import type { StockPriceWindow } from '@twbbd/shared'

type Props = {
  stockId: string
  stockName?: string
  priceWindow: StockPriceWindow
}

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSignedAmount(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return `${sign}${fmtPrice(n)}`
}

function fmtSignedPercent(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return `${sign}${(n * 100).toFixed(2)}%`
}

/** 個股區間漲跌摘要：起漲價、目前價、漲跌金額與 % */
export function StockPriceSummary({ stockId, stockName, priceWindow }: Props) {
  const { startDate, endDate, startClose, endClose, changeAmount, changePercent } = priceWindow
  const up = changeAmount > 0
  const down = changeAmount < 0
  const toneClass = up ? 'stock-price-summary--up' : down ? 'stock-price-summary--down' : ''

  return (
    <div className={`stock-price-summary ${toneClass}`}>
      <div className="stock-price-summary__title">
        個股區間漲跌
        <span className="stock-price-summary__stock">
          <span className="mono">{stockId}</span>
          {stockName ? ` ${stockName}` : ''}
        </span>
      </div>
      <div className="stock-price-summary__grid">
        <div className="stock-price-summary__item">
          <span className="stock-price-summary__label">起漲價格</span>
          <span className="stock-price-summary__value">{fmtPrice(startClose)}</span>
          <span className="stock-price-summary__sub muted">{startDate}</span>
        </div>
        <div className="stock-price-summary__item">
          <span className="stock-price-summary__label">目前價格</span>
          <span className="stock-price-summary__value">{fmtPrice(endClose)}</span>
          <span className="stock-price-summary__sub muted">{endDate}</span>
        </div>
        <div className="stock-price-summary__item">
          <span className="stock-price-summary__label">漲跌金額</span>
          <span className="stock-price-summary__value stock-price-summary__change">
            {fmtSignedAmount(changeAmount)}
          </span>
        </div>
        <div className="stock-price-summary__item">
          <span className="stock-price-summary__label">漲跌幅</span>
          <span className="stock-price-summary__value stock-price-summary__change">
            {fmtSignedPercent(changePercent)}
          </span>
        </div>
      </div>
    </div>
  )
}
