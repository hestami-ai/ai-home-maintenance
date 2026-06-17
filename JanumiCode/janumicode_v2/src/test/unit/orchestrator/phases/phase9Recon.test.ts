/**
 * Phase 9.0 Reconnaissance (Stage 1+2 increment 1) — the pure pieces:
 * deterministic workspace inventory, LLM-plan parse/coerce, deterministic
 * fallback, and per-area gate aggregation. The LLM call + persistence are
 * exercised in the Phase-9 e2e harness.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildWorkspaceInventory,
  parseReconPlan,
  deterministicReconFallback,
  reconGlobalGates,
  buildReconEnforcementManifest,
  buildReconLayoutContract,
} from '../../../../lib/orchestrator/phases/phase9Recon';

let ws: string;
beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-')); });
afterEach(() => { fs.rmSync(ws, { recursive: true, force: true }); });
const write = (rel: string, content = '') => {
  const abs = path.join(ws, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

describe('buildWorkspaceInventory — deterministic FS facts', () => {
  it('reports empty for a greenfield workspace', () => {
    const inv = buildWorkspaceInventory(ws);
    expect(inv.is_empty).toBe(true);
    expect(inv.detected_root_stack).toBeNull();
  });

  it('captures root manifests, per-dir language signals, and the single root stack', () => {
    write('package.json', '{}');
    write('src/a.ts', 'export const a = 1;');
    write('src/b.ts', 'export const b = 2;');
    const inv = buildWorkspaceInventory(ws);
    expect(inv.is_empty).toBe(false);
    expect(inv.root_manifests).toContain('package.json');
    expect(inv.detected_root_stack).toBe('node');
    const src = inv.dir_signals.find(d => d.dir === 'src');
    expect(src?.languages.typescript).toBe(2);
  });

  it('detects no single stack for a polyglot workspace (defer signal)', () => {
    write('package.json', '{}');
    write('Cargo.toml', '');
    expect(buildWorkspaceInventory(ws).detected_root_stack).toBeNull();
  });
});

describe('deterministicReconFallback', () => {
  it('greenfield → single area, low confidence, kernel default stack', () => {
    const inv = buildWorkspaceInventory(ws);
    const plan = deterministicReconFallback(ws, inv);
    expect(plan.source).toBe('deterministic_fallback');
    expect(plan.workspace_kind).toBe('greenfield');
    expect(plan.areas).toHaveLength(1);
    expect(plan.areas[0].confidence).toBe('low');
  });

  it('detected stack → high confidence + resolver gates', () => {
    write('Cargo.toml', '');
    write('src/main.rs', 'fn main() {}');
    const plan = deterministicReconFallback(ws, buildWorkspaceInventory(ws));
    expect(plan.areas[0].stack).toBe('rust');
    expect(plan.areas[0].confidence).toBe('high');
    expect(reconGlobalGates(plan).some(g => g.command === 'cargo')).toBe(true);
  });
});

describe('parseReconPlan — coerce + validate LLM output', () => {
  it('parses a well-formed multi-area plan with gates + boundaries', () => {
    const plan = parseReconPlan({
      workspace_kind: 'brownfield',
      areas: [
        { area_id: 'billing', stack: 'java', confidence: 'high', source_roots: ['services/billing'],
          conflicts: ['stated python vs existing java'],
          gate_commands: [{ name: 'billing:test', kind: 'test', command: 'mvn', args: ['-q', 'test'], cwd: 'services/billing' }] },
        { area_id: 'share', stack: 'python', confidence: 'medium',
          gate_commands: [{ kind: 'test', command: 'pytest', args: ['-q'] }] },
      ],
      integration_boundaries: [{ description: 'REST', between: ['billing', 'share'], mechanism: 'REST' }],
      notes: 'two areas',
    }, ws);
    expect(plan).not.toBeNull();
    expect(plan!.source).toBe('agent');
    expect(plan!.areas.map(a => a.stack)).toEqual(['java', 'python']);
    expect(plan!.areas[0].conflicts).toContain('stated python vs existing java');
    expect(plan!.integration_boundaries).toHaveLength(1);
    // gate coercion defaults
    const g = plan!.areas[1].gate_commands[0];
    expect(g.name).toBe('test:pytest'); // synthesized when omitted
    expect(g.timeoutMs).toBeGreaterThan(0);
    // aggregation flattens all areas' gates
    expect(reconGlobalGates(plan).map(g2 => g2.command)).toEqual(['mvn', 'pytest']);
  });

  it('parses the per-area enforcement manifest fields', () => {
    const plan = parseReconPlan({
      areas: [{
        area_id: 'web', stack: 'node', confidence: 'high',
        source_roots: ['src/web'], test_roots: ['src/web'],
        dependency_manifest: 'package.json',
        protected_paths: ['src/shared/', 'package.json'],
        canonical_modules: [{ path: 'src/shared/models/User.ts', import_specifier: '@shared/models/User', description: 'user' }],
        import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }],
        gate_commands: [{ kind: 'test', command: 'npm', args: ['test'] }],
      }],
    }, ws);
    const a = plan!.areas[0];
    expect(a.dependency_manifest).toBe('package.json');
    expect(a.protected_paths).toContain('src/shared/');
    expect(a.canonical_modules[0].import_specifier).toBe('@shared/models/User');
    expect(a.import_aliases[0].alias).toBe('@shared/*');
  });

  it('returns null on no usable areas (caller falls back)', () => {
    expect(parseReconPlan({ areas: [] }, ws)).toBeNull();
    expect(parseReconPlan({ areas: [{ description: 'no id or stack' }] }, ws)).toBeNull();
    expect(parseReconPlan('garbage', ws)).toBeNull();
  });

  it('drops malformed gates + areas but keeps the valid ones', () => {
    const plan = parseReconPlan({
      areas: [
        { area_id: 'ok', stack: 'node', confidence: 'banana',
          gate_commands: [{ kind: 'test', command: 'npm', args: ['test'] }, { kind: 'test' /* no command */ }] },
        { stack: 'rust' /* no area_id */ },
      ],
    }, ws);
    expect(plan!.areas).toHaveLength(1);
    expect(plan!.areas[0].confidence).toBe('medium'); // invalid 'banana' → medium
    expect(plan!.areas[0].gate_commands).toHaveLength(1); // the command-less gate dropped
  });
});

