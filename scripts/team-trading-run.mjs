#!/usr/bin/env node
/**
 * Team Trading 排程入口 — 跑兩套策略回測、選最佳版本、產出報告並寫入 DB
 * 供 Cursor Cloud Automation / 本機手動執行
 */
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RUN_DATE = process.env.TEAM_TRADING_DATE ?? new Date().toISOString().slice(0, 10)
const RUN_DIR = join(ROOT, 'docs/runs', RUN_DATE)

const DB_URL = process.env.SOURCE_DB_URL ?? process.env.DATABASE_URL
if (!DB_URL) {
  console.error('缺少 DATABASE_URL 或 SOURCE_DB_URL')
  process.exit(1)
}

const STRATEGIES = [
  {
    id: 'momentum',
    name: '溫和動能 × 分點確認',
    script: 'scripts/backtest-momentum-v1.mjs',
    outPrefix: 'backtest-momentum-v'
  },
  {
    id: 'relative-strength',
    name: '相對強勢 × 量能蓄勢',
    script: 'scripts/backtest-relative-strength.mjs',
    outPrefix: 'backtest-relative-strength-v'
  }
]

function runBacktest(strat, version) {
  const r = spawnSync('node', [join(ROOT, strat.script)], {
    cwd: ROOT,
    env: {
      ...process.env,
      SOURCE_DB_URL: DB_URL,
      BACKTEST_VERSION: String(version)
    },
    encoding: 'utf8'
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    throw new Error(`backtest failed: ${strat.script} v${version}`)
  }
  const outFile = join(ROOT, 'docs', `${strat.outPrefix}${version}.json`)
  return JSON.parse(readFileSync(outFile, 'utf8'))
}

function verdictRank(v) {
  if (v.startsWith('✅')) return 3
  if (v.startsWith('🟡')) return 2
  return 1
}

/** 在 v1–v3 中選 validator 分數最高的一版 */
function pickBestVersion(reports) {
  return [...reports].sort((a, b) => {
    const vr = verdictRank(b.verdict) - verdictRank(a.verdict)
    if (vr !== 0) return vr
    const scoreA = a.overall.samples * a.overall.winRate * (a.overall.avgReturn > 0 ? 1 : 0.1)
    const scoreB = b.overall.samples * b.overall.winRate * (b.overall.avgReturn > 0 ? 1 : 0.1)
    return scoreB - scoreA
  })[0]
}

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`
}

function pctSigned(x) {
  if (x == null) return '—'
  const p = (x * 100).toFixed(2)
  return `${x >= 0 ? '+' : ''}${p}%`
}

function topPicks(report, limit = 5) {
  const seen = new Set()
  const picks = []
  for (const ev of report.events ?? []) {
    if (seen.has(ev.stockId)) continue
    if (ev.eventDate !== report.dataRange.end) continue
    seen.add(ev.stockId)
    picks.push({
      stockId: ev.stockId,
      stockName: ev.stockName,
      referencePrice: ev.entryClose ?? ev.referencePrice,
      momentum: ev.mom ?? ev.mom5 ?? ev.momentum3d
    })
    if (picks.length >= limit) break
  }
  return picks
}

function buildSummaryMd(manifest) {
  const lines = [
    `# Team Trading 排程報告 · ${RUN_DATE}`,
    '',
    '> 自動產生，非投資建議。',
    '',
    `**執行時間（UTC）**：${manifest.generatedAt}`,
    '',
    '## 策略摘要',
    ''
  ]
  for (const s of manifest.strategies) {
    lines.push(`### ${s.name}（${s.selectedVersion}）`)
    lines.push(`- **判定**：${s.verdict}`)
    lines.push(`- **資料區間**：${s.dataRange.start} → ${s.dataRange.end}（${s.dataRange.tradingDays} 交易日）`)
    lines.push(`- **回測**：樣本 ${s.overall.samples}，勝率 ${pct(s.overall.winRate)}，平均報酬 ${pctSigned(s.overall.avgReturn)}`)
    if (s.picks.length) {
      lines.push(`- **當日觸發**：${s.picks.map((p) => `${p.stockId} ${p.stockName}`).join('、')}`)
    } else {
      lines.push('- **當日觸發**：（無）')
    }
    lines.push('')
  }
  lines.push('## 報告檔案', '', `- [互動 HTML](./report.html)`, `- [完整 manifest](./manifest.json)`, '')
  lines.push('## 限制', '', manifest.limitation, '')
  return lines.join('\n')
}

