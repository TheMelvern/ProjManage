import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { PrismaService } from './prisma.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const where = { organizationId: req.principal.organizationId, recipientId: req.principal.userId };
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { ...where, readAt: null } })
    ]);
    return { success: true, data: { items: rows, unread } };
  }

  @Patch('read-all')
  async readAll(@Req() req: AuthenticatedRequest) {
    const result = await this.prisma.notification.updateMany({
      where: { organizationId: req.principal.organizationId,
        recipientId: req.principal.userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { success: true, data: { updated: result.count } };
  }

  @Patch(':id/read')
  async markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, organizationId: req.principal.organizationId, recipientId: req.principal.userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { success: true, data: { updated: result.count } };
  }
}
