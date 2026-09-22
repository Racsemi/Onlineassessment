# Architecture Overview

- **Monorepo**: Managed via Turborepo.
- **Frontend Apps**: Next.js App Router for public marketing, recruiter dashboard, and candidate application.
- **Backend API**: Modular NestJS application providing a REST/OpenAPI interface.
- **Database**: Managed PostgreSQL accessed securely via Prisma ORM (`packages/database`).
- **Cache/Queue**: Redis (local dev via docker-compose) for rate-limiting and BullMQ task queues.
- **Future Services**:
  - `Worker`: Asynchronous job processing (emails, reports).
  - `Code Runner`: Isolated, unprivileged sandboxes for executing untrusted candidate code.
  - `Proctoring Service`: Ingestion of high-frequency proctoring telemetry.
