// JAN-EXECRUN XR-02 — the caller. A model is invoked ON BEHALF OF AN EXECUTION STEP, for the first time.
//
// ⭑ WHAT WAS MISSING WAS ONLY THIS. `StepTypeSchema`'s first member is `MODEL_INVOCATION`; Guide `:1137`
// defines a step AS a model/tool invocation; `MODEL_EXCHANGE` records one durably, verifiably and readably
// (`REG-D-055`/`056`/`057`, `JAN-MXREAD`); a work-unit type now owns the prompt (`REG-D-058`). Every part
// existed except something that put them together — 37 mentions of `stepType` in shipped code and exactly two
// that branch on it, neither running anything.
//
// ⛔ AND THE EXECUTOR IS THE MODEL, NOT THE OPERATOR. The demo's existing lifecycle step records the human who
// clicked, and says so deliberately — it is a `TRANSFORMATION` a human drove. This path is different in kind:
// recording a human for work a model did would be a fiction, and the assurance floor is entitled to know
// which it was. That the floor may then BLOCK is the system working.
import {
	prepareModelInvocation,
	type ContextAssemblyPolicyContent,
	type InvocationSubject
} from '@janumipwb/rph-application';
import type {
	ContextSourceRule,
	ContextSpecification,
	PromptTemplate,
	RecordModelExchangePayload
} from '@janumipwb/rph-contracts';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { captureTry, createExchangeSink } from '../assurance/exchange-capture.js';
import { isToolInvocationResult, type ToolInvocationResult } from '../tools/backing-tool.js';
import { splitExecutionEnvelope } from './execution-contract.js';
import type { ProducerSession } from './producer-session.js';
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { recordExchanges } from '../assurance/exchange-recorder.js';

export interface RunModelStepInput {
	readonly subject: InvocationSubject;
	readonly subjectSemanticVersion: number;
	readonly pwuTypeId: string;
	readonly template: PromptTemplate | undefined;
	/**
	 * The producer's SESSION, held across the work unit's tries (`JAN-EXECSESS`).
	 *
	 * ⭑ IT REPLACED A ONE-SHOT `print`, because a one-shot call has nowhere for a second turn to land — which
	 * is why the loop's first version spliced findings into a re-rendered instruction. Injected so the gate
	 * never spawns a subprocess and a live run is configuration.
	 */
	readonly session: ProducerSession;
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly dispatchExchange: (
		payload: RecordModelExchangePayload,
		aggregateId: string
	) => { status: string };
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	/** The model the host CONFIGURED. ⚠ Used only when the tool reports nothing better — see `print`. */
	readonly modelId: string;
	readonly providerId: string;
	/**
	 * ⭑ JAN-EXECLOOP — findings from a PREVIOUS try, to be addressed on this one.
	 *
	 * ⚠ STRUCTURED PAIRS, NOT THE REVIEWER'S PROSE. `classifyFloorRemediation` reads codes *"never prose"*, and
	 * the same discipline applies going back: the producer is told WHAT failed, by its criterion id, and asked
	 * to address it. ⛔ It is NOT told HOW — that would be the harness doing the professional work, and the
	 * work unit's whole point is that a professional (or a model acting as one) does it.
	 */
	readonly priorFindings?: readonly { readonly code: string; readonly statement: string }[];
	/**
	 * ⭑ CP-04 — the policy this deployment operates under, RESOLVED, not an id.
	 *
	 * ⛔ Required, so that *"resolve the policy and ignore it"* is not expressible here either. Resolution is
	 * the caller's job because it needs the store; obeying it is this step's, because this is where the
	 * assembly happens.
	 */
	readonly contextPolicy: ContextAssemblyPolicyContent;
	/** The work-unit TYPE's context specification, when it declares one. */
	readonly contextSpecification?: ContextSpecification;
}

