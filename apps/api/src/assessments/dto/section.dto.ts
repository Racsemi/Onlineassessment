import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createSectionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  displayOrder: z.number().int().min(0),
}).strict();

export class CreateSectionDto extends createZodDto(createSectionSchema) {}

export const updateSectionSchema = createSectionSchema.partial().strict();

export class UpdateSectionDto extends createZodDto(updateSectionSchema) {}
