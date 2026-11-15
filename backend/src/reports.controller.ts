import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService, private readonly projects: ProjectsService) {}

  @Get('portfolio')
  async portfolio(@Req() req: AuthenticatedRequest) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: req.principal.organizationId },
      include: { tasks: true }, orderBy: { name: 'asc' }
    });
    const now = new Date();
    const isOverdue = (task: { status: string; dueDate: Date | null }) =>
      task.status !== 'DONE' && !!task.dueDate && task.dueDate < now;
    const tasks = projects.flatMap((p) => p.tasks);
    const data = {
      generatedAt: now.toISOString(),
      organizationId: req.principal.organizationId,
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === 'ACTIVE').length,
        atRiskProjects: projects.filter((p) => p.health === 'RED' || p.health === 'AMBER').length,
        completedProjects: projects.filter((p) => p.status === 'COMPLETED').length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'DONE').length,
        overdueTasks: tasks.filter(isOverdue).length
      },
      projects: projects.map((p) => ({
        id: p.id, name: p.name, client: p.client, status: p.status, health: p.health,
        totalTasks: p.tasks.length,
        completedTasks: p.tasks.filter((t) => t.status === 'DONE').length,
        overdueTasks: p.tasks.filter(isOverdue).length,
        progressPercent: p.tasks.length
          ? Math.round((p.tasks.filter((t) => t.status === 'DONE').length / p.tasks.length) * 100)
          : 0
      }))
    };
    return { success: true, data };
  }

  @Get('projects/:id')
  async project(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.projects.findOne(req.principal.organizationId, id);
    const p = result.data;
    const now = new Date();
    const complete = p.tasks.filter((t) => t.status === 'DONE').length;
    const overdue = p.tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < now);
    return {
      success: true,
      data: {
        generatedAt: now.toISOString(), projectId: p.id, name: p.name,
        client: p.client, status: p.status, health: p.health,
        progressPercent: p.tasks.length ? Math.round(complete / p.tasks.length * 100) : 0,
        taskCounts: { total: p.tasks.length, completed: complete, overdue: overdue.length },
        overdueTasks: overdue.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate }))
      }
    };
  }
}
