# M13 Release Blockers

Based on the full repository audit, the following critical issues definitively block the release of this software:

## CRITICAL FINDINGS

### 1. Code Runner Trust Boundary Violation
- **Location:** `services/worker/src/index.ts`
- **Issue:** The worker spawns `docker run` directly via `child_process.exec`. While it uses `--network none`, `--cpus`, `--memory`, `--user nobody`, and `--security-opt=no-new-privileges:true`, running arbitrary code via raw `exec` opens the host up to shell injection if test case inputs or language arguments aren't strictly sanitized. Furthermore, requiring the worker to run on a host with Docker socket access means any breach of the worker compromises the host. 
- **Blocker:** Shell injection risk and missing isolated code-runner microservice deployment architecture.

### 2. Missing Frontend Application
- **Location:** `apps/web`, `apps/candidate`, `apps/admin`
- **Issue:** The primary user interface (`apps/web`) is nothing but the Next.js default scaffold ("To get started, edit the page.tsx file"). The `candidate` and `admin` apps do not even exist.
- **Blocker:** The product literally cannot be used by a candidate or a recruiter.

### 3. Destructive Database Migrations
- **Location:** `packages/database/package.json`
- **Issue:** The repository lacks a `prisma/migrations` folder and uses `prisma db push`. Running this in production will forcefully overwrite the schema, leading to irreversible data loss.
- **Blocker:** No versioned migration strategy for production.

## HIGH FINDINGS

### 4. Missing Dedicated Proctoring Service
- **Location:** `services/proctoring`
- **Issue:** The directory is missing. While `apps/api/src/proctoring` ingests events and saves base64 image blobs to a local file system (`storage/evidence`), this approach is completely incompatible with a horizontally scaled, stateless API.
- **Blocker:** Saving files to the local container disk means evidence will be lost on container restart or inaccessible to other load-balanced API nodes.

### 5. Incomplete Deployment Configuration
- **Location:** `docker-compose.yml`
- **Issue:** Only orchestrates PostgreSQL and Redis. The actual API and Worker are not containerized for production deployment.
- **Blocker:** Cannot be reliably deployed to a production environment.
