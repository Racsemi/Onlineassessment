# Tenancy Architecture

The SaaS uses a pool-based multi-tenancy model. 

## Relationships
```text
User
  ↓ (1:M)
OrganizationMember
  ↓ (M:1)
Organization
```

A single `User` account can belong to multiple `Organization`s. There is no `User.organizationId`. Instead, when a user acts upon a resource, the API verifies their `OrganizationMember` status and role for the target `organizationId`.

## Tenant-Owned Resources
All operational resources (Assessments, Candidates, Questions, Results) contain an `organizationId` and belong to the Organization, not the User. When a user leaves an organization, the data remains.
