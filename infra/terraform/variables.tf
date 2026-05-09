variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID（儀表板網域概覽右側）"
  type        = string
}

variable "dns_records" {
  description = <<EOT
DNS 記錄（key 僅供 terraform 內部識別）。
典型方案 A：api → Railway/Fly 給的 CNAME；dash → Pages 預設子網域或自訂主機。
EOT
  type = map(object({
    name    = string
    type    = string
    content = string
    proxied = optional(bool, false)
    ttl     = optional(number, 1)
    comment = optional(string, null)
  }))
  default = {}
}

variable "pages_custom_domains" {
  description = "已存在的 Cloudflare Pages 專案名稱 + 要掛的自訂網域（須先在 Pages 連好 Git／build）"
  type = map(object({
    project_name = string
    domain       = string
  }))
  default = {}
}

variable "cloudflare_account_id" {
  description = "掛 Pages 自訂網域時需要 Account ID"
  type        = string
  default     = ""
}
