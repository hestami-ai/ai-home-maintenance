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
  detectSandboxEscapes,
  isTestFilePath,
  orderLeavesByOwnershipRank,
  buildLeafDistribution,
  accumulateTestTotals,
  buildQuarantineReason,
  collectOwnedTestFiles,
  buildScopeViolationOutcome,
  buildHighSeverityOutcome,
  buildSandboxEscapeOutcome,
  type SchedulerLeaf,
} from '../../../lib/orchestrator/executionScheduler';
import {
  diffWaveSnapshots,
  detectOverlapConflicts,
  type FileSnapshot,
} from '../../../lib/orchestrator/workspaceSnapshot';
import { QuarantineLedger } from '../../../lib/orchestrator/quarantineLedger';
import type { TaskQuarantineContent, QuarantineAttemptEntry } from '../../../lib/types/records';
import type { ModuleOwnershipPlan, OrderingEdge } from '../../../lib/orchestrator/phases/moduleOwnershipPlanner';
import type { LeafTestRunResult } from '../../../lib/orchestrator/leafTestRunner';
import type { ExecutionResult } from '../../../lib/agents/executorAgent';

describe('isTestFilePath — file-level test detection (attribution)', () => {
  it('matches common test conventions across stacks', () => {
    for (const p of [
      'src/url-validator/validator.test.ts',
      'src/a/stats.spec.ts',
      'src/b/handler_test.go',
      'pkg/mod/test_views.py',
      'src/c/__tests__/foo.ts',
      'tests/integration/boot.ts',
    ]) expect(isTestFilePath(p)).toBe(true);
  });
  it('does NOT match implementation files', () => {
    for (const p of [
      'src/url-validator/validator.ts',
      'src/a/index.ts',
      'src/b/handler.go',
      'src/contest/latest.ts', // "test" as a substring, not a test file
    ]) expect(isTestFilePath(p)).toBe(false);
  });
});

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

describe('detectSandboxEscapes — out-of-project-root write guard', () => {
  const root = path.join(path.sep, 'ws', 'thin-slice-workspace-150', 'project');
  const mk = (filePath: string, operation: 'create' | 'modify' | 'delete' = 'create') => ({ filePath, operation });

  it('passes relative in-sandbox writes', () => {
    expect(detectSandboxEscapes([mk('src/foo.ts'), mk('internal/x/y.go')], root)).toEqual([]);
  });

  it('passes absolute writes that resolve INSIDE the project root', () => {
    expect(detectSandboxEscapes([mk(path.join(root, 'src', 'foo.ts'))], root)).toEqual([]);
  });

  it('flags a parent-climbing (`..`) write as an escape', () => {
    const escapes = detectSandboxEscapes([mk('../../thin-slice-workspace150/x.go')], root);
    expect(escapes.length).toBe(1);
    expect(escapes[0]).not.toMatch(/\\/); // POSIX-normalized
  });

  it('flags an absolute write OUTSIDE the project root', () => {
    const outside = path.join(path.sep, 'ws', 'thin-slice-workspaces150', 'keystore.go');
    expect(detectSandboxEscapes([mk(outside)], root)).toEqual([outside.split(path.sep).join('/')]);
  });

  it('ignores deletes', () => {
    expect(detectSandboxEscapes([mk('../escape.go', 'delete')], root)).toEqual([]);
  });
});

