import { useState } from 'react'
import type { UserFavorite } from '@twbbd/shared'
import { Link } from 'react-router-dom'

type Props = {
  item: UserFavorite
  onSave: (id: string, patch: { buyDate: string | null; buyPrice: number | null; notes: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function FavoriteCard({ item, onSave, onDelete }: Props) {
  const snap = item.strategySnapshot
  const [editing, setEditing] = useState(false)
  const [buyDate, setBuyDate] = useState(item.buyDate ?? '')
  const [buyPrice, setBuyPrice] = useState(item.buyPrice != null ? String(item.buyPrice) : '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setBusy(true)
    try {
      await onSave(item.id, {
        buyDate: buyDate.trim() || null,
        buyPrice: buyPrice.trim() ? Number(buyPrice) : null,
        notes: notes.trim() || null
      })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`確定從最愛移除 ${item.stockId} ${item.stockName}？`)) return
    setBusy(true)
    try {
      await onDelete(item.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rec-card fav-card">
      <header className="rec-card__head">
        <div>
          <h3 className="rec-card__title">
            <Link to={`/stock?stockId=${item.stockId}&stockName=${encodeURIComponent(item.stockName)}`}>
              {item.stockId} {item.stockName}
            </Link>
          </h3>
          <p className="muted rec-card__meta">
            加入時間 {new Date(item.addedAt).toLocaleString('zh-TW')} · 策略 {snap.strategyName ?? '—'} · 訊號日{' '}
            {snap.signalDate ?? '—'}
          </p>
        </div>
        <div className="rec-card__badges">
          {!editing ? (
            <>
              <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(true)}>
                編輯買進紀錄
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={handleDelete}>
                移除
              </button>
            </>
          ) : null}
        </div>
      </header>

      {editing ? (
        <div className="row align-start fav-edit">
          <label className="field">
            <span className="field-label">買進日期</span>
            <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">買進價格</span>
            <input
              type="number"
              step="0.01"
              placeholder="例：230.5"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
            />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            <span className="field-label">備註</span>
            <input
              type="text"
              placeholder="例：第一批 40% 已進"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button type="button" disabled={busy} onClick={handleSave}>
            儲存
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>
            取消
          </button>
        </div>
      ) : (
        <div className="info-grid fav-summary">
          <div className="mini-card">
            <div className="mini-title">我的買進</div>
            <div className="mini-body">
              日期：{item.buyDate ?? '（尚未填寫）'}
              <br />
              價格：{item.buyPrice != null ? item.buyPrice.toFixed(2) : '（尚未填寫）'}
              {item.notes ? (
                <>
                  <br />
                  備註：{item.notes}
                </>
              ) : null}
            </div>
          </div>
          <div className="mini-card">
            <div className="mini-title">當時建議買入區間</div>
            <div className="mini-body mono">
              {snap.buyZone
                ? `${snap.buyZone.lowPrice.toFixed(2)} ～ ${snap.buyZone.highPrice.toFixed(2)}（參考 ${snap.buyZone.referencePrice.toFixed(2)}）`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {snap.buyMethod ? (
        <div className="mini-card" style={{ marginTop: 12 }}>
          <div className="mini-title">進場方式（{snap.buyMethod.style}）</div>
          <ol className="rec-list rec-list--compact">
            {snap.buyMethod.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {snap.exitConditions?.length ? (
        <div className="mini-card" style={{ marginTop: 12 }}>
          <div className="mini-title">賣出條件</div>
          <ul className="rec-list rec-list--compact">
            {snap.exitConditions.map((e) => (
              <li key={e.label}>
                <strong>{e.label}</strong> — {e.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="info-grid rec-card__grid" style={{ marginTop: 12 }}>
        {snap.watchItems?.length ? (
          <div className="mini-card">
            <div className="mini-title">追蹤事項</div>
            <ul className="rec-list rec-list--compact">
              {snap.watchItems.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {snap.cautions?.length ? (
          <div className="mini-card rec-caution">
            <div className="mini-title">注意事項</div>
            <ul className="rec-list rec-list--compact">
              {snap.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  )
}
