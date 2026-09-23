import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { AssessmentsModule } from './assessments/assessments.module.js';
import { CandidateAuthModule } from './candidate-auth/candidate-auth.module.js';
import { CandidateAttemptsModule } from './candidate-attempts/candidate-attempts.module.js';
import { ProctoringModule } from './proctoring/proctoring.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { BillingModule } from './billing/billing.module.js';
import { InterviewsModule } from './interviews/interviews.module.js';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 5 }, // 5 requests per minute for sensitive endpoints
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    AssessmentsModule,
    CandidateAuthModule,
    CandidateAttemptsModule,
    ProctoringModule,
    ReportsModule,
    NotificationsModule,
    InvitationsModule,
    PlatformModule,
    BillingModule,
    InterviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
