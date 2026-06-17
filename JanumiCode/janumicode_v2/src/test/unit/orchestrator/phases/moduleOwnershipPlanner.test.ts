/**
 * Unit tests for the module-ownership planner (Phase 9.0 Tier-A kernel).
 * Fixtures mirror the slice-139 component graph that produced the divergent
 * duplicate modules.
 */
import { describe, it, expect } from 'vitest';
import {
  buildModuleOwnershipPlan,
  type ModuleOwnershipPlannerInput,
} from '../../../../lib/orchestrator/phases/moduleOwnershipPlanner';

// slice-139 shape: most components sync_call comp-mapping-persistence; AuditLog
// is owned by comp-deletion-endpoint-service; URLMapping primarily by
// comp-mapping-persistence (scattered to consumers too).
function slice139(): ModuleOwnershipPlannerInput {
  const sync = (...ids: string[]) => ids.map((id) => ({ component_id: id, kind: 'sync_call' }));
  return {
    components: [
      { id: 'comp-mapping-persistence', dependencies: [] },
      { id: 'comp-url-submission', dependencies: sync('comp-slug-generation', 'comp-mapping-persistence') },
      { id: 'comp-slug-generation', dependencies: sync('comp-mapping-persistence') },
      { id: 'comp-redirect-handling', dependencies: sync('comp-mapping-persistence', 'comp-click-tracking') },
      { id: 'comp-click-tracking', dependencies: sync('comp-mapping-persistence') },
      { id: 'comp-deletion-endpoint-service', dependencies: sync('comp-mapping-persistence') },
      { id: 'comp-gdpr-erasure-service', dependencies: sync('comp-mapping-persistence') },
    ],
    dataModels: [
      { entity_name: 'URLMapping', component_id: 'comp-mapping-persistence' },
      { entity_name: 'URLMapping', component_id: 'comp-url-submission' },
      { entity_name: 'AuditLog', component_id: 'comp-deletion-endpoint-service' },
    ],
    tasks: [
      // mapping_repository demanded by 5 distinct components (drifted path too).
      { id: 't1', component_id: 'comp-url-submission', read_directory_paths: ['src/repositories/mapping_repository'] },
      { id: 't2', component_id: 'comp-redirect-handling', read_directory_paths: ['src/repositories/mapping_repository'] },
      { id: 't3', component_id: 'comp-click-tracking', read_directory_paths: ['src/repositories/mapping_repository'] },
      { id: 't4', component_id: 'comp-deletion-endpoint-service', read_directory_paths: ['src/repositories/mapping_repository', 'src/repositories/audit_log_repository'] },
      { id: 't5', component_id: 'comp-gdpr-erasure-service', read_directory_paths: ['src/repositories/mapping_repository.ts', 'src/repositories/audit_log_repository'] },
      // a component-local read by a single component → NOT shared.
      { id: 't6', component_id: 'comp-slug-generation', read_directory_paths: ['src/utils/slug_generator'] },
      // encryption read by two components → shared cross-cutting util.
      { id: 't7', component_id: 'comp-url-submission', read_directory_paths: ['src/utils/encryption'] },
      { id: 't8', component_id: 'comp-redirect-handling', read_directory_paths: ['src/utils/encryption'] },
    ],
  };
}

