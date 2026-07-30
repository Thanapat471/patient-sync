import { redirect } from 'next/navigation'

export default function PatientEntryPage() {
  redirect(`/patient/${crypto.randomUUID()}`)
}
