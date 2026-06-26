/**
 * Scaffolding agent (Stage 1+2 inc.2) — pure helpers. The executor invocation
 * + manifest-presence check are exercised in the Phase-9 e2e harness.
 */
import { describe, it, expect } from 'vitest';
import { areaWriteScope, areaRoot, buildAreaScaffoldingPrompt } from '../../../../lib/orchestrator/phases/scaffoldingAgent';
import type { ReconArea } from '../../../../lib/orchestrator/phases/phase9Recon';

function area(id: string, src: string[], test: string[] = []): ReconArea {
  return {
    area_id: id, description: '', stack: 'node', confidence: 'high',
    source_refs: [], conflicts: [], alternatives_rejected: [],
    source_roots: src, test_roots: test,
    protected_paths: [], dependency_manifest: 'package.json', canonical_modules: [], import_aliases: [],
    gate_commands: [],
  };
}

describe('buildAreaScaffoldingPrompt — stack genericity', () => {
  it('python area: no JS jargon (barrel/package.json), uses pyproject.toml + idiomatic specifier, no alias line', () => {
    const py: ReconArea = {
      ...area('core', ['src'], ['tests']), stack: 'python', dependency_manifest: 'pyproject.toml',
      canonical_modules: [{ path: 'src/shared/db.py', import_specifier: 'shared.db', description: 'DB layer' }],
      import_aliases: [], // python has no path aliases
    };
    const prompt = buildAreaScaffoldingPrompt(py, '[]', '[]', [{ id: 'comp-x', dir: 'src/x' }]);
    expect(prompt).toContain('stack: python');
    expect(prompt).not.toMatch(/barrel/i);           // no JS/TS jargon
    expect(prompt).not.toContain('package.json');     // no JS manifest fallback
    expect(prompt).toContain('pyproject.toml');
    expect(prompt).toContain('shared.db');            // stack-idiomatic specifier rendered
    expect(prompt).not.toMatch(/import aliases/);     // empty aliases → no line
    expect(prompt).toMatch(/__init__\.py/);           // python package-init guidance
    // skeleton-vs-materialize contradiction resolved
    expect(prompt).toMatch(/type.*definition.*IS skeleton/i);
  });

  it('node area WITH aliases: renders the alias line; unset manifest falls back to a stack-neutral hint (not package.json)', () => {
    const node: ReconArea = {
      ...area('web', ['src']), import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }],
    };
    expect(buildAreaScaffoldingPrompt(node, '[]', '[]', []))
      .toContain('import aliases (node): @shared/* → src/shared/*');

    const rustNoManifest: ReconArea = { ...area('svc', ['src']), stack: 'rust', dependency_manifest: '' };
    const prompt = buildAreaScaffoldingPrompt(rustNoManifest, '[]', '[]', []);
    expect(prompt).toContain('(the rust standard manifest)');
    expect(prompt).not.toContain('package.json');
  });
});

describe('areaWriteScope', () => {
  it('greenfield area at src → includes the root (manifest) and src', () => {
    const scope = areaWriteScope(area('web', ['src'], ['src/__tests__']));
    expect(scope).toContain('.'); // areaRoot('src') — where package.json lives
    expect(scope).toContain('src');
    expect(scope).toContain('src/__tests__');
  });
  it('sub-tree area → scoped to its own subtree, not the whole workspace', () => {
    const scope = areaWriteScope(area('engine', ['crates/engine/src']));
    expect(scope).toContain('crates/engine'); // area root for its Cargo.toml
    expect(scope).toContain('crates/engine/src');
    expect(scope).not.toContain('.'); // does NOT claim the workspace root
  });
});

describe('areaRoot', () => {
  it('drops the trailing source segment to find the area root', () => {
    expect(areaRoot('src')).toBe('.');
    expect(areaRoot('services/billing/src')).toBe('services/billing');
    expect(areaRoot('crates/engine/')).toBe('crates'); // trailing slash trimmed
  });
});
