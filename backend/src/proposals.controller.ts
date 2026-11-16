import { BadRequestException, Body, Controller, ForbiddenException, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';
import { notifyReviewers } from './review-notifications';

const kinds = [
  'PROJECT_CREATE','TASK_CREATE','TASK_UPDATE','RISK_CREATE','RISK_UPDATE',
  'ISSUE_CREATE','ISSUE_UPDATE','DECISION_CREATE','ACTION_CREATE','ACTION_UPDATE',
  'TIMESHEET_CREATE','REPORT_PUBLISH'
] as const;
type Kind = typeof kinds[number];
class OperationDto {
  @IsIn(kinds) kind!: Kind;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() targetId?: string;
  @IsObject() values!: Record<string, unknown>;
  @IsString() @MinLength(5) @MaxLength(400) summary!: string;
}

const writable: Record<Kind, string[]> = {
  PROJECT_CREATE: ['name','client','description','startDate','targetEndDate','deliveryMethod'],
  TASK_CREATE: ['title','description','dueDate','startDate','itemType','priority','phase'],
  TASK_UPDATE: ['title','description','dueDate','startDate','itemType','priority','phase','status'],
  RISK_CREATE: ['title','description','severity','ownerName','mitigation','targetDate'],
  RISK_UPDATE: ['title','description','severity','ownerName','mitigation','targetDate','status'],
  ISSUE_CREATE: ['title','description','severity','ownerName','resolution','targetDate'],
  ISSUE_UPDATE: ['title','description','severity','ownerName','resolution','targetDate','status'],
  DECISION_CREATE: ['title','rationale','decidedBy'],
  ACTION_CREATE: ['title','ownerName','dueDate'],
  ACTION_UPDATE: ['title','ownerName','dueDate','status'],
  TIMESHEET_CREATE: ['workDate','hours','description'],
  REPORT_PUBLISH: []
};
const statusValues = ['TODO','IN_PROGRESS','BLOCKED','DONE','OPEN','CLOSED'] as const;
const severityValues = ['LOW','MEDIUM','HIGH','CRITICAL'];

function validateValues(kind: Kind, values: Record<string, unknown>): Record<string, string | number | null> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new BadRequestException('A valid values object is required');
  const keys = Object.keys(values);
  if (keys.some(key => !writable[kind].includes(key))) throw new BadRequestException('Unsupported field in proposed change');
  if (kind === 'REPORT_PUBLISH') return {};
  if (kind.endsWith('_CREATE') && !['TIMESHEET_CREATE'].includes(kind)) {
    if (typeof values.title !== 'string' && typeof values.name !== 'string') {
      throw new BadRequestException('A name or title is required');
    }
  }
  const checked: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      if (!['dueDate','targetDate','startDate','targetEndDate','phase','description','client','ownerName','resolution','mitigation'].includes(key)) {
        throw new BadRequestException('This field cannot be null');
      }
      checked[key] = null;
      continue;
    }
    if (key === 'hours') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.25 || value > 24 ||
        Math.round(value * 4) !== value * 4) throw new BadRequestException('Hours must be 0.25 to 24 in quarter-hour increments');
      checked[key] = value; continue;
    }
    if (typeof value !== 'string') throw new BadRequestException('Field ' + key + ' must be text');
    const clean = value.trim();
    if (clean.length > 1500) throw new BadRequestException('Field exceeds maximum size');
    if (['name','title'].includes(key) && (clean.length < 2 || clean.length > 200)) throw new BadRequestException('Name/title must have 2–200 characters');
    if (key === 'deliveryMethod' && !['KANBAN','WATERFALL'].includes(clean)) throw new BadRequestException('Invalid delivery method');
    if (key === 'itemType' && !['EPIC','STORY','TASK','BUG','MILESTONE'].includes(clean)) throw new BadRequestException('Invalid work item type');
    if (key === 'priority' && !['LOW','MEDIUM','HIGH','CRITICAL'].includes(clean)) throw new BadRequestException('Invalid priority');
    if (key === 'status' && !statusValues.includes(clean as typeof statusValues[number])) throw new BadRequestException('Invalid status');
    if (key === 'severity' && !severityValues.includes(clean)) throw new BadRequestException('Invalid severity');
    if (['dueDate','targetDate','startDate','targetEndDate','workDate'].includes(key) && (!Number.isFinite(Date.parse(clean)))) {
      throw new BadRequestException('Invalid date');
    }
    checked[key] = clean;
  }
  if (kind === 'PROJECT_CREATE' && typeof checked.startDate === 'string' &&
      typeof checked.targetEndDate === 'string' && Date.parse(checked.targetEndDate) < Date.parse(checked.startDate)) {
    throw new BadRequestException('Project end must be on or after the planned start');
  }
  if ((kind === 'TASK_CREATE' || kind === 'TASK_UPDATE') && typeof checked.startDate === 'string' &&
      typeof checked.dueDate === 'string' && Date.parse(checked.dueDate) < Date.parse(checked.startDate)) {
    throw new BadRequestException('Work item due date must be on or after its start');
  }
  if (kind === 'TIMESHEET_CREATE') {
    if (typeof checked.workDate !== 'string' || typeof checked.hours !== 'number') {
      throw new BadRequestException('Work date and hours are required');
    }
    if (new Date(checked.workDate).getTime() > Date.now() + 86400000) {
      throw new BadRequestException('Future time entries are not permitted');
    }
  }
  return checked;
}

