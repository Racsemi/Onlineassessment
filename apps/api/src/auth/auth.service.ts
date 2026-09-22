import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: passwordHash,
        name: dto.name,
      },
    });

    // Generate email verification token
    const rawVerificationToken = randomBytes(32).toString('base64url');
    const verificationTokenHash = createHash('sha256').update(rawVerificationToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
    
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: verificationTokenHash,
        expiresAt,
      }
    });

    await this.notificationsService.sendVerificationEmail(user.email, user.name, rawVerificationToken);
    
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials or account inactive');
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate secure session token
    const sessionToken = randomBytes(64).toString('base64url');
    const sessionTokenHash = createHash('sha256').update(sessionToken).digest('hex');

    // Create session in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return { sessionToken, user: { id: user.id, email: user.email, name: user.name } };
  }

  async logout(sessionToken: string) {
    const sessionTokenHash = createHash('sha256').update(sessionToken).digest('hex');
    
    await this.prisma.userSession.delete({
      where: { sessionTokenHash },
    }).catch(() => null); // ignore if already deleted
    
    return { success: true };
  }

  async validateSession(sessionToken: string) {
    const sessionTokenHash = createHash('sha256').update(sessionToken).digest('hex');
    const session = await this.prisma.userSession.findUnique({
      where: { sessionTokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || session.revokedAt) {
      return null;
    }
    return session.user;
  }

  async revokeOtherSessions(userId: string, currentSessionToken: string) {
    const currentSessionTokenHash = createHash('sha256').update(currentSessionToken).digest('hex');
    
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        sessionTokenHash: { not: currentSessionTokenHash },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      }
    });

    return { success: true };
  }

  async verifyEmail(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const verification = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async initiatePasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success anyway to prevent email enumeration
      return { success: true };
    }

    const rawResetToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawResetToken).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
    
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      }
    });
    
    await this.notificationsService.sendPasswordResetEmail(user.email, rawResetToken);

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { password: passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active sessions
      this.prisma.userSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    ]);

    return { success: true };
  }
}
