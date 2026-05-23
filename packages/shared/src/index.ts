export type Market = 'TWSE' | 'TPEX'

export type TradeByBranchDaily = {
  date: string // YYYY-MM-DD
  market: Market
  stockId: string
  branchId: string // brokerId + branchCode (provider-specific but stable)
  branchName: string
  buyShares: number
  sellShares: number
  netShares: number
}

export type ByStockWindowRequest = {
  stockId: string
  tradingDays: number
  endDate?: string // YYYY-MM-DD, default: latest ingested date
}

export type BranchAgg = {
  branchId: string
  branchName: string
  buyShares: number
  sellShares: number
  netShares: number
  shareOfNetAbs: number
}

export type ByStockWindowResponse = {
  stockId: string
  startDate: string
  endDate: string
  tradingDays: number
  branches: BranchAgg[]
  concentration: {
    top1Share: number
    top3Share: number
    hhi: number
  }
}

export type ByBranchWindowRequest = {
  branchId: string
  tradingDays: number
  endDate?: string
}

export type StockAgg = {
  stockId: string
  stockName?: string
  buyShares: number
  sellShares: number
  netShares: number
  shareOfNetAbs: number
}

export type ByBranchWindowResponse = {
  branchId: string
  startDate: string
  endDate: string
  tradingDays: number
  stocks: StockAgg[]
}

export type PerformanceMetric = 'avgForwardReturn' | 'hitRate' | 'weightedPnlProxy'

export type BranchPerformanceRequest = {
  tradingDays: number
  forwardTradingDays: number
  metric: PerformanceMetric
  minSampleSize: number
  endDate?: string
}

export type BranchPerformanceRow = {
  branchId: string
  branchName: string
  sampleSize: number
  value: number
}

export type BranchPerformanceResponse = {
  startDate: string
  endDate: string
  tradingDays: number
  forwardTradingDays: number
  metric: PerformanceMetric
  minSampleSize: number
  top: BranchPerformanceRow[]
  /**
   * 診斷用：當 `top` 為空時協助判斷資料是否不足，或 K 被自動下修。
   * - `missing_trading_dates`：`trading_dates` 沒資料
   * - `insufficient_forward_calendar`：交易日曆長度不足以支援 requested K（自動下修後仍可能不足）
   * - `computed`：已成功選定 endDate 並完成計算（`top` 仍可能因樣本門檻為空）
   */
  reasonCode?: 'missing_trading_dates' | 'insufficient_forward_calendar' | 'computed'
  /** 使用者原始輸入的前瞻 K（交易日） */
  requestedForwardTradingDays?: number
  /** 實際計算採用的前瞻 K（交易日）。若資料不足，可能小於請求值。 */
  effectiveForwardTradingDays?: number
  /** human readable（繁中）給前端顯示；未來可加 i18n */
  debugMessage?: string
}

export type LatestStatusResponse = {
  latestDate?: string
  provider?: string
  markets?: Market[]
}

export type StockSuggestion = {
  stockId: string
  stockName: string
}

export type StockSuggestResponse = {
  suggestions: StockSuggestion[]
}

/** 券商代號對應顯示名稱（供分點名稱搜尋） */
export type BranchSuggestion = {
  branchId: string
  branchName: string
}

export type BranchSuggestResponse = {
  suggestions: BranchSuggestion[]
}

export const StorageKeys = {
  dates: 'twbbd:dates', // redis list, oldest -> newest
  latestStatus: 'twbbd:status:latest', // json
  /** Redis HASH: branchId -> branchName（爬蟲時合併更新） */
  branchCatalog: 'twbbd:branchCatalog',
  /** 全市場股票代號對中文名稱（供搜尋與顯示用） */
  stockCatalog: 'twbbd:stockCatalog', // json array
  daily: (date: string, market: string, stockId: string) =>
    `twbbd:daily:${date}:${market}:${stockId}`,
  dailyStockSet: (date: string, market: string) => `twbbd:dailyStocks:${date}:${market}`, // redis set
  aggByStock: (stockId: string, endDate: string, days: number) =>
    `twbbd:agg:stock:${stockId}:${endDate}:${days}`,
  aggByBranch: (branchId: string, endDate: string, days: number) =>
    `twbbd:agg:branch:${branchId}:${endDate}:${days}`,
  perf: (endDate: string, days: number, fwdDays: number, metric: string, minSample: number) =>
    `twbbd:perf:${endDate}:${days}:${fwdDays}:${metric}:${minSample}`,
  priceClose: (date: string, stockId: string) => `twbbd:priceClose:${date}:${stockId}`
} as const

