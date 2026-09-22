import { Controller, Post, Body, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { StripeService } from './stripe.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('organizations/:organizationId/billing')
@UseGuards(AuthGuard, TenantGuard)
export class BillingController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService
  ) {}

  @Post('checkout')
  async createCheckout(@CurrentOrganization() org: any, @Body('priceId') priceId: string) {
    let customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId: org.id }
    });

    if (!customer) {
      // Create Stripe Customer
      const stripeCustomer = await this.stripeService.stripe.customers.create({
        metadata: { organizationId: org.id },
      });
      
      customer = await this.prisma.billingCustomer.create({
        data: {
          organizationId: org.id,
          stripeCustomerId: stripeCustomer.id,
        }
      });
    }

    const session = await this.stripeService.createCheckoutSession(
      customer.stripeCustomerId,
      priceId,
      `${process.env.CLIENT_URL}/dashboard/${org.id}?checkout=success`,
      `${process.env.CLIENT_URL}/dashboard/${org.id}?checkout=cancel`
    );

    return { success: true, data: { url: session.url } };
  }

  @Post('portal')
  async createPortal(@CurrentOrganization() org: any) {
    const customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId: org.id }
    });

    if (!customer) {
      throw new NotFoundException('Billing customer not found for this organization');
    }

    const session = await this.stripeService.createCustomerPortalSession(
      customer.stripeCustomerId,
      `${process.env.CLIENT_URL}/dashboard/${org.id}`
    );

    return { success: true, data: { url: session.url } };
  }
}
