# Agent Changelog

> 新的條目加在最上面。Subagent 的「Changelog 教訓」區從這裡 sync。

## 2026-05-26 — 圓餅圖 tooltip 百分比與 Top10 排序

- **來源**：qa-inspector
- **問題**：Pie tooltip 的 % 用 top10 加總當分母，和表格「比重」(`shareOfNetAbs`) 不一致；Top10 用 signed `netShares` 排序，和「依淨額絕對值」文案不符
- **修正**：待修 — `PieSegment` 應帶 `shareOfNetAbs`；slice 前先 `sort((a,b) => Math.abs(b.netShares) - Math.abs(a.netShares))`
- **Agent 規則**：圖表數字必須和 API 欄位 / 表格同一套定義，不能在前端另算一套百分比

## 2026-05-26 — Recharts tooltip 難以點擊 chip

- **來源**：qa-inspector
- **問題**：滑鼠離開扇區 `onMouseLeave` 會關 tooltip，chip 來不及點
- **修正**：待修 — delay clear `activeIndex` 或 tooltip wrapper `onMouseEnter`
- **Agent 規則**：Recharts 可點 tooltip 要處理 hover 狀態，不能假設使用者能瞬間點到 chip

## 2026-05-26 — 首頁應為 Performance 且自動打 API

- **來源**：team-dev / user
- **問題**：進站預設 Stock 頁，Performance 需手動按「計算」
- **修正**：`/` → Performance；首訪自動 `api.performance()`；Stock 改 `/stock` 並保留 `/?stockId=` redirect
- **Agent 規則**：新分頁若已有預設查詢條件，首訪應 auto-fetch（用 bootstrap ref 避免重複打 API）

## 2026-05-26 — Colima 8787 port forward 失效

- **來源**：fullstack-dev
- **問題**：API container 正常但 host `curl localhost:8787` 連不上；舊 image 還連 Redis crash
- **修正**：`colima restart` + `docker-compose up -d --build api`
- **Agent 規則**：Docker 連線問題先區分 container 內 vs host，再查 port forward / 映像是否過舊
