import type {
  BranchPerformanceResponse,
  BranchSuggestResponse,
  ByBranchWindowResponse,
  ByStockWindowResponse,
  LatestStatusResponse,
  PerformanceMetric,
  StockSuggestResponse
} from '@twbbd/shared'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export const api = {
  latestStatus: () => getJson<LatestStatusResponse>('/status/latest'),
  branchSuggest: (q: string, limit = 30) =>
    getJson<BranchSuggestResponse>(
      `/branches/suggest?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
  stockSuggest: (q: string, limit = 30) =>
    getJson<StockSuggestResponse>(`/stocks/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
  byStock: (stockId: string, days: number) =>
    getJson<ByStockWindowResponse>(`/stocks/${stockId}?days=${days}`),
  byBranch: (branchId: string, days: number) =>
    getJson<ByBranchWindowResponse>(
      `/branches/${encodeURIComponent(branchId)}?days=${days}`
    ),
  performance: (
    days: number,
    forwardDays: number,
    metric: PerformanceMetric,
    minSample: number
  ) =>
    getJson<BranchPerformanceResponse>(
      `/performance/branches?days=${days}&forwardDays=${forwardDays}&metric=${metric}&minSample=${minSample}`
    )
}

