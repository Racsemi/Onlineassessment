import { Module, forwardRef } from '@nestjs/common';
import { ProctoringService } from './proctoring.service.js';
import { ProctoringController } from './proctoring.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { CandidateAuthModule } from '../candidate-auth/candidate-auth.module.js';

@Module({
  imports: [AuthModule, forwardRef(() => CandidateAuthModule)],
  controllers: [ProctoringController],
  providers: [ProctoringService],
  exports: [ProctoringService]
})
export class ProctoringModule {}
