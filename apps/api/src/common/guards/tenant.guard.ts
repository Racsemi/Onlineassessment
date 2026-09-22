import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    
    if (!user) {
      // AuthGuard must run before TenantGuard
      throw new ForbiddenException('User not authenticated');
    }

    const rawOrgId = request.params.organizationId;
    const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
    if (!organizationId) {
      throw new ForbiddenException('Tenant context (organizationId) is required');
    }

    // Lookup organization membership and organization status
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      include: {
        organization: true,
        role: true,
      }
    });

    if (!member) {
      throw new ForbiddenException('Tenant access denied');
    }

    if (member.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant access denied: Membership inactive');
    }

    if (member.organization.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant access denied: Organization inactive');
    }

    // Attach validated tenant context to request
    (request as any).member = member;
    (request as any).tenant = member.organization;

    return true;
  }
}
