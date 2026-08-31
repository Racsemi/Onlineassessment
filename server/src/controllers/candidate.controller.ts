import { Request, Response } from 'express';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import prisma from '../utils/db';
import { sendEmail } from '../utils/email';

export const inviteCandidate = async (req: Request, res: Response) => {
  try {
    const { assessmentId, name, email } = req.body;
    
    // Ensure assessment exists
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    // Create candidate
    const candidate = await prisma.candidate.upsert({
      where: { email_assessmentId: { email, assessmentId } },
      update: { name },
      create: { assessmentId, name, email }
    });
    
    const token = crypto.randomBytes(32).toString('hex');
    
    const invitation = await prisma.invitation.create({
      data: {
        candidateId: candidate.id,
        assessmentId,
        token,
        status: 'SENT'
      }
    });
    
    const assessmentLink = `${process.env.CLIENT_URL}/test/${token}`;
    
    console.log(`Sending invite to ${email} for ${assessment.title}: ${assessmentLink}`);
    
    res.status(200).json({ message: 'Invitation sent', candidate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite candidate' });
  }
};

export const getAllCandidates = async (req: Request, res: Response) => {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        assessment: true,
        invitations: true,
        results: true
      }
    });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all candidates' });
  }
};

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const candidates = await prisma.candidate.findMany({
      where: { assessmentId },
      include: {
        invitations: true,
        results: true
      }
    });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

export const validateCandidatesCsv = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    let validRows: any[] = [];
    let invalidRows: any[] = [];
    
    // basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    records.forEach((row: any, index: number) => {
      const rowNum = index + 2; 
      
      const name = row.name?.trim();
      const email = row.email?.trim();
      
      if (!name) {
        invalidRows.push({ row: rowNum, field: 'name', error: 'Name is required' });
        return;
      }
      
      if (!email || !emailRegex.test(email)) {
        invalidRows.push({ row: rowNum, field: 'email', error: 'Valid email is required' });
        return;
      }
      
      validRows.push({ name, email });
    });
    
    res.json({
      total: records.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
};

export const importCandidatesCsv = async (req: Request, res: Response) => {
  try {
    const { assessmentId, candidates } = req.body;
    
    const created = await Promise.all(
      candidates.map(async (c: any) => {
        return prisma.candidate.upsert({
          where: { email_assessmentId: { email: c.email, assessmentId } },
          update: { name: c.name },
          create: { assessmentId, name: c.name, email: c.email }
        });
      })
    );
    
    res.json({ imported: created.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import candidates CSV' });
  }
};

export const registerPublicCandidate = async (req: Request, res: Response) => {
  try {
    const { assessmentId, name, email, phone, college, branch, cgpa, photo, customFields } = req.body;
    
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    const parsedCgpa = cgpa ? parseFloat(cgpa) : null;

    const candidate = await prisma.candidate.upsert({
      where: { email_assessmentId: { email, assessmentId } },
      update: { name, phone, college, branch, cgpa: parsedCgpa, photo, customFields: customFields || {} },
      create: { assessmentId, name, email, phone, college, branch, cgpa: parsedCgpa, photo, customFields: customFields || {} }
    });
    
    const token = crypto.randomBytes(32).toString('hex');
    
    await prisma.invitation.create({
      data: {
        candidateId: candidate.id,
        assessmentId,
        token,
        status: 'USED'
      }
    });
    
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register candidate' });
  }
};

export const resetTest = async (req: Request, res: Response) => {
  try {
    const { assessmentId, candidateId } = req.params;
    
    // Hard delete session and results for this candidate in this assessment
    // (Cascade delete automatically handles CandidateAnswer, CodingSubmission, and IntegrityEvent)
    await prisma.candidateSession.deleteMany({
      where: { candidateId }
    });
    
    await prisma.assessmentResult.deleteMany({
      where: { candidateId, assessmentId }
    });
    
    res.status(200).json({ message: 'Test reset successfully. Candidate can retake.' });
  } catch (error) {
    console.error('Reset test error:', error);
    res.status(500).json({ error: 'Failed to reset test' });
  }
};

export const deleteCandidate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.candidate.delete({ where: { id } });
    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
};
