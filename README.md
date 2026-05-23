## TW Broker-Branch Dashboard (Local quick review)

This repo provides a browser dashboard + API for exploring Taiwan broker branch (券商分點) activity:

- **Stock → branches** (arbitrary last N trading days)
- **Branch → stocks** (arbitrary last N trading days)
- **Charts** for quick concentration/“main force” reading
- **Branch performance** ranking (avg forward return / hit rate / weighted PnL proxy)

### Important note about official sources

Both TWSE (`bsr.twse.com.tw`) and TPEx (`tpex.org.tw`) broker-branch pages are protected by CAPTCHA / Turnstile.
Fully automated, free, official scraping is not reliably achievable without a human-in-the-loop step or a paid data source.

For **feature review**, this project can seed **fake EOD data** into Postgres so the UX + metrics are testable immediately.

### 本機跑 ingester（不必 Docker）

本機需已裝 **Node**，且 **Postgres** 可連（`DATABASE_URL`）。

```bash
cd /Users/justinkao/projects/tw-broker-branch-dashboard
npm run ingest:local
```

`ingest:local` 已內建 **`TWSE_STOCKS=all`**、**`TW_STOCK_UNIVERSE=twse`**，會跑證交所分點爬蟲。**若手動執行 `ingest:once` 又沒設 `TWSE_STOCKS`**，程式會改走 **假資料 seed**（你才會看到 `seeded fake data`）。要看假資料 UX 請用 **`npm run ingest:fake`**。

分點頁請求：**URL 只帶 `v=t`、`StkNo`、`RecCount`**。同一檔若 **`RecCount=10` 連續取不到內容（空 body）**，會自動改試 **`5`**，再試 **`1`**（同一 `RecCount` 仍保留最多三次短暫重試以排除瞬間空回應）。

### Run locally (Docker Compose)

Start API + web + postgres + **ingester-cron**（每日 TWSE 排程）：

```bash
cd /Users/justinkao/projects/tw-broker-branch-dashboard
docker-compose up --build
```

若你的環境只有舊版指令，請用 `docker-compose`（含連字號）；`docker compose` 子命令不相容時會報錯。

`web` 服務已掛載 `./apps/web`：**調整前端樣式或元件後通常不必重建映像**，重新整理瀏覽器即可（Vite HMR）。若改了 `package.json` 依賴，仍需重建。

若尚未有資料，可選：假資料 seed（60 天）一次（需 `--profile tools`，不影響平常 `up`）：

```bash
docker-compose --profile tools run --rm ingester
```

Open the dashboard:
- `http://localhost:5173`

若曾在 `/branch`、`/performance` 重新整理出現整頁 404，請重建 web 映像後再試（已加上 dev server 的 SPA fallback）。

API:
- `http://localhost:8787/health`
- `http://localhost:8787/status/latest`
- `http://localhost:8787/stocks/2330?days=20`
- `http://localhost:8787/branches/suggest?q=土銀`
- `http://localhost:8787/branches/<branchId>?days=20`（由 UI 選定分點後帶入）
- `http://localhost:8787/performance/branches?days=20&forwardDays=10&metric=avgForwardReturn&minSample=10`

### What’s next (real data)

- Add a provider that supports either:
  - **manual CSV import** (download after captcha, then upload/import), or
  - a **paid/free-tier data API** that explicitly permits automated access (requires real API docs + key).

### 每日排程（TWSE 爬蟲）

`docker-compose up` 會一併啟動 **`ingester-cron`**（與 postgres、api、web 相同，不需額外 profile）。預設 **週一至週五 18:00（`Asia/Taipei`）** 依 `TWSE_STOCKS` 抓取證交所 `bsContent` 最新一日分點彙總並寫入 Postgres。

`TWSE_STOCKS=all` 時標的清單由 **`TW_STOCK_UNIVERSE`** 決定（預設 **`twse`**，建議）：先取 **證交所 OpenAPI `STOCK_DAY_ALL`**，再 **僅保留四碼純數字代號**（約一千檔級；過濾掉 OpenAPI 內常見、但 `bsContent` 幾乎必領空的 **`006xxx`** 等非四碼純數字）。若設為 **`merged`**，會在上述上市四碼之外 **再併入櫃買四碼**；櫃買標的多數仍無 TWSE 分點頁，`empty_body` 略過會變多，屬預期。

爬蟲來源仍是 **TWSE `bsContent`**：**`RecCount` 由 10→5→1 遞減**（列數門檻過高時證交所常回空）。市場休市、無分點揭露、throttle 時仍可能略過。略過時預設一行摘要；除錯設 **`DEBUG_INGEST=1`**。

每檔抓取結束會立刻印一行 **`[ingester] ok …`** 或 **`[ingester] fail …`**（stdout），方便 `tail -f` 即時監看。檔與檔之間預設休眠約 **350ms**；若遇 TWSE 頻繁空回應可把 **`INGEST_MS_BETWEEN_STOCKS`** 加大（例如 800～1200）。

