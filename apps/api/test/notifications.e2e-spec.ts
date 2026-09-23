import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { NotificationsService } from '../src/notifications/notifications.service.js';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
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

    // Mock NotificationsService to track jobs
    const notificationsService = app.get(NotificationsService);
    vi.spyOn(notificationsService, 'sendVerificationEmail');
    vi.spyOn(notificationsService, 'sendAssessmentInvitation');
    vi.spyOn(notificationsService, 'sendPasswordResetEmail');

    await prisma.userSession.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.role.deleteMany({ where: { isSystem: false } });
    await prisma.passwordResetToken.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.assessmentInvitation.deleteMany();
    await prisma.assessmentVersion.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.organization.deleteMany({ where: { slug: 'notify-org' } });
    await prisma.user.deleteMany({ where: { email: { in: ['adminnotify@proc.com', 'new@proc.com', 'reset@proc.com'] } } });

    const org = await prisma.organization.create({ data: { name: 'Notify Org', slug: 'notify-org' } });
    orgId = org.id;

    const assessment = await prisma.assessment.create({ data: { organizationId: orgId, title: 'Notify Test', createdBy: 'admin' } });
    assessmentId = assessment.id;

    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentId: assessment.id,
        versionNumber: 1,
        publishedBy: 'admin',
        snapshot: { sections: [] }
      }
    });

    const user = await prisma.user.create({ data: { email: 'adminnotify@proc.com', password: 'hash', name: 'Admin' } });
    const uToken = crypto.randomBytes(32).toString('hex');
    const uTokenHash = crypto.createHash('sha256').update(uToken).digest('hex');
    
    await prisma.userSession.create({
      data: { userId: user.id, sessionTokenHash: uTokenHash, expiresAt: new Date(Date.now() + 100000) }
    });
    adminToken = uToken;

    for (const action of ['invitation.create']) {
      await prisma.permission.upsert({ where: { action }, update: {}, create: { action } });
    }

    const role = await prisma.role.create({ 
      data: { 
        name: 'Admin', 
        organizationId: orgId,
        permissions: {
          create: ['invitation.create'].map(action => ({
            permission: { connect: { action } }
          }))
        }
      } 
    });
    await prisma.organizationMember.create({ data: { userId: user.id, organizationId: orgId, roleId: role.id } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - Register triggers Verification Email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'new@proc.com', password: 'Password123!', name: 'New User' });
      
    if (res.status !== 201) console.log('REGISTRATION ERROR:', res.body);
    expect(res.status).toBe(201);

    expect(res.body.success).toBe(true);
    
    const notificationsService = app.get(NotificationsService);
    expect(notificationsService.sendVerificationEmail).toHaveBeenCalled();
  });

  it('Test 2 - Password Reset triggers Email', async () => {
    await prisma.user.create({ data: { email: 'reset@proc.com', password: 'hash', name: 'Reset' } });
    
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@proc.com' })
      .expect(201);
      
    expect(res.body.success).toBe(true);

    const notificationsService = app.get(NotificationsService);
    expect(notificationsService.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('Test 3 - Create Invitation triggers Email', async () => {
    const version = await prisma.assessmentVersion.findFirst({ where: { assessmentId } });
    
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({
        candidateEmail: 'candidate@proc.com',
        candidateName: 'Candidate',
        assessmentVersionId: version!.id
      })
      .expect(201);
      
    expect(res.body.success).toBe(true);
    
    const notificationsService = app.get(NotificationsService);
    expect(notificationsService.sendAssessmentInvitation).toHaveBeenCalled();
  });

  it('Test 4 - MockEmailProvider processes mail job in Worker', async () => {
    // Import the worker manually to test its processEmailJob logic
    const { processEmailJob } = await import('../../../services/worker/src/email-worker.js');
    
    const mockJob = {
      id: 'job-1',
      name: 'email-verification',
      data: {
        email: 'test@mock.com',
        name: 'Test',
        token: 'token123'
      }
    };
    
    // Process it, should run without errors using MockEmailProvider
    await expect(processEmailJob(mockJob as any)).resolves.toBeUndefined();
  });
});
