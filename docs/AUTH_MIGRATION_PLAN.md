# Authentication Migration Plan

## Current State
The `FINAL_DOCUMENTATION.md` implies that the system might be using JWTs. However, a deep inspection of `apps/api/src/auth/auth.service.ts` reveals that **the system already implements the approved, highly secure architecture.**

### Implementation Truth
- **Storage:** Opaque Session Tokens are generated securely using `crypto.randomBytes(64)`.
- **Database:** Only the SHA-256 hash of the session token is stored in the `UserSession` table (`sessionTokenHash`), mitigating database-leak session hijacking.
- **Password Hashing:** Passwords are securely hashed using `Argon2id` with appropriate memory and time costs.
- **Revocation:** Explicit logout and session revocation (`revokeOtherSessions`) are fully supported.
- **Delivery:** While the API correctly issues the opaque token, the missing frontend (`apps/web`) has yet to be built to store it in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.

## Migration Requirements
**No destructive rewrite is required.** The API architecture is correct.

The only remaining task (for the frontend implementation phase) is to ensure the frontend strictly utilizes `HttpOnly` cookies for token storage rather than `localStorage`.
