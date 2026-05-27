import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function fmtPrice(n) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtSignedAmount(n) {
    const sign = n > 0 ? '+' : n < 0 ? '' : '';
    return `${sign}${fmtPrice(n)}`;
}
function fmtSignedPercent(n) {
    const sign = n > 0 ? '+' : n < 0 ? '' : '';
    return `${sign}${(n * 100).toFixed(2)}%`;
}
/** 個股區間漲跌摘要：起漲價、目前價、漲跌金額與 % */
export function StockPriceSummary({ stockId, stockName, priceWindow }) {
    const { startDate, endDate, startClose, endClose, changeAmount, changePercent } = priceWindow;
    const up = changeAmount > 0;
    const down = changeAmount < 0;
    const toneClass = up ? 'stock-price-summary--up' : down ? 'stock-price-summary--down' : '';
    return (_jsxs("div", { className: `stock-price-summary ${toneClass}`, children: [_jsxs("div", { className: "stock-price-summary__title", children: ["\u500B\u80A1\u5340\u9593\u6F32\u8DCC", _jsxs("span", { className: "stock-price-summary__stock", children: [_jsx("span", { className: "mono", children: stockId }), stockName ? ` ${stockName}` : ''] })] }), _jsxs("div", { className: "stock-price-summary__grid", children: [_jsxs("div", { className: "stock-price-summary__item", children: [_jsx("span", { className: "stock-price-summary__label", children: "\u8D77\u6F32\u50F9\u683C" }), _jsx("span", { className: "stock-price-summary__value", children: fmtPrice(startClose) }), _jsx("span", { className: "stock-price-summary__sub muted", children: startDate })] }), _jsxs("div", { className: "stock-price-summary__item", children: [_jsx("span", { className: "stock-price-summary__label", children: "\u76EE\u524D\u50F9\u683C" }), _jsx("span", { className: "stock-price-summary__value", children: fmtPrice(endClose) }), _jsx("span", { className: "stock-price-summary__sub muted", children: endDate })] }), _jsxs("div", { className: "stock-price-summary__item", children: [_jsx("span", { className: "stock-price-summary__label", children: "\u6F32\u8DCC\u91D1\u984D" }), _jsx("span", { className: "stock-price-summary__value stock-price-summary__change", children: fmtSignedAmount(changeAmount) })] }), _jsxs("div", { className: "stock-price-summary__item", children: [_jsx("span", { className: "stock-price-summary__label", children: "\u6F32\u8DCC\u5E45" }), _jsx("span", { className: "stock-price-summary__value stock-price-summary__change", children: fmtSignedPercent(changePercent) })] })] })] }));
}
