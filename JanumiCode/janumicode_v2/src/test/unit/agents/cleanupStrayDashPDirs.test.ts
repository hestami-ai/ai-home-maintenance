/**
 * Tests for cleanupStrayDashPDirs — Windows CMD `mkdir -p` artifact cleanup.
 *
 * The function runs at workspace level after each Phase 9 executor invocation
 * to sweep empty `-p` directories left by Unix-trained agents that invoke
 * `mkdir -p` via Windows CMD (which interprets `-p` as another directory
 * name rather than a flag).
 *
 * Tests run on all platforms — the function itself is platform-agnostic;
 * only the executor's invocation gate is Windows-only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cleanupStrayDashPDirs, warnStrayTopLevelDirs } from '../../../lib/agents/executorAgent';

describe('cleanupStrayDashPDirs', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-dashp-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('no-op when no -p directory exists', () => {
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(path.join(workspace, '-p'))).toBe(false);
  });

  it('removes an empty -p directory at workspace root', () => {
    fs.mkdirSync(path.join(workspace, '-p'));
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(path.join(workspace, '-p'))).toBe(false);
  });

  it('leaves a non-empty -p directory in place (safety)', () => {
    const dashP = path.join(workspace, '-p');
    fs.mkdirSync(dashP);
    fs.writeFileSync(path.join(dashP, 'real-work.txt'), 'agent wrote this');
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(dashP)).toBe(true);
    expect(fs.readFileSync(path.join(dashP, 'real-work.txt'), 'utf-8')).toBe('agent wrote this');
  });

  it('removes empty -p directory one level deep', () => {
    const subdir = path.join(workspace, 'src');
    fs.mkdirSync(subdir);
    fs.mkdirSync(path.join(subdir, '-p'));
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(path.join(subdir, '-p'))).toBe(false);
    // Subdir itself preserved
    expect(fs.existsSync(subdir)).toBe(true);
  });

  it('skips .janumicode subdirectory', () => {
    const janumi = path.join(workspace, '.janumicode');
    fs.mkdirSync(janumi);
    fs.mkdirSync(path.join(janumi, '-p'));
    cleanupStrayDashPDirs(workspace);
    // The .janumicode dir is internal — we don't sweep inside it
    expect(fs.existsSync(path.join(janumi, '-p'))).toBe(true);
  });

  it('skips node_modules subdirectory', () => {
    const nm = path.join(workspace, 'node_modules');
    fs.mkdirSync(nm);
    fs.mkdirSync(path.join(nm, '-p'));
    cleanupStrayDashPDirs(workspace);
    // node_modules can be massive — we don't scan inside
    expect(fs.existsSync(path.join(nm, '-p'))).toBe(true);
  });

  it('does not affect files named -p (only directories)', () => {
    fs.writeFileSync(path.join(workspace, '-p'), 'this is a file not a dir');
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(path.join(workspace, '-p'))).toBe(true);
  });

  it('cleans -p directories in multiple subdirs', () => {
    fs.mkdirSync(path.join(workspace, 'src'));
    fs.mkdirSync(path.join(workspace, 'src', '-p'));
    fs.mkdirSync(path.join(workspace, 'tests'));
    fs.mkdirSync(path.join(workspace, 'tests', '-p'));
    cleanupStrayDashPDirs(workspace);
    expect(fs.existsSync(path.join(workspace, 'src', '-p'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'tests', '-p'))).toBe(false);
  });

  it('does not throw when workspace does not exist', () => {
    const missing = path.join(workspace, 'does-not-exist');
    expect(() => cleanupStrayDashPDirs(missing)).not.toThrow();
  });
});

describe('warnStrayTopLevelDirs (F4 — stray path surfacing)', () => {
  let workspace: string;
  beforeEach(() => { workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-stray-test-')); });
  afterEach(() => { if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true }); });

  it('surfaces mangled/garbage top-level dirs but not canonical roots, dotdirs, or files', () => {
    for (const d of ['src', 'node_modules', 'tests', 'brationworkspace_cal_34', 'ibration']) {
      fs.mkdirSync(path.join(workspace, d));
    }
    fs.mkdirSync(path.join(workspace, '.git'));                       // dotdir — ignored
    fs.writeFileSync(path.join(workspace, 'package.json'), '{}');     // file — ignored
    expect(warnStrayTopLevelDirs(workspace).sort()).toEqual(['brationworkspace_cal_34', 'ibration']);
  });

  it('returns empty when only canonical roots + dotdirs are present', () => {
    for (const d of ['src', 'dist', 'node_modules', '.janumicode']) fs.mkdirSync(path.join(workspace, d));
    expect(warnStrayTopLevelDirs(workspace)).toEqual([]);
  });

  it('does not throw when the workspace is missing', () => {
    expect(() => warnStrayTopLevelDirs(path.join(workspace, 'nope'))).not.toThrow();
  });
});
