'use client'

import { useEffect } from 'react'
import SessionList from '@/components/staff/SessionList'
import LiveMirrorForm from '@/components/staff/LiveMirrorForm'
import { useStaffStore } from '@/store/useStaffStore'
import { fakeSessions } from '@/store/fakeSessions'

export default function StaffPage() {
  const selectedSessionId = useStaffStore((state) => state.selectedSessionId)
  const selectSession = useStaffStore((state) => state.selectSession)
  const upsertSession = useStaffStore((state) => state.upsertSession)

  useEffect(() => {
    Object.entries(fakeSessions).forEach(([sessionId, session]) => {
      upsertSession(sessionId, session)
    })
    selectSession(Object.keys(fakeSessions)[0])
  }, [upsertSession, selectSession])

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
        {selectedSessionId ? (
          <LiveMirrorForm sessionId={selectedSessionId} />
        ) : (
          <p className="text-sm text-zinc-500">Select a session to view details.</p>
        )}
      </main>
    </div>
  )
}
