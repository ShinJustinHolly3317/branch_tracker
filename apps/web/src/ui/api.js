const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
async function getJson(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return (await res.json());
}
export const api = {
    latestStatus: () => getJson('/status/latest'),
    branchSuggest: (q, limit = 30) => getJson(`/branches/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
    stockSuggest: (q, limit = 30) => getJson(`/stocks/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
    byStock: (stockId, days) => getJson(`/stocks/${stockId}?days=${days}`),
    byBranch: (branchId, days) => getJson(`/branches/${encodeURIComponent(branchId)}?days=${days}`),
    performance: (days, forwardDays, metric, minSample) => getJson(`/performance/branches?days=${days}&forwardDays=${forwardDays}&metric=${metric}&minSample=${minSample}`)
};
