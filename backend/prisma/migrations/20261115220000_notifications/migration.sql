CREATE TABLE "Notification" (
"id" TEXT NOT NULL,
"organizationId" TEXT NOT NULL,
"recipientId" TEXT NOT NULL,
"kind" TEXT NOT NULL,
"title" TEXT NOT NULL,
"body" TEXT NOT NULL,
"link" TEXT,
"readAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_organizationId_recipientId_createdAt_idx" ON "Notification"("organizationId","recipientId","createdAt");
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId","readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
