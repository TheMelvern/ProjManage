ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Task" ADD COLUMN "dependsOnId" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_dependsOnId_idx" ON "Task"("dependsOnId");
