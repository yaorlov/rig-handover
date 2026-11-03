import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Counts, DigestRow, JobStatus, ReadNight } from './types.js';

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

type Line = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

// Parse at the edge (styleguide). A line that does not hold what a run line holds is skipped,
// never thrown: one bad line must not lose the night.
function parseLine(text: string): Line | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || typeof v.job !== 'string') return null;
  if (typeof v.status !== 'string' || !STATUSES.includes(v.status)) return null;
  return {
    at: v.at,
    job: v.job,
    status: v.status as JobStatus,
    owner: typeof v.owner === 'string' ? v.owner : null,
    error: typeof v.error === 'string' ? v.error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;

    const run = parseLine(line);
    if (run === null) {
      badLines += 1;
      continue;
    }
    counts[run.status] += 1;

    const row = rows.get(run.job);
    if (row === undefined) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error,
        first: run.at,
        last: run.at,
      });
      continue;
    }

    row.runs += 1;
    if (run.status === 'retry') row.retries += 1;
    // Lines come in time order, so the last one written is the last one seen.
    row.lastStatus = run.status;
    row.last = run.at;
    if (run.owner !== null) row.owner = run.owner;
    if (run.error !== null) row.lastError = run.error;
  }

  return {
    night,
    rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)),
    badLines,
    counts,
  };
};