```bash
cd /Users/justinkao/projects/tw-broker-branch-dashboard
# 可選：建立 .env 覆寫 TWSE_STOCKS、INGEST_CRON 等
docker-compose up -d --build
```

環境變數說明：

| 變數 | 說明 | 預設 |
|------|------|------|
| `TWSE_STOCKS` | `all` 或 `*`＝自動清單；否則逗號分隔股號 | `all` |
| `TW_STOCK_UNIVERSE` | `twse`＝上市 STOCK_DAY_ALL **過濾四碼數字**；`merged`＝再加櫃買四碼 | `twse` |
| `DEBUG_INGEST` | `1` 時略過個股印完整錯誤含 stack | `0` |
| `INGEST_MS_BETWEEN_STOCKS` | 每檔股票完成後休眠毫秒數（降載 TWSE） | `350` |
| `INGEST_CRON` | [node-cron](https://github.com/node-cron/node-cron) 表達式 | `0 18 * * 1-5`（週一至週五 18:00） |
| `INGEST_TZ` | IANA 時區 | `Asia/Taipei` |
| `INGEST_RUN_ON_START` | 啟動時是否立刻跑一次 | `false` |

手動單次抓取（不開 cron），寫入 Postgres 後 UI 即可查詢：

```bash
docker-compose --profile tools run --rm -e TWSE_STOCKS=all ingester
```

同一輪會順便填充分點名稱目錄（供 Branch 分頁依「名稱」搜尋）。若 `/branches/suggest` 一直是空的，多半是尚未跑過新版 ingester，請再執行上方指令一次。

### 上線部署計畫（服務選型 + 建議步驟）

#### 近乎零成本主線（個人）：Supabase + GitHub Actions + Netlify／Vercel

若你希望 **Postgres（Supabase）**、**定時 ingest 改用 GitHub Actions**、前端與 API 完全拆分，並以各家免費額度撐過極低流量，請優先閱讀：

- **`docs/deploy-zero-cost.md`**（Secret、Cron、SPA fallback、API Serverless、`DATABASE_URL` 對照）

相關檔案：**`.github/workflows/daily-twse-ingest.yml`**、**`netlify.toml`**、`apps/api/vercel.json`、`apps/api/api/index.ts`。

---

本專案有四個**邏輯元件**，部署時請拆開想：

| 元件 | 現況 | 上線時注意 |
|------|------|------------|
| **Web** | Vite SPA，`npm run -w @twbbd/web build` 產出靜態檔 | 需設定 **`VITE_API_BASE`** 指向正式 API 網址（含 `https://`） |
| **API** | Express | 須能連到 Postgres；生產環境務必設定 **CORS** 只放行你的前端網域 |
| **Postgres** | 存日線、分點目錄、查詢結果 | 建議開啟備份/PITR；注意連線數與儲存 |
| **Ingester** | 對 TWSE **連續 HTTP 數十分鐘**（千檔級） | **不適合**塞進 Cloudflare Worker「單次請求」模型（執行時間/CPU 上限）；適合 **`ingester-cron` 容器**／**長生命週期 VM**，或 **`GitHub Actions` 長時間 job**（見 `daily-twse-ingest.yml`，留意私有 repo 的分鐘額度） |

先前討論過「便宜、邊緣、Serverless」時，**Cloudflare Workers + KV / R2** 適合 **讀多寫少、短請求 API**；本專案目前仍以 **Postgres + Express API** 為主。若你不想租常駐主機：**API** 可走 **Vercel Serverless**（`apps/api/api/index.ts` + `vercel.json`），**前端**可走 **Netlify/Vercel 靜態**，**資料庫**用 **Supabase**，**每日 ingest** 用 **GitHub Actions**——細節已收斂進 **`docs/deploy-zero-cost.md`**。

---

#### 方案比較（先選一條主線）

| 方案 | 前端 | API + 資料 | Ingester | 改程式量 | 適合誰 |
|------|------|------------|----------|----------|--------|
| **D（零分拆）**：Supabase + Actions + SPA + Serverless API | Netlify／Vercel 靜態 | **Supabase Postgres**；API 採 **`apps/api` Vercel**（`serverless-http`） | **GitHub Actions** `daily-twse-ingest.yml` → `ingest:once` | **中低**（本 repo 已補工作流程與進入點） | 個人／極低流量／希望 **0～極低成本** |
| **A（推薦）混合雲** | **Cloudflare Pages**（或 Netlify / Vercel 靜態） | **Fly.io / Railway / Render** 等跑 **Docker**：`api` + `postgres` + `ingester-cron` 同 stack | 與 API 同機 **cron 容器**（等同現在 compose） | **最少** | 想快上線、少改架構 |
| **B 全託管無伺服器** | Cloudflare Pages | **Workers + KV / D1**，API 改寫存取層 | **GitHub Actions** 排程跑 `ingest:once`（或獨立小 VM），經 **HTTPS 內部 API** 或 **REST 管線** 寫入 KV | **大** | 願意為 Workers 付 refactor |
| **C 單機 VPS** | Nginx 提供 `dist/` 靜態檔 | 同一台 **Docker Compose** 全套 | 同機 | **少** | 接受自己維護 OS / 防火牆 |

**建議預設**：若你已經有 **Compose**／喜歡一機跑完，仍可選方案 **A**。若你希望 **資料庫、排程與請求後端進一步拆離**，先看 **`docs/deploy-zero-cost.md`**（方案 **D**）。

##### Terraform（階段性：Cloudflare DNS / Pages 網域）

若正式網域掛在 **Cloudflare**，可用 **`infra/terraform/`** 管理 **DNS CNAME**（例如 `api` → Railway/Fly hostname、`dash` → Pages）以及（選用）**Pages 自訂網域**。**Railway / Fly / Render / Postgres** 本體多半仍靠各平台控制台或 CLI；若要「整套」一鍵開栈，較務實的是第二階段加 **AWS/GCP** 官方 provider 模組。操作說明見 [`infra/terraform/README.md`](infra/terraform/README.md)。

---

#### 方案 A：建議實作順序（可照抄 checklist）

1. **準備**
   - [ ] 決定正式網域（例如 `dash.example.com`、`api.example.com`）。
   - [ ] 在雲平台建立專案；備妥 **Secrets**：`DATABASE_URL`。

2. **Postgres**
   - [ ] 開託管 Postgres（Neon/Supabase/RDS/Cloud SQL）或自建；確認 **TLS** 與連線字串格式。

3. **API 映像**
   - [ ] 用 `apps/api/Dockerfile` build image，部署為長駐服務；環境變數至少：`DATABASE_URL`、`PORT`、`NODE_ENV=production`。
   - [ ] **CORS**：允許來源設為 Pages 網址（例如 `https://dash.example.com`），不要用 `*` 配 credentials。
   - [ ] 探一下 `GET /health`、`GET /status/latest`。

4. **Ingester**
   - [ ] 同一個 private network 或可連到同一 Postgres 的方式部署 **ingester-cron**（等同 compose 裡的排程服務）。
   - [ ] 設定 `TWSE_STOCKS`、`TW_STOCK_UNIVERSE`、`INGEST_CRON`、`INGEST_TZ`；初次上線可手動跑一次 `ingest:once` 確認資料有寫入。

5. **Web（Pages）**
   - [ ] 本機 `npm run -w @twbbd/web build`，將 **`apps/web/dist`** 上傳為靜態站台。
   - [ ] **Build 時**注入 `VITE_API_BASE=https://api.example.com`（各平台「環境變數 / build env」設定方式不同，重點是 **build 進 bundle**，不是 runtime）。
   - [ ] SPA 路由：主機需 **fallback 到 `index.html`**（Pages / Netlify `_redirects` 等）。

6. **收斂**
   - [ ] 瀏覽器開發者工具確認 API 無 mixed content / CORS 錯誤。
   - [ ] 保留 **log 輸出或告警**（ingester 長跑失敗時要能發現）。

---

#### 若堅持「API 也上 Workers」（方案 B 備忘）

- 若要走 Workers/D1/KV，需要改寫資料存取層（本 repo 目前以 Postgres 為主）。
- Ingester **仍應**獨立在 Workers 之外跑長 job，再透過 **批量寫入 API** 灌進 KV（注意 Workers **單次 CPU 時間**與 **subrequest** 上限）。
- 此路線適合第二階段重構，不建議當第一次上線預設。

---

#### 生產環境變數速查

| 服務 | 重要變數 |
|------|----------|
| Web（build） | `VITE_API_BASE` |
| API（Vercel / Docker） | `DATABASE_URL`、`PORT`（Docker 常駐）、CORS |
| Ingester（容器 cron / 手動一次性） | `DATABASE_URL`、`TWSE_STOCKS`、`TW_STOCK_UNIVERSE`、`INGEST_CRON`、`INGEST_TZ`、`INGEST_MS_BETWEEN_STOCKS` |
| GitHub Actions（見 `daily-twse-ingest.yml`） | `DATABASE_URL`（Repository secret） |

---

#### 與「真實資料來源」的關係（法令與穩定性）

官方網站常有 **CAPTCHA / 頻率限制**；此專案目前以 **TWSE 公開分點頁** 為技術示範。正式對外服務前請自行確認 **使用條款、robots、頻率**，並預留 **人工 CSV / 付費資料源** 做備援（見下方 What’s next）。

