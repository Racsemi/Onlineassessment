import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { InvitationsService } from './invitations.service.js';
import { CreateInvitationDto } from './dto/invitation.dto.js';

@Controller('organizations/:organizationId/invitations')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @RequirePermissions('invitation.create') // Assuming this permission exists or will be added to the RBAC seed
  async invite(@CurrentOrganization() org: any, @Body() dto: CreateInvitationDto) {
    const result = await this.invitationsService.inviteCandidate(org.id, dto);
    return { success: true, data: result };
  }
}
