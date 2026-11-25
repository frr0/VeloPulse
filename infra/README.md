# VeloPulse Infrastructure as Code (`infra/`)

Questa cartella contiene la configurazione **Terraform** di esempio/laboratorio per gestire dichiarativamente le risorse Cloudflare invece di configurarle manualmente da dashboard.

## Uso in locale

1. Copia il file delle variabili di esempio (escluso da Git):
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
2. Inizializza e verifica il piano:
   ```bash
   terraform init
   terraform fmt -check
   terraform validate
   terraform plan
   ```
3. Per risorse già create a mano (es. KV namespace o Worker), usa `terraform import` per collegarle allo state prima di `terraform apply`.
