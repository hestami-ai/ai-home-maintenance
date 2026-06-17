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
