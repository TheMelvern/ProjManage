import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';

class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(140) name!: string;
}

class UpdateAvatarDto {
  @IsString() @MaxLength(220000) dataUrl!: string;
}

class UpdateAppearanceDto {
  @IsIn(['system','light','dark']) themeMode!: string;
  @IsIn(['blue','graphite','purple','teal','green','rose']) accentColor!: string;
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
      select: { id: true, name: true, email: true, avatarDataUrl: true, themeMode: true, accentColor: true, emailVerifiedAt: true, createdAt: true }
    });
    if (!user) throw new UnauthorizedException('Account not found');
    const org = await this.prisma.organization.findUnique({
      where: { id: req.principal.organizationId },
      select: { name: true }
    });
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: req.principal.organizationId, userId: req.principal.userId } },
      select: { department: true, role: true, organizationId: true }
    });
    return { success: true, data: {
      ...user, role: membership?.role || req.principal.role, organization: org?.name || 'Organization',
      organizationId: req.principal.organizationId, department: membership?.department || null
    } };
  }

  @Patch()
  async update(@Req() req: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw new BadRequestException('Name must contain at least two characters');
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

  @Patch('appearance')
  async updateAppearance(@Req() req: AuthenticatedRequest, @Body() body: UpdateAppearanceDto) {
    const user = await this.prisma.user.update({
      where: { id: req.principal.userId },
      data: { themeMode: body.themeMode, accentColor: body.accentColor },
      select: { themeMode: true, accentColor: true }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'APPEARANCE_UPDATED', entityType: 'USER', entityId: req.principal.userId
    } });
    return { success: true, data: user };
  }

  @Post('avatar')
  async updateAvatar(@Req() req: AuthenticatedRequest, @Body() body: UpdateAvatarDto) {
    // Accept only small PNG/JPEG/WebP images; reject arbitrary active formats such as SVG.
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.dataUrl);
    if(!match) throw new BadRequestException('Upload a PNG, JPEG or WebP image');
    const bytes=Buffer.from(match[2],'base64');
    if(bytes.length===0 || bytes.length>150000 || bytes.toString('base64')!==match[2]) {
      throw new BadRequestException('Profile image must be at most 150 KB');
    }
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg=bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
    const webp=bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
    if(!(match[1]==='png'&&png || match[1]==='jpeg'&&jpg || match[1]==='webp'&&webp)) {
      throw new BadRequestException('Invalid profile image content');
    }
    const user=await this.prisma.user.update({where:{id:req.principal.userId},
      data:{avatarDataUrl:body.dataUrl},select:{avatarDataUrl:true}});
    await this.prisma.auditEvent.create({data:{organizationId:req.principal.organizationId,
      actorId:req.principal.userId,action:'PROFILE_AVATAR_UPDATED',entityType:'USER',entityId:req.principal.userId}});
    return {success:true,data:user};
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
