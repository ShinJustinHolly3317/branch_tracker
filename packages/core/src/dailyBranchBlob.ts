import type { TradeByBranchDaily } from '@twbbd/shared'
import type pg from 'pg'

/** daily_branch_blob.payload 單筆股票彙總 */
export type BranchBlobStockRow = {
  stockId: string
  buyShares: number
  sellShares: number
  netShares: number
}

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/**
 * 由 daily_stock_blob 翻轉寫入 daily_branch_blob（單一 trade_date）
 */
export async function rebuildDailyBranchBlob(db: pg.Pool, tradeDate: string): Promise<number> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    await client.query('DELETE FROM daily_branch_blob WHERE trade_date = $1::date', [tradeDate])

    const r = await client.query<{ market: string; stock_id: string; payload: unknown }>(
      `SELECT market, stock_id, payload
       FROM daily_stock_blob
       WHERE trade_date = $1::date`,
      [tradeDate]
    )

    const byMarketBranch = new Map<string, Map<string, Map<string, BranchBlobStockRow>>>()

    for (const row of r.rows) {
      const rows = row.payload as TradeByBranchDaily[]
      if (!Array.isArray(rows)) continue

      let byBranch = byMarketBranch.get(row.market)
      if (!byBranch) {
        byBranch = new Map()
        byMarketBranch.set(row.market, byBranch)
      }

      for (const rr of rows) {
        let byStock = byBranch.get(rr.branchId)
        if (!byStock) {
          byStock = new Map()
          byBranch.set(rr.branchId, byStock)
        }
        const cur = byStock.get(rr.stockId) ?? {
          stockId: rr.stockId,
          buyShares: 0,
          sellShares: 0,
          netShares: 0
        }
        cur.buyShares += safeNumber(rr.buyShares)
        cur.sellShares += safeNumber(rr.sellShares)
        cur.netShares += safeNumber(rr.netShares)
        byStock.set(rr.stockId, cur)
      }
    }

    let inserted = 0
    for (const [market, byBranch] of byMarketBranch) {
      for (const [branchId, byStock] of byBranch) {
        const payload = [...byStock.values()]
        await client.query(
          `INSERT INTO daily_branch_blob (trade_date, market, branch_id, payload)
           VALUES ($1::date, $2, $3, $4::jsonb)
           ON CONFLICT (trade_date, market, branch_id)
           DO UPDATE SET payload = EXCLUDED.payload`,
          [tradeDate, market, branchId, JSON.stringify(payload)]
        )
        inserted++
      }
    }

    await client.query('COMMIT')
    return inserted
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** 合併多個 trade_date 的 branch blob payload 為 stock 彙總 */
export function mergeBranchBlobPayloads(
  rows: { payload: unknown }[]
): Map<string, BranchBlobStockRow> {
  const byStock = new Map<string, BranchBlobStockRow>()
  for (const row of rows) {
    const items = row.payload as BranchBlobStockRow[]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (!item?.stockId) continue
      const cur = byStock.get(item.stockId) ?? {
        stockId: item.stockId,
        buyShares: 0,
        sellShares: 0,
        netShares: 0
      }
      cur.buyShares += safeNumber(item.buyShares)
      cur.sellShares += safeNumber(item.sellShares)
      cur.netShares += safeNumber(item.netShares)
      byStock.set(item.stockId, cur)
    }
  }
  return byStock
}
