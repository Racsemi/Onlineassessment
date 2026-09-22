# M13 SECURITY TEST MATRIX

| Threat | Component | Endpoint | Attack | Expected Behavior | Current Behavior | Severity | Automated Test | Remediation | Status |
|--------|-----------|----------|--------|-------------------|------------------|----------|----------------|-------------|--------|
| Rate Limiting | Auth | `POST /api/v1/auth/login` | Brute force credentials (100 reqs/sec) | HTTP 429 Too Many Requests | HTTP 429 (Global throttle) but limit is too high | MEDIUM | `test_auth_brute_force` | Add strict local throttle | PENDING |
| Session Fixation | Auth | `POST /api/v1/auth/login` | Pass pre-created `session_token` cookie | Server ignores old token and issues new one | TBD | HIGH | `test_session_fixation` | Verify auth service | PENDING |
| Privilege Escalation | RBAC | `PUT /organizations/:id/members/:userId` | `MEMBER` tries to update their own role to `ADMIN` | HTTP 403 Forbidden | TBD | CRITICAL | `test_escalation_member_to_admin` | Verify `PermissionGuard` | PENDING |
| BOLA / IDOR | Assessments | `GET /organizations/:id/assessments/:assessmentId` | Request Assessment `B` (Org Y) while logged into Org `X` | HTTP 404 Not Found (Leak prevention) | TBD | CRITICAL | `test_bola_assessment_read` | Enforce `where: { organizationId, id }` | PENDING |
| Mass Assignment | Organizations | `PATCH /organizations/:id` | Send `{"status": "ACTIVE", "isPlatformAdmin": true}` | Ignored or HTTP 400 | TBD | HIGH | `test_mass_assignment` | Enforce Zod `strip: true` | PENDING |
| CSRF | Core API | `POST /organizations/:id/assessments` | Cross-origin POST with credentials | Blocked | TBD | HIGH | `test_csrf_post` | Verify `SameSite=Strict` and CORS | PENDING |
| Code Escape | Code Runner | `POST /execute` | Submit Python script reading `/etc/passwd` | Execution succeeds, output is empty/denied | TBD | CRITICAL | `test_runner_file_read` | Enforce Docker isolation | PENDING |
| Code Exhaustion | Code Runner | `POST /execute` | Submit infinite `while(true)` memory leak | Killed with HTTP 408 / Memory Error | TBD | HIGH | `test_runner_memory_limit` | Enforce Docker memory limits | PENDING |
| Webhook Forgery | Billing | `POST /billing/webhook` | Send unverified webhook | HTTP 400 | HTTP 400 | CRITICAL | `test_webhook_signature` | Verify existing Stripe logic | VERIFIED |
| Replay Attack | Billing | `POST /billing/webhook` | Resend exact same valid webhook twice | First 200, Second 200 (ignored idempotently) | TBD | HIGH | `test_webhook_replay` | Verify `ProcessedWebhook` | PENDING |
| Secret Leakage | Global | All Repositories | Search for `sk_test_*` or `postgresql://` | 0 findings in codebase | TBD | CRITICAL | Manual grep / Git sweep | Remove from `.ts` files | PENDING |
| DB Race Condition | Billing | `POST /organizations/:id/assessments` | Fire 10 simultaneous requests at limit boundary | Only 1 succeeds, 9 fail | TBD | MEDIUM | `test_entitlement_race` | Use transactions/locks | PENDING |
