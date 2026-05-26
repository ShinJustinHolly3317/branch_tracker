import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDashboardTabCache } from '../DashboardTabCache'
import type { StockSuggestion } from '@twbbd/shared'
import { InteractivePieChart } from '../components/InteractivePieChart'

/** Branch 頁 deeplink：與 Performance 排行榜同款 `branchId` / `branchName` */
function branchSearchPath(branchId: string, branchName: string | undefined) {
  const sp = new URLSearchParams()
  sp.set('branchId', branchId)
  const name = (branchName || '').trim()
  if (name) sp.set('branchName', name)
  return `/branch?${sp.toString()}`
}

export function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { stockTab, setStockTab, bootstrapRefs } = useDashboardTabCache()
  const { query, selected, days, data, hint } = stockTab

  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const [loading, setLoading] = useState(false)
  const suggestSeq = useRef(0)
  const daysRef = useRef(days)
  useEffect(() => {
    daysRef.current = days
  }, [days])

  useEffect(() => {
    const q = query.trim()
    const id = ++suggestSeq.current
    const handle = window.setTimeout(() => {
      api
        .stockSuggest(q, 40)
        .then((r) => {
          if (id !== suggestSeq.current) return
          setSuggestions(r.suggestions)
          setHighlightIdx(0)
        })
        .catch(() => {
          if (id !== suggestSeq.current) return
          setSuggestions([])
        })
    }, 220)
    return () => window.clearTimeout(handle)
  }, [query])

  const pieSegments = useMemo(() => {
    if (!data?.branches?.length) return []
    return data.branches.slice(0, 10).map((b) => ({
      id: b.branchId,
      label: b.branchName || b.branchId,
      value: Math.abs(b.netShares),
      navigateTo: branchSearchPath(b.branchId, b.branchName),
      actionLabel: '前往分點'
    }))
  }, [data])

  function pickSuggestion(s: StockSuggestion) {
    setStockTab((prev) => ({
      ...prev,
      selected: s,
      query: `${s.stockId} ${s.stockName}`.trim(),
      hint: null
    }))
    setOpenSuggest(false)
  }

  const loadStockById = useCallback(
    async (stockIdRaw: string, windowTradingDays?: number) => {
      const sid = stockIdRaw.trim()
      const n = typeof windowTradingDays === 'number' ? windowTradingDays : daysRef.current
      if (!sid) {
        setStockTab((prev) => ({
          ...prev,
          data: null,
          hint: '請輸入股票代號或中文名稱，並從下拉選單選一筆。'
        }))
        return
      }

      setStockTab((prev) => ({ ...prev, hint: null }))
      setLoading(true)
      try {
        const resp = await api.byStock(sid, n)
        setStockTab((prev) => ({
          ...prev,
          data: resp,
          hint: resp.branches.length
            ? null
            : '這段區間尚無分點明細，換個天數或待資料更新後再試。'
        }))
      } catch {
        setStockTab((prev) => ({
          ...prev,
          data: null,
          hint: '連線異常，請確認 API 已啟動。'
        }))
      } finally {
        setLoading(false)
      }
    },
    [setStockTab]
  )

  /** 進預設查詢；修改條件後請按「查詢」 */
  async function loadStock() {
    let stockId = stockTab.selected?.stockId
    if (!stockId && stockTab.query.trim()) {
      const trimmed = stockTab.query.trim()
      const digits = trimmed.match(/[0-9]{4}/)?.[0]
      stockId =
        digits ??
        suggestions.find((s) => s.stockName === trimmed || `${s.stockId} ${s.stockName}` === trimmed)?.stockId
    }

    if (!stockId) {
      setStockTab((prev) => ({
        ...prev,
        data: null,
        hint: '請輸入股票代號或中文名稱，並從下拉選單選一筆。'
      }))
      return
    }

    await loadStockById(stockId)
  }

  // ① `/?stockId=` 深連結 ② 首訪且無快取：預設 2330；有快取則不再自動打 API
  useEffect(() => {
    const idRaw = searchParams.get('stockId')?.trim()
    if (idRaw) {
      bootstrapRefs.stockDefaultBootstrapFired.current = true

      let stockIdDecoded = idRaw
      try {
        stockIdDecoded = decodeURIComponent(idRaw)
      } catch {
        stockIdDecoded = idRaw
      }

      const nameRaw = searchParams.get('stockName')?.trim()
      let stockNameDecoded = ''
      if (nameRaw) {
        try {
          stockNameDecoded = decodeURIComponent(nameRaw)
        } catch {
          stockNameDecoded = nameRaw
        }
      }

      const next = new URLSearchParams(searchParams)
      next.delete('stockId')
      next.delete('stockName')
      setSearchParams(next, { replace: true })

      const sug: StockSuggestion = { stockId: stockIdDecoded, stockName: stockNameDecoded }
      setStockTab((prev) => ({
        ...prev,
        selected: sug,
        query: stockNameDecoded ? `${stockIdDecoded} ${stockNameDecoded}`.trim() : stockIdDecoded,
        hint: null
      }))
      void loadStockById(stockIdDecoded, daysRef.current)
      return
    }

    if (stockTab.data != null || stockTab.hint != null) return

    if (bootstrapRefs.stockDefaultBootstrapFired.current) return
    bootstrapRefs.stockDefaultBootstrapFired.current = true
    void loadStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadStockById,
    searchParams,
    setSearchParams,
    setStockTab,
    stockTab.data,
    stockTab.hint,
    bootstrapRefs
  ])

  const showDropdown = openSuggest && suggestions.length > 0

  return (
    <div className="grid2">
      <div className="card">
        <div className="row">
          <div className="field suggest-wrap">
            <span className="field-label">搜尋股票（代號 / 中文）</span>
            <input
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="stock-suggest-list"
              value={query}
              onChange={(e) => {
                const v = e.target.value
                setStockTab((prev) => ({
                  ...prev,
                  query: v,
                  selected: null
                }))
                setOpenSuggest(true)
              }}
              onFocus={() => setOpenSuggest(true)}
              onBlur={() => window.setTimeout(() => setOpenSuggest(false), 180)}
              placeholder="例如：2330、台積電、積…"
              onKeyDown={(e) => {
                if (!showDropdown) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHighlightIdx((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const s = suggestions[highlightIdx]
                  if (s) pickSuggestion(s)
                } else if (e.key === 'Escape') {
                  setOpenSuggest(false)
                }
              }}
            />
            {showDropdown ? (
              <ul id="stock-suggest-list" className="suggest-list" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.stockId}-${s.stockName}`}
                    role="option"
                    aria-selected={i === highlightIdx}
                    title={s.stockId}
                    onMouseEnter={() => setHighlightIdx(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                  >
                    <strong>
                      <span className="mono">{s.stockId}</span> {s.stockName}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <span className="selected-pill" title={`代號 ${selected.stockId}`}>
                已選：{selected.stockId} {selected.stockName}
              </span>
            ) : null}
          </div>
          <div className="field">
            <span className="field-label">最近 N 個交易日</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) =>
                setStockTab((prev) => ({
                  ...prev,
                  days: Number(e.target.value)
                }))
              }
            />
          </div>
          <div className="field">
            <span className="field-label" aria-hidden style={{ visibility: 'hidden' }}>
              —
            </span>
            <button type="button" onClick={() => void loadStock()} disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
          </div>
        </div>

        {hint ? <div className="hint-soft">{hint}</div> : null}

        {data && data.branches.length > 0 ? (
          <>
            <div className="muted" style={{ marginTop: 16 }}>
              區間：{data.startDate} → {data.endDate}（{data.tradingDays} 個交易日）· Top1 集中度{' '}
              {(data.concentration.top1Share * 100).toFixed(1)}% · Top3{' '}
              {(data.concentration.top3Share * 100).toFixed(1)}%
            </div>

            <table>
              <thead>
                <tr>
                  <th>分點</th>
                  <th>買進</th>
                  <th>賣出</th>
                  <th>淨額</th>
                  <th>比重</th>
                </tr>
              </thead>
              <tbody>
                {data.branches.slice(0, 50).map((b) => (
                  <tr key={b.branchId}>
                    <td>
                      <Link className="performance-branch-link" to={branchSearchPath(b.branchId, b.branchName)}>
                        {b.branchName || b.branchId}
                      </Link>
                    </td>
                    <td>{b.buyShares.toLocaleString()}</td>
                    <td>{b.sellShares.toLocaleString()}</td>
                    <td>{b.netShares.toLocaleString()}</td>
                    <td>{(b.shareOfNetAbs * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>

      <div className="card chart-card">
        <h3 className="chart-title">分點集中度（依淨額絕對值）</h3>
        <p className="muted chart-caption">圓餅圖為前十名分點。</p>
        <div className="chart-wrap">
          {loading ? (
            <div className="chart-empty">載入中…</div>
          ) : pieSegments.length > 0 ? (
            <InteractivePieChart segments={pieSegments} />
          ) : (
            <div className="chart-empty">
              尚無可視覺化的分點資料。
              <br />
              確認已跑過爬蟲且 Redis 有資料後，此處會自動顯示。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
