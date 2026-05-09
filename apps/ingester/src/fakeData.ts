import type { Market, TradeByBranchDaily } from '@twbbd/shared'

const STOCKS = ['2330', '2317', '2454', '2603', '2618', '2882', '3037']

type Branch = { branchId: string; branchName: string }
const BRANCHES: Branch[] = [
  { branchId: '9800-001', branchName: '元大-台北' },
  { branchId: '9200-013', branchName: '凱基-台南' },
  { branchId: '5850-002', branchName: '統一-嘉義' },
  { branchId: '8450-007', branchName: '富邦-建國' },
  { branchId: '8880-001', branchName: '國泰-台中' },
  { branchId: '7000-009', branchName: '兆豐-忠孝' }
]

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getFakeStocks() {
  return STOCKS
}

export function generateFakeDaily(params: {
  date: string
  market: Market
  stockId: string
}): TradeByBranchDaily[] {
  const { date, market, stockId } = params
  const seed = Number(stockId) + Number(date.replaceAll('-', '')) + (market === 'TWSE' ? 1 : 2)
  const rnd = mulberry32(seed)

  const branchCount = 3 + Math.floor(rnd() * 4) // 3-6
  const selected = [...BRANCHES].sort(() => rnd() - 0.5).slice(0, branchCount)

  return selected.map((b) => {
    const buy = Math.floor(rnd() * 2000)
    const sell = Math.floor(rnd() * 2000)
    return {
      date,
      market,
      stockId,
      branchId: b.branchId,
      branchName: b.branchName,
      buyShares: buy,
      sellShares: sell,
      netShares: buy - sell
    }
  })
}

export function generateFakeClosePrice(params: { date: string; stockId: string }): number {
  const { date, stockId } = params
  const seed = Number(stockId) * 17 + Number(date.replaceAll('-', ''))
  const rnd = mulberry32(seed)
  const base = 50 + (Number(stockId) % 2000) / 20
  const noise = (rnd() - 0.5) * 5
  return Math.round((base + noise) * 100) / 100
}

