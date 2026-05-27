import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
export function FavoriteCard({ item, onSave, onDelete }) {
    const snap = item.strategySnapshot;
    const [editing, setEditing] = useState(false);
    const [buyDate, setBuyDate] = useState(item.buyDate ?? '');
    const [buyPrice, setBuyPrice] = useState(item.buyPrice != null ? String(item.buyPrice) : '');
    const [notes, setNotes] = useState(item.notes ?? '');
    const [busy, setBusy] = useState(false);
    async function handleSave() {
        setBusy(true);
        try {
            await onSave(item.id, {
                buyDate: buyDate.trim() || null,
                buyPrice: buyPrice.trim() ? Number(buyPrice) : null,
                notes: notes.trim() || null
            });
            setEditing(false);
        }
        finally {
            setBusy(false);
        }
    }
    async function handleDelete() {
        if (!window.confirm(`確定從最愛移除 ${item.stockId} ${item.stockName}？`))
            return;
        setBusy(true);
        try {
            await onDelete(item.id);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("article", { className: "rec-card fav-card", children: [_jsxs("header", { className: "rec-card__head", children: [_jsxs("div", { children: [_jsx("h3", { className: "rec-card__title", children: _jsxs(Link, { to: `/stock?stockId=${item.stockId}&stockName=${encodeURIComponent(item.stockName)}`, children: [item.stockId, " ", item.stockName] }) }), _jsxs("p", { className: "muted rec-card__meta", children: ["\u52A0\u5165\u6642\u9593 ", new Date(item.addedAt).toLocaleString('zh-TW'), " \u00B7 \u7B56\u7565 ", snap.strategyName ?? '—', " \u00B7 \u8A0A\u865F\u65E5", ' ', snap.signalDate ?? '—'] })] }), _jsx("div", { className: "rec-card__badges", children: !editing ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "secondary", disabled: busy, onClick: () => setEditing(true), children: "\u7DE8\u8F2F\u8CB7\u9032\u7D00\u9304" }), _jsx("button", { type: "button", className: "secondary", disabled: busy, onClick: handleDelete, children: "\u79FB\u9664" })] })) : null })] }), editing ? (_jsxs("div", { className: "row align-start fav-edit", children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u8CB7\u9032\u65E5\u671F" }), _jsx("input", { type: "date", value: buyDate, onChange: (e) => setBuyDate(e.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "\u8CB7\u9032\u50F9\u683C" }), _jsx("input", { type: "number", step: "0.01", placeholder: "\u4F8B\uFF1A230.5", value: buyPrice, onChange: (e) => setBuyPrice(e.target.value) })] }), _jsxs("label", { className: "field", style: { flex: 1, minWidth: 200 }, children: [_jsx("span", { className: "field-label", children: "\u5099\u8A3B" }), _jsx("input", { type: "text", placeholder: "\u4F8B\uFF1A\u7B2C\u4E00\u6279 40% \u5DF2\u9032", value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsx("button", { type: "button", disabled: busy, onClick: handleSave, children: "\u5132\u5B58" }), _jsx("button", { type: "button", className: "secondary", disabled: busy, onClick: () => setEditing(false), children: "\u53D6\u6D88" })] })) : (_jsxs("div", { className: "info-grid fav-summary", children: [_jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u6211\u7684\u8CB7\u9032" }), _jsxs("div", { className: "mini-body", children: ["\u65E5\u671F\uFF1A", item.buyDate ?? '（尚未填寫）', _jsx("br", {}), "\u50F9\u683C\uFF1A", item.buyPrice != null ? item.buyPrice.toFixed(2) : '（尚未填寫）', item.notes ? (_jsxs(_Fragment, { children: [_jsx("br", {}), "\u5099\u8A3B\uFF1A", item.notes] })) : null] })] }), _jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u7576\u6642\u5EFA\u8B70\u8CB7\u5165\u5340\u9593" }), _jsx("div", { className: "mini-body mono", children: snap.buyZone
                                    ? `${snap.buyZone.lowPrice.toFixed(2)} ～ ${snap.buyZone.highPrice.toFixed(2)}（參考 ${snap.buyZone.referencePrice.toFixed(2)}）`
                                    : '—' })] })] })), snap.buyMethod ? (_jsxs("div", { className: "mini-card", style: { marginTop: 12 }, children: [_jsxs("div", { className: "mini-title", children: ["\u9032\u5834\u65B9\u5F0F\uFF08", snap.buyMethod.style, "\uFF09"] }), _jsx("ol", { className: "rec-list rec-list--compact", children: snap.buyMethod.steps.map((s) => (_jsx("li", { children: s }, s))) })] })) : null, snap.exitConditions?.length ? (_jsxs("div", { className: "mini-card", style: { marginTop: 12 }, children: [_jsx("div", { className: "mini-title", children: "\u8CE3\u51FA\u689D\u4EF6" }), _jsx("ul", { className: "rec-list rec-list--compact", children: snap.exitConditions.map((e) => (_jsxs("li", { children: [_jsx("strong", { children: e.label }), " \u2014 ", e.detail] }, e.label))) })] })) : null, _jsxs("div", { className: "info-grid rec-card__grid", style: { marginTop: 12 }, children: [snap.watchItems?.length ? (_jsxs("div", { className: "mini-card", children: [_jsx("div", { className: "mini-title", children: "\u8FFD\u8E64\u4E8B\u9805" }), _jsx("ul", { className: "rec-list rec-list--compact", children: snap.watchItems.map((w) => (_jsx("li", { children: w }, w))) })] })) : null, snap.cautions?.length ? (_jsxs("div", { className: "mini-card rec-caution", children: [_jsx("div", { className: "mini-title", children: "\u6CE8\u610F\u4E8B\u9805" }), _jsx("ul", { className: "rec-list rec-list--compact", children: snap.cautions.map((c) => (_jsx("li", { children: c }, c))) })] })) : null] })] }));
}
