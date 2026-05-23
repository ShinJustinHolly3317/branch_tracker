import { z } from 'zod'
import cron from 'node-cron'
import { getEnv } from './env.js'
import type { Env } from './env.js'
import { generateFakeClosePrice, generateFakeDaily, getFakeStocks } from './fakeData.js'
import type { LatestStatusResponse, Market } from '@twbbd/shared'
import { fetchTwseStockBranchDaily } from './providers/twse.js'
import { fetchTaiwanTradableStockCodes } from './providers/taiwanStockList.js'
import { getDb } from './db.js'
import { mergeBranchCatalogRow } from './branchCatalog.js'

/** 略過時一行錯誤摘要（避免整段 stack 洗版） */
function ingestErrOneLine(err: unknown): string {
  if (err instanceof Error) {
    const line = err.message.split('\n')[0]?.trim() ?? err.message
    return line.length > 220 ? `${line.slice(0, 217)}…` : line
  }
  const s = String(err)
  return s.length > 220 ? `${s.slice(0, 217)}…` : s
}

function toYmd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return toYmd(dt)
}

async function ensureTradingDate(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, date: string) {
  await client.query('INSERT INTO trading_dates (trade_date) VALUES ($1) ON CONFLICT DO NOTHING', [date])
}

async function ingestFake(params: { backfillDays: number }) {
  const { backfillDays } = params
  const db = getDb()
  const client = await db.connect()
  try {
    const end = new Date()
    end.setDate(end.getDate() - 1) // yesterday (EOD assumption)
    const endDate = toYmd(end)

    const stocks = getFakeStocks()
    const markets: Market[] = ['TWSE', 'TPEX']

    for (let i = backfillDays - 1; i >= 0; i--) {
      const date = addDays(endDate, -i)
      await ensureTradingDate(client, date)

      for (const stockId of stocks) {
        // price close (used later for performance)
        const close = generateFakeClosePrice({ date, stockId })
        await client.query(
          'INSERT INTO stock_close (trade_date, stock_id, close) VALUES ($1,$2,$3) ON CONFLICT (trade_date, stock_id) DO UPDATE SET close=EXCLUDED.close',
          [date, stockId, close]
        )

        for (const market of markets) {
          const rows = generateFakeDaily({ date, market, stockId })
          await client.query(
            'INSERT INTO daily_stock_blob (trade_date, market, stock_id, payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (trade_date, market, stock_id) DO UPDATE SET payload=EXCLUDED.payload',
            [date, market, stockId, JSON.stringify(rows)]
          )
          for (const row of rows) {
            await mergeBranchCatalogRow(client, row.branchId, row.branchName)
          }
        }
      }
    }

    const status: LatestStatusResponse = {
      latestDate: endDate,
      provider: 'fake',
      markets
    }
    await client.query(
      'INSERT INTO ingest_status (id, payload) VALUES (1,$1::jsonb) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()',
      [JSON.stringify(status)]
    )
  } finally {
    client.release()
  }
}

function parseStockList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** TWSE_STOCKS=all 或 * 時依 TW_STOCK_UNIVERSE 拉清單 */
async function resolveTwseStockIds(env: Env): Promise<string[]> {
  const raw = env.TWSE_STOCKS?.trim() ?? ''
  if (!raw) return []
  const lower = raw.toLowerCase()
  if (lower === 'all' || raw === '*') {
    const universe = env.TW_STOCK_UNIVERSE
    const codes = await fetchTaiwanTradableStockCodes(universe)
    const desc =
      universe === 'twse'
        ? '證交所 STOCK_DAY_ALL 再過濾「四碼數字」以配合 bsContent（略過 006xxx 等非四碼純數字）'
        : '上市四碼 ∪ 櫃買四碼（櫃買多數無分點頁，略過仍可能多）'
    // eslint-disable-next-line no-console
    console.log(`[ingester] TWSE_STOCKS=all universe=${universe}：${codes.length} 檔（${desc}）`)
    return codes
  }
  return parseStockList(raw)
}

