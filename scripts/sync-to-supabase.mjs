#!/usr/bin/env node
/**
 * 本機 Postgres → Supabase 資料同步腳本
 *
 * 使用方式：
 *   SOURCE_DB_URL=postgres://twbbd:twbbd@localhost:5432/twbbd \
 *   TARGET_DB_URL=postgresql://postgres.[ref]:[pw]@[region].pooler.supabase.com:6543/postgres?sslmode=require \
 *   node scripts/sync-to-supabase.mjs
 *
 * 重複資料處理：所有 table 均採 ON CONFLICT DO NOTHING（以 primary key 比對）。
 * 效能：每批一個 multi-row INSERT，避免逐筆 round-trip。
 */

import pg from 'pg'

const { Pool } = pg

const SOURCE_URL = process.env.SOURCE_DB_URL
const TARGET_URL = process.env.TARGET_DB_URL

if (!SOURCE_URL || !TARGET_URL) {
  console.error('❌ 請設定 SOURCE_DB_URL 和 TARGET_DB_URL 環境變數')
  process.exit(1)
}

const src = new Pool({ connectionString: SOURCE_URL, max: 4 })
const dst = new Pool({ connectionString: TARGET_URL, max: 4, ssl: { rejectUnauthorized: false } })

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

const BATCH = 200

/**
 * 一批一個 multi-row INSERT，比逐筆快很多。
 * buildMultiInsert 回傳 { sql, params }。
 */
function buildMultiInsert(rows, colNames, valuesFn, conflictClause) {
  const params = []
  const placeholderGroups = rows.map((row) => {
    const vals = valuesFn(row)
    const start = params.length + 1
    vals.forEach((v) => params.push(v))
    return `(${vals.map((_, i) => `$${start + i}`).join(', ')})`
  })
  const sql = `
    INSERT INTO ${colNames.table} (${colNames.cols.join(', ')})
    VALUES ${placeholderGroups.join(', ')}
    ${conflictClause}
  `
  return { sql, params }
}

async function syncBatch({ rows, colNames, valuesFn, conflictClause, label }) {
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { sql, params } = buildMultiInsert(chunk, colNames, valuesFn, conflictClause)
    const result = await dst.query(sql, params)
    inserted += result.rowCount ?? 0
    skipped += chunk.length - (result.rowCount ?? 0)

    if (rows.length > BATCH) {
      process.stdout.write(`\r  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}...`)
    }
  }

  if (rows.length > BATCH) process.stdout.write('\n')
  log(`  ${label}: inserted=${inserted} skipped(duplicate)=${skipped} total=${rows.length}`)
}

// ── 各 table ────────────────────────────────────────────────

async function syncTradingDates() {
  log('📅 trading_dates...')
  const { rows } = await src.query('SELECT trade_date::text FROM trading_dates ORDER BY trade_date')
  await syncBatch({
    rows,
    colNames: { table: 'trading_dates', cols: ['trade_date'] },
    valuesFn: (r) => [r.trade_date],
    conflictClause: 'ON CONFLICT DO NOTHING',
    label: 'trading_dates'
  })
}

async function syncDailyStockBlob() {
  log('📦 daily_stock_blob...')
  const { rows } = await src.query(
    'SELECT trade_date::text, market, stock_id, payload FROM daily_stock_blob ORDER BY trade_date, stock_id'
  )
  log(`  總計 ${rows.length} 筆，每批 ${BATCH}...`)
  await syncBatch({
    rows,
    colNames: { table: 'daily_stock_blob', cols: ['trade_date', 'market', 'stock_id', 'payload'] },
    valuesFn: (r) => [r.trade_date, r.market, r.stock_id, JSON.stringify(r.payload)],
    conflictClause: 'ON CONFLICT DO NOTHING',
    label: 'daily_stock_blob'
  })
}

async function syncStockClose() {
  log('💹 stock_close...')
  const { rows } = await src.query(
    'SELECT trade_date::text, stock_id, close FROM stock_close ORDER BY trade_date, stock_id'
  )
  await syncBatch({
    rows,
    colNames: { table: 'stock_close', cols: ['trade_date', 'stock_id', 'close'] },
    valuesFn: (r) => [r.trade_date, r.stock_id, r.close],
    conflictClause: 'ON CONFLICT DO NOTHING',
    label: 'stock_close'
  })
}

async function syncBranchCatalog() {
  log('🏦 branch_catalog...')
  const { rows } = await src.query('SELECT branch_id, branch_name FROM branch_catalog')
  await syncBatch({
    rows,
    colNames: { table: 'branch_catalog', cols: ['branch_id', 'branch_name'] },
    valuesFn: (r) => [r.branch_id, r.branch_name],
    conflictClause: 'ON CONFLICT (branch_id) DO UPDATE SET branch_name = EXCLUDED.branch_name',
    label: 'branch_catalog'
  })
}

async function syncStockCatalog() {
  log('📋 stock_catalog...')
  const { rows } = await src.query('SELECT stock_id, stock_name FROM stock_catalog')
  await syncBatch({
    rows,
    colNames: { table: 'stock_catalog', cols: ['stock_id', 'stock_name'] },
    valuesFn: (r) => [r.stock_id, r.stock_name],
    conflictClause: 'ON CONFLICT (stock_id) DO UPDATE SET stock_name = EXCLUDED.stock_name',
    label: 'stock_catalog'
  })
}

async function syncIngestStatus() {
  log('ℹ️  ingest_status...')
  const { rows } = await src.query('SELECT id, payload FROM ingest_status')
  await syncBatch({
    rows,
    colNames: { table: 'ingest_status', cols: ['id', 'payload'] },
    valuesFn: (r) => [r.id, JSON.stringify(r.payload)],
    conflictClause: 'ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()',
    label: 'ingest_status'
  })
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  log('🚀 開始同步 本機 → Supabase')
  log(`   source: ${SOURCE_URL.replace(/:([^:@]+)@/, ':***@')}`)
  log(`   target: ${TARGET_URL.replace(/:([^:@]+)@/, ':***@')}`)

  try {
    await syncTradingDates()
    await syncDailyStockBlob()
    await syncStockClose()
    await syncBranchCatalog()
    await syncStockCatalog()
    await syncIngestStatus()
    log('✅ 同步完成')
  } finally {
    await src.end()
    await dst.end()
  }
}

main().catch((err) => {
  console.error('❌ 同步失敗', err)
  process.exit(1)
})
