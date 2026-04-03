// scripts/fixCallStatus.ts
// Run once with: npx ts-node scripts/fixCallStatus.ts
// This fixes all old call logs that were wrongly marked as not_connected

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding wrongly marked call logs...');

  // ── FIX 1: Has callDuration > 0 but marked as not_connected ──
  // A call with real duration cannot be missed
  const durationFix = await prisma.callLog.updateMany({
    where: {
      callStatus: 'not_connected',
      callDuration: {
        gt: 0,  // duration > 0 means the call was answered
      },
    },
    data: {
      callStatus: 'connected_positive',
    },
  });

  console.log(`✅ Fixed ${durationFix.count} records with duration > 0 but marked as missed`);

  // ── FIX 2: Has a real recording filename in notes but marked as not_connected ──
  // A missed call cannot have a recording
  // We look for notes containing "Recording:" but NOT "Recording: None" or "Recording: N/A"
  const allWronglyMissed = await prisma.callLog.findMany({
    where: {
      callStatus: 'not_connected',
      notes: {
        contains: 'Recording:',
      },
    },
    select: {
      id: true,
      notes: true,
      callDuration: true,
    },
  });

  // Filter in JS — Prisma can't do NOT LIKE on multiple values cleanly
  const toFix = allWronglyMissed.filter(log => {
    const notes = log.notes || '';
    const match = notes.match(/Recording:\s*([^\s|]+)/i);
    if (!match) return false;
    const val = match[1].trim().toLowerCase();
    // Skip if recording is None/N/A/empty
    return val && val !== 'none' && val !== 'n/a' && val !== '';
  });

  if (toFix.length > 0) {
    const ids = toFix.map(l => l.id);
    const recordingFix = await prisma.callLog.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        callStatus: 'connected_positive',
      },
    });
    console.log(`✅ Fixed ${recordingFix.count} records with recording but marked as missed`);
  } else {
    console.log('ℹ️  No recording-based fixes needed');
  }

  console.log('\n🎉 Done! All old bad call statuses have been corrected.');

  // ── Print summary ──
  const finalStats = await prisma.callLog.groupBy({
    by: ['callStatus'],
    _count: true,
  });
  console.log('\n📊 Final DB Status Counts:');
  finalStats.forEach(s => console.log(`   ${s.callStatus}: ${s._count}`));
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());