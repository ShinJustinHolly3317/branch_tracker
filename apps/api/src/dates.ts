import type pg from 'pg'

export async function getLatestDate(db: pg.Pool): Promise<string | undefined> {
  const r = await db.query<{ trade_date: string }>(
    'SELECT trade_date::text FROM trading_dates ORDER BY trade_date DESC LIMIT 1'
  )
  return r.rows[0]?.trade_date
}

export async function getLastNDates(
  db: pg.Pool,
  days: number,
  endDate?: string
): Promise<string[]> {
  if (days <= 0) return []

  if (!endDate) {
    const r = await db.query<{ trade_date: string }>(
      'SELECT trade_date::text FROM trading_dates ORDER BY trade_date DESC LIMIT $1',
      [days]
    )
    return r.rows.map((x) => x.trade_date).reverse()
  }

  const r = await db.query<{ trade_date: string }>(
    `SELECT trade_date::text
     FROM trading_dates
     WHERE trade_date <= $1
     ORDER BY trade_date DESC
     LIMIT $2`,
    [endDate, days]
  )
  return r.rows.map((x) => x.trade_date).reverse()
}

