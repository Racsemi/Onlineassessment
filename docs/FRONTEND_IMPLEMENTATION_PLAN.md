# Frontend Implementation Plan

## Current State
The frontend applications (`apps/web`, `apps/candidate`, `apps/admin`) are completely missing or contain only the default scaffolding (e.g. Next.js "To get started, edit the page.tsx file" in `apps/web`).

## Applications Required

### 1. Recruiter / Organization Portal (`apps/web`)
**Audience:** Organization Owners, Admins, Recruiters.
**Features:**
- **Authentication:** Login, Registration, Password Reset, Email Verification flow.
- **Dashboard:** Overview of active assessments and candidate statuses.
- **Assessment Builder:** Multi-section creation for MCQs and Coding questions, configuration of timers and passing criteria.
- **Proctoring Configuration:** Enable/disable camera, screen share, and event logging requirements.
- **Candidate Management:** Sending assessment invitations (single and bulk), viewing candidate scores and proctoring timeline reports.

### 2. Candidate Assessment Portal (`apps/candidate`)
**Audience:** Assessment candidates (Test-takers).
**Features:**
- **Authentication:** Token-based entry via secure email link (`/invite/:tokenHash`).
- **Lobby/Pre-check:** Hardware checks (camera, microphone permissions), instructions acknowledgment, and identity verification.
- **Test Engine:** Secure, locked-down testing environment with autosave, section timers, and code-editor capabilities (Monaco Editor).
- **Proctoring Service:** Client-side event tracking for window blurs, tab switches, copy-paste, and periodic webcam snapshots to be securely transmitted to the API.

### 3. Platform Admin Portal (`apps/admin`)
**Audience:** SaaS Platform Administrators.
**Features:**
- **Tenancy Management:** View all organizations, suspend abusive organizations, and manage global system roles.
- **Billing Management:** View Stripe synchronization statuses and platform usage metrics.
- **Health/Audit:** View system health and platform-level audit logs.

## Security Considerations
- All frontends must strictly rely on secure `HttpOnly` cookies. No session tokens should be accessible via JavaScript (`localStorage` / `sessionStorage`).
- Candidate portal must gracefully handle server-side expiration (HTTP 403) and terminate the session.
