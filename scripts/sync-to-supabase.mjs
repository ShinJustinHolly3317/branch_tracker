#!/usr/bin/env node
/**
 * 本機 Postgres → Supabase 資料同步腳本
 *
 * 使用方式（專案根目錄）：
 *   npm run sync:supabase
 *
 * 預設：
 *   - source：本機 docker postgres（或 .env / SOURCE_DB_URL）
 *   - target：.env 的 DATABASE_URL（Supabase）或 TARGET_DB_URL
 *
 * 重複資料處理：所有 table 均採 ON CONFLICT DO NOTHING（以 primary key 比對）。
 * 效能：每批一個 multi-row INSERT，避免逐筆 round-trip。
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_SOURCE = 'postgres://twbbd:twbbd@localhost:5432/twbbd'

/** 讀取專案根目錄 .env（不覆蓋已存在的 process.env） */
function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const fileEnv = loadEnvFile(join(ROOT, '.env'))

const SOURCE_URL =
  process.env.SOURCE_DB_URL ?? fileEnv.SOURCE_DB_URL ?? DEFAULT_SOURCE
const TARGET_URL =
  process.env.TARGET_DB_URL ??
  fileEnv.TARGET_DB_URL ??
  process.env.DATABASE_URL ??
  fileEnv.DATABASE_URL

if (!TARGET_URL) {
  console.error('❌ 找不到 target：請在 .env 設定 DATABASE_URL（Supabase），或設 TARGET_DB_URL')
  process.exit(1)
}

if (SOURCE_URL === TARGET_URL) {
  console.error('❌ source 與 target 相同，請確認 .env 的 DATABASE_URL 是 Supabase，本機用預設或 SOURCE_DB_URL')
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
