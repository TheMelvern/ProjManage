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
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Patch('risks/:id')
  async patchRisk(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: RegisterPatchDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Post('issues')
  async createIssue(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: RegisterDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Patch('issues/:id')
  async patchIssue(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: RegisterPatchDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Post('decisions')
  async createDecision(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: DecisionDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Post('actions')
  async createAction(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: ActionDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Patch('actions/:id')
  async patchAction(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: ActionPatchDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }
}
