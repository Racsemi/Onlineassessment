import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateInvitationSchema = z.object({
  candidateEmail: z.string().email(),
  candidateName: z.string().min(1),
  assessmentVersionId: z.string().uuid(),
});

export class CreateInvitationDto extends createZodDto(CreateInvitationSchema) {}
