import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { compare } from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { memberships: true }
    });
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException('No organization membership');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      org: membership.organizationId,
      role: membership.role
    }, { expiresIn: '1h' });
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
