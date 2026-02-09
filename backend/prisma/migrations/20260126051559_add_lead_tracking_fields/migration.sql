-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_contacted_at" TIMESTAMP(3),
ADD COLUMN     "lead_score" INTEGER DEFAULT 0;
