# Development Notes

## Project Structure

```
app/
  layout.tsx                  fonts, metadata, ThemeProvider, AppHeader, Toaster
  globals.css                 design tokens (light + dark) and the status palette
  page.tsx                    landing page — what this is, links into both sides
  patient/
    page.tsx                  generates a session uuid, redirects to /patient/<uuid>
    [sessionId]/page.tsx      renders PatientForm for that session
  staff/
    page.tsx                  session list + live mirror, wired to useStaffSync

components/
  ui/                         shadcn/ui primitives (generated, edited rarely)
  layout/AppHeader.tsx        logo, active-aware nav, theme toggle
  patient/PatientForm.tsx     react-hook-form + zodResolver, rendered from metadata
  staff/SessionList.tsx       sorted session queue with status + "last seen"
  staff/StatusBadge.tsx       the filling / inactive / submitted pill
  staff/LiveMirrorForm.tsx    read-only mirror, one Zustand selector per field

hooks/
  usePatientSync.ts           patient side: broadcast + presence + idle timer
  useStaffSync.ts             staff side: presence discovery + broadcast listeners

lib/
  schema.ts                   single source of truth — the Zod patientSchema
  patientFields.ts            per-field label / input type / section metadata
  supabase.ts                 browser Supabase client
  realtime.ts                 shared channel-name constants
  patientSubmissions.ts       insert/fetch helpers for the patient_submissions table
  utils.ts                    `cn()` (clsx + tailwind-merge), from shadcn

store/
  useStaffStore.ts            Zustand store: sessions, selected session, actions

supabase/migrations/
  001_patient_submissions.sql the table + RLS policies (run manually in Supabase)
```

There's no `src/` folder — `create-next-app` scaffolded `app/` at the project
root, so every later file follows that same convention instead of the `src/`
paths in the original plan.

## Design system

The visual layer is shadcn/ui (Radix primitives + lucide icons, `radix-nova`
preset) on top of Tailwind v4. Nothing renders a raw hex colour: `app/globals.css`
owns every token, including three the project adds on top of shadcn's set —
`--status-filling`, `--status-inactive`, `--status-submitted`, each with a `-bg`
and `-fg` pair. `StatusBadge` is the only component that reads them, so the three
session states look identical everywhere they appear and can be re-themed in one
place.

Dark mode is class-based (`next-themes`, `defaultTheme="system"`), so it follows
the OS by default with a manual override in the header. The theme toggle picks
its icon with CSS (`hidden dark:block`) rather than render state — a mount guard
would either flash the wrong icon or trip React's rule against `setState` in an
effect.

## Design decisions per screen size

Both pages are built mobile-first with Tailwind's default breakpoints:

- **Patient form** (`components/patient/PatientForm.tsx`): four `Card` sections
  (personal / contact / background / emergency) each holding a
  `grid-cols-1 md:grid-cols-2` — one column under 768px, two from `md:` up.
  Address spans both columns (`fullWidth` in the field metadata) at every size,
  since a wide free-text field looks cramped at half width. Sections are on one
  scrolling page rather than a multi-step wizard: react-hook-form unregisters
  unmounted fields by default, so stepping between screens would drop values the
  patient had already typed *and* already broadcast to staff.
- **Staff view** (`app/staff/page.tsx`): `flex-col md:flex-row`. On mobile the
  session queue stacks above the mirrored form; from `md:` up they sit side by
  side with the sidebar fixed at `md:w-80` so the mirror keeps its two columns.
  The mirror repeats the patient's own four sections in the same order, so staff
  are looking at the layout the patient is looking at.
- **Header** (`components/layout/AppHeader.tsx`): with only two destinations,
  the nav labels simply collapse below `sm:` and leave the icons — cheaper and
  more usable than a drawer.

Verified at 375px (iPhone SE-class) and 1440px (laptop).

## Component architecture

- **`lib/schema.ts` is the only place the patient shape is defined.** Every
  other file — the form, the store, the DB row mapping — derives its types
  from `z.infer<typeof patientSchema>`. Nothing redeclares the 13 fields.
