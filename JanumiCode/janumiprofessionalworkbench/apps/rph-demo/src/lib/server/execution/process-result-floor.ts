// ⭐⭐ JAN-EXEC PHASE 5 — THE ASSURANCE FLOOR OVER A COMMAND RESULT, so a test run can become governed evidence.
//
// ── ⭑ WHAT THIS IS THE SECOND OF, AND WHY THE FIRST ONE'S FACTS DO NOT PORT ──────────────────────────────────
//
// `work-product-floor.ts` derives the floor's deterministic FACTS for an ARTIFACT; this derives them for an
// EVIDENCE object carrying a command's result. The RUN itself is shared (`floor-over-subject.ts`) because `R14`
// made the reviewers stop reading their subject. ⛔ **THE FACTS ARE NOT SHARED, AND THE ROADMAP'S EXTRACTION
// BOUNDARY MISSED THIS ENTIRELY** — it named `work-product-floor.ts:143-275`, and `workProductFloorFacts` sits at
// `:69-103`, outside it. Three of its five identity facts and its whole schema fact are wrong here:
//
//   `schemaValid`   was `splitAnswerSpan(answer).located` — *is a model ANSWER SPAN locatable*. Asked of a build
//                   log it is false for every genuine test run, and its violation code `WORK_PRODUCT_NOT_PARSEABLE`
//                   would be a FALSE STATEMENT about something that is not a work product. ⛔ Reporting that is
//                   the fabricated-measurement defect this repository records repeatedly.
//   `hasProducer`   read `artifact.producingPwuId`. `EvidenceObjectSchema` has no such field and cannot have one;
//                   the evidence-side field is `producedBy`.
//   `traceComplete` re-hashes the producing MODEL_EXCHANGE. ⭑ A `node` run has no exchange — but under `R15` the
//                   reasoning under review is THE MODEL'S, so the producing exchange IS the right one to re-hash.
//                   The fact survives because the ruling changed whose reasoning is at issue, not by analogy.
//
// ── ⛔⛔ `R17` (SPONSOR, 2026-09-17) — WHAT MAKES A PROCESS RESULT UNFIT TO BE EVIDENCE AT ALL ──────────────────
//
// Each member of `invariantViolations` becomes a BLOCKING observation code VERBATIM, so this list is a
// ratification-grade decision and not a naming exercise. Two block; two are recorded LIMITATIONS:
//
//   ⛔ `PROCESS_OUTPUT_NOT_RETAINED`   the evidence would name bytes nobody kept.
//   ⛔ `PROCESS_VERDICT_UNOBSERVED`    `exitCode === null` (terminated by a signal) or `timedOut` — there is no
//                                     verdict to evidence, and folding `null` into a number would assert a
//                                     termination nobody observed.
//   ⚠ a DECLARED truncation           a LIMITATION. It travels with its own declaration, so it does not
//                                     invalidate the exit code.
//   ⚠ an incomplete capture           a LIMITATION. What is lost is the guarantee that nothing more was coming;
//                                     the verdict is not.
//
// ⭑ **THE LINE IS BETWEEN A SILENT PREFIX AND A DECLARED ONE**, which is exactly what `omittedRegions` was built
// to carry — *"`REG-D-057` requires the omission be declared with enough structure to undo it, and a flag has
// none."* The runner's hazard sentence names the SILENT case: *"a test result read off a silently truncated
// stdout is a pass nothing produced."* This seam has no silent case. ⛔ And the strict reading was declined on
// measured grounds: capture is capped at 64 KiB per stream, so a real suite's output is routinely a declared
// prefix, and blocking on it would mean NO REAL TEST SUITE COULD EVER PRODUCE ADMISSIBLE EVIDENCE.
//
// ⚠ **AND THE LIMITATIONS GO ON THE EVIDENCE, NOT INTO THE FLOOR.** `SchemaInvariantFacts` has no limitations
// channel, and widening it would put a property of the SUBJECT inside a fact about the RUN. `EvidenceObject`
// already has the field, `ProposeEvidence` already requires it, and `evidenceAdmissibility`'s
// `LIMITATIONS_RECORDED` limb already reads it — so this is the one place a reader of the evidence will look.
//
// ── ⭐ `JAN-PRQUAL` `PQ-1` (design D1; `REG-F-476`) — THE RENDERER, AND THE RETENTION DISPOSITION IT OWES, MOVED ──────
//
// ~~`renderProcessResult` puts both streams into the text a REVIEWING MODEL reads~~ — it lived here, and this file
// imports `floor-over-subject`, which the reviewer-qualification closure refuses: so no fingerprint could reach what a
// reviewer of a process result reads (`REG-D-072` D17). It is now `assurance/process-result-render.ts`, a pure module
// with two views of one run (the EVIDENCE bytes `evidence-join.ts` mints, and the REVIEW view the reviewer reads), and
// `REG-Q-066`'s retention disposition for binding `stderr` moved into ITS header with it, restated for the two views.
// This file binds no stream any more, so `verif/agy-stderr-unbound.test.ts` names that module in its place.
//
// ⛔ AND THE REVIEW INPUT IS BUILT IN ONE PLACE: `processResultReviewInput` (`assurance/review-input.ts`), with no
// narration and no prior — `review-input.test.ts` holds `runProcessResultFloor` to it byte for byte.
import type { ProfessionalRationaleSummary, ValidatorContext } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion, ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { verifyExchangeContent, type ResolvableExchange } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { commandLine } from '../assurance/process-result-render.js';
import { processResultReviewInput } from '../assurance/review-input.js';
import { runFloorOverSubject, type FloorRunOutcome } from './floor-over-subject.js';

