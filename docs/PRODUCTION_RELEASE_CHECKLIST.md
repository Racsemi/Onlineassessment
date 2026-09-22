# Production Release Checklist

## 1. Domain & DNS
- [ ] Production domain configured (e.g., `assess.example.com`).
- [ ] Cloudflare / WAF proxy enabled.
- [ ] Subdomains mapped for Web, Candidate, and API.

## 2. Security & TLS
- [ ] TLS Certificates provisioned and forced (HSTS enabled).
- [ ] `CORS_ORIGIN` explicitly restricted to production frontend domains.
- [ ] Security headers (CSP, X-Content-Type-Options, etc.) active.

## 3. Infrastructure & Backends
- [ ] **Database:** Managed PostgreSQL instance active (RDS/Supabase).
- [ ] **DB Backups:** Daily automated backups + 7-day PITR enabled.
- [ ] **Migrations:** Executed via `npx prisma migrate deploy` ONLY.
- [ ] **Redis:** Authentication enabled, TLS enabled, `noeviction` configured.
- [ ] **Queues:** BullMQ successfully connecting to Redis.

## 4. Platform Services
- [ ] **Code Runner:** Dedicated runner hosts provisioned without access to primary VPC.
- [ ] **Email:** Transactional email provider verified (DKIM/SPF records healthy).
- [ ] **Payments:** Stripe production Webhook Secret registered in `.env`.
- [ ] **Storage:** S3 buckets provisioned. Public access blocked. Lifecycle policies enabled.

## 5. Secrets Management
- [ ] Database URLs injected securely.
- [ ] Payment keys, API secrets, and JWT secrets verified.
- [ ] No `.env` files committed to production repositories.

## 6. Observability
- [ ] Structured logging sink connected (Datadog/CloudWatch).
- [ ] Error tracking (Sentry) configured.
- [ ] Alerts enabled for HTTP 5xx spikes and Queue backlogs.
- [ ] Rate limiters globally enabled.

## 7. Legal & Compliance
- [ ] Privacy Policy linked in footer.
- [ ] Terms of Service linked in footer.
- [ ] Data deletion procedures documented for support staff.
- [ ] Support contact channels live.

## 8. Disaster Recovery
- [ ] Bi-annual restore test scheduled.
- [ ] Rollback procedures tested.