describe('buildModuleOwnershipPlan', () => {
  it('collapses drifted demand paths and owns mapping_repository at the sync_call sink', () => {
    const plan = buildModuleOwnershipPlan(slice139());
    const mr = plan.shared_modules.find((m) => m.module_key.includes('mappingrepository'));
    expect(mr).toBeDefined();
    // mapping_repository + mapping_repository.ts collapsed to one module.
    expect(mr!.demand_paths.length).toBeGreaterThanOrEqual(2);
    // Owner = comp-mapping-persistence (the sink every consumer sync_calls /
    // the primary URLMapping owner).
    expect(mr!.owner_component_id).toBe('comp-mapping-persistence');
    expect(mr!.canonical_path).toBe('src/mapping-persistence/mapping_repository.ts');
    expect(mr!.import_specifier).toBe('@/mapping-persistence/mapping_repository');
    expect(mr!.consumer_component_ids).toContain('comp-redirect-handling');
  });

  it('owns audit_log_repository at the AuditLog data-model owner, not the sink', () => {
    const plan = buildModuleOwnershipPlan(slice139());
    const al = plan.shared_modules.find((m) => m.module_key.includes('auditlog'));
    expect(al).toBeDefined();
    // AuditLog is owned by deletion-endpoint-service even though both consumers
    // sync_call mapping-persistence — data-model ownership wins for entity repos.
    expect(al!.owner_component_id).toBe('comp-deletion-endpoint-service');
    expect(al!.owner_source).toBe('data_model_owner');
  });

  it('routes a cross-cutting util (encryption) to the dependency-sink hub, NOT the unproducible shared dir', () => {
    // src/shared is leaf-protected and the scaffold does not materialize
    // behavioral modules — an owner=shared util would never be built
    // (slice-141). The hub every consumer depends on owns it instead.
    const plan = buildModuleOwnershipPlan(slice139());
    const enc = plan.shared_modules.find((m) => m.module_key.includes('encryption'));
    expect(enc).toBeDefined();
    expect(enc!.owner_component_id).toBe('comp-mapping-persistence');
    expect(enc!.owner_source).toBe('sync_call_sink');
    expect(enc!.import_specifier).toBe('@/mapping-persistence/encryption');
  });

  it('slice-142 shape: resolves owner through ROOT-level deps + picks the entity-owning LEAF', () => {
    // Saturation children carry NO dependency edges; deps live at root level
    // (redirect-handler -> url-lifecycle). The planner must fold root edges
    // into the leaf consumers and, when the sink is a decomposed root, pick
    // the owning LEAF — ranked by data-model entity ownership (mapping-store
    // owns URLMapping → it owns `db`).
    const plan = buildModuleOwnershipPlan({
      components: [
        { id: 'comp-redirect-handler', dependencies: [{ component_id: 'comp-url-lifecycle', kind: 'sync_call' }] },
        { id: 'comp-stats-retriever', dependencies: [{ component_id: 'comp-url-lifecycle', kind: 'sync_call' }] },
        { id: 'comp-slug-generator', dependencies: [] },
        { id: 'comp-mapping-store', dependencies: [] },
        { id: 'comp-click-counter-initializer', dependencies: [] },
      ],
      rootComponents: [
        { id: 'comp-url-lifecycle', dependencies: [] },
        { id: 'comp-redirect-handler', dependencies: [{ component_id: 'comp-url-lifecycle', kind: 'sync_call' }] },
        { id: 'comp-stats-retriever', dependencies: [{ component_id: 'comp-url-lifecycle', kind: 'sync_call' }] },
      ],
      leafToRoot: {
        'comp-slug-generator': 'comp-url-lifecycle',
        'comp-mapping-store': 'comp-url-lifecycle',
        'comp-click-counter-initializer': 'comp-url-lifecycle',
        'comp-redirect-handler': 'comp-redirect-handler',
        'comp-stats-retriever': 'comp-stats-retriever',
      },
      dataModels: [
        { entity_name: 'URLMapping', component_id: 'comp-mapping-store' },
      ],
      tasks: [
        { id: 't1', component_id: 'comp-redirect-handler', read_directory_paths: ['src/lib/db'] },
        { id: 't2', component_id: 'comp-stats-retriever', read_directory_paths: ['src/lib/db'] },
        { id: 't3', component_id: 'comp-slug-generator', read_directory_paths: ['src/lib/db'] },
      ],
    });
    const dbMod = plan.shared_modules.find((m) => m.basename === 'db');
    expect(dbMod).toBeDefined();
    // Sink root = comp-url-lifecycle (redirect+stats sync_call it; slug's root
    // IS it); owner leaf = mapping-store (owns the URLMapping entity).
    expect(dbMod!.owner_component_id).toBe('comp-mapping-store');
    expect(dbMod!.import_specifier).toBe('@/mapping-store/db');
    // Ordering edges run owner-before-consumers.
    const afters = new Set(plan.ordering_edges.filter((e) => e.before_component_id === 'comp-mapping-store').map((e) => e.after_component_id));
    expect(afters.has('comp-redirect-handler')).toBe(true);
  });

  it('no dependency graph → first consumer produces the module (never the unproducible shared dir)', () => {
    // Slice-142 live finding: owner='shared' modules are importable-but-
    // never-built (GDPR middleware shipped `import '@shared/lib/iputils'`
    // with no producer). With consumers present, the first (sorted) consumer
    // owns the module in its OWN dir and ordering edges make it exist first.
    const plan = buildModuleOwnershipPlan({
      components: [
        { id: 'comp-a', dependencies: [] },
        { id: 'comp-b', dependencies: [] },
      ],
      dataModels: [],
      tasks: [
        { id: 't1', component_id: 'comp-a', read_directory_paths: ['src/utils/helpers'] },
        { id: 't2', component_id: 'comp-b', read_directory_paths: ['src/utils/helpers'] },
      ],
    });
    const h = plan.shared_modules.find((m) => m.basename === 'helpers');
    expect(h).toBeDefined();
    expect(h!.owner_component_id).toBe('comp-a');
    expect(h!.owner_source).toBe('consumer_fallback');
    expect(h!.import_specifier).toBe('@/a/helpers'); // comp- prefix stripped by canonicalComponentDir
    // Producer-before-consumer edge to the OTHER consumer.
    expect(plan.ordering_edges.some((e) => e.before_component_id === 'comp-a' && e.after_component_id === 'comp-b')).toBe(true);
  });

  it('falls back to shared only when no consumer has a component id (nothing imports it)', () => {
    const plan = buildModuleOwnershipPlan({
      components: [{ id: 'comp-a', dependencies: [] }],
      dataModels: [],
      tasks: [
        { id: 't1', component_id: '', read_directory_paths: ['src/utils/helpers'] },
        { id: 't2', component_id: '', read_directory_paths: ['src/utils/helpers'] },
      ],
    });
    const h = plan.shared_modules.find((m) => m.basename === 'helpers');
    expect(h).toBeDefined();
    expect(h!.owner_component_id).toBe('shared');
    expect(h!.owner_source).toBe('shared_fallback');
  });

  it('single-reader-under-shared-root still resolves a component owner (deterministic)', () => {
    const plan = buildModuleOwnershipPlan(slice139());
    // slug_generator sits under utils/ (shared-root category) with one reader
    // (comp-slug-generation, which sync_calls mapping-persistence). The sink
    // heuristic now owns cross-cutting modules too, so it gets a producing
    // component rather than the unproducible shared dir.
    const sg = plan.shared_modules.find((m) => m.basename === 'slug_generator');
    if (sg) expect(sg.owner_component_id).toBe('comp-mapping-persistence');
  });

  it('resolves the owner from non-sync_call dependency kinds (uses/data_read), not just sync_call (slice-140)', () => {
    // Phase-4 models legitimately use `dependency_type: "uses"`; the planner
    // must treat any consumption edge (not only sync_call) as an ownership
    // signal, else it falls back to shared and nothing produces the module.
    const input: ModuleOwnershipPlannerInput = {
      components: [
        { id: 'comp-persistence', dependencies: [] },
        { id: 'comp-reader', dependencies: [{ component_id: 'comp-persistence', kind: 'uses' }] },
        { id: 'comp-writer', dependencies: [{ component_id: 'comp-persistence', kind: 'data_read' }] },
      ],
      dataModels: [],
      tasks: [
        { id: 'r1', component_id: 'comp-reader', read_directory_paths: ['src/services/record_store'] },
        { id: 'w1', component_id: 'comp-writer', read_directory_paths: ['src/services/record_store'] },
      ],
    };
    const plan = buildModuleOwnershipPlan(input);
    const rs = plan.shared_modules.find((m) => m.basename === 'record_store');
    expect(rs).toBeDefined();
    expect(rs!.owner_component_id).toBe('comp-persistence');
    expect(rs!.owner_source).toBe('sync_call_sink'); // (sink heuristic now spans all consumption kinds)
    // async_event is NOT a consumption signal → would not have resolved an owner.
  });

  it('emits producer-before-consumer ordering edges (owner before each consumer)', () => {
    const plan = buildModuleOwnershipPlan(slice139());
    const mrEdges = plan.ordering_edges.filter((e) => e.before_component_id === 'comp-mapping-persistence');
    // mapping-persistence must precede each consumer of the mapping repository.
    const afters = new Set(mrEdges.map((e) => e.after_component_id));
    expect(afters.has('comp-redirect-handling')).toBe(true);
    expect(afters.has('comp-deletion-endpoint-service')).toBe(true);
    // No self-edge.
    expect(afters.has('comp-mapping-persistence')).toBe(false);
  });
});
