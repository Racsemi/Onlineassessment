import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User context is missing');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isPlatformAdmin: true }
    });

    if (!dbUser || !dbUser.isPlatformAdmin) {
      throw new ForbiddenException('Platform Administrator access required');
    }

    return true;
  }
}
