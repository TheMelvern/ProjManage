import { ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { MfaService } from './mfa.service';
import { compare } from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService,
    private readonly mfa: MfaService) {}

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId },
      data: { sessionVersion: { increment: 1 } } });
    return { success: true, data: { revoked: true } };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { memberships: true }
    });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('Too many failed attempts. Try again after the temporary lock expires.', 429);
    }
    if (!(await compare(password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({ where: { id: user.id }, data: {
        failedLogins: failed,
        lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      } });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.failedLogins || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null }
      });
    }
    if (!user.emailVerifiedAt) throw new ForbiddenException('Email verification required before sign-in');
    if (user.mfaEnabledAt) return this.mfa.createChallenge(user.id);
    return this.issueAccessToken(user.id);
  }

  async issueAccessToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, include: { memberships: true }
    });
    if (!user?.emailVerifiedAt) throw new UnauthorizedException('Verified account required');
    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException('No organization membership');
    const configuredSession = await this.prisma.organizationParameter.findUnique({
      where: { organizationId_key: { organizationId: membership.organizationId,
        key: 'sessionTimeoutMinutes' } }
    });
    const configuredMinutes = Number(configuredSession?.value ?? 60);
    const sessionMinutes = Number.isFinite(configuredMinutes)
      ? Math.max(5, Math.min(Math.round(configuredMinutes), 480)) : 60;
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      org: membership.organizationId,
      role: membership.role,
      ver: user.sessionVersion
    }, { expiresIn: sessionMinutes * 60 });
    return {
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: membership.role },
        organizationId: membership.organizationId
      }
    };
  }
}
