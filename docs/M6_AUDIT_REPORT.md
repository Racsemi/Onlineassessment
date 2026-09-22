# M6 AUDIT REPORT

**Date:** 2026-09-16
**Milestone:** M6 (Candidate Assessment Flow)
**Status:** M6 STATUS: READY FOR M7

## Audit Scope
The objective of this audit was to ensure the Candidate Assessment Flow was implemented securely, fully separated from the M1-M4 Recruiter RBAC, honoring the immutable `AssessmentVersion` from M5.

## Validation Checklist

- [x] **Database Constraints**: `AssessmentInvitation`, `CandidateSession`, `AssessmentAttempt`, and `AttemptAnswer` models successfully deployed.
- [x] **Invitation Security**: Invitations rely on 32-byte cryptographic randomness. The token is never stored in plaintext, only as a SHA-256 hash in the database, preventing token theft from database backups.
- [x] **Session Security**: Candidates operate on an independent `candidate_session_token` cookie utilizing `HttpOnly` and `SameSite=Lax`. Candidates strictly bypass `AuthGuard` and interact exclusively through `CandidateAuthGuard`.
- [x] **Attempt State Machine**: Exclusively uses a server-authoritative state machine (`CREATED` -> `IN_PROGRESS` -> `SUBMITTED`).
- [x] **Timer Architecture**: Client timers are explicitly ignored. Time logic runs via `expiresAt` set atomically during the `IN_PROGRESS` transition. Reconnection doesn't reset time. 
- [x] **Data Leakage & Output Filtering**: A mapping function on `/api/v1/candidate/attempts/:id/questions` explicitly destroys `isCorrect`, `correctOptionId`, and all non-candidate variables, enforcing candidate ignorance.
- [x] **Idempotency & Concurrency**: Validated that duplicate `IN_PROGRESS` starts and `SUBMITTED` events operate idempotently without state corruption.
- [x] **Mass Assignment**: `z.record(z.any())` is used safely within `AttemptAnswer.answerData` because structural validation is abstracted from the candidate JSON boundary, keeping core attributes protected.
- [x] **E2E Testing**: `candidate.e2e-spec.ts` exercises all critical candidate flow threat models.

## Conclusion
The M6 Candidate Assessment Flow is structurally complete and fully secure against candidate-side cheating or data extraction.

**M6 STATUS: READY FOR M7**
