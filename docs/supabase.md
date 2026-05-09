# Supabase（Postgres）— schema 建立與本專案需要的 secrets

本專案 API / ingester 目前仍以 **`pg` + `DATABASE_URL`** 連 Postgres（最适合搬去 Supabase Postgres）。同時已加上 **`@supabase/supabase-js`** 的 admin client 工廠，方便後續改用 PostgREST / RPC / Storage。

## 你需要先準備的 secrets（Supabase Dashboard）

專案中 **Express 後端**建議使用 **`service_role`**（可繞過 RLS；請勿暴露到瀏覽器）：

| 名稱 | 在哪裡拿 | 用途 |
|------|----------|------|
| `SUPABASE_URL` | Settings → API → Project URL | Supabase JS client base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` | 後端 admin client（**秘密**） |
| `SUPABASE_ANON_KEY` | Settings → API → `anon` | 只有在你真的要让「純前端直連」才需要；並且要寫 RLS |

Postgres 連線（**給 `pg` / Prisma / 其他 SQL client**）：

| 名稱 | 在哪裡拿 | 用途 |
|------|----------|------|
| `DATABASE_URL` | Settings → Database → Connection string（通常選 **Transaction pooler** 給 serverless；常駐 Node 也可用 Direct） | `pg` pool connection string（務必含 `sslmode=require`） |
| `SUPABASE_DB_PASSWORD` | 建立專案時的 DB password（或 reset） | 組 connection string 需要 |

> 建議另外保存一份 **Direct connection**（非 pooler）給 migration / 大批次維運使用；URL 可用 `DIRECT_URL` 自行管理（目前程式未读取，纯文档约定）。

JWT / Signing keys 通常 **不必**給本專案（除非你自建签发 JWT 或自定义 Auth）。

## 用指令建立 schema（兩種方式擇一）

### A) Supabase CLI（推薦：可版控 migrations）

1) 安裝 CLI（本機）

```bash
brew install supabase/tap/supabase
```

2) 登入並連結專案

```bash
supabase login
supabase link --project-ref "<你的 project ref>"
```

3) 套用 `supabase/migrations/*.sql`

```bash
cd /Users/justinkao/projects/tw-broker-branch-dashboard
supabase db push
```

### B) `psql` 直接執行（最快）

把 Dashboard 的 **Database password** 代入：

```bash
export SUPABASE_DB_PASSWORD='...'
psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require" \
  -f supabase/migrations/20260109120000_twbbd_phase1_jsonb.sql
```

## 本 repo 內已準備的 migration 檔

- `supabase/migrations/20260109120000_twbbd_phase1_jsonb.sql`

## 後端 env（最小集合）

- `DATABASE_URL`（給 `pg`，指向 Supabase Postgres）

若要開始使用 Supabase JS SDK（本 repo 已提供 `getSupabaseAdmin()`）再加：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Cloud agent 繼續時：先確認三個 env 都能在容器/VM 中讀到，再 `npm run build` + 部署。
