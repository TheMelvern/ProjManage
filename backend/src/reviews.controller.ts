import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HealthStatus, Prisma, ProjectStatus, ReviewStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { hash } from 'bcryptjs';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';
import { workdays } from './workflow-modules.controller';
import { ThrottleService } from './throttle.service';
import type { Request } from 'express';

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
  @IsOptional() @IsString() @MinLength(2) @MaxLength(140) name?: string;
  @IsOptional() @IsString() @MaxLength(140) client?: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
  @IsString() @MinLength(5) @MaxLength(400) summary!: string;
}

class DecisionDto {
  @IsIn(['APPROVED', 'REJECTED', 'RETURNED']) decision!: 'APPROVED' | 'REJECTED' | 'RETURNED';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

function safeRequest(r: { payload: unknown; [key: string]: unknown }) {
  const { payload, ...safe } = r;
  return { ...safe, proposed: ['PROJECT_UPDATE', 'PARAMETER_UPDATE', 'LEAVE_REQUEST', 'MEMBERSHIP_UPDATE',
    'PROJECT_CREATE','TASK_CREATE','TASK_UPDATE','RISK_CREATE','RISK_UPDATE','ISSUE_CREATE','ISSUE_UPDATE',
    'ACTION_CREATE','ACTION_UPDATE','DECISION_CREATE','TIMESHEET_CREATE','REPORT_PUBLISH'].includes(String(safe.kind)) ? payload : undefined };
}

@Controller('auth')
export class RegistrationController {
  constructor(private readonly prisma: PrismaService, private readonly throttle: ThrottleService) {}

