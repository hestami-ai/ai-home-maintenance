/**
 * Module-Ownership Planner — Phase 9.0 Tier-A deterministic coordination.
 *
 * Phases 1–8 are filesystem-blind; the task `read_directory_paths` they emit
 * are *guidelines* ("you'll need a mapping repository"), not ground truth —
 * they drift (`mapping_repository` vs `…repository.ts`) and point at phantom
 * paths no component owns. With each executor leaf seeing only its own write
 * scope, multiple leaves independently — and correctly — build "a mapping
 * repository", producing the divergent-duplicate modules observed in
 * slice-139 (`mapping_repository` was demanded by 8 of 12 leaf components).
 *
 * This planner is the ONE global, deterministic pass that resolves that
 * coordination: it derives, from data already in the governed stream, a
 * single OWNER + canonical path + import specifier per shared module, and the
 * producer-before-consumer ordering edges that guarantee the owner's code
 * exists before its consumers run. No LLM, no regex id surgery — normalization
 * reuses {@link idComparisonKey}; directory mapping reuses
 * {@link canonicalComponentDir}.
 *
 * Pure function: the Phase-9 wiring extracts the inputs (leaf tasks, leaf
 * components with `sync_call` edges, data-model ownership) from the existing
 * effective views and feeds them here.
 */

import { idComparisonKey } from '../idResolver';
import { canonicalComponentDir } from './layoutContract';
import { resolveProjectProfile, type ProjectProfile } from './scaffoldSynthesis';
import { idiomaticImportSpecifier, primaryExtForStack, type Phase9ReconPlan } from './phase9Recon';
import type { PhaseContext } from '../orchestratorEngine';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveTaskView, buildEffectiveComponentView } from './phaseContext';

// ── Inputs ──────────────────────────────────────────────────────────

export interface PlannerTask {
  id: string;
  component_id: string;
  /** Cross-component shared-module DEMAND signal (LLM guidelines, may drift). */
  read_directory_paths: string[];
}

export interface PlannerComponent {
  id: string;
  dependencies: Array<{ component_id: string; kind: string }>;
}

export interface PlannerDataModel {
  entity_name: string;
  component_id: string;
  /** P5.1b entity_ownership_reconciliation verdict on this per-component copy. */
  ownership_role?: 'owned' | 'referenced' | 'shared_value_object';
  /** When ownership_role='referenced': the component that owns the aggregate. */
  owner_component_id?: string;
  /** The elected owner's canonical DM entity id (an owned copy's own id, or a
   *  referenced copy's owner_entity_id). */
  owner_entity_id?: string;
}

export interface ModuleOwnershipPlannerInput {
  tasks: PlannerTask[];
  components: PlannerComponent[];
  dataModels: PlannerDataModel[];
  /**
   * Leaf component id → its decomposition ROOT component id. Dependency edges
   * are typically declared at ROOT level (comp-redirect-handler →
   * comp-url-lifecycle) while the effective component set is the saturated
   * LEAVES, whose `dependencies` arrays are empty (slice-142). Without this
   * map, sink resolution finds no edges and every module degrades to the
   * unproducible shared fallback.
   */
  leafToRoot?: Record<string, string>;
  /** Depth-0 root components WITH their dependency edges. */
  rootComponents?: PlannerComponent[];
  /** Workspace src root + shared dir (from the scaffold profile / layout contract). */
  srcRoot?: string;
  sharedDir?: string;
  /**
   * Area tech stack (from recon). Drives the canonical file EXTENSION and the
   * STACK-IDIOMATIC import specifier: node/unknown keep the TS `@shared/*`/`@/*`
   * path aliases (unchanged); python/rust/go/java get idiomatic module paths
   * (e.g. `shared.lib.db`, `crate::shared::lib::db`). Defaults to node.
   */
  stack?: string;
}

// ── Output ──────────────────────────────────────────────────────────

export type OwnerSource = 'data_model_owner' | 'sync_call_sink' | 'consumer_fallback' | 'shared_fallback';

