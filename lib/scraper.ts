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
        const beds = bedsMatch ? bedsMatch[1] + ' BR' :
