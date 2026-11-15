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
  console.log('Bootstrap user prepared; credentials are not printed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
