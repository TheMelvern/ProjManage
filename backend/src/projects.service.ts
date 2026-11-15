import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProjectStatus, HealthStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { updatedAt: 'desc' }
    });
    return { success: true, data: projects };
  }

  async findOne(organizationId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: { tasks: { orderBy: { createdAt: 'asc' } } }
    });
    if (!project) throw new NotFoundException('Project not found');
    return { success: true, data: project };
  }

  async create(organizationId: string, data: { name: string; description?: string; client?: string }) {
    const project = await this.prisma.project.create({
      data: { ...data, organization: { connect: { id: organizationId } } }
    });
    return { success: true, data: project };
  }

  async update(organizationId: string, id: string, data: { name?: string; description?: string; client?: string; status?: ProjectStatus; health?: HealthStatus }) {
    await this.findOne(organizationId, id);
    const project = await this.prisma.project.update({ where: { id }, data });
    return { success: true, data: project };
  }

  async summary(organizationId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId }, select: { status: true, health: true }
    });
    return {
      success: true,
      data: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'ACTIVE').length,
        atRiskProjects: projects.filter(p => p.health === 'AMBER' || p.health === 'RED').length,
        completedProjects: projects.filter(p => p.status === 'COMPLETED').length
      }
    };
  }
}
