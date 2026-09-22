import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ProctoringEventSchema = z.object({
  eventType: z.enum([
    'TAB_HIDDEN',
    'WINDOW_BLUR',
    'FULLSCREEN_EXIT',
    'COPY',
    'PASTE',
    'NETWORK_CHANGE',
    'MULTIPLE_SESSION',
    'EVIDENCE_UPLOAD'
  ]),
  timestamp: z.string().datetime(), // client timestamp, for sequencing mostly
  context: z.record(z.any()).optional(),
  evidenceBase64: z.string().optional() // For MVP evidence upload (e.g., webcam snapshot)
});

export const IngestEventsDtoSchema = z.object({
  events: z.array(ProctoringEventSchema).max(50) // Batch up to 50 events
});

export class IngestEventsDto extends createZodDto(IngestEventsDtoSchema) {}
