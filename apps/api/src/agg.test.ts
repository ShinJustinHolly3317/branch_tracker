import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type pg from 'pg'
import { aggregateByBranch } from './agg.js'

function makeMockDb(handlers: {
  branchBlob: { payload: unknown }[]
  stockBlob?: { stock_id: string; payload: unknown }[]
  stockBlobCount?: number
}): pg.Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes('daily_branch_blob')) {
        return { rows: handlers.branchBlob }
      }
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ n: String(handlers.stockBlobCount ?? 0) }] }
      }
      if (sql.includes('daily_stock_blob') && sql.includes('SELECT stock_id')) {
        return { rows: handlers.stockBlob ?? [] }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

describe('aggregateByBranch', () => {
  it('reads from daily_branch_blob when present', async () => {
    const db = makeMockDb({
      branchBlob: [
        {
          payload: [
            { stockId: '2330', buyShares: 100, sellShares: 10, netShares: 90 },
            { stockId: '2317', buyShares: 20, sellShares: 0, netShares: 20 }
          ]
        }
      ]
    })

    const resp = await aggregateByBranch({
      db,
      branchId: '9800-001',
      dates: ['2026-01-10']
    })

    assert.equal(resp.stocks.length, 2)
    assert.equal(resp.stocks[0]!.stockId, '2330')
    assert.equal(resp.stocks[0]!.netShares, 90)
  })

  it('falls back to daily_stock_blob scan when branch blob empty', async () => {
    const db = makeMockDb({
      branchBlob: [],
      stockBlobCount: 1,
      stockBlob: [
        {
          stock_id: '2330',
          payload: [
            {
              date: '2026-01-10',
              market: 'TWSE',
              stockId: '2330',
              branchId: '9800-001',
              branchName: '元大',
              buyShares: 50,
              sellShares: 0,
              netShares: 50
            },
            {
              date: '2026-01-10',
              market: 'TWSE',
              stockId: '2330',
              branchId: 'other',
              branchName: '其他',
              buyShares: 1,
              sellShares: 0,
              netShares: 1
            }
          ]
        }
      ]
    })

    const resp = await aggregateByBranch({
      db,
      branchId: '9800-001',
      dates: ['2026-01-10']
    })

    assert.equal(resp.stocks.length, 1)
    assert.equal(resp.stocks[0]!.netShares, 50)
  })
})
