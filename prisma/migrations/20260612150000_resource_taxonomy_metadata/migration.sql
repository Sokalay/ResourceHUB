CREATE TYPE "SourceProvider" AS ENUM ('DIRECT_UPLOAD', 'GOOGLE_DRIVE', 'GITHUB', 'HUGGINGFACE', 'SERVER_PATH', 'S3', 'GCS', 'MINIO', 'MANUAL', 'OTHER');
CREATE TYPE "SourceKind" AS ENUM ('FILE', 'FOLDER', 'REPOSITORY', 'MODEL_REPOSITORY', 'DATASET_REPOSITORY', 'SPACE_REPOSITORY', 'NOTEBOOK', 'ARCHIVE', 'DATABASE_DUMP', 'API_ENDPOINT', 'OTHER');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'MINIO', 'S3', 'GCS', 'GOOGLE_DRIVE', 'GITHUB', 'HUGGINGFACE', 'INTERNAL_SERVER', 'OTHER');

CREATE TABLE "resource_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parent_id" TEXT,
  "level" INTEGER NOT NULL,
  "sort_order" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_tags" (
  "id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_tags_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "resources" ADD COLUMN "primary_category_id" TEXT;
ALTER TABLE "resources" ADD COLUMN "source_provider" "SourceProvider" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "resources" ADD COLUMN "source_kind" "SourceKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "resources" ADD COLUMN "source_url" TEXT;
ALTER TABLE "resources" ADD COLUMN "storage_provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "resources" ADD COLUMN "metadata_json" JSONB;

UPDATE "resources"
SET "source_provider" = CASE
  WHEN "official_storage_location" IS NOT NULL THEN 'DIRECT_UPLOAD'::"SourceProvider"
  WHEN "current_working_location" ILIKE '%github.com%' THEN 'GITHUB'::"SourceProvider"
  WHEN "current_working_location" ILIKE '%huggingface.co%' THEN 'HUGGINGFACE'::"SourceProvider"
  WHEN "current_working_location" ILIKE '%drive.google.com%' THEN 'GOOGLE_DRIVE'::"SourceProvider"
  WHEN "current_working_location" IS NOT NULL THEN 'MANUAL'::"SourceProvider"
  ELSE 'MANUAL'::"SourceProvider"
END,
"source_kind" = CASE
  WHEN "official_storage_location" IS NOT NULL THEN 'FILE'::"SourceKind"
  WHEN "current_working_location" ILIKE '%github.com%' THEN 'REPOSITORY'::"SourceKind"
  WHEN "current_working_location" ILIKE '%huggingface.co%' THEN 'DATASET_REPOSITORY'::"SourceKind"
  ELSE 'OTHER'::"SourceKind"
END,
"source_url" = "current_working_location"
WHERE "source_url" IS NULL;

CREATE UNIQUE INDEX "resource_categories_parent_id_name_key" ON "resource_categories"("parent_id", "name");
CREATE UNIQUE INDEX "resource_categories_parent_id_slug_key" ON "resource_categories"("parent_id", "slug");
CREATE INDEX "resource_categories_parent_id_idx" ON "resource_categories"("parent_id");
CREATE INDEX "resource_categories_level_idx" ON "resource_categories"("level");
CREATE INDEX "resource_categories_slug_idx" ON "resource_categories"("slug");
CREATE INDEX "resource_categories_archived_at_idx" ON "resource_categories"("archived_at");
CREATE UNIQUE INDEX "resource_tags_resource_id_name_key" ON "resource_tags"("resource_id", "name");
CREATE INDEX "resource_tags_resource_id_idx" ON "resource_tags"("resource_id");
CREATE INDEX "resource_tags_name_idx" ON "resource_tags"("name");
CREATE INDEX "resources_resource_type_idx" ON "resources"("resource_type");
CREATE INDEX "resources_primary_category_id_idx" ON "resources"("primary_category_id");
CREATE INDEX "resources_source_provider_idx" ON "resources"("source_provider");
CREATE INDEX "resources_source_kind_idx" ON "resources"("source_kind");
CREATE INDEX "resources_storage_provider_idx" ON "resources"("storage_provider");
CREATE INDEX "resources_status_idx" ON "resources"("status");
CREATE INDEX "resources_classification_idx" ON "resources"("classification");
CREATE INDEX "resources_owner_user_id_idx" ON "resources"("owner_user_id");
CREATE INDEX "resources_created_at_idx" ON "resources"("created_at");
CREATE INDEX "resources_updated_at_idx" ON "resources"("updated_at");

ALTER TABLE "resource_categories" ADD CONSTRAINT "resource_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "resource_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_primary_category_id_fkey" FOREIGN KEY ("primary_category_id") REFERENCES "resource_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
