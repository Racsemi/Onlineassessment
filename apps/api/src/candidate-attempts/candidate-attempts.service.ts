import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { SaveAnswerDto } from '../candidate-auth/dto/candidate.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CandidateAttemptsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @InjectQueue('evaluation-queue') private evaluationQueue: Queue
  ) {}

  async startAttempt(candidateId: string, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessmentVersion: true }
    });

    if (!attempt || attempt.candidateId !== candidateId) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'CREATED') {
      // Idempotency: if already IN_PROGRESS, just return it
      if (attempt.status === 'IN_PROGRESS') return attempt;
      throw new ConflictException(`Cannot start attempt in ${attempt.status} state`);
    }

    const settings = (attempt.assessmentVersion.snapshot as any).settings;
    const durationMinutes = settings?.durationMinutes || 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    const updated = await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'IN_PROGRESS',
        startedAt,
        expiresAt,
        lastActivityAt: new Date()
      }
    });

    await this.prisma.proctoringSession.upsert({
      where: { attemptId },
      update: {},
      create: { attemptId }
    });

    return updated;
  }

  async getAttemptQuestions(candidateId: string, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessmentVersion: true, answers: true }
    });

    if (!attempt || attempt.candidateId !== candidateId) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
       throw new ForbiddenException(`Cannot view questions for attempt in ${attempt.status} state`);
    }

    if (attempt.expiresAt && attempt.expiresAt < new Date()) {
      await this.markExpired(attemptId);
      throw new ForbiddenException('Attempt has expired');
    }

    const snapshot = attempt.assessmentVersion.snapshot as any;
    
    // Process DTOs to strip sensitive info
    const safeSections = snapshot.sections.map((section: any) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      displayOrder: section.displayOrder,
      questions: section.questions.map((q: any) => {
        const safeOptions = q.options?.map((o: any) => ({
          id: o.id,
          text: o.text,
          displayOrder: o.displayOrder,
        }));
        
        // Expose only safe configuration keys
        let safeConfig = undefined;
        if (q.type === 'CODING' && q.configuration) {
           safeConfig = {
             timeLimit: q.configuration.timeLimit,
             memoryLimit: q.configuration.memoryLimit,
             allowedLanguages: q.configuration.allowedLanguages,
             starterCode: q.configuration.starterCode,
           };
        }

        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          displayOrder: q.displayOrder,
          required: q.required,
          options: safeOptions,
          configuration: safeConfig,
        };
      })
    }));

    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      sections: safeSections,
      answers: attempt.answers.map(a => ({ questionId: a.questionId, answerData: a.answerData }))
    };
  }

  async saveAnswer(candidateId: string, attemptId: string, questionId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessmentVersion: true }
    });

    if (!attempt || attempt.candidateId !== candidateId) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ForbiddenException(`Cannot modify answer for attempt in ${attempt.status} state`);
    }

    if (attempt.expiresAt && attempt.expiresAt < new Date()) {
      await this.markExpired(attemptId);
      throw new ForbiddenException('Attempt has expired');
    }

    // Validate questionId exists in version
    const snapshot = attempt.assessmentVersion.snapshot as any;
    let questionFound = false;
    for (const s of snapshot.sections) {
      if (s.questions.some((q: any) => q.id === questionId)) {
        questionFound = true;
        break;
      }
    }

    if (!questionFound) {
      throw new BadRequestException('Question does not belong to this assessment version');
    }

    // Upsert answer
    const answer = await this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { answerData: dto.answerData },
      create: { attemptId, questionId, answerData: dto.answerData }
    });

    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { lastActivityAt: new Date() }
    });

    return answer;
  }

  async submitAttempt(candidateId: string, attemptId: string) {
    // Transactional submission
    const submittedAttempt = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id: attemptId },
        include: { candidate: true, assessmentVersion: { include: { assessment: true } } }
      });

      if (!attempt || attempt.candidateId !== candidateId) {
        throw new NotFoundException('Attempt not found');
      }

      if (attempt.status === 'SUBMITTED') {
        return attempt; // Idempotent
      }

      if (attempt.status !== 'IN_PROGRESS') {
        throw new ForbiddenException(`Cannot submit attempt from ${attempt.status} state`);
      }

      if (attempt.expiresAt && attempt.expiresAt < new Date()) {
        await tx.assessmentAttempt.update({
          where: { id: attemptId },
          data: { status: 'EXPIRED' }
        });
        throw new ForbiddenException('Attempt has expired and cannot be submitted');
      }

      return tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          lastActivityAt: new Date()
        },
        include: { candidate: true, assessmentVersion: { include: { assessment: true } } }
      });
    });

    // Fire off async jobs
    await this.evaluationQueue.add('evaluate-attempt', { attemptId });
    await this.notificationsService.sendAssessmentSubmitted(
      attemptId,
      submittedAttempt.candidate.email,
      submittedAttempt.candidate.name,
      submittedAttempt.assessmentVersion.assessment.title
    );

    return submittedAttempt;
  }

  async evaluateCode(candidateId: string, attemptId: string, questionId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessmentVersion: true }
    });

    if (!attempt || attempt.candidateId !== candidateId) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ForbiddenException(`Cannot evaluate code for attempt in ${attempt.status} state`);
    }

    if (attempt.expiresAt && attempt.expiresAt < new Date()) {
      await this.markExpired(attemptId);
      throw new ForbiddenException('Attempt has expired');
    }

    // Verify question is CODING type
    const snapshot = attempt.assessmentVersion.snapshot as any;
    let question: any = null;
    for (const s of snapshot.sections) {
      question = s.questions.find((q: any) => q.id === questionId);
      if (question) break;
    }

    if (!question || question.type !== 'CODING') {
      throw new BadRequestException('Question is not a coding question');
    }

    const job = await this.evaluationQueue.add('evaluate', {
      attemptId,
      questionId,
      language: 'javascript' // Typically passed in DTO, assuming default for now
    });

    return { jobId: job.id };
  }

  private async markExpired(attemptId: string) {
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: 'EXPIRED' }
    });
  }
}

