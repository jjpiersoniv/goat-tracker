import { NextRequest, NextResponse } from 'next/server'
import { buildExcel } from '@/lib/excel'
import { ScrapeResult } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  try {
    const results: ScrapeResult[] = await req.json()
    const buf = buildExcel(results)
    const today = new Date().toISOString().split('T')[0]
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="RentTracker_${today}.xlsx"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
