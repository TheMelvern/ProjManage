CREATE TABLE "OrganizationParameter" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationParameter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationParameter_organizationId_key_key" ON "OrganizationParameter"("organizationId","key");
ALTER TABLE "OrganizationParameter" ADD CONSTRAINT "OrganizationParameter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
