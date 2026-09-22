import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentOrganization, ActiveMember } from '../common/decorators/tenant.decorator.js';
import { OrganizationsService } from './organizations.service.js';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js';

@Controller('organizations/:organizationId/roles')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class RolesController {
  constructor(private orgService: OrganizationsService) {}

  @Get()
  @RequirePermissions('role.read')
  async getRoles(@CurrentOrganization() org: any) {
    const roles = await this.orgService.getRoles(org.id);
    return { success: true, data: roles };
  }

  @Post()
  @RequirePermissions('role.create')
  async createRole(@CurrentOrganization() org: any, @ActiveMember() activeMember: any, @Body() dto: CreateRoleDto) {
    const role = await this.orgService.createRole(org.id, activeMember, dto);
    return { success: true, data: role };
  }

  @Patch(':roleId')
  @RequirePermissions('role.update')
  async updateRole(@CurrentOrganization() org: any, @ActiveMember() activeMember: any, @Param('roleId') roleId: string, @Body() dto: UpdateRoleDto) {
    const role = await this.orgService.updateRole(org.id, activeMember, roleId, dto);
    return { success: true, data: role };
  }

  @Delete(':roleId')
  @RequirePermissions('role.delete')
  async deleteRole(@CurrentOrganization() org: any, @Param('roleId') roleId: string) {
    await this.orgService.deleteRole(org.id, roleId);
    return { success: true };
  }
}
