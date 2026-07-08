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
  gatherTechnicalConstraints,
  applyForcedStack,
  defaultGatesForStack,
  manifestForStack,
  idiomaticImportSpecifier,
  normalizeGreenfieldLayout,
  collapseGreenfieldAreas,
  pinGreenfieldStack,
  prescribedStackFromConstraints,
  overrideWorkspaceKindIfEmpty,
  isDecisiveForArea,
} from '../../../../lib/orchestrator/phases/phase9Recon';
import type { ReconArea, Phase9ReconPlan, IntegrationBoundary } from '../../../../lib/orchestrator/phases/phase9Recon';

describe('normalizeGreenfieldLayout — deterministic greenfield topology', () => {
  it('overrides the agent area_id-as-source-dir with canonical src/ layout', () => {
    // slice-156: agent emitted source_roots:['core-service'] (area id as a dir) +
    // /src/ protected → project nested under project/core-service/, fragmented.
    const plan = parseReconPlan({
      workspace_kind: 'greenfield',
      areas: [{
        area_id: 'core-service', stack: 'python', confidence: 'high',
        source_roots: ['core-service'], test_roots: ['core-service/tests'],
        protected_paths: ['/src/'], dependency_manifest: 'pyproject.toml',
        gate_commands: [{ kind: 'test', command: 'pytest', args: [] }],
      }],
    }, ws)!;
    const out = normalizeGreenfieldLayout(plan);
    expect(out.areas[0].source_roots).toEqual(['src']);
    expect(out.areas[0].test_roots).toEqual(['src']);
    expect(out.areas[0].protected_paths).toEqual(['src/shared/', 'pyproject.toml']);
    expect(out.areas[0].stack).toBe('python'); // semantic decision preserved
  });

  it('leaves brownfield layout untouched (real existing dirs matter)', () => {
    const plan = parseReconPlan({
      workspace_kind: 'brownfield',
      areas: [{
        area_id: 'svc', stack: 'python', confidence: 'high',
        source_roots: ['services/svc/src'], test_roots: ['services/svc/tests'],
        protected_paths: ['services/svc/src/shared/'], dependency_manifest: 'pyproject.toml',
        gate_commands: [{ kind: 'test', command: 'pytest', args: [] }],
      }],
    }, ws)!;
    const out = normalizeGreenfieldLayout(plan);
    expect(out.areas[0].source_roots).toEqual(['services/svc/src']); // unchanged
  });
});

describe('idiomaticImportSpecifier — stack-idiomatic import paths', () => {
  it('strips a leading source root + extension and renders the stack idiom', () => {
    expect(idiomaticImportSpecifier('src/shared/db.py', 'python')).toBe('shared.db');
    expect(idiomaticImportSpecifier('src/shared/db.rs', 'rust')).toBe('crate::shared::db');
    expect(idiomaticImportSpecifier('src/shared/db.go', 'go')).toBe('shared/db');
    expect(idiomaticImportSpecifier('src/shared/Db.java', 'java')).toBe('shared.Db');
    expect(idiomaticImportSpecifier('src/shared/db.ts', 'node')).toBe('@/shared/db');
  });

  it('applyForcedStack retargets canonical-module specifiers to the new stack (not the old TS alias)', () => {
    const base = {
      kind: 'phase9_recon_plan' as const, schemaVersion: '1.0' as const,
      workspace_kind: 'greenfield' as const, source: 'agent' as const,
      areas: [{
        area_id: 'workspace', description: '', stack: 'node', confidence: 'high' as const,
        source_refs: [], conflicts: [], alternatives_rejected: [], source_roots: ['src'], test_roots: ['src'],
        protected_paths: ['src/shared/'], dependency_manifest: 'package.json',
        canonical_modules: [{ path: 'src/shared/db.ts', import_specifier: '@shared/db', description: 'db' }],
        import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }], gate_commands: [],
      }],
      integration_boundaries: [], notes: '',
    };
    const py = applyForcedStack(base, 'python');
    expect(py.areas[0].canonical_modules[0].path).toMatch(/\.py$/);
    expect(py.areas[0].canonical_modules[0].import_specifier).toBe('shared.db'); // not '@shared/db'
    expect(py.areas[0].import_aliases).toEqual([]); // python has no aliases
  });
});
import type { PhaseContext } from '../../../../lib/orchestrator/orchestratorEngine';

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

  it('drops over-broad protected paths equal to a source root (the /src/ deadlock)', () => {
    // The recon AGENT emitted the whole source tree as protected (`/src/`), which
    // contradicts a per-component write scope underneath it (src/link-management)
    // and deadlocks the executor. Sanitize: keep src/shared/ + manifest, drop /src/.
    const plan = parseReconPlan({
      workspace_kind: 'greenfield',
      areas: [
        { area_id: 'core', stack: 'python', confidence: 'low', dependency_manifest: 'pyproject.toml',
          protected_paths: ['/src/', 'src/shared/'], source_roots: ['src'],
          gate_commands: [{ kind: 'test', command: 'pytest', args: [] }] },
      ],
    }, ws)!;
    const m = buildReconEnforcementManifest(plan);
    expect(m.protected_paths).not.toContain('/src/');  // over-broad → dropped
    expect(m.protected_paths).not.toContain('src');
    expect(m.protected_paths).toContain('src/shared/'); // proper subdir → kept
    expect(m.protected_paths).toContain('pyproject.toml');
    // conventions string must NOT tell the agent "do NOT author /src/"
    expect(m.conventions).not.toMatch(/do NOT author:[^.]*\/src\//);
    expect(m.conventions).toContain('src/shared/');
  });
});

