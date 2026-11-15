import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { NotFoundException } from '@nestjs/common';

class CreateTaskDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
}
class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

@Controller('projects/:projectId/tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly prisma: PrismaService, private readonly projects: ProjectsService) {}

  private assertEditor(req: AuthenticatedRequest) {
    if (!['ADMIN', 'PMO', 'PROJECT_MANAGER'].includes(req.principal.role)) {
      throw new ForbiddenException('Task edit permission required');
    }
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    await this.projects.findOne(req.principal.organizationId, projectId);
    return { success: true, data: await this.prisma.task.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }) };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: CreateTaskDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }

  @Patch(':id')
  async update(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string,
    @Param('id') id: string, @Body() body: UpdateTaskDto) {
    throw new ForbiddenException('Changes must be submitted as an independent maker-checker review');
  }
}
