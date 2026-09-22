# Proctoring Privacy Policy (M8)

## Overview
The integrity monitoring system is designed to provide signals regarding test conditions without functioning as unrestricted surveillance. Privacy is handled via structured policies that enforce clear boundaries.

## Candidate Consent & Transparency
1. **Explicit Configuration**: `AssessmentProctoringSettings` defines explicitly what is being collected.
   - `cameraRequired`: Boolean
   - `microphoneRequired`: Boolean
   - `screenShareRequired`: Boolean
   - `eventLoggingEnabled`: Boolean
2. **Transparency**: The frontend must present these requirements explicitly to the candidate before they begin the attempt. Silent enabling of hardware permissions is impossible due to browser sandboxing, but we also enforce transparency at the application level.

## Data Minimization
- **No Biometrics**: We do not process facial recognition, eye tracking, or emotion detection.
- **Event-Driven**: Proctoring focuses on structured event signals (`TAB_HIDDEN`, `COPY`, `PASTE`) rather than continuous monolithic screen recordings where possible.
- **Scope Limitation**: Telemetry is tightly scoped to the duration of the `AssessmentAttempt`. The `ProctoringSession` ends when the attempt is submitted.

## Evidence Retention
- **Policy Enforcement**: `evidenceRetentionDays` is configured at the assessment level (default: 30 days).
- **Deletion Rules**: Evidence (e.g. snapshots) must be purged from storage once the retention period lapses, independent of the candidate profile data.

## Access Control
- Proctoring data is physically separated from normal profile tables in the schema (`ProctoringSession` & `ProctoringEvent`).
- Only recruiters with appropriate tenant and role permissions (`TenantGuard`) can access the dashboard. Candidates cannot view other candidates' timelines.