describe('applyForcedStack — executor language-sweep lever', () => {
  // A two-area, node-shaped plan with TS canonical modules + @shared aliases.
  const nodePlan = () => parseReconPlan({
    workspace_kind: 'greenfield',
    areas: [{
      area_id: 'link_manager', stack: 'node', confidence: 'high',
      source_roots: ['src'], test_roots: ['src/__tests__'],
      dependency_manifest: 'package.json',
      protected_paths: ['src/shared/', 'package.json', 'tsconfig.json'],
      canonical_modules: [{ path: 'src/shared/models.ts', import_specifier: '@shared/models', description: 'm' }],
      import_aliases: [{ alias: '@shared/*', target: 'src/shared/*' }],
      gate_commands: [{ kind: 'test', command: 'npm', args: ['test'] }],
    }],
  }, '/ws')!;

  it('repoints stack/manifest/gates/extensions to python while preserving topology', () => {
    const forced = applyForcedStack(nodePlan(), 'python');
    const a = forced.areas[0];
    expect(forced.forced_stack).toBe('python');
    expect(a.stack).toBe('python');
    expect(a.dependency_manifest).toBe('pyproject.toml');
    expect(a.gate_commands).toEqual(defaultGatesForStack('python'));
    expect(a.gate_commands.some(g => g.command === 'pytest')).toBe(true);
    // topology preserved
    expect(a.area_id).toBe('link_manager');
    expect(a.source_roots).toEqual(['src']);
    expect(a.test_roots).toEqual(['src/__tests__']);
    // canonical module extension retargeted; node-only aliases dropped
    expect(a.canonical_modules[0].path).toBe('src/shared/models.py');
    expect(a.import_aliases).toEqual([]);
    // protected dir kept, manifest swapped (no stale tsconfig/package.json)
    expect(a.protected_paths).toContain('src/shared/');
    expect(a.protected_paths).toContain('pyproject.toml');
    expect(a.protected_paths).not.toContain('package.json');
    expect(a.protected_paths).not.toContain('tsconfig.json');
  });

  it('keeps @shared aliases when forcing back to node, and uses .rs/.go for rust/go', () => {
    expect(applyForcedStack(nodePlan(), 'node').areas[0].import_aliases.length).toBe(2);
    expect(applyForcedStack(nodePlan(), 'rust').areas[0].canonical_modules[0].path).toBe('src/shared/models.rs');
    expect(applyForcedStack(nodePlan(), 'go').areas[0].canonical_modules[0].path).toBe('src/shared/models.go');
    expect(manifestForStack('rust')).toBe('Cargo.toml');
    expect(manifestForStack('java')).toBe('pom.xml');
  });

  it('returns the plan unchanged for an unknown stack', () => {
    const p = nodePlan();
    const out = applyForcedStack(p, 'cobol');
    expect(out.forced_stack).toBeUndefined();
    expect(out.areas[0].stack).toBe('node');
  });
});

