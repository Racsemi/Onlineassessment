import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getAssessmentAnalytics(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        versions: {
          include: {
            attempts: {
              include: { result: true }
            }
          }
        }
      }
    });

    if (!assessment || assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment not found');
    }

    const allAttempts = assessment.versions.flatMap(v => v.attempts);
    
    let started = 0;
    let completed = 0;
    let totalScore = 0;
    let totalPassed = 0;

    for (const attempt of allAttempts) {
      if (attempt.status !== 'CREATED') started++;
      if (attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED') {
        completed++;
        if (attempt.result) {
          totalScore += attempt.result.percentage;
          if (attempt.result.status === 'PASSED') totalPassed++;
        }
      }
    }

    const completionRate = started > 0 ? (completed / started) * 100 : 0;
    const averageScore = completed > 0 ? (totalScore / completed) : 0;
    const passRate = completed > 0 ? (totalPassed / completed) * 100 : 0;

    return {
      totalAttempts: started,
      completedAttempts: completed,
      completionRate,
      averageScore,
      passRate
    };
  }

  async getAttemptDetailedReport(organizationId: string, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        candidate: true,
        assessmentVersion: { include: { assessment: true } },
        result: true,
        evaluationResults: true,
        proctoringSession: { include: { events: { orderBy: { timestamp: 'asc' } } } }
      }
    });

    if (!attempt || attempt.organizationId !== organizationId) {
      throw new NotFoundException('Attempt not found');
    }

    return attempt;
  }
}
