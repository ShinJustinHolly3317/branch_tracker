import type {
  BranchPerformanceResponse,
  BranchPerformanceRow,
  PerformanceMetric
} from '@twbbd/shared'
import type pg from 'pg'
import {
  computeAllBranchPerformanceMetrics,
  DEFAULT_PERF_DAYS,
  DEFAULT_PERF_FORWARD,
  DEFAULT_PERF_MIN_SAMPLE
} from './performance.js'
import { resolvePerformanceCalendar } from './performanceCalendar.js'

export {
  DEFAULT_PERF_DAYS,
  DEFAULT_PERF_FORWARD,
  DEFAULT_PERF_MIN_SAMPLE
}

/** snapshot manifest：同一組參數下三種 metric 的 top 列表 */
export type PerformanceSnapshotManifest = {
  startDate: string
  endDate: string
  tradingDays: number
  forwardTradingDays: number
  minSampleSize: number
  requestedForwardTradingDays: number
  effectiveForwardTradingDays: number
  debugMessage?: string
  metrics: Record<PerformanceMetric, BranchPerformanceRow[]>
}

export type PerformanceSnapshotKey = {
  endDate: string
  days: number
  forwardDays: number
  minSample: number
}

export function isDefaultPerformanceParams(params: PerformanceSnapshotKey): boolean {
  return (
    params.days === DEFAULT_PERF_DAYS &&
    params.forwardDays === DEFAULT_PERF_FORWARD &&
    params.minSample === DEFAULT_PERF_MIN_SAMPLE
  )
}

export async function fetchAllTradingDates(db: pg.Pool): Promise<string[]> {
  const r = await db.query<{ trade_date: string }>(
    'SELECT trade_date::text FROM trading_dates ORDER BY trade_date ASC'
  )
  return r.rows.map((x) => x.trade_date)
}

export async function purgePerformanceSnapshotsExcept(db: pg.Pool, endDate: string): Promise<void> {
  await db.query('DELETE FROM performance_branch_snapshot WHERE end_date <> $1::date', [endDate])
}

export async function upsertPerformanceSnapshot(
  db: pg.Pool,
  key: PerformanceSnapshotKey,
  manifest: PerformanceSnapshotManifest
): Promise<void> {
  await db.query(
    `INSERT INTO performance_branch_snapshot (end_date, days, forward_days, min_sample, manifest)
     VALUES ($1::date, $2, $3, $4, $5::jsonb)
     ON CONFLICT (end_date, days, forward_days, min_sample)
     DO UPDATE SET manifest = EXCLUDED.manifest, updated_at = now()`,
    [key.endDate, key.days, key.forwardDays, key.minSample, JSON.stringify(manifest)]
  )
}

export async function getPerformanceSnapshotManifest(
  db: pg.Pool,
  key: PerformanceSnapshotKey
): Promise<PerformanceSnapshotManifest | null> {
  const r = await db.query<{ manifest: PerformanceSnapshotManifest }>(
    `SELECT manifest
     FROM performance_branch_snapshot
     WHERE end_date = $1::date
       AND days = $2
       AND forward_days = $3
       AND min_sample = $4`,
    [key.endDate, key.days, key.forwardDays, key.minSample]
  )
  const raw = r.rows[0]?.manifest
  if (!raw || typeof raw !== 'object') return null
  const m = raw as PerformanceSnapshotManifest
  if (!m.metrics || typeof m.endDate !== 'string') return null
  return m
}

export function slicePerformanceFromManifest(
  manifest: PerformanceSnapshotManifest,
  metric: PerformanceMetric
): BranchPerformanceResponse {
  const top = manifest.metrics[metric] ?? []
  return {
    startDate: manifest.startDate,
    endDate: manifest.endDate,
    tradingDays: manifest.tradingDays,
    forwardTradingDays: manifest.forwardTradingDays,
    metric,
    minSampleSize: manifest.minSampleSize,
    top,
    reasonCode: 'computed',
    requestedForwardTradingDays: manifest.requestedForwardTradingDays,
    effectiveForwardTradingDays: manifest.effectiveForwardTradingDays,
    fromCache: true,
    ...(top.length === 0 && manifest.debugMessage ? { debugMessage: manifest.debugMessage } : {})
  }
}

export async function getPerformanceFromSnapshot(params: {
  db: pg.Pool
  key: PerformanceSnapshotKey
  metric: PerformanceMetric
}): Promise<BranchPerformanceResponse | null> {
  const manifest = await getPerformanceSnapshotManifest(params.db, params.key)
  if (!manifest) return null
  return slicePerformanceFromManifest(manifest, params.metric)
}

export async function computeAndUpsertDefaultPerformanceSnapshot(params: {
  db: pg.Pool
  allDates: string[]
  endDate: string
  effectiveK: number
  requestedForwardDays?: number
}): Promise<PerformanceSnapshotManifest> {
  const requestedForwardDays = params.requestedForwardDays ?? DEFAULT_PERF_FORWARD
  const computed = await computeAllBranchPerformanceMetrics({
    db: params.db,
    datesAll: params.allDates,
    endDate: params.endDate,
    tradingDays: DEFAULT_PERF_DAYS,
    forwardTradingDays: params.effectiveK,
    minSampleSize: DEFAULT_PERF_MIN_SAMPLE,
    requestedForwardTradingDays: requestedForwardDays
  })

  const manifest: PerformanceSnapshotManifest = {
    startDate: computed.startDate,
    endDate: computed.endDate,
    tradingDays: computed.tradingDays,
    forwardTradingDays: computed.forwardTradingDays,
    minSampleSize: computed.minSampleSize,
    requestedForwardTradingDays: computed.requestedForwardTradingDays,
    effectiveForwardTradingDays: computed.effectiveForwardTradingDays,
    debugMessage: computed.debugMessage,
    metrics: computed.metrics
  }

  await upsertPerformanceSnapshot(params.db, {
    endDate: params.endDate,
    days: DEFAULT_PERF_DAYS,
    forwardDays: params.effectiveK,
    minSample: DEFAULT_PERF_MIN_SAMPLE
  }, manifest)

  return manifest
}

export async function computeDefaultPerformanceSnapshot(params: {
  db: pg.Pool
  allDates?: string[]
}): Promise<{ endDate: string; effectiveK: number } | null> {
  const allDates = params.allDates ?? (await fetchAllTradingDates(params.db))
  const cal = resolvePerformanceCalendar({
    allDates,
    forwardDays: DEFAULT_PERF_FORWARD
  })
  if (!cal.ok) return null

  await purgePerformanceSnapshotsExcept(params.db, cal.endDate)
  await computeAndUpsertDefaultPerformanceSnapshot({
    db: params.db,
    allDates,
    endDate: cal.endDate,
    effectiveK: cal.effectiveK
  })

  return { endDate: cal.endDate, effectiveK: cal.effectiveK }
}
