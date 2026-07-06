/**
 * PD-3 (P9 prompt audit) — the scaffold layout section rendered three roots from
 * independent sources that could disagree: the area's declared `source_roots`
 * (recon/LLM, e.g. `src/portal-web`), the `@shared/*` alias TARGET, and the
 * per-component dirs (`canonicalComponentDir` → `src/<comp>`). When the declared
 * root was not the canonical one, the scaffolder could not resolve where `@shared`
 * or the component dirs actually land (→ invented fields, 0 artifacts). These tests
 * pin `reconcileAreaLayout` (all three rebased to ONE tree derived from the
 * component-dir map = the layout authority) + the internally-consistent prompt.
 */
import { describe, it, expect } from 'vitest';
import { reconcileAreaLayout, buildAreaScaffoldingPrompt } from '../../../../lib/orchestrator/phases/scaffoldingAgent';

const compDirs = (roots: string[]) => roots.map(r => ({ id: `comp-${r.split('/').pop()}`, dir: r }));

// A minimal recon area (only the fields the layout render/reconcile touch).
const area = (over: Partial<Record<string, unknown>> = {}) => ({
  area_id: 'portal_web',
  description: '',
  stack: 'node',
  confidence: 'high' as const,
  source_refs: [], conflicts: [], alternatives_rejected: [],
  source_roots: ['src'],
  test_roots: ['src'],
  protected_paths: [], dependency_manifest: 'package.json',
  canonical_modules: [],
  import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }, { alias: '@/*', target: 'src/*' }],
  gate_commands: [],
  ...over,
}) as unknown as Parameters<typeof buildAreaScaffoldingPrompt>[0];

describe('reconcileAreaLayout (PD-3)', () => {
  it('leaves the coherent greenfield case untouched (src root, @shared→src/shared/*)', () => {
    const l = reconcileAreaLayout(area(), compDirs(['src/a', 'src/b']));
    expect(l.sourceRoot).toBe('src');
    expect(l.sharedDir).toBe('src/shared');
    expect(l.aliases).toContainEqual({ alias: '@shared/*', target: 'src/shared/*' });
    expect(l.aliases).toContainEqual({ alias: '@/*', target: 'src/*' });
    expect(l.reconciledFrom).toEqual([]);
  });

  it('overrides a declared root that the component dirs do NOT sit under', () => {
    const l = reconcileAreaLayout(area({ source_roots: ['src/portal-web'], test_roots: ['src/portal-web'] }),
      compDirs(['src/a', 'src/b']));
    expect(l.sourceRoot).toBe('src');               // authority = where the component dirs sit
    expect(l.reconciledFrom).toEqual(['src/portal-web']);
    expect(l.testRoots).toEqual(['src']);           // tests follow the overridden root
  });

  it('rebases stale alias targets onto the coherent tree', () => {
    const l = reconcileAreaLayout(
      area({ import_aliases: [{ alias: '@shared/*', target: 'portal-web/shared/*' }, { alias: '@/*', target: 'portal-web/*' }] }),
      compDirs(['src/a', 'src/b']));
    expect(l.aliases).toContainEqual({ alias: '@shared/*', target: 'src/shared/*' });
    expect(l.aliases).toContainEqual({ alias: '@/*', target: 'src/*' });
  });

  it('treats a repo-root ("." / unset) declaration as coherent, not a disagreement', () => {
    const l = reconcileAreaLayout(area({ source_roots: ['.'] }), compDirs(['src/a', 'src/b']));
    expect(l.sourceRoot).toBe('src');
    expect(l.reconciledFrom).toEqual([]);
  });

  it('derives a NESTED tree root from the component dirs (not hardcoded src)', () => {
    const l = reconcileAreaLayout(area({ source_roots: ['services/api'] }),
      compDirs(['services/api/src/a', 'services/api/src/b']));
    expect(l.sourceRoot).toBe('services/api/src');
    expect(l.sharedDir).toBe('services/api/src/shared');
    // 'services/api' IS an ancestor of the derived root → coherent, not overridden.
    expect(l.reconciledFrom).toEqual([]);
  });

  it('falls back to src when there are no component dirs to derive from', () => {
    const l = reconcileAreaLayout(area({ source_roots: [] }), []);
    expect(l.sourceRoot).toBe('src');
    expect(l.sharedDir).toBe('src/shared');
  });
});

describe('buildAreaScaffoldingPrompt layout coherence (PD-3)', () => {
  it('renders ONE root; the stale declared root never appears', () => {
    const prompt = buildAreaScaffoldingPrompt(
      area({ source_roots: ['src/portal-web'], test_roots: ['src/portal-web'] }),
      '(none)', '(none)', compDirs(['src/portal', 'src/media']));
    // Single coherent tree rooted at src — alias, shared dir, and component dirs all agree.
    expect(prompt).toContain('rooted at `src/`');
    expect(prompt).toContain('shared module dir: src/shared/');
    expect(prompt).toContain('@shared/* → src/shared/*');
    expect(prompt).toContain('- comp-portal → src/portal/');
    // the discarded per-area root must NOT leak into the prompt (that was the contradiction)
    expect(prompt).not.toContain('portal-web');
  });

  it('is internally consistent — the alias target dir is the SAME as the shared module dir', () => {
    const prompt = buildAreaScaffoldingPrompt(
      area({ import_aliases: [{ alias: '@shared/*', target: 'wrong/place/*' }] }),
      '(none)', '(none)', compDirs(['src/a']));
    expect(prompt).toContain('shared module dir: src/shared/');
    expect(prompt).toContain('@shared/* → src/shared/*');
    expect(prompt).not.toContain('wrong/place');
  });
});
