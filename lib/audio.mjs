/**
 * Audio utilities — download, probe, and extract segments.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

/** Check if a command exists on PATH. */
export function hasCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Get audio duration in seconds via ffprobe. */
export function getDuration(file) {
  const out = execSync(
    `ffprobe -v quiet -print_format json -show_format "${file}"`,
    { encoding: 'utf8' }
  );
  return parseFloat(JSON.parse(out).format.duration);
}

/** Extract a segment as raw s16le mono 16kHz PCM for Shazam. */
export function extractSegment(file, startSec, durationSec, outPath) {
  try {
    execSync(
      `ffmpeg -y -ss ${startSec} -t ${durationSec} ` +
      `-i "${file}" -ac 1 -ar 16000 -f s16le -acodec pcm_s16le "${outPath}" 2>/dev/null`
    );
    return true;
  } catch {
    return false;
  }
}

/** Download audio from a URL using yt-dlp. Returns path to downloaded file. */
export function downloadURL(url, outputDir) {
  if (!hasCommand('yt-dlp')) {
    throw new Error('yt-dlp is required for URL downloads. Install: brew install yt-dlp');
  }

  // Get title for filename
  const info = spawnSync('yt-dlp', ['--print', 'title', '--no-download', url], {
    encoding: 'utf8',
    timeout: 30_000,
  });

  const title = (info.status === 0 && info.stdout.trim())
    ? info.stdout.trim().replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 80)
    : 'downloaded-mix';

  const outTemplate = join(outputDir, `${title}.%(ext)s`);

  const downloadArgs = [
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '-o', outTemplate, '--no-playlist', '--progress', '--newline', url,
  ];

  const download = (extraArgs = []) => spawnSync('yt-dlp', [
    ...extraArgs, ...downloadArgs,
  ], {
    encoding: 'utf8',
    timeout: 600_000,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  const findDownloadedFile = () => {
    const mp3Path = join(outputDir, `${title}.mp3`);
    if (existsSync(mp3Path)) return mp3Path;

    for (const ext of ['webm', 'opus', 'm4a', 'ogg', 'wav']) {
      const alt = join(outputDir, `${title}.${ext}`);
      if (existsSync(alt)) return alt;
    }

    return null;
  };

  download();
  let downloadedFile = findDownloadedFile();

  // YouTube can return 403s for the android_vr player client. Retry with the
  // regular Android client, which requests a different set of media URLs.
  if (!downloadedFile && /(?:^|\.)youtube\.com$|youtu\.be$/i.test(new URL(url).hostname)) {
    console.log('YouTube download failed; retrying with an alternate player client...');
    download(['--extractor-args', 'youtube:player_client=android']);
    downloadedFile = findDownloadedFile();
  }

  if (downloadedFile) return downloadedFile;

  throw new Error('Download failed. Check the URL, and update yt-dlp if downloading from YouTube.');
}

/** Format file size for display. */
export function fileSize(path) {
  return (statSync(path).size / 1024 / 1024).toFixed(1) + ' MB';
}
