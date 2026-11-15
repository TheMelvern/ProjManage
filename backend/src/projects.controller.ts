import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { HealthStatus, ProjectStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';

class OrganizationQuery {
  @IsUUID() organizationId!: string;
}

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
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // TEMPORARY: disable mutation routes until authenticated organization
  // membership guards are implemented. Do not trust client-supplied tenant IDs.
  @Get()
  list(@Query() query: OrganizationQuery) { return this.projects.list(query.organizationId); }

  @Get('summary')
  summary(@Query() query: OrganizationQuery) { return this.projects.summary(query.organizationId); }

  @Get(':id')
  detail(@Query() query: OrganizationQuery, @Param('id') id: string) {
    return this.projects.findOne(query.organizationId, id);
  }
}
