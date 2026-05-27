import type pg from 'pg'
import type { CreateFavoriteRequest, StrategySnapshot, UpdateFavoriteRequest, UserFavorite } from '@twbbd/shared'

function rowToFavorite(row: {
  id: string
  client_id: string
  stock_id: string
  stock_name: string
  added_at: Date
  buy_date: string | null
  buy_price: string | null
  notes: string | null
  strategy_snapshot: StrategySnapshot
  updated_at: Date
}): UserFavorite {
  return {
    id: row.id,
    clientId: row.client_id,
    stockId: row.stock_id,
    stockName: row.stock_name,
    addedAt: row.added_at.toISOString(),
    buyDate: row.buy_date,
    buyPrice: row.buy_price != null ? Number(row.buy_price) : null,
    notes: row.notes,
    strategySnapshot: row.strategy_snapshot ?? ({} as StrategySnapshot),
    updatedAt: row.updated_at.toISOString()
  }
}

export async function listFavorites(db: pg.Pool, clientId: string): Promise<UserFavorite[]> {
  const r = await db.query(
    `SELECT id, client_id, stock_id, stock_name, added_at, buy_date::text, buy_price::text, notes, strategy_snapshot, updated_at
     FROM user_favorites
     WHERE client_id = $1
     ORDER BY added_at DESC`,
    [clientId]
  )
  return r.rows.map(rowToFavorite)
}

export async function createFavorite(
  db: pg.Pool,
  clientId: string,
  body: CreateFavoriteRequest
): Promise<UserFavorite> {
  const r = await db.query(
    `INSERT INTO user_favorites (client_id, stock_id, stock_name, buy_date, buy_price, notes, strategy_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (client_id, stock_id) DO UPDATE SET
       stock_name = EXCLUDED.stock_name,
       buy_date = COALESCE(EXCLUDED.buy_date, user_favorites.buy_date),
       buy_price = COALESCE(EXCLUDED.buy_price, user_favorites.buy_price),
       notes = COALESCE(EXCLUDED.notes, user_favorites.notes),
       strategy_snapshot = EXCLUDED.strategy_snapshot,
       updated_at = now()
     RETURNING id, client_id, stock_id, stock_name, added_at, buy_date::text, buy_price::text, notes, strategy_snapshot, updated_at`,
    [
      clientId,
      body.stockId,
      body.stockName,
      body.buyDate ?? null,
      body.buyPrice ?? null,
      body.notes ?? null,
      JSON.stringify(body.strategySnapshot)
    ]
  )
  return rowToFavorite(r.rows[0])
}

export async function updateFavorite(
  db: pg.Pool,
  clientId: string,
  id: string,
  body: UpdateFavoriteRequest
): Promise<UserFavorite | null> {
  const r = await db.query(
    `UPDATE user_favorites SET
       buy_date = COALESCE($3, buy_date),
       buy_price = COALESCE($4, buy_price),
       notes = COALESCE($5, notes),
       updated_at = now()
     WHERE id = $1 AND client_id = $2
     RETURNING id, client_id, stock_id, stock_name, added_at, buy_date::text, buy_price::text, notes, strategy_snapshot, updated_at`,
    [id, clientId, body.buyDate ?? null, body.buyPrice ?? null, body.notes ?? null]
  )
  if (!r.rows[0]) return null
  return rowToFavorite(r.rows[0])
}

export async function deleteFavorite(db: pg.Pool, clientId: string, id: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM user_favorites WHERE id = $1 AND client_id = $2`, [id, clientId])
  return (r.rowCount ?? 0) > 0
}
