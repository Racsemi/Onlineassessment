import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const member = request.member;
    const tenant = request.tenant;

    if (!member || !tenant) {
      throw new ForbiddenException('Tenant context not found. Ensure TenantGuard runs before PermissionsGuard.');
    }

    if (member.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    // Load member's role and permissions
    const roleWithPermissions = await this.prisma.role.findUnique({
      where: { id: member.roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!roleWithPermissions) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    // Ensure role belongs to this tenant or is global
    if (roleWithPermissions.organizationId !== null && roleWithPermissions.organizationId !== tenant.id) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    // Check all required permissions
    const memberPermissions = new Set(roleWithPermissions.permissions.map(rp => rp.permission.action));
    const hasAllPermissions = requiredPermissions.every(perm => memberPermissions.has(perm));

    if (!hasAllPermissions) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}
