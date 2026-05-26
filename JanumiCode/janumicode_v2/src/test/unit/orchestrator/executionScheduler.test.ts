/**
 * Wave R — unit tests for the executionScheduler pure helpers.
 *
 * These cover the deterministic slicing + topo-sort logic, the
 * workspace-snapshot diff, and the quarantine-ledger augmented context
 * builder. Full end-to-end integration of the scheduler against
 * ExecutorAgent + ReasoningReview is exercised in the Phase 9 e2e
 * harness (separate suite); these tests pin the algorithmic core so
 * regressions surface without a full workflow setup.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  sliceLeavesIntoWaves,
  topoSortRespectingWave,
  collapseLegacySectionsWhenPacketPresent,
  buildWorkspaceOrientation,
  type SchedulerLeaf,
} from '../../../lib/orchestrator/executionScheduler';
import {
  diffWaveSnapshots,
  detectOverlapConflicts,
  type FileSnapshot,
} from '../../../lib/orchestrator/workspaceSnapshot';
import { QuarantineLedger } from '../../../lib/orchestrator/quarantineLedger';
import type { TaskQuarantineContent } from '../../../lib/types/records';

function leaf(id: string, opts: Partial<SchedulerLeaf> = {}): SchedulerLeaf {
  return {
    id,
    task_type: 'standard',
    component_id: opts.component_id ?? 'comp-x',
    component_responsibility: 'do work',
    description: `Implement ${id}`,
    backing_tool: 'claude_code_cli',
    estimated_complexity: 'medium',
    completion_criteria: [{
      criterion_id: `cc-${id}`,
      description: `${id} works`,
      verification_method: 'test_execution',
    }],
    write_directory_paths: opts.write_directory_paths,
    dependency_task_ids: opts.dependency_task_ids,
    release_id: opts.release_id ?? null,
    release_ordinal: opts.release_ordinal ?? null,
  };
}

describe('sliceLeavesIntoWaves', () => {
  it('returns empty when no leaves', () => {
    expect(sliceLeavesIntoWaves([], [])).toEqual([]);
  });

  it('falls back to single-wave when no releases declared', () => {
    const leaves = [leaf('a'), leaf('b')];
    const waves = sliceLeavesIntoWaves(leaves, []);
    expect(waves).toHaveLength(1);
    expect(waves[0].kind).toBe('single');
    expect(waves[0].leaves).toHaveLength(2);
  });

  it('slices by release ordinal in ascending order', () => {
    const leaves = [
      leaf('a3', { release_id: 'r3', release_ordinal: 3 }),
      leaf('a1', { release_id: 'r1', release_ordinal: 1 }),
      leaf('a2', { release_id: 'r2', release_ordinal: 2 }),
    ];
    const waves = sliceLeavesIntoWaves(leaves, [
      { release_id: 'r1', release_ordinal: 1, release_name: 'R1' },
      { release_id: 'r2', release_ordinal: 2, release_name: 'R2' },
      { release_id: 'r3', release_ordinal: 3, release_name: 'R3' },
    ]);
    expect(waves.map(w => w.release_id)).toEqual(['r1', 'r2', 'r3']);
    expect(waves[0].leaves[0].id).toBe('a1');
  });

  it('places null-release leaves into a backlog wave at the end', () => {
    const leaves = [
      leaf('a1', { release_id: 'r1', release_ordinal: 1 }),
      leaf('orphan'),
    ];
    const waves = sliceLeavesIntoWaves(leaves, [
      { release_id: 'r1', release_ordinal: 1, release_name: 'R1' },
    ]);
    expect(waves).toHaveLength(2);
    expect(waves[1].release_id).toBeNull();
    expect(waves[1].release_name).toBe('Backlog');
    expect(waves[1].leaves[0].id).toBe('orphan');
  });

  it('skips releases that have no matching leaves', () => {
    const leaves = [leaf('a1', { release_id: 'r1', release_ordinal: 1 })];
    const waves = sliceLeavesIntoWaves(leaves, [
      { release_id: 'r1', release_ordinal: 1, release_name: 'R1' },
      { release_id: 'r2', release_ordinal: 2, release_name: 'R2' },
    ]);
    expect(waves).toHaveLength(1);
    expect(waves[0].release_id).toBe('r1');
  });
});

describe('topoSortRespectingWave', () => {
  it('orders by in-wave dependencies', () => {
    const a = leaf('a');
    const b = leaf('b', { dependency_task_ids: ['a'] });
    const c = leaf('c', { dependency_task_ids: ['b'] });
    const inWave = new Set(['a', 'b', 'c']);
    const ordered = topoSortRespectingWave([c, b, a], inWave);
    expect(ordered.map(l => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores cross-wave dependencies', () => {
    const a = leaf('a');
    const b = leaf('b', { dependency_task_ids: ['external-from-other-wave'] });
    const inWave = new Set(['a', 'b']);
    const ordered = topoSortRespectingWave([a, b], inWave);
    expect(ordered).toHaveLength(2);
  });

  it('appends cycle-participants in input order so they still run', () => {
    const a = leaf('a', { dependency_task_ids: ['b'] });
    const b = leaf('b', { dependency_task_ids: ['a'] });
    const inWave = new Set(['a', 'b']);
    const ordered = topoSortRespectingWave([a, b], inWave);
    expect(ordered).toHaveLength(2);
    const ids = ordered.map(l => l.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('diffWaveSnapshots', () => {
  function snap(p: string, hash: string | null, size = 0): FileSnapshot {
    return { path: p, hash, size };
  }
  it('classifies created / modified / deleted / unchanged correctly', () => {
    const pre = new Map<string, FileSnapshot>();
    const post = new Map<string, FileSnapshot>();
    pre.set('/a', snap('/a', 'h1', 10));
    post.set('/a', snap('/a', 'h2', 12)); // modified
    post.set('/b', snap('/b', 'h3', 5));  // created
    pre.set('/c', snap('/c', 'h4', 20));  // deleted
    pre.set('/d', snap('/d', 'h5', 7));
    post.set('/d', snap('/d', 'h5', 7));  // unchanged
    const diff = diffWaveSnapshots(pre, post);
    expect(diff.created).toBe(1);
    expect(diff.modified).toBe(1);
    expect(diff.deleted).toBe(1);
    const ops = diff.files.map(f => `${f.path}:${f.operation}`).sort();
    expect(ops).toEqual(['/a:modified', '/b:created', '/c:deleted', '/d:unchanged']);
  });
});

describe('detectOverlapConflicts', () => {
  it('returns empty when each file has one writer', () => {
    const conflicts = detectOverlapConflicts([
      { leafTaskId: 'a', writtenFiles: ['/x'] },
      { leafTaskId: 'b', writtenFiles: ['/y'] },
    ]);
    expect(conflicts).toEqual([]);
  });
  it('flags files written by 2+ leaves', () => {
    const conflicts = detectOverlapConflicts([
      { leafTaskId: 'a', writtenFiles: ['/x', '/shared'] },
      { leafTaskId: 'b', writtenFiles: ['/shared'] },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe('/shared');
    expect(conflicts[0].leaves.sort()).toEqual(['a', 'b']);
  });
});

describe('QuarantineLedger.buildAugmentedContext', () => {
  it('summarizes prior reasoning_review flaws into retry hint text', () => {
    const prior: TaskQuarantineContent = {
      kind: 'task_quarantine',
      leaf_task_id: 'leaf-1',
      wave_number: 1,
      release_id: 'r1',
      release_ordinal: 1,
      attempts: [
        {
          attempt_number: 1,
          invocation_id: 'inv-1',
          outcome: 'reasoning_review_failed',
          reasoning_review_flaws: [
            { flaw_type: 'completeness_shortcut', severity: 'high', description: 'no real edits' },
          ],
        },
        {
          attempt_number: 2,
          invocation_id: 'inv-2',
          outcome: 'tests_failed',
          test_failures: ['1 failed / 0 passed (exit 1)'],
        },
      ],
      quarantine_reason: 'tests_failed (1 failed / 0 passed)',
      rescue_status: 'pending',
      quarantined_at: '2026-04-28T00:00:00Z',
    };
    const text = QuarantineLedger.buildAugmentedContext(prior);
    expect(text).toContain('quarantined after 2 attempts');
    expect(text).toContain('completeness_shortcut');
    expect(text).toContain('tests_failed');
    expect(text).toContain('Failing tests');
    expect(text).toContain('address each flaw');
  });
});

describe('collapseLegacySectionsWhenPacketPresent — Path N #6', () => {
  const sample = [
    '[JC:SYSTEM SCOPE]',
    '',
    '# CONTEXT SUMMARY',
    '',
    '## Component Context',
    'Name: Foo (comp-foo)',
    'Responsibility: do x; do y',
    '',
    '## Component Model Summary',
    'Foo bar baz.',
    '',
    '## Test Cases to Implement',
    '- [TC-001] (integration) when X, then Y',
    '',
    "## Evaluation Criteria (filtered to this task's component)",
    '- [US-001] something',
    '',
    '## Dependency Tasks (already completed)',
    '(no dependency tasks)',
    '',
    '## Upstream Validator Findings (HIGH/MEDIUM against motivating artifacts)',
    '(none)',
  ].join('\n');

  it('replaces duplicated section bodies with a pointer when packet is present', () => {
    const out = collapseLegacySectionsWhenPacketPresent(sample);
    // Headings are preserved.
    expect(out).toContain('## Component Context');
    expect(out).toContain('## Component Model Summary');
    expect(out).toContain('## Test Cases to Implement');
    expect(out).toContain("## Evaluation Criteria (filtered to this task's component)");
    // Bodies are collapsed.
    expect(out).not.toContain('Responsibility: do x; do y');
    expect(out).not.toContain('Foo bar baz.');
    expect(out).not.toContain('TC-001');
    expect(out).not.toContain('[US-001] something');
    // Pointer appears in each suppressed section.
    expect((out.match(/Implementation Packet Context/g) ?? []).length).toBe(4);
  });

  it('does NOT touch sections that are not duplicated by the packet', () => {
    const out = collapseLegacySectionsWhenPacketPresent(sample);
    expect(out).toContain('## Dependency Tasks (already completed)');
    expect(out).toContain('(no dependency tasks)');
    expect(out).toContain('## Upstream Validator Findings (HIGH/MEDIUM against motivating artifacts)');
    expect(out).toContain('(none)');
  });

  it('is idempotent when run twice', () => {
    const once = collapseLegacySectionsWhenPacketPresent(sample);
    const twice = collapseLegacySectionsWhenPacketPresent(once);
    expect(twice).toBe(once);
  });
});

describe('buildWorkspaceOrientation — Path N #5/#8', () => {
  it('reports greenfield when the workspace exists and is empty', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'janum-ws-empty-'));
    try {
      const out = buildWorkspaceOrientation(tmp, ['src/services/abuse-notification']);
      expect(out).toContain('# Workspace Orientation');
      expect(out).toContain(tmp);
      expect(out).toContain('greenfield');
      expect(out).toContain('`src/services/abuse-notification` (does not exist — create it)');
      expect(out).toContain('Do not spend tool calls probing');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('reports existing brownfield when workspace has top-level entries', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'janum-ws-brown-'));
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{}');
      fs.mkdirSync(path.join(tmp, 'src'));
      const out = buildWorkspaceOrientation(tmp, []);
      expect(out).toContain('existing');
      expect(out).toContain('2 top-level entries');
      expect(out).toContain('treat as brownfield');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('marks each write-scope path as exists / does not exist', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'janum-ws-mixed-'));
    try {
      fs.mkdirSync(path.join(tmp, 'src', 'services', 'abuse-notification'), { recursive: true });
      const out = buildWorkspaceOrientation(tmp, [
        'src/services/abuse-notification',
        'src/services/missing',
      ]);
      expect(out).toContain('`src/services/abuse-notification` (exists)');
      expect(out).toContain('`src/services/missing` (does not exist — create it)');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('reports "not yet created" when the workspace path itself does not exist', () => {
    const ghost = path.join(os.tmpdir(), `janum-ws-ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const out = buildWorkspaceOrientation(ghost, ['src/foo']);
    expect(out).toContain('not yet created');
    expect(out).toContain('orchestrator will mkdir');
  });
});
