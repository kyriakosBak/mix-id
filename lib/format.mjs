/**
 * Output formatting — TXT, CUE, and JSON.
 */

import { writeFileSync } from 'fs';
import { basename } from 'path';

/** Format seconds as H:MM:SS or MM:SS. */
export function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Write confirmed tracks and one-hit candidates in paste-friendly format. */
export function writeTXT(tracks, outPath, candidates = []) {
  const lines = tracks.map(t => `${t.artist} - ${t.title} ${t.timestamp}`);
  if (candidates.length) {
    if (lines.length) lines.push('');
    lines.push('POSSIBLE TRACKS (no adjacent matching pair; review these)');
    lines.push(...candidates.map(t => `${t.artist} - ${t.title} ${t.timestamp}`));
  }
  writeFileSync(outPath, lines.join('\n') + '\n');
}

/** Write CUE sheet. */
export function writeCUE(tracks, outPath, audioFilename) {
  const title = basename(outPath, '.cue').replace(/[-_]/g, ' ');
  let cue = `REM GENRE DJ Mix\nTITLE "${title}"\nFILE "${audioFilename}" MP3\n`;

  tracks.forEach((t, i) => {
    const num = String(i + 1).padStart(2, '0');
    const mm = String(Math.floor(t.position_sec / 60)).padStart(2, '0');
    const ss = String(t.position_sec % 60).padStart(2, '0');
    cue += `  TRACK ${num} AUDIO\n`;
    cue += `    TITLE "${t.title}"\n`;
    cue += `    PERFORMER "${t.artist}"\n`;
    cue += `    INDEX 01 ${mm}:${ss}:00\n`;
  });

  writeFileSync(outPath, cue);
}

/** Write only the consolidated confirmed tracks as a JSON array. */
export function writeJSON(tracks, outPath) {
  writeFileSync(outPath, JSON.stringify(tracks, null, 2) + '\n');
}
