import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';

class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(140) name!: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.principal.userId },
      select: { id: true, name: true, email: true, emailVerifiedAt: true, createdAt: true }
    });
    if (!user) throw new UnauthorizedException('Account not found');
    const org = await this.prisma.organization.findUnique({
      where: { id: req.principal.organizationId },
      select: { name: true }
    });
    return { success: true, data: {
      ...user, role: req.principal.role, organization: org?.name || 'Organization'
    } };
  }

  @Patch()
  async update(@Req() req: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw new UnauthorizedException('Name must contain at least two characters');
    const user = await this.prisma.user.update({
      where: { id: req.principal.userId },
      data: { name }, select: { id: true, name: true, email: true }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'PROFILE_UPDATED', entityType: 'USER', entityId: req.principal.userId
    } });
    return { success: true, data: { ...user, role: req.principal.role } };
  }

  @Post('change-password')
  async changePassword(@Req() req: AuthenticatedRequest, @Body() body: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.principal.userId },
      select: { id: true, passwordHash: true }
    });
    if (!user?.passwordHash || !(await compare(body.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (body.currentPassword === body.newPassword) {
      throw new UnauthorizedException('New password must differ from your current password');
    }
    const passwordHash = await hash(body.newPassword, 12);
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: user.id }, data: {
        passwordHash, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null
      } });
      await tx.auditEvent.create({ data: {
        organizationId: req.principal.organizationId, actorId: req.principal.userId,
        action: 'PASSWORD_CHANGED', entityType: 'USER', entityId: user.id
      } });
    });
    return { success: true, data: {
      sessionsRevoked: true, message: 'Password changed. Please sign in with your new password.'
    } };
  }
}
