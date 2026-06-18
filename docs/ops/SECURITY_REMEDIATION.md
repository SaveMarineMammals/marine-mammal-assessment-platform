# Security remediation tracker

Tracked findings from the MMAP security review. Update **Status** as work completes.

**Legend:** `open` · `in_progress` · `done` · `accepted` (risk acknowledged)

Last updated: 2026-06-15

---

## Infrastructure

| ID | Priority | Finding | Recommendation | Status |
| --- | --- | --- | --- | --- |
| INF-01 | Critical | Terraform CI role has `iam:*`, `secretsmanager:*`, `s3:*` on `*` | Least-privilege policies per module; deny IAM user/key creation | open |
| INF-02 | Critical | OIDC trust `repo:ORG/REPO:*` for Terraform CI | Restrict `sub` to `main`, environments, named workflows | open |
| INF-03 | High | Long-lived bootstrap access keys | One-time bootstrap via SSO; delete keys after use | open |
| INF-04 | High | `DATABASE_URL` duplicated in GitHub Secrets for migrations | Use `DATABASE_SECRET_ARN` + Secrets Manager at runtime (see INF-06) | done |
| INF-05 | High | State bucket lacks bucket policy, KMS CMK, TLS-only deny | Harden S3 state bucket; treat state as tier-0 | open |
| INF-06 | High | DB password in Terraform state via `random_password` | RDS `manage_master_user_password` + Secrets Manager JSON secret | done |
| INF-07 | Medium | Staging App Runner auto-deploy on ECR push | Set `auto_deployments = false`; deploy via CI only | open |
| INF-08 | Medium | ECR mutable tags in production | `IMMUTABLE` tags; deploy by digest or unique version | open |
| INF-09 | Medium | Infra apply uses `-auto-approve` without IaC-enforced approval | Require GitHub Environment reviewers for staging/production | open |
| INF-10 | Medium | Manual staging infra from any ref without admin gate | Add admin check or restrict `workflow_dispatch` permissions | open |
| INF-11 | Low | Bootstrap local state not in remote backend | Back up `infra/bootstrap/terraform.tfstate` securely | open |
| INF-12 | Low | `terraform.tfvars` not gitignored | Add to `.gitignore`; keep `.example` committed | open |

---

## Networking

| ID | Priority | Finding | Recommendation | Status |
| --- | --- | --- | --- | --- |
| NET-01 | Critical | No WAF on CloudFront `/v1/*` | AWS WAF rate limits + managed rules on API paths | open |
| NET-02 | High | App Runner connector SG allows all egress | Restrict to RDS :5432 + VPC endpoints for AWS APIs | open |
| NET-03 | High | `/v1/admin/*` reachable via public CloudFront | Block admin paths at edge; internal-only admin origin | open |
| NET-04 | Medium | No HSTS / security headers at CloudFront | Response headers policy when custom domains enabled | open |
| NET-05 | Medium | Production RDS single-AZ | Enable Multi-AZ for production | open |
| NET-06 | Medium | CloudWatch alarms without SNS actions | Wire alarms to SNS/PagerDuty | open |
| NET-07 | Low | No VPC Flow Logs | Enable flow logs on private subnets for audit | open |

---

## Application

| ID | Priority | Finding | Recommendation | Status |
| --- | --- | --- | --- | --- |
| APP-01 | Critical | Unauthenticated `POST /v1/sync/batch` | Device/org API keys, JWT, or mTLS before production pilot | open |
| APP-02 | Critical | Client-controlled `sync_status` publishes to public dataset | Server-set `sync_status`; gate public visibility on complete assessments | open |
| APP-03 | High | `PUBLIC_PSEUDONYMIZE_NAMES=false` by default | Enable in production; salted HMAC for public IDs | open |
| APP-04 | High | Full-precision coordinates on public API | Coordinate fuzzing/reduction for public export | open |
| APP-05 | High | No rate limits or batch size caps | `@fastify/rate-limit`, body limits, max batch items | open |
| APP-06 | Medium | Admin routes on public service; static `x-admin-token` | Disable on public origin or use constant-time compare + rotation | open |
| APP-07 | Medium | OpenAPI `/docs` exposed in production | Disable or protect admin-only | open |
| APP-08 | Medium | Unbounded string fields in schema | Add `maxLength` to Zod + JSON Schema | open |
| APP-09 | Low | Field IndexedDB / backups unencrypted | Document device encryption expectations; optional backup encryption | accepted |
| APP-10 | Low | Mermaid `securityLevel: 'loose'` | Keep protocol content trusted-only; sanitize if user content added | accepted |

---

## Completed work log

| Date | ID | Notes |
| --- | --- | --- |
| 2026-06-15 | INF-06 | RDS `manage_master_user_password`; removed Terraform-managed password in state; API parses Secrets Manager JSON via `DATABASE_URL` |
| 2026-06-15 | INF-04 | `deploy-aws.yml` migration step reads `DATABASE_SECRET_ARN` from Secrets Manager (no plaintext URL in GitHub) |

---

## Verification checklist (after each remediation)

- [ ] `pnpm validate` passes locally
- [ ] CI integration job passes (Postgres service + `DATABASE_URL`)
- [ ] Terraform plan shows expected changes only
- [ ] Relevant doc updated in `docs/ops/` or `docs/DEVELOPMENT.md`

---

## Related docs

- [AWS_INFRA.md](AWS_INFRA.md) — architecture and secrets flow
- [DEPLOYMENT.md](DEPLOYMENT.md) — promotion and secret rotation
- [INFRA_PIPELINES.md](INFRA_PIPELINES.md) — CI/CD setup
