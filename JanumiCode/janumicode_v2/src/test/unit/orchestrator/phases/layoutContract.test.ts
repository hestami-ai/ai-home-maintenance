/**
 * Unit tests for the Project Layout Contract (deterministic structure).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  canonicalComponentDir,
  normalizeComponentDirForStack,
  resolveWriteScopeForComponent,
  buildProjectLayoutContract,
  detectLayoutViolations,
  renderLayoutConventions,
} from '../../../../lib/orchestrator/phases/layoutContract';

describe('resolveWriteScopeForComponent — Phase-9 single write-scope authority', () => {
  it('greenfield python: component_id → stack-correct underscore dir', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-data-governance', isCompositionRoot: false, stack: 'python', workspaceKind: 'greenfield',
    })).toEqual(['src/data_governance']);
  });
  it('greenfield node: hyphenated dir (TS convention)', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-data-governance', isCompositionRoot: false, stack: 'node', workspaceKind: 'greenfield',
    })).toEqual(['src/data-governance']);
  });
  it('composition root → whole tree (never slugged)', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'composition_root', isCompositionRoot: true, stack: 'python', workspaceKind: 'greenfield',
    })).toEqual(['src']);
  });
  it('shared/cross_cutting → the shared dir', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'cross_cutting', isCompositionRoot: false, stack: 'python', workspaceKind: 'greenfield',
    })).toEqual(['src/shared']);
  });
  it('BROWNFIELD: returns null (keep persisted/detected dirs)', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-data-governance', isCompositionRoot: false, stack: 'python', workspaceKind: 'brownfield',
    })).toBeNull();
  });
  it('falls back to scaffoldSource when workspaceKind is absent', () => {
    // greenfield-ish scaffold (config_default/recon_stack) → resolve
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-x', isCompositionRoot: false, stack: 'python', scaffoldSource: 'recon_stack',
    })).toEqual(['src/x']);
    // brownfield_detected → null
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-x', isCompositionRoot: false, stack: 'python', scaffoldSource: 'brownfield_detected',
    })).toBeNull();
  });
  it('no signal at all → null (safe default: do not override)', () => {
    expect(resolveWriteScopeForComponent({
      componentId: 'comp-x', isCompositionRoot: false, stack: 'python',
    })).toBeNull();
  });
});

const profile = { language: 'typescript', module: 'esm', test_runner: 'vitest', shared_dir: 'src/shared', source: 'config_default' } as const;

describe('canonicalComponentDir', () => {
  it.each([
    ['comp-analytics', 'src/analytics'],
    ['component_url_shortener', 'src/url-shortener'],
    ['cmp-auth', 'src/auth'],
    ['Analytics Service', 'src/analytics-service'],
    ['', 'src/unknown'],
    ['shared', 'src/shared'],
    ['root', 'src'],
  ])('%s → %s', (id, expected) => {
    expect(canonicalComponentDir(id, 'src', 'src/shared')).toBe(expected);
  });

  it('python (and rust/go/java) use UNDERSCORE packages, not hyphens (invalid identifiers)', () => {
    // slice-156: a python run handed `src/data-governance` deadlocked the executor.
    expect(canonicalComponentDir('comp-data-governance', 'src', 'src/shared', 'python')).toBe('src/data_governance');
    expect(canonicalComponentDir('comp-link-management', 'src', 'src/shared', 'rust')).toBe('src/link_management');
    expect(canonicalComponentDir('comp-link-management', 'src', 'src/shared', 'java')).toBe('src/link_management');
    // node keeps hyphens (TS resolves via aliases; hyphenated dirs are conventional)
    expect(canonicalComponentDir('comp-data-governance', 'src', 'src/shared', 'node')).toBe('src/data-governance');
  });
});

describe('normalizeComponentDirForStack', () => {
  it('converts hyphens to underscores for python (persisted node-shaped paths)', () => {
    expect(normalizeComponentDirForStack('src/data-governance', 'python')).toBe('src/data_governance');
    expect(normalizeComponentDirForStack('src/link-management', 'rust')).toBe('src/link_management');
  });
  it('leaves node/unknown paths untouched', () => {
    expect(normalizeComponentDirForStack('src/data-governance', 'node')).toBe('src/data-governance');
    expect(normalizeComponentDirForStack('src/data-governance', undefined)).toBe('src/data-governance');
  });
});

describe('buildProjectLayoutContract', () => {
  it('maps every component id and defines the @shared/@ aliases', () => {
    const c = buildProjectLayoutContract([{ id: 'comp-analytics' }, { id: 'comp-redirect' }], profile, 'colocated');
    expect(c.component_dir_map).toEqual({ 'comp-analytics': 'src/analytics', 'comp-redirect': 'src/redirect' });
    expect(c.import_aliases).toEqual([
      { alias: '@shared/*', target: 'src/shared/*' },
      { alias: '@/*', target: 'src/*' },
    ]);
    expect(c.test_placement).toBe('colocated');
    expect(c.allowed_source_extensions).toContain('.ts');
    expect(c.allowed_source_extensions).not.toContain('.go');
    expect(c.allowed_top_level_dirs).toContain('src');
  });

  it('a javascript profile does not allow .ts', () => {
    const c = buildProjectLayoutContract([{ id: 'comp-x' }], { ...profile, language: 'javascript' }, 'colocated');
    expect(c.allowed_source_extensions).toContain('.js');
    expect(c.allowed_source_extensions).not.toContain('.ts');
  });

  it('a python profile uses NO path aliases and allows only .py', () => {
    const py = { ...profile, language: 'python', module: 'na', test_runner: 'pytest' } as const;
    const c = buildProjectLayoutContract([{ id: 'comp-x' }], py, 'colocated');
    expect(c.import_aliases).toEqual([]); // python uses package imports, not @shared aliases
    expect(c.allowed_source_extensions).toContain('.py');
    expect(c.allowed_source_extensions).not.toContain('.ts');
    expect(c.allowed_source_extensions).not.toContain('.js');
  });
});

describe('renderLayoutConventions', () => {
  it('states the @shared import form and co-located test rule', () => {
    const c = buildProjectLayoutContract([{ id: 'comp-x' }], profile, 'colocated');
    const text = renderLayoutConventions(c, profile);
    expect(text).toContain('@shared/');
    expect(text).toMatch(/co-?locate/i);
  });

  it('python conventions use package imports + pytest + test_<file>.py, never @shared/npm', () => {
    const py = { ...profile, language: 'python', module: 'na', test_runner: 'pytest' } as const;
    const c = buildProjectLayoutContract([{ id: 'comp-x' }], py, 'colocated');
    const text = renderLayoutConventions(c, py);
    expect(text).toMatch(/from shared\.models\.Foo import Foo/);
    expect(text).toMatch(/pytest/);
    expect(text).toMatch(/test_<file>\.py/);
    expect(text).not.toContain('@shared/');
    expect(text).not.toContain('npm test');
    expect(text).toMatch(/\.py/);
  });
});

describe('detectLayoutViolations', () => {
  let ws: string;
  beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-')); });
  afterEach(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } });
  const contract = buildProjectLayoutContract([{ id: 'comp-analytics' }], profile, 'colocated');

  function write(rel: string, content = 'x') {
    const abs = path.join(ws, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  it('passes on a clean conformant workspace', () => {
    write('src/analytics/index.ts');
    write('src/shared/models/ClickStat.ts');
    write('package.json', '{}');
    const r = detectLayoutViolations(ws, contract);
    expect(r.passed).toBe(true);
  });

  it('flags a stray root shared/ tree, a stray top-level dir, and a .go file', () => {
    write('src/analytics/index.ts');
    write('shared/models/ClickStat.ts');           // stray root shared tree
    write('test-redirection/x.test.ts');            // stray top-level dir
    write('src/analytics/availability/retry.go');   // foreign language
    const r = detectLayoutViolations(ws, contract);
    expect(r.passed).toBe(false);
    expect(r.stray_shared_trees).toContain('shared');
    expect(r.stray_top_level_dirs).toEqual(expect.arrayContaining(['shared', 'test-redirection']));
    expect(r.foreign_language_files.some(f => f.endsWith('retry.go'))).toBe(true);
  });

  it('flags dist/ that contains TS source', () => {
    write('dist/src/analytics/index.ts');
    const r = detectLayoutViolations(ws, contract);
    expect(r.build_output_has_source).toBe(true);
  });
});
