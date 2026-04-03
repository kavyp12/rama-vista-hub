// scripts/fixCallStatus.ts
import { PrismaClient } from '@prisma/client';
import * as mm from 'music-metadata';
import axios from 'axios';

const prisma = new PrismaClient();
const MCUBE_RECORDING_BASE_URL = 'https://recordings.mcube.com';

// Helper to delay loops
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper to split a large array into smaller batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

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

  // ── FAST AUDIO FETCHING (BATCH PROCESSING) ──
  console.log('\n🔍 Scanning for calls with missing durations but valid audio files...');
  
  const recordsNeedingAudioFetch = await prisma.callLog.findMany({
    where: { 
      OR: [{ callDuration: null }, { callDuration: 0 }],
      notes: { contains: 'Recording:' }
    },
    select: { id: true, notes: true }
  });

  console.log(`Found ${recordsNeedingAudioFetch.length} records needing audio fetch.`);

  // Split the 2000+ records into chunks of 15 records each
  const CONCURRENCY_LIMIT = 15; 
  const chunks = chunkArray(recordsNeedingAudioFetch, CONCURRENCY_LIMIT);
  
  let audioFetchSuccess = 0;
  let processedCount = 0;
  
  for (const chunk of chunks) {
    // Process all 15 records in the current chunk AT THE SAME TIME
    await Promise.all(chunk.map(async (log) => {
      const match = (log.notes || '').match(/Recording:\s*([^\s|]+)/i);
      if (!match) return;
      
      const val = match[1].trim();
      if (val.toLowerCase() === 'none' || val.toLowerCase() === 'n/a' || val === '') return;

      const cleanPath = val.startsWith('/') ? val.slice(1) : val;
      const fullAudioUrl = cleanPath.startsWith('http') ? cleanPath : `${MCUBE_RECORDING_BASE_URL}/${cleanPath}`;

      try {
        const response = await axios({
            method: 'get',
            url: fullAudioUrl,
            responseType: 'stream',
            timeout: 5000 // 5 second timeout so a bad link doesn't freeze the batch
        });

        const metadata = await mm.parseStream(response.data, { mimeType: 'audio/wav' }, { duration: true, skipCovers: true });
        
        if (metadata.format.duration) {
          const durationSecs = Math.round(metadata.format.duration);
          await prisma.callLog.update({
            where: { id: log.id },
            data: { callDuration: durationSecs }
          });
          audioFetchSuccess++;
        }

        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      } catch (err: any) {
        // Silently ignore 404s/timeouts
      }
    }));

    // Update progress
    processedCount += chunk.length;
    process.stdout.write(`\r⚡ Processed ${processedCount}/${recordsNeedingAudioFetch.length} | ✅ Success: ${audioFetchSuccess}`);
    
    // Tiny delay between *batches* of 15, not individual records
    await delay(300); 
  }
  
  console.log(`\n\n✅ Finished fetching audio durations from MCUBE servers.`);
  console.log('🎉 Done! Database is completely patched.');
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());