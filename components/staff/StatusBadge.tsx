import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/store/useStaffStore'

const statusStyles: Record<SessionStatus, string> = {
  filling: 'bg-status-filling-bg text-status-filling-fg',
  inactive: 'bg-status-inactive-bg text-status-inactive-fg',
  submitted: 'bg-status-submitted-bg text-status-submitted-fg',
}

const dotStyles: Record<SessionStatus, string> = {
  filling: 'bg-status-filling',
  inactive: 'bg-status-inactive',
  submitted: 'bg-status-submitted',
}

export const statusLabels: Record<SessionStatus, string> = {
  filling: 'Actively filling',
  inactive: 'Inactive',
  submitted: 'Submitted',
}

export default function StatusBadge({
  status,
  className,
}: {
  readonly status: SessionStatus
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        statusStyles[status],
        className
      )}
    >
      <span className="relative flex size-1.5">
        {/* Only the live state pulses; idle and finished shouldn't keep
            drawing the eye across the queue. */}
        {status === 'filling' && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              dotStyles[status]
            )}
          />
        )}
        <span
          className={cn('relative inline-flex size-1.5 rounded-full', dotStyles[status])}
        />
      </span>
      {statusLabels[status]}
    </span>
  )
}
