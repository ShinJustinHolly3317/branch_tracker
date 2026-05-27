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
