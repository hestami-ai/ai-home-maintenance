// Drives the PublishPwa protected transition LIVE to prove the CALL SITE scopes a waiver, not just the kernel.
//
// Guide §16 item 12, L2509 (byte-exact): "Never implement waiver as a Boolean—require a version-bound Decision with
// scope, expiry, rationale, controls, and preserved finding."
// Guide §8.4, L854 (byte-exact): "No PWA profile, low-risk classification, planner optimization, or local agent
// instruction may suppress this Reasoning Review floor."
//
// ── WHAT THIS FILE COVERS, AND WHY IT IS NOT THE CRITERION LIMB ──────────────────────────────────────────────────
// RPH-GOV-005 has THREE limbs: a waiver does not bleed to another CRITERION, another OBJECT, or another VERSION.
// `pwa-authoring.test.ts` already drives the CRITERION limb non-vacuously (it has a control that publishes and a
// discriminator that does not, and neutralising `waiverCovers`' criterion conjunct reddens it). The other two limbs
// were covered by NOTHING the running engine can reach — proven by mutation, twice:
//
//   neutralise `waiverCovers`' subjectSemanticVersion conjunct  -> only rph-domain/governance.test.ts reddens
//   neutralise `waiverCovers`' subjectObjectId conjunct         -> only rph-domain/governance.test.ts reddens
//   delete `subjectObjectIds.includes(subjectId)` in effectiveFloorWaivers -> THE ENTIRE SUITE STAYS GREEN
//
// `waiverCovers`' object conjunct is a TAUTOLOGY at its only production call site: `effectiveFloorWaivers` builds
// the view with `subjectObjectId: subjectId`, the very value `waiverCovers` compares it against, so that conjunct
// compares a thing with itself and can never discriminate. The kernel test proves it computes correctly; nothing
// can ask it a question it could get wrong. That is the DS-001 shape at CONJUNCT granularity.
//
// THE THIRD LINE IS NOT WHAT IT LOOKS LIKE, and this correction is recorded rather than quietly applied because the
// first reading was written down before it was checked. "The suite stays green when the subject filter is deleted"
// reads as an unguarded bypass — a waiver naming another PWA discharging this one's floor. It is not. The object
// limb is enforced TWICE, and either site suffices alone: the filter, and REDUNDANTLY the `?? -1` fallback one
// argument along, because a waiver that does not name this subject carries no `subjectSemanticVersions` entry for
// it, so its view gets version -1 and fails the version conjunct. Deleting the filter changes no behaviour any
// arrangement can observe. The filter is REDUNDANT, not unguarded — an unkillable line, not a hole. Proven by
// combining both mutations (filter -> false AND `?? -1` -> `?? 2`), which DOES redden the object test below: the
// limb is guarded, just not by any one line.
//
// So the three tests below own the object, version and policy limbs, each with a named predicted red on the test.
//
// ── HOW THIS FILE USED TO PASS, WHICH IS THE REAL LESSON ─────────────────────────────────────────────────────────
// Until 2026-08-03 it held two tests asserting that an out-of-scope waiver leaves publish REJECTED. Both passed.
// Neither reached the waiver logic AT ALL — a `throw` on the first line of `waiverCovers` did not fire. Three
// independent shields, each sufficient alone, found by instrumenting one branch at a time:
//
//   1. THE OPERATIVE ONE. The floor policies were never seeded. `RequestAssuranceAssessment` fails closed on a
//      policy the store has never seen, so every floor assessment was REFUSED and no assessment aggregate was ever
//      created. The local `recordFloor` helper asserted nothing, so a helper that recorded NO FLOOR AT ALL looked
//      like one that recorded three.
//   2. It recorded against the literal version 1, while `DefinePwuType` raises the PWA to 2 — so even a created
//      assessment would have been discarded as stale by the version binding.
//   3. It recorded no observations, so `waiverDischargesFloorPolicy` would have returned at its "nothing to waive"
//      branch before comparing any criterion.
//
// A PWA with no floor is refused publication for MISSING, which is also REJECTED with RPH_INVARIANT_VIOLATION. The
// assertions were TRUE — about a different refusal. This is the "control that cannot fail" defect in its purest
// form: not a weak assertion, but a correct assertion about an arrangement that was never built. Note that this
// file's HEADER was corrected one commit earlier (f48b4412) for calling `waiverCovers` dead; the prose was fixed
// while the tests underneath it were still proving nothing. Filed as REG-F-015.
//
// The fixture is now `recordFloorAssessment` in `__tests__/floor-fixtures.ts`, which THROWS on any non-ACCEPTED
// dispatch and requires the caller to state the subject version. A fixture may not silently arrange nothing.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { recordFloorAssessment, seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-07-15T00:00:00Z';
const AGENT: ActorReference = {
	actorId: 'agent-1',
	actorType: 'AGENT',
	displayName: 'Authoring Agent'
};
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
const AI_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const AI_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S30';
const OTHER_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S40';
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5S20';
const SCHEMA = 'floor.schema-invariant';
const IDENTITY = 'floor.identity-provenance';
const REVIEW = 'floor.reasoning-review';
/** A real criterion of floor.reasoning-review — the one the arranged Reasoning Review fails. */
const FAILED_CRITERION = 'RR-04-no-proxy-satisfaction';

