import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SweepStateManager } from '../../../../../scripts/model-bakeoff/sweepState';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const CANDS: CandidateSpec[] = [
  { slug: 'a', modelTag: 'm', server: {} },
  { slug: 'b', modelTag: 'm', server: {} },
  { slug: 'c', modelTag: 'm', server: {} },
];

describe('SweepStateManager', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bakeoff-state-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates and persists the state file on construction', () => {
    new SweepStateManager(dir, 'sweep-x');
    const path = join(dir, 'sweep-state.json');
    expect(existsSync(path)).toBe(true);
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    expect(state.sweepId).toBe('sweep-x');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('persists transitions and survives reload (crash-resume)', () => {
    const m1 = new SweepStateManager(dir, 'sweep-x');
    m1.markRunning('a');
    m1.markCompleted('a', '/results/a.json');
    m1.markRunning('b');
    m1.markFailed('b', 'ollama pull exploded');
    m1.markRunning('c'); // crash leaves c in 'running'

    const m2 = new SweepStateManager(dir, 'ignored-new-id');
    expect(m2.current.sweepId).toBe('sweep-x');
    expect(m2.getConfig('a').status).toBe('completed');
    expect(m2.getConfig('a').resultPath).toBe('/results/a.json');
    expect(m2.getConfig('b').status).toBe('failed');
    expect(m2.getConfig('b').errorMessage).toContain('exploded');
    expect(m2.getConfig('c').status).toBe('running');
  });

  it('getPendingConfigs with resume skips only completed configs', () => {
    const m = new SweepStateManager(dir, 's');
    m.markCompleted('a', '/r/a.json');
    m.markFailed('b', 'boom');
    // c crashed while running
    m.markRunning('c');

    const resumed = m.getPendingConfigs(CANDS, true).map((c) => c.slug);
    expect(resumed).toEqual(['b', 'c']);
    const fresh = m.getPendingConfigs(CANDS, false).map((c) => c.slug);
    expect(fresh).toEqual(['a', 'b', 'c']);
  });

  it('unknown slugs default to pending', () => {
    const m = new SweepStateManager(dir, 's');
    expect(m.getConfig('never-seen').status).toBe('pending');
  });
});
