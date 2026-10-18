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
import {
	answerFromText,
	isToolInvocationResult,
	type AdapterAnswer,
	type ToolInvocationResult
} from '../tools/backing-tool.js';
import {
	declareWorkProductDerivation,
	describeWorkProductDerivation,
	noAnswerOutcome,
	noAnswerRefusal,
	splitExecutionEnvelope
} from './execution-contract.js';
import { governedToolCallReport } from '../tools/observed-tool-calls.js';
import { stepCapabilityRefusal, type StepBinding } from './step-binding.js';
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
	 * ⭐⭐ `JAN-EXEC` P7-6R RD8 — findings carried from a REFUSED ATTEMPT into a FRESH session, by a person's re-run of the
	 * work (`DESIGN-the-stopped-unit-recovery.md` RD8; `REG-D-104` (1)).
	 *
	 * ⛔ NOT `priorFindings`, AND THE DIFFERENCE IS THE HAZARD RD8 NAMES. A repair turn on a HELD session omits the
	 * instruction, because the session already had it; a fresh session given that turn would get findings with no task. So
	 * a carried finding rides the FIRST turn, AFTER the instruction, and declares `PRIOR_REVIEW_FINDING` alone — the fresh
	 * session holds no prior work product and no prior rationale, whatever `retainsHistory` says.
	 * ⛔ Only SUBJECT findings, as the floor's classifier lists them: never an escalation recommendation, and nothing from a
	 * review that did not conclude (`REG-D-090`, `REG-D-059`). The caller passes them on try 1 only; later tries are repairs
	 * on the now-held session and use `priorFindings`.
	 */
	readonly carriedFindings?: readonly { readonly code: string; readonly statement: string }[];
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
	/**
	 * ⭑ JAN-EXECGOV EG-03 — the step's RUNTIME_BINDING and what it CURRENTLY grants.
	 *
	 * ⛔⛔ REQUIRED, WITH AN EXPLICIT `NONE`, AND THE FIRST VERSION OF THIS FIELD WAS OPTIONAL — which made
	 * "skip the capability check" expressible by OMISSION. That is the exact shape of the `producer`-omission
	 * dodge this programme filed at `REG-F-364` and declined to fix on its own authority, and it is the shape
	 * `CP-04` refused when it made the context policy a REQUIRED parameter so that *"resolve the policy and
	 * ignore it"* could not be written. Applying a weaker standard to a check of my own than to one I audited
	 * is how a dodge gets built by the person who documented it.
	 *
	 * ⭑ `NONE` IS A DECLARATION, NOT AN ABSENCE — the same distinction the kernel draws between a step naming
	 * no binding (`OUT_OF_SCOPE`, legal) and one naming a binding that does not resolve (fail closed). A caller
	 * must say which case it is in.
	 *
	 * ⚠ AND THE GRANT IS READ FROM THE STORE, not taken from the request that produced it. Comparing a request
	 * against itself is a check that cannot fail; reading the stored grant means `RevokeRuntimeCapability`
	 * changes the answer — §22.1's *"revoked bindings cannot be used for new attempts."*
	 */
	readonly binding: StepBindingFacts;
}

/**
 * What the caller knows about this step's binding. ⛔ `NONE` must be SAID, never left out.
 *
 * ⛔ `binding` IS THE WHOLE `StepBinding` — the wire request AND the REQUIRES/USES needs it was derived from
 * — rather than the request alone. JAN-EXEC Phase 3 made the difference load-bearing: the refusal must fire on
 * an ungranted REQUIRES and must NOT fire on an ungranted USES, and `requestedCapabilities` cannot tell the two
 * apart. A caller asked to supply the split separately would be asked to re-derive a fact the step type owns,
 * and the plausible wrong answer (everything REQUIRES) silently turns the degradation this phase exists to
 * provide back into a refusal.
 */