export interface SharedModule {
  /** Normalized canonical key (idComparisonKey of the basename) — collapses drift. */
  module_key: string;
  /** Representative file basename, e.g. `mapping_repository`. */
  basename: string;
  /** Shared-root category inferred from the demand path: repositories|services|utils|config|models|''. */
  category: string;
  /** Resolved single owner component id, or `'shared'` when cross-cutting. */
  owner_component_id: string;
  /** How the owner was resolved. */
  owner_source: OwnerSource;
  /** When the module is data-model-backed: the P5.1b elected owner's canonical DM
   *  entity id (D13) — lets downstream join the code module to the owned entity. */
  owner_entity_id?: string;
  /** Workspace-relative canonical file path the owner produces, e.g. `src/mapping-persistence/mapping_repository.ts`. */
  canonical_path: string;
  /** Stable import specifier consumers use, e.g. `@/mapping-persistence/mapping_repository` or `@shared/utils/encryption`. */
  import_specifier: string;
  /** Distinct components that READ (depend on) this module. */
  consumer_component_ids: string[];
  /** Raw demand paths that collapsed to this module (drift evidence). */
  demand_paths: string[];
}

export interface OrderingEdge {
  /** This component's tasks must run before `after_component_id`'s tasks. */
  before_component_id: string;
  after_component_id: string;
  /** The shared module that induced the edge (audit). */
  module_key: string;
}

export interface ModuleOwnershipPlan {
  kind: 'module_ownership_plan';
  schemaVersion: '1.0';
  shared_modules: SharedModule[];
  /** Producer-before-consumer edges to inject into scheduling. */
  ordering_edges: OrderingEdge[];
}

// ── Derivation ──────────────────────────────────────────────────────

const SHARED_ROOT_CATEGORIES = new Set(['repositories', 'services', 'utils', 'config', 'models', 'lib', 'helpers']);
/** Suffixes stripped to map a module basename back to its underlying entity. */
const ENTITY_SUFFIXES = ['_repository', '_repo', '_dao', '_store', '_service', '_model', '_table', '_mapper'];
/** Cross-cutting categories that default to the shared dir rather than a component owner. */
const SHARED_DIR_CATEGORIES = new Set(['utils', 'config', 'lib', 'helpers']);
/** D12: bare generic barrels (no shared-root category) are PER-COMPONENT files
 *  each component owns — not a cross-component shared module. Collapsing them to a
 *  single owner mislabels every other component's barrel as a foreign import. */
const GENERIC_BARREL_BASENAMES = new Set(['models', 'db', 'migrations', 'schema', 'index', 'entities']);

interface Demand {
  basename: string;
  category: string;
  consumers: Set<string>;
  demandPaths: Set<string>;
}

/** Linear trailing-slash strip (avoids the ReDoS-prone `/\/+$/` regex). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

/** Split a workspace-relative read path into { category, basename }. */
function splitReadPath(p: string): { category: string; basename: string } {
  const clean = stripTrailingSlashes(p.replaceAll('\\', '/').replace(/\.[a-z0-9]+$/i, ''));
  const segs = clean.split('/').filter(Boolean);
  const basename = segs.at(-1) ?? clean;
  // category = the parent segment when it is a recognized shared root.
  const parent = segs.length >= 2 ? segs[segs.length - 2] : '';
  const category = SHARED_ROOT_CATEGORIES.has(parent.toLowerCase()) ? parent.toLowerCase() : '';
  return { category, basename };
}

/** Strip an entity-suffix from a module basename to recover the entity token. */
function entityTokenOf(basename: string): string {
  const key = idComparisonKey(basename);
  for (const suf of ENTITY_SUFFIXES) {
    const sufKey = idComparisonKey(suf);
    if (key.endsWith(sufKey) && key.length > sufKey.length) {
      return key.slice(0, key.length - sufKey.length);
    }
  }
  return key;
}

/**
 * Build the import specifier + canonical path for a resolved owner, in the
 * area's stack idiom. node/unknown keep the TS path aliases (`@shared/*` for
 * shared modules, `@/*` for component-owned) — unchanged. Non-alias stacks
 * (python/rust/go/java) get the stack's file extension + an idiomatic module
 * specifier (e.g. `shared.lib.db`, `crate::shared::lib::db`) derived from the
 * canonical path, so the `import (do NOT reinvent)` directive is stack-correct.
 */
