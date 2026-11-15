import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { HealthStatus, ProjectStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

class CreateProjectDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() client?: string;
}
class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsEnum(HealthStatus) health?: HealthStatus;
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.projects.list(req.principal.organizationId);
  }

  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    return this.projects.summary(req.principal.organizationId);
  }

  @Get(':id')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.findOne(req.principal.organizationId, id);
  }

  private assertCanEdit(req: AuthenticatedRequest) {
    if (!['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
      throw new ForbiddenException('Project edit permission required');
    }
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateProjectDto) {
    this.assertCanEdit(req);
    return this.projects.create(req.principal.organizationId, body);
  }

  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateProjectDto) {
    this.assertCanEdit(req);
    if (body.status !== undefined || body.health !== undefined) {
      throw new BadRequestException('Project status and health changes require maker-checker approval via POST /api/reviews/projects');
    }
    return this.projects.update(req.principal.organizationId, id, body);
  }
}
