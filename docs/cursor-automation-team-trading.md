# Cursor Cloud Agent 指令（Team Trading 排程）

在 repo 根目錄執行，**不要** commit、**不要** 開 PR，除非使用者另行要求。

## 步驟

1. 確認環境變數 `DATABASE_URL` 已設定（Supabase Postgres）。
2. 執行：

```bash
npm ci
export TEAM_TRADING_SOURCE=cursor-cloud
npm run team-trading
```

3. 確認輸出含 `已寫入 DB team_trading_run id=...`。
4. 回報摘要：兩套策略的判定、勝率、樣本數、當日觸發標的。

## 失敗處理

- 若 `relation "team_trading_run" does not exist`：提醒使用者套用 migration `20260530140000_team_trading_run.sql`。
- 若 DATABASE_URL 缺失：停止並回報。

## 禁止

- 不要修改策略腳本（除非使用者明確要求）
- 不要 push git
- 不要給確定買入建議
