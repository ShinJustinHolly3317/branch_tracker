import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type pg from 'pg'
import type { TradeByBranchDaily } from '@twbbd/shared'
import { computeBranchPerformance } from './performance.js'

type QueryCall = { sql: string; params?: unknown[] }

function makePayload(rows: TradeByBranchDaily[]): unknown {
  return rows
}

function makeMockDb(handlers: {
  closes: { trade_date: string; stock_id: string; close: string }[]
  blobs: { trade_date: string; stock_id: string; payload: unknown }[]
}): { db: pg.Pool; calls: QueryCall[] } {
  const calls: QueryCall[] = []
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      if (sql.includes('FROM stock_close')) {
        return { rows: handlers.closes }
      }
      if (sql.includes('FROM daily_stock_blob')) {
        return { rows: handlers.blobs }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
  return { db, calls }
}

describe('computeBranchPerformance', () => {
  const datesAll = ['2026-01-02', '2026-01-03', '2026-01-06', '2026-01-07', '2026-01-08']

  it('uses batched queries (not per-stock N+1)', async () => {
    const { db, calls } = makeMockDb({ closes: [], blobs: [] })
    await computeBranchPerformance({
      db,
      datesAll,
      endDate: '2026-01-07',
      tradingDays: 3,
      forwardTradingDays: 1,
      metric: 'avgForwardReturn',
      minSampleSize: 1,
      requestedForwardTradingDays: 1
    })
    assert.equal(calls.length, 2)
    assert.match(calls[0]!.sql, /stock_close/)
    assert.match(calls[1]!.sql, /daily_stock_blob/)
  })

  it('computes avgForwardReturn and ranks branches', async () => {
    const branchA = '9800-001'
    const branchB = '9200-013'
    const eventDate = '2026-01-06'
    const forwardDate = '2026-01-07'

    const payload2330: TradeByBranchDaily[] = [
      {
        date: eventDate,
        market: 'TWSE',
        stockId: '2330',
        branchId: branchA,
        branchName: '元大-台北',
        buyShares: 100,
        sellShares: 0,
        netShares: 100
      },
      {
        date: eventDate,
        market: 'TWSE',
        stockId: '2330',
        branchId: branchB,
        branchName: '凱基-台南',
        buyShares: 50,
        sellShares: 0,
        netShares: 50
      }
    ]

    const { db } = makeMockDb({
      closes: [
        { trade_date: eventDate, stock_id: '2330', close: '100' },
        { trade_date: forwardDate, stock_id: '2330', close: '110' }
      ],
      blobs: [{ trade_date: eventDate, stock_id: '2330', payload: makePayload(payload2330) }]
    })

    const resp = await computeBranchPerformance({
      db,
      datesAll,
      endDate: forwardDate,
      tradingDays: 2,
      forwardTradingDays: 1,
      metric: 'avgForwardReturn',
      minSampleSize: 1,
      requestedForwardTradingDays: 1
    })

    assert.equal(resp.top.length, 2)
    const ids = resp.top.map((r) => r.branchId).sort()
    assert.deepEqual(ids, [branchA, branchB].sort())
    assert.ok(resp.top.every((r) => Math.abs(r.value - 0.1) < 1e-9))
    assert.ok(resp.top.every((r) => r.sampleSize === 1))
  })

  it('filters branches below minSampleSize', async () => {
    const eventDate = '2026-01-06'
    const forwardDate = '2026-01-07'
    const payload: TradeByBranchDaily[] = [
      {
        date: eventDate,
        market: 'TWSE',
        stockId: '2330',
        branchId: 'only-one',
        branchName: '單一',
        buyShares: 1,
        sellShares: 0,
        netShares: 1
      }
    ]

    const { db } = makeMockDb({
      closes: [
        { trade_date: eventDate, stock_id: '2330', close: '100' },
        { trade_date: forwardDate, stock_id: '2330', close: '105' }
      ],
      blobs: [{ trade_date: eventDate, stock_id: '2330', payload: makePayload(payload) }]
    })

    const resp = await computeBranchPerformance({
      db,
      datesAll,
      endDate: forwardDate,
      tradingDays: 1,
      forwardTradingDays: 1,
      metric: 'hitRate',
      minSampleSize: 5,
      requestedForwardTradingDays: 1
    })

    assert.equal(resp.top.length, 0)
    assert.ok(resp.debugMessage)
  })

  it('skips netShares <= 0', async () => {
    const eventDate = '2026-01-06'
    const forwardDate = '2026-01-07'
    const payload: TradeByBranchDaily[] = [
      {
        date: eventDate,
        market: 'TWSE',
        stockId: '2330',
        branchId: 'sell-only',
        branchName: '賣',
        buyShares: 0,
        sellShares: 10,
        netShares: -5
      }
    ]

    const { db } = makeMockDb({
      closes: [
        { trade_date: eventDate, stock_id: '2330', close: '100' },
        { trade_date: forwardDate, stock_id: '2330', close: '110' }
      ],
      blobs: [{ trade_date: eventDate, stock_id: '2330', payload: makePayload(payload) }]
    })

    const resp = await computeBranchPerformance({
      db,
      datesAll,
      endDate: forwardDate,
      tradingDays: 1,
      forwardTradingDays: 1,
      metric: 'avgForwardReturn',
      minSampleSize: 1,
      requestedForwardTradingDays: 1
    })

    assert.equal(resp.top.length, 0)
  })
})
