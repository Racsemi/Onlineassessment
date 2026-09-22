import { Module } from '@nestjs/common';
import { CandidateAuthService } from './candidate-auth.service.js';
import { CandidateAuthController } from './candidate-auth.controller.js';
import { ProctoringModule } from '../proctoring/proctoring.module.js';

@Module({
  imports: [ProctoringModule],
  controllers: [CandidateAuthController],
  providers: [CandidateAuthService],
})
export class CandidateAuthModule {}
