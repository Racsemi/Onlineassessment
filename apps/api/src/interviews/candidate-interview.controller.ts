import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CandidateAuthGuard } from '../common/guards/candidate-auth.guard.js';
import { InterviewsService } from './interviews.service.js';
import {
  ValidateCandidateInviteDto,
  DeviceCheckDto,
  ExecuteCodeDto,
} from './dto/interview.dto.js';

@Controller('candidate/interviews')
export class CandidateInterviewController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post('validate')
  async validateInvite(
    @Body() dto: ValidateCandidateInviteDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.interviewsService.validateCandidateInvite(dto.token);

    // Set secure HttpOnly candidate session cookie
    res.cookie('candidate_session_token', result.candidateSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      interview: result.interview,
    };
  }

  @Get(':id/details')
  @UseGuards(CandidateAuthGuard)
  async getDetails(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.interviewsService.getCandidateInterviewDetails(req.candidate.id, id);
  }

  @Post(':id/room-token')
  @UseGuards(CandidateAuthGuard)
  async getRoomToken(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.interviewsService.getCandidateRoomToken(req.candidate.id, id);
  }

  @Post(':id/device-check')
  @UseGuards(CandidateAuthGuard)
  async recordDeviceCheck(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: DeviceCheckDto
  ) {
    return this.interviewsService.recordDeviceCheck(req.candidate.id, id, dto);
  }

  @Post(':id/code/execute')
  @UseGuards(CandidateAuthGuard)
  async executeCode(
    @Param('id') id: string,
    @Body() dto: ExecuteCodeDto
  ) {
    return this.interviewsService.executeLiveCode(id, dto);
  }
}
