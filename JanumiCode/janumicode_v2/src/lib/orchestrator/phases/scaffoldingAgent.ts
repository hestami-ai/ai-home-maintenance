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
  const norm = sourceRoot.replaceAll('\\', '/').replace(/\/+$/g, '');
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
// D7 (P9 audit): the shared-data-model block is the executor's ONLY source for
// the shape of every shared type it must materialize ONCE. Dropping types — and
// pointing at "the data_models artifact", which the headless executor session
// (cwd=<ws>/project) cannot open — left them unmaterialized. The ownership rewrite
// already shrinks this block (referenced copies collapse to one-line import
// stubs), so a generous budget keeps the whole set inline without real bloat.
const SCAFFOLD_DM_BUDGET = 40000;
const SCAFFOLD_CONTRACT_BUDGET = 5000;

// The canonical source root + shared dir the component-dir map is built on (mirrors
// canonicalComponentDir's defaults in layoutContract). Single source of truth so the
// component dirs, the reconciled area source root, and the alias targets all agree.
const SCAFFOLD_SRC_ROOT = 'src';
const SCAFFOLD_SHARED_DIR = 'src/shared';

/** Narrow a value to a trimmed non-empty string, else undefined. */
function asStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

/** Render one field object to a `type (constraints)` display string. Handles both
 *  a string `constraints` and a string[] `constraints` (the producer emits either). */
function fieldDisplay(fo: Record<string, unknown>): { name: string; text: string } {
  const fname = asStr(fo.name) ?? '?';
  const ftype = asStr(fo.type) ?? asStr(fo.data_type) ?? '?';
  const cons: string[] = [];
  if (fo.required === true || fo.is_identity === true) cons.push('required');
  if (typeof fo.constraints === 'string' && fo.constraints) cons.push(fo.constraints);
  else if (Array.isArray(fo.constraints)) for (const c of fo.constraints) { if (typeof c === 'string' && c) cons.push(c); }
  if (asStr(fo.foreign_key)) cons.push(`fk:${fo.foreign_key as string}`);
  return { name: fname, text: `${ftype}${cons.length ? ` (${cons.join(', ')})` : ''}` };
}

/**
 * Render one relationship object to a `  → <target> (<kind>[, <ownership>])` line.
 * D8 (P9 materialization audit): the producer emits the target under ANY of
 * target_entity_id / target_entity / target / entity / references (an FK ref like
 * `"WorkOrder.id"` → `WorkOrder`), and the kind under kind / type /
 * relationship_type. The old renderer read only target_entity_id/target + kind, so
 * the common `{type, references}` shape rendered as `→ ? (references)` — a
 * materialization bug misread earlier as an upstream data gap.
 */
function relationshipLine(ro: Record<string, unknown>): string {
  const rawTarget = asStr(ro.target_entity_id) ?? asStr(ro.target_entity) ?? asStr(ro.target)
    ?? asStr(ro.entity) ?? asStr(ro.references);
  const target = rawTarget ? rawTarget.split('.')[0] : '?';
  const kind = asStr(ro.kind) ?? asStr(ro.type) ?? asStr(ro.relationship_type) ?? 'references';
  const own = asStr(ro.ownership);
  return `  → ${target} (${kind}${own ? `, ${own}` : ''})`;
}

/** A raw per-component member of a same-named entity group. */
interface EntityMember { compId?: string; e: Record<string, unknown>; }

/** Group the models' entities by name, preserving first-seen order. */
function groupEntitiesByName(list: unknown[]): { order: string[]; groups: Map<string, EntityMember[]> } {
  const groups = new Map<string, EntityMember[]>();
  const order: string[] = [];
  for (const m of list) {
    if (typeof m !== 'object' || m === null) continue;
    const mo = m as Record<string, unknown>;
    const compId = asStr(mo.component_id);
    const entities = Array.isArray(mo.entities) ? mo.entities : [mo]; // element may itself be an entity
    for (const e of entities) {
      if (typeof e !== 'object' || e === null) continue;
      const eo = e as Record<string, unknown>;
      const name = asStr(eo.name) ?? asStr(eo.id);
      if (!name) continue;
      if (!groups.has(name)) { groups.set(name, []); order.push(name); }
      groups.get(name)!.push({ compId, e: eo });
    }
  }
  return { order, groups };
}

function memberId(m: EntityMember, name: string): string {
  return asStr(m.e.id) ?? (m.compId ? `DM-${m.compId}-${name.toLowerCase()}` : name);
}
function memberComp(m: EntityMember): string {
  return m.compId ?? asStr(m.e.owner_component_id) ?? '?';
}

