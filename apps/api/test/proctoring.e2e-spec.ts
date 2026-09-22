import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ProctoringService } from '../src/proctoring/proctoring.service.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Proctoring & Integrity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let candidateId: string;
  let attemptId: string;
  let sessionToken: string;
  let adminToken: string;
  let assessmentVersionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up
    await prisma.proctoringEvent.deleteMany();
    await prisma.proctoringSession.deleteMany();
    await prisma.assessmentProctoringSettings.deleteMany();
    await prisma.candidateSession.deleteMany();
    await prisma.assessmentAttempt.deleteMany();
    await prisma.assessmentInvitation.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.assessmentVersion.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.organization.deleteMany({ where: { name: 'Proctoring Org' } });

    // Seed
    const org = await prisma.organization.create({ data: { name: 'Proctoring Org', slug: 'proc-org' } });
    orgId = org.id;

    const candidate = await prisma.candidate.create({ data: { organizationId: orgId, email: 'proc@test.com', name: 'Proc' } });
    candidateId = candidate.id;

    const assessment = await prisma.assessment.create({ data: { organizationId: orgId, title: 'Proc Test', createdBy: 'admin' } });
    
    await prisma.assessmentProctoringSettings.create({
      data: {
        assessmentId: assessment.id,
        eventLoggingEnabled: true
      }
    });

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentId: assessment.id,
        versionNumber: 1,
        publishedBy: 'admin',
        snapshot: { settings: { durationMinutes: 60 }, sections: [] }
      }
    });
    assessmentVersionId = version.id;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const inv = await prisma.assessmentInvitation.create({
      data: { organizationId: orgId, candidateId, assessmentVersionId, tokenHash, expiresAt: new Date(Date.now() + 100000) }
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: { organizationId: orgId, candidateId, assessmentVersionId, invitationId: inv.id, status: 'IN_PROGRESS' }
    });
    attemptId = attempt.id;

    await prisma.proctoringSession.create({
      data: { attemptId }
    });

    const sToken = crypto.randomBytes(32).toString('hex');
    const sTokenHash = crypto.createHash('sha256').update(sToken).digest('hex');

    await prisma.candidateSession.create({
      data: { candidateId, attemptId, sessionTokenHash: sTokenHash, expiresAt: new Date(Date.now() + 100000) }
    });
    sessionToken = sToken;

    // Admin
    const user = await prisma.user.upsert({ 
      where: { email: 'admin@proc.com' },
      update: {},
      create: { email: 'admin@proc.com', password: 'hash', name: 'Admin' } 
    });
    const uToken = crypto.randomBytes(32).toString('hex');
    const uTokenHash = crypto.createHash('sha256').update(uToken).digest('hex');
    
    await prisma.userSession.create({
      data: { userId: user.id, sessionTokenHash: uTokenHash, expiresAt: new Date(Date.now() + 100000) }
    });
    adminToken = uToken;

    const role = await prisma.role.create({ data: { name: 'Admin', organizationId: orgId } });
    await prisma.organizationMember.create({ data: { userId: user.id, organizationId: orgId, roleId: role.id } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - Candidate Ingests Proctoring Events (Batch)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/proctoring/events`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .send({
        events: [
          { eventType: 'TAB_HIDDEN', timestamp: new Date().toISOString() },
          { eventType: 'COPY', timestamp: new Date().toISOString(), context: { textLength: 10 } }
        ]
      })
      .expect(201);
    
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);

    const session = await prisma.proctoringSession.findUnique({ where: { attemptId }, include: { events: true } });
    expect(session?.events.length).toBe(2);
    // Verifying logic applied correctly
    const hidden = session?.events.find(e => e.eventType === 'TAB_HIDDEN');
    expect(hidden?.severity).toBe('REVIEW_RECOMMENDED');
  });

  it('Test 2 - Candidate Event Ingestion Rejected with missing Auth', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/proctoring/events`)
      .send({ events: [] })
      .expect(401);
  });

  it('Test 3 - Recruiter Dashboard Retrieves Timeline', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/proctoring/${attemptId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200);

    expect(res.body.data.events.length).toBeGreaterThan(0);
    expect(res.body.data.events[0].eventType).toBe('TAB_HIDDEN');
  });

  it('Test 4 - Cross-Tenant Access to Timeline Denied', async () => {
    // Create another org
    const otherOrg = await prisma.organization.upsert({ 
      where: { slug: 'oth' },
      update: {},
      create: { name: 'Other', slug: 'oth' } 
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${otherOrg.id}/proctoring/${attemptId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(403); // TenantGuard kicks in
  });

  it('Test 5 - Concurrency Anomaly (Multiple Session Detection)', async () => {
    // If we validate an invitation, it should drop a MULTIPLE_SESSION event 
    // and invalidate older sessions.
    
    // First, verify current active sessions: 1
    const activeBefore = await prisma.candidateSession.count({ where: { attemptId, revokedAt: null } });
    expect(activeBefore).toBe(1);
    // Now validate the exact same attempt by creating a new active session
    // In our test, we didn't save the original token. Let's just create a new session explicitly and call the hook.
    const hookS = await prisma.candidateSession.create({
      data: { candidateId, attemptId, sessionTokenHash: 'mock', expiresAt: new Date(Date.now() + 10000) }
    });

    const proctoringService = app.get(ProctoringService);
    await proctoringService.checkConcurrencyAnomaly(attemptId, hookS.id);

    const activeAfter = await prisma.candidateSession.count({ where: { attemptId, revokedAt: null } });
    expect(activeAfter).toBe(1); // The older one was revoked

    const timeline = await proctoringService.getAttemptTimeline(orgId, attemptId);
    const multi = timeline.events.find(e => e.eventType === 'MULTIPLE_SESSION');
    expect(multi).toBeDefined();
    expect(multi?.severity).toBe('HIGH_RISK_SIGNAL');
  });
});
