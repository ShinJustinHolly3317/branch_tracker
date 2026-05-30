import type pg from 'pg'

export type TeamTradingManifest = {
  runDate: string
  generatedAt: string
  limitation: string
  strategies: Array<{
    id: string
    name: string
    selectedVersion: string
    verdict: string
    dataRange: { start: string; end: string; tradingDays: number }
    overall: { samples: number; winRate: number; avgReturn: number }
    picks: Array<{ stockId: string; stockName: string; referencePrice?: number }>
    perStockTop5?: Array<{
      stockId: string
      stockName: string
      samples: number
      winRate: number
      avgReturn: number
    }>
  }>
}

function rowToListItem(row: {
  id: string
  run_date: string
  generated_at: Date
  source: string
  manifest: TeamTradingManifest
}) {
  const m = row.manifest
  return {
    id: row.id,
    runDate: row.run_date,
    generatedAt: row.generated_at.toISOString(),
    source: row.source,
    strategies: (m.strategies ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      selectedVersion: s.selectedVersion,
      verdict: s.verdict,
      samples: s.overall?.samples ?? 0,
      winRate: s.overall?.winRate ?? 0,
      avgReturn: s.overall?.avgReturn ?? 0,
      picks: (s.picks ?? []).map((p) => ({ stockId: p.stockId, stockName: p.stockName }))
    }))
  }
}

export async function listAnalysisRuns(db: pg.Pool, limit: number): Promise<ReturnType<typeof rowToListItem>[]> {
  const r = await db.query<{
    id: string
    run_date: string
    generated_at: Date
    source: string
    manifest: TeamTradingManifest
  }>(
    `SELECT id, run_date::text, generated_at, source, manifest
     FROM team_trading_run
     ORDER BY generated_at DESC
     LIMIT $1`,
    [limit]
  )
  return r.rows.map(rowToListItem)
}

export async function getAnalysisRun(db: pg.Pool, id: string) {
  const r = await db.query<{
    id: string
    run_date: string
    generated_at: Date
    source: string
    manifest: TeamTradingManifest
    summary_md: string | null
    report_html: string
  }>(
    `SELECT id, run_date::text, generated_at, source, manifest, summary_md, report_html
     FROM team_trading_run WHERE id = $1`,
    [id]
  )
  const row = r.rows[0]
  if (!row) return null
  return {
    ...rowToListItem(row),
    manifest: row.manifest,
    summaryMd: row.summary_md,
    reportHtml: row.report_html
  }
}

export async function insertAnalysisRun(
  db: pg.Pool,
  input: {
    runDate: string
    source: string
    manifest: TeamTradingManifest
    summaryMd: string
    reportHtml: string
  }
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO team_trading_run (run_date, source, manifest, summary_md, report_html)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING id`,
    [input.runDate, input.source, JSON.stringify(input.manifest), input.summaryMd, input.reportHtml]
  )
  return r.rows[0].id
}
