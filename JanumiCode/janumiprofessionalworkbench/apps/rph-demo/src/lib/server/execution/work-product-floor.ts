// JAN-EXECREVIEW — the assurance floor over a WORK PRODUCT, so a model-executed step can finally complete.
//
// ── ⭑ THIS IS SMALLER THAN IT LOOKS, THREE TIMES OVER ───────────────────────────────────────────────────────
// Each of these was expected to be a subsystem and turned out to be a parameter:
//   1. The floor validators do not inspect their subject (`REG-F-354`) — they judge FACTS the caller supplies.
//   2. `classifyFloorRemediation` does not either: it reads dispositions and observation CODES, "never prose",
//      and every mention of a PWA inside it is in a guidance STRING.
//   3. `runPwaFloor` is a subject plus a context. An artifact run is the same call with different content.
// ⭑ Three times in one session the system turned out to have been designed for this and never used that way.
import {
	runFloorAndPlanRecording,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { recordAssuranceRecordingPlan } from '@janumipwb/rph-engine';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { verifyExchangeContent, type ResolvableExchange } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import { splitAnswerSpan } from '../assurance/agy-cli.js';
import { createFloorRegistry } from '../assurance/index.js';
import { classifyFloorRemediation, type FloorRemediation, type FloorView } from '../floor.js';
import { createExchangeSink } from '../assurance/exchange-capture.js';
import { recordExchanges } from '../assurance/exchange-recorder.js';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { isTestMode } from '../workbench.js';

/** What this module needs about the artifact and the call that produced it. Structural, so a test can drive it. */
export interface WorkProductSubject {
	readonly artifactId: string;
	readonly artifact: Record<string, unknown>;
	readonly exchange: ResolvableExchange & Record<string, unknown>;
	/** The retained answer — the work product itself. */
	readonly answer: string;
	/** The prompt the PRODUCING model was given, so the reviewer judges the same pair the producer saw. */
	readonly producingPrompt: string;
	readonly producerModelId: string;
	/**
	 * ⭑ REQUIRED, BECAUSE `differs()` FAILS CLOSED ON ABSENCE. `checkIndependence` treats an undefined field
	 * as never-different — *"an absence cannot evidence independence"* — so a provider-based rung selected
	 * while this is missing is a PERMANENT BLOCK, not a strict check. It was absent here entirely, which is
	 * why `DIFFERENT_PROVIDER` was unreachable on this path whatever the policy said.
	 */
	readonly producerProviderId: string;
	/**
	 * ⭑ §9.7 — the producer's CONTRACTED account of how the work product discharges its obligation.
	 *
	 * ⚠ THIS IS NOT VOLUNTEERED REASONING AND MUST NEVER BE CONFUSED WITH IT. Chain-of-thought is emitted
	 * unbidden, is `PURGEABLE_AT_EXPIRY`, and an evaluator may NEVER see it (`PER-12`). This is ASKED FOR,
	 * is part of the deliverable, and is exactly what the evaluator is FOR.
	 */
	readonly rationale?: ProfessionalRationaleSummary;
}

/**
 * The deterministic floor facts for a work product.
 *
 * ⚠ `schemaValid` MEANS PARSEABLE, NOT "CONFORMS TO ITS OUTPUT CONTRACT", and the distinction is load-bearing.
 * `PromptTemplate.outputContract` is FREE TEXT describing what a conforming answer looks like; it is not
 * machine-checkable, so contract conformance cannot be decided today. What CAN be decided is that the answer
 * is locatable — the same measurement the retention path makes (`REG-F-351`). ⛔ Reporting a parse as
 * conformance would be the fabricated-measurement defect this repository records repeatedly, so the violation
 * code says `NOT_PARSEABLE` and a machine-checkable contract is recorded as owed.
 */
export function workProductFloorFacts(
	subject: WorkProductSubject,
	store: ArtifactStore
): Promise<{
	schemaInvariant: { schemaValid: boolean; invariantViolations: string[] };
	identityProvenance: {
		hasStableId: boolean;
		hasSemanticVersion: boolean;
		hasProvenance: boolean;
		hasProducer: boolean;
		traceComplete: boolean;
	};
}> {
	const parseable = splitAnswerSpan(subject.answer).located;
	// ⭑ THE TRACE CHECK IS THE READ PATH BUILT FOR DIAGNOSTICS. `verifyExchangeContent` re-hashes the retained
	// bytes and reports whether the record's claim about them is true — which is exactly what "the trace is
	// complete" has to mean if it is to be a measurement rather than an assertion.
	return verifyExchangeContent(subject.exchange, store).then((report) => ({
		schemaInvariant: {
			schemaValid: parseable,
			invariantViolations: parseable ? [] : ['WORK_PRODUCT_NOT_PARSEABLE']
		},
		identityProvenance: {
			hasStableId: Boolean(subject.artifactId),
			hasSemanticVersion: subject.artifact.semanticVersion !== undefined,
			hasProvenance: subject.artifact.provenance !== undefined,
			// ⛔ THE PRODUCER IS THE MODEL. `producingPwuId` says which work unit; the exchange says which model.
			// Both are required: a work product whose producer is only a work unit does not say WHO made it, and
			// `REG-F-352` records that naming the operator would be a fiction.
			hasProducer:
				Boolean(subject.artifact.producingPwuId) && Boolean(subject.producerModelId),
			traceComplete: report.intact
		}
	}));
}

/**
 * Run the three floor policies over a work product and record the assessments against the ARTIFACT.
 *
 * ⭑ THE SUBJECT IS THE ARTIFACT, not the work unit and not the architecture — because that is what
 * `floorGateBlock` looks for when it decides whether the step may complete.
 *
 * ⚠ INDEPENDENCE — AND THIS DISCLOSURE WAS WRONG TWICE, SO IT IS REPLACED RATHER THAN EDITED.
 *
 * It used to read: *"the producing model and the reviewing model are THE SAME CONFIGURED JUDGE, so this
 * satisfies the weakest rung and nothing more."* ⛔ Wrong twice, as `REG-F-356` found: the reasoning-review
 * policy requires `DIFFERENT_MODEL`, not separate invocation — so sameness did not "satisfy" a weaker rung, it
 * REFUSED outright. And it described a collision as though it were a deployment choice.
 *
 * ⭑ WHAT IS TRUE NOW: the producer identity below is the model that ACTUALLY ANSWERED, reported by the tool
 * that ran it (`JAN-TOOLSUITE`), and the executor is configured separately from the judge. Whether the two
 * differ is therefore a fact about the deployment that `checkIndependence` MEASURES, rather than a constant
 * this comment can assert. `providerId` is populated so a provider-based rung is decidable at all.
 */
export async function runWorkProductFloor(
	subject: WorkProductSubject,
	engine: AuthedEngineHandle,
	opts: {
		readonly artifacts: ArtifactStore;
		readonly now: () => string;
		readonly newId: (prefix: string) => string;
		readonly criteria: readonly AssessmentCriterion[];
		readonly print?: (prompt: string) => Promise<string>;
	}
): Promise<{
	satisfied: boolean;
	observations: { code: string; statement: string }[];
	/** ⭑ JAN-EXECLOOP — what to DO about an unsatisfied floor, decided by the SAME classifier the authoring
	 *  plane uses. Computing it here rather than in the route keeps one definition of "these findings may go
	 *  back to the producer", which is the distinction `REG-D-059` turns on. */
	remediation: FloorRemediation;
}> {
	const facts = await workProductFloorFacts(subject, opts.artifacts);

	const assuranceSubject: AssuranceSubject = {
		subjectId: subject.artifactId,
		objectType: 'ARTIFACT',
		semanticVersion: Number(subject.artifact.semanticVersion ?? 1),
		isAiProduced: true,
		// ⚠⚠ `modelId`, NOT ONLY `agentId`, AND THE INDEPENDENCE CHECK CAUGHT ME PUTTING IT IN THE WRONG FIELD.
		// The reasoning-review policy requires `DIFFERENT_MODEL` (`floor-policies.ts:146`), and `checkIndependence`
		// requires BOTH sides DEFINED and different — an undefined field is never "different", because an
		// absence cannot evidence independence. With the model id only in `agentId`, `producer.modelId` was
		// undefined, and the review was BOUNDARY_REJECTED for non-independence every time.
		// ⭑ THE CHECK WAS RIGHT AND MY DECLARATION WAS WRONG. The producer of a work product IS a model, so its
		// `modelId` is the field that must differ from the reviewer's.
		producer: {
			actorType: 'AGENT' as const,
			agentId: `execution.model-invocation:${subject.artifactId}`,
			modelId: subject.producerModelId,
				providerId: subject.producerProviderId
		}
	};

	const ctx: ValidatorContext = {
		schemaInvariant: facts.schemaInvariant,
		identityProvenance: facts.identityProvenance,
		reasoningReview: {
			criteria: opts.criteria,
			// ⭑ THE REVIEWER JUDGES THE SAME PAIR THE PRODUCER SAW — the prompt that was given and the answer
			// that came back. Handing it a summary would make the judgement about the summary.
			prompt: subject.producingPrompt,
			content: subject.answer,
			// ⚠ PASSED UNCONDITIONALLY — the section renders `(none recorded)` when absent. §9.7: presence or
			// absence is never a signal, so the reviewer's INPUT SHAPE must not encode whether the producer
			// declared one. What the reviewer may do is find against a real absence, which is a judgement about
			// the work rather than a difference in what it was handed.
			rationale: subject.rationale,
			narration: undefined,
			prior: undefined
		}
	};

	// ⭑⭑ BOTH OR NEITHER — AND THE LIVE LANE IS WHAT FOUND THIS. `captureTry` REFUSES a store supplied without
	// a sink, because bytes retained with no record referencing them are the orphan `REG-F-336 C-2` forbids.
	// This call passed `artifacts` and no `exchanges`, so the FIRST real reviewer ever pointed at a work
	// product failed with `VALIDATOR_EXECUTION_FAILED: a store was supplied with no sink`.
	//
	// ⚠ THE MOCK COULD NEVER HAVE CAUGHT IT: it captures nothing, so the sink was never reached and every gate
	// run was green. That is the whole argument for a live lane — the guard was working correctly and the
	// wiring around it had never been exercised.
	const exchanges = createExchangeSink();
	const plan = await runFloorAndPlanRecording(
		assuranceSubject,
		ctx,
		createFloorRegistry({
			testMode: isTestMode(),
			artifacts: opts.artifacts,
			exchanges,
			...(opts.print ? { print: opts.print } : {})
		})
	);
	recordAssuranceRecordingPlan(engine, plan, {
		issuedAt: opts.now(),
		correlationId: `work-product-floor:${subject.artifactId}`,
		idPrefix: opts.newId('wpfloor'),
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
					correlationId: `model-exchange:${subject.artifactId}`,
					idempotencyKey: `mex:${aggregateId}`,
					payload
				}),
			drained,
			{
				runToken: opts.newId('wpfloorrun'),
				// ⚠ THE REVIEW IS AN ASSURANCE ACT EVEN THOUGH ITS SUBJECT CAME OFF THE EXECUTION PLANE. The
				// plane names WHO IS ACTING, not where the subject came from — conflating them would file the
				// reviewer's call as though the work unit had made it.
				plane: 'ASSURANCE',
				invokerId: 'reasoning-review',
				assurancePolicyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				subjectObjectId: subject.artifactId,
				subjectObjectType: 'ARTIFACT',
				subjectSemanticVersion: Number(subject.artifact.semanticVersion ?? 1),
				newId: opts.newId
			}
		);
		// A retention fault must not fail a review that already reached its conclusion — but it must not vanish
		// either. Surfacing it is the disclosed shortfall PER-9 permits; swallowing it is what it forbids.
		if (outcome.failures.length > 0)
			console.warn(
				`[MXR] ${outcome.recorded}/${drained.length} work-product exchange records written; ` +
					`${outcome.failures.length} failed: ${outcome.failures.join('; ')}`
			);
	}

	return {
		satisfied: plan.gatePermitsTransition,
		observations: plan.assessments.flatMap((a) =>
			a.observations.map((o) => ({ code: o.code, statement: o.statement }))
		),
		// ⚠ THE SAME CLASSIFIER, NOT A SECOND ONE. `classifyFloorRemediation` is subject-agnostic — it reads
		// policy ids, dispositions and observation CODES, "never prose" — so an artifact subject is the same
		// call with different content. Writing a work-product-specific one here is how two descriptions of one
		// rule come to disagree (`REG-F-353`).
		remediation: classifyFloorRemediation({
			subjectId: subject.artifactId,
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
