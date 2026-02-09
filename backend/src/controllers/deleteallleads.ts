
import { prisma } from '../utils/prisma';

async function deleteAllLeads() {
  try {
    console.log('🗑️  Starting lead deletion...');

    // Delete related records first (due to foreign key constraints)
    
    // 1. Delete Property Recommendations
    const deletedRecommendations = await prisma.propertyRecommendation.deleteMany({});
    console.log(`✅ Deleted ${deletedRecommendations.count} property recommendations`);

    // 2. Delete Follow-up Tasks
    const deletedTasks = await prisma.followUpTask.deleteMany({});
    console.log(`✅ Deleted ${deletedTasks.count} follow-up tasks`);

    // 3. Delete Call Logs
    const deletedCalls = await prisma.callLog.deleteMany({});
    console.log(`✅ Deleted ${deletedCalls.count} call logs`);

    // 4. Delete Site Visits
    const deletedVisits = await prisma.siteVisit.deleteMany({});
    console.log(`✅ Deleted ${deletedVisits.count} site visits`);

    // 5. Delete Documents
    const deletedDocs = await prisma.document.deleteMany({
      where: { leadId: { not: null } }
    });
    console.log(`✅ Deleted ${deletedDocs.count} documents`);

    // 6. Delete Payments
    const deletedPayments = await prisma.payment.deleteMany({
      where: { leadId: { not: null } }
    });
    console.log(`✅ Deleted ${deletedPayments.count} payments`);

    // 7. Delete Deals
    const deletedDeals = await prisma.deal.deleteMany({});
    console.log(`✅ Deleted ${deletedDeals.count} deals`);

    // 8. Finally, Delete Leads
    const deletedLeads = await prisma.lead.deleteMany({});
    console.log(`✅ Deleted ${deletedLeads.count} leads`);

    console.log('\n🎉 All leads and related data deleted successfully!');
    
  } catch (error) {
    console.error('❌ Error deleting leads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllLeads();