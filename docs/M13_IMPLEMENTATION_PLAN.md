# M13 Implementation Plan: Security Hardening

## 1. Executive Summary
This implementation plan governs the comprehensive security hardening (M13) of the assessment SaaS platform. It transforms the existing threat model into actionable technical audits, penetration testing procedures, and remediation tasks. The goal is not feature expansion but extreme resilience, specifically around multi-tenancy, authentication, billing, and code execution.

## 2. Current Architecture
The repository consists of:
- **`apps/api`**: NestJS monolithic API covering candidate flows, authentication, tenant management, and platform administration.
- **`packages/database`**: Prisma schema defining all resources from `Organization` to `BillingCustomer` and `UsageRecord`.
- **`services/code-runner`**: M7 untrusted execution environment.
- **`services/proctoring`**: M8 proctoring and integrity monitoring.
- **`services/worker`**: Background jobs (evaluation, email).

## 3. Threat-Model Mapping

| Threat | Affected Component | Attack Surface | Existing Control | Missing Control | Test Required |
|--------|--------------------|----------------|------------------|-----------------|---------------|
| Cross-tenant access (BOLA) | Organizations API, Assessments API | Nested resource UUIDs in routes | `TenantGuard` verifies top-level org membership | Validation that deeply nested resources (e.g. AssessmentVersion) belong to the `organizationId` in the route | Swap `assessmentId` with one from another org. |
| Code Execution Escape | `code-runner` | Submitted candidate code | Network isolation, Docker | Strict seccomp profiles, capability dropping, memory/CPU caps | Fork bombs, network pinging, shell escapes. |
| Rate Limiting Bypass | Auth API, Billing Webhooks | Open endpoints | `ThrottlerModule` implemented globally | Specific low-limit throttles on password reset and login | Brute-force simulation. |
| Privilege Escalation | RBAC / API | Admin routes | `PermissionGuard` | Check that `OWNER` cannot be reassigned by `ADMIN` | Attempt to change `roleId` to OWNER. |
| Mass Assignment | DTOs | Request Body | `ZodValidationPipe` | `strip: true` configuration in Zod to drop unknown fields | Submit `isPlatformAdmin: true` in user update. |
| Billing Spoofing | Webhook API | Stripe Event Parsing | Stripe SDK signature verification | Idempotency guarantees are present, but need race-condition testing | Replay identical webhook signatures. |

## 4. Endpoint Inventory

**`apps/api/src/auth`**:
- `POST /api/v1/auth/register` (Public)
- `POST /api/v1/auth/login` (Public, Requires Throttle)
- `POST /api/v1/auth/logout` (AuthGuard)

**`apps/api/src/organizations`**:
- `GET /api/v1/organizations` (AuthGuard)
- `POST /api/v1/organizations` (AuthGuard)
- `GET /api/v1/organizations/:organizationId` (AuthGuard, TenantGuard)

**`apps/api/src/assessments`**:
- `POST /api/v1/organizations/:organizationId/assessments` (AuthGuard, TenantGuard, EntitlementsService)
- `GET /api/v1/organizations/:organizationId/assessments/:id` (AuthGuard, TenantGuard, OwnershipCheck)

**`apps/api/src/billing`**:
- `POST /api/v1/organizations/:organizationId/billing/checkout` (AuthGuard, TenantGuard)
- `POST /api/v1/billing/webhook` (Public, Stripe Signature)

**`apps/api/src/platform`**:
- `GET /api/v1/platform/organizations` (AuthGuard, PlatformAdminGuard)
- `POST /api/v1/platform/organizations/:id/suspend` (AuthGuard, PlatformAdminGuard)

## 5. Security Test Matrix
*(Detailed matrix will be generated in `docs/M13_SECURITY_TEST_MATRIX.md`)*

