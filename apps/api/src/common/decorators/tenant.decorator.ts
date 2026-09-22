import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const ActiveMember = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).member;
  },
);

export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).tenant;
  },
);
