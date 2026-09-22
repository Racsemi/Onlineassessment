import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async getOrganizations(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true, assessments: true, candidates: true }
          },
          billingCustomer: {
            include: {
              subscriptions: { where: { status: 'ACTIVE' } }
            }
          }
        }
      }),
      this.prisma.organization.count()
    ]);

    return {
      data: organizations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, assessments: true, candidates: true, attempts: true }
        },
        billingCustomer: {
          include: {
            subscriptions: true
          }
        },
        members: {
          include: { user: true, role: true }
        }
      }
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async suspendOrganization(id: string, adminId: string, reason: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.organization.update({
        where: { id },
        data: { status: 'SUSPENDED' }
      });

      // Audit Log for platform intervention
      await tx.auditLog.create({
        data: {
          organizationId: id, // Linking to org but actor is platform admin
          actorUserId: adminId,
          action: 'organization.suspend',
          resourceType: 'Organization',
          resourceId: id,
          metadata: { reason }
        }
      });

      return o;
    });

    return updated;
  }

  async getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count()
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
