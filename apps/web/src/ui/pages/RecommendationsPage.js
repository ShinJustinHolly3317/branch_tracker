import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { RecommendationCard } from '../components/RecommendationCard';
import { FavoriteCard } from '../components/FavoriteCard';
export function RecommendationsPage() {
    const [tab, setTab] = useState('recommend');
    const [recData, setRecData] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [loadingRec, setLoadingRec] = useState(false);
    const [loadingFav, setLoadingFav] = useState(false);
    const [hint, setHint] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.stockId)), [favorites]);
    const loadRecommendations = useCallback(async () => {
        setLoadingRec(true);
        setHint(null);
        try {
            const r = await api.shortTermRecommendations(20);
            setRecData(r);
            if (r.debugMessage)
                setHint(r.debugMessage);
            if (r.items.length === 0 && !r.debugMessage) {
                setHint('今日沒有符合「溫和動能 × 分點確認」的標的，可改天再來或到 Stock 頁自行觀察。');
            }
        }
        catch {
            setHint('無法載入推薦清單，請確認 API 已啟動。');
        }
        finally {
            setLoadingRec(false);
        }
    }, []);
    const loadFavorites = useCallback(async () => {
        setLoadingFav(true);
        try {
            const r = await api.listFavorites();
            setFavorites(r.items);
        }
        catch {
            setHint('無法載入最愛清單。');
        }
        finally {
            setLoadingFav(false);
        }
    }, []);
    useEffect(() => {
        void loadRecommendations();
        void loadFavorites();
    }, [loadRecommendations, loadFavorites]);
    async function handleAddFavorite(stockId) {
        const item = recData?.items.find((x) => x.stockId === stockId);
        if (!item)
            return;
        setSavingId(stockId);
        try {
            const fav = await api.addFavorite({
                stockId: item.stockId,
                stockName: item.stockName,
                strategySnapshot: item.strategySnapshot
            });
            setFavorites((prev) => {
                const rest = prev.filter((f) => f.stockId !== fav.stockId);
                return [fav, ...rest];
            });
            setHint(`已將 ${item.stockId} ${item.stockName} 加入最愛，可至「我的最愛」填寫買進日期與價格。`);
        }
        catch {
            setHint('加入最愛失敗，請稍後再試。');
        }
        finally {
            setSavingId(null);
        }
    }
    async function handleUpdateFavorite(id, patch) {
        const updated = await api.updateFavorite(id, patch);
        setFavorites((prev) => prev.map((f) => (f.id === id ? updated : f)));
        setHint('已更新買進紀錄。');
    }
    async function handleDeleteFavorite(id) {
        await api.deleteFavorite(id);
        setFavorites((prev) => prev.filter((f) => f.id !== id));
        setHint('已從最愛清單移除。');
    }
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { className: "page-title", children: "\u80A1\u7968\u63A8\u85A6\uFF06\u9810\u6E2C" }), _jsx("p", { className: "page-intro muted", children: "\u4F9D\u300C\u6EAB\u548C\u52D5\u80FD \u00D7 \u5206\u9EDE\u78BA\u8A8D\u300D\u7B56\u7565\uFF0C\u5217\u51FA\u77ED\u671F\u53EF\u89C0\u5BDF\u6A19\u7684\u3001\u8CB7\u5165\u5340\u9593\u3001\u5206\u6279\u65B9\u5F0F\u8207\u8CE3\u51FA\u689D\u4EF6\u3002\u559C\u6B61\u7684\u6A19\u7684\u53EF\u52A0\u5165\u6700\u611B\uFF0C\u4E8B\u5F8C\u67E5\u95B1\u5B8C\u6574\u7B56\u7565\u8207\u4F60\u7684\u8CB7\u9032\u7D00\u9304\u3002" }), _jsxs("div", { className: "rec-tabs", role: "tablist", children: [_jsx("button", { type: "button", role: "tab", className: tab === 'recommend' ? 'rec-tab active' : 'rec-tab', "aria-selected": tab === 'recommend', onClick: () => setTab('recommend'), children: "\u4ECA\u65E5\u63A8\u85A6" }), _jsxs("button", { type: "button", role: "tab", className: tab === 'favorites' ? 'rec-tab active' : 'rec-tab', "aria-selected": tab === 'favorites', onClick: () => setTab('favorites'), children: ["\u6211\u7684\u6700\u611B", favorites.length ? ` (${favorites.length})` : ''] })] }), hint ? _jsx("div", { className: "hint-soft", children: hint }) : null, tab === 'recommend' ? (_jsxs("section", { className: "rec-section", children: [_jsxs("div", { className: "row", style: { marginBottom: 16 }, children: [_jsx("button", { type: "button", disabled: loadingRec, onClick: () => void loadRecommendations(), children: loadingRec ? '更新中…' : '重新掃描' }), recData ? (_jsxs("span", { className: "muted", children: ["\u7B56\u7565\uFF1A", recData.strategyName, " \u00B7 \u8A0A\u865F\u65E5 ", recData.signalDate] })) : null] }), loadingRec && !recData ? _jsx("p", { className: "muted", children: "\u8F09\u5165\u63A8\u85A6\u4E2D\u2026" }) : null, recData?.items.length ? (_jsx("div", { className: "rec-stack", children: recData.items.map((item) => (_jsx(RecommendationCard, { item: item, isFavorite: favoriteIds.has(item.stockId), saving: savingId === item.stockId, onAddFavorite: () => void handleAddFavorite(item.stockId) }, item.stockId))) })) : null, recData ? (_jsx("p", { className: "muted", style: { marginTop: 20, fontSize: 12 }, children: recData.disclaimer })) : null] })) : (_jsxs("section", { className: "rec-section", children: [_jsx("p", { className: "muted", style: { marginBottom: 16 }, children: "\u6700\u611B\u6E05\u55AE\u4FDD\u5B58\u5728\u4F3A\u670D\u5668\uFF08\u4EE5\u672C\u6A5F\u700F\u89BD\u5668 ID \u5340\u5206\uFF09\u3002\u63DB\u96FB\u8166\u6216\u6E05\u9664\u700F\u89BD\u5668\u8CC7\u6599\u6703\u770B\u4E0D\u5230\u540C\u4E00\u6E05\u55AE\u3002" }), loadingFav && favorites.length === 0 ? _jsx("p", { className: "muted", children: "\u8F09\u5165\u6700\u611B\u4E2D\u2026" }) : null, !loadingFav && favorites.length === 0 ? (_jsx("div", { className: "hint-warn", children: "\u5C1A\u7121\u6700\u611B\u6A19\u7684\u3002\u5230\u300C\u4ECA\u65E5\u63A8\u85A6\u300D\u6309 \u2B50 \u52A0\u5165\u3002" })) : (_jsx("div", { className: "rec-stack", children: favorites.map((f) => (_jsx(FavoriteCard, { item: f, onSave: handleUpdateFavorite, onDelete: handleDeleteFavorite }, f.id))) }))] }))] }));
}
