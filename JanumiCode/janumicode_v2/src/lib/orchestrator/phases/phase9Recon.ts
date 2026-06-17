/**
 * Phase 9.0 — Reconnaissance (Stage 1+2, the agentic kernel).
 *
 * The ONE place that decides, with filesystem reality in hand, the EXECUTION
 * ground: which tech stack each area of the workspace uses, where existing code
 * lives, how new and existing systems integrate, and the per-area verification
 * gates. Phases 1–8 are filesystem-blind and only ADVISE (stated stack arrives
 * as a binding `TECH-*` constraint); this sub-phase reconciles that advice with
 * what is actually on disk and represents the result as a `phase9_recon_plan`
 * that the kernel (scaffold/ownership/layout/gates) consumes.
 *
 * Two halves, by the project's deterministic-vs-judgment split:
 *   - {@link buildWorkspaceInventory} — DETERMINISTIC facts (per-directory
 *     language/manifest signals from the workspace scan). "What is on disk."
 *   - {@link runPhase9ReconSubPhase} — an LLM JUDGMENT over those facts + the
 *     advisory intent: per-area stack with CONFIDENCE / CONFLICTS / SOURCES
 *     (evidence-backed decisions, NOT "ground truth"). Falls back to a
 *     deterministic single-area plan when the model is silent/unavailable, so
 *     the greenfield single-stack path never depends on model quality.
 *
 * INCREMENT 1 (this change) produces + persists the plan and feeds its per-area
 * gate commands to the stabilization loop. Kernel author→enforce retirement
 * (scaffold/ownership/layout consuming the plan's enforcement manifest) is a
 * subsequent increment — the deterministic authoring still runs meanwhile, so
 * the validated greenfield path is unaffected.
 */

import { scanWorkspace } from '../../workspace/workspaceScanner';
import { detectWorkspaceStack, resolveGateCommands, type GateCommand, type GateKind } from '../gateCommands';
import { getLogger } from '../../logging';
import type { ProjectLayoutContract } from './layoutContract';
import type { PhaseContext } from '../orchestratorEngine';

// ── Deterministic workspace inventory (facts) ───────────────────────

export interface DirStackSignal {
  /** Top-level workspace directory (e.g. 'src', 'services/billing'). */
  dir: string;
  /** Detected source language → file count. */
  languages: Record<string, number>;
  /** Manifest files present under this dir (package.json, Cargo.toml, …). */
  manifests: string[];
}

export interface WorkspaceInventory {
  is_empty: boolean;
  total_files: number;
  /** Manifest files at the workspace ROOT. */
  root_manifests: string[];
  /** Per top-level directory language/manifest signals. */
  dir_signals: DirStackSignal[];
  /** Single root stack when the workspace is homogeneous, else null (ambiguous). */
  detected_root_stack: string | null;
}

const MANIFEST_FILES = new Set([
  'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
  'setup.py', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle', 'build.gradle.kts',
]);