function placeModule(
  ownerComponentId: string,
  category: string,
  basename: string,
  srcRoot: string,
  sharedDir: string,
  stack: string,
): { canonical_path: string; import_specifier: string } {
  const ext = primaryExtForStack(stack);
  const aliased = stack === 'node' || !stack;
  if (ownerComponentId === 'shared') {
    const sub = category || 'lib';
    const canonical_path = `${sharedDir}/${sub}/${basename}${ext}`;
    return {
      canonical_path,
      import_specifier: aliased ? `@shared/${sub}/${basename}` : idiomaticImportSpecifier(canonical_path, stack),
    };
  }
  const dir = canonicalComponentDir(ownerComponentId, srcRoot, sharedDir, stack);
  const canonical_path = `${dir}/${basename}${ext}`;
  const rel = dir.replace(new RegExp(`^${srcRoot}/?`), '');
  return {
    canonical_path,
    import_specifier: aliased ? `@/${rel}/${basename}` : idiomaticImportSpecifier(canonical_path, stack),
  };
}

export function buildModuleOwnershipPlan(input: ModuleOwnershipPlannerInput): ModuleOwnershipPlan {
  const srcRoot = stripTrailingSlashes((input.srcRoot ?? 'src').replaceAll('\\', '/'));
  const sharedDir = stripTrailingSlashes((input.sharedDir ?? 'src/shared').replaceAll('\\', '/'));
  const stack = input.stack || 'node';

  // Component lookup + the set of components each component DEPENDS ON. A
  // dependency of any "consumption" kind (sync_call, uses, data_read) signals
  // the depended-on component is the hub that owns the shared service/module —
  // not just sync_call (Phase-4 models legitimately use `uses`/`data_read`,
  // e.g. slice-140's `dependency_type: "uses"`). async_event (pub/sub) is
  // excluded as it does not imply an owned shared module.
  const leafToRoot = input.leafToRoot ?? {};
  const syncTargetsByComponent = new Map<string, Set<string>>();
  const collectTargets = (c: PlannerComponent, into: Set<string>): void => {
    for (const d of c.dependencies ?? []) {
      // async_event (pub/sub) does not imply an owned shared module; every
      // other dependency kind (sync_call / uses / data_read / unknown) is a
      // consumption signal pointing at the owning hub.
      if (d.component_id && d.kind !== 'async_event') into.add(d.component_id);
    }
  };
  const rootById = new Map<string, PlannerComponent>();
  for (const r of input.rootComponents ?? []) rootById.set(r.id, r);
  for (const c of input.components) {
    const set = new Set<string>();
    collectTargets(c, set);
    // Leaf deps are usually EMPTY (saturation children don't inherit edges) —
    // fold in the leaf's ROOT-level edges so sink resolution sees the graph.
    const rootId = leafToRoot[c.id];
    const root = rootId ? rootById.get(rootId) : undefined;
    if (root) collectTargets(root, set);
    syncTargetsByComponent.set(c.id, set);
  }
  const componentIds = new Set(input.components.map((c) => c.id));
  const rootIds = new Set((input.rootComponents ?? []).map((r) => r.id));
  // Leaves grouped by root — used to pick the owning LEAF when a sink is a root.
  const leavesByRoot = new Map<string, string[]>();
  for (const [leaf, root] of Object.entries(leafToRoot)) {
    if (!componentIds.has(leaf)) continue;
    const arr = leavesByRoot.get(root) ?? [];
    arr.push(leaf);
    leavesByRoot.set(root, arr);
  }
  for (const arr of leavesByRoot.values()) arr.sort((a, b) => a.localeCompare(b));

  // data-model entity token -> owning component ids.
  const entityOwners = new Map<string, string[]>();
  for (const dm of input.dataModels) {
    if (!dm.entity_name || !dm.component_id) continue;
    const key = idComparisonKey(dm.entity_name);
    const arr = entityOwners.get(key) ?? [];
    if (!arr.includes(dm.component_id)) arr.push(dm.component_id);
    entityOwners.set(key, arr);
  }

  // P5.1b elected-owner index (D5/D13): entity token → the single reconciled
  // owning component + its canonical DM entity id. When present, this is
  // AUTHORITATIVE — it overrides the sync-sink/first-seen heuristic that would
  // otherwise be able to elect a REFERENCED copy's component as the module owner.
  // An 'owned' tag always wins; a 'referenced' tag contributes its owner pointer.
  const electedOwnerByEntityKey = new Map<string, { owner: string; entityId: string }>();
  for (const dm of input.dataModels) {
    if (!dm.entity_name) continue;
    const key = idComparisonKey(dm.entity_name);
    if (dm.ownership_role === 'owned') {
      electedOwnerByEntityKey.set(key, {
        owner: dm.component_id,
        entityId: dm.owner_entity_id ?? `DM-${dm.component_id}-${dm.entity_name.toLowerCase()}`,
      });
    } else if (dm.ownership_role === 'referenced' && dm.owner_component_id && !electedOwnerByEntityKey.has(key)) {
      electedOwnerByEntityKey.set(key, {
        owner: dm.owner_component_id,
        entityId: dm.owner_entity_id ?? `DM-${dm.owner_component_id}-${dm.entity_name.toLowerCase()}`,
      });
    }
  }

  // ── 1. Inventory: collapse drifted demand paths by normalized module key. ──
  const demandByKey = new Map<string, Demand>();
  for (const t of input.tasks) {
    for (const raw of t.read_directory_paths ?? []) {
      if (!raw) continue;
      const { category, basename } = splitReadPath(raw);
      const key = idComparisonKey(basename);
      if (!key) continue;
      const d = demandByKey.get(key) ?? { basename, category, consumers: new Set(), demandPaths: new Set() };
      // Prefer a basename that carries a category (more descriptive) for display.
      if (category && !d.category) { d.category = category; d.basename = basename; }
      if (t.component_id) d.consumers.add(t.component_id);
      d.demandPaths.add(raw);
      demandByKey.set(key, d);
    }
  }

  // ── 2/3. A module is SHARED when ≥2 distinct components read it, or it sits
  // under a recognized shared root. Resolve a single owner per shared module. ──
  const shared_modules: SharedModule[] = [];
  for (const [key, d] of demandByKey) {
    const consumers = [...d.consumers].filter((c) => c !== ''); // any task component
    // D12: a bare generic barrel (models/db/migrations/… with no shared-root
    // category) is a per-component file, not a shared module — skip it. The truly
    // shared data-model TYPES are materialized by the scaffold at src/shared.
    if (d.category === '' && GENERIC_BARREL_BASENAMES.has(idComparisonKey(d.basename))) continue;
    const isShared = d.consumers.size >= 2 || (d.category !== '' && SHARED_ROOT_CATEGORIES.has(d.category));
    if (!isShared) continue;

    const { owner, source, owner_entity_id } = resolveOwner(
      d, consumers, entityOwners, syncTargetsByComponent, componentIds,
      rootIds, leavesByRoot, electedOwnerByEntityKey,
    );
    const { canonical_path, import_specifier } = placeModule(owner, d.category, d.basename, srcRoot, sharedDir, stack);
    shared_modules.push({
      module_key: key,
      basename: d.basename,
      category: d.category,
      owner_component_id: owner,
      owner_source: source,
      owner_entity_id,
      canonical_path,
      import_specifier,
      consumer_component_ids: consumers.sort((a, b) => a.localeCompare(b)),
      demand_paths: [...d.demandPaths].sort((a, b) => a.localeCompare(b)),
    });
  }
  shared_modules.sort((a, b) => b.consumer_component_ids.length - a.consumer_component_ids.length
    || a.module_key.localeCompare(b.module_key));

  // ── 4. Producer-before-consumer ordering edges (owner before each consumer). ──
  const edgeSet = new Set<string>();
  const ordering_edges: OrderingEdge[] = [];
  for (const m of shared_modules) {
    if (m.owner_component_id === 'shared') continue; // shared dir is materialized up front
    for (const consumer of m.consumer_component_ids) {
      if (consumer === m.owner_component_id) continue;
      const sig = `${m.owner_component_id}->${consumer}`;
      if (edgeSet.has(sig)) continue;
      edgeSet.add(sig);
      ordering_edges.push({
        before_component_id: m.owner_component_id,
        after_component_id: consumer,
        module_key: m.module_key,
      });
    }
  }

  return { kind: 'module_ownership_plan', schemaVersion: '1.0', shared_modules, ordering_edges };
}

