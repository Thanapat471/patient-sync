import { redirect } from 'next/navigation'

/**
 * Required. Without it Next.js prerenders this route: `randomUUID()` runs once
 * at build time, the redirect target is baked in, and every patient on the
 * deployed site lands on the *same* session — sharing a channel and
 * overwriting each other's answers.
 */
export const dynamic = 'force-dynamic'

export default function PatientEntryPage() {
  redirect(`/patient/${crypto.randomUUID()}`)
}
