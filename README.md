# Patient Sync — Patient Form + Staff Live View

Two pages that stay in sync in real time: a patient fills out a registration form,
and staff watch it fill in live on a separate dashboard, with a status indicator
that shows whether the patient is actively filling, idle, or has submitted.

**Live demo:** https://patient-sync-azure.vercel.app
&nbsp;&nbsp;·&nbsp;&nbsp;[Patient form](https://patient-sync-azure.vercel.app/patient)
&nbsp;&nbsp;·&nbsp;&nbsp;[Staff dashboard](https://patient-sync-azure.vercel.app/staff)

Open `/patient` on a phone and `/staff` on a laptop at the same time to see them
sync.

- `/` — overview with links into both sides
- `/patient` — generates a new session, then shows the registration form
- `/staff` — lists every active patient session and mirrors the selected one live

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase Realtime
(Broadcast + Presence) · Supabase Postgres · Zustand · React Hook Form + Zod ·
lodash.throttle

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project at [supabase.com](https://supabase.com), then run
   the SQL in [`supabase/migrations/001_patient_submissions.sql`](supabase/migrations/001_patient_submissions.sql)
   in the Supabase SQL Editor to create the `patient_submissions` table.

3. Create a `.env.local` file in the project root with:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
   ```

   Both values are on the **Project Settings → Data API** page of your Supabase
   project. `.env.local` is already git-ignored — never commit real keys.

## Running locally

```bash
npm run dev       # http://localhost:3000
npx tsc --noEmit  # type check
npm run lint      # lint
npm run build     # production build
```

Open `/patient` in one window and `/staff` in another to see the sync live.

## Deploying

Deployed on Vercel. When importing the repo, add the same two environment
variables from `.env.local` in the Vercel project settings before the first
deploy. Every push to `main` redeploys automatically.

## How the sync works (short version)

- The patient page generates a session id (`crypto.randomUUID()`) and keeps it
  in the URL (`/patient/<uuid>`).
- Every keystroke is sent over a Supabase Realtime **broadcast** channel,
  throttled to one message per 300ms — never on every single keystroke.
- A separate lightweight **presence** channel lets the staff dashboard discover
  which sessions are currently active, without needing to know session ids in
  advance, and tracks a `filling` / `inactive` status.
- On submit, the data is validated (Zod) and inserted into the
  `patient_submissions` table, then a `submitted` event is broadcast so the
  staff badge updates immediately. Staff refreshing the page still sees
  submitted records, because those are read from the database on load.

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for the full breakdown, including the
project structure, responsive design decisions, and the detailed real-time
flow.

## Bonus features (beyond the minimum spec)

- **Multi-session staff dashboard** — staff can see and switch between
  *multiple* patients filling out forms at the same time, not just one.
- **Idle detection while still connected** — the status flips to "Inactive"
  after ~15s of no keystrokes even if the tab stays open and focused, and
  flips back to "Actively filling" on the next keystroke.
- **Reload-safe live state** — if a staff browser refreshes mid-session
  (before the patient submits), it recovers the most recently typed values
  from Realtime Presence instead of showing "Unnamed patient" until the next
  keystroke.
- **Resilient presence channel** — the presence connection self-heals if it
  silently drops after a period of inactivity, instead of getting stuck.
- **Inactivity session expiry** — an abandoned form warns the patient, then
  clears itself and releases the session, so the previous patient's details
  aren't left readable on a shared device and reception's queue doesn't fill
  up with sessions nobody is filling in.
- **Schema-driven UI** — labels, input types and section grouping live in one
  file (`lib/patientFields.ts`), typed against the Zod schema. Adding a field
  means editing the schema and that file; both the patient form and the staff
  mirror pick it up, and forgetting either half fails the type check.
- **Considered UI/UX** — a design-token layer (light and dark, following the OS
  with a manual override), mirrored fields that flash when a value arrives so
  staff can see *where* the patient is typing, a live-pulsing status badge,
  relative "last seen" timestamps, and a sorted queue that puts actively
  filling patients first.

## Known trade-offs

No authentication was in scope. Session ids are unguessable UUIDs, and channel
topics / RLS policies are UUID- and public-role-based rather than
permission-checked. See [`DEVELOPMENT.md`](DEVELOPMENT.md#security-trade-offs)
for details.
