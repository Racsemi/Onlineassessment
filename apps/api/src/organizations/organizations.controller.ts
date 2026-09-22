import { Controller, Post, Body, Req, Get, UseGuards, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/organization.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { ActiveMember, CurrentOrganization } from '../common/decorators/tenant.decorator.js';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateOrganizationDto) {
    const userId = req.user.id;
    const organization = await this.orgService.createOrganization(userId, dto);
    return { success: true, data: organization };
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user.id;
    const organizations = await this.orgService.getMyOrganizations(userId);
    return { success: true, data: organizations };
  }

  @Get(':organizationId')
  @UseGuards(TenantGuard)
  async findOne(@CurrentOrganization() organization: any) {
    // TenantGuard has already fetched and attached the organization to the context
    return { success: true, data: organization };
  }

}
