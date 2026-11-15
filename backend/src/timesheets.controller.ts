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
    return { success: true, data: await this.prisma.timesheetEntry.findMany({
      where: { projectId, ...(isManager ? {} : { userId: req.principal.userId }) },
      orderBy: { workDate: 'desc' }, take: 200
    }) };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: NewTimesheetDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }
}
