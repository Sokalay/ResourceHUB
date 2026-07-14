-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DATASET', 'CODE', 'MODEL', 'DOCUMENT', 'ANNOTATION', 'NOTEBOOK', 'REPORT', 'APPLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'TRANSFERRING', 'STORED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('UPLOAD', 'EXTERNAL_LINK', 'GOOGLE_DRIVE_LINK', 'GITHUB_LINK', 'HUGGINGFACE_LINK', 'SERVER_PATH', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "resource_type" "ResourceType" NOT NULL,
    "classification" "Classification" NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "current_working_location" TEXT,
    "official_storage_location" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_versions" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_name" TEXT NOT NULL,
    "description" TEXT,
    "storage_path" TEXT NOT NULL,
    "checksum" TEXT,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "total_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_files" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_jobs" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "version_id" TEXT,
    "source_type" "SourceType" NOT NULL,
    "source_location" TEXT NOT NULL,
    "destination_location" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_by_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_team_id_key" ON "team_members"("user_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "resources_slug_key" ON "resources"("slug");

-- CreateIndex
CREATE INDEX "resources_team_id_idx" ON "resources"("team_id");

-- CreateIndex
CREATE INDEX "resources_created_by_id_idx" ON "resources"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_versions_resource_id_version_number_key" ON "resource_versions"("resource_id", "version_number");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "resource_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_jobs" ADD CONSTRAINT "transfer_jobs_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_jobs" ADD CONSTRAINT "transfer_jobs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "resource_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_jobs" ADD CONSTRAINT "transfer_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
