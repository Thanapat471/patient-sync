@AGENTS.md
# Agnos Assignment — Patient Form + Staff Live View

Two pages that stay in sync in real time: patients fill a form, staff watch it fill in live
with a status indicator (submitted / actively filling / inactive).

## Commands

- Dev server: `npm run dev`
- Type check: `npx tsc --noEmit`  ← run after finishing a series of edits
- Lint: `npm run lint`
- Production check before deploy: `npm run build`

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix + lucide-react,
`radix-nova` preset) · next-themes · sonner · Supabase Realtime (Broadcast + Presence)
· Zustand · React Hook Form + Zod · lodash.throttle

Do not add libraries beyond this list without asking first.

## Hard rules

- **One source of truth for types.** The patient shape lives only in `src/lib/schema.ts`.
  Everything else uses `z.infer<typeof patientSchema>`. Never redeclare the fields.
- **One source of truth for field presentation.** Labels, input types and section grouping
  live only in `lib/patientFields.ts`, typed `Record<keyof Patient, PatientFieldMeta>` so a
  field added to the schema but missing here fails `tsc`. Both the patient form and the
  staff mirror render from it — never hand-write a field list in a component.
- **Throttle, never debounce.** All outgoing realtime sends go through `throttle(fn, 300)`.
  Debounce waits for the user to stop typing, which breaks the "live as the patient types"
  requirement.
- **Broadcast is ephemeral.** Live typing goes over the channel only. On submit, INSERT the
  record into the `patient_submissions` table so the data survives a staff refresh.
- **Staff view is read-only.** It subscribes and renders; it never sends field updates.
- **Zustand with selectors.** Each mirrored field subscribes to its own slice so a keystroke
  re-renders one input, not the whole dashboard.
- **Mobile-first.** Check 375px and 1440px for both pages before calling a phase done.
- **No secrets in git.** Keys live in `.env.local` only. Client key is the publishable key
  (`sb_publishable_...`) exposed as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Gotchas

- Install `zod` and `@hookform/resolvers` in the same command so their versions match;
  mismatched versions break `zodResolver` typing at build time even when runtime works.
- Realtime code must run client-side only (`'use client'`), and channels must be removed in
  the effect cleanup or subscriptions leak across navigations.
- Presence needs an explicit "inactive" path: unload/blur, plus the automatic leave event
  when the tab closes.

## Compact instructions

When compacting, always preserve: the current phase in PLAN.md, the list of files changed,
any realtime configuration that is confirmed working, and unresolved bugs.
