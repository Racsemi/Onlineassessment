# Production Runbook

## Overview
This runbook governs the daily operational procedures for maintaining the assessment SaaS platform. It provides actionable guidelines for scaling, managing deployments, handling alerts, and debugging production issues without compromising security or data integrity.

## 1. Deployments
**Rule:** NEVER deploy directly from a local machine.
All deployments must originate from the CI/CD pipeline (e.g., GitHub Actions) upon a merge to `main`.

### Pre-Deployment Checks
- Container scans (`npm audit` & Trivy) must pass.
- E2E suites and unit tests must report 100% success.
- `npx prisma migrate status` must be validated.

### Database Migrations
**Rule:** NEVER run `prisma db push` in production.
- Migrations are applied sequentially via `npx prisma migrate deploy` executing inside the CI pipeline runner.
- Destructive migrations (column dropping) must be handled across two separate deployments (1. Deprecate, 2. Drop).

## 2. Telemetry and Logging
- **Log Sink:** All Node.js instances log stdout/stderr in structured JSON. Do not parse raw text on the server. Query the centralized logging service (Datadog/CloudWatch) filtering by `req.id`.
- **Alert Triage:** 
  - *HTTP 5xx Spikes:* Check the API logs for `PrismaClientInitializationError` (DB connection exhaustion) or unhandled runtime exceptions. 
  - *High CPU in Code Runner:* Investigate if the Docker daemon on the runner host is hanging. Restart the host VM if necessary.

## 3. Worker / Queue Management
Background tasks (BullMQ) operate in `services/worker`. 
- **Backlog > 1000 Jobs:** Trigger horizontal scaling of the worker containers.
- **Stuck Jobs (Evaluating for > 15m):** Ensure Redis is not evicting keys (must be configured to `noeviction`). Purge stalled jobs manually via the BullMQ UI if corrupted.

## 4. Platform Suspension (Abuse Handling)
If a tenant organization is identified executing DDoS or malicious payload attacks:
1. Locate the `organizationId` from telemetry.
2. Authenticate as a Platform Admin.
3. Issue `POST /api/v1/platform/organizations/:id/suspend`.
4. This instantly terminates all active sessions globally for that tenant.

## 5. Secret Rotation
If a production secret (e.g., `STRIPE_SECRET_KEY`, `JWT_SECRET`) is suspected of compromise:
1. Generate the new secret.
2. Inject it into the Cloud Provider's Secret Manager.
3. Restart the API instances (Zero-downtime rolling restart).
4. Verify the new secret is active.
5. Invalidate the old secret at the source provider.
