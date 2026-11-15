import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HealthStatus, Prisma, ProjectStatus, ReviewStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { hash } from 'bcryptjs';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';

class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(140) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(2) organization!: string;
}

class ProjectReviewDto {
  @IsUUID() projectId!: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsEnum(HealthStatus) health?: HealthStatus;
  @IsString() @MinLength(5) @MaxLength(400) summary!: string;
}

class DecisionDto {
  @IsIn(['APPROVED', 'REJECTED', 'RETURNED']) decision!: 'APPROVED' | 'REJECTED' | 'RETURNED';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

function safeRequest(r: { payload: unknown; [key: string]: unknown }) {
  const { payload, ...safe } = r;
  return { ...safe, proposed: ['PROJECT_UPDATE', 'PARAMETER_UPDATE', 'LEAVE_REQUEST'].includes(String(safe.kind)) ? payload : undefined };
}

@Controller('auth')
export class RegistrationController {
  constructor(private readonly prisma: PrismaService) {}

  // Requests never issue a token. Organization administrators independently approve membership.
  @Post('register')
  async register(@Body() input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const org = await this.prisma.organization.findFirst({ where: { name: { equals: input.organization.trim(), mode: 'insensitive' } } });
    if (!org) throw new BadRequestException('Organization not found. Ask your administrator for the correct organization name.');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('This email already has an account. Sign in or contact your administrator.');
    const pending = await this.prisma.reviewRequest.findFirst({
      where: { organizationId: org.id, kind: 'REGISTRATION', status: 'PENDING', summary: email }
    });
    if (pending) throw new ConflictException('A registration request for this email is pending approval');
    const passwordHash = await hash(input.password, 12);
    const request = await this.prisma.reviewRequest.create({
      data: {
        organizationId: org.id, kind: 'REGISTRATION', summary: email,
        payload: { email, name: input.name.trim(), passwordHash }
      }
    });
    return { success: true, data: { id: request.id, status: request.status, message: 'Registration submitted for administrator approval' } };
  }
}

@Controller('reviews')
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertChecker(req: AuthenticatedRequest) {
    if (!['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
      throw new ForbiddenException('Independent reviewer role required');
    }
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const role = req.principal.role;
    const requests = await this.prisma.reviewRequest.findMany({
      where: {
        organizationId: req.principal.organizationId,
        ...(role === 'ADMIN' ? {} : role === 'PMO' || role === 'PROJECT_MANAGER'
          ? { kind: { notIn: ['REGISTRATION', 'PARAMETER_UPDATE'] } }
          : { makerId: req.principal.userId })
      },
      orderBy: { createdAt: 'desc' }, take: 150
    });
    return { success: true, data: requests.map(safeRequest) };
  }

  @Post('projects')
  async submitProject(@Req() req: AuthenticatedRequest, @Body() input: ProjectReviewDto) {
    this.assertChecker(req);
    if (!input.status && !input.health) throw new BadRequestException('Provide a project status or health change');
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, organizationId: req.principal.organizationId }
    });
    if (!project) throw new NotFoundException('Project not found');
    const change = await this.prisma.reviewRequest.create({
      data: {
        organizationId: req.principal.organizationId,
        makerId: req.principal.userId,
        kind: 'PROJECT_UPDATE',
        entityId: project.id,
        summary: input.summary.trim(),
        payload: { status: input.status, health: input.health, previousStatus: project.status, previousHealth: project.health }
      }
    });
    return { success: true, data: safeRequest(change) };
  }

  @Post(':id/decision')
  async decide(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: DecisionDto) {
    this.assertChecker(req);
    if (body.decision !== 'APPROVED' && !body.comment?.trim()) {
      throw new BadRequestException('A reason is required when rejecting or returning a request');
    }
    const result = await this.prisma.$transaction(async tx => {
      const review = await tx.reviewRequest.findFirst({
        where: { id, organizationId: req.principal.organizationId }
      });
      if (!review) throw new NotFoundException('Review request not found');
      if (review.status !== 'PENDING') throw new ConflictException('This request has already been reviewed');
      if (review.makerId === req.principal.userId) {
        throw new ForbiddenException('Makers cannot approve or review their own requests');
      }
      if (review.kind === 'REGISTRATION' && req.principal.role !== 'ADMIN') {
        throw new ForbiddenException('Only organization administrators can approve account registration');
      }
      if (review.kind === 'LEAVE_REQUEST' && !['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
        throw new ForbiddenException('Leave checker permission required');
      }
      const payload = review.payload as Prisma.JsonObject;
      if (body.decision === 'APPROVED') {
        if (review.kind === 'PROJECT_UPDATE') {
          const project = await tx.project.findFirst({ where: { id: review.entityId || '', organizationId: review.organizationId } });
          if (!project) throw new NotFoundException('Target project not found');
          if (project.status !== payload.previousStatus || project.health !== payload.previousHealth) {
            throw new ConflictException('The source project changed. A new approval must be submitted');
          }
          const status = payload.status as ProjectStatus | undefined;
          const health = payload.health as HealthStatus | undefined;
          await tx.project.update({ where: { id: project.id }, data: { status, health } });
        } else if (review.kind === 'PARAMETER_UPDATE') {
          if (req.principal.role !== 'ADMIN') {
            throw new ForbiddenException('Administrator checker required for parameter changes');
          }
          const key = String(payload.key);
          const current = await tx.organizationParameter.findUnique({
            where: { organizationId_key: { organizationId: review.organizationId, key } }
          });
          if (JSON.stringify(current?.value ?? null) !== JSON.stringify(payload.previousValue ?? null)) {
            throw new ConflictException('This parameter has changed; re-submit an updated proposal');
          }
          await tx.organizationParameter.upsert({
            where: { organizationId_key: { organizationId: review.organizationId, key } },
            create: { organizationId: review.organizationId, key, value: String(payload.value), updatedBy: req.principal.userId },
            update: { value: String(payload.value), updatedBy: req.principal.userId }
          });
        } else if (review.kind === 'LEAVE_REQUEST') {
          // The approved review request itself is the authoritative leave record.
          // No user can publish a leave approval without passing this checker gate.
        } else if (review.kind === 'REGISTRATION') {
          const email = String(payload.email);
          const already = await tx.user.findUnique({ where: { email } });
          if (already) throw new ConflictException('Account already exists');
          const user = await tx.user.create({
            data: { email, name: String(payload.name), passwordHash: String(payload.passwordHash) }
          });
          await tx.membership.create({ data: { userId: user.id, organizationId: review.organizationId, role: 'MEMBER' } });
        } else {
          throw new BadRequestException('Unsupported review type');
        }
      }
      const updated = await tx.reviewRequest.update({
        where: { id },
        data: {
          status: body.decision as ReviewStatus,
          checkerId: req.principal.userId,
          comment: body.comment?.trim() || null,
          reviewedAt: new Date(),
          // Never retain the password hash after registration is reviewed.
          ...(review.kind === 'REGISTRATION' ? { payload: { email: payload.email, name: payload.name } as Prisma.InputJsonValue } : {})
        }
      });
      await tx.auditEvent.create({
        data: { organizationId: review.organizationId, actorId: req.principal.userId,
          action: 'REVIEW_' + body.decision, entityType: review.kind, entityId: review.id }
      });
      return updated;
    });
    return { success: true, data: safeRequest(result) };
  }
}