@Controller('reviews')
@UseGuards(AuthGuard)
export class OperationProposalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('operations')
  async submit(@Req() req: AuthenticatedRequest, @Body() input: OperationDto) {
    const { kind } = input;
    const editor = ['ADMIN','PMO','PROJECT_MANAGER'].includes(req.principal.role);
    if (kind !== 'TIMESHEET_CREATE' && !editor) throw new ForbiddenException('Maker permissions required');
    const values = validateValues(kind, input.values);
    if (kind === 'PROJECT_CREATE') {
      if (typeof values.name !== 'string') throw new BadRequestException('Project name is required');
    } else {
      if (kind !== 'REPORT_PUBLISH' && !input.projectId) throw new BadRequestException('Project required');
      if (input.projectId) {
        const project = await this.prisma.project.findFirst({
          where: { id: input.projectId, organizationId: req.principal.organizationId }
        });
        if (!project) throw new NotFoundException('Project not found');
      }
    }
    let previousUpdatedAt: string | undefined;
    if (kind.endsWith('_UPDATE')) {
      if (!input.targetId || !input.projectId) throw new BadRequestException('Target and project required');
      let record: { updatedAt: Date } | null = null;
      if (kind === 'TASK_UPDATE') record = await this.prisma.task.findFirst({ where: { id: input.targetId, projectId: input.projectId } });
      if (kind === 'RISK_UPDATE') record = await this.prisma.risk.findFirst({ where: { id: input.targetId, projectId: input.projectId } });
      if (kind === 'ISSUE_UPDATE') record = await this.prisma.issue.findFirst({ where: { id: input.targetId, projectId: input.projectId } });
      if (kind === 'ACTION_UPDATE') record = await this.prisma.actionItem.findFirst({ where: { id: input.targetId, projectId: input.projectId } });
      if (!record) throw new NotFoundException('Target record not found');
      previousUpdatedAt = record.updatedAt.toISOString();
    }
    const snapshot = kind === 'REPORT_PUBLISH' ? await this.prisma.project.findMany({
      where: { organizationId: req.principal.organizationId },
      select: { id: true, name: true, status: true, health: true, client: true,
        tasks: { select: { status: true, dueDate: true } },
        risks: { select: { status: true, severity: true } },
        issues: { select: { status: true } },
        actions: { select: { status: true, dueDate: true } },
        timesheets: { select: { hours: true } } },
      orderBy: { name: 'asc' }
    }).then(projects => ({
      generatedAt: new Date().toISOString(),
      projects: projects.map(p => ({
        id: p.id, name: p.name, client: p.client, status: p.status, health: p.health,
        totalTasks: p.tasks.length, completedTasks: p.tasks.filter(t => t.status === 'DONE').length,
        progressPercent: p.tasks.length ? Math.round(p.tasks.filter(t => t.status === 'DONE').length / p.tasks.length * 100) : 0,
        overdueTasks: p.tasks.filter(t => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date()).length,
        highRisks: p.risks.filter(r => r.status !== 'CLOSED' && ['HIGH','CRITICAL'].includes(r.severity)).length,
        openRisks: p.risks.filter(r => r.status !== 'CLOSED').length,
        openIssues: p.issues.filter(i => i.status !== 'CLOSED').length,
        overdueActions: p.actions.filter(a => a.status !== 'CLOSED' && a.dueDate && a.dueDate < new Date()).length,
        approvedHours: p.timesheets.reduce((sum,t) => sum + Number(t.hours),0)
      }))
    })) : null;
    const review = await this.prisma.reviewRequest.create({
      data: {
        organizationId: req.principal.organizationId, makerId: req.principal.userId,
        kind, entityId: input.targetId || input.projectId || null,
        summary: input.summary.trim(),
        payload: { projectId: input.projectId || null, targetId: input.targetId || null,
          values: values as Prisma.InputJsonValue, snapshot, previousUpdatedAt: previousUpdatedAt || null }
      }
    });
    await this.prisma.auditEvent.create({ data: {
      organizationId: req.principal.organizationId, actorId: req.principal.userId,
      action: 'REVIEW_SUBMITTED', entityType: kind, entityId: review.id
    } });
    await notifyReviewers(this.prisma, req.principal.organizationId, req.principal.userId,
      input.summary, kind === 'REPORT_PUBLISH', kind);
    return { success: true, data: { id: review.id, kind: review.kind, status: review.status } };
  }
}
