import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssessmentDto, UpdateAssessmentDto } from './dto/assessment.dto.js';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto.js';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto.js';
import { EntitlementsService } from '../billing/entitlements.service.js';

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService
  ) {}

  // ==========================
  // ASSESSMENTS
  // ==========================

  async createAssessment(organizationId: string, createdBy: string, dto: CreateAssessmentDto) {
    await this.entitlementsService.canCreateAssessment(organizationId);

    const { settings, ...assessmentData } = dto;
    return this.prisma.assessment.create({
      data: {
        ...assessmentData,
        organizationId,
        createdBy,
        settings: settings ? { create: settings } : undefined,
      },
      include: { settings: true }
    });
  }

  async getAssessments(organizationId: string) {
    return this.prisma.assessment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { settings: true },
    });
  }

  async getAssessment(organizationId: string, id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { 
        settings: true,
        sections: {
          orderBy: { displayOrder: 'asc' },
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
              include: {
                options: {
                  orderBy: { displayOrder: 'asc' }
                }
              }
            }
          }
        }
      },
    });

    if (!assessment || assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment not found');
    }

    return assessment;
  }

  async updateAssessment(organizationId: string, id: string, dto: UpdateAssessmentDto) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status === 'PUBLISHED') {
      throw new ForbiddenException('Cannot modify a published assessment directly. Create a new version.');
    }

    const { settings, ...data } = dto;

    return this.prisma.assessment.update({
      where: { id },
      data: {
        ...data,
        settings: settings ? {
          upsert: {
            create: settings,
            update: settings,
          }
        } : undefined
      },
      include: { settings: true }
    });
  }

  async deleteAssessment(organizationId: string, id: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status === 'PUBLISHED') {
      return this.prisma.assessment.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() }
      });
    }

    return this.prisma.assessment.delete({ where: { id } });
  }

  // ==========================
  // SECTIONS
  // ==========================

  async createSection(organizationId: string, assessmentId: string, dto: CreateSectionDto) {
    await this.verifyAssessmentOwnership(organizationId, assessmentId);
    return this.prisma.assessmentSection.create({
      data: {
        ...dto,
        assessmentId,
      }
    });
  }

  async getSections(organizationId: string, assessmentId: string) {
    await this.verifyAssessmentOwnership(organizationId, assessmentId);
    return this.prisma.assessmentSection.findMany({
      where: { assessmentId },
      orderBy: { displayOrder: 'asc' }
    });
  }

  async updateSection(organizationId: string, assessmentId: string, sectionId: string, dto: UpdateSectionDto) {
    await this.verifySectionOwnership(organizationId, assessmentId, sectionId);
    return this.prisma.assessmentSection.update({
      where: { id: sectionId },
      data: dto
    });
  }

  async deleteSection(organizationId: string, assessmentId: string, sectionId: string) {
    await this.verifySectionOwnership(organizationId, assessmentId, sectionId);
    return this.prisma.assessmentSection.delete({ where: { id: sectionId } });
  }

  // ==========================
  // QUESTIONS
  // ==========================

  async createQuestion(organizationId: string, assessmentId: string, sectionId: string, dto: CreateQuestionDto) {
    await this.verifySectionOwnership(organizationId, assessmentId, sectionId);
    const { options, ...questionData } = dto;

    const createData: any = {
      ...questionData,
      sectionId,
      options: options ? {
        create: options
      } : undefined
    };

    return this.prisma.assessmentQuestion.create({
      data: createData,
      include: { options: true }
    });
  }

  async getQuestions(organizationId: string, assessmentId: string, sectionId: string) {
    await this.verifySectionOwnership(organizationId, assessmentId, sectionId);
    return this.prisma.assessmentQuestion.findMany({
      where: { sectionId },
      orderBy: { displayOrder: 'asc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } }
    });
  }

  async updateQuestion(organizationId: string, assessmentId: string, sectionId: string, questionId: string, dto: UpdateQuestionDto) {
    await this.verifyQuestionOwnership(organizationId, assessmentId, sectionId, questionId);
    const { options, ...data } = dto;
    const updateData: any = { ...data };

    return this.prisma.$transaction(async (tx) => {
      const q = await tx.assessmentQuestion.update({
        where: { id: questionId },
        data: updateData
      });

      if (options) {
        // Simple approach for draft updates: wipe and recreate options
        await tx.questionOption.deleteMany({ where: { questionId } });
        if (options.length > 0) {
          await tx.questionOption.createMany({
            data: options.map(o => ({
              ...o,
              questionId,
            }))
          });
        }
      }

      return tx.assessmentQuestion.findUnique({
        where: { id: questionId },
        include: { options: { orderBy: { displayOrder: 'asc' } } }
      });
    });
  }

  async deleteQuestion(organizationId: string, assessmentId: string, sectionId: string, questionId: string) {
    await this.verifyQuestionOwnership(organizationId, assessmentId, sectionId, questionId);
    return this.prisma.assessmentQuestion.delete({ where: { id: questionId } });
  }

  // ==========================
  // PUBLISHING
  // ==========================

  async publishAssessment(organizationId: string, assessmentId: string, publishedBy: string) {
    const assessment = await this.getAssessment(organizationId, assessmentId); // Validates ownership

    if (assessment.status === 'PUBLISHED') {
      throw new ConflictException('Assessment is already published.');
    }

    if (assessment.sections.length === 0) {
      throw new BadRequestException('Assessment must have at least one section to publish.');
    }

    // Comprehensive Validation
    for (const section of assessment.sections) {
      if (section.questions.length === 0) {
        throw new BadRequestException(`Section "${section.title}" must have at least one question.`);
      }

      for (const question of section.questions) {
        if (['MCQ_SINGLE', 'MCQ_MULTI'].includes(question.type)) {
          if (question.options.length < 2) {
            throw new BadRequestException(`MCQ Question "${question.prompt}" must have at least two options.`);
          }
          const correctOptions = question.options.filter(o => o.isCorrect);
          if (correctOptions.length === 0) {
            throw new BadRequestException(`MCQ Question "${question.prompt}" must have at least one correct option.`);
          }
          if (question.type === 'MCQ_SINGLE' && correctOptions.length > 1) {
            throw new BadRequestException(`MCQ_SINGLE Question "${question.prompt}" cannot have multiple correct options.`);
          }
        }
        if (question.type === 'TRUE_FALSE') {
          if (question.options.length !== 2) {
             throw new BadRequestException(`TRUE_FALSE Question "${question.prompt}" must have exactly two options.`);
          }
          const correctOptions = question.options.filter(o => o.isCorrect);
          if (correctOptions.length !== 1) {
            throw new BadRequestException(`TRUE_FALSE Question "${question.prompt}" must have exactly one correct option.`);
          }
        }
      }
    }

    // Transactionally create snapshot and update status
    return this.prisma.$transaction(async (tx) => {
      const lastVersion = await tx.assessmentVersion.findFirst({
        where: { assessmentId },
        orderBy: { versionNumber: 'desc' },
      });

      const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

      const snapshot = JSON.parse(JSON.stringify(assessment)); // Deep copy the retrieved assessment structure

      const version = await tx.assessmentVersion.create({
        data: {
          assessmentId,
          versionNumber: nextVersionNumber,
          publishedBy,
          snapshot,
        }
      });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        }
      });

      return version;
    });
  }

  // ==========================
  // OWNERSHIP HELPERS
  // ==========================
  
  private async verifyAssessmentOwnership(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { organizationId: true, status: true }
    });
    if (!assessment || assessment.organizationId !== organizationId) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status === 'PUBLISHED') {
      throw new ForbiddenException('Cannot modify a published assessment directly. Create a new version.');
    }
  }

  private async verifySectionOwnership(organizationId: string, assessmentId: string, sectionId: string) {
    await this.verifyAssessmentOwnership(organizationId, assessmentId);
    const section = await this.prisma.assessmentSection.findUnique({
      where: { id: sectionId },
      select: { assessmentId: true }
    });
    if (!section || section.assessmentId !== assessmentId) {
      throw new NotFoundException('Section not found');
    }
  }

  private async verifyQuestionOwnership(organizationId: string, assessmentId: string, sectionId: string, questionId: string) {
    await this.verifySectionOwnership(organizationId, assessmentId, sectionId);
    const question = await this.prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      select: { sectionId: true }
    });
    if (!question || question.sectionId !== sectionId) {
      throw new NotFoundException('Question not found');
    }
  }
}
