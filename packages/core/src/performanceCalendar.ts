/** 績效 API 與預設 snapshot 共用的交易日曆解析 */

export type PerformanceCalendarError = {
  ok: false
  reasonCode: 'missing_trading_dates' | 'insufficient_forward_calendar'
  startDate: string
  endDate: string
  effectiveK: number
  debugMessage: string
}

export type PerformanceCalendarOk = {
  ok: true
  endDate: string
  effectiveK: number
  endIdx: number
}

export type PerformanceCalendarResult = PerformanceCalendarError | PerformanceCalendarOk

export function resolvePerformanceCalendar(params: {
  allDates: string[]
  forwardDays: number
}): PerformanceCalendarResult {
  const { allDates, forwardDays } = params

  if (allDates.length === 0) {
    return {
      ok: false,
      reasonCode: 'missing_trading_dates',
      startDate: '—',
      endDate: '—',
      effectiveK: forwardDays,
      debugMessage: 'trading_dates 沒有任何資料；請先跑 ingester 寫入交易日曆。'
    }
  }

  if (allDates.length < 2) {
    return {
      ok: false,
      reasonCode: 'insufficient_forward_calendar',
      startDate: allDates[0] ?? '—',
      endDate: allDates[0] ?? '—',
      effectiveK: forwardDays,
      debugMessage:
        'Performance 需要至少 2 個交易日（trading_dates）才能計算前瞻報酬；目前只有 1 天。'
    }
  }

  const maxFeasibleK = Math.max(0, allDates.length - 1)
  const effectiveK = Math.min(forwardDays, maxFeasibleK)
  const endIdx = allDates.length - 1 - effectiveK

  if (endIdx < 0) {
    return {
      ok: false,
      reasonCode: 'insufficient_forward_calendar',
      startDate: '—',
      endDate: '—',
      effectiveK,
      debugMessage: '交易日曆不足以支援前瞻 K（即便自動下修仍失敗）。'
    }
  }

  return {
    ok: true,
    endDate: allDates[endIdx]!,
    effectiveK,
    endIdx
  }
}
