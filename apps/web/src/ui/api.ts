import type {
  BranchPerformanceResponse,
  BranchSuggestResponse,
  ByBranchWindowResponse,
  ByStockWindowResponse,
  CreateFavoriteRequest,
  FavoritesListResponse,
  LatestStatusResponse,
  PerformanceMetric,
  ShortTermRecommendationsResponse,
  StockRecommendation,
  StockSuggestResponse,
  UpdateFavoriteRequest,
  UserFavorite
} from '@twbbd/shared'
import { getClientId } from './clientId'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

async function jsonRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-TWBBD-Client-Id': getClientId(),
      ...(init.headers ?? {})
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (res.status === 204) return undefined as T
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
    ),
  shortTermRecommendations: (limit = 20) =>
    getJson<ShortTermRecommendationsResponse>(`/recommendations/short-term?limit=${limit}`),
  recommendationForStock: (stockId: string) =>
    getJson<StockRecommendation>(`/recommendations/short-term/${encodeURIComponent(stockId)}`),
  listFavorites: () => jsonRequest<FavoritesListResponse>('/favorites', { method: 'GET' }),
  addFavorite: (body: CreateFavoriteRequest) =>
    jsonRequest<UserFavorite>('/favorites', { method: 'POST', body: JSON.stringify(body) }),
  updateFavorite: (id: string, body: UpdateFavoriteRequest) =>
    jsonRequest<UserFavorite>(`/favorites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFavorite: (id: string) =>
    jsonRequest<void>(`/favorites/${id}`, { method: 'DELETE' })
}
