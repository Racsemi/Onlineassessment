import { Controller, Post, Body, Req, UseGuards, Param, Get, Res, NotFoundException } from '@nestjs/common';
import { ProctoringService } from './proctoring.service.js';
import { IngestEventsDto } from './dto/proctoring.dto.js';
import { CandidateAuthGuard } from '../common/guards/candidate-auth.guard.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import type { Response } from 'express';

@Controller()
export class ProctoringController {
  constructor(private readonly proctoringService: ProctoringService) {}

  // ---------------------------------------------------------
  // CANDIDATE ENDPOINTS
  // ---------------------------------------------------------
  @Post('candidate/attempts/:attemptId/proctoring/events')
  @UseGuards(CandidateAuthGuard)
  async ingestEvents(@Req() req: any, @Param('attemptId') attemptId: string, @Body() dto: IngestEventsDto) {
    const candidateId = req.candidate.id;
    return this.proctoringService.processEvents(candidateId, attemptId, dto);
  }

  // ---------------------------------------------------------
  // RECRUITER / ADMIN ENDPOINTS
  // ---------------------------------------------------------
  @Get('organizations/:organizationId/proctoring/:attemptId')
  @UseGuards(AuthGuard, TenantGuard)
  async getAttemptTimeline(@Param('organizationId') orgId: string, @Param('attemptId') attemptId: string) {
    const session = await this.proctoringService.getAttemptTimeline(orgId, attemptId);
    return { success: true, data: session };
  }

  @Get('organizations/:organizationId/proctoring/evidence/:eventId')
  @UseGuards(AuthGuard, TenantGuard)
  async viewEvidence(
    @Param('organizationId') orgId: string, 
    @Param('eventId') eventId: string, 
    @Res() res: Response
  ) {
    const buffer = await this.proctoringService.getEvidenceBlob(orgId, eventId);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
  }
}
