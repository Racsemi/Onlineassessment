import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { TenantGuard } from '../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ActiveMember, CurrentOrganization } from '../common/decorators/tenant.decorator.js';
import { InterviewsService } from './interviews.service.js';
import {
  CreateInterviewDto,
  RescheduleInterviewDto,
  CancelInterviewDto,
  SetAvailabilityDto,
  CreateQuestionBankDto,
  CreateNoteDto,
  SubmitScorecardDto,
  ExecuteCodeDto,
  UpdatePipelineStageDto,
} from './dto/interview.dto.js';

@Controller('organizations/:organizationId/interviews')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @RequirePermissions('interview.create')
  async createInterview(
    @Param('organizationId') organizationId: string,
    @ActiveMember() member: any,
    @Body() dto: CreateInterviewDto
  ) {
    return this.interviewsService.createInterview(organizationId, member.userId, dto);
  }

  @Get()
  @RequirePermissions('interview.read')
  async getInterviews(
    @Param('organizationId') organizationId: string,
    @Query('candidateId') candidateId?: string,
    @Query('interviewerId') interviewerId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.interviewsService.getInterviews(organizationId, {
      candidateId,
      interviewerId,
      status,
      from,
      to,
    });
  }

  @Get('calendar')
  @RequirePermissions('interview.read')
  async getCalendar(
    @Param('organizationId') organizationId: string,
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    return this.interviewsService.getCalendar(organizationId, start, end);
  }

  @Get('interviewers/availability')
  @RequirePermissions('interview.read')
  async getAvailability(
    @Param('organizationId') organizationId: string,
    @Query('userId') userId?: string,
    @ActiveMember() member?: any
  ) {
    return this.interviewsService.getInterviewerAvailability(organizationId, userId || member.userId);
  }

  @Put('interviewers/availability')
  @RequirePermissions('member.update')
  async setAvailability(
    @Param('organizationId') organizationId: string,
    @ActiveMember() member: any,
    @Body() dto: SetAvailabilityDto,
    @Query('userId') targetUserId?: string
  ) {
    return this.interviewsService.setInterviewerAvailability(
      organizationId,
      targetUserId || member.userId,
      dto
    );
  }

  @Get('question-bank')
  @RequirePermissions('interview.read')
  async getQuestionBank(
    @Param('organizationId') organizationId: string,
    @Query('category') category?: string
  ) {
    return this.interviewsService.getQuestionBank(organizationId, category);
  }

  @Post('question-bank')
  @RequirePermissions('assessment.create')
  async createQuestionBankItem(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateQuestionBankDto
  ) {
    return this.interviewsService.createQuestionBankItem(organizationId, dto);
  }

  @Patch('candidates/:candidateId/pipeline-stage')
  @RequirePermissions('candidate.update')
  async updateCandidatePipelineStage(
    @Param('organizationId') organizationId: string,
    @Param('candidateId') candidateId: string,
    @ActiveMember() member: any,
    @Body() dto: UpdatePipelineStageDto
  ) {
    return this.interviewsService.updateCandidatePipelineStage(
      organizationId,
      candidateId,
      member.userId,
      dto.pipelineStage
    );
  }

  @Get(':id')
  @RequirePermissions('interview.read')
  async getInterviewById(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any
  ) {
    return this.interviewsService.getInterviewById(organizationId, id, member.userId);
  }

  @Patch(':id/reschedule')
  @RequirePermissions('interview.reschedule')
  async rescheduleInterview(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any,
    @Body() dto: RescheduleInterviewDto
  ) {
    return this.interviewsService.rescheduleInterview(organizationId, id, member.userId, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('interview.cancel')
  async cancelInterview(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any,
    @Body() dto: CancelInterviewDto
  ) {
    return this.interviewsService.cancelInterview(organizationId, id, member.userId, dto);
  }

  @Post(':id/room-token')
  @RequirePermissions('interview.read')
  async getRoomToken(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.interviewsService.getMemberRoomToken(organizationId, id, req.user);
  }

  @Get(':id/notes')
  @RequirePermissions('interview.read')
  async getNotes(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any
  ) {
    return this.interviewsService.getNotes(organizationId, id, member.userId);
  }

  @Post(':id/notes')
  @RequirePermissions('interview.read')
  async createNote(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any,
    @Body() dto: CreateNoteDto
  ) {
    return this.interviewsService.createNote(organizationId, id, member.userId, dto);
  }

  @Get(':id/scorecards')
  @RequirePermissions('interview.scorecard.read')
  async getScorecards(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string
  ) {
    return this.interviewsService.getScorecards(organizationId, id);
  }

  @Post(':id/scorecards')
  @RequirePermissions('interview.scorecard.submit')
  async submitScorecard(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @ActiveMember() member: any,
    @Body() dto: SubmitScorecardDto
  ) {
    return this.interviewsService.submitScorecard(organizationId, id, member.userId, dto);
  }

  @Post(':id/code/execute')
  @RequirePermissions('interview.read')
  async executeCode(
    @Param('id') id: string,
    @Body() dto: ExecuteCodeDto
  ) {
    return this.interviewsService.executeLiveCode(id, dto);
  }
}
