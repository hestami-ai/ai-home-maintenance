/**
 * P5.1b entity_ownership_reconciliation — the pure DDD ownership bridge.
 * Pins: deterministic owner election via the P1 businessDomain→software_domain→
 * component chain; adjudicator tie-break within a multi-component context;
 * shared_value_object (copy-by-value, no owner); coincidental collision → separate
 * (all owned); reference stubs keep THEIR OWN fields (per-context data preserved);
 * adjudicator-OFF deterministic fallback; invalid owner suggestion rejected.
 */
import { describe, it, expect } from 'vitest';
import {
  reconcileEntityOwnership,
  type BridgeModel,
  type OwnershipContext,
  type Adjudicator,
} from '../../../../lib/orchestrator/phases/phase5/entityOwnershipBridge';

const ent = (name: string, fields: string[]) => ({ name, fields: fields.map((n) => ({ name: n, type: 'string' })) });
const model = (component_id: string, entities: Array<{ name: string; fields: { name: string; type: string }[] }>): BridgeModel => ({ component_id, entities });

// WorkOrder owned by work-order svc; Invoice svc references it. Compliance context
// (2 components) shares AuditLogEntry.
const ctx: OwnershipContext = {
  conceptBusinessDomain: new Map([
    ['workorder', 'DOM-WO'], ['invoice', 'DOM-FIN'], ['auditlogentry', 'DOM-COMPLIANCE'], ['address', 'DOM-SHARED'],
  ]),
  domainBusinessDomains: new Map([
    ['domain-wo', ['DOM-WO']], ['domain-fin', ['DOM-FIN']], ['domain-compliance', ['DOM-COMPLIANCE']],
  ]),
  componentDomain: new Map([
    ['comp-workorder-service', 'domain-wo'],
    ['comp-invoice-service', 'domain-fin'],
    ['comp-audit-log-writer', 'domain-compliance'],
    ['comp-compliance-status-updater', 'domain-compliance'],
  ]),
};

const ownedAggregate: Adjudicator = async (reqs) => reqs.map((r) => ({ concept_key: r.concept_key, verdict: 'owned_aggregate' }));

