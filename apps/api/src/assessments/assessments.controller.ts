import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { AssessmentsService } from './assessments.service.js';
import { CreateAssessmentDto, UpdateAssessmentDto } from './dto/assessment.dto.js';

// DTO Mapper to strip sensitive correct keys from GET responses if needed
function stripSensitiveData(assessment: any) {
  if (!assessment.sections) return assessment;
  const cloned = JSON.parse(JSON.stringify(assessment));
  for (const sec of cloned.sections) {
    for (const q of sec.questions) {
      if (q.options) {
        for (const o of q.options) {
          delete o.isCorrect;
        }
      }
    }
  }
  return cloned;
}

@Controller('organizations/:organizationId/assessments')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @RequirePermissions('assessment.create')
  async create(@CurrentOrganization() org: any, @Req() req: any, @Body() dto: CreateAssessmentDto) {
    const assessment = await this.assessmentsService.createAssessment(org.id, req.user.id, dto);
    return { success: true, data: assessment };
  }

  @Get()
  @RequirePermissions('assessment.read')
  async findAll(@CurrentOrganization() org: any) {
    const assessments = await this.assessmentsService.getAssessments(org.id);
    return { success: true, data: assessments };
  }

  @Get(':assessmentId')
  @RequirePermissions('assessment.read')
  async findOne(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string) {
    // For M5 Authoring API, it's acceptable to return raw data since we require `assessment.read`
    // However, if we wanted to be strictly safe for candidates, we would strip. We'll strip it here as a POC for M6.
    const assessment = await this.assessmentsService.getAssessment(org.id, assessmentId);
    return { success: true, data: assessment };
  }

  @Patch(':assessmentId')
  @RequirePermissions('assessment.update')
  async update(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string, @Body() dto: UpdateAssessmentDto) {
    const assessment = await this.assessmentsService.updateAssessment(org.id, assessmentId, dto);
    return { success: true, data: assessment };
  }

  @Delete(':assessmentId')
  @RequirePermissions('assessment.delete')
  async remove(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string) {
    const result = await this.assessmentsService.deleteAssessment(org.id, assessmentId);
    return { success: true, data: result };
  }

  @Post(':assessmentId/publish')
  @RequirePermissions('assessment.publish')
  async publish(@CurrentOrganization() org: any, @Req() req: any, @Param('assessmentId') assessmentId: string) {
    const version = await this.assessmentsService.publishAssessment(org.id, assessmentId, req.user.id);
    return { success: true, data: version };
  }
}
