import { Controller, Post, Req, Res, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeService } from './stripe.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('billing/webhook')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>, 
    @Res() res: Response,
    @Headers('stripe-signature') signature: string
  ) {
    let event;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

    try {
      event = this.stripeService.stripe.webhooks.constructEvent(
        req.rawBody!,
        signature,
        secret
      );
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await this.prisma.processedWebhook.create({
        data: { id: event.id, type: event.type }
      });
    } catch (err: any) {
      // Prisma unique constraint violation means already processed
      if (err.code === 'P2002') {
        return res.status(200).send({ received: true });
      }
      throw err;
    }

    try {
      await this.processEvent(event);
    } catch (err) {
      // If processing fails, we must remove the processed webhook lock so it can be retried
      await this.prisma.processedWebhook.delete({ where: { id: event.id } });
      throw err;
    }

    res.status(200).send({ received: true });
  }

  private async processEvent(event: any) {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const customerId = sub.customer as string;

      const customer = await this.prisma.billingCustomer.findUnique({
        where: { stripeCustomerId: customerId }
      });

      if (customer) {
        await this.prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          create: {
            billingCustomerId: customer.id,
            stripeSubscriptionId: sub.id,
            planId: sub.items.data[0].price.id,
            status: sub.status.toUpperCase(),
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end
          },
          update: {
            status: sub.status.toUpperCase(),
            planId: sub.items.data[0].price.id,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end
          }
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'CANCELED' }
      });
    }
  }
}
