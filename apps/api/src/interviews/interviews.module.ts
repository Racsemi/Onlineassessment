import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { InterviewsController } from './interviews.controller.js';
import { CandidateInterviewController } from './candidate-interview.controller.js';
import { InterviewsService } from './interviews.service.js';
import { MediaTokenService } from './services/media-token.service.js';
import { InterviewCodeService } from './services/interview-code.service.js';
import { InterviewGateway } from './interview.gateway.js';

@Module({
  imports: [DatabaseModule, AuthModule, NotificationsModule],
  controllers: [InterviewsController, CandidateInterviewController],
  providers: [
    InterviewsService,
    MediaTokenService,
    InterviewCodeService,
    InterviewGateway,
  ],
  exports: [InterviewsService, MediaTokenService, InterviewGateway],
})
export class InterviewsModule {}
