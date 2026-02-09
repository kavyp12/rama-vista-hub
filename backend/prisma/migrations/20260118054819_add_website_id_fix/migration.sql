/*
  Warnings:

  - A unique constraint covering the columns `[website_id]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "website_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_website_id_key" ON "projects"("website_id");