describe('gatherTechnicalConstraints — Phase-1 → recon contract', () => {
  // Build a fake engine whose writer returns the records Phase 1.0c actually
  // writes. The shape here MUST mirror phase1.ts:864 + records.ts:TechnicalConstraint.
  const fakeEngine = (records: Array<Record<string, unknown>>): PhaseContext['engine'] =>
    ({ writer: { getRecordsByType: () => records.map(content => ({ content })) } } as unknown as PhaseContext['engine']);

  it('reads the camelCase `technicalConstraints` key + the `.text` item field Phase 1.0c emits', () => {
    // Exactly the shape phase1.ts persists. A reader keyed on snake_case or on
    // `.constraint`/`.statement` (the pre-fix bug) returns [] here → the recon
    // agent sees "(none stated)" and free-invents a stack/topology.
    const out = gatherTechnicalConstraints(fakeEngine([
      {
        kind: 'technical_constraints_discovery',
        technicalConstraints: [
          { id: 'TECH-1', category: 'infrastructure', text: 'a single containerised service; no microservices' },
          { id: 'TECH-2', category: 'database', text: 'Postgres 16+ on a single managed instance' },
        ],
      },
    ]), 'run-1');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('TECH-1: a single containerised service; no microservices');
    expect(out[1]).toContain('Postgres 16+');
  });

  it('still tolerates snake_case container + alternate item fields (LLM-shaped sources)', () => {
    const out = gatherTechnicalConstraints(fakeEngine([
      { kind: 'technical_constraints', constraints: [{ id: 'TC-1', constraint: 'HTTPS only' }] },
    ]), 'run-1');
    expect(out).toEqual(['TC-1: HTTPS only']);
  });

  it('returns empty for unrelated artifact kinds', () => {
    expect(gatherTechnicalConstraints(fakeEngine([{ kind: 'component_model', components: [] }]), 'run-1')).toEqual([]);
  });
});

describe('isDecisiveForArea — TECH-* constraint classification for the recon prompt split', () => {
  it('treats language/framework choices as DECISIVE (they set the stack)', () => {
    for (const c of [
      'TECH-SVELTKIT-1: SvelteKit | web portals',
      'TECH-NODEJS-1: Node.js (Bun) for high-performance API execution',
      'TECH-PY-1: Python + FastAPI backend',
      'TECH-RS-1: Rust services with cargo',
    ]) {
      expect(isDecisiveForArea(c)).toBe(true);
    }
  });
  it('treats topology cues as DECISIVE (they set how many deployables/areas exist)', () => {
    for (const c of [
      'TECH-1: a single containerised service; no microservices',
      'TECH-CLOUDFLARE-1: Cloudflare CDN is the only public entry point',
      'TECH-2: modular monolith, one deployable',
    ]) {
      expect(isDecisiveForArea(c)).toBe(true);
    }
  });
  it('treats runtime libraries / infra as NON-decisive (the chosen stack merely consumes them)', () => {
    // These are exactly the constraints that mis-steered cal-41 recon into 8
    // microservice areas when dumped as binding stack signals.
    for (const c of [
      'TECH-PGSQL-1: PostgreSQL with Row-Level Security',
      'TECH-DBOS-1: DBOS durable workflows',
      'TECH-ORPC-1: oRPC function-based API layer',
      'TECH-CERBOS-1: Cerbos authorization engine',
      'TECH-DOCKERCOMPOSE-1: Docker Compose',
      'TECH-SEAWEEDFS-1: SeaweedFS',
      'TECH-CLAMAV-1: ClamAV',
      'TECH-FFMPEG-1: ffmpeg',
      'TECH-TRAFFIC-1: Traefik | TLS termination, SNI routing',
    ]) {
      expect(isDecisiveForArea(c)).toBe(false);
    }
  });
});

