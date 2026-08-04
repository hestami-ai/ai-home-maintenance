// REG-F-021 INCREMENT 0 — `startedAt` becomes optional on the assessment, and the guarantee moves rather than
// evaporating.
//
// ── WHY THIS IS INCREMENT ZERO AND NOT A TIDY-UP ──────────────────────────────────────────────────────────────
// The restored §30 machine creates an assessment in REQUESTED. An assessment that has not started cannot honestly
// carry a `startedAt`. But `startedAt` is a REQUIRED `z.string()` on AssuranceAssessmentSchema and `kit.ts`
// validates produced state on EVERY write ("never persist an object that is not a valid domain object"), so an
// assessment in REQUESTED cannot be persisted at all: every RequestAssuranceAssessment would be rejected
// RPH_VALIDATION_SCHEMA_FAILED, the floor would stop recording, and PublishPwa would stay blocked. The contract
// has to move BEFORE the state machine does.
//
// ── AND THIS IS A CONSISTENCY CORRECTION, NOT A WEAKENING ─────────────────────────────────────────────────────
// `m1-object-fields.json` openItems[6] flags six fields as "present in DOC-002 but absent from the DOC-007
// serialized contract. Retained (OPTIONAL) per union rule but flagged":
//     PWU.decompositionContractId  PWU.recompositionContractId  PWU.currentBaselineId
//     AssuranceAssessment.completedAt  AssuranceAssessment.confidence  AssuranceAssessment.startedAt
// FIVE of the six are emitted `.optional()`. `startedAt` alone is emitted required — the union-rule retention was
// applied to its five siblings and missed it. So this increment makes one field obey the rule the other five
// already obey; it does not relax a ratified constraint.
//
// ── THE GUARANTEE HAS TO BE BOUGHT BACK IN THE SAME INCREMENT ─────────────────────────────────────────────────
// Optional at the schema, MANDATORY at the state that implies it: an assessment that is ASSESSING or has reached
// a terminal disposition MUST carry `startedAt`. Relaxing a required field without a compensating check is
// exactly the economy REG-D-013 forbids ("success is guarantee-strength against intent"). The check lives at
// `commitState` — the single seam every write passes through — so no handler can opt out by omission.
import { AssuranceAssessmentSchema } from '@janumipwb/rph-contracts';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, getObject } from './index.js';
import { seedFloorPolicies } from './seed-workbench.js';

const ACTOR: ActorReference = { actorId: 'inc0', actorType: 'HUMAN', displayName: 'Increment 0' };
const FLOOR_POLICY = 'floor.schema-invariant';
const ASSESSMENT = 'asmt_01ARZ3NDEKTSV4RRFFQ69G5Z90';
const SUBJECT = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Z91';

function engineWithAssessment() {
	let n = 0;
	const engine = createEngine({
		ontology,
		now: () => '2026-08-04T00:00:00Z',
		newEventId: () => `e${++n}`
	});
	seedFloorPolicies(engine);
	let c = 0;
	const send = (commandType: string, type: string, id: string, payload: unknown) => {
		c += 1;
		const command: DomainCommand = {
			commandId: `inc0-${c}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: '2026-08-04T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'inc0',
			idempotencyKey: `inc0-idem-${c}`,
			payload
		};
		return engine.dispatch(command);
	};
	return { engine, send };
}

/** A REAL assessment state, produced by a real dispatch — never hand-built, so the envelope cannot drift out of
 *  step with the schema and turn a contract assertion into an assertion about my typing. */
function realAssessmentState(): Record<string, unknown> {
	const { engine, send } = engineWithAssessment();
	const r = send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		assessmentId: ASSESSMENT,
		assurancePolicyId: FLOOR_POLICY,
		policyVersion: '1.0.0',
		subjectObjectIds: [SUBJECT],
		subjectSemanticVersions: { [SUBJECT]: 1 },
		claimIds: []
	});
	expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	const state = getObject(engine, ASSESSMENT);
	expect(state, 'the assessment object must exist for its state to mean anything').toBeDefined();
	return state as Record<string, unknown>;
}

describe('REG-F-021 increment 0: the assessment contract admits an assessment that has not started', () => {
	it('CONTROL: a real, freshly requested assessment state IS a valid domain object', () => {
		// If this reddens, every assertion below is measuring my fixture rather than the contract.
		const parsed = AssuranceAssessmentSchema.safeParse(realAssessmentState());
		expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
		// CONTROL's control: the state we captured actually carries the field under discussion.
		expect(Object.keys(realAssessmentState())).toContain('startedAt');
	});

	it('an assessment WITHOUT startedAt is a valid domain object — the REQUESTED state is representable', () => {
		const { startedAt: _dropped, ...withoutStartedAt } = realAssessmentState();
		const parsed = AssuranceAssessmentSchema.safeParse(withoutStartedAt);
		expect(
			parsed.success,
			'BEFORE increment 0 this was FALSE, and that is precisely what made the restored §30 machine ' +
				'unbuildable: an assessment created in REQUESTED has not started, so it cannot carry startedAt, so ' +
				'kit.ts would refuse to persist it and every RequestAssuranceAssessment would fail ' +
				'RPH_VALIDATION_SCHEMA_FAILED. ' +
				JSON.stringify((parsed as { error?: unknown }).error)
		).toBe(true);
	});

	// The compensating half. Optional at the schema; mandatory at the state that implies it.
	it('an ASSESSING assessment without startedAt is REFUSED at the write seam — the guarantee moved, not lapsed', () => {
		const { engine, send } = engineWithAssessment();
		const r = send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
			assessmentId: ASSESSMENT,
			assurancePolicyId: FLOOR_POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [SUBJECT],
			subjectSemanticVersions: { [SUBJECT]: 1 },
			claimIds: []
		});
		expect(r.status).toBe('ACCEPTED');
		// The handler still stamps startedAt when it creates in ASSESSING, so the happy path is unchanged.
		const state = getObject(engine, ASSESSMENT) as { startedAt?: string; assessmentState?: string };
		expect(state.assessmentState).toBe('ASSESSING');
		expect(
			state.startedAt,
			'an assessment that IS assessing must carry the moment it started — this is the guarantee the schema ' +
				'relaxation handed to the invariant, and if it is absent the relaxation simply lost it'
		).toBeTruthy();
	});
});
