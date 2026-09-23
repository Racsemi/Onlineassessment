# Full-Fledged In-App Interview Platform: Architecture & Implementation Plan

## 1. Current Architecture Review

- **Workspace & Monorepo**: Turborepo root managing:
  - `apps/api`: NestJS 12 modular REST API.
  - `apps/web`: Next.js 16 App Router application.
  - `packages/database`: Prisma 5.22, PostgreSQL client, shared schema.
  - `packages/shared`: Shared TypeScript types, Zod schemas, validation contracts.
  - `services/worker`: Asynchronous BullMQ background worker with Docker execution sandbox for code execution and email delivery.
- **Authentication**:
  - Organization Members: HttpOnly secure cookie (`session_token`) hashed with SHA-256 in `UserSession`, passwords hashed with Argon2id.
  - Candidates: HttpOnly secure cookie (`candidate_session_token`) hashed with SHA-256 in `CandidateSession`.
- **Authorization**:
  - `AuthGuard` -> `TenantGuard` (validates `organizationId` from route param against `OrganizationMember`) -> `PermissionsGuard` (validates granular permissions via `@RequirePermissions`).
  - No `x-organization-id` header; no JWT for browser authentication; opaque sessions throughout.
- **Realtime / Queues**:
  - Redis 7 for BullMQ (`mail-queue`, `evaluation-queue`).
  - No WebSocket gateway currently configured in NestJS.
- **Hosting Model**:
  - Backend: Render Web Service (TLS termination, HTTPS/WSS, dynamic port binding, zero sticky sessions).
  - Frontend: FileZilla / cPanel upload or Next.js hosting communicating via configurable `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

---

## 2. Required Changes & Core Modules

To transform the platform into an enterprise technical recruitment and interview suite, the following core modules must be implemented:

1. **Interview Lifecycle & Scheduling Engine**:
   - Statuses: `DRAFT`, `SCHEDULED`, `CONFIRMED`, `WAITING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `EXPIRED`.
   - Recruitment Pipeline: `APPLIED` -> `SCREENING` -> `ASSESSMENT` -> `SHORTLISTED` -> `INTERVIEW` -> `TECHNICAL_ROUND` -> `HR_ROUND` -> `SELECTED` (with `REJECTED`, `ON_HOLD`, `WITHDRAWN`).
   - Drag-and-drop calendar scheduling with server-side validation against interviewer availability, working hours, existing bookings, and concurrency protection.
2. **Multi-Participant Video & Media Room**:
   - Integration with LiveKit WebRTC SFU for HD multi-party video/audio and screen sharing.
   - Pre-interview device check (camera, microphone, speaker, network).
   - Roles: `CANDIDATE`, `INTERVIEWER`, `LEAD_INTERVIEWER`, `OBSERVER`, `RECRUITER`.
3. **Realtime WebSocket Gateway**:
   - NestJS `@WebSocketGateway` backed by Redis pub/sub adapter (`@socket.io/redis-adapter`) for multi-instance Render compatibility.
   - Authenticated handshake via session cookies, room authorization, and heartbeats.
   - Realtime events: participant join/leave, chat, timer sync, questions asked, live coding, and scorecard drafts.
4. **Live Collaborative & Isolated Technical Coding**:
   - Interviewer selects or creates coding problem; sends challenge to candidate.
   - Candidate writes and executes code in isolated sandbox via BullMQ `interview-code-queue` and the worker's secure Docker runner (network: none, CPU/memory quotas).
   - Realtime synchronization of editor buffers and test results.
5. **Private Notes, Questions & Structured Scorecards**:
   - Question bank integration with categorized technical/behavioral questions.
   - Tenant-isolated private interviewer notes (never returned in candidate API responses).
   - Configurable scorecard criteria (1–5 scale, comments, recommendation: `PASS`, `FAIL`, `ON_HOLD`, `FURTHER_ROUND`).
   - Aggregated multi-interviewer feedback with audit logging.
