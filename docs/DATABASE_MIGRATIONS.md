# Database Migrations

## Current State
The repository uses `npx prisma db push` (via `npm run db:push`) to synchronize the database schema. The `packages/database/prisma/migrations` folder does not exist.

## Why `db push` is Dangerous in Production
`prisma db push` forces the database schema to match the Prisma file without retaining a safe execution history. If a field is renamed or removed, `db push` can silently drop the column, resulting in irreversible data loss.

## Proposed Strategy

### 1. Development (Local)
Engineers will use:
```bash
npx prisma migrate dev --name <migration_name>
```
This generates immutable SQL migration files that define the exact alterations applied.

### 2. CI/CD Validation
The CI pipeline will run:
```bash
npx prisma migrate status
```
to ensure all migrations apply cleanly against a shadow database without drift.

### 3. Production Deployment
The production deployment step will exclusively use:
```bash
npx prisma migrate deploy
```
This ensures safe, ordered, and idempotent SQL execution. 

## Next Steps for Remediation
1. Run `npx prisma migrate dev --name init` against a fresh local database to baseline the existing M1-M12 schema into a single `01_init.sql` migration.
2. Update all deployment scripts and `package.json` to enforce `migrate deploy`.