  // Requests never issue a token. Organization administrators independently approve membership.
  @Post('register')
  async register(@Body() input: RegisterDto, @Req() req: Request) {
    this.throttle.limit('register:' + req.ip, 5, 600_000);
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
          ? { kind: { notIn: ['REGISTRATION', 'PARAMETER_UPDATE', 'MEMBERSHIP_UPDATE'] } }
          : { makerId: req.principal.userId })
      },
      orderBy: { createdAt: 'desc' }, take: 150
    });
    return { success: true, data: requests.map(safeRequest) };
  }

  @Post('projects')
  async submitProject(@Req() req: AuthenticatedRequest, @Body() input: ProjectReviewDto) {
    this.assertChecker(req);
    if (input.status === undefined && input.health === undefined && input.name === undefined &&
      input.client === undefined && input.description === undefined) {
      throw new BadRequestException('Provide at least one project change');
    }
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
        payload: { status: input.status, health: input.health, name: input.name,
          client: input.client, description: input.description,
          previousStatus: project.status, previousHealth: project.health,
          previousUpdatedAt: project.updatedAt.toISOString() }
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
      if (['REGISTRATION', 'MEMBERSHIP_UPDATE'].includes(review.kind) && req.principal.role !== 'ADMIN') {
        throw new ForbiddenException('Only organization administrators can approve account registration');
      }
      if (review.kind === 'LEAVE_REQUEST' && !['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
        throw new ForbiddenException('Leave checker permission required');
      }
      // Acquire the pending state atomically inside this transaction to prevent double approval.
      const claimed = await tx.reviewRequest.updateMany({
        where: { id: review.id, organizationId: review.organizationId, status: 'PENDING' },
        data: { status: body.decision as ReviewStatus, checkerId: req.principal.userId,
          reviewedAt: new Date(), comment: body.comment?.trim() || null }
      });
      if (claimed.count !== 1) throw new ConflictException('Review request has already been decided');
      const payload = review.payload as Prisma.JsonObject;
      if (body.decision === 'APPROVED') {
        if (review.kind === 'PROJECT_CREATE') {
          const values = (payload.values || {}) as Prisma.JsonObject;
          await tx.project.create({ data: {
            organizationId: review.organizationId, name: String(values.name),
            client: typeof values.client === 'string' ? values.client : undefined,
            description: typeof values.description === 'string' ? values.description : undefined
          } });
        } else if (['TASK_CREATE', 'TASK_UPDATE', 'RISK_CREATE', 'RISK_UPDATE',
          'ISSUE_CREATE', 'ISSUE_UPDATE', 'ACTION_CREATE', 'ACTION_UPDATE',
          'DECISION_CREATE', 'TIMESHEET_CREATE', 'REPORT_PUBLISH'].includes(review.kind)) {
          const values = (payload.values || {}) as Prisma.JsonObject;
          const projectId = String(payload.projectId || '');
          const project = projectId ? await tx.project.findFirst({
            where: { id: projectId, organizationId: review.organizationId }
          }) : null;
          if (review.kind !== 'REPORT_PUBLISH' && !project) {
            throw new NotFoundException('Source project no longer exists');
          }
          const str = (key: string) => typeof values[key] === 'string' ? String(values[key]) : undefined;
          const date = (key: string) => str(key) ? new Date(str(key)!) : undefined;
          const targetId = String(payload.targetId || '');
          const version = String(payload.previousUpdatedAt || '');
          const assertVersion = (record: { updatedAt: Date } | null) => {
            if (!record || record.updatedAt.toISOString() !== version)
              throw new ConflictException('Source record changed. Re-submit your proposal');
          };
          if (review.kind === 'TASK_CREATE') {
            await tx.task.create({ data: { projectId, title: str('title')!,
              description: str('description'), dueDate: date('dueDate') } });
          } else if (review.kind === 'TASK_UPDATE') {
            const current = await tx.task.findFirst({ where: { id: targetId, projectId } });
            assertVersion(current);
            await tx.task.update({ where: { id: targetId }, data: {
              title: str('title'), description: str('description'),
              dueDate: date('dueDate'), status: str('status') as any
            } });
          } else if (review.kind === 'RISK_CREATE') {
            await tx.risk.create({ data: { projectId, title: str('title')!,
              description: str('description'), severity: str('severity') as any,
              ownerName: str('ownerName'), mitigation: str('mitigation'), targetDate: date('targetDate') } });
          } else if (review.kind === 'RISK_UPDATE') {
            const current = await tx.risk.findFirst({ where: { id: targetId, projectId } });
            assertVersion(current);
            await tx.risk.update({ where: { id: targetId }, data: {
              title: str('title'), description: str('description'),
              severity: str('severity') as any, status: str('status') as any,
              ownerName: str('ownerName'), mitigation: str('mitigation'), targetDate: date('targetDate')
            } });
          } else if (review.kind === 'ISSUE_CREATE') {
            await tx.issue.create({ data: { projectId, title: str('title')!,
              description: str('description'), severity: str('severity') as any,
              ownerName: str('ownerName'), resolution: str('resolution'), targetDate: date('targetDate') } });
          } else if (review.kind === 'ISSUE_UPDATE') {
            const current = await tx.issue.findFirst({ where: { id: targetId, projectId } });
            assertVersion(current);
            await tx.issue.update({ where: { id: targetId }, data: {
              title: str('title'), description: str('description'),
              severity: str('severity') as any, status: str('status') as any,
              ownerName: str('ownerName'), resolution: str('resolution'), targetDate: date('targetDate')
            } });
          } else if (review.kind === 'ACTION_CREATE') {
            await tx.actionItem.create({ data: { projectId, title: str('title')!,
              ownerName: str('ownerName'), dueDate: date('dueDate') } });
          } else if (review.kind === 'ACTION_UPDATE') {
            const current = await tx.actionItem.findFirst({ where: { id: targetId, projectId } });
            assertVersion(current);
            await tx.actionItem.update({ where: { id: targetId }, data: {
              title: str('title'), ownerName: str('ownerName'),
              dueDate: date('dueDate'), status: str('status') as any
            } });
          } else if (review.kind === 'DECISION_CREATE') {
            await tx.decision.create({ data: { projectId, title: str('title')!,
              rationale: str('rationale'), decidedBy: str('decidedBy') } });
          } else if (review.kind === 'TIMESHEET_CREATE') {
            if (!review.makerId) throw new BadRequestException('Time entry maker missing');
            await tx.timesheetEntry.create({ data: { projectId, userId: review.makerId,
              workDate: date('workDate')!, hours: Number(values.hours), description: str('description') } });
          } else if (review.kind === 'REPORT_PUBLISH') {
            if (!['ADMIN','PMO'].includes(req.principal.role))
              throw new ForbiddenException('PMO checker required to release executive reports');
            // Approval of the versioned snapshot is recorded in ReviewRequest and AuditEvent.
          }
        } else if (review.kind === 'PROJECT_UPDATE') {
          const project = await tx.project.findFirst({ where: { id: review.entityId || '', organizationId: review.organizationId } });
          if (!project) throw new NotFoundException('Target project not found');
          if (project.status !== payload.previousStatus || project.health !== payload.previousHealth ||
            project.updatedAt.toISOString() !== payload.previousUpdatedAt) {
            throw new ConflictException('The source project changed. A new approval must be submitted');
          }
          const status = payload.status as ProjectStatus | undefined;
          const health = payload.health as HealthStatus | undefined;
          await tx.project.update({ where: { id: project.id }, data: { status, health,
            name: typeof payload.name === 'string' ? payload.name : undefined,
            client: typeof payload.client === 'string' ? payload.client : undefined,
            description: typeof payload.description === 'string' ? payload.description : undefined
          } });
        } else if (review.kind === 'MEMBERSHIP_UPDATE') {
          if (req.principal.role !== 'ADMIN') {
            throw new ForbiddenException('Administrator checker required for role changes');
          }
          const membership = await tx.membership.findFirst({
            where: { id: String(payload.membershipId), organizationId: review.organizationId }
          });
          if (!membership || membership.role !== payload.previousRole) {
            throw new ConflictException('Membership changed; submit a new role proposal');
          }
          if (membership.role === 'ADMIN' && payload.newRole !== 'ADMIN') {
            const count = await tx.membership.count({
              where: { organizationId: review.organizationId, role: 'ADMIN' }
            });
            if (count <= 2) throw new ConflictException('At least two independent administrators must remain');
          }
          await tx.membership.update({
            where: { id: membership.id }, data: { role: String(payload.newRole) }
          });
          // Role changes immediately revoke previously issued access tokens.
          await tx.user.update({ where: { id: membership.userId },
            data: { sessionVersion: { increment: 1 } } });
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
          // Revalidate against all effective absences at approval time. Pending requests do not consume balance.
          if (!review.makerId) throw new BadRequestException('Leave requester missing');
          const start = String(payload.startDate), end = String(payload.endDate);
          const dayType = String(payload.dayType || 'FULL');
          const approved = await tx.reviewRequest.findMany({ where: {
            organizationId: review.organizationId, kind: 'LEAVE_REQUEST',
            makerId: review.makerId, status: 'APPROVED', id: { not: review.id }
          } });
          for (const r of approved) {
            const p = r.payload as Prisma.JsonObject;
            if (String(p.startDate) > end || String(p.endDate) < start) continue;
            if (start === end && String(p.startDate) === String(p.endDate) &&
              dayType !== 'FULL' && String(p.dayType || 'FULL') !== 'FULL' &&
              dayType !== String(p.dayType)) continue;
            throw new ConflictException('Leave overlaps an existing approved absence');
          }
          const leaveType = String(payload.type);
          if (leaveType === 'ANNUAL' || leaveType === 'MEDICAL') {
            const key = leaveType === 'ANNUAL' ? 'leaveAnnualEntitlement' : 'leaveMedicalEntitlement';
            const policy = await tx.organizationParameter.findUnique({
              where: { organizationId_key: { organizationId: review.organizationId, key } }
            });
            const configured = Number(policy?.value ?? (leaveType === 'ANNUAL' ? 18 : 14));
            const entitlement = Number.isFinite(configured) && configured >= 0
              ? configured : leaveType === 'ANNUAL' ? 18 : 14;
            for (let year = Number(start.slice(0,4)); year <= Number(end.slice(0,4)); year++) {
              const lower = start < year + '-01-01' ? year + '-01-01' : start;
              const upper = end > year + '-12-31' ? year + '-12-31' : end;
              const requestedDays = workdays(lower, upper, dayType);
              const alreadyUsed = approved.reduce((total, r) => {
                const p = r.payload as Prisma.JsonObject;
                if (String(p.type) !== leaveType) return total;
                const a = String(p.startDate), b = String(p.endDate);
                const first = a < year + '-01-01' ? year + '-01-01' : a;
                const last = b > year + '-12-31' ? year + '-12-31' : b;
                return total + (first <= last ? workdays(first,last,String(p.dayType || 'FULL')) : 0);
              }, 0);
              if (alreadyUsed + requestedDays > entitlement) {
                throw new ConflictException('Insufficient leave entitlement at approval time');
              }
            }
          }
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
