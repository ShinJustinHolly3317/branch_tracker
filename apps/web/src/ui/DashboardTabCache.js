import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useRef, useState } from 'react';
const defaultStock = {
    query: '2330',
    selected: null,
    days: 20,
    data: null,
    hint: null
};
const defaultBranch = {
    query: '',
    selected: null,
    days: 20,
    data: null,
    hint: null
};
const defaultPerf = {
    days: 20,
    forwardDays: 10,
    minSample: 10,
    metric: 'avgForwardReturn',
    data: null,
    hint: null
};
const DashboardTabCacheContext = createContext(undefined);
export function DashboardTabCacheProvider({ children }) {
    const [stockTab, setStockTab] = useState(defaultStock);
    const [branchTab, setBranchTab] = useState(defaultBranch);
    const [performanceTab, setPerformanceTab] = useState(defaultPerf);
    const stockDefaultBootstrapFired = useRef(false);
    const bootstrapRefs = useMemo(() => ({ stockDefaultBootstrapFired }), []);
    const value = useMemo(() => ({
        stockTab,
        setStockTab,
        branchTab,
        setBranchTab,
        performanceTab,
        setPerformanceTab,
        bootstrapRefs
    }), [stockTab, branchTab, performanceTab, bootstrapRefs]);
    return _jsx(DashboardTabCacheContext.Provider, { value: value, children: children });
}
export function useDashboardTabCache() {
    const ctx = useContext(DashboardTabCacheContext);
    if (!ctx) {
        throw new Error('useDashboardTabCache must be used within DashboardTabCacheProvider');
    }
    return ctx;
}
