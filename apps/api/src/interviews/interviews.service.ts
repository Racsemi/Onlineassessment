import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { MediaTokenService } from './services/media-token.service.js';
import { InterviewCodeService } from './services/interview-code.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CreateInterviewDto,
  RescheduleInterviewDto,
  CancelInterviewDto,
  SetAvailabilityDto,
  CreateQuestionBankDto,
  CreateNoteDto,
  SubmitScorecardDto,
  ExecuteCodeDto,
  DeviceCheckDto,
} from './dto/interview.dto.js';
import crypto from 'crypto';

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private prisma: PrismaService,
    private mediaTokenService: MediaTokenService,
    private codeService: InterviewCodeService,
    private notificationsService: NotificationsService,
  ) {}

  // ==========================================
  // SCHEDULING & INTERVIEW CRUD
  // ==========================================

  async createInterview(organizationId: string, createdById: string, dto: CreateInterviewDto) {
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);

    if (start >= end) {
      throw new BadRequestException('Scheduled start time must be before end time');
    }

    // 1. Verify candidate belongs to organization
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, organizationId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found in this organization');
    }

    // 2. Verify all interviewers are active organization members
    const allUserIds = Array.from(
      new Set([
        ...dto.interviewerIds,
        ...(dto.leadInterviewerId ? [dto.leadInterviewerId] : []),
        ...(dto.observerIds || []),
      ])
    );

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: { in: allUserIds },
        status: 'ACTIVE',
      },
    });

    if (members.length !== allUserIds.length) {
      throw new BadRequestException('One or more assigned interviewers are not active members of this organization');
    }

    // 3. Concurrency Protection & Overlap Detection
    // Check if candidate has an overlapping active interview
    const candidateConflict = await this.prisma.interview.findFirst({
      where: {
        organizationId,
        candidateId: dto.candidateId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
    });

    if (candidateConflict) {
      throw new ConflictException(`Candidate already has an interview booked between ${candidateConflict.scheduledStart.toISOString()} and ${candidateConflict.scheduledEnd.toISOString()}`);
    }

    // Check if any interviewer has an overlapping active interview
    const interviewerConflict = await this.prisma.interviewParticipant.findFirst({
      where: {
        userId: { in: allUserIds },
        role: { in: ['INTERVIEWER', 'LEAD_INTERVIEWER'] },
        interview: {
          organizationId,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          scheduledStart: { lt: end },
          scheduledEnd: { gt: start },
        },
      },
      include: {
        interview: true,
        user: true,
      },
    });

    if (interviewerConflict) {
      throw new ConflictException(
        `Interviewer ${interviewerConflict.user?.name || 'assigned'} already has an interview booked from ${interviewerConflict.interview.scheduledStart.toISOString()} to ${interviewerConflict.interview.scheduledEnd.toISOString()}`
      );
    }

    // 4. Generate unique, unpredictable room identity
    const roomName = `rm_int_${crypto.randomBytes(12).toString('hex')}`;
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');

    // 5. Execute in interactive transaction
    const interview = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          organizationId,
          candidateId: dto.candidateId,
          createdById,
          title: dto.title,
          description: dto.description,
          type: dto.type,
          status: 'SCHEDULED',
          scheduledStart: start,
          scheduledEnd: end,
          durationMinutes: dto.durationMinutes,
          instructions: dto.instructions,
          roomName,
          recordingEnabled: dto.recordingEnabled,
          screenShareAllowed: dto.screenShareAllowed,
          codingEnabled: dto.codingEnabled,
        },
      });

      // Add candidate as participant
      await tx.interviewParticipant.create({
        data: {
          interviewId: created.id,
          candidateId: dto.candidateId,
          role: 'CANDIDATE',
        },
      });

      // Add interviewers
      for (const interviewerId of dto.interviewerIds) {
        const isLead = interviewerId === dto.leadInterviewerId;
        await tx.interviewParticipant.create({
          data: {
            interviewId: created.id,
            userId: interviewerId,
            role: isLead ? 'LEAD_INTERVIEWER' : 'INTERVIEWER',
          },
        });
      }

      // Add observers
      for (const observerId of dto.observerIds || []) {
        await tx.interviewParticipant.create({
          data: {
            interviewId: created.id,
            userId: observerId,
            role: 'OBSERVER',
          },
        });
      }

      // Create magic invitation link for candidate
      await tx.interviewInvitation.create({
        data: {
          interviewId: created.id,
          tokenHash,
          expiresAt: new Date(end.getTime() + 24 * 60 * 60 * 1000), // Valid until 24h after end
        },
      });

      // Update candidate pipeline stage to INTERVIEW
      await tx.candidate.update({
        where: { id: dto.candidateId },
        data: { pipelineStage: 'INTERVIEW' },
      });

      // Log Audit Event
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: createdById,
          action: 'INTERVIEW_SCHEDULED',
          resourceType: 'Interview',
          resourceId: created.id,
          metadata: {
            title: dto.title,
            candidateId: dto.candidateId,
            scheduledStart: start.toISOString(),
            scheduledEnd: end.toISOString(),
          },
        },
      });

      return created;
    });

    // Enqueue interview invitation email (async, non-blocking)
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    this.notificationsService.sendAssessmentInvitation(
      interview.id,
      candidate.email,
      candidate.name,
      org?.name || 'Racsemi Assess',
      `Technical Interview: ${dto.title}`,
      rawInviteToken
    ).catch((e) => this.logger.warn(`Failed to enqueue invitation mail: ${e.message}`));

    return this.getInterviewById(organizationId, interview.id, createdById);
  }

  async getInterviews(
    organizationId: string,
    filters: {
      candidateId?: string;
      interviewerId?: string;
      status?: string;
      from?: string;
      to?: string;
    }
  ) {
    const where: any = { organizationId };

    if (filters.candidateId) where.candidateId = filters.candidateId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.scheduledStart = {};
      if (filters.from) where.scheduledStart.gte = new Date(filters.from);
      if (filters.to) where.scheduledStart.lte = new Date(filters.to);
    }

    if (filters.interviewerId) {
      where.participants = {
        some: { userId: filters.interviewerId },
      };
    }

    return this.prisma.interview.findMany({
      where,
      orderBy: { scheduledStart: 'asc' },
      include: {
        candidate: true,
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        scorecards: {
          select: { id: true, interviewerId: true, isSubmitted: true, recommendation: true },
        },
      },
    });
  }

  async getCalendar(organizationId: string, startStr: string, endStr: string) {
    const start = new Date(startStr);
    const end = new Date(endStr);

    const interviews = await this.prisma.interview.findMany({
      where: {
        organizationId,
        status: { notIn: ['CANCELLED'] },
        scheduledStart: { gte: start, lte: end },
      },
      include: {
        candidate: { select: { id: true, name: true, email: true, pipelineStage: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const availabilities = await this.prisma.interviewAvailability.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return {
      interviews,
      availabilities,
    };
  }

  async getInterviewById(organizationId: string, interviewId: string, requestingUserId?: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
      include: {
        candidate: true,
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        scorecards: {
          include: {
            interviewer: { select: { id: true, name: true } },
            scores: true,
          },
        },
        notes: {
          where: requestingUserId ? { authorId: requestingUserId } : {},
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
        codingSessions: true,
        events: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  async rescheduleInterview(
    organizationId: string,
    interviewId: string,
    userId: string,
    dto: RescheduleInterviewDto
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
      include: { participants: true },
    });

    if (!interview) throw new NotFoundException('Interview not found');
    if (['COMPLETED', 'CANCELLED'].includes(interview.status)) {
      throw new BadRequestException(`Cannot reschedule interview with status ${interview.status}`);
    }

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);

    if (start >= end) {
      throw new BadRequestException('Scheduled start time must be before end time');
    }

    // Check interviewer conflicts
    const userIds = interview.participants
      .filter((p) => p.userId && ['INTERVIEWER', 'LEAD_INTERVIEWER'].includes(p.role))
      .map((p) => p.userId!);

    const conflict = await this.prisma.interviewParticipant.findFirst({
      where: {
        userId: { in: userIds },
        interview: {
          id: { not: interviewId },
          organizationId,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          scheduledStart: { lt: end },
          scheduledEnd: { gt: start },
        },
      },
      include: { user: true, interview: true },
    });

    if (conflict) {
      throw new ConflictException(
        `Interviewer ${conflict.user?.name || ''} has a conflict for the selected time slot`
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        scheduledStart: start,
        scheduledEnd: end,
        status: 'CONFIRMED',
        updatedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: userId,
        action: 'INTERVIEW_RESCHEDULED',
        resourceType: 'Interview',
        resourceId: interviewId,
        metadata: {
          previousStart: interview.scheduledStart.toISOString(),
          newStart: start.toISOString(),
          reason: dto.reason,
        },
      },
    });

    return updated;
  }

  async cancelInterview(
    organizationId: string,
    interviewId: string,
    userId: string,
    dto: CancelInterviewDto
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
    });

    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.status === 'CANCELLED') return interview;

    const cancelled = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: userId,
        action: 'INTERVIEW_CANCELLED',
        resourceType: 'Interview',
        resourceId: interviewId,
        metadata: { reason: dto.reason },
      },
    });

    return cancelled;
  }

  async updateCandidatePipelineStage(
    organizationId: string,
    candidateId: string,
    userId: string,
    stage: string
  ) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
    });

    if (!candidate) throw new NotFoundException('Candidate not found');

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { pipelineStage: stage },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: userId,
        action: 'CANDIDATE_PIPELINE_STAGE_UPDATED',
        resourceType: 'Candidate',
        resourceId: candidateId,
        metadata: { from: candidate.pipelineStage, to: stage },
      },
    });

    return updated;
  }

  // ==========================================
  // AVAILABILITY & WORKING HOURS
  // ==========================================

  async getInterviewerAvailability(organizationId: string, userId: string) {
    return this.prisma.interviewAvailability.findMany({
      where: { organizationId, userId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setInterviewerAvailability(
    organizationId: string,
    userId: string,
    dto: SetAvailabilityDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Clear existing availability for user
      await tx.interviewAvailability.deleteMany({
        where: { organizationId, userId },
      });

      // Insert new records
      if (dto.availabilities.length > 0) {
        await tx.interviewAvailability.createMany({
          data: dto.availabilities.map((a) => ({
            organizationId,
            userId,
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            timezone: a.timezone,
            isBlocked: a.isBlocked,
            specificDate: a.specificDate ? new Date(a.specificDate) : null,
          })),
        });
      }

      return tx.interviewAvailability.findMany({
        where: { organizationId, userId },
      });
    });
  }

  // ==========================================
  // ROOM ACCESS & LIVEKIT TOKENS (MEMBERS)
  // ==========================================

  async getMemberRoomToken(organizationId: string, interviewId: string, user: any) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
      include: {
        participants: { where: { userId: user.id } },
      },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    const participant = interview.participants[0];
    if (!participant) {
      throw new ForbiddenException('You are not an assigned participant for this interview');
    }

    const role = participant.role as 'INTERVIEWER' | 'LEAD_INTERVIEWER' | 'OBSERVER' | 'RECRUITER';

    // Mark interview IN_PROGRESS if first time joining
    if (['SCHEDULED', 'CONFIRMED', 'WAITING'].includes(interview.status)) {
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: 'IN_PROGRESS',
          actualStart: interview.actualStart || new Date(),
        },
      }).catch(() => {});
    }

    // Update connection status
    await this.prisma.interviewParticipant.update({
      where: { id: participant.id },
      data: {
        joinedAt: participant.joinedAt || new Date(),
        connectionStatus: 'CONNECTED',
      },
    });

    return this.mediaTokenService.generateToken({
      roomName: interview.roomName,
      participantIdentity: `user_${user.id}`,
      participantName: user.name || user.email,
      role,
      screenShareAllowed: interview.screenShareAllowed,
    });
  }

  // ==========================================
  // CANDIDATE JOIN FLOW & VALIDATION
  // ==========================================

  async validateCandidateInvite(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.interviewInvitation.findUnique({
      where: { tokenHash },
      include: {
        interview: {
          include: {
            candidate: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid or unrecognized interview invitation link');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ForbiddenException('This interview invitation has expired');
    }

    // Mark as used
    if (!invitation.usedAt) {
      await this.prisma.interviewInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
    }

    // Generate or reuse CandidateSession
    const candidateSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(candidateSessionToken).digest('hex');

    await this.prisma.candidateSession.create({
      data: {
        candidateId: invitation.interview.candidateId,
        sessionTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return {
      candidateSessionToken,
      interview: {
        id: invitation.interview.id,
        title: invitation.interview.title,
        status: invitation.interview.status,
        scheduledStart: invitation.interview.scheduledStart,
        scheduledEnd: invitation.interview.scheduledEnd,
        durationMinutes: invitation.interview.durationMinutes,
        instructions: invitation.interview.instructions,
        organization: invitation.interview.organization,
        candidate: {
          id: invitation.interview.candidate.id,
          name: invitation.interview.candidate.name,
          email: invitation.interview.candidate.email,
        },
      },
    };
  }

  async getCandidateInterviewDetails(candidateId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidateId },
      include: {
        organization: { select: { id: true, name: true } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    return {
      id: interview.id,
      title: interview.title,
      description: interview.description,
      status: interview.status,
      scheduledStart: interview.scheduledStart,
      scheduledEnd: interview.scheduledEnd,
      durationMinutes: interview.durationMinutes,
      instructions: interview.instructions,
      screenShareAllowed: interview.screenShareAllowed,
      codingEnabled: interview.codingEnabled,
      organization: interview.organization,
      candidate: interview.candidate,
    };
  }

  async getCandidateRoomToken(candidateId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidateId },
      include: { candidate: true },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    if (interview.status === 'CANCELLED') {
      throw new ForbiddenException('This interview has been cancelled');
    }

    const participant = await this.prisma.interviewParticipant.findFirst({
      where: { interviewId, candidateId },
    });

    if (participant) {
      await this.prisma.interviewParticipant.update({
        where: { id: participant.id },
        data: {
          joinedAt: participant.joinedAt || new Date(),
          connectionStatus: 'CONNECTED',
        },
      });
    }

    return this.mediaTokenService.generateToken({
      roomName: interview.roomName,
      participantIdentity: `cand_${candidateId}`,
      participantName: interview.candidate.name,
      role: 'CANDIDATE',
      screenShareAllowed: interview.screenShareAllowed,
    });
  }

  async recordDeviceCheck(candidateId: string, interviewId: string, dto: DeviceCheckDto) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidateId },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    await this.prisma.interviewEvent.create({
      data: {
        interviewId,
        type: 'DEVICE_CHECK_COMPLETED',
        actorName: 'Candidate',
        metadata: { ...dto },
      },
    });

    return { success: true, message: 'Device check recorded' };
  }

  // ==========================================
  // IN-INTERVIEW: PRIVATE NOTES
  // ==========================================

  async getNotes(organizationId: string, interviewId: string, userId: string) {
    return this.prisma.interviewNote.findMany({
      where: { interviewId, authorId: userId, interview: { organizationId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(
    organizationId: string,
    interviewId: string,
    authorId: string,
    dto: CreateNoteDto
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    return this.prisma.interviewNote.create({
      data: {
        interviewId,
        authorId,
        category: dto.category,
        content: dto.content,
        isPrivate: true,
      },
    });
  }

  // ==========================================
  // IN-INTERVIEW: QUESTIONS & QUESTION BANK
  // ==========================================

  async getQuestionBank(organizationId: string, category?: string) {
    const where: any = { organizationId };
    if (category) where.category = category;
    return this.prisma.interviewQuestionBank.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async createQuestionBankItem(organizationId: string, dto: CreateQuestionBankDto) {
    return this.prisma.interviewQuestionBank.create({
      data: {
        organizationId,
        title: dto.title,
        category: dto.category,
        difficulty: dto.difficulty,
        prompt: dto.prompt,
        expectedAnswer: dto.expectedAnswer,
        configuration: dto.configuration,
      },
    });
  }

  // ==========================================
  // IN-INTERVIEW: SCORECARDS
  // ==========================================

  async getScorecards(organizationId: string, interviewId: string) {
    return this.prisma.interviewScorecard.findMany({
      where: { interviewId, interview: { organizationId } },
      include: {
        interviewer: { select: { id: true, name: true, email: true } },
        scores: true,
      },
    });
  }

  async submitScorecard(
    organizationId: string,
    interviewId: string,
    interviewerId: string,
    dto: SubmitScorecardDto
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, organizationId },
    });

    if (!interview) throw new NotFoundException('Interview not found');

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert scorecard header
      const scorecard = await tx.interviewScorecard.upsert({
        where: { interviewId_interviewerId: { interviewId, interviewerId } },
        update: {
          isSubmitted: true,
          submittedAt: new Date(),
          recommendation: dto.recommendation,
          summary: dto.summary,
          updatedAt: new Date(),
        },
        create: {
          interviewId,
          interviewerId,
          isSubmitted: true,
          submittedAt: new Date(),
          recommendation: dto.recommendation,
          summary: dto.summary,
        },
      });

      // Clear previous criterion scores for this scorecard
      await tx.interviewCriterionScore.deleteMany({
        where: { scorecardId: scorecard.id },
      });

      // Insert fresh scores
      await tx.interviewCriterionScore.createMany({
        data: dto.scores.map((s) => ({
          scorecardId: scorecard.id,
          criterion: s.criterion,
          score: s.score,
          feedback: s.feedback,
        })),
      });

      // Update interview resultOutcome if lead interviewer or completed
      await tx.interview.update({
        where: { id: interviewId },
        data: {
          resultOutcome: dto.recommendation,
          status: 'COMPLETED',
          actualEnd: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: interviewerId,
          action: 'SCORECARD_SUBMITTED',
          resourceType: 'InterviewScorecard',
          resourceId: scorecard.id,
          metadata: { recommendation: dto.recommendation, criteriaCount: dto.scores.length },
        },
      });

      return tx.interviewScorecard.findUnique({
        where: { id: scorecard.id },
        include: { scores: true, interviewer: { select: { id: true, name: true } } },
      });
    });

    return result;
  }

  // ==========================================
  // IN-INTERVIEW: LIVE CODING
  // ==========================================

  async executeLiveCode(interviewId: string, dto: ExecuteCodeDto) {
    return this.codeService.executeCode(interviewId, dto.language, dto.code, dto.stdin);
  }
}
