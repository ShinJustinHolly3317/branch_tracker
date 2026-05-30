#!/usr/bin/env node
/**
 * 相對強勢 × 量能蓄勢 — 回測（validator）
 * 對標 Yahoo 台股題材：強於大盤 ETF、量能溫和放大、不追三根大紅棒
 */
import pg from 'pg'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { Pool } = pg

const SOURCE_URL = process.env.SOURCE_DB_URL ?? 'postgres://twbbd:twbbd@localhost:5432/twbbd'
const VERSION = process.env.BACKTEST_VERSION ?? '1'
const OUT_FILE = process.env.BACKTEST_OUT ?? `backtest-relative-strength-v${VERSION}.json`
const BENCHMARK = '0050'

const PRESETS = {
  '1': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.02,
    momentumMax: 0.08,
    minRsVsBench: 0.015,
    maxSingleDay: 0.035,
    max3DaySum: 0.08,
    maxLastDay: 0.025,
    minTurnover: 100_000,
    volBuildRatio: 1.05,
    requireNetBuy: true
  },
  '2': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.015,
    momentumMax: 0.07,
    minRsVsBench: 0.01,
    maxSingleDay: 0.03,
    max3DaySum: 0.07,
    maxLastDay: 0.02,
    minTurnover: 120_000,
    volBuildRatio: 1.08,
    requireNetBuy: true
  },
  '3': {
    holdDays: 3,
    momLookback: 3,
    momentumMin: 0.02,
    momentumMax: 0.065,
    minRsVsBench: 0.012,
    maxSingleDay: 0.028,
    max3DaySum: 0.065,
    maxLastDay: 0.018,
    minTurnover: 150_000,
    volBuildRatio: 1.1,
    requireNetBuy: true,
    minNetRatio: 0.02
  }
}

const p = PRESETS[VERSION] ?? PRESETS['1']
const HOLD_DAYS = Number(process.env.BACKTEST_HOLD_DAYS ?? p.holdDays)
const MOM_LOOKBACK = p.momLookback
const MIN_NET_RATIO = p.minNetRatio ?? 0

const HOT_POOL = ['0050', '2330', '2454', '6770', '2344', '2408', '2881', '3481', '2303', '2317']

const pool = new Pool({ connectionString: SOURCE_URL, max: 4 })

