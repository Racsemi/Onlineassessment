import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import crypto from 'crypto';

@Injectable()
export class CandidateAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.['candidate_session_token'];

    if (!token) {
      throw new UnauthorizedException('Candidate session missing');
    }

    const sessionTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await this.prisma.candidateSession.findUnique({
      where: { sessionTokenHash },
      include: { candidate: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired candidate session');
    }

    // Update last used asynchronously
    this.prisma.candidateSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    request.candidate = session.candidate;
    request.candidateSession = session;
    return true;
  }
}
