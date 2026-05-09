import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../api';
export function StatusBar() {
    const [status, setStatus] = useState(null);
    const [warn, setWarn] = useState(null);
    useEffect(() => {
        api
            .latestStatus()
            .then(setStatus)
            .catch(() => setWarn('無法連線到資料服務；請確認 API 容器已啟動（預設 http://localhost:8787）。'));
    }, []);
    return (_jsx("div", { className: "card status-card", children: _jsxs("div", { className: "row", style: { justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, color: 'var(--color-nav-active)', marginBottom: 4 }, children: "\u8CC7\u6599\u72C0\u614B" }), _jsx("div", { className: "muted", children: warn
                                ? warn
                                : status?.latestDate
                                    ? `最新交易日：${status.latestDate} · 來源 ${status.provider ?? '—'} · 市場 ${(status.markets ?? []).join('、') || '—'}`
                                    : '尚未寫入資料；可先執行一次爬蟲。' })] }), _jsx("button", { type: "button", className: "secondary", onClick: () => window.location.reload(), children: "\u91CD\u65B0\u6574\u7406" })] }) }));
}
