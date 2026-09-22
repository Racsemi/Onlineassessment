import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { AuthModule } from '../auth/auth.module.js';

import { RolesController } from './roles.controller.js';
import { MembersController } from './members.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, RolesController, MembersController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