/**
 * What this call will place in front of the producer, beyond the rendered instruction.
 *
 * ⭑⭑ DERIVED FROM THE TWO FACTS THAT DECIDE IT, not declared by a caller who might get it wrong. A repair turn
 * carries the findings; and when the session REMEMBERS, the producer's context on that turn also holds its own
 * prior work product and prior rationale — which is what `JAN-EXECSESS` bought and what `retainsHistory` has
 * declared since, with no consumer but tests until now.
 *
 * ⚠ NOTHING IS ASSEMBLED ON TRY 1 BEYOND THE INSTRUCTION, even with a remembering session: a fresh session has
 * no prior turns to hold. Listing them anyway would be a claim about material that does not exist.
 */
export function assembledSources(
	priorFindings: readonly unknown[] | undefined,
	retainsHistory: boolean
): readonly ContextSourceRule[] {
	if (!priorFindings?.length) return [];
	return [
		{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT' },
		...(retainsHistory
			? ([
					{ source: 'PRIOR_WORK_PRODUCT', scope: 'THIS_WORK_UNIT' },
					{ source: 'PRIOR_RATIONALE', scope: 'THIS_WORK_UNIT' }
				] as const)
			: [])
	];
}

export type RunModelStepOutcome =
	| {
			readonly ran: true;
			readonly answer: string;
			/** ⭑ THE RENDERED PROMPT, so a reviewer can judge the SAME PAIR the producer saw rather than a
			 *  summary of it. Omitted from the first version of this outcome, and the work-product review could
			 *  not be wired without it — a return value that stops one field short of its only consumer. */
			readonly prompt: string;
			/** The exchange this call created, so a caller can resolve its record without searching for it. */
			readonly exchangeId: string;
			readonly fingerprint: string;
			/** Where the answer is retained. The exchange record already names these exact bytes. */
			readonly storageKey: string;
			readonly contentHash: string;
			readonly byteSize: number;
			readonly exchangesRecorded: number;
			/**
			 * ⭑ WHO ACTUALLY PRODUCED THIS, so the floor stops inventing it.
			 *
			 * ⛔ BEFORE THIS FIELD THE CALLER PASSED `resolveJudgeModel()` AS THE PRODUCER — it labelled the
			 * producing model with the REVIEWING model's id, which is both a fiction and a guaranteed
			 * `checkIndependence('DIFFERENT_MODEL', …)` refusal, since the two sides were the same string BY
			 * CONSTRUCTION. `REG-F-356` recorded that refusal and read it as a field-placement mistake alone.
			 */
			readonly producer: {
				readonly agentId: string;
				readonly modelId: string;
				readonly providerId: string;
			};
			/** How that identity was obtained — the tool's own grade, or HOST_CONFIGURED when it reported none. */
			readonly identityEvidence: 'PROVIDER_REPORTED' | 'HOST_CONFIGURED';
			/**
			 * ⭑ §9.7 — THE PRODUCER'S OWN ACCOUNT OF HOW THE WORK PRODUCT DISCHARGES THE OBLIGATION.
			 *
			 * ⚠ `undefined` means NOT DECLARED, and that is a CONTRACT SHORTFALL TO RECORD — never an absence to
			 * infer from, and never a summary to synthesize. A reviewer may legitimately find against it, which
			 * is precisely the verdict `GLM-5.2` reached in `JAN-LIVEEXEC` before this field existed.
			 */
			readonly rationale?: ProfessionalRationaleSummary;
			/** Set when the execution contract was not honoured, in terms a record can carry. */
			readonly rationaleShortfall?: string;
	  }
	| { readonly ran: false; readonly refusedBecause: string };

/**
 * Run one `MODEL_INVOCATION` step.
 *
 * ⭑ THE ANSWER IS STORED ONCE AND NAMED TWICE, and that is content-addressing paying for itself rather than a
 * shortcut. The exchange record retains the answer because `PER-9` requires the returned output kept per try;
 * an `ARTIFACT` names it because that is what a downstream step or an assurance policy consumes. Both point at
 * the same key, because the store keys on tenant + retention class + content hash — so the same bytes under
 * the same class ARE the same stored object. Writing them twice would produce two keys for one answer and a
 * reader could not tell which the assessment rested on.
 */
export async function runModelInvocationStep(
	input: RunModelStepInput
): Promise<RunModelStepOutcome> {
	const plan = prepareModelInvocation(input.subject, input.pwuTypeId, input.template, {
		policy: input.contextPolicy,
		alsoAssembles: assembledSources(input.priorFindings, input.session.retainsHistory),
		...(input.contextSpecification ? { specification: input.contextSpecification } : {})
	});
	if (!plan.ready) return { ran: false, refusedBecause: plan.reason };

	// ⭑⭑ A REPAIR IS A FOLLOW-UP TURN, NOT A RE-RENDERED INSTRUCTION. The first version of this loop appended
	// findings to the original prompt and sent the whole thing again — which asks the model to produce the work
	// afresh, as though it had never seen it. With the session held (`JAN-EXECSESS`) the producer's own history
	// carries what it produced, so the turn says what it actually is.
	//
	// ⚠ AND THIS CLOSES AN ACCIDENTAL CHANNEL. While the findings were spliced into the producing prompt, the
	// REVIEWER saw them too — it receives that prompt as the "intent" — so it gained state it was never
	// designed to have, by accident and mislabelled. The sponsor ruled the reviewer COLD by default; removing
	// the splice is what makes that true rather than nominal.
	const turnText = input.priorFindings?.length
		? [
				'An independent assurance review of the work product you just produced found the following:',
				...input.priorFindings.map((f) => `- ${f.code}: ${f.statement}`),
				'',
				'Produce the work product again, addressing these findings. Do not argue with them and do not',
				'restate them back; if you believe a finding is mistaken, say so in your rationale.'
			].join('\n')
		: plan.prompt;

	const sink = createExchangeSink();
	const exchangeId = input.newId('exch');
	const requestedAt = input.now();
	let answer: string;
	// ⭑ SET ONLY WHEN THE TOOL REPORTED ITS OWN IDENTITY. `undefined` here is not "no producer" — it is "the tool
	// told us only its answer", which is a different fact and grades the evidence weaker rather than absent.
	let produced: ToolInvocationResult | undefined;
	try {
		const returned = await input.session.turn(turnText);
		if (isToolInvocationResult(returned)) {
			produced = returned;
			answer = returned.answerText;
		} else answer = returned;
	} catch (e) {
		// ⚠ A FAILED CALL IS STILL A TRY THAT HAPPENED. `PER-9` wants the record; recording nothing here would
		// make the one call that broke the run the one call with no evidence, which is the defect inverted.
		const respondedAt = input.now();
		await captureTry({
			store: input.store,
			sink,
			tenantPrefix: input.tenantPrefix,
			exchangeId,
			role: 'initial',
			model: { modelId: input.modelId, providerId: input.providerId },
			prompt: turnText,
			rawOutput: '',
			disposition: 'rejected',
			attemptOrdinal: 1,
			requestedAt,
			respondedAt,
			parseOutcome: {
				outcome: 'NOT_ATTEMPTED',
				detail: `The model call itself failed: ${e instanceof Error ? e.message : String(e)}`
			},
			promptTemplateFingerprint: plan.fingerprint
		});
		record(input, sink);
		return {
			ran: false,
			refusedBecause: `The model call failed: ${e instanceof Error ? e.message : String(e)}`
		};
	}

	// ⭑ THE EXECUTION CONTRACT IS UNWRAPPED HERE, NOT IN THE ADAPTER. Every executing tool is asked for the same
	// envelope by the same system prompt, so interpreting it is a property of the STEP rather than of whichever
	// tool answered — and a second adapter must not be able to interpret it differently.
	//
	// ⚠ THE WORK PRODUCT IS WHAT GETS RETAINED, NOT THE ENVELOPE. The professional's own `outputContract` still
	// means what it says; the harness's wrapper is unwrapped and then forgotten.
	const envelope = splitExecutionEnvelope(answer);
	answer = envelope.workProduct;

	const respondedAt = input.now();
	// ⭑ THE TOOL'S OWN ACCOUNT BEATS THE HOST'S CONFIGURATION, because they can differ: a configured label may
	// resolve to a different model, and `PER-9` E-3 wants the model ACTUALLY invoked. When the tool reported
	// nothing the configured values stand, graded HOST_CONFIGURED by default in `identityFacts`.
	const identity = produced
		? {
				modelId: produced.producer.modelId,
				providerId: produced.producer.providerId,
				evidence: produced.identityEvidence
			}
		: { modelId: input.modelId, providerId: input.providerId };
	await captureTry({
		store: input.store,
		sink,
		tenantPrefix: input.tenantPrefix,
		exchangeId,
		role: 'initial',
		model: identity,
		// ⭑⭑ E-1 IS THE COMPOSITE WHEN THE TOOL CAN REPORT IT. With a held session the model's real input is the
		// system prompt plus every prior turn plus this one — so recording `turnText` alone would name a turn
		// while the model saw a CONVERSATION. `PER-9`: a template *"never substitutes for"* the record.
		// ⚠ Falls back to the turn for one-shot tools, whose turn IS very nearly the whole input.
		prompt: produced?.materializedInput ?? turnText,
		rawOutput: answer,
		disposition: 'accepted',
		attemptOrdinal: 1,
		requestedAt,
		respondedAt,
		// An execution step's answer is the WORK PRODUCT, not a structured judgement, so there is no schema to
		// coerce it against and nothing was attempted. Saying PARSED would assert an outcome nobody observed.
		parseOutcome: {
			outcome: 'NOT_ATTEMPTED',
			detail: 'An execution step answer is a work product; no schema coercion applies.'
		},
		promptTemplateFingerprint: plan.fingerprint
	});

	const recording = record(input, sink);

	// The same bytes, the same class — therefore the same key the exchange record already names.
	const stored = await input.store.put({
		tenantPrefix: input.tenantPrefix,
		bytes: answer,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});

	return {
		ran: true,
		answer,
		// ⚠ THE INSTRUCTION, NOT THE TURN AND NOT THE COMPOSITE. The reviewer judges the work product against
		// the OBLIGATION it was given; handing it a findings turn would make it judge the repair request, and
		// handing it the serialized provider payload would drown it in machinery.
		prompt: plan.prompt,
		// The LAST aggregate id recorded is this call's: one try, one record. Falling back to the app-local id
		// would reintroduce the namespace confusion this field's docblock records, so it does not.
		exchangeId: recording.aggregateIds.at(-1) ?? '',
		fingerprint: plan.fingerprint,
		storageKey: stored.storageKey,
		contentHash: stored.contentHash,
		byteSize: stored.byteSize,
		exchangesRecorded: recording.recorded,
		producer: produced?.producer ?? {
			// ⚠ THE SAME agentId THE TOOL ADAPTERS USE, so a reader cannot tell the two paths apart by accident.
			// What DOES differ is the evidence grade below, which is the honest place for the difference.
			agentId: 'execution.model-invocation',
			modelId: identity.modelId,
			providerId: identity.providerId
		},
		identityEvidence: produced?.identityEvidence ?? 'HOST_CONFIGURED',
		...(envelope.rationale ? { rationale: envelope.rationale } : {}),
		...(envelope.shortfall ? { rationaleShortfall: envelope.shortfall } : {})
	};
}

function record(
	input: RunModelStepInput,
	sink: ReturnType<typeof createExchangeSink>
): { recorded: number; aggregateIds: string[] } {
	const aggregateIds: string[] = [];
	const outcome = recordExchanges(
		(payload, aggregateId) => {
			aggregateIds.push(aggregateId);
			return input.dispatchExchange(payload, aggregateId);
		},
		sink.drain(),
		{
			runToken: input.newId('execrun'),
			// ⭑ THE EXECUTION PLANE, WHICH THIS ENUM HAS CARRIED SINCE REG-D-055 AND NOTHING HAS EVER WRITTEN.
			plane: 'EXECUTION',
			invokerId: `execution.model-invocation:${input.pwuTypeId}`,
			subjectObjectId: input.subject.id,
			subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
			subjectSemanticVersion: input.subjectSemanticVersion,
			newId: input.newId
		}
	);
	return { recorded: outcome.recorded, aggregateIds };
}
