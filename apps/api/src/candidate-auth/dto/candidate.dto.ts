import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const validateInvitationSchema = z.object({
  token: z.string().min(32),
}).strict();

export class ValidateInvitationDto extends createZodDto(validateInvitationSchema) {}

export const saveAnswerSchema = z.object({
  answerData: z.record(z.any()),
}).strict();

export class SaveAnswerDto extends createZodDto(saveAnswerSchema) {}
