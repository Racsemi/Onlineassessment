# Proctoring Security Model (M8)

## Architecture
The proctoring system intercepts telemetry asynchronously using a dedicated API module (`ProctoringModule`).

## Threat Mitigations

### 1. Cross-Tenant Evidence Access (IDOR)
- **Vector**: A recruiter attempts to view `evidenceUrl` for a candidate in a different organization.
- **Mitigation**: The endpoint `/organizations/:orgId/proctoring/evidence/:eventId` enforces `TenantGuard`. The service explicitly verifies that the `attempt` linked to the `eventId` belongs to the authenticated `orgId`.

### 2. Event Spoofing & Fake Timestamps
- **Vector**: A candidate manually hits `POST /events` with fabricated timestamps to hide a gap where they cheated.
- **Mitigation**: 
  - The API relies on the server timestamp `new Date()` upon ingestion to guarantee chronological integrity in the DB.
  - Events are strictly scoped to the candidate's active `CandidateSessionToken`.

### 3. Multiple Session Anomalies
- **Vector**: A candidate logs in on a laptop and a phone simultaneously, using the phone to browse while the laptop runs the test.
- **Mitigation**: The `warn_and_invalidate` policy is enforced. When a second session is spawned for the same attempt, older sessions are immediately revoked (`revokedAt = new Date()`), and a `MULTIPLE_SESSION` (High Risk) event is dropped onto the proctoring timeline.

### 4. Storage Security (Evidence)
- **Vector**: Public access to screenshots or webcam blobs.
- **Mitigation**: 
  - Blobs are stored in a private directory (`storage/evidence`).
  - They are never served as static assets.
  - Access is brokered exclusively through the protected API endpoint which streams the buffer.

### 5. Event Flooding (DoS)
- **Vector**: A candidate sends millions of events per second to crash the DB.
- **Mitigation**: 
  - Batched ingestion (`IngestEventsDto` caps at 50 events per request).
  - Global `ThrottlerModule` limits API requests per IP/Session.