function branchStats(rows) {
  let buy = 0
  let sell = 0
  for (const r of rows) {
    buy += r.buyShares
    sell += r.sellShares
  }
  const net = buy - sell
  return { turnover: buy + sell, net }
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

  const blobR = await pool.query(
    `SELECT trade_date::text AS d, stock_id, payload FROM daily_stock_blob WHERE market = ANY($1::text[])`,
    [['TWSE', 'TPEX']]
  )
  const blobByKey = new Map()
  const turnoverByKey = new Map()
  for (const row of blobR.rows) {
    blobByKey.set(`${row.d}|${row.stock_id}`, row.payload)
    if (Array.isArray(row.payload)) {
      const st = branchStats(row.payload)
      turnoverByKey.set(`${row.d}|${row.stock_id}`, st.turnover)
    }
  }

  const benchCloses = new Map((closeByStock.get(BENCHMARK) ?? []).map((x) => [x.d, x.close]))
  const stockIds = [...new Set(blobR.rows.map((r) => r.stock_id))]

  const events = []
  const perStock = new Map()
  const filterStats = { mom: 0, rs: 0, chase: 0, vol: 0, build: 0, net: 0, pass: 0 }

  for (const stockId of stockIds) {
    if (stockId === BENCHMARK) continue
    const closes = closeByStock.get(stockId) ?? []
    const closeMap = new Map(closes.map((x) => [x.d, x.close]))
    const stockEvents = []

    for (let i = MOM_LOOKBACK; i < dates.length; i++) {
      const fwdIdx = i + HOLD_DAYS
      if (fwdIdx >= dates.length) continue

      const eventDate = dates[i]
      const c0 = closeMap.get(eventDate)
      const cStart = closeMap.get(dates[i - MOM_LOOKBACK])
      const cFwd = closeMap.get(dates[fwdIdx])
      const b0 = benchCloses.get(eventDate)
      const bStart = benchCloses.get(dates[i - MOM_LOOKBACK])
      if (!c0 || !cStart || !cFwd || !b0 || !bStart || cStart <= 0 || bStart <= 0) continue

      const mom = (c0 - cStart) / cStart
      if (mom < p.momentumMin || mom > p.momentumMax) continue
      filterStats.mom++

      const benchMom = (b0 - bStart) / bStart
      const rs = mom - benchMom
      if (rs < p.minRsVsBench) continue
      filterStats.rs++

      const cPrev1 = closeMap.get(dates[i - 1])
      const cPrev2 = closeMap.get(dates[i - 2])
      const cPrev3 = closeMap.get(dates[i - 3])
      if (!cPrev1 || !cPrev2 || !cPrev3) continue
      const r1 = (c0 - cPrev1) / cPrev1
      const r2 = (cPrev1 - cPrev2) / cPrev2
      const r3 = (cPrev2 - cPrev3) / cPrev3
      if (Math.max(r1, r2, r3) > p.maxSingleDay) continue
      if (r1 + r2 + r3 > p.max3DaySum) continue
      if (r1 > p.maxLastDay) continue
      filterStats.chase++

      const payload = blobByKey.get(`${eventDate}|${stockId}`)
      if (!payload || !Array.isArray(payload)) continue
      const stats = branchStats(payload)
      if (stats.turnover < p.minTurnover) continue
      filterStats.vol++

      const t0 = stats.turnover
      const t1 = turnoverByKey.get(`${dates[i - 1]}|${stockId}`) ?? 0
      const t2 = turnoverByKey.get(`${dates[i - 2]}|${stockId}`) ?? 0
      const avgPrev = (t1 + t2) / 2
      if (avgPrev > 0 && t0 < avgPrev * p.volBuildRatio) continue
      filterStats.build++

      if (p.requireNetBuy && stats.net <= 0) continue
      if (MIN_NET_RATIO > 0 && stats.net / stats.turnover < MIN_NET_RATIO) continue
      filterStats.net++
      filterStats.pass++

      const ret = (cFwd - c0) / c0
      const ev = {
        stockId,
        stockName: names[stockId] ?? stockId,
        eventDate,
        forwardDate: dates[fwdIdx],
        holdDays: HOLD_DAYS,
        forwardReturn: ret,
        win: ret > 0,
        mom,
        rsVs0050: rs,
        benchMom,
        turnover: stats.turnover,
        volBuild: avgPrev > 0 ? t0 / avgPrev : null
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
  const hotWinOk = passHot.length ? passHot.filter((h) => h.winRate >= 0.5).length / passHot.length : 0

  let verdict = '❌ 不通過'
  if (events.length >= 5 && overallWin >= 0.55 && overallAvg > 0 && hotWinOk >= 0.5) verdict = '✅ 通過'
  else if (events.length >= 3 && overallWin >= 0.5 && overallAvg > 0) verdict = '🟡 部分通過'
  else if (dates.length < 60 && events.length >= 8 && overallAvg > 0) {
    verdict = '🟡 部分通過（資料區間不足，邏輯待長期驗證）'
  } else if (dates.length < 60 && events.length >= 3 && overallAvg > 0) {
    verdict = '🟡 部分通過（樣本偏少，僅供參考）'
  }

  const report = {
    strategy: '相對強勢 × 量能蓄勢',
    strategySubtitle: 'Yahoo 台股題材連動 — 強於 0050、量能溫和放大、不追三根大紅棒',
    yahooContext: [
      '外資連續買超、AI/記憶體題材發酵（Yahoo 財經 2026-05-27）',
      '熱門成交榜常見群創、力積電、華邦電 — 本策略刻意避開已噴出標的',
      '大盤創高時改找「跑贏 0050 但還沒連續大紅棒」的標的'
    ],
    generatedAt: new Date().toISOString(),
    dataRange: { start: dates[0], end: dates[dates.length - 1], tradingDays: dates.length },
    benchmark: BENCHMARK,
    params: { ...p, holdDays: HOLD_DAYS, momLookback: MOM_LOOKBACK, liveHoldTargetDays: '12–18 交易日' },
    filterStats,
    limitation:
      '資料庫僅含約 11 個交易日，無法做 1 年以上回測；Yahoo 新聞為當日脈絡，回測僅用本專案 EOD 收盤價與分點量。',
    overall: { samples: events.length, winRate: overallWin, avgReturn: overallAvg },
    hotPool: hotResults,
    perStock: [...perStock.values()].sort((a, b) => b.samples - a.samples).slice(0, 20),
    events: events.slice(0, 80),
    verdict
  }

  const outPath = join(ROOT, 'docs', OUT_FILE)
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outPath, verdict, samples: events.length, winRate: overallWin, avgReturn: overallAvg }, null, 2))
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
