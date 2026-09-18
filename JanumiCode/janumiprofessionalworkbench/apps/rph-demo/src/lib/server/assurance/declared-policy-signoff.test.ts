// ⭐⭐ THE SIGN-OFF ASSESSES WHAT THE PWU DECLARES, AND A SECOND PARTY PERFORMS IT — `JAN-EXEC` Phase 6b / `R22`.
//
// ⛔ EVERY ASSERTION HERE WAS RED AT HEAD, AND THE ROADMAP NAMED WHICH BEFORE ANY OF IT WAS WRITTEN (§8b.3).
// The surface assessed ONE policy the PWU does not declare, with `producer: evaluator` — one identity wearing
// both hats — under a policy chosen because its `independenceRequirement: NONE` means the check is skipped.
//
// ⚠ THIS FILE LIVES IN `apps/`, WHICH THE RATCHETS DO NOT WALK. `guards:export` walks `packages/` only and the
// coverage floor has ZERO entries for this app, so nothing here is measured by the three standing instruments.
// That is why the controls below are explicit and why `P6b-*` mutants exist: in this directory a test is the
// only instrument there is. (Phase 5 hit the same blindness and guarded it the same way.)
import { vi } from 'vitest';

// `workbench.ts` freezes RPH_DEMO_MODE into a module const at load; `vi.hoisted` is what runs early enough.
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { createEngine } from '@janumipwb/rph-engine';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	ASSURANCE_REVIEWER_CREDENTIAL,
	SESSION_CREDENTIAL,
	actingActor,
	standaloneAuthenticator
} from '../identity.js';
import {
	DEMO_REVIEW_LIMITATION,
	planDeclaredSignoff,
	unsatisfyingReviews
} from './declared-policy-signoff.js';

const TS = '2026-09-18T12:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GS100';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GS110';
const TYPE = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS120';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS130';
/** A PWU whose type declares NOTHING — the control for the untouched else-branch. */
const TYPE_BARE = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS140';
const PWU_BARE = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS150';
/** TWO policies, so "one per governing policy" is distinguishable from "one, always". */
const POL_AGENT = 'pol_01ARZ3NDEKTSV4RRFFQ69GS160';
const POL_INVOC = 'pol_01ARZ3NDEKTSV4RRFFQ69GS170';
/** Declared but SUSPENDED — the exclusion arm, which must be reported rather than silently dropped. */
const POL_SUSPENDED = 'pol_01ARZ3NDEKTSV4RRFFQ69GS180';