/** Render a single entity block — its OWN fields + relationships (NO cross-component
 *  field union) under the given header label. */
function renderEntityBlock(m: EntityMember, name: string, label: string): string {
  const lines = [`### ${memberId(m, name)} — ${name}${label}`, 'Fields:'];
  for (const f of Array.isArray(m.e.fields) ? m.e.fields : []) {
    if (typeof f !== 'object' || f === null) continue;
    const { name: fn, text } = fieldDisplay(f as Record<string, unknown>);
    lines.push(`  - ${fn}: ${text}`);
  }
  for (const r of Array.isArray(m.e.relationships) ? m.e.relationships : []) {
    if (typeof r === 'object' && r !== null) lines.push(relationshipLine(r as Record<string, unknown>));
  }
  return lines.join('\n');
}

/** LEGACY (untagged) path — pre-P5.1b behavior: MERGE same-named entities, UNION
 *  their fields (annotating divergence), dedup relationships. Retained for
 *  data_models artifacts that predate entity_ownership_reconciliation. */
function renderLegacyMergedGroup(name: string, members: EntityMember[]): string {
  const comps: string[] = [];
  const fields = new Map<string, { primary: string; variants: Set<string> }>();
  const rels: string[] = [];
  const relSeen = new Set<string>();
  let id = '';
  for (const m of members) {
    if (!id) id = memberId(m, name);
    if (m.compId && !comps.includes(m.compId)) comps.push(m.compId);
    for (const f of Array.isArray(m.e.fields) ? m.e.fields : []) {
      if (typeof f !== 'object' || f === null) continue;
      const { name: fn, text } = fieldDisplay(f as Record<string, unknown>);
      const mf = fields.get(fn);
      if (!mf) fields.set(fn, { primary: text, variants: new Set([text]) });
      else mf.variants.add(text);
    }
    for (const r of Array.isArray(m.e.relationships) ? m.e.relationships : []) {
      if (typeof r !== 'object' || r === null) continue;
      const line = relationshipLine(r as Record<string, unknown>);
      if (!relSeen.has(line)) { relSeen.add(line); rels.push(line); }
    }
  }
  let compLabel: string;
  if (comps.length === 0) compLabel = '';
  else if (comps.length === 1) compLabel = ` (component: ${comps[0]})`;
  else compLabel = ` (shared across components: ${comps.join(', ')} — materialize ONCE)`;
  const lines = [`### ${id} — ${name}${compLabel}`, 'Fields:'];
  for (const [fn, mf] of fields) {
    const alts = [...mf.variants].filter((v) => v !== mf.primary);
    lines.push(`  - ${fn}: ${mf.primary}${alts.length ? ` [divergent — also defined as: ${alts.join(' | ')} — reconcile to ONE canonical shape]` : ''}`);
  }
  lines.push(...rels);
  return lines.join('\n');
}

/**
 * OWNERSHIP-AWARE (P5.1b) path — the data_models entities carry ownership_role /
 * owner_entity_id / owner_component_id from entity_ownership_reconciliation. Render
 * each concept per its DDD verdict rather than field-unioning every copy (D1/D2):
 *  - owned aggregate → the OWNER's shape ONCE (owner's id + owner's fields); the
 *    non-owner copies are references that IMPORT it, never re-materialized — this
 *    kills the shared-kernel field-union AND the wrong first-seen id.
 *  - shared value object → copied by value once (no owner, no reference).
 *  - separate (coincidental name collision) → each component's type distinctly.
 */
function renderOwnershipGroup(name: string, members: EntityMember[]): string[] {
  const owned = members.filter((m) => m.e.ownership_role === 'owned');
  const refd = members.filter((m) => m.e.ownership_role === 'referenced');
  const vos = members.filter((m) => m.e.ownership_role === 'shared_value_object');

  if (vos.length && owned.length === 0) {
    const comps = [...new Set(members.map(memberComp).filter((c) => c !== '?'))];
    const label = comps.length > 1 ? ` (value object — copied by value into: ${comps.join(', ')})` : '';
    return [renderEntityBlock(vos[0], name, label)];
  }
  if (owned.length === 1) {
    const refComps = [...new Set(refd.map(memberComp))];
    const label = refComps.length
      ? ` (owned by ${memberComp(owned[0])}; referenced by ${refComps.join(', ')} — those components IMPORT this type, they do NOT redefine it)`
      : ` (component: ${memberComp(owned[0])})`;
    return [renderEntityBlock(owned[0], name, label)];
  }
  if (owned.length > 1) {
    // 'separate' verdict — genuinely different concepts that share a name; keep
    // each distinct per-component type (never merged).
    return owned.map((m) => renderEntityBlock(m, name, ` (component: ${memberComp(m)})`));
  }
  // Only referenced copies present (the owner is materialized elsewhere) — emit an
  // import stub so the executor references the owned type rather than re-defining it.
  const r = refd[0] ?? members[0];
  const ownerId = asStr(r.e.owner_entity_id) ?? memberId(r, name);
  const ownerComp = asStr(r.e.owner_component_id) ?? '?';
  return [`### ${ownerId} — ${name} (referenced — owned by ${ownerComp}; IMPORT this type, do NOT redefine)`];
}

