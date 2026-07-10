/**
 * Characterization tests for the pure helpers extracted from
 * Phase5Handler.execute() during the S3776 cognitive-complexity refactor.
 *
 * These pin the ORIGINAL inline behaviour (DMR-seed collapse, per-component
 * scoped-summary map, TECH-* roster rendering, API/data-model summary
 * projection, and the DDD owned/referenced/value-object depth-0 seed plan) so
 * the extraction stays behaviour-preserving. They deliberately exercise
 * branches the end-to-end phase smoke test (phases.test.ts) does NOT reach with
 * its empty-LLM fallback data (populated components, TECH rosters, and the
 * ownership-split seeding that only fires when real entities exist).
 */
import { describe, it, expect } from 'vitest';
import {
  flattenSeedIds,
  buildComponentSummariesById,
  buildTechnicalConstraintsSummary,
  buildApiSummary,
  buildDataModelsSummary,
  buildRootSeedPlan,
  buildRootSeedOp,
} from '../../../../lib/orchestrator/phases/phase5';

describe('flattenSeedIds', () => {
  it('passes plain string ids through, unwraps recordId contexts, drops falsy — order preserved', () => {
    expect(
      flattenSeedIds([{ recordId: 'a' }, null, 'b', undefined, { recordId: 'c' }, '']),
    ).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for an empty list', () => {
    expect(flattenSeedIds([])).toEqual([]);
  });

  it('preserves the DMR-seed prefix/suffix ordering (string prefix then contexts)', () => {
    expect(
      flattenSeedIds(['dm-rec', { recordId: 'cm' }, { recordId: 'ic' }, { recordId: 'sr' }]),
    ).toEqual(['dm-rec', 'cm', 'ic', 'sr']);
  });
});

describe('buildComponentSummariesById', () => {
  it('keys by string id with the PROJECT TYPE prefix; skips components without a string id', () => {
    const out = buildComponentSummariesById(
      [
        { id: 'comp-a', name: 'Alpha', responsibilities: [{ description: 'do a' }] },
        { name: 'NoId' },
      ],
      'MyProj',
    );
    expect(Object.keys(out)).toEqual(['comp-a']);
    expect(out['comp-a']).toBe('PROJECT TYPE: MyProj\n\n[Backlog] comp-a: Alpha\n  - do a');
  });

  it('returns {} for an empty component list', () => {
    expect(buildComponentSummariesById([], 'X')).toEqual({});
  });
});

describe('buildTechnicalConstraintsSummary', () => {
  type Arg = Parameters<typeof buildTechnicalConstraintsSummary>[0];

  it('returns the placeholder when the artifact is absent', () => {
    expect(buildTechnicalConstraintsSummary(undefined)).toBe(
      'No technical_constraints_discovery artifact available',
    );
  });

  it('returns the placeholder when the artifact has an empty constraints array', () => {
    const art = { content: { technicalConstraints: [] } } as unknown as Arg;
    expect(buildTechnicalConstraintsSummary(art)).toBe(
      'No technical_constraints_discovery artifact available',
    );
  });

  it('renders id — tech — category — text with technology→name and text→rationale fallbacks, dropping empties', () => {
    const art = {
      content: {
        technicalConstraints: [
          { id: 'TECH-1', technology: 'postgres', category: 'database', text: 'use pg' },
          { id: 'TECH-2', name: 'redis', rationale: 'cache' },
        ],
      },
    } as unknown as Arg;
    expect(buildTechnicalConstraintsSummary(art)).toBe(
      'TECH-1 — postgres — database — use pg\nTECH-2 — redis — cache',
    );
  });
});

describe('buildApiSummary', () => {
  it('renders one block per component with per-endpoint auth (defaulting to none)', () => {
    const out = buildApiSummary([
      {
        component_id: 'comp-a',
        endpoints: [
          { method: 'GET', path: '/x', auth_requirement: 'jwt' },
          { method: 'POST', path: '/y' },
        ],
      },
    ]);
    expect(out).toBe('Component comp-a:\n  GET /x (auth: jwt)\n  POST /y (auth: none)');
  });
});

