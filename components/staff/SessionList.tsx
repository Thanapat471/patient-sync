'use client'

import { useEffect, useState } from 'react'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { cn } from '@/lib/utils'
import StatusBadge from '@/components/staff/StatusBadge'

/** Live sessions first, then idle, then the ones already done. */
const statusOrder: Record<SessionStatus, number> = {
  filling: 0,
  inactive: 1,
  submitted: 2,
}

function relativeTime(from: number, now: number) {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.at(-1)?.[0] ?? '')).toUpperCase()
}

export default function SessionList() {
  const sessions = useStaffStore((state) => state.sessions)
  const selectedSessionId = useStaffStore((state) => state.selectedSessionId)
  const selectSession = useStaffStore((state) => state.selectSession)

  // One timer for the whole list rather than one per row, purely to keep the
  // "…s ago" labels moving between realtime events.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const sessionIds = Object.keys(sessions).sort((a, b) => {
    const byStatus =
      statusOrder[sessions[a].status] - statusOrder[sessions[b].status]
    return byStatus !== 0 ? byStatus : sessions[b].lastSeen - sessions[a].lastSeen
  })

  if (sessionIds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No sessions yet.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessionIds.map((sessionId) => {
        const session = sessions[sessionId]
        const name =
          [session.fields.firstName, session.fields.lastName]
            .filter(Boolean)
            .join(' ') || 'Unnamed patient'
        const isSelected = selectedSessionId === sessionId

        return (
          <li key={sessionId}>
            <button
              type="button"
              onClick={() => selectSession(sessionId)}
              aria-current={isSelected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                isSelected
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-muted/60'
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {initials(name === 'Unnamed patient' ? '' : name)}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn(
                    'truncate text-sm font-medium',
                    name === 'Unnamed patient' && 'text-muted-foreground italic'
                  )}
                >
                  {name}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge status={session.status} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {relativeTime(session.lastSeen, now)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
