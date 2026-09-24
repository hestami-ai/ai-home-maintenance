// JAN-EXECREVIEW — the assurance floor over a WORK PRODUCT, so a model-executed step can finally complete.
//
// ── ⭑ THIS IS SMALLER THAN IT LOOKS, THREE TIMES OVER ───────────────────────────────────────────────────────
// Each of these was expected to be a subsystem and turned out to be a parameter:
//   1. ~~The floor validators do not inspect their subject (`REG-F-354`) — they judge FACTS the caller
//      supplies.~~ ⛔ TRUE OF TWO OF THE THREE, AND `JAN-EXEC` PHASE 5 WAS SPECIFIED ON THIS SENTENCE. The
//      REASONING-REVIEW validator tested `subject.objectType === 'ARTIFACT'`, and because that test was
//      BINARY its false arm — the PWA-graph framing — is where every OTHER subject kind landed, silently. A
//      command result reached it, failed `JSON.parse`, and returned INCONCLUSIVE, which BLOCKS.
//      ⭐ `REG-F-354`'s own measurement sentence cites `floor.ts:161` and `:213` — the two DETERMINISTIC
//      validators — and its scope note carves the third out of BUILD EFFORT, never out of subject-inspection.
//      This line generalised a measurement about two into a claim about three, and a later programme planned
//      against the claim rather than against the measurement.
//      ⭐ IT IS TRUE NOW (`R14`): the framing is DECLARED on `ReasoningReviewInput` by the caller, the switch
//      is exhaustive, and no floor validator reads its subject for anything but identity and version.
//   2. `classifyFloorRemediation` does not either: it reads dispositions and observation CODES, "never prose",
//      and every mention of a PWA inside it is in a guidance STRING. ⭑ RE-MEASURED IN PHASE 5; IT HELD.
//   3. `runPwaFloor` is a subject plus a context. An artifact run is the same call with different content.
//      ⭑ HELD, AND IS NOW `floor-over-subject.ts` — but the parameter count was wrong: TWELVE, not four.
// ⭑ Three times in one session the system turned out to have been designed for this and never used that way.
// ⚠ AND ONCE IT TURNED OUT NOT TO HAVE BEEN, WHICH IS WHY ITEM 1 IS STRUCK RATHER THAN DELETED.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { verifyExchangeContent, type ResolvableExchange } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import { splitAnswerSpan } from '../assurance/agy-cli.js';
import { workProductReviewInput } from '../assurance/review-input.js';
import { runFloorOverSubject, type FloorRunOutcome } from './floor-over-subject.js';

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
	/** ⚠ OFF BY DEFAULT — see `reviewSeesPriorFindings`. Supplied only when the deployment has chosen to
	 *  give the reviewer state it was not designed to have. */
	readonly priorGaps?: readonly string[];
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
	// ⭑ THE SHARED OUTCOME, NOT A RESTATEMENT OF IT. This was an inline object type carrying its own docblock
	// for `remediation`; a second caller restating it is how two descriptions of one shape come to disagree
	// (`REG-F-353`), which is the defect this file's own header records about a different pair.
): Promise<FloorRunOutcome> {
	const facts = await workProductFloorFacts(subject, opts.artifacts);
	return runFloorOverSubject(
		{
			subjectId: subject.artifactId,
			objectType: 'ARTIFACT',
			semanticVersion: Number(subject.artifact.semanticVersion ?? 1),
			// ⚠ A LITERAL BEFORE AND STILL A LITERAL — but now one this file OWNS rather than one buried inside a
			// shared run. `floor-gate.ts` makes a MODEL_INVOCATION step AI-produced BY CONSTRUCTION, so for a work
			// product this is a fact about the path and not a judgement about the subject.
			isAiProduced: true,
			producer: {
				agentId: `execution.model-invocation:${subject.artifactId}`,
				modelId: subject.producerModelId,
				providerId: subject.producerProviderId
			},
			runLabel: 'work-product-floor',
			idPrefix: 'wpfloor'
		},
		{
			schemaInvariant: facts.schemaInvariant,
			identityProvenance: facts.identityProvenance,
			// ⭐ BUILT BY THE ONE MODULE REVIEWER QUALIFICATION REPLAYS (`JAN-CRITREAD` J2-1): the reviewer judges the same
			// pair the producer saw — the prompt it was given and the answer that came back — assembled by
			// `workProductReviewInput`, which `review-input.test.ts` holds this call to byte for byte.
			reasoningReview: workProductReviewInput({
				criteria: opts.criteria,
				producingPrompt: subject.producingPrompt,
				answer: subject.answer,
				rationale: subject.rationale,
				priorGaps: subject.priorGaps
			})
		},
		engine,
		opts
	);
}
