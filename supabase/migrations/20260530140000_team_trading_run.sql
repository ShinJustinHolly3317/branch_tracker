-- Team Trading 每次分析結果（排程 / 手動跑完寫入）
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
