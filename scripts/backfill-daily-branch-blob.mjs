#!/usr/bin/env node
/**
 * 歷史回填：所有 daily_stock_blob 交易日 → daily_branch_blob，再 purge + 預設績效 snapshot
 */
import pg from 'pg'
import {
  rebuildDailyBranchBlob,
  computeDefaultPerformanceSnapshot
} from '../packages/core/dist/index.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('需要 DATABASE_URL')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, max: 4 })

const datesR = await pool.query(
  `SELECT DISTINCT trade_date::text AS trade_date
   FROM daily_stock_blob
   ORDER BY trade_date ASC`
)
const dates = datesR.rows.map((r) => r.trade_date)
console.log(`[backfill] ${dates.length} trade dates`)

let totalRows = 0
for (const tradeDate of dates) {
  const n = await rebuildDailyBranchBlob(pool, tradeDate)
  totalRows += n
  if (dates.indexOf(tradeDate) % 50 === 0) {
    console.log(`[backfill] ${tradeDate} branch rows=${n}`)
  }
}
console.log(`[backfill] daily_branch_blob done, inserted/updated branches=${totalRows}`)

const snap = await computeDefaultPerformanceSnapshot({ db: pool })
console.log(
  `[backfill] default snapshot endDate=${snap?.endDate ?? '—'} effectiveK=${snap?.effectiveK ?? '—'}`
)

await pool.end()
