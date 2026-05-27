import type { StockPriceWindow } from '@twbbd/shared'
import type pg from 'pg'

/**
 * 依起訖交易日從 stock_close 取收盤價，計算漲跌金額與比例。
 * 任一端缺價則回傳 null。
 */
export async function getStockPriceWindow(
  db: pg.Pool,
  stockId: string,
  startDate: string,
  endDate: string
): Promise<StockPriceWindow | null> {
  const r = await db.query<{ trade_date: string; close: string }>(
    `SELECT trade_date::text, close::text
     FROM stock_close
     WHERE stock_id = $1 AND trade_date = ANY($2::date[])`,
    [stockId, [startDate, endDate]]
  )

  let startClose: number | undefined
  let endClose: number | undefined

  for (const row of r.rows) {
    const n = Number(row.close)
    if (!Number.isFinite(n)) continue
    if (row.trade_date === startDate) startClose = n
    if (row.trade_date === endDate) endClose = n
  }

  if (startClose === undefined || endClose === undefined) return null

  const changeAmount = endClose - startClose
  const changePercent = startClose !== 0 ? changeAmount / startClose : 0

  return {
    startDate,
    endDate,
    startClose,
    endClose,
    changeAmount,
    changePercent
  }
}
