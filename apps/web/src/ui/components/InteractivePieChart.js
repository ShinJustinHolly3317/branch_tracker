import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
const DEFAULT_COLORS = [
    '#0f9b8e',
    '#14b8a6',
    '#2dd4bf',
    '#5eead4',
    '#99f6e4',
    '#0d8177',
    '#0f5952',
    '#134e4a',
    '#5ebfb5',
    '#d5f5f0'
];
function renderActiveShape(props) {
    const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } = props;
    return (_jsx(Sector, { cx: cx, cy: cy, innerRadius: innerRadius, outerRadius: Number(outerRadius) + 6, startAngle: startAngle, endAngle: endAngle, fill: fill, stroke: "var(--color-bg-card)", strokeWidth: 2, style: { cursor: 'pointer' } }));
}
function PieHoverTooltip({ active, payload, total, onNavigate }) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0]?.payload;
    if (!row)
        return null;
    const value = Number(payload[0]?.value ?? row.value);
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
    return (_jsxs("div", { className: "pie-hover-tooltip", role: "tooltip", children: [_jsx("div", { className: "pie-hover-tooltip__icon", "aria-hidden": true, children: "\u2197" }), _jsxs("div", { className: "pie-hover-tooltip__body", children: [_jsx("div", { className: "pie-hover-tooltip__label", children: row.label }), _jsxs("div", { className: "pie-hover-tooltip__meta", children: ["\u6DE8\u984D ", value.toLocaleString(), " \u00B7 ", pct, "%"] }), _jsx("button", { type: "button", className: "pie-hover-chip", onClick: (e) => {
                            e.stopPropagation();
                            onNavigate(row.navigateTo);
                        }, children: row.actionLabel })] })] }));
}
export function InteractivePieChart({ segments, colors = DEFAULT_COLORS, loading, emptyMessage }) {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(undefined);
    const chartData = useMemo(() => segments.map((s) => ({
        ...s,
        name: s.label
    })), [segments]);
    const total = useMemo(() => chartData.reduce((sum, s) => sum + s.value, 0), [chartData]);
    function goToSegment(row) {
        navigate(row.navigateTo);
    }
    if (loading) {
        return _jsx("div", { className: "chart-empty", children: "\u8F09\u5165\u4E2D\u2026" });
    }
    if (chartData.length === 0) {
        return (_jsx("div", { className: "chart-empty", children: emptyMessage ?? '尚無可視覺化的資料。' }));
    }
    return (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { dataKey: "value", data: chartData, nameKey: "name", outerRadius: 130, paddingAngle: 1, activeIndex: activeIndex, activeShape: renderActiveShape, style: { cursor: 'pointer' }, onMouseEnter: (_, index) => setActiveIndex(index), onMouseLeave: () => setActiveIndex(undefined), onClick: (_, index) => {
                        const row = chartData[index];
                        if (row)
                            goToSegment(row);
                    }, children: chartData.map((s, i) => (_jsx(Cell, { fill: colors[i % colors.length], stroke: "var(--color-bg-card)", opacity: activeIndex === undefined || activeIndex === i ? 1 : 0.72 }, s.id))) }), _jsx(Tooltip, { content: _jsx(PieHoverTooltip, { total: total, onNavigate: (to) => navigate(to) }), wrapperStyle: { zIndex: 20, pointerEvents: 'auto' } })] }) }));
}
