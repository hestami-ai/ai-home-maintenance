/**
 * PD-2 (P9 prompt audit) — the scaffold-agent shared-data-model / contract blocks
 * were `JSON.stringify(all, null, 1).slice(0, 8000)`: a raw firehose CLIPPED
 * mid-object → truncated, unparseable JSON that dropped most components' shapes.
 * These renderers emit a curated, budgeted excerpt that drops whole items at the
 * ITEM boundary (never clips mid-object) and dedups entities by name. These tests
 * pin the never-clip + budget + dedup invariants so the truncation cannot recur.
 */
import { describe, it, expect } from 'vitest';
import { renderSharedDataModels, renderContractsExcerpt, stripContractRuntimeFields } from '../../../../lib/orchestrator/phases/scaffoldingAgent';

const entity = (name: string, nFields = 2) => ({
  name,
  fields: Array.from({ length: nFields }, (_, i) => ({ name: `f${i}`, type: 'string', required: i === 0 })),
  relationships: [{ target_entity_id: 'DM-other', kind: 'one_to_many', ownership: 'owns' }],
});
const models = (names: string[]) => [{ component_id: 'comp-a', entities: names.map((n) => entity(n)) }];

describe('renderSharedDataModels (PD-2)', () => {
  it('renders entities in a curated, coherent per-entity format', () => {
    const out = renderSharedDataModels(models(['Property', 'WorkOrder']), 8000);
    expect(out).toContain('### DM-comp-a-property — Property (component: comp-a)');
    expect(out).toContain('Fields:');
    expect(out).toContain('- f0: string (required)');
    expect(out).toContain('→ DM-other (one_to_many, owns)');
    expect(out).not.toContain('… ('); // nothing elided at a generous budget
  });

  it('NEVER clips mid-object — over budget it drops WHOLE entities + notes the count', () => {
    const many = models(Array.from({ length: 60 }, (_, i) => `Entity${i}`));
    const out = renderSharedDataModels(many, 600); // tiny budget forces elision
    // every rendered block is COMPLETE: each `### ` header is followed by `Fields:`.
    const headers = (out.match(/^### /gm) || []).length;
    const fieldsMarkers = (out.match(/^Fields:$/gm) || []).length;
    expect(headers).toBe(fieldsMarkers);
    expect(headers).toBeGreaterThan(0);
    expect(headers).toBeLessThan(60); // some were dropped
    expect(out).toMatch(/… \(\d+ more shared entit(y|ies) omitted/);
    // the last non-note content is a complete field line, not a severed object.
    expect(out).not.toMatch(/[:{[]\s*$/); // does not end mid-structure
  });

  it('dedups by entity name — a name injected multiple times materializes ONCE', () => {
    const dup = [
      { component_id: 'comp-a', entities: [entity('ContractorMatchRecord'), entity('ContractorMatchRecord')] },
      { component_id: 'comp-b', entities: [entity('ContractorMatchRecord')] },
    ];
    const out = renderSharedDataModels(dup, 8000);
    expect((out.match(/— ContractorMatchRecord/g) || []).length).toBe(1);
  });

  // PD-5 — same-named entity with DIVERGENT shapes across components. Keep-first
  // dedup silently dropped variant fields → the model invented its own union enum.
  // Merge instead: union fields (nothing lost), annotate the divergence.
  it('merges same-named entities across components — unions fields + surfaces divergence (PD-5)', () => {
    const conflicting = [
      { component_id: 'comp-a', entities: [{ name: 'ContractorMatchRecord', fields: [
        { name: 'status', type: 'enum(pending,active)' },
        { name: 'score', type: 'int' },
      ] }] },
      { component_id: 'comp-b', entities: [{ name: 'ContractorMatchRecord', fields: [
        { name: 'status', type: 'enum(pending,active,matching)' }, // divergent enum
        { name: 'matched_at', type: 'timestamp' },                  // field only in comp-b
      ] }] },
    ];
    const out = renderSharedDataModels(conflicting, 8000);
    // materialized ONCE, flagged as shared across the two components
    expect((out.match(/— ContractorMatchRecord/g) || []).length).toBe(1);
    expect(out).toMatch(/shared across components: comp-a, comp-b/);
    // UNION of fields — nothing lost (score from a, matched_at from b)
    expect(out).toContain('score:');
    expect(out).toContain('matched_at:');
    // the divergent enum is SURFACED, not silently dropped
    expect(out).toMatch(/status:.*\[divergent — also defined as:/);
    expect(out).toContain('enum(pending,active,matching)');
  });

  it('does NOT annotate divergence when same-named entities are identical', () => {
    const same = [
      { component_id: 'comp-a', entities: [entity('Shared')] },
      { component_id: 'comp-b', entities: [entity('Shared')] },
    ];
    const out = renderSharedDataModels(same, 8000);
    expect(out).not.toContain('[divergent');
    expect(out).toMatch(/shared across components: comp-a, comp-b/);
  });

  it('accepts a flat-entity array (element IS an entity, no component wrapper)', () => {
    const out = renderSharedDataModels([entity('Flat')], 8000);
    expect(out).toContain('— Flat');
    expect(out).toContain('Fields:');
  });

  it('returns "(none)" for empty / non-array / malformed input', () => {
    expect(renderSharedDataModels([], 8000)).toBe('(none)');
    expect(renderSharedDataModels(null, 8000)).toBe('(none)');
    expect(renderSharedDataModels('not an array', 8000)).toBe('(none)');
  });
});

// D1/D2 (P9 materialization audit) — the data_models entities carry P5.1b
// ownership tags (ownership_role / owner_entity_id / owner_component_id). Render
// each concept per its DDD verdict instead of field-unioning every copy: the OWNER
// materializes once; non-owners are import references, NOT re-materialized.
describe('renderSharedDataModels — ownership-aware (P5.1b, D1/D2)', () => {
  const owned = (comp: string, name: string, fields: Array<{ name: string; type: string }>) => ({
    id: `DM-${comp}-${name.toLowerCase()}`, name, ownership_role: 'owned', fields,
  });
  const referenced = (comp: string, name: string, ownerComp: string, fields: Array<{ name: string; type: string }>) => ({
    id: `DM-${comp}-${name.toLowerCase()}`, name, ownership_role: 'referenced',
    owner_component_id: ownerComp, owner_entity_id: `DM-${ownerComp}-${name.toLowerCase()}`, fields,
  });

  it('materializes an owned aggregate ONCE under the elected owner id — not first-seen', () => {
    const models = [
      // first-seen is the REFERENCED copy (audit-log-retriever); owner is property-service
      { component_id: 'comp-audit-log-retriever', entities: [referenced('comp-audit-log-retriever', 'PropertyRecord', 'comp-property-service', [
        { name: 'id', type: 'uuid' }, { name: 'audit_note', type: 'string' },
      ]) ] },
      { component_id: 'comp-property-service', entities: [owned('comp-property-service', 'PropertyRecord', [
        { name: 'id', type: 'uuid' }, { name: 'address', type: 'string' },
      ]) ] },
    ];
    const out = renderSharedDataModels(models, 8000);
    // rendered ONCE, keyed to the OWNER id (not the first-seen audit-log-retriever id)
    expect((out.match(/— PropertyRecord/g) || []).length).toBe(1);
    expect(out).toContain('### DM-comp-property-service-propertyrecord — PropertyRecord');
    expect(out).not.toContain('DM-comp-audit-log-retriever-propertyrecord —');
    // OWNER fields only — the referenced copy's divergent field is NOT unioned in
    expect(out).toContain('- address: string');
    expect(out).not.toContain('audit_note');
    expect(out).not.toContain('reconcile to ONE canonical shape'); // no shared-kernel merge
    // the reference is surfaced as an IMPORT, not a re-definition
    expect(out).toMatch(/owned by comp-property-service; referenced by comp-audit-log-retriever/);
    expect(out).toContain('IMPORT this type');
  });

  it('renders a shared value object as copied-by-value (no owner/reference)', () => {
    const models = [
      { component_id: 'comp-a', entities: [{ id: 'DM-comp-a-money', name: 'Money', ownership_role: 'shared_value_object', fields: [{ name: 'amount', type: 'int' }] }] },
      { component_id: 'comp-b', entities: [{ id: 'DM-comp-b-money', name: 'Money', ownership_role: 'shared_value_object', fields: [{ name: 'amount', type: 'int' }] }] },
    ];
    const out = renderSharedDataModels(models, 8000);
    expect((out.match(/— Money/g) || []).length).toBe(1);
    expect(out).toMatch(/value object — copied by value into: comp-a, comp-b/);
  });

  it('keeps SEPARATE (coincidental-name) concepts as distinct per-component types', () => {
    const models = [
      { component_id: 'comp-a', entities: [owned('comp-a', 'Status', [{ name: 'code', type: 'int' }])] },
      { component_id: 'comp-b', entities: [owned('comp-b', 'Status', [{ name: 'label', type: 'string' }])] },
    ];
    const out = renderSharedDataModels(models, 8000);
    // two owned members of the same name → two distinct blocks (not merged/unioned)
    expect((out.match(/— Status/g) || []).length).toBe(2);
    expect(out).toContain('### DM-comp-a-status — Status (component: comp-a)');
    expect(out).toContain('### DM-comp-b-status — Status (component: comp-b)');
    expect(out).not.toContain('divergent');
  });
});

// D8 (P9 materialization audit) — relationship targets live under target_entity /
// references / entity, and kinds under type / relationship_type; the old renderer
// read only target_entity_id/target so `{type, references}` rendered as `→ ?`.
describe('renderSharedDataModels — relationship key resolution (D8)', () => {
  it('resolves the target from `references` (FK "Entity.field") and kind from `type`', () => {
    const models = [{ component_id: 'comp-a', entities: [{
      name: 'WorkOrderAudit', ownership_role: 'owned', fields: [{ name: 'id', type: 'uuid' }],
      relationships: [{ name: 'work_order', type: 'many_to_one', foreign_key: 'work_order_id', references: 'WorkOrder.id' }],
    }] }];
    const out = renderSharedDataModels(models, 8000);
    expect(out).toContain('→ WorkOrder (many_to_one)');
    expect(out).not.toContain('→ ?');
  });

  it('resolves the target from `target_entity` / `entity` too', () => {
    const models = [{ component_id: 'comp-a', entities: [{
      name: 'X', ownership_role: 'owned', fields: [{ name: 'id', type: 'uuid' }],
      relationships: [{ target_entity: 'Tenant', relationship_type: 'references' }, { entity: 'User', kind: 'many_to_one' }],
    }] }];
    const out = renderSharedDataModels(models, 8000);
    expect(out).toContain('→ Tenant (references)');
    expect(out).toContain('→ User (many_to_one)');
  });

  it('renders array-valued `constraints`', () => {
    const models = [{ component_id: 'comp-a', entities: [{
      name: 'Y', ownership_role: 'owned',
      fields: [{ name: 'id', type: 'uuid', constraints: ['primary_key', 'required'] }],
    }] }];
    const out = renderSharedDataModels(models, 8000);
    expect(out).toContain('- id: uuid (primary_key, required)');
  });
});

describe('renderContractsExcerpt (PD-2)', () => {
  it('emits each contract as a COMPLETE JSON item (never clipped)', () => {
    const contracts = Array.from({ length: 20 }, (_, i) => ({ id: `IC-${i}`, protocol: 'http', endpoints: [{ path: `/x${i}` }] }));
    const out = renderContractsExcerpt(contracts, 400); // forces elision
    expect(out).toMatch(/… \(\d+ more contract/); // some elided
    // pretty-JSON items open with `{` at col 0 and close with `}` at col 0;
    // equal counts prove every started item was closed (no mid-object clip).
    const opens = (out.match(/^\{$/gm) || []).length;
    const closes = (out.match(/^\}$/gm) || []).length;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(0);
    expect(opens).toBeLessThan(20); // some dropped whole
  });

  it('returns "(none)" for empty / non-array', () => {
    expect(renderContractsExcerpt([], 5000)).toBe('(none)');
    expect(renderContractsExcerpt(undefined, 5000)).toBe('(none)');
  });

  // PD-9 — the scaffold is a type-shape deliverable; runtime error-handling prose
  // must not be injected (mis-frames runtime as code types + inflates → PD-2).
  it('strips runtime error-handling fields but keeps the type-shape fields', () => {
    const contract = {
      id: 'IC-DB-001', protocol: 'http', data_format: 'json', systems_involved: ['a', 'b'],
      error_handling_strategy: 'exponential backoff', retry_policy: '3x',
      error_responses: [{ code: '400', description: 'bad request' }, { code: '500', description: 'boom' }],
    };
    const out = renderContractsExcerpt([contract], 5000);
    // type-shape fields survive
    expect(out).toContain('"id": "IC-DB-001"');
    expect(out).toContain('"protocol": "http"');
    expect(out).toContain('"data_format": "json"');
    // runtime-behavior fields are gone
    expect(out).not.toContain('error_responses');
    expect(out).not.toContain('error_handling_strategy');
    expect(out).not.toContain('retry_policy');
    expect(out).not.toContain('backoff');
  });

  it('stripContractRuntimeFields leaves non-objects untouched', () => {
    expect(stripContractRuntimeFields('str')).toBe('str');
    expect(stripContractRuntimeFields(null)).toBe(null);
    expect(stripContractRuntimeFields(['a'])).toEqual(['a']);
  });
});
