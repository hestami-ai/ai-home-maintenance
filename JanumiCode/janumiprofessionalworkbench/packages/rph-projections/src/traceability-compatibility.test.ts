// W2-INC-3 unit tests: the Traceability (typed link graph) and Compatibility (legacy-phase milestone) projectors
// fold events into rebuildable read-models. Synthetic events keep these independent of the reference fixture;
// the fixture-level rebuildability proof lives in rph-engine (boundary — projections cannot depend on the engine).
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { IncrementalProjection, rebuildProjection } from './projector.js';
import { compatibilityProjector } from './compatibility-view.js';
import { traceabilityProjector, outboundLinks } from './traceability-view.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
let seq = 0;
function ev(eventType: string, aggregateType: string, aggregateId: string, payload: unknown): DomainEvent {
	return {
		eventId: `evt_${++seq}`,
		eventType,
		eventSchemaVersion: 1,
		aggregateType,
		aggregateId,
		aggregateRevision: 0,
		occurredAt: '2026-07-19T00:00:00Z',
		recordedAt: '2026-07-19T00:00:00Z',
		actor,
		correlationId: 'c',
		payload
	};
}

describe('traceabilityProjector', () => {
	const events: DomainEvent[] = [
		ev('IntentCaptured', 'INTENT', 'int_1', { intentId: 'int_1' }),
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_root', { pwuId: 'pwu_root', pwuKind: 'PRODUCT_REALIZATION', intentId: 'int_1' }),
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_child', { pwuId: 'pwu_child', pwuKind: 'ARCHITECTURE', intentId: 'int_1', parentWorkUnitId: 'pwu_root' }),
		ev('DecompositionProposed', 'DECOMPOSITION_CONTRACT', 'dcp_1', { parentWorkUnitId: 'pwu_root', childWorkUnitIds: ['pwu_child'], status: 'UNDER_REVIEW' }),
		ev('ClaimAsserted', 'CLAIM', 'clm_1', { claimId: 'clm_1', subjectObjectIds: ['pwu_child'] }),
		ev('EvidenceProposed', 'EVIDENCE', 'evd_1', { supportsClaimIds: ['clm_1'] }),
		ev('ObligationAsserted', 'OBLIGATION', 'obl_1', { obligationId: 'obl_1', sourceObjectId: 'pwu_child' }),
		ev('BaselinePromoted', 'BASELINE', 'base_1', { baselineId: 'base_1', itemObjectVersions: [{ objectId: 'pwu_child', semanticVersion: 1 }] })
	];

	it('folds typed links from event payloads', () => {
		const view = rebuildProjection(traceabilityProjector, events);
		const has = (from: string, to: string, type: string) =>
			view.links.some((l) => l.from === from && l.to === to && l.type === type);
		expect(has('pwu_root', 'int_1', 'TRACES_TO_INTENT')).toBe(true);
		expect(has('pwu_child', 'pwu_root', 'CHILD_OF')).toBe(true);
		expect(has('pwu_root', 'pwu_child', 'DECOMPOSES')).toBe(true);
		expect(has('clm_1', 'pwu_child', 'ABOUT')).toBe(true);
		expect(has('evd_1', 'clm_1', 'SUPPORTS')).toBe(true);
		expect(has('obl_1', 'pwu_child', 'OBLIGATION_OF')).toBe(true);
		expect(has('base_1', 'pwu_child', 'BASELINES')).toBe(true);
		expect(outboundLinks(view, 'pwu_root', 'DECOMPOSES')).toHaveLength(1);
		// every acting aggregate is a node
		expect(Object.keys(view.nodes)).toEqual(
			expect.arrayContaining(['int_1', 'pwu_root', 'pwu_child', 'dcp_1', 'clm_1', 'evd_1', 'obl_1', 'base_1'])
		);
	});

	it('is rebuildable and idempotent (incremental == full rebuild; double-apply is a no-op)', () => {
		const full = rebuildProjection(traceabilityProjector, events);
		const inc = new IncrementalProjection(traceabilityProjector);
		for (const e of events) inc.apply(e);
		for (const e of events) inc.apply(e); // re-apply — idempotent by eventId
		expect(inc.current()).toEqual(full);
		expect(inc.checkpoint).toBe(events.length);
	});
});

describe('compatibilityProjector', () => {
	const events: DomainEvent[] = [
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_a', { pwuId: 'pwu_a', pwuKind: 'ARCHITECTURE' }),
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_i', { pwuId: 'pwu_i', pwuKind: 'PRODUCT_IMPLEMENTATION' }),
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_p', { pwuId: 'pwu_p', pwuKind: 'BASELINE_PROMOTION' }),
		ev('PwuProposed', 'PROFESSIONAL_WORK_UNIT', 'pwu_x', { pwuId: 'pwu_x', pwuKind: 'SOMETHING_UNKNOWN' })
	];

	it('derives a legacy-phase milestone per PWU from its kind', () => {
		const view = rebuildProjection(compatibilityProjector, events);
		expect(view.milestoneByPwu).toEqual({
			pwu_a: 'ARCHITECTURE',
			pwu_i: 'EXECUTE',
			pwu_p: 'COMMIT',
			pwu_x: 'INTAKE' // unknown kind falls back to the entry milestone, never a fabricated later phase
		});
	});

	it('is rebuildable and idempotent', () => {
		const full = rebuildProjection(compatibilityProjector, events);
		const inc = new IncrementalProjection(compatibilityProjector);
		for (const e of events) inc.apply(e);
		for (const e of events) inc.apply(e);
		expect(inc.current()).toEqual(full);
	});
});
