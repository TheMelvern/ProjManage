import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import type { PrismaService } from './prisma.service';

export async function assertReturnedRequest(
  prisma: PrismaService,
  principal: AuthenticatedRequest['principal'],
  id: string,
  kind: 'PROJECT_CREATE' | 'LEAVE_REQUEST',
) {
  const original = await prisma.reviewRequest.findFirst({
    where: { id, organizationId: principal.organizationId, makerId: principal.userId, kind, status: 'RETURNED' },
    select: { id: true },
  });
  if (!original) throw new BadRequestException('This returned request is unavailable for revision');
}
