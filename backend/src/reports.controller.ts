import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProjectsService } from './projects.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService, private readonly projects: ProjectsService) {}

  @Get('published')
  async published(@Req() req: AuthenticatedRequest) {
    const released = await this.prisma.reviewRequest.findMany({
      where: { organizationId: req.principal.organizationId, kind: 'REPORT_PUBLISH', status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' }, take: 30
    });
    return { success: true, data: released.map(item => {
      const payload = item.payload as Record<string, unknown>;
      return { id: item.id, createdAt: item.createdAt, reviewedAt: item.reviewedAt,
        makerId: item.makerId, checkerId: item.checkerId, summary: item.summary,
        snapshot: payload.snapshot };
    }) };
  }

  @Get('portfolio')
  async portfolio(@Req() req: AuthenticatedRequest) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: req.principal.organizationId },
      include: { tasks: true, risks: true, issues: true, actions: true }, orderBy: { name: 'asc' }
    });
    const parameter = await this.prisma.organizationParameter.findUnique({
      where: { organizationId_key: { organizationId: req.principal.organizationId,
        key: 'riskEscalationThreshold' } }
    });
    const threshold = String(parameter?.value || 'HIGH');
    const critical = threshold === 'CRITICAL' ? ['CRITICAL'] :
      threshold === 'MEDIUM' ? ['MEDIUM','HIGH','CRITICAL'] :
      threshold === 'LOW' ? ['LOW','MEDIUM','HIGH','CRITICAL'] : ['HIGH','CRITICAL'];
    const now = new Date();
    const isOverdue = (task: { status: string; dueDate: Date | null }) =>
      task.status !== 'DONE' && !!task.dueDate && task.dueDate < now;
    const tasks = projects.flatMap((p) => p.tasks);
    const risks = projects.flatMap((p) => p.risks);
    const issues = projects.flatMap((p) => p.issues);
    const actions = projects.flatMap((p) => p.actions);
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
        overdueTasks: tasks.filter(isOverdue).length,
        openRisks: risks.filter((r) => r.status !== 'CLOSED').length,
        highRisks: risks.filter((r) => r.status !== 'CLOSED' && (r.severity === 'HIGH' || r.severity === 'CRITICAL')).length,
        openIssues: issues.filter((i) => i.status !== 'CLOSED').length,
        overdueActions: actions.filter((a) => a.status !== 'CLOSED' && a.dueDate && a.dueDate < now).length
      },
      projects: projects.map((p) => ({
        id: p.id, name: p.name, client: p.client, status: p.status, health: p.health,
        totalTasks: p.tasks.length,
        completedTasks: p.tasks.filter((t) => t.status === 'DONE').length,
        overdueTasks: p.tasks.filter(isOverdue).length,
        openRisks: p.risks.filter((r) => r.status !== 'CLOSED').length,
        highRisks: p.risks.filter((r) => r.status !== 'CLOSED' && (r.severity === 'HIGH' || r.severity === 'CRITICAL')).length,
        openIssues: p.issues.filter((i) => i.status !== 'CLOSED').length,
        overdueActions: p.actions.filter((a) => a.status !== 'CLOSED' && a.dueDate && a.dueDate < now).length,
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
