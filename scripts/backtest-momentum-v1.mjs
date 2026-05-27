#!/usr/bin/env node
/**
 * 溫和動能 × 分點確認 — 回測腳本（validator 用）
 * 讀本機 Postgres，輸出 JSON 供 HTML 報告使用
 */
import pg from 'pg'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { Pool } = pg

const SOURCE_URL = process.env.SOURCE_DB_URL ?? 'postgres://twbbd:twbbd@localhost:5432/twbbd'
const VERSION = process.env.BACKTEST_VERSION ?? '1'
const OUT_FILE = process.env.BACKTEST_OUT ?? `backtest-momentum-v${VERSION}.json`

const PRESETS = {
  '1': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.02,
    momentumMax: 0.15,
    maxSingleDay: 0.045,
    max3DaySum: 0.12,
    minTurnover: 30000,
    minTop1Conc: 0.15,
    minNetRatio: 0
  },
  '2': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.025,
    momentumMax: 0.08,
    maxSingleDay: 0.035,
    max3DaySum: 0.08,
    minTurnover: 80000,
    minTop1Conc: 0.22,
    minNetRatio: 0.05
  },
  '3': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.025,
    momentumMax: 0.07,
    maxSingleDay: 0.03,
    max3DaySum: 0.07,
    minTurnover: 120000,
    minTop1Conc: 0.2,
    minNetRatio: 0.03,
    maxLastDayReturn: 0.02
  }
}

const preset = PRESETS[VERSION] ?? PRESETS['1']
const HOLD_DAYS = Number(process.env.BACKTEST_HOLD_DAYS ?? preset.holdDays)
const MOM_LOOKBACK = Number(process.env.BACKTEST_MOM_DAYS ?? preset.momLookback)
const MOMENTUM_MIN = preset.momentumMin
const MOMENTUM_MAX = preset.momentumMax
const MAX_SINGLE_DAY = preset.maxSingleDay
const MAX_3DAY_SUM = preset.max3DaySum
const MIN_TURNOVER = preset.minTurnover
const MIN_TOP1_CONC = preset.minTop1Conc
const MIN_NET_RATIO = preset.minNetRatio
const MAX_LAST_DAY_RETURN = preset.maxLastDayReturn ?? null

const HOT_POOL = ['0050', '2330', '2317', '2454', '2881', '2303', '2382', '3231', '6669', '3017']

const pool = new Pool({ connectionString: SOURCE_URL, max: 4 })

