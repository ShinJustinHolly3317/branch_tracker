import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useDashboardTabCache } from '../DashboardTabCache'
import type { PerformanceMetric } from '@twbbd/shared'

export function PerformancePage() {
  const { performanceTab, setPerformanceTab } = useDashboardTabCache()
  const navigate = useNavigate()
  const { days, forwardDays, minSample, metric, data, hint } = performanceTab

  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const resp = await api.performance(days, forwardDays, metric, minSample)
      setPerformanceTab((s) => ({
        ...s,
        data: resp,
        hint: !resp.top.length
          ? '這組條件暫時算不出排行；試著調低最小樣本、縮短前瞻 K，或累積更多交易日後再試。'
          : null
      }))
    } catch {
      setPerformanceTab((s) => ({
        ...s,
        data: null,
        hint: '連線或計算異常，請確認 API 與 Postgres 資料是否就緒。'
      }))
    } finally {
      setLoading(false)
    }
  }

  const metricLabel =
    metric === 'avgForwardReturn'
      ? '平均前瞻報酬'
      : metric === 'hitRate'
        ? '勝率'
        : '加權報酬 proxy'

  /** Branch 頁 deeplink：`BranchPage` 會帶 keyword + 自動打 byBranch API */
  function branchSearchPath(branchId: string, branchName: string | undefined) {
    const sp = new URLSearchParams()
    sp.set('branchId', branchId)
    const name = (branchName || '').trim()
    if (name) sp.set('branchName', name)
    return `/branch?${sp.toString()}`
  }

  return (
    <div className="card">
      <div className="page-intro">
        <h2 className="page-title">Branch Performance</h2>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          用「分點淨買事件」做簡單回測：回溯 N 個交易日、往前看 K 個交易日的報酬表現。
        </p>

        <div className="info-grid" style={{ marginTop: 14 }}>
          <div className="mini-card">
            <div className="mini-title">三個參數</div>
            <div className="mini-body muted">
              N = 回溯天數（取樣窗口）<br />
              K = 前瞻天數（報酬計算）<br />
              最小樣本 = 分點至少出現幾次才排名
            </div>
          </div>
          <div className="mini-card">
            <div className="mini-title">指標怎麼看</div>
            <div className="mini-body muted">
              平均前瞻報酬：事件後 K 日的平均漲跌幅<br />
              勝率：事件後 K 日上漲的比例<br />
              加權報酬 proxy：用「淨買金額 proxy」加權後的報酬
            </div>
          </div>
        </div>

        <div className="mini-card" style={{ marginTop: 12 }}>
          <div className="mini-title">例子</div>
          <div className="mini-body muted">
            例 1：N=20、K=10、指標=平均前瞻報酬、最小樣本=10 → 看「最近一個月」哪些分點淨買後 10
            日平均表現最好。<br />
            例 2：N=60、K=5、指標=勝率、最小樣本=30 → 看「最近三個月」更穩定的分點（命中率取向）。
          </div>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <span className="field-label">回溯 N 日</span>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) =>
              setPerformanceTab((s) => ({ ...s, days: Number(e.target.value) }))
            }
          />
        </div>
        <div className="field">
          <span className="field-label">前瞻 K 日</span>
          <input
            type="number"
            min={1}
            max={120}
            value={forwardDays}
            onChange={(e) =>
              setPerformanceTab((s) => ({ ...s, forwardDays: Number(e.target.value) }))
            }
          />
        </div>
        <div className="field">
          <span className="field-label">指標</span>
          <select
            value={metric}
            onChange={(e) =>
              setPerformanceTab((s) => ({
                ...s,
                metric: e.target.value as PerformanceMetric
              }))
            }
          >
            <option value="avgForwardReturn">平均前瞻報酬</option>
            <option value="hitRate">勝率</option>
            <option value="weightedPnlProxy">加權報酬 proxy</option>
          </select>
        </div>
        <div className="field">
          <span className="field-label">最小樣本</span>
          <input
            type="number"
            min={1}
            max={500}
            value={minSample}
            onChange={(e) =>
              setPerformanceTab((s) => ({
                ...s,
                minSample: Number(e.target.value)
              }))
            }
          />
        </div>
        <div className="field">
          <span className="field-label" aria-hidden style={{ visibility: 'hidden' }}>
            —
          </span>
          <button type="button" onClick={run} disabled={loading}>
            {loading ? '計算中…' : '計算'}
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 14 }}>
        依分點淨買事件計算 {metricLabel}；需要有足夠交易日與「前瞻 K 日」收盤價資料。
      </p>

      {hint ? <div className="hint-soft">{hint}</div> : null}

      {data?.debugMessage ? <div className="hint-warn">{data.debugMessage}</div> : null}

      {data && data.reasonCode && data.top.length === 0 ? (
        <div className="muted" style={{ marginTop: 12 }}>
          診斷：<span className="mono">{data.reasonCode}</span>
          {typeof data.effectiveForwardTradingDays === 'number' &&
          typeof data.requestedForwardTradingDays === 'number' ? (
            <>
              {' '}
              · 前瞻 K：請求 {data.requestedForwardTradingDays} / 實際 {data.effectiveForwardTradingDays}
            </>
          ) : null}
        </div>
      ) : null}

      {data && data.top.length > 0 ? (
        <>
          <div className="muted" style={{ marginTop: 16 }}>
            參考區間：{data.startDate} → {data.endDate}
            <span style={{ marginLeft: 8 }} className="performance-table-hint">
              （點整列可到 Branch 並帶入該分點查詢）
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>分點</th>
                <th>樣本數</th>
                <th>數值</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((r) => {
                const to = branchSearchPath(r.branchId, r.branchName)
                const label = r.branchName || r.branchId
                return (
                  <tr
                    key={r.branchId}
                    className="performance-branch-row"
                    role="link"
                    tabIndex={0}
                    title="前往 Branch 並查詢此分點持股"
                    aria-label={`Branch：${label}`}
                    onClick={() => navigate(to)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(to)
                      }
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault()
                        window.open(to, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    <td>
                      <span className="performance-branch-link">{label}</span>
                    </td>
                    <td>{r.sampleSize}</td>
                    <td>
                      {metric === 'hitRate'
                        ? `${(r.value * 100).toFixed(1)}%`
                        : metric === 'avgForwardReturn'
                          ? `${(r.value * 100).toFixed(2)}%`
                          : r.value.toFixed(0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  )
}
