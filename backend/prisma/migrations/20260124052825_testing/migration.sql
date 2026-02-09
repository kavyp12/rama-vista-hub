-- CreateTable
CREATE TABLE "property_recommendations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "recommended_by" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "property_recommendations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "property_recommendations" ADD CONSTRAINT "property_recommendations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_recommendations" ADD CONSTRAINT "property_recommendations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_recommendations" ADD CONSTRAINT "property_recommendations_recommended_by_fkey" FOREIGN KEY ("recommended_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
