import { NextRequest, NextResponse } from 'next/server'
import { scrapeProperty } from '@/lib/scraper'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    const result = await scrapeProperty(url)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to scrape property'
    console.error('Scrape error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
