import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ProctoringService } from '../proctoring/proctoring.service.js';
import crypto from 'crypto';

@Injectable()
export class CandidateAuthService {
  constructor(
    private prisma: PrismaService,
    private proctoringService: ProctoringService
  ) {}

  async validateInvitationAndCreateSession(token: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await this.prisma.assessmentInvitation.findUnique({
      where: { tokenHash },
      include: {
        assessmentVersion: true,
        attempts: true
      }
    });

    if (!invitation) {
      throw new UnauthorizedException('Invalid invitation token');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ForbiddenException('Invitation has expired');
    }

    if (invitation.status === 'REVOKED') {
      throw new ForbiddenException('Invitation has been revoked');
    }

    let attemptId = invitation.attempts[0]?.id;

    if (!attemptId) {
      const attempt = await this.prisma.assessmentAttempt.create({
        data: {
          organizationId: invitation.organizationId,
          candidateId: invitation.candidateId,
          assessmentVersionId: invitation.assessmentVersionId,
          invitationId: invitation.id,
          status: 'CREATED'
        }
      });
      attemptId = attempt.id;
    } else {
      const attempt = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId } });
      if (attempt?.status === 'SUBMITTED' || attempt?.status === 'EXPIRED') {
        throw new ForbiddenException(`Attempt is already ${attempt.status}`);
      }
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    const session = await this.prisma.candidateSession.create({
      data: {
        candidateId: invitation.candidateId,
        attemptId,
        sessionTokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    // Check concurrency anomaly asynchronously
    this.proctoringService.checkConcurrencyAnomaly(attemptId, session.id).catch(err => {
      console.error('Failed to run concurrency check:', err);
    });

    return { sessionToken, attemptId };
  }
}
