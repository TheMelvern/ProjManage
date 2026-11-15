-- Maker/checker review requests and pending signup requests
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "makerId" TEXT,
    "checkerId" TEXT,
    "kind" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewRequest_organizationId_status_createdAt_idx" ON "ReviewRequest"("organizationId","status","createdAt");
CREATE INDEX "ReviewRequest_makerId_createdAt_idx" ON "ReviewRequest"("makerId","createdAt");
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
