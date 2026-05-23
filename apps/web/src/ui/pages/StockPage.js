import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useDashboardTabCache } from '../DashboardTabCache';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
const PIE_COLORS = ['#0f9b8e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#0d8177', '#0f5952', '#134e4a', '#5ebfb5', '#d5f5f0'];
export function StockPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { stockTab, setStockTab, bootstrapRefs } = useDashboardTabCache();
    const { query, selected, days, data, hint } = stockTab;
    const [suggestions, setSuggestions] = useState([]);
    const [openSuggest, setOpenSuggest] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const suggestSeq = useRef(0);
    const daysRef = useRef(days);
    useEffect(() => {
        daysRef.current = days;
    }, [days]);
    useEffect(() => {
        const q = query.trim();
        const id = ++suggestSeq.current;
        const handle = window.setTimeout(() => {
            api
                .stockSuggest(q, 40)
                .then((r) => {
                if (id !== suggestSeq.current)
                    return;
                setSuggestions(r.suggestions);
                setHighlightIdx(0);
            })
                .catch(() => {
                if (id !== suggestSeq.current)
                    return;
                setSuggestions([]);
            });
        }, 220);
        return () => window.clearTimeout(handle);
    }, [query]);
    const pieData = useMemo(() => {
        if (!data?.branches?.length)
            return [];
        return data.branches.slice(0, 10).map((b) => ({
            name: b.branchName || b.branchId,
            value: Math.abs(b.netShares)
        }));
    }, [data]);
    function pickSuggestion(s) {
        setStockTab((prev) => ({
            ...prev,
            selected: s,
            query: `${s.stockId} ${s.stockName}`.trim(),
            hint: null
        }));
        setOpenSuggest(false);
    }
    const loadStockById = useCallback(async (stockIdRaw, windowTradingDays) => {
        const sid = stockIdRaw.trim();
        const n = typeof windowTradingDays === 'number' ? windowTradingDays : daysRef.current;
        if (!sid) {
            setStockTab((prev) => ({
                ...prev,
                data: null,
                hint: '請輸入股票代號或中文名稱，並從下拉選單選一筆。'
            }));
            return;
        }
        setStockTab((prev) => ({ ...prev, hint: null }));
        setLoading(true);
        try {
            const resp = await api.byStock(sid, n);
            setStockTab((prev) => ({
                ...prev,
                data: resp,
                hint: resp.branches.length
                    ? null
                    : '這段區間尚無分點明細，換個天數或待資料更新後再試。'
            }));
        }
        catch {
            setStockTab((prev) => ({
                ...prev,
                data: null,
                hint: '連線異常，請確認 API 已啟動。'
            }));
        }
        finally {
            setLoading(false);
        }
    }, [setStockTab]);
    /** 進預設查詢；修改條件後請按「查詢」 */
    async function loadStock() {
        let stockId = stockTab.selected?.stockId;
        if (!stockId && stockTab.query.trim()) {
            const trimmed = stockTab.query.trim();
            const digits = trimmed.match(/[0-9]{4}/)?.[0];
            stockId =
                digits ??
                    suggestions.find((s) => s.stockName === trimmed || `${s.stockId} ${s.stockName}` === trimmed)?.stockId;
        }
        if (!stockId) {
            setStockTab((prev) => ({
                ...prev,
                data: null,
                hint: '請輸入股票代號或中文名稱，並從下拉選單選一筆。'
            }));
            return;
        }
        await loadStockById(stockId);
    }
    // ① `/?stockId=` 深連結 ② 首訪且無快取：預設 2330；有快取則不再自動打 API
    useEffect(() => {
        const idRaw = searchParams.get('stockId')?.trim();
        if (idRaw) {
            bootstrapRefs.stockDefaultBootstrapFired.current = true;
            let stockIdDecoded = idRaw;
            try {
                stockIdDecoded = decodeURIComponent(idRaw);
            }
            catch {
                stockIdDecoded = idRaw;
            }
            const nameRaw = searchParams.get('stockName')?.trim();
            let stockNameDecoded = '';
            if (nameRaw) {
                try {
                    stockNameDecoded = decodeURIComponent(nameRaw);
                }
                catch {
                    stockNameDecoded = nameRaw;
                }
            }
            const next = new URLSearchParams(searchParams);
            next.delete('stockId');
            next.delete('stockName');
            setSearchParams(next, { replace: true });
            const sug = { stockId: stockIdDecoded, stockName: stockNameDecoded };
            setStockTab((prev) => ({
                ...prev,
                selected: sug,
                query: stockNameDecoded ? `${stockIdDecoded} ${stockNameDecoded}`.trim() : stockIdDecoded,
                hint: null
            }));
            void loadStockById(stockIdDecoded, daysRef.current);
            return;
        }
        if (stockTab.data != null || stockTab.hint != null)
            return;
        if (bootstrapRefs.stockDefaultBootstrapFired.current)
            return;
        bootstrapRefs.stockDefaultBootstrapFired.current = true;
        void loadStock();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        loadStockById,
        searchParams,
        setSearchParams,
        setStockTab,
        stockTab.data,
        stockTab.hint,
        bootstrapRefs
    ]);
    const showDropdown = openSuggest && suggestions.length > 0;
    /** Branch 頁 deeplink：與 Performance 排行榜同款 `branchId` / `branchName` */
    function branchSearchPath(branchId, branchName) {
        const sp = new URLSearchParams();
        sp.set('branchId', branchId);
        const name = (branchName || '').trim();
        if (name)
            sp.set('branchName', name);
        return `/branch?${sp.toString()}`;
    }
    return (_jsxs("div", { className: "grid2", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "row", children: [_jsxs("div", { className: "field suggest-wrap", children: [_jsx("span", { className: "field-label", children: "\u641C\u5C0B\u80A1\u7968\uFF08\u4EE3\u865F / \u4E2D\u6587\uFF09" }), _jsx("input", { role: "combobox", "aria-expanded": showDropdown, "aria-controls": "stock-suggest-list", value: query, onChange: (e) => {
                                            const v = e.target.value;
                                            setStockTab((prev) => ({
                                                ...prev,
                                                query: v,
                                                selected: null
                                            }));
                                            setOpenSuggest(true);
                                        }, onFocus: () => setOpenSuggest(true), onBlur: () => window.setTimeout(() => setOpenSuggest(false), 180), placeholder: "\u4F8B\u5982\uFF1A2330\u3001\u53F0\u7A4D\u96FB\u3001\u7A4D\u2026", onKeyDown: (e) => {
                                            if (!showDropdown)
                                                return;
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
                                            }
                                            else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setHighlightIdx((i) => Math.max(i - 1, 0));
                                            }
                                            else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const s = suggestions[highlightIdx];
                                                if (s)
                                                    pickSuggestion(s);
                                            }
                                            else if (e.key === 'Escape') {
                                                setOpenSuggest(false);
                                            }
                                        } }), showDropdown ? (_jsx("ul", { id: "stock-suggest-list", className: "suggest-list", role: "listbox", children: suggestions.map((s, i) => (_jsx("li", { role: "option", "aria-selected": i === highlightIdx, title: s.stockId, onMouseEnter: () => setHighlightIdx(i), onMouseDown: (ev) => ev.preventDefault(), onClick: () => pickSuggestion(s), children: _jsxs("strong", { children: [_jsx("span", { className: "mono", children: s.stockId }), " ", s.stockName] }) }, `${s.stockId}-${s.stockName}`))) })) : null, selected ? (_jsxs("span", { className: "selected-pill", title: `代號 ${selected.stockId}`, children: ["\u5DF2\u9078\uFF1A", selected.stockId, " ", selected.stockName] })) : null] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u8FD1 N \u500B\u4EA4\u6613\u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setStockTab((prev) => ({
                                            ...prev,
                                            days: Number(e.target.value)
                                        })) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: () => void loadStock(), disabled: loading, children: loading ? '查詢中…' : '查詢' })] })] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data && data.branches.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate, "\uFF08", data.tradingDays, " \u500B\u4EA4\u6613\u65E5\uFF09\u00B7 Top1 \u96C6\u4E2D\u5EA6", ' ', (data.concentration.top1Share * 100).toFixed(1), "% \u00B7 Top3", ' ', (data.concentration.top3Share * 100).toFixed(1), "%"] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5206\u9EDE" }), _jsx("th", { children: "\u8CB7\u9032" }), _jsx("th", { children: "\u8CE3\u51FA" }), _jsx("th", { children: "\u6DE8\u984D" }), _jsx("th", { children: "\u6BD4\u91CD" })] }) }), _jsx("tbody", { children: data.branches.slice(0, 50).map((b) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx(Link, { className: "performance-branch-link", to: branchSearchPath(b.branchId, b.branchName), children: b.branchName || b.branchId }) }), _jsx("td", { children: b.buyShares.toLocaleString() }), _jsx("td", { children: b.sellShares.toLocaleString() }), _jsx("td", { children: b.netShares.toLocaleString() }), _jsxs("td", { children: [(b.shareOfNetAbs * 100).toFixed(1), "%"] })] }, b.branchId))) })] })] })) : null] }), _jsxs("div", { className: "card chart-card", children: [_jsx("h3", { className: "chart-title", children: "\u5206\u9EDE\u96C6\u4E2D\u5EA6\uFF08\u4F9D\u6DE8\u984D\u7D55\u5C0D\u503C\uFF09" }), _jsx("p", { className: "muted chart-caption", children: "\u5713\u9905\u5716\u70BA\u524D\u5341\u540D\u5206\u9EDE\u3002" }), _jsx("div", { className: "chart-wrap", children: loading ? (_jsx("div", { className: "chart-empty", children: "\u8F09\u5165\u4E2D\u2026" })) : pieData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { dataKey: "value", data: pieData, nameKey: "name", outerRadius: 130, paddingAngle: 1, children: pieData.map((_, i) => (_jsx(Cell, { fill: PIE_COLORS[i % PIE_COLORS.length], stroke: "var(--color-bg-card)" }, String(i)))) }), _jsx(Tooltip, { contentStyle: {
                                            borderRadius: 10,
                                            border: '1px solid rgba(15,155,142,0.22)'
                                        } })] }) })) : (_jsxs("div", { className: "chart-empty", children: ["\u5C1A\u7121\u53EF\u8996\u89BA\u5316\u7684\u5206\u9EDE\u8CC7\u6599\u3002", _jsx("br", {}), "\u78BA\u8A8D\u5DF2\u8DD1\u904E\u722C\u87F2\u4E14 Redis \u6709\u8CC7\u6599\u5F8C\uFF0C\u6B64\u8655\u6703\u81EA\u52D5\u986F\u793A\u3002"] })) })] })] }));
}
