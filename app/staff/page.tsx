'use client'

import SessionList from '@/components/staff/SessionList'
import LiveMirrorForm from '@/components/staff/LiveMirrorForm'
import { useStaffStore } from '@/store/useStaffStore'
import { useStaffSync } from '@/hooks/useStaffSync'

export default function StaffPage() {
  useStaffSync()
  const selectedSessionId = useStaffStore((state) => state.selectedSessionId)
  const hasSessions = useStaffStore((state) => Object.keys(state.sessions).length > 0)

  let mainContent: React.ReactNode
  if (selectedSessionId) {
    mainContent = <LiveMirrorForm sessionId={selectedSessionId} />
  } else if (hasSessions) {
    mainContent = <p className="text-sm text-zinc-500">Select a session to view details.</p>
  } else {
    mainContent = (
      <p className="text-sm text-zinc-500">Waiting for a patient session to start…</p>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-6 md:flex-row">
      <aside className="w-full shrink-0 md:w-72">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Sessions
        </h2>
        <SessionList />
      </aside>
      <main className="flex-1">
        <h1 className="mb-6 text-2xl font-semibold text-foreground">Staff Live View</h1>
        {mainContent}
      </main>
    </div>
  )
}