- **`lib/patientFields.ts` is the only place field *presentation* is defined.**
  Label, input type, placeholder, section and column span for each field live
  there once, and both the patient form and the staff mirror render from it —
  neither component contains a hand-written field list. It's typed
  `Record<keyof Patient, PatientFieldMeta>`, so adding a field to the schema and
  forgetting the metadata is a `tsc` error rather than a field that silently
  never appears. This is the seam that makes the form cheap to extend: a new
  field is a two-file change and both screens update.
  - The one field that needs special handling is `gender`. shadcn's `Select` is
    a Radix listbox, not a native `<select>`, so it's wired with `Controller`
    instead of `register()` — which keeps it inside react-hook-form and
    therefore keeps it flowing through the `watch` subscription that drives
    the realtime broadcast.
- **The patient form and the staff mirror are separate components that both
  read from the same schema**, but never share state directly — they only
  talk to each other over Supabase Realtime. The staff view is read-only by
  construction: `LiveMirrorForm` renders `<div>`s, not `<input>`s, and
  `useStaffSync` never sends anything back to a patient's channel.
- **Zustand with per-field selectors.** `useStaffStore` keeps
  `sessions: Record<sessionId, { fields, status, lastSeen }>`.
  `LiveMirrorForm` renders one `MirrorField` subcomponent per field, and each
  one selects only its own value (`state.sessions[id]?.fields[fieldKey]`), so
  a single keystroke re-renders one mirrored field, not the whole dashboard.

## Real-time synchronization flow

There are two Realtime channels in play, plus one Postgres table:

1. **`patient-session-<uuid>`** — one broadcast channel per patient visit.
   - Patient → sends a `field_update` event (`{ field, value }`) on every
     change, throttled to one message per 300ms (`lodash.throttle`, never
     debounce — staff need to see typing *as it happens*, not after a pause).
   - Patient → sends a `state_snapshot` event (the whole set of values typed so
     far), throttled to once per 3s. This is the catch-up path for a dashboard
     that connected mid-session and missed the earlier keystrokes.
   - Patient → sends a `submitted` event once, right after a successful
     database insert.
   - Staff → listens for all three events and writes them into the Zustand
     store.

2. **`patient-lobby`** — one shared presence channel every patient session
   joins, keyed by its own session id. This exists specifically so the staff
   dashboard can *discover* which sessions are active without knowing their
   uuids in advance: staff subscribes to this one channel and, for every
   session id it sees, dynamically joins that session's broadcast channel.
   - Presence payload: `{ status: 'filling' | 'inactive', fields }`.
     `status` flips to `inactive` after 15s with no keystrokes, and back to
     `filling` on the next one (or on window blur/focus).
   - **`track()` fires only when the status genuinely flips** — never on a
     timer, and never per keystroke. Supabase rate-limits presence server-side;
     an earlier version refreshed the presence payload every 2.5s and the
     server answered with `Client presence rate limit exceeded` and a
     `phx_close` after roughly six calls. The visible symptom was a badge
     flickering to "Inactive" while the patient was still typing. Everything
     high-frequency was moved to broadcast, which has far higher limits.
   - Recovery from a dropped presence channel creates a *new* channel object
     for the same topic rather than resubscribing the old one — a Phoenix
     channel can only be joined once, and calling `.subscribe()` twice throws
     "tried to join multiple times".
   - The `fields` snapshot still rides along in the presence payload, because
     an idle patient sends no broadcasts at all — for them it's the only
     up-to-date copy a newly connected staff tab can pick up, which is what
     stops the queue showing "Unnamed patient" after a staff refresh.
   - Closing the patient tab fires Presence's automatic `leave` event, and the
     session is **retired from the queue immediately** — the same rule every
     presence UI follows. Earlier the leave only flipped the badge to
     `inactive` and left the row behind, so the queue only ever grew: every
     abandoned or reloaded session left a dead row that a page refresh would
     clear but the live view never did.
     - Submitted sessions are exempt. They're real records that outlive the
       connection, and they're re-read from Postgres on load.
     - Presence state, not the leave event, is the authority — the `sync`
       handler retires anything in the store that has vanished from presence,
       so a dropped or missed `leave` still gets reconciled.
     - This is why `inactive` means *idle but still connected*, and nothing
       else: a patient who is gone is gone from the list, not greyed out in
       it. The 15s idle timer is the only thing that produces that badge.

### Inactivity expiry

