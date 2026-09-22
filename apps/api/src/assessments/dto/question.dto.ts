import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const questionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1).max(1000),
  displayOrder: z.number().int().min(0),
  isCorrect: z.boolean().default(false),
}).strict();

export const createQuestionSchema = z.object({
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'CODING']),
  prompt: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().min(0).default(1.0),
  displayOrder: z.number().int().min(0),
  required: z.boolean().default(true),
  configuration: z.record(z.any()).optional().nullable(),
  options: z.array(questionOptionSchema).optional(),
}).strict();

export class CreateQuestionDto extends createZodDto(createQuestionSchema) {}

export const updateQuestionSchema = createQuestionSchema.partial().strict();

export class UpdateQuestionDto extends createZodDto(updateQuestionSchema) {}
