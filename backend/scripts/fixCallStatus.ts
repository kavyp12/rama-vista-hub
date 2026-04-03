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
  console.log('🔄 ULTIMATE REBUILD V2: Recalculating ALL MCUBE Call Logs based STRICTLY on Duration...\n');

  // Grab EVERY call log that came from MCUBE
  const allMcubeLogs = await prisma.callLog.findMany({
    where: { notes: { contains: 'MCUBE' } },
    select: { id: true, notes: true, callStatus: true, callDuration: true }
  });

  console.log(`Found ${allMcubeLogs.length} total MCUBE call logs. Re-evaluating every single one...`);

  const CONCURRENCY_LIMIT = 15; 
  const chunks = chunkArray(allMcubeLogs, CONCURRENCY_LIMIT);
  
  let processedCount = 0;
  let statusChangedCount = 0;
  let durationUpdatedCount = 0;
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (log) => {
      const notes = log.notes || '';
      
      // 1. Extract raw data from notes
      const recMatch = notes.match(/Recording:\s*([^\s|]+)/i);
      const durMatch = notes.match(/Duration:\s*(\d+)/i);
      
      let hasRecording = false;
      let fullAudioUrl = '';
      if (recMatch) {
        const val = recMatch[1].trim();
        if (val.toLowerCase() !== 'none' && val.toLowerCase() !== 'n/a' && val !== '') {
          hasRecording = true;
          const cleanPath = val.startsWith('/') ? val.slice(1) : val;
          fullAudioUrl = cleanPath.startsWith('http') ? cleanPath : `${MCUBE_RECORDING_BASE_URL}/${cleanPath}`;
        }
      }

      let extractedDuration = null;
      if (durMatch) {
        const parsed = parseInt(durMatch[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          extractedDuration = parsed;
        }
      }

      // 2. Fetch Absolute True Duration from MCUBE Server (if we don't already know it)
      let fetchedDuration = null;
      if (hasRecording && (log.callDuration === null || log.callDuration === 0)) {
        try {
          const response = await axios({
              method: 'get',
              url: fullAudioUrl,
              responseType: 'stream',
              timeout: 5000
          });

          const metadata = await mm.parseStream(response.data, { mimeType: 'audio/wav' }, { duration: true, skipCovers: true });
          
          if (metadata.format.duration) {
            fetchedDuration = Math.round(metadata.format.duration);
          }

          if (response.data && typeof response.data.destroy === 'function') {
            response.data.destroy();
          }
        } catch (err: any) {
          // File missing or timeout from MCUBE servers
        }
      }

      // 3. Determine the 100% correct Final Truth
      const finalDuration = fetchedDuration ?? extractedDuration ?? log.callDuration ?? null;
      
      // ✨ NEW STRICT RULE: Recordings DO NOT matter. ONLY duration > 0 makes it connected.
      const isConnected = (finalDuration !== null && finalDuration > 0);
      
      let finalStatus = log.callStatus;
      
      if (isConnected) {
        // If it actually has talk time, make sure it's connected
        if (finalStatus === 'not_connected') {
          finalStatus = 'connected_positive';
        }
      } else {
        // If duration is 0, it MUST be a missed call, even if there is an IVR recording
        if (finalStatus === 'connected_positive') {
          finalStatus = 'not_connected';
        }
      }

      // 4. Force Update Database
      let needsUpdate = false;
      const updateData: any = {};

      if (finalDuration !== log.callDuration) {
        updateData.callDuration = finalDuration;
        needsUpdate = true;
        durationUpdatedCount++;
      }

      if (finalStatus !== log.callStatus) {
        updateData.callStatus = finalStatus;
        needsUpdate = true;
        statusChangedCount++;
      }

      if (needsUpdate) {
        await prisma.callLog.update({
          where: { id: log.id },
          data: updateData
        });
      }
    }));

    processedCount += chunk.length;
    process.stdout.write(`\r⚡ Processed ${processedCount}/${allMcubeLogs.length} | Status Demoted/Fixed: ${statusChangedCount} | Durations Fixed: ${durationUpdatedCount}`);
    
    await delay(300); 
  }
  
  console.log(`\n\n✅ 100% COMPLETE. Old database records have been perfectly aligned with the strict duration rule.`);
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());