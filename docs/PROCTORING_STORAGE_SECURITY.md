# Proctoring Storage Security

## Current State
The `proctoring.service.ts` within `apps/api` ingests `EVIDENCE_UPLOAD` events containing `base64` image data. It decodes this data and stores it on the local container file system at `storage/evidence/`. 

## Why it is dangerous
1. **Data Loss:** Containers are ephemeral. If the API container restarts or scales down, all local evidence is permanently lost.
2. **Horizontal Scaling Breakage:** If multiple API nodes exist behind a load balancer, a recruiter requesting evidence might hit `API Node B`, while the image is physically stored on `API Node A`, resulting in a `404 Not Found`.
3. **Storage Exhaustion:** Base64 images can quickly fill up the local disk of a container, leading to a Denial of Service (DoS).

## Proposed Secure Architecture (Object Storage)
Proctoring evidence must be strictly isolated to cloud Object Storage (e.g., AWS S3, Cloudflare R2).

### Implementation Workflow
1. **Direct Upload (Recommended):** The API provides a short-lived Pre-Signed URL to the `apps/candidate` frontend. The frontend uploads the evidence blob directly to S3. This keeps high-bandwidth media traffic completely off the API nodes.
2. **Access Control:** The S3 bucket must be strictly **private**. No public read access.
3. **Retrieval:** When a recruiter views the timeline in `apps/web`, the API generates a short-lived Pre-Signed URL (e.g. 15 minutes) to securely serve the image directly from S3.
4. **Encryption:** S3 Default Encryption (SSE-S3) must be enabled.
5. **Retention:** Configure an Object Lifecycle Policy to automatically delete evidence 30 days after assessment completion (or in accordance with GDPR data minimalization requirements).

## Required Changes
- Remove `fs.writeFile` from `proctoring.service.ts`.
- Introduce `storage.service.ts` wrapping the AWS S3 SDK.
- Update `proctoring.service.ts` to return upload/download Signed URLs.
