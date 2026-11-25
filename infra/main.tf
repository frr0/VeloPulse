# Declarative Cloudflare Workers Static Assets configuration for VeloPulse.
# Note: Static-asset-only Workers read VITE_* build variables during CI/CD;
# this resource models the Worker script/deployment metadata and route/subdomain state.
resource "cloudflare_workers_kv_namespace" "velopulse_cache" {
  account_id = var.cloudflare_account_id
  title      = "${var.worker_name}-platform-lab"
}
