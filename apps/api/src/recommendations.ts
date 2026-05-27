import type pg from 'pg'
import type {
  BuyMethodSuggestion,
  BuyZoneSuggestion,
  ExitCondition,
  StockRecommendation,
  StrategySnapshot,
  TradeByBranchDaily
} from '@twbbd/shared'
import { getLastNDates, getLatestDate } from './dates.js'

/** v3 溫和動能 × 分點確認 — 與 backtest preset 3 對齊 */
const MOM_LOOKBACK = 3
const MOMENTUM_MIN = 0.025
const MOMENTUM_MAX = 0.07
const MAX_SINGLE_DAY = 0.03
const MAX_3DAY_SUM = 0.07
const MIN_TURNOVER = 120_000
const MIN_TOP1_CONC = 0.2
const MIN_NET_RATIO = 0.03
const MAX_LAST_DAY_RETURN = 0.02

const STRATEGY_NAME = '溫和動能 × 分點確認'

function branchStats(rows: TradeByBranchDaily[]) {
  let buy = 0
  let sell = 0
  let netAbs = 0
  const byBranch = new Map<string, { net: number; name: string }>()
  for (const r of rows) {
    buy += r.buyShares
    sell += r.sellShares
    netAbs += Math.abs(r.netShares)
    const cur = byBranch.get(r.branchId) ?? { net: 0, name: r.branchName }
    cur.net += r.netShares
    byBranch.set(r.branchId, cur)
  }
  const net = buy - sell
  const branches = [...byBranch.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  const top1 = branches[0] ? Math.abs(branches[0].net) : 0
  const top1Share = netAbs > 0 ? top1 / netAbs : 0
  return { buy, sell, turnover: buy + sell, net, top1Share }
}

function buildBuyZone(referencePrice: number): BuyZoneSuggestion {
  const low = Math.round(referencePrice * 0.98 * 100) / 100
  const high = Math.round(referencePrice * 1.01 * 100) / 100
  return {
    lowPrice: low,
    highPrice: high,
    referencePrice,
    summary: `理想區間 ${low.toFixed(2)}～${high.toFixed(2)} 元（現價 ±2% 內）。超過上限不追，跌破下限等站穩再考慮。`
  }
}

function buildBuyMethod(): BuyMethodSuggestion {
  return {
    style: '分批',
    steps: [
      '第一批 40%：價格落在買入區間內，且當日分點仍為淨買超時進場',
      '第二批 30%：若回測至區間下緣或 3 日低點附近且量縮，加碼',
      '第三批 30%：突破近 3 日高點且分點持續買超，完成建倉'
    ],
    summary: '建議分 3 批、約 3～5 個交易日完成，避免一次 All-in。'
  }
}

function buildExitConditions(): ExitCondition[] {
  return [
    {
      type: 'time',
      label: '時間出場',
      detail: '持有滿 15～20 個交易日，無論盈虧先減碼或全出（本策略為短中期動能，非長抱）。'
    },
    {
      type: 'stopLoss',
      label: '停損',
      detail: '自平均成本下跌 8% 出場，勿凹單。'
    },
    {
      type: 'takeProfit',
      label: '停利',
      detail: '獲利達 15% 可先賣一半；其餘用移動停利（自高點回撤 5% 出清）。'
    },
    {
      type: 'signal',
      label: '動能失效',
      detail: '3 日動能轉負，且分點連續 2 日淨賣超 → 提前出場。'
    }
  ]
}

function buildWatchItems(stockName: string): string[] {
  return [
    `每日收盤後看 ${stockName} 分點是否仍為淨買超`,
    '大盤若連跌 2 日，動能股易同步回檔，留意部位',
    '留意法說、除權息、重大利空新聞',
    '若出現單日漲幅 > 4% 的長紅，停止加碼並提高停利警覺'
  ]
}

function buildCautions(): string[] {
  return [
    '以下為策略研究產出，非投資建議；請依自身風險承受能力決定。',
    '資料庫歷史尚短，回測樣本有限，績效不代表未來。',
    '中小型股流動性較差，實際成交價可能滑價。',
    '單一標的建議不超過總資金的 5%。'
  ]
}

function scoreCandidate(input: {
  momentum: number
  turnover: number
  netRatio: number
  top1Share: number
}): { score: number; confidence: 'high' | 'medium' | 'low' } {
  let score = 50
  const momMid = (MOMENTUM_MIN + MOMENTUM_MAX) / 2
  score += Math.max(0, 15 - Math.abs(input.momentum - momMid) * 200)
  score += Math.min(15, (input.turnover / 5_000_000) * 15)
  score += Math.min(15, input.netRatio * 100)
  score += Math.min(10, input.top1Share * 20)
  const confidence = score >= 75 ? 'high' : score >= 60 ? 'medium' : 'low'
  return { score: Math.round(score), confidence }
}

function toRecommendation(input: {
  stockId: string
  stockName: string
  signalDate: string
  referencePrice: number
  momentum: number
  turnover: number
  netRatio: number
  top1Share: number
}): StockRecommendation {
  const { score, confidence } = scoreCandidate({
    momentum: input.momentum,
    turnover: input.turnover,
    netRatio: input.netRatio,
    top1Share: input.top1Share
  })
  const buyZone = buildBuyZone(input.referencePrice)
  const buyMethod = buildBuyMethod()
  const exitConditions = buildExitConditions()
  const watchItems = buildWatchItems(input.stockName)
  const cautions = buildCautions()
  const strategySnapshot: StrategySnapshot = {
    strategyName: STRATEGY_NAME,
    signalDate: input.signalDate,
    buyZone,
    buyMethod,
    exitConditions,
    watchItems,
    cautions,
    metrics: {
      momentum3d: input.momentum,
      turnover: input.turnover,
      netBuyRatio: input.netRatio,
      top1Share: input.top1Share
    }
  }
  return {
    stockId: input.stockId,
    stockName: input.stockName,
    signalDate: input.signalDate,
    referencePrice: input.referencePrice,
    confidence,
    score,
    momentum3d: input.momentum,
    turnover: input.turnover,
    netBuyRatio: input.netRatio,
    top1Share: input.top1Share,
    buyZone,
    buyMethod,
    exitConditions,
    watchItems,
    cautions,
    strategySnapshot
  }
}

export async function computeShortTermRecommendations(opts: {
  db: pg.Pool
  limit?: number
}): Promise<{
  strategyName: string
  signalDate: string
  items: StockRecommendation[]
  debugMessage?: string
}> {
  const limit = opts.limit ?? 20
  const signalDate = await getLatestDate(opts.db)
  if (!signalDate) {
    return { strategyName: STRATEGY_NAME, signalDate: '—', items: [], debugMessage: '尚無交易日資料' }
  }

  const dates = await getLastNDates(opts.db, MOM_LOOKBACK + 1, signalDate)
  if (dates.length < MOM_LOOKBACK + 1) {
    return {
      strategyName: STRATEGY_NAME,
      signalDate,
      items: [],
      debugMessage: `交易日不足 ${MOM_LOOKBACK + 1} 天，無法計算動能`
    }
  }

  const blobR = await opts.db.query<{ stock_id: string; payload: unknown }>(
    `SELECT stock_id, payload FROM daily_stock_blob WHERE trade_date = $1 AND market = ANY($2::text[])`,
    [signalDate, ['TWSE', 'TPEX']]
  )

  const closeR = await opts.db.query<{ stock_id: string; trade_date: string; close: string }>(
    `SELECT stock_id, trade_date::text, close::text
     FROM stock_close
     WHERE trade_date = ANY($1::date[])`,
    [dates]
  )
  const closeByStock = new Map<string, Map<string, number>>()
  for (const row of closeR.rows) {
    const m = closeByStock.get(row.stock_id) ?? new Map<string, number>()
    m.set(row.trade_date, Number(row.close))
    closeByStock.set(row.stock_id, m)
  }

  const catalogR = await opts.db.query<{ stock_id: string; stock_name: string }>(
    'SELECT stock_id, stock_name FROM stock_catalog'
  )
  const names = new Map(catalogR.rows.map((r) => [r.stock_id, r.stock_name]))

  const i = dates.length - 1
  const d0 = dates[i]
  const d1 = dates[i - 1]
  const d2 = dates[i - 2]
  const d3 = dates[i - 3]

  const picks: StockRecommendation[] = []

  for (const row of blobR.rows) {
    const stockId = row.stock_id
    const cm = closeByStock.get(stockId)
    if (!cm) continue

    const c0 = cm.get(d0)
    const cStart = cm.get(d3)
    const cPrev1 = cm.get(d1)
    const cPrev2 = cm.get(d2)
    const cPrev3 = cm.get(d3)
    if (!c0 || !cStart || !cPrev1 || !cPrev2 || !cPrev3) continue
    if (cStart <= 0 || cPrev1 <= 0 || cPrev2 <= 0 || cPrev3 <= 0) continue

    const mom = (c0 - cStart) / cStart
    if (mom < MOMENTUM_MIN || mom > MOMENTUM_MAX) continue

    const r1 = (c0 - cPrev1) / cPrev1
    const r2 = (cPrev1 - cPrev2) / cPrev2
    const r3 = (cPrev2 - cPrev3) / cPrev3
    if (Math.max(r1, r2, r3) > MAX_SINGLE_DAY) continue
    if (r1 + r2 + r3 > MAX_3DAY_SUM) continue
    if (r1 > MAX_LAST_DAY_RETURN) continue

    const payload = row.payload
    if (!Array.isArray(payload)) continue
    const stats = branchStats(payload as TradeByBranchDaily[])
    if (stats.turnover < MIN_TURNOVER) continue
    if (stats.net <= 0) continue
    const netRatio = stats.net / stats.turnover
    if (netRatio < MIN_NET_RATIO) continue
    if (stats.top1Share < MIN_TOP1_CONC) continue

    picks.push(
      toRecommendation({
        stockId,
        stockName: names.get(stockId) ?? stockId,
        signalDate: d0,
        referencePrice: c0,
        momentum: mom,
        turnover: stats.turnover,
        netRatio,
        top1Share: stats.top1Share
      })
    )
  }

  picks.sort((a, b) => b.score - a.score || b.turnover - a.turnover)

  return {
    strategyName: STRATEGY_NAME,
    signalDate,
    items: picks.slice(0, limit)
  }
}

/** 單一標的：若符合策略則回傳推薦，否則仍產出基本觀察資訊 */
export async function getRecommendationForStock(opts: {
  db: pg.Pool
  stockId: string
}): Promise<StockRecommendation | null> {
  const all = await computeShortTermRecommendations({ db: opts.db, limit: 500 })
  const hit = all.items.find((x) => x.stockId === opts.stockId)
  if (hit) return hit

  const signalDate = all.signalDate
  if (signalDate === '—') return null

  const dates = await getLastNDates(opts.db, MOM_LOOKBACK + 1, signalDate)
  if (dates.length < MOM_LOOKBACK + 1) return null

  const closeR = await opts.db.query<{ close: string }>(
    `SELECT close::text FROM stock_close WHERE stock_id = $1 AND trade_date = $2`,
    [opts.stockId, signalDate]
  )
  const c0 = Number(closeR.rows[0]?.close)
  if (!c0) return null

  const catalogR = await opts.db.query<{ stock_name: string }>(
    'SELECT stock_name FROM stock_catalog WHERE stock_id = $1',
    [opts.stockId]
  )
  const stockName = catalogR.rows[0]?.stock_name ?? opts.stockId

  return toRecommendation({
    stockId: opts.stockId,
    stockName,
    signalDate,
    referencePrice: c0,
    momentum: 0,
    turnover: 0,
    netRatio: 0,
    top1Share: 0
  })
}
