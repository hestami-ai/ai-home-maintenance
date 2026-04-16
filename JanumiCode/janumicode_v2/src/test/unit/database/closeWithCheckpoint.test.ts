/**
 * Regression tests for closeWithCheckpoint() — the helper that ensures the
 * on-disk .db file is self-contained (no orphaned -wal sidecar) after a
 * workflow session ends.
 *
 * Background: JanumiCode v2 runs SQLite in WAL mode because WAL gives us
 * concurrent reads during writes and better crash safety. The downside is
 * that until the WAL is checkpointed, rows live in a `-wal` sidecar file,
 * not the main .db. SQLite + better-sqlite3 will usually checkpoint on a
 * clean, single-connection close() — but the VS Code extension runs a
 * sidecar child process that owns the DB, and on an ungraceful shutdown
 * (VS Code window killed, process terminated) the sidecar is SIGKILLed
 * before close() runs. The .db file on disk is then nearly empty, with
 * all the content in the -wal. That's what produced the user-reported
 * "Could not find schema for table" error when they tried to open the v2
 * .db file in an online SQLite viewer.
 *
 * The fix runs `PRAGMA wal_checkpoint(TRUNCATE)` inside the RPC path that
 * handles 'close', so the WAL is merged into the main .db *before* close()
 * (and therefore before the kill signal that might interrupt close()).
 *
 * These tests pin the behavior at the helper boundary, not via full
 * filesystem observation — SQLite's auto-checkpoint defaults make the
 * filesystem outcome too timing-dependent to assert cleanly in a unit
 * test, but the ORDER and FREQUENCY of the pragma + close calls is what
 * actually prevents the regression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3');
import { closeWithCheckpoint } from '../../../lib/database/init';

interface BetterSqlite3Database {
  exec(sql: string): void;
  prepare(sql: string): { run(...p: unknown[]): void; all(...p: unknown[]): unknown[] };
  pragma(pragma: string): unknown;
  close(): void;
}

// ── Spy-based behavior tests (the load-bearing assertions) ──────────

describe('closeWithCheckpoint — call sequence', () => {
  it('issues PRAGMA wal_checkpoint(TRUNCATE) exactly once, before close()', () => {
    const calls: string[] = [];
    const fake = {
      pragma: (p: string) => { calls.push(`pragma:${p}`); return []; },
      close: () => { calls.push('close'); },
    };

    closeWithCheckpoint(fake);

    expect(calls).toEqual(['pragma:wal_checkpoint(TRUNCATE)', 'close']);
  });

  it('does NOT use a weaker checkpoint mode (PASSIVE/FULL/RESTART)', () => {
    // Pins the specific mode — only TRUNCATE both merges the WAL AND
    // zeros the sidecar so external viewers see a clean single file.
    const pragmas: string[] = [];
    closeWithCheckpoint({
      pragma: (p: string) => { pragmas.push(p); return []; },
      close: () => {},
    });
    expect(pragmas).toEqual(['wal_checkpoint(TRUNCATE)']);
  });

  it('still calls close() when the checkpoint pragma throws', () => {
    // The checkpoint is best-effort — if another connection holds a lock,
    // it can fail. We must not leave the DB open in that case.
    let closed = false;
    expect(() => closeWithCheckpoint({
      pragma: () => { throw new Error('SQLITE_BUSY: database is locked'); },
      close: () => { closed = true; },
    })).not.toThrow();
    expect(closed).toBe(true);
  });

  it('does NOT swallow errors thrown by close() itself', () => {
    // If close() throws, the caller (extension.ts) decides whether to
    // swallow; the helper's job is to attempt the checkpoint first and
    // then delegate. Masking a close failure could hide a real bug.
    expect(() => closeWithCheckpoint({
      pragma: () => [],
      close: () => { throw new Error('close failed'); },
    })).toThrow(/close failed/);
  });
});

// ── End-to-end filesystem test (weaker but worth having) ────────────

describe('closeWithCheckpoint — end-to-end with better-sqlite3', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-close-ckpt-'));
    dbPath = path.join(tmpDir, 'test.db');
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('leaves every row readable from the .db alone (no -wal required)', () => {
    const db = new BetterSqlite3(dbPath) as BetterSqlite3Database;
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    const insert = db.prepare('INSERT INTO widgets (label) VALUES (?)');
    for (let i = 0; i < 200; i++) insert.run(`widget-${i}`);

    closeWithCheckpoint(db);

    // Remove WAL/SHM sidecars to simulate "user uploaded only the .db to
    // an online viewer". Every row must still be readable.
    for (const ext of ['-wal', '-shm']) {
      try { fs.rmSync(dbPath + ext, { force: true }); } catch { /* ignore */ }
    }

    const readonly = new BetterSqlite3(dbPath, { readonly: true }) as BetterSqlite3Database;
    try {
      const rows = readonly.prepare('SELECT COUNT(*) as n FROM widgets').all() as { n: number }[];
      expect(rows[0].n).toBe(200);
    } finally {
      readonly.close();
    }
  });
});
