provider "cloudflare" {
  # 建議用環境變數：export CLOUDFLARE_API_TOKEN=...
  # Token 權限：Zone → DNS Edit；若使用 Pages 自訂網域再加 Account → Cloudflare Pages → Edit
}

resource "cloudflare_record" "dns" {
  for_each = var.dns_records

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.content
  proxied = each.value.proxied
  ttl     = each.value.ttl
  comment = each.value.comment
}

resource "cloudflare_pages_domain" "custom" {
  for_each = length(var.cloudflare_account_id) > 0 ? var.pages_custom_domains : {}

  account_id   = var.cloudflare_account_id
  project_name = each.value.project_name
  domain       = each.value.domain
}
