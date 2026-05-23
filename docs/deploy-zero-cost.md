# 個人／極低流量 —— 近乎零成本部署（Supabase + GitHub Actions + 靜態前端 + Serverless API）

> **問題追蹤報告（HTML）**：[`docs/deployment-report.html`](deployment-report.html) — 今日 Vercel / Netlify 修正時間軸與待辦，可直接用瀏覽器開啟。

適用對象：**個人使用**、預期流量極低、希望將 **資料庫、排程爬蟲、前端、後端** 分拆到各家免費額度內的典型架構。

> 備註：免費層級與配额會隨各平台調整；上線前仍以官方文件為準。

---

## 架構對照（與程式碼的落點）

| 元件 | 建議平台 | 本 repo 對應 | 備註 |
|------|-----------|---------------|------|
| Postgres | Supabase Free | `infra/postgres/init` 初始化 SQL／遷移至 Supabase SQL Editor 執行 | 將 `DATABASE_URL` 換成 Supabase「Transaction pooling」連線字串 |
| 每日 ingest | GitHub Actions | `.github/workflows/daily-twse-ingest.yml` | 請設 `DATABASE_URL` secret |
| Web（SPA） | Cloudflare Pages | `apps/web`，`.github/workflows/deploy-web-cloudflare.yml`，`apps/web/public/_redirects` 已含 SPA fallback | **Build 時**注入 `VITE_API_BASE=https://…` |
| API | Vercel（Serverless）或 Render 長駐 Docker | **Vercel**：`apps/api/vercel.json` + `apps/api/api/index.ts` | Vercel 專案的 **Root Directory** 請設為 `apps/api` |

---

## 1) Supabase Postgres

1. 建立 Supabase 專案後，將本專案的 schema 建好（對應本機 `infra/postgres/init` 底下的 SQL）。
2. 取用 **DATABASE_URL**：建議優先使用連線池中 **Transaction** 模式、`sslmode=require` 的連線字串。
3. 請勿把密碼寫進 Git；僅打在各平台的 **環境變數／Secrets**。

### 資料庫休止（Supabase 免費版）

長期無活動的專案可能進入休眠。本架構下 **每天至少有一次 GitHub Actions ingest 會寫入**，通常可比純網頁查詢更穩定地維持有變動；仍請自行留意控制台通知。

---

## 2) 每日 ingest：GitHub Actions

對應檔案：**`.github/workflows/daily-twse-ingest.yml`**

### 必填 Secret

請到 GitHub → **Settings → Secrets and variables → Actions** 設定：

| Secret | 說明 |
|--------|------|
| `DATABASE_URL` | Supabase Postgres 連線（建議 pooling） |

工作流程會執行 `npm run -w @twbbd/ingester ingest:once`，並帶 **`TWSE_STOCKS=all`** / **`TW_STOCK_UNIVERSE=twse`**。

### Private repo 的注意事項

GitHub Actions 免費分鐘數 **私有倉有限額**。本 ingest 對 TWSE **可能跑很久**（千檔 × 請求休眠），請自行觀察工作流用量；必要時可把 `cron` 改稀疏、縮短清單、或將 ingest 移至其他長跑環境。

### 也可以手動觸發

在 Actions 選 **Run workflow**，方便除錯或補跑。

---

## 3) 前端：Cloudflare Pages

透過 GitHub Actions 自動部署，對應檔案：**`.github/workflows/deploy-web-cloudflare.yml`**

- 每次 push 到 `main` 且異動 `apps/web/**` 或 `packages/shared/**` 時自動觸發
- SPA fallback 由 **`apps/web/public/_redirects`** 處理（`/* -> /index.html`）
- `netlify.toml` 已標記為 deprecated，不再使用

### 必填 Secret

請到 GitHub → **Settings → Secrets and variables → Actions** 設定：

| Secret | 說明 |
|--------|------|
| `CF_API_TOKEN` | 到 Cloudflare Dashboard → My Profile → API Tokens → Create Token，選 "Edit Cloudflare Workers" 範本再加 Pages 權限 |
| `CF_ACCOUNT_ID` | Cloudflare Dashboard 右側 sidebar 可以找到 |
| `VITE_API_BASE` | Vercel API 的網址，例如 `https://your-api.vercel.app` |

---

## 4) API：Vercel（Serverless + Express）

**重點：Vercel 專案請把 Root Directory 設為 `apps/api`。**

`apps/api/vercel.json` 已內建 monorepo 建置指令（勿在 Dashboard 覆寫成只有 `npm run build`）：

- **Install**：`cd ../.. && npm ci`（從 repo 根安裝 workspace）
- **Build**：先 `@twbbd/shared`，再 `@twbbd/api`

結構：

- `apps/api/src/app.ts`：Express `createApp()`（路由全集）
- `apps/api/api/index.ts`：`serverless-http` 將 `createApp()` 綁為 Function
- `apps/api/vercel.json`：**rewrites** 將 `/(.*)` 全部導向 `/api`

### Environment Variables（Production）

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | 與 ingest 同源之 Supabase 連線字串 |
| `API_PG_POOL_MAX` | （選用）Serverless pool 連線數上限，`2`〜`5` 之間；預設在程式內已收斂 |

### 若你不想用 Serverless

你可以沿用既有 **`apps/api/Dockerfile`** 部署到 Railway／Render／Fly 這類長駐服務；唯 Render 免費層級可能睡眠，請自行評估是否要加 **wake ping** 或換付費/常駐主機。

---

## 5) 舊版「混合雲／Docker Compose」

本機與過往文件中的 **Compose 整包**仍是有效路徑：`docker-compose.yml` 與 README 對應章節不變。本附件描述的是你要的「**完全分拆 + 低維護**」另一個主線。

---

## Secrets 對照總結

| 放哪裡 | 常用變數 |
|--------|---------|
| GitHub Actions Secrets | `DATABASE_URL`、`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`VITE_API_BASE` |
| Vercel API project | `DATABASE_URL`、選用 `API_PG_POOL_MAX` |

---

若有 **自訂網域**，記得將 **CORS** 從 `origin: true`（目前開發友善）調整為只允許前端網域（這屬程式層級的後續收斂，避免任意網站直連你的資料庫後端）。
