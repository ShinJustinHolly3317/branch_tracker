import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Route, Routes } from 'react-router-dom';
import { DashboardTabCacheProvider } from './DashboardTabCache';
import { HomePage } from './HomePage';
import { StockPage } from './pages/StockPage';
import { BranchPage } from './pages/BranchPage';
import { PerformancePage } from './pages/PerformancePage';
import { StatusBar } from './components/StatusBar';
export function App() {
    return (_jsx(DashboardTabCacheProvider, { children: _jsxs("div", { className: "container", children: [_jsxs("header", { className: "app-header", children: [_jsx("h1", { className: "app-title", children: "TW Broker-Branch Dashboard" }), _jsx("p", { className: "app-subtitle", children: "EOD data, arbitrary trading-day windows, and quick concentration views." })] }), _jsx(StatusBar, {}), _jsxs("nav", { className: "nav", children: [_jsx(NavLink, { to: "/", end: true, children: "Performance" }), _jsx(NavLink, { to: "/stock", children: "Stock" }), _jsx(NavLink, { to: "/branch", children: "Branch" })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/stock", element: _jsx(StockPage, {}) }), _jsx(Route, { path: "/branch", element: _jsx(BranchPage, {}) }), _jsx(Route, { path: "/performance", element: _jsx(PerformancePage, {}) })] })] }) }));
}
