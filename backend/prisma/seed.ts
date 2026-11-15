import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const orgName = process.env.BOOTSTRAP_ORGANIZATION_NAME || 'PMO Development';
  if (!email || !password || password.length < 12) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (minimum 12 characters)');
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hash(password, 12) },
    create: { email, name: 'PMO Administrator', passwordHash: await hash(password, 12) }
  });
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id }, include: { organization: true }
  });
  if (!existing) {
    const org = await prisma.organization.create({ data: { name: orgName } });
    await prisma.membership.create({
      data: { organizationId: org.id, userId: user.id, role: 'ADMIN' }
    });
  }
  // The first two administrators are provisioned through explicit local bootstrap credentials.
  // The running API never bypasses the independent-checker review requirement.
  const reviewerEmail = process.env.BOOTSTRAP_REVIEWER_EMAIL?.trim().toLowerCase();
  const reviewerPassword = process.env.BOOTSTRAP_REVIEWER_PASSWORD;
  if (reviewerEmail || reviewerPassword) {
    if (!reviewerEmail || !reviewerPassword || reviewerPassword.length < 12 || reviewerEmail === email) {
      throw new Error('Set a distinct BOOTSTRAP_REVIEWER_EMAIL and a password of at least 12 characters');
    }
    const targetOrg = existing?.organization || await prisma.membership.findFirst({
      where: { userId: user.id }, include: { organization: true }
    }).then(m => m?.organization);
    if (!targetOrg) throw new Error('Bootstrap organization not found');
    const reviewer = await prisma.user.upsert({
      where: { email: reviewerEmail },
      update: {},
      create: { email: reviewerEmail, name: 'PMO Independent Administrator',
        passwordHash: await hash(reviewerPassword, 12) }
    });
    const reviewerMembership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: targetOrg.id, userId: reviewer.id } }
    });
    if (!reviewerMembership) {
      await prisma.membership.create({
        data: { organizationId: targetOrg.id, userId: reviewer.id, role: 'ADMIN' }
      });
    } else if (reviewerMembership.role !== 'ADMIN') {
      throw new Error('Reviewer has an existing non-admin membership; change it through maker-checker approval');
    }
  }
  console.log('Bootstrap users prepared; credentials are not printed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
