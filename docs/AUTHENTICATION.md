# Authentication Architecture

## Overview
This document outlines the authentication and session management architecture of the platform. Authentication uses a custom, highly secure implementation based on Argon2id password hashing and stateful, revokable database sessions.

## 1. Password Security
- **Hashing Algorithm:** `argon2id`
- **Parameters:** `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`
- **Enforcement:** Minimum 8 characters.

## 2. Session Management
- **Token Generation:** 64 bytes of cryptographically secure random data (`crypto.randomBytes(64)`).
- **Storage:** Only the `SHA-256` hash of the session token is stored in the database (`UserSession` table). The raw token is returned to the client as an `HttpOnly` cookie.
- **Expiration:** Sessions auto-expire after 14 days.
- **Cookie Security:** 
  - `httpOnly: true`
  - `secure: true` (in production)
  - `sameSite: 'lax'` (to permit top-level navigation, preventing cross-site request forgery for state-changing endpoints).

## 3. Account Recovery & Verification
- **Email Verification:** A 32-byte raw token is sent via email, and its SHA-256 hash is saved. Expires in 24 hours.
- **Password Reset:** A 32-byte raw token is emailed. Expires in 1 hour. Upon successful reset, all active sessions for the user are immediately revoked.

## 4. Rate Limiting
- `POST /api/v1/auth/login` is limited to 5 requests per minute.
- `POST /api/v1/auth/reset-password` and `forgot-password` are limited to 3 requests per minute to prevent brute-forcing and enumeration.
