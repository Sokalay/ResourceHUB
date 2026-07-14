-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('TEAM_ONLY', 'ORGANIZATION', 'VISITOR', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('RESOURCE_STORAGE', 'VISIBILITY_VISITOR', 'VISIBILITY_PUBLIC');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "resources"
ADD COLUMN "visibility" "ResourceVisibility" NOT NULL DEFAULT 'TEAM_ONLY',
ADD COLUMN "pending_visibility" "ResourceVisibility",
ADD COLUMN "team_approved_at" TIMESTAMP(3),
ADD COLUMN "team_approved_by_id" TEXT,
ADD COLUMN "admin_approved_at" TIMESTAMP(3),
ADD COLUMN "admin_approved_by_id" TEXT;

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requested_visibility" "ResourceVisibility",
    "note" TEXT,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_resource_id_idx" ON "approval_requests"("resource_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_type_idx" ON "approval_requests"("type");

-- CreateIndex
CREATE INDEX "resources_visibility_idx" ON "resources"("visibility");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
