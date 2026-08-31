import { Request, Response } from 'express';
import prisma from '../utils/db';

export const createAssessment = async (req: Request, res: Response) => {
  try {
    const { title, description, duration, instructions, startDate, endDate, sections } = req.body;
    const totalDuration = sections ? sections.reduce((sum: number, sec: any) => sum + (Number(sec.duration) || 0), 0) : duration || 0;

    const assessment = await prisma.assessment.create({
      data: {
        title,
        description,
        duration: totalDuration,
        instructions,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: req.body.status || 'DRAFT',
        sections: sections ? {
          create: sections.map((sec: any, i: number) => ({
            name: sec.name || `Section ${i + 1}`,
            description: sec.description || '',
            duration: Number(sec.duration) || 0,
            order: i,
            questions: sec.questionIds && sec.questionIds.length > 0 ? {
              connect: sec.questionIds.map((id: string) => ({ id }))
            } : undefined
          }))
        } : undefined
      }
    });
    
    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create assessment' });
  }
};

export const getAssessments = async (req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { candidates: true }
        }
      }
    });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
};

export const getAssessmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            questions: {
              include: { options: true }
            },
            codingQuestions: {
              include: { testCases: true }
            }
          }
        }
      }
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
};

export const updateAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, duration, instructions, status, startDate, endDate, sections } = req.body;
    
    if (sections) {
      await prisma.section.deleteMany({ where: { assessmentId: id } });
    }

    const totalDuration = sections ? sections.reduce((sum: number, sec: any) => sum + (Number(sec.duration) || 0), 0) : duration || 0;

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        title,
        description,
        duration: totalDuration,
        instructions,
        status: status || 'DRAFT',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sections: sections ? {
          create: sections.map((sec: any, i: number) => ({
            name: sec.name || `Section ${i + 1}`,
            description: sec.description || '',
            duration: Number(sec.duration) || 0,
            order: i,
            questions: sec.questionIds && sec.questionIds.length > 0 ? {
              connect: sec.questionIds.map((qId: string) => ({ id: qId }))
            } : undefined,
            codingQuestions: sec.codingQuestionIds && sec.codingQuestionIds.length > 0 ? {
              connect: sec.codingQuestionIds.map((qId: string) => ({ id: qId }))
            } : undefined
          }))
        } : undefined
      }
    });
    
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assessment' });
  }
};

export const getAssessmentResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: id },
      include: {
        candidate: {
          include: {
            sessions: {
              include: { 
                integrityEvents: true,
                codingAnswers: {
                  include: { codingQuestion: true }
                }
              }
            }
          }
        }
      },
      orderBy: { totalScore: 'desc' }
    });
    
    const mapped = results.map(r => {
      const session = r.candidate.sessions[0];
      const codingSubmissions = (session?.codingAnswers || []).map((ca: any) => ({
        questionTitle: ca.codingQuestion?.title,
        language: ca.language,
        status: ca.status,
        score: ca.score,
        maxScore: ca.codingQuestion?.marks || 10
      }));
      return {
        id: r.id,
        name: r.candidate.name,
        email: r.candidate.email,
        score: r.totalScore,
        maxScore: r.maxScore,
        percentage: r.percentage,
        status: session?.status === 'COMPLETED' ? 'EVALUATED' : session?.status || r.status,
        integrityEventsCount: session?.integrityEvents?.length || 0,
        integrityEvents: session?.integrityEvents || [],
        codingSubmissions
      };
    });
    
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};

export const getPublicAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { id: true, title: true, description: true }
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'GLOBAL' } });
    
    res.json({ ...assessment, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public assessment details' });
  }
};
