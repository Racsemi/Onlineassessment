# M14 Implementation Plan: Production Deployment and Scalability

## 1. Executive Summary
This implementation plan outlines the architecture and operational procedures required to deploy the multi-tenant SaaS assessment platform into a secure, highly-available, and observable production environment. The focus is on predictable costs, strict security isolation, robust disaster recovery, and operational maintainability rather than theoretical massive scale.

## 2. Deployment Architecture
We will use a secure, pragmatic cloud architecture:
- **Hosting**: Managed Platform-as-a-Service (e.g., AWS Elastic Beanstalk, Render, or Railway) or isolated VPS instances with Docker Compose for simpler initial footprint. Kubernetes will **not** be used to avoid unnecessary operational overhead.
- **VPC / Networking**: Private network isolation for Database, Redis, and Worker instances. Only the API, Web, Candidate, and Admin apps will be exposed via Load Balancers.
- **DNS & TLS**: Cloudflare (or AWS Route53 + ACM) for DNS management, automatic TLS termination, and Web Application Firewall (WAF) protection.
- **Environments**:
  - `development`: Local developer environments using Docker Compose.
  - `staging`: Exact replica of production architecture for final QA.
  - `production`: Fully isolated from staging. No shared secrets or infrastructure.

## 3. Application Deployment
- **Frontend (Web, Candidate, Admin)**: Static sites or Next.js/SSR builds deployed to a global CDN (e.g., Vercel, AWS CloudFront + S3, or Cloudflare Pages) for optimal latency.
- **API Server (`apps/api`)**: Node.js containers behind a load balancer with auto-scaling based on CPU/memory utilization.
- **Worker (`services/worker`)**: Dedicated container instances connected to Redis. No public ingress.
- **Code Runner (`services/code-runner`)**: Strictly isolated, unprivileged Docker containers on dedicated EC2/VM hosts with aggressive seccomp profiles, detached from the primary VPC to prevent internal network traversal.
- **Proctoring (`services/proctoring`)**: Containerized service for analyzing events, routing heavy media processing through secure signed URLs.

## 4. Infrastructure & Backends
- **PostgreSQL**: Fully managed PostgreSQL (e.g., AWS RDS or Supabase) with:
  - Encryption at rest and in transit.
  - Multi-AZ for high availability.
  - Automated daily snapshots and 7-day Point-in-Time Recovery (PITR).
  - Explicit Prisma migrations (`npx prisma migrate deploy` in CI), banning `db push`.
- **Redis**: Managed Redis (e.g., ElastiCache or Upstash) inside the private VPC with:
  - Authentication (AUTH) and TLS enforced.
  - Eviction policy configured to `noeviction` for queues, or `volatile-lru` if caching is mixed.
- **Object Storage**: S3-compatible storage (AWS S3, R2) with private buckets and strict IAM policies. All public access via short-lived signed URLs.
- **Email & Payments**:
  - Resend or AWS SES for transactional emails.
  - Stripe for payments, using webhook signing secrets injected at deploy-time.

## 5. Observability & Alerting
- **Logs**: Structured JSON logging (Pino) aggregated into a central sink (Datadog, CloudWatch, or Axiom). Secrets strictly redacted.
- **Metrics & Tracing**: Basic APM to monitor HTTP latency and Prisma query execution times.
- **Health Checks**: `/health/live` (process active) and `/health/ready` (DB & Redis connections valid).
- **Alerting**: PagerDuty/Slack integration for:
  - API HTTP 5xx rate > 1%
  - BullMQ job failures or backlog > 1000
  - DB CPU > 80% or connections maxed
  - Stripe webhook processing failures

## 6. CI/CD & Migrations
- **Pipeline (GitHub Actions / GitLab CI)**:
  1. `lint` and `typecheck`
  2. `unit`, `integration`, and `e2e` tests
  3. `security` scans (`npm audit`, container scanning)
  4. Docker build and ECR push
  5. `prisma migrate deploy` (Pre-deployment hook on Staging/Prod)
  6. Zero-downtime rolling deployment
- **Rollback Strategy**: Container version reversion combined with non-destructive DB migrations.

## 7. Backup & Disaster Recovery (DR)
- **RPO (Recovery Point Objective)**: 5 minutes (via PITR).
- **RTO (Recovery Time Objective)**: 1 hour for full regional restoration.
- **Restore Testing**: Bi-annual automated restoration of production DB into an isolated sandbox to cryptographically verify data integrity.

## 8. Artifact Generation
Before concluding M14, we will finalize:
- `docs/PRODUCTION_RUNBOOK.md`: Daily operational commands and scaling triggers.
- `docs/DISASTER_RECOVERY.md`: Step-by-step restoration commands for total failure.
- `docs/M14_AUDIT_REPORT.md`: Final sign-off on staging vs production parity.