6. **Audit Logs, Entitlements & Automated Email Notifications**:
   - Scheduled/reminder emails (24h, 1h, 15m) via BullMQ.
   - Entitlement checks on interview creation (monthly limits, concurrent active rooms).

---

## 3. Database Design (Prisma Schema Extensions)

The following models will be added to `packages/database/prisma/schema.prisma` with versioned migration:

```prisma
// Recruitment Pipeline Stage for Candidate
enum CandidatePipelineStage {
  APPLIED
  SCREENING
  ASSESSMENT
  SHORTLISTED
  INTERVIEW
  TECHNICAL_ROUND
  HR_ROUND
  SELECTED
  REJECTED
  ON_HOLD
  WITHDRAWN
}

enum InterviewStatus {
  DRAFT
  SCHEDULED
  CONFIRMED
  WAITING
  IN_PROGRESS
  PAUSED
  COMPLETED
  CANCELLED
  NO_SHOW
  EXPIRED
}

enum ParticipantRole {
  CANDIDATE
  INTERVIEWER
  LEAD_INTERVIEWER
  OBSERVER
  RECRUITER
}

enum InterviewResultOutcome {
  PASS
  FAIL
  ON_HOLD
  FURTHER_ROUND
}

model Interview {
  id               String          @id @default(uuid())
  organizationId   String
  title            String
  description      String?
  status           InterviewStatus @default(DRAFT)
  type             String          @default("TECHNICAL") // TECHNICAL, BEHAVIORAL, SYSTEM_DESIGN, SCREENING, HR
  scheduledStart   DateTime
  scheduledEnd     DateTime
  durationMinutes  Int             @default(60)
  actualStart      DateTime?
  actualEnd        DateTime?
  roomName         String          @unique // Unpredictable: rm_<id>_<randomHex>
  instructions     String?
  candidateId      String
  createdById      String
  recordingEnabled Boolean         @default(false)
  screenShareAllowed Boolean       @default(true)
  codingEnabled    Boolean         @default(true)
  resultOutcome    InterviewResultOutcome?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  organization     Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  candidate        Candidate       @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  participants     InterviewParticipant[]
  invitations      InterviewInvitation[]
  notes            InterviewNote[]
  scorecards       InterviewScorecard[]
  chatMessages     InterviewChatMessage[]
  codingSessions   InterviewCodingSession[]
  events           InterviewEvent[]
  recording        InterviewRecording?

  @@index([organizationId])
  @@index([candidateId])
  @@index([status])
  @@index([scheduledStart, scheduledEnd])
}

model InterviewParticipant {
  id             String          @id @default(uuid())
  interviewId    String
  userId         String?         // Null if candidate
  candidateId    String?         // Set if candidate
  role           ParticipantRole
  joinedAt       DateTime?
  leftAt         DateTime?
  connectionStatus String        @default("DISCONNECTED") // CONNECTED, RECONNECTING, DISCONNECTED

  interview      Interview       @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  user           User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  candidate      Candidate?      @relation(fields: [candidateId], references: [id], onDelete: Cascade)

  @@unique([interviewId, userId])
  @@unique([interviewId, candidateId])
  @@index([userId])
}

model InterviewAvailability {
  id             String       @id @default(uuid())
  organizationId String
  userId         String
  dayOfWeek      Int          // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  startTime      String       // "09:00"
  endTime        String       // "17:00"
  timezone       String       @default("UTC")
  isBlocked      Boolean      @default(false) // For time-off / exceptions
  specificDate   DateTime?    // If set, applies to a specific calendar date override

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([organizationId, userId])
}

model InterviewInvitation {
  id             String       @id @default(uuid())
  interviewId    String
  tokenHash      String       @unique // SHA-256 of candidate magic invite token
  expiresAt      DateTime
  usedAt         DateTime?
  createdAt      DateTime     @default(now())

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}

model InterviewQuestionBank {
  id             String       @id @default(uuid())
  organizationId String
  title          String
  category       String       // TECHNICAL, BEHAVIORAL, SYSTEM_DESIGN, CODING, DATABASE
  difficulty     String       // EASY, MEDIUM, HARD
  prompt         String
  expectedAnswer String?
  configuration  Json?        // For coding problems: starterCode, testCases, timeLimit
  createdAt      DateTime     @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model InterviewNote {
  id             String       @id @default(uuid())
  interviewId    String
  authorId       String
  category       String       @default("GENERAL") // GENERAL, TECHNICAL, BEHAVIORAL, CODING
  content        String
  isPrivate      Boolean      @default(true) // ALWAYS TRUE - strictly excluded from candidate endpoints
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  author         User         @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([interviewId, authorId])
}

model InterviewScorecard {
  id             String       @id @default(uuid())
  interviewId    String
  interviewerId  String
  isSubmitted    Boolean      @default(false)
  submittedAt    DateTime?
  recommendation InterviewResultOutcome?
  summary        String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  interviewer    User         @relation(fields: [interviewerId], references: [id], onDelete: Cascade)
  scores         InterviewCriterionScore[]

  @@unique([interviewId, interviewerId])
}

model InterviewCriterionScore {
  id             String             @id @default(uuid())
  scorecardId    String
  criterion      String             // e.g., "Technical Knowledge", "Problem Solving", "Communication"
  score          Int                // 1 to 5
  feedback       String?

  scorecard      InterviewScorecard @relation(fields: [scorecardId], references: [id], onDelete: Cascade)

  @@unique([scorecardId, criterion])
}

model InterviewChatMessage {
  id             String       @id @default(uuid())
  interviewId    String
  senderName     String
  senderRole     ParticipantRole
  senderUserId   String?
  senderCandidateId String?
  content        String       @db.VarChar(1000)
  createdAt      DateTime     @default(now())

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  @@index([interviewId, createdAt])
}

model InterviewCodingSession {
  id             String       @id @default(uuid())
  interviewId    String
  title          String
  description    String
  language       String       @default("javascript")
  code           String       @db.Text
  isShared       Boolean      @default(false) // Candidate-only or Collaborative
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}

model InterviewRecording {
  id             String       @id @default(uuid())
  interviewId    String       @unique
  storageKey     String       // S3/R2 path
  durationSeconds Int
  fileSizeBytes  BigInt
  status         String       @default("READY") // PROCESSING, READY, FAILED, DELETED
  recordedAt     DateTime     @default(now())

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}

model InterviewEvent {
  id             String       @id @default(uuid())
  interviewId    String
  type           String       // PARTICIPANT_JOINED, SCREEN_SHARE_STARTED, CODING_RUN, etc.
  actorName      String
  metadata       Json?
  timestamp      DateTime     @default(now())

  interview      Interview    @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  @@index([interviewId, timestamp])
}
```

