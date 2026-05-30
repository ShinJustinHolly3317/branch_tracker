import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { AnalysisRunDetail, AnalysisRunListItem, ShortTermRecommendationsResponse, UserFavorite } from '@twbbd/shared'
import { RecommendationCard } from '../components/RecommendationCard'
import { FavoriteCard } from '../components/FavoriteCard'
import { AnalysisRunDetailPanel, AnalysisRunList } from '../components/AnalysisRunPanel'

type Tab = 'recommend' | 'favorites' | 'history'

export function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>('recommend')
  const [recData, setRecData] = useState<ShortTermRecommendationsResponse | null>(null)
  const [favorites, setFavorites] = useState<UserFavorite[]>([])
  const [loadingRec, setLoadingRec] = useState(false)
  const [loadingFav, setLoadingFav] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRunListItem[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runDetail, setRunDetail] = useState<AnalysisRunDetail | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingRunDetail, setLoadingRunDetail] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runDetailError, setRunDetailError] = useState<string | null>(null)

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.stockId)), [favorites])

  const loadRecommendations = useCallback(async () => {
    setLoadingRec(true)
    setHint(null)
    try {
      const r = await api.shortTermRecommendations(20)
      setRecData(r)
      if (r.debugMessage) setHint(r.debugMessage)
      if (r.items.length === 0 && !r.debugMessage) {
        setHint('今日沒有符合「溫和動能 × 分點確認」的標的，可改天再來或到 Stock 頁自行觀察。')
      }
    } catch {
      setHint('無法載入推薦清單，請確認 API 已啟動。')
    } finally {
      setLoadingRec(false)
    }
  }, [])

  const loadFavorites = useCallback(async () => {
    setLoadingFav(true)
    try {
      const r = await api.listFavorites()
      setFavorites(r.items)
    } catch {
      setHint('無法載入最愛清單。')
    } finally {
      setLoadingFav(false)
    }
  }, [])

  const loadAnalysisRuns = useCallback(async () => {
    setLoadingRuns(true)
    setRunsError(null)
    try {
      const r = await api.listAnalysisRuns(30)
      setAnalysisRuns(r.items)
      setSelectedRunId((prev) => prev ?? r.items[0]?.id ?? null)
    } catch {
      setRunsError('無法載入分析紀錄，請確認 API 已啟動。')
      setAnalysisRuns([])
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    void loadRecommendations()
    void loadFavorites()
    void loadAnalysisRuns()
  }, [loadRecommendations, loadFavorites, loadAnalysisRuns])

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null)
      setRunDetailError(null)
      return
    }
    let cancelled = false
    setLoadingRunDetail(true)
    setRunDetail(null)
    setRunDetailError(null)
    api
      .getAnalysisRun(selectedRunId)
      .then((d) => {
        if (!cancelled) setRunDetail(d)
      })
      .catch(() => {
        if (!cancelled) {
          setRunDetail(null)
          setRunDetailError('無法載入這筆分析報告。')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRunDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedRunId])

  async function handleAddFavorite(stockId: string) {
    const item = recData?.items.find((x) => x.stockId === stockId)
    if (!item) return
    setSavingId(stockId)
    try {
      const fav = await api.addFavorite({
        stockId: item.stockId,
        stockName: item.stockName,
        strategySnapshot: item.strategySnapshot
      })
      setFavorites((prev) => {
        const rest = prev.filter((f) => f.stockId !== fav.stockId)
        return [fav, ...rest]
      })
      setHint(`已將 ${item.stockId} ${item.stockName} 加入最愛，可至「我的最愛」填寫買進日期與價格。`)
    } catch {
      setHint('加入最愛失敗，請稍後再試。')
    } finally {
      setSavingId(null)
    }
  }

  async function handleUpdateFavorite(
    id: string,
    patch: { buyDate: string | null; buyPrice: number | null; notes: string | null }
  ) {
    const updated = await api.updateFavorite(id, patch)
    setFavorites((prev) => prev.map((f) => (f.id === id ? updated : f)))
    setHint('已更新買進紀錄。')
  }

  async function handleDeleteFavorite(id: string) {
    await api.deleteFavorite(id)
    setFavorites((prev) => prev.filter((f) => f.id !== id))
    setHint('已從最愛清單移除。')
  }

  return (
    <div className="card">
      <h2 className="page-title">股票推薦＆預測</h2>
      <p className="page-intro muted">
        依「溫和動能 × 分點確認」策略，列出短期可觀察標的、買入區間、分批方式與賣出條件。喜歡的標的可加入最愛，事後查閱完整策略與你的買進紀錄。
      </p>

      <div className="rec-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'recommend' ? 'rec-tab active' : 'rec-tab'}
          aria-selected={tab === 'recommend'}
          onClick={() => {
            setTab('recommend')
            setHint(null)
          }}
        >
          今日推薦
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'favorites' ? 'rec-tab active' : 'rec-tab'}
          aria-selected={tab === 'favorites'}
          onClick={() => {
            setTab('favorites')
            setHint(null)
          }}
        >
          我的最愛{favorites.length ? ` (${favorites.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'history' ? 'rec-tab active' : 'rec-tab'}
          aria-selected={tab === 'history'}
          onClick={() => {
            setTab('history')
            setHint(null)
          }}
        >
          分析紀錄{analysisRuns.length ? ` (${analysisRuns.length})` : ''}
        </button>
      </div>

      {hint ? <div className="hint-soft">{hint}</div> : null}

      {tab === 'recommend' ? (
        <section className="rec-section">
          <div className="row" style={{ marginBottom: 16 }}>
            <button type="button" disabled={loadingRec} onClick={() => void loadRecommendations()}>
              {loadingRec ? '更新中…' : '重新掃描'}
            </button>
            {recData ? (
              <span className="muted">
                策略：{recData.strategyName} · 訊號日 {recData.signalDate}
              </span>
            ) : null}
          </div>

          {loadingRec && !recData ? <p className="muted">載入推薦中…</p> : null}

          {recData?.items.length ? (
            <div className="rec-stack">
              {recData.items.map((item) => (
                <RecommendationCard
                  key={item.stockId}
                  item={item}
                  isFavorite={favoriteIds.has(item.stockId)}
                  saving={savingId === item.stockId}
                  onAddFavorite={() => void handleAddFavorite(item.stockId)}
                />
              ))}
            </div>
          ) : null}

          {recData ? (
            <p className="muted" style={{ marginTop: 20, fontSize: 12 }}>
              {recData.disclaimer}
            </p>
          ) : null}
        </section>
      ) : tab === 'favorites' ? (
        <section className="rec-section">
          <p className="muted" style={{ marginBottom: 16 }}>
            最愛清單保存在伺服器（以本機瀏覽器 ID 區分）。換電腦或清除瀏覽器資料會看不到同一清單。
          </p>
          {loadingFav && favorites.length === 0 ? <p className="muted">載入最愛中…</p> : null}
          {!loadingFav && favorites.length === 0 ? (
            <div className="hint-warn">尚無最愛標的。到「今日推薦」按 ⭐ 加入。</div>
          ) : (
            <div className="rec-stack">
              {favorites.map((f) => (
                <FavoriteCard
                  key={f.id}
                  item={f}
                  onSave={handleUpdateFavorite}
                  onDelete={handleDeleteFavorite}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rec-section">
          <div className="row" style={{ marginBottom: 16 }}>
            <button type="button" disabled={loadingRuns} onClick={() => void loadAnalysisRuns()}>
              {loadingRuns ? '更新中…' : '重新載入'}
            </button>
            <span className="muted">Cursor Cloud 排程或手動跑完會寫入資料庫</span>
          </div>
          <div className="analysis-run-layout">
            {runsError ? <div className="hint-warn">{runsError}</div> : null}
            <AnalysisRunList
              items={analysisRuns}
              selectedId={selectedRunId}
              loading={loadingRuns}
              onSelect={setSelectedRunId}
            />
            {analysisRuns.length > 0 ? (
              <AnalysisRunDetailPanel
                detail={runDetail}
                loading={loadingRunDetail}
                error={runDetailError}
              />
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
