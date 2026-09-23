# Interview Media Architecture & WebRTC SFU Specification

## 1. Executive Summary & Provider Selection

For a production-grade enterprise technical recruitment platform supporting multi-party video/audio, screen sharing, and recording across arbitrary client networks, **LiveKit** is selected as the WebRTC SFU (Selective Forwarding Unit) media provider.

### Why LiveKit Over Alternatives (Agora, Twilio Video, Daily, Raw Mesh WebRTC):
- **Raw WebRTC Mesh (P2P)**: Requires $N \times (N-1)$ streams. With 1 candidate, 2 technical interviewers, and 1 recruiter observer ($N=4$), each client must encode and upload 3 video streams simultaneously. This causes catastrophic packet loss, high CPU throttling, and connection dropouts on standard home broadband or laptops.
- **Twilio Video**: Deprecated and shut down.
- **Agora / Daily**: Proprietary closed ecosystems with vendor lock-in and high per-minute cost curves.
- **LiveKit (Chosen)**: 
  - Industry standard open-source SFU core with open protocols and SDKs (`livekit-server-sdk`, `@livekit/components-react`, `livekit-client`).
  - Architecture decoupling: media traffic is routed directly between browsers and SFU edge nodes, keeping heavy video streams off the NestJS Render API server.
  - Zero server secrets on client: tokens are ephemeral, cryptographically signed JWTs issued solely by the NestJS backend after strict tenant and participant verification.
  - Hybrid deployment flexibility: Can run seamlessly against **LiveKit Cloud** or self-hosted **LiveKit SFU Docker container** in any region.

---

## 2. Media Architecture Diagram

```text
┌─────────────────────────┐           ┌─────────────────────────┐
│  Candidate Browser      │           │  Interviewer Browser    │
│  (@livekit/components)  │           │  (@livekit/components)  │
└───────────┬─────────────┘           └───────────┬─────────────┘
            │                                     │
    Publish WebRTC Track                  Publish WebRTC Track
    Subscribe Tracks                      Subscribe Tracks
            │                                     │
            └───────────────┐     ┌───────────────┘
                            ▼     ▼
               ┌───────────────────────────────┐
               │    LiveKit WebRTC SFU         │
               │    (Media Switching & Relays) │
               └───────────────┬───────────────┘
                               │
                Egress / Composite Recording
                               │
                               ▼
               ┌───────────────────────────────┐
               │    Object Storage (S3 / R2)   │
               │    (Encrypted Audio/Video)    │
               └───────────────────────────────┘
                               ▲
                               │ Signed URLs
┌──────────────────────────────┴───────────────┐
│ NestJS Render API (Port 5000)                │
│ - Issues short-lived LiveKit Room Tokens     │
│ - Enforces TenantGuard & Participant Grants  │
│ - Authoritative for Interview State & Sync   │
└──────────────────────────────────────────────┘
```

---

## 3. Room Creation & Naming Policy

1. **Unpredictable Room Identity**:
   - Rooms are never named using sequential IDs (e.g. `room_1`, `int_123`).
   - Format: `rm_<interviewId>_<randomHex>` (e.g., `rm_cm72a8d9_f839a04bd821`).
2. **Server-Side Room Management**:
   - The NestJS API uses `RoomServiceClient` from `livekit-server-sdk` to manage room lifecycles.
   - Rooms are automatically closed upon interview conclusion or status transition to `COMPLETED` / `CANCELLED`.
   - Max participants and empty room timeouts (`emptyTimeout: 300` seconds) are enforced.

---

## 4. Token Generation & Participant Permission Grants

The frontend NEVER receives or stores the `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET`.

When a user joins an interview room:
1. User passes authentication (`AuthGuard` for members or `CandidateAuthGuard` for candidates).
2. `TenantGuard` verifies organization context.
3. System verifies participant record in `InterviewParticipant` table.
4. NestJS generates a short-lived token (TTL: 10–30 minutes, refreshable via WebSocket/REST).

### Participant Grant Matrix:

| Role | `canPublish` (Cam/Mic) | `canPublishSources` (ScreenShare) | `canSubscribe` | `hidden` (Ghost) | `roomAdmin` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CANDIDATE** | Yes | Configurable (Default: Yes) | Yes | No | No |
| **INTERVIEWER** | Yes | Yes | Yes | No | Yes |
| **LEAD_INTERVIEWER** | Yes | Yes | Yes | No | Yes |
| **OBSERVER** | Configurable (Default: No) | No | Yes | Configurable | No |
| **RECRUITER** | Yes | Yes | Yes | No | Yes |

Sample Token Creation in NestJS:
```typescript
import { AccessToken } from 'livekit-server-sdk';

export function generateInterviewToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'LEAD_INTERVIEWER' | 'OBSERVER' | 'RECRUITER';
  screenShareAllowed: boolean;
}): string {
  const at = new AccessToken(params.apiKey, params.apiSecret, {
    identity: params.participantIdentity,
    name: params.participantName,
    ttl: '1h',
  });

  const isInterviewer = ['INTERVIEWER', 'LEAD_INTERVIEWER', 'RECRUITER'].includes(params.role);
  const isObserver = params.role === 'OBSERVER';

  at.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: !isObserver,
    canPublishData: true,
    canSubscribe: true,
    canPublishSources: params.screenShareAllowed 
      ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
      : ['camera', 'microphone'],
    roomAdmin: isInterviewer,
  });

  return at.toJwt();
}
```

---

## 5. Reconnection & Network Resilience

- **ICE Restarts**: LiveKit client natively handles ICE disconnects, temporary network drops, and IP route shifts (e.g. WiFi to Cellular) with automatic ICE restarts without dropping room state.
- **Adaptive Stream & Simulcast**: Multi-layer video simulcast (1080p / 720p / 360p / 180p) automatically downscales publication resolution and bitrate for bandwidth-constrained participants without degrading stream quality for other participants.
- **WebSocket Fallback**: If UDP/WebRTC traffic is blocked by strict enterprise corporate firewalls, LiveKit supports TURN over TLS (port 443) and WebSockets fallback.

---

## 6. Interview Recording Architecture

1. **Composite Egress**:
   - Uses LiveKit Egress to generate composite grid layouts containing:
     - Active speaker video
     - Screen share presentation (if active)
     - Multi-participant video strip
     - Synchronized stereo audio
2. **Secure Destination**:
   - Direct upload to private AWS S3 / Cloudflare R2 bucket.
   - Files are stored with server-side encryption (`AES-256` or `KMS`).
3. **Audited Access Control**:
   - No direct public URLs are ever stored or exposed.
   - Backend exposes `/api/v1/organizations/:organizationId/interviews/:id/recording`, which checks `interview.recording.view` permission, verifies tenant ownership, and generates a short-lived (15-minute) pre-signed download URL.
   - Access is recorded in `AuditLog` (`RECORDING_ACCESSED`).

---

## 7. Security & Compliance

1. **Zero Secret Leakage**:
   - `LIVEKIT_API_SECRET` and S3 bucket credentials exist only in backend environment variables.
2. **Cryptographic Verification**:
   - LiveKit tokens are signed with HMAC-SHA256 and checked at SFU boundary.
3. **Room Isolation**:
   - Tokens are scoped strictly to `roomName`. A token for `room_A` cannot access `room_B`.
4. **Tenant Isolation**:
   - Room tokens are only minted after validating organization tenancy in the database.
