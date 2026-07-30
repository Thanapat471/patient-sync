'use client'

import { useStaffStore } from '@/store/useStaffStore'
import type { Patient } from '@/lib/schema'

const fields: { key: keyof Patient; label: string }[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'preferredLanguage', label: 'Preferred language' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'religion', label: 'Religion' },
  { key: 'emergencyContactName', label: 'Emergency contact name' },
  { key: 'emergencyContactRelationship', label: 'Emergency contact relationship' },
]

function MirrorField({
  sessionId,
  fieldKey,
  label,
}: {
  sessionId: string
  fieldKey: keyof Patient
  label: string
}) {
  const value = useStaffStore((state) => state.sessions[sessionId]?.fields[fieldKey])

  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-1 min-h-9 rounded-md border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
        {value || <span className="text-zinc-400">—</span>}
      </div>
    </div>
  )
}

export default function LiveMirrorForm({ sessionId }: { sessionId: string }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      {fields.map(({ key, label }) => (
        <MirrorField key={key} sessionId={sessionId} fieldKey={key} label={label} />
      ))}
    </div>
  )
}
