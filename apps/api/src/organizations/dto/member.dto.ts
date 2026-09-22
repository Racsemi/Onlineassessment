import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
}).strict();

export class UpdateMemberDto extends createZodDto(updateMemberSchema) {}

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
}).strict();

export class InviteMemberDto extends createZodDto(inviteMemberSchema) {}
