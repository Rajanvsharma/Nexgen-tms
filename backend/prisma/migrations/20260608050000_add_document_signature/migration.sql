-- AlterTable
ALTER TABLE "Document" ADD COLUMN "signatureToken" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3),
ADD COLUMN "signerName" TEXT,
ADD COLUMN "signerEmail" TEXT,
ADD COLUMN "signatureData" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_signatureToken_key" ON "Document"("signatureToken");
