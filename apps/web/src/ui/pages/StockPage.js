import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
const PIE_COLORS = ['#0f9b8e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#0d8177', '#0f5952', '#134e4a', '#5ebfb5', '#d5f5f0'];
export function StockPage() {
    const [query, setQuery] = useState('2330');
    const [suggestions, setSuggestions] = useState([]);
    const [openSuggest, setOpenSuggest] = useState(false);
    const [selected, setSelected] = useState(null);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [days, setDays] = useState(20);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState(null);
    const suggestSeq = useRef(0);
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
        setSelected(s);
        setQuery(`${s.stockId} ${s.stockName}`.trim());
        setOpenSuggest(false);
        setHint(null);
    }
    async function loadStock() {
        setHint(null);
        setLoading(true);
        try {
            let stockId = selected?.stockId;
            if (!stockId && query.trim()) {
                const trimmed = query.trim();
                const digits = trimmed.match(/[0-9]{4}/)?.[0];
                stockId =
                    digits ??
                        suggestions.find((s) => s.stockName === trimmed || `${s.stockId} ${s.stockName}` === trimmed)?.stockId;
            }
            if (!stockId) {
                setData(null);
                setHint('請輸入股票代號或中文名稱，並從下拉選單選一筆。');
                return;
            }
            const resp = await api.byStock(stockId.trim(), days);
            setData(resp);
            if (!resp.branches.length) {
                setHint('這段區間尚無分點明細，換個天數或待資料更新後再試。');
            }
        }
        catch {
            setData(null);
            setHint('連線異常，請確認 API 已啟動。');
        }
        finally {
            setLoading(false);
        }
    }
    // 首次進頁帶出預設查詢；修改條件後請按「查詢」。
    useEffect(() => {
        void loadStock();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const showDropdown = openSuggest && suggestions.length > 0;
    return (_jsxs("div", { className: "grid2", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "row", children: [_jsxs("div", { className: "field suggest-wrap", children: [_jsx("span", { className: "field-label", children: "\u641C\u5C0B\u80A1\u7968\uFF08\u4EE3\u865F / \u4E2D\u6587\uFF09" }), _jsx("input", { role: "combobox", "aria-expanded": showDropdown, "aria-controls": "stock-suggest-list", value: query, onChange: (e) => {
                                            setQuery(e.target.value);
                                            setSelected(null);
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
                                        } }), showDropdown ? (_jsx("ul", { id: "stock-suggest-list", className: "suggest-list", role: "listbox", children: suggestions.map((s, i) => (_jsx("li", { role: "option", "aria-selected": i === highlightIdx, title: s.stockId, onMouseEnter: () => setHighlightIdx(i), onMouseDown: (ev) => ev.preventDefault(), onClick: () => pickSuggestion(s), children: _jsxs("strong", { children: [_jsx("span", { className: "mono", children: s.stockId }), " ", s.stockName] }) }, `${s.stockId}-${s.stockName}`))) })) : null, selected ? (_jsxs("span", { className: "selected-pill", title: `代號 ${selected.stockId}`, children: ["\u5DF2\u9078\uFF1A", selected.stockId, " ", selected.stockName] })) : null] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u8FD1 N \u500B\u4EA4\u6613\u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setDays(Number(e.target.value)) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: () => void loadStock(), disabled: loading, children: loading ? '查詢中…' : '查詢' })] })] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data && data.branches.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate, "\uFF08", data.tradingDays, " \u500B\u4EA4\u6613\u65E5\uFF09\u00B7 Top1 \u96C6\u4E2D\u5EA6", ' ', (data.concentration.top1Share * 100).toFixed(1), "% \u00B7 Top3", ' ', (data.concentration.top3Share * 100).toFixed(1), "%"] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5206\u9EDE" }), _jsx("th", { children: "\u8CB7\u9032" }), _jsx("th", { children: "\u8CE3\u51FA" }), _jsx("th", { children: "\u6DE8\u984D" }), _jsx("th", { children: "\u6BD4\u91CD" })] }) }), _jsx("tbody", { children: data.branches.slice(0, 50).map((b) => (_jsxs("tr", { children: [_jsx("td", { children: b.branchName || b.branchId }), _jsx("td", { children: b.buyShares.toLocaleString() }), _jsx("td", { children: b.sellShares.toLocaleString() }), _jsx("td", { children: b.netShares.toLocaleString() }), _jsxs("td", { children: [(b.shareOfNetAbs * 100).toFixed(1), "%"] })] }, b.branchId))) })] })] })) : null] }), _jsxs("div", { className: "card chart-card", children: [_jsx("h3", { className: "chart-title", children: "\u5206\u9EDE\u96C6\u4E2D\u5EA6\uFF08\u4F9D\u6DE8\u984D\u7D55\u5C0D\u503C\uFF09" }), _jsx("p", { className: "muted chart-caption", children: "\u5713\u9905\u5716\u70BA\u524D\u5341\u540D\u5206\u9EDE\u3002" }), _jsx("div", { className: "chart-wrap", children: loading ? (_jsx("div", { className: "chart-empty", children: "\u8F09\u5165\u4E2D\u2026" })) : pieData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { dataKey: "value", data: pieData, nameKey: "name", outerRadius: 130, paddingAngle: 1, children: pieData.map((_, i) => (_jsx(Cell, { fill: PIE_COLORS[i % PIE_COLORS.length], stroke: "var(--color-bg-card)" }, String(i)))) }), _jsx(Tooltip, { contentStyle: {
                                            borderRadius: 10,
                                            border: '1px solid rgba(15,155,142,0.22)'
                                        } })] }) })) : (_jsxs("div", { className: "chart-empty", children: ["\u5C1A\u7121\u53EF\u8996\u89BA\u5316\u7684\u5206\u9EDE\u8CC7\u6599\u3002", _jsx("br", {}), "\u78BA\u8A8D\u5DF2\u8DD1\u904E\u722C\u87F2\u4E14 Redis \u6709\u8CC7\u6599\u5F8C\uFF0C\u6B64\u8655\u6703\u81EA\u52D5\u986F\u793A\u3002"] })) })] })] }));
}
