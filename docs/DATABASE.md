# Database Architecture

## Schema Ownership
The Prisma schema (`schema.prisma`) is exclusively owned by `packages/database`. No frontend application is allowed to import this package or access database secrets. The API backend is the sole consumer of this package.

## Migrations
We use Prisma Migrate. Migrations are strictly applied in a controlled manner. Automatic `prisma migrate reset` is strictly forbidden in production.

## Multi-Tenancy Indexes
All tenant-owned resources contain an `organizationId` foreign key. We employ composite indexes such as `@@unique([organizationId, email])` to enforce uniqueness strictly within the bounds of a single tenant.

## Soft Deletion
Entities like `Organization` and `User` use a `status` field (`ACTIVE`, `SUSPENDED`, `DELETED`) to represent their lifecycle state instead of hard-deleting records, which helps preserve audit logs and historical integrity.
