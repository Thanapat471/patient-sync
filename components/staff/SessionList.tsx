'use client'

import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'

const statusStyles: Record<SessionStatus, string> = {
  filling: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  inactive: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  submitted: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
}

const statusLabels: Record<SessionStatus, string> = {
  filling: 'Actively filling',
  inactive: 'Inactive',
  submitted: 'Submitted',
}

export default function SessionList() {
  const sessions = useStaffStore((state) => state.sessions)
  const selectedSessionId = useStaffStore((state) => state.selectedSessionId)
  const selectSession = useStaffStore((state) => state.selectSession)

  const sessionIds = Object.keys(sessions)

  if (sessionIds.length === 0) {
    return <p className="text-sm text-zinc-500">No active sessions.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessionIds.map((sessionId) => {
        const session = sessions[sessionId]
        const name =
          [session.fields.firstName, session.fields.lastName]
            .filter(Boolean)
            .join(' ') || 'Unnamed patient'

        return (
          <li key={sessionId}>
            <button
              type="button"
              onClick={() => selectSession(sessionId)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selectedSessionId === sessionId
                  ? 'border-black/40 dark:border-white/40'
                  : 'border-black/10 dark:border-white/15'
              }`}
            >
              <span>{name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[session.status]}`}
              >
                {statusLabels[session.status]}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
