import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Candidate Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let candidateId: string;
  let assessmentId: string;
  let assessmentVersionId: string;
  
  let validInviteToken: string;
  let sessionToken: string;
  let attemptId: string;
  let questionId: string;

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
    await prisma.attemptAnswer.deleteMany();
    await prisma.candidateSession.deleteMany();
    await prisma.assessmentAttempt.deleteMany();
    await prisma.assessmentInvitation.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.assessmentVersion.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.organization.deleteMany({ where: { name: 'Candidate Org' } });
    
    // Seed Org
    const org = await prisma.organization.create({
      data: { name: 'Candidate Org', slug: 'candidate-org' }
    });
    orgId = org.id;

    // Seed Candidate
    const candidate = await prisma.candidate.create({
      data: { organizationId: orgId, email: 'candidate@test.com', name: 'Test Candidate' }
    });
    candidateId = candidate.id;

    // Seed Assessment & Version
    const assessment = await prisma.assessment.create({
      data: { organizationId: orgId, title: 'Test Test', createdBy: 'admin', status: 'PUBLISHED' }
    });
    assessmentId = assessment.id;

    questionId = crypto.randomUUID();

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentId,
        versionNumber: 1,
        publishedBy: 'admin',
        snapshot: {
          settings: { durationMinutes: 60, shuffleQuestions: false },
          sections: [
            {
              id: crypto.randomUUID(),
              title: 'Section 1',
              displayOrder: 1,
              questions: [
                {
                  id: questionId,
                  type: 'MCQ_SINGLE',
                  prompt: '1 + 1?',
                  points: 1,
                  displayOrder: 1,
                  required: true,
                  options: [
                    { id: 'o1', text: '2', displayOrder: 1, isCorrect: true },
                    { id: 'o2', text: '3', displayOrder: 2, isCorrect: false },
                  ]
                }
              ]
            }
          ]
        }
      }
    });
    assessmentVersionId = version.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - Invalid invitation token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidate/invitations/validate')
      .send({ token: 'invalid_token_which_is_thirty_two_bytes' })
      .expect(401);
  });

  it('Test 2 - Valid invitation creates session and CREATED attempt', async () => {
    validInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(validInviteToken).digest('hex');

    const inv = await prisma.assessmentInvitation.create({
      data: {
        organizationId: orgId,
        candidateId,
        assessmentVersionId,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000000)
      }
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/candidate/invitations/validate')
      .send({ token: validInviteToken })
      .expect(200);

    attemptId = res.body.data.attemptId;
    const cookie = res.headers['set-cookie'][0];
    sessionToken = cookie.split(';')[0].split('=')[1];

    const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
    expect(attempt?.status).toBe('CREATED');
  });

  it('Test 3 - Prevent starting attempt without valid session', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/start`)
      .expect(401);
  });

  it('Test 4 - Valid session starts attempt and starts timer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/start`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .expect(201);
    
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.startedAt).toBeDefined();
    expect(res.body.data.expiresAt).toBeDefined();
  });

  it('Test 5 - Deliver questions with stripped answer keys (Data Leakage Test)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/candidate/attempts/${attemptId}/questions`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .expect(200);
    
    const data = res.body.data;
    expect(data.sections.length).toBe(1);
    const q = data.sections[0].questions[0];
    expect(q.prompt).toBe('1 + 1?');
    expect(q.options[0].isCorrect).toBeUndefined(); // MUST NOT EXPOSE
  });

  it('Test 6 - Save answer (Autosave)', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/candidate/attempts/${attemptId}/answers/${questionId}`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .send({ answerData: { optionId: 'o1' } })
      .expect(200);
  });

  it('Test 7 - Rejects answer to invalid question ID', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/candidate/attempts/${attemptId}/answers/fake_id`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .send({ answerData: { optionId: 'o1' } })
      .expect(400); // Question does not belong to version
  });

  it('Test 8 - Submit attempt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/submit`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .expect(201);
    
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('Test 9 - Idempotent duplicate submit', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/candidate/attempts/${attemptId}/submit`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .expect(201); // Returns idempotent success
    
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('Test 10 - Modifying answers post-submission is forbidden', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/candidate/attempts/${attemptId}/answers/${questionId}`)
      .set('Cookie', [`candidate_session_token=${sessionToken}`])
      .send({ answerData: { optionId: 'o2' } })
      .expect(403);
  });
});
