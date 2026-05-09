import type {
  BranchPerformanceResponse,
  PerformanceMetric,
  TradeByBranchDaily
} from '@twbbd/shared'
import type pg from 'pg'

type Sample = { branchId: string; branchName: string; value: number; weight: number }

export async function computeBranchPerformance(params: {
  db: pg.Pool
  datesAll: string[] // sorted ascending
  endDate: string
  tradingDays: number
  forwardTradingDays: number
  metric: PerformanceMetric
  minSampleSize: number
}): Promise<BranchPerformanceResponse> {
  const { db, datesAll, endDate, tradingDays, forwardTradingDays, metric, minSampleSize } =
    params

  const endIdx = datesAll.lastIndexOf(endDate)
  if (endIdx === -1) {
    return {
      startDate: endDate,
      endDate,
      tradingDays,
      forwardTradingDays,
      metric,
      minSampleSize,
      top: []
    }
  }

  const windowStart = Math.max(0, endIdx - tradingDays + 1)
  const windowDates = datesAll.slice(windowStart, endIdx + 1)

  const samplesByBranch = new Map<string, Sample[]>()
  const sampleCountByBranch = new Map<string, number>()

  for (const date of windowDates) {
    const idx = datesAll.lastIndexOf(date)
    const fwdIdx = idx + forwardTradingDays
    if (fwdIdx >= datesAll.length) continue
    const forwardDate = datesAll[fwdIdx]

    const daily = await db.query<{ stock_id: string; payload: unknown }>(
      `SELECT stock_id, payload
       FROM daily_stock_blob
       WHERE trade_date=$1
         AND market = ANY($2::text[])`,
      [date, ['TWSE', 'TPEX']]
    )

    for (const row of daily.rows) {
      const stockId = row.stock_id
      const closes = await db.query<{ close0: string; close1: string }>(
        `SELECT
           (SELECT close::text FROM stock_close WHERE trade_date=$1 AND stock_id=$3) AS close0,
           (SELECT close::text FROM stock_close WHERE trade_date=$2 AND stock_id=$3) AS close1`,
        [date, forwardDate, stockId]
      )
      const close0 = Number(closes.rows[0]?.close0)
      const close1 = Number(closes.rows[0]?.close1)
      if (!Number.isFinite(close0) || !Number.isFinite(close1) || close0 <= 0) continue

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
        sampleCountByBranch.set(r.branchId, (sampleCountByBranch.get(r.branchId) ?? 0) + 1)
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
        // weightedPnlProxy
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
    top: rows
  }
}

