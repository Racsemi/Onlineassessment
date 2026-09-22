import { Controller, Get, Post, Body, UseGuards, Query, Param, Req } from '@nestjs/common';
import { PlatformService } from './platform.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard.js';

@Controller('platform')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('organizations')
  async getOrganizations(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    const result = await this.platformService.getOrganizations(parseInt(page), parseInt(limit));
    return { success: true, ...result };
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string) {
    const org = await this.platformService.getOrganization(id);
    return { success: true, data: org };
  }

  @Post('organizations/:id/suspend')
  async suspendOrganization(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string
  ) {
    const org = await this.platformService.suspendOrganization(id, req.user.id, reason || 'No reason provided');
    return { success: true, data: org };
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50'
  ) {
    const result = await this.platformService.getAuditLogs(parseInt(page), parseInt(limit));
    return { success: true, ...result };
  }
}