describe('collapseGreenfieldAreas — deterministic topology from stack partition (slice-156)', () => {
  function mkArea(p: Partial<ReconArea> & { area_id: string; stack: string }): ReconArea {
    return {
      description: '', confidence: 'high', source_refs: [], conflicts: [], alternatives_rejected: [],
      source_roots: ['src'], test_roots: ['src'], protected_paths: [], dependency_manifest: '',
      canonical_modules: [], import_aliases: [], gate_commands: [],
      ...p,
    };
  }
  function mkPlan(
    workspace_kind: Phase9ReconPlan['workspace_kind'],
    areas: ReconArea[],
    integration_boundaries: IntegrationBoundary[] = [],
  ): Phase9ReconPlan {
    return { kind: 'phase9_recon_plan', schemaVersion: '1.0', workspace_kind, source: 'agent', areas, integration_boundaries, notes: '' };
  }
  const gate = (name: string, command: string): ReconArea['gate_commands'][number] =>
    ({ name, kind: 'test', command, args: ['test'], timeoutMs: 60000 });

  it('single-stack greenfield: N invented areas → ONE area "workspace" (the ws-156 case)', () => {
    // ws-156 emitted core-service / core-service / core-backend, all python.
    const plan = mkPlan('greenfield', [
      mkArea({ area_id: 'core-service', stack: 'python', canonical_modules: [{ path: 'src/shared/db.py', import_specifier: 'shared.db', description: 'db' }], gate_commands: [gate('python:test', 'pytest')] }),
      mkArea({ area_id: 'core-backend', stack: 'python', canonical_modules: [{ path: 'src/shared/api.py', import_specifier: 'shared.api', description: 'api' }], gate_commands: [gate('python:test', 'pytest')] }),
    ]);
    const out = collapseGreenfieldAreas(plan);
    expect(out.areas).toHaveLength(1);
    expect(out.areas[0].area_id).toBe('workspace');
    expect(out.areas[0].stack).toBe('python');
    // The agent's genuine outputs are PRESERVED as a de-duped union.
    expect(out.areas[0].canonical_modules.map(m => m.path).sort()).toEqual(['src/shared/api.py', 'src/shared/db.py']);
    expect(out.areas[0].gate_commands).toHaveLength(1); // de-duped by name
  });

  it('is order-INVARIANT: shuffled input areas → identical area_id + primary_stack signal', () => {
    const a = mkArea({ area_id: 'core-service', stack: 'python' });
    const b = mkArea({ area_id: 'core-backend', stack: 'python' });
    const fwd = collapseGreenfieldAreas(mkPlan('greenfield', [a, b]));
    const rev = collapseGreenfieldAreas(mkPlan('greenfield', [b, a]));
    expect(fwd.areas[0].area_id).toBe(rev.areas[0].area_id);
    expect(fwd.areas[0].stack).toBe(rev.areas[0].stack); // primary_stack = areas[0].stack is stable
  });

  it('polyglot greenfield: distinct stacks → one "area-<stack>" each, sorted (deterministic)', () => {
    const out = collapseGreenfieldAreas(mkPlan('greenfield', [
      mkArea({ area_id: 'frontend', stack: 'node' }),
      mkArea({ area_id: 'api', stack: 'python' }),
    ]));
    expect(out.areas.map(a => a.area_id)).toEqual(['area-node', 'area-python']);
    expect(out.areas[0].stack).toBe('node'); // sorted → node first → stable primary_stack
  });

  it('brownfield is returned UNCHANGED (areas are real subsystems, not inventions)', () => {
    const plan = mkPlan('brownfield', [
      mkArea({ area_id: 'billing', stack: 'java', source_roots: ['services/billing'] }),
      mkArea({ area_id: 'share', stack: 'python', source_roots: ['libs/share'] }),
    ]);
    expect(collapseGreenfieldAreas(plan)).toBe(plan); // identity — no copy, no mutation
  });

  it('single-stack collapse drops integration_boundaries; polyglot remaps them to surviving ids', () => {
    expect(collapseGreenfieldAreas(mkPlan('greenfield',
      [mkArea({ area_id: 'a', stack: 'python' }), mkArea({ area_id: 'b', stack: 'python' })],
      [{ description: 'x', between: ['a', 'b'], mechanism: 'REST' }],
    )).integration_boundaries).toEqual([]);

    const poly = collapseGreenfieldAreas(mkPlan('greenfield',
      [mkArea({ area_id: 'fe', stack: 'node' }), mkArea({ area_id: 'be', stack: 'python' })],
      [{ description: 'ui→api', between: ['fe', 'be'], mechanism: 'REST' }],
    ));
    expect(poly.integration_boundaries[0].between.sort()).toEqual(['area-node', 'area-python']);
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

// D6/D3 (P9 materialization audit) — the recon agent WAFFLES between stacks in
// greenfield (cal-41 proposed native/node/sveltekit/python/other), and each
// distinct stack becomes its own area that re-scaffolds the FULL component set at
// the same src/ root (the 8× collision + python-for-a-TS-spec). Pin the stack.
describe('pinGreenfieldStack + prescribedStackFromConstraints (D6/D3 — stack waffle)', () => {
  const area = (id: string, stack: string) => ({
    area_id: id, stack, confidence: 'medium', source_roots: ['src'], test_roots: ['src'],
    dependency_manifest: '', protected_paths: [], canonical_modules: [], import_aliases: [], gate_commands: [],
  });
  const waffled = () => parseReconPlan({
    workspace_kind: 'greenfield',
    areas: [area('a-native', 'native'), area('a-node', 'node'), area('a-svelte', 'sveltekit'), area('a-py', 'python')],
  }, '/ws')!;

  it('derives the prescribed stack from TECH constraints (TS/SvelteKit → node; Django → python)', () => {
    expect(prescribedStackFromConstraints(['TECH-1: SvelteKit frontend', 'TECH-2: Node.js + TypeScript backend', 'TECH-3: PostgreSQL'])).toBe('node');
    expect(prescribedStackFromConstraints(['TECH-1: Django REST', 'TECH-2: Python 3.12'])).toBe('python');
    expect(prescribedStackFromConstraints(['TECH-1: PostgreSQL only'])).toBeNull();
  });

  it('pins a waffled greenfield plan to the prescribed stack → ONE workspace area (no python, no collision)', () => {
    const { plan, pinnedTo, proposed } = pinGreenfieldStack(waffled(), { detectedStack: null, prescribedStack: 'node' });
    expect(pinnedTo).toBe('node');
    expect(proposed.length).toBeGreaterThanOrEqual(3);
    expect([...new Set(plan.areas.map(a => a.stack))]).toEqual(['node']); // all one stack
    expect(plan.forced_stack).toBeUndefined();                            // auto-pin, not the sweep lever
    const collapsed = collapseGreenfieldAreas(plan);
    expect(collapsed.areas).toHaveLength(1);                              // ONE area, not N
    expect(collapsed.areas[0].area_id).toBe('workspace');
  });

  it('precedence: detected-on-disk beats prescribed', () => {
    expect(pinGreenfieldStack(waffled(), { detectedStack: 'python', prescribedStack: 'node' }).pinnedTo).toBe('python');
  });

  it('overrideWorkspaceKindIfEmpty: an empty project mislabelled "mixed" is corrected to greenfield → pin then fires', () => {
    const mislabelled = { ...waffled(), workspace_kind: 'mixed' as const };
    // as-is, the pin is suppressed (mixed is not greenfield)
    expect(pinGreenfieldStack(mislabelled, { prescribedStack: 'node' }).pinnedTo).toBeNull();
    // corrected because the project root is empty (deterministic fact)
    const fixed = overrideWorkspaceKindIfEmpty(mislabelled, true);
    expect(fixed.workspace_kind).toBe('greenfield');
    expect(pinGreenfieldStack(fixed, { prescribedStack: 'node' }).pinnedTo).toBe('node');
    // a genuinely non-empty (brownfield) workspace is left untouched
    expect(overrideWorkspaceKindIfEmpty(mislabelled, false).workspace_kind).toBe('mixed');
  });

  it('is a no-op for single-stack, brownfield, or already-forced plans', () => {
    const single = parseReconPlan({ workspace_kind: 'greenfield', areas: [area('w', 'node')] }, '/ws')!;
    expect(pinGreenfieldStack(single, { prescribedStack: 'python' }).pinnedTo).toBeNull();
    expect(pinGreenfieldStack({ ...waffled(), workspace_kind: 'brownfield' }, { prescribedStack: 'node' }).pinnedTo).toBeNull();
    expect(pinGreenfieldStack({ ...waffled(), forced_stack: 'go' }, { prescribedStack: 'node' }).pinnedTo).toBeNull();
  });
});
