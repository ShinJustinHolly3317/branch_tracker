import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type pg from 'pg'
import {
  getPerformanceFromSnapshot,
  slicePerformanceFromManifest,
  type PerformanceSnapshotManifest
} from './performanceSnapshot.js'

function makeMockDb(rows: { manifest: PerformanceSnapshotManifest }[]): pg.Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes('performance_branch_snapshot')) {
        return { rows }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

describe('performanceSnapshot', () => {
  const manifest: PerformanceSnapshotManifest = {
    startDate: '2026-01-02',
    endDate: '2026-01-20',
    tradingDays: 20,
    forwardTradingDays: 10,
    minSampleSize: 10,
    requestedForwardTradingDays: 10,
    effectiveForwardTradingDays: 10,
    metrics: {
      avgForwardReturn: [
        { branchId: 'a', branchName: 'A', sampleSize: 12, value: 0.05 }
      ],
      hitRate: [{ branchId: 'b', branchName: 'B', sampleSize: 11, value: 0.6 }],
      weightedPnlProxy: [{ branchId: 'c', branchName: 'C', sampleSize: 15, value: 1000 }]
    }
  }

  it('slicePerformanceFromManifest returns metric slice', () => {
    const resp = slicePerformanceFromManifest(manifest, 'hitRate')
    assert.equal(resp.metric, 'hitRate')
    assert.equal(resp.top.length, 1)
    assert.equal(resp.top[0]!.branchId, 'b')
    assert.equal(resp.fromCache, true)
  })

  it('getPerformanceFromSnapshot returns null on miss', async () => {
    const db = makeMockDb([])
    const hit = await getPerformanceFromSnapshot({
      db,
      key: { endDate: '2026-01-20', days: 20, forwardDays: 10, minSample: 10 },
      metric: 'avgForwardReturn'
    })
    assert.equal(hit, null)
  })

  it('getPerformanceFromSnapshot returns cached row', async () => {
    const db = makeMockDb([{ manifest }])
    const hit = await getPerformanceFromSnapshot({
      db,
      key: { endDate: '2026-01-20', days: 20, forwardDays: 10, minSample: 10 },
      metric: 'weightedPnlProxy'
    })
    assert.ok(hit)
    assert.equal(hit!.top[0]!.branchId, 'c')
    assert.equal(hit!.fromCache, true)
  })
})
