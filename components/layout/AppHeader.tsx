'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Activity, ClipboardList, MonitorDot, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  // /patient mints a session per visit — never prefetch or client-cache it.
  { href: '/patient', label: 'Patient', icon: ClipboardList, prefetch: false },
  { href: '/staff', label: 'Staff', icon: MonitorDot, prefetch: undefined },
]

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {/* CSS decides which icon shows, off the `.dark` class. The server can't
          know the visitor's OS theme, so deciding in render would mismatch. */}
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  )
}

export default function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Patient<span className="text-primary">Sync</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon, prefetch }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                prefetch={prefetch}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {/* Only two links, so labels just collapse on small screens
                    rather than needing a drawer. */}
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
          <div className="mx-1 h-5 w-px bg-border" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