/**
 * Resolve the single owning component for a shared module, by precedence:
 *   1. data_model_owner — the module's entity (basename minus repo/service
 *      suffix) maps to a data-model entity; among that entity's owning
 *      components prefer the one others sync_call (the sink), else the first.
 *   2. sync_call_sink — the component most consumers sync_call (the hub the
 *      module logically lives behind), for non-cross-cutting categories.
 *   3. consumer_fallback — no dependency graph: the first consumer (sorted)
 *      produces the module in its own dir.
 *   4. shared_fallback — no consumers with a component id at all (nothing
 *      imports it, so the unproduced shared path is harmless).
 */
function resolveOwner(
  d: Demand,
  consumers: string[],
  entityOwners: Map<string, string[]>,
  syncTargetsByComponent: Map<string, Set<string>>,
  componentIds: Set<string>,
  rootIds: Set<string>,
  leavesByRoot: Map<string, string[]>,
  electedOwnerByEntityKey: Map<string, { owner: string; entityId: string }>,
): { owner: string; source: OwnerSource; owner_entity_id?: string } {
  // Tally how often each component is a dependency target across the consumers
  // (leaf edges + the folded-in root edges).
  const sinkTally = new Map<string, number>();
  for (const c of consumers) {
    for (const target of syncTargetsByComponent.get(c) ?? []) {
      sinkTally.set(target, (sinkTally.get(target) ?? 0) + 1);
    }
  }
  /**
   * A sink target may be a ROOT (dep edges are root-grained) whose work is
   * done by its LEAVES — resolve to the owning leaf: most data-model entities
   * owned, then module-consumer, then lexicographic (deterministic).
   */
  const resolveToLeaf = (comp: string): string | null => {
    if (componentIds.has(comp)) return comp;
    const leaves = leavesByRoot.get(comp);
    if (!leaves || leaves.length === 0) return null;
    const entityCount = (leaf: string): number => {
      let n = 0;
      for (const comps of entityOwners.values()) if (comps.includes(leaf)) n++;
      return n;
    };
    const consumerSet = new Set(consumers);
    const ranked = [...leaves].sort((a, b) =>
      (entityCount(b) - entityCount(a))
      || ((consumerSet.has(b) ? 1 : 0) - (consumerSet.has(a) ? 1 : 0))
      || a.localeCompare(b));
    return ranked[0];
  };
  const topSink = (candidates?: Set<string>): string | null => {
    let best: string | null = null;
    let bestN = 0;
    for (const [comp, n] of sinkTally) {
      if (candidates && !candidates.has(comp)) continue;
      if (!componentIds.has(comp) && !rootIds.has(comp)) continue;
      if (n > bestN) { bestN = n; best = comp; }
    }
    return best === null ? null : resolveToLeaf(best);
  };

  // 1. data-model entity ownership. PREFER the P5.1b elected owner (D5): when the
  // module's entity was reconciled to a single owning context, that owner is
  // authoritative (+ carries owner_entity_id for the downstream join, D13). Fall
  // back to the sink/first-seen heuristic only when no reconciliation tag exists.
  const token = entityTokenOf(d.basename);
  let elected = electedOwnerByEntityKey.get(token);
  if (!elected) {
    for (const [ek, v] of electedOwnerByEntityKey) {
      if (ek.includes(token) || token.includes(ek)) { elected = v; break; }
    }
  }
  if (elected && !SHARED_DIR_CATEGORIES.has(d.category)) {
    return { owner: elected.owner, source: 'data_model_owner', owner_entity_id: elected.entityId };
  }
  let entityComps: string[] = entityOwners.get(token) ?? [];
  if (entityComps.length === 0) {
    for (const [ek, comps] of entityOwners) {
      if (ek.includes(token) || token.includes(ek)) { entityComps = comps; break; }
    }
  }
  if (entityComps.length > 0 && !SHARED_DIR_CATEGORIES.has(d.category)) {
    const sink = topSink(new Set(entityComps));
    return { owner: sink ?? entityComps[0], source: 'data_model_owner' };
  }

  // 2. dependency-sink hub — for ALL categories, including cross-cutting
  // utils/config. Every shared module needs a PRODUCING component: the scaffold
  // does not materialize behavioral modules and `src/shared/` is leaf-protected,
  // so an `owner=shared` behavioral module would be importable-but-never-built
  // (slice-141: consumers told `import '@shared/lib/db'` with no producer). The
  // hub every consumer already depends on is the natural home; the module lives
  // in ITS directory (leaf-writable) and ordering edges run hub-before-consumers.
  const sink = topSink();
  if (sink) return { owner: sink, source: 'sync_call_sink' };

  // 3. No dependency graph → the FIRST consumer owns it (deterministic:
  // sorted order). Slice-142 live finding: `owner=shared` modules are
  // importable-but-never-built — the CONSUMES directive told the GDPR
  // middleware `import '@shared/lib/iputils'` while the scaffold only
  // materializes contracts/models, so the generated code shipped with
  // unresolvable imports. Same principle as the sink-hub rule above: every
  // shared module needs a PRODUCING component; with no hub, the first
  // consumer is the natural producer (its OWNS directive + ordering edges
  // make it exist before the other consumers run).
  const firstConsumer = [...consumers].sort((a, b) => a.localeCompare(b))[0];
  if (firstConsumer) return { owner: firstConsumer, source: 'consumer_fallback' };

  // 4. No consumers with a component id at all → shared dir. Harmless:
  // nothing imports a consumer-less module, so nothing references the
  // unproduced path.
  return { owner: 'shared', source: 'shared_fallback' };
}

