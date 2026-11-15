import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';

class LeaveDto {
  @IsIn(['ANNUAL', 'MEDICAL', 'EMERGENCY', 'UNPAID']) type!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

class ParameterDto {
  @IsIn(['timezone', 'currency', 'dateFormat', 'fiscalYearStart', 'leaveApprovalSlaDays', 'leaveAnnualEntitlement', 'leaveMedicalEntitlement', 'riskEscalationThreshold', 'sessionTimeoutMinutes'])
  key!: string;
  @IsString() @MinLength(1) @MaxLength(120) value!: string;
  @IsOptional() @IsString() @MaxLength(400) summary?: string;
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
      status: r.status, checkerId: r.checkerId, createdAt: r.createdAt
    })) };
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
    const overlapping = await this.prisma.reviewRequest.findMany({
      where: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'LEAVE_REQUEST', status: { in: ['PENDING', 'APPROVED'] } }
    });
    if (overlapping.some(r => {
      const p = r.payload as Prisma.JsonObject;
      return String(p.startDate) <= body.endDate && String(p.endDate) >= body.startDate;
    })) throw new BadRequestException('This request overlaps an existing pending or approved absence');
    const request = await this.prisma.reviewRequest.create({
      data: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'LEAVE_REQUEST', summary: body.type + ' leave: ' + body.startDate + ' to ' + body.endDate,
        payload: { type: body.type, startDate: body.startDate, endDate: body.endDate, reason: body.reason } }
    });
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
    const current = await this.prisma.organizationParameter.findUnique({
      where: { organizationId_key: { organizationId: req.principal.organizationId, key: body.key } }
    });
    const review = await this.prisma.reviewRequest.create({
      data: { organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind: 'PARAMETER_UPDATE', entityId: current?.id, summary: body.summary || 'Change ' + body.key,
        payload: { key: body.key, value: body.value, previousValue: current?.value ?? null } }
    });
    return { success: true, data: { id: review.id, status: review.status } };
  }
}
