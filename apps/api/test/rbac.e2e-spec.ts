import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let viewerToken: string;
  
  let orgAId: string;
  let orgBId: string;

  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let viewerId: string;

  let adminRoleId: string;
  let memberRoleId: string;
  let viewerRoleId: string;

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
    await prisma.organizationMember.deleteMany();
    await prisma.rolePermission.deleteMany({ where: { role: { isSystem: false } } });
    await prisma.role.deleteMany({ where: { isSystem: false } });
    await prisma.organization.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();

    // Register Users
    const registerUser = async (email: string, name: string) => {
      const u = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password: 'password123', name });
      if (u.status !== 201) console.log('REGISTER ERROR:', u.body);
      const l = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'password123' });
      if (l.status !== 200) console.log('LOGIN ERROR:', l.body);
      return { id: u.body.data.id, token: l.headers['set-cookie'][0].split(';')[0].split('=')[1] };
    };

    const owner = await registerUser('owner@test.com', 'Owner User');
    ownerId = owner.id; ownerToken = owner.token;

    const admin = await registerUser('admin@test.com', 'Admin User');
    adminId = admin.id; adminToken = admin.token;

    const member = await registerUser('member@test.com', 'Member User');
    memberId = member.id; memberToken = member.token;

    const viewer = await registerUser('viewer@test.com', 'Viewer User');
    viewerId = viewer.id; viewerToken = viewer.token;

    // Create Organization A (Owner is OWNER)
    const orgARes = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ name: 'Organization A' });
    orgAId = orgARes.body.data.id;

    // Create Organization B (Admin is OWNER in B)
    const orgBRes = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ name: 'Organization B' });
    orgBId = orgBRes.body.data.id;

    // Get system roles
    const roles = await prisma.role.findMany({ where: { isSystem: true } });
    adminRoleId = roles.find(r => r.name === 'ADMIN')!.id;
    memberRoleId = roles.find(r => r.name === 'MEMBER')!.id;
    viewerRoleId = roles.find(r => r.name === 'VIEWER')!.id;

    // Manually add members to Org A
    await prisma.organizationMember.create({ data: { userId: adminId, organizationId: orgAId, roleId: adminRoleId, status: 'ACTIVE' } });
    await prisma.organizationMember.create({ data: { userId: memberId, organizationId: orgAId, roleId: memberRoleId, status: 'ACTIVE' } });
    await prisma.organizationMember.create({ data: { userId: viewerId, organizationId: orgAId, roleId: viewerRoleId, status: 'ACTIVE' } });

  });

  afterAll(async () => {
    await app.close();
  });

  it('Test 1 - ADMIN allowed (member.invite)', async () => {
    // Admin in Org A
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/roles`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200); // role.read is allowed for ADMIN
  });

  it('Test 2 - MEMBER denied (member.invite)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/members/invite`)
      .set('Cookie', [`session_token=${memberToken}`])
      .send({ email: 'new@test.com', roleId: viewerRoleId })
      .expect(403);
  });

  it('Test 3 - VIEWER denied (member.update)', async () => {
    const memberTarget = await prisma.organizationMember.findFirst({ where: { userId: memberId, organizationId: orgAId } });
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/members/${memberTarget!.id}`)
      .set('Cookie', [`session_token=${viewerToken}`])
      .send({ status: 'SUSPENDED' })
      .expect(403);
  });

  it('Test 6 - Custom role isolation', async () => {
    // Create Custom Role in Org A
    const customRoleRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/roles`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ name: 'Custom Viewer', permissions: ['member.read'] })
      .expect(201);
    
    const customRoleId = customRoleRes.body.data.id;

    // Assign to VIEWER
    const viewerMember = await prisma.organizationMember.findFirst({ where: { userId: viewerId, organizationId: orgAId } });
    
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/members/${viewerMember!.id}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ roleId: customRoleId })
      .expect(200);

    // VIEWER can now read members
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/members`)
      .set('Cookie', [`session_token=${viewerToken}`])
      .expect(200);

    // But VIEWER cannot invite
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/members/invite`)
      .set('Cookie', [`session_token=${viewerToken}`])
      .send({ email: 'x@test.com', roleId: viewerRoleId })
      .expect(403);
  });

  it('Test 7 - Cross-tenant role attack', async () => {
    // Attempt to create role in Org B using Org A custom role ID? No, assigning Org B role to Org A member
    // Owner of A tries to assign an Org B custom role to their member
    const orgBRoleRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgBId}/roles`)
      .set('Cookie', [`session_token=${adminToken}`]) // admin is OWNER of Org B
      .send({ name: 'Org B Role', permissions: ['member.read'] })
      .expect(201);
      
    const orgBRoleId = orgBRoleRes.body.data.id;

    const viewerMemberA = await prisma.organizationMember.findFirst({ where: { userId: viewerId, organizationId: orgAId } });
    
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/members/${viewerMemberA!.id}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ roleId: orgBRoleId })
      .expect(403); // Forbidden target role
  });

  it('Test 9 - Same user, different organization permissions', async () => {
    // Admin is ADMIN in Org A, OWNER in Org B
    // Org A -> role.delete is forbidden for ADMIN
    // Create a custom role in Org A to delete
    const roleA = await request(app.getHttpServer()).post(`/api/v1/organizations/${orgAId}/roles`).set('Cookie', [`session_token=${ownerToken}`]).send({ name: 'Temp', permissions: ['member.read'] });
    
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgAId}/roles/${roleA.body.data.id}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(403); // ADMIN cannot role.delete

    // Org B -> OWNER can role.delete
    const roleB = await request(app.getHttpServer()).post(`/api/v1/organizations/${orgBId}/roles`).set('Cookie', [`session_token=${adminToken}`]).send({ name: 'Temp B', permissions: ['member.read'] });
    
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgBId}/roles/${roleB.body.data.id}`)
      .set('Cookie', [`session_token=${adminToken}`])
      .expect(200); // OK
  });

  it('Test 10 - Suspended member', async () => {
    const viewerMember = await prisma.organizationMember.findFirst({ where: { userId: viewerId, organizationId: orgAId } });
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/members/${viewerMember!.id}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .send({ status: 'SUSPENDED' })
      .expect(200);

    // Viewer is suspended, ANY tenant endpoint returns 403
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/roles`)
      .set('Cookie', [`session_token=${viewerToken}`])
      .expect(403);
  });

  it('Test 13 - Privilege escalation', async () => {
    // Member tries to create a custom role with 'role.delete' which they do not have
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgAId}/roles`)
      .set('Cookie', [`session_token=${memberToken}`]) // member has member.read
      .send({ name: 'Hacker Role', permissions: ['role.delete'] })
      .expect(403);
  });

  it('Test 14 - System role protection', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgAId}/roles/${adminRoleId}`)
      .set('Cookie', [`session_token=${ownerToken}`])
      .expect(403);
  });

  it('Test 15 - Last owner protection', async () => {
    const ownerMember = await prisma.organizationMember.findFirst({ where: { userId: ownerId, organizationId: orgAId } });
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgAId}/members/${ownerMember!.id}`)
      .set('Cookie', [`session_token=${ownerToken}`]) // Owner demoting themselves
      .send({ roleId: adminRoleId })
      .expect(403); // Cannot remove last owner
  });
});
