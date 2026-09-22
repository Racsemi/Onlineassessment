# Security Policies

- **Encryption**: TLS 1.2+ for transit. Data at rest encrypted natively by cloud provider.
- **Session Management**: Secure, HTTP-only, SameSite cookies. Raw session tokens are never stored in the database (only Argon2 hashes).
- **Authorization**: Role-Based Access Control (RBAC). Roles are maps to specific permissions (e.g., `assessment.create`).
- **Secrets Management**: Configuration is loaded via `.env` (development) or Secrets Manager (production). Secrets NEVER enter the Git repository or client-side Next.js code (`NEXT_PUBLIC_`).
