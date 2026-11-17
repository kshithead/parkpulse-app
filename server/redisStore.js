import crypto from 'node:crypto';
import { HttpError } from './validators.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Compare-and-delete so an instance can only release a lock it still owns.
const UNLOCK_LUA = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";

/**
 * Shared-database store for serverless hosting (Vercel), backed by Upstash Redis' REST API.
 *
 * Serverless instances don't share memory, so the whole database document lives in Redis:
 *   <prefix>:doc  - the JSON database          <prefix>:rev - revision counter (cheap change detection)
 *   <prefix>:lock - short-lived mutation lock  <prefix>:blob:<name> - uploaded evidence photos
 *
 * Contract used by app.js:
 *   refresh()  - make this.data current (one tiny GET unless another instance changed something)
 *   lock()/unlock(token) - serialise mutations across all instances
 *   save()     - mark dirty;  persist() - write doc+rev (called before the HTTP response is sent)
 */
export class RedisStore {
  constructor({ url, token, prefix = 'parkpulse' }) {
    this.remote = true;
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.k = { doc: `${prefix}:doc`, rev: `${prefix}:rev`, lock: `${prefix}:lock`, blob: (n) => `${prefix}:blob:${n}` };
    this.data = null;
    this.localRev = -1;
    this.dirty = false;
  }

  async cmd(...args) {
    const [res] = await this.pipeline([args]);
    return res;
  }

  async pipeline(cmds) {
    let r;
    try {
      r = await fetch(`${this.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds)
      });
    } catch (err) {
      throw new Error(`Redis unreachable: ${err.message}`);
    }
    const out = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(out)) throw new Error(`Redis error ${r.status}: ${out?.error || 'bad response'}`);
    const failed = out.find((x) => x.error);
    if (failed) throw new Error(`Redis command failed: ${failed.error}`);
    return out.map((x) => x.result);
  }

  async load(buildInitial) {
    if ((await this.cmd('GET', this.k.doc)) == null) {
      const initial = await buildInitial();
      // NX: if another instance seeded first, theirs wins.
      await this.cmd('SET', this.k.doc, JSON.stringify(initial), 'NX');
    }
    await this.cmd('SET', this.k.rev, '1', 'NX');
    await this.refresh(true);
    return this.data;
  }

  async refresh(force = false) {
    const rev = Number(await this.cmd('GET', this.k.rev)) || 0;
    if (!force && this.data && rev === this.localRev) return;
    const raw = await this.cmd('GET', this.k.doc);
    if (raw == null) throw new Error('Database document is missing in Redis.');
    this.data = JSON.parse(raw);
    this.localRev = rev;
    this.dirty = false;
  }

  /** Force the next refresh to reload from Redis (used after a failed write). */
  invalidate() {
    this.localRev = -1;
    this.dirty = false;
  }

  save() {
    this.dirty = true;
  }

  replace(data) {
    this.data = data;
    this.dirty = true;
  }

  async persist() {
    if (!this.dirty) return;
    const next = this.localRev + 1;
    await this.pipeline([
      ['SET', this.k.doc, JSON.stringify(this.data)],
      ['SET', this.k.rev, String(next)]
    ]);
    this.localRev = next;
    this.dirty = false;
  }

  flush() {
    /* writes happen in persist() before each response */
  }

  async lock(timeoutMs = 7000) {
    const token = crypto.randomBytes(8).toString('hex');
    const started = Date.now();
    for (;;) {
      if ((await this.cmd('SET', this.k.lock, token, 'NX', 'PX', '8000')) === 'OK') return token;
      if (Date.now() - started > timeoutMs) throw new HttpError(503, 'The server is busy right now. Please try again in a moment.');
      await sleep(30 + Math.random() * 60);
    }
  }

  async unlock(token) {
    if (!token) return;
    await this.cmd('EVAL', UNLOCK_LUA, '1', this.k.lock, token).catch(() => {});
  }

  // Evidence photos: /tmp is not shared between serverless instances, so they live in Redis too.
  async putBlob(name, base64) {
    await this.cmd('SET', this.k.blob(name), base64);
  }

  async getBlob(name) {
    const b64 = await this.cmd('GET', this.k.blob(name));
    return b64 ? Buffer.from(b64, 'base64') : null;
  }
}

/** Per-instance FIFO mutex: one request touches the shared in-memory snapshot at a time. */
export class Mutex {
  constructor() {
    this.tail = Promise.resolve();
  }

  acquire() {
    let release;
    const next = new Promise((r) => (release = r));
    const ready = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return ready;
  }
}
