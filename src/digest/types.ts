// The digest's one contract (plan.md § 1). Section 2 works against these types, so this file
// is committed before any digest code.
export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  // `at` as written in the log, offset kept (styleguide: never convert to UTC for display).
  first: string;
  last: string;
};

// How the night's run lines ended, counted per line, not per job.
export type Counts = { ok: number; retry: number; fail: number };

// One night's digest: the rows, sorted by job, how many lines were skipped, and the line counts.
export type Night = { night: string; rows: DigestRow[]; badLines: number; counts: Counts };

// Null when there is no file for that night: a missing night is not an empty one.
export type ReadNight = (runsDir: string, night: string) => Night | null;
