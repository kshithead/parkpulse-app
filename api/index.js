// Vercel serverless entry.
//
// Serverless instances do not share memory or disk, so a shared database is REQUIRED for the app
// to behave correctly (logins, check-ins and reports must be visible to every instance).
// Provide a Redis REST endpoint (e.g. Upstash, via the Vercel Marketplace) with either
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   or   KV_REST_API_URL + KV_REST_API_TOKEN
// Without it the API falls back to per-instance /tmp storage and /api/v1/health reports
// storage: "ephemeral" (sessions will drop between requests).
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server/app.js';
import { RedisStore } from '../server/redisStore.js';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const tmp = path.join(os.tmpdir(), 'parkpulse');

let ready;
function boot() {
  ready ??= createApp({
    dbFile: path.join(tmp, 'db.json'),
    uploadsDir: path.join(tmp, 'uploads'),
    distDir: path.join(tmp, 'no-dist'),
    seedMode: process.env.SEED_MODE === 'clean' ? 'clean' : 'demo',
    store: url && token ? new RedisStore({ url, token }) : undefined
  })
    .then((r) => r.app)
    .catch((err) => {
      ready = undefined; // retry on the next request instead of caching the failure
      throw err;
    });
  return ready;
}

export default async function handler(req, res) {
  try {
    const app = await boot();
    return app(req, res);
  } catch (err) {
    console.error('[api] boot failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'The API could not start. Check the Redis configuration.' }));
  }
}