/** Read-only deterministic scan → per-directory stack signals. Never throws. */
export function buildWorkspaceInventory(workspacePath: string): WorkspaceInventory {
  let files: Array<{ relativePath: string; type: string; language?: string }> = [];
  let total = 0;
  try {
    const scan = scanWorkspace(workspacePath, { maxFiles: 4000, maxFileSizeBytes: 1024 * 1024 });
    files = scan.files;
    total = scan.totalFiles;
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0 recon: workspace scan failed (empty inventory)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const rootManifests: string[] = [];
  const byDir = new Map<string, DirStackSignal>();
  const topDir = (rel: string): string => {
    const segs = rel.split('/');
    return segs.length <= 1 ? '.' : segs[0];
  };
  for (const f of files) {
    const base = f.relativePath.split('/').pop() ?? f.relativePath;
    if (MANIFEST_FILES.has(base)) {
      if (!f.relativePath.includes('/')) rootManifests.push(base);
      const dir = topDir(f.relativePath);
      const sig = byDir.get(dir) ?? { dir, languages: {}, manifests: [] };
      if (!sig.manifests.includes(base)) sig.manifests.push(base);
      byDir.set(dir, sig);
    }
    if (f.type === 'source' && f.language) {
      const dir = topDir(f.relativePath);
      const sig = byDir.get(dir) ?? { dir, languages: {}, manifests: [] };
      sig.languages[f.language] = (sig.languages[f.language] ?? 0) + 1;
      byDir.set(dir, sig);
    }
  }

  return {
    is_empty: total === 0 || files.every(f => f.type !== 'source'),
    total_files: total,
    root_manifests: [...new Set(rootManifests)].sort(),
    dir_signals: [...byDir.values()].sort((a, b) => a.dir.localeCompare(b.dir)),
    detected_root_stack: detectWorkspaceStack(workspacePath)?.id ?? null,
  };
}

// ── Recon plan (evidence-backed judgment) ───────────────────────────

export type ReconConfidence = 'high' | 'medium' | 'low';

export interface ReconCanonicalModule {
  /** Workspace-relative file path the area produces, e.g. 'src/shared/models/Mapping.ts'. */
  path: string;
  /** Stable specifier consumers import, e.g. '@shared/models/Mapping'. */
  import_specifier: string;
  description: string;
}

export interface ReconImportAlias {
  /** e.g. '@shared/*'. */
  alias: string;
  /** Workspace-relative target, e.g. 'src/shared/*'. */
  target: string;
}

export interface ReconArea {
  area_id: string;
  description: string;
  /** Chosen stack id ('node' | 'python' | 'rust' | 'go' | 'java' | …). */
  stack: string;
  confidence: ReconConfidence;
  /** Evidence: file paths, TECH-* ids, intent excerpts the decision rests on. */
  source_refs: string[];
  /** Surfaced conflicts (e.g. stated Django vs existing Spring) — NOT silently resolved. */
  conflicts: string[];
  alternatives_rejected: string[];
  /** Workspace-relative dirs this area owns (source). */
  source_roots: string[];
  /** Workspace-relative dirs holding this area's tests. */
  test_roots: string[];
  // ── Enforcement manifest (Stage 1+2 inc.2 — replaces the scaffold's substrate) ──
  /** Paths agents must NOT author (shared/config owned by the scaffolding step). */
  protected_paths: string[];
  /** This area's dependency manifest file (package.json, Cargo.toml, …). */
  dependency_manifest: string;
  /** Canonical shared modules this area exposes ("import, don't reinvent"). */
  canonical_modules: ReconCanonicalModule[];
  /** Import aliases the area's code uses (e.g. @shared/* → src/shared/*). */
  import_aliases: ReconImportAlias[];
  /** Per-area verification gates (supersede the generic resolver). */
  gate_commands: GateCommand[];
}

export interface IntegrationBoundary {
  description: string;
  /** area_ids the boundary connects. */
  between: string[];
  /** e.g. 'REST', 'shared database', 'message queue'. */
  mechanism: string;
}

export interface Phase9ReconPlan {
  kind: 'phase9_recon_plan';
  schemaVersion: '1.0';
  workspace_kind: 'greenfield' | 'brownfield' | 'mixed';
  /** How the plan was produced (audit): the LLM judgment or the deterministic fallback. */
  source: 'agent' | 'deterministic_fallback';
  areas: ReconArea[];
  integration_boundaries: IntegrationBoundary[];
  notes: string;
}

const GATE_KINDS: GateKind[] = ['test', 'typecheck', 'build', 'boot_smoke', 'dep_check'];

/** Aggregate every area's gate commands into the flat list the stabilization
 *  loop runs (each gate carries its own area `cwd`). */
export function reconGlobalGates(plan: Phase9ReconPlan | null): GateCommand[] {
  if (!plan) return [];
  return plan.areas.flatMap(a => a.gate_commands);
}

// ── Enforcement manifest derivation (inc.2 — replaces the scaffold substrate) ─

/** The kernel-enforcement substrate the recon plan provides — the polyglot
 *  successor to the (TS-shaped) scaffold manifest. The scheduler's write-scope
 *  guard + executor "import, don't reinvent" directives consume this. */
export interface ReconEnforcement {
  /** Union of every area's protected paths (dir prefixes end with '/'). */
  protected_paths: string[];
  /** Canonical shared modules across all areas. */
  canonical_modules: ReconCanonicalModule[];
  /** Per-area allowed source extensions (layout-violation checks). */
  allowed_extensions_by_area: Record<string, string[]>;
  /** Agent-facing conventions text (per-area stacks, aliases, import rules). */
  conventions: string;
  /** Workspace-relative Engineering Constitution copy (set by the caller; the
   *  side-channel survives the author→enforce cutover off the scaffold manifest). */
  engineering_constitution_path?: string;
}

/** Source-file extensions per stack (for per-area layout enforcement). */
const STACK_EXTENSIONS: Record<string, string[]> = {
  node: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py', '.pyi'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java', '.kt'],
};