describe('buildDataModelsSummary', () => {
  it('renders one block per component listing entity fields as name:type', () => {
    const out = buildDataModelsSummary([
      {
        component_id: 'comp-a',
        entities: [
          { name: 'Link', fields: [{ name: 'slug', type: 'string' }, { name: 'id', type: 'uuid' }] },
        ],
      },
    ]);
    expect(out).toBe('Component comp-a:\n  Link: slug:string, id:uuid');
  });
});

describe('buildRootSeedPlan / buildRootSeedOp — DDD ownership split', () => {
  // component_id, entities incl. ownership_role — the shape Phase 5.1 emits
  // after 5.1b tags each entity. Cast because ownership_role/owner_* are read
  // via cast inside the helper (not on the base entity type).
  const models = [
    {
      component_id: 'comp-a',
      entities: [
        { id: 'DM-1', name: 'WorkOrder', fields: [{ name: 'id', type: 'uuid' }], relationships: ['Customer'] },
        { id: 'DM-2', name: 'Customer', fields: [{ name: 'id', type: 'uuid' }], ownership_role: 'referenced', owner_entity_id: 'DM-9', owner_component_id: 'comp-b' },
        { name: 'Money', fields: [{ name: 'amount', type: 'int' }], ownership_role: 'shared_value_object' },
      ],
    },
  ] as unknown as Parameters<typeof buildRootSeedPlan>[0];

  it('produces one op per entity in (models, entities) order', () => {
    const plan = buildRootSeedPlan(models, ['TECH-1']);
    expect(plan).toHaveLength(3);
    expect(plan.map(op => op.entity.name)).toEqual(['WorkOrder', 'Customer', 'Money']);
  });

  it('OWNED (no role) → pending + enqueue, kind aggregate, active_constraints threaded', () => {
    const [owned] = buildRootSeedPlan(models, ['TECH-1']);
    expect(owned.status).toBe('pending');
    expect(owned.enqueue).toBe(true);
    expect(owned.pruningReason).toBeUndefined();
    expect(owned.entity.id).toBe('DM-1');
    expect(owned.entity.kind).toBe('aggregate');
    expect(owned.entity.ownership_role).toBeUndefined();
    expect(owned.entity.active_constraints).toEqual(['TECH-1']);
    expect(owned.entity.relationships).toEqual([{ target_entity_id: 'Customer', kind: 'references' }]);
  });

  it('REFERENCED → pruned(foreign_context_reference), NOT enqueued, owner ids preserved, kind aggregate', () => {
    const referenced = buildRootSeedPlan(models, ['TECH-1'])[1];
    expect(referenced.status).toBe('pruned');
    expect(referenced.enqueue).toBe(false);
    expect(referenced.pruningReason).toBe('foreign_context_reference');
    expect(referenced.entity.kind).toBe('aggregate');
    expect(referenced.entity.ownership_role).toBe('referenced');
    expect(referenced.entity.owner_entity_id).toBe('DM-9');
    expect(referenced.entity.owner_component_id).toBe('comp-b');
    expect(referenced.entity.relationships).toEqual([]);
  });

  it('SHARED_VALUE_OBJECT → pruned(shared_value_object), NOT enqueued, kind value_type, id falls back to name', () => {
    const vo = buildRootSeedPlan(models, ['TECH-1'])[2];
    expect(vo.status).toBe('pruned');
    expect(vo.enqueue).toBe(false);
    expect(vo.pruningReason).toBe('shared_value_object');
    expect(vo.entity.kind).toBe('value_type');
    expect(vo.entity.id).toBe('Money'); // e.id absent → falls back to e.name
    expect(vo.entity.ownership_role).toBe('shared_value_object');
  });

  it('buildRootSeedOp forces the passed component_id onto the entity', () => {
    const op = buildRootSeedOp(
      { id: 'DM-1', name: 'WorkOrder', fields: [] } as unknown as Parameters<typeof buildRootSeedOp>[0],
      'comp-forced',
      [],
    );
    expect(op.entity.component_id).toBe('comp-forced');
  });
});
