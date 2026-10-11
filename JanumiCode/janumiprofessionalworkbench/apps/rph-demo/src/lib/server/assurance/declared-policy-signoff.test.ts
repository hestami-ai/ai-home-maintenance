// ⭐⭐ THE SIGN-OFF ASSESSES WHAT THE PWU DECLARES, AND A SECOND PARTY PERFORMS IT — `JAN-EXEC` Phase 6b / `R22`.
//
// ⛔ EVERY ASSERTION HERE WAS RED AT HEAD, AND THE ROADMAP NAMED WHICH BEFORE ANY OF IT WAS WRITTEN (§8b.3).
// The surface assessed ONE policy the PWU does not declare, with `producer: evaluator` — one identity wearing
// both hats — under a policy chosen because its `independenceRequirement: NONE` means the check is skipped.
//
// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3); `REG-D-111`; `DESIGN-phase-7-completion.md` B1–B3, B6)
// — AND NOW EACH DECLARED POLICY IS JUDGED, CRITERION BY CRITERION: the plan takes each policy's REVIEW, as its reviewer
// answered it (`DeclaredPolicyAnswer`), records one criterion result per criterion, each failed criterion as an open
// finding, and computes the verdict from them (`dispositionFromFindings`). The reviewer here is a validator DOUBLE — a
// hand-written answer is legitimate in a unit arrangement (`REG-D-071` Q2 (b), (c)); the gate lane's stand-in and the
// model reviewer each have their own file. ⛔ PREDICTED RED, observed against HEAD's sign-off before it was rewritten: a
// review answering a BLOCKING criterion NOT_MET gave its policy SATISFIED (`supportedDisposition`'s one SATISFIED return),
// and no criterion result was recorded (0).
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
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { FloorCriterion, Identity } from '@janumipwb/rph-assurance';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	ASSURANCE_REVIEWER_CREDENTIAL,
	SESSION_CREDENTIAL,
	actingActor,
	standaloneAuthenticator
} from '../identity.js';
import {
	evidenceRefusals,
	foldAfterRerun,
	governingDeclaredPolicies,
	noCriterionDeclared,
	planDeclaredSignoff,
	unsatisfyingReviews,
	type DeclaredSignoff
} from './declared-policy-signoff.js';
import type { DeclaredPolicyAnswer } from './declared-policy-review.js';

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

/** ⭐ E2 — the reviewer the double reports, as a model reviewer reports itself: an AGENT, its model and provider. */
const REVIEWER_MODEL: Identity = {
	actorType: 'AGENT',
	agentId: 'devin',
	modelId: 'qualified-reviewer-model',
	providerId: 'devin'
};
/** ⭐ E2 (`REG-F-514`) — the producer as the record holds it for a model unit: the model, its attempt as its invocation. */
const EXECUTOR: ActorReference = {
	actorId: 'model:producer-model',
	actorType: 'AGENT',
	displayName: 'Execution model',
	executionInstanceId: 'attempt_01ARZ3NDEKTSV4RRFFQ69GSX01'
};

/** One criterion of a test policy: its id and the stakes the policy declares if it is not met. */
type Stakes = 'BLOCKING' | 'MATERIAL' | 'ADVISORY' | 'CRITICAL';
const criterion = (id: string, severityIfNotMet: Stakes) => ({
	id,
	name: id,
	description: `The declared aspect ${id} is met.`,
	criterionType: 'QUALITATIVE',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet,
	mayBeNotApplicable: false
});
/** The default rubric: three criteria, two of them mandatory — so "one row per criterion" is three rows, not one. */
const RUBRIC = [criterion('C1', 'BLOCKING'), criterion('C2', 'MATERIAL'), criterion('C3', 'BLOCKING')];

/**
 * ⭐ E2 — A REVIEW AS A REVIEWER ANSWERED IT: one row per criterion of `rubric`, MET unless `answers` says otherwise, each
 * failed row an open finding at the POLICY's stakes — the shape `reasoningReviewResultFromJudgement` gives the model
 * reviewer's answer. A validator double's answer (`REG-D-071` Q2 (c)).
 */