export function buildReconEnforcementManifest(plan: Phase9ReconPlan): ReconEnforcement {
  const protectedSet = new Set<string>();
  const modules: ReconCanonicalModule[] = [];
  const extByArea: Record<string, string[]> = {};
  for (const a of plan.areas) {
    for (const p of a.protected_paths) protectedSet.add(p);
    if (a.dependency_manifest) protectedSet.add(a.dependency_manifest);
    modules.push(...a.canonical_modules);
    extByArea[a.area_id] = STACK_EXTENSIONS[a.stack] ?? [];
  }
  const conventions = plan.areas.map(a => {
    const aliases = a.import_aliases.map(al => `${al.alias} → ${al.target}`).join(', ');
    return `Area ${a.area_id} (${a.stack}): source ${a.source_roots.join(', ') || '(unset)'}; `
      + `tests ${a.test_roots.join(', ') || '(unset)'}; `
      + (aliases ? `import aliases: ${aliases}; ` : '')
      + (a.canonical_modules.length
          ? `import (do NOT reinvent): ${a.canonical_modules.map(m => m.import_specifier).filter(Boolean).join(', ')}; `
          : '')
      + `do NOT author: ${a.protected_paths.join(', ') || '(none)'}.`;
  }).join('\n');
  return {
    protected_paths: [...protectedSet].sort(),
    canonical_modules: modules,
    allowed_extensions_by_area: extByArea,
    conventions,
  };
}

/** Non-source extensions any stack legitimately carries (mirrors layoutContract). */
const COMMON_NON_SOURCE_EXT = ['.json', '.md', '.yaml', '.yml', '.env', '.gitignore', '.txt', '.sql', '.sh', '.toml', '.lock', '.cfg', '.ini'];
const BASE_TOP_LEVEL = ['src', 'node_modules', '.git', '.janumicode', 'dist', 'target', 'build', 'docs', '__pycache__', '.venv', 'venv'];

/**
 * Build a {@link ProjectLayoutContract} from the recon plan so Phase-10's
 * layout check works under the recon (Replace) path — where there is no
 * scaffold manifest. Allowed extensions are the UNION across every area's
 * stack (so a legitimate polyglot file is never a "foreign-language"
 * false-positive); allowed top-level dirs include every area's source/test
 * root segments.
 */
export function buildReconLayoutContract(plan: Phase9ReconPlan): ProjectLayoutContract {
  const exts = new Set<string>(COMMON_NON_SOURCE_EXT);
  const topLevel = new Set<string>(BASE_TOP_LEVEL);
  const aliases = new Map<string, string>();
  const componentDirMap: Record<string, string> = {};
  let sharedDir = 'src/shared';
  for (const a of plan.areas) {
    for (const e of STACK_EXTENSIONS[a.stack] ?? []) exts.add(e);
    for (const r of [...a.source_roots, ...a.test_roots]) {
      const top = r.replace(/\\/g, '/').split('/')[0];
      if (top && top !== '.') topLevel.add(top);
    }
    if (a.source_roots[0]) componentDirMap[a.area_id] = a.source_roots[0];
    for (const al of a.import_aliases) aliases.set(al.alias, al.target);
    const sharedProtected = a.protected_paths.find(p => p.endsWith('/'));
    if (sharedProtected) sharedDir = sharedProtected.replace(/\/+$/g, '');
  }
  return {
    kind: 'project_layout_contract',
    component_dir_map: componentDirMap,
    import_aliases: [...aliases].map(([alias, target]) => ({ alias, target })),
    test_placement: 'colocated',
    shared_dir: sharedDir,
    allowed_top_level_dirs: [...topLevel].sort(),
    allowed_source_extensions: [...exts].sort(),
  };
}

// ── Sub-phase orchestration ─────────────────────────────────────────

/**
 * Build the deterministic single-area fallback plan: one area = the whole
 * workspace, stack from filesystem detection (else null → kernel default),
 * gates from the generic resolver. Used when the model is unavailable/invalid
 * and for the simple greenfield single-stack case.
 */
export function deterministicReconFallback(workspacePath: string, inv: WorkspaceInventory): Phase9ReconPlan {
  const stack = inv.detected_root_stack;
  return {
    kind: 'phase9_recon_plan',
    schemaVersion: '1.0',
    workspace_kind: inv.is_empty ? 'greenfield' : 'brownfield',
    source: 'deterministic_fallback',
    areas: [{
      area_id: 'workspace',
      description: 'Whole workspace (single detectable stack).',
      stack: stack ?? 'unknown',
      confidence: stack ? 'high' : 'low',
      source_refs: inv.root_manifests,
      conflicts: [],
      alternatives_rejected: [],
      source_roots: ['src'],
      test_roots: ['src'],
      protected_paths: ['src/shared/', 'package.json', 'tsconfig.json'],
      dependency_manifest: stack === 'rust' ? 'Cargo.toml' : stack === 'go' ? 'go.mod'
        : stack === 'python' ? 'pyproject.toml' : stack === 'java' ? 'pom.xml' : 'package.json',
      canonical_modules: [],
      import_aliases: stack === 'node' || !stack
        ? [{ alias: '@shared/*', target: 'src/shared/*' }, { alias: '@/*', target: 'src/*' }]
        : [],
      gate_commands: resolveGateCommands(workspacePath),
    }],
    integration_boundaries: [],
    notes: stack
      ? `Deterministic fallback: detected single stack '${stack}' from root manifests.`
      : 'Deterministic fallback: no stack detected on disk (greenfield or pre-scaffold); kernel default applies.',
  };
}

/** Coerce an LLM-proposed area object into a validated {@link ReconArea}, or null. */
function coerceArea(raw: unknown, workspacePath: string): ReconArea | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const area_id = str(o.area_id).trim();
  const stack = str(o.stack).trim();
  if (!area_id || !stack) return null;
  const conf = str(o.confidence).toLowerCase();
  const confidence: ReconConfidence = conf === 'high' || conf === 'low' ? conf : 'medium';
  const gates = Array.isArray(o.gate_commands)
    ? (o.gate_commands as unknown[]).map(g => coerceGate(g, workspacePath)).filter((g): g is GateCommand => g !== null)
    : [];
  const modules: ReconCanonicalModule[] = Array.isArray(o.canonical_modules)
    ? (o.canonical_modules as unknown[]).map(m => {
        const mo = (m ?? {}) as Record<string, unknown>;
        const p = str(mo.path).trim();
        return p ? { path: p, import_specifier: str(mo.import_specifier).trim(), description: str(mo.description) } : null;
      }).filter((m): m is ReconCanonicalModule => m !== null)
    : [];
  const aliases: ReconImportAlias[] = Array.isArray(o.import_aliases)
    ? (o.import_aliases as unknown[]).map(a => {
        const ao = (a ?? {}) as Record<string, unknown>;
        const al = str(ao.alias).trim();
        const tg = str(ao.target).trim();
        return al && tg ? { alias: al, target: tg } : null;
      }).filter((a): a is ReconImportAlias => a !== null)
    : [];
  return {
    area_id,
    description: str(o.description),
    stack,
    confidence,
    source_refs: strArr(o.source_refs),
    conflicts: strArr(o.conflicts),
    alternatives_rejected: strArr(o.alternatives_rejected),
    source_roots: strArr(o.source_roots),
    test_roots: strArr(o.test_roots),
    protected_paths: strArr(o.protected_paths),
    dependency_manifest: str(o.dependency_manifest).trim(),
    canonical_modules: modules,
    import_aliases: aliases,
    gate_commands: gates,
  };
}

