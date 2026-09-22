import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CandidateAttemptsService } from './candidate-attempts.service.js';
import { CandidateAuthGuard } from '../common/guards/candidate-auth.guard.js';
import { SaveAnswerDto } from '../candidate-auth/dto/candidate.dto.js';

@Controller('candidate/attempts')
@UseGuards(CandidateAuthGuard)
export class CandidateAttemptsController {
  constructor(private readonly attemptsService: CandidateAttemptsService) {}

  @Post(':id/start')
  async start(@Req() req: any, @Param('id') id: string) {
    const attempt = await this.attemptsService.startAttempt(req.candidate.id, id);
    return { success: true, data: attempt };
  }

  @Get(':id/questions')
  async getQuestions(@Req() req: any, @Param('id') id: string) {
    const payload = await this.attemptsService.getAttemptQuestions(req.candidate.id, id);
    return { success: true, data: payload };
  }

  @Put(':id/answers/:questionId')
  async saveAnswer(
    @Req() req: any,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveAnswerDto
  ) {
    const answer = await this.attemptsService.saveAnswer(req.candidate.id, id, questionId, dto);
    return { success: true, data: answer };
  }

  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const attempt = await this.attemptsService.submitAttempt(req.candidate.id, id);
    return { success: true, data: attempt };
  }

  @Post(':id/evaluate/:questionId')
  async evaluate(@Req() req: any, @Param('id') id: string, @Param('questionId') questionId: string) {
    const evaluation = await this.attemptsService.evaluateCode(req.candidate.id, id, questionId);
    return { success: true, data: evaluation };
  }
}

