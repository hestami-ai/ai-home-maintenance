/**
 * Phase 9.0 — Scaffolding Agent (Stage 1+2 inc.2, the "Replace" authoring).
 *
 * Under the agreed authorship model the AGENT authors all scaffolding from the
 * recon plan; the kernel only ENFORCES. This step launches one executor session
 * with a precise SKELETON mandate (NOT feature work): per area, author the
 * dependency manifest + language/build config, the canonical shared modules
 * (from the data models + interface contracts), the directory layout, and the
 * import aliases the recon plan specifies.
 *
 * Safety: a missing dependency manifest after the agent runs is a foundational
 * failure (every downstream leaf would fail to resolve imports), worse than the
 * run-to-run variance the model accepts. So the caller keeps the deterministic
 * materializer as a CATASTROPHIC SAFETY NET (not a hybrid fast-path): if the
 * agent produced no primary manifest, fall back to it. `producedPrimaryManifest`
 * reports that.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../../logging';
import type { PhaseContext } from '../orchestratorEngine';
import type { ExecutorAgent } from '../../agents/executorAgent';
import type { Phase9ReconPlan } from './phase9Recon';
import { canonicalComponentDir } from './layoutContract';

export interface ScaffoldingAgentResult {
  /** True when every area's primary dependency manifest exists on disk after. */
  producedPrimaryManifest: boolean;
  invocationId: string | null;
  /** Per-area manifest existence (audit). */
  manifestsPresent: Record<string, boolean>;
}