function coerceGate(raw: unknown, _workspacePath: string): GateCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const command = typeof o.command === 'string' ? o.command.trim() : '';
  if (!command) return null;
  const kind = GATE_KINDS.includes(o.kind as GateKind) ? (o.kind as GateKind) : 'test';
  const args = Array.isArray(o.args) ? o.args.filter((x): x is string => typeof x === 'string') : [];
  const cwd = typeof o.cwd === 'string' && o.cwd.trim() ? o.cwd.trim() : undefined;
  const timeoutMs = typeof o.timeoutMs === 'number' && o.timeoutMs > 0 ? o.timeoutMs : 600_000;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : `${kind}:${command}`;
  return { name, kind, command, args, cwd, timeoutMs };
}

/** Parse + validate the LLM's recon plan JSON, or null when unusable. */
export function parseReconPlan(parsed: unknown, workspacePath: string): Phase9ReconPlan | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const areas = Array.isArray(o.areas)
    ? (o.areas as unknown[]).map(a => coerceArea(a, workspacePath)).filter((a): a is ReconArea => a !== null)
    : [];
  if (areas.length === 0) return null;
  const wk = typeof o.workspace_kind === 'string' ? o.workspace_kind : '';
  const workspace_kind: Phase9ReconPlan['workspace_kind'] =
    wk === 'brownfield' || wk === 'mixed' ? wk : 'greenfield';
  const boundaries: IntegrationBoundary[] = Array.isArray(o.integration_boundaries)
    ? (o.integration_boundaries as unknown[]).map(b => {
        const bo = (b ?? {}) as Record<string, unknown>;
        return {
          description: typeof bo.description === 'string' ? bo.description : '',
          between: Array.isArray(bo.between) ? bo.between.filter((x): x is string => typeof x === 'string') : [],
          mechanism: typeof bo.mechanism === 'string' ? bo.mechanism : '',
        };
      }).filter(b => b.between.length > 0)
    : [];
  return {
    kind: 'phase9_recon_plan',
    schemaVersion: '1.0',
    workspace_kind,
    source: 'agent',
    areas,
    integration_boundaries: boundaries,
    notes: typeof o.notes === 'string' ? o.notes : '',
  };
}

/**
 * Run Phase 9.0 reconnaissance: deterministic inventory + advisory intent → an
 * LLM judgment → validated `phase9_recon_plan`, persisted as an artifact. Runs
 * FIRST in Phase 9.0 (before ownership/scaffold/packet synthesis) so downstream
 * reflects per-area decisions. Never throws — falls back to a deterministic
 * single-area plan on any failure.
 */
