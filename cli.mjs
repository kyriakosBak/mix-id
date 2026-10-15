#!/usr/bin/env node

/**
 * mix-id — Identify tracks in any DJ mix.
 *
 * Usage:
 *   mix-id <file-or-url> [options]
 *
 * Examples:
 *   mix-id my-mix.mp3
 *   mix-id https://soundcloud.com/dj/set-name
 *   mix-id https://www.mixcloud.com/dj/show-name
 *   mix-id https://youtube.com/watch?v=... --step 60
 */

import { existsSync } from 'fs';
import { basename } from 'path';
import { scan } from './lib/scanner.mjs';
import { reconcile } from './lib/reconcile.mjs';
import { writeTXT, writeCUE, writeJSON } from './lib/format.mjs';
import { downloadURL, fileSize, hasCommand } from './lib/audio.mjs';

// --- Parse args ---

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    flags[key] = args[i + 1] || true;
    i++;
  } else {
    positional.push(args[i]);
  }
}

const input = positional[0];
const step = flags.step ? parseInt(flags.step) : null; // auto-detect if not set
const segment = parseInt(flags.segment || '18');
const start = parseInt(flags.start || '0');

if (!input || flags.help) {
  console.log(`
  mix-id — Identify tracks in any DJ mix.

  Usage:
    mix-id <file-or-url> [options]

  Options:
    --step <sec>      Time between scan points (default: 30s)
    --segment <sec>   Sample length for recognition (default: 18)
    --start <sec>     Skip to position before scanning (default: 0)
    --help            Show this help

  Examples:
    mix-id my-mix.mp3
    mix-id https://soundcloud.com/dj/set-name
    mix-id mix.wav --step 60 --segment 20

  Requirements:
    ffmpeg    Audio processing (brew install ffmpeg)
    yt-dlp    URL downloads (brew install yt-dlp)
  `);
  process.exit(input ? 0 : 1);
}

// --- Resolve input type ---

const isURL = /^https?:\/\//i.test(input);

// --- Preflight checks ---

async function ensureDeps() {
  const missing = [];
  if (!hasCommand('ffmpeg') || !hasCommand('ffprobe')) missing.push('ffmpeg');
  if (isURL && !hasCommand('yt-dlp')) missing.push('yt-dlp');

  if (missing.length === 0) return;

  // Try auto-install via brew
  if (hasCommand('brew')) {
    console.log(`\n📦 Installing missing dependencies: ${missing.join(', ')}...\n`);
    const { execSync } = await import('child_process');
    try {
      execSync(`brew install ${missing.join(' ')}`, { stdio: 'inherit' });
      console.log('');
      return;
    } catch {
      console.error(`\n❌ Auto-install failed. Please run manually:`);
      console.error(`   brew install ${missing.join(' ')}`);
      process.exit(1);
    }
  }

  console.error(`\n❌ Missing dependencies: ${missing.join(', ')}`);
  console.error(`\n   Install with:`);
  console.error(`   brew install ${missing.join(' ')}    (macOS)`);
  console.error(`   apt install ${missing.join(' ')}     (Linux)`);
  process.exit(1);
}

await ensureDeps();
let file;

if (isURL) {
  console.log(`\n📥 Downloading...`);
  console.log(`   ${input}\n`);
  file = downloadURL(input, process.cwd());
  console.log(`✅ ${basename(file)} (${fileSize(file)})\n`);
} else {
  file = input;
}

if (!existsSync(file)) {
  console.error(`❌ File not found: ${file}`);
  process.exit(1);
}

// --- Default scan step ---

const actualStep = step ?? 30;

// --- Scan ---

const result = await scan(file, { step: actualStep, segment, start });

// --- Reconcile & output ---

const { tracks, candidates } = reconcile(result.observations);

if (tracks.length === 0 && candidates.length === 0) {
  console.log('\n❌ No tracks identified.');
  process.exit(0);
}

// Print tracklist
console.log('\n' + '─'.repeat(50));
console.log(`🎧 TRACKLIST — ${basename(file)}`);
console.log('─'.repeat(50));
tracks.forEach((t, i) => {
  const num = String(i + 1).padStart(2);
  const album = t.album ? ` [${t.album}]` : '';
  console.log(`${num}. [${t.timestamp}] ${t.artist} — ${t.title}${album}`);
});
if (candidates.length) {
  console.log('\nPOSSIBLE TRACKS — no adjacent matching pair');
  candidates.forEach((t, i) => {
    const num = String(i + 1).padStart(2);
    console.log(`${num}. [${t.timestamp}] ${t.artist} — ${t.title}`);
  });
}
console.log('─'.repeat(50));

// Write files
const base = file.replace(/\.[^.]+$/, '');
const audioFilename = basename(file);

writeTXT(tracks, base + '_tracklist.txt', candidates);
writeCUE(tracks, base + '.cue', audioFilename);
writeJSON(tracks, base + '_tracklist.json');

console.log(`\n💾 Output:`);
console.log(`   ${base}_tracklist.txt`);
console.log(`   ${base}.cue`);
console.log(`   ${base}_tracklist.json`);
