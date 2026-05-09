-- twbbd Phase 1 schema（JSONB）— 可直接套用至 Supabase Postgres
-- 說明：此檔與 `infra/postgres/init/001_init.sql` 同步；請以 Supabase migrations 流程管理版本

CREATE TABLE IF NOT EXISTS trading_dates (
  trade_date date PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS daily_stock_blob (
  trade_date date NOT NULL,
  market text NOT NULL,
  stock_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (trade_date, market, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stock_blob_stock_date
  ON daily_stock_blob (stock_id, trade_date);

CREATE INDEX IF NOT EXISTS idx_daily_stock_blob_date
  ON daily_stock_blob (trade_date);

CREATE TABLE IF NOT EXISTS stock_close (
  trade_date date NOT NULL,
  stock_id text NOT NULL,
  close numeric NOT NULL,
  PRIMARY KEY (trade_date, stock_id)
);

CREATE TABLE IF NOT EXISTS branch_catalog (
  branch_id text PRIMARY KEY,
  branch_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_catalog (
  stock_id text PRIMARY KEY,
  stock_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_status (
  id int PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
