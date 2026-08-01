import type { Metadata } from 'next'

// The staff page itself is a client component (it drives realtime hooks), so
// its metadata lives in this pass-through server layout.
export const metadata: Metadata = {
  title: 'Staff live view',
}

export default function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
