import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  principal: { userId: string; organizationId: string; role: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Bearer token required');
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; org: string; role: string; ver: number }>(match[1]);
      if (!claims.sub || !claims.org) throw new Error('Missing tenant claims');
      const membership = await this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: claims.org, userId: claims.sub } }
      });
      if (!membership) throw new Error('Membership revoked');
      const user = await this.prisma.user.findUnique({
        where: { id: claims.sub }, select: { sessionVersion: true }
      });
      if (!user || user.sessionVersion !== claims.ver) throw new Error('Session revoked');
      req.principal = { userId: claims.sub, organizationId: membership.organizationId, role: membership.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
