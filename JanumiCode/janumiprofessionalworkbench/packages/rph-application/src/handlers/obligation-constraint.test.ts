// W1 WIRE-1/2 prerequisite (JAN-ROADMAP-001 gate G1 condition C1): the first-class Obligation / Constraint
// object plane. Master WP-1-005 requires "material obligations SHALL become first-class traceable objects";
// before AssertObligation / AssertConstraint existed, OBLIGATION and CONSTRAINT were declared object types with
// no way to instantiate one, so the conservation kernels (validateObligationConservation /
// validateConstraintPropagation) could only ever run over an empty plane. These tests prove the plane is real:
// the commands mint objects that carry `strength` (the field the conservation gates key on), through the live
// engine pipeline (schema validation + event gate + commit).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'arch-1', actorType: 'HUMAN' as const, displayName: 'Architect' };
const authority = {
	authorityId: 'auth_arch',
	authorityType: 'ORGANIZATIONAL_ROLE' as const,
	scope: ['architecture'],
	validFrom: TS
};
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const OBL_ID = 'obl_01ARZ3NDEKTSV4RRFFQ69G5V02';
const CON_ID = 'con_01ARZ3NDEKTSV4RRFFQ69G5V03';

describe('AssertObligation / AssertConstraint mint first-class objects (WP-1-005/006, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			issuedBy: human,
			correlationId: 'corr-obl-con',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	function freshEngine() {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
	}

	it('AssertObligation creates an OBLIGATION carrying its MANDATORY strength', () => {
		freshEngine();
		const r = dispatch('AssertObligation', OBL_ID, 'OBLIGATION', {
			statement: 'Isolate tenant data',
			obligationType: 'SECURITY',
			sourceObjectId: PWU_ID,
			authority,
			strength: 'MANDATORY'
		});
		expect(r.status).toBe('ACCEPTED');
		const obj = store.loadObject(OBL_ID)?.state as Record<string, unknown>;
		expect(obj.objectType).toBe('OBLIGATION');
		expect(obj.strength).toBe('MANDATORY');
		expect(obj.status).toBe('PROPOSED');
		expect(obj.sourceObjectId).toBe(PWU_ID);
		// provenance links back to the source object (traceability)
		expect((obj.provenance as { sourceObjectIds: string[] }).sourceObjectIds).toContain(PWU_ID);
	});

	it('AssertConstraint creates a CONSTRAINT carrying its MANDATORY strength (sourceObjectId → provenance only)', () => {
		freshEngine();
		const r = dispatch('AssertConstraint', CON_ID, 'CONSTRAINT', {
			statement: 'All PII encrypted at rest',
			constraintType: 'SECURITY',
			sourceObjectId: PWU_ID,
			authority,
			applicability: {},
			strength: 'MANDATORY'
		});
		expect(r.status).toBe('ACCEPTED');
		const obj = store.loadObject(CON_ID)?.state as Record<string, unknown>;
		expect(obj.objectType).toBe('CONSTRAINT');
		expect(obj.strength).toBe('MANDATORY');
		expect(obj.status).toBe('PROPOSED');
		// the ConstraintObject has no sourceObjectId field (§11.1) — it lives on provenance
		expect(obj.sourceObjectId).toBeUndefined();
		expect((obj.provenance as { sourceObjectIds: string[] }).sourceObjectIds).toContain(PWU_ID);
	});

	it('rejects an AssertObligation whose strength is not a valid ObligationStrength', () => {
		freshEngine();
		const r = dispatch('AssertObligation', OBL_ID, 'OBLIGATION', {
			statement: 'bad',
			obligationType: 'SECURITY',
			sourceObjectId: PWU_ID,
			authority,
			strength: 'PREFERRED' // ConstraintStrength value — NOT a valid ObligationStrength
		});
		expect(r.status).not.toBe('ACCEPTED');
		expect(store.loadObject(OBL_ID)).toBeUndefined();
	});
});
