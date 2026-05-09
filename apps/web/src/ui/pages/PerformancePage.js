import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { api } from '../api';
export function PerformancePage() {
    const [days, setDays] = useState(20);
    const [forwardDays, setForwardDays] = useState(10);
    const [minSample, setMinSample] = useState(10);
    const [metric, setMetric] = useState('avgForwardReturn');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState(null);
    async function run() {
        setHint(null);
        setLoading(true);
        try {
            const resp = await api.performance(days, forwardDays, metric, minSample);
            setData(resp);
            if (!resp.top.length) {
                setHint('這組條件暫時算不出排行；試著調低最小樣本、縮短前瞻 K，或累積更多交易日後再試。');
            }
        }
        catch {
            setData(null);
            setHint('連線或計算異常，請確認 API 與 Postgres 資料是否就緒。');
        }
        finally {
            setLoading(false);
        }
    }
    const metricLabel = metric === 'avgForwardReturn'
        ? '平均前瞻報酬'
        : metric === 'hitRate'
            ? '勝率'
            : '加權報酬 proxy';
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "page-intro", children: [_jsx("h2", { className: "page-title", children: "Branch Performance" }), _jsx("p", { className: "muted", style: { margin: '6px 0 0' }, children: "\u7528\u300C\u5206\u9EDE\u6DE8\u8CB7\u4E8B\u4EF6\u300D\u505A\u7C21\u55AE\u56DE\u6E2C\uFF1A\u56DE\u6EAF \\(N\\) \u500B\u4EA4\u6613\u65E5\u3001\u5F80\u524D\u770B \\(K\\) \u500B\u4EA4\u6613\u65E5\u7684\u5831\u916C\u8868\u73FE\u3002" }), _jsxs("div", { className: "info-grid", style: { marginTop: 14 }, children: [_jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u4E09\u500B\u53C3\u6578" }), _jsxs("div", { className: "mini-body muted", children: ["N = \u56DE\u6EAF\u5929\u6578\uFF08\u53D6\u6A23\u7A97\u53E3\uFF09", _jsx("br", {}), "K = \u524D\u77BB\u5929\u6578\uFF08\u5831\u916C\u8A08\u7B97\uFF09", _jsx("br", {}), "\u6700\u5C0F\u6A23\u672C = \u5206\u9EDE\u81F3\u5C11\u51FA\u73FE\u5E7E\u6B21\u624D\u6392\u540D"] })] }), _jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u6307\u6A19\u600E\u9EBC\u770B" }), _jsxs("div", { className: "mini-body muted", children: ["\u5E73\u5747\u524D\u77BB\u5831\u916C\uFF1A\u4E8B\u4EF6\u5F8C K \u65E5\u7684\u5E73\u5747\u6F32\u8DCC\u5E45", _jsx("br", {}), "\u52DD\u7387\uFF1A\u4E8B\u4EF6\u5F8C K \u65E5\u4E0A\u6F32\u7684\u6BD4\u4F8B", _jsx("br", {}), "\u52A0\u6B0A\u5831\u916C proxy\uFF1A\u7528\u300C\u6DE8\u8CB7\u91D1\u984D proxy\u300D\u52A0\u6B0A\u5F8C\u7684\u5831\u916C"] })] })] }), _jsxs("div", { className: "mini-card", style: { marginTop: 12 }, children: [_jsx("div", { className: "mini-title", children: "\u4F8B\u5B50" }), _jsxs("div", { className: "mini-body muted", children: ["\u4F8B 1\uFF1AN=20\u3001K=10\u3001\u6307\u6A19=\u5E73\u5747\u524D\u77BB\u5831\u916C\u3001\u6700\u5C0F\u6A23\u672C=10 \u2192 \u770B\u300C\u6700\u8FD1\u4E00\u500B\u6708\u300D\u54EA\u4E9B\u5206\u9EDE\u6DE8\u8CB7\u5F8C 10 \u65E5\u5E73\u5747\u8868\u73FE\u6700\u597D\u3002", _jsx("br", {}), "\u4F8B 2\uFF1AN=60\u3001K=5\u3001\u6307\u6A19=\u52DD\u7387\u3001\u6700\u5C0F\u6A23\u672C=30 \u2192 \u770B\u300C\u6700\u8FD1\u4E09\u500B\u6708\u300D\u66F4\u7A69\u5B9A\u7684\u5206\u9EDE\uFF08\u547D\u4E2D\u7387\u53D6\u5411\uFF09\u3002"] })] })] }), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u56DE\u6EAF N \u65E5" }), _jsx("input", { type: "number", min: 1, max: 365, value: days, onChange: (e) => setDays(Number(e.target.value)) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u524D\u77BB K \u65E5" }), _jsx("input", { type: "number", min: 1, max: 120, value: forwardDays, onChange: (e) => setForwardDays(Number(e.target.value)) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6307\u6A19" }), _jsxs("select", { value: metric, onChange: (e) => setMetric(e.target.value), children: [_jsx("option", { value: "avgForwardReturn", children: "\u5E73\u5747\u524D\u77BB\u5831\u916C" }), _jsx("option", { value: "hitRate", children: "\u52DD\u7387" }), _jsx("option", { value: "weightedPnlProxy", children: "\u52A0\u6B0A\u5831\u916C proxy" })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u6700\u5C0F\u6A23\u672C" }), _jsx("input", { type: "number", min: 1, max: 500, value: minSample, onChange: (e) => setMinSample(Number(e.target.value)) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", "aria-hidden": true, style: { visibility: 'hidden' }, children: "\u2014" }), _jsx("button", { type: "button", onClick: run, disabled: loading, children: loading ? '計算中…' : '計算' })] })] }), _jsxs("p", { className: "muted", style: { marginTop: 14 }, children: ["\u4F9D\u5206\u9EDE\u6DE8\u8CB7\u4E8B\u4EF6\u8A08\u7B97 ", metricLabel, "\uFF1B\u9700\u8981\u6709\u8DB3\u5920\u4EA4\u6613\u65E5\u8207\u300C\u524D\u77BB K \u65E5\u300D\u6536\u76E4\u50F9\u8CC7\u6599\u3002"] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, data && data.top.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "muted", style: { marginTop: 16 }, children: ["\u53C3\u8003\u5340\u9593\uFF1A", data.startDate, " \u2192 ", data.endDate] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5206\u9EDE" }), _jsx("th", { children: "\u6A23\u672C\u6578" }), _jsx("th", { children: "\u6578\u503C" })] }) }), _jsx("tbody", { children: data.top.map((r) => (_jsxs("tr", { children: [_jsx("td", { children: r.branchName || r.branchId }), _jsx("td", { children: r.sampleSize }), _jsx("td", { children: metric === 'hitRate'
                                                ? `${(r.value * 100).toFixed(1)}%`
                                                : metric === 'avgForwardReturn'
                                                    ? `${(r.value * 100).toFixed(2)}%`
                                                    : r.value.toFixed(0) })] }, r.branchId))) })] })] })) : null] }));
}
