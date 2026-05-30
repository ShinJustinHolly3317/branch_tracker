#!/usr/bin/env node
/**
 * 套用 supabase/migrations 內尚未執行的 SQL（需 DATABASE_URL 指向 Supabase）
 */
import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.DATABASE_URL ?? process.env.TARGET_DB_URL
if (!url) {
  console.error('需要 DATABASE_URL 或 TARGET_DB_URL（Supabase）')
  process.exit(1)
}

const ssl = url.includes('supabase') || url.includes('sslmode=require')
const pool = new pg.Pool({
  connectionString: url,
  max: 2,
  ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
})

const dir = join(ROOT, 'supabase/migrations')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8')
  console.log(' applying', file)
  await pool.query(sql)
}
console.log('✅ migrations applied:', files.length)
await pool.end()
