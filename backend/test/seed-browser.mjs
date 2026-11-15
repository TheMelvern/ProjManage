import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
const db=new PrismaClient();
try {
  const org=await db.organization.findFirst({where:{name:'PMO Development'}});
  if(!org) throw new Error('Seeded organization not found');
  const email='checker@pmo.test';
  const user=await db.user.upsert({where:{email},
    create:{email,name:'Independent Browser Checker',emailVerifiedAt:new Date(),passwordHash:await bcryptjs.hash('checker-test-password-123',12)},
    update:{passwordHash:await bcryptjs.hash('checker-test-password-123',12)}});
  await db.membership.upsert({
    where:{organizationId_userId:{organizationId:org.id,userId:user.id}},
    create:{organizationId:org.id,userId:user.id,role:'ADMIN'},
    update:{role:'ADMIN'}
  });
  const project=await db.project.create({data:{
    organizationId:org.id,name:'E2E Delivery Project',client:'Browser test customer',status:'ACTIVE',health:'GREEN'
  }});
  await db.task.create({data:{projectId:project.id,title:'E2E Delivery Task',status:'TODO'}});
  console.log('Browser fixture seeded with project ID '+project.id);
} finally {await db.$disconnect();}
