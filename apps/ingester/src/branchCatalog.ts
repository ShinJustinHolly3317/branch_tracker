/** 優先保留較長的名稱（通常含分公司資訊） */
export function pickBetterBranchName(prev: string, cur: string): string {
  const a = (prev ?? '').trim()
  const b = (cur ?? '').trim()
  if (!a) return b || a
  if (!b) return a
  return b.length >= a.length ? b : a
}

/** 將單筆分點寫入 Postgres 目錄（供名稱搜尋） */
export async function mergeBranchCatalogRow(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }> },
  branchId: string,
  branchName: string
): Promise<void> {
  if (!branchId) return
  const prev = await client.query('SELECT branch_name FROM branch_catalog WHERE branch_id=$1', [branchId])
  const prevName = (prev.rows?.[0] as { branch_name?: string } | undefined)?.branch_name ?? ''
  const next = pickBetterBranchName(prevName, branchName)
  await client.query(
    'INSERT INTO branch_catalog (branch_id, branch_name) VALUES ($1,$2) ON CONFLICT (branch_id) DO UPDATE SET branch_name=EXCLUDED.branch_name, updated_at=now()',
    [branchId, next]
  )
}
