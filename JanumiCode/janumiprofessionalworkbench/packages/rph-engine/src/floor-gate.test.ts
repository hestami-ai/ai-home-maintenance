// Proves the recorder (3b) and the protected-transition gate (3c) compose: an AGENT-authored PWA cannot be PUBLISHED
// until the REAL de minimis floor — run by the actual Validators and persisted by recordAssuranceRecordingPlan — is
// recorded SATISFIED. This closes the loop the two package-local suites test in isolation.
import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	assuranceRecordingPlan,
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runFloorPolicies,
	schemaInvariantValidatorInstance,
	type AssuranceRecordingPlan,
	type AssuranceSubject,
	type Identity,
	type Validator,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import type { EngineHandle } from './engine.js';
import { createEngine, recordAssuranceRecordingPlan } from './index.js';
import { seedFloorPolicies } from './seed-workbench.js';

/**
 * ⭐⭐ `JAN-ORPHANED` `OR-02` — WHAT A REVIEWER THAT EVALUATED EVERYTHING AND FAULTED NOTHING ACTUALLY
 * RETURNS: one `failed: false` row per criterion.
 *
 * ⛔ THIS FIXTURE USED TO BE `findings: []`, AND THAT MEANT THE OPPOSITE OF WHAT IT MEANS NOW. It was
 * authored 2026-07-14 under the contract where an unmentioned criterion read as `MET` — so an empty list
 * said *“evaluated everything, found nothing”*. `R26` (2026-09-20) ruled that absence means the reviewer
 * did not judge it, and re-meant every such literal without touching one: the `R26` commit changed seven
 * files and no fixture among them.
 *
 * ⭑ THE INTENT WAS ALWAYS THIS — IT IS WRITTEN IN THE FIXTURE'S OWN DOCSTRING (*“all 9 criteria MET”*).
 * What changed is only that a clean verdict must now be SAID rather than inferred from silence, which is
 * exactly what a live reviewer does: `REG-F-412` measured nine rows in four of four reviews; seven stored, all nine (`REG-F-439`).
 *
 * ⚠ DERIVED, NEVER HAND-LISTED. Nine written-out ids would stop covering a tenth criterion silently — the
 * hand-listing defect one level up. (The criterion list itself is pinned by id AND count in
 * `pwa-export.test.ts`, so this cannot mask a new one.)
 */
const allClean = () =>
	SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	}));

const TS = '2026-07-14T00:00:00Z';
const AGENT: ActorReference = {
	actorId: 'agent-1',
	actorType: 'AGENT',
	displayName: 'Authoring Agent'
};
const SVC: ActorReference = {
	actorId: 'assurance',
	actorType: 'SERVICE',
	displayName: 'Assurance'
};
const PRODUCER: Identity = {
	actorType: 'AGENT',
	agentId: 'agent-1',
	modelId: 'gpt-5.4',
	providerId: 'openai'
};
const JUDGE: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';

const rrSatisfied: Validator = {
	policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
	validatorId: 'test.reasoning-review',
	evaluate: (subject) =>
		Promise.resolve(
			reasoningReviewResultFromJudgement(
				subject,
				JUDGE,
				'test.reasoning-review',
				{
					findings: allClean(),
					recommendation: 'SATISFIED'
				},
				SEEDED_REASONING_REVIEW_CRITERIA
			)
		)
};

// TWO ACTORS, AND THE AGENT IS THE ONE THE HEADLINE DEPENDS ON.
//
// ⚠ `send`'s `actor` PARAMETER IS LOAD-BEARING, NOT VESTIGIAL. It used to be written onto the envelope as
// `issuedBy`; now the SESSION carries it and the parameter SELECTS that session. The difference is not cosmetic
// — a codemod that dropped the envelope field left the parameter dead, and dead is wrong here: `pwaFloorGate`
// derives `aiProduced` from the PWA's `createdBy.actorType`, which is the stamped issuer of `CreatePwa`. Author the
// PWA as a HUMAN and `aiProduced` is false, no floor has been recorded yet so `latestFloorDispositions` is empty,
// and `floorGateBlock` returns null — the FIRST assertion in this file, that publish is blocked, would go green
// against a PWA the floor never governed. The test would still pass its last line and prove nothing, which is
// exactly the shape of vacuity this suite exists to refuse.
//
// SVC is the second, and the REASON CHANGED under it — worth stating, because the parameter surviving a change in
// why it matters is how a knob quietly becomes dead. It used to matter because `recordAssuranceRecordingPlan`
// DECLARED `issuedBy: opts.actor`, so a session that disagreed was refused outright. That declaration is gone
// (REG-F-062): the recorder now takes its issuer FROM the session, which means SVC is what lands in every recorded
// assessment's `createdBy` — the assurance-recording arm is a different actor from the PWA's AGENT author, and this
// suite reads `createdBy.actorType` to decide `aiProduced`. Collapse the two and the separation stops being tested.
const DIR = testDirectory([
	{ ...AGENT, tenantId: 'tenant-test', organizationId: 'org-test' },
	{ ...SVC, tenantId: 'tenant-test', organizationId: 'org-test' }
]);

