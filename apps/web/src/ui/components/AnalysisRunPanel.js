import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function pct(x) {
    return `${(x * 100).toFixed(1)}%`;
}
function pctSigned(x) {
    const p = (x * 100).toFixed(2);
    return `${x >= 0 ? '+' : ''}${p}%`;
}
function sourceLabel(source) {
    if (source === 'cursor-cloud')
        return 'Cursor Cloud';
    if (source === 'manual')
        return '手動';
    return source;
}
export function AnalysisRunList({ items, selectedId, loading, onSelect }) {
    if (loading && items.length === 0) {
        return _jsx("p", { className: "muted", children: "\u8F09\u5165\u5206\u6790\u7D00\u9304\u4E2D\u2026" });
    }
    if (!loading && items.length === 0) {
        return (_jsxs("div", { className: "hint-warn", children: ["\u5C1A\u7121\u5206\u6790\u7D00\u9304\u3002\u6392\u7A0B\u6216\u624B\u52D5\u57F7\u884C ", _jsx("code", { children: "npm run team-trading" }), " \u5F8C\u6703\u51FA\u73FE\u5728\u9019\u88E1\u3002"] }));
    }
    return (_jsx("div", { className: "analysis-run-list", children: items.map((run) => (_jsxs("button", { type: "button", className: `analysis-run-row${selectedId === run.id ? ' active' : ''}`, onClick: () => onSelect(run.id), children: [_jsxs("div", { className: "analysis-run-row__head", children: [_jsx("strong", { children: run.runDate }), _jsx("span", { className: "muted", children: sourceLabel(run.source) })] }), _jsxs("div", { className: "analysis-run-row__meta muted", children: [new Date(run.generatedAt).toLocaleString('zh-TW'), " \u00B7 ", run.strategies.length, " \u5957\u7B56\u7565"] }), _jsx("div", { className: "analysis-run-row__verdicts", children: run.strategies.map((s) => (_jsx("span", { className: "rec-badge rec-badge--mid", title: s.verdict, children: s.name }, s.id))) })] }, run.id))) }));
}
export function AnalysisRunDetailPanel({ detail, loading, error }) {
    if (loading)
        return _jsx("p", { className: "muted", children: "\u8F09\u5165\u5831\u544A\u4E2D\u2026" });
    if (error)
        return _jsx("div", { className: "hint-warn", children: error });
    if (!detail) {
        return _jsx("p", { className: "muted", children: "\u2190 \u9078\u4E00\u7B46\u5206\u6790\u7D00\u9304\u67E5\u770B\u5B8C\u6574\u5831\u544A" });
    }
    return (_jsxs("div", { className: "analysis-run-detail", children: [_jsxs("header", { className: "analysis-run-detail__head", children: [_jsxs("h3", { className: "page-title", style: { margin: 0 }, children: [detail.runDate, " \u5206\u6790\u5831\u544A"] }), _jsxs("p", { className: "muted", style: { margin: '4px 0 0' }, children: [sourceLabel(detail.source), " \u00B7 ", new Date(detail.generatedAt).toLocaleString('zh-TW')] })] }), detail.strategies.map((s) => (_jsxs("article", { className: "rec-card", style: { marginTop: 12 }, children: [_jsxs("h4", { style: { margin: '0 0 8px' }, children: [s.name, " ", _jsx("span", { className: "rec-badge", children: s.selectedVersion })] }), _jsx("p", { className: "rec-badge rec-badge--mid", style: { display: 'inline-block' }, children: s.verdict }), _jsxs("p", { style: { margin: '8px 0' }, children: ["\u6A23\u672C ", s.samples, " \u00B7 \u52DD\u7387 ", pct(s.winRate), " \u00B7 \u5E73\u5747\u5831\u916C", ' ', _jsx("span", { className: s.avgReturn >= 0 ? 'pos' : 'neg', children: pctSigned(s.avgReturn) })] }), s.picks.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "mini-title", children: "\u7576\u65E5\u89F8\u767C" }), _jsx("ul", { className: "rec-list rec-list--compact", children: s.picks.map((p) => (_jsxs("li", { children: [p.stockId, " ", p.stockName] }, p.stockId))) })] })) : (_jsx("p", { className: "muted", children: "\u7576\u65E5\u7121\u89F8\u767C\u6A19\u7684" }))] }, s.id))), _jsx("div", { className: "row", style: { marginTop: 16 }, children: _jsx("button", { type: "button", className: "secondary", onClick: () => {
                        const blob = new Blob([detail.reportHtml], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank', 'noopener,noreferrer');
                        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                    }, children: "\u958B\u555F\u5B8C\u6574 HTML \u5831\u544A" }) }), _jsx("p", { className: "muted", style: { fontSize: 12, marginTop: 16 }, children: "\u98A8\u96AA\u8072\u660E\uFF1A\u7B56\u7565\u7814\u7A76\u7528\u9014\uFF0C\u975E\u6295\u8CC7\u5EFA\u8B70\u3002" })] }));
}
