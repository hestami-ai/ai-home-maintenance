/**
 * PA-13(2a) — the task_skeleton template rendered {{active_constraints}} TWICE:
 * once at the top under "GOVERNING CONSTRAINTS (apply without exception)" and
 * again in the [INPUT] "# Active constraints" section. Both filled with the
 * same (several-KB) dmr.activeConstraintsText — the only template of 29 with
 * count=2 (D4 intra-prompt duplication). The [INPUT] copy is now a one-line
 * pointer; this pins the single-injection invariant.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
const rel = 'prompts/phases/phase_06_implementation_planning/implementation_task_decomposition.system.md';

describe('PA-13(2a) — task_skeleton injects active_constraints exactly once', () => {
  const body = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');

  it('renders {{active_constraints}} exactly once', () => {
    const count = (body.match(/\{\{active_constraints\}\}/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('keeps the authoritative top GOVERNING CONSTRAINTS anchor + a pointer in [INPUT]', () => {
    expect(body).toContain('GOVERNING CONSTRAINTS (apply without exception)');
    // the [INPUT] section now references the top block instead of re-injecting.
    expect(body).toContain('stated once at the top under GOVERNING CONSTRAINTS');
  });
});
