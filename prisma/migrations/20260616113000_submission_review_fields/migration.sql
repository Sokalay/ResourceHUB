-- CreateEnum
CREATE TYPE "StorageHandling" AS ENUM ('STANDARD_LOCAL', 'ORGANIZATION_INTERNAL', 'RESTRICTED_LOCAL', 'EXTERNAL_REFERENCE_ONLY');

-- AlterTable
ALTER TABLE "resources"
ADD COLUMN "staging_storage_location" TEXT,
ADD COLUMN "source_access_granted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "source_access_instructions" TEXT,
ADD COLUMN "storage_handling" "StorageHandling" NOT NULL DEFAULT 'STANDARD_LOCAL',
ADD COLUMN "storage_decision_notes" TEXT;

-- CreateIndex
CREATE INDEX "resources_storage_handling_idx" ON "resources"("storage_handling");
