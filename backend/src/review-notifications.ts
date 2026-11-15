import { PrismaService } from './prisma.service';

/**
 * In-app notification fanout. Only actual organization members can receive events.
 * Failure to deliver an in-app notification must not grant, bypass or reverse approval.
 */
export async function notifyReviewers(
  prisma: PrismaService,
  organizationId: string,
  makerId: string | null,
  summary: string,
  adminOnly = false
) {
  const reviewers = await prisma.membership.findMany({
    where: {
      organizationId,
      role: { in: adminOnly ? ['ADMIN'] : ['ADMIN', 'PMO', 'PROJECT_MANAGER'] },
      ...(makerId ? { userId: { not: makerId } } : {})
    },
    select: { userId: true }
  });
  if (!reviewers.length) return 0;
  const result = await prisma.notification.createMany({ data: reviewers.map(({ userId }) => ({
    organizationId, recipientId: userId,
    kind: 'REVIEW_PENDING', title: 'New approval request',
    body: summary.slice(0, 350), link: '/approvals'
  })) });
  return result.count;
}
