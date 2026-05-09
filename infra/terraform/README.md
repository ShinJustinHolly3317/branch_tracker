# Terraform（阶段性：DNS / Pages 網域）

這個資料夾用 **[Terraform](https://www.terraform.io/)** 管理 **Cloudflare** 上與本專案部署計畫直接相關、且 **API 完整** 的資源：

- **DNS 記錄**（例如 `api` → PaaS CNAME、`dash` → Pages）
- （選用）**Cloudflare Pages 自訂網域**（專案已在 Pages 後台建立並連 Git 後，可用 terraform 綁域名）

## 為什麼不是「一鍵整套 Docker」？

| 項目 | Terraform 成熟度 |
|------|------------------|
| **Cloudflare** DNS / Pages 網域 | 高（本目錄已覆蓋） |
| **Railway / Render** 應用與環境變數 | 多半無官方 provider，常用 **CLI / 控制台** 或自建模組 |
| **Fly.io** | 有社群 provider，版本與資源型別需自行評估 |
| **Redis 託管**（ElastiCache / Memorystore） | **AWS / GCP 官方 provider** 最穩，適合第二階段獨立 `infra/terraform/aws/` 模組 |

長時間跑的 **ingester** 仍建議放在 **always-on 容器或 VM**（見主 README「上線部署計畫」）；若要 **AWS ECS/Fargate + ElastiCache** 一鍵開栈，可在此 repo 後續加模組，與本目錄 **並存**。

## 使用前準備

1. 安裝 [Terraform CLI](https://developer.hashicorp.com/terraform/downloads)（>= 1.5，與 `versions.tf` 一致）。
2. Cloudflare 建立 **API Token**（至少 **Zone → DNS Edit**；若用 `pages_custom_domains` 再加 **Account → Cloudflare Pages → Edit**）。
3. 取得 **Zone ID**（網域總覽頁右欄）。

```bash
export CLOUDFLARE_API_TOKEN="xxxx"
```

## 初始化與套用

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# 編輯 terraform.tfvars

terraform init
terraform plan
terraform apply
```

## Pages 流程建議

1. 先在 Cloudflare **Dashboard → Workers & Pages → Create → Connect to Git**，建立 Pages 專案並設定 build（monorepo 可在 Pages 設 root／build command，見主 README）。
2. 再用 **DNS**（本 terraform）把 `dash.example.com` **CNAME** 指到 `xxx.pages.dev`，或使用 **`pages_custom_domains`** 由 terraform 申請自訂網域（依 Cloudflare 與 provider 版本行為為準）。

## `VITE_API_BASE`

前端 **build 時**帶入正式 API URL；Terraform **不管** Vite env，請在 Pages **Environment variables（build）** 設定。
