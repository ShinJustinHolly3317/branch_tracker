import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { BranchSuggestion, ByBranchWindowResponse } from '@twbbd/shared'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const BAR_FILL = '#0f9b8e'

export function BranchPage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<BranchSuggestion[]>([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [selected, setSelected] = useState<BranchSuggestion | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const [days, setDays] = useState(20)
  const [data, setData] = useState<ByBranchWindowResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const suggestSeq = useRef(0)

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

  const chartData = useMemo(() => {
    if (!data?.stocks?.length) return []
    return data.stocks.slice(0, 10).map((s) => ({
      label: s.stockName ? `${s.stockId} ${s.stockName}` : s.stockId,
      net: s.netShares
    }))
  }, [data])

  async function run() {
    setHint(null)

    let branchId = selected?.branchId
    if (!branchId && query.trim()) {
      const hit = suggestions.find((s) => s.branchName === query.trim())
      branchId = hit?.branchId
      if (hit) setSelected(hit)
    }

    if (!branchId) {
      setHint('請輸入分點名稱關鍵字，並從清單選一筆分點。')
      setData(null)
      return
    }

    setLoading(true)
    try {
      const resp = await api.byBranch(branchId, days)
      setData(resp)
      if (!resp.stocks.length) {
        setHint('這段區間暫無持股明細，換個天數或待資料更新後再試。')
      }
    } catch {
      setData(null)
      setHint('連線異常，請確認 API 已啟動。')
    } finally {
      setLoading(false)
    }
  }

  function pickSuggestion(s: BranchSuggestion) {
    setSelected(s)
    setQuery(s.branchName || s.branchId)
    setOpenSuggest(false)
    setHint(null)
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
                setQuery(e.target.value)
                setSelected(null)
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
              onChange={(e) => setDays(Number(e.target.value))}
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
                      <span className="mono">{s.stockId}</span>
                      {s.stockName ? ` ${s.stockName}` : null}
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
        <p className="muted chart-caption">長條圖為淨額；僅顯示前十名。</p>
        <div className="chart-wrap">
          {loading ? (
            <div className="chart-empty">載入中…</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                <XAxis type="number" stroke="#5a726f" tick={{ fill: '#5a726f', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={160}
                  stroke="#5a726f"
                  tick={{ fill: '#5a726f', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid rgba(15,155,142,0.22)'
                  }}
                />
                <Bar dataKey="net" fill={BAR_FILL} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