describe('reconcileEntityOwnership (P5.1b)', () => {
  it('single-component entity is trivially owned', async () => {
    const models = [model('comp-a', [ent('LocalThing', ['id'])])];
    await reconcileEntityOwnership(models, ctx, ownedAggregate);
    expect(models[0].entities[0].ownership_role).toBe('owned');
  });

  it('cross-context aggregate: owner elected by the domain chain; referencer becomes a reference stub (keeping ITS OWN fields)', async () => {
    const models = [
      model('comp-workorder-service', [ent('WorkOrder', ['id', 'status', 'assigned_to'])]),
      model('comp-invoice-service', [ent('WorkOrder', ['id', 'billable_cost'])]),
    ];
    await reconcileEntityOwnership(models, ctx, ownedAggregate);
    const owner = models[0].entities[0];
    const ref = models[1].entities[0];
    expect(owner.ownership_role).toBe('owned');
    expect(ref.ownership_role).toBe('referenced');
    expect(ref.owner_component_id).toBe('comp-workorder-service');
    expect(ref.owner_entity_id).toBe('DM-workorder-service-workorder');
    // per-context fields preserved verbatim (billable_cost is the invoice context's own)
    expect(ref.fields!.map((f) => f.name)).toEqual(['id', 'billable_cost']);
  });

  it('owner TIE (one context, two components) is broken by a VALID adjudicator suggestion', async () => {
    const models = [
      model('comp-audit-log-writer', [ent('AuditLogEntry', ['id', 'actor', 'action', 'at'])]),
      model('comp-compliance-status-updater', [ent('AuditLogEntry', ['id', 'action'])]),
    ];
    const adj: Adjudicator = async (reqs) => reqs.map((r) => ({ concept_key: r.concept_key, verdict: 'owned_aggregate', owner_component_id: 'comp-audit-log-writer' }));
    const { ownershipMap } = await reconcileEntityOwnership(models, ctx, adj);
    expect(models[0].entities[0].ownership_role).toBe('owned');
    expect(models[1].entities[0].ownership_role).toBe('referenced');
    expect(models[1].entities[0].owner_component_id).toBe('comp-audit-log-writer');
    const d = ownershipMap.decisions.find((x) => x.concept_key === 'auditlogentry')!;
    expect(d.source).toBe('adjudicator');
  });

  it('owner TIE with NO suggestion falls back to field-richness then lexicographic (deterministic)', async () => {
    const models = [
      model('comp-compliance-status-updater', [ent('AuditLogEntry', ['id'])]),
      model('comp-audit-log-writer', [ent('AuditLogEntry', ['id', 'actor', 'action', 'at'])]), // richer → owner
    ];
    await reconcileEntityOwnership(models, ctx, ownedAggregate);
    expect(models[1].entities[0].ownership_role).toBe('owned');        // richer wins
    expect(models[0].entities[0].ownership_role).toBe('referenced');
  });

  it('shared_value_object verdict: every copy kept as a value object, none referenced', async () => {
    const models = [
      model('comp-a', [ent('Address', ['street', 'city', 'zip'])]),
      model('comp-b', [ent('Address', ['street', 'city', 'zip', 'country'])]),
    ];
    const adj: Adjudicator = async (reqs) => reqs.map((r) => ({ concept_key: r.concept_key, verdict: 'shared_value_object' }));
    const { ownershipMap } = await reconcileEntityOwnership(models, ctx, adj);
    expect(models[0].entities[0].ownership_role).toBe('shared_value_object');
    expect(models[1].entities[0].ownership_role).toBe('shared_value_object');
    expect(ownershipMap.decisions.find((d) => d.concept_key === 'address')!.verdict).toBe('shared_value_object');
  });

  it('coincidental name collision (no shared field) → separate, all owned, surfaced as unresolved', async () => {
    const models = [
      model('comp-billing', [ent('Invoice', ['amount', 'due_date'])]),
      model('comp-vendor', [ent('Invoice', ['vendor_ref', 'po_number'])]),
    ];
    const { ownershipMap } = await reconcileEntityOwnership(models, ctx, ownedAggregate);
    expect(models[0].entities[0].ownership_role).toBe('owned');
    expect(models[1].entities[0].ownership_role).toBe('owned');
    expect(ownershipMap.unresolved).toContain('invoice');
    expect(ownershipMap.decisions.find((d) => d.concept_key === 'invoice')!.source).toBe('fail_open');
  });

  it('adjudicator OFF: multi-component shared concept defaults to owned_aggregate + deterministic election', async () => {
    const models = [
      model('comp-workorder-service', [ent('WorkOrder', ['id', 'status'])]),
      model('comp-invoice-service', [ent('WorkOrder', ['id'])]),
    ];
    await reconcileEntityOwnership(models, ctx); // no adjudicator
    expect(models[0].entities[0].ownership_role).toBe('owned');       // work-order svc via domain chain
    expect(models[1].entities[0].ownership_role).toBe('referenced');
  });

  it('rejects an adjudicator owner suggestion that is not a real member (uses domain election instead)', async () => {
    const models = [
      model('comp-workorder-service', [ent('WorkOrder', ['id', 'status'])]),
      model('comp-invoice-service', [ent('WorkOrder', ['id'])]),
    ];
    const adj: Adjudicator = async (reqs) => reqs.map((r) => ({ concept_key: r.concept_key, verdict: 'owned_aggregate', owner_component_id: 'comp-does-not-exist' }));
    const { ownershipMap } = await reconcileEntityOwnership(models, ctx, adj);
    expect(models[0].entities[0].ownership_role).toBe('owned');       // domain chain, not the bogus suggestion
    expect(ownershipMap.decisions.find((d) => d.concept_key === 'workorder')!.owner_component_id).toBe('comp-workorder-service');
  });
});
