/**
 * Core scanner — samples audio at regular intervals and identifies tracks.
 */

import { mkdtempSync, readFileSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { getDuration, extractSegment } from './audio.mjs';
import { recognize } from './recognize.mjs';
import { formatTime } from './format.mjs';

const RATE_LIMIT_MS = 3000; // Be polite to Shazam
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Scan an audio file and identify tracks.
 *
 * @param {string} file       - Path to audio file
 * @param {object} opts
 * @param {number} opts.step     - Seconds between scan points (default: 30)
 * @param {number} opts.segment  - Seconds per sample (default: 18)
 * @param {number} opts.start    - Start position in seconds (default: 0)
 * @returns {Promise<{ observations: Array, duration: number, segmentsScanned: number }>}
 */
export async function scan(file, opts = {}) {
  const step = opts.step ?? 30;
  const segment = opts.segment ?? 18;
  const start = opts.start ?? 0;

  const duration = getDuration(file);
  const tmpDir = mkdtempSync(join(tmpdir(), 'mix-id-'));

  const log = (msg) => process.stdout.write(msg);

  console.log(`\n🎵 mix-id`);
  console.log('─'.repeat(50));
  console.log(`File:     ${basename(file)}`);
  console.log(`Duration: ${formatTime(duration)}`);
  console.log(`Settings: ${step}s step, ${segment}s sample`);
  console.log('─'.repeat(50) + '\n');

  const observations = [];
  let segNum = 0;
  const validPositions = [];
  for (let pos = start; pos >= 0 && pos + segment <= duration; pos += step) {
    validPositions.push(pos);
  }

  for (const pos of validPositions) {
    segNum++;
    const ts = formatTime(pos);
    const pct = Math.round((segNum / validPositions.length) * 100);
    log(`[${ts}] ${pct}% `);

    const segPath = join(tmpDir, `seg.raw`);

    if (!extractSegment(file, pos, segment, segPath)) {
      log('⚠️  skip\n');
      observations.push({ timestamp: ts, position_sec: pos, match: null, error: 'segment extraction failed' });
      continue;
    }

    try {
      const pcm = readFileSync(segPath);
      const match = await recognize(pcm);

      if (match) {
        log(`✅ ${match.artist} — ${match.title}\n`);
        observations.push({ timestamp: ts, position_sec: pos, ...match });
      } else {
        log('❓\n');
        observations.push({ timestamp: ts, position_sec: pos, match: null });
      }
    } catch (err) {
      log(`⚠️  ${err.message}\n`);
      observations.push({ timestamp: ts, position_sec: pos, match: null, error: err.message });
    }

    try { unlinkSync(segPath); } catch {}
    await sleep(RATE_LIMIT_MS);
  }

  return { observations, duration, segmentsScanned: segNum };
}
