import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { EntitlementsService } from '../src/billing/entitlements.service.js';
import { vi } from 'vitest';

describe('Assessments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let ownerToken: string;
  let adminToken: string; // From another org
  let memberToken: string;
  
  let orgAId: string;
  let orgBId: string;
  let ownerId: string;
  let adminId: string;
  let memberId: string;

  let assessmentId: string;
  let sectionId: string;
  let questionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EntitlementsService)
      .useValue({
        canCreateAssessment: vi.fn().mockResolvedValue(true),
        canInviteCandidate: vi.fn().mockResolvedValue(true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up
    await prisma.assessmentVersion.deleteMany();
    await prisma.questionOption.deleteMany();
    await prisma.assessmentQuestion.deleteMany();
    await prisma.assessmentSection.deleteMany();
    await prisma.assessmentSettings.deleteMany();
    await prisma.assessment.deleteMany();
    
    await prisma.organizationMember.deleteMany({ where: { user: { email: { in: ['a_owner@test.com', 'a_member@test.com', 'b_admin@test.com'] } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: ['a_owner@test.com', 'a_member@test.com', 'b_admin@test.com'] } } } });
    await prisma.user.deleteMany({ where: { email: { in: ['a_owner@test.com', 'a_member@test.com', 'b_admin@test.com'] } } });
    await prisma.organization.deleteMany({ where: { name: { in: ['Org A', 'Org B'] } } });

    // We assume the DB is already seeded by the main seed script (roles/permissions exist).
    // Let's create users and organizations using the real APIs so roles get assigned properly.

    const registerUser = async (email: string, name: string) => {
      const r = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password: 'password123', name });
      if (r.status !== 201) console.log('REGISTER ERROR:', r.body);
      const l = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'password123' });
      if (l.status !== 200) console.log('LOGIN ERROR:', l.body);
      return { id: r.body.data.id, token: l.headers['set-cookie'][0].split(';')[0].split('=')[1] };
    };

    const owner = await registerUser('a_owner@test.com', 'A Owner');
    ownerId = owner.id; ownerToken = owner.token;

    const member = await registerUser('a_member@test.com', 'A Member');
    memberId = member.id; memberToken = member.token;

    const admin = await registerUser('b_admin@test.com', 'B Admin');
    adminId = admin.id; adminToken = admin.token;

    // Create Org A
    const orgARes = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ name: 'Org A' });
    orgAId = orgARes.body.data.id;

    // Create Org B
    const orgBRes = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ name: 'Org B' });
    orgBId = orgBRes.body.data.id;

    // Add member to Org A as VIEWER (VIEWER does not have assessment.create)
    const viewerRole = await prisma.role.findFirst({ where: { name: 'VIEWER', isSystem: true } });
    await prisma.organizationMember.create({ data: { userId: memberId, organizationId: orgAId, roleId: viewerRole!.id, status: 'ACTIVE' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - Authorized user creates assessment', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`]) // Owner has all permissions
      .send({ title: 'Software Engineering Test' })
      .expect(201);
    
    assessmentId = res.body.data.id;
    expect(res.body.data.title).toBe('Software Engineering Test');
  });

  it('Test 2 - User without assessment.create', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${memberToken}`]) // VIEWER
      .send({ title: 'Hacked Test' })
      .expect(403);
  });

  it('Test 3 - Authorized user lists assessments (only current tenant)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .expect(200);
    
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(assessmentId);
  });

  it('Test 4 - User from Org A attempts to access Org B assessment', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}/assessments/${assessmentId}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .expect(403); // Owner of A is not a member of B, TenantGuard blocks it
  });

  it('Test 5 - User attempts to update another tenants assessment', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgBId}/assessments/${assessmentId}`)
      .set('Cookie', [`session_token=${adminToken}`]) // Admin of B attempting to update Org A's assessment
      .send({ title: 'Hacked' })
      .expect(404); // Even if they pass TenantGuard for B, the assessment organizationId !== B
  });

  it('Test 6 - User attempts to delete another tenants assessment', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgBId}/assessments/${assessmentId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(404);
  });

  it('Test 7 - Create section', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${assessmentId}/sections`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'Frontend Basics', displayOrder: 1 })
      .expect(201);
    
    sectionId = res.body.data.id;
  });

  it('Test 8 - Create MCQ', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${assessmentId}/sections/${sectionId}/questions`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ 
        type: 'MCQ_SINGLE', 
        prompt: 'What is React?', 
        displayOrder: 1,
        options: [
          { text: 'Library', displayOrder: 1, isCorrect: true },
          { text: 'Framework', displayOrder: 2, isCorrect: false }
        ]
      })
      .expect(201);
    
    questionId = res.body.data.id;
  });

  it('Test 9 - Create coding question', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${assessmentId}/sections/${sectionId}/questions`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ 
        type: 'CODING', 
        prompt: 'Write a binary search.', 
        displayOrder: 2,
        configuration: {
          timeLimit: 1000,
          memoryLimit: 128
        }
      })
      .expect(201);
  });

  it('Test 10 - Invalid assessment cannot be published', async () => {
    // Create an empty assessment
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'Empty' })
      .expect(201);
    
    // Attempt to publish
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${res.body.data.id}/publish`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .expect(400); // Bad Request due to no sections
  });

  it('Test 11 - Valid assessment can be published', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${assessmentId}/publish`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .expect(201);
  });

  it('Test 12 - Published version cannot be modified', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/assessments/${assessmentId}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'New Title' })
      .expect(403);
  });

  it('Test 14 - Cross-tenant section ID attack fails', async () => {
    // Admin of B tries to access A's section under B's org context
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgBId}/assessments/${assessmentId}/sections/${sectionId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ title: 'Hacked' })
      .expect(404);
  });

  it('Test 15 - Cross-tenant question ID attack fails', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgBId}/assessments/${assessmentId}/sections/${sectionId}/questions/${questionId}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ prompt: 'Hacked' })
      .expect(404);
  });

  it('Test 17 - Client cannot force status=PUBLISHED through update API', async () => {
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'Draft' });
    
    // Attempt to patch status
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/assessments/${draftRes.body.data.id}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ status: 'PUBLISHED' }) // Should be ignored by Zod strict/partial
      .expect(400); // Zod throws error because 'status' is not in the schema (unrecognized key in strict mode)
  });

  it('Test 18 - Client cannot modify organizationId or createdBy', async () => {
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'Draft2' });
    
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/assessments/${draftRes.body.data.id}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ organizationId: orgBId, createdBy: adminId })
      .expect(400); // Strict validation blocks
  });

  it('Test 19 - Concurrent publish requests cannot corrupt version state', async () => {
    // We already published assessmentId once (version 1)
    // Wait, it's immutable so we can't publish it again.
    // Let's create a new one.
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'Concurrent Test' });
    const cId = res.body.data.id;

    const secRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${cId}/sections`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ title: 'S1', displayOrder: 1 });
    
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/assessments/${cId}/sections/${secRes.body.data.id}/questions`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ type: 'TRUE_FALSE', prompt: 'Is this true?', displayOrder: 1, options: [{ text: 'T', displayOrder: 1, isCorrect: true }, { text: 'F', displayOrder: 2, isCorrect: false }] });
    
    // Concurrent requests
    const p1 = request(app.getHttpServer()).post(`/api/v1/organizations/${orgAId}/assessments/${cId}/publish`).set('Cookie', [`session_token=${ownerToken}`]);
    const p2 = request(app.getHttpServer()).post(`/api/v1/organizations/${orgAId}/assessments/${cId}/publish`).set('Cookie', [`session_token=${ownerToken}`]);

    const results = await Promise.all([p1, p2]);
    const statuses = results.map(r => r.status);
    
    // One should succeed (201), the other should fail (409 Conflict)
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });
});
