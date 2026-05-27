import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction
} from 'react'
import type {
  BranchPerformanceResponse,
  BranchSuggestion,
  ByBranchWindowResponse,
  ByStockWindowResponse,
  PerformanceMetric,
  StockSuggestion
} from '@twbbd/shared'

/** Stock 頁：搜尋條件與上次 API 結果（切換分頁不丟） */
export type StockTabSnapshot = {
  query: string
  selected: StockSuggestion | null
  days: number
  data: ByStockWindowResponse | null
  hint: string | null
}

/** Branch 頁 */
export type BranchTabSnapshot = {
  query: string
  selected: BranchSuggestion | null
  days: number
  data: ByBranchWindowResponse | null
  hint: string | null
}

/** Performance 頁 */
export type PerfTabSnapshot = {
  days: number
  forwardDays: number
  minSample: number
  metric: PerformanceMetric
  data: BranchPerformanceResponse | null
  hint: string | null
}

const defaultStock: StockTabSnapshot = {
  query: '2330',
  selected: null,
  days: 20,
  data: null,
  hint: null
}

const defaultBranch: BranchTabSnapshot = {
  query: '',
  selected: null,
  days: 20,
  data: null,
  hint: null
}

const defaultPerf: PerfTabSnapshot = {
  days: 20,
  forwardDays: 10,
  minSample: 10,
  metric: 'avgForwardReturn',
  data: null,
  hint: null
}

export type DashboardTabBootstrapRefs = {
  /** Stock：已觸發過「首屏自動查詢（預設 2330）」；避免離開後再進又打一次預設 */
  stockDefaultBootstrapFired: MutableRefObject<boolean>
  /** Performance：首屏自動計算排行 */
  perfDefaultBootstrapFired: MutableRefObject<boolean>
}

type DashboardTabCacheValue = {
  stockTab: StockTabSnapshot
  setStockTab: Dispatch<SetStateAction<StockTabSnapshot>>
  branchTab: BranchTabSnapshot
  setBranchTab: Dispatch<SetStateAction<BranchTabSnapshot>>
  performanceTab: PerfTabSnapshot
  setPerformanceTab: Dispatch<SetStateAction<PerfTabSnapshot>>
  bootstrapRefs: DashboardTabBootstrapRefs
}

const DashboardTabCacheContext = createContext<DashboardTabCacheValue | undefined>(undefined)

export function DashboardTabCacheProvider({ children }: { children: ReactNode }) {
  const [stockTab, setStockTab] = useState<StockTabSnapshot>(defaultStock)
  const [branchTab, setBranchTab] = useState<BranchTabSnapshot>(defaultBranch)
  const [performanceTab, setPerformanceTab] = useState<PerfTabSnapshot>(defaultPerf)

  const stockDefaultBootstrapFired = useRef(false)
  const perfDefaultBootstrapFired = useRef(false)

  const bootstrapRefs: DashboardTabBootstrapRefs = useMemo(
    () => ({ stockDefaultBootstrapFired, perfDefaultBootstrapFired }),
    []
  )

  const value = useMemo(
    (): DashboardTabCacheValue => ({
      stockTab,
      setStockTab,
      branchTab,
      setBranchTab,
      performanceTab,
      setPerformanceTab,
      bootstrapRefs
    }),
    [stockTab, branchTab, performanceTab, bootstrapRefs]
  )

  return <DashboardTabCacheContext.Provider value={value}>{children}</DashboardTabCacheContext.Provider>
}

export function useDashboardTabCache(): DashboardTabCacheValue {
  const ctx = useContext(DashboardTabCacheContext)
  if (!ctx) {
    throw new Error('useDashboardTabCache must be used within DashboardTabCacheProvider')
  }
  return ctx
}
