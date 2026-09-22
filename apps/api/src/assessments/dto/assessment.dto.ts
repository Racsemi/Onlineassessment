import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const assessmentSettingsSchema = z.object({
  durationMinutes: z.number().int().min(1).optional().nullable(),
  passingScore: z.number().min(0).max(100).optional().nullable(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  allowBackNavigation: z.boolean().optional(),
  attemptLimit: z.number().int().min(1).optional().nullable(),
}).strict();

export const createAssessmentSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(5000).optional(),
  settings: assessmentSettingsSchema.optional(),
}).strict();

export class CreateAssessmentDto extends createZodDto(createAssessmentSchema) {}

export const updateAssessmentSchema = createAssessmentSchema.partial().strict();

export class UpdateAssessmentDto extends createZodDto(updateAssessmentSchema) {}
