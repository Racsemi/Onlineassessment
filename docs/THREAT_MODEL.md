# M13 THREAT MODEL

## 1. Authentication & Session Management
- **Account Takeover / Credential Stuffing**: Mitigated by Argon2id hashing and impending rate limits on login/reset routes.
- **Session Theft & Fixation**: Uses secure, `HttpOnly`, `SameSite=Strict` cookies. Session hashes are stored in the DB to allow instantaneous global revocation.
- **CSRF**: Mitigated by `SameSite=Strict` cookies and CORS validation.
- **XSS**: NestJS auto-escapes JSON. No raw HTML rendering currently takes place. Validation pipes (Zod) reject malicious scripts if they don't match the schema.

## 2. Authorization & Multi-Tenancy
- **IDOR / BOLA**: All tenant resources are prefixed with `/api/v1/organizations/:organizationId`. The `TenantGuard` cryptographically asserts the session's membership to that ID.
- **Tenant Escape**: Direct object lookups must unconditionally include the `organizationId` from the route params in the SQL `WHERE` clause.
- **Privilege Escalation**: Explicit DB role checks are enforced (OWNER vs ADMIN). `isPlatformAdmin` flag completely bypasses tenant membership, isolating platform capabilities.

## 3. API & Data Security
- **Mass Assignment**: `ZodValidationPipe` will be configured to strip unknown fields (`strip: true`).
- **SQL / NoSQL Injection**: Prisma ORM sanitizes all queries natively. No raw SQL concatenations exist.
- **SSRF**: No endpoints currently fetch external URLs provided by users.
- **Denial of Service (DoS)**: `ThrottlerModule` implements baseline API rate limits. Pagination limits will be hard-capped.
- **API Abuse**: Endpoints missing rate limits (e.g. email invitations, webhooks) will be strictly throttled.

## 4. Execution & Proctoring
- **Code Execution / Container Escape**: M7 runner uses isolated Docker containers without network access. Seccomp profiles and dropped capabilities prevent container escape.
- **Proctoring Evidence Theft**: M8 limits proctoring evidence access to authorized reviewers via short-lived signed URLs.
- **Queue Abuse**: BullMQ jobs are serialized. Worker nodes do not expose HTTP interfaces.

## 5. Secrets & Supply Chain
- **Secret Leakage**: Codebase scanning reveals no hardcoded production secrets. `.env` files are ignored by git.
- **Dependency Vulnerabilities**: `npm audit` reveals known vulnerabilities that must be patched or pinned.

