output "kv_namespace_id" {
  description = "ID of the Cloudflare KV namespace managed by Terraform"
  value       = cloudflare_workers_kv_namespace.velopulse_cache.id
}
