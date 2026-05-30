import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import type {
  BranchPerformanceResponse,
  BranchSuggestResponse,
  ByBranchWindowResponse,
  ByStockWindowResponse,
  CreateFavoriteRequest,
  FavoritesListResponse,
  AnalysisRunDetail,
  AnalysisRunsListResponse,
  LatestStatusResponse,
  PerformanceMetric,
  ShortTermRecommendationsResponse,
  StockRecommendation,
  StockSuggestResponse,
  UpdateFavoriteRequest,
  UserFavorite
} from '@twbbd/shared'
import { getDb } from './db.js'
import { getLastNDates, getLatestDate } from './dates.js'
import { aggregateByBranch, aggregateByStock } from './agg.js'
import { computeBranchPerformance } from './performance.js'
import { getStockCatalog } from './stockCatalog.js'
import { getStockPriceWindow } from './stockPrice.js'
import { computeShortTermRecommendations, getRecommendationForStock } from './recommendations.js'
import { createFavorite, deleteFavorite, listFavorites, updateFavorite } from './favorites.js'
import { getAnalysisRun, listAnalysisRuns } from './analysisRuns.js'

const CLIENT_ID_HEADER = 'x-twbbd-client-id'

function readClientId(req: express.Request): string | null {
  const raw = req.header(CLIENT_ID_HEADER)
  if (!raw || raw.trim().length < 8 || raw.length > 64) return null
  return raw.trim()
}

