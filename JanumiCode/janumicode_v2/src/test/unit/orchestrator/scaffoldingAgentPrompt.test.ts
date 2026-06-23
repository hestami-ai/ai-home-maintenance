/**
 * Regression (slice-151 layout divergence): the area scaffolding prompt must
 * carry the CANONICAL component→directory map (the same `src/<slug>` paths the
 * Phase-6 task `write_directory_paths` use and Phase 10 enforces) and forbid any
 * alternative per-component layout.
 *
 * Before the fix the prompt listed component data models under "materialize the
 * types this area exposes" with NO directory paths ("canonical_modules" empty →
 * "none listed — derive…"), so the scaffold agent invented `src/components/<comp>/`
 * while implementation tasks wrote to `src/<comp>/` → divergent duplicate modules.
 */

import { describe, it, expect } from 'vitest';
import { buildAreaScaffoldingPrompt } from '../../../lib/orchestrator/phases/scaffoldingAgent';

const AREA = {
  area_id: 'workspace',
  stack: 'node',
  confidence: 'low',
  source_refs: [],
  conflicts: [],
  alternatives_rejected: [],
  source_roots: ['src'],
  test_roots: ['src'],
  protected_paths: [],
  dependency_manifest: 'package.json',
  canonical_modules: [],
  import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }],
  gate_commands: [],
} as never;

const COMPONENT_DIRS = [
  { id: 'comp-analytics-ingestion', dir: 'src/analytics-ingestion' },
  { id: 'comp-url-shortener', dir: 'src/url-shortener' },
];

describe('buildAreaScaffoldingPrompt — canonical component-dir contract', () => {
  it('renders the canonical per-component directories the impl tasks write to', () => {
    const p = buildAreaScaffoldingPrompt(AREA, '[]', '[]', COMPONENT_DIRS);
    expect(p).toContain('## Component directories (canonical');
    expect(p).toContain('comp-analytics-ingestion → src/analytics-ingestion/');
    expect(p).toContain('comp-url-shortener → src/url-shortener/');
  });

  it('forbids the invented `components/` subtree convention (the only place it may appear)', () => {
    const p = buildAreaScaffoldingPrompt(AREA, '[]', '[]', COMPONENT_DIRS);
    expect(p).toContain('components/` subtree');
    // `src/components/` must appear ONLY inside the prohibition rule — never as a
    // layout the agent is invited to use.
    const occurrences = (p.match(/src\/components\//g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('directs shared data models + contracts to the shared dir, not per-component', () => {
    const p = buildAreaScaffoldingPrompt(AREA, '[]', '[]', COMPONENT_DIRS);
    expect(p).toContain('Shared data models — materialize as SHARED types');
    expect(p).toContain('NOT per-component');
  });

  it('omits the component-directories block when no dirs are supplied (back-compat)', () => {
    const p = buildAreaScaffoldingPrompt(AREA, '[]', '[]', []);
    expect(p).not.toContain('## Component directories');
  });
});
