# FM-01 — Field sync batch failure or API unreachable

**ID:** FM-01  
**Domain:** Application  
**Severity:** High

## Context

The field PWA is **offline-first**: assessments and measurements are stored in IndexedDB and queued in `sync_queue`. When the device is online and the API is reachable, the sync worker POSTs batches to `/v1/sync/batch` every 60 seconds (see `apps/field/src/sync/sync-worker.ts`).

**Who is affected:** Field biologists whose assessments remain `pending` or `error` and never appear in the central PostgreSQL database or public dataset.

**What breaks:**

- Network failures, API downtime, or CloudFront/nginx misconfiguration → fetch throws; queue entries get `status: error` with exponential backoff (base 1s, max **5 attempts**).
- Schema validation failures on the API → HTTP 400 or 207 with per-item errors in the response body.
- CORS or wrong API base URL in dev → browser blocks the request before it reaches the API.

Production and Docker use **same-origin** `/v1` (nginx or CloudFront path behavior). Leave `VITE_API_BASE_URL` unset unless deliberately pointing at a cross-origin API.

## Detection

| Signal | Where |
| ------ | ----- |
| Assessment badge `pending` or `error` | Field app list/detail |
| Sync / Settings page lists failed queue entries with `last_error` | `apps/field/src/pages/SyncPage.tsx`, `SettingsPage.tsx` |
| API connectivity indicator offline | `apps/field/src/sync/api-connectivity.ts` (polls `/v1/health` every 30s) |
| CloudWatch 4xx/5xx on App Runner or ALB | AWS console (when deployed) |
| API logs show validation errors | `sync_audit` table / App Runner logs |

## Prerequisites

- Access to the field device browser (DevTools) or staging field URL
- API health endpoint reachable from your machine (local, Docker, or CloudFront)
- For server-side validation issues: API logs or ability to replay a batch with `curl`

## Diagnosis

1. **Confirm device network state**

   Field sync short-circuits when `navigator.onLine` is false (`runSync` in `apps/field/src/sync/sync-service.ts`).

2. **Check API health from the same origin the field app uses**

   Git Bash:

   ```bash
   # Local API (direct)
   curl -s http://localhost:3001/v1/health | head -c 200

   # Docker field PWA (same-origin /v1 proxy via nginx)
   curl -s http://localhost:5174/v1/health | head -c 200
   ```

   PowerShell:

   ```powershell
   Invoke-RestMethod http://localhost:3001/v1/health
   Invoke-RestMethod http://localhost:5174/v1/health
   ```

   Expected: JSON with `"status":"ok"`.

3. **Inspect failed queue entries in the field app**

   Open **Sync** or **Settings → Sync** and note `last_error` and attempt count. After **5 attempts** (`MAX_SYNC_ATTEMPTS` in `apps/field/src/config.ts`), entries stop auto-retry until **Retry failed** is used.

4. **Verify dev API base URL and CORS**

   - `VITE_API_BASE_URL` should be **unset** for same-origin proxy (Vite dev or Docker nginx).
   - If set incorrectly, requests go to the wrong host.
   - API `CORS_ORIGIN` must include the field origin (e.g. `http://localhost:5174`). See `apps/api/.env.example`.

5. **Replay a minimal batch against the API**

   Git Bash (requires a valid fixture payload):

   ```bash
   curl -s -X POST http://localhost:3001/v1/sync/batch \
     -H 'Content-Type: application/json' \
     -d '{"assessments":[],"measurements":[]}'
   ```

   Empty batch returns 200 with `"results":[]`. Validation errors return 400 with per-item `error` fields (see `getBatchHttpStatus` in `apps/api/src/services/sync-batch.ts`).

6. **For staging/production: check CloudFront `/v1` path**

   ```bash
   curl -s "https://field-staging.<your-domain>/v1/health"
   ```

   If the static site loads but `/v1/health` fails, the CDN API origin or App Runner service is misconfigured. See [AWS_INFRA.md](../AWS_INFRA.md).

## Resolution

1. **Offline or transient network**

   - Wait for connectivity; sync runs automatically on `online` event and every 60s when API is reachable.
   - No server action required.

2. **API down or unhealthy**

   - Restore API first (see [FM-02-database-connectivity.md](FM-02-database-connectivity.md) if DB-related).
   - Verify `/v1/health` returns 200 before asking field users to retry.

3. **Validation errors (HTTP 400 / 207)**

   - Read `last_error` on the Sync page — mirrors API validation messages (`path: message` from `@mmap/schema`).
   - Fix data in the field app if possible, or fix schema/API mismatch in code and redeploy.
   - Use **Retry failed** in Settings/Sync after fix (`retryFailedSyncEntries` resets attempts to 0).

4. **CORS / wrong API URL in dev**

   - Unset `VITE_API_BASE_URL` in `apps/field/.env`.
   - Add field dev origin to `CORS_ORIGIN` in `apps/api/.env`.
   - Restart field dev server and API.

5. **Permanent errors after max attempts**

   In the field app: **Settings → Sync → Retry failed**, or **Sync → Retry failed**.

   This calls `retryFailedSyncEntries()` then `triggerSync({ force: true })`.

6. **Production CloudFront / App Runner**

   - Confirm infra outputs: `field_url`, `api_service_url` (`infra/terraform/environments/staging/outputs.tf`).
   - Run application deploy after infra is healthy ([FM-04-deploy-pipeline-failure.md](FM-04-deploy-pipeline-failure.md)).

## Verification

- [ ] `curl …/v1/health` returns `"status":"ok"` from field same-origin URL
- [ ] Field connectivity indicator shows online
- [ ] **Sync now** succeeds; failed queue count goes to zero
- [ ] Assessment `sync_status` becomes `synced`
- [ ] Record visible via admin or `GET /v1/public/assessments` (if published)

## Escalation / when to stop

- **Stop** if health checks pass but every batch returns validation errors — treat as a schema/version mismatch; open a code fix PR rather than repeatedly retrying in the field.
- **Escalate** if CloudFront serves the PWA but `/v1/*` consistently 502/503 across environments — infra/deploy issue ([FM-04](FM-04-deploy-pipeline-failure.md), [DEPLOYMENT.md](../DEPLOYMENT.md)).
- Field IndexedDB data is **only on the device** until sync succeeds; do not clear site data unless backups exist.

## References

| Resource | Path |
| -------- | ---- |
| Sync service | `apps/field/src/sync/sync-service.ts` |
| Sync worker & intervals | `apps/field/src/sync/sync-worker.ts`, `apps/field/src/config.ts` |
| API connectivity monitor | `apps/field/src/sync/api-connectivity.ts` |
| Batch ingestion | `apps/api/src/services/sync-batch.ts` |
| Sync route | `apps/api/src/app.ts` (`POST /v1/sync/batch`) |
| Field nginx `/v1` proxy | `apps/field/nginx.conf` |
| Dev troubleshooting | [DEVELOPMENT.md](../../DEVELOPMENT.md#field-sync-not-reaching-api) |
| Architecture (CloudFront `/v1`) | [AWS_INFRA.md](../AWS_INFRA.md) |
| Security note (unauthenticated sync) | [SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) (APP-01) |
