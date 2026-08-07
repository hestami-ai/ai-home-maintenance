// EDITING A POLICY'S SCOPE CANNOT DRIVE ITS TWO REPRESENTATIONS APART — REG-F-029 review finding (c).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// A policy carries its object-type scope TWICE: as `applicableObjectTypes` (DOC-007's field) and inside
// `applicability.objectTypeConditions` (DOC-004 §5.1's rule, which the now-enforced determination READS and
// prefers). `createAssurancePolicy` derives the second from the first, so a created policy is consistent.
//
// EDIT WAS NOT. `applicability` sat on the Edit PAYLOAD and was missing from `EDITABLE_PATCH_FIELDS`, so an edit
// supplying it had it SILENTLY DROPPED — the authored-then-dropped shape REG-F-022 named, landing on the one
// field a live refusal now depends on. And because `applicableObjectTypes` IS patchable, narrowing it moved the
// fallback while leaving the preferred field pinned at creation: **REG-F-024's defect, re-openable by anyone
// with an EditAssurancePolicy.**
//
// Found by adversarial review, not by the suite — every test here would have passed before the fix except the
// ones below, which is the point of writing them.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-08-05T00:00:00Z';
const human: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };
const POLICY = 'pol_scope_edit';

describe('EditAssurancePolicy keeps the two scope representations in step (review finding (c))', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const edit = (payload: Record<string, unknown>) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType: 'EditAssurancePolicy',
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_POLICY',
			targetAggregateId: POLICY,
			issuedAt: TS,
			issuedBy: human,
			correlationId: 'corr-scope-edit',
			idempotencyKey: `idem-${n}`,
			payload: { policyId: POLICY, ...payload }
		} as DomainCommand);
	};
	const scope = () =>
		store.loadObject(POLICY)?.state as {
			applicableObjectTypes?: string[];
			applicability?: { objectTypeConditions?: string[]; pwuKindConditions?: string[] };
		};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		seedPolicy(engine, POLICY, {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				pwuKindConditions: ['ARCHITECTURE_DEFINITION']
			}
		});
	});

	it('CONTROL: the seeded policy starts consistent, or nothing below is measuring a change', () => {
		expect(scope().applicableObjectTypes).toEqual(['PROFESSIONAL_WORK_UNIT']);
		expect(scope().applicability?.objectTypeConditions).toEqual(['PROFESSIONAL_WORK_UNIT']);
	});

	it('an edit that supplies `applicability` is APPLIED, not silently dropped', () => {
		const r = edit({
			applicability: {
				objectTypeConditions: ['ARTIFACT'],
				pwuKindConditions: ['INTEGRATED_PRODUCT_VALIDATION']
			}
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(
			scope().applicability?.objectTypeConditions,
			'the field the §5.1 determination reads must reflect the edit that was accepted'
		).toEqual(['ARTIFACT']);
		expect(scope().applicability?.pwuKindConditions).toEqual(['INTEGRATED_PRODUCT_VALIDATION']);
	});

	it('narrowing `applicableObjectTypes` alone carries the RULE with it — the two cannot diverge', () => {
		// THE RE-OPENING OF REG-F-024. Before the fix this left `applicability.objectTypeConditions` at
		// PROFESSIONAL_WORK_UNIT while the declared field said EVIDENCE — the enforced scope and the declared
		// scope disagreeing, through a supported command, on the field a live refusal depends on.
		const r = edit({ applicableObjectTypes: ['EVIDENCE'] });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(scope().applicableObjectTypes).toEqual(['EVIDENCE']);
		expect(
			scope().applicability?.objectTypeConditions,
			'the rule the determination reads must follow the declared types, or the gate enforces a scope nobody ' +
				'can see in the policy'
		).toEqual(['EVIDENCE']);
	});

	it('...and PRESERVES the arms that edit did not speak to', () => {
		// A type edit says nothing about kinds. Overwriting the whole rule would silently widen a kind-scoped
		// policy to every kind — a narrowing edit quietly producing a broadening, which is the worse direction.
		edit({ applicableObjectTypes: ['EVIDENCE'] });
		expect(
			scope().applicability?.pwuKindConditions,
			'the kind restriction was authored separately and this edit did not mention it'
		).toEqual(['ARCHITECTURE_DEFINITION']);
	});

	it('an explicit `applicability` WINS over the derived one when both are supplied', () => {
		// The more specific statement of scope is the rule itself. If the derivation overrode it, supplying both
		// would silently discard the caller's rule.
		const r = edit({
			applicableObjectTypes: ['EVIDENCE'],
			applicability: { objectTypeConditions: ['ARTIFACT'] }
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(scope().applicability?.objectTypeConditions).toEqual(['ARTIFACT']);
		expect(scope().applicableObjectTypes).toEqual(['EVIDENCE']);
	});

	it('an edit that changes ONLY the applicability rule is not a no-op', () => {
		// `editPolicyNoOp` refuses an edit whose every payload-present editable field already matches. While
		// `applicability` was outside EDITABLE_PATCH_FIELDS, an edit changing only the rule compared nothing,
		// looked like a no-op, and was REJECTED — so the field could not be edited at all, by any route.
		const r = edit({ applicability: { objectTypeConditions: ['ARTIFACT'] } });
		expect(
			r.status,
			'a real change to the scope rule must be accepted, not refused as changing nothing'
		).toBe('ACCEPTED');
	});
});
