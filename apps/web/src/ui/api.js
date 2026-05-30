import { getClientId } from './clientId';
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
async function getJson(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return (await res.json());
}
async function jsonRequest(path, init) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'X-TWBBD-Client-Id': getClientId(),
            ...(init.headers ?? {})
        }
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    if (res.status === 204)
        return undefined;
    return (await res.json());
}
export const api = {
    latestStatus: () => getJson('/status/latest'),
    branchSuggest: (q, limit = 30) => getJson(`/branches/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
    stockSuggest: (q, limit = 30) => getJson(`/stocks/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
    byStock: (stockId, days) => getJson(`/stocks/${stockId}?days=${days}`),
    byBranch: (branchId, days) => getJson(`/branches/${encodeURIComponent(branchId)}?days=${days}`),
    performance: (days, forwardDays, metric, minSample) => getJson(`/performance/branches?days=${days}&forwardDays=${forwardDays}&metric=${metric}&minSample=${minSample}`),
    shortTermRecommendations: (limit = 20) => getJson(`/recommendations/short-term?limit=${limit}`),
    recommendationForStock: (stockId) => getJson(`/recommendations/short-term/${encodeURIComponent(stockId)}`),
    listFavorites: () => jsonRequest('/favorites', { method: 'GET' }),
    addFavorite: (body) => jsonRequest('/favorites', { method: 'POST', body: JSON.stringify(body) }),
    updateFavorite: (id, body) => jsonRequest(`/favorites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteFavorite: (id) => jsonRequest(`/favorites/${id}`, { method: 'DELETE' }),
    listAnalysisRuns: (limit = 30) => getJson(`/analysis-runs?limit=${limit}`),
    getAnalysisRun: (id) => getJson(`/analysis-runs/${id}`)
};
