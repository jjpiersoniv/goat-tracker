import { NextRequest, NextResponse } from 'next/server'
import { buildExcel } from '@/lib/excel'
import { ScrapeResult } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  try {
    const results: ScrapeResult[] = await req.json()
    const today = new Date().toISOString().split('T')[0]
    const buf = buildExcel(results)
    const arr = new Uint8Array(buf)
    const res = new NextResponse(arr, { status: 200 })
    res.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.headers.set('Content-Disposition', `attachment; filename="RentTracker_${today}.xlsx"`)
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
