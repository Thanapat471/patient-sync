import type { Metadata } from 'next'
import PatientForm from '@/components/patient/PatientForm'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Patient registration',
}

export default async function PatientSessionPage({
  params,
}: {
  readonly params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Patient registration
          </h1>
          <Badge variant="outline" className="font-mono">
            {sessionId.slice(0, 8)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Fill this in at your own pace — reception can already see your answers
          as you type, so nothing is lost if you stop partway.
        </p>
      </header>

      {/* Keyed so a new registration gets a genuinely fresh component — empty
          form, cleared timers — rather than one that resets itself. */}
      <PatientForm key={sessionId} sessionId={sessionId} />
    </main>
  )
}