---

## 4. API Design (NestJS REST Endpoints)

All organization endpoints conform to: `/api/v1/organizations/:organizationId/...` protected by `AuthGuard`, `TenantGuard`, and `PermissionsGuard`.

### Candidate Pipeline & Candidate Management:
- `GET /api/v1/organizations/:organizationId/candidates`: List candidates with pipeline filters.
- `POST /api/v1/organizations/:organizationId/candidates`: Create candidate.
- `PATCH /api/v1/organizations/:organizationId/candidates/:id/pipeline-stage`: Update pipeline stage (`candidate.update`).

### Interview Scheduling & Calendar:
- `GET /api/v1/organizations/:organizationId/interviews`: List interviews with date/status/interviewer filters.
- `POST /api/v1/organizations/:organizationId/interviews`: Create/schedule interview (`interview.create`). Validates availability and concurrent slots inside an interactive Prisma database transaction.
- `PATCH /api/v1/organizations/:organizationId/interviews/:id/reschedule`: Reschedule interview (`interview.reschedule`). Checks conflicts and updates reminders.
- `POST /api/v1/organizations/:organizationId/interviews/:id/cancel`: Cancel interview (`interview.cancel`).
- `GET /api/v1/organizations/:organizationId/interviews/calendar`: Calendar view (Day, Week, Month) aggregating availability and scheduled blocks.
- `GET /api/v1/organizations/:organizationId/interviewers/availability`: Query interviewer working hours and blocked slots.
- `PUT /api/v1/organizations/:organizationId/interviewers/availability`: Set interviewer availability.

