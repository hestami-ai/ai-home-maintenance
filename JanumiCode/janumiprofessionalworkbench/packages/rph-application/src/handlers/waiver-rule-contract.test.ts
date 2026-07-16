// A policy's WaiverRule is DOC-004 §12.1, and the contract enforces it.
//
// WHY THIS MATTERS BEYOND THE SHAPE. §12.1 ratifies `waiverAllowed: boolean` and `requiredAuthorityType` —
// i.e. THE MODEL'S OWN WAY for a policy to declare it may not be waived, and by whose authority it may.
// The de minimis floor's non-waivability is currently a hand-rolled guard (`rejectIfFloorLocked`) keyed to
// three hardcoded policy ids and citing INV-5 — a misattribution (INV-5 is executionState=SUCCEEDED MUST NOT
// imply assuranceState=SATISFIED; it says nothing about waivability). The ratified home has existed all along;
// this makes it representable.
//
// ⚠️ It does NOT retire the guard. Today the seeded policy objects are never read at runtime, so a policy
// declaring `waiverAllowed: false` would be a field nothing consults. Wiring the guard to read it needs the
// store->runtime content path first — otherwise a working hardcoded guard is swapped for a decorative one.
// See docs/_working/AUDIT-placeholder-helpers.md.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-16T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'Author' };
const POL = 'pol_waiver_rule_contract';

/** DOC-004 §12.1, all 8 fields. */
const RATIFIED_WAIVER_RULE = {
	waiverAllowed: false,
	eligibleCriteriaIds: ['C-01'],
	prohibitedFindingSeverities: ['BLOCKING', 'CRITICAL'],
	requiredAuthorityType: 'PRODUCT_OWNER',
	maximumDuration: 'P90D',
	requiredRationaleFields: ['residualRisk', 'mitigation'],
	requiredCompensatingControls: ['Manual review before release.']
};

const CRITERION = {
	id: 'C-01',
	name: 'Tenant isolation',
	description: 'Tenant data is isolated.',
	criterionType: 'BOOLEAN',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: 'BLOCKING',
	mayBeNotApplicable: false
};

describe('WaiverRule (DOC-004 §12.1) is enforced, not a placeholder', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function createPolicy(waiverRules: unknown[]) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'CreateAssurancePolicy',
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_POLICY',
			targetAggregateId: POL,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload: {
				policyId: POL,
				version: '1.0.0',
				name: 'Tenant Isolation Review',
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['CORRECTNESS'],
				criteria: [CRITERION],
				evaluatorRole: 'reviewer',
				independenceRequirement: 'DIFFERENT_AGENT',
				findingDefinitions: [],
				permittedControlActions: ['ESCALATE'],
				waiverRules
			}
		};
		return engine.dispatch(command);
	}

	it('accepts a policy declaring a ratified WaiverRule — a policy CAN now say it is non-waivable', () => {
		const r = createPolicy([RATIFIED_WAIVER_RULE]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const stored = (store.loadObject(POL)!.state as { waiverRules: unknown[] }).waiverRules;
		expect(stored).toEqual([RATIFIED_WAIVER_RULE]);
		// The field the floor's hand-rolled lock should eventually read, round-tripped through the engine.
		expect((stored[0] as { waiverAllowed: boolean }).waiverAllowed).toBe(false);
	});

	it('still accepts the empty array every policy ships today — the tightening migrates nothing', () => {
		// `waiverRules: []` has exactly one writer (assurance.ts). This is why WaiverRule was the cheapest of
		// the nine ratified-but-placeholder helpers to transcribe: there are no instances to migrate.
		expect(createPolicy([]).status).toBe('ACCEPTED');
	});

	it('REJECTS an arbitrary object — the placeholder accepted literally anything', () => {
		// Before the transcription `WaiverRuleSchema` was z.record(z.string(), z.unknown()): this passed.
		expect(createPolicy([{ nonsense: true }]).status).toBe('VALIDATION_FAILED');
	});

	it('rejects a rule missing waiverAllowed — the one field that carries the non-waivability decision', () => {
		const { waiverAllowed: _dropped, ...withoutFlag } = RATIFIED_WAIVER_RULE;
		expect(createPolicy([withoutFlag]).status).toBe('VALIDATION_FAILED');
	});

	it('rejects waiverAllowed as a non-boolean — it is a decision, not a label', () => {
		expect(createPolicy([{ ...RATIFIED_WAIVER_RULE, waiverAllowed: 'no' }]).status).toBe(
			'VALIDATION_FAILED'
		);
	});

	it('accepts a rule omitting §12.1’s three OPTIONAL fields', () => {
		// maximumDuration, requiredCompensatingControls and revalidationTrigger carry `?` in §12.1. Requiring
		// them would over-tighten a ratified declaration — the opposite error to the placeholder.
		const {
			maximumDuration: _a,
			requiredCompensatingControls: _b,
			...minimal
		} = RATIFIED_WAIVER_RULE;
		const r = createPolicy([minimal]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('leaves revalidationTrigger permissive — PolicyExpression is defined NOWHERE in the corpus', () => {
		// The one undefined dependency of the eight. DOC-004 references PolicyExpression 4x and defines it never,
		// so this field stays `z.unknown()`. Inventing a predicate language would be the fabrication the audit
		// exists to stop. This test pins that the restraint is deliberate, not an oversight.
		const r = createPolicy([{ ...RATIFIED_WAIVER_RULE, revalidationTrigger: { anything: 1 } }]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});
});
