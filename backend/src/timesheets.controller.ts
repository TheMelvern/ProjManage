import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from './prisma.service';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

class NewTimesheetDto {
  @IsISO8601() workDate!: string;
  @IsNumber() @Min(0.25) @Max(24) hours!: number;
  @IsOptional() @IsString() description?: string;
}

@Controller('projects/:projectId/timesheets')
@UseGuards(AuthGuard)
export class TimesheetsController {
  constructor(private readonly prisma: PrismaService, private readonly projects: ProjectsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    await this.projects.findOne(req.principal.organizationId, projectId);
    const isManager = ['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role);
    const entries = await this.prisma.timesheetEntry.findMany({
      where: { projectId, ...(isManager ? {} : { userId: req.principal.userId }) },
      orderBy: { workDate: 'desc' }, take: 200
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(entries.map(e => e.userId))] } },
      select: { id: true, name: true }
    });
    const names = new Map(users.map(u => [u.id, u.name]));
    return { success: true, data: entries.map(e => ({ ...e,
      userName: names.get(e.userId) || 'Unknown member' })) };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: NewTimesheetDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }
}