### Room Access & Participant Credentials:
- `POST /api/v1/organizations/:organizationId/interviews/:id/room-token`: Generate short-lived LiveKit token for authenticated recruiter/interviewer.
- `GET /api/v1/organizations/:organizationId/interviews/:id/participants`: List assigned participants and live presence.
- `POST /api/v1/organizations/:organizationId/interviews/:id/participants`: Add/remove participants.

### Candidate-Facing Endpoints:
- `POST /api/v1/candidate/interviews/validate`: Validates magic invite token from email; sets `candidate_session_token` cookie.
- `GET /api/v1/candidate/interviews/details`: Retrieve interview meta, rules, instructions, and required device checklist.
- `POST /api/v1/candidate/interviews/device-check`: Log device check result (cam/mic/network).
- `POST /api/v1/candidate/interviews/room-token`: Generate candidate's restricted LiveKit room token (no secret exposure).

### In-Interview Features (Interviewer & Collaborative):
- `GET/POST /api/v1/organizations/:organizationId/interviews/:id/questions`: Manage questions asked during interview.
- `GET/POST /api/v1/organizations/:organizationId/interviews/:id/notes`: Private interviewer notes (Strictly blocked for candidates).
- `GET/PUT /api/v1/organizations/:organizationId/interviews/:id/scorecard`: Draft and submit interviewer scorecard.
- `POST /api/v1/interviews/:id/code/execute`: Run candidate code through BullMQ + Docker sandbox. Returns stdout/stderr/timeMs.
- `GET /api/v1/organizations/:organizationId/interviews/:id/recording`: Generates 15-minute signed S3 URL for authorized members.

---

## 5. Realtime WebSocket Architecture

- **Gateway**: `InterviewGateway` under `/ws/interview`.
- **Scaling & Resilience**: Backed by `@socket.io/redis-adapter` for multi-instance Render deployments.
- **Handshake Authentication**:
  - Automatically extracts and validates `session_token` or `candidate_session_token` cookie from socket handshake headers.
  - Queries DB to verify membership and participant grant for the requested `interviewId`.
  - Rejects untrusted client claims (server derives user ID, candidate ID, role, and organization ID).
- **Socket Rooms**: `interview:<interviewId>`.
- **Events Broadcasted**:
  - `participant:joined`, `participant:left`, `participant:status_change`
  - `chat:message` (server validated, HTML escaped, rate-limited)
  - `interview:timer_sync` (authoritative server clock, remaining duration)
  - `question:shared` (when interviewer exposes a question to candidate)
  - `code:sync` (code buffer change with revision counter)
  - `code:executing` / `code:result` (when code test finishes)
  - `scorecard:updated` (for multi-interviewer panel status)
- **Heartbeat & Reconnect**:
  - Socket.IO ping interval (25s) and ping timeout (20s).
  - Client implements exponential backoff (1s, 2s, 4s, max 10s) with automatic state reconciliation on reconnect.

---

## 6. WebRTC SFU Design (LiveKit)

- **Provider**: LiveKit Cloud / LiveKit SFU.
- **Client Library**: `livekit-client` and `@livekit/components-react`.
- **Separation of Concerns**:
  - Media packets (VP8/H.264 video, Opus audio) stream directly between user browsers and LiveKit SFU.
  - Render API only orchestrates tokens, permissions, and interview lifecycle state.
- **Screen Sharing**: Emits `SCREEN_SHARE_STARTED` and `SCREEN_SHARE_STOPPED` to WebSocket for audit logging and UI badge display.

