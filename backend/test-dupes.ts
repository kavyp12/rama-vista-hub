const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const leadsCount = await prisma.lead.count();
  console.log('Total Leads:', leadsCount);
  
  const dupes = await prisma.lead.groupBy({
    by: ['phone'],
    having: { phone: { _count: { gt: 1 } } },
    _count: { phone: true }
  });
  console.log('Duplicate Phones:', dupes);

  const callsCount = await prisma.callLog.count();
  console.log('Total Calls:', callsCount);

  // Lets get the one of the duplicate phones and see how many calls it has
  if (dupes.length > 0) {
    const dupPhone = dupes[0].phone;
    const records = await prisma.lead.findMany({
      where: { phone: dupPhone },
      include: { _count: { select: { callLogs: true } }, assignedTo: true }
    });
    console.log('Records for', dupPhone, JSON.stringify(records, null, 2));
  }
}
main().finally(() => prisma.$disconnect());
