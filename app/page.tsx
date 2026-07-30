import Link from 'next/link'
import { ArrowRight, Database, Radio, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const highlights = [
  {
    icon: Radio,
    title: 'Live as they type',
    body: 'Every keystroke is broadcast over a Supabase Realtime channel, throttled to one message per 300ms — staff see the form fill in, not a finished snapshot.',
  },
  {
    icon: UserCheck,
    title: 'Presence-based status',
    body: 'Each session reports whether the patient is actively filling, has gone idle for 15 seconds, or has submitted — and a closed tab is detected automatically.',
  },
  {
    icon: Database,
    title: 'Persisted on submit',
    body: 'Typing stays ephemeral. On submit the record is validated and written to Postgres, so a staff refresh still shows every completed registration.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-20">
      <section className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-filling opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-status-filling" />
          </span>
          <span>Real-time patient intake</span>
        </span>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Watch a registration form fill in{' '}
          <span className="text-primary">as it happens</span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
          Patients complete a registration form on their own device. Staff open a
          dashboard and see every field appear live, alongside a status
          indicator for each patient in the queue.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-5 text-sm">
            {/* Never prefetched — this route mints a session on every visit. */}
            <Link href="/patient" prefetch={false}>
              Start patient form
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-sm">
            <Link href="/staff">Open staff dashboard</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Tip: open the two pages side by side — or on a phone and a laptop — to
          see them sync.
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:mt-20 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4.5" />
              </span>
              <CardTitle className="mt-3">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
