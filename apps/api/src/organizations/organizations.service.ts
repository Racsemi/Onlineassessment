import { Injectable, ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrganizationDto } from './dto/organization.dto.js';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto.js';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    return await this.prisma.$transaction(async (tx) => {
      let finalSlug = slug;
      let slugExists = await tx.organization.findUnique({ where: { slug: finalSlug } });
      if (slugExists) {
        finalSlug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }

      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug: finalSlug,
        },
      });

      let ownerRole = await tx.role.findFirst({ where: { name: 'OWNER', isSystem: true } });
      if (!ownerRole) {
        throw new Error('Database is missing global system roles. Please seed the database.');
      }

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
        },
      });

      return organization;
    });
  }

  async getMyOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true, role: true }
    });
    return memberships.map(m => m.organization);
  }

  async getMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true, isSystem: true } },
      },
    });
  }

  async inviteMember(organizationId: string, dto: InviteMemberDto) {
    // Basic invitation flow for M4 demonstration
    const targetRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!targetRole) throw new NotFoundException('Role not found');
    
    // Ensure role is either a global role or belongs to this organization
    if (targetRole.organizationId !== null && targetRole.organizationId !== organizationId) {
      throw new ForbiddenException('Invalid role specified');
    }

    // In a real app, send an email. For M4, we'll just require the user to exist,
    // or simulate creating a pending invite if they don't.
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('User must register first before invitation (for M4 simplified flow)');
    }

    const existingMember = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } }
    });

    if (existingMember) {
      throw new ConflictException('User is already a member');
    }

    return this.prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId,
        roleId: targetRole.id,
        status: 'INVITED', // They would accept it later. We'll set ACTIVE for testing simplicity in e2e
      }
    });
  }

  async updateMember(organizationId: string, activeMember: any, targetMemberId: string, dto: UpdateMemberDto) {
    const targetMember = await this.prisma.organizationMember.findUnique({
      where: { id: targetMemberId },
      include: { role: true }
    });

    if (!targetMember || targetMember.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }

    // Owner protection
    if (targetMember.role.name === 'OWNER' && targetMember.role.isSystem) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          role: { name: 'OWNER', isSystem: true },
          status: 'ACTIVE'
        }
      });

      if (ownerCount <= 1 && (dto.roleId || dto.status === 'REMOVED' || dto.status === 'SUSPENDED')) {
        throw new ForbiddenException('Cannot remove or demote the last owner');
      }
    }

    const updateData: any = {};
    if (dto.status) updateData.status = dto.status;
    
    if (dto.roleId) {
      const targetRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!targetRole || (targetRole.organizationId !== null && targetRole.organizationId !== organizationId)) {
        throw new ForbiddenException('Invalid target role');
      }
      
      // Privilege escalation protection
      // We don't allow assigning OWNER unless you are already an OWNER
      if (targetRole.name === 'OWNER' && targetRole.isSystem) {
        if (activeMember.role.name !== 'OWNER') {
          throw new ForbiddenException('Only owners can assign the OWNER role');
        }
      }
      
      updateData.roleId = dto.roleId;
    }

    return this.prisma.organizationMember.update({
      where: { id: targetMemberId },
      data: updateData,
      include: { role: true, user: { select: { id: true, email: true, name: true } } }
    });
  }

  async getRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [
          { organizationId: null },
          { organizationId }
        ]
      },
      include: {
        permissions: { include: { permission: true } }
      }
    });
  }

  async createRole(organizationId: string, activeMember: any, dto: CreateRoleDto) {
    return await this.prisma.$transaction(async (tx) => {
      const activeMemberRole = await tx.role.findUnique({
        where: { id: activeMember.roleId },
        include: { permissions: { include: { permission: true } } }
      });
      
      const activePermissions = new Set(activeMemberRole?.permissions.map(p => p.permission.action) || []);

      // Privilege escalation check
      for (const p of dto.permissions) {
        if (!activePermissions.has(p)) {
          throw new ForbiddenException(`Privilege escalation detected. You cannot grant permission: ${p}`);
        }
      }

      const permissions = await tx.permission.findMany({
        where: { action: { in: dto.permissions } }
      });

      if (permissions.length !== dto.permissions.length) {
        throw new BadRequestException('One or more requested permissions are invalid');
      }

      const role = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description,
          organizationId,
          isSystem: false,
        }
      });

      await tx.rolePermission.createMany({
        data: permissions.map(p => ({
          roleId: role.id,
          permissionId: p.id
        }))
      });

      return tx.role.findUnique({
        where: { id: role.id },
        include: { permissions: { include: { permission: true } } }
      });
    });
  }

  async updateRole(organizationId: string, activeMember: any, roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    
    if (!role || role.organizationId !== organizationId) {
      throw new ForbiddenException('You can only modify custom roles belonging to your organization');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    return await this.prisma.$transaction(async (tx) => {
      if (dto.permissions) {
        const activeMemberRole = await tx.role.findUnique({
          where: { id: activeMember.roleId },
          include: { permissions: { include: { permission: true } } }
        });
        
        const activePermissions = new Set(activeMemberRole?.permissions.map(p => p.permission.action) || []);

        for (const p of dto.permissions) {
          if (!activePermissions.has(p)) {
            throw new ForbiddenException(`Privilege escalation detected. You cannot grant permission: ${p}`);
          }
        }
      }

      const updateData: any = {};
      if (dto.name) updateData.name = dto.name;
      if (dto.description) updateData.description = dto.description;

      if (Object.keys(updateData).length > 0) {
        await tx.role.update({
          where: { id: roleId },
          data: updateData
        });
      }

      if (dto.permissions) {
        const permissions = await tx.permission.findMany({
          where: { action: { in: dto.permissions } }
        });

        if (permissions.length !== dto.permissions.length) {
          throw new BadRequestException('One or more requested permissions are invalid');
        }

        await tx.rolePermission.deleteMany({ where: { roleId } });
        
        await tx.rolePermission.createMany({
          data: permissions.map(p => ({
            roleId,
            permissionId: p.id
          }))
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } }
      });
    });
  }

  async deleteRole(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    
    if (!role || role.organizationId !== organizationId) {
      throw new ForbiddenException('You can only delete custom roles belonging to your organization');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    // Protection: don't delete if members are assigned to it
    const activeAssignments = await this.prisma.organizationMember.count({
      where: { roleId }
    });

    if (activeAssignments > 0) {
      throw new BadRequestException('Cannot delete role because members are currently assigned to it');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
  }
}
