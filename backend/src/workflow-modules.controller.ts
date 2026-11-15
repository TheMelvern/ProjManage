import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';
import { notifyReviewers } from './review-notifications';

class LeaveDto {
  @IsIn(['ANNUAL', 'MEDICAL', 'EMERGENCY', 'UNPAID']) type!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsOptional() @IsIn(['FULL', 'AM', 'PM']) dayType?: string;
}

class ParameterDto {
  @IsIn(['timezone', 'currency', 'dateFormat', 'fiscalYearStart', 'leaveApprovalSlaDays', 'leaveAnnualEntitlement', 'leaveMedicalEntitlement', 'leavePublicHolidays', 'riskEscalationThreshold', 'sessionTimeoutMinutes'])
  key!: string;
  @IsString() @MinLength(1) @MaxLength(2000) value!: string;
  @IsOptional() @IsString() @MaxLength(400) summary?: string;
}


export function parseHolidays(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const input = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (input.length > 500) throw new BadRequestException('Holiday calendar exceeds 500 dates');
  for (const date of input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T00:00:00.000Z')) ||
      new Date(date + 'T00:00:00.000Z').toISOString().slice(0,10) !== date) {
      throw new BadRequestException('Holiday dates must use YYYY-MM-DD');
    }
  }
  return [...new Set(input)];
}
export function workdays(start: string, end: string, dayType = 'FULL', holidays: readonly string[] = []) {
  const first = new Date(start + 'T00:00:00.000Z');
  const last = new Date(end + 'T00:00:00.000Z');
  if (!Number.isFinite(first.valueOf()) || !Number.isFinite(last.valueOf())) return 0;
  let count = 0;
  const excluded = new Set(holidays);
  for (let day = first.getTime(); day <= last.getTime() && count < 260; day += 86400000) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !excluded.has(new Date(day).toISOString().slice(0,10))) count++;
  }
  return dayType !== 'FULL' && start === end ? count / 2 : count;
}

