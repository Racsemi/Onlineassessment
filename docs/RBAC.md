# Role-Based Access Control (RBAC)

This document outlines the RBAC implementation (Milestone 4) for the multi-tenant assessment platform.

## Authorization Flow

The core security chain for the API is deterministic and ordered:

```text
Request
  ↓
AuthGuard (Identity Verification)
  ↓
TenantGuard (Membership & Organization Verification)
  ↓
PermissionsGuard (Granular Role/Permission Verification)
  ↓
Controller
```

1. **AuthGuard**: Validates the session token, attaches `req.user`.
2. **TenantGuard**: Extracts `:organizationId` from URL, validates that the user is an `ACTIVE` member of that organization. Attaches `req.tenant` and `req.member`.
3. **PermissionsGuard**: Reads `@RequirePermissions(...)` from route metadata, loads the member's role and permissions from PostgreSQL, and ensures the member has all required permissions.

## Role Types

The system supports two distinct types of roles:

### System/Global Roles (`isSystem: true`, `organizationId: null`)
These roles are managed by the platform and cannot be modified or deleted by tenants.
- **OWNER**: Full privileges, including dangerous operations (e.g. creating/deleting custom roles, removing members).
- **ADMIN**: Administrative privileges within the organization, but cannot perform owner-only operations (e.g. deleting the final owner).
- **MEMBER**: Standard access to the platform.
- **VIEWER**: Read-only access.

### Custom Roles (`isSystem: false`, `organizationId: <uuid>`)
Organizations can create custom roles tailored to their workflow (e.g., `Technical Interviewer`, `Junior Recruiter`).
- Bound strictly to a single tenant.
- Permissions assigned must be drawn from the platform's standard permission catalog.
- Cross-tenant role assignment is strictly prohibited.

## Permissions

Permissions are the absolute authorization primitive. Controllers must not authorize based on role names.

Example Decorator:
```typescript
@RequirePermissions('member.read', 'member.invite')
@Post('members/invite')
async inviteMember(...) { ... }
```

By default, `@RequirePermissions` enforces **ALL** listed permissions (AND semantics).

## Privilege Escalation Protection

The `OrganizationsService` enforces strict checks when creating or updating custom roles:
- Users can only grant permissions that they themselves possess.
- Attempting to grant unauthorized permissions throws a `403 Forbidden` privilege escalation error.
- Only users with the `OWNER` role can assign the `OWNER` role to others.

## Last Owner Protection
The system ensures that an organization is never left without an owner. The final `OWNER` cannot be demoted, suspended, or removed.

## E2E Security Tests
A comprehensive test suite (`rbac.e2e-spec.ts`) covers all critical paths, including:
- Cross-tenant role attacks
- Global role protection
- Suspension/removal isolation
- Privilege escalation
- Strict permission compliance
