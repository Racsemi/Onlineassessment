# M13 Documentation Reconciliation

| Documentation Claim | Actual Reality | Status | Evidence | Risk |
| -------------------- | --------------------- | -------- | ------ | --------------- |
| Express API          | NestJS API            | `apps/api/src/main.ts` | MISMATCH | None |
| JWT access/refresh tokens | Opaque server-side sessions with Argon2id | `apps/api/src/auth/auth.service.ts` | MISMATCH | Lower risk (Current is more secure) |
| `requireRoles` middleware | `@RequirePermissions` decorator | `apps/api/src/common/decorators/permissions.decorator.ts` | MISMATCH | Better RBAC granularity |
| API-host Docker execution (`/var/run/docker.sock` mount) | Executed by `services/worker`, not the API. | `services/worker/src/index.ts` | MISMATCH | High if worker deployed un-isolated |
| 100% Complete Proctoring | Basic ingestion built, missing `services/proctoring`, frontend empty | `apps/api/src/proctoring/proctoring.service.ts`, `schema.prisma` | PARTIAL | Misleading completeness |
| 100% Complete Billing    | Webhook ingestion built, subscriptions tracked | `apps/api/src/billing/webhook.controller.ts`, `schema.prisma` | PARTIAL | Unverified entitlements |
| 48 E2E Functional Tests (`test_runner.ts`) | `test_runner.ts` is absent, but `apps/api/test/*.e2e-spec.ts` exists | `apps/api/test/` | MISMATCH | Misleading test name |
| 4-service production docker | DB & Redis only (`api`/`worker` missing) | `docker-compose.yml` | MISMATCH | Unverified deployment |
| Infinite horizontal scaling | Architecture supports it, but worker isn't dockerized yet | `services/worker/package.json` | UNVERIFIED | False marketing claim |
| SQL injection completely mitigated | Prisma ORM | `packages/database/prisma/schema.prisma` | MATCH | None |
| Production ready frontend | `apps/web` is a default Next.js starter page | `apps/web/src/app/page.tsx` | MISMATCH | Core product missing |