export function createApp(): express.Express {
  const app = express()
  app.use(
    cors({
      origin: true,
      credentials: false
    })
  )
  app.use(express.json())

  /** Vercel 預覽／根路徑直接開啟時不要 500 空白 */
  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'twbbd-api', health: '/health' })
  })

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.get('/status/latest', async (_req, res) => {
    const db = getDb()
    const latestDate = await getLatestDate(db)
    const r = await db.query<{ payload: unknown }>('SELECT payload FROM ingest_status WHERE id=1')
    const status = (r.rows[0]?.payload ?? {}) as LatestStatusResponse
    res.json({ ...status, latestDate: (status as LatestStatusResponse).latestDate ?? latestDate })
  })

  function emptyStockWindow(stockId: string): ByStockWindowResponse {
    return {
      stockId,
      startDate: '—',
      endDate: '—',
      tradingDays: 0,
      branches: [],
      concentration: { top1Share: 0, top3Share: 0, hhi: 0 }
    }
  }

  function emptyBranchWindow(branchId: string): ByBranchWindowResponse {
    return {
      branchId,
      startDate: '—',
      endDate: '—',
      tradingDays: 0,
      stocks: []
    }
  }

  /** 分點搜尋僅依「名稱」比對，不依券商代號。 */
  function matchesBranchNameQuery(q: string, branchName: string): boolean {
    const needle = q.trim()
    if (!needle) return true
    if (branchName.includes(needle)) return true
    const lower = needle.toLowerCase()
    return branchName.toLowerCase().includes(lower)
  }

  function matchesStockQuery(q: string, stockId: string, stockName: string): boolean {
    const needle = q.trim()
    if (!needle) return true

    const nLower = needle.toLowerCase()
    if (stockId.includes(needle) || stockId.toLowerCase().includes(nLower)) return true
    if (stockName.includes(needle) || stockName.toLowerCase().includes(nLower)) return true

    // 中文/模糊：needle 任一字命中就算
    const chars = [...new Set([...needle].map((c) => c.trim()).filter(Boolean))]
    if (chars.length === 0) return true
    return chars.some((c) => stockName.includes(c))
  }

  app.get('/branches/suggest', async (req, res) => {
    const q = z.string().optional().parse(req.query.q) ?? ''
    const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit)

    const db = getDb()
    const r = await db.query<{ branch_id: string; branch_name: string }>(
      'SELECT branch_id, branch_name FROM branch_catalog'
    )
    let pairs = r.rows.map((x) => ({ branchId: x.branch_id, branchName: x.branch_name }))
    pairs = pairs.filter(({ branchName }) => matchesBranchNameQuery(q, branchName))
    pairs.sort((a, b) => a.branchName.localeCompare(b.branchName, 'zh-Hant', { sensitivity: 'base' }))
    const body: BranchSuggestResponse = { suggestions: pairs.slice(0, limit) }
    return res.json(body)
  })

  app.get('/stocks/suggest', async (req, res) => {
    const q = z.string().optional().parse(req.query.q) ?? ''
    const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit)

    const db = getDb()
    const rows = await getStockCatalog(db)
    const pairs = rows
      .filter((r) => matchesStockQuery(q, r.stockId, r.stockName))
      .sort((a, b) => a.stockId.localeCompare(b.stockId))

    const body: StockSuggestResponse = { suggestions: pairs.slice(0, limit) }
    return res.json(body)
  })

  app.get('/stocks/:stockId', async (req, res) => {
    const stockId = z.string().min(1).parse(req.params.stockId)
    const days = z.coerce.number().int().min(1).max(365).default(20).parse(req.query.days)
    const endDate = z.string().optional().parse(req.query.endDate)

    const db = getDb()
    const actualEndDate = endDate ?? (await getLatestDate(db))
    if (!actualEndDate) return res.json(emptyStockWindow(stockId))

    const dates = await getLastNDates(db, days, actualEndDate)
    if (dates.length === 0) return res.json(emptyStockWindow(stockId))

    const agg = await aggregateByStock({ db, stockId, dates })
    const priceWindow =
      agg.startDate && agg.endDate
        ? await getStockPriceWindow(db, stockId, agg.startDate, agg.endDate)
        : null
    const resp: ByStockWindowResponse = {
      stockId,
      startDate: agg.startDate!,
      endDate: agg.endDate!,
      tradingDays: agg.tradingDays,
      branches: agg.branches,
      concentration: agg.concentration,
      priceWindow
    }
    return res.json(resp)
  })

  app.get('/branches/:branchId', async (req, res) => {
    const branchId = z.string().min(1).parse(req.params.branchId)
    const days = z.coerce.number().int().min(1).max(365).default(20).parse(req.query.days)
    const endDate = z.string().optional().parse(req.query.endDate)

    const db = getDb()
    const catalogRows = await getStockCatalog(db)
    const stockNameById = new Map(catalogRows.map((r) => [r.stockId, r.stockName] as const))

    const actualEndDate = endDate ?? (await getLatestDate(db))
    if (!actualEndDate) return res.json(emptyBranchWindow(branchId))

    const dates = await getLastNDates(db, days, actualEndDate)
    if (dates.length === 0) return res.json(emptyBranchWindow(branchId))

    const agg = await aggregateByBranch({ db, branchId, dates })
    const resp: ByBranchWindowResponse = {
      branchId,
      startDate: agg.startDate!,
      endDate: agg.endDate!,
      tradingDays: agg.tradingDays,
      stocks: agg.stocks.map((s) => ({
        ...s,
        stockName: stockNameById.get(s.stockId) ?? s.stockName
      }))
    }
    return res.json(resp)
  })

  app.get('/performance/branches', async (req, res) => {
    const days = z.coerce.number().int().min(1).max(365).default(20).parse(req.query.days)
    const forwardDays = z.coerce.number().int().min(1).max(120).default(10).parse(req.query.forwardDays)
    const metric = z
      .enum(['avgForwardReturn', 'hitRate', 'weightedPnlProxy'])
      .default('avgForwardReturn')
      .parse(req.query.metric) as PerformanceMetric
    const minSample = z.coerce.number().int().min(1).max(500).default(10).parse(req.query.minSample)

    const db = getDb()
    const allDatesR = await db.query<{ trade_date: string }>(
      'SELECT trade_date::text FROM trading_dates ORDER BY trade_date ASC'
    )
    const allDates = allDatesR.rows.map((x) => x.trade_date)
    if (allDates.length === 0) {
      return res.json({
        startDate: '—',
        endDate: '—',
        tradingDays: days,
        forwardTradingDays: forwardDays,
        metric,
        minSampleSize: minSample,
        top: [],
        reasonCode: 'missing_trading_dates',
        requestedForwardTradingDays: forwardDays,
        effectiveForwardTradingDays: forwardDays,
        debugMessage: 'trading_dates 沒有任何資料；請先跑 ingester 寫入交易日曆。'
      })
    }

    if (allDates.length < 2) {
      return res.json({
        startDate: allDates[0] ?? '—',
        endDate: allDates[0] ?? '—',
        tradingDays: days,
        forwardTradingDays: forwardDays,
        metric,
        minSampleSize: minSample,
        top: [],
        reasonCode: 'insufficient_forward_calendar',
        requestedForwardTradingDays: forwardDays,
        effectiveForwardTradingDays: forwardDays,
        debugMessage: 'Performance 需要至少 2 個交易日（trading_dates）才能計算前瞻報酬；目前只有 1 天。'
      })
    }

    // Make sure we have forward prices: pick the largest feasible K (<= requested) so endIdx >= 0
    const maxFeasibleK = Math.max(0, allDates.length - 1 - 0) // up to len-1
    const effectiveK = Math.min(forwardDays, maxFeasibleK)
    const endIdx = allDates.length - 1 - effectiveK
    if (endIdx < 0) {
      // should not happen given effectiveK, but keep defensive
      return res.json({
        startDate: '—',
        endDate: '—',
        tradingDays: days,
        forwardTradingDays: forwardDays,
        metric,
        minSampleSize: minSample,
        top: [],
        reasonCode: 'insufficient_forward_calendar',
        requestedForwardTradingDays: forwardDays,
        effectiveForwardTradingDays: effectiveK,
        debugMessage: '交易日曆不足以支援前瞻 K（即便自動下修仍失敗）。'
      })
    }
    const endDate = allDates[endIdx]

    const resp: BranchPerformanceResponse = await computeBranchPerformance({
      db,
      datesAll: allDates,
      endDate,
      tradingDays: days,
      forwardTradingDays: effectiveK,
      metric,
      minSampleSize: minSample,
      requestedForwardTradingDays: forwardDays
    })

    const bumped =
      effectiveK < forwardDays
        ? `已將前瞻 K 從 ${forwardDays} 自動下修为 ${effectiveK}（目前 trading_dates 只有 ${allDates.length} 天）。`
        : undefined

    return res.json({
      ...resp,
      ...(bumped ? { debugMessage: [resp.debugMessage, bumped].filter(Boolean).join(' ') } : {})
    })
  })

  app.get('/recommendations/short-term', async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit)
    const db = getDb()
    const result = await computeShortTermRecommendations({ db, limit })
    const body: ShortTermRecommendationsResponse = {
      strategyName: result.strategyName,
      signalDate: result.signalDate,
      generatedAt: new Date().toISOString(),
      disclaimer: '以下為策略研究產出，非投資建議。請依自身風險承受能力決定是否交易。',
      items: result.items,
      debugMessage: result.debugMessage
    }
    return res.json(body)
  })

  app.get('/recommendations/short-term/:stockId', async (req, res) => {
    const stockId = z.string().min(1).parse(req.params.stockId)
    const db = getDb()
    const item = await getRecommendationForStock({ db, stockId })
    if (!item) return res.status(404).json({ error: 'not_found' })
    return res.json(item satisfies StockRecommendation)
  })

  app.get('/favorites', async (req, res) => {
    const clientId = readClientId(req)
    if (!clientId) return res.status(400).json({ error: 'missing_client_id' })
    const db = getDb()
    const items = await listFavorites(db, clientId)
    const body: FavoritesListResponse = { items }
    return res.json(body)
  })

  app.post('/favorites', async (req, res) => {
    const clientId = readClientId(req)
    if (!clientId) return res.status(400).json({ error: 'missing_client_id' })
    const body = z
      .object({
        stockId: z.string().min(1),
        stockName: z.string().min(1),
        buyDate: z.string().nullable().optional(),
        buyPrice: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        strategySnapshot: z.object({}).passthrough()
      })
      .parse(req.body) as CreateFavoriteRequest
    const db = getDb()
    const item = await createFavorite(db, clientId, body)
    return res.status(201).json(item satisfies UserFavorite)
  })

  app.patch('/favorites/:id', async (req, res) => {
    const clientId = readClientId(req)
    if (!clientId) return res.status(400).json({ error: 'missing_client_id' })
    const id = z.string().uuid().parse(req.params.id)
    const body = z
      .object({
        buyDate: z.string().nullable().optional(),
        buyPrice: z.number().nullable().optional(),
        notes: z.string().nullable().optional()
      })
      .parse(req.body) as UpdateFavoriteRequest
    const db = getDb()
    const item = await updateFavorite(db, clientId, id, body)
    if (!item) return res.status(404).json({ error: 'not_found' })
    return res.json(item satisfies UserFavorite)
  })

  app.delete('/favorites/:id', async (req, res) => {
    const clientId = readClientId(req)
    if (!clientId) return res.status(400).json({ error: 'missing_client_id' })
    const id = z.string().uuid().parse(req.params.id)
    const db = getDb()
    const ok = await deleteFavorite(db, clientId, id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    return res.status(204).send()
  })

  app.get('/analysis-runs', async (req, res) => {
    const parsed = z.coerce.number().int().min(1).max(100).safeParse(req.query.limit ?? 30)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_limit' })
    const limit = parsed.data
    const db = getDb()
    const items = await listAnalysisRuns(db, limit)
    const body: AnalysisRunsListResponse = { items }
    return res.json(body)
  })

  app.get('/analysis-runs/:id', async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_id' })
    const db = getDb()
    const item = await getAnalysisRun(db, parsed.data)
    if (!item) return res.status(404).json({ error: 'not_found' })
    return res.json(item satisfies AnalysisRunDetail)
  })

  return app
}
