# Billing Security Posture

## Webhooks

We rely on **Stripe Webhooks** to update the internal subscription states. Webhooks are critical components since they authorize feature usage.

1. **Signature Verification**: Webhooks are verified using the official Stripe SDK: `stripe.webhooks.constructEvent(req.rawBody, signature, secret)`. This prevents payload tampering or forged requests.
2. **Idempotency**: Every webhook contains a unique Stripe Event ID. We store processed IDs in the `ProcessedWebhook` database table. If a duplicate event arrives (e.g. from Stripe retry mechanics or malicious replays), it is immediately rejected with `200 OK` (so Stripe stops retrying), preventing double-processing.
3. **Raw Body**: Signature verification requires the *exact byte sequence* originally sent. NestJS is configured with `RawBodyRequest` to provide access to `req.rawBody` exclusively for this route.

## Checkout and Portals

1. **No PCI Data**: Credit card numbers and CVCs are never touched by our infrastructure.
2. **Hosted Sessions**: We use `stripe.checkout.sessions.create` and `stripe.billingPortal.sessions.create`. These return a securely hosted Stripe URL. Users enter their details on Stripe's domains.
3. **Redirection**: On completion or cancellation, users are safely redirected back to the dashboard.

## Entitlements

1. **Centralization**: Plan features and usage limits are verified inside `EntitlementsService`. Individual controllers (`AssessmentsService`, `InvitationsService`) do not inspect subscription objects.
2. **Concurrency Safe**: `EntitlementsService` relies on live database counts (`prisma.assessment.count()`) instead of stale cached quantities, making it more resilient to race conditions from concurrent requests bypassing limits.
