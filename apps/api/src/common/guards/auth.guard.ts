import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies['session_token'];

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.authService.validateSession(sessionToken);
    if (!user) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Attach user to request for downstream use
    (request as any).user = user;
    return true;
  }
}