/** The two BLOCKING codes `R17` names. Exported so a test names the same string the floor emits. */
export const PROCESS_RESULT_VIOLATIONS = {
	/** The evidence would name bytes nobody kept. */
	NOT_RETAINED: 'PROCESS_OUTPUT_NOT_RETAINED',
	/** No exit status was observed — a signal, or a deadline the host enforced. */
	VERDICT_UNOBSERVED: 'PROCESS_VERDICT_UNOBSERVED'
} as const;

export interface ProcessResultSubject {
	readonly evidenceId: string;
	/** The recorded EVIDENCE object, read back from the engine. */
	readonly evidence: Record<string, unknown>;
	/**
	 * ⭑ THE PRODUCING MODEL'S EXCHANGE, AND `R15` IS WHY THAT IS THE RIGHT ONE. A child process has no exchange;
	 * what `traceComplete` verifies is the record of the turn in which the model DECIDED to run this command and
	 * gave its account of the work — which is the reasoning this floor's review is over.
	 */
	readonly exchange: ResolvableExchange & Record<string, unknown>;
	readonly run: ObservedProcessRun;
	/** The prompt the PRODUCING model was given, so the reviewer judges the same pair the producer saw. */
	readonly producingPrompt: string;
	readonly producerModelId: string;
	readonly producerProviderId: string;
	/**
	 * ⭐ THE HOST'S OWN OBSERVATION OF THE TURN — `R15`'s independent half. §22.1 makes the model's account
	 * untrusted external input; this is what it is checked against.
	 */
	readonly observedToolCalls?: ObservedToolCallReport;
	/** §9.7 — the producer's CONTRACTED account. Under `R15` this is the reasoning the review is OF. */
	readonly rationale?: ProfessionalRationaleSummary;
}

/**
 * Whether a run produced a VERDICT anyone observed.
 *
 * ⛔ `timedOut` IS A LIMB OF THIS AND NOT A SEPARATE CODE, because a killed process's exit status is the kill.
 * §36.2's TIMEOUT-vs-TOOL_FAILURE split is preserved on the outcome and in the rendered result the reviewer
 * reads; what it does NOT do is make a deadline into a test verdict.
 */
export function processVerdictObserved(run: ObservedProcessRun): boolean {
	return run.exitCode !== null && !run.timedOut;
}

/**
 * `R17`'s LIMITATION half, in the form `ProposeEvidence` requires.
 *
 * ⚠ ALWAYS AT LEAST ONE ENTRY, AND THE REASON IS `evidenceAdmissibility`. Its `LIMITATIONS_RECORDED` limb reads
 * `e.limitations === undefined` — *"an empty array counts as recorded"* — so an empty list is admissible. But an
 * empty list also reads as *"this evidence has no limitations"*, which is never true of a bounded capture of a
 * process someone else's code ran. The standing entry says what this evidence IS.
 */
export function processResultLimitations(run: ObservedProcessRun): string[] {
	const out = [
		// ⭐ `REG-F-482` — `argv` AS A JSON ARRAY, as both views of the run render it (`commandLine`): joined by spaces,
		// two different commands read as one.
		`This evidence is the recorded outcome of one command (${commandLine(run.argv)}) run in the work unit's ` +
			`workspace by the executing model. It establishes what that command exited with and printed. It does ` +
			`NOT establish that the command was the right one to run, that its scope covers any particular claim, ` +
			`or that a passing exit status means the work is correct.`
	];
	if (run.omittedRegions.length > 0)
		out.push(
			`The captured output is a DECLARED PREFIX: ${run.omittedRegions
				.map((r) => `${r.byteSize} UTF-8 bytes were removed from ${r.stream} at byte offset ${r.byteOffset}`)
				.join('; ')}. Anything the command printed beyond the capture bound is not in this evidence.`
		);
	if (!run.outputComplete)
		out.push(
			'A descendant process still held the output streams when the child exited, so the capture may be ' +
				'incomplete in a way the declared cuts above do not describe: more output may have been coming.'
		);
	return out;
}

// ~~`renderProcessResult` — what the reviewer reads as the subject's CONTENT~~ — moved, with its two views, to
// `assurance/process-result-render.ts` (`JAN-PRQUAL` `PQ-1`, design D1). See this file's header.

