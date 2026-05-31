import { mergeBranchBlobPayloads } from '@twbbd/core'
import type {
  BranchAgg,
  ByBranchWindowResponse,
  ByStockWindowResponse,
  StockAgg,
  TradeByBranchDaily
} from '@twbbd/shared'
import type pg from 'pg'

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

function calcConcentration(branches: BranchAgg[]) {
  const shares = branches.map((b) => b.shareOfNetAbs).sort((a, b) => b - a)
  const top1Share = shares[0] ?? 0
  const top3Share = (shares[0] ?? 0) + (shares[1] ?? 0) + (shares[2] ?? 0)
  const hhi = shares.reduce((acc, s) => acc + s * s, 0)
  return { top1Share, top3Share, hhi }
}

export async function aggregateByStock(params: {
  db: pg.Pool
  stockId: string
  dates: string[]
}): Promise<Omit<ByStockWindowResponse, 'startDate' | 'endDate' | 'tradingDays'> & {
  startDate?: string
  endDate?: string
  tradingDays: number
}> {
  const { db, stockId, dates } = params

  const items: TradeByBranchDaily[] = []
  if (dates.length > 0) {
    const r = await db.query<{ payload: unknown }>(
      `SELECT payload
       FROM daily_stock_blob
       WHERE stock_id=$1
         AND trade_date = ANY($2::date[])
         AND market = ANY($3::text[])`,
      [stockId, dates, ['TWSE', 'TPEX']]
    )
    for (const row of r.rows) {
      const rows = row.payload as TradeByBranchDaily[]
      if (Array.isArray(rows)) items.push(...rows)
    }
  }

  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  const byBranch = new Map<string, BranchAgg>()
  for (const r of items) {
    const cur = byBranch.get(r.branchId) ?? {
      branchId: r.branchId,
      branchName: r.branchName,
      buyShares: 0,
      sellShares: 0,
      netShares: 0,
      shareOfNetAbs: 0
    }
    cur.buyShares += safeNumber(r.buyShares)
    cur.sellShares += safeNumber(r.sellShares)
    cur.netShares += safeNumber(r.netShares)
    cur.branchName = r.branchName || cur.branchName
    byBranch.set(r.branchId, cur)
  }

  const branches = [...byBranch.values()].sort((a, b) => b.netShares - a.netShares)
  const netAbsSum =
    branches.reduce((acc, b) => acc + Math.abs(b.netShares), 0) || 1
  for (const b of branches) {
    b.shareOfNetAbs = Math.abs(b.netShares) / netAbsSum
  }

  return {
    stockId,
    startDate,
    endDate,
    tradingDays: dates.length,
    branches,
    concentration: calcConcentration(branches)
  }
}

export async function aggregateByBranch(params: {
  db: pg.Pool
  branchId: string
  dates: string[]
}): Promise<Omit<ByBranchWindowResponse, 'startDate' | 'endDate' | 'tradingDays'> & {
  startDate?: string
  endDate?: string
  tradingDays: number
}> {
  const { db, branchId, dates } = params

  const byStock = new Map<string, StockAgg>()

  if (dates.length > 0) {
    const branchR = await db.query<{ payload: unknown }>(
      `SELECT payload
       FROM daily_branch_blob
       WHERE branch_id = $1
         AND trade_date = ANY($2::date[])`,
      [branchId, dates]
    )

    if (branchR.rows.length > 0) {
      for (const [stockId, row] of mergeBranchBlobPayloads(branchR.rows)) {
        const cur = byStock.get(stockId) ?? {
          stockId,
          buyShares: 0,
          sellShares: 0,
          netShares: 0,
          shareOfNetAbs: 0
        }
        cur.buyShares += row.buyShares
        cur.sellShares += row.sellShares
        cur.netShares += row.netShares
        byStock.set(stockId, cur)
      }
    } else {
      const stockCountR = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n
         FROM daily_stock_blob
         WHERE trade_date = ANY($1::date[])
           AND market = ANY($2::text[])`,
        [dates, ['TWSE', 'TPEX']]
      )
      const hasStockBlob = Number(stockCountR.rows[0]?.n ?? 0) > 0

      if (hasStockBlob) {
        const r = await db.query<{ stock_id: string; payload: unknown }>(
          `SELECT stock_id, payload
           FROM daily_stock_blob
           WHERE trade_date = ANY($1::date[])
             AND market = ANY($2::text[])`,
          [dates, ['TWSE', 'TPEX']]
        )

        for (const row of r.rows) {
          const rows = row.payload as TradeByBranchDaily[]
          if (!Array.isArray(rows)) continue
          for (const rr of rows) {
            if (rr.branchId !== branchId) continue
            const cur = byStock.get(rr.stockId) ?? {
              stockId: rr.stockId,
              buyShares: 0,
              sellShares: 0,
              netShares: 0,
              shareOfNetAbs: 0
            }
            cur.buyShares += safeNumber(rr.buyShares)
            cur.sellShares += safeNumber(rr.sellShares)
            cur.netShares += safeNumber(rr.netShares)
            byStock.set(rr.stockId, cur)
          }
        }
      }
    }
  }

  const stocks = [...byStock.values()].sort((a, b) => b.netShares - a.netShares)
  const netAbsSum = stocks.reduce((acc, s) => acc + Math.abs(s.netShares), 0) || 1
  for (const s of stocks) {
    s.shareOfNetAbs = Math.abs(s.netShares) / netAbsSum
  }

  return {
    branchId,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    tradingDays: dates.length,
    stocks
  }
}

