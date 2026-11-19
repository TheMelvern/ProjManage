import { PrismaService } from './prisma.service';

/** Return the module-owned approval tab for a review category. */
export function reviewApprovalPath(kind?: string, requestId?: string): string {
  const path = reviewQueuePath(kind);
  return requestId ? path + '/' + encodeURIComponent(requestId) : path;
}

function reviewQueuePath(kind?: string): string {
  if (!kind) return '/projects/approvals';
  if (['REGISTRATION','PARAMETER_UPDATE','MEMBERSHIP_UPDATE'].includes(kind)) return '/admin/approvals';
  if (kind === 'LEAVE_REQUEST') return '/leave/approvals';
  if (kind === 'TIMESHEET_CREATE') return '/timesheets/approvals';
  if (kind === 'REPORT_PUBLISH') return '/reports/approvals';
  if (/^(RISK|ISSUE|DECISION|ACTION)_/.test(kind)) return '/raid/approvals';
  return '/projects/approvals';
}

/**
 * In-app notification fanout. Only actual organization members can receive events.
 * Failure to deliver an in-app notification must not grant, bypass or reverse approval.
 */
export async function notifyReviewers(
  prisma: PrismaService,
  organizationId: string,
  makerId: string | null,
  summary: string,
  adminOnly = false,
  kind?: string,
  requestId?: string
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
    body: summary.slice(0, 350), link: reviewApprovalPath(kind, requestId)
  })) });
  return result.count;
}
