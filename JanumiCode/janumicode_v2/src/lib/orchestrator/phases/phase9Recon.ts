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
    root_manifests: [...new Set(rootManifests)].sort((a, b) => a.localeCompare(b)),
    dir_signals: [...byDir.values()].sort((a, b) => a.dir.localeCompare(b.dir)),
    detected_root_stack: detectWorkspaceStack(workspacePath)?.id ?? null,
  };
}

// ── Recon plan (evidence-backed judgment) ───────────────────────────

export type ReconConfidence = 'high' | 'medium' | 'low';

export interface ReconCanonicalModule {
  /** Workspace-relative file path the area produces (stack-appropriate extension),
   *  e.g. python 'src/shared/models/mapping.py', rust 'src/shared/models/mapping.rs',
   *  ts 'src/shared/models/Mapping.ts'. */
  path: string;
  /** STACK-IDIOMATIC specifier consumers import this module by — how code in THIS
   *  area's language refers to it: python 'shared.models.mapping', rust
   *  'crate::shared::models::mapping', ts '@shared/models/Mapping' (or relative),
   *  java the fully-qualified class/package. NOT a universal alias. */
  import_specifier: string;
  description: string;
}

/** Path-alias mapping — a stack-SPECIFIC concept (TS tsconfig `paths`, JS bundler
 *  aliases). Empty for stacks without an aliasing mechanism (python, rust, go, java),
 *  which use `import_specifier` (idiomatic module paths) directly instead. */
