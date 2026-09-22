import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Platform Administration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let regularToken: string;
  let platformAdminToken: string;
  let platformAdminId: string;

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

    await prisma.userSession.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.role.deleteMany();
    await prisma.organization.deleteMany({ where: { slug: 'platform-target' } });
    await prisma.user.deleteMany({ where: { email: { in: ['plat_reg@proc.com', 'plat_admin@proc.com'] } } });

    const org = await prisma.organization.create({ data: { name: 'Target Org', slug: 'platform-target' } });
    orgId = org.id;

    // Regular User
    const regUser = await prisma.user.create({ data: { email: 'plat_reg@proc.com', password: 'hash', name: 'Reg' } });
    const regU = crypto.randomBytes(32).toString('hex');
    await prisma.userSession.create({
      data: { userId: regUser.id, sessionTokenHash: crypto.createHash('sha256').update(regU).digest('hex'), expiresAt: new Date(Date.now() + 100000) }
    });
    regularToken = regU;

    // Platform Admin
    const adminUser = await prisma.user.create({ 
      data: { email: 'plat_admin@proc.com', password: 'hash', name: 'PlatAdmin', isPlatformAdmin: true } 
    });
    platformAdminId = adminUser.id;
    const adminU = crypto.randomBytes(32).toString('hex');
    await prisma.userSession.create({
      data: { userId: adminUser.id, sessionTokenHash: crypto.createHash('sha256').update(adminU).digest('hex'), expiresAt: new Date(Date.now() + 100000) }
    });
    platformAdminToken = adminU;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - Regular user is rejected by PlatformAdminGuard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Cookie', [`session_token=${regularToken}`])
      .expect(403);
      
    expect(res.body.message).toBe('Platform Administrator access required');
  });

  it('Test 2 - Platform Admin can access organizations list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/organizations')
      .set('Cookie', [`session_token=${platformAdminToken}`])
      .expect(200);
      
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Test 3 - Platform Admin can suspend organization and it logs an audit event', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/platform/organizations/${orgId}/suspend`)
      .set('Cookie', [`session_token=${platformAdminToken}`])
      .send({ reason: 'ToS Violation' })
      .expect(201);
      
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUSPENDED');

    // Verify Audit Log
    const logs = await prisma.auditLog.findMany({
      where: { action: 'organization.suspend', resourceId: orgId }
    });
    expect(logs.length).toBe(1);
    expect(logs[0].actorUserId).toBe(platformAdminId);
  });
});
