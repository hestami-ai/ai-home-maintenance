/**
 * Unit tests for Phase 9.0 Scaffold Synthesis (Lever 2a).
 *
 * Covers the two pure pieces:
 *   - resolveProjectProfile precedence: brownfield-detected > ADR override > config default
 *   - materializeScaffold: creates root config + shared models/contracts, skip-if-exists idempotency
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveProjectProfile, materializeScaffold } from '../../../../lib/orchestrator/phases/scaffoldSynthesis';
import { buildProjectLayoutContract } from '../../../../lib/orchestrator/phases/layoutContract';

const configDefault = { language: 'typescript', module: 'esm', test_runner: 'vitest', shared_dir: 'src/shared' } as const;

let ws: string;
beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-')); });
afterEach(() => { try { fs.rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } });

describe('resolveProjectProfile — precedence', () => {
  it('uses the config default for a greenfield (empty) workspace', () => {
    const p = resolveProjectProfile(ws, null, configDefault);
    expect(p.source).toBe('config_default');
    expect(p.language).toBe('typescript');
    expect(p.module).toBe('esm');
    expect(p.test_runner).toBe('vitest');
  });

  it('adopts an existing brownfield package.json (CJS + jest)', () => {
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({
      name: 'legacy', scripts: { test: 'jest' }, devDependencies: { jest: '^29' },
    }));
    const p = resolveProjectProfile(ws, null, configDefault);
    expect(p.source).toBe('brownfield_detected');
    expect(p.module).toBe('commonjs'); // no "type":"module"
    expect(p.test_runner).toBe('jest');
    expect(p.language).toBe('javascript'); // no tsconfig, no typescript dep
  });

  it('detects TypeScript + ESM brownfield from type:module + tsconfig', () => {
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({
      name: 'legacy', type: 'module', scripts: { test: 'vitest run' }, devDependencies: { typescript: '^5', vitest: '^1' },
    }));
    fs.writeFileSync(path.join(ws, 'tsconfig.json'), '{}');
    const p = resolveProjectProfile(ws, null, configDefault);
    expect(p.source).toBe('brownfield_detected');
    expect(p.language).toBe('typescript');
    expect(p.module).toBe('esm');
  });

  it('uses an ADR override when no workspace config exists', () => {
    const adr = { project_profile: { language: 'javascript', module: 'commonjs', test_runner: 'node' } };
    const p = resolveProjectProfile(ws, adr, configDefault);
    expect(p.source).toBe('adr_override');
    expect(p.language).toBe('javascript');
    expect(p.module).toBe('commonjs');
    expect(p.test_runner).toBe('node');
    expect(p.shared_dir).toBe('src/shared'); // unspecified ⇒ inherits config default
  });

  it('brownfield beats ADR (precedence order)', () => {
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'x', type: 'module' }));
    const adr = { project_profile: { language: 'javascript', module: 'commonjs' } };
    const p = resolveProjectProfile(ws, adr, configDefault);
    expect(p.source).toBe('brownfield_detected');
  });
});

describe('materializeScaffold — file generation + idempotency', () => {
  const profile = { ...configDefault, source: 'config_default' as const };
  const contract = buildProjectLayoutContract([{ id: 'comp-url' }], profile, 'colocated');
  const dataModels = {
    models: [{ component_id: 'comp-url', entities: [
      { name: 'ShortLink', fields: [
        { name: 'id', type: 'uuid' },
        { name: 'clicks', type: 'integer' },
        { name: 'createdAt', type: 'timestamp' },
      ] },
    ] }],
  };
  const contracts = { contracts: [{ id: 'IC-001', protocol: 'HTTPS', data_format: 'JSON', systems_involved: ['api', 'db'] }] };

  it('writes root config + shared model/contract + barrel', () => {
    const r = materializeScaffold(ws, 'tinyurl', profile, dataModels, contracts, contract);
    expect(r.created).toContain('package.json');
    expect(r.created).toContain('tsconfig.json');
    expect(r.created.some(f => f.includes('src/shared/models/ShortLink.ts'))).toBe(true);
    expect(r.created.some(f => f.includes('src/shared/contracts/IC001.ts'))).toBe(true);
    expect(r.created.some(f => f.endsWith('src/shared/index.ts'))).toBe(true);

    // package.json is ESM + vitest test script.
    const pkg = JSON.parse(fs.readFileSync(path.join(ws, 'package.json'), 'utf-8'));
    expect(pkg.type).toBe('module');
    expect(pkg.scripts.test).toBe('vitest run');
    // fast-check is preinstalled (dev) so property test cases don't quarantine
    // on a missing module.
    expect(pkg.devDependencies['fast-check']).toBeDefined();

    // Model maps types to permissive TS types.
    const model = fs.readFileSync(path.join(ws, 'src/shared/models/ShortLink.ts'), 'utf-8');
    expect(model).toContain('export interface ShortLink');
    expect(model).toContain('clicks: number');
    expect(model).toContain('id: string');
  });

  it('renders nullable/optional fields as `T | null`, keeps required fields non-null', () => {
    // Slice-145 bug: a nullable field rendered as non-null, so fixtures passing
    // `null` failed strict-mode tsc. Required / not-null / primary-key stay non-null.
    const nullableModels = {
      models: [{ component_id: 'comp-url', entities: [
        { name: 'Mapping', fields: [
          { name: 'id', type: 'uuid', constraints: 'primary_key' },
          { name: 'slug', type: 'string', constraints: 'not null,unique' },
          { name: 'deleted_at', type: 'timestamp', constraints: 'nullable' },
          { name: 'note', type: 'text', constraints: 'optional' },
        ] },
      ] }],
    };
    materializeScaffold(ws, 'tinyurl', profile, nullableModels, contracts, contract);
    const model = fs.readFileSync(path.join(ws, 'src/shared/models/Mapping.ts'), 'utf-8');
    expect(model).toContain('deleted_at: string | null');
    expect(model).toContain('note: string | null');
    expect(model).toContain('id: string;'); // primary key → not null
    expect(model).toContain('slug: string;'); // not null
    expect(model).not.toContain('slug: string | null');
  });

  it('is skip-if-exists (never clobbers existing files)', () => {
    fs.writeFileSync(path.join(ws, 'package.json'), '{"name":"keep-me"}');
    const r = materializeScaffold(ws, 'tinyurl', profile, dataModels, contracts, contract);
    expect(r.preExisting).toContain('package.json');
    expect(r.created).not.toContain('package.json');
    expect(JSON.parse(fs.readFileSync(path.join(ws, 'package.json'), 'utf-8')).name).toBe('keep-me');
  });
});
