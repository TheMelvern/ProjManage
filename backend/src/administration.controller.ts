import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';
import { notifyReviewers } from './review-notifications';

class MembershipProposalDto {
  @IsUUID() membershipId!: string;
  @IsIn(['ADMIN', 'PMO', 'PROJECT_MANAGER', 'MEMBER']) role!: string;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdministrationController {
  constructor(private readonly prisma: PrismaService) {}
  private admin(req: AuthenticatedRequest) {
    if (req.principal.role !== 'ADMIN') throw new ForbiddenException('Administrator role required');
  }
  @Get('users')
  async listUsers(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const users = await this.prisma.membership.findMany({
      where: { organizationId: req.principal.organizationId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { user: { name: 'asc' } }
    });
    return { success: true, data: users.map(u => ({
      membershipId: u.id, userId: u.userId, name: u.user.name, email: u.user.email,
      role: u.role, joinedAt: u.user.createdAt
    })) };
  }
  @Post('users/proposals')
  async roleProposal(@Req() req: AuthenticatedRequest, @Body() body: MembershipProposalDto) {
    this.admin(req);
    const existing = await this.prisma.membership.findFirst({
      where: { id: body.membershipId, organizationId: req.principal.organizationId }
    });
    if (!existing) throw new ForbiddenException('Membership does not exist in your organization');
    if (existing.role === body.role) throw new ForbiddenException('No role change is needed');
    const review = await this.prisma.reviewRequest.create({
      data: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'MEMBERSHIP_UPDATE', entityId: existing.id,
        summary: body.reason.trim(),
        payload: { userId: existing.userId, membershipId: existing.id,
          previousRole: existing.role, newRole: body.role } }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'REVIEW_SUBMITTED', entityType: 'MEMBERSHIP_UPDATE', entityId: review.id
    } });
    await notifyReviewers(this.prisma, req.principal.organizationId, req.principal.userId, review.summary, true, 'MEMBERSHIP_UPDATE');
    return { success: true, data: { id: review.id, status: review.status } };
  }
  @Get('audit')
  async audit(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const events = await this.prisma.auditEvent.findMany({
      where: { organizationId: req.principal.organizationId },
      orderBy: { createdAt: 'desc' }, take: 200
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(events.map(e => e.actorId))] } },
      select: { id: true, name: true }
    });
    const names = new Map(users.map(u => [u.id, u.name]));
    return { success: true, data: events.map(e => ({
      id: e.id, action: e.action, entityType: e.entityType,
      entityId: e.entityId, actorId: e.actorId,
      actorName: names.get(e.actorId) || 'Unknown user',
      createdAt: e.createdAt
    })) };
  }
}
