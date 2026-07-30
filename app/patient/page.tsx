import { redirect } from 'next/navigation'

/**
 * Every visit must mint a fresh session id.
 *
 * Without this, Next.js prerenders the route at build time: `randomUUID()` runs
 * once, the redirect target is baked into the build, and every patient who ever
 * opens the deployed site lands on the *same* session — sharing a channel and
 * overwriting each other's answers.
 */
export const dynamic = 'force-dynamic'

export default function PatientEntryPage() {
  redirect(`/patient/${crypto.randomUUID()}`)
}
