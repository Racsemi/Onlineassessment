# M13 Repository Status Report

## 1. Current Architecture
- **Backend:** NestJS monolithic API with module boundaries (`apps/api`).
- **Database:** PostgreSQL accessed via Prisma ORM (`packages/database`).
- **Background Jobs:** BullMQ with Redis (`services/worker`).
- **Frontend:** Next.js (currently missing/scaffolded).

## 2. Implemented Components
- **M1 Foundation:** Turborepo, shared packages, Prisma schema.
- **M2 Authentication:** Argon2id, Opaque server-side sessions, Cookie-based.
- **M3 Multi-tenancy:** URL/header-based tenant context, Prisma relational mapping.
- **M4 RBAC:** Decorator-based permissions (`@RequirePermissions`), system and custom roles.
- **M5 Assessment Engine:** API endpoints for CRUD, immutable versions, question banks.
- **M6 Candidate Flow:** API endpoints for secure invites, attempt state machine, autosave answers.
- **M11 Billing (Partial):** Stripe webhook ingestion and Subscription persistence.

## 3. Partial Components
- **M7 Code Execution:** Worker uses `docker run` locally, but lacks independent microservice network isolation, exposing the host.
- **M8 Proctoring:** API ingests events, but stores evidence on the local disk (not cloud storage/S3). `services/proctoring` is absent.
- **M9 Evaluation:** Objective scoring runs on worker. Code evaluation relies on local Docker execution.
- **M10 Email:** Basic BullMQ jobs exist, but likely relying on a local Mock/SMTP.
- **M12 Platform Admin:** Platform service exists, but UI does not.

## 4. Scaffold Only / Missing Components
- **`apps/web`:** SCAFFOLD ONLY (Default Next.js boilerplate).
- **`apps/candidate`:** MISSING.
- **`apps/admin`:** MISSING.
- **`services/code-runner`:** MISSING (Logic merged into worker).
- **`services/proctoring`:** MISSING (Logic merged into API).
- **Production Migrations:** MISSING (`prisma/migrations`).
- **Production Dockerization:** MISSING for API and Worker.

## 5. Security-Critical Findings
- **API File System Evidence Storage:** API stores proctoring images on local disk instead of S3, breaking stateless horizontal scaling.
- **Shell Injection Risk in Worker:** `services/worker/src/index.ts` uses raw `child_process.exec(dockerCmd)` which is highly vulnerable to injection if input is not sanitized.
- **Data Loss Risk:** No versioned migrations.

## 6. Test Coverage Reality
- **Claim:** "48-point E2E Functional Verification (`test_runner.ts`)"
- **Reality:** `test_runner.ts` does not exist. However, the repository contains 12 legitimate E2E test files in `apps/api/test/*.e2e-spec.ts`.

## 7. Recommended Implementation Order (Next Milestones)
1. **Frontend Foundation (M14 Pre-requisite):** Build `apps/web` starting with authentication and candidate assessment portals.
2. **Code Runner Security:** Refactor `services/worker` code execution into an isolated gRPC microservice (`services/code-runner`).
3. **Storage Abstraction:** Refactor Proctoring to use S3 for evidence rather than local disk.
4. **Migrations & Deployment:** Generate initial Prisma migrations and dockerize the Node.js services.