describe('buildReconEnforcementManifest — polyglot enforcement substrate', () => {
  it('unions protected paths (+ dependency manifests), flattens modules, maps per-area extensions', () => {
    const plan = parseReconPlan({
      workspace_kind: 'mixed',
      areas: [
        { area_id: 'web', stack: 'node', confidence: 'high', dependency_manifest: 'package.json',
          protected_paths: ['src/shared/'], source_roots: ['src/web'],
          canonical_modules: [{ path: 'src/shared/models/User.ts', import_specifier: '@shared/models/User', description: '' }],
          gate_commands: [{ kind: 'test', command: 'npm', args: ['test'] }] },
        { area_id: 'engine', stack: 'rust', confidence: 'high', dependency_manifest: 'Cargo.toml',
          protected_paths: ['crates/shared/'], source_roots: ['crates/engine'],
          gate_commands: [{ kind: 'test', command: 'cargo', args: ['test'], cwd: 'crates/engine' }] },
      ],
    }, ws)!;
    const m = buildReconEnforcementManifest(plan);
    expect(m.protected_paths).toContain('src/shared/');
    expect(m.protected_paths).toContain('crates/shared/');
    expect(m.protected_paths).toContain('package.json'); // dependency manifest folded in
    expect(m.protected_paths).toContain('Cargo.toml');
    expect(m.canonical_modules).toHaveLength(1);
    expect(m.allowed_extensions_by_area.web).toContain('.ts');
    expect(m.allowed_extensions_by_area.engine).toContain('.rs');
    expect(m.allowed_extensions_by_area.web).not.toContain('.rs'); // per-area, not global
    expect(m.conventions).toContain('Area web (node)');
    expect(m.conventions).toContain('Area engine (rust)');
  });
});

describe('buildReconLayoutContract — Phase-10 layout check under the recon path', () => {
  it('unions per-area extensions (no polyglot false-positives) + collects area top-level dirs', () => {
    const plan = parseReconPlan({
      areas: [
        { area_id: 'web', stack: 'node', confidence: 'high', source_roots: ['src/web'],
          import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }],
          gate_commands: [{ kind: 'test', command: 'npm', args: ['test'] }] },
        { area_id: 'engine', stack: 'rust', confidence: 'high', source_roots: ['crates/engine'],
          protected_paths: ['crates/shared/'],
          gate_commands: [{ kind: 'test', command: 'cargo', args: ['test'] }] },
      ],
    }, ws)!;
    const c = buildReconLayoutContract(plan);
    expect(c.allowed_source_extensions).toContain('.ts'); // node legit
    expect(c.allowed_source_extensions).toContain('.rs'); // rust legit — NOT a foreign-file false positive
    expect(c.allowed_top_level_dirs).toContain('crates'); // engine area root segment
    expect(c.allowed_top_level_dirs).toContain('src');
    expect(c.shared_dir).toBe('crates/shared'); // from the dir-prefix protected path
    expect(c.import_aliases.find(a => a.alias === '@shared/*')?.target).toBe('src/shared/*');
  });
});
