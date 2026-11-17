// Vercel serverless entry. Serverless filesystems are ephemeral (/tmp), so data here
// is demo-grade only; use `npm start` (or any Node host with a persistent disk) for real use.
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server/app.js';

const tmp = path.join(os.tmpdir(), 'parkpulse');

let ready;
function boot() {
  ready ??= createApp({
    dbFile: path.join(tmp, 'db.json'),
    uploadsDir: path.join(tmp, 'uploads'),
    distDir: path.join(tmp, 'no-dist'),
    seedMode: 'demo'
  }).then((r) => r.app);
  return ready;
}

export default async function handler(req, res) {
  const app = await boot();
  return app(req, res);
}
