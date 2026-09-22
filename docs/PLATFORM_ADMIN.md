# Platform Administration

## Overview
Platform Administration (`/api/v1/platform/*`) acts as an overarching management layer, structurally isolated from tenant-level operations (`/api/v1/organizations/*`). This isolates standard multi-tenant boundaries from superuser administration.

## Trust Boundary

**Tenant Roles**: `OWNER`, `ADMIN`, `MEMBER`.
**Platform Role**: `isPlatformAdmin`.

An `OWNER` of a tenant organization has completely unrestricted access **inside** their own organization, but zero access to the Platform layer.

A `Platform Admin` has access to the `/platform` endpoints, but notably, they are **not automatically members of any tenant organizations**. If a Platform Admin attempts to hit `/api/v1/organizations/:id/assessments`, they will be blocked by `TenantGuard` unless they explicitly invite themselves into that organization (which leaves an audit trail).

## Endpoints

- `GET /api/v1/platform/organizations`: Aggregated overview of all tenants, billing statuses, and member counts.
- `GET /api/v1/platform/organizations/:id`: Deep dive into a specific tenant.
- `POST /api/v1/platform/organizations/:id/suspend`: Instantly locks out all users of an organization. This triggers an immutable `AuditLog` entry tying the Platform Admin ID to the action.
- `GET /api/v1/platform/audit-logs`: Global investigation endpoint for security and compliance operations.