function answered(
	policyId: string,
	answers: Readonly<Record<string, 'MET' | 'NOT_MET' | 'UNABLE_TO_DETERMINE' | 'STIPULATED'>> = {},
	over: Partial<DeclaredPolicyAnswer> = {},
	rubric: readonly ReturnType<typeof criterion>[] = RUBRIC
): DeclaredPolicyAnswer {
	const rows: FloorCriterion[] = rubric.map((c) => {
		const a = answers[c.id] ?? 'MET';
		const mandatory = c.severityIfNotMet === 'BLOCKING' || c.severityIfNotMet === 'CRITICAL';
		if (a === 'STIPULATED')
			return { criterionId: c.id, mandatory, outcome: 'UNABLE_TO_DETERMINE', stipulated: 'MET', rationale: 'stipulated' };
		return { criterionId: c.id, mandatory, outcome: a, rationale: `${c.id} answered ${a}` };
	});
	return {
		policyId,
		validatorId: 'reviewer.declared-policy',
		evaluator: REVIEWER_MODEL,
		criteria: rows,
		observations: rubric
			.filter((c) => answers[c.id] === 'NOT_MET')
			.map((c) => ({ code: c.id, severity: c.severityIfNotMet, statement: `${c.id} is not met.`, open: true })),
		recommendation: 'SATISFIED',
		residualUncertainty: [],
		limitations: [],
		...over
	};
}

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
	 * ⭐ E2 — AND THE CRITERIA, for the same reason: a criterion's stakes decide what an unmet answer costs.
	 */
	function policy(
		policyId: string,
		name: string,
		independence: string,
		requiredEvidence: readonly Record<string, unknown>[] = [],
		activate = true,
		criteria: readonly ReturnType<typeof criterion>[] = RUBRIC
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
				criteria: criteria.map((c) => ({ ...c })),
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

	/** ⭐ E2 — each governing policy of `pwuId` answered clean, unless `answers` names it. */
	const cleanAnswers = (pwuId: string, answers: Readonly<Record<string, DeclaredPolicyAnswer>> = {}) =>
		new Map(
			governingDeclaredPolicies(host, pwuId).policies.map((p) => [p.policyId, answers[p.policyId] ?? answered(p.policyId)])
		);

	const plan = (pwuId: string, overrides: Record<string, unknown> = {}) =>
		planDeclaredSignoff({
			engine: host,
			pwuId,
			subjectSemanticVersion: host.loadObject(pwuId)?.semanticVersion ?? 1,
			operator: actingActor(operator),
			producer: EXECUTOR,
			// ⚠ Built only when the test hands none: the two predicted reds hand theirs, so they reach the plan at HEAD.
			...('answers' in overrides ? {} : { answers: cleanAnswers(pwuId) }),
			// ⭐ E2 — each review's invocation, by policy: the token its calls would be recorded under.
			invocations: { get: (policyId: string) => `declared-review:${policyId}` } as unknown as ReadonlyMap<string, string>,
			admitStipulatedAnswers: host.admitStipulatedAnswers,
			mintId,
			...overrides
		} as Parameters<typeof planDeclaredSignoff>[0]);

	/** Issue the review EXACTLY as the route does — the reviewer's commands under the REVIEWER's own session, and a HUMAN
	 *  decision's under the operator's. */
	const runReview = (steps: readonly [string, string, string, unknown][], as: AuthedEngineHandle = reviewer) =>
		as.dispatchBatch(
			steps.map(([commandType, aggType, aggId, payload]) =>
				command(commandType, aggType, aggId, payload)
			)
		);

	const stateOf = (id: string) =>
		host.loadObject(id)?.state as
			| {
					assessmentState?: string;
					assurancePolicyId?: string;
					evaluator?: { actorId?: string; actorType?: string; modelId?: string; executionInstanceId?: string };
					producer?: { actorId?: string; executionInstanceId?: string };
					updatedBy?: { actorId?: string };
			  }
			| undefined;

	/** ⭐ E2 — the criterion results recorded against `assessmentId`, as the engine's events hold them. */
	const resultsOf = (assessmentId: string) =>
		host
			.readAllEvents()
			.filter(
				(e) =>
					e.eventType === 'AssuranceCriterionEvaluated' &&
					(e.payload as { assessmentId?: string }).assessmentId === assessmentId
			)
			.map((e) => e.payload as { criterionId: string; result: string; rationale?: string; stipulated?: string });

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

	// ── ⭐⭐ E2 — THE VERDICT IS COMPUTED FROM THE ANSWERS (`REG-F-523`; `REG-D-110` (3); design B2) ──────────────────────────
	it('⭐⭐ E2 — a review answering a BLOCKING criterion NOT_MET gives that policy REJECTED, recorded with its blocking finding', () => {
		// ⛔ THE PREDICTED RED (design B2), observed at HEAD: `SATISFIED`, from `supportedDisposition`'s one SATISFIED return
		// — the verdict read the policy's required evidence and nothing the reviewer said.
		const p = plan(PWU, {
			answers: new Map([
				[POL_AGENT, answered(POL_AGENT, { C3: 'NOT_MET' })],
				[POL_INVOC, answered(POL_INVOC)]
			])
		});
		expect(p.dispositions, 'the policy whose BLOCKING criterion is unmet').toEqual(['REJECTED', 'SATISFIED']);
		expect(p.foldedAssuranceState, 'the axis is the strictest verdict').toBe('REJECTED');
		expect(p.blockingObservationIds, 'canon’s route: a blocking finding (REG-D-111 (1))').toHaveLength(1);
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);
		expect(batch.ok, `the review was refused: ${JSON.stringify(batch.results.at(-1)?.error)}`).toBe(true);
		// ⭐ RECORDED, NOT REFUSED (design B3): a paid review's verdict against the work is the record PER-9 wants.
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState).toBe('REJECTED');
		expect(stateOf(p.assessmentIds[1]!)?.assessmentState).toBe('SATISFIED');
		const finding = host.loadObject(p.blockingObservationIds[0]!)?.state as { severity?: string; findingCode?: string; subjectObjectIds?: string[] };
		expect([finding.severity, finding.findingCode, finding.subjectObjectIds]).toEqual(['BLOCKING', 'C3', [PWU]]);
		expect(unsatisfyingReviews(p)).toEqual([{ policyId: POL_AGENT, disposition: 'REJECTED' }]);
	});

	it('⭐⭐ E2 — ONE RecordCriterionResult PER CRITERION of each policy, each the reviewer’s answer', () => {
		// ⛔ THE PREDICTED RED (design B2), observed at HEAD: 0 — the sign-off recorded no criterion result at all.
		const p = plan(PWU, {
			answers: new Map([
				[POL_AGENT, answered(POL_AGENT, { C2: 'NOT_MET', C3: 'UNABLE_TO_DETERMINE' })],
				[POL_INVOC, answered(POL_INVOC)]
			])
		});
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(
			host.readAllEvents().filter((e) => e.eventType === 'AssuranceCriterionEvaluated'),
			'one criterion result per criterion: three for each of two policies'
		).toHaveLength(6);
		expect(p.criterionResults).toBe(6);
		expect(resultsOf(p.assessmentIds[0]!).map((r) => [r.criterionId, r.result])).toEqual([
			['C1', 'MET'],
			['C2', 'NOT_MET'],
			['C3', 'UNABLE_TO_DETERMINE']
		]);
		expect(resultsOf(p.assessmentIds[1]!).map((r) => r.result)).toEqual(['MET', 'MET', 'MET']);
		// ⭐ A mandatory criterion left undetermined is no pass (ASR-9): INCONCLUSIVE, whatever the reviewer recommended.
		expect(p.dispositions).toEqual(['INCONCLUSIVE', 'SATISFIED']);
	});

	it('⭐ E2 — a MATERIAL criterion unmet gives CONDITIONALLY_SATISFIED: the policy’s stakes, not the reviewer’s', () => {
		const p = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: answered(POL_AGENT, { C2: 'NOT_MET' }) }) });
		expect(p.dispositions).toEqual(['CONDITIONALLY_SATISFIED', 'SATISFIED']);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState).toBe('CONDITIONALLY_SATISFIED');
		expect(p.blockingObservationIds, 'a MATERIAL finding is no blocking finding').toEqual([]);
	});

	it('⛔ E2 — the verdict follows the ANSWERS, never the reviewer’s recommendation, in either direction', () => {
		const lenient = answered(POL_AGENT, { C1: 'NOT_MET' }, { recommendation: 'SATISFIED' });
		const harsh = answered(POL_INVOC, {}, { recommendation: 'REJECTED' });
		const p = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: lenient, [POL_INVOC]: harsh }) });
		expect(p.dispositions).toEqual(['REJECTED', 'SATISFIED']);
		// ⭑ And the recommendation is not lost: the record says what was recommended, beside the verdict computed.
		const complete = p.steps.find(([t, , id]) => t === 'CompleteAssuranceAssessment' && id === p.assessmentIds[1])!;
		expect((complete[3] as { validatorResult: { residualUncertainty: string[] } }).validatorResult.residualUncertainty).toContain(
			'The reviewer recommended REJECTED; the verdict, SATISFIED, is computed from its criterion answers (REG-D-110 (3)).'
		);
	});

	it('⛔ E2 — a review that FAILED is INCONCLUSIVE: every criterion recorded undetermined, and the failure a finding', () => {
		const failed = answered(POL_AGENT, {}, { criteria: [], observations: [], failure: 'The reviewing tool’s call failed.' });
		const p = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: failed }) });
		expect(p.dispositions).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(resultsOf(p.assessmentIds[0]!).map((r) => r.result)).toEqual(['UNABLE_TO_DETERMINE', 'UNABLE_TO_DETERMINE', 'UNABLE_TO_DETERMINE']);
		const findings = p.steps.filter(([t]) => t === 'RecordAssuranceObservation').map(([, , , pl]) => pl as { findingCode: string; statement: string });
		expect(findings.map((f) => [f.findingCode, f.statement])).toEqual([['VALIDATOR_EXECUTION_FAILED', 'The reviewing tool’s call failed.']]);
		// ⛔ AND IT IS NEVER REPORTED AS A CONCLUDED REVIEW (`P6b-f`'s guard): the route tells the operator so.
		expect(unsatisfyingReviews(p)).toEqual([{ policyId: POL_AGENT, disposition: 'INCONCLUSIVE' }]);
	});

	it('⛔ E2 — a governing policy NOBODY reviewed is INCONCLUSIVE, never a pass', () => {
		const p = plan(PWU, { answers: new Map([[POL_INVOC, answered(POL_INVOC)]]) });
		expect(p.dispositions).toEqual(['INCONCLUSIVE', 'SATISFIED']);
	});

	it('⛔ E12F F6 — a governing policy that declares NO criterion is INCONCLUSIVE, and the record says why: nothing was checked, whatever the reviewer recommended', () => {
		// ⛔ PREDICTED RED, read from the code: SATISFIED — `dispositionFromFindings` over no row and no finding passes, so a
		// policy with an empty rubric was signed off with nothing checked, `REG-F-523`'s shape one policy down.
		const POL_EMPTY = 'pol_01ARZ3NDEKTSV4RRFFQ69GS190';
		const TYPE_EMPTY = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1A0';
		const PWU_EMPTY = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1B0';
		policy(POL_EMPTY, 'No criteria', 'DIFFERENT_AGENT', [], true, []);
		definePwuType(TYPE_EMPTY, [POL_EMPTY]);
		proposePwu(PWU_EMPTY, TYPE_EMPTY);
		const p = plan(PWU_EMPTY, { answers: new Map([[POL_EMPTY, answered(POL_EMPTY, {}, {}, [])]]) });
		expect(p.dispositions, 'a policy with no criterion checks nothing').toEqual(['INCONCLUSIVE']);
		expect(p.criterionResults).toBe(0);
		const complete = p.steps.find(([t]) => t === 'CompleteAssuranceAssessment')!;
		expect((complete[3] as { validatorResult: { residualUncertainty: string[] } }).validatorResult.residualUncertainty).toContain(
			noCriterionDeclared(POL_EMPTY)
		);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState).toBe('INCONCLUSIVE');
		expect(unsatisfyingReviews(p)).toEqual([{ policyId: POL_EMPTY, disposition: 'INCONCLUSIVE' }]);
	});

	it('⭐ E2 — a stipulated row counts as met in an engine built to admit it, and only there (REG-D-071 Q5 (a))', () => {
		const stipulatedAll = answered(POL_AGENT, { C1: 'STIPULATED', C2: 'STIPULATED', C3: 'STIPULATED' });
		const admitting = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: stipulatedAll }), admitStipulatedAnswers: true });
		expect(admitting.dispositions).toEqual(['SATISFIED', 'SATISFIED']);
		const refusing = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: stipulatedAll }), admitStipulatedAnswers: false });
		expect(refusing.dispositions, 'an engine not built for tests: nobody judged them').toEqual(['INCONCLUSIVE', 'SATISFIED']);
		// ⭑ The stipulation rides BESIDE the result, never in it (form D).
		const rows = refusing.steps.filter(([t, , id]) => t === 'RecordCriterionResult' && id === refusing.assessmentIds[0]);
		expect(rows.map(([, , , pl]) => pl)).toEqual(
			['C1', 'C2', 'C3'].map((criterionId) => ({ criterionId, result: 'UNABLE_TO_DETERMINE', rationale: 'stipulated', stipulated: 'MET' }))
		);
	});

	// ── `PR-2` + `PR-3`, DRIVEN LIVE ─────────────────────────────────────────────────────────────────────────
	it('⭐⭐ the review is ISSUED BY the reviewer session, and BOTH declared independence demands are SATISFIED', () => {
		// ⛔ RED AT HEAD in two independent ways: the assessments did not exist, and the one that did was
		// completed with `producer: evaluator`. `DIFFERENT_AGENT` compares `actorId`; `DIFFERENT_INVOCATION`
		// compares `executionInstanceId` and FAILS CLOSED unless BOTH parties carry one.
		// ⭐ E2: the evaluator recorded is WHO JUDGED — the reviewer's identity, the review's invocation beside it — and the
		// producer is WHO DID THE WORK (`REG-F-514`): so `DIFFERENT_INVOCATION` is decided between the producer's attempt and
		// the review's invocation.
		const p = plan(PWU);
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);
		expect(batch.ok, `the independent review was refused: ${JSON.stringify(batch.results.at(-1)?.error)}`).toBe(
			true
		);
		for (const [i, asmId] of p.assessmentIds.entries()) {
			const s = stateOf(asmId);
			// ⚠ SATISFIED, and specifically NOT `INDEPENDENCE_VIOLATION` — the §30 arrow a self-review takes.
			expect(s?.assessmentState, `${asmId} did not reach SATISFIED`).toBe('SATISFIED');
			expect([s?.evaluator?.actorId, s?.evaluator?.actorType, s?.evaluator?.modelId, s?.evaluator?.executionInstanceId]).toEqual([
				'devin',
				'AGENT',
				'qualified-reviewer-model',
				`declared-review:${p.policyIds[i]}`
			]);
			// ⭐ `REG-F-514` — the producer is the executor the record holds, its attempt beside it: never the operator.
			expect([s?.producer?.actorId, s?.producer?.executionInstanceId]).toEqual([EXECUTOR.actorId, EXECUTOR.executionInstanceId]);
			// `PR-3` — THE ISSUER IS THE REVIEWER'S SESSION (`R22`): the operator's session issues none of these.
			expect(s?.updatedBy?.actorId, 'the STAMPED issuer of the completion').toBe('assurance-reviewer-1');
		}
		expect(p.humanSteps, 'no policy here demands a HUMAN').toEqual([]);
	});

	it('⭐ E2 (REG-D-111 (3)) — a policy demanding a HUMAN is the OPERATOR’s decision, each criterion result citing the reviewer', () => {
		const POL_HUMAN = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1R0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1S0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1T0';
		policy(POL_HUMAN, 'Fitness, judged by a person', 'HUMAN');
		definePwuType(typeId, [POL_HUMAN]);
		proposePwu(pwuId, typeId);
		const p = plan(pwuId, { answers: new Map([[POL_HUMAN, answered(POL_HUMAN, { C2: 'NOT_MET' })]]) });
		expect(p.steps, 'the reviewer session issues none of it').toEqual([]);
		const batch = runReview(p.humanSteps as readonly [string, string, string, unknown][], operator);
		expect(batch.ok, JSON.stringify(batch.results.at(-1)?.error)).toBe(true);
		const s = stateOf(p.assessmentIds[0]!);
		expect([s?.assessmentState, s?.evaluator?.actorId, s?.evaluator?.actorType, s?.updatedBy?.actorId]).toEqual([
			'CONDITIONALLY_SATISFIED',
			'local-professional',
			'HUMAN',
			'local-professional'
		]);
		expect(resultsOf(p.assessmentIds[0]!).map((r) => r.rationale)).toEqual([
			'The reviewer devin (qualified-reviewer-model) answered MET: C1 answered MET',
			'The reviewer devin (qualified-reviewer-model) answered NOT_MET: C2 answered NOT_MET',
			'The reviewer devin (qualified-reviewer-model) answered MET: C3 answered MET'
		]);
	});

	// ── `C-3` — the control that says the reviewer is distinct in the dimension that is TESTED ────────────────
	it('⛔ CONTROL — a reviewer that IS the producer, by agent id, is REFUSED by DIFFERENT_AGENT', () => {
		// ⚠ WITHOUT THIS, `PR-2` PASSES FOR A GUARD THAT NEVER RAN. The independence check is skipped whenever
		// either operand is absent, so "the assessments reached SATISFIED" is equally consistent with a check
		// that decided nothing. This arrangement differs from the passing one in ONE field and must fail.
		const self: Identity = { ...REVIEWER_MODEL, agentId: EXECUTOR.actorId };
		const p = plan(PWU, {
			answers: cleanAnswers(PWU, {
				[POL_AGENT]: answered(POL_AGENT, {}, { evaluator: self }),
				[POL_INVOC]: answered(POL_INVOC, {}, { evaluator: self })
			})
		});
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);

		// ⛔ THE BATCH IS *ACCEPTED*, AND THAT IS THE WHOLE TRAP THIS CONTROL CAUGHT. A self-review is not a malformed
		// request, it is a fact to be minuted, so the handler takes the ratified §30 `ASSESSING -> INDEPENDENCE_VIOLATION`
		// arrow and ACCEPTS the command. Any caller reading only `ok` would report a review that succeeded.
		expect(batch.ok, 'a violation is recorded, not refused — the command is accepted').toBe(true);
		expect(
			host.readAllEvents().some((e) => e.eventType === 'AssuranceIndependenceViolated'),
			'the outcome must be the INDEPENDENCE one, not some other non-satisfaction'
		).toBe(true);
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState, 'INV-8 forbids this state from ever being SATISFIED').toBe(
			'INDEPENDENCE_VIOLATION'
		);
		// ⛔ AND THE PLAN CANNOT SEE THIS ONE: an independence violation is knowable only by dispatching, so
		// `unsatisfyingReviews` reports nothing here. The ATOMIC envelope holds the line in the route (`R23`).
		expect(unsatisfyingReviews(p), 'the answers are fine; the PARTIES are not').toEqual([]);
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
		expect(p.humanSteps).toEqual([]);
		expect(p.foldedAssuranceState).toBeUndefined();
	});

	// ── `C-2` — determination is doing the selecting, not a declaration read straight through ────────────────
	it('⛔ CONTROL — a DECLARED policy that does not currently govern is EXCLUDED, with its reason reported', () => {
		// ⚠ THE DISTINCTION THIS CONTROL BUYS: `declared` and `selected` are different sets, and a plan built
		// from `declared` would demand a verdict from a policy that cannot lawfully give one — the over-refusal
		// `R19` was ruled asymmetric to avoid. ⚠ DECLARED WHILE ACTIVE, SUSPENDED AFTERWARDS — `DefinePwuType` refuses
		// to NEWLY reference a non-ACTIVE policy, so this is the only way the arrangement arises in production too.
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

	// ── ⭐⭐ THE VERDICT IS NEVER PAST WHAT THE EVIDENCE SUPPORTS (the ceiling, since E2) ─────────────────────────────
	//
	// ⛔ FOUND BY THE BROWSER, NOT BY DESIGN: `pol_intent_fidelity` declares 7 required-evidence items and
	// `pol_intent_completeness` 6, so four of fifteen PWU kinds have 13 requirements this workbench cannot evidence.
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

	it('⭐ a policy whose SATISFIED-gated evidence is absent gets CONDITIONALLY_SATISFIED over clean answers, not SATISFIED', () => {
		// Gate A would REFUSE the stronger verdict anyway; asking for it and being refused, or reaching the
		// honest one first, *"differ only in whether the drive tells the truth first"* (`earnAssurance`).
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1B0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1C0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1D0';
		policy(pol, 'Needs evidence to be SATISFIED', 'DIFFERENT_AGENT', [EV('EV-01', 'SATISFIED_ONLY')]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		const p = plan(pwuId, { answers: cleanAnswers(pwuId) });
		expect(p.dispositions).toEqual(['CONDITIONALLY_SATISFIED']);
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		expect(stateOf(p.assessmentIds[0]!)?.assessmentState).toBe('CONDITIONALLY_SATISFIED');
		// ⭑ AND IT IS A SATISFYING OUTCOME — the PWU may record it; what it may NOT do is claim SATISFIED over it.
		expect(unsatisfyingReviews(p)).toEqual([]);
		expect(p.foldedAssuranceState).toBe('CONDITIONALLY_SATISFIED');
	});

	it('⛔ a policy whose evidence gates EVERY disposition is refused BEFORE any review is asked for', () => {
		// ⚠ DERIVED, NOT OBSERVED. No policy in today's catalog declares an `ALL` requirement, so a two-valued
		// rule (SATISFIED / CONDITIONALLY_SATISFIED) would pass every test in this repository and be wrong the
		// first time one is authored. `requiredForDispositions` has three values and the rule reads all three.
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1E0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1F0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1G0';
		policy(pol, 'Needs evidence for anything positive', 'DIFFERENT_AGENT', [EV('EV-01', 'ALL')]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		// ⭐ E2 — ANSWERED FROM THE POLICY OBJECTS ALONE, before a review would be paid for (`evidenceRefusals`).
		expect(evidenceRefusals(governingDeclaredPolicies(host, pwuId).policies)).toEqual([
			{ policyId: pol, disposition: 'INCONCLUSIVE' }
		]);
		const p = plan(pwuId, { answers: cleanAnswers(pwuId) });
		expect(p.dispositions, 'clean answers do not lift the ceiling').toEqual(['INCONCLUSIVE']);
		// ⛔ AND THE REVIEW CANNOT EVEN BEGIN — measured, not predicted: an `ALL` requirement gates the §30
		// `EVIDENCE_PENDING -> READY` arrow itself, so `BeginAssuranceAssessment` is correctly REFUSED.
		const batch = runReview(p.steps as readonly [string, string, string, unknown][]);
		expect(batch.ok, 'an assessment stuck in EVIDENCE_PENDING cannot be begun').toBe(false);
	});

	it('⭑ CONTROL — a ZERO_OR_MORE requirement gates NOTHING, so the verdict stays SATISFIED', () => {
		// ⛔ GATE A EXEMPTS IT (`demandsAnInstance`), AND REPRODUCING THE EXEMPTION IS LOAD-BEARING. Without it
		// the demo's own sign-off policy — whose single requirement is `ZERO_OR_MORE` — would read as unmet and
		// silently downgrade every verdict Gate A would have admitted.
		const pol = 'pol_01ARZ3NDEKTSV4RRFFQ69GS1H0';
		const typeId = 'pwt_01ARZ3NDEKTSV4RRFFQ69GS1P0';
		const pwuId = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS1J0';
		policy(pol, 'Optional evidence only', 'DIFFERENT_AGENT', [
			{ ...EV('EV-01', 'SATISFIED_ONLY'), cardinality: 'ZERO_OR_MORE' }
		]);
		definePwuType(typeId, [pol]);
		proposePwu(pwuId, typeId);

		expect(plan(pwuId, { answers: cleanAnswers(pwuId) }).dispositions).toEqual(['SATISFIED']);
	});

	it('⭐ the PWU’s axis is the STRICTEST verdict across its declared policies, never the friendliest', () => {
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

		const p = plan(pwuId, { answers: cleanAnswers(pwuId) });
		expect(p.dispositions, 'each policy is judged on its own evidence').toEqual([
			'SATISFIED',
			'CONDITIONALLY_SATISFIED'
		]);
		expect(p.foldedAssuranceState, 'the axis is the weakest verdict, not the first one').toBe(
			'CONDITIONALLY_SATISFIED'
		);
	});

	it('⭑ a review’s own limitations reach the record WHERE A READER CAN SEE IT — the event’s residualUncertainty', () => {
		// ⛔ `limitations` is the field that BELONGS to this fact, and the ratified `AssuranceAssessmentCompleted` payload is a
		// `strictObject` that does not declare it, so the value is dropped at the event boundary (design §4.15.7). ⭐ E2: the
		// demonstration disclosure is gone — the policies are judged — and a review's OWN limitations are carried instead.
		const limited = answered(POL_AGENT, {}, { limitations: ['The reviewer read the first 4,000 characters only.'] });
		const p = plan(PWU, { answers: cleanAnswers(PWU, { [POL_AGENT]: limited }) });
		expect(runReview(p.steps as readonly [string, string, string, unknown][]).ok).toBe(true);
		const recorded = host
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentCompleted')
			.map((e) => (e.payload as { residualUncertainty?: string[] }).residualUncertainty ?? []);
		expect(recorded).toHaveLength(2);
		expect(recorded[0]).toContain('The reviewer read the first 4,000 characters only.');
	});
});

// ── ⭐ `E12F` F3 (`REG-D-112` (a)) — THE UNIT'S FOLD AFTER A RE-RUN OF ITS DECLARED REVIEWS THAT DID NOT CONCLUDE ────────────────
describe('⭐ E12F F3 — the unit’s fold after a re-run reads every governing policy’s latest verdict, never the re-run’s alone', () => {
	const rerun = (dispositions: DeclaredSignoff['dispositions']): DeclaredSignoff => ({
		policyIds: dispositions.map((_, i) => `pol_rerun_${i}`),
		assessmentIds: dispositions.map((_, i) => `asm_rerun_${i}`),
		excluded: [],
		dispositions,
		steps: [],
		humanSteps: [],
		blockingObservationIds: [],
		criterionResults: 0
	});
	const other = (state: string) => [{ policyId: 'pol_other', assessmentId: 'asm_other', state }];

	it('⭐ a policy NOT re-run still folds in: its CONDITIONALLY_SATISFIED caps a re-run that SATISFIED', () => {
		expect(foldAfterRerun(rerun(['SATISFIED']), other('CONDITIONALLY_SATISFIED'))).toBe('CONDITIONALLY_SATISFIED');
		expect(foldAfterRerun(rerun(['SATISFIED']), other('SATISFIED'))).toBe('SATISFIED');
		expect(foldAfterRerun(rerun(['INCONCLUSIVE']), other('SATISFIED')), 'a re-run that again did not conclude').toBe('INCONCLUSIVE');
		expect(foldAfterRerun(rerun(['REJECTED']), other('SATISFIED'))).toBe('REJECTED');
	});

	it('⛔ an unconcluded latest verdict of another policy is no pass: it folds as INCONCLUSIVE', () => {
		expect(foldAfterRerun(rerun(['SATISFIED']), other('ASSESSING'))).toBe('INCONCLUSIVE');
	});
});
