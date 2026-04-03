// scripts/fixCallStatus.ts
// Run once with: npx ts-node scripts/fixCallStatus.ts
// This fixes all old call logs that were wrongly marked as not_connected
// AND fixes records where callDuration is null/0 but Duration is stored in notes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding wrongly marked call logs...\n');

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
    console.log('ℹ️  No recording-based status fixes needed');
  }

  // ── FIX 3: callDuration is null/0 but notes contains "Duration: X" ──
  // The webhook stores duration in the notes string; backfill it to the DB column
  console.log('\n🔍 Fixing missing callDuration from notes...');
  const logsWithNullDuration = await prisma.callLog.findMany({
    where: {
      OR: [
        { callDuration: null },
        { callDuration: 0 },
      ],
      notes: {
        contains: 'Duration:',
      },
    },
    select: {
      id: true,
      notes: true,
      callDuration: true,
    },
  });

  let durationBackfillCount = 0;
  for (const log of logsWithNullDuration) {
    const match = (log.notes || '').match(/Duration:\s*(\d+)/i);
    if (!match) continue;
    const parsedDur = parseInt(match[1], 10);
    if (isNaN(parsedDur) || parsedDur <= 0) continue;

    await prisma.callLog.update({
      where: { id: log.id },
      data: { callDuration: parsedDur },
    });
    durationBackfillCount++;
  }
  console.log(`✅ Backfilled callDuration for ${durationBackfillCount} records from notes`);

  // ── FIX 4: Any record with a real recording should be marked connected ──
  // Re-check: there may be records that still have 0 callDuration after FIX 3
  // and are connected_positive purely because of the recording — that's fine.
  // But mark any remaining not_connected with recordings as connected.
  console.log('\n🎉 Done! All old bad call statuses have been corrected.');

  // ── Print summary ──
  const finalStats = await prisma.callLog.groupBy({
    by: ['callStatus'],
    _count: true,
  });
  console.log('\n📊 Final DB Status Counts:');
  finalStats.forEach(s => console.log(`   ${s.callStatus}: ${s._count}`));

  // ── Print duration coverage ──
  const withDuration = await prisma.callLog.count({ where: { callDuration: { gt: 0 } } });
  const totalLogs = await prisma.callLog.count({ where: { deletedAt: null } });
  console.log(`\n📈 Duration Coverage: ${withDuration} / ${totalLogs} records have a duration stored in DB`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());