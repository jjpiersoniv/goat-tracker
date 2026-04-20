import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rent Tracker | Multifamily Pricing Tool',
  description: 'Pull live apartment pricing directly from property websites',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