export type StepBindingFacts =
	| { readonly kind: 'NONE' }
	| {
			readonly kind: 'BOUND';
			readonly binding: StepBinding;
			readonly granted: readonly string[];
			/**
			 * ⭐⭐ `B-1` — THE BINDING'S CURRENT `authorizationStatus`, AND IT IS A SEPARATE FACT FROM `granted`.
			 *
			 * ⛔ DRIVEN: `RevokeRuntimeCapability` advances the status to REVOKED and **deliberately does not
			 * clear** `grantedCapabilities`, so `granted` is byte-identical before and after a revocation. Every
			 * reader in the Phase 3 path took the list and never the status, so §22.1's *"Revoked bindings cannot
			 * be used for new attempts"* — a RATIFIED rule — was enforced on the START arrow (`RPH-EXE-003`) and
			 * nowhere per TRY. This loop takes several tries against ONE already-started step.
			 *
			 * ⛔ REQUIRED ON THE `BOUND` ARM, never optional: a caller that holds a binding holds its status, and
			 * an optional field would make *"read the grant and skip the revocation question"* expressible by
			 * omission — the dodge shape this type's own explicit `NONE` member exists to refuse one level up.
			 */
			readonly authorizationStatus: string;
	  };

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

/**
 * ⭐ P7-6R RD8 — what THIS turn assembles: a repair turn, what the held session holds (`assembledSources`); a fresh
 * session's first turn carrying a refused attempt's findings, the finding ALONE — `retainsHistory: false`, because a fresh
 * session holds no prior work product or rationale whatever it could hold; and with neither, nothing beyond the
 * instruction. ⛔ Carried findings are ignored beside prior ones: a repair turn is on a session that already has a task.
 */
function turnAssembles(input: RunModelStepInput): readonly ContextSourceRule[] {
	if (input.priorFindings?.length)
		return assembledSources(input.priorFindings, input.session.retainsHistory);
	return assembledSources(input.carriedFindings, false);
}

/**
 * ⭐ P7-6R RD8 — a turn that is not a repair: the instruction, and — on a re-run of refused work — the refused review's
 * findings AFTER it, since a fresh session has no task until it is given one. ⭑ It says what the session does NOT hold and
 * what it may find, so the record (E-1 holds this turn) says so too: the earlier attempt's files stay in the shared
 * workspace (`workspace-host.ts`). With nothing carried it is the instruction exactly, as Begin & Execute sends it.
 */