describe('⭐ planDeclaredSignoff — one assessment per governing DECLARED policy, by an independent party', () => {
	let host: ReturnType<typeof createEngine>;
	let operator: AuthedEngineHandle;
	let reviewer: AuthedEngineHandle;
	let seq = 0;

	const command = (
		commandType: string,
		aggType: string,
		aggId: string,
		payload: unknown
	): DomainCommand => {
		seq += 1;
		return {
			commandId: `c-${seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: aggId,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${seq}`,
			payload
		};
	};

	const send = (
		handle: AuthedEngineHandle,
		commandType: string,
		aggType: string,
		aggId: string,
		payload: unknown
	) => handle.dispatch(command(commandType, aggType, aggId, payload));

	function ok(r: { status: string; error?: { message?: string } }, what: string) {
		if (r.status !== 'ACCEPTED') throw new Error(`${what}: ${r.status} ${r.error?.message ?? ''}`);
		return r;
	}

	/**
	 * An ACTIVE policy over PWUs with a stated independence requirement.
	 *
	 * ⚠ `requiredEvidence` IS A PARAMETER SO THE GATED ARMS ARE EXPRESSIBLE. Hard-coding `[]` is what made the
	 * whole disposition question invisible in the first draft — a fixture that can only build the easy case
	 * cannot fail on the hard one, which is this repository's most-recorded defect shape.
	 */
	function policy(
		policyId: string,
		name: string,
		independence: string,
		requiredEvidence: readonly Record<string, unknown>[] = [],
		activate = true
	): void {
		ok(
			send(operator, 'CreateAssurancePolicy', 'ASSURANCE_POLICY', policyId, {
				policyId,
				version: '1.0.0',
				name,
				purpose: 'Assess the declared aspect of this work.',
				rationale: 'Declared by the PWU Type; demanded of every instance.',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Met',
						description: 'The declared aspect is met.',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: independence,
				requiredEvidence: requiredEvidence.map((r) => ({ ...r })),
				findingDefinitions: [
					{
						code: 'NOT_MET',
						name: 'Not met',
						description: 'Not met.',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE']
			}),
			`CreateAssurancePolicy(${policyId})`
		);
		if (activate)
			ok(
				send(operator, 'ActivateAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId }),
				`ActivateAssurancePolicy(${policyId})`
			);
	}

	function definePwuType(typeId: string, required: readonly string[]): void {
		ok(
			send(operator, 'DefinePwuType', 'PWU_TYPE', typeId, {
				pwuTypeId: typeId,
				pwaId: PWA,
				pwuKind: 'ARCHITECTURE',
				name: `Type ${typeId.slice(-3)}`,
				purpose: 'p',
				isRoot: typeId === TYPE,
				requiredAssurancePolicyIds: [...required]
			}),
			`DefinePwuType(${typeId})`
		);
	}

	function proposePwu(pwuId: string, typeId: string): void {
		ok(
			send(operator, 'ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
				pwuId,
				pwuKind: 'PWU',
				title: 'Declared work',
				description: 'd',
				intentId: INTENT,
				pwuTypeId: typeId,
				// ⭑ THE INSTANCE DECLARES NOTHING OF ITS OWN. Everything under test arrives from the TYPE, which
				// is how the demo's own instantiation path fills it (`undertakings/+page.server.ts:234`) and
				// therefore the arrangement the browser actually produces.
				assurancePolicyIds: [],
				boundaries: {
					inScope: ['x'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'MEDIUM'
				}
			}),
			`ProposePwu(${pwuId})`
		);
	}

	let minted = 0;
	const mintId = (prefix: string) => `${prefix}_01ARZ3NDEKTSV4RRFFQ69GSA${String(++minted).padStart(2, '0')}`;

	const plan = (pwuId: string, overrides: Record<string, unknown> = {}) =>
		planDeclaredSignoff({
			engine: host,
			pwuId,
			subjectSemanticVersion: host.loadObject(pwuId)?.semanticVersion ?? 1,
			evaluator: actingActor(reviewer),
			producer: actingActor(operator),
			mintId,
			...overrides
		} as Parameters<typeof planDeclaredSignoff>[0]);

	/** Issue the review EXACTLY as the route does — one batch, under the REVIEWER's own session. */
	const runReview = (steps: readonly [string, string, string, unknown][]) =>
		reviewer.dispatchBatch(
			steps.map(([commandType, aggType, aggId, payload]) =>
				command(commandType, aggType, aggId, payload)
			)
		);

	const stateOf = (id: string) =>
		host.loadObject(id)?.state as
			| {
					assessmentState?: string;
					assurancePolicyId?: string;
					evaluator?: { actorId?: string };
					updatedBy?: { actorId?: string };
			  }
			| undefined;

	beforeEach(() => {
		seq = 0;
		minted = 0;
		host = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		});
		operator = host.as(SESSION_CREDENTIAL);
		reviewer = host.as(ASSURANCE_REVIEWER_CREDENTIAL);
		ok(
			send(operator, 'CaptureIntent', 'INTENT', INTENT, {
				intentId: INTENT,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			}),
			'CaptureIntent'
		);
		ok(
			send(operator, 'CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'A',
				description: 'The architecture whose types carry the declarations under test.',
				domain: 'test',
				version: '1'
			}),
			'CreatePwa'
		);
		policy(POL_AGENT, 'Different agent', 'DIFFERENT_AGENT');
		policy(POL_INVOC, 'Different invocation', 'DIFFERENT_INVOCATION');
		definePwuType(TYPE, [POL_AGENT, POL_INVOC]);
		definePwuType(TYPE_BARE, []);
		proposePwu(PWU, TYPE);
		proposePwu(PWU_BARE, TYPE_BARE);
	});

	// ── `PR-1` ───────────────────────────────────────────────────────────────────────────────────────────────
	it('⭐ opens ONE assessment per governing DECLARED policy — not one, always', () => {
		// ⛔ RED AT HEAD: `assurancePrelude` opened exactly one assessment, under `DEMO_POLICY_ID`, which is in
		// neither declared set. TWO policies is what separates "per policy" from "one" — with a single declared
		// policy both readings produce the same number and the assertion says nothing.
		const p = plan(PWU);
		expect(p.policyIds, 'the TYPE’s declaration is the instance’s').toEqual([POL_AGENT, POL_INVOC]);
		expect(p.assessmentIds).toHaveLength(2);
		expect(new Set(p.assessmentIds).size, 'two policies cannot share one assessment').toBe(2);
	});

	// ── `PR-4` ───────────────────────────────────────────────────────────────────────────────────────────────
	it('⭐ each verdict names ITS OWN policy, and each assessment is opened under it', () => {
		const p = plan(PWU);
		for (const [i, policyId] of p.policyIds.entries()) {
			const asmId = p.assessmentIds[i]!;
			const request = p.steps.find(
				([type, , id]) => type === 'RequestAssuranceAssessment' && id === asmId
			);
			const complete = p.steps.find(
				([type, , id]) => type === 'CompleteAssuranceAssessment' && id === asmId
			);
			expect((request?.[3] as { assurancePolicyId?: string }).assurancePolicyId).toBe(policyId);
			expect(
				(complete?.[3] as { validatorResult?: { policyId?: string } }).validatorResult?.policyId,
				'a verdict naming another policy is a judgement attributed to criteria it was never measured against'
			).toBe(policyId);
		}
	});

	// ── `PR-2` + `PR-3`, DRIVEN LIVE ─────────────────────────────────────────────────────────────────────────
	it('⭐⭐ the review is ISSUED BY the reviewer, and BOTH declared independence demands are SATISFIED', () => {
		// ⛔ RED AT HEAD in two independent ways: the assessments did not exist, and the one that did was
		// completed with `producer: evaluator`. `DIFFERENT_AGENT` compares `actorId`; `DIFFERENT_INVOCATION`
		// compares `executionInstanceId` and FAILS CLOSED unless BOTH parties carry one.
		const p = plan(PWU);
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);
		expect(batch.ok, `the independent review was refused: ${JSON.stringify(batch.results.at(-1)?.error)}`).toBe(
			true
		);
		for (const asmId of p.assessmentIds) {
			const s = stateOf(asmId);
			// ⚠ SATISFIED, and specifically NOT `INDEPENDENCE_VIOLATION` — the §30 arrow a self-review takes.
			expect(s?.assessmentState, `${asmId} did not reach SATISFIED`).toBe('SATISFIED');
			// `PR-3` — THE CONTROL ON `R22`'s OWN DISCIPLINE. The recorded evaluator and the STAMPED issuer are
			// the same party. A fix that NAMED a reviewer the operator's session issued for would satisfy the
			// independence check above and fail here, which is the forgery `REG-F-061` is about.
			expect(s?.evaluator?.actorId, 'the recorded evaluator').toBe('assurance-reviewer-1');
			expect(s?.updatedBy?.actorId, 'the STAMPED issuer of the completion').toBe('assurance-reviewer-1');
		}
	});

	it('⭑ every verdict DISCLOSES what this review did not do, WHERE A READER CAN SEE IT', () => {
		// A demonstration sign-off that presented itself as a criteria-level evaluation would be the fiction
		// this surface has already been caught in twice.
		//
		// ⛔ THE FIRST VERSION OF THIS TEST ASSERTED ON §20 `limitations` AND WAS RED — which is how the orphan
		// was found. `limitations` is the field that BELONGS to this fact, and the ratified
		// `AssuranceAssessmentCompleted` payload is a `strictObject` that does not declare it, so the value is
		// carried by the command and dropped at the event boundary. Asserting on the command alone would have
		// proved the surface WROTE a disclosure, not that anyone can READ one — the distinction this whole
		// phase is about. Both are asserted below, and they are asserted separately on purpose.
		const p = plan(PWU);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);

		// (a) the COMMAND carries it in its proper §20 home…
		const written = p.steps
			.filter(([type]) => type === 'CompleteAssuranceAssessment')
			.map(([, , , payload]) => (payload as { validatorResult: { limitations: string[] } }).validatorResult);
		expect(written).toHaveLength(2);
		for (const v of written) expect(v.limitations).toContain(DEMO_REVIEW_LIMITATION);

		// (b) …and the EVENT, which is the durable record, carries it where the ratified payload has room.
		const recorded = host
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentCompleted')
			.map((e) => (e.payload as { residualUncertainty?: string[] }).residualUncertainty ?? []);
		expect(recorded).toHaveLength(2);
		for (const r of recorded) expect(r).toContain(DEMO_REVIEW_LIMITATION);
	});

	// ── `C-3` — the control that says the reviewer is distinct in the dimension that is TESTED ────────────────
	it('⛔ CONTROL — a reviewer differing only in displayName is REFUSED by DIFFERENT_AGENT', () => {
		// ⚠ WITHOUT THIS, `PR-2` PASSES FOR A GUARD THAT NEVER RAN. The independence check is skipped whenever
		// either operand is absent, so "the assessments reached SATISFIED" is equally consistent with a check
		// that decided nothing. This arrangement differs from the passing one in ONE field and must fail.
		const impostor = { ...actingActor(operator), displayName: 'Independent Assurance Reviewer' };
		const p = plan(PWU, { evaluator: impostor });
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);

		// ⛔ THE BATCH IS *ACCEPTED*, AND THAT IS THE WHOLE TRAP THIS CONTROL CAUGHT. My first version asserted
		// `batch.ok === false` and was red: a self-review is not a malformed request, it is a fact to be minuted,
		// so the handler takes the ratified §30 `ASSESSING -> INDEPENDENCE_VIOLATION` arrow and ACCEPTS the
		// command. Any caller reading only `ok` would report a review that succeeded. `unsatisfyingReviews` exists
		// because of this line.
		expect(batch.ok, 'a violation is recorded, not refused — the command is accepted').toBe(true);
		expect(
			host.readAllEvents().some((e) => e.eventType === 'AssuranceIndependenceViolated'),
			'the outcome must be the INDEPENDENCE one, not some other non-satisfaction'
		).toBe(true);
		for (const asmId of p.assessmentIds)
			expect(stateOf(asmId)?.assessmentState, 'INV-8 forbids this state from ever being SATISFIED').toBe(
				'INDEPENDENCE_VIOLATION'
			);
		// ⛔ AND THE PRE-DISPATCH CHECK CANNOT SEE THIS ONE, WHICH IS WHY `R23` EXISTS. An independence violation
		// is not knowable from the policy objects — only from dispatching — so `unsatisfyingReviews` reports
		// nothing here. What holds the line instead is the ATOMIC envelope: these assessments never reach a
		// satisfying disposition, `RPH-PWU-007` refuses the controller's hop, and the whole transaction — both
		// parties' commands — unwinds together.
		expect(unsatisfyingReviews(p), 'the evidence is fine; the PARTIES are not').toEqual([]);
	});

	// ── `C-1` — the else-branch this phase deliberately does not touch ───────────────────────────────────────
	it('⭑ CONTROL — a PWU declaring NOTHING produces an EMPTY plan, and the demo path is left alone', () => {
		// ⛔ A PWU MAY LAWFULLY DECLARE NO POLICY (`undertakings/[id]` proposes ad-hoc ones with `[]`), and
		// `RPH-PWU-007` has no opinion about those. Failing loud here would invent a requirement that every PWU
		// declare something — a different rule with a different argument, smuggled in under this one.
		const p = plan(PWU_BARE);
		expect(p.policyIds).toEqual([]);
		expect(p.assessmentIds).toEqual([]);
		expect(p.steps).toEqual([]);
	});

	// ── `C-2` — determination is doing the selecting, not a declaration read straight through ────────────────
	it('⛔ CONTROL — a DECLARED policy that does not currently govern is EXCLUDED, with its reason reported', () => {
		// ⚠ THE DISTINCTION THIS CONTROL BUYS: `declared` and `selected` are different sets, and a plan built
		// from `declared` would demand a verdict from a policy that cannot lawfully give one — the over-refusal
		// `R19` was ruled asymmetric to avoid. The exclusion is RETURNED rather than dropped because *"a
		// governance decision nobody can read is the shape half this register is about"*.
		// ⚠ DECLARED WHILE ACTIVE, SUSPENDED AFTERWARDS — AND THE ORDER IS FORCED, NOT COSMETIC. `DefinePwuType`
		// refuses to NEWLY reference a non-ACTIVE policy (*"only ACTIVE policies may be newly referenced"*), so
		// the arrangement this control needs — a policy legitimately declared and later withdrawn from service —
		// is the only way it arises in production too.
		policy(POL_SUSPENDED, 'Suspended', 'NONE');
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS190';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1A0';
		definePwuType(typeId, [POL_AGENT, POL_SUSPENDED]);
		proposePwu(pwuId, typeId);
		ok(
			send(operator, 'SuspendAssurancePolicy', 'ASSURANCE_POLICY', POL_SUSPENDED, {
				policyId: POL_SUSPENDED
			}),
			'SuspendAssurancePolicy'
		);

		const p = plan(pwuId);
		expect(p.policyIds, 'only the governing policy is assessed').toEqual([POL_AGENT]);
		expect(p.excluded.map((e) => e.policyId)).toEqual([POL_SUSPENDED]);
		expect(p.excluded[0]?.reason, 'the reason must say WHY, not merely that').toContain('NOT_ACTIVE');
	});

	// ── ⭐⭐ THE VERDICT IS WHAT THE EVIDENCE SUPPORTS ──────────────────────────────────────────────
	//
	// ⛔ FOUND BY THE BROWSER, NOT BY DESIGN, AND THE DESIGN WAS WRONG UNTIL IT WAS. This phase's design asserted
	// that the declared policies carry `requiredEvidence: []` — true of the FOUR that `ARCHITECTURE_DEFINITION`
	// declares, and false of the ontology: `pol_intent_fidelity` declares 7 and `pol_intent_completeness` 6, so
	// four of fifteen PWU kinds have 13 requirements this workbench cannot evidence. Generalising from the one
	// kind I had measured is the defect these tests now close.
	const EV = (id: string, requiredForDispositions: string) => ({
		id,
		evidenceType: 'ARTIFACT',
		description: `evidence ${id}`,
		purpose: 'Substantiate the declared aspect.',
		cardinality: 'EXACTLY_ONE',
		admissibilityRules: [],
		requiredForDispositions,
		mayBeWaived: false
	});

	it('⭐ a policy whose SATISFIED-gated evidence is absent gets CONDITIONALLY_SATISFIED, not SATISFIED', () => {
		// Gate A would REFUSE the stronger verdict anyway; asking for it and being refused, or reaching the
		// honest one first, *"differ only in whether the drive tells the truth first"* (`earnAssurance`).
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1B0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1C0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1D0';
		policy(pol, 'Needs evidence to be SATISFIED', 'DIFFERENT_AGENT', [EV('EV-01', 'SATISFIED_ONLY')]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		const p = plan(pwuId);
		expect(p.dispositions).toEqual(['CONDITIONALLY_SATISFIED']);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState).toBe('CONDITIONALLY_SATISFIED');
		// ⭑ AND IT IS A SATISFYING OUTCOME — the PWU may record it; what it may NOT do is claim SATISFIED over it.
		expect(unsatisfyingReviews(p)).toEqual([]);
		expect(p.foldedAssuranceState).toBe('CONDITIONALLY_SATISFIED');
	});

	it('⛔ a policy whose evidence gates EVERY disposition gets INCONCLUSIVE, and the PWU is stopped', () => {
		// ⚠ DERIVED, NOT OBSERVED. No policy in today's catalog declares an `ALL` requirement, so a two-valued
		// rule (SATISFIED / CONDITIONALLY_SATISFIED) would pass every test in this repository and be wrong the
		// first time one is authored. `requiredForDispositions` has three values and the rule reads all three.
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1E0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1F0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1G0';
		policy(pol, 'Needs evidence for anything positive', 'DIFFERENT_AGENT', [EV('EV-01', 'ALL')]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		const p = plan(pwuId);
		expect(p.dispositions).toEqual(['INCONCLUSIVE']);

		// ⛔ AND THE REVIEW CANNOT EVEN BEGIN — measured, not predicted. An `ALL` requirement gates the §30
		// `EVIDENCE_PENDING -> READY` arrow itself, so `RequestAssuranceAssessment` lands the assessment in
		// EVIDENCE_PENDING and `BeginAssuranceAssessment` is correctly REFUSED. My first version of this test
		// asserted the batch was ACCEPTED and an INCONCLUSIVE verdict recorded; it was red, and the red was
		// right. A policy whose evidence gates everything stops the review one arrow earlier than the verdict.
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);
		expect(batch.ok, 'an assessment stuck in EVIDENCE_PENDING cannot be begun').toBe(false);
		// ⭐ AND THE SURFACE NEVER REACHES THAT DISPATCH, because the check is PRE-DISPATCH: the disposition this
		// policy can reach is computable from the policy object alone, so the refusal happens with the store
		// untouched — which is what `SPEC-001-INV-14` deserves rather than a rollback after the fact.
		expect(unsatisfyingReviews(p)).toEqual([{ policyId: pol, disposition: 'INCONCLUSIVE' }]);
	});

	it('⭑ CONTROL — a ZERO_OR_MORE requirement gates NOTHING, so the verdict stays SATISFIED', () => {
		// ⛔ GATE A EXEMPTS IT (`demandsAnInstance`), AND REPRODUCING THE EXEMPTION IS LOAD-BEARING. Without it
		// the demo's own sign-off policy — whose single requirement is `ZERO_OR_MORE` — would read as unmet and
		// silently downgrade every verdict Gate A would have admitted. A downgrade nobody asked for is as wrong
		// as an upgrade nobody earned.
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1H0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1P0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1J0';
		policy(pol, 'Optional evidence only', 'DIFFERENT_AGENT', [
			{ ...EV('EV-01', 'SATISFIED_ONLY'), cardinality: 'ZERO_OR_MORE' }
		]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		expect(plan(pwuId).dispositions).toEqual(['SATISFIED']);
	});

	it('⭐ the PWU\u2019s axis is the STRICTEST verdict across its declared policies, never the friendliest', () => {
		// §28.2's ladder, and the one assertion that separates a fold from a first-wins read: the SATISFIED
		// policy is declared FIRST, so a plan returning `dispositions[0]` would answer SATISFIED here.
		const polOk = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1K0';
		const polShort = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1Q0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1M0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1N0';
		policy(polOk, 'Fully evidenced', 'DIFFERENT_AGENT');
		policy(polShort, 'Short of evidence', 'DIFFERENT_AGENT', [EV('EV-01', 'SATISFIED_ONLY')]);
		definePwuType(typeId, [polOk, polShort]);
		proposePwu(pwuId, typeId);

		const p = plan(pwuId);
		expect(p.dispositions, 'each policy is judged on its own evidence').toEqual([
			'SATISFIED',
			'CONDITIONALLY_SATISFIED'
		]);
		expect(p.foldedAssuranceState, 'the axis is the weakest verdict, not the first one').toBe(
			'CONDITIONALLY_SATISFIED'
		);
	});
});
