import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// runs/ is read-only (AGENTS.md), so every route test builds its own nights in a temp dir.
const runsDir = mkdtempSync(join(tmpdir(), 'runs-routes-'));

writeFileSync(
  join(runsDir, '2026-12-01.jsonl'),
  [
    '{"at":"2026-12-01T23:00:00+01:00","job":"alpha","status":"ok","owner":"rook"}',
    '{"at":"2026-12-01T23:05:00+01:00","job":"beta","status":"retry","owner":"rook","error":"upstream 503"}',
    '{"at":"2026-12-01T23:09:00+01:00","job":"gamma","status":"fail","owner":null,"error":"quota exceeded"}',
    '{"at":"2026-12-01T23:10:00+01:00","job":"del',
  ].join('\n'),
);
writeFileSync(join(runsDir, '2026-12-02.jsonl'), '');

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = () => createApp(config);

describe('digest page', () => {
  it('renders the night, marks the fail, and says the night is partial', async () => {
    const res = await app().request('/digest/2026-12-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha');
    expect(html).toContain('gamma');
    expect(html).toContain('quota exceeded');
    expect(html).toContain('1 line could not be read');
    // A row that failed is marked with the layout's warning class.
    expect(html).toMatch(/<tr class="warn">[\s\S]*gamma/);
  });

  it('returns 404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const res = await app().request('/digest/2026-12-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('returns 404 for a name that is not a night', async () => {
    expect((await app().request('/digest/2026-13-45')).status).toBe(404);
    expect((await app().request('/digest/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  });
});

describe('digest json', () => {
  it('returns the same rows, in the same order, as the page', async () => {
    const res = await app().request('/api/digest/2026-12-01');
    const body = (await res.json()) as { night: string; badLines: number; rows: { job: string }[] };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-12-01');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta', 'gamma']);

    const html = await (await app().request('/digest/2026-12-01')).text();
    let at = 0;
    for (const row of body.rows) {
      const next = html.indexOf(`<td>${row.job}</td>`, at);
      expect(next).toBeGreaterThanOrEqual(at);
      at = next + 1;
    }
  });

  it('returns 404 for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('returns an empty night as no rows, not 404', async () => {
    const res = await app().request('/api/digest/2026-12-02');
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('returns 400 for a name that is not a night', async () => {
    expect((await app().request('/api/digest/2026-13-45')).status).toBe(400);
    expect((await app().request('/api/digest/..%2F..%2Fetc%2Fpasswd')).status).toBe(400);
  });
});
