import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { AssessmentsService } from './assessments.service.js';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto.js';

@Controller('organizations/:organizationId/assessments/:assessmentId/sections/:sectionId/questions')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class QuestionsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @RequirePermissions('assessment.update')
  async create(
    @CurrentOrganization() org: any,
    @Param('assessmentId') assessmentId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateQuestionDto
  ) {
    const question = await this.assessmentsService.createQuestion(org.id, assessmentId, sectionId, dto);
    return { success: true, data: question };
  }

  @Get()
  @RequirePermissions('assessment.read')
  async findAll(
    @CurrentOrganization() org: any,
    @Param('assessmentId') assessmentId: string,
    @Param('sectionId') sectionId: string
  ) {
    const questions = await this.assessmentsService.getQuestions(org.id, assessmentId, sectionId);
    return { success: true, data: questions };
  }

  @Patch(':questionId')
  @RequirePermissions('assessment.update')
  async update(
    @CurrentOrganization() org: any,
    @Param('assessmentId') assessmentId: string,
    @Param('sectionId') sectionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto
  ) {
    const question = await this.assessmentsService.updateQuestion(org.id, assessmentId, sectionId, questionId, dto);
    return { success: true, data: question };
  }

  @Delete(':questionId')
  @RequirePermissions('assessment.update')
  async remove(
    @CurrentOrganization() org: any,
    @Param('assessmentId') assessmentId: string,
    @Param('sectionId') sectionId: string,
    @Param('questionId') questionId: string
  ) {
    const result = await this.assessmentsService.deleteQuestion(org.id, assessmentId, sectionId, questionId);
    return { success: true, data: result };
  }
}