describe('buildWorkspaceOrientation — Path N #5/#8', () => {
  it('reports greenfield when the workspace exists and is empty', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'janum-ws-empty-'));
    try {
      const out = buildWorkspaceOrientation(tmp, ['src/services/abuse-notification']);
      expect(out).toContain('# Workspace Orientation');
      // The absolute workspace root is deliberately NOT printed (sandbox-escape
      // mangling vector); the agent is steered to relative paths instead.
      expect(out).not.toContain(tmp);
      expect(out).not.toContain(tmp.replace(/\\/g, '/'));
      expect(out).toMatch(/RELATIVE to it/);
      expect(out).toMatch(/NEVER use an absolute path/);
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

// ── Characterization tests for helpers extracted during the S3776
//    cognitive-complexity refactor of biasLeavesByOwnership / runWave /
//    runLeafAttempt. These pin the CURRENT observable behavior of the pure
//    building blocks those methods now delegate to. ─────────────────────────

function ownershipPlan(edges: OrderingEdge[]): ModuleOwnershipPlan {
  return {
    kind: 'module_ownership_plan',
    schemaVersion: '1.0',
    shared_modules: [],
    ordering_edges: edges,
  };
}
function edge(before: string, after: string): OrderingEdge {
  return { before_component_id: before, after_component_id: after, module_key: `${before}->${after}` };
}

describe('orderLeavesByOwnershipRank — producer-before-consumer bias', () => {
  it('returns the SAME array (no-op) when there is no plan', () => {
    const ls = [leaf('a'), leaf('b')];
    expect(orderLeavesByOwnershipRank(ls, null)).toBe(ls);
  });

  it('returns the SAME array (no-op) when the plan has no ordering edges', () => {
    const ls = [leaf('a'), leaf('b')];
    expect(orderLeavesByOwnershipRank(ls, ownershipPlan([]))).toBe(ls);
  });

  it('orders a producer component ahead of its consumer', () => {
    const ls = [leaf('b', { component_id: 'compB' }), leaf('a', { component_id: 'compA' })];
    // compA must run before compB.
    const ordered = orderLeavesByOwnershipRank(ls, ownershipPlan([edge('compA', 'compB')]));
    expect(ordered.map(l => l.id)).toEqual(['a', 'b']);
  });

  it('is a stable sort — preserves input order within the same rank', () => {
    const ls = [
      leaf('c1', { component_id: 'compC' }),
      leaf('a1', { component_id: 'compA' }),
      leaf('a2', { component_id: 'compA' }),
    ];
    // compA (rank 0) before compC (rank 1); a1 before a2 (tie → input order).
    const ordered = orderLeavesByOwnershipRank(ls, ownershipPlan([edge('compA', 'compC')]));
    expect(ordered.map(l => l.id)).toEqual(['a1', 'a2', 'c1']);
  });

  it('degrades gracefully on a component cycle (tied ranks → stable original order, no throw)', () => {
    const ls = [leaf('b', { component_id: 'compB' }), leaf('a', { component_id: 'compA' })];
    const plan = ownershipPlan([edge('compA', 'compB'), edge('compB', 'compA')]);
    const ordered = orderLeavesByOwnershipRank(ls, plan);
    expect(ordered.map(l => l.id)).toEqual(['b', 'a']);
  });

  it('ignores ordering edges whose components are absent from the wave', () => {
    const ls = [leaf('a', { component_id: 'compA' }), leaf('b', { component_id: 'compB' })];
    // Edge references a component not present → dropped → stable original order.
    const ordered = orderLeavesByOwnershipRank(ls, ownershipPlan([edge('compX', 'compY')]));
    expect(ordered.map(l => l.id)).toEqual(['a', 'b']);
  });
});

describe('buildLeafDistribution — per-component telemetry counts', () => {
  it('counts leaves by component_id', () => {
    const dist = buildLeafDistribution([
      leaf('a', { component_id: 'c1' }),
      leaf('b', { component_id: 'c1' }),
      leaf('c', { component_id: 'c2' }),
    ]);
    expect(dist).toEqual({ c1: 2, c2: 1 });
  });
  it('returns an empty object for no leaves', () => {
    expect(buildLeafDistribution([])).toEqual({});
  });
});

describe('accumulateTestTotals — folds one attempt into running wave totals', () => {
  const mkTest = (passed: number, failed: number, skipped: number): LeafTestRunResult => ({
    passed: failed === 0,
    passedCount: passed,
    failedCount: failed,
    skippedCount: skipped,
    exitCode: failed === 0 ? 0 : 1,
    durationMs: 1,
  });

  it('sums counts and increments leaves_with_failing_tests only when failures > 0', () => {
    const totals = { passed: 0, failed: 0, skipped: 0, leaves_with_failing_tests: 0 };
    accumulateTestTotals(totals, mkTest(3, 2, 1));
    expect(totals).toEqual({ passed: 3, failed: 2, skipped: 1, leaves_with_failing_tests: 1 });
    accumulateTestTotals(totals, mkTest(1, 0, 0));
    expect(totals).toEqual({ passed: 4, failed: 2, skipped: 1, leaves_with_failing_tests: 1 });
  });
});

describe('buildQuarantineReason — final-attempt reason string', () => {
  const attempt = (o: Partial<QuarantineAttemptEntry>): QuarantineAttemptEntry => ({
    attempt_number: 1,
    invocation_id: 'inv',
    outcome: 'execution_failed',
    ...o,
  });

  it('falls back to execution_failed (unspecified) when there is no attempt', () => {
    expect(buildQuarantineReason(undefined)).toBe('execution_failed (unspecified)');
  });

  it('lists reasoning-review flaw types', () => {
    const r = buildQuarantineReason(attempt({
      outcome: 'reasoning_review_failed',
      reasoning_review_flaws: [
        { flaw_type: 'x', severity: 'high' },
        { flaw_type: 'y', severity: 'high' },
      ],
    }));
    expect(r).toBe('reasoning_review_failed (x, y)');
  });

  it('uses "unspecified" for a reasoning_review_failed attempt with no flaws', () => {
    expect(buildQuarantineReason(attempt({ outcome: 'reasoning_review_failed' })))
      .toBe('reasoning_review_failed (unspecified)');
  });

  it('lists at most the first 3 test failures', () => {
    const r = buildQuarantineReason(attempt({
      outcome: 'tests_failed',
      test_failures: ['f1', 'f2', 'f3', 'f4'],
    }));
    expect(r).toBe('tests_failed (f1, f2, f3)');
  });

  it('uses "unspecified" for a tests_failed attempt with no failures', () => {
    expect(buildQuarantineReason(attempt({ outcome: 'tests_failed' })))
      .toBe('tests_failed (unspecified)');
  });

  it('reports the error message for a plain execution_failed attempt', () => {
    expect(buildQuarantineReason(attempt({ outcome: 'execution_failed', error_message: 'boom' })))
      .toBe('execution_failed (boom)');
  });
});

describe('collectOwnedTestFiles — file-level test attribution', () => {
  const ws = path.join(path.sep, 'ws', 'proj');
  const abs = (rel: string) => path.join(ws, ...rel.split('/'));

  it('adds in-workspace, non-deleted test files only', () => {
    const owned = new Set<string>();
    collectOwnedTestFiles([
      { filePath: abs('src/foo.test.ts'), operation: 'create' },
      { filePath: abs('src/foo.ts'), operation: 'create' },       // not a test file
      { filePath: abs('src/bar.test.ts'), operation: 'delete' },  // deletes ignored
    ], ws, owned);
    expect([...owned]).toEqual(['src/foo.test.ts']);
  });

  it('accumulates across calls (dedup via the shared set)', () => {
    const owned = new Set<string>(['src/pre.test.ts']);
    collectOwnedTestFiles([{ filePath: abs('src/foo.test.ts'), operation: 'modify' }], ws, owned);
    collectOwnedTestFiles([{ filePath: abs('src/foo.test.ts'), operation: 'modify' }], ws, owned);
    expect([...owned].sort()).toEqual(['src/foo.test.ts', 'src/pre.test.ts']);
  });
});

describe('runLeafAttempt outcome builders — quarantine attempt entries', () => {
  const mkResult = (invocationId: string, filesWrittenCount: number): ExecutionResult => ({
    taskId: 't',
    success: true,
    invocationId,
    filesWritten: Array.from({ length: filesWrittenCount }, () => ({})),
    skippedIdempotent: false,
  } as unknown as ExecutionResult);

  it('buildScopeViolationOutcome cites the violating paths', () => {
    const out = buildScopeViolationOutcome(mkResult('inv-1', 2), ['src/shared/x.ts'], 3);
    expect(out.testResult).toBeNull();
    expect(out.invocationId).toBe('inv-1');
    expect(out.entry.attempt_number).toBe(3);
    expect(out.entry.invocation_id).toBe('inv-1');
    expect(out.entry.outcome).toBe('reasoning_review_failed');
    expect(out.entry.files_written_count).toBe(2);
    const flaw = (out.entry.reasoning_review_flaws ?? [])[0];
    expect(flaw.flaw_type).toBe('write_scope_violation');
    expect(flaw.severity).toBe('high');
    expect(flaw.description).toContain('src/shared/x.ts');
  });

  it('buildHighSeverityOutcome maps findings (summary truncated to 80, severity lowercased)', () => {
    const longSummary = 'S'.repeat(100);
    const out = buildHighSeverityOutcome(
      mkResult('inv-2', 1),
      [{ summary: longSummary, detail: 'D', severity: 'HIGH' }],
      1,
    );
    expect(out.entry.outcome).toBe('reasoning_review_failed');
    const flaw = (out.entry.reasoning_review_flaws ?? [])[0];
    expect(flaw.flaw_type).toBe('S'.repeat(80));
    expect(flaw.severity).toBe('high');
    expect(flaw.description).toBe('D');
    expect(out.entry.files_written_count).toBe(1);
  });

  it('buildSandboxEscapeOutcome cites the escape paths (rmSync on nonexistent is a no-op)', () => {
    const ghost = path.join(os.tmpdir(), `janum-escape-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'x.ts');
    const out = buildSandboxEscapeOutcome(mkResult('inv-3', 0), [ghost], leaf('esc-leaf'), 2);
    expect(out.testResult).toBeNull();
    expect(out.entry.attempt_number).toBe(2);
    expect(out.entry.outcome).toBe('reasoning_review_failed');
    const flaw = (out.entry.reasoning_review_flaws ?? [])[0];
    expect(flaw.flaw_type).toBe('write_scope_violation');
    expect(flaw.description).toContain(ghost);
    expect(out.entry.files_written_count).toBe(0);
  });
});
