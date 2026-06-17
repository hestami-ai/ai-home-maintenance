/**
 * Scaffolding agent (Stage 1+2 inc.2) — pure helpers. The executor invocation
 * + manifest-presence check are exercised in the Phase-9 e2e harness.
 */
import { describe, it, expect } from 'vitest';
import { areaWriteScope, areaRoot } from '../../../../lib/orchestrator/phases/scaffoldingAgent';
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
