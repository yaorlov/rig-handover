import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

// Only a real date may name a night: readNight joins it onto runsDir, so anything else
// (`../../etc/passwd`, a slash, a word) must never reach the filesystem.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isNight(value: string): boolean {
  if (!NIGHT.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Same rows as the digest page, straight from readNight: one shape, one order, so the two
  // cannot disagree (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNight(night)) return c.json({ error: 'night must be YYYY-MM-DD', night }, 400);

    const digest = readNight(config.runsDir, night);
    if (digest === null) return c.json({ error: 'no digest for this night', night }, 404);

    return c.json(digest);
  });

  return app;
}