// ── Phase 9.0a orchestration ────────────────────────────────────────

/**
 * Run the Phase 9.0a module-ownership planning sub-phase: extract the leaf
 * tasks (read-path demand), leaf components (`sync_call` edges), and data-model
 * ownership from the governed stream via the existing effective views, build
 * the deterministic ownership plan, persist it as a `module_ownership_plan`
 * artifact, and return it for the scaffold + scheduler to consume.
 *
 * Runs BEFORE scaffold synthesis so the layout/scaffold can declare the shared
 * modules' canonical paths and the scheduler can honor producer-before-consumer
 * ordering. Safe: returns null on any failure (execution proceeds without it).
 */
export function runModuleOwnershipPlanningSubPhase(
  ctx: PhaseContext,
  reconPlan?: Phase9ReconPlan | null,
): ModuleOwnershipPlan | null {
  const { workflowRun, engine } = ctx;
  try {
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const taskNodes = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node');
    const compNodes = engine.writer.getRecordsByType(workflowRun.id, 'component_decomposition_node');
    const taskView = buildEffectiveTaskView(taskNodes, prior);
    const compView = buildEffectiveComponentView(compNodes, prior);

    const tasks: PlannerTask[] = (taskView.tasks as Array<Record<string, unknown>>).map((t) => ({
      id: typeof t.id === 'string' ? t.id : '',
      component_id: typeof t.component_id === 'string' ? t.component_id : '',
      read_directory_paths: Array.isArray(t.read_directory_paths)
        ? (t.read_directory_paths as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
    }));

    const components: PlannerComponent[] = (compView.components as Array<Record<string, unknown>>).map((c) => ({
      id: typeof c.id === 'string' ? c.id : '',
      dependencies: Array.isArray(c.dependencies)
        ? (c.dependencies as Array<Record<string, unknown>>).map((d) => {
            const targetId = typeof d.target_component_id === 'string' ? d.target_component_id : '';
            const component_id = typeof d.component_id === 'string' ? d.component_id : targetId;
            const depType = typeof d.dependency_type === 'string' ? d.dependency_type : '';
            const kind = typeof d.kind === 'string' ? d.kind : depType;
            return { component_id, kind };
          })
        : [],
    }));

    const dmContent = prior.dataModels?.content as Record<string, unknown> | undefined;
    const dataModels: PlannerDataModel[] = [];
    for (const m of (dmContent?.models as Array<Record<string, unknown>> | undefined) ?? []) {
      const compId = typeof m.component_id === 'string' ? m.component_id : '';
      for (const e of (m.entities as Array<Record<string, unknown>> | undefined) ?? []) {
        const name = typeof e.name === 'string' ? e.name : '';
        if (!name || !compId) continue;
        const role = e.ownership_role;
        const fallbackEntityId = typeof e.id === 'string' ? e.id : undefined;
        dataModels.push({
          entity_name: name,
          component_id: compId,
          ownership_role: role === 'owned' || role === 'referenced' || role === 'shared_value_object' ? role : undefined,
          owner_component_id: typeof e.owner_component_id === 'string' ? e.owner_component_id : undefined,
          // For an 'owned' copy the canonical id IS its own id; a 'referenced' copy
          // carries the owner's id in owner_entity_id.
          owner_entity_id: typeof e.owner_entity_id === 'string' ? e.owner_entity_id : fallbackEntityId,
        });
      }
    }

    // Resolve the shared_dir the SAME way scaffold synthesis will (brownfield >
    // ADR override > config default) rather than reading the raw config default.
    // Ownership runs before scaffold, but resolveProjectProfile is deterministic
    // over already-present inputs (workspace files + the Phase-4 ADR artifact),
    // so both compute an identical shared_dir — without it, an ADR shared_dir
    // override would make ownership's canonical paths diverge from the scaffold's.
    const configProfile: Omit<ProjectProfile, 'source'> = (engine.configManager.get() as unknown as {
      scaffold?: { project_profile?: Omit<ProjectProfile, 'source'> };
    }).scaffold?.project_profile ?? {
      language: 'typescript', module: 'esm', test_runner: 'vitest', shared_dir: 'src/shared',
    };
    const adrsRecord = engine.writer.getArtifactByKind(workflowRun.id, 'architectural_decisions');
    const sharedDir = resolveProjectProfile(
      engine.projectRoot,
      (adrsRecord?.content as Record<string, unknown>) ?? null,
      configProfile,
    ).shared_dir;

    // Component leaf→root lineage + root-level dependency edges. Dependency
    // knowledge is declared on the depth-0 components; saturation children
    // carry empty deps (slice-142), so the planner needs both layers.
    const byNodeId = new Map<string, Record<string, unknown>>();
    for (const r of compNodes) {
      const c = r.content as Record<string, unknown>;
      if (typeof c.node_id === 'string') byNodeId.set(c.node_id, c);
    }
    const leafToRoot: Record<string, string> = {};
    const rootComponents: PlannerComponent[] = [];
    const seenRoots = new Set<string>();
    const mapDeps = (comp: Record<string, unknown>): PlannerComponent['dependencies'] =>
      (Array.isArray(comp.dependencies) ? comp.dependencies as Array<Record<string, unknown>> : []).map((dep) => {
        const targetId = typeof dep.target_component_id === 'string' ? dep.target_component_id : '';
        const component_id = typeof dep.component_id === 'string' ? dep.component_id : targetId;
        const depType = typeof dep.dependency_type === 'string' ? dep.dependency_type : '';
        const kind = typeof dep.kind === 'string' ? dep.kind : depType;
        return { component_id, kind };
      });
    for (const r of compNodes) {
      const c = r.content as Record<string, unknown>;
      const comp = c.component as Record<string, unknown> | undefined;
      const compId = comp && typeof comp.id === 'string' ? comp.id : '';
      if (!compId) continue;
      if (c.depth === 0 && !seenRoots.has(compId)) {
        seenRoots.add(compId);
        rootComponents.push({ id: compId, dependencies: mapDeps(comp!) });
      }
      // Walk to the depth-0 ancestor for the leaf→root map.
      let cur: Record<string, unknown> | undefined = c;
      const guard = new Set<string>();
      while (cur && cur.depth !== 0 && typeof cur.parent_node_id === 'string' && !guard.has(cur.parent_node_id as string)) {
        guard.add(cur.parent_node_id as string);
        cur = byNodeId.get(cur.parent_node_id as string);
      }
      const rootComp = cur && (cur.component as Record<string, unknown> | undefined);
      const rootId = rootComp && typeof rootComp.id === 'string' ? rootComp.id : compId;
      if (!leafToRoot[compId]) leafToRoot[compId] = rootId;
    }

    // Stack drives canonical extensions + idiomatic import specifiers. The
    // ownership plan is workspace-wide (shared modules cross components), so it
    // assumes a single primary stack — recon's first area, else node. (Polyglot
    // per-area shared-module ownership is a separate refinement; cross-language
    // shared imports aren't expressible anyway.)
    const stack = reconPlan?.areas?.[0]?.stack || 'node';
    const plan = buildModuleOwnershipPlan({ tasks, components, dataModels, leafToRoot, rootComponents, sharedDir, stack });

    const record = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'module_ownership_planning',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: plan as unknown as Record<string, unknown>,
    });
    engine.ingestionPipeline.ingest(record);

    getLogger().info('workflow', 'Phase 9.0a module_ownership_planning complete', {
      workflow_run_id: workflowRun.id,
      shared_modules: plan.shared_modules.length,
      ordering_edges: plan.ordering_edges.length,
      owned: plan.shared_modules.filter((m) => m.owner_component_id !== 'shared').length,
      shared: plan.shared_modules.filter((m) => m.owner_component_id === 'shared').length,
    });
    return plan;
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0a module_ownership_planning failed (continuing without plan)', {
      workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
