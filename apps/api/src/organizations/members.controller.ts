import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization, ActiveMember } from '../common/decorators/tenant.decorator.js';
import { OrganizationsService } from './organizations.service.js';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto.js';

@Controller('organizations/:organizationId/members')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class MembersController {
  constructor(private orgService: OrganizationsService) {}

  @Get()
  @RequirePermissions('member.read')
  async getMembers(@CurrentOrganization() org: any) {
    const members = await this.orgService.getMembers(org.id);
    return { success: true, data: members };
  }

  @Post('invite')
  @RequirePermissions('member.invite')
  async inviteMember(@CurrentOrganization() org: any, @Body() dto: InviteMemberDto) {
    const member = await this.orgService.inviteMember(org.id, dto);
    return { success: true, data: member };
  }

  @Patch(':memberId')
  @RequirePermissions('member.update')
  async updateMember(
    @CurrentOrganization() org: any,
    @ActiveMember() activeMember: any,
    @Param('memberId') targetMemberId: string,
    @Body() dto: UpdateMemberDto
  ) {
    const member = await this.orgService.updateMember(org.id, activeMember, targetMemberId, dto);
    return { success: true, data: member };
  }
}
