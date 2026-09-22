# Disaster Recovery Plan (DRP)

## Objective
Provide step-by-step instructions to restore the assessment platform to operational status in the event of partial or total catastrophic failure.

## 1. RPO and RTO Targets
- **Recovery Point Objective (RPO):** 5 minutes. The maximum acceptable data loss. Achieved via continuous Write-Ahead Log (WAL) archiving in PostgreSQL (Point-in-Time Recovery).
- **Recovery Time Objective (RTO):** 1 hour. The maximum time to restore full platform functionality in a secondary region.

## 2. Catastrophic Database Failure
*Scenario: Production PostgreSQL instance is corrupted, deleted, or inaccessible.*

1. **Acknowledge and Block Ingress:** Update DNS / CDN routing to return a static `503 Service Unavailable (Maintenance)` page to halt partial writes and state drift.
2. **Initiate PITR:** Using the cloud provider's console (e.g., AWS RDS), initiate a Point-In-Time Restore to the minute immediately preceding the corruption.
3. **Validate the Clone:** Connect to the restored database clone. Spot-check the `AuditLog` and `AssessmentAttempt` tables to verify integrity.
4. **Cutover:** Update the `DATABASE_URL` secret in the environment variables to point to the newly restored instance.
5. **Restart APIs:** Trigger a rolling restart of all API and Worker containers to establish fresh connection pools.
6. **Restore Ingress:** Remove the 503 maintenance page.

## 3. Total Region Loss
*Scenario: The primary cloud region (e.g., us-east-1) goes entirely offline.*

1. **Failover Database:** If Multi-Region replication is enabled, promote the standby region replica to Primary. If not, restore the DB from cross-region snapshot backups.
2. **Provision Infrastructure (IaC):** Run Terraform / Pulumi scripts to spin up the VPC, Redis cluster, and ECS/VM clusters in the secondary region (e.g., us-west-2).
3. **Deploy Applications:** Run the CI/CD pipeline targeting the secondary region.
4. **Update DNS:** Change the Cloudflare / Route53 apex and subdomains to point to the new load balancers.
5. **Monitor Webhooks:** Instruct Stripe to resend webhooks that failed during the outage window. `ProcessedWebhook` checks will prevent double-processing.

## 4. Storage Bucket Compromise
*Scenario: The S3 bucket containing candidate proctoring evidence is deleted or corrupted.*

1. **Halt Operations:** Pause the `services/worker` and `services/proctoring` queues.
2. **Restore from Glacier/Replication:** Access the cross-region replicated bucket or Glacier vault. 
3. **Sync:** Sync the surviving objects back to the primary bucket. Note: Evidence lost within the 15-minute replication delay is permanently lost and must be logged as a compliance incident.
4. **Resume:** Unpause queues.

## 5. Routine DR Testing
A simulated database restore must be executed and documented bi-annually. A backup that has never been successfully restored is considered non-existent.
