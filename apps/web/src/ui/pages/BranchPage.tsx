import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDashboardTabCache } from '../DashboardTabCache'
import type { BranchSuggestion } from '@twbbd/shared'
import { InteractivePieChart } from '../components/InteractivePieChart'

export function BranchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { branchTab, setBranchTab } = useDashboardTabCache()
  const { query, selected, days, data, hint } = branchTab

  const [suggestions, setSuggestions] = useState<BranchSuggestion[]>([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const [loading, setLoading] = useState(false)
  const suggestSeq = useRef(0)
  const daysRef = useRef(days)
  useEffect(() => {
    daysRef.current = days
  }, [days])

  const runWithBranchId = useCallback(
    async (branchId: string, windowTradingDays?: number) => {
      const n = typeof windowTradingDays === 'number' ? windowTradingDays : daysRef.current

      setBranchTab((prev) => ({ ...prev, hint: null }))
      setLoading(true)
      try {
        const resp = await api.byBranch(branchId, n)
        setBranchTab((prev) => ({ ...prev, data: resp }))
        if (!resp.stocks.length) {
          setBranchTab((prev) => ({
            ...prev,
            hint: '這段區間暫無持股明細，換個天數或待資料更新後再試。'
          }))
        }
      } catch {
        setBranchTab((prev) => ({
          ...prev,
          data: null,
          hint: '連線異常，請確認 API 已啟動。'
        }))
      } finally {
        setLoading(false)
      }
    },
    [setBranchTab]
  )

  /** 網址帶 `branchId` 時：每次出現都吃一次並清 query（對應 SPA 來回／深連結） */
  useEffect(() => {
    const branchIdRaw = searchParams.get('branchId')?.trim()
    if (!branchIdRaw) return

    const branchNameRaw = searchParams.get('branchName')?.trim()

    let stockBranchIdDecoded: string
    try {
      stockBranchIdDecoded = decodeURIComponent(branchIdRaw)
    } catch {
      stockBranchIdDecoded = branchIdRaw
    }

    let branchNameDecoded = ''
    if (branchNameRaw) {
      try {
        branchNameDecoded = decodeURIComponent(branchNameRaw)
      } catch {
        branchNameDecoded = branchNameRaw
      }
    }

    const next = new URLSearchParams(searchParams)
    next.delete('branchId')
    next.delete('branchName')
    setSearchParams(next, { replace: true })

    const suggestion: BranchSuggestion = {
      branchId: stockBranchIdDecoded,
      branchName: branchNameDecoded ? branchNameDecoded : stockBranchIdDecoded
    }

    setBranchTab((prev) => ({
      ...prev,
      selected: suggestion,
      query: suggestion.branchName || suggestion.branchId,
      hint: null
    }))
    setOpenSuggest(true)

    void runWithBranchId(suggestion.branchId, daysRef.current)
  }, [runWithBranchId, searchParams, setBranchTab, setSearchParams])

  useEffect(() => {
    const q = query.trim()
    const id = ++suggestSeq.current
    const handle = window.setTimeout(() => {
      api
        .branchSuggest(q, 40)
        .then((r) => {
          if (id !== suggestSeq.current) return
          setSuggestions(r.suggestions)
          setHighlightIdx(0)
        })
        .catch(() => {
          if (id !== suggestSeq.current) return
          setSuggestions([])
        })
    }, 280)
    return () => window.clearTimeout(handle)
  }, [query])

  /** Stock 頁 deeplink：`/stock?stockId=` */
  function stockSearchPath(stockId: string, stockName: string | undefined) {
    const sp = new URLSearchParams()
    sp.set('stockId', stockId)
    const n = stockName?.trim()
    if (n) sp.set('stockName', n)
    return `/stock?${sp.toString()}`
  }

  const pieSegments = useMemo(() => {
    if (!data?.stocks?.length) return []
    return data.stocks.slice(0, 10).map((s) => ({
      id: s.stockId,
      label: s.stockName ? `${s.stockId} ${s.stockName}` : s.stockId,
      value: Math.abs(s.netShares),
      navigateTo: stockSearchPath(s.stockId, s.stockName),
      actionLabel: '前往股票'
    }))
  }, [data])

  async function run() {
    let branchId = selected?.branchId
    if (!branchId && query.trim()) {
      const hit = suggestions.find((s) => s.branchName === query.trim())
      branchId = hit?.branchId
      if (hit)
        setBranchTab((prev) => ({
          ...prev,
          selected: hit
        }))
    }

    if (!branchId) {
      setBranchTab((prev) => ({
        ...prev,
        hint: '請輸入分點名稱關鍵字，並從清單選一筆分點。',
        data: null
      }))
      return
    }

    await runWithBranchId(branchId)
  }

  function pickSuggestion(s: BranchSuggestion) {
    setBranchTab((prev) => ({
      ...prev,
      selected: s,
      query: s.branchName || s.branchId,
      hint: null
    }))
    setOpenSuggest(false)
  }

  const showDropdown = openSuggest && suggestions.length > 0

  return (
    <div className="grid2">
      <div className="card">
        <div className="row align-start">
          <div className="field suggest-wrap">
            <span className="field-label">搜尋分點（名稱）</span>
            <input
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="branch-suggest-list"
              value={query}
              placeholder="例如：土銀、元大、合庫…"
              onChange={(e) => {
                const v = e.target.value
                setBranchTab((prev) => ({
                  ...prev,
                  query: v,
                  selected: null
                }))
                setOpenSuggest(true)
              }}
              onFocus={() => setOpenSuggest(true)}
              onBlur={() => window.setTimeout(() => setOpenSuggest(false), 180)}
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
              <ul id="branch-suggest-list" className="suggest-list" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.branchId}-${s.branchName}`}
                    role="option"
                    aria-selected={i === highlightIdx}
                    title={s.branchId}
                    onMouseEnter={() => setHighlightIdx(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                  >
                    <strong>{s.branchName || '（無名稱）'}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <span className="selected-pill" title={`代號 ${selected.branchId}`}>
                已選：{selected.branchName}
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
                setBranchTab((prev) => ({
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
            <button type="button" onClick={run} disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
          </div>
        </div>

        {hint ? <div className="hint-soft">{hint}</div> : null}

        {data && data.stocks.length > 0 ? (
          <>
            <div className="muted" style={{ marginTop: 16 }}>
              區間：{data.startDate} → {data.endDate}（{data.tradingDays} 個交易日）
            </div>
            <table>
              <thead>
                <tr>
                  <th>股票</th>
                  <th>買進</th>
                  <th>賣出</th>
                  <th>淨額</th>
                  <th>比重</th>
                </tr>
              </thead>
              <tbody>
                {data.stocks.slice(0, 50).map((s) => (
                  <tr key={s.stockId}>
                    <td>
                      <Link className="performance-branch-link" to={stockSearchPath(s.stockId, s.stockName)}>
                        <span className="mono">{s.stockId}</span>
                        {s.stockName ? ` ${s.stockName}` : ''}
                      </Link>
                    </td>
                    <td>{s.buyShares.toLocaleString()}</td>
                    <td>{s.sellShares.toLocaleString()}</td>
                    <td>{s.netShares.toLocaleString()}</td>
                    <td>{(s.shareOfNetAbs * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>

      <div className="card chart-card">
        <h3 className="chart-title">主力持股（淨額 Top 10）</h3>
        <p className="muted chart-caption">圓餅圖為淨額前十名；hover 可點擊前往 Stock 查詢。</p>
        <div className="chart-wrap">
          {loading ? (
            <div className="chart-empty">載入中…</div>
          ) : pieSegments.length > 0 ? (
            <InteractivePieChart segments={pieSegments} />
          ) : (
            <div className="chart-empty">
              選定分點並查詢後，此處會顯示淨額前十名股票。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