function branchStats(rows) {
  let buy = 0
  let sell = 0
  let netAbs = 0
  const byBranch = new Map()
  for (const r of rows) {
    buy += r.buyShares
    sell += r.sellShares
    netAbs += Math.abs(r.netShares)
    const cur = byBranch.get(r.branchId) ?? { net: 0, name: r.branchName }
    cur.net += r.netShares
    byBranch.set(r.branchId, cur)
  }
  const net = buy - sell
  const branches = [...byBranch.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  const top1 = branches[0] ? Math.abs(branches[0].net) : 0
  const top1Share = netAbs > 0 ? top1 / netAbs : 0
  return { buy, sell, turnover: buy + sell, net, top1Share }
}

async function main() {
  const datesR = await pool.query(`SELECT trade_date::text AS d FROM trading_dates ORDER BY trade_date`)
  const dates = datesR.rows.map((r) => r.d)

  const catalogR = await pool.query(`SELECT stock_id, stock_name FROM stock_catalog`)
  const names = Object.fromEntries(catalogR.rows.map((r) => [r.stock_id, r.stock_name]))

  const closeR = await pool.query(
    `SELECT trade_date::text AS d, stock_id, close::float8 AS close FROM stock_close ORDER BY stock_id, trade_date`
  )
  const closeByStock = new Map()
  for (const row of closeR.rows) {
    const list = closeByStock.get(row.stock_id) ?? []
    list.push({ d: row.d, close: row.close })
    closeByStock.set(row.stock_id, list)
  }
  for (const list of closeByStock.values()) {
    list.sort((a, b) => a.d.localeCompare(b.d))
  }

  const blobR = await pool.query(
    `SELECT trade_date::text AS d, stock_id, payload FROM daily_stock_blob WHERE market = ANY($1::text[])`,
    [['TWSE', 'TPEX']]
  )
  const blobByKey = new Map()
  for (const row of blobR.rows) {
    blobByKey.set(`${row.d}|${row.stock_id}`, row.payload)
  }

  const stockIds = [...new Set([...closeByStock.keys(), ...blobR.rows.map((r) => r.stock_id)])]
  const dateIdx = new Map(dates.map((d, i) => [d, i]))

  const events = []
  const perStock = new Map()
  const filterStats = { mom: 0, chase: 0, blob: 0, turnover: 0, net: 0, conc: 0, pass: 0 }

  for (const stockId of stockIds) {
    const closes = closeByStock.get(stockId) ?? []
    const closeMap = new Map(closes.map((x) => [x.d, x.close]))
    const stockEvents = []

    for (let i = MOM_LOOKBACK; i < dates.length; i++) {
      const eventDate = dates[i]
      const fwdIdx = i + HOLD_DAYS
      if (fwdIdx >= dates.length) continue

      const c0 = closeMap.get(eventDate)
      const cStart = closeMap.get(dates[i - MOM_LOOKBACK])
      const cFwd = closeMap.get(dates[fwdIdx])
      if (!c0 || !cStart || !cFwd || cStart <= 0) continue

      const mom = (c0 - cStart) / cStart
      if (mom < MOMENTUM_MIN || mom > MOMENTUM_MAX) continue
      filterStats.mom++

      const cPrev1 = closeMap.get(dates[i - 1])
      const cPrev2 = closeMap.get(dates[i - 2])
      const cPrev3 = closeMap.get(dates[i - 3])
      if (!cPrev1 || !cPrev2 || !cPrev3 || cPrev1 <= 0 || cPrev2 <= 0 || cPrev3 <= 0) continue

      const r1 = (c0 - cPrev1) / cPrev1
      const r2 = (cPrev1 - cPrev2) / cPrev2
      const r3 = (cPrev2 - cPrev3) / cPrev3
      if (Math.max(r1, r2, r3) > MAX_SINGLE_DAY) continue
      if (r1 + r2 + r3 > MAX_3DAY_SUM) continue
      if (MAX_LAST_DAY_RETURN != null && r1 > MAX_LAST_DAY_RETURN) continue
      filterStats.chase++

      const payload = blobByKey.get(`${eventDate}|${stockId}`)
      if (!payload || !Array.isArray(payload)) continue
      filterStats.blob++
      const stats = branchStats(payload)
      if (stats.turnover < MIN_TURNOVER) continue
      filterStats.turnover++
      if (stats.net <= 0) continue
      if (MIN_NET_RATIO > 0 && stats.net / stats.turnover < MIN_NET_RATIO) continue
      filterStats.net++
      if (stats.top1Share < MIN_TOP1_CONC) continue
      filterStats.conc++
      filterStats.pass++

      const ret = (cFwd - c0) / c0
      const ev = {
        stockId,
        stockName: names[stockId] ?? stockId,
        eventDate,
        forwardDate: dates[fwdIdx],
        holdDays: HOLD_DAYS,
        entryClose: c0,
        exitClose: cFwd,
        forwardReturn: ret,
        win: ret > 0,
        mom,
        turnover: stats.turnover,
        top1Share: stats.top1Share
      }
      events.push(ev)
      stockEvents.push(ev)
    }

    if (stockEvents.length) {
      const wins = stockEvents.filter((e) => e.win).length
      perStock.set(stockId, {
        stockId,
        stockName: names[stockId] ?? stockId,
        samples: stockEvents.length,
        winRate: wins / stockEvents.length,
        avgReturn: stockEvents.reduce((a, e) => a + e.forwardReturn, 0) / stockEvents.length,
        events: stockEvents
      })
    }
  }

  const overallWin = events.length ? events.filter((e) => e.win).length / events.length : 0
  const overallAvg = events.length ? events.reduce((a, e) => a + e.forwardReturn, 0) / events.length : 0

  const hotResults = HOT_POOL.map((id) => {
    const s = perStock.get(id)
    return s
      ? { stockId: id, stockName: s.stockName, samples: s.samples, winRate: s.winRate, avgReturn: s.avgReturn, hasData: true }
      : { stockId: id, stockName: names[id] ?? id, samples: 0, winRate: null, avgReturn: null, hasData: false }
  })

  const passHot = hotResults.filter((h) => h.hasData && h.samples > 0)
  const hotWinOk = passHot.length ? passHot.filter((h) => h.winRate >= 0.55).length / passHot.length : 0

  let verdict = '❌ 不通過'
  if (events.length >= 5 && overallWin >= 0.55 && overallAvg > 0 && hotWinOk >= 0.6) verdict = '✅ 通過'
  else if (events.length >= 3 && overallWin >= 0.5 && overallAvg > 0) verdict = '🟡 部分通過'
  else if (dates.length < 60 && events.length >= 10 && overallAvg > 0) {
    verdict = '🟡 部分通過（資料區間不足，邏輯待長期驗證）'
  } else if (dates.length < 60 && events.length >= 5 && overallAvg > 0) {
    verdict = '🟡 部分通過（樣本偏少，僅供參考）'
  }

  const report = {
    strategy: '溫和動能 × 分點確認',
    generatedAt: new Date().toISOString(),
    dataRange: { start: dates[0], end: dates[dates.length - 1], tradingDays: dates.length },
    params: {
      holdDays: HOLD_DAYS,
      momLookback: MOM_LOOKBACK,
      momentumRange: [MOMENTUM_MIN, MOMENTUM_MAX],
      antiChase: { maxSingleDay: MAX_SINGLE_DAY, max3DaySum: MAX_3DAY_SUM },
      minTurnover: MIN_TURNOVER,
      minTop1Conc: MIN_TOP1_CONC,
      minNetRatio: MIN_NET_RATIO,
      maxLastDayReturn: MAX_LAST_DAY_RETURN,
      liveHoldTargetDays: '15–20（實盤建議；回測因資料長度縮短）'
    },
    filterStats,
    limitation:
      '資料庫僅含約 10 個交易日，無法做 1 年以上回測；以下為可用區間內的樣本外推參考，非正式長期驗證。',
    overall: {
      samples: events.length,
      winRate: overallWin,
      avgReturn: overallAvg
    },
    hotPool: hotResults,
    perStock: [...perStock.values()]
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 20),
    events: events.slice(0, 100),
    verdict
  }

  const outPath = join(ROOT, 'docs', OUT_FILE)
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outPath, verdict, samples: events.length, winRate: overallWin }, null, 2))
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
