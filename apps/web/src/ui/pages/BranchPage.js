import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useDashboardTabCache } from '../DashboardTabCache';
import { InteractivePieChart } from '../components/InteractivePieChart';
export function BranchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { branchTab, setBranchTab } = useDashboardTabCache();
    const { query, selected, days, data, hint } = branchTab;
    const [suggestions, setSuggestions] = useState([]);
    const [openSuggest, setOpenSuggest] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const suggestSeq = useRef(0);
    const daysRef = useRef(days);
    useEffect(() => {
        daysRef.current = days;
    }, [days]);
    const runWithBranchId = useCallback(async (branchId, windowTradingDays) => {
        const n = typeof windowTradingDays === 'number' ? windowTradingDays : daysRef.current;
        setBranchTab((prev) => ({ ...prev, hint: null }));
        setLoading(true);
        try {
            const resp = await api.byBranch(branchId, n);
            setBranchTab((prev) => ({ ...prev, data: resp }));
            if (!resp.stocks.length) {
                setBranchTab((prev) => ({
                    ...prev,
                    hint: '這段區間暫無持股明細，換個天數或待資料更新後再試。'
                }));
            }
        }
        catch {
            setBranchTab((prev) => ({
                ...prev,
                data: null,
                hint: '連線異常，請確認 API 已啟動。'
            }));
        }
        finally {
            setLoading(false);
        }
    }, [setBranchTab]);
    /** 網址帶 `branchId` 時：每次出現都吃一次並清 query（對應 SPA 來回／深連結） */
    useEffect(() => {
        const branchIdRaw = searchParams.get('branchId')?.trim();
        if (!branchIdRaw)
            return;
        const branchNameRaw = searchParams.get('branchName')?.trim();
        let stockBranchIdDecoded;
        try {
            stockBranchIdDecoded = decodeURIComponent(branchIdRaw);
        }
        catch {
            stockBranchIdDecoded = branchIdRaw;
        }
        let branchNameDecoded = '';
        if (branchNameRaw) {
            try {
                branchNameDecoded = decodeURIComponent(branchNameRaw);
            }
            catch {
                branchNameDecoded = branchNameRaw;
            }
        }
        const next = new URLSearchParams(searchParams);
        next.delete('branchId');
        next.delete('branchName');
        setSearchParams(next, { replace: true });
        const suggestion = {
            branchId: stockBranchIdDecoded,
            branchName: branchNameDecoded ? branchNameDecoded : stockBranchIdDecoded
        };
        setBranchTab((prev) => ({
            ...prev,
            selected: suggestion,
            query: suggestion.branchName || suggestion.branchId,
            hint: null
        }));
        setOpenSuggest(true);
        void runWithBranchId(suggestion.branchId, daysRef.current);
    }, [runWithBranchId, searchParams, setBranchTab, setSearchParams]);
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
    /** Stock 頁 deeplink：`/stock?stockId=` */
    function stockSearchPath(stockId, stockName) {
        const sp = new URLSearchParams();
        sp.set('stockId', stockId);
        const n = stockName?.trim();
        if (n)
            sp.set('stockName', n);
        return `/stock?${sp.toString()}`;
    }
    const pieSegments = useMemo(() => {
        if (!data?.stocks?.length)
            return [];
        return data.stocks.slice(0, 10).map((s) => ({
            id: s.stockId,
            label: s.stockName ? `${s.stockId} ${s.stockName}` : s.stockId,
            value: Math.abs(s.netShares),
            navigateTo: stockSearchPath(s.stockId, s.stockName),
            actionLabel: '前往股票'
        }));
    }, [data]);
    async function run() {
        let branchId = selected?.branchId;
        if (!branchId && query.trim()) {
            const hit = suggestions.find((s) => s.branchName === query.trim());
            branchId = hit?.branchId;
            if (hit)
                setBranchTab((prev) => ({
                    ...prev,
                    selected: hit
                }));
        }
        if (!branchId) {
            setBranchTab((prev) => ({
                ...prev,
                hint: '請輸入分點名稱關鍵字，並從清單選一筆分點。',
                data: null
            }));
            return;
        }
        await runWithBranchId(branchId);
    }
    function pickSuggestion(s) {
        setBranchTab((prev) => ({
            ...prev,
            selected: s,
            query: s.branchName || s.branchId,
            hint: null
        }));
        setOpenSuggest(false);
    }
    const showDropdown = openSuggest && suggestions.length > 0;
    return (_jsxs("div", { className: "grid2", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "row align-start", children: [_jsxs("div", { className: "field suggest-wrap", children: [_jsx("span", { className: "field-label", children: "\u641C\u5C0B\u5206\u9EDE\uFF08\u540D\u7A31\uFF09" }), _jsx("input", { role: "combobox", "aria-expanded": showDropdown, "aria-controls": "branch-suggest-list", value: query, placeholder: "\u4F8B\u5982\uFF1A\u571F\u9280\u3001\u5143\u5927\u3001\u5408\u5EAB\u2026", onChange: (e) => {
                                            const v = e.target.value;
                                            setBranchTab((prev) => ({
                                                ...prev,
                                                query: v,
                                                selected: null
                                            }));
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
                                        } }), showDropdown ? (_jsx("ul", { id: "branch-suggest-list", className: "suggest-list", role: "listbox", children: suggestions.map((s, i) => (_jsx("li", { role: "option", "aria-selected": i === highlightIdx, title: s.branchId, onMouseEnter: () => setHighlightIdx(i), onMouseDown: (ev) => ev.preventDefault(), onClick: () => pickSuggestion(s), children: _jsx("strong", { children: s.branchName || '（無名稱）' }) }, `${s.branchId}-${s.branchName}`))) })) : null, selected ? (_jsxs("span", { className: "selected-pill", title: `代號 ${selected.branchId}`, children: ["\u5DF2\u9078\uFF1A", selected.branchName] })) : null] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u8FD1 N \u500B\u4EA4\u6613\u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setBranchTab((prev) => ({
                                            ...prev,
                                            days: Number(e.target.value)
                                        })) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: run, disabled: loading, children: loading ? '查詢中…' : '查詢' })] })] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data && data.stocks.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate, "\uFF08", data.tradingDays, " \u500B\u4EA4\u6613\u65E5\uFF09"] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u80A1\u7968" }), _jsx("th", { children: "\u8CB7\u9032" }), _jsx("th", { children: "\u8CE3\u51FA" }), _jsx("th", { children: "\u6DE8\u984D" }), _jsx("th", { children: "\u6BD4\u91CD" })] }) }), _jsx("tbody", { children: data.stocks.slice(0, 50).map((s) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs(Link, { className: "performance-branch-link", to: stockSearchPath(s.stockId, s.stockName), children: [_jsx("span", { className: "mono", children: s.stockId }), s.stockName ? ` ${s.stockName}` : ''] }) }), _jsx("td", { children: s.buyShares.toLocaleString() }), _jsx("td", { children: s.sellShares.toLocaleString() }), _jsx("td", { children: s.netShares.toLocaleString() }), _jsxs("td", { children: [(s.shareOfNetAbs * 100).toFixed(1), "%"] })] }, s.stockId))) })] })] })) : null] }), _jsxs("div", { className: "card chart-card", children: [_jsx("h3", { className: "chart-title", children: "\u4E3B\u529B\u6301\u80A1\uFF08\u6DE8\u984D Top 10\uFF09" }), _jsx("p", { className: "muted chart-caption", children: "\u5713\u9905\u5716\u70BA\u6DE8\u984D\u524D\u5341\u540D\uFF1Bhover \u53EF\u9EDE\u64CA\u524D\u5F80 Stock \u67E5\u8A62\u3002" }), _jsx("div", { className: "chart-wrap", children: loading ? (_jsx("div", { className: "chart-empty", children: "\u8F09\u5165\u4E2D\u2026" })) : pieSegments.length > 0 ? (_jsx(InteractivePieChart, { segments: pieSegments })) : (_jsx("div", { className: "chart-empty", children: "\u9078\u5B9A\u5206\u9EDE\u4E26\u67E5\u8A62\u5F8C\uFF0C\u6B64\u8655\u6703\u986F\u793A\u6DE8\u984D\u524D\u5341\u540D\u80A1\u7968\u3002" })) })] })] }));
}