export async function runPhase9ReconSubPhase(ctx: PhaseContext): Promise<Phase9ReconPlan> {
  const { workflowRun, engine } = ctx;
  const workspacePath = engine.workspacePath;
  const inv = buildWorkspaceInventory(workspacePath);

  let plan: Phase9ReconPlan;
  try {
    const techConstraints = gatherTechnicalConstraints(engine, workflowRun.id);
    const components = gatherComponents(engine, workflowRun.id);
    const routing = engine.configManager.getLLMRouting().reasoning_review;
    const result = await engine.llmCaller.call({
      provider: routing.primary.provider,
      model: routing.primary.model,
      baseUrl: routing.primary.base_url,
      prompt: buildReconPrompt(inv, techConstraints, components),
      responseFormat: 'json',
      temperature: routing.temperature,
      traceContext: {
        workflowRunId: workflowRun.id,
        phaseId: '9',
        subPhaseId: 'reconnaissance',
        agentRole: 'reasoning_review',
        label: 'Phase 9.0 — Reconnaissance (per-area stack + gates)',
      },
    });
    plan = parseReconPlan(result.parsed, workspacePath) ?? deterministicReconFallback(workspacePath, inv);
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0 recon: LLM judgment failed — using deterministic fallback', {
      workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
    });
    plan = deterministicReconFallback(workspacePath, inv);
  }

  try {
    const record = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'reconnaissance',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: plan as unknown as Record<string, unknown>,
    });
    engine.ingestionPipeline.ingest(record);
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0 recon: persist failed (continuing with in-memory plan)', {
      workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
    });
  }

  getLogger().info('workflow', 'Phase 9.0 reconnaissance complete', {
    workflow_run_id: workflowRun.id,
    source: plan.source,
    workspace_kind: plan.workspace_kind,
    areas: plan.areas.map(a => `${a.area_id}:${a.stack}(${a.confidence})`),
    gate_count: reconGlobalGates(plan).length,
    conflicts: plan.areas.flatMap(a => a.conflicts).length,
  });
  return plan;
}

// ── Prompt + context gathering ──────────────────────────────────────

function gatherTechnicalConstraints(engine: PhaseContext['engine'], runId: string): string[] {
  const out: string[] = [];
  try {
    const recs = engine.writer.getRecordsByType(runId, 'artifact_produced');
    for (const r of recs) {
      const c = r.content as Record<string, unknown>;
      const kind = typeof c.kind === 'string' ? c.kind : '';
      if (!/technical_constraint/i.test(kind)) continue;
      const list = (c.technical_constraints ?? c.constraints) as Array<Record<string, unknown>> | undefined;
      for (const tc of Array.isArray(list) ? list : []) {
        const id = typeof tc.id === 'string' ? tc.id : '';
        const text = typeof tc.constraint === 'string' ? tc.constraint
          : (typeof tc.statement === 'string' ? tc.statement : (typeof tc.description === 'string' ? tc.description : ''));
        if (text) out.push(`${id ? id + ': ' : ''}${text}`);
      }
    }
  } catch { /* advisory — tolerate */ }
  return out.slice(0, 60);
}

function gatherComponents(engine: PhaseContext['engine'], runId: string): Array<{ id: string; name: string; domain: string }> {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'component_model');
    const comps = ((rec?.content as Record<string, unknown> | undefined)?.components as Array<Record<string, unknown>>) ?? [];
    return comps.map(c => ({
      id: typeof c.id === 'string' ? c.id : '',
      name: typeof c.name === 'string' ? c.name : '',
      domain: typeof c.domain_id === 'string' ? c.domain_id : '',
    })).filter(c => c.id).slice(0, 80);
  } catch { return []; }
}

