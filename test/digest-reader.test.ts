import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const runs = 'runs';

function night(file: string): NonNullable<ReturnType<typeof readNight>> {
  const n = readNight(runs, file);
  if (n === null) throw new Error(`expected a night for ${file}`);
  return n;
}

describe('readNight', () => {
  it('reads the night on disk into one row per job, and counts the bad line', () => {
    const n = night('2026-10-28');
    expect(n.rows).toHaveLength(5);
    expect(n.badLines).toBe(1);
    // 16 lines, one bad: the 15 readable ones are 10 ok, 4 retry, 1 fail.
    expect(n.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the last error of the job', () => {
    const refresh = night('2026-10-28').rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });

    const backup = night('2026-10-28').rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    const render = night('2026-10-28').rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, retries: 0 });
  });

  it('keeps the offset from the log', () => {
    const sync = night('2026-10-28').rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({
      runs: 8,
      retries: 1,
      first: '2026-10-28T23:00:06+01:00',
      last: '2026-10-29T05:00:04+01:00',
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runs, '2026-01-01')).toBeNull();
  });

  it('renders the night around a bad line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runs-'));
    writeFileSync(
      join(dir, '2026-11-01.jsonl'),
      ['{"at":"2026-11-01T23:00:00+01:00","job":"a","status":"ok","owner":"rook"}', 'not json', '{"at":"2026-11-01T23:01:00+01:00","job":"b","status":"fail","owner":null,"error":"boom"}', '{"job":"c"}'].join('\n'),
    );

    const n = readNight(dir, '2026-11-01');
    if (n === null) throw new Error('expected a night');
    expect(n.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(n.badLines).toBe(2);
  });

  it('renders an empty night as no rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runs-'));
    writeFileSync(join(dir, '2026-11-02.jsonl'), '');

    const n = readNight(dir, '2026-11-02');
    if (n === null) throw new Error('expected a night');
    expect(n.rows).toEqual([]);
    expect(n.badLines).toBe(0);
  });
});
