output "dns_record_ids" {
  description = "已建立的 DNS 記錄 id"
  value       = { for k, r in cloudflare_record.dns : k => r.id }
}

output "pages_domain_ids" {
  description = "Pages 自訂網域資源 id（若有啟用）"
  value       = { for k, d in cloudflare_pages_domain.custom : k => d.id }
}
