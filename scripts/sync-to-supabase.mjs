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
 */

import pg from 'pg'

const { Pool } = pg

// ── 連線設定 ──────────────────────────────────────────────
const SOURCE_URL = process.env.SOURCE_DB_URL
const TARGET_URL = process.env.TARGET_DB_URL

if (!SOURCE_URL || !TARGET_URL) {
  console.error('❌ 請設定 SOURCE_DB_URL 和 TARGET_DB_URL 環境變數')
  process.exit(1)
}

const src = new Pool({ connectionString: SOURCE_URL, max: 4 })
const dst = new Pool({ connectionString: TARGET_URL, max: 4, ssl: { rejectUnauthorized: false } })

// ── 工具函式 ──────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

/**
 * 批次大小：避免單筆 query 過大
 * Supabase free tier 每次 request 建議不要超過太多 rows
 */
const BATCH = 500

async function syncInBatches({ table, rows, insertSql, paramsFn, label }) {
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    for (const row of chunk) {
      const params = paramsFn(row)
      const result = await dst.query(insertSql, params)
      if (result.rowCount > 0) inserted++
      else skipped++
    }
  }

  log(`  ${label}: inserted=${inserted} skipped(duplicate)=${skipped} total=${rows.length}`)
}

// ── 各 table 同步 ─────────────────────────────────────────

async function syncTradingDates() {
  log('📅 trading_dates...')
  const { rows } = await src.query('SELECT trade_date::text FROM trading_dates ORDER BY trade_date')
  await syncInBatches({
    table: 'trading_dates',
    rows,
    insertSql: 'INSERT INTO trading_dates (trade_date) VALUES ($1) ON CONFLICT DO NOTHING',
    paramsFn: (r) => [r.trade_date],
    label: 'trading_dates'
  })
}

async function syncDailyStockBlob() {
  log('📦 daily_stock_blob...')
  const { rows } = await src.query(
    'SELECT trade_date::text, market, stock_id, payload FROM daily_stock_blob ORDER BY trade_date, stock_id'
  )
  log(`  總計 ${rows.length} 筆，每批 ${BATCH}...`)

  await syncInBatches({
    table: 'daily_stock_blob',
    rows,
    insertSql: `
      INSERT INTO daily_stock_blob (trade_date, market, stock_id, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT DO NOTHING
    `,
    paramsFn: (r) => [r.trade_date, r.market, r.stock_id, JSON.stringify(r.payload)],
    label: 'daily_stock_blob'
  })
}

async function syncStockClose() {
  log('💹 stock_close...')
  const { rows } = await src.query(
    'SELECT trade_date::text, stock_id, close FROM stock_close ORDER BY trade_date, stock_id'
  )
  await syncInBatches({
    table: 'stock_close',
    rows,
    insertSql: `
      INSERT INTO stock_close (trade_date, stock_id, close)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `,
    paramsFn: (r) => [r.trade_date, r.stock_id, r.close],
    label: 'stock_close'
  })
}

async function syncBranchCatalog() {
  log('🏦 branch_catalog...')
  const { rows } = await src.query('SELECT branch_id, branch_name FROM branch_catalog')
  await syncInBatches({
    table: 'branch_catalog',
    rows,
    insertSql: `
      INSERT INTO branch_catalog (branch_id, branch_name)
      VALUES ($1, $2)
      ON CONFLICT (branch_id) DO UPDATE SET branch_name = EXCLUDED.branch_name
    `,
    paramsFn: (r) => [r.branch_id, r.branch_name],
    label: 'branch_catalog'
  })
}

async function syncStockCatalog() {
  log('📋 stock_catalog...')
  const { rows } = await src.query('SELECT stock_id, stock_name FROM stock_catalog')
  await syncInBatches({
    table: 'stock_catalog',
    rows,
    insertSql: `
      INSERT INTO stock_catalog (stock_id, stock_name)
      VALUES ($1, $2)
      ON CONFLICT (stock_id) DO UPDATE SET stock_name = EXCLUDED.stock_name
    `,
    paramsFn: (r) => [r.stock_id, r.stock_name],
    label: 'stock_catalog'
  })
}

async function syncIngestStatus() {
  log('ℹ️  ingest_status...')
  const { rows } = await src.query('SELECT id, payload FROM ingest_status')
  await syncInBatches({
    table: 'ingest_status',
    rows,
    insertSql: `
      INSERT INTO ingest_status (id, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `,
    paramsFn: (r) => [r.id, JSON.stringify(r.payload)],
    label: 'ingest_status'
  })
}

// ── 主流程 ────────────────────────────────────────────────

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
