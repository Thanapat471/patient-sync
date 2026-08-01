'use client'

import Link from 'next/link'
import { ExternalLink, Inbox, MousePointerClick } from 'lucide-react'
import SessionList from '@/components/staff/SessionList'
import LiveMirrorForm from '@/components/staff/LiveMirrorForm'
import StatusBadge from '@/components/staff/StatusBadge'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { useStaffSync } from '@/hooks/useStaffSync'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const countedStatuses: SessionStatus[] = ['filling', 'inactive', 'submitted']

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  readonly icon: typeof Inbox
  readonly title: string
  readonly body: string
  readonly action?: React.ReactNode
}) {
  return (
    <Card className="py-12">
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
            {body}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

export default function StaffPage() {
  useStaffSync()
  const selectedSessionId = useStaffStore((state) => state.selectedSessionId)
  const sessions = useStaffStore((state) => state.sessions)

  const sessionCount = Object.keys(sessions).length
  const counts = Object.values(sessions).reduce<Record<string, number>>(
    (acc, session) => {
      acc[session.status] = (acc[session.status] ?? 0) + 1
      return acc
    },
    {}
  )

  let mainContent: React.ReactNode
  if (selectedSessionId && sessions[selectedSessionId]) {
    mainContent = <LiveMirrorForm sessionId={selectedSessionId} />
  } else if (sessionCount > 0) {
    mainContent = (
      <EmptyState
        icon={MousePointerClick}
        title="Select a session"
        body="Pick a patient from the list to watch their form fill in field by field."
      />
    )
  } else {
    mainContent = (
      <EmptyState
        icon={Inbox}
        title="Waiting for a patient session"
        body="Sessions appear here the moment a patient opens the registration form. Nothing to do but wait — or start one yourself to try it out."
        action={
          <Button asChild variant="outline" className="mt-2 h-10 px-4">
            <Link
              href="/patient"
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open a patient form
              <ExternalLink />
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 md:flex-row">
      <aside className="w-full shrink-0 md:w-80">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sessions
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {sessionCount}
          </span>
        </div>

        {sessionCount > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {countedStatuses
              .filter((status) => counts[status])
              .map((status) => (
                <span key={status} className="inline-flex items-center gap-1">
                  <StatusBadge status={status} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {counts[status]}
                  </span>
                </span>
              ))}
          </div>
        )}

        <SessionList />
      </aside>

      <main className="min-w-0 flex-1">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Staff live view
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Read-only. Fields update as the patient types.
          </p>
        </header>
        {mainContent}
      </main>
    </div>
  )
}