## 6. Authentication Audit Plan
- **Argon2id**: Confirm hash parameters are resistant to modern GPU cracking.
- **Session Tokens**: Ensure 32-byte CSRNG tokens. Verify DB stores SHA-256 hashes, not raw tokens.
- **Cookies**: Confirm `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- **Password Reset**: Verify token expiration and single-use invalidation.

## 7. Authorization Audit Plan
- Verify `PermissionGuard` uses the `request.member.role` rather than implicitly trusting client input.
- Audit `Role` modification endpoints to prevent self-escalation to `OWNER`.

## 8. Tenant-Isolation Audit Plan
- Examine all controllers under `organizations/:organizationId/`.
- Ensure Prisma queries always use `where: { organizationId, id }` rather than just `where: { id }`.
- Test IDOR by attempting to read `Assessment B` (Org Y) while authenticated to `Org X`.

## 9. Validation/Zod Audit
- Inspect `ZodValidationPipe`. Ensure `strip: true` is enabled.
- Verify DTOs do not implicitly trust inputs for `userId`, `organizationId`, or `status`.

## 10. Database Audit
- Ensure cascading deletes do not inadvertently delete cross-tenant data.
- Verify unique constraints on `(organizationId, slug)` or `(organizationId, email)`.

## 11. Code-Runner Audit
- Execute penetration scripts against the M7 runner (fork bombs, file read attempts, network egress).
- Ensure Docker socket is completely inaccessible from the runner.

## 12. Proctoring Audit
- Ensure evidence URLs are cryptographically signed and expire rapidly.
- Verify tenants cannot access other tenants' evidence logs.

## 13. Billing/Webhook Audit
- Verify idempotency in `webhook.controller.ts` via the `ProcessedWebhook` model.
- Test signature forgery rejection.

## 14. Dependency Audit
- Run `npm audit`.
- Pin highly sensitive libraries (e.g. `stripe`, `@prisma/client`, `argon2`).

## 15. Secrets Audit
- Perform a manual sweep and automated regex search for leaked `JWT_SECRET`, `STRIPE_SECRET_KEY`, or `DATABASE_URL` in `.ts` files, test fixtures, and logs.

## 16. Supply-Chain Audit
- Lockfile integrity check.
- Remove unused or dangerous third-party packages.

## 17. Logging/Error Audit
- Ensure Prisma connection errors (which leak the `DATABASE_URL`) are masked in production HTTP 500 responses.
- Ensure authentication payloads (passwords) are excluded from request logs.

## 18. Race-Condition Audit
- Test concurrent attempts to redeem the same assessment invitation token.
- Test concurrent webhook deliveries for subscription creation.

## 19. Automated E2E Plan
- Construct `apps/api/test/security.e2e-spec.ts`.
- Script BOLA, Privilege Escalation, and CSRF attempts.

## 20. Remediation Batches
1. `M13.1`: Authentication/session hardening & Rate Limiting.
2. `M13.2`: Tenant isolation / IDOR / BOLA patching.
3. `M13.3`: Validation / Zod / mass assignment.
4. `M13.4`: Code runner & Proctoring security.
5. `M13.5`: Billing/webhook security.
6. `M13.6`: Dependencies & error handling.
7. `M13.7`: Security E2E Test Suite.

## 21. Dependencies/Risks
- Dependency pinning may break build pipelines if versions are radically outdated.
- Stricter Zod validation may cause regressions if frontend relies on loose types.

## 22. Acceptance Criteria
M13 is complete when:
- `security.e2e-spec.ts` exists and passes.
- No CRITICAL or HIGH findings remain.
- All webhook, code-runner, and isolation tests successfully reject attacks.

## 23. Rollback Strategy
- Prisma schema changes (if any) will be backward compatible or run in shadow databases first.
- E2E tests provide safety against regressions during remediation.

## 24. Estimated Implementation Order
Follow the exact order laid out in Section 20.

M13 PHASE 1 STATUS: PLAN READY FOR REVIEW