/** The session for one of the two registered actors. `credentialFor` throws for anyone else — the cast is fixed. */
const asActor = (eng: EngineHandle, actor: ActorReference) =>
	eng.as(DIR.credentialFor(actor.actorId));

let seq = 0;
function build(): EngineHandle {
	let s = 0;
	seq = 0;
	return createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => TS,
		newEventId: () => `e${++s}`
	});
}

// Every command gets a UNIQUE idempotency key (a colliding key returns the prior receipt as DUPLICATE — so a
// blocked publish would otherwise mask a legitimate retry, and the recorder's commands would be skipped).
function send(
	eng: EngineHandle,
	actor: ActorReference,
	commandType: string,
	id: string,
	type: string,
	payload: unknown
) {
	seq += 1;
	const command: DomainCommand = {
		commandId: `g-${seq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: type,
		targetAggregateId: id,
		issuedAt: TS,
		correlationId: 'gate-e2e',
		idempotencyKey: `g-idem-${seq}`,
		payload
	};
	// The envelope declares NO issuer — the session is the claim, and declaring it again would only add something
	// the engine could disagree with.
	return asActor(eng, actor).dispatch(command);
}

function authorValidated(eng: EngineHandle) {
	send(eng, AGENT, 'CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
		pwaId: PWA,
		name: 'Agent PWA',
		description: 'd',
		domain: 'software',
		version: '1.0.0'
	});
	send(eng, AGENT, 'DefinePwuType', ROOT, 'PWU_TYPE', {
		pwuTypeId: ROOT,
		pwaId: PWA,
		pwuKind: 'PRODUCT_REALIZATION',
		name: 'R',
		purpose: 'root',
		isRoot: true
	});
	send(eng, AGENT, 'SubmitPwaForReview', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
	send(eng, AGENT, 'ValidatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
}

const publish = (eng: EngineHandle) =>
	send(eng, AGENT, 'PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: ROOT });

const GOOD_FACTS: ValidatorContext = {
	schemaInvariant: { schemaValid: true, invariantViolations: [] },
	identityProvenance: {
		hasStableId: true,
		hasSemanticVersion: true,
		hasProvenance: true,
		hasProducer: true,
		traceComplete: true
	}
};

/**
 * ⭐ The review in parts, B3 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D6) — ONE FLOOR ROUND AS THE AUTHORING FLOOR
 * RECORDS IT (the demo's `runPwaFloor`): the two deterministic policies run once over the PWA, the Reasoning Review once over
 * its one type, ROOT — each composed as a plan of its own — and both plans recorded under ONE correlation, the round's
 * token, each with a command prefix of its own. Against the subjects' ACTUAL current versions: defining the root PWU Type
 * materially edits the graph and raises the PWA's semanticVersion (from 1 to 2), so the floor must bind that version, not
 * a hardcoded 1 (§10.1 L1379).
 */
async function recordRound(
	eng: EngineHandle,
	review: Validator,
	prefix: string
): Promise<{ readonly pwa: AssuranceRecordingPlan; readonly part: AssuranceRecordingPlan }> {
	const version = (id: string) =>
		Number((eng.loadObject(id)?.state as { semanticVersion: number }).semanticVersion);
	const pwaSubject: AssuranceSubject = {
		subjectId: PWA,
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: version(PWA),
		isAiProduced: true,
		producer: PRODUCER
	};
	const partSubject: AssuranceSubject = {
		subjectId: ROOT,
		objectType: 'PWU_TYPE',
		semanticVersion: version(ROOT),
		isAiProduced: true,
		producer: PRODUCER
	};
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	registry.register(review);
	const deterministic = await runFloorPolicies(pwaSubject, GOOD_FACTS, registry, [
		FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
	]);
	const reviewed = await runFloorPolicies(partSubject, {}, registry, [FLOOR_POLICY_IDS.REASONING_REVIEW]);
	const plans = {
		pwa: assuranceRecordingPlan(pwaSubject, deterministic.plan, deterministic.results),
		part: assuranceRecordingPlan(partSubject, reviewed.plan, reviewed.results)
	};
	let idn = 0;
	for (const [suffix, plan] of [['pwa', plans.pwa], ['part', plans.part]] as const)
		recordAssuranceRecordingPlan(asActor(eng, SVC), plan, {
			issuedAt: TS,
			correlationId: 'floor',
			idPrefix: `${prefix}-${suffix}`,
			newId: (p) => `${p}_${String(++idn).padStart(26, '0')}`
		});
	return plans;
}

describe('floor gate + recorder compose (3b + 3c)', () => {
	it('an AGENT PWA is blocked until the real recorded floor is SATISFIED, then publishes', async () => {
		const eng = build();
		// the recorder cites floor.* policies — they must exist for RequestAssuranceAssessment
		seedFloorPolicies(asActor(eng, SVC));
		authorValidated(eng);

		// Gate blocks: no floor recorded yet.
		expect(publish(eng).status).toBe('REJECTED');
		expect((eng.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus).toBe(
			'VALIDATED'
		);

		// Run the REAL floor and persist it via the recorder, as one round (`recordRound`).
		const round = await recordRound(eng, rrSatisfied, 'rec');
		expect([round.pwa.gatePermitsTransition, round.part.gatePermitsTransition]).toEqual([true, true]);

		// Gate now permits.
		const r = publish(eng);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect((eng.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus).toBe(
			'PUBLISHED'
		);
	});
});

// ── ⭐⭐ `JAN-ESCREC` D1 — THE ENGINE'S OWN GATE REFUSES AN ESCALATED REVIEW (`REG-D-089`: *"publishing stays blocked"*) ───
//
// The package's `gatePermitsTransition` is the floor's OWN answer; what actually refuses publication is the engine's
// `floorGateBlock`, which reads the latest RECORDED assessment per floor policy and admits SATISFIED only. So rule (a)
// is proved end to end here: the real floor runs, the recorder persists an ESCALATED review, and PublishPwa is refused
// naming it. The CONTROL is the identical arrangement with the reviewer recommending SATISFIED, which publishes — so
// the refusal is the escalation's, and not the version binding's or the author's.
describe('⭐⭐ JAN-ESCREC D1 — PublishPwa is refused over a recorded ESCALATED review, and admitted over the same review SATISFIED', () => {
	/** ⭐ B3 — the round's plan for the one part, its review recommending `recommendation` (`recordRound`). */
	async function recordFloorRecommending(
		eng: EngineHandle,
		recommendation: 'ESCALATED' | 'SATISFIED'
	) {
		const round = await recordRound(
			eng,
			{
				...rrSatisfied,
				evaluate: (s) =>
					Promise.resolve(
						reasoningReviewResultFromJudgement(
							s,
							JUDGE,
							'test.reasoning-review',
							{ findings: allClean(), recommendation },
							SEEDED_REASONING_REVIEW_CRITERIA
						)
					)
			},
			`rec-${recommendation.toLowerCase()}`
		);
		return round.part;
	}
	const publicationStatus = (eng: EngineHandle) =>
		(eng.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus;

	it('⭐ RED — a clean review recommending ESCALATED is recorded ESCALATED, and the engine’s floor gate refuses PublishPwa naming it', async () => {
		// PREDICTED RED AT HEAD: the review is recorded SATISFIED and the publish is ACCEPTED (`REG-F-473`: *"publication
		// is not blocked"*).
		const eng = build();
		seedFloorPolicies(asActor(eng, SVC));
		authorValidated(eng);
		const plan = await recordFloorRecommending(eng, 'ESCALATED');

		// ⭑ THE ENGINE'S REFUSAL IS ASSERTED FIRST, because it is the claim: the plan's `gatePermitsTransition` is only the
		// floor's own answer, and a host that published on its own reading would still meet this gate.
		const r = publish(eng);
		expect(r.status, 'the engine’s floor gate refuses the protected transition').toBe('REJECTED');
		// ⭐ THE MESSAGE NAMES THE ESCALATED REVIEW AND ONLY IT: the two deterministic policies are SATISFIED, so the
		// block is the review's alone — ⭐ B3: its part's, named with its type (`pwaPartsFloorBlock` lists every row that is
		// not SATISFIED).
		expect(r.error?.message).toContain(`(floor.reasoning-review of ${ROOT}=ESCALATED)`);
		expect(publicationStatus(eng), 'nothing was published').toBe('VALIDATED');
		expect(plan.gatePermitsTransition, 'and the floor’s own answer agrees').toBe(false);
	});

	it('CONTROL — the identical arrangement, the reviewer recommending SATISFIED, publishes', async () => {
		const eng = build();
		seedFloorPolicies(asActor(eng, SVC));
		authorValidated(eng);
		const plan = await recordFloorRecommending(eng, 'SATISFIED');
		expect(plan.gatePermitsTransition).toBe(true);
		const r = publish(eng);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(publicationStatus(eng)).toBe('PUBLISHED');
	});
});
