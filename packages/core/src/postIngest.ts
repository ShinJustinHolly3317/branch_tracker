import type pg from 'pg'
import { rebuildDailyBranchBlob } from './dailyBranchBlob.js'
import { computeDefaultPerformanceSnapshot } from './performanceSnapshot.js'

/**
 * ingest 成功後：重建當日 branch blob、清除舊 snapshot、寫入預設績效快取
 */
export async function runIngestPostProcess(params: {
  db: pg.Pool
  tradeDate?: string
}): Promise<{ branchBlobRows: number; snapshotEndDate?: string }> {
  const { db, tradeDate } = params

  let latest = tradeDate
  if (!latest) {
    const r = await db.query<{ trade_date: string }>(
      'SELECT trade_date::text FROM trading_dates ORDER BY trade_date DESC LIMIT 1'
    )
    latest = r.rows[0]?.trade_date
  }

  if (!latest) {
    return { branchBlobRows: 0 }
  }

  const branchBlobRows = await rebuildDailyBranchBlob(db, latest)
  const snap = await computeDefaultPerformanceSnapshot({ db })

  return {
    branchBlobRows,
    snapshotEndDate: snap?.endDate
  }
}
