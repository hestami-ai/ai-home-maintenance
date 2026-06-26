/**
 * Composition Root — the deterministic Phase-9 "make it run" injection.
 * Slice-144: app bootstrap was nobody's task → parts-bin output (no
 * entrypoint, framework type-shimmed). The synthetic leaf must run last,
 * own the global gate, and derive smoke criteria from interface contracts.
 */
import { describe, it, expect } from 'vitest';
import { buildCompositionRootLeaf, COMPOSITION_ROOT_TASK_ID } from '../../../../lib/orchestrator/phases/compositionRoot';
import { extractDeclaredDependencies } from '../../../../lib/orchestrator/phases/scaffoldSynthesis';
import type { SchedulerLeaf } from '../../../../lib/orchestrator/executionScheduler';
import type { ScaffoldManifest } from '../../../../lib/orchestrator/phases/scaffoldSynthesis';

const leaves: SchedulerLeaf[] = [
  { id: 't-a', task_type: 'standard', component_id: 'comp-a', component_responsibility: '', description: '', estimated_complexity: 'low', completion_criteria: [] },
  { id: 't-b', task_type: 'standard', component_id: 'comp-b', component_responsibility: '', description: '', estimated_complexity: 'low', completion_criteria: [] },
];

const manifest = { profile: { language: 'typescript' } } as unknown as ScaffoldManifest;

describe('buildCompositionRootLeaf', () => {
  it('depends on every leaf, carries no release, and owns the src-wide (global) gate', () => {
    const root = buildCompositionRootLeaf(leaves, manifest, []);
    expect(root.id).toBe(COMPOSITION_ROOT_TASK_ID);
    expect(root.dependency_task_ids).toEqual(['t-a', 't-b']);
    expect(root.release_id).toBeNull();
    expect(root.release_ordinal).toBeNull();
    expect(root.write_directory_paths).toEqual(['src']); // scoped runner ⇒ full suite
    expect(root._composition_root).toBe(true);
  });

  it('derives one smoke criterion per interface contract + the fixed gates', () => {
    const root = buildCompositionRootLeaf(leaves, manifest, [
      { id: 'C-API-CREATE', protocol: 'HTTP' },
      { id: 'C-DB-QUERY', protocol: 'PostgreSQL wire protocol' },
    ]);
    const ids = root.completion_criteria.map((c) => c.criterion_id);
    expect(ids).toContain('CC-COMP-001'); // entrypoint boots
    expect(ids).toContain('CC-COMP-002'); // real deps, no shims
    expect(ids).toContain('CC-COMP-003'); // tsc + full suite
    expect(ids).toContain('CC-COMP-SMOKE-001');
    expect(ids).toContain('CC-COMP-SMOKE-002');
    expect(root.description).toContain('C-API-CREATE');
    expect(root.description).toContain('comp-a, comp-b');
  });

  it('stays generic — instructs installing what the code imports, names no framework', () => {
    const root = buildCompositionRootLeaf(leaves, manifest, []);
    expect(root.description).toMatch(/any package the code imports/i);
    expect(root.description).not.toMatch(/fastify|express|koa|pg\b/i);
  });

  it('uses the .js entrypoint for javascript profiles', () => {
    const jsManifest = { profile: { language: 'javascript' } } as unknown as ScaffoldManifest;
    const root = buildCompositionRootLeaf(leaves, jsManifest, []);
    expect(root.description).toContain('src/index.js');
  });

  it('python profile: src/main.py entrypoint + pyproject.toml manifest, never src/index.ts or package.json', () => {
    const pyManifest = { profile: { language: 'python' } } as unknown as ScaffoldManifest;
    const root = buildCompositionRootLeaf(leaves, pyManifest, []);
    expect(root.description).toContain('src/main.py');
    expect(root.description).toContain('pyproject.toml');
    expect(root.description).not.toContain('src/index.ts');
    expect(root.description).not.toContain('package.json');
    expect(root.completion_criteria?.some(c => c.artifact_ref === 'pyproject.toml')).toBe(true);
  });
});

describe('extractDeclaredDependencies (generic, structured-only)', () => {
  it('returns empty for null / prose-only artifacts (never name-guesses)', () => {
    expect(extractDeclaredDependencies(null)).toEqual({});
    expect(extractDeclaredDependencies({ decisions: [{ decision: 'Use Fastify with PostgreSQL' }] })).toEqual({});
  });

  it('absorbs string arrays with optional ranges, including scoped packages', () => {
    expect(extractDeclaredDependencies({ dependencies: ['fastify', 'pg@^8.11', '@scope/pkg', '@scope/pkg2@~1.2'] }))
      .toEqual({ fastify: '*', pg: '^8.11', '@scope/pkg': '*', '@scope/pkg2': '~1.2' });
  });

  it('absorbs map form and nested tech_stack/project_profile on decisions', () => {
    expect(extractDeclaredDependencies({
      decisions: [
        { tech_stack: { dependencies: { fastify: '^4.0.0' } } },
        { project_profile: { runtime_dependencies: ['pg@^8'] } },
      ],
    })).toEqual({ fastify: '^4.0.0', pg: '^8' });
  });
});