@Controller('leave')
@UseGuards(AuthGuard)
export class LeaveController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mine')
  async mine(@Req() req: AuthenticatedRequest) {
    const records = await this.prisma.reviewRequest.findMany({
      where: { organizationId: req.principal.organizationId, makerId: req.principal.userId, kind: 'LEAVE_REQUEST' },
      orderBy: { createdAt: 'desc' }, take: 100
    });
    return { success: true, data: records.map(r => ({
      id: r.id, type: (r.payload as Prisma.JsonObject).type, startDate: (r.payload as Prisma.JsonObject).startDate,
      endDate: (r.payload as Prisma.JsonObject).endDate, reason: (r.payload as Prisma.JsonObject).reason,
      dayType: (r.payload as Prisma.JsonObject).dayType || 'FULL',
      status: r.status, checkerId: r.checkerId, createdAt: r.createdAt
    })) };
  }

  @Get('balances')
  async balances(@Req() req: AuthenticatedRequest) {
    const [records, parameters] = await Promise.all([
      this.prisma.reviewRequest.findMany({
        where: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
          kind: 'LEAVE_REQUEST', status: 'APPROVED' }
      }),
      this.prisma.organizationParameter.findMany({
        where: { organizationId: req.principal.organizationId,
          key: { in: ['leaveAnnualEntitlement', 'leaveMedicalEntitlement', 'leavePublicHolidays'] } }
      })
    ]);
    const configured = Object.fromEntries(parameters.map(p => [p.key, Number(p.value)]));
    const holidays = parseHolidays(parameters.find(p => p.key === 'leavePublicHolidays')?.value);
    const entitlements = {
      ANNUAL: Number.isFinite(configured.leaveAnnualEntitlement) && configured.leaveAnnualEntitlement >= 0
        ? configured.leaveAnnualEntitlement : 18,
      MEDICAL: Number.isFinite(configured.leaveMedicalEntitlement) && configured.leaveMedicalEntitlement >= 0
        ? configured.leaveMedicalEntitlement : 14
    };
    const used = { ANNUAL: 0, MEDICAL: 0 };
    const year = new Date().getUTCFullYear();
    for (const item of records) {
      const p = item.payload as Prisma.JsonObject;
      const type = String(p.type) as keyof typeof used;
      if (!(type in used)) continue;
      const from = String(p.startDate), to = String(p.endDate);
      const lower = from < year + '-01-01' ? year + '-01-01' : from;
      const upper = to > year + '-12-31' ? year + '-12-31' : to;
      if (lower <= upper) used[type] += workdays(lower, upper, String(p.dayType || 'FULL'), holidays);
    }
    const remaining = {
      ANNUAL: Math.max(0, entitlements.ANNUAL - used.ANNUAL),
      MEDICAL: Math.max(0, entitlements.MEDICAL - used.MEDICAL)
    };
    return { success: true, data: { year, entitlement: entitlements, used, remaining,
      holidays, note: 'Weekdays excluding configured organization holidays. Hire-date prorating and accrual require HR policy.' } };
  }

  @Get('team')
  async team(@Req() req: AuthenticatedRequest) {
    if (!['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
      throw new ForbiddenException('Team availability permission required');
    }
    const records = await this.prisma.reviewRequest.findMany({
      where: { organizationId: req.principal.organizationId,
        kind: 'LEAVE_REQUEST', status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }, take: 200
    });
    const people = await this.prisma.user.findMany({
      where: { memberships: { some: { organizationId: req.principal.organizationId } } },
      select: { id: true, name: true }
    });
    const names = new Map(people.map(p => [p.id, p.name]));
    return { success: true, data: records.map(r => ({
      id: r.id, employeeId: r.makerId, employeeName: names.get(r.makerId || '') || 'Unknown',
      type: (r.payload as Prisma.JsonObject).type,
      startDate: (r.payload as Prisma.JsonObject).startDate,
      endDate: (r.payload as Prisma.JsonObject).endDate
    })) };
  }

  @Post(':id/cancel')
  async cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const updated = await this.prisma.$transaction(async tx => {
      const existing = await tx.reviewRequest.findFirst({
        where: { id, organizationId: req.principal.organizationId,
          makerId: req.principal.userId, kind: 'LEAVE_REQUEST' }
      });
      if (!existing) throw new NotFoundException('Leave request not found');
      if (existing.status !== 'PENDING') {
        throw new ConflictException('Only pending leave requests can be cancelled');
      }
      const result = await tx.reviewRequest.updateMany({
        where: { id: existing.id, status: 'PENDING' },
        data: { status: 'CANCELLED', comment: 'Cancelled by applicant', reviewedAt: new Date() }
      });
      if (result.count !== 1) throw new ConflictException('Request has already changed');
      await tx.auditEvent.create({
        data: { organizationId: req.principal.organizationId, actorId: req.principal.userId,
          action: 'REVIEW_CANCELLED', entityType: 'LEAVE_REQUEST', entityId: existing.id }
      });
      return existing.id;
    });
    return { success: true, data: { id: updated, status: 'CANCELLED' } };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: LeaveDto) {
    const start = new Date(body.startDate), end = new Date(body.endDate);
    if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }
    if ((end.getTime() - start.getTime()) / 86400000 > 60) {
      throw new BadRequestException('Requests longer than 60 days must be handled by HR');
    }
    const dayType = body.dayType || 'FULL';
    const policy = await this.prisma.organizationParameter.findUnique({
      where: { organizationId_key: { organizationId: req.principal.organizationId, key: 'leavePublicHolidays' } }
    });
    const holidays = parseHolidays(policy?.value);
    if (dayType !== 'FULL' && body.startDate !== body.endDate) {
      throw new BadRequestException('Half-day leave must start and end on the same day');
    }
    if (workdays(body.startDate, body.endDate, dayType, holidays) === 0) {
      throw new BadRequestException('A leave request must include at least one weekday');
    }
    const overlapping = await this.prisma.reviewRequest.findMany({
      where: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'LEAVE_REQUEST', status: { in: ['PENDING', 'APPROVED'] } }
    });
    if (overlapping.some(r => {
      const p = r.payload as Prisma.JsonObject;
      if (String(p.startDate) > body.endDate || String(p.endDate) < body.startDate) return false;
      // Opposite AM/PM sessions on a single date may coexist.
      if (body.startDate === body.endDate && String(p.startDate) === String(p.endDate) &&
        dayType !== 'FULL' && String(p.dayType || 'FULL') !== 'FULL' &&
        dayType !== String(p.dayType)) return false;
      return true;
    })) throw new BadRequestException('This request overlaps an existing pending or approved absence');
    const balances = await this.balances(req);
    const remaining = balances.data.remaining as Record<string, number>;
    if (['ANNUAL', 'MEDICAL'].includes(body.type) &&
      workdays(body.startDate, body.endDate, dayType, holidays) > (remaining[body.type] ?? 0)) {
      throw new BadRequestException('Insufficient approved leave balance');
    }
    const request = await this.prisma.reviewRequest.create({
      data: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'LEAVE_REQUEST', summary: body.type + ' leave: ' + body.startDate + ' to ' + body.endDate,
        payload: { type: body.type, startDate: body.startDate, endDate: body.endDate, reason: body.reason, dayType } }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'REVIEW_SUBMITTED', entityType: 'LEAVE_REQUEST', entityId: request.id
    } });
    await notifyReviewers(this.prisma, req.principal.organizationId, req.principal.userId, request.summary);
    return { success: true, data: { id: request.id, status: request.status } };
  }
}

@Controller('admin/parameters')
@UseGuards(AuthGuard)
export class ParametersController {
  constructor(private readonly prisma: PrismaService) {}
  private assertAdmin(req: AuthenticatedRequest) {
    if (req.principal.role !== 'ADMIN') throw new ForbiddenException('Administrator role required');
  }
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    this.assertAdmin(req);
    return { success: true, data: await this.prisma.organizationParameter.findMany({
      where: { organizationId: req.principal.organizationId }, orderBy: { key: 'asc' } }) };
  }
  @Post('proposals')
  async propose(@Req() req: AuthenticatedRequest, @Body() body: ParameterDto) {
    this.assertAdmin(req);
    if (body.key === 'leavePublicHolidays') parseHolidays(body.value);
    const current = await this.prisma.organizationParameter.findUnique({
      where: { organizationId_key: { organizationId: req.principal.organizationId, key: body.key } }
    });
    const review = await this.prisma.reviewRequest.create({
      data: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'PARAMETER_UPDATE', entityId: current?.id, summary: body.summary || 'Change ' + body.key,
        payload: { key: body.key, value: body.value, previousValue: current?.value ?? null } }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'REVIEW_SUBMITTED', entityType: 'PARAMETER_UPDATE', entityId: review.id
    } });
    await notifyReviewers(this.prisma, req.principal.organizationId, req.principal.userId, review.summary, true);
    return { success: true, data: { id: review.id, status: review.status } };
  }
}
