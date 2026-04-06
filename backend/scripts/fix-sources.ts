import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fixing old website leads...');

  const result = await prisma.lead.updateMany({
    where: {
      source: {
        // 👇 All your specific website form names are included here
        in: [
          'Vastu Calculator',
          'Project Details Contact Form',
          'Filter Page Form',
          'Floor Plan Modal',
          'Land Details Contact Form',
          'Commercial - Dealer - Self Use',
          'Website Import' 
        ]
      }
    },
    data: {
      source: 'Website'
    }
  });

  console.log(`✅ Successfully changed ${result.count} old leads to 'Website'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
