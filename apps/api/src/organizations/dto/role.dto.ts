import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).min(1), // Array of permission names (e.g. "member.read")
}).strict();

export class CreateRoleDto extends createZodDto(createRoleSchema) {}

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).min(1).optional(),
}).strict();

export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}
