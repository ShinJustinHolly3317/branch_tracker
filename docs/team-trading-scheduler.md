# Team Trading 雲端排程（Cursor Cloud）

GitHub Actions 已移除。排程改由 **Cursor Cloud Automation** 執行，結果寫入 **Postgres `team_trading_run`**，UI「推薦 → 分析紀錄」可查。

## 流程

```
Cursor Cloud Automation（cron）
  → Cloud Agent 執行 npm run team-trading
  → 回測兩套策略 → 寫入 team_trading_run
  → UI /analysis-runs API 查詢
```

## 設定 Cursor Automation

1. 開啟 Cursor → **Automations** → **New automation**
2. **預填連結**（一鍵帶入排程與 prompt）：  
   https://cursor.com/automations/new?prefill=eyJuYW1lIjoiVFdCQkQgVGVhbSBUcmFkaW5nIiwiZGVzY3JpcHRpb24iOiLpgLHkuIDoh7PpgLHkupTot5EgdGVhbS10cmFkaW5nIOWbnua4rOS4puWvq-WFpSBTdXBhYmFzZSIsIndvcmtmbG93Ijp7InRyaWdnZXJzIjpbeyJ0eXBlIjoiU0NIRURVTEUiLCJzY2hlZHVsZSI6eyJjcm9uIjoiMzAgMTIgKiAqIDEtNSIsInRpbWV6b25lIjoiVVRDIn19XSwiYWN0aW9ucyI6W3sidHlwZSI6IkFHRU5UIiwicHJvbXB0IjoiUmVhZCBkb2NzL2N1cnNvci1hdXRvbWF0aW9uLXRlYW0tdHJhZGluZy5tZCBhbmQgZm9sbG93IGl0IGV4YWN0bHkuIFJ1biBucG0gcnVuIHRlYW0tdHJhZGluZyB3aXRoIERBVEFCQVNFX1VSTCBhbmQgVEVBTV9UUkFESU5HX1NPVVJDRT1jdXJzb3ItY2xvdWQuIFJlcG9ydCBzdW1tYXJ5IG9ubHk7IG5vIGdpdCBjb21taXQgb3IgUFIuIn1dLCJtZW1vcnlFbmFibGVkIjpmYWxzZX19
3. 在 Automation 設定 **Secrets**：`DATABASE_URL`
4. 確認 repo 已連到該 Automation
5. Prompt 詳細步驟：`docs/cursor-automation-team-trading.md`

## 本機 / 手動跑

```bash
DATABASE_URL='postgres://...' npm run team-trading
# 可選
TEAM_TRADING_SOURCE=manual npm run team-trading
```

## 資料庫

表：`team_trading_run`

| 欄位 | 說明 |
|------|------|
| id | UUID |
| run_date | 報告日期 |
| source | `cursor-cloud` / `manual` |
| manifest | 完整 JSON |
| summary_md | Markdown 摘要 |
| report_html | HTML 報告 |

Migration：`supabase/migrations/20260530140000_team_trading_run.sql`

## API

- `GET /analysis-runs?limit=30` — 列表
- `GET /analysis-runs/:id` — 含 HTML 報告

## UI

**推薦** 頁 → **分析紀錄** 分頁：左側列表、右側詳情，可開完整 HTML。

## 與 `/team-trading` skill

| | Cursor skill（對話） | Cloud 排程 |
|--|---------------------|------------|
| Trader 改策略 | ✅ Agent | ❌ 改 repo 腳本 |
| Validator 回測 | ✅ | ✅ `npm run team-trading` |
| 存 DB | — | ✅ |
| 開 PR | — | ❌（不需要） |

## 風險聲明

策略研究用途，非投資建議。
