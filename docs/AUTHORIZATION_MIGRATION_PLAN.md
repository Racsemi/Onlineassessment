# Authorization Migration Plan

## Current State
The `FINAL_DOCUMENTATION.md` claims the use of a generic `RoleGuard`. However, the repository implementation in `apps/api/src/common/guards/` reveals a mature and correct authorization architecture.

### Implementation Truth
The system implements the approved architecture:
1. `AuthGuard`: Validates the Opaque session.
2. `TenantGuard`: Extracts `organizationId` from the route params, verifies `OrganizationMember` status in the DB, and injects tenant context into the request.
3. `PermissionsGuard`: Instead of blunt roles, endpoints use `@RequirePermissions('MANAGE_ASSESSMENTS')`. The guard resolves the user's role within that specific tenant and checks if the role possesses the required permission flags.

## Migration Requirements
**No architectural rewrite is required.** The authorization strategy is fully compliant with M4 specifications (Tenant-aware RBAC with Granular Permissions).

The documentation simply drifted out of date. We will proceed using the existing `TenantGuard` and `@RequirePermissions` decorators across all new controller routes.