describe('de minimis floor waiver SCOPE at the PublishPwa call site', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let idSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		idSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		// Shield 1 above. Without this every floor assessment is refused and the file proves nothing.
		seedFloorPolicies(engine, TS);
	});

	function d(
		actor: ActorReference,
		commandType: string,
		payload: unknown,
		id: string,
		type: string
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'waiver-scope',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	/** Every arranging dispatch is checked. Shield 1 existed because these were not. */
	function ok(actor: ActorReference, commandType: string, payload: unknown, id: string, type: string) {
		const r = d(actor, commandType, payload, id, type);
		expect(r.status, `${commandType} ${id}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		return r;
	}

	const ulid = (prefix: string) => `${prefix}_${String(++idSeq).padStart(26, '0')}`;

	const pub = (pwaId = AI_PWA) =>
		(store.loadObject(pwaId)?.state as { publicationStatus: string }).publicationStatus;

	/** The subject's CURRENT semanticVersion, read from engine state. Shield 2 was a literal 1 here. */
	const pwaVersion = (pwaId: string) =>
		Number((store.loadObject(pwaId)?.state as { semanticVersion?: number }).semanticVersion ?? 1);

	/** CreatePwa only — the PWA exists at v1 and nothing has raised it yet. */
	function createPwa(pwaId: string) {
		ok(
			AGENT,
			'CreatePwa',
			{
				pwaId,
				name: 'Agent-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			pwaId,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
	}

	/** DefinePwuType (which RAISES semanticVersion to 2) -> submit -> validate. */
	function validatePwa(pwaId: string, rootId: string) {
		ok(
			AGENT,
			'DefinePwuType',
			{
				pwuTypeId: rootId,
				pwaId,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			rootId,
			'PWU_TYPE'
		);
		ok(AGENT, 'SubmitPwaForReview', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE');
		ok(AGENT, 'ValidatePwa', {}, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE');
	}

	function authorValidatedAiPwa(pwaId = AI_PWA, rootId = AI_ROOT) {
		createPwa(pwaId);
		validatePwa(pwaId, rootId);
	}

	/**
	 * Record the three floor policies over `pwaId` at its CURRENT version: schema + identity SATISFIED, the
	 * Reasoning Review REJECTED with ONE open finding naming `FAILED_CRITERION`. That finding is what a waiver must
	 * name to discharge — shield 3 was its absence.
	 */
	function recordFailingFloor(pwaId: string) {
		const version = pwaVersion(pwaId);
		for (const policyId of [SCHEMA, IDENTITY]) {
			recordFloorAssessment(engine, {
				assessmentId: ulid('asmt'),
				policyId,
				subjectId: pwaId,
				subjectSemanticVersion: version,
				disposition: 'SATISFIED',
				now: TS
			});
		}
		recordFloorAssessment(engine, {
			assessmentId: ulid('asmt'),
			policyId: REVIEW,
			subjectId: pwaId,
			subjectSemanticVersion: version,
			disposition: 'REJECTED',
			openFindings: [{ observationId: ulid('obs'), findingCode: FAILED_CRITERION }],
			now: TS
		});
	}

	/**
	 * Grant an EFFECTIVE waiver naming an exact (policy, criterion) over `subjectPwaId`. The VERSION is not a
	 * parameter: `requestWaiver` pins it from the store at request time (`subjectVersions`), which is why the
	 * version-limb test below arranges its mismatch by WHEN it grants rather than by what it passes.
	 */
	function grantWaiverScopedTo(opts: {
		policyId: string;
		criterionId: string;
		subjectPwaId?: string;
	}) {
		const subject = opts.subjectPwaId ?? AI_PWA;
		ok(
			HUMAN,
			'RequestWaiver',
			{
				subjectObjectIds: [subject],
				scope: opts.criterionId,
				rationale: 'Accepted residual risk for the pilot.',
				duration: 'until superseded',
				affectedObjectIds: [subject],
				waivedPolicyId: opts.policyId,
				waivedCriterionId: opts.criterionId,
				waivedFindingIds: [],
				compensatingControls: [],
				reviewConditions: []
			},
			WAIVER,
			'DECISION'
		);
		ok(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: WAIVER, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);
	}

	const publish = (pwaId = AI_PWA, rootId = AI_ROOT) =>
		d(AGENT, 'PublishPwa', { rootPwuTypeId: rootId }, pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE');

	// THE CONTROL THIS FILE NEVER HAD. Everything below asserts a REJECTED publish, and a REJECTED publish is the
	// DEFAULT for an AI-produced PWA — it is what MISSING, stale, and unwaived all produce. Without a run that
	// PUBLISHES, no test here can distinguish "the waiver was correctly refused" from "the arrangement never
	// happened", which is precisely how the previous version of this file passed for months.
	it('CONTROL: a waiver naming the exact policy, criterion, object and version DOES discharge the floor', () => {
		authorValidatedAiPwa();
		recordFailingFloor(AI_PWA);
		expect(publish().status, 'unwaived, the failing Reasoning Review must block').toBe('REJECTED');

		grantWaiverScopedTo({ policyId: REVIEW, criterionId: FAILED_CRITERION });

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	});

	// LIMB 2 — ANOTHER OBJECT. Identical to the control in every field except WHICH PWA the waiver names.
	//
	// PREDICTED RED, and it takes TWO mutations at once because the limb is enforced twice over — stated as a pair
	// because a single-line predicted red was tried here first and DID NOT FIRE, which is the only reason this
	// comment is trustworthy. In `effectiveFloorWaivers`: replace `!s.subjectObjectIds.includes(subjectId)` with
	// `false` AND `?? -1` with `?? 2`. Then this test fails (the publish becomes ACCEPTED) while the control stays
	// green. Either mutation ALONE leaves the whole suite green: the filter drops the foreign waiver, and failing
	// that, the version fallback gives it -1 and the version conjunct drops it. Redundant enforcement, not a hole.
	//
	// NOT PROVABLE HERE, and stated so no one reads this test as covering it: `waiverCovers`' own subjectObjectId
	// conjunct is unreachable-by-construction from this path, because `effectiveFloorWaivers` builds the view with
	// `subjectObjectId: subjectId`. Neutralising that conjunct leaves this test green. The limb is enforced; the
	// predicate that appears to enforce it is not what does.
	it('a waiver naming ANOTHER OBJECT does not discharge this PWA floor (RPH-GOV-005: no bleeding across objects)', () => {
		authorValidatedAiPwa();
		authorValidatedAiPwa(OTHER_PWA, OTHER_ROOT);
		recordFailingFloor(AI_PWA);
		expect(publish().status).toBe('REJECTED');

		// Same policy, same criterion, same version number — everything but the object.
		grantWaiverScopedTo({
			policyId: REVIEW,
			criterionId: FAILED_CRITERION,
			subjectPwaId: OTHER_PWA
		});

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	// LIMB 3 — ANOTHER VERSION. The rule's literal example: "a waiver for policy criterion AC-04 on Architecture
	// version 2 ... does not waive Architecture version 3."
	//
	// The mismatch is arranged by ORDER, not by a payload field: `requestWaiver` pins the subject version from the
	// store, so granting BEFORE `DefinePwuType` pins v1, and `DefinePwuType` then raises the PWA to v2. The floor is
	// recorded at the current version, so the ONLY thing stale is the waiver.
	//
	// PREDICTED RED: neutralise `waiverCovers`' `subjectSemanticVersion` conjunct and this test must fail while the
	// control stays green. Before this test that mutation reddened only the rph-domain kernel unit test — the
	// version limb had no command-layer reader.
	it('a waiver pinned to an EARLIER version does not discharge the current one (RPH-GOV-005: no bleeding across versions)', () => {
		createPwa(AI_PWA);
		expect(pwaVersion(AI_PWA), 'the waiver must pin v1').toBe(1);
		grantWaiverScopedTo({ policyId: REVIEW, criterionId: FAILED_CRITERION });

		validatePwa(AI_PWA, AI_ROOT);
		expect(pwaVersion(AI_PWA), 'DefinePwuType materially edits the graph and raises the version').toBe(2);
		recordFailingFloor(AI_PWA);

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	// The POLICY half of "exact policy and criterion" (DOC-004 §12.2). `waiverCovers` scopes by criterion only; the
	// policy comparison lives in `waiverDischargesFloorPolicy`'s filter. A criterion id that happened to repeat
	// across two policies would bleed between them without it.
	//
	// PREDICTED RED: drop `w.waivedPolicyId === policyId` from that filter and this test must fail.
	it('a waiver of the SAME criterion id under ANOTHER POLICY does not discharge this policy', () => {
		authorValidatedAiPwa();
		recordFailingFloor(AI_PWA);
		expect(publish().status).toBe('REJECTED');

		// Names the failing criterion, but attributes it to the schema policy rather than the Reasoning Review.
		grantWaiverScopedTo({ policyId: SCHEMA, criterionId: FAILED_CRITERION });

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(pub()).toBe('VALIDATED');
	});
});
