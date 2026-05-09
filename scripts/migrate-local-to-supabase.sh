#!/usr/bin/env bash
# 本機 twbbd → Supabase Postgres：先套用 schema，再還原資料。
# 事前請在 Supabase Dashboard 複製「Direct connection」或 Session pooler（見 docs/supabase.md）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://twbbd:twbbd@127.0.0.1:5432/twbbd}"
MIGRATION_SQL="$ROOT/supabase/migrations/20260109120000_twbbd_phase1_jsonb.sql"
DUMP="${DUMP_PATH:-$ROOT/tmp/twbbd_data_only.dump}"

die() {
  echo "錯誤: $*" >&2
  exit 1
}

cmd_dump() {
  mkdir -p "$(dirname "$DUMP")"
  echo "從本機匯出 data-only → $DUMP"
  pg_dump "$LOCAL_URL" \
    -n public \
    --data-only \
    --no-owner \
    --no-acl \
    -Fc \
    -f "$DUMP"
  ls -la "$DUMP"
  echo "完成。下一步請設定 SUPABASE_DATABASE_URL 後執行： $0 schema && $0 restore"
}

cmd_schema() {
  [[ -n "${SUPABASE_DATABASE_URL:-}" ]] || die "請設定 SUPABASE_DATABASE_URL（建議 Direct，sslmode=require）"
  echo "在 Supabase 套用 Phase 1 schema…"
  psql "$SUPABASE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"
  echo "schema 完成。"
}

cmd_restore() {
  [[ -n "${SUPABASE_DATABASE_URL:-}" ]] || die "請設定 SUPABASE_DATABASE_URL"
  [[ -f "$DUMP" ]] || die "找不到 dump：$DUMP（先執行 $0 dump）"
  echo "還原資料到 Supabase（請確認 public 表為空或與本機結構一致）…"
  pg_restore \
    --no-owner \
    --no-acl \
    --verbose \
    -d "$SUPABASE_DATABASE_URL" \
    "$DUMP"
  echo "還原完成。"
}

usage() {
  cat <<EOF
用法：
  LOCAL_DATABASE_URL=... $0 dump              # 本機匯出 data-only 到 tmp/twbbd_data_only.dump
  SUPABASE_DATABASE_URL=... $0 schema         # 在 Supabase 建立表（IF NOT EXISTS）
  SUPABASE_DATABASE_URL=... $0 restore        # 寫入資料

若 Supabase 已手動跑過 migration，可略過 schema，直接 restore。
Transaction pooler（6543）常無法跑 pg_restore；請改用 Direct 連線字串。
EOF
}

case "${1:-}" in
  dump) cmd_dump ;;
  schema) cmd_schema ;;
  restore) cmd_restore ;;
  *) usage ; exit 1 ;;
esac
