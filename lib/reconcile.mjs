import { formatTime } from './format.mjs';

function normalize(value = '') {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function identity(match) {
  return `${normalize(match.artist)}|${normalize(match.title)}`;
}

/** Turn ordered scan samples into confirmed runs and one-sample candidates. */
export function reconcile(observations) {
  const ordered = [...observations].sort((a, b) => a.position_sec - b.position_sec);
  const groups = new Map();
  let run = null;

  const finishRun = () => {
    if (!run) return;
    let group = groups.get(run.id);
    if (!group) {
      group = {
        artist: run.artist,
        title: run.title,
        album: run.album,
        year: run.year,
        position_sec: run.position_sec,
        timestamp: run.timestamp,
        sample_positions: [],
        evidence_runs: [],
        confirmed: false,
      };
      groups.set(run.id, group);
    }
    group.sample_positions.push(...run.sample_positions);
    group.evidence_runs.push(run.sample_positions);
    if (run.sample_positions.length >= 2) group.confirmed = true;
    run = null;
  };

  for (const observation of ordered) {
    const hasMatch = observation.artist && observation.title && !observation.error;
    if (!hasMatch) {
      finishRun();
      continue;
    }

    const id = identity(observation);
    if (run && run.id !== id) finishRun();
    if (!run) {
      run = {
        id,
        artist: observation.artist,
        title: observation.title,
        album: observation.album || '',
        year: observation.year || '',
        position_sec: observation.position_sec,
        timestamp: observation.timestamp || formatTime(observation.position_sec),
        sample_positions: [],
      };
    }
    run.sample_positions.push(observation.position_sec);
  }
  finishRun();

  const tracks = [];
  const candidates = [];
  for (const group of groups.values()) {
    group.sample_positions.sort((a, b) => a - b);
    group.evidence_runs.sort((a, b) => a[0] - b[0]);
    const item = {
      artist: group.artist,
      title: group.title,
      album: group.album,
      year: group.year,
      timestamp: group.timestamp,
      position_sec: group.position_sec,
      evidence_count: group.sample_positions.length,
      sample_positions: group.sample_positions,
      evidence_runs: group.evidence_runs,
    };
    (group.confirmed ? tracks : candidates).push(item);
  }

  return { tracks, candidates };
}
