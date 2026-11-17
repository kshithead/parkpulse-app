import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal JSON-file document store.
 * - The whole database lives in memory; every mutation is flushed to disk with an
 *   atomic write (temp file + rename) so a crash can never leave a half-written file.
 * - Single-process by design (fine for a campus deployment / demo).
 */
export class Store {
  constructor(file) {
    this.file = file;
    this.data = null;
    this.timer = null;
  }

  async load(buildInitial) {
    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        return this.data;
      }
    } catch (err) {
      console.error(`[store] Could not read ${this.file} (${err.message}); rebuilding from seed.`);
      try {
        fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
    }
    this.data = await buildInitial();
    this.flush();
    return this.data;
  }

  replace(data) {
    this.data = data;
    this.flush();
  }

  /** Debounced flush: collapses bursts of writes into one disk write. */
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 60);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf-8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[store] Failed to persist database:', err.message);
    }
  }
}
