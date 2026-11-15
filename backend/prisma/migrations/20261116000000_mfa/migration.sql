ALTER TABLE "User" ADD COLUMN "mfaCiphertext" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaPendingCiphertext" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaPendingCreatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaLastStep" INTEGER;

CREATE TABLE "MfaChallenge" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");
CREATE INDEX "MfaChallenge_userId_expiresAt_idx" ON "MfaChallenge"("userId","expiresAt");
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "codeHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");
CREATE INDEX "MfaRecoveryCode_userId_consumedAt_idx" ON "MfaRecoveryCode"("userId","consumedAt");
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
