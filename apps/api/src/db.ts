import pg from 'pg'
import { getEnv } from './env.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getDb(): pg.Pool {
  if (pool) return pool
  const env = getEnv()
  /**
   * Vercel 等無伺服器每次呼叫視為短命行程；Pg pool 請收斂，
   * 並搭配 Supabase「Transaction pooling」連線埠（通常是 6543）較適合長尾冷啟連線。
   */
  const onServerlessPlatform = typeof process.env.VERCEL !== 'undefined'
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: onServerlessPlatform ? Math.min(Number(process.env.API_PG_POOL_MAX ?? 2), 5) : 10
  })
  return pool
}

