import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeBranchBlobPayloads } from './dailyBranchBlob.js'

describe('mergeBranchBlobPayloads', () => {
  it('merges stock rows across multiple dates', () => {
    const merged = mergeBranchBlobPayloads([
      {
        payload: [{ stockId: '2330', buyShares: 10, sellShares: 0, netShares: 10 }]
      },
      {
        payload: [{ stockId: '2330', buyShares: 5, sellShares: 2, netShares: 3 }]
      }
    ])
    const row = merged.get('2330')
    assert.ok(row)
    assert.equal(row!.buyShares, 15)
    assert.equal(row!.sellShares, 2)
    assert.equal(row!.netShares, 13)
  })
})
