# Email and Notification System (M10)

## Overview
The application uses an asynchronous, resilient messaging architecture to send all notifications. This ensures that slow email providers do not degrade the performance or reliability of the core API.

## Architecture

```mermaid
graph TD
    API[API (e.g. AuthService)]
    N[NotificationsService]
    Q[(BullMQ: mail-queue)]
    W[Worker: processEmailJob]
    P[EmailProvider]

    API --> N
    N --> Q
    Q --> W
    W --> P
```

### 1. NotificationsService
Provides a unified interface (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendAssessmentInvitation`, `sendAssessmentSubmitted`) to abstract away the underlying queue payload generation.

### 2. BullMQ (`mail-queue`)
All jobs are pushed to `mail-queue` with:
- `attempts: 3`
- `backoff: exponential (1000ms base)`
- Idempotency Keys (e.g., `jobId: invitation:<id>`) for operations that should never be sent twice.

### 3. Providers
We use the Strategy pattern for `EmailProvider`:
- **`MockEmailProvider`**: Used in non-production environments to avoid accidental spam and protect tokens from leaking. It safely sanitizes console output.
- **`SmtpEmailProvider`**: Uses standard NodeMailer for production SMTP delivery.

## Supported Templates
- **Verification**: Sent immediately upon Registration.
- **Password Reset**: Triggered via reset-password flow.
- **Assessment Invitation**: Pushed by recruiter, delivers a tokenized Magic Link.
- **Assessment Submitted**: Auto-triggered when candidate successfully completes attempt.
