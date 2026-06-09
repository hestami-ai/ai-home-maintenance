/**
 * Unit tests for the Project Layout Contract (deterministic structure).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  canonicalComponentDir,
  buildProjectLayoutContract,
  detectLayoutViolations,
  renderLayoutConventions,
} from '../../../../lib/orchestrator/phases/layoutContract';

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
});

describe('renderLayoutConventions', () => {
  it('states the @shared import form and co-located test rule', () => {
    const c = buildProjectLayoutContract([{ id: 'comp-x' }], profile, 'colocated');
    const text = renderLayoutConventions(c, profile);
    expect(text).toContain('@shared/');
    expect(text).toMatch(/co-?locate/i);
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