Presence is honest about a tab that is simply left open: the socket is alive, so
the session stays in reception's queue forever with whatever the patient had
typed still on screen. Nothing on the staff side can fix that without fighting
presence — the `sync` handler re-adds anything still being advertised — so the
patient tab, which is the one that knows it has been abandoned, ends its own
session.

This is the kiosk pattern (airport check-in, ATMs), which is what a registration
form on a clinic device is. The driver is privacy, not tidiness: the form holds
name, date of birth, address and religion, and an abandoned session exposes the
previous patient to whoever sits down next. Automatic termination after
inactivity is the standard control for this — it's the "automatic logoff"
specification in the HIPAA Security Rule, §164.312(a)(2)(iii). Clearing the
staff queue is a side effect.

The ladder, all reset together by any keystroke or window focus:

| After | What happens |
|---|---|
| 15s | Staff badge flips to `Inactive`. Nothing is discarded. |
| 3 min | Sticky "Are you still filling this in?" banner with a 60s countdown and an **I'm still here** button. |
| +60s | Session expires: presence is untracked, form state is `reset()`, and the page shows "Session ended". |

Notes on the implementation:

- The countdown timer is only armed **when the warning is rendered**, not up
  front, so the patient always gets the full grace period to react to it.
- The warning is a sticky banner, not a modal — a modal would trap focus and
  block the very typing that dismisses it. Any activity (a keystroke, window
  focus, pressing Submit, the button itself) both resets the timers *and*
  clears the banner — resetting one without the other leaves a countdown
  frozen at 0s over a form that is no longer going to expire.
- Pressing Submit counts as activity so the session cannot expire while the
  database insert is in flight — expiry mid-insert would untrack presence,
  staff would drop the session's channels, and the `submitted` broadcast that
  follows would be lost until a staff refresh.
- Expiry calls `reset()` as well as swapping the view. Unmounting the inputs
  clears the screen but would leave the values sitting in react-hook-form state,
  which defeats the point.
- `PatientForm` is keyed on `sessionId`, so "Start a new registration" produces a
  genuinely fresh component rather than one that has to remember to reset itself.
- There is deliberately no silent auto-resume. Typing after expiry does nothing;
  the only way forward is a new session. If a different person has walked up,
  restoring the previous patient's answers is exactly the outcome being avoided.

Both durations are constants at the top of `hooks/usePatientSync.ts` — drop them
to a few seconds to exercise the flow by hand.

### Session ids must be minted per visit

`/patient` exists only to generate a `crypto.randomUUID()` and redirect to
`/patient/<uuid>`. Two things make that fragile, and both bit us:

- **It must be `export const dynamic = 'force-dynamic'`.** Otherwise Next.js
  prerenders the route at build time: `randomUUID()` runs once, the redirect
  target is baked into the build, and *every* patient on the deployed site
  lands on the same session — sharing a channel and overwriting each other.
  Verified against a production build: without the flag, five requests all
  returned `location: /patient/64146b64-…`; with it, five unique ids.
- **It must never be prefetched or client-cached.** A `<Link href="/patient">`
  goes through the client Router Cache, which can replay a redirect it already
  resolved and hand the next patient a session that was already submitted.
  Links to it pass `prefetch={false}`, and the "Start another registration"
  button generates the uuid on the client and calls `router.replace()` rather
  than routing through `/patient` at all.

As defence in depth, `setField` and `mergeFields` in the store refuse to touch a
session whose status is already `submitted` — a submitted record is final no
matter how a stray update reaches it.

3. **`patient_submissions` table** — the only thing written to Postgres.
   Broadcast is ephemeral by design; nothing typed mid-form is persisted. On
   submit: validate with Zod → insert the row → broadcast `submitted`. Staff
   loads existing rows from this table on mount, so already-submitted
   patients still show up after a refresh.

## Security trade-offs

No authentication was in scope for this project. As a result:

- Channel topics (`patient-session-<uuid>`) and the session URL are
  UUID-based rather than permission-checked — anyone with the link can join
  that session's channel.
- The `patient_submissions` table has row-level security enabled, with
  public `insert` and `select` policies for the `anon` role (no `update` or
  `delete` policy, so submitted records can't be altered or removed through
  the app or the public API key).
- In a real deployment this would need at minimum: staff authentication
  before `/staff` is reachable, and RLS policies scoped to authenticated
  staff rather than the public `anon` role.
