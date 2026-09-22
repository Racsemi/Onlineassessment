import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { IngestEventsDto } from './dto/proctoring.dto.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

@Injectable()
export class ProctoringService {
  private evidenceDir = path.join(process.cwd(), 'storage', 'evidence');

  constructor(private prisma: PrismaService) {
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    await fs.mkdir(this.evidenceDir, { recursive: true });
  }

  // Called when attempt starts
  async initializeSession(attemptId: string) {
    return this.prisma.proctoringSession.upsert({
      where: { attemptId },
      update: {},
      create: { attemptId }
    });
  }

  async processEvents(candidateId: string, attemptId: string, dto: IngestEventsDto) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { 
        proctoringSession: true,
        assessmentVersion: { include: { assessment: { include: { proctoringSettings: true } } } }
      }
    });

    if (!attempt || attempt.candidateId !== candidateId) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ForbiddenException(`Cannot ingest events for attempt in ${attempt.status} state`);
    }

    let proctoringSession = attempt.proctoringSession;
    if (!proctoringSession) {
      proctoringSession = await this.initializeSession(attemptId);
    }

    const settings = attempt.assessmentVersion.assessment.proctoringSettings;
    if (settings && !settings.eventLoggingEnabled) {
      return { success: true, ignored: true };
    }

    // Process events
    const mappedEvents = [];
    for (const event of dto.events) {
      // Analyze severity
      let severity = 'NORMAL';
      let confidence = 1.0;

      switch (event.eventType) {
        case 'TAB_HIDDEN':
        case 'WINDOW_BLUR':
        case 'PASTE':
          severity = 'REVIEW_RECOMMENDED';
          break;
        case 'MULTIPLE_SESSION':
          severity = 'HIGH_RISK_SIGNAL';
          break;
        case 'EVIDENCE_UPLOAD':
          severity = 'NORMAL';
          break;
      }

      // Handle Evidence Upload MVP
      let evidenceUrl = null;
      if (event.evidenceBase64) {
        const buffer = Buffer.from(event.evidenceBase64, 'base64');
        const filename = `${proctoringSession.id}_${crypto.randomUUID()}.jpg`;
        await fs.writeFile(path.join(this.evidenceDir, filename), buffer);
        evidenceUrl = `/local-store/${filename}`; // Internal pointer
      }

      mappedEvents.push({
        proctoringSessionId: proctoringSession.id,
        eventType: event.eventType,
        // Override client timestamp if it's too skewed, or just use server timestamp for simplicity and security.
        // We will store server timestamp to prevent timestamp spoofing but keep client sequence if we needed.
        timestamp: new Date(), 
        severity,
        confidence,
        context: event.context || {},
        evidenceUrl,
      });
    }

    await this.prisma.proctoringEvent.createMany({
      data: mappedEvents
    });

    return { success: true, count: mappedEvents.length };
  }

  // Recruiter Dashboard View
  async getAttemptTimeline(organizationId: string, attemptId: string) {
    const session = await this.prisma.proctoringSession.findUnique({
      where: { attemptId },
      include: {
        attempt: true,
        events: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!session || session.attempt.organizationId !== organizationId) {
      throw new NotFoundException('Proctoring session not found for this attempt in your organization');
    }

    return session;
  }

  async getEvidenceBlob(organizationId: string, eventId: string) {
    const event = await this.prisma.proctoringEvent.findUnique({
      where: { id: eventId },
      include: { session: { include: { attempt: true } } }
    });

    if (!event || event.session.attempt.organizationId !== organizationId) {
      throw new NotFoundException('Event evidence not found');
    }

    if (!event.evidenceUrl) {
      throw new BadRequestException('No evidence attached to this event');
    }

    const filename = event.evidenceUrl.replace('/local-store/', '');
    const filepath = path.join(this.evidenceDir, filename);

    try {
      const buffer = await fs.readFile(filepath);
      return buffer;
    } catch {
      throw new NotFoundException('Evidence blob missing from storage');
    }
  }

  // Concurrency hook
  async checkConcurrencyAnomaly(attemptId: string, incomingSessionId: string) {
    const activeSessions = await this.prisma.candidateSession.findMany({
      where: { attemptId, revokedAt: null },
      orderBy: { createdAt: 'asc' }
    });

    if (activeSessions.length > 1) {
      // Invalidate older sessions
      for (const session of activeSessions) {
        if (session.id !== incomingSessionId) {
          await this.prisma.candidateSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
          });
        }
      }

      // Log Proctoring anomaly
      let proctoringSession = await this.prisma.proctoringSession.findUnique({ where: { attemptId } });
      if (!proctoringSession) {
        proctoringSession = await this.initializeSession(attemptId);
      }

      await this.prisma.proctoringEvent.create({
        data: {
          proctoringSessionId: proctoringSession.id,
          eventType: 'MULTIPLE_SESSION',
          severity: 'HIGH_RISK_SIGNAL',
          confidence: 1.0,
          context: { note: 'Multiple concurrent active sessions detected and old session invalidated.' }
        }
      });
    }
  }
}
