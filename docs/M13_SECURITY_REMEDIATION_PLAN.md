# M13 Security Remediation Plan

## CRITICAL 1: Raw Shell Execution in Worker
- **Location:** `services/worker/src/index.ts` (lines 228-243)
- **Current Implementation:** Uses `child_process.exec(dockerCmd)` with string concatenation for language runners, test cases, and memory limits.
- **Why it is dangerous:** Extremely vulnerable to shell command injection if candidate-supplied arguments (e.g. language selection or test cases) contain shell metacharacters. Even though inputs currently appear hardcoded or sourced from DB, any drift will result in total host compromise.
- **Affected Trust Boundary:** The worker container and the host Docker daemon.
- **Proposed Secure Architecture:** Transition to an isolated `code-runner` microservice. Until then, use `child_process.spawn` or `execFile` with an explicit arguments array instead of executing a raw shell string (`sh -c`).
- **Tests Required:** Command injection tests sending shell metacharacters in language strings (`"javascript; rm -rf /"`).
- **Rollback:** Retain old worker script disabled until verified.

## CRITICAL 2: Database Migrations (No Versioning)
- **Location:** `packages/database/package.json`
- **Current Implementation:** Uses `prisma db push` for schema updates.
- **Why it is dangerous:** `db push` forcefully syncs the schema, which can drop columns and tables unpredictably in production, destroying all tenant data.
- **Affected Trust Boundary:** Production PostgreSQL data integrity.
- **Proposed Secure Architecture:** Use `prisma migrate dev` locally and `prisma migrate deploy` in CI/CD / production. Generate a baseline migration script.
- **Tests Required:** Migration dry-run checks in staging environment.

## CRITICAL 3: Missing Frontend
- **Location:** `apps/web/src/app/page.tsx`
- **Current Implementation:** Unmodified Next.js starter page.
- **Proposed Secure Architecture:** Documented in `FRONTEND_IMPLEMENTATION_PLAN.md`.

## HIGH 1: Proctoring Storage
- **Location:** `apps/api/src/proctoring/proctoring.service.ts`
- **Current Implementation:** Saves base64 evidence images to `storage/evidence/` via `fs.writeFile`.
- **Proposed Secure Architecture:** Store evidence securely in private S3 buckets. Documented in `PROCTORING_STORAGE_SECURITY.md`.

## HIGH 2: Code Runner Trust Boundary
- **Location:** `services/worker/src/index.ts`
- **Proposed Secure Architecture:** Decoupled isolated service. Documented in `CODE_RUNNER_TRUST_BOUNDARY.md`.

## HIGH 3 & HIGH 4: Authentication & Authorization
- **Current Implementation:** Unlike the documentation claims, the system *already uses* secure Opaque Sessions + Argon2id + Cookie (Auth) and `@RequirePermissions` (AuthZ). 
- **Proposed Secure Architecture:** Documented in respective plans. No destructive architectural rewrites needed.
