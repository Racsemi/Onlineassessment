import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import crypto from 'crypto';

interface AuthenticatedSocketData {
  userId?: string;
  candidateId?: string;
  role: string;
  name: string;
  interviewId: string;
}

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  },
  namespace: '/ws/interview',
})
export class InterviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InterviewGateway.name);

  constructor(private prisma: PrismaService) {}

  private parseCookies(cookieHeader?: string): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });

    return list;
  }

  async handleConnection(client: Socket) {
    try {
      const cookies = this.parseCookies(client.handshake.headers.cookie);
      const sessionToken = cookies['session_token'];
      const candidateSessionToken = cookies['candidate_session_token'];
      const rawInterviewId = client.handshake.query.interviewId;
      const interviewId = Array.isArray(rawInterviewId) ? rawInterviewId[0] : rawInterviewId;

      if (!interviewId) {
        this.logger.warn(`Socket connection rejected: missing interviewId`);
        client.disconnect(true);
        return;
      }

      let socketData: AuthenticatedSocketData | null = null;

      // 1. Authenticate as Organization Member
      if (sessionToken) {
        const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
        const session = await this.prisma.userSession.findUnique({
          where: { sessionTokenHash: tokenHash },
          include: { user: true },
        });

        if (session && !session.revokedAt && session.expiresAt > new Date()) {
          // Verify participant assignment
          const participant = await this.prisma.interviewParticipant.findFirst({
            where: { interviewId, userId: session.userId },
          });

          if (participant) {
            socketData = {
              userId: session.userId,
              role: participant.role,
              name: session.user.name || session.user.email,
              interviewId,
            };
          }
        }
      }

      // 2. Authenticate as Candidate
      if (!socketData && candidateSessionToken) {
        const tokenHash = crypto.createHash('sha256').update(candidateSessionToken).digest('hex');
        const session = await this.prisma.candidateSession.findUnique({
          where: { sessionTokenHash: tokenHash },
          include: { candidate: true },
        });

        if (session && !session.revokedAt && session.expiresAt > new Date()) {
          const participant = await this.prisma.interviewParticipant.findFirst({
            where: { interviewId, candidateId: session.candidateId },
          });

          if (participant) {
            socketData = {
              candidateId: session.candidateId,
              role: 'CANDIDATE',
              name: session.candidate.name,
              interviewId,
            };
          }
        }
      }

      if (!socketData) {
        this.logger.warn(`Socket connection rejected: unauthorized for interview ${interviewId}`);
        client.disconnect(true);
        return;
      }

      client.data = socketData;
      const roomKey = `interview:${interviewId}`;
      await client.join(roomKey);

      this.logger.log(`Socket joined room ${roomKey}: ${socketData.name} (${socketData.role})`);

      // Broadcast participant joined event to the room
      this.server.to(roomKey).emit('participant:joined', {
        identity: socketData.userId ? `user_${socketData.userId}` : `cand_${socketData.candidateId}`,
        name: socketData.name,
        role: socketData.role,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error(`Socket connection error: ${err.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as AuthenticatedSocketData | undefined;
    if (data?.interviewId) {
      const roomKey = `interview:${data.interviewId}`;
      this.server.to(roomKey).emit('participant:left', {
        identity: data.userId ? `user_${data.userId}` : `cand_${data.candidateId}`,
        name: data.name,
        role: data.role,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { content: string }
  ) {
    const data = client.data as AuthenticatedSocketData | undefined;
    if (!data?.interviewId || !payload?.content) return;

    // Sanitize and trim
    const content = payload.content.trim().slice(0, 1000);
    if (!content) return;

    // Persist to database
    const saved = await this.prisma.interviewChatMessage.create({
      data: {
        interviewId: data.interviewId,
        senderName: data.name,
        senderRole: data.role,
        senderUserId: data.userId,
        senderCandidateId: data.candidateId,
        content,
      },
    });

    const roomKey = `interview:${data.interviewId}`;
    this.server.to(roomKey).emit('chat:message', {
      id: saved.id,
      senderName: data.name,
      senderRole: data.role,
      content,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  @SubscribeMessage('code:sync')
  async handleCodeSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; language?: string }
  ) {
    const data = client.data as AuthenticatedSocketData | undefined;
    if (!data?.interviewId || typeof payload?.code !== 'string') return;

    const roomKey = `interview:${data.interviewId}`;
    // Broadcast to other participants in room
    client.to(roomKey).emit('code:sync', {
      code: payload.code,
      language: payload.language || 'javascript',
      senderName: data.name,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('question:share')
  async handleQuestionShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { question: any }
  ) {
    const data = client.data as AuthenticatedSocketData | undefined;
    // Only interviewers and recruiters can share questions
    if (!data?.interviewId || data.role === 'CANDIDATE') return;

    const roomKey = `interview:${data.interviewId}`;
    this.server.to(roomKey).emit('question:shared', {
      question: payload.question,
      sharedBy: data.name,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('screen:state')
  async handleScreenShareState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { isSharing: boolean }
  ) {
    const data = client.data as AuthenticatedSocketData | undefined;
    if (!data?.interviewId) return;

    const roomKey = `interview:${data.interviewId}`;
    this.server.to(roomKey).emit('screen:state_changed', {
      identity: data.userId ? `user_${data.userId}` : `cand_${data.candidateId}`,
      name: data.name,
      isSharing: !!payload.isSharing,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('timer:sync')
  async handleTimerSync(@ConnectedSocket() client: Socket) {
    const data = client.data as AuthenticatedSocketData | undefined;
    if (!data?.interviewId) return;

    const interview = await this.prisma.interview.findUnique({
      where: { id: data.interviewId },
      select: { scheduledStart: true, scheduledEnd: true, durationMinutes: true, actualStart: true, status: true },
    });

    if (interview) {
      client.emit('timer:synced', {
        serverTime: new Date().toISOString(),
        scheduledStart: interview.scheduledStart.toISOString(),
        scheduledEnd: interview.scheduledEnd.toISOString(),
        durationMinutes: interview.durationMinutes,
        actualStart: interview.actualStart?.toISOString() || null,
        status: interview.status,
      });
    }
  }
}
