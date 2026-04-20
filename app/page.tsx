'use client'

import { useState } from 'react'

interface Floorplan {
  name: string
  sqft: number | null
  beds: string
  prices: number[]
}

interface ScrapeResult {
  property_name: string
  url: string
  date: string
  floorplans: Floorplan[]
  error?: string
}

function computeStats(prices: number[]) {
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

function fmt(val: number | null) {
  if (val === null) return '—'
  return '$' + val.toLocaleString()
}

export default function Home() {
  const [urls, setUrls] = useState<string[]>([''])
  const [results, setResults] = useState<ScrapeResult[]>([])
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [exporting, setExporting] = useState(false)

  const addUrl = () => setUrls([...urls, ''])
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i))
  const updateUrl = (i: number, val: string) => {
    const next = [...urls]
    next[i] = val
    setUrls(next)
  }

  const scrape = async (i: number) => {
    const url = urls[i]
    if (!url) return
    setLoading((l) => ({ ...l, [i]: true }))
    setErrors((e) => ({ ...e, [i]: '' }))
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setResults((prev) => {
        const idx = prev.findIndex((r) => r.url === url)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data
          return next
        }
        return [...prev, data]
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setErrors((e) => ({ ...e, [i]: msg }))
    } finally {
      setLoading((l) => ({ ...l, [i]: false }))
    }
  }

  const scrapeAll = async () => {
    for (let i = 0; i < urls.length; i++) {
      if (urls[i]) await scrape(i)
    }
  }

  const exportExcel = async () => {
    if (!results.length) return
    setExporting(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `RentTracker_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  const removeResult = (url: string) => setResults((prev) => prev.filter((r) => r.url !== url))
  const allPrices = results.flatMap((r) => r.floorplans.flatMap((fp) => fp.prices))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef', fontFamily: 'Georgia, serif' }}>
      <div style={{ borderBottom: '3px solid #1a1a1a', padding: '32px 48px 24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#888', marginBottom: '6px' }}>
          MULTIFAMILY · REAL ESTATE PE
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: '40px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.02em' }}>
          Rent Tracker
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          Live apartment pricing pulled directly from property websites — no ILS aggregators
        </p>
      </div>

      <div style={{ padding: '36px 48px', maxWidth: '1200px' }}>
        <div style={{ background: '#fff', border: '1px solid #ddd', padding: '28px 32px', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.22em', color: '#888', marginBottom: '16px' }}>
            PROPERTY WEBSITE URLS
          </div>
          {urls.map((url, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <input
                value={url}
                onChange={(e) => updateUrl(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && scrape(i)}
                placeholder="https://property-website.com/floorplans/"
                style={{
                  flex: 1, padding: '11px 14px', fontSize: '14px',
                  border: '1px solid #ccc', fontFamily: 'monospace',
                  outline: 'none', background: '#fafafa',
                }}
              />
              <button
                onClick={() => scrape(i)}
                disabled={loading[i] || !url}
                style={{
                  background: loading[i] ? '#ccc' : '#1a1a1a',
                  color: '#fff', border: 'none', padding: '11px 24px',
                  fontSize: '12px', letterSpacing: '0.12em', fontWeight: '700',
                  cursor: loading[i] ? 'not-allowed' : 'pointer',
                  fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
                }}
              >
                {loading[i] ? 'SCANNING...' : 'SCAN SITE'}
              </button>
              {urls.length > 1 && (
                <button
                  onClick={() => removeUrl(i)}
                  style={{
                    background: 'transparent', border: '1px solid #ddd',
                    color: '#999', padding: '11px 14px', cursor: 'pointer', fontSize: '16px',
                  }}
                >
                  x
                </button>
              )}
            </div>
          ))}

          {Object.entries(errors).map(([i, msg]) =>
            msg ? (
              <div key={i} style={{ color: '#b91c1c', fontSize: '13px', marginTop: '6px', padding: '8px 12px', background: '#fff5f5', border: '1px solid #fca5a5' }}>
                Row {parseInt(i) + 1}: {msg}
              </div>
            ) : null
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={addUrl}
              style={{
                background: 'transparent', border: '1px dashed #aaa',
                color: '#666', padding: '9px 18px', cursor: 'pointer',
                fontSize: '12px', letterSpacing: '0.1em', fontFamily: 'Georgia, serif',
              }}
            >
              + ADD ANOTHER PROPERTY
            </button>
            {urls.filter(Boolean).length > 1 && (
              <button
                onClick={scrapeAll}
                style={{
                  background: '#4a7c59', color: '#fff', border: 'none',
                  padding: '9px 20px', cursor: 'pointer', fontSize: '12px',
                  letterSpacing: '0.1em', fontFamily: 'Georgia, serif', fontWeight: '700',
                }}
              >
                SCAN ALL
              </button>
            )}
          </div>
        </div>

        {Object.values(loading).some(Boolean) && (
          <div style={{ padding: '20px 24px', background: '#fff', border: '1px solid #ddd', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              border: '2px solid #ddd', borderTop: '2px solid #1a1a1a',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Scanning property website...</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                Opening a real browser and reading all units. Usually 30-60 seconds.
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: '#666' }}>
                {results.length} {results.length === 1 ? 'property' : 'properties'} · {allPrices.length} units tracked
              </div>
              <button
                onClick={exportExcel}
                disabled={exporting}
                style={{
                  background: exporting ? '#ccc' : '#1a1a1a', color: '#fff',
                  border: 'none', padding: '11px 24px', cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: '12px', letterSpacing: '0.15em', fontWeight: '700', fontFamily: 'Georgia, serif',
                }}
              >
                {exporting ? 'EXPORTING...' : 'EXPORT TO EXCEL'}
              </button>
            </div>

            {results.map((result) => {
              const allResultPrices = result.floorplans.flatMap((fp) => fp.prices).filter(Boolean)
              return (
                <div key={result.url} style={{ marginBottom: '32px', background: '#fff', border: '1px solid #e5e5e5' }}>
                  <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>{result.property_name}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>
                        {result.date} ·{' '}
                        <a href={result.url} target="_blank" rel="noreferrer" style={{ color: '#4a7c59' }}>
                          {result.url}
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => removeResult(result.url)}
                      style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}
                    >
                      x
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #e5e5e5' }}>
                    {[
                      ['Floorplans', result.floorplans.length],
                      ['Units Tracked', allResultPrices.length],
                      ['Market Low', allResultPrices.length ? fmt(Math.min(...allResultPrices)) : '—'],
                      ['Market High', allResultPrices.length ? fmt(Math.max(...allResultPrices)) : '—'],
                    ].map(([label, val], i) => (
                      <div key={String(label)} style={{ padding: '16px 24px', borderRight: i < 3 ? '1px solid #e5e5e5' : 'none' }}>
                        <div style={{ fontSize: '10px', letterSpacing: '0.18em', color: '#999', marginBottom: '4px' }}>
                          {String(label).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a' }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a', color: '#fff' }}>
                          {['FLOORPLAN', 'SQFT', 'UNITS AVAIL.', 'LOWEST', '2ND LOWEST', 'HIGHEST', 'WTDAVG'].map((h, i) => (
                            <th key={h} style={{ padding: '12px 20px', textAlign: i === 0 ? 'left' : 'right', fontSize: '10px', letterSpacing: '0.18em', fontWeight: '700' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.floorplans.map((fp, i) => {
                          const s = computeStats(fp.prices)
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ padding: '13px 20px', fontWeight: '700', color: '#1a1a1a' }}>{fp.name}</td>
                              <td style={{ padding: '13px 20px', textAlign: 'right', color: '#666' }}>
                                {fp.sqft ? fp.sqft.toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'right', color: s.count > 0 ? '#16a34a' : '#999' }}>
                                {s.count || '—'}
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>{fmt(s.lowest)}</td>
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>{fmt(s.second)}</td>
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>{fmt(s.highest)}</td>
                              <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: '700', color: '#92400e' }}>
                                {s.wavg ? fmt(s.wavg) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
