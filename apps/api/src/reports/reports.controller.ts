import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';

@Controller('organizations/:organizationId/reports')
@UseGuards(AuthGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('assessments/:assessmentId')
  async getAssessmentAnalytics(
    @Param('organizationId') orgId: string,
    @Param('assessmentId') assessmentId: string
  ) {
    const analytics = await this.reportsService.getAssessmentAnalytics(orgId, assessmentId);
    return { success: true, data: analytics };
  }

  @Get('attempts/:attemptId')
  async getAttemptDetailedReport(
    @Param('organizationId') orgId: string,
    @Param('attemptId') attemptId: string
  ) {
    const report = await this.reportsService.getAttemptDetailedReport(orgId, attemptId);
    return { success: true, data: report };
  }

  @Get('attempts/:attemptId/export')
  async exportAttemptReport(
    @Param('organizationId') orgId: string,
    @Param('attemptId') attemptId: string
  ) {
    const report = await this.reportsService.getAttemptDetailedReport(orgId, attemptId);
    // Export MVP: Return structured JSON for frontend rendering instead of heavy PDF logic
    return {
      success: true,
      metadata: { generatedAt: new Date().toISOString(), type: 'DETAILED_REPORT' },
      data: report
    };
  }
}
