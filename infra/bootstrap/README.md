# Terraform bootstrap (one-time)

Creates remote state storage, the GitHub OIDC role used by CI for `terraform plan` /
`apply`, and (optionally) a public Route 53 hosted zone + shared ACM certificate for
CloudFront. Domain registration stays at an external registrar (e.g. Namecheap).

## Resources

- S3 bucket (versioned, encrypted) for Terraform state
- DynamoDB table for state locking
- GitHub OIDC provider (if not already present in the account)
- IAM role `mmap-terraform-ci` trusted by this repository
- IAM service-linked role `AWSServiceRoleForECS` (account-wide ECS prerequisite)
- **Optional public DNS** (`enable_public_domain = true`):
  - Route 53 public hosted zone for `public_domain` (default `savemarinemammals.com`)
  - ACM certificate in **us-east-1** covering apex + `*.savemarinemammals.com`
  - DNS validation records in the hosted zone

## Run via GitHub Actions (recommended)

1. Configure the **`bootstrap`** environment with admin-only reviewers.
2. Add `AWS_BOOTSTRAP_ACCESS_KEY_ID` and `AWS_BOOTSTRAP_SECRET_ACCESS_KEY` to that environment.
3. Run **Infra bootstrap** (`infra-bootstrap.yml`) as a repository admin.
4. Copy outputs into repository secrets (see [docs/ops/INFRA_PIPELINES.md](../../docs/ops/INFRA_PIPELINES.md)).

## Run locally (alternative)

Requires AWS credentials with permission to create S3, DynamoDB, IAM, Route 53, and ACM
resources.

```powershell
cd infra/bootstrap
copy terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set github_repository; optionally enable public DNS
terraform init
terraform apply
```

Bootstrap uses **local state** stored in `infra/bootstrap/terraform.tfstate` — back up this
file; it is not stored in S3.

## Public DNS (`savemarinemammals.com`)

Register the domain at **Namecheap** (or another registrar). Bootstrap only creates the
Route 53 hosted zone and ACM certificate (~$0.50/mo for the zone; ACM is free for
CloudFront).

### 1. Enable and create the hosted zone

1. Set `enable_public_domain = true` and `public_domain = "savemarinemammals.com"` in
   `terraform.tfvars` (see `terraform.tfvars.example`).
2. Create the zone first (fast; does not wait on ACM):

```powershell
cd infra/bootstrap
terraform apply -target=aws_route53_zone.public
terraform output name_servers
```

### 2. Point Namecheap at Route 53

1. Sign in to [Namecheap](https://www.namecheap.com/) → **Domain List** →
   `savemarinemammals.com` → **Manage**.
2. Under **Nameservers**, choose **Custom DNS** (not Namecheap BasicDNS).
3. Enter the **four** values from `terraform output name_servers` (one per field). Example
   shape only — use your own output:

   - `ns-xxxx.awsdns-xx.org`
   - `ns-xxxx.awsdns-xx.co.uk`
   - `ns-xxxx.awsdns-xx.com`
   - `ns-xxxx.awsdns-xx.net`

4. Save. Propagation is often minutes to a few hours (occasionally up to 48h).
5. Optional check (after some wait):

```powershell
nslookup -type=NS savemarinemammals.com
```

You should see the same `awsdns` hosts as the Terraform output.

### 3. Finish ACM validation

With custom NS live, complete bootstrap (certificate validation can wait up to 60 minutes):

```powershell
terraform apply
terraform output -raw hosted_zone_id
terraform output -raw acm_certificate_arn
```

Copy `hosted_zone_id` and `acm_certificate_arn` into staging and production
`terraform.tfvars` with `domain_name = "savemarinemammals.com"` (see environment
`terraform.tfvars.example` files and [DEPLOYMENT.md](../../docs/ops/DEPLOYMENT.md)).

| Output                | Use                                                   |
| --------------------- | ----------------------------------------------------- |
| `public_domain`       | Root domain string                                    |
| `hosted_zone_id`      | Staging/production CDN Route 53 aliases               |
| `acm_certificate_arn` | CloudFront viewer certificate (shared)                |
| `name_servers`        | Custom DNS at Namecheap (required for ACM + site DNS) |

Do **not** leave Namecheap BasicDNS or parking nameservers active once you switch — Route 53
must be authoritative for ACM DNS validation and CloudFront aliases.

## ECS service-linked role

Bootstrap creates `AWSServiceRoleForECS` (`ecs.amazonaws.com`). Staging/production Terraform
reads this role via a data source in the api module; it is not recreated per environment.

If the role already exists in the account (for example after a manual
`aws iam create-service-linked-role`), import it into bootstrap state before re-running apply:

```powershell
cd infra/bootstrap
terraform import aws_iam_service_linked_role.ecs `
  "arn:aws:iam::ACCOUNT_ID:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS"
terraform apply
```

Replace `ACCOUNT_ID` with your AWS account ID.

## After bootstrap

Remove or rotate bootstrap access keys when no longer needed. Day-to-day Terraform uses
`AWS_TERRAFORM_ROLE_ARN` via OIDC.
