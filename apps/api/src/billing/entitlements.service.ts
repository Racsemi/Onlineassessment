import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export const PLANS = {
  free: { maxMembers: 1, maxAssessments: 1, maxCandidates: 10, features: ['basic_reports'] },
  pro: { maxMembers: 5, maxAssessments: 50, maxCandidates: 1000, features: ['basic_reports', 'proctoring', 'coding'] },
};

@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  async getOrganizationPlan(organizationId: string) {
    const customer = await this.prisma.billingCustomer.findUnique({
      where: { organizationId },
      include: { subscriptions: { where: { status: 'ACTIVE' } } }
    });

    if (!customer || customer.subscriptions.length === 0) {
      return PLANS.free;
    }

    const sub = customer.subscriptions[0];
    return PLANS[sub.planId as keyof typeof PLANS] || PLANS.free;
  }

  async canCreateAssessment(organizationId: string) {
    const plan = await this.getOrganizationPlan(organizationId);
    
    // Check usage
    const count = await this.prisma.assessment.count({
      where: { organizationId }
    });

    if (count >= plan.maxAssessments) {
      throw new ForbiddenException(`Plan limit reached: maximum ${plan.maxAssessments} assessments allowed.`);
    }
    
    return true;
  }

  async canInviteCandidate(organizationId: string) {
    const plan = await this.getOrganizationPlan(organizationId);
    
    const count = await this.prisma.candidate.count({
      where: { organizationId }
    });

    if (count >= plan.maxCandidates) {
      throw new ForbiddenException(`Plan limit reached: maximum ${plan.maxCandidates} candidates allowed.`);
    }
    
    return true;
  }
}
