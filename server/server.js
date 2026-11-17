import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;

const { app, close, store } = await createApp({
  dbFile: process.env.DB_FILE || path.join(here, 'data', 'db.json'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(here, 'data', 'uploads'),
  distDir: path.join(here, '..', 'dist'),
  seedMode: process.env.SEED_MODE === 'clean' ? 'clean' : 'demo'
});

const server = app.listen(PORT, () => {
  const m = store.data.meta;
  const ageDays = Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 86400000);
  console.log('────────────────────────────────────────────────────');
  console.log(` ParkPulse API listening on http://localhost:${PORT}`);
  console.log(` Health check:  http://localhost:${PORT}/api/v1/health`);
  console.log(` Dataset: ${m.seedMode}${m.seedMode === 'demo' ? ` (generated ${ageDays === 0 ? 'today' : ageDays + ' day(s) ago'})` : ''}`);
  if (m.seedMode === 'demo' && ageDays >= 1) console.log(' Tip: run "npm run seed:demo" (or Admin > Reset data) to refresh the demo timeline before presenting.');
  console.log('────────────────────────────────────────────────────');
});

function shutdown() {
  close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
