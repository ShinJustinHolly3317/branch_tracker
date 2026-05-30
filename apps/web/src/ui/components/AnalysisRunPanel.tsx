import type { AnalysisRunDetail, AnalysisRunListItem } from '@twbbd/shared'

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

function pctSigned(x: number) {
  const p = (x * 100).toFixed(2)
  return `${x >= 0 ? '+' : ''}${p}%`
}

function sourceLabel(source: string) {
  if (source === 'cursor-cloud') return 'Cursor Cloud'
  if (source === 'manual') return '手動'
  return source
}

type ListProps = {
  items: AnalysisRunListItem[]
  selectedId: string | null
  loading: boolean
  onSelect: (id: string) => void
}

export function AnalysisRunList({ items, selectedId, loading, onSelect }: ListProps) {
  if (loading && items.length === 0) {
    return <p className="muted">載入分析紀錄中…</p>
  }
  if (!loading && items.length === 0) {
    return (
      <div className="hint-warn">
        尚無分析紀錄。排程或手動執行 <code>npm run team-trading</code> 後會出現在這裡。
      </div>
    )
  }
  return (
    <div className="analysis-run-list">
      {items.map((run) => (
        <button
          key={run.id}
          type="button"
          className={`analysis-run-row${selectedId === run.id ? ' active' : ''}`}
          onClick={() => onSelect(run.id)}
        >
          <div className="analysis-run-row__head">
            <strong>{run.runDate}</strong>
            <span className="muted">{sourceLabel(run.source)}</span>
          </div>
          <div className="analysis-run-row__meta muted">
            {new Date(run.generatedAt).toLocaleString('zh-TW')} · {run.strategies.length} 套策略
          </div>
          <div className="analysis-run-row__verdicts">
            {run.strategies.map((s) => (
              <span key={s.id} className="rec-badge rec-badge--mid" title={s.verdict}>
                {s.name}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  )
}

type DetailProps = {
  detail: AnalysisRunDetail | null
  loading: boolean
  error?: string | null
}

export function AnalysisRunDetailPanel({ detail, loading, error }: DetailProps) {
  if (loading) return <p className="muted">載入報告中…</p>
  if (error) return <div className="hint-warn">{error}</div>
  if (!detail) {
    return <p className="muted">← 選一筆分析紀錄查看完整報告</p>
  }

  return (
    <div className="analysis-run-detail">
      <header className="analysis-run-detail__head">
        <h3 className="page-title" style={{ margin: 0 }}>
          {detail.runDate} 分析報告
        </h3>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {sourceLabel(detail.source)} · {new Date(detail.generatedAt).toLocaleString('zh-TW')}
        </p>
      </header>

      {detail.strategies.map((s) => (
        <article key={s.id} className="rec-card" style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>
            {s.name} <span className="rec-badge">{s.selectedVersion}</span>
          </h4>
          <p className="rec-badge rec-badge--mid" style={{ display: 'inline-block' }}>
            {s.verdict}
          </p>
          <p style={{ margin: '8px 0' }}>
            樣本 {s.samples} · 勝率 {pct(s.winRate)} · 平均報酬{' '}
            <span className={s.avgReturn >= 0 ? 'pos' : 'neg'}>{pctSigned(s.avgReturn)}</span>
          </p>
          {s.picks.length > 0 ? (
            <>
              <div className="mini-title">當日觸發</div>
              <ul className="rec-list rec-list--compact">
                {s.picks.map((p) => (
                  <li key={p.stockId}>
                    {p.stockId} {p.stockName}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">當日無觸發標的</p>
          )}
        </article>
      ))}

      <div className="row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const blob = new Blob([detail.reportHtml], { type: 'text/html;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank', 'noopener,noreferrer')
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
          }}
        >
          開啟完整 HTML 報告
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        風險聲明：策略研究用途，非投資建議。
      </p>
    </div>
  )
}
