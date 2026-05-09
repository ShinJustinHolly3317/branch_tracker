import pg from 'pg'
import { getEnv } from './env.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getDb(): pg.Pool {
  if (pool) return pool
  const env = getEnv()
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10
  })
  return pool
}

