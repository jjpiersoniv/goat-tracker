import { chromium } from 'playwright'

export interface Floorplan {
  name: string
  sqft: number | null
  beds: string
  baths: string
  prices: number[]
}

export interface ScrapeResult {
  property_name: string
  url: string
  date: string
  floorplans: Floorplan[]
}

export function computeStats(prices: number[]) {
  if (!prices.length) return { count: 0, lowest: null, second: null, highest: null, wavg: null }
  const s = [...prices].sort((a, b) => a - b)
  return {
    count: s.length,
    lowest: s[0],
    second: s.length > 1 ? s[1] : null,
    highest: s[s.length - 1],
    wavg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  }
}

export async function scrapeProperty(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage()

    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(3000)

    const propertyName = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      if (h1?.textContent?.trim()) return h1.textContent.trim()
      const og = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
      if (og?.content) return og.content.replace(/ [-|].*$/, '').trim()
      return document.title.replace(/ [-|].*$/, '').trim()
    })

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 400
        const timer = setInterval(() => {
          window.scrollBy(0, distance)
          totalHeight += distance
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 120)
      })
    })

    await page.waitForTimeout(2000)

    const floorplans: Floorplan[] = await page.evaluate(() => {
      const results: Array<{ name: string; sqft: number | null; beds: string; baths: string; prices: number[] }> = []

      const fpContainers = document.querySelectorAll(
        '[class*="floorplan"], [class*="floor-plan"], [class*="fp-"], [data-floorplan], [class*="unit-type"], [class*="plan-"]'
      )

      fpContainers.forEach((container) => {
        const nameEl = container.querySelector(
          '[class*="name"], [class*="title"], h2, h3, h4, [class*="plan-name"], [class*="fp-name"]'
        )
        const name = nameEl?.textContent?.trim()
        if (!name || name.length > 50) return

        const sqftMatch = container.textContent?.match(/(\d{3,4})\s*(?:sq\.?\s*ft|square\s*feet)/i)
        const sqft = sqftMatch ? parseInt(sqftMatch[1]) : null
        const bedsMatch = container.textContent?.match(/(\d+)\s*bed/i)
        const bathsMatch = container.textContent?.match(/(\d+(?:\.\d)?)\s*bath/i)
        const beds = bedsMatch ? bedsMatch[1] + ' BR' : ''
        const baths = bathsMatch ? bathsMatch[1] + ' BA' : ''

        const priceEls = container.querySelectorAll(
          '[class*="price"], [class*="rent"], [class*="rate"], [class*="amount"]'
        )
        const prices: number[] = []

        priceEls.forEach((el) => {
          const text = el.textContent || ''
          const matches = text.matchAll(/\$\s*([\d,]+)/g)
          for (const m of matches) {
            const val = parseInt(m[1].replace(/,/g, ''))
            if (val >= 500 && val <= 20000) prices.push(val)
          }
        })

        if (!prices.length) {
          const text = container.textContent || ''
          const matches = text.matchAll(/\$\s*([\d,]+)/g)
          for (const m of matches) {
            const val = parseInt(m[1].replace(/,/g, ''))
            if (val >= 500 && val <= 20000) prices.push(val)
          }
        }

        results.push({ name, sqft, beds, baths, prices: [...new Set(prices)] })
      })

      if (results.length === 0) {
        const tables = document.querySelectorAll('table')
        tables.forEach((table) => {
          const rows = table.querySelectorAll('tr')
          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td, th')).map((c) => c.textContent?.trim() || '')
            const priceCell = cells.find((c) => /^\$[\d,]+$/.test(c))
            const nameCell = cells.find((c) => /^[0-9A-Z]{1,4}$/.test(c) && c.length <= 4)
            if (priceCell && nameCell) {
              const price = parseInt(priceCell.replace(/[$,]/g, ''))
              const existing = results.find((r) => r.name === nameCell)
              if (existing) {
                existing.prices.push(price)
              } else {
                const sqftCell = cells.find((c) => /^\d{3,4}$/.test(c))
                results.push({
                  name: nameCell,
                  sqft: sqftCell ? parseInt(sqftCell) : null,
                  beds: '',
                  baths: '',
                  prices: [price],
                })
              }
            }
          })
        })
      }

      if (results.length === 0) {
        const lines = document.body.innerText.split('\n').map((l) => l.trim()).filter(Boolean)
        lines.forEach((line, i) => {
          if (/^(?:Studio|[1-4]\s*(?:BR|Bed|Bedroom)|[A-Z]\d{1,2}|[1-4][A-Z])$/i.test(line)) {
            const nearby = lines.slice(i, i + 10).join(' ')
            const prices: number[] = []
            const priceMatches = nearby.matchAll(/\$\s*([\d,]+)/g)
            for (const m of priceMatches) {
              const val = parseInt(m[1].replace(/,/g, ''))
              if (val >= 500 && val <= 20000) prices.push(val)
            }
            const sqftMatch = nearby.match(/(\d{3,4})\s*(?:sq|sf)/i)
            results.push({
              name: line,
              sqft: sqftMatch ? parseInt(sqftMatch[1]) : null,
              beds: '',
              baths: '',
              prices,
            })
          }
        })
      }

      return results
    })

    const seen = new Map<string, Floorplan>()
    for (const fp of floorplans) {
      if (seen.has(fp.name)) {
        const existing = seen.get(fp.name)!
        existing.prices = [...new Set([...existing.prices, ...fp.prices])]
      } else {
        seen.set(fp.name, fp)
      }
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    return {
      property_name: propertyName || 'Unknown Property',
      url,
      date: today,
      floorplans: Array.from(seen.values()),
    }
  } finally {
    await browser.close()
  }
}
