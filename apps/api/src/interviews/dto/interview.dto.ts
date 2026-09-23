import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createInterviewSchema = z.object({
  candidateId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'SCREENING', 'HR']).default('TECHNICAL'),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  instructions: z.string().max(4000).optional(),
  interviewerIds: z.array(z.string().uuid()).min(1),
  leadInterviewerId: z.string().uuid().optional(),
  observerIds: z.array(z.string().uuid()).optional(),
  recordingEnabled: z.boolean().default(false),
  screenShareAllowed: z.boolean().default(true),
  codingEnabled: z.boolean().default(true),
}).strict();

export class CreateInterviewDto extends createZodDto(createInterviewSchema) {}

export const rescheduleInterviewSchema = z.object({
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  reason: z.string().max(500).optional(),
}).strict();

export class RescheduleInterviewDto extends createZodDto(rescheduleInterviewSchema) {}

export const cancelInterviewSchema = z.object({
  reason: z.string().max(500).optional(),
}).strict();

export class CancelInterviewDto extends createZodDto(cancelInterviewSchema) {}

export const setAvailabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // "HH:MM"
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string().default('UTC'),
  isBlocked: z.boolean().default(false),
  specificDate: z.string().datetime().optional(),
}).strict();

export const setAvailabilitySchema = z.object({
  availabilities: z.array(setAvailabilityItemSchema),
}).strict();

export class SetAvailabilityDto extends createZodDto(setAvailabilitySchema) {}

export const createQuestionBankSchema = z.object({
  title: z.string().min(2).max(200),
  category: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING', 'DATABASE', 'CUSTOM']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  prompt: z.string().min(5).max(5000),
  expectedAnswer: z.string().max(5000).optional(),
  configuration: z.record(z.any()).optional(),
}).strict();

export class CreateQuestionBankDto extends createZodDto(createQuestionBankSchema) {}

export const createNoteSchema = z.object({
  category: z.enum(['GENERAL', 'TECHNICAL', 'BEHAVIORAL', 'CODING']).default('GENERAL'),
  content: z.string().min(1).max(10000),
}).strict();

export class CreateNoteDto extends createZodDto(createNoteSchema) {}

export const scoreCriterionSchema = z.object({
  criterion: z.string().min(1).max(100),
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
}).strict();

export const submitScorecardSchema = z.object({
  recommendation: z.enum(['PASS', 'FAIL', 'ON_HOLD', 'FURTHER_ROUND']),
  summary: z.string().max(4000).optional(),
  scores: z.array(scoreCriterionSchema).min(1),
}).strict();

export class SubmitScorecardDto extends createZodDto(submitScorecardSchema) {}

export const executeCodeSchema = z.object({
  language: z.enum(['javascript', 'python']),
  code: z.string().min(1).max(50000),
  stdin: z.string().max(5000).optional(),
}).strict();

export class ExecuteCodeDto extends createZodDto(executeCodeSchema) {}

export const updatePipelineStageSchema = z.object({
  pipelineStage: z.enum([
    'APPLIED',
    'SCREENING',
    'ASSESSMENT',
    'SHORTLISTED',
    'INTERVIEW',
    'TECHNICAL_ROUND',
    'HR_ROUND',
    'SELECTED',
    'REJECTED',
    'ON_HOLD',
    'WITHDRAWN',
  ]),
}).strict();

export class UpdatePipelineStageDto extends createZodDto(updatePipelineStageSchema) {}

export const validateCandidateInviteSchema = z.object({
  token: z.string().min(10),
}).strict();

export class ValidateCandidateInviteDto extends createZodDto(validateCandidateInviteSchema) {}

export const deviceCheckSchema = z.object({
  cameraStatus: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  microphoneStatus: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  speakerStatus: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  networkQuality: z.enum(['EXCELLENT', 'GOOD', 'POOR']),
  userAgent: z.string().optional(),
}).strict();

export class DeviceCheckDto extends createZodDto(deviceCheckSchema) {}
