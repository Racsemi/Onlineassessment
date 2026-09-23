import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';
import { StripeService } from '../src/billing/stripe.service.js';

describe('Billing & Entitlements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Mock Stripe
    const stripeService = app.get(StripeService);
    stripeService.stripe.webhooks.constructEvent = vi.fn().mockImplementation((rawBody, signature, secret) => {
      if (signature === 'invalid') throw new Error('Invalid signature');
      return JSON.parse(rawBody.toString());
    });

    await prisma.userSession.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.role.deleteMany({ where: { isSystem: false } });
    await prisma.billingCustomer.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.processedWebhook.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.organization.deleteMany({ where: { slug: 'billing-org' } });
    await prisma.user.deleteMany({ where: { email: 'adminbilling@proc.com' } });

    const org = await prisma.organization.create({ data: { name: 'Billing Org', slug: 'billing-org' } });
    orgId = org.id;

    const user = await prisma.user.create({ data: { email: 'adminbilling@proc.com', password: 'hash', name: 'Admin' } });
    const crypto = await import('crypto');
    const uToken = crypto.randomBytes(32).toString('hex');
    const uTokenHash = crypto.createHash('sha256').update(uToken).digest('hex');
    
    await prisma.userSession.create({
      data: { userId: user.id, sessionTokenHash: uTokenHash, expiresAt: new Date(Date.now() + 100000) }
    });
    adminToken = uToken;

    for (const action of ['assessment.create', 'invitation.create']) {
      await prisma.permission.upsert({ where: { action }, update: {}, create: { action } });
    }

    const role = await prisma.role.create({ 
      data: { 
        name: 'Admin', 
        organizationId: orgId,
        permissions: {
          create: ['assessment.create', 'invitation.create'].map(action => ({
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

  it('Test 1 - Free Plan Limits (Assessment Creation)', async () => {
    // Create 1 assessment (max allowed on free plan)
    const res1 = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/assessments`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ title: 'Assessment 1' })
      .expect(201);
      
    expect(res1.body.success).toBe(true);

    // Create 2nd assessment (should fail)
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/assessments`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ title: 'Assessment 2' })
      .expect(403);
      
    expect(res2.body.message).toContain('Plan limit reached');
  });

  it('Test 2 - Webhook: Subscription Created', async () => {
    // Setup billing customer
    const bCust = await prisma.billingCustomer.create({
      data: {
        organizationId: orgId,
        stripeCustomerId: 'cus_123',
      }
    });

    const event = {
      id: 'evt_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1000000,
          current_period_end: 2000000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: 'pro' } }] }
        }
      }
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid')
      .send(event)
      .expect(200);

    expect(res.body.received).toBe(true);

    // Verify DB
    const sub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: 'sub_123' } });
    expect(sub).toBeDefined();
    expect(sub!.status).toBe('ACTIVE');
    expect(sub!.planId).toBe('pro');
  });

  it('Test 3 - Idempotency: Duplicate Webhook is ignored', async () => {
    const event = { id: 'evt_1', type: 'customer.subscription.created' }; // stripped payload

    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid')
      .send(event)
      .expect(200);

    expect(res.body.received).toBe(true);

    // Ensure only 1 record in ProcessedWebhook
    const count = await prisma.processedWebhook.count({ where: { id: 'evt_1' } });
    expect(count).toBe(1);
  });

  it('Test 4 - Invalid Webhook Signature Rejected', async () => {
    const event = { id: 'evt_2', type: 'customer.subscription.created' };

    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'invalid')
      .send(event)
      .expect(400);

    expect(res.text).toContain('Webhook Error');
  });

  it('Test 5 - Pro Plan Limits (Assessment Creation bypasses free limit)', async () => {
    // Because Test 2 created a Pro subscription, we can now create another assessment
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/assessments`)
      .set('Cookie', [`session_token=${adminToken}`])
      .send({ title: 'Assessment 2 (Pro)' })
      .expect(201);
      
    expect(res.body.success).toBe(true);
  });
});
