import type {
  BranchPerformanceResponse,
  PerformanceMetric,
  TradeByBranchDaily
} from '@twbbd/shared'
import type pg from 'pg'

type Sample = { branchId: string; branchName: string; value: number; weight: number }

function closeKey(tradeDate: string, stockId: string): string {
  return `${tradeDate}|${stockId}`
}

export async function computeBranchPerformance(params: {
  db: pg.Pool
  datesAll: string[] // sorted ascending
  endDate: string
  tradingDays: number
  forwardTradingDays: number
  metric: PerformanceMetric
  minSampleSize: number
  requestedForwardTradingDays: number
}): Promise<BranchPerformanceResponse> {
  const {
    db,
    datesAll,
    endDate,
    tradingDays,
    forwardTradingDays,
    metric,
    minSampleSize,
    requestedForwardTradingDays
  } = params

  const emptyBase = {
    startDate: endDate,
    endDate,
    tradingDays,
    forwardTradingDays,
    metric,
    minSampleSize,
    top: [] as BranchPerformanceResponse['top'],
    reasonCode: 'computed' as const,
    requestedForwardTradingDays,
    effectiveForwardTradingDays: forwardTradingDays
  }

  const endIdx = datesAll.lastIndexOf(endDate)
  if (endIdx === -1) {
    return emptyBase
  }

  const windowStart = Math.max(0, endIdx - tradingDays + 1)
  const windowDates = datesAll.slice(windowStart, endIdx + 1)
  if (windowDates.length === 0) {
    return emptyBase
  }

  const dateIdx = new Map(datesAll.map((d, i) => [d, i]))

  /** 可計算前瞻報酬的 (eventDate, forwardDate) */
  const eventPairs: { eventDate: string; forwardDate: string }[] = []
  const closeDates = new Set<string>()
  for (const eventDate of windowDates) {
    const idx = dateIdx.get(eventDate)
    if (idx === undefined) continue
    const fwdIdx = idx + forwardTradingDays
    if (fwdIdx >= datesAll.length) continue
    const forwardDate = datesAll[fwdIdx]!
    eventPairs.push({ eventDate, forwardDate })
    closeDates.add(eventDate)
    closeDates.add(forwardDate)
  }

  const closeByKey = new Map<string, number>()
  if (closeDates.size > 0) {
    const closeR = await db.query<{ trade_date: string; stock_id: string; close: string }>(
      `SELECT trade_date::text, stock_id, close::text
       FROM stock_close
       WHERE trade_date = ANY($1::date[])`,
      [[...closeDates]]
    )
    for (const row of closeR.rows) {
      const n = Number(row.close)
      if (Number.isFinite(n)) closeByKey.set(closeKey(row.trade_date, row.stock_id), n)
    }
  }

  const blobsByDate = new Map<string, { stock_id: string; payload: unknown }[]>()
  if (windowDates.length > 0) {
    const dailyR = await db.query<{ trade_date: string; stock_id: string; payload: unknown }>(
      `SELECT trade_date::text, stock_id, payload
       FROM daily_stock_blob
       WHERE trade_date = ANY($1::date[])
         AND market = ANY($2::text[])`,
      [windowDates, ['TWSE', 'TPEX']]
    )
    for (const row of dailyR.rows) {
      const list = blobsByDate.get(row.trade_date) ?? []
      list.push({ stock_id: row.stock_id, payload: row.payload })
      blobsByDate.set(row.trade_date, list)
    }
  }

  const samplesByBranch = new Map<string, Sample[]>()

  for (const { eventDate, forwardDate } of eventPairs) {
    const dailyRows = blobsByDate.get(eventDate) ?? []
    for (const row of dailyRows) {
      const stockId = row.stock_id
      const close0 = closeByKey.get(closeKey(eventDate, stockId))
      const close1 = closeByKey.get(closeKey(forwardDate, stockId))
      if (close0 === undefined || close1 === undefined || close0 <= 0) continue

      const ret = (close1 - close0) / close0
      const rows = row.payload as TradeByBranchDaily[]
      if (!Array.isArray(rows)) continue
      for (const r of rows) {
        if (r.netShares <= 0) continue

        const list = samplesByBranch.get(r.branchId) ?? []
        const weight = Math.max(0, r.netShares) * close0
        list.push({
          branchId: r.branchId,
          branchName: r.branchName,
          value: ret,
          weight
        })
        samplesByBranch.set(r.branchId, list)
      }
    }
  }

  const rows = [...samplesByBranch.entries()]
    .map(([branchId, samples]) => {
      const branchName = samples.find((s) => s.branchName)?.branchName ?? branchId
      const n = samples.length
      if (n < minSampleSize) return null

      let value = 0
      if (metric === 'avgForwardReturn') {
        value = samples.reduce((acc, s) => acc + s.value, 0) / n
      } else if (metric === 'hitRate') {
        value = samples.reduce((acc, s) => acc + (s.value > 0 ? 1 : 0), 0) / n
      } else {
        value = samples.reduce((acc, s) => acc + s.weight * s.value, 0)
      }

      return {
        branchId,
        branchName,
        sampleSize: n,
        value
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return {
    startDate: windowDates[0] ?? endDate,
    endDate,
    tradingDays,
    forwardTradingDays,
    metric,
    minSampleSize,
    top: rows,
    reasonCode: 'computed',
    requestedForwardTradingDays,
    effectiveForwardTradingDays: forwardTradingDays,
    ...(rows.length === 0
      ? {
          debugMessage:
            '已選定 endDate，但樣本不足（常見原因：資料庫交易日曆太短、對應 K 日以後缺少收盤價 stock_close、或 minSample 太大）。可先試降低最小樣本或縮短 K。'
        }
      : {})
  }
}
