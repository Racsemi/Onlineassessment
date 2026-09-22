import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
});

export class CreateOrganizationDto extends createZodDto(createOrganizationSchema) {}
