ALTER TABLE "teams" ADD COLUMN "archived_at" TIMESTAMP(3);
DROP INDEX IF EXISTS "teams_name_key";
CREATE UNIQUE INDEX "teams_active_name_key" ON "teams"(LOWER("name")) WHERE "archived_at" IS NULL;
