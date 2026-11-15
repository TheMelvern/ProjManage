import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { RegisterStatus, Severity } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

class RegisterDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Severity) severity?: Severity;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() mitigation?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsISO8601() targetDate?: string;
}
class RegisterPatchDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Severity) severity?: Severity;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsEnum(RegisterStatus) status?: RegisterStatus;
  @IsOptional() @IsString() mitigation?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsISO8601() targetDate?: string;
}
class DecisionDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() rationale?: string;
  @IsOptional() @IsString() decidedBy?: string;
}
class ActionDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
}
class ActionPatchDto {
  @IsOptional() @IsEnum(RegisterStatus) status?: RegisterStatus;
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() ownerName?: string;
}

@Controller('projects/:projectId/raid')
@UseGuards(AuthGuard)
export class RaidController {
  constructor(private readonly prisma: PrismaService, private readonly projects: ProjectsService) {}

  private async authorize(req: AuthenticatedRequest, projectId: string, write = false) {
    await this.projects.findOne(req.principal.organizationId, projectId);
    if (write && !['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
      throw new ForbiddenException('RAID editing permission required');
    }
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    await this.authorize(req, projectId);
    const [risks, issues, decisions, actions] = await Promise.all([
      this.prisma.risk.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.issue.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.decision.findMany({ where: { projectId }, orderBy: { decidedAt: 'desc' } }),
      this.prisma.actionItem.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
    ]);
    return { success: true, data: { risks, issues, decisions, actions } };
  }

  @Post('risks')
  async createRisk(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: RegisterDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const risk = await this.prisma.risk.create({
      data: { projectId, title: body.title, description: body.description, severity: body.severity,
        mitigation: body.mitigation, ownerName: body.ownerName,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined }
    });
    return { success: true, data: risk };
  }

  @Patch('risks/:id')
  async patchRisk(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: RegisterPatchDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const existing = await this.prisma.risk.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Risk not found');
    const risk = await this.prisma.risk.update({ where: { id }, data: {
      title: body.title, description: body.description, severity: body.severity,
      status: body.status, mitigation: body.mitigation, ownerName: body.ownerName,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined
    } });
    return { success: true, data: risk };
  }

  @Post('issues')
  async createIssue(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: RegisterDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const issue = await this.prisma.issue.create({
      data: { projectId, title: body.title, description: body.description, severity: body.severity,
        resolution: body.resolution, ownerName: body.ownerName,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined }
    });
    return { success: true, data: issue };
  }

  @Patch('issues/:id')
  async patchIssue(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: RegisterPatchDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const existing = await this.prisma.issue.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Issue not found');
    const issue = await this.prisma.issue.update({ where: { id }, data: {
      title: body.title, description: body.description, severity: body.severity,
      status: body.status, resolution: body.resolution, ownerName: body.ownerName,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined
    } });
    return { success: true, data: issue };
  }

  @Post('decisions')
  async createDecision(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: DecisionDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const decision = await this.prisma.decision.create({ data: { projectId, title: body.title,
      rationale: body.rationale, decidedBy: body.decidedBy } });
    return { success: true, data: decision };
  }

  @Post('actions')
  async createAction(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: ActionDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const action = await this.prisma.actionItem.create({
      data: { projectId, title: body.title, ownerName: body.ownerName,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined }
    });
    return { success: true, data: action };
  }

  @Patch('actions/:id')
  async patchAction(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: ActionPatchDto) {
    throw new ForbiddenException('RAID changes require an independent maker-checker proposal');
    await this.authorize(req, projectId, true);
    const existing = await this.prisma.actionItem.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Action not found');
    const action = await this.prisma.actionItem.update({ where: { id }, data: body });
    return { success: true, data: action };
  }
}
