// File: backend/src/scripts/resetProjects.ts
// Run this manually: npx ts-node src/scripts/resetProjects.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetProjects() {
  try {
    console.log('🗑️  Deleting all projects...');
    
    // Delete in order to avoid foreign key errors
    await prisma.siteVisit.deleteMany({});
    console.log('   ✅ Deleted site visits');
    
    await prisma.property.deleteMany({});
    console.log('   ✅ Deleted properties');
    
    await prisma.project.deleteMany({});
    console.log('   ✅ Deleted projects');
    
    console.log('✅ Database reset complete!');
    console.log('');
    console.log('Now run the import from your CRM dashboard.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetProjects();