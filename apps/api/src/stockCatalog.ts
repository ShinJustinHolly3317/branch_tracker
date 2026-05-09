import type pg from 'pg'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

type TwseDayAllRow = {
  Code?: string
  Name?: string
}

export type StockCatalogRow = {
  stockId: string
  stockName: string
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchJsonWithRetry<T>(url: string, label: string): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'user-agent': UA,
          accept: 'application/json,text/plain,*/*'
        }
      })
      if (!res.ok) throw new Error(`${label} http_${res.status}`)
      return (await res.json()) as T
    } catch (e) {
      lastErr = e
      await sleep(400 * attempt)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

const TWSE_BSCONTENT_CODE = /^[0-9]{4}$/

async function fetchTwseCatalog(): Promise<StockCatalogRow[]> {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
  const rows = await fetchJsonWithRetry<TwseDayAllRow[]>(url, 'twse_stock_day_all')
  const m = new Map<string, string>()
  for (const r of rows) {
    const stockId = (r.Code ?? '').trim()
    const stockName = (r.Name ?? '').trim()
    if (!stockId || !stockName) continue
    if (!TWSE_BSCONTENT_CODE.test(stockId)) continue
    m.set(stockId, stockName)
  }
  return [...m.entries()]
    .map(([stockId, stockName]) => ({ stockId, stockName }))
    .sort((a, b) => a.stockId.localeCompare(b.stockId))
}

export async function getStockCatalog(db: pg.Pool): Promise<StockCatalogRow[]> {
  const existing = await db.query<{ stock_id: string; stock_name: string }>(
    'SELECT stock_id, stock_name FROM stock_catalog ORDER BY stock_id'
  )
  if (existing.rows.length > 0) {
    return existing.rows.map((r) => ({ stockId: r.stock_id, stockName: r.stock_name }))
  }

  const fetched = await fetchTwseCatalog()
  if (fetched.length === 0) return []

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const r of fetched) {
      await client.query(
        'INSERT INTO stock_catalog (stock_id, stock_name) VALUES ($1,$2) ON CONFLICT (stock_id) DO UPDATE SET stock_name=EXCLUDED.stock_name, updated_at=now()',
        [r.stockId, r.stockName]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  return fetched
}

