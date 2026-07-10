/**
 * Characterization tests for Wave R rollback — workspaceSnapshot.revertWaveSnapshot.
 *
 * Pins the CURRENT observable behavior of the reverse-apply path:
 *   - created files → deleted (counted as reverted)
 *   - created files already gone → no-op, no failure
 *   - modified/deleted files with captured pre-content → restored (counted)
 *   - modified files that were oversize (hash-only) → failure 'oversize_uncaptured'
 *   - modified/deleted files with no captured pre-content → failure 'no_pre_content'
 *   - any fs error during an entry → recorded as a failure; loop continues
 *
 * These assertions are derived from the branch logic (not the refactor) so they
 * hold for both the pre- and post-decomposition implementations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  revertWaveSnapshot,
  type FileSnapshot,
  type WaveDiffEntry,
  type WaveDiffSummary,
} from '../../../lib/orchestrator/workspaceSnapshot';

let ws: string;
beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'revert-')); });
afterEach(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } });

function abs(rel: string): string {
  return path.join(ws, rel);
}

function writeFile(rel: string, content: string): string {
  const p = abs(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

function summary(files: WaveDiffEntry[]): WaveDiffSummary {
  return { created: 0, modified: 0, deleted: 0, total_bytes_added: 0, files };
}

function preSnap(p: string, extra: Partial<FileSnapshot> = {}): FileSnapshot {
  return { path: p, hash: 'h', ...extra };
}

describe('revertWaveSnapshot', () => {
  it('deletes a created file and counts it as reverted', () => {
    const p = writeFile('gen/new.ts', 'created content');
    const result = revertWaveSnapshot(
      summary([{ path: p, operation: 'created', pre: null, post: preSnap(p) }]),
    );
    expect(result.reverted).toBe(1);
    expect(result.failed).toEqual([]);
    expect(fs.existsSync(p)).toBe(false);
  });

  it('created file already absent → no-op, no failure', () => {
    const p = abs('gen/gone.ts'); // never written
    const result = revertWaveSnapshot(
      summary([{ path: p, operation: 'created', pre: null, post: null }]),
    );
    expect(result.reverted).toBe(0);
    expect(result.failed).toEqual([]);
  });

  it('restores modified file from captured pre-content', () => {
    const p = writeFile('gen/mod.ts', 'NEW body after wave');
    const result = revertWaveSnapshot(
      summary([{
        path: p,
        operation: 'modified',
        pre: preSnap(p, { content: Buffer.from('OLD body') }),
        post: preSnap(p),
      }]),
    );
    expect(result.reverted).toBe(1);
    expect(result.failed).toEqual([]);
    expect(fs.readFileSync(p, 'utf8')).toBe('OLD body');
  });

  it('modified oversize file (hash-only) → failure oversize_uncaptured', () => {
    const p = writeFile('gen/big.ts', 'huge new content');
    const result = revertWaveSnapshot(
      summary([{
        path: p,
        operation: 'modified',
        pre: preSnap(p, { hash: null, oversize: true }),
        post: preSnap(p),
      }]),
    );
    expect(result.reverted).toBe(0);
    expect(result.failed).toEqual([{ path: p, reason: 'oversize_uncaptured' }]);
  });

  it('modified file with no captured pre-content → failure no_pre_content', () => {
    const p = writeFile('gen/nocontent.ts', 'new content');
    const result = revertWaveSnapshot(
      summary([{ path: p, operation: 'modified', pre: preSnap(p), post: preSnap(p) }]),
    );
    expect(result.reverted).toBe(0);
    expect(result.failed).toEqual([{ path: p, reason: 'no_pre_content' }]);
  });

  it('recreates a deleted file from captured pre-content', () => {
    const p = abs('gen/deleted.ts'); // absent at revert time (was deleted during wave)
    const result = revertWaveSnapshot(
      summary([{
        path: p,
        operation: 'deleted',
        pre: preSnap(p, { content: Buffer.from('restored body') }),
        post: null,
      }]),
    );
    expect(result.reverted).toBe(1);
    expect(result.failed).toEqual([]);
    expect(fs.readFileSync(p, 'utf8')).toBe('restored body');
  });

  it('deleted file with no captured pre-content → failure no_pre_content', () => {
    const p = abs('gen/deleted2.ts');
    const result = revertWaveSnapshot(
      summary([{ path: p, operation: 'deleted', pre: preSnap(p), post: null }]),
    );
    expect(result.reverted).toBe(0);
    expect(result.failed).toEqual([{ path: p, reason: 'no_pre_content' }]);
  });

  it('unchanged entries are ignored (no revert, no failure)', () => {
    const p = writeFile('gen/same.ts', 'unchanged');
    const result = revertWaveSnapshot(
      summary([{ path: p, operation: 'unchanged', pre: preSnap(p), post: preSnap(p) }]),
    );
    expect(result.reverted).toBe(0);
    expect(result.failed).toEqual([]);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('records an fs error as a failure and continues the loop', () => {
    // A directory at a "created" path: existsSync → true, but unlinkSync(dir) throws.
    const dirPath = abs('gen/adir');
    fs.mkdirSync(dirPath, { recursive: true });
    const okPath = writeFile('gen/ok.ts', 'created');
    const result = revertWaveSnapshot(
      summary([
        { path: dirPath, operation: 'created', pre: null, post: preSnap(dirPath) },
        { path: okPath, operation: 'created', pre: null, post: preSnap(okPath) },
      ]),
    );
    // The throwing entry is recorded as a failure; the following entry still reverts.
    expect(result.reverted).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].path).toBe(dirPath);
    expect(fs.existsSync(okPath)).toBe(false);
  });

  it('aggregates counts across a mixed batch', () => {
    const created = writeFile('gen/c.ts', 'c');
    const modified = writeFile('gen/m.ts', 'm-new');
    const deleted = abs('gen/d.ts');
    const result = revertWaveSnapshot(
      summary([
        { path: created, operation: 'created', pre: null, post: preSnap(created) },
        {
          path: modified,
          operation: 'modified',
          pre: preSnap(modified, { content: Buffer.from('m-old') }),
          post: preSnap(modified),
        },
        {
          path: deleted,
          operation: 'deleted',
          pre: preSnap(deleted, { content: Buffer.from('d-old') }),
          post: null,
        },
      ]),
    );
    expect(result.reverted).toBe(3);
    expect(result.failed).toEqual([]);
    expect(fs.existsSync(created)).toBe(false);
    expect(fs.readFileSync(modified, 'utf8')).toBe('m-old');
    expect(fs.readFileSync(deleted, 'utf8')).toBe('d-old');
  });
});
