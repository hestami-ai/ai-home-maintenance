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
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
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
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5S20';
const SCHEMA = 'floor.schema-invariant';
const IDENTITY = 'floor.identity-provenance';
const REVIEW = 'floor.reasoning-review';
/** A real criterion of floor.reasoning-review — the one the arranged Reasoning Review fails. */
const FAILED_CRITERION = 'RR-04-no-proxy-satisfaction';

describe('de minimis floor waiver SCOPE at the PublishPwa call site', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;
	let idSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		idSeq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
			correlationId: 'waiver-scope',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	/** Every arranging dispatch is checked. Shield 1 existed because these were not. */
	function ok(
		actor: ActorReference,
		commandType: string,
		payload: unknown,
		id: string,
		type: string
	) {
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
	// ⚠⚠ ASR-3 — THE FLOOR IS UNCONDITIONAL, AND THIS FILE'S SUBJECT CHANGED ON 2026-08-20 (REG-F-202).
	//
	// JPWB-DOC-003:249, ratified: "The de minimis assurance floor is UNCONDITIONAL. Risk proportionality governs
	// assurance above a mandatory floor; it never makes the floor optional." Sponsor ruling, same day: the floor is
	// never skippable. So `waiverDischargesFloorPolicy` and the whole discharge apparatus were deleted from
	// `floor-gate.ts`, and this file no longer has a call site whose SCOPING it can prove.
	//
	// ── WHAT WAS HERE, AND WHY DELETING IT WAS NOT ENOUGH ────────────────────────────────────────────────────────
	// Four tests: a CONTROL that published through an exactly-scoped waiver, and three limbs (OBJECT, VERSION,
	// POLICY) asserting that an out-of-scope waiver leaves publish REJECTED.
	//
	// Only the CONTROL broke. THE THREE LIMBS STAYED GREEN AND WENT VACUOUS — they assert a REJECTED publish, and
	// after the change REJECTED is the UNCONDITIONAL answer for any AI-produced PWA with a non-SATISFIED floor.
	// Their arrangements can no longer change the outcome, so they would have passed forever while proving nothing.
	//
	// THAT IS THIS FILE'S OWN HISTORY REPEATING. Its header records that until 2026-08-03 it held exactly that
	// shape — "a correct assertion about an arrangement that was never built" — filed as REG-F-015, and states the
	// remedy: "Without a run that PUBLISHES, no test here can distinguish 'the waiver was correctly refused' from
	// 'the arrangement never happened'." The change deleted the only run that publishes. Keeping the limbs would
	// have restored the defect the file exists to forbid; deleting them silently would have retired a ratified
	// rule's only command-layer proof. So they are deleted WITH THIS HEADER, and their subject is named below.
	//
	// ── WHERE RPH-GOV-005 IS STILL PROVEN, because it is NOT retired ─────────────────────────────────────────────
	// The rule has two applications and lost only one:
	//   DISCHARGE      — whether an existing waiver clears a floor finding. Deleted; no such path exists now.
	//   AUTHORIZATION  — whether a cited Decision may authorize a waive at all. LIVE, at
	//                    `waiver-authorization.ts:54` (`resolveWaiverAuthorization`), reached in production from
	//                    `pwu.ts:1529`, refusing on decisionType, object and version pin and naming RPH-GOV-005 in
	//                    its own refusal text. Its control is `waiver-authority.test.ts:248`.
	// The three CONJUNCTS this file used to drive are exercised non-vacuously by the kernel at
	// `rph-domain/src/governance.test.ts` (waiverCovers over criterion, object and version).
	it('ASR-3: a PERFECTLY scoped waiver does NOT discharge a required floor policy', () => {
		// The waiver is exact in every dimension the old scope limbs varied — policy, criterion, object, version —
		// and EFFECTIVE and unexpired. Under ASR-3 none of that matters, which is the point: this test would have
		// been the CONTROL a day ago, asserting the opposite outcome from the identical arrangement.
		authorValidatedAiPwa();
		recordFailingFloor(AI_PWA);
		expect(publish().status, 'unwaived, the failing Reasoning Review must block').toBe('REJECTED');

		grantWaiverScopedTo({ policyId: REVIEW, criterionId: FAILED_CRITERION });

		const r = publish();
		expect(r.status, 'ASR-3: the floor is UNCONDITIONAL — a waiver may not discharge it').toBe(
			'REJECTED'
		);
		expect(pub()).toBe('VALIDATED');
	});

	// THE CONTROL THIS FILE STILL NEEDS, and for the same reason as before: every assertion above is a REJECTED
	// publish, which is now the DEFAULT. Without a run that PUBLISHES, nothing here distinguishes "the floor
	// correctly refused" from "the arrangement never happened" — REG-F-015 in one sentence. A SATISFIED floor is
	// the only arrangement that still publishes, so it is the only control available.
	it('CONTROL: a SATISFIED floor still publishes, so the gate discriminates rather than refusing everything', () => {
		authorValidatedAiPwa();
		const version = pwaVersion(AI_PWA);
		for (const policyId of [SCHEMA, IDENTITY, REVIEW]) {
			recordFloorAssessment(engine, {
				assessmentId: ulid('asmt'),
				policyId,
				subjectId: AI_PWA,
				subjectSemanticVersion: version,
				disposition: 'SATISFIED',
				now: TS
			});
		}
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	});
});
