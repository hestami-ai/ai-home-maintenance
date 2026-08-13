// STA-6 CLAUSE (d) — "a superseded intent cannot authorize new PWUs" (JPWB-DOC-003 §5 STA-6, verbatim).
//
// ── WHY THIS LANDS BEFORE `SupersedeIntent` EXISTS, WHICH IS THE WHOLE POINT OF ITS ORDERING ──────────────────
//
// The enforcement register closes this rule as `NOT_A_COMMAND_REFUSAL` on the ground that SUPERSEDED is
// COMMAND-UNREACHABLE — six INTENT commands are registered and none targets it — and states the consequence in
// terms: *"if SUPERSEDED ever becomes reachable, this rule becomes a live UNENFORCED_DISCLOSED row on the same
// day."* Building `SupersedeIntent` first would therefore ship six new arrows, a green gate, and a governance
// rule that had silently stopped being closed. The guard lands FIRST so there is no such day.
//
// The antecedent being command-unreachable is also why this suite SEEDS the status rather than driving it: an
// arrangement no command can produce is exactly the case a fixture is for, and `getMachine` is consulted so a
// state the machine cannot represent cannot be rehearsed against.
//
// ── ⚠ SUPERSEDED ONLY — AND WITHDRAWN IS DELIBERATELY ADMITTED ───────────────────────────────────────────────
//
// My design said "SUPERSEDED (and WITHDRAWN)". That was an inference, and it repeats one this register has
// already ratified AS an error. STA-6 names *"a superseded intent"* and nothing else; the ratified Canonical
// Domain Model mentions WITHDRAWN twice — the enum member and the §6.2 matrix row — and none of §6.3's seven
// invariants names it. The ground for adding it was `terminalStates: ['SUPERSEDED','WITHDRAWN']`, i.e. *the two
// terminal states should behave alike* — and **REG-F-083 records that `terminalStates` is WHOLLY A REPOSITORY
// SHAPE**: *"The ratified Canonical Domain Model contains the word 'terminal' ZERO times."* Reasoning from it as
// though it were canon is the mistake, not the conclusion.
//
// The corpus does not treat the two alike either: Supersede has SIX in-arrows ("any active"), Withdraw only
// THREE ("permitted only from these three early states").
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { getMachine } from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-13T00:00:00.000Z';
const human = { actorId: 'arch', actorType: 'HUMAN' as const, displayName: 'Architect' };
const DIR = testDirectory([{ ...human, tenantId: 't', organizationId: 'o' }]);
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('STA-6 (d) — a superseded intent cannot authorize new PWUs', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const send = (commandType: string, payload: unknown, id: string, aggType: string) => {
		seq += 1;
		return engine.as(DIR.credentialFor(human.actorId)).dispatch({
			commandId: `c-${seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'sta6',
			idempotencyKey: `k-${seq}`,
			payload
		} as never);
	};

	const captureIntent = () =>
		send(
			'CaptureIntent',
			{ intentId: INTENT_ID, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT_ID,
			'INTENT'
		);

	/**
	 * Put the intent into a status no command can reach.
	 *
	 * Guarded against the machine, not against a remembered list: seeding a state the machine cannot represent
	 * would rehearse this rule against an aggregate that cannot exist, which is the manufactured-evidence shape
	 * this repository refuses.
	 */
	const seedIntentStatus = (intentStatus: string) => {
		const states = getMachine('Intent.intentStatus').states as readonly string[];
		if (!states.includes(intentStatus))
			throw new Error(`seedIntentStatus: '${intentStatus}' is not a state of Intent.intentStatus`);
		const stored = store.loadObject(INTENT_ID);
		if (!stored) throw new Error('seedIntentStatus: capture the intent first');
		seq += 1;
		const r = store.commit({
			aggregateType: 'INTENT',
			aggregateId: INTENT_ID,
			objectType: 'INTENT',
			expectedRevision: stored.revision,
			newRevision: stored.revision + 1,
			newSemanticVersion: stored.semanticVersion,
			currentState: { ...(stored.state as Record<string, unknown>), intentStatus },
			events: [],
			receipt: {
				commandId: `fixture-sta6-${seq}`,
				idempotencyKey: `fixture-sta6-${seq}`,
				commandType: 'FixtureSeedIntentStatus',
				targetAggregateId: INTENT_ID,
				status: 'ACCEPTED',
				producedEventIds: []
			}
		});
		if (!r.ok) throw new Error(`seedIntentStatus: commit refused (${r.reason})`);
	};

	const proposePwu = (pwuId: string) =>
		send(
			'ProposePwu',
			{
				pwuId,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'd',
				intentId: INTENT_ID,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			},
			pwuId,
			'PROFESSIONAL_WORK_UNIT'
		);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		});
		expect(captureIntent().status).toBe('ACCEPTED');
	});

	it('REFUSES a proposal whose intent is SUPERSEDED', () => {
		seedIntentStatus('SUPERSEDED');
		const r = proposePwu('pwu_01ARZ3NDEKTSV4RRFFQ69G5FB1');
		expect(r.status, 'STA-6: a superseded intent authorizes no new work').not.toBe('ACCEPTED');
		expect(store.loadObject('pwu_01ARZ3NDEKTSV4RRFFQ69G5FB1'), 'and nothing was created').toBeUndefined();
	});

	// ⚠ THE CONTROL THAT STOPS THIS BECOMING A READINESS GATE. `pwuGuards.ts` already holds clause (a) with
	// `INTENT_AT_LEAST_PROVISIONAL` = {PROVISIONAL, FORMALIZED, APPROVED, REVISED}, and reusing that set HERE
	// would refuse RAW — which is how the repository actually works: 56 of the 71 files that dispatch both
	// CaptureIntent and ProposePwu never mature the intent in between. Clause (a) governs READINESS; clause (d)
	// governs CREATION; they take different sets and this control is what keeps them apart.
	it('CONTROL — a RAW intent still authorizes a proposal, because clause (d) is not clause (a)', () => {
		const r = proposePwu('pwu_01ARZ3NDEKTSV4RRFFQ69G5FB2');
		expect(r.status, 'proposing under a RAW intent is the normal, deliberate pattern').toBe('ACCEPTED');
	});

	it('CONTROL — the matured states are unaffected', () => {
		// The suffixes are Crockford base32 (the ULID alphabet excludes I, L, O and U) — a first pass used
		// `s.slice(0, 2)` and FORMALIZED gave "FO", which the id schema refused. The refusal was the CONTRACT
		// working; the test was wrong.
		const cases: readonly [string, string][] = [
			['PROVISIONAL', 'P1'],
			['FORMALIZED', 'F2'],
			['APPROVED', 'A3'],
			['REVISED', 'R4']
		];
		for (const [status, suffix] of cases) {
			seedIntentStatus(status);
			expect(
				proposePwu(`pwu_01ARZ3NDEKTSV4RRFFQ69G5F${suffix}`).status,
				`${status} must still authorize`
			).toBe('ACCEPTED');
		}
	});

	// ⚠ PINNED AS A DELIBERATE NON-RULE, NOT AS AN ENDORSEMENT. Nothing ratified says a WITHDRAWN intent cannot
	// authorize new PWUs, and the only ground for inferring it — `terminalStates` — is a repository shape
	// (REG-F-083). So it is ADMITTED, and pinned here so that changing it is a visible act with a stated
	// justification rather than a quiet widening. **If the sponsor rules that a withdrawn intent should not
	// authorize work, this test is the thing that must change, and that is the point of it.**
	it('WITHDRAWN is deliberately ADMITTED — the rule names SUPERSEDED and only SUPERSEDED', () => {
		seedIntentStatus('WITHDRAWN');
		const r = proposePwu('pwu_01ARZ3NDEKTSV4RRFFQ69G5FB3');
		expect(
			r.status,
			'refusing WITHDRAWN would enforce an inference from `terminalStates`, which REG-F-083 records is a ' +
				'repository shape and not canon — a ratification question, not a repository one'
		).toBe('ACCEPTED');
	});
});
