import { useEffect, useState } from 'react'
import { api } from '../api'
import type { LatestStatusResponse } from '@twbbd/shared'

export function StatusBar() {
  const [status, setStatus] = useState<LatestStatusResponse | null>(null)
  const [warn, setWarn] = useState<string | null>(null)

  useEffect(() => {
    api
      .latestStatus()
      .then(setStatus)
      .catch(() =>
        setWarn('無法連線到資料服務；請確認 API 容器已啟動（預設 http://localhost:8787）。')
      )
  }, [])

  return (
    <div className="card status-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-nav-active)', marginBottom: 4 }}>
            資料狀態
          </div>
          <div className="muted">
            {warn
              ? warn
              : status?.latestDate
                ? `最新交易日：${status.latestDate} · 來源 ${status.provider ?? '—'} · 市場 ${(status.markets ?? []).join('、') || '—'}`
                : '尚未寫入資料；可先執行一次爬蟲。'}
          </div>
        </div>
        <button type="button" className="secondary" onClick={() => window.location.reload()}>
          重新整理
        </button>
      </div>
    </div>
  )
}