export interface ReconImportAlias {
  /** e.g. (TS) '@shared/*'. */
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
  /** Path aliases the area's code uses — ONLY for stacks that support aliasing
   *  (TS/JS, e.g. @shared/* → src/shared/*); EMPTY for python/rust/go/java. */
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
  /** Set when JANUMICODE_FORCE_STACK pinned every area to one stack (experiment audit). */
  forced_stack?: string;
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
  /** Primary stack (first area). Drives stack-aware path normalization (e.g.
   *  python component dirs must be underscore packages, not hyphenated). */
  primary_stack?: string;
  /** Workspace kind. The scheduler resolves component_id→dir ONLY for greenfield
   *  (brownfield keeps the recon-detected real directories). */
  workspace_kind?: string;
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

/** Strip trailing '/' characters in linear time (avoids ReDoS-prone `/\/+$/`). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

/** Normalize a path for comparison: strip leading/trailing slashes. */
function normPath(p: string): string {
  return stripTrailingSlashes((p ?? '').trim().replace(/^[./]+/, ''));
}

/**
 * Sanitize a recon area's `protected_paths`. The recon AGENT sometimes emits the
 * whole source root (e.g. `/src/`) as scaffold-owned — but per-component write
 * scopes live UNDER the source root (`src/link-management`), so a `do NOT author
 * /src/` directive directly contradicts the write scope and DEADLOCKS the
 * executor (it cannot write anywhere). Only PROPER subdirectories (e.g.
 * `src/shared/`) and manifest files are legitimately protected — drop any path
 * that equals a source root. The deterministic fallback already uses
 * `src/shared/`, so this only corrects agent output.
 */
function sanitizeProtectedPaths(protectedPaths: string[], sourceRoots: Set<string>): string[] {
  return protectedPaths.filter(p => {
    const n = normPath(p);
    return n.length > 0 && !sourceRoots.has(n);
  });
}

export function buildReconEnforcementManifest(plan: Phase9ReconPlan): ReconEnforcement {
  const protectedSet = new Set<string>();
  const modules: ReconCanonicalModule[] = [];
  const extByArea: Record<string, string[]> = {};
  // Every area's source roots — a protected path equal to any of these is
  // over-broad (it would swallow the per-component write directories beneath it).
  const sourceRoots = new Set(plan.areas.flatMap(a => a.source_roots.map(normPath)));
  // Per-area sanitized protected list (reused for the conventions string).
  const cleanProtectedByArea: Record<string, string[]> = {};
  for (const a of plan.areas) {
    const clean = sanitizeProtectedPaths(a.protected_paths, sourceRoots);
    cleanProtectedByArea[a.area_id] = clean;
    for (const p of clean) protectedSet.add(p);
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
      + `do NOT author: ${cleanProtectedByArea[a.area_id].join(', ') || '(none)'}.`;
  }).join('\n');
  return {
    protected_paths: [...protectedSet].sort((a, b) => a.localeCompare(b)),
    canonical_modules: modules,
    allowed_extensions_by_area: extByArea,
    conventions,
    primary_stack: plan.areas[0]?.stack,
    workspace_kind: plan.workspace_kind,
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
      const top = r.replaceAll('\\', '/').split('/')[0];
      if (top && top !== '.') topLevel.add(top);
    }
    if (a.source_roots[0]) componentDirMap[a.area_id] = a.source_roots[0];
    for (const al of a.import_aliases) aliases.set(al.alias, al.target);
    const sharedProtected = a.protected_paths.find(p => p.endsWith('/'));
    if (sharedProtected) sharedDir = stripTrailingSlashes(sharedProtected);
  }
  return {
    kind: 'project_layout_contract',
    component_dir_map: componentDirMap,
    import_aliases: [...aliases].map(([alias, target]) => ({ alias, target })),
    test_placement: 'colocated',
    shared_dir: sharedDir,
    allowed_top_level_dirs: [...topLevel].sort((a, b) => a.localeCompare(b)),
    allowed_source_extensions: [...exts].sort((a, b) => a.localeCompare(b)),
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
      protected_paths: ['src/shared/', manifestForStack(stack ?? 'node')],
      dependency_manifest: manifestForStack(stack ?? 'node'),
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

// ── Forced-stack override (experiment lever, e.g. the executor LANGUAGE sweep) ──

/** Stacks `applyForcedStack` knows how to materialize (manifest + gates + ext). */
export const KNOWN_FORCED_STACKS = ['node', 'python', 'go', 'rust', 'java'] as const;

const _FIVE_MIN = 300_000;
const _TEN_MIN = 600_000;

/** Canonical dependency manifest filename for a stack. */
export function manifestForStack(stack: string): string {
  switch (stack) {
    case 'rust': return 'Cargo.toml';
    case 'go': return 'go.mod';
    case 'python': return 'pyproject.toml';
    case 'java': return 'pom.xml';
    default: return 'package.json';
  }
}

/**
 * Pure per-stack default gate commands — the no-filesystem mirror of
 * {@link resolveGateCommands}'s per-stack arms. Used when forcing a stack onto a
 * greenfield plan (no manifest on disk yet, so the FS resolver can't fire).
 */
export function defaultGatesForStack(stack: string): GateCommand[] {
  switch (stack) {
    case 'rust':
      return [
        { name: 'rust:test', kind: 'test', command: 'cargo', args: ['test'], timeoutMs: _TEN_MIN },
        { name: 'rust:check', kind: 'typecheck', command: 'cargo', args: ['check'], timeoutMs: _FIVE_MIN },
      ];
    case 'go':
      return [
        { name: 'go:test', kind: 'test', command: 'go', args: ['test', './...'], timeoutMs: _TEN_MIN },
        { name: 'go:vet', kind: 'typecheck', command: 'go', args: ['vet', './...'], timeoutMs: _FIVE_MIN },
      ];
    case 'python':
      return [
        { name: 'python:test', kind: 'test', command: 'pytest', args: ['-q'], timeoutMs: _TEN_MIN },
      ];
    case 'java':
      return [
        { name: 'java:test', kind: 'test', command: 'mvn', args: ['-q', 'test'], timeoutMs: _TEN_MIN },
      ];
    case 'node':
    default:
      return [
        { name: 'node:test', kind: 'test', command: 'npm', args: ['test', '--silent'], timeoutMs: _TEN_MIN },
        { name: 'node:tsc', kind: 'typecheck', command: 'npx', args: ['--no-install', 'tsc', '--noEmit'], timeoutMs: _FIVE_MIN },
      ];
  }
}

export function primaryExtForStack(stack: string): string {
  return (STACK_EXTENSIONS[stack] ?? ['.ts'])[0];
}

/** Swap a file path's source extension to the target stack's primary one. */
function retargetExtension(p: string, stack: string): string {
  const ext = primaryExtForStack(stack);
  return p.replace(/\.[A-Za-z0-9]+$/, ext);
}

/**
 * Best-effort STACK-IDIOMATIC import specifier for a shared-module file path —
 * used when forcing a stack deterministically (the LLM recon agent emits these
 * directly in production). Strips a leading conventional source root + extension,
 * then renders the segments in the stack's import syntax. Heuristic, not a full
 * resolver: enough to keep `import (do NOT reinvent)` directives stack-correct.
 */
export function idiomaticImportSpecifier(filePath: string, stack: string): string {
  const segs = filePath.replace(/\.[A-Za-z0-9]+$/, '').split('/').filter(Boolean);
  if (segs[0] === 'src' || segs[0] === 'lib') segs.shift();
  if (segs.length === 0) return '';
  switch (stack) {
    case 'python': return segs.join('.');                 // shared.models.mapping
    case 'rust':   return 'crate::' + segs.join('::');    // crate::shared::models::mapping
    case 'java':   return segs.join('.');                 // shared.models.Mapping
    case 'go':     return segs.join('/');                 // module-relative path
    case 'node':
    default:       return '@/' + segs.join('/');          // @/shared/models/Mapping (alias form)
  }
}

/**
 * Rewrite every area of a recon plan to a single forced stack, preserving
 * TOPOLOGY (area ids, source/test roots, integration boundaries, conflicts) so
 * the ONLY variable that changes is the language. This is the deterministic
 * primitive behind the executor language-sweep bakeoff (and the future
 * production "preferred stack" tiebreaker). Unknown stacks are returned
 * unchanged (caller logs).
 */
export function applyForcedStack(plan: Phase9ReconPlan, stack: string): Phase9ReconPlan {
  if (!(KNOWN_FORCED_STACKS as readonly string[]).includes(stack)) return plan;
  const manifest = manifestForStack(stack);
  const aliases: ReconImportAlias[] = stack === 'node'
    ? [{ alias: '@shared/*', target: 'src/shared/*' }, { alias: '@/*', target: 'src/*' }]
    : [];
  const areas = plan.areas.map(a => {
    // Preserve directory protected-paths; replace the old manifest with the new.
    const protectedDirs = a.protected_paths.filter(p => p.endsWith('/'));
    return {
      ...a,
      stack,
      dependency_manifest: manifest,
      gate_commands: defaultGatesForStack(stack),
      protected_paths: [...protectedDirs, manifest],
      canonical_modules: a.canonical_modules.map(m => {
        const path = retargetExtension(m.path, stack);
        return { ...m, path, import_specifier: idiomaticImportSpecifier(path, stack) };
      }),
      import_aliases: aliases,
      source_refs: [...a.source_refs, `forced-stack:${stack}`],
    };
  });
  return {
    ...plan,
    forced_stack: stack,
    areas,
    notes: `${plan.notes} [stack forced to '${stack}' for executor language sweep — topology preserved]`,
  };
}

/**
 * For a GREENFIELD project the directory LAYOUT is deterministic — the recon
 * agent's job is the STACK + canonical-module decisions, NOT inventing a
 * topology. Left to itself the agent emits divergent layouts (the area_id as a
 * source dir — `source_roots: ['core-service']` → a whole project nested under
 * `project/core-service/`; `/src/` as a protected path) that conflict with the
 * executor's deterministic `canonicalComponentDir` (always `src/<comp>`),
 * fragmenting the generated codebase. Override the layout PATHS to the canonical
 * greenfield values (`src/` root, `src/shared/` + manifest protected), preserving
 * the agent's semantic output (stack, canonical_modules, import_aliases, gates).
 * Brownfield/mixed keep the agent's detected layout — real existing dirs matter.
 * Runs AFTER applyForcedStack so `dependency_manifest` is the resolved one.
 */
export function normalizeGreenfieldLayout(plan: Phase9ReconPlan): Phase9ReconPlan {
  if (plan.workspace_kind !== 'greenfield') return plan;
  return {
    ...plan,
    areas: plan.areas.map(a => ({
      ...a,
      source_roots: ['src'],
      test_roots: ['src'],
      protected_paths: ['src/shared/', a.dependency_manifest].filter(
        (p): p is string => typeof p === 'string' && p.length > 0,
      ),
    })),
  };
}

/**
 * Collapse a GREENFIELD recon plan's area partition to a DETERMINISTIC function
 * of the resolved stack(s), removing the LLM's run-to-run topology invention.
 *
 * The recon agent emits `area_id`, the area COUNT, and per-area `stack` as free
 * text, so the same intent yields a different partition every run (ws-156: ONE
 * run produced `core-service`, `core-service`, `core-backend`). But an "area" is
 * just the build/stack unit (one manifest + one gate set + one language) — for
 * single-stack greenfield there is exactly ONE, and per-leaf write scope is
 * resolved from `component_id`, never `area_id`. So the topology is derivable,
 * not a judgment call.
 *
 * Greenfield → group areas by `stack`:
 *   - one stack → a single area `area_id:'workspace'`
 *   - ≥2 stacks → one area per stack `area_id:'area-<stack>'` (sorted) — polyglot
 * The agent's genuine outputs are PRESERVED as a de-duped union within each group
 * (canonical_modules, import_aliases, gate_commands, evidence, conflicts). With
 * `area_id` deterministic, `primary_stack` (= sorted `areas[0].stack`) is too, so
 * the scaffold session id, the enforcement conventions, the component_dir_map key,
 * and the on-disk dir separator stop churning run-to-run. Brownfield/mixed are
 * returned unchanged (their areas are real existing subsystems, not inventions).
 * Runs BEFORE {@link normalizeGreenfieldLayout} so the latter sets canonical paths
 * on the collapsed areas.
 *
 * NOTE: this makes `area_id` deterministic GIVEN the stack(s). Pinning the STACK
 * CHOICE itself (binding TECH-* > detected > agent-majority) when the agent
 * waffles between stacks is a separate additive enhancement; JANUMICODE_FORCE_STACK
 * already pins it for the executor-language sweep.
 */
export function collapseGreenfieldAreas(plan: Phase9ReconPlan): Phase9ReconPlan {
  if (plan.workspace_kind !== 'greenfield' || plan.areas.length === 0) return plan;

  const byStack = new Map<string, ReconArea[]>();
  for (const a of plan.areas) {
    const g = byStack.get(a.stack);
    if (g) g.push(a); else byStack.set(a.stack, [a]);
  }
  const stacks = [...byStack.keys()].sort((a, b) => a.localeCompare(b));
  const single = stacks.length === 1;

  const uniq = <T>(xs: T[], key: (x: T) => string): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of xs) { const k = key(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
    return out;
  };
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  const idMap = new Map<string, string>(); // old area_id → new area_id
  const areas: ReconArea[] = stacks.map(stack => {
    const group = byStack.get(stack)!;
    const newId = single ? 'workspace' : `area-${stack}`;
    for (const a of group) idMap.set(a.area_id, newId);
    return {
      area_id: newId,
      description: single ? 'Whole workspace (single greenfield stack).' : `All ${stack} components.`,
      stack,
      confidence: group.reduce<ReconArea['confidence']>(
        (best, a) => ((rank[a.confidence] ?? 0) >= (rank[best] ?? 0) ? a.confidence : best), group[0].confidence),
      source_refs: uniq(group.flatMap(a => a.source_refs), x => x).sort((a, b) => a.localeCompare(b)),
      conflicts: uniq(group.flatMap(a => a.conflicts), x => x),
      alternatives_rejected: uniq(group.flatMap(a => a.alternatives_rejected), x => x),
      source_roots: ['src'],
      test_roots: ['src'],
      protected_paths: uniq(group.flatMap(a => a.protected_paths), x => x),
      dependency_manifest: group[0].dependency_manifest || manifestForStack(stack),
      canonical_modules: uniq(group.flatMap(a => a.canonical_modules), m => m.path),
      import_aliases: uniq(group.flatMap(a => a.import_aliases), al => al.alias),
      gate_commands: uniq(group.flatMap(a => a.gate_commands), g => g.name),
    };
  });

  // Remap integration boundaries onto surviving ids; drop now-self-referential ones.
  const integration_boundaries = single ? [] : plan.integration_boundaries
    .map(b => ({ ...b, between: uniq(b.between.map(id => idMap.get(id) ?? id), x => x) }))
    .filter(b => b.between.length >= 2);

  return { ...plan, areas, integration_boundaries };
}

/** Distinctive keyword → canonical stack id (no ambiguous short tokens like bare
 *  'go'/'java'; node is listed first so 'javascript' resolves to node). */
const STACK_KEYWORDS: Array<[string, string[]]> = [
  ['node', ['typescript', 'javascript', 'nodejs', 'node.js', 'sveltekit', 'svelte', 'nestjs', 'next.js', 'nextjs', 'express', 'deno', ' bun ', 'vite', 'better-auth', 'drizzle', 'prisma', 'react']],
  ['python', ['python', 'django', 'flask', 'fastapi', 'pydantic', 'sqlalchemy']],
  ['rust', ['rust', 'cargo', 'actix', 'axum', 'tokio']],
  ['go', ['golang', 'go module']],
  ['java', ['kotlin', 'spring boot', 'springboot', 'gradle', 'maven']],
];
function stackIdFromText(s: string): string | null {
  const t = ` ${s.toLowerCase()} `;
  for (const [stack, kws] of STACK_KEYWORDS) for (const kw of kws) if (t.includes(kw)) return stack;
  return null;
}

/**
 * Derive the prescribed workspace stack from the binding P1–P4 technical
 * constraints (the architecture decision), else null. Tally keyword hits across
 * all constraints and return the plurality stack (deterministic lexicographic
 * tiebreak). This is the "binding TECH-*" signal that stops recon free-inventing
 * python/native for a TypeScript-prescribed spec.
 */
export function prescribedStackFromConstraints(techConstraints: string[]): string | null {
  const tally = new Map<string, number>();
  for (const c of techConstraints ?? []) {
    const s = stackIdFromText(c);
    if (s) tally.set(s, (tally.get(s) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [s, n] of [...tally].sort((a, b) => a[0].localeCompare(b[0]))) if (n > bestN) { bestN = n; best = s; }
  return best;
}

/**
 * An empty project root IS greenfield regardless of the recon LLM's `workspace_kind`
 * claim. The greenfield determinism (collapse / pin / normalize) gates on that
 * field, so a model that mislabels an empty project 'mixed' (cal-41) silently
 * suppresses the stack-pin + area collapse. `is_empty` (deterministic filesystem
 * fact) is authoritative; override the claim. No-op for a non-empty (real
 * brownfield) workspace — its areas are genuine existing subsystems.
 */
export function overrideWorkspaceKindIfEmpty(plan: Phase9ReconPlan, isEmpty: boolean): Phase9ReconPlan {
  if (isEmpty && plan.workspace_kind !== 'greenfield') {
    return { ...plan, workspace_kind: 'greenfield' };
  }
  return plan;
}

/**
 * When a GREENFIELD recon plan proposes ≥2 stacks (the agent waffled — the exact
 * failure {@link collapseGreenfieldAreas}'s note calls out), pin the WHOLE plan to
 * ONE stack so it collapses to a single coherent `workspace` area instead of N
 * stack-areas that each re-scaffold the full component set at the same `src/` root
 * (the 8× collision + python-for-a-TS-spec observed in cal-41). Precedence:
 * detected-on-disk > prescribed TECH-* > the agent's plurality stack. No-op when
 * single-stack, brownfield, or JANUMICODE_FORCE_STACK already pinned it. Reuses the
 * topology-preserving {@link applyForcedStack} rewrite (then clears the sweep
 * marker, since this is an automatic pin, not the experiment lever).
 */
export function pinGreenfieldStack(
  plan: Phase9ReconPlan,
  opts: { detectedStack?: string | null; prescribedStack?: string | null },
): { plan: Phase9ReconPlan; pinnedTo: string | null; proposed: string[] } {
  const isKnown = (s: string | null | undefined): s is string =>
    !!s && (KNOWN_FORCED_STACKS as readonly string[]).includes(s);
  const proposed = [...new Set(plan.areas.map(a => a.stack))];
  if (plan.forced_stack || plan.workspace_kind !== 'greenfield' || proposed.length <= 1) {
    return { plan, pinnedTo: null, proposed };
  }
  const tally = new Map<string, number>();
  for (const a of plan.areas) tally.set(a.stack, (tally.get(a.stack) ?? 0) + 1);
  let plurality: string | null = null;
  let bestN = 0;
  for (const [s, n] of [...tally].sort((a, b) => a[0].localeCompare(b[0]))) if (n > bestN) { bestN = n; plurality = s; }
  const winner = [opts.detectedStack, opts.prescribedStack, plurality].find(isKnown) ?? null;
  if (!winner) return { plan, pinnedTo: null, proposed };
  const rewritten = applyForcedStack(plan, winner);
  return {
    plan: {
      ...rewritten,
      forced_stack: undefined,
      notes: `${plan.notes} [greenfield stack pinned to '${winner}' (agent proposed ${proposed.join('/')}) — one coherent area, no cross-stack src/ collision]`,
    },
    pinnedTo: winner,
    proposed,
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
  // Recon scans the agent-owned project root (where generated code/manifests
  // live), not the control-plane workspace root.
  const workspacePath = engine.projectRoot;
  const inv = buildWorkspaceInventory(workspacePath);
  const techConstraints = gatherTechnicalConstraints(engine, workflowRun.id);
  const components = gatherComponents(engine, workflowRun.id);

  let plan: Phase9ReconPlan;
  try {
    // Recon gets its OWN routing role; fall back to reasoning_review when unset so
    // production (gemini-2.5-flash) is byte-unchanged. A calibration/CI config that
    // pins reasoning_review to a tiny reviewer model must set `reconnaissance` to a
    // capable model so this architectural judgment isn't done by a 4B model.
    // NB: `agentRole` below STAYS 'reasoning_review' — it is load-bearing in
    // llmCaller (skips deterministic JSON recovery / LLM json-repair / the review
    // hook); only the routing lookup changes.
    const llmRouting = engine.configManager.getLLMRouting();
    const routing = llmRouting.reconnaissance ?? llmRouting.reasoning_review;
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

  // The greenfield transforms (collapseGreenfieldAreas / pinGreenfieldStack /
  // normalizeGreenfieldLayout) all gate on `workspace_kind`, but that field is set
  // by the LLM — and in cal-41 the recon agent returned 'mixed' for an EMPTY
  // project root, which silently suppressed the stack-pin + area collapse (letting
  // the python-for-a-TS-spec + N-area partition through). `inv.is_empty` is the
  // deterministic truth: an empty project root IS greenfield, whatever the model
  // claims. Override it so the greenfield determinism actually fires.
  const kindOverridden = overrideWorkspaceKindIfEmpty(plan, inv.is_empty);
  if (kindOverridden !== plan) {
    getLogger().info('workflow', 'Phase 9.0 recon: workspace_kind → greenfield (project root is empty; model claimed otherwise)', {
      workflow_run_id: workflowRun.id, model_claimed: plan.workspace_kind,
    });
    plan = kindOverridden;
  }

  // Experiment lever: pin the whole plan to one stack (executor language sweep).
  // Topology stays as recon decided; only the language changes. Deterministic,
  // so a cached/fallback recon plan is overridden identically.
  const forced = (process.env.JANUMICODE_FORCE_STACK ?? '').trim().toLowerCase();
  if (forced) {
    if ((KNOWN_FORCED_STACKS as readonly string[]).includes(forced)) {
      plan = applyForcedStack(plan, forced);
      getLogger().info('workflow', 'Phase 9.0 recon: stack FORCED via JANUMICODE_FORCE_STACK', {
        workflow_run_id: workflowRun.id, forced_stack: forced,
      });
    } else {
      getLogger().warn('workflow', 'Phase 9.0 recon: JANUMICODE_FORCE_STACK is not a known stack — ignored', {
        workflow_run_id: workflowRun.id, forced_stack: forced, known: KNOWN_FORCED_STACKS,
      });
    }
  }

  // Auto-pin the greenfield stack BEFORE collapse when the agent waffled between
  // stacks (D6/D3 — cal-41 proposed native/node/sveltekit/python/other, each
  // becoming its own area that re-scaffolds the WHOLE component set at src/ → the
  // 8× collision + python-for-a-TS-spec). Precedence: detected-on-disk >
  // prescribed TECH-* > agent plurality. Then collapse sees ONE stack → ONE
  // `workspace` area. No-op for single-stack / brownfield / forced-stack plans.
  const prescribedStack = prescribedStackFromConstraints(techConstraints);
  const pin = pinGreenfieldStack(plan, { detectedStack: inv.detected_root_stack, prescribedStack });
  if (pin.pinnedTo) {
    plan = pin.plan;
    getLogger().info('workflow', 'Phase 9.0 recon: greenfield stack auto-pinned (agent waffled between stacks)', {
      workflow_run_id: workflowRun.id, pinned_to: pin.pinnedTo, agent_proposed: pin.proposed,
      detected: inv.detected_root_stack, prescribed: prescribedStack,
    });
  }

  // Greenfield TOPOLOGY is DETERMINISTIC. First collapse the agent's invented
  // area partition to one area per stack (`workspace` for single-stack), so
  // `area_id`/count/`primary_stack` stop churning run-to-run (ws-156:
  // core-service↔core-backend within one run) — the agent's stack + canonical
  // modules + gates are preserved as a union. Then normalize the layout PATHS
  // (area_id-as-source-dir, /src/ protected → canonical src/) so the scaffolding
  // agent, the executor's canonicalComponentDir, and imports all agree. (slice-156)
  plan = collapseGreenfieldAreas(plan);
  plan = normalizeGreenfieldLayout(plan);

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

/**
 * The technical-constraint item objects under one `artifact_produced` record, or
 * `[]` when the record is not a technical-constraint artifact. Accepts both the
 * camelCase key Phase 1.0c writes (`technicalConstraints`, see phase1.ts) and the
 * snake_case an LLM might emit — the dual-key normalizer principle. A single-key
 * reader silently empties the list and the recon agent then sees "(none stated)"
 * and free-invents a stack.
 */
function extractConstraintList(content: Record<string, unknown>): Array<Record<string, unknown>> {
  const kind = typeof content.kind === 'string' ? content.kind : '';
  if (!/technical_constraint/i.test(kind)) return [];
  const list = (content.technicalConstraints ?? content.technical_constraints ?? content.constraints) as
    Array<Record<string, unknown>> | undefined;
  return Array.isArray(list) ? list : [];
}

/**
 * The constraint text. `TechnicalConstraint.text` is the real field (records.ts);
 * keep the other names as fallbacks for differently-shaped sources. Empty string
 * when none is present.
 */
function constraintText(tc: Record<string, unknown>): string {
  if (typeof tc.text === 'string') return tc.text;
  if (typeof tc.constraint === 'string') return tc.constraint;
  if (typeof tc.statement === 'string') return tc.statement;
  if (typeof tc.description === 'string') return tc.description;
  return '';
}

/** Render one constraint item as `ID: text` (id prefix omitted when absent), or
 *  '' when the item carries no text (caller skips it). */
function formatConstraint(tc: Record<string, unknown>): string {
  const text = constraintText(tc);
  if (!text) return '';
  const id = typeof tc.id === 'string' ? tc.id : '';
  return `${id ? id + ': ' : ''}${text}`;
}

export function gatherTechnicalConstraints(engine: PhaseContext['engine'], runId: string): string[] {
  const out: string[] = [];
  try {
    const recs = engine.writer.getRecordsByType(runId, 'artifact_produced');
    for (const r of recs) {
      for (const tc of extractConstraintList(r.content as Record<string, unknown>)) {
        const formatted = formatConstraint(tc);
        if (formatted) out.push(formatted);
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

/**
 * TECH-* substrings that make a constraint DECISIVE for the area/stack partition:
 * a language/framework choice, or a deployment-TOPOLOGY cue. Runtime libraries and
 * infrastructure services (Postgres, Docker, Cloudflare, oRPC, DBOS, …) do NOT
 * change how many services/areas exist — the ONE chosen stack simply consumes
 * them — so recon must NOT weigh them when partitioning. Deliberately NARROWER
 * than STACK_KEYWORDS (which also matches libs like better-auth/prisma/react) so a
 * library mention can't masquerade as a stack/topology signal. (cal-41: dumping
 * all 18 TECH-* undifferentiated led a small model to cite Cloudflare/Traefik/DBOS
 * as justification for 8 microservice areas — over-decomposition the greenfield
 * collapse then had to undo.)
 */
const RECON_DECISIVE_CUES = [
  'typescript', 'javascript', 'node.js', 'nodejs', ' node ', 'sveltekit', 'svelte', 'deno', ' bun ', 'nestjs', 'next.js', 'nextjs', 'express',
  'python', 'django', 'flask', 'fastapi', 'rust', 'cargo', 'golang', 'go module', 'java', 'kotlin', 'spring',
  'single service', 'one service', 'single deployable', 'one deployable', 'single container', 'single process',
  'modular monolith', 'monolith', 'monorepo', 'microservice', 'no microservice', 'separate service', 'separate deployable',
  'only public entry point', 'public entry point', 'single application', 'one application',
];

/** Whether a `TECH-id: text` constraint is a stack/topology decision driver (vs. a
 *  runtime library the chosen stack merely uses). Exported for unit testing. */
export function isDecisiveForArea(c: string): boolean {
  const t = ` ${c.toLowerCase()} `;
  return RECON_DECISIVE_CUES.some(k => t.includes(k));
}

/** Collapse a non-decisive runtime-library constraint to a short one-liner
 *  (id + first few words) — enough context for the executor-facing notes without
 *  the full-text bloat that mis-weights the area partition. */
function summarizeLibConstraint(c: string): string {
  const i = c.indexOf(':');
  const id = i >= 0 ? c.slice(0, i).trim() : '';
  const text = (i >= 0 ? c.slice(i + 1) : c).trim().split(/\s+/).slice(0, 8).join(' ');
  return id ? `${id} (${text})` : text;
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
        ...inv.dir_signals.map(d => {
          const langs = Object.entries(d.languages).map(([l, n]) => `${l}×${n}`).join(', ') || '(none)';
          const manifests = d.manifests.length ? `; manifests: ${d.manifests.join(', ')}` : '';
          return `  ${d.dir}/ — languages: ${langs}${manifests}`;
        }),
      ].join('\n');

  const componentsList = components.length
    ? components
        .map(c => {
          const nameSuffix = c.name ? ` (${c.name})` : '';
          const domainSuffix = c.domain ? ` [domain ${c.domain}]` : '';
          return `- ${c.id}${nameSuffix}${domainSuffix}`;
        })
        .join('\n')
    : '(none)';

  return `You are the Phase 9 RECONNAISSANCE agent. From the filesystem facts and the BINDING technical constraints below, decide the EXECUTION ground: per-area tech stack, the directories each area owns, how areas integrate, and the per-area verification gate commands. This is JUDGMENT — show your evidence and surface conflicts; do not pretend certainty. The technical constraints are binding, not advisory: obey them (including topology constraints like "a single service" / "no microservices") unless the filesystem makes one infeasible, in which case surface it in \`conflicts\` rather than silently overriding.

## Filesystem facts (deterministic scan)
${invStr}

## Stated technical constraints
### Stack & topology (BINDING — these decide the stack AND how many deployables/areas exist; obey unless the filesystem makes one infeasible, then surface it in \`conflicts\`)
${(() => {
    const decisive = techConstraints.filter(isDecisiveForArea);
    return decisive.length
      ? decisive.map(t => `- ${t}`).join('\n')
      : '(none stated — infer the stack from the filesystem/intent; default to ONE area)';
  })()}
### Runtime dependencies & infrastructure (context only — libraries/services the ONE chosen stack consumes; they do NOT create separate areas or deployables)
${(() => {
    const runtime = techConstraints.filter(c => !isDecisiveForArea(c));
    return runtime.length ? runtime.map(c => `- ${summarizeLibConstraint(c)}`).join('\n') : '(none)';
  })()}

## Candidate modules (internal building blocks of the service — NOT a service list)
Treat these as modules WITHIN ONE deployable service (one area) unless a BINDING stack/topology constraint above explicitly mandates a separate deployable for one. Do NOT create one area/service per component — that 1:1 mapping is the over-decomposition this phase exists to prevent.
${componentsList}

## Rules
- An "area" is a coherent slice of the workspace that uses ONE stack (a new feature, or an existing subsystem). Greenfield single-stack ⇒ ONE area. Default to the FEWEST areas the work needs: prefer a single area unless the filesystem shows distinct existing subsystems, or a binding constraint requires separate deployables. Multiple internal concerns inside ONE deployable service are ONE area, not several — do NOT split a single-service intent into per-feature microservices.
- Choose each area's stack from the BINDING constraints when stated; else from the filesystem; else the most reasonable conventional choice for the intent. Put the evidence in \`source_refs\` and any tension in \`conflicts\`.
- For each area, author its gate commands: at minimum a \`test\` gate, plus \`typecheck\`/\`build\` where the stack has them. Use real commands for the stack (e.g. node: {"command":"npm","args":["test","--silent"]}; rust: {"command":"cargo","args":["test"]}; python: {"command":"pytest","args":["-q"]}). Set \`cwd\` (area-relative) when the area is not the workspace root.
- Author each area's ENFORCEMENT MANIFEST: \`dependency_manifest\` (the stack's manifest file), \`protected_paths\` (dirs/files the coding agents must NOT author — the shared module dir + the dependency manifest/config), \`canonical_modules\` (shared types/contracts the area exposes for cross-area import), and \`import_aliases\`. These REPLACE the deterministic scaffold's substrate, so the kernel enforces against them.
- Import conventions are STACK-IDIOMATIC, not universal. Each canonical module's \`import_specifier\` is how code in THIS area's language imports that file: python a dotted module path (\`shared.models.mapping\`), rust a path (\`crate::shared::models::mapping\`), TS an alias or relative path (\`@shared/models/Mapping\`), java the package/class. Use file paths + extensions that match the stack (\`.py\`/\`.rs\`/\`.ts\`/\`.java\`). \`import_aliases\` is a path-alias mechanism that ONLY some stacks have (TS \`tsconfig paths\`, JS bundlers) — emit them for those stacks, and leave \`import_aliases\` an empty \`[]\` for python/rust/go/java (they have no aliasing; consumers use the idiomatic \`import_specifier\` directly).

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
      "canonical_modules": [ { "path": "<workspace-relative file, stack extension>", "import_specifier": "<stack-idiomatic import: py 'shared.db', rust 'crate::db', ts '@shared/db'>", "description": "<one line>" } ],
      "import_aliases": [ /* TS/JS only, else []: */ { "alias": "@shared/*", "target": "src/shared/*" } ],
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
