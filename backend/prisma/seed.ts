
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Admin User
  const adminEmail = 'admin@example.com';
  const adminPassword = 'password123';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      fullName: 'System Admin',
      role: 'admin',
    },
  });

  console.log(`✅ Admin user created: ${admin.email} / ${adminPassword}`);

  // 2. Create Sales Agent
  const agentEmail = 'agent@example.com';
  const agentPassword = 'password123';
  const hashedAgentPassword = await bcrypt.hash(agentPassword, 12);

  const agent = await prisma.user.upsert({
    where: { email: agentEmail },
    update: {},
    create: {
      email: agentEmail,
      password: hashedAgentPassword,
      fullName: 'Rahul Sharma',
      role: 'sales_agent',
    },
  });

  console.log(`✅ Sales Agent created: ${agent.email} / ${agentPassword}`);

  // 3. Create Sample Project
  const project = await prisma.project.create({
    data: {
      name: 'Rama Vista Heights',
      location: 'Bandra West',
      city: 'Mumbai',
      developer: 'Rama Group',
      status: 'active',
      totalUnits: 100,
      availableUnits: 85,
      minPrice: 25000000,
      maxPrice: 45000000,
      description: 'Luxury apartments with sea view.',
      amenities: ['pool', 'gym', 'parking', 'security'],
    }
  });
  console.log(`✅ Project created: ${project.name}`);

  // 4. Create Sample Property
  const property = await prisma.property.create({
    data: {
      title: '3BHK Sea View Apartment',
      description: 'Spacious 3BHK on 15th floor',
      price: 35000000,
      status: 'available',
      propertyType: 'apartment',
      location: 'Bandra West',
      city: 'Mumbai',
      bedrooms: 3,
      bathrooms: 3,
      areaSqft: 1800,
      projectId: project.id,
    }
  });
  console.log(`✅ Property created: ${property.title}`);

  // 5. Create Sample Lead
  const lead = await prisma.lead.create({
    data: {
      name: 'Amit Patel',
      phone: '9876543210',
      email: 'amit@example.com',
      source: 'Website',
      temperature: 'hot',
      stage: 'new',
      assignedToId: agent.id,
    }
  });
  console.log(`✅ Lead created: ${lead.name}`);

  console.log('✅ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
