import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

describe('OrganizationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let user1SessionToken: string;
  let user2SessionToken: string;
  
  let orgAId: string;
  let orgBId: string;

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

    // Clean up DB before tests
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();

    // Register User 1
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'user1@test.com', password: 'password123', name: 'User 1' });
      
    if (reg.status !== 201) console.log('REGISTER ERROR:', reg.body);
    expect(reg.status).toBe(201);
      
    const login1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user1@test.com', password: 'password123' })
      .expect(200);
      
    user1SessionToken = login1.headers['set-cookie'][0].split(';')[0].split('=')[1];

    // Register User 2
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'user2@test.com', password: 'password123', name: 'User 2' })
      .expect(201);
      
    const login2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user2@test.com', password: 'password123' })
      .expect(200);
      
    user2SessionToken = login2.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create Organization A for User 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${user1SessionToken}`])
      .send({ name: 'Organization A' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Organization A');
    orgAId = res.body.data.id;
  });

  it('should create Organization B for User 2', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${user2SessionToken}`])
      .send({ name: 'Organization B' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Organization B');
    orgBId = res.body.data.id;
  });

  it('should allow User 1 to access Org A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Cookie', [`session_token=${user1SessionToken}`])
      .expect(200);

    expect(res.body.data.id).toBe(orgAId);
  });

  it('should prevent cross-tenant organization access: User 1 -> Org B', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}`)
      .set('Cookie', [`session_token=${user1SessionToken}`])
      .expect(403);
  });

  it('should prevent cross-tenant organization access: User 2 -> Org A', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set('Cookie', [`session_token=${user2SessionToken}`])
      .expect(403);
  });
});
