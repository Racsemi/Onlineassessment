import { Controller, Post, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { CandidateAuthService } from './candidate-auth.service.js';
import { ValidateInvitationDto } from './dto/candidate.dto.js';
import type { Response, Request } from 'express';

@Controller('candidate/invitations')
export class CandidateAuthController {
  constructor(private readonly authService: CandidateAuthService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateInvitation(@Body() dto: ValidateInvitationDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const { sessionToken, attemptId } = await this.authService.validateInvitationAndCreateSession(dto.token, ipAddress, userAgent);

    res.cookie('candidate_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return { success: true, data: { attemptId } };
  }
}
