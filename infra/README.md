# VeloPulse Infrastructure as Code (`infra/`)

This directory contains the **Terraform** configuration to manage Cloudflare resources declaratively instead of configuring them manually in the dashboard.

## Local Usage

1. Copy the example variables file (`.tfvars` files are gitignored):
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
2. Initialize and inspect the plan:
   ```bash
   terraform init
   terraform fmt -check
   terraform validate
   terraform plan
   ```
3. For resources created manually beforehand (e.g. a KV namespace or Worker), run `terraform import` to bring them under Terraform state before running `terraform apply`.