function firstTurn(
	instruction: string,
	carried: readonly { readonly code: string; readonly statement: string }[]
): string {
	if (carried.length === 0) return instruction;
	return [
		instruction,
		'',
		'An independent assurance review of an earlier attempt at this work found the following:',
		...carried.map((f) => `- ${f.code}: ${f.statement}`),
		'',
		'This is a fresh session: you do not hold that attempt’s work product or rationale,',
		'though files it wrote may still be in the workspace.',
		'Produce the work product, addressing these findings. Do not argue with them and do not',
		'restate them back; if you believe a finding is mistaken, say so in your rationale.'
	].join('\n');
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
 * ⚠⚠ THIS DOCBLOCK IS REPLACED RATHER THAN EDITED, BECAUSE THE SPONSOR'S PHASE 0 RULING MADE IT FALSE. It read:
 * *"THE ANSWER IS STORED ONCE AND NAMED TWICE … Both point at the same key, because the store keys on tenant +
 * retention class + content hash — so the same bytes under the same class ARE the same stored object."* That
 * held only while E-2's answer half WAS the work product, which is precisely the question the ruling settled
 * the other way.
 *
 * ⭐ WHAT IS TRUE NOW. Three objects are retained per try, and each is retained for a stated reason:
 *   · the ANSWER SPAN — the execution ENVELOPE the model returned, `RETAINED_BY_PARTICIPATION` (E-2, §9.7);
 *   · the VOLUNTEERED REASONING, when any arrived — `PURGEABLE_AT_EXPIRY` (PER-12), separated at retention;
 *   · the WORK PRODUCT — the envelope's `workProduct` field, which the `ARTIFACT` names and every assessment
 *     is recorded over.
 *
 * ⛔ THE FIRST AND THIRD ARE NO LONGER ONE OBJECT, SO THE RELATION BETWEEN THEM IS DECLARED IN E-5 RATHER THAN
 * INFERRED FROM EQUAL BYTES — `declareWorkProductDerivation`. The old arrangement's virtue was that *"a reader
 * could not tell which the assessment rested on"* was answered by arithmetic; this one answers it by saying so,
 * which is the only form available once the two halves genuinely differ.
 */
export async function runModelInvocationStep(
	input: RunModelStepInput
): Promise<RunModelStepOutcome> {
	// ── ⭑⭑ EG-03 — THE BINDING MUST STILL AUTHORIZE THIS, AND IT IS CHECKED BEFORE ANYTHING IS BUILT ───────
	//
	// `EG-02` made a step run under an AUTHORIZED binding; a grant that constrains nothing is a record, not a
	// control. This refuses BEFORE the prompt is rendered and before any model is called, on the same ordering
	// argument `prompt-render.ts:8-12` makes: a check that fires after the call disclosed the harm afterwards.
	//
	// ⛔ THIS IS NOT THE OPERATION TIER. `RPH-EXE-004`'s operation tier — intercepting the call itself — is the
	// Platform's and stays deferred. This refuses to BEGIN an invocation the binding does not authorise, which
	// is step governance and JPWB's.
	if (input.binding.kind === 'BOUND') {
		// ⛔ `B-1` — THE STATUS TRAVELS WITH THE GRANT, because a REVOKED binding still LISTS what it granted and
		// a list is not an authorization. §22.1: revoked bindings cannot be used for new attempts.
		const refusal = stepCapabilityRefusal(
			input.binding.binding,
			input.binding.granted,
			input.binding.authorizationStatus
		);
		if (refusal) return { ran: false, refusedBecause: refusal };
	}

	const plan = prepareModelInvocation(input.subject, input.pwuTypeId, input.template, {
		policy: input.contextPolicy,
		alsoAssembles: turnAssembles(input),
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
		: firstTurn(plan.prompt, input.carriedFindings ?? []);

	const sink = createExchangeSink();
	const exchangeId = input.newId('exch');
	const requestedAt = input.now();
	/** ⭐ `JAN-NOANS` — the answer, OR a stated reason none arrived. Narrowed once, below. */
	let adapterAnswer: AdapterAnswer;
	let answer: string;
	// ⭐⭐ E-2 WHOLE, AS IT ARRIVED — THE ONE VALUE THE RECORDER MUST NOT BE HANDED ALREADY REDUCED.
	//
	// `captureTry` derives BOTH the answer span and the volunteered-reasoning span from the single `rawOutput`
	// it is given, so Guide §9.7's lawful separation can only run on the TRUE reply. This step used to hand it
	// `answer` — stripped of reasoning by `answerText` and then envelope-split — so the split found nothing to
	// separate, took the *"nothing to separate"* branch, and the record asserted in `volunteeredReasoningRef`'s
	// own words that this was *"an observed absence, not an unretained presence"* for replies that carried some.
	// ⛔ A record that manufactures the absence it then discloses is the defect; this variable is the fix.
	//
	// ⚠ `answer` IS UNTOUCHED BY THIS, AND THAT IS NOT AN OVERSIGHT. `TS-05` records `answer = returned.rawOutput`
	// as the ASR-13 violation the split exists to PREVENT — the reviewer must never receive the producer's
	// interior. The two values are separated here precisely so the RECORD can be complete while the REVIEWER
	// stays cold.
	let rawReply: string;
	// ⭑ SET ONLY WHEN THE TOOL REPORTED ITS OWN IDENTITY. `undefined` here is not "no producer" — it is "the tool
	// told us only its answer", which is a different fact and grades the evidence weaker rather than absent.
	let produced: ToolInvocationResult | undefined;
	try {
		const returned = await input.session.turn(turnText);
		if (isToolInvocationResult(returned)) {
			produced = returned;
			adapterAnswer = returned.answer;
			rawReply = returned.rawOutput;
		} else {
			// ⭐ `JAN-NOANS` — A BARE STRING IS STILL CLASSIFIED, because a one-shot CLI's empty stdout is exactly
			// as much a non-answer as a refused provider's silence. `answerFromText` is the single place that
			// decides what an empty string means, so the three seams returning one cannot drift.
			adapterAnswer = answerFromText(returned);
			// A tool that told us only its answer told us the whole reply too — there is no interior it withheld.
			rawReply = returned;
		}
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
			// ⭐⭐ SPONSOR RULING (`JAN-NOANS`, 2026-09-20): a THROWN call is `no-response`, not `rejected`.
			//
			// ⛔ `rejected` IS A PRODUCER-FAULT DISPOSITION AND THE PRODUCER COMMITTED NO FAULT HERE. It says an
			// answer arrived and was refused; on this arm the call never returned one. `REG-F-338` states the
			// cost of the shape in general — *"worse than a lost record: it is a false one"* — and the ratified
			// vocabulary note for `NO_RESPONSE` names *"a timeout or abort"* as its own referent, which is
			// precisely this arm.
			//
			// ⭑ THE TWO NON-ANSWERS STAY DISTINGUISHABLE, which is why only the DISPOSITION moves. This arm keeps
			// `NOT_ATTEMPTED` and the silent-turn arm below carries `EMPTY_RESPONSE`: *the call broke* and *the
			// call returned holding nothing* are different facts with different remedies, and E-5 is where that
			// difference belongs. Collapsing them into one disposition AND one outcome would be the finding.
			disposition: 'no-response',
			attemptOrdinal: 1,
			requestedAt,
			respondedAt,
			parseOutcome: {
				outcome: 'NOT_ATTEMPTED',
				detail: `The model call itself failed: ${e instanceof Error ? e.message : String(e)}`
			},
			// ⭐⭐ R11 — THE ARM THAT MAKES THE FOURTH MEMBER REAL, AND IT IS NOT THE SAME ABSENCE AS A REVIEWER'S.
			// This step DOES owe a work product; the call failed before one existed. Recording that as
			// `NO_WORK_PRODUCT_EXPECTED` would file an execution failure as though it were an assurance call,
			// and a reader auditing which steps produced nothing would never find it.
			// ⚠ THE REASON DOES NOT QUOTE THE ERROR. `parseOutcome.detail` one field up already carries it, and a
			// second copy of an untrusted diagnostic is a second copy to redact and one that nothing will.
			workProductDerivation: {
				relation: 'EXPECTED_BUT_UNRETAINED',
				reason:
					'This MODEL_INVOCATION step owed a work product and none was retained: the model call itself ' +
					'failed before any answer arrived, so there was nothing to separate out of an answer span and ' +
					'nothing to store. The failure is quoted verbatim in this record’s parseOutcome detail.'
			},
			// ⭐⭐ `B-2` — THE ADAPTER IS **ASKED**, BECAUSE A FAILED CALL IS NOT THE SAME FACT AS A BLIND ONE.
			//
			// ⛔ THIS ARM USED TO ASSERT `NOT_OBSERVABLE` WITH ITS OWN SENTENCE — *"no adapter returned a result
			// and nothing was in a position to observe tool calls"* — AND THAT WAS FALSE FOR THE PI ADAPTER.
			// Its observer is SESSION-scoped, subscribed inside `turn()` and unsubscribed in a `finally`: when
			// `prompt` rejects it already HOLDS every call the model made before the failure. Writing the
			// sentence here made one caller speak for every adapter, and it spoke wrongly for the only one that
			// can see. ⚠ `R11` minted `NOT_OBSERVABLE` to mean *"nothing could look"*; using it for *"the call
			// failed"* collapses the two facts the discriminator exists to separate — and collapses them in the
			// direction that hides commands a model ran before it broke the run.
			//
			// ⭑ SO THE FACT COMES FROM THE PARTY THAT HOLDS IT. An adapter that genuinely could not look says so
			// in its OWN words (`oneShotSession` does, and its reason is about being one-shot rather than about
			// this failure), and an adapter that could look reports what it saw — which `governedToolCallReport`
			// then grades `OBSERVED` or `NONE_OBSERVED` by the same rule it applies on the success path.
			observedToolCalls: governedToolCallReport(input.session.lastTurnObservation()),
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
	// ── ⭐⭐ `JAN-NOANS` — A TURN THAT YIELDED NOTHING IS NOT A TURN THAT ANSWERED BADLY (`REG-F-410`) ────────
	//
	// ⛔ THIS ARM DID NOT EXIST, AND ITS ABSENCE IS THE FINDING. A live run was configured with a model the
	// provider refuses outright; `session.prompt` RESOLVED, no text ever arrived, and execution fell straight
	// down the success path below. The record then said `disposition: ACCEPTED`, `SCHEMA_COERCION_FAILED` —
	// *"The answer is not a JSON object"* — and addressed `sha256:e3b0c442…`, the hash of the EMPTY STRING, as
	// the work product every downstream assessment rested on. Three zero-byte artifacts were recorded and nine
	// assurance assessments ran over them.
	//
	// ⭑ IT SITS **BEFORE** `splitExecutionEnvelope` AND BEFORE `store.put`, AND BOTH ARE DELIBERATE. The
	// envelope splitter can only report a PRODUCER shortfall, because that is the only thing it is able to
	// report — so anything that reaches it has already been attributed to the producer. And `put` is what
	// mints the zero-byte artifact: gating after it would record the object and then decline to use it.
	if (!adapterAnswer.arrived) {
		const respondedAt = input.now();
		await captureTry({
			store: input.store,
			sink,
			tenantPrefix: input.tenantPrefix,
			exchangeId,
			role: 'initial',
			// ⛔ THE **WEAKER** IDENTITY, NOT THE TOOL'S REPORTED ONE, AND THIS IS NOT AN OVERSIGHT. The success
			// path below reads `produced.identityEvidence`, which the Pi adapter hardcodes `PROVIDER_REPORTED`.
			// On a refusal the provider reported that it would NOT run this model — grading that as the provider
			// CONFIRMING the model turns the one field a reader would use to diagnose the fault into a false
			// record. The `catch` arm directly above already uses this shape, for the same reason.
			model: { modelId: input.modelId, providerId: input.providerId },
			prompt: produced?.materializedInput ?? turnText,
			rawOutput: rawReply,
			disposition: 'no-response',
			attemptOrdinal: 1,
			requestedAt,
			respondedAt,
			parseOutcome: noAnswerOutcome(adapterAnswer),
			// ⭑ `EXPECTED_BUT_UNRETAINED`, THE SAME MEMBER THE `catch` ARM USES AND FOR THE SAME REASON. This
			// step OWED a work product and none exists. ⛔ What it must never do is what the live run did:
			// declare `WHOLE_ANSWER_SPAN` over `sha256:e3b0c442…` — the empty string — and thereby name an
			// address for bytes every downstream assessment would then rest on.
			workProductDerivation: {
				relation: 'EXPECTED_BUT_UNRETAINED',
				reason:
					'This MODEL_INVOCATION step owed a work product and none was retained: no answer bytes ' +
					'arrived, so there was nothing to separate out of an answer span and nothing to store. What ' +
					'became of the turn is stated verbatim in this record’s parseOutcome detail.'
			},
			// ⭑ THE ADAPTER IS ASKED, exactly as on the `catch` arm — the party that drove the session is the
			// only one that knows whether it was in a position to watch. Its RETURNED observation is preferred
			// over `lastTurnObservation()` because an adapter that knows no model ran downgrades the returned
			// one to `NOT_OBSERVABLE`, and `NONE_OBSERVED` here would assert a model was watched and called
			// nothing.
			observedToolCalls: governedToolCallReport(
				produced?.observedToolCalls ?? input.session.lastTurnObservation()
			),
			promptTemplateFingerprint: plan.fingerprint,
			// ⭐ `JAN-MHX` MH-1 (D20) — a CLI executor hands on its CLI's record only for a turn that breached, and on that
			// turn it is the only account of what the CLI did, so it is kept beside the try.
			...(produced?.sessionExport === undefined ? {} : { breachRecord: produced.sessionExport })
		});
		record(input, sink);
		return {
			ran: false,
			refusedBecause: noAnswerRefusal(adapterAnswer)
		};
	}
	answer = adapterAnswer.text;

	const envelope = splitExecutionEnvelope(answer);
	answer = envelope.workProduct;

	// ⭐⭐ THE WORK PRODUCT IS STORED BEFORE THE TRY IS RECORDED, SO THE RECORD CAN NAME IT.
	//
	// ⛔ THE ORDER IS THE WHOLE POINT AND IT USED TO BE THE OTHER WAY ROUND. Under the Phase 0 ruling the answer
	// span is the ENVELOPE and the artifact is the WORK PRODUCT, so they are no longer one content-addressed
	// object and the relationship that was free — equal bytes, equal key — has to be DECLARED. A declaration
	// cannot name an address that does not exist yet, so the `put` moves above the capture.
	const stored = await input.store.put({
		tenantPrefix: input.tenantPrefix,
		bytes: answer,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});

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
		// ⭐ THE TRUE REPLY, WHICH IS WHAT THE FIELD HAS ALWAYS PROMISED. It used to receive `answer` — already
		// stripped and already envelope-split — so the field named "raw output BEFORE coercion" carried the value
		// AFTER two coercions, and §9.7's separation could never run for an execution step.
		rawOutput: rawReply,
		disposition: 'accepted',
		attemptOrdinal: 1,
		requestedAt,
		respondedAt,
		// ⭐⭐ E-5 NOW CARRIES THE ARTIFACT→ANSWER-SPAN RELATION, because the ruling took away the one that was
		// free. This read *"An execution step answer is a work product; no schema coercion applies"* — true while
		// the answer half WAS the work product, false the moment it became the envelope.
		// ⚠ E-5 NO LONGER CARRIES THE ADDRESS — `R11` MOVED IT TO A TYPED FIELD. What stays here is E-5's own
		// job: the outcome member and, on the shortfall arm, the producer's own words for what went wrong.
		parseOutcome: describeWorkProductDerivation(envelope),
		// ⭐⭐ R11 — THE RELATION, TYPED. Phase 0 took away the guarantee that `art.storageKey ===
		// answerSpanRef.storageKey`; this is what replaces it, and it is now a field a reader can query rather
		// than a tag they must grep for inside a sentence.
		workProductDerivation: declareWorkProductDerivation(envelope, stored),
		// ⭐⭐ R11 — AND THE ADAPTER'S OWN OBSERVATION, WHICH IS THE HALF §22.1 IS ABOUT. `produced` is undefined
		// when the seam returned a bare string; that is a tool which told us only its answer, so it reported
		// nothing about tool calls and this record says exactly that instead of an empty list.
		observedToolCalls: governedToolCallReport(
			produced?.observedToolCalls ?? {
				canObserve: false,
				reason:
					'The backing tool returned only an answer string, so it reported nothing about tool calls. ' +
					'This record therefore says nothing about whether any ran — it is not evidence that none did.'
			}
		),
		promptTemplateFingerprint: plan.fingerprint
	});

	const recording = record(input, sink);

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
