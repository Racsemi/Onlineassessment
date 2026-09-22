import { Module } from '@nestjs/common';
import { CandidateAttemptsService } from './candidate-attempts.service.js';
import { CandidateAttemptsController } from './candidate-attempts.controller.js';

import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'evaluation-queue' })
  ],
  controllers: [CandidateAttemptsController],
  providers: [CandidateAttemptsService],
})
export class CandidateAttemptsModule {}
