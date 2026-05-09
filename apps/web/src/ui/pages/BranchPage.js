import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
const BAR_FILL = '#0f9b8e';
export function BranchPage() {
    const [query, setQuery] = useState('');
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
                .branchSuggest(q, 40)
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
        }, 280);
        return () => window.clearTimeout(handle);
    }, [query]);
    const chartData = useMemo(() => {
        if (!data?.stocks?.length)
            return [];
        return data.stocks.slice(0, 10).map((s) => ({
            label: s.stockName ? `${s.stockId} ${s.stockName}` : s.stockId,
            net: s.netShares
        }));
    }, [data]);
    async function run() {
        setHint(null);
        let branchId = selected?.branchId;
        if (!branchId && query.trim()) {
            const hit = suggestions.find((s) => s.branchName === query.trim());
            branchId = hit?.branchId;
            if (hit)
                setSelected(hit);
        }
        if (!branchId) {
            setHint('請輸入分點名稱關鍵字，並從清單選一筆分點。');
            setData(null);
            return;
        }
        setLoading(true);
        try {
            const resp = await api.byBranch(branchId, days);
            setData(resp);
            if (!resp.stocks.length) {
                setHint('這段區間暫無持股明細，換個天數或待資料更新後再試。');
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
    function pickSuggestion(s) {
        setSelected(s);
        setQuery(s.branchName || s.branchId);
        setOpenSuggest(false);
        setHint(null);
    }
    const showDropdown = openSuggest && suggestions.length > 0;
    return (_jsxs("div", { className: "grid2", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "row align-start", children: [_jsxs("div", { className: "field suggest-wrap", children: [_jsx("span", { className: "field-label", children: "\u641C\u5C0B\u5206\u9EDE\uFF08\u540D\u7A31\uFF09" }), _jsx("input", { role: "combobox", "aria-expanded": showDropdown, "aria-controls": "branch-suggest-list", value: query, placeholder: "\u4F8B\u5982\uFF1A\u571F\u9280\u3001\u5143\u5927\u3001\u5408\u5EAB\u2026", onChange: (e) => {
                                            setQuery(e.target.value);
                                            setSelected(null);
                                            setOpenSuggest(true);
                                        }, onFocus: () => setOpenSuggest(true), onBlur: () => window.setTimeout(() => setOpenSuggest(false), 180), onKeyDown: (e) => {
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
                                        } }), showDropdown ? (_jsx("ul", { id: "branch-suggest-list", className: "suggest-list", role: "listbox", children: suggestions.map((s, i) => (_jsx("li", { role: "option", "aria-selected": i === highlightIdx, title: s.branchId, onMouseEnter: () => setHighlightIdx(i), onMouseDown: (ev) => ev.preventDefault(), onClick: () => pickSuggestion(s), children: _jsx("strong", { children: s.branchName || '（無名稱）' }) }, `${s.branchId}-${s.branchName}`))) })) : null, selected ? (_jsxs("span", { className: "selected-pill", title: `代號 ${selected.branchId}`, children: ["\u5DF2\u9078\uFF1A", selected.branchName] })) : null] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u8FD1 N \u500B\u4EA4\u6613\u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setDays(Number(e.target.value)) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: run, disabled: loading, children: loading ? '查詢中…' : '查詢' })] })] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data && data.stocks.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate, "\uFF08", data.tradingDays, " \u500B\u4EA4\u6613\u65E5\uFF09"] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u80A1\u7968" }), _jsx("th", { children: "\u8CB7\u9032" }), _jsx("th", { children: "\u8CE3\u51FA" }), _jsx("th", { children: "\u6DE8\u984D" }), _jsx("th", { children: "\u6BD4\u91CD" })] }) }), _jsx("tbody", { children: data.stocks.slice(0, 50).map((s) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("span", { className: "mono", children: s.stockId }), s.stockName ? ` ${s.stockName}` : null] }), _jsx("td", { children: s.buyShares.toLocaleString() }), _jsx("td", { children: s.sellShares.toLocaleString() }), _jsx("td", { children: s.netShares.toLocaleString() }), _jsxs("td", { children: [(s.shareOfNetAbs * 100).toFixed(1), "%"] })] }, s.stockId))) })] })] })) : null] }), _jsxs("div", { className: "card chart-card", children: [_jsx("h3", { className: "chart-title", children: "\u4E3B\u529B\u6301\u80A1\uFF08\u6DE8\u984D Top 10\uFF09" }), _jsx("p", { className: "muted chart-caption", children: "\u9577\u689D\u5716\u70BA\u6DE8\u984D\uFF1B\u50C5\u986F\u793A\u524D\u5341\u540D\u3002" }), _jsx("div", { className: "chart-wrap", children: loading ? (_jsx("div", { className: "chart-empty", children: "\u8F09\u5165\u4E2D\u2026" })) : chartData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: chartData, layout: "vertical", margin: { left: 8, right: 16, top: 8 }, children: [_jsx(XAxis, { type: "number", stroke: "#5a726f", tick: { fill: '#5a726f', fontSize: 12 } }), _jsx(YAxis, { type: "category", dataKey: "label", width: 160, stroke: "#5a726f", tick: { fill: '#5a726f', fontSize: 12 } }), _jsx(Tooltip, { contentStyle: {
                                            borderRadius: 10,
                                            border: '1px solid rgba(15,155,142,0.22)'
                                        } }), _jsx(Bar, { dataKey: "net", fill: BAR_FILL, radius: [0, 6, 6, 0] })] }) })) : (_jsx("div", { className: "chart-empty", children: "\u9078\u5B9A\u5206\u9EDE\u4E26\u67E5\u8A62\u5F8C\uFF0C\u6B64\u8655\u6703\u986F\u793A\u6DE8\u984D\u524D\u5341\u540D\u80A1\u7968\u3002" })) })] })] }));
}
