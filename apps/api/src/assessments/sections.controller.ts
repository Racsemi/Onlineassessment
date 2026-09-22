import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { AssessmentsService } from './assessments.service.js';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto.js';

@Controller('organizations/:organizationId/assessments/:assessmentId/sections')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class SectionsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @RequirePermissions('assessment.update')
  async create(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string, @Body() dto: CreateSectionDto) {
    const section = await this.assessmentsService.createSection(org.id, assessmentId, dto);
    return { success: true, data: section };
  }

  @Get()
  @RequirePermissions('assessment.read')
  async findAll(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string) {
    const sections = await this.assessmentsService.getSections(org.id, assessmentId);
    return { success: true, data: sections };
  }

  @Patch(':sectionId')
  @RequirePermissions('assessment.update')
  async update(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string, @Param('sectionId') sectionId: string, @Body() dto: UpdateSectionDto) {
    const section = await this.assessmentsService.updateSection(org.id, assessmentId, sectionId, dto);
    return { success: true, data: section };
  }

  @Delete(':sectionId')
  @RequirePermissions('assessment.update')
  async remove(@CurrentOrganization() org: any, @Param('assessmentId') assessmentId: string, @Param('sectionId') sectionId: string) {
    const result = await this.assessmentsService.deleteSection(org.id, assessmentId, sectionId);
    return { success: true, data: result };
  }
}
