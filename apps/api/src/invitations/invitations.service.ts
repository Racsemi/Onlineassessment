import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EntitlementsService } from '../billing/entitlements.service.js';
import { CreateInvitationDto } from './dto/invitation.dto.js';
import crypto from 'crypto';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private entitlementsService: EntitlementsService
  ) {}

  async inviteCandidate(organizationId: string, dto: CreateInvitationDto) {
    await this.entitlementsService.canInviteCandidate(organizationId);

    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: dto.assessmentVersionId },
      include: { assessment: { include: { organization: true } } }
    });

    if (!version || version.assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment Version not found');
    }

    // Upsert Candidate
    let candidate = await this.prisma.candidate.findFirst({
      where: { organizationId, email: dto.candidateEmail }
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          organizationId,
          email: dto.candidateEmail,
          name: dto.candidateName
        }
      });
    }

    // Check existing active invitation
    const existingInv = await this.prisma.assessmentInvitation.findFirst({
      where: {
        organizationId,
        candidateId: candidate.id,
        assessmentVersionId: version.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInv) {
      throw new ConflictException('Candidate already has an active invitation for this assessment');
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.assessmentInvitation.create({
      data: {
        organizationId,
        candidateId: candidate.id,
        assessmentVersionId: version.id,
        tokenHash,
        expiresAt
      }
    });

    await this.notificationsService.sendAssessmentInvitation(
      invitation.id,
      candidate.email,
      candidate.name,
      version.assessment.organization.name,
      version.assessment.title,
      rawToken
    );

    return { id: invitation.id, status: invitation.status, expiresAt: invitation.expiresAt };
  }
}
