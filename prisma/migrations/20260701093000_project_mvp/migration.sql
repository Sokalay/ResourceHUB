CREATE TYPE "ProjectOrigin" AS ENUM ('NEW', 'EXISTING');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProjectProvisioningStatus" AS ENUM ('NOT_REQUESTED', 'MANUAL_REQUIRED', 'READY');
CREATE TYPE "ProjectOwnershipStatus" AS ENUM ('RND_ADMIN_OWNER', 'TRANSFER_REQUIRED', 'TRANSFER_VERIFIED');
CREATE TYPE "ProjectCollaboratorRole" AS ENUM ('CONTRIBUTOR', 'REVIEWER', 'VIEWER');

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "origin" "ProjectOrigin" NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "provisioning_status" "ProjectProvisioningStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "ownership_status" "ProjectOwnershipStatus" NOT NULL DEFAULT 'RND_ADMIN_OWNER',
  "repository_url" TEXT,
  "repository_name" TEXT,
  "team_id" TEXT NOT NULL,
  "lead_user_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),

  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_collaborators" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "ProjectCollaboratorRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_collaborators_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "resources" ADD COLUMN "project_id" TEXT;
ALTER TABLE "resources" ADD COLUMN "contributed_by_team_id" TEXT;

CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
CREATE INDEX "projects_team_id_idx" ON "projects"("team_id");
CREATE INDEX "projects_lead_user_id_idx" ON "projects"("lead_user_id");
CREATE INDEX "projects_origin_idx" ON "projects"("origin");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_archived_at_idx" ON "projects"("archived_at");
CREATE UNIQUE INDEX "project_collaborators_project_id_user_id_key" ON "project_collaborators"("project_id", "user_id");
CREATE INDEX "project_collaborators_user_id_idx" ON "project_collaborators"("user_id");
CREATE INDEX "resources_project_id_idx" ON "resources"("project_id");
CREATE INDEX "resources_contributed_by_team_id_idx" ON "resources"("contributed_by_team_id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_contributed_by_team_id_fkey" FOREIGN KEY ("contributed_by_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