export function renderSharedDataModels(models: unknown, budget: number): string {
  const list = Array.isArray(models) ? models : [];
  const { order, groups } = groupEntitiesByName(list);

  const blocks: string[] = [];
  let used = 0;
  let dropped = 0;
  for (const name of order) {
    const members = groups.get(name)!;
    // Ownership mode when ANY copy carries a P5.1b tag; legacy union otherwise
    // (backward-compatible for pre-reconciliation data_models artifacts).
    const tagged = members.some((m) => typeof m.e.ownership_role === 'string');
    const rendered = tagged ? renderOwnershipGroup(name, members) : [renderLegacyMergedGroup(name, members)];
    for (const block of rendered) {
      if (used + block.length + 2 > budget && blocks.length > 0) { dropped++; continue; }
      blocks.push(block);
      used += block.length + 2;
    }
  }
  if (blocks.length === 0) return '(none)';
  let out = blocks.join('\n\n');
  if (dropped > 0) out += `\n\n… (${dropped} more shared entit${dropped === 1 ? 'y' : 'ies'} omitted for length — define ${dropped === 1 ? 'it' : 'them'} following the same owned-vs-reference pattern shown above)`;
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
    .sort((a, b) => a.localeCompare(b))
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
  const s = (p ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/g, '');
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
  let testRoots: string[];
  if (reconciledFrom.length) testRoots = [root];
  else if (filteredTests.length) testRoots = filteredTests;
  else testRoots = [root];
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
  // D14: the area's prescribed TECH-* ids (evidence the stack/library decision
  // rests on) and its verification gates were dropped from the prompt — so the
  // agent couldn't honor the specific runtime/library or author a skeleton that
  // passes the gates it will be checked against. Render both.
  const techRefs = area.source_refs.filter(r => r.toUpperCase().startsWith('TECH-'));
  const techRefsBlock = techRefs.length
    ? `## Prescribed technologies (honor these — do NOT substitute a different runtime/library)\n${techRefs.map(r => `  - ${r}`).join('\n')}\n\n`
    : '';
  const gatesBlock = area.gate_commands.length
    ? `## Verification gates — the authored skeleton MUST pass these once complete\n${area.gate_commands.map(g => `  - ${g.kind}: \`${g.command}${Array.isArray(g.args) && g.args.length ? ' ' + g.args.join(' ') : ''}\``).join('\n')}\n\n`
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
    + techRefsBlock
    + `## Canonical shared modules to create (exact paths)\n${mods}\n\n`
    + `## Shared data models — define as shared types/records under the shared module dir; components IMPORT them (never duplicate per-component)\n${dataModels}\n\n`
    + `## Interface contracts — define as shared contract types under the shared module dir\n${contracts}\n\n`
    + `## Documentation (REQUIRED)\n`
    + `- Every shared type / class / module you create MUST carry a brief doc-comment stating WHAT data shape or contract it materializes and citing the ACTUAL data-model or interface-contract id it comes from — cite the id verbatim from the "Shared data models" / "Interface contracts" blocks above (format: \`# <DM-id>\` or \`# per <IC-id>\` in python; \`// <DM-id>\` in TS/Go/Rust/Java). Do NOT invent an id that is not in those blocks.\n`
    + `- Comment the non-obvious WHY, not the WHAT; prefer self-documenting names over narration; leave no commented-out code.\n\n`
    + gatesBlock
    + `## Rules\n`
    + `- Materialize the shared modules + data-model/contract definitions ONCE at the EXACT listed paths; components import them — never duplicate.\n`
    + `- Use ${stack}-idiomatic constructs throughout (types/records, modules, imports, manifest, test runner). Do not import another language's conventions or filenames.\n`
    + `- Component code lives ONLY in the canonical per-component directories above (the same paths the implementation tasks write to).\n`
    + `- Honor the ${stack} stack; do not introduce another language.\n`
    + `- Verify the skeleton builds / type-checks / parses before finishing.`;
}
