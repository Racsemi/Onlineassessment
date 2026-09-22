# Migration Plan

## Existing Implementation

The current codebase is a single-tenant application with a basic Express backend (`server/`) and a React frontend (`client/`). The database is a single PostgreSQL instance managed via Prisma (`prisma/schema.prisma`).

## Problems & Security Risks

- **Lack of Multi-Tenancy**: Data for all potential customers is commingled. There is no `organizationId` boundary.
- **Inadequate Authorization**: The current role model (`User.role` with `ADMIN` and `SUPERADMIN`) lacks resource-level validation and granular permissions.
- **Insecure Session Management**: Relies heavily on basic JWT implementation, without tracking active sessions or enabling revocation.
- **Tightly Coupled Database**: The Prisma schema and client are intertwined with the backend application rather than encapsulated in a shared module.

## Recommended Architecture

We will shift to a **Turborepo**-based monorepo.
- **Backend**: Replace Express with **NestJS** (`apps/api`), segmented into distinct modules for Auth, Organizations, RBAC, etc.
- **Database**: Move the Prisma schema into `packages/database`. Add multi-tenancy models (`Organization`, `OrganizationMember`, `Role`, `Permission`) and scope all business records with an `organizationId`.
- **Frontend**: Move to Next.js (`apps/web`, `apps/candidate`) to support SSR and better route separation for different personas.

## Database Changes (Tenancy)

The new schema will introduce:
- `Organization`
- `OrganizationMember`
- `Role` & `Permission`
- `UserSession`
- Appending `organizationId` to existing models (`Assessment`, `Candidate`, `Question`, etc.)

## Migration Risks & Backward Compatibility

- **Data Wipe Policy**: The current data in the existing `server` is treated as **mock/development data**. We will not write a complex ETL migration script for it at this stage. Instead, we will start with a fresh, clean database schema that enforces tenant isolation. **A clean database is acceptable and preferred** to ensure no broken references occur during the transition to multi-tenancy.
- **Downtime**: As this is treated as a major version upgrade/rewrite to a new SaaS product, backward compatibility with the current exact API endpoints is not preserved.

## Testing Required

- **Tenant Isolation Tests**: Assert that a user from Org A cannot access data from Org B.
- **RBAC Tests**: Assert that specific permissions gate access correctly within an organization.
- **Session Tests**: Validate HTTP-only cookie security, login/logout, and revocation flows.