async function ingestTwseLatest(params: {
  stockIds: string[]
  msBetweenStocks?: number
  debugIngest?: boolean
}) {
  const { stockIds, msBetweenStocks = 350, debugIngest = false } = params
  const db = getDb()
  const client = await db.connect()
  try {
    let latestDate: string | undefined
    let ok = 0
    let fail = 0

    for (let i = 0; i < stockIds.length; i++) {
      const stockId = stockIds[i]
      try {
        const r = await fetchTwseStockBranchDaily({ stockId })
        latestDate = r.tradeDate

        await ensureTradingDate(client, r.tradeDate)

        if (r.closePrice && r.closePrice > 0) {
          await client.query(
            'INSERT INTO stock_close (trade_date, stock_id, close) VALUES ($1,$2,$3) ON CONFLICT (trade_date, stock_id) DO UPDATE SET close=EXCLUDED.close',
            [r.tradeDate, stockId, r.closePrice]
          )
        }

        await client.query(
          'INSERT INTO daily_stock_blob (trade_date, market, stock_id, payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (trade_date, market, stock_id) DO UPDATE SET payload=EXCLUDED.payload',
          [r.tradeDate, 'TWSE', stockId, JSON.stringify(r.rows)]
        )

        for (const row of r.rows) {
          await mergeBranchCatalogRow(client, row.branchId, row.branchName)
        }
        ok++
        // eslint-disable-next-line no-console
        console.log(
          `[ingester] ok ${stockId} date=${r.tradeDate} branches=${r.rows.length}` +
            (r.closePrice ? ` close=${r.closePrice}` : '')
        )
      } catch (e) {
        fail++
        // eslint-disable-next-line no-console
        console.log(`[ingester] fail ${stockId} ${ingestErrOneLine(e)}`)
        if (debugIngest) {
          // eslint-disable-next-line no-console
          console.error(e)
        }
      }

      if (i < stockIds.length - 1 && msBetweenStocks > 0) {
        await new Promise((resolve) => setTimeout(resolve, msBetweenStocks))
      }

      if ((i + 1) % 100 === 0 || i === stockIds.length - 1) {
        // eslint-disable-next-line no-console
        console.log(`[ingester] 進度 ${i + 1}/${stockIds.length} ok=${ok} fail=${fail}`)
      }
    }

    const status: LatestStatusResponse = {
      latestDate,
      provider: 'twse:bsContent',
      markets: ['TWSE']
    }
    await client.query(
      'INSERT INTO ingest_status (id, payload) VALUES (1,$1::jsonb) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()',
      [JSON.stringify(status)]
    )

    // eslint-disable-next-line no-console
    console.log(`[ingester] 本輪結束 ok=${ok} fail=${fail}`)
    if (ok === 0 && stockIds.length > 0) {
      throw new Error('twse_ingest_all_failed')
    }
  } finally {
    client.release()
  }
}

/**
 * 以 node-cron 在指定時區每日（預設週一至週五）觸發 TWSE 爬蟲寫入 Postgres
 */
async function runTwseScheduledIngest(params: { env: Env }) {
  const { env } = params
  const expr = env.INGEST_CRON
  const tz = env.INGEST_TZ

  if (!cron.validate(expr)) {
    // eslint-disable-next-line no-console
    console.error(`[ingester] 無效的 INGEST_CRON: ${JSON.stringify(expr)}`)
    process.exit(1)
  }

  const stockIdsPreview = await resolveTwseStockIds(env)
  // eslint-disable-next-line no-console
  console.log(
    `[ingester] TWSE 排程已啟動 cron=${JSON.stringify(expr)} tz=${JSON.stringify(
      tz
    )} stocks=${stockIdsPreview.length}`
  )

  const tick = async () => {
    try {
      const stockIds = await resolveTwseStockIds(env)
      await ingestTwseLatest({
        stockIds,
        msBetweenStocks: env.INGEST_MS_BETWEEN_STOCKS,
        debugIngest: env.DEBUG_INGEST
      })
      // eslint-disable-next-line no-console
      console.log(`[ingester] cron tick OK ${new Date().toISOString()}`)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ingester] cron tick failed', e)
    }
  }

  if (env.INGEST_RUN_ON_START === 'true') {
    await tick()
  }

  cron.schedule(expr, tick, { timezone: tz })

  await new Promise<void>((resolve) => {
    const shutdown = () => resolve()
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}

async function main() {
  const cmd = process.argv[2]
  if (cmd !== 'ingest:once' && cmd !== 'ingest:cron') {
    // eslint-disable-next-line no-console
    console.error('Usage: ingest:once | ingest:cron')
    process.exit(1)
  }

  const env = getEnv()
  if (env.TWSE_STOCKS) {
    const stockIds = await resolveTwseStockIds(env)
    if (stockIds.length === 0) {
      // eslint-disable-next-line no-console
      console.error('[ingester] 無法解析股號清單（TWSE_STOCKS 為空或無效）')
      process.exit(1)
    }
    if (cmd === 'ingest:once') {
      await ingestTwseLatest({
        stockIds,
        msBetweenStocks: env.INGEST_MS_BETWEEN_STOCKS,
        debugIngest: env.DEBUG_INGEST
      })
      // eslint-disable-next-line no-console
      console.log(`[ingester] ingest:once 完成，共處理 ${stockIds.length} 檔`)
      return
    }

    await runTwseScheduledIngest({ env })
    return
  }

  // For now, if QDATA_API_KEY is missing, seed fake data so UI is reviewable.
  // Qdata ingestion will be added next.
  if (!env.QDATA_API_KEY) {
    const BackfillSchema = z.coerce.number().int().min(1).max(365).default(60)
    const backfillDays = BackfillSchema.parse(process.env.BACKFILL_DAYS)
    if (cmd === 'ingest:once') {
      await ingestFake({ backfillDays })
      // eslint-disable-next-line no-console
      console.log(`[ingester] seeded fake data backfillDays=${backfillDays}`)
      return
    }

    // ingest:cron
    // eslint-disable-next-line no-console
    console.log(`[ingester] cron mode (fake) backfillDays=${backfillDays}`)
    // simple daily loop
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await ingestFake({ backfillDays: 1 })
      // eslint-disable-next-line no-console
      console.log('[ingester] cron tick done, sleeping 24h')
      await new Promise((r) => setTimeout(r, 24 * 60 * 60 * 1000))
    }
  }

  // eslint-disable-next-line no-console
  console.log('[ingester] QDATA_API_KEY provided, but qdata ingestion not implemented yet.')
  process.exit(2)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