function buildReconPrompt(
  inv: WorkspaceInventory,
  techConstraints: string[],
  components: Array<{ id: string; name: string; domain: string }>,
): string {
  const invStr = inv.is_empty
    ? '(empty / greenfield — no source files on disk yet)'
    : [
        `root manifests: ${inv.root_manifests.join(', ') || '(none)'}`,
        `detected single root stack: ${inv.detected_root_stack ?? '(none / ambiguous)'}`,
        'per-directory signals:',
        ...inv.dir_signals.map(d =>
          `  ${d.dir}/ — languages: ${Object.entries(d.languages).map(([l, n]) => `${l}×${n}`).join(', ') || '(none)'}`
          + (d.manifests.length ? `; manifests: ${d.manifests.join(', ')}` : '')),
      ].join('\n');

  return `You are the Phase 9 RECONNAISSANCE agent. With the filesystem facts and the advisory intent below, decide the EXECUTION ground: per-area tech stack, the directories each area owns, how areas integrate, and the per-area verification gate commands. This is JUDGMENT — show your evidence and surface conflicts; do not pretend certainty.

## Filesystem facts (deterministic scan)
${invStr}

## Stated technical constraints (BINDING — "apply without exception"; obey unless filesystem reality makes a constraint infeasible or contradictory, in which case surface it in \`conflicts\`)
${techConstraints.length ? techConstraints.map(t => `- ${t}`).join('\n') : '(none stated)'}

## Components / domains (from upstream decomposition, advisory)
${components.length ? components.map(c => `- ${c.id}${c.name ? ` (${c.name})` : ''}${c.domain ? ` [domain ${c.domain}]` : ''}`).join('\n') : '(none)'}

## Rules
- An "area" is a coherent slice of the workspace that uses ONE stack (a new feature, or an existing subsystem). Greenfield single-stack ⇒ ONE area.
- Choose each area's stack from the BINDING constraints when stated; else from the filesystem; else the most reasonable conventional choice for the intent. Put the evidence in \`source_refs\` and any tension in \`conflicts\`.
- For each area, author its gate commands: at minimum a \`test\` gate, plus \`typecheck\`/\`build\` where the stack has them. Use real commands for the stack (e.g. node: {"command":"npm","args":["test","--silent"]}; rust: {"command":"cargo","args":["test"]}; python: {"command":"pytest","args":["-q"]}). Set \`cwd\` (area-relative) when the area is not the workspace root.
- Author each area's ENFORCEMENT MANIFEST: \`dependency_manifest\` (the stack's manifest file), \`protected_paths\` (dirs/files the coding agents must NOT author — the shared module dir + the dependency manifest/config), \`canonical_modules\` (shared types/contracts the area exposes for cross-area import, with their import specifier), and \`import_aliases\` (the canonical import form, e.g. @shared/* → src/shared/*). These REPLACE the deterministic scaffold's substrate, so the kernel enforces against them.

Return JSON only (no markdown fences):
{
  "workspace_kind": "greenfield" | "brownfield" | "mixed",
  "areas": [
    {
      "area_id": "<short id>",
      "description": "<one line>",
      "stack": "node" | "python" | "rust" | "go" | "java" | "<other>",
      "confidence": "high" | "medium" | "low",
      "source_refs": ["<file path, TECH-* id, or intent excerpt>"],
      "conflicts": ["<stated-vs-reality tension, if any>"],
      "alternatives_rejected": ["<stack considered and why not>"],
      "source_roots": ["<workspace-relative source dir>"],
      "test_roots": ["<workspace-relative test dir>"],
      "dependency_manifest": "package.json" | "Cargo.toml" | "pyproject.toml" | "go.mod" | "pom.xml",
      "protected_paths": ["<dir/ or file the agents must not author>"],
      "canonical_modules": [ { "path": "<workspace-relative file>", "import_specifier": "<how consumers import it>", "description": "<one line>" } ],
      "import_aliases": [ { "alias": "@shared/*", "target": "src/shared/*" } ],
      "gate_commands": [
        { "name": "<area:kind>", "kind": "test"|"typecheck"|"build", "command": "<exe>", "args": ["..."], "cwd": "<area-relative dir or omit>", "timeoutMs": 600000 }
      ]
    }
  ],
  "integration_boundaries": [
    { "description": "<one line>", "between": ["<area_id>", "<area_id>"], "mechanism": "REST" | "shared database" | "message queue" | "<other>" }
  ],
  "notes": "<overall reasoning summary>"
}`;
}
