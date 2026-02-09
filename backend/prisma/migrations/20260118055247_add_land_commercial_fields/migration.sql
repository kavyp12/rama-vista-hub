-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'residential',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "plot_area" DOUBLE PRECISION,
ADD COLUMN     "property_type" TEXT,
ADD COLUMN     "survey_number" TEXT,
ADD COLUMN     "taluka" TEXT,
ADD COLUMN     "transaction_type" TEXT,
ADD COLUMN     "village" TEXT;
