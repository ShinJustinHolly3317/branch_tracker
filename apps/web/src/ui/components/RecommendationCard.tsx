import type { StockRecommendation } from '@twbbd/shared'
import { Link } from 'react-router-dom'

type Props = {
  item: StockRecommendation
  isFavorite: boolean
  onAddFavorite: () => void
  saving?: boolean
}

function confidenceLabel(c: StockRecommendation['confidence']) {
  if (c === 'high') return { text: '信心偏高', cls: 'rec-badge--high' }
  if (c === 'medium') return { text: '信心中等', cls: 'rec-badge--mid' }
  return { text: '信心偏低', cls: 'rec-badge--low' }
}

export function RecommendationCard({ item, isFavorite, onAddFavorite, saving }: Props) {
  const badge = confidenceLabel(item.confidence)
  const momPct = (item.momentum3d * 100).toFixed(1)

  return (
    <article className="rec-card">
      <header className="rec-card__head">
        <div>
          <h3 className="rec-card__title">
            <Link to={`/stock?stockId=${item.stockId}&stockName=${encodeURIComponent(item.stockName)}`}>
              {item.stockId} {item.stockName}
            </Link>
          </h3>
          <p className="muted rec-card__meta">
            訊號日 {item.signalDate} · 參考價 <span className="mono">{item.referencePrice.toFixed(2)}</span>
            · 3日動能 <span className="mono">{momPct}%</span>
          </p>
        </div>
        <div className="rec-card__badges">
          <span className={`rec-badge ${badge.cls}`}>{badge.text}</span>
          <span className="rec-badge rec-badge--score">評分 {item.score}</span>
        </div>
      </header>

      <div className="info-grid rec-card__grid">
        <div className="mini-card">
          <div className="mini-title">買入區間</div>
          <div className="mini-body">
            <span className="mono">
              {item.buyZone.lowPrice.toFixed(2)} ～ {item.buyZone.highPrice.toFixed(2)}
            </span>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {item.buyZone.summary}
            </p>
          </div>
        </div>
        <div className="mini-card">
          <div className="mini-title">怎麼買（{item.buyMethod.style}）</div>
          <div className="mini-body">
            <p style={{ margin: '0 0 8px' }}>{item.buyMethod.summary}</p>
            <ol className="rec-list">
              {item.buyMethod.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="mini-card" style={{ marginTop: 12 }}>
        <div className="mini-title">何時考慮賣出</div>
        <ul className="rec-list rec-list--compact">
          {item.exitConditions.map((e) => (
            <li key={e.label}>
              <strong>{e.label}</strong> — {e.detail}
            </li>
          ))}
        </ul>
      </div>

      <div className="info-grid rec-card__grid" style={{ marginTop: 12 }}>
        <div className="mini-card">
          <div className="mini-title">追蹤事項</div>
          <ul className="rec-list rec-list--compact">
            {item.watchItems.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div className="mini-card rec-caution">
          <div className="mini-title">注意事項</div>
          <ul className="rec-list rec-list--compact">
            {item.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="rec-card__foot">
        <button type="button" disabled={isFavorite || saving} onClick={onAddFavorite}>
          {isFavorite ? '已在最愛清單' : saving ? '加入中…' : '⭐ 加入最愛'}
        </button>
      </footer>
    </article>
  )
}
