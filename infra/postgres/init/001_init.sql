-- Phase 1 schema (JSONB blobs) for tw-broker-branch-dashboard

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

-- 使用者最愛清單（以 client_id 區分，無登入）
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  stock_id text NOT NULL,
  stock_name text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  buy_date date,
  buy_price numeric,
  notes text,
  strategy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_client
  ON user_favorites (client_id, added_at DESC);

-- Team Trading 每次分析結果
CREATE TABLE IF NOT EXISTS team_trading_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  manifest jsonb NOT NULL,
  summary_md text,
  report_html text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_trading_run_generated
  ON team_trading_run (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_trading_run_date
  ON team_trading_run (run_date DESC);

