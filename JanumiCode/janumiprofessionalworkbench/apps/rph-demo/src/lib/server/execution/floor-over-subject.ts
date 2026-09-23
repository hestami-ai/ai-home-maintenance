// ⭐⭐ JAN-EXEC PHASE 5 — ONE FLOOR RUN, PARAMETERISED BY ITS SUBJECT. Extracted from `work-product-floor.ts`.
//
// ── ⛔ WHY THIS EXTRACTION WAS NOT THE WHOLE OF PHASE 5, WHICH THE ROADMAP EXPECTED IT TO BE ──────────────────
//
// `work-product-floor.ts` opened by recording that *"the floor validators do not inspect their subject
// (`REG-F-354`) — they judge FACTS the caller supplies"*, and Phase 5 was specified as **a call site, not a
// redesign** on the strength of it. ⛔ **MEASURED: TRUE OF TWO OF THE THREE.** The reasoning-review validator
// tested `subject.objectType === 'ARTIFACT'` with the PWA-graph framing as its FALSE arm, so a subject that was
// neither took the graph arm silently — INCONCLUSIVE offline, which BLOCKS. `R14` moved that selector onto
// `ReasoningReviewInput.framing`, where the CALLER declares it and the switch is exhaustive.
//
// ⭑ **SO THE COMMENT IS NOW TRUE, AND THAT IS WHY THIS FILE EXISTS RATHER THAN A PARAMETER ON THE OLD ONE.** With
// the framing declared, no floor validator reads its subject for anything but identity and version — which is
// exactly the property that makes one run serve two subjects. The extraction is the consequence of the fix, not
// a substitute for it.
//
// ── ⚠ WHAT IS SUBJECT-SPECIFIC, MEASURED RATHER THAN GUESSED ────────────────────────────────────────────────
//
// The roadmap said *"the four literals"*. There are TWELVE: six threads of `subject.artifactId` (one of them the
// independence baseline's `agentId`, which also hardcodes the step type), two `objectType` literals at two
// DIFFERENT type strengths (an unchecked `string` on `AssuranceSubject`, the 31-member contract enum on the
// model-exchange record), two correlationId prefixes, two minted-id prefixes — plus two hardcoded VERDICTS,
// `isAiProduced: true` and `waived: false`, which are not labels at all.
//
// ⭑ `objectType` IS TYPED TO THE CONTRACT ENUM HERE, WHICH TIGHTENS THE WEAKER OF THE TWO SITES FOR FREE. One
// parameter feeding both means the stronger type wins, so `AssuranceSubject.objectType` — declared `string`,
// with no schema anywhere applying an enum to it — can no longer receive a value the record plane would refuse.
import {
	runFloorAndPlanRecording,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { recordAssuranceRecordingPlan, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { ProfessionalWorkObjectType } from '@janumipwb/rph-contracts';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { createFloorRegistry } from '../assurance/index.js';
import type { StipulationLookup } from '../assurance/standin-reasoning-review-validator.js';
import { anyStipulationRegistered, stipulationFor, workProductPwaOf } from '../stipulations.js';
import { classifyFloorRemediation, type FloorRemediation, type FloorView } from '../floor.js';
import { createExchangeSink } from '../assurance/exchange-capture.js';
import { recordExchanges } from '../assurance/exchange-recorder.js';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { isTestMode } from '../workbench.js';

/**
 * Everything one floor run needs to know about WHOSE floor it is.
 *
 * ⛔ NOTHING HERE IS OPTIONAL, AND THAT IS THE POINT. Each field was a LITERAL inside the work-product run, and a
 * literal that becomes an optional parameter with the old value as its default is not a parameterisation — it is
 * the original hardcoding wearing a parameter's clothes, and the second caller inherits it by writing nothing.
 */
export interface FloorSubjectDeclaration {
	readonly subjectId: string;
	/**
	 * ⭑ THE CONTRACT ENUM, NOT `string`. `AssuranceSubject.objectType` is declared `string` and no schema anywhere
	 * validates it; `ExchangeRunContext.subjectObjectType` is the 31-member enum. The same conceptual fact was
	 * written twice at two type strengths, 96 lines apart. One parameter feeding both makes the stronger one
	 * govern.
	 */
	readonly objectType: ProfessionalWorkObjectType;
	readonly semanticVersion: number;
	/**
	 * ⛔ A VERDICT, NOT A LABEL, AND IT DECIDES WHETHER THE REASONING REVIEW RUNS AT ALL. `deMinimisFloorPlan`
	 * includes `floor.reasoning-review` only when this is true, while `floorGateBlock` requires all three policies
	 * SATISFIED — so `false` does not skip the review, it makes it permanently MISSING and blocks the transition.
	 * ⚠ Both arms of that apparent dilemma block; only one is honest, and which one is honest is a question about
	 * the subject that the CALLER has to answer.
	 */
	readonly isAiProduced: boolean;
	/**
	 * The independence baseline the reviewer must differ from.
	 *
	 * ⚠ `modelId` MUST BE POPULATED OR THE REVIEW IS BOUNDARY_REJECTED, NOT MERELY STRICT. `checkIndependence`
	 * requires BOTH sides defined and different — *"an absence cannot evidence independence"* — so an undefined
	 * `modelId` under a `DIFFERENT_MODEL` rung is a PERMANENT refusal.
	 */
	readonly producer: {
		readonly agentId: string;
		readonly modelId: string;
		readonly providerId: string;
	};
	/** The prefix this run's correlation ids carry, e.g. `work-product-floor`. */
	readonly runLabel: string;
	/** The prefix this run's minted assessment ids carry, e.g. `wpfloor`. */
	readonly idPrefix: string;
}

export interface FloorRunOutcome {
	satisfied: boolean;
	observations: { code: string; statement: string }[];
	/** ⭑ JAN-EXECLOOP — what to DO about an unsatisfied floor, decided by the SAME classifier the authoring
	 *  plane uses. Computing it here rather than in the route keeps one definition of "these findings may go
	 *  back to the producer", which is the distinction `REG-D-059` turns on. */
	remediation: FloorRemediation;
}

/**
 * ⛔ THE INVOKER ID IS SHARED BY BOTH CALLERS, AND IT DISAGREES WITH THE VOCABULARY — DISCLOSED, NOT MULTIPLIED.
 *
 * `RecordModelExchange.invokerId` is documented in the vocab as the VALIDATOR's id, and the reviewing validators
 * are `agy.reasoning-review` and `mock.reasoning-review`. This value is neither. ⚠ It is kept UNCHANGED because
 * altering it would change the shape of records the work-product path has already written, which is a records
 * question and not this phase's; and it is kept in ONE PLACE because the alternative — a second caller copying
 * the literal — would make three constants disagree with one vocabulary instead of one.
 */
const FLOOR_REVIEW_INVOKER_ID = 'reasoning-review';

/**
 * Run the three de minimis floor policies over any subject and record the assessments against it.
 *
 * ⭑ THE RECORDER IS ALREADY SUBJECT-AGNOSTIC AND THAT PART OF THE ROADMAP'S CLAIM SURVIVED MEASUREMENT:
 * `AssuranceRecordingPlan` carries `subjectId` and `subjectSemanticVersion` and no object type at all, and
 * `stepResultSubjects` — the kernel side that decides which results the floor gate loops over — never reads
 * `objectType` either. What needed fixing was never the recorder.
 */
export async function runFloorOverSubject(
	declaration: FloorSubjectDeclaration,
	ctx: ValidatorContext,
	engine: AuthedEngineHandle,
	opts: {
		readonly artifacts: ArtifactStore;
		readonly now: () => string;
		readonly newId: (prefix: string) => string;
		readonly print?: (prompt: string) => Promise<string>;
	}
): Promise<FloorRunOutcome> {
	const assuranceSubject: AssuranceSubject = {
		subjectId: declaration.subjectId,
		objectType: declaration.objectType,
		semanticVersion: declaration.semanticVersion,
		isAiProduced: declaration.isAiProduced,
		// ⚠⚠ `modelId`, NOT ONLY `agentId`, AND THE INDEPENDENCE CHECK CAUGHT THIS IN THE WRONG FIELD ONCE. The
		// reasoning-review policy requires `DIFFERENT_MODEL` (`floor-policies.ts:146`), and `checkIndependence`
		// requires BOTH sides DEFINED and different — an undefined field is never "different", because an absence
		// cannot evidence independence. With the model id only in `agentId`, `producer.modelId` was undefined and
		// the review was BOUNDARY_REJECTED for non-independence every time.
		producer: { actorType: 'AGENT' as const, ...declaration.producer }
	};

	// ⭑⭑ BOTH OR NEITHER — AND THE LIVE LANE IS WHAT FOUND THIS. `captureTry` REFUSES a store supplied without
	// a sink, because bytes retained with no record referencing them are the orphan `REG-F-336 C-2` forbids.
	// This call once passed `artifacts` and no `exchanges`, so the FIRST real reviewer ever pointed at a work
	// product failed with `VALIDATOR_EXECUTION_FAILED: a store was supplied with no sink`.
	//
	// ⚠ THE MOCK COULD NEVER HAVE CAUGHT IT: it captures nothing, so the sink was never reached and every gate
	// run was green. That is the whole argument for a live lane — the guard was working correctly and the
	// wiring around it had never been exercised.
	// ⭐ THE WORK-PRODUCT ARM FINDS ITS PWA through artifact → work unit → undertaking (`REG-D-072` D6), on the engine this
	// floor records into, and only when a test registered anything at all. A process result is never stipulated.
	const stipulations: StipulationLookup = (s, framing) => {
		if (framing !== 'WORK_PRODUCT' || !anyStipulationRegistered()) return undefined;
		const pwaId = workProductPwaOf(engine, s.subjectId);
		return pwaId === undefined ? undefined : stipulationFor(pwaId, 'WORK_PRODUCT');
	};
	const exchanges = createExchangeSink();
	const plan = await runFloorAndPlanRecording(
		assuranceSubject,
		ctx,
		createFloorRegistry({
			testMode: isTestMode(),
			artifacts: opts.artifacts,
			exchanges,
			...(opts.print ? { print: opts.print } : {}),
			stipulations
		}),
		// ⭐ `REG-D-071` Q5: the engine this floor records into decides whether a stipulated answer counts — the same
		// engine whose Gate E judges the completion. One source, so the ladder and the gate cannot disagree.
		{ admitStipulatedAnswers: engine.admitStipulatedAnswers }
	);
	recordAssuranceRecordingPlan(engine, plan, {
		issuedAt: opts.now(),
		correlationId: `${declaration.runLabel}:${declaration.subjectId}`,
		idPrefix: opts.newId(declaration.idPrefix),
		newId: opts.newId
	});

	// ⭑ THE DRAIN — `PER-9`'s durable record of the REVIEWING call, one per bounded try. Without it the review
	// happened and nothing says so: the producing call is recorded on the EXECUTION plane and the reviewing
	// call would have no record at all, which is the record-plane omission `PER-9` calls illegal.
	const drained = exchanges.drain();
	if (drained.length > 0) {
		const outcome = recordExchanges(
			(payload, aggregateId) =>
				engine.dispatch({
					commandId: opts.newId('cmd'),
					commandType: 'RecordModelExchange',
					commandSchemaVersion: 1,
					targetAggregateType: 'MODEL_EXCHANGE',
					targetAggregateId: aggregateId,
					issuedAt: opts.now(),
					correlationId: `model-exchange:${declaration.subjectId}`,
					idempotencyKey: `mex:${aggregateId}`,
					payload
				}),
			drained,
			{
				runToken: opts.newId(`${declaration.idPrefix}run`),
				// ⚠ THE REVIEW IS AN ASSURANCE ACT EVEN THOUGH ITS SUBJECT CAME OFF THE EXECUTION PLANE. The
				// plane names WHO IS ACTING, not where the subject came from — conflating them would file the
				// reviewer's call as though the work unit had made it.
				plane: 'ASSURANCE',
				invokerId: FLOOR_REVIEW_INVOKER_ID,
				assurancePolicyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				subjectObjectId: declaration.subjectId,
				subjectObjectType: declaration.objectType,
				subjectSemanticVersion: declaration.semanticVersion,
				newId: opts.newId
			}
		);
		// A retention fault must not fail a review that already reached its conclusion — but it must not vanish
		// either. Surfacing it is the disclosed shortfall PER-9 permits; swallowing it is what it forbids.
		if (outcome.failures.length > 0)
			console.warn(
				`[MXR] ${outcome.recorded}/${drained.length} ${declaration.runLabel} exchange records written; ` +
					`${outcome.failures.length} failed: ${outcome.failures.join('; ')}`
			);
	}

	return {
		satisfied: plan.gatePermitsTransition,
		observations: plan.assessments.flatMap((a) =>
			a.observations.map((o) => ({ code: o.code, statement: o.statement }))
		),
		// ⚠ THE SAME CLASSIFIER, NOT A SECOND ONE. `classifyFloorRemediation` is subject-agnostic — it reads
		// policy ids, dispositions and observation CODES, "never prose" — so a second subject is the same call
		// with different content. Writing a subject-specific one here is how two descriptions of one rule come
		// to disagree (`REG-F-353`).
		//
		// ⚠ AND THE DOUBLE CAST IS INHERITED, NOT INTRODUCED, AND IT IS NOW A SECOND CALLER'S PROBLEM TOO.
		// `FloorView` requires `aggregate` and `waived`; this supplies neither, and `classifyFloorRemediation`
		// reads neither — today. The day anything starts reading `floor.aggregate`, the authoring path will
		// supply a value and both execution paths will supply `undefined`. Recorded rather than fixed, because
		// removing the cast is a `FloorView` change with its own readers.
		remediation: classifyFloorRemediation({
			subjectId: declaration.subjectId,
			satisfied: plan.gatePermitsTransition,
			waived: false,
			policies: plan.assessments.map((a) => ({
				policyId: a.policyId,
				disposition: a.disposition,
				independenceOk: a.independenceOk,
				observations: a.observations
			}))
		} as unknown as FloorView)
	};
}
