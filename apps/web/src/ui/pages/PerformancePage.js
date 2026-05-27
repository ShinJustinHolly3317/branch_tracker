import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StockPriceSummary } from '../components/StockPriceSummary';
import { useDashboardTabCache } from '../DashboardTabCache';
export function PerformancePage() {
    const { performanceTab, setPerformanceTab, bootstrapRefs } = useDashboardTabCache();
    const navigate = useNavigate();
    const { days, forwardDays, minSample, metric, data, hint } = performanceTab;
    const [loading, setLoading] = useState(false);
    const [stockQuery, setStockQuery] = useState('');
    const [stockSelected, setStockSelected] = useState(null);
    const [stockSuggestions, setStockSuggestions] = useState([]);
    const [openStockSuggest, setOpenStockSuggest] = useState(false);
    const [stockHighlightIdx, setStockHighlightIdx] = useState(0);
    const [stockPriceLoading, setStockPriceLoading] = useState(false);
    const [stockPriceWindow, setStockPriceWindow] = useState(null);
    const [stockPriceHint, setStockPriceHint] = useState(null);
    const daysRef = useRef(days);
    const forwardDaysRef = useRef(forwardDays);
    const minSampleRef = useRef(minSample);
    const metricRef = useRef(metric);
    const stockSuggestSeq = useRef(0);
    useEffect(() => {
        daysRef.current = days;
    }, [days]);
    useEffect(() => {
        forwardDaysRef.current = forwardDays;
    }, [forwardDays]);
    useEffect(() => {
        minSampleRef.current = minSample;
    }, [minSample]);
    useEffect(() => {
        metricRef.current = metric;
    }, [metric]);
    useEffect(() => {
        const q = stockQuery.trim();
        const id = ++stockSuggestSeq.current;
        const handle = window.setTimeout(() => {
            api
                .stockSuggest(q, 40)
                .then((r) => {
                if (id !== stockSuggestSeq.current)
                    return;
                setStockSuggestions(r.suggestions);
                setStockHighlightIdx(0);
            })
                .catch(() => {
                if (id !== stockSuggestSeq.current)
                    return;
                setStockSuggestions([]);
            });
        }, 220);
        return () => window.clearTimeout(handle);
    }, [stockQuery]);
    const loadStockPrice = useCallback(async (stockId) => {
        setStockPriceLoading(true);
        setStockPriceHint(null);
        try {
            const resp = await api.byStock(stockId, daysRef.current);
            if (resp.priceWindow) {
                setStockPriceWindow(resp.priceWindow);
            }
            else {
                setStockPriceWindow(null);
                setStockPriceHint('此區間缺少起訖收盤價，無法計算漲跌幅。');
            }
        }
        catch {
            setStockPriceWindow(null);
            setStockPriceHint('連線異常，無法載入個股價格。');
        }
        finally {
            setStockPriceLoading(false);
        }
    }, []);
    const runPerformance = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await api.performance(daysRef.current, forwardDaysRef.current, metricRef.current, minSampleRef.current);
            setPerformanceTab((s) => ({
                ...s,
                data: resp,
                hint: !resp.top.length
                    ? '這組條件暫時算不出排行；試著調低最小樣本、縮短前瞻 K，或累積更多交易日後再試。'
                    : null
            }));
            if (stockSelected?.stockId) {
                void loadStockPrice(stockSelected.stockId);
            }
        }
        catch {
            setPerformanceTab((s) => ({
                ...s,
                data: null,
                hint: '連線或計算異常，請確認 API 與 Postgres 資料是否就緒。'
            }));
        }
        finally {
            setLoading(false);
        }
    }, [setPerformanceTab, stockSelected?.stockId, loadStockPrice]);
    /** 首訪自動計算；有快取結果則不重打（切換分頁回來保留） */
    useEffect(() => {
        if (performanceTab.data != null || performanceTab.hint != null)
            return;
        if (bootstrapRefs.perfDefaultBootstrapFired.current)
            return;
        bootstrapRefs.perfDefaultBootstrapFired.current = true;
        void runPerformance();
    }, [performanceTab.data, performanceTab.hint, bootstrapRefs, runPerformance]);
    /** 已選個股時，回溯 N 日變更後重算區間漲跌 */
    useEffect(() => {
        if (!stockSelected?.stockId)
            return;
        void loadStockPrice(stockSelected.stockId);
    }, [days, stockSelected?.stockId, loadStockPrice]);
    const metricLabel = metric === 'avgForwardReturn'
        ? '平均前瞻報酬'
        : metric === 'hitRate'
            ? '勝率'
            : '加權報酬 proxy';
    function pickStockSuggestion(s) {
        setStockSelected(s);
        setStockQuery(`${s.stockId} ${s.stockName}`.trim());
        setOpenStockSuggest(false);
        void loadStockPrice(s.stockId);
    }
    const showStockDropdown = openStockSuggest && stockSuggestions.length > 0;
    /** Branch 頁 deeplink：`BranchPage` 會帶 keyword + 自動打 byBranch API */
    function branchSearchPath(branchId, branchName) {
        const sp = new URLSearchParams();
        sp.set('branchId', branchId);
        const name = (branchName || '').trim();
        if (name)
            sp.set('branchName', name);
        return `/branch?${sp.toString()}`;
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "page-intro", children: [_jsx("h2", { className: "page-title", children: "Branch Performance" }), _jsx("p", { className: "muted", style: { margin: '6px 0 0' }, children: "\u7528\u300C\u5206\u9EDE\u6DE8\u8CB7\u4E8B\u4EF6\u300D\u505A\u7C21\u55AE\u56DE\u6E2C\uFF1A\u56DE\u6EAF N \u500B\u4EA4\u6613\u65E5\u3001\u5F80\u524D\u770B K \u500B\u4EA4\u6613\u65E5\u7684\u5831\u916C\u8868\u73FE\u3002" }), _jsxs("div", { className: "info-grid", style: { marginTop: 14 }, children: [_jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u4E09\u500B\u53C3\u6578" }), _jsxs("div", { className: "mini-body muted", children: ["N = \u56DE\u6EAF\u5929\u6578\uFF08\u53D6\u6A23\u7A97\u53E3\uFF09", _jsx("br", {}), "K = \u524D\u77BB\u5929\u6578\uFF08\u5831\u916C\u8A08\u7B97\uFF09", _jsx("br", {}), "\u6700\u5C0F\u6A23\u672C = \u5206\u9EDE\u81F3\u5C11\u51FA\u73FE\u5E7E\u6B21\u624D\u6392\u540D"] })] }), _jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u6307\u6A19\u600E\u9EBC\u770B" }), _jsxs("div", { className: "mini-body muted", children: ["\u5E73\u5747\u524D\u77BB\u5831\u916C\uFF1A\u4E8B\u4EF6\u5F8C K \u65E5\u7684\u5E73\u5747\u6F32\u8DCC\u5E45", _jsx("br", {}), "\u52DD\u7387\uFF1A\u4E8B\u4EF6\u5F8C K \u65E5\u4E0A\u6F32\u7684\u6BD4\u4F8B", _jsx("br", {}), "\u52A0\u6B0A\u5831\u916C proxy\uFF1A\u7528\u300C\u6DE8\u8CB7\u91D1\u984D proxy\u300D\u52A0\u6B0A\u5F8C\u7684\u5831\u916C"] })] })] }), _jsxs("div", { className: "mini-card", style: { marginTop: 12 }, children: [_jsx("div", { className: "mini-title", children: "\u4F8B\u5B50" }), _jsxs("div", { className: "mini-body muted", children: ["\u4F8B 1\uFF1AN=20\u3001K=10\u3001\u6307\u6A19=\u5E73\u5747\u524D\u77BB\u5831\u916C\u3001\u6700\u5C0F\u6A23\u672C=10 \u2192 \u770B\u300C\u6700\u8FD1\u4E00\u500B\u6708\u300D\u54EA\u4E9B\u5206\u9EDE\u6DE8\u8CB7\u5F8C 10 \u65E5\u5E73\u5747\u8868\u73FE\u6700\u597D\u3002", _jsx("br", {}), "\u4F8B 2\uFF1AN=60\u3001K=5\u3001\u6307\u6A19=\u52DD\u7387\u3001\u6700\u5C0F\u6A23\u672C=30 \u2192 \u770B\u300C\u6700\u8FD1\u4E09\u500B\u6708\u300D\u66F4\u7A69\u5B9A\u7684\u5206\u9EDE\uFF08\u547D\u4E2D\u7387\u53D6\u5411\uFF09\u3002"] })] })] }), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u56DE\u6EAF N \u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setPerformanceTab((s) => ({ ...s, days: Number(e.target.value) })) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u524D\u77BB K \u65E5" }), _jsx("input", { type: "number", min: 1, max: 120, value: forwardDays, onChange: (e) => setPerformanceTab((s) => ({ ...s, forwardDays: Number(e.target.value) })) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6307\u6A19" }), _jsxs("select", { value: metric, onChange: (e) => setPerformanceTab((s) => ({
                                    ...s,
                                    metric: e.target.value
                                })), children: [_jsx("option", { value: "avgForwardReturn", children: "\u5E73\u5747\u524D\u77BB\u5831\u916C" }), _jsx("option", { value: "hitRate", children: "\u52DD\u7387" }), _jsx("option", { value: "weightedPnlProxy", children: "\u52A0\u6B0A\u5831\u916C proxy" })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u5C0F\u6A23\u672C" }), _jsx("input", { type: "number", min: 1, max: 500, value: minSample, onChange: (e) => setPerformanceTab((s) => ({
                                    ...s,
                                    minSample: Number(e.target.value)
                                })) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: () => void runPerformance(), disabled: loading, children: loading ? '計算中…' : '計算' })] })] }), _jsx("div", { className: "row align-start", style: { marginTop: 8 }, children: _jsxs("div", { className: "field suggest-wrap", children: [_jsx("span", { className: "field-label", children: "\u67E5\u500B\u80A1\u5340\u9593\u6F32\u8DCC\uFF08\u540C\u56DE\u6EAF N \u65E5\uFF09" }), _jsx("input", { role: "combobox", "aria-expanded": showStockDropdown, "aria-controls": "perf-stock-suggest-list", value: stockQuery, placeholder: "\u4F8B\u5982\uFF1A2330\u3001\u53F0\u7A4D\u96FB\u2026", onChange: (e) => {
                                setStockQuery(e.target.value);
                                setStockSelected(null);
                                setStockPriceWindow(null);
                                setStockPriceHint(null);
                                setOpenStockSuggest(true);
                            }, onFocus: () => setOpenStockSuggest(true), onBlur: () => window.setTimeout(() => setOpenStockSuggest(false), 180), onKeyDown: (e) => {
                                if (!showStockDropdown)
                                    return;
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setStockHighlightIdx((i) => Math.min(i + 1, stockSuggestions.length - 1));
                                }
                                else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setStockHighlightIdx((i) => Math.max(i - 1, 0));
                                }
                                else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const s = stockSuggestions[stockHighlightIdx];
                                    if (s)
                                        pickStockSuggestion(s);
                                }
                                else if (e.key === 'Escape') {
                                    setOpenStockSuggest(false);
                                }
                            } }), showStockDropdown ? (_jsx("ul", { id: "perf-stock-suggest-list", className: "suggest-list", role: "listbox", children: stockSuggestions.map((s, i) => (_jsx("li", { role: "option", "aria-selected": i === stockHighlightIdx, onMouseEnter: () => setStockHighlightIdx(i), onMouseDown: (ev) => ev.preventDefault(), onClick: () => pickStockSuggestion(s), children: _jsxs("strong", { children: [_jsx("span", { className: "mono", children: s.stockId }), " ", s.stockName] }) }, `${s.stockId}-${s.stockName}`))) })) : null] }) }), stockPriceLoading ? _jsx("div", { className: "hint-soft", children: "\u8F09\u5165\u500B\u80A1\u50F9\u683C\u4E2D\u2026" }) : null, stockPriceHint ? _jsx("div", { className: "hint-soft", children: stockPriceHint }) : null, stockSelected && stockPriceWindow ? (_jsx(StockPriceSummary, { stockId: stockSelected.stockId, stockName: stockSelected.stockName, priceWindow: stockPriceWindow })) : null, _jsxs("p", { className: "muted", style: { marginTop: 14 }, children: ["\u4F9D\u5206\u9EDE\u6DE8\u8CB7\u4E8B\u4EF6\u8A08\u7B97 ", metricLabel, "\uFF1B\u9700\u8981\u6709\u8DB3\u5920\u4EA4\u6613\u65E5\u8207\u300C\u524D\u77BB K \u65E5\u300D\u6536\u76E4\u50F9\u8CC7\u6599\u3002"] }), loading && !data ? _jsx("div", { className: "hint-soft", children: "\u8F09\u5165\u6392\u884C\u4E2D\u2026" }) : null, hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data?.debugMessage ? _jsx("div", { className: "hint-warn", children: data.debugMessage }) : null, data && data.reasonCode && data.top.length === 0 ? (_jsxs("div", { className: "muted", style: { marginTop: 12 }, children: ["\u8A3A\u65B7\uFF1A", _jsx("span", { className: "mono", children: data.reasonCode }), typeof data.effectiveForwardTradingDays === 'number' &&
                        typeof data.requestedForwardTradingDays === 'number' ? (_jsxs(_Fragment, { children: [' ', "\u00B7 \u524D\u77BB K\uFF1A\u8ACB\u6C42 ", data.requestedForwardTradingDays, " / \u5BE6\u969B ", data.effectiveForwardTradingDays] })) : null] })) : null, data && data.top.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u53C3\u8003\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate, _jsx("span", { style: { marginLeft: 8 }, className: "performance-table-hint", children: "\uFF08\u9EDE\u6574\u5217\u53EF\u5230 Branch \u4E26\u5E36\u5165\u8A72\u5206\u9EDE\u67E5\u8A62\uFF09" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5206\u9EDE" }), _jsx("th", { children: "\u6A23\u672C\u6578" }), _jsxs("th", { children: [metricLabel, "\uFF08\u7E3E\u6548\uFF09"] })] }) }), _jsx("tbody", { children: data.top.map((r) => {
                                    const to = branchSearchPath(r.branchId, r.branchName);
                                    const label = r.branchName || r.branchId;
                                    return (_jsxs("tr", { className: "performance-branch-row", role: "link", tabIndex: 0, title: "\u524D\u5F80 Branch \u4E26\u67E5\u8A62\u6B64\u5206\u9EDE\u6301\u80A1", "aria-label": `Branch：${label}`, onClick: () => navigate(to), onKeyDown: (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate(to);
                                            }
                                        }, onAuxClick: (e) => {
                                            if (e.button === 1) {
                                                e.preventDefault();
                                                window.open(to, '_blank', 'noopener,noreferrer');
                                            }
                                        }, children: [_jsx("td", { children: _jsx("span", { className: "performance-branch-link", children: label }) }), _jsx("td", { children: r.sampleSize }), _jsx("td", { children: metric === 'hitRate'
                                                    ? `${(r.value * 100).toFixed(1)}%`
                                                    : metric === 'avgForwardReturn'
                                                        ? `${(r.value * 100).toFixed(2)}%`
                                                        : r.value.toFixed(0) })] }, r.branchId));
                                }) })] })] })) : null] }));
}