---

## 7. Frontend Architecture (`apps/web`)

Next.js App Router layout with modular UI components:

```text
apps/web/src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── candidates/page.tsx
│   │   ├── interviews/
│   │   │   ├── page.tsx            # Recruiter Interview List & Filters
│   │   │   ├── calendar/page.tsx   # Drag-and-drop Day/Week/Month Scheduler
│   │   │   ├── new/page.tsx        # Booking modal with availability checks
│   │   │   └── [id]/
│   │   │       ├── room/page.tsx   # Interviewer Room
│   │   │       └── scorecard/page.tsx
│   ├── interview/
│   │   └── [token]/
│   │       ├── page.tsx            # Candidate Landing
│   │       ├── device-check/page.tsx
│   │       └── room/page.tsx       # Candidate Interview Room
├── components/
│   ├── calendar/                   # Scheduler calendar with drag/drop
│   ├── interview/
│   │   ├── VideoStage.tsx          # LiveKit Multi-party Video Grid
│   │   ├── DeviceCheck.tsx         # Media stream diagnostics
│   │   ├── InterviewControls.tsx   # Mute, Cam, Screen Share, Leave
│   │   ├── InterviewChat.tsx       # Realtime room chat
│   │   ├── CodeEditor.tsx          # Monaco Editor + Run + Language Select
│   │   ├── QuestionPanel.tsx       # Question bank & sharing
│   │   ├── PrivateNotes.tsx        # Interviewer notes
│   │   └── ScorecardModal.tsx      # Multi-criteria scorecard
```

---

## 8. Security Design & Threat Mitigation

1. **Strict Multi-Tenancy**:
   - Every interview, participant, note, and scorecard is tied to `organizationId`.
   - `TenantGuard` verifies user's active membership in `organizationId`.
2. **IDOR & BOLA Prevention**:
   - Access to `/interviews/:id/*` verifies `interview.organizationId === tenant.id`.
3. **Information Leakage Protection**:
   - `InterviewNote` records and draft scorecards are explicitly stripped from candidate API responses and candidate socket rooms.
   - Private unit test inputs/outputs are evaluated server-side and never sent to the candidate browser.
4. **Race Condition & Concurrency Defense**:
   - Simultaneous booking of the same interviewer is blocked via PostgreSQL transactions and slot overlap constraints.
5. **Cookie Security**:
   - `SameSite=Lax` or `SameSite=None` with `Secure=true` and `HttpOnly=true`. No session tokens in `localStorage`.

---

## 9. Deployment Design (Render & FileZilla)

- **Backend on Render**:
  - Process binds to `0.0.0.0:$PORT`.
  - HTTPS / WSS termination handled at Render load balancer.
  - WebSocket gateway configured with CORS origins matching client domain.
- **Frontend**:
  - Built with dynamic environment variables:
    - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
    - `NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com`
    - `NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com`
  - Zero hardcoded `localhost` references in client bundle.

---

## 10. Testing Strategy

1. **Unit Tests**:
   - Interview state machine transitions.
   - Scheduling conflict algorithms and availability calculations.
   - Scorecard calculation logic.
2. **Integration Tests**:
   - Interview scheduling, participant assignment, and concurrent double-booking rejection.
   - LiveKit token generation and grant validation.
   - Realtime WebSocket gateway authentication and room event broadcasting.
3. **E2E Tests**:
   - Full flow: Recruiter schedules interview -> Candidate joins via magic link -> Video room token issued -> Live coding executed -> Notes taken -> Scorecard submitted -> Pipeline stage updated.

---

## 11. Rollback & Disaster Recovery Strategy

- All schema additions use additive, nullable, or defaulted columns with versioned Prisma migrations (`prisma migrate dev`).
- Old assessment and candidate attempt flows are completely isolated and untouched.
- Rollback can be performed instantaneously via migration rollback or deploying previous commit without data corruption.
