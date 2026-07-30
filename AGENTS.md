# PLAN.md — 3-day build order

Rule: finish a phase, verify it, commit it, then `/clear` before the next phase.
Never start a phase while the previous one is unverified.

---

## Phase 0 — Foundation (2 hours)

- [ ] `npx create-next-app@latest agnos-patient-sync` → TypeScript: yes, Tailwind: yes, App Router: yes
- [ ] `npm i @supabase/supabase-js zustand react-hook-form`
- [ ] `npm i zod @hookform/resolvers` (same command, versions must match)
- [ ] `npm i lodash.throttle && npm i -D @types/lodash.throttle`
- [ ] Create Supabase project → copy Project URL + publishable key into `.env.local`
- [ ] `src/lib/supabase.ts` — browser client
- [ ] `src/lib/schema.ts` — Zod schema for all 13 fields (First, Middle?, Last, DOB, Gender,
      Phone, Email, Address, Preferred Language, Nationality, Emergency Contact name?,
      Emergency Contact relationship?, Religion?)
- [ ] `git init` + first commit

**Verify:** `npx tsc --noEmit` passes and `npm run dev` serves a blank page with no console errors.

---

## Phase 1 — Patient form UI (3 hours)

- [ ] `src/app/patient/page.tsx`
- [ ] `src/components/patient/PatientForm.tsx` with react-hook-form + zodResolver
- [ ] Validation messages visible under each field; phone and email rules enforced
- [ ] Responsive: single column on mobile, two columns from `md:` up

**Verify:** submitting an empty form shows errors on every required field; a valid form passes.
Screenshot at 375px and 1440px.

---

## Phase 2 — Staff view UI, no realtime yet (2 hours)

- [ ] `src/store/useStaffStore.ts` — Zustand: `sessions: Record<sessionId, {fields, status, lastSeen}>`
- [ ] `src/components/staff/SessionList.tsx` — list of sessions + status badge
- [ ] `src/components/staff/LiveMirrorForm.tsx` — read-only mirror of the selected session
- [ ] `src/app/staff/page.tsx`
- [ ] Feed it hardcoded fake data first so the layout is done before the wiring

**Verify:** with fake data in the store, both pages look right at 375px and 1440px.

---

## Phase 3 — Realtime wiring (half a day, the risky part)

- [ ] `src/hooks/usePatientSync.ts` — join channel `patient-session-<uuid>`, send
      `field_update` events through `throttle(..., 300)`
- [ ] `src/hooks/useStaffSync.ts` — subscribe, write incoming payloads into the store
- [ ] Session id: generate a `crypto.randomUUID()` per patient visit, keep it in the URL
- [ ] Channel cleanup with `supabase.removeChannel(channel)` in the effect return

**Verify:** two browser windows side by side. Typing in `/patient` shows up in `/staff` within
about a second, and the Network tab shows one WebSocket, not a flood of requests.

**If nothing arrives:** first check whether the channel is public or private. Public channels
need no policy. Only add RLS policies on `realtime.messages` if you set `private: true` or
your project has public access turned off.

---

## Phase 4 — Status indicator + persistence (half a day)

- [ ] Presence: `channel.track({ status: 'filling' | 'inactive' })` on focus/blur
- [ ] Auto-inactive after ~15s of no keystrokes; back to filling on the next keystroke
- [ ] Tab close → presence leave event → staff shows inactive
- [ ] Table `patient_submissions` created in Supabase
- [ ] Submit → validate → INSERT → broadcast `submitted` → staff badge turns Submitted
- [ ] Staff refresh still shows submitted records (read from the table on mount)

**Verify:** walk all three states in front of two windows — typing, idle 20s, submit — then
refresh the staff page and confirm the submitted record is still there.

---

## Phase 5 — Deploy + docs (Day 3)

- [ ] `npm run build` passes locally
- [ ] Push to GitHub
- [ ] Deploy on Vercel, add the two env vars in project settings, redeploy
- [ ] Test the live URL from a phone and a laptop at the same time
- [ ] `README.md`: overview, setup steps, env vars, how to run, bonus features
- [ ] `DEVELOPMENT.md`: Project Structure · Design decisions per screen size ·
      Component Architecture · Real-Time Synchronization Flow
- [ ] Note the security trade-off honestly: no auth was in scope, so channel topics are
      UUID-based rather than permission-checked

**Verify:** open the deployed `/patient` on your phone and `/staff` on your laptop and watch
it sync. That video/GIF is the strongest thing you can put in the README.

---

## Cut list if time runs short

Cut in this order: Shadcn UI → Postgres persistence → the idle timer.
Never cut: responsive layout, validation, live sync, deployed URL, the two docs.
