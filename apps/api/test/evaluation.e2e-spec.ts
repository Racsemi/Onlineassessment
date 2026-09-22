import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';
import { Queue } from 'bullmq';

describe('Evaluation & Reporting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let attemptId: string;
  let assessmentId: string;
  let adminToken: string;

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

    await prisma.attemptResult.deleteMany();
    await prisma.evaluationResult.deleteMany();
    await prisma.attemptAnswer.deleteMany();
    await prisma.assessmentAttempt.deleteMany();
    await prisma.assessmentVersion.deleteMany();
    await prisma.assessmentQuestion.deleteMany();
    await prisma.assessmentSection.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.organization.deleteMany({ where: { slug: 'eval-org' } });

    const org = await prisma.organization.create({ data: { name: 'Eval Org', slug: 'eval-org' } });
    orgId = org.id;

    const assessment = await prisma.assessment.create({ data: { organizationId: orgId, title: 'Eval Test', createdBy: 'admin' } });
    assessmentId = assessment.id;

    const section = await prisma.assessmentSection.create({
      data: { assessmentId: assessment.id, title: 'S1', displayOrder: 1 }
    });

    const q1 = await prisma.assessmentQuestion.create({
      data: { sectionId: section.id, type: 'MCQ_SINGLE', prompt: 'Q1', points: 10, displayOrder: 1 }
    });
    const o1Correct = await prisma.questionOption.create({
      data: { questionId: q1.id, text: 'Correct', displayOrder: 1, isCorrect: true }
    });
    
    const q2 = await prisma.assessmentQuestion.create({
      data: { sectionId: section.id, type: 'SHORT_ANSWER', prompt: 'Q2', points: 20, displayOrder: 2, configuration: { expectedAnswer: 'hello world' } }
    });

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentId: assessment.id,
        versionNumber: 1,
        publishedBy: 'admin',
        snapshot: { 
          settings: { durationMinutes: 60, passingScore: 50 }, 
          sections: [{
            id: section.id,
            questions: [
              { id: q1.id, type: 'MCQ_SINGLE', points: 10, options: [{ id: o1Correct.id, isCorrect: true }] },
              { id: q2.id, type: 'SHORT_ANSWER', points: 20, configuration: { expectedAnswer: 'hello world' } }
            ]
          }] 
        }
      }
    });

    const candidate = await prisma.candidate.create({ data: { organizationId: orgId, email: 'eval@test.com', name: 'Eval' } });
    
    const inv = await prisma.assessmentInvitation.create({
      data: { organizationId: orgId, candidateId: candidate.id, assessmentVersionId: version.id, tokenHash: 't', expiresAt: new Date(Date.now() + 100000) }
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: { organizationId: orgId, candidateId: candidate.id, assessmentVersionId: version.id, invitationId: inv.id, status: 'SUBMITTED' }
    });
    attemptId = attempt.id;

    // Seed answers
    await prisma.attemptAnswer.createMany({
      data: [
        { attemptId, questionId: q1.id, answerData: { optionId: o1Correct.id } }, // Correct
        { attemptId, questionId: q2.id, answerData: { text: 'hello WORLD ' } } // Correct (case-insensitive trim)
      ]
    });

    const user = await prisma.user.create({ data: { email: 'admineval@proc.com', password: 'hash', name: 'Admin' } });
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

  it('Test 1 - Process Evaluation Job directly (Worker logic)', async () => {
    const { processJob } = await import('../../../services/worker/src/index.js');
    
    const res = await processJob({ name: 'evaluate-attempt', data: { attemptId } } as any);
    
    expect(res).toBeDefined();
    expect((res as any).score).toBe(30);
    expect((res as any).percentage).toBe(100);
    expect((res as any).status).toBe('PASSED');

    const result = await prisma.attemptResult.findUnique({ where: { attemptId } });
    expect(result).toBeDefined();
    expect(result?.score).toBe(30);
    expect(result?.status).toBe('PASSED');
  });

  it('Test 2 - Recruiter Assessment Analytics Endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/reports/assessments/${assessmentId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.completedAttempts).toBe(1);
    expect(res.body.data.averageScore).toBe(100);
    expect(res.body.data.passRate).toBe(100);
  });

  it('Test 3 - Recruiter Detailed Attempt Report', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/reports/attempts/${attemptId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200);

    expect(res.body.data.result.score).toBe(30);
    expect(res.body.data.evaluationResults.length).toBe(2);
  });

  it('Test 4 - Recruiter Export Endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/reports/attempts/${attemptId}/export`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200);

    expect(res.body.metadata.type).toBe('DETAILED_REPORT');
    expect(res.body.data.result.percentage).toBe(100);
  });
});
