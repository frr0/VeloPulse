variable "cloudflare_api_token" {
  description = "Cloudflare API Token with Workers & Account read/edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "worker_name" {
  description = "Cloudflare Worker name"
  type        = string
  default     = "velopulse"
}

variable "supabase_url" {
  description = "Supabase Project URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase Publishable / Anon Key"
  type        = string
  sensitive   = true
}