/** The deterministic floor facts for a command result. See `R17` in this file's header. */
export function processResultFloorFacts(
	subject: ProcessResultSubject,
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
	const retained = subject.run.retention.retained;
	const verdict = processVerdictObserved(subject.run);
	const violations = [
		...(retained ? [] : [PROCESS_RESULT_VIOLATIONS.NOT_RETAINED]),
		...(verdict ? [] : [PROCESS_RESULT_VIOLATIONS.VERDICT_UNOBSERVED])
	];
	return verifyExchangeContent(subject.exchange, store).then((report) => ({
		schemaInvariant: {
			// ⭑ NOT "PARSEABLE" — THERE IS NOTHING TO PARSE. A command result is well-formed when its bytes were
			// kept and its verdict was seen; anything else is a result nobody can stand behind. The two facts are
			// the SAME two the violations list names, deliberately, so `FS-01` and `FS-02` cannot disagree.
			schemaValid: retained && verdict,
			invariantViolations: violations
		},
		identityProvenance: {
			hasStableId: Boolean(subject.evidenceId),
			hasSemanticVersion: subject.evidence.semanticVersion !== undefined,
			hasProvenance: subject.evidence.provenance !== undefined,
			// ⛔ `producedBy`, NOT `producingPwuId`. The artifact path reads a work-unit field an Evidence object
			// does not and cannot have; the evidence-side field is the one `ProposeEvidence` requires and
			// `evidenceAdmissibility`'s PROVENANCE_PRESENT limb reads. And the MODEL is still required beside it,
			// for the reason the artifact path gives: an output whose producer is only a work unit does not say
			// WHO made it.
			hasProducer: Boolean(subject.evidence.producedBy) && Boolean(subject.producerModelId),
			traceComplete: report.intact
		}
	}));
}

/**
 * Run the three floor policies over a command result and record the assessments against the EVIDENCE.
 *
 * ⭑ THE SUBJECT IS THE EVIDENCE OBJECT, because `completeExecutionStep` unions `outputArtifactIds` with
 * `proposedEvidenceIds` into one `resultIds` list and loops `floorGateBlock` over every member at its own
 * store-derived version. ⛔ **SO THIS RUN IS NOT OPTIONAL: naming a TEST_RESULT in `proposedEvidenceIds` without
 * it makes every AI step completion REJECT**, with all three policies MISSING. The gate needed no change; what
 * was missing was the producer.
 *
 * ⚠ `isAiProduced: true`, AND BOTH ARMS OF THE APPARENT DILEMMA BLOCK — ONLY ONE IS HONEST. `false` omits the
 * reasoning review from `deMinimisFloorPlan` while `floorGateBlock` still requires all three SATISFIED, so it
 * yields a permanent MISSING rather than a skip. ⭐ `R15` is what makes `true` honest: the reasoning under review
 * is the MODEL'S account of its work, so `producer.modelId` is a true statement and `DIFFERENT_MODEL` against
 * the judge is decidable. The dilemma dissolves because of the ruling, not around it.
 */
export async function runProcessResultFloor(
	subject: ProcessResultSubject,
	engine: AuthedEngineHandle,
	opts: {
		readonly artifacts: ArtifactStore;
		readonly now: () => string;
		readonly newId: (prefix: string) => string;
		readonly criteria: readonly AssessmentCriterion[];
		readonly print?: (prompt: string) => Promise<string>;
	}
): Promise<FloorRunOutcome> {
	const facts = await processResultFloorFacts(subject, opts.artifacts);
	const ctx: ValidatorContext = {
		schemaInvariant: facts.schemaInvariant,
		identityProvenance: facts.identityProvenance,
		// ⭐ `JAN-PRQUAL` `PQ-1` (design D1) — BUILT BY THE ONE BUILDER, WITH NO NARRATION AND NO PRIOR, as this floor always
		// built it inline: `review-input.test.ts` holds this call site to `processResultReviewInput` byte for byte.
		reasoningReview: processResultReviewInput({
			// ⛔ THE SAME RUBRIC THE WORK-PRODUCT AND GRAPH RUNS USE, READ FROM THE SAME POLICY OBJECT (`R14`).
			// A second rubric here would be recorded citing `floor.reasoning-review` anyway — `ValidatorResult.
			// policyId` is typed `FloorPolicyId` — so the record would name a policy that did not supply it.
			criteria: opts.criteria,
			producingPrompt: subject.producingPrompt,
			run: subject.run,
			// ⭐ `R15` — THE TWO HALVES OF THE JOIN. The model's own account, and the host's observation of what
			// it actually did. Neither alone is a review: §22.1 makes the first untrusted, and the second carries
			// no reasoning at all.
			rationale: subject.rationale,
			...(subject.observedToolCalls ? { observedToolCalls: subject.observedToolCalls } : {})
		})
	};
	return runFloorOverSubject(
		{
			subjectId: subject.evidenceId,
			objectType: 'EVIDENCE',
			semanticVersion: Number(subject.evidence.semanticVersion ?? 1),
			isAiProduced: true,
			producer: {
				agentId: `execution.process-run:${subject.evidenceId}`,
				modelId: subject.producerModelId,
				providerId: subject.producerProviderId
			},
			runLabel: 'process-result-floor',
			idPrefix: 'prfloor'
		},
		ctx,
		engine,
		opts
	);
}
