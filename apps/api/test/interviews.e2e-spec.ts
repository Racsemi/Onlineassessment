import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';
import argon2 from 'argon2';

describe('Interviews Platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let interviewerToken: string;
  let orgBToken: string;

  let orgAId: string;
  let orgBId: string;
  let ownerId: string;
  let interviewerId: string;
  let candidateId: string;
  let interviewId: string;
  let candidateToken: string;

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

    // Clean up previous test entities
    await prisma.interviewCriterionScore.deleteMany();
    await prisma.interviewScorecard.deleteMany();
    await prisma.interviewNote.deleteMany();
    await prisma.interviewChatMessage.deleteMany();
    await prisma.interviewParticipant.deleteMany();
    await prisma.interviewInvitation.deleteMany();
    await prisma.interview.deleteMany();

    const emails = ['recruiter@racsemi.test', 'interviewer@racsemi.test', 'other_org@racsemi.test'];
    await prisma.organizationMember.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Seed Orgs
    const orgA = await prisma.organization.create({
      data: { name: 'Acme Corp', slug: `acme-${Date.now()}` },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: 'Beta Corp', slug: `beta-${Date.now()}` },
    });
    orgBId = orgB.id;

    let ownerRole = await prisma.role.findFirst({ where: { name: 'OWNER', isSystem: true } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({ data: { name: 'OWNER', isSystem: true, description: 'Owner' } });
    }
    let memberRole = await prisma.role.findFirst({ where: { name: 'MEMBER', isSystem: true } });
    if (!memberRole) {
      memberRole = await prisma.role.create({ data: { name: 'MEMBER', isSystem: true, description: 'Member' } });
    }

    const passwordHash = await argon2.hash('Password123!');

    // Create Recruiter (Owner of Org A)
    const owner = await prisma.user.create({
      data: { email: 'recruiter@racsemi.test', name: 'Alice Recruiter', password: passwordHash },
    });
    ownerId = owner.id;
    await prisma.organizationMember.create({
      data: { organizationId: orgAId, userId: ownerId, roleId: ownerRole.id },
    });

    ownerToken = 'session_owner_token_' + Date.now();
    await prisma.userSession.create({
      data: {
        userId: ownerId,
        sessionTokenHash: crypto.createHash('sha256').update(ownerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Create Interviewer (Member of Org A)
    const interviewer = await prisma.user.create({
      data: { email: 'interviewer@racsemi.test', name: 'Bob Engineer', password: passwordHash },
    });
    interviewerId = interviewer.id;
    await prisma.organizationMember.create({
      data: { organizationId: orgAId, userId: interviewerId, roleId: ownerRole.id },
    });

    interviewerToken = 'session_interviewer_token_' + Date.now();
    await prisma.userSession.create({
      data: {
        userId: interviewerId,
        sessionTokenHash: crypto.createHash('sha256').update(interviewerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Create Org B user
    const orgBUser = await prisma.user.create({
      data: { email: 'other_org@racsemi.test', name: 'Charlie Other', password: passwordHash },
    });
    await prisma.organizationMember.create({
      data: { organizationId: orgBId, userId: orgBUser.id, roleId: ownerRole.id },
    });

    orgBToken = 'session_orgb_token_' + Date.now();
    await prisma.userSession.create({
      data: {
        userId: orgBUser.id,
        sessionTokenHash: crypto.createHash('sha256').update(orgBToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Create Candidate in Org A
    const candidate = await prisma.candidate.create({
      data: {
        organizationId: orgAId,
        name: 'Jane Candidate',
        email: `candidate_${Date.now()}@test.com`,
        pipelineStage: 'APPLIED',
      },
    });
    candidateId = candidate.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Recruiter schedules an interview and assigns interviewer', async () => {
    const start = new Date(Date.now() + 3600000); // 1 hr in future
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hr duration

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({
        candidateId,
        title: 'Senior Backend Engineering Interview',
        description: 'System design and live coding evaluation',
        type: 'TECHNICAL',
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        durationMinutes: 60,
        interviewerIds: [interviewerId],
        leadInterviewerId: interviewerId,
        codingEnabled: true,
        screenShareAllowed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Senior Backend Engineering Interview');
    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.roomName).toContain('rm_int_');
    expect(res.body.participants).toHaveLength(2); // Candidate + Interviewer

    interviewId = res.body.id;

    // Verify candidate pipeline stage updated
    const candidateRecord = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(candidateRecord?.pipelineStage).toBe('INTERVIEW');
  });

  it('2. Prevents double-booking: scheduling overlapping interview for same interviewer fails with 409', async () => {
    const existing = await prisma.interview.findUnique({ where: { id: interviewId } });
    const start = new Date(existing!.scheduledStart.getTime() + 10 * 60 * 1000); // starts 10 mins after
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // Create second candidate
    const candidate2 = await prisma.candidate.create({
      data: { organizationId: orgAId, name: 'John Doe', email: `john_${Date.now()}@test.com` },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({
        candidateId: candidate2.id,
        title: 'Conflict Test Interview',
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        durationMinutes: 60,
        interviewerIds: [interviewerId],
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already has an interview booked');
  });

  it('3. Reschedules interview to a non-conflicting time slot', async () => {
    const newStart = new Date(Date.now() + 5 * 3600000);
    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/interviews/${interviewId}/reschedule`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({
        scheduledStart: newStart.toISOString(),
        scheduledEnd: newEnd.toISOString(),
        reason: 'Candidate requested time change',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
    expect(new Date(res.body.scheduledStart).getTime()).toBe(newStart.getTime());
  });

  it('4. Multi-tenancy isolation: Org B user cannot access Org A interview (403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/interviews/${interviewId}`)
      .set('Cookie', [`session_token=${orgBToken}`]);

    expect(res.status).toBe(403);
  });

  it('5. Generates signed LiveKit room token for assigned interviewer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews/${interviewId}/room-token`)
      .set('Cookie', [`session_token=${interviewerToken}`]);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.roomName).toContain('rm_int_');
    expect(res.body.serverUrl).toBeDefined();
  });

  it('6. Candidate validates magic invitation token and receives session cookie', async () => {
    // Find invitation token in DB
    const invitation = await prisma.interviewInvitation.findFirst({
      where: { interviewId },
    });
    expect(invitation).toBeDefined();

    // Since tokenHash is SHA-256 of raw token, let's create a test token
    const testRawToken = 'magic_token_' + Date.now();
    const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');

    await prisma.interviewInvitation.update({
      where: { id: invitation!.id },
      data: { tokenHash: testTokenHash },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/candidate/interviews/validate')
      .send({ token: testRawToken });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.interview.id).toBe(interviewId);

    // Verify cookie was issued
    const cookies = res.headers['set-cookie'] as any;
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c: string) => c.startsWith('candidate_session_token='));
    expect(sessionCookie).toBeDefined();
    candidateToken = sessionCookie.split(';')[0].split('=')[1];
  });

  it('7. Candidate retrieves interview details and room token', async () => {
    const detailsRes = await request(app.getHttpServer())
      .get(`/api/v1/candidate/interviews/${interviewId}/details`)
      .set('Cookie', [`candidate_session_token=${candidateToken}`]);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.title).toBe('Senior Backend Engineering Interview');

    const tokenRes = await request(app.getHttpServer())
      .post(`/api/v1/candidate/interviews/${interviewId}/room-token`)
      .set('Cookie', [`candidate_session_token=${candidateToken}`]);

    expect(tokenRes.status).toBe(201);
    expect(tokenRes.body.token).toBeDefined();
    expect(tokenRes.body.roomName).toContain('rm_int_');
  });

  it('8. Interviewer takes private notes (strictly hidden from candidate)', async () => {
    const noteRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews/${interviewId}/notes`)
      .set('Cookie', [`session_token=${interviewerToken}`])
      .send({
        category: 'TECHNICAL',
        content: 'Strong grasp of distributed systems and caching layers.',
      });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.content).toContain('Strong grasp');
    expect(noteRes.body.isPrivate).toBe(true);

    // Verify candidate details endpoint does not leak notes
    const candRes = await request(app.getHttpServer())
      .get(`/api/v1/candidate/interviews/${interviewId}/details`)
      .set('Cookie', [`candidate_session_token=${candidateToken}`]);

    expect(candRes.body.notes).toBeUndefined();
  });

  it('9. Live code execution in interview returns stdout and execution time', async () => {
    const codeRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews/${interviewId}/code/execute`)
      .set('Cookie', [`session_token=${interviewerToken}`])
      .send({
        language: 'javascript',
        code: 'const nums = [1, 2, 3, 4]; console.log("SUM:", nums.reduce((a, b) => a + b, 0));',
      });

    expect(codeRes.status).toBe(201);
    expect(codeRes.body.stdout).toContain('SUM: 10');
    expect(codeRes.body.status).toBe('SUCCESS');
    expect(codeRes.body.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('10. Interviewer submits scorecard with criteria ratings and recommendation', async () => {
    const scorecardRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/interviews/${interviewId}/scorecards`)
      .set('Cookie', [`session_token=${interviewerToken}`])
      .send({
        recommendation: 'PASS',
        summary: 'Excellent candidate, demonstrated strong problem solving skills.',
        scores: [
          { criterion: 'Technical Knowledge', score: 5, feedback: 'Deep understanding of Node/Nest' },
          { criterion: 'Problem Solving', score: 4, feedback: 'Clean algorithmic approach' },
          { criterion: 'Communication', score: 5, feedback: 'Articulate and clear' },
        ],
      });

    expect(scorecardRes.status).toBe(201);
    expect(scorecardRes.body.isSubmitted).toBe(true);
    expect(scorecardRes.body.recommendation).toBe('PASS');
    expect(scorecardRes.body.scores).toHaveLength(3);

    // Verify interview status transitioned to COMPLETED
    const interviewRecord = await prisma.interview.findUnique({ where: { id: interviewId } });
    expect(interviewRecord?.status).toBe('COMPLETED');
    expect(interviewRecord?.resultOutcome).toBe('PASS');
  });

  it('11. Recruiter moves candidate to next recruitment pipeline stage (SELECTED)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/interviews/candidates/${candidateId}/pipeline-stage`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ pipelineStage: 'SELECTED' });

    expect(res.status).toBe(200);
    expect(res.body.pipelineStage).toBe('SELECTED');
  });
});