function buildHtml(manifest) {
  const stratCards = manifest.strategies
    .map(
      (s) => `
    <article class="card">
      <h3>${s.name} <span class="tag">${s.selectedVersion}</span></h3>
      <p class="verdict">${s.verdict}</p>
      <p>區間 ${s.dataRange.start} → ${s.dataRange.end} · ${s.dataRange.tradingDays} 交易日</p>
      <p>樣本 <strong>${s.overall.samples}</strong> · 勝率 <strong>${pct(s.overall.winRate)}</strong> · 平均報酬 <strong>${pctSigned(s.overall.avgReturn)}</strong></p>
      <h4>當日觸發</h4>
      ${
        s.picks.length
          ? `<ul>${s.picks.map((p) => `<li>${p.stockId} ${p.stockName}${p.referencePrice ? ` · ${p.referencePrice}` : ''}</li>`).join('')}</ul>`
          : '<p class="muted">（無）</p>'
      }
      <h4>分檔 Top 5</h4>
      <table><tr><th>代號</th><th>樣本</th><th>勝率</th><th>報酬</th></tr>
      ${(s.perStockTop5 ?? [])
        .map(
          (r) =>
            `<tr><td>${r.stockId} ${r.stockName}</td><td>${r.samples}</td><td>${pct(r.winRate)}</td><td>${pctSigned(r.avgReturn)}</td></tr>`
        )
        .join('')}
      </table>
    </article>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Team Trading · ${RUN_DATE}</title>
  <style>
    body{font-family:"PingFang TC","Noto Sans TC",system-ui,sans-serif;background:#0c1220;color:#eef2f8;margin:0;padding:2rem;line-height:1.65}
    .wrap{max-width:920px;margin:0 auto}
    h1{margin:0 0 .5rem}
    .muted{color:#8fa3bf}
    .card{background:#151d2e;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:1.2rem;margin:1rem 0}
    .tag{font-size:.75rem;background:rgba(56,189,248,.15);color:#38bdf8;padding:.15rem .5rem;border-radius:999px}
    .verdict{font-weight:700;color:#fbbf24}
    table{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:.5rem}
    th,td{padding:.45rem;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
    th{color:#8fa3bf}
    .alert{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);padding:1rem;border-radius:10px;color:#fde68a;font-size:.9rem}
  </style>
</head>
<body>
<div class="wrap">
  <h1>Team Trading 排程報告</h1>
  <p class="muted">${RUN_DATE} · 自動產生</p>
  <div class="alert">${manifest.limitation}</div>
  ${stratCards}
  <p class="muted" style="font-size:.82rem;margin-top:2rem">風險聲明：策略研究用途，非投資建議。</p>
</div>
</body>
</html>`
}

async function saveToDb(manifest, summaryMd, reportHtml) {
  const pool = new pg.Pool({ connectionString: DB_URL, max: 2 })
  try {
    const source = process.env.TEAM_TRADING_SOURCE ?? 'manual'
    const r = await pool.query(
      `INSERT INTO team_trading_run (run_date, source, manifest, summary_md, report_html)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id::text`,
      [RUN_DATE, source, JSON.stringify(manifest), summaryMd, reportHtml]
    )
    return r.rows[0].id
  } finally {
    await pool.end()
  }
}

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })

  const strategyResults = []

  for (const strat of STRATEGIES) {
    console.log(`\n=== ${strat.name} ===`)
    const versions = [1, 2, 3].map((v) => {
      console.log(`  running v${v}...`)
      const report = runBacktest(strat, v)
      return { version: `v${v}`, ...report }
    })
    const selected = pickBestVersion(versions)

    console.log(`  selected: ${selected.version} → ${selected.verdict}`)

    strategyResults.push({
      id: strat.id,
      name: strat.name,
      selectedVersion: selected.version,
      verdict: selected.verdict,
      dataRange: selected.dataRange,
      overall: selected.overall,
      picks: topPicks(selected),
      perStockTop5: (selected.perStock ?? []).slice(0, 5),
      allVersions: versions.map((v) => ({
        version: v.version,
        verdict: v.verdict,
        samples: v.overall.samples,
        winRate: v.overall.winRate,
        avgReturn: v.overall.avgReturn
      }))
    })
  }

  const manifest = {
    runDate: RUN_DATE,
    generatedAt: new Date().toISOString(),
    limitation:
      '回測使用 Supabase/Postgres 現有 EOD 資料；交易日不足時僅能 🟡 部分通過。非 1 年以上正式驗證。',
    strategies: strategyResults
  }

  const summaryMd = buildSummaryMd(manifest)
  const reportHtml = buildHtml(manifest)

  writeFileSync(join(RUN_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(join(RUN_DIR, 'SUMMARY.md'), summaryMd)
  writeFileSync(join(RUN_DIR, 'report.html'), reportHtml)
  writeFileSync(join(ROOT, 'docs/runs/latest.json'), JSON.stringify({ runDate: RUN_DATE, path: `docs/runs/${RUN_DATE}` }, null, 2))

  let dbId = null
  try {
    dbId = await saveToDb(manifest, summaryMd, reportHtml)
    console.log(`\n💾 已寫入 DB team_trading_run id=${dbId}`)
  } catch (e) {
    console.error('\n⚠️ 寫入 DB 失敗（請確認已跑 migration）:', e.message)
  }

  console.log(`\n✅ 輸出：${RUN_DIR}`)
  console.log(JSON.stringify(manifest.strategies.map((s) => ({ name: s.name, verdict: s.verdict, samples: s.overall.samples })), null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
