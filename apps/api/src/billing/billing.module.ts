import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service.js';
import { BillingController } from './billing.controller.js';
import { EntitlementsService } from './entitlements.service.js';
import { WebhookController } from './webhook.controller.js';

@Global()
@Module({
  controllers: [BillingController, WebhookController],
  providers: [StripeService, EntitlementsService],
  exports: [EntitlementsService],
})
export class BillingModule {}
