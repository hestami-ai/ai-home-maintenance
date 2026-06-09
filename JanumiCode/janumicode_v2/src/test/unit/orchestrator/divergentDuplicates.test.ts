/**
 * Unit tests for Lever 2c — divergent-duplicate detection
 * (workspaceSnapshot.detectDivergentDuplicates).
 *
 * Flags files that share a basename but have DIFFERENT content across paths
 * (the fragmentation symptom), while ignoring identical copies, ubiquitous
 * structural names, test files, root config, and the scaffold's protected
 * shared dir. Purely structural (basename + hash); no domain keywords.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectDivergentDuplicates } from '../../../lib/orchestrator/workspaceSnapshot';

let ws: string;
beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'divdup-')); });
afterEach(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } });

function write(rel: string, content: string): void {
  const abs = path.join(ws, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

describe('detectDivergentDuplicates', () => {
  it('flags two same-named modules with divergent content', () => {
    write('src/services/redirect/encryption-service.js', 'export const enc = () => 1; // ESM');
    write('src/services/url/encryption-service.js', 'module.exports.enc = () => 2; // CJS');
    const findings = detectDivergentDuplicates(ws);
    expect(findings).toHaveLength(1);
    expect(findings[0].basename).toBe('encryption-service.js');
    expect(findings[0].files).toHaveLength(2);
  });

  it('does NOT flag identical copies (same hash)', () => {
    write('a/util.js', 'export const x = 1;');
    write('b/util.js', 'export const x = 1;');
    expect(detectDivergentDuplicates(ws)).toHaveLength(0);
  });

  it('ignores ubiquitous structural names (index/types) and test files', () => {
    write('a/index.ts', 'export const a = 1;');
    write('b/index.ts', 'export const b = 2;'); // divergent but ubiquitous → ignored
    write('a/types.ts', 'export type A = 1;');
    write('b/types.ts', 'export type B = 2;');
    write('a/foo.test.ts', 'test 1');
    write('b/foo.test.ts', 'test 2');
    expect(detectDivergentDuplicates(ws)).toHaveLength(0);
  });

  it('ignores root config files (package.json etc.)', () => {
    write('package.json', '{"name":"root"}');
    write('sub/package.json', '{"name":"sub"}'); // divergent but config → ignored
    expect(detectDivergentDuplicates(ws)).toHaveLength(0);
  });

  it('excludes files under a protected prefix (the shared dir)', () => {
    write('src/shared/models/Link.ts', 'export interface Link { id: string }');
    write('src/services/x/Link.ts', 'export interface Link { id: number }'); // divergent vs shared
    // Without protection both Link.ts would be flagged; protecting src/shared/ excludes its copy,
    // leaving a single non-shared Link.ts ⇒ no divergent group.
    const findings = detectDivergentDuplicates(ws, ['src/shared/']);
    expect(findings).toHaveLength(0);
  });
});
