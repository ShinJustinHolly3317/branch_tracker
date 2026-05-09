import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { ByStockWindowResponse, StockSuggestion } from '@twbbd/shared'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const PIE_COLORS = ['#0f9b8e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#0d8177', '#0f5952', '#134e4a', '#5ebfb5', '#d5f5f0']

export function StockPage() {
  const [query, setQuery] = useState('2330')
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [selected, setSelected] = useState<StockSuggestion | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const [days, setDays] = useState(20)
  const [data, setData] = useState<ByStockWindowResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const suggestSeq = useRef(0)

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

  const pieData = useMemo(() => {
    if (!data?.branches?.length) return []
    return data.branches.slice(0, 10).map((b) => ({
      name: b.branchName || b.branchId,
      value: Math.abs(b.netShares)
    }))
  }, [data])

  function pickSuggestion(s: StockSuggestion) {
    setSelected(s)
    setQuery(`${s.stockId} ${s.stockName}`.trim())
    setOpenSuggest(false)
    setHint(null)
  }

  async function loadStock() {
    setHint(null)
    setLoading(true)
    try {
      let stockId = selected?.stockId
      if (!stockId && query.trim()) {
        const trimmed = query.trim()
        const digits = trimmed.match(/[0-9]{4}/)?.[0]
        stockId =
          digits ??
          suggestions.find((s) => s.stockName === trimmed || `${s.stockId} ${s.stockName}` === trimmed)?.stockId
      }

      if (!stockId) {
        setData(null)
        setHint('請輸入股票代號或中文名稱，並從下拉選單選一筆。')
        return
      }

      const resp = await api.byStock(stockId.trim(), days)
      setData(resp)
      if (!resp.branches.length) {
        setHint('這段區間尚無分點明細，換個天數或待資料更新後再試。')
      }
    } catch {
      setData(null)
      setHint('連線異常，請確認 API 已啟動。')
    } finally {
      setLoading(false)
    }
  }

  // 首次進頁帶出預設查詢；修改條件後請按「查詢」。
  useEffect(() => {
    void loadStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                setQuery(e.target.value)
                setSelected(null)
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
              onChange={(e) => setDays(Number(e.target.value))}
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
                    <td>{b.branchName || b.branchId}</td>
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
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={130} paddingAngle={1}>
                  {pieData.map((_, i) => (
                    <Cell key={String(i)} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--color-bg-card)" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid rgba(15,155,142,0.22)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
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
