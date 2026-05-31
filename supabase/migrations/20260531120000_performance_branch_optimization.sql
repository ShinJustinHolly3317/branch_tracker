-- 分點聚合與績效快取（hybrid：daily_branch_blob + performance_branch_snapshot）

CREATE TABLE IF NOT EXISTS daily_branch_blob (
  trade_date date NOT NULL,
  market text NOT NULL,
  branch_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (trade_date, market, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_branch_blob_branch_date
  ON daily_branch_blob (branch_id, trade_date);

CREATE TABLE IF NOT EXISTS performance_branch_snapshot (
  end_date date NOT NULL,
  days int NOT NULL,
  forward_days int NOT NULL,
  min_sample int NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (end_date, days, forward_days, min_sample)
);

CREATE INDEX IF NOT EXISTS idx_performance_branch_snapshot_end_date
  ON performance_branch_snapshot (end_date);
