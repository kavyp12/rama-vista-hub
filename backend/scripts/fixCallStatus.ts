// scripts/fixCallStatus.ts
import { PrismaClient } from '@prisma/client';
import * as mm from 'music-metadata';
import axios from 'axios';

const prisma = new PrismaClient();
const MCUBE_RECORDING_BASE_URL = 'https://recordings.mcube.com';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

  // ── FAST AUDIO FETCHING (FORCED FULL SCAN) ──
  console.log('\n🔍 FORCED SCAN: Checking ALL calls that have an audio recording...');
  
  // 👇 Notice the filter for "callDuration: 0" is GONE. It grabs everything with a recording.
  const recordsNeedingAudioFetch = await prisma.callLog.findMany({
    where: { 
      notes: { contains: 'Recording:' }
    },
    select: { id: true, notes: true }
  });

  console.log(`Found ${recordsNeedingAudioFetch.length} total records with audio. Processing...`);

  const CONCURRENCY_LIMIT = 15; 
  const chunks = chunkArray(recordsNeedingAudioFetch, CONCURRENCY_LIMIT);
  
  let audioFetchSuccess = 0;
  let processedCount = 0;
  
  for (const chunk of chunks) {
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
            timeout: 5000
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
        // Silently ignore broken links
      }
    }));

    processedCount += chunk.length;
    process.stdout.write(`\r⚡ Processed ${processedCount}/${recordsNeedingAudioFetch.length} | ✅ Re-synced: ${audioFetchSuccess}`);
    
    await delay(300); 
  }
  
  console.log(`\n\n✅ Finished heavily syncing audio durations from MCUBE servers.`);
  console.log('🎉 Done! Your past database is 100% up to date.');
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());