// deleteAll.ts
// Place this file in your CRM backend folder (e.g., crm-backend/src/scripts/)
// Run with: npx ts-node src/scripts/deleteAll.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllData() {
  try {
    console.log('🗑️  Starting deletion...');

    // Delete all properties first (they reference projects)
    const deletedProperties = await prisma.property.deleteMany({});
    console.log(`✅ Deleted ${deletedProperties.count} properties`);

    // Delete all projects
    const deletedProjects = await prisma.project.deleteMany({});
    console.log(`✅ Deleted ${deletedProjects.count} projects`);

    console.log('🎉 All done! Database cleaned.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllData();