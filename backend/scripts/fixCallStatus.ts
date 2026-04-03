// scripts/fixCallStatus.ts
import { PrismaClient } from '@prisma/client';
import * as mm from 'music-metadata';
import axios from 'axios';

const prisma = new PrismaClient();
const MCUBE_RECORDING_BASE_URL = 'https://recordings.mcube.com';

// Helper to delay loops so we don't spam the MCUBE server
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  console.log('🔍 Starting Call Log Database Fixes...\n');

  // ── FIX 1: Has callDuration > 0 but marked as not_connected ──
  const durationFix = await prisma.callLog.updateMany({
    where: { callStatus: 'not_connected', callDuration: { gt: 0 } },
    data: { callStatus: 'connected_positive' },
  });
  console.log(`✅ Fixed ${durationFix.count} records marked as missed but had duration`);

  // ── FIX 2: Has a recording in notes but marked as not_connected ──
  const allWronglyMissed = await prisma.callLog.findMany({
    where: { callStatus: 'not_connected', notes: { contains: 'Recording:' } },
    select: { id: true, notes: true },
  });
  const toFix = allWronglyMissed.filter(log => {
    const match = (log.notes || '').match(/Recording:\s*([^\s|]+)/i);
    return match && match[1].trim() !== 'None' && match[1].trim() !== 'N/A';
  });
  if (toFix.length > 0) {
    await prisma.callLog.updateMany({
      where: { id: { in: toFix.map(l => l.id) } },
      data: { callStatus: 'connected_positive' },
    });
    console.log(`✅ Fixed ${toFix.length} records marked as missed but had audio files`);
  }

  // ── FIX 3: Backfill Duration from Notes ──
  const logsWithNullDuration = await prisma.callLog.findMany({
    where: { OR: [{ callDuration: null }, { callDuration: 0 }], notes: { contains: 'Duration:' } },
    select: { id: true, notes: true },
  });
  let noteDurationCount = 0;
  for (const log of logsWithNullDuration) {
    const match = (log.notes || '').match(/Duration:\s*(\d+)/i);
    if (match && parseInt(match[1], 10) > 0) {
      await prisma.callLog.update({ where: { id: log.id }, data: { callDuration: parseInt(match[1], 10) } });
      noteDurationCount++;
    }
  }
  console.log(`✅ Fixed ${noteDurationCount} durations pulled from text notes`);

  console.log('\n🔍 Scanning for calls with missing durations but valid audio files...');
  
  const recordsNeedingAudioFetch = await prisma.callLog.findMany({
    where: { 
      OR: [{ callDuration: null }, { callDuration: 0 }],
      notes: { contains: 'Recording:' }
    },
    select: { id: true, notes: true }
  });

  let audioFetchSuccess = 0;
  
  for (const log of recordsNeedingAudioFetch) {
    const match = (log.notes || '').match(/Recording:\s*([^\s|]+)/i);
    if (!match) continue;
    
    const val = match[1].trim();
    if (val.toLowerCase() === 'none' || val.toLowerCase() === 'n/a' || val === '') continue;

    const cleanPath = val.startsWith('/') ? val.slice(1) : val;
    const fullAudioUrl = cleanPath.startsWith('http') ? cleanPath : `${MCUBE_RECORDING_BASE_URL}/${cleanPath}`;

    try {
      // 1. Fetch as stream via Axios
      const response = await axios({
          method: 'get',
          url: fullAudioUrl,
          responseType: 'stream',
      });

      // 2. Parse stream
      const metadata = await mm.parseStream(response.data, { mimeType: 'audio/wav' }, { duration: true, skipCovers: true });
      
      if (metadata.format.duration) {
        const durationSecs = Math.round(metadata.format.duration);
        await prisma.callLog.update({
          where: { id: log.id },
          data: { callDuration: durationSecs }
        });
        audioFetchSuccess++;
        process.stdout.write(`\r✅ Fetched audio duration for ${audioFetchSuccess} old records...`);
      }

      // 3. Destroy stream
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
    } catch (err: any) {
      // Ignore errors for 404s (if MCUBE deleted old files)
    }
    
    // Tiny delay to prevent spamming MCUBE's servers during the loop
    await delay(500); 
  }
  console.log(`\n✅ Finished fetching audio durations from MCUBE servers.`);

  console.log('\n🎉 Done! Database is completely patched.');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());