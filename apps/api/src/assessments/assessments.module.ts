import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller.js';
import { SectionsController } from './sections.controller.js';
import { QuestionsController } from './questions.controller.js';
import { AssessmentsService } from './assessments.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AssessmentsController, SectionsController, QuestionsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