export async function runScaffoldingAgentSubPhase(
  ctx: PhaseContext,
  plan: Phase9ReconPlan,
  executorAgent: ExecutorAgent,
): Promise<ScaffoldingAgentResult> {
  const { workflowRun, engine } = ctx;
  // Project root: the scaffolding agent's cwd + where manifests are checked.
  const workspacePath = engine.projectRoot;
  const logger = getLogger();

  const dataModels = gatherDataModels(engine, workflowRun.id);
  const contracts = gatherContracts(engine, workflowRun.id);
  // Canonical component→dir map (= where impl tasks write + Phase 10 enforces).
  // Fed into every area's scaffold prompt so the agent never invents a divergent
  // per-component layout. STACK-AWARE: the per-component dir separator follows the
  // resolved stack (underscore for python/rust/go/java, hyphen for node) so the
  // scaffold agent creates the SAME dirs the executor write-scope resolves to —
  // otherwise the scaffold mints `src/link-management` (hyphen) while the executor
  // writes `src/link_management` (underscore), producing duplicate dirs (slice-156).
  // The stack is known at Phase 9 (recon); areas[0].stack is the resolved per-area
  // stack (applyForcedStack rewrites it for a forced sweep).
  const componentDirs = gatherComponentDirs(engine, workflowRun.id, plan.areas[0]?.stack);

  // ONE session per area — a polyglot workspace must not cram N stacks into a
  // single agent context; each area's session sees only its own stack + the
  // shared types it exposes. (Single-area greenfield ⇒ exactly one session.)
  const invocationIds: string[] = [];
  for (const area of plan.areas) {
    const task = {
      id: `task-scaffolding-${area.area_id}`,
      taskType: 'standard' as const,
      componentId: 'scaffolding',
      componentResponsibility: `Author the ${area.area_id} (${area.stack}) skeleton: manifest, config, canonical shared modules, layout.`,
      description:
        `PROJECT SCAFFOLDING for area "${area.area_id}" (stack ${area.stack}). Author ONLY the skeleton the implementation `
        + 'tasks will build on — no feature logic. (1) create the dependency manifest with the dependencies the stack needs and '
        + 'a runnable test script; (2) create the language/build configuration; (3) create the canonical shared modules this area '
        + 'exposes (from the data models / contracts) at EXACTLY the given paths, importable via the given stack-idiomatic import specifiers; (4) create the '
        + 'directory layout. Match the stack exactly; keep modules to minimal canonical type/record definitions.',
      completionCriteria: [
        { criterionId: 'CC-SCAF-001', description: `Area ${area.area_id} has its dependency manifest + build/test config, and its canonical shared modules exist at their stated paths with working imports.` },
      ],
      writeDirectoryPaths: areaWriteScope(area),
    };
    // PD-3: surface any layout reconciliation (declared area root overridden to the
    // canonical component-dir tree) rather than silently rewriting it in the prompt.
    const layout = reconcileAreaLayout(area, componentDirs);
    if (layout.reconciledFrom.length) {
      logger.info('workflow', 'Phase 9.0 scaffolding: reconciled area source root to canonical layout (PD-3)', {
        workflow_run_id: workflowRun.id, area: area.area_id,
        overridden_source_roots: layout.reconciledFrom, canonical_root: layout.sourceRoot,
      });
    }
    const stdin = buildAreaScaffoldingPrompt(area, dataModels, contracts, componentDirs);
    try {
      const r = await executorAgent.execute(task, workflowRun.id, stdin, workspacePath, engine.janumiCodeVersionSha);
      invocationIds.push(r.invocationId);
    } catch (err) {
      logger.warn('workflow', 'Phase 9.0 scaffolding agent threw for area (catastrophic safety net may run)', {
        workflow_run_id: workflowRun.id, area: area.area_id, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const invocationId: string | null = invocationIds[0] ?? null;

  const manifestsPresent: Record<string, boolean> = {};
  for (const a of plan.areas) {
    const manifest = a.dependency_manifest || 'package.json';
    const rel = a.source_roots[0] && a.source_roots[0] !== 'src'
      ? path.join(areaRoot(a.source_roots[0]), manifest)
      : manifest;
    manifestsPresent[a.area_id] = fs.existsSync(path.join(workspacePath, manifest))
      || fs.existsSync(path.join(workspacePath, rel));
  }
  const producedPrimaryManifest = plan.areas.length > 0 && plan.areas.every(a => manifestsPresent[a.area_id]);

  logger.info('workflow', 'Phase 9.0 scaffolding agent complete', {
    workflow_run_id: workflowRun.id,
    produced_primary_manifest: producedPrimaryManifest,
    manifests_present: manifestsPresent,
  });
  return { producedPrimaryManifest, invocationId, manifestsPresent };
}

/** One area's scaffolding write scope: its source/test roots plus the area
 *  root where its dependency manifest lives. */
export function areaWriteScope(area: Phase9ReconPlan['areas'][number]): string[] {
  const dirs = new Set<string>();
  dirs.add(area.source_roots[0] ? areaRoot(area.source_roots[0]) : '.');
  for (const r of area.source_roots) dirs.add(r);
  for (const r of area.test_roots) dirs.add(r);
  return [...dirs];
}

export function areaRoot(sourceRoot: string): string {
  // 'services/billing/src' → 'services/billing'; 'src' → '.'
  const norm = sourceRoot.replace(/\\/g, '/').replace(/\/+$/g, '');
  const segs = norm.split('/');
  return segs.length <= 1 ? '.' : segs.slice(0, -1).join('/');
}

// PD-2 (P9 prompt audit, cal-40): the shared data-model / contract blocks were
// `JSON.stringify(all, null, 1).slice(0, 8000)` — a raw pretty-printed firehose
// CLIPPED mid-object, so the injected JSON was truncated + unparseable (the
// opening `[` never closed before the next `##` header) and dropped most
// components' shapes — fatal for a task whose deliverable is "materialize every
// shared type ONCE". These renderers emit a curated, compact excerpt and drop
// whole items at the ITEM boundary when over budget (never clip mid-object → the
// block is always coherent), and dedup entities by name (each materialized once,
// a partial PD-5 mitigation).
const SCAFFOLD_DM_BUDGET = 8000;
const SCAFFOLD_CONTRACT_BUDGET = 5000;

// The canonical source root + shared dir the component-dir map is built on (mirrors
// canonicalComponentDir's defaults in layoutContract). Single source of truth so the
// component dirs, the reconciled area source root, and the alias targets all agree.
const SCAFFOLD_SRC_ROOT = 'src';
const SCAFFOLD_SHARED_DIR = 'src/shared';

/** One field of a merged shared entity: the first-seen rendering + every distinct
 *  variant seen for the SAME field name across components (PD-5 divergence). */
interface MergedField { primary: string; variants: Set<string>; }
interface MergedEntity {
  id: string;
  name: string;
  comps: string[];                 // ordered-unique component ids that defined it
  fields: Map<string, MergedField>; // by field name — union across variants
  rels: string[];                  // deduped relationship lines
  relSeen: Set<string>;
}

/** Render one field object to a `type (constraints)` display string. */
function fieldDisplay(fo: Record<string, unknown>): { name: string; text: string } {
  const fname = typeof fo.name === 'string' ? fo.name : '?';
  const ftype = typeof fo.type === 'string' ? fo.type : (typeof fo.data_type === 'string' ? fo.data_type : '?');
  const cons: string[] = [];
  if (fo.required === true || fo.is_identity === true) cons.push('required');
  if (typeof fo.constraints === 'string' && fo.constraints) cons.push(fo.constraints);
  if (typeof fo.foreign_key === 'string' && fo.foreign_key) cons.push(`fk:${fo.foreign_key}`);
  return { name: fname, text: `${ftype}${cons.length ? ` (${cons.join(', ')})` : ''}` };
}

export function renderSharedDataModels(models: unknown, budget: number): string {
  const list = Array.isArray(models) ? models : [];

  // PD-5 — the scaffold mandate is "materialize each shared type ONCE", but the
  // producer emits the SAME entity name in several components with DIVERGENT shapes
  // (e.g. ContractorMatchRecord 3× with different enums/fields). PD-2's keep-first
  // dedup silently dropped the variants' fields → the model invented its own union.
  // Instead MERGE same-named entities: UNION their fields (nothing lost), dedup
  // relationships, and where the SAME field diverges across components keep the
  // first but ANNOTATE the divergence inline so "materialize once" is satisfiable
  // deterministically and the genuine conflict is surfaced, not hidden.
  const byName = new Map<string, MergedEntity>();
  const order: string[] = [];
  for (const m of list) {
    if (typeof m !== 'object' || m === null) continue;
    const mo = m as Record<string, unknown>;
    const compId = typeof mo.component_id === 'string' ? mo.component_id : undefined;
    const entities = Array.isArray(mo.entities) ? mo.entities : [mo]; // element may itself be an entity
    for (const e of entities) {
      if (typeof e !== 'object' || e === null) continue;
      const eo = e as Record<string, unknown>;
      const name = typeof eo.name === 'string' ? eo.name : (typeof eo.id === 'string' ? eo.id : '');
      if (!name) continue;
      let ent = byName.get(name);
      if (!ent) {
        const id = typeof eo.id === 'string' ? eo.id : (compId ? `DM-${compId}-${name.toLowerCase()}` : name);
        ent = { id, name, comps: [], fields: new Map(), rels: [], relSeen: new Set() };
        byName.set(name, ent);
        order.push(name);
      }
      if (compId && !ent.comps.includes(compId)) ent.comps.push(compId);
      for (const f of Array.isArray(eo.fields) ? eo.fields : []) {
        if (typeof f !== 'object' || f === null) continue;
        const { name: fname, text } = fieldDisplay(f as Record<string, unknown>);
        const mf = ent.fields.get(fname);
        if (!mf) ent.fields.set(fname, { primary: text, variants: new Set([text]) });
        else mf.variants.add(text);
      }
      for (const r of Array.isArray(eo.relationships) ? eo.relationships : []) {
        if (typeof r !== 'object' || r === null) continue;
        const ro = r as Record<string, unknown>;
        const t = typeof ro.target_entity_id === 'string' ? ro.target_entity_id : (typeof ro.target === 'string' ? ro.target : '?');
        const relLine = `  → ${t} (${typeof ro.kind === 'string' ? ro.kind : 'references'}${typeof ro.ownership === 'string' ? `, ${ro.ownership}` : ''})`;
        if (!ent.relSeen.has(relLine)) { ent.relSeen.add(relLine); ent.rels.push(relLine); }
      }
    }
  }

  const blocks: string[] = [];
  let used = 0;
  let dropped = 0;
  for (const name of order) {
    const ent = byName.get(name)!;
    const compLabel = ent.comps.length === 0 ? ''
      : ent.comps.length === 1 ? ` (component: ${ent.comps[0]})`
      : ` (shared across components: ${ent.comps.join(', ')} — materialize ONCE)`;
    const lines = [`### ${ent.id} — ${ent.name}${compLabel}`, 'Fields:'];
    for (const [fname, mf] of ent.fields) {
      const alts = [...mf.variants].filter((v) => v !== mf.primary);
      lines.push(`  - ${fname}: ${mf.primary}${alts.length ? ` [divergent — also defined as: ${alts.join(' | ')} — reconcile to ONE canonical shape]` : ''}`);
    }
    lines.push(...ent.rels);
    const block = lines.join('\n');
    if (used + block.length + 2 > budget && blocks.length > 0) { dropped++; continue; }
    blocks.push(block);
    used += block.length + 2;
  }
  if (blocks.length === 0) return '(none)';
  let out = blocks.join('\n\n');
  if (dropped > 0) out += `\n\n… (${dropped} more shared entit${dropped === 1 ? 'y' : 'ies'} elided to fit budget — materialize the remainder from the data_models artifact)`;
  return out;
}

// PD-9 (P9 prompt audit): the scaffold is a TYPE-SHAPE deliverable (data shapes /
// records / contract types), explicitly NOT runtime behavior — yet interface
// contracts carry runtime error-handling (`error_responses` 400/401/…/500,
// `error_handling_strategy`, retry / rate-limit / timeout policy). Injecting it
// into the scaffold mis-frames runtime prose as code types, inflates the block,
// and feeds the PD-2 truncation. Strip the runtime-behavior fields before
// serializing; the implementation tasks own that behavior.
const CONTRACT_RUNTIME_FIELDS = new Set([
  'error_responses', 'error_handling_strategy', 'error_codes', 'errors',
  'retry_strategy', 'retry_policy', 'rate_limit', 'rate_limits',
  'timeout', 'timeouts', 'status_codes', 'sla',
]);

export function stripContractRuntimeFields(contract: unknown): unknown {
  if (typeof contract !== 'object' || contract === null || Array.isArray(contract)) return contract;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(contract as Record<string, unknown>)) {
    if (!CONTRACT_RUNTIME_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

export function renderContractsExcerpt(contracts: unknown, budget: number): string {
  const list = Array.isArray(contracts) ? contracts : [];
  const items: string[] = [];
  let used = 0;
  let dropped = 0;
  for (const c of list) {
    const s = JSON.stringify(stripContractRuntimeFields(c), null, 1);
    if (used + s.length + 1 > budget && items.length > 0) { dropped++; continue; }
    items.push(s);
    used += s.length + 1;
  }
  if (items.length === 0) return '(none)';
  let out = items.join('\n');
  if (dropped > 0) out += `\n… (${dropped} more contract(s) elided to fit budget)`;
  return out;
}

function gatherDataModels(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'data_models');
    if (!rec) return '(none)';
    const models = (rec.content as Record<string, unknown>).models ?? rec.content;
    return renderSharedDataModels(models, SCAFFOLD_DM_BUDGET);
  } catch { return '(none)'; }
}

function gatherContracts(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'interface_contracts');
    if (!rec) return '(none)';
    const contracts = (rec.content as Record<string, unknown>).contracts ?? rec.content;
    return renderContractsExcerpt(contracts, SCAFFOLD_CONTRACT_BUDGET);
  } catch { return '(none)'; }
}

/**
 * The CANONICAL component_id → source-directory map, computed the same way the
 * layout contract ({@link canonicalComponentDir}) and the executor write-scope
 * resolver do. STACK-AWARE: `comp-analytics-ingestion` → `src/analytics-ingestion`
 * for node, `src/analytics_ingestion` for python/rust/go/java (identifier-based
 * package stacks). Passing the resolved stack here keeps the scaffold agent's dirs
 * identical to the executor's `canonicalComponentDir(..., stack)`; omitting it (the
 * old bug) emitted hyphen dirs the python executor then forked into underscore
 * variants → duplicate dirs (slice-156).
 *
 * Feeding this into the scaffolding prompt is what prevents the scaffold agent
 * from inventing a divergent per-component layout (e.g. `src/components/<comp>/`):
 * with no canonical paths the agent fills the vacuum, and its guess collides with
 * where the implementation tasks actually write + what Phase 10 enforces. Sourced
 * from the structured component_model + data_models artifacts (NOT the sliced
 * prompt strings) so the roster is complete; pseudo-components (shared /
 * cross-cutting / root) collapse onto the shared dir / src root as the contract
 * specifies.
 */
export function gatherComponentDirs(
  engine: PhaseContext['engine'],
  runId: string,
  stack?: string,
): Array<{ id: string; dir: string }> {
  const ids = new Set<string>();
  const collect = (kind: string, arrayKeys: string[], idKey = 'id') => {
    try {
      const rec = engine.writer.getArtifactByKind(runId, kind);
      const content = (rec?.content ?? {}) as Record<string, unknown>;
      for (const key of arrayKeys) {
        const arr = content[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const v = (item as Record<string, unknown>)?.[idKey];
            if (typeof v === 'string' && v.trim()) ids.add(v.trim());
          }
        }
      }
    } catch { /* artifact absent — skip */ }
  };
  collect('component_model', ['components', 'component_model']);
  collect('data_models', ['models'], 'component_id');
  return [...ids]
    .sort()
    .map(id => ({ id, dir: canonicalComponentDir(id, SCAFFOLD_SRC_ROOT, SCAFFOLD_SHARED_DIR, stack) }));
}

// PD-3 (P9 prompt audit): the scaffold layout section rendered THREE roots from
// independent sources that could disagree — the area's `source_roots` (recon/LLM,
// e.g. `src/portal-web`), the `@shared/*` alias TARGET (`src/shared/*`), and the
// per-component dirs (`canonicalComponentDir` → `src/<comp>`). When the declared
// area root was not the canonical one the scaffolder could not resolve where
// `@shared` or the component dirs actually land (the observed "src/portal-web root
// vs src/<comp>/ vs @shared→src/shared" contradiction → invented fields, 0
// artifacts). The deterministic component-dir map is the layout AUTHORITY (the
// executor write-scope and Phase-10 enforce it), so we reconcile the area's
// declared source/test roots and alias targets to the tree the component dirs sit
// in, and render ONE coherent tree by construction. Greenfield (already `src`-rooted
// with `@shared→src/shared/*`) is unchanged. Brownfield's per-component dirs are a
// separate limitation of gatherComponentDirs (always `src/<comp>`), out of scope
// here — this only guarantees the prompt is INTERNALLY consistent.
export interface CoherentAreaLayout {
  /** The single source root every path below is rooted at. */
  sourceRoot: string;
  /** The one canonical shared-module dir (where `@shared` / shared types land). */
  sharedDir: string;
  testRoots: string[];
  /** Alias targets reconciled to the coherent tree (`@shared/*`→`<sharedDir>/*`, `@/*`→`<sourceRoot>/*`). */
  aliases: Array<{ alias: string; target: string }>;
  /** Area-declared source roots that disagreed and were overridden (audit/log). */
  reconciledFrom: string[];
}

function normLayoutPath(p: string): string {
  const s = (p ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
  return s === '.' ? '' : s; // a bare '.' is the repo root — the empty-string sentinel
}

/** True when `anc` is `desc` or a path-segment ancestor of it ('' = repo root, ancestor of all). */
function isPathAncestor(anc: string, desc: string): boolean {
  const a = normLayoutPath(anc);
  const d = normLayoutPath(desc);
  if (a === '') return true;
  return a === d || d.startsWith(a + '/');
}

/** The common PARENT directory of the component dirs — the tree they all sit under
 *  (`src/<comp>` dirs → `src`; `src/svc/<comp>` → `src/svc`). null when underivable. */
function commonParentRoot(dirs: string[]): string | null {
  const parents = dirs.map(normLayoutPath).filter(Boolean).map(d => {
    const segs = d.split('/');
    return segs.length <= 1 ? '' : segs.slice(0, -1).join('/');
  }).filter(Boolean);
  if (parents.length === 0) return null;
  let prefix = parents[0].split('/');
  for (const p of parents.slice(1)) {
    const segs = p.split('/');
    let i = 0;
    while (i < prefix.length && i < segs.length && prefix[i] === segs[i]) i++;
    prefix = prefix.slice(0, i);
  }
  const root = prefix.join('/');
  return root || null;
}

/**
 * Reconcile a recon area's declared layout to the tree its component dirs sit in,
 * so the scaffold prompt presents ONE coherent, rooted source tree (PD-3). The
 * authoritative root is derived from the component-dir map (fallback `src`); the
 * shared dir is `<root>/shared`; the standard `@shared`/`@` alias targets are
 * rebased onto that tree; declared source/test roots that would place the tree
 * elsewhere are overridden (and reported in `reconciledFrom`).
 */
export function reconcileAreaLayout(
  area: Pick<Phase9ReconPlan['areas'][number], 'source_roots' | 'test_roots' | 'import_aliases'>,
  componentDirs: Array<{ id: string; dir: string }> = [],
): CoherentAreaLayout {
  const root = commonParentRoot(componentDirs.map(c => c.dir)) ?? SCAFFOLD_SRC_ROOT;
  const shared = `${root}/shared`;
  const declared = (area.source_roots ?? []).map(normLayoutPath).filter(Boolean);
  // A declared root that is neither the canonical root nor an ancestor of it puts
  // the component dirs OUTSIDE it — a genuine disagreement; the canonical root wins.
  const reconciledFrom = declared.filter(s => !isPathAncestor(s, root) && s !== root);
  const filteredTests = (area.test_roots ?? []).map(normLayoutPath).filter(Boolean)
    .filter(t => isPathAncestor(root, t) || isPathAncestor(t, root));
  // When the source root was overridden the tests follow it; otherwise keep the
  // area's (tree-consistent) test roots, defaulting to the root for colocated tests.
  const testRoots = reconciledFrom.length ? [root] : (filteredTests.length ? filteredTests : [root]);
  const aliases = (area.import_aliases ?? []).map(al => {
    if (al.alias.startsWith('@shared')) return { alias: al.alias, target: `${shared}/*` };
    if (al.alias === '@/*' || al.alias === '@') return { alias: al.alias, target: `${root}/*` };
    return { alias: al.alias, target: al.target };
  });
  return { sourceRoot: root, sharedDir: shared, testRoots, aliases, reconciledFrom };
}

export function buildAreaScaffoldingPrompt(
  area: Phase9ReconPlan['areas'][number],
  dataModels: string,
  contracts: string,
  componentDirs: Array<{ id: string; dir: string }> = [],
): string {
  const stack = area.stack;
  const layout = reconcileAreaLayout(area, componentDirs);
  // Each module's `import_specifier` is STACK-IDIOMATIC (recon emits it per
  // language — see phase9Recon). Render it as "importable as (per <stack>)" so
  // the agent honors the same specifier the implementation tasks will import by.
  const mods = area.canonical_modules.length
    ? area.canonical_modules.map(m =>
        `  - ${m.path}${m.import_specifier ? `  — importable as (per ${stack}): ${m.import_specifier}` : ''}${m.description ? `  — ${m.description}` : ''}`).join('\n')
    : '  (none listed — derive the shared types this area needs from the data models / contracts)';
  // Aliases are a stack-SPECIFIC concept (TS/JS path aliases); only render the
  // line when recon actually emitted them. Other stacks import by module path.
  // Targets are the reconciled ones (rebased onto the coherent tree — PD-3).
  const aliasLine = layout.aliases.length
    ? `- import aliases (${stack}): ${layout.aliases.map(al => `${al.alias} → ${al.target}`).join(', ')}\n`
    : '';
  // The CANONICAL per-component directories — the exact paths the implementation
  // tasks will write to and Phase 10 enforces. Rendering them (and forbidding any
  // alternative layout) is what stops the agent inventing a divergent
  // `src/components/<comp>/` tree when `canonical_modules` is empty.
  const componentDirsBlock = componentDirs.length
    ? `## Component directories (canonical — implementation tasks write to these EXACT paths)\n`
      + componentDirs.map(c => `  - ${c.id} → ${c.dir}/`).join('\n')
      + `\nCreate these directories EMPTY — plus the ${stack} package/namespace init file ONLY if the stack requires one (e.g. \`__init__.py\`, \`mod.rs\`). Do NOT put feature files here (the implementation tasks own them), and do NOT invent an alternative layout (no \`components/\` or \`src/components/\` tree).\n\n`
    : '';
  const manifest = area.dependency_manifest || `(the ${stack} standard manifest)`;
  return `# Project Scaffolding — area "${area.area_id}" (stack: ${stack})\n\n`
    + `You are scaffolding the **${stack}** skeleton for this area. Produce IDIOMATIC ${stack} — `
    + `you know its conventions (manifest, module/package layout, import syntax, test runner, and the `
    + `language's type/record constructs). Author ONLY the skeleton below; the implementation tasks add feature behavior on top.\n\n`
    + `## Produce exactly these artifacts\n`
    + `1. The dependency manifest (${manifest}) with the dependencies this area needs and a runnable test command.\n`
    + `2. Any build / language configuration the ${stack} stack requires.\n`
    + `3. The canonical shared modules listed below, at their EXACT paths.\n`
    + `4. The shared data-model and interface-contract type/record DEFINITIONS (the data shapes below), materialized ONCE under the shared module dir.\n`
    + `5. The component directories listed below — created EMPTY.\n`
    + `Then verify it builds / type-checks / parses.\n\n`
    + `## What "skeleton" means here\n`
    + `Skeleton = directory + module structure, the dependency manifest/config, and the shared TYPE / CONTRACT DEFINITIONS (data shapes, signatures). It does NOT include feature behavior or algorithms — those belong to the implementation tasks. A type or record definition IS skeleton; business logic is not.\n\n`
    + `## Layout — ONE coherent source tree; EVERY path below is rooted at \`${layout.sourceRoot}/\`. Do NOT create a second source root or a nested \`components/\` tree.\n`
    + `- source root: ${layout.sourceRoot}/\n`
    + `- shared module dir: ${layout.sharedDir}/ — materialize the shared types/contracts here ONCE; components import them (never duplicate).\n`
    + `- test roots: ${layout.testRoots.join(', ')}\n`
    + `- dependency manifest: ${manifest}\n`
    + aliasLine + `\n`
    + componentDirsBlock
    + `## Canonical shared modules to create (exact paths)\n${mods}\n\n`
    + `## Shared data models — define as shared types/records under the shared module dir; components IMPORT them (never duplicate per-component)\n${dataModels}\n\n`
    + `## Interface contracts — define as shared contract types under the shared module dir\n${contracts}\n\n`
    + `## Documentation (REQUIRED)\n`
    + `- Every shared type / class / module you create MUST carry a brief doc-comment stating WHAT data shape or contract it materializes and citing the ACTUAL data-model or interface-contract id it comes from — cite the id verbatim from the "Shared data models" / "Interface contracts" blocks above (format: \`# <DM-id>\` or \`# per <IC-id>\` in python; \`// <DM-id>\` in TS/Go/Rust/Java). Do NOT invent an id that is not in those blocks.\n`
    + `- Comment the non-obvious WHY, not the WHAT; prefer self-documenting names over narration; leave no commented-out code.\n\n`
    + `## Rules\n`
    + `- Materialize the shared modules + data-model/contract definitions ONCE at the EXACT listed paths; components import them — never duplicate.\n`
    + `- Use ${stack}-idiomatic constructs throughout (types/records, modules, imports, manifest, test runner). Do not import another language's conventions or filenames.\n`
    + `- Component code lives ONLY in the canonical per-component directories above (the same paths the implementation tasks write to).\n`
    + `- Honor the ${stack} stack; do not introduce another language.\n`
    + `- Verify the skeleton builds / type-checks / parses before finishing.`;
}
