import * as XLSX from 'xlsx'
import { ScrapeResult, computeStats } from './scraper'

export function buildExcel(results: ScrapeResult[]): Buffer {
  const wb = XLSX.utils.book_new()

  for (const result of results) {
    const sheetName = result.property_name.substring(0, 31).replace(/[\\/:*?[\]]/g, '')

    const rows: (string | number)[][] = [
      [result.property_name.toUpperCase()],
      ['RENT TRACKER'],
      [result.date],
      [],
      [],
      ['', 'FLOORPLAN', 'SQUARE FOOTAGE', 'UNITS AVAILABLE', 'LOWEST PRICE', '2ND LOWEST PRICE', 'HIGHEST PRICE', 'WEIGHTED AVERAGE OF AVAILABLE UNITS'],
    ]

    for (const fp of result.floorplans) {
      const s = computeStats(fp.prices)
      rows.push([
        '',
        fp.name,
        fp.sqft ?? '',
        s.count,
        s.lowest ?? '',
        s.second ?? '',
        s.highest ?? '',
        s.wavg ?? '',
      ])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 2 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
