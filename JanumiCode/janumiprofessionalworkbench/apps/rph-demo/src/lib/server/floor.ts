// The in-product de minimis assurance floor (guide §8.4) for the PWA authoring plane. After an authoring turn the
// server runs the ordered floor over the DRAFT PWA graph — schema/invariant + identity/provenance (deterministic) +
// an INDEPENDENT Reasoning Review (agy/Gemini in dev/prod, the structural mock under E2E; a different vendor than the
// Pi authoring executor — exec != assurance, INV-5) — and persists the outcome as canonical ASSURANCE_ASSESSMENT +
// ASSURANCE_OBSERVATION objects via the shared recorder. Nothing here self-dispositions; composeAssuranceOutcome does
// the strictest-unresolved composition, and the PublishPwa gate (rph-application) enforces it.
import { analyzePwaGraph } from '@janumipwb/rph-projections';
import {
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	type AssuranceSubject,
	type IdentityProvenanceFacts,
	type ProfessionalRationaleSummary,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import {
	getObject,
	listAssessments,
	listDecisions,
	listObservations,
	recordAssuranceRecordingPlan,
	type AuthedEngineHandle
} from '@janumipwb/rph-engine';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { createFloorRegistry } from './assurance/index.js';
import { stipulationFor } from './stipulations.js';
import type { AgyPrint } from './assurance/reasoning-review-validator.js';
import { createExchangeSink } from './assurance/exchange-capture.js';
import { recordExchanges } from './assurance/exchange-recorder.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { canonicalActsOf } from './authoring-turn.js';
import { buildPwaExport, getArtifactStore, getEngine, hostNow, isTestMode, mintUiId } from './workbench.js';

/**
 * Read the ACTIVE `floor.reasoning-review` policy's criteria FROM THE STORE — the store→runtime content path.
 *
 * THIS FUNCTION IS THE INCREMENT. Until now the rubric and the scored criterion set both keyed off the
 * `REASONING_REVIEW_CRITERIA` constant in `rph-assurance`, so the seeded ASSURANCE_POLICY object was a
 * PROJECTION of the code: written once at seed time and never read again. Editing it would have changed the UI
 * card and nothing in the evaluation — "a policy that lies about what it checks". The constant is now only the
 * SEED; the policy object is the source.
 *
 * This lives in the composition root, not in `rph-assurance`, on purpose: that package may not import the
 * engine (the package DAG forbids it, and `boundary` enforces it), so the app reads the store and passes plain
 * data in. That is what keeps the Validator subsystem store-free while still letting the policy govern it.
 *
 * FAIL-CLOSED, and §13.3 L2227 names this case literally — "Fail closed on missing identity, tenant, POLICY,
 * schema, or authority context". A missing or empty policy must NOT silently fall back to the constant: that
 * would restore the projection at the exact moment the policy stopped being readable, which is the worst
 * possible moment. §8.4 L854 agrees — a required review that is unavailable "cannot satisfy assurance or permit
 * its protected transition".
 */
/** ⭑ EXPORTED FOR THE EXECUTION PLANE (`JAN-EXECREVIEW`). The work-product review is governed by the SAME
 *  policy object as the authoring review, read from the store. Restating the rubric in a second module is
 *  how four descriptions of one AssessmentCriterion came to disagree — the defect this function's own
 *  fail-closed errors exist to prevent, one plane over. */
export function reasoningReviewCriteria(engine: AuthedEngineHandle): readonly AssessmentCriterion[] {
	const policy = getObject(engine, FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!policy) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} ASSURANCE_POLICY is not in the store, so its criteria cannot govern the review. Seed the floor policies before running the floor.`
		);
	}
	const criteria = policy.criteria;
	if (!Array.isArray(criteria) || criteria.length === 0) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} policy records no criteria, so a Reasoning Review over it would assert a rubric no policy declares.`
		);
	}
	return criteria as AssessmentCriterion[];
}

// ⚠ `FLOOR_ACTOR` WAS HERE — `{ actorId: 'assurance-svc', actorType: 'SERVICE' }`, passed to
// `recordAssuranceRecordingPlan` as the declared issuer of every assessment/observation command.
//
// It was a string, not an identity. No authenticator issued `assurance-svc`, no credential resolves to it, and
// once the engine began stamping the authenticated principal the declaration became a DISAGREEMENT — refused
// (REG-D-027(b)), which surfaced as `BLOCKED_EXTERNAL · the reviewer call failed` on every authoring turn that
// reached assurance. The floor was not failing; recording its result was.
//
// The issuer is now the caller's authenticated handle, and the identity that carries assurance meaning — the
// independent EVALUATOR §8.12 checks — was never this field: it rides in `validatorResult.executionProvenance`.

/** The ACTUAL producer of the graph under review. §8.12 checks independence against real model/provider identity —
 *  "not a role label such as 'Verifier'" — so this is resolved per run and never a compile-time constant. It was
 *  previously the literal `authoring-executor`, which made `checkIndependence(DIFFERENT_MODEL, …)` a comparison of
 *  two constants: it could never fail, and certified independence on every run. */
export interface FloorProducer {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

export interface FloorObservationView {
	readonly code: string;
	readonly severity: string;
	readonly statement: string;
}

export interface FloorPolicyView {
	readonly policyId: string;
	readonly disposition: string;
	readonly independenceOk: boolean;
	readonly observations: FloorObservationView[];
	/** ⭐ WHAT THE VERDICT RESTS ON (`JAN-CRITREAD` J1-2; §4.4): recorded criteria a reviewer EVALUATED, and criteria a
	 *  TEST stipulated (`REG-D-071`). Optional: absent on a view built before any criterion was recorded. */
	readonly criteria?: CriterionTally;
}

/** ⭐ `JAN-CRITREAD` J1-2 — a policy's recorded criteria, split by who answered them. */
export interface CriterionTally {
	/** A reviewer reached a result (anything but `UNABLE_TO_DETERMINE`). */
	readonly evaluated: number;
	/** Nobody judged it; the TEST stipulated it clean (`UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it). */
	readonly stipulated: number;
}

/** Tally recorded criterion rows — `outcome` on the floor's own rows, `result` on the event that records them. */
export function tallyCriteria(
	rows: readonly { readonly outcome?: string; readonly result?: string; readonly stipulated?: string }[]
): CriterionTally {
	const result = (r: (typeof rows)[number]) => r.outcome ?? r.result;
	return {
		evaluated: rows.filter((r) => result(r) !== undefined && result(r) !== 'UNABLE_TO_DETERMINE').length,
		stipulated: rows.filter((r) => r.stipulated === 'MET').length
	};
}

/**
 * ⭐ THE ONE-LINE STATUS OF A FLOOR RUN, for the agent's log (`JAN-CRITREAD` J1-2; §4.4). A SATISFIED floor whose
 * reasoning review rests on a TEST's stipulations says so on the same line: the prefix every reader matches on is
 * kept, and what follows it is true.
 */
export function floorStatusLine(f: FloorView): string {
	if (f.satisfied) {
		const rr = f.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.criteria;
		if (rr && rr.stipulated > 0)
			return `⚖ Assurance floor SATISFIED (test mode) — schema and provenance pass; reasoning review: ${rr.evaluated} criteria evaluated, ${rr.stipulated} stipulated by the test, not reviewed.`;
		return '⚖ Assurance floor SATISFIED — schema, provenance, and an independent reasoning review all pass.';
	}
	const validFindings = classifyFloorRemediation(f).findings.length;
	const gaps = validFindings ? ` · ${validFindings} valid reasoning finding(s)` : '';
	return `⚖ Assurance floor ${f.aggregate}${gaps}.`;
}

/** ⭐ The "assured candidate" line, carrying the same disclosure beside the ✓ (§4.4). */
export function assuredCandidateLine(candidateHash: string, f: FloorView | undefined): string {
	const rr = f?.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.criteria;
	const disclosure =
		rr && rr.stipulated > 0
			? ` Its reasoning review rests on ${rr.stipulated} criteria stipulated by the test, not reviewed (test mode).`
			: '';
	return `✓ Assured candidate ${candidateHash} is staged.${disclosure} Canonical DRAFT is unchanged until you accept this exact preview.`;
}
export interface FloorView {
	readonly subjectId: string;
	readonly aggregate: string;
	readonly satisfied: boolean;
	/** True iff an EFFECTIVE governance WAIVER covers the subject. ⚠ THAT IS ALL IT MEANS. This docblock read
	 *  "— publication is permitted despite the floor", and it was the contract-level source of every waiver claim
	 *  the UI made: `data.floor.waived` gates the badge and the hint on the floor panel, and both said what this
	 *  line told them to say. ASR-3 makes the floor UNCONDITIONAL (REG-F-202), so an EFFECTIVE waiver permits
	 *  NOTHING here — it records accepted risk (ASR-14) while the floor keeps blocking. Fixing the markup without
	 *  fixing this line leaves the next reader authoring the same claim again. */
	readonly waived: boolean;
	readonly policies: FloorPolicyView[];
	/** Open Reasoning-Review observation statements for display. Remediation decisions MUST use the structured
	 *  policy/observation fields above: this list also contains operational findings when review execution fails. */
	readonly reasoningGaps: string[];
}

/** The authoring-plane response to an unsatisfied floor. Only a valid Reasoning Review finding about the reviewed
 *  subject may be sent back to the producing agent. Validator availability, execution, output-boundary, and
 *  independence failures are assurance-control failures; asking the producer to edit the graph in response would
 *  hide the failed control behind unrelated semantic mutation. */
export type FloorRemediationAction =
	| 'NONE'
	| 'REFINE_SUBJECT'
	| 'RETRY_OR_CONFIGURE_REVIEWER'
	| 'CHANGE_REVIEWER'
	| 'ESCALATE_REVIEW'
	| 'RESOLVE_OTHER_FLOOR_FINDINGS';

export interface FloorRemediation {
	readonly action: FloorRemediationAction;
	readonly autoRefine: boolean;
	/** Structured, valid subject findings that may be given to the authoring agent. Never operational failures. */
	readonly findings: readonly FloorObservationView[];
	/** Human/operator guidance. The route emits this verbatim after the fail-closed floor result. */
	readonly guidance: string;
}

const OPERATIONAL_REVIEW_CODES = new Set(['VALIDATOR_EXECUTION_FAILED', 'INDEPENDENCE_VIOLATION']);

/** The dispositions that JUDGED the subject and found something in it — the only ones whose findings may
 *  be sent back to the producer. Of `AggregateAssuranceDisposition`'s six members these are the two that
 *  assert something ABOUT THE WORK; the other four assert something about the REVIEW. */
const FEEDS_BACK_TO_PRODUCER: ReadonlySet<string> = new Set(['REJECTED', 'CONDITIONALLY_SATISFIED']);

/** Classify remediation from policy identity, disposition, independence, and observation CODES — never prose.
 *
 * `VALIDATOR_EXECUTION_FAILED` covers missing host configuration and external process/provider failures alike. The
 * exact operational diagnosis remains in the recorded observation, but all such cases have the same safe authoring
 * response: preserve the subject, repair/retry/change the independent Validator, and keep publication blocked.
 */
export function classifyFloorRemediation(floor: FloorView): FloorRemediation {
	if (floor.satisfied) {
		return { action: 'NONE', autoRefine: false, findings: [], guidance: '' };
	}

	const review = floor.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!review) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not produce a policy result. Configure or register a permitted independent reviewer, then rerun assurance. Do not revise the PWA or record a waiver in response to the missing review.'
		};
	}

	const executionFailure = review.observations.some((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
	if (executionFailure) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not execute. Configure or retry the reviewer; if it remains unavailable, change to a permitted independent validator and rerun assurance. Do not revise the PWA or record a waiver in response to this execution failure.'
		};
	}

	if (
		!review.independenceOk ||
		review.observations.some((o) => o.code === 'INDEPENDENCE_VIOLATION')
	) {
		return {
			action: 'CHANGE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was not independent of the producer. Select a permitted reviewer/model/provider that satisfies the policy independence rule, then rerun assurance. Do not revise the PWA or record a waiver in response to this independence failure.'
		};
	}

	if (review.disposition === 'ESCALATED') {
		return {
			action: 'ESCALATE_REVIEW',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was escalated. Route the recorded review to the governed human or alternate independent-review path, then rerun assurance; an automatic subject edit cannot substitute for the escalation.'
		};
	}

	const subjectFindings = review.observations.filter((o) => !OPERATIONAL_REVIEW_CODES.has(o.code));
	// ⛔ ONLY A DISPOSITION THAT ACTUALLY JUDGES THE SUBJECT MAY SEND WORK BACK TO ITS PRODUCER.
	//
	// This read `disposition !== 'SATISFIED'`, which swept in `INCONCLUSIVE` — and `REG-D-059` rules that out in
	// terms: *"INCONCLUSIVE — the reviewer could not tell — must not feed a finding back to the agent, because
	// there is no finding … Feeding an inconclusive review back as though it were a critique would MANUFACTURE
	// WORK FROM SILENCE."* `ASR-11` limb 1 says the same: a validator failure *"neither rejects nor satisfies
	// the subject."*
	//
	// ⚠ THE GAP WAS UNREACHABLE UNTIL A LIVE REVIEWER EXISTED. The offline arm returns INCONCLUSIVE only with
	// operational codes, which this filter already drops — so the condition could never be met and the defect
	// was invisible. A live model CHOOSES its disposition, and may return INCONCLUSIVE alongside subject-coded
	// observations.
	//
	// ⭑ `UNASSESSED` and `EVIDENCE_REQUIRED` are excluded for their own reasons, not by oversight: nothing
	// assessed the subject in the first, and the remedy is EVIDENCE rather than a subject edit in the second.
	if (FEEDS_BACK_TO_PRODUCER.has(review.disposition) && subjectFindings.length > 0) {
		return {
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: subjectFindings,
			guidance:
				'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.'
		};
	}

	// An unsatisfied/rejected/inconclusive review with no valid subject observations is not an instruction to mutate
	// the subject. It can arise from a missing or boundary-rejected Validator result whose prose is deliberately not
	// interpreted here. Treat it as an assurance-control problem and keep the gate closed.
	if (review.disposition !== 'SATISFIED') {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.'
		};
	}

	return {
		action: 'RESOLVE_OTHER_FLOOR_FINDINGS',
		autoRefine: false,
		findings: [],
		guidance:
			'PublishPwa remains blocked by non-review assurance findings. Resolve the coded schema, invariant, identity, or provenance findings and rerun the assurance floor.'
	};
}

/**
 * The identity/provenance/trace facts (§8.4 step 2) DERIVED from the real PWA object under review, not asserted.
 * These were five literal `true`s — a floor step that certifies itself and can never fail (findings 18/67; the
 * vacuity audit). Four are now computed: a PWA missing a stable id, a semantic version, a provenance record, or
 * an identified producer now fails IP-01/02/03/04 and blocks, as §8.4 step 2's checks require. "The engine
 * always adds provenance" is exactly the complacency the floor exists to counter — it re-checks rather than trusts.
 *
 * `traceComplete` (IP-05) stays asserted and is DISCLOSED as withheld: §8.4 step 2 names a "trace completeness"
 * check, but no ratified definition of trace-completeness exists as a computable predicate (the causal chain §5.6
 * describes is not contracted as one condition), and §0.3 forbids an agent inventing one. It becomes real the
 * moment that definition lands — the same posture as the readiness guard's withheld limbs and the waiver.
 */
export function identityProvenanceFactsOf(
	pwa: Record<string, unknown>,
	producer: FloorProducer
): IdentityProvenanceFacts {
	const id = pwa.id;
	const prov = pwa.provenance as { originType?: unknown } | undefined;
	return {
		hasStableId: typeof id === 'string' && id.length > 0,
		hasSemanticVersion: Number(pwa.semanticVersion) >= 1,
		hasProvenance: !!prov && typeof prov.originType === 'string' && prov.originType.length > 0,
		hasProducer:
			producer.agentId.length > 0 &&
			(producer.modelId.length > 0 || producer.providerId.length > 0),
		traceComplete: true // WITHHELD — no ratified trace-completeness definition; see the doc comment.
	};
}

const isFloorPolicy = (id: unknown): boolean =>
	id === FLOOR_POLICY_IDS.SCHEMA_INVARIANT ||
	id === FLOOR_POLICY_IDS.IDENTITY_PROVENANCE ||
	id === FLOOR_POLICY_IDS.REASONING_REVIEW;

/** True iff an EFFECTIVE governance WAIVER Decision covers `subjectId`. ⚠ NOT "the auditable override of a
 *  blocking floor", which is what this said: under ASR-3 nothing overrides the floor. It is an auditable record
 *  of accepted risk, and the floor blocks regardless (REG-F-202). */
function hasEffectiveWaiver(engine: AuthedEngineHandle, subjectId: string): boolean {
	// WORKSPACE, and deliberately so (SPEC-001 INV-02 / FORK-9): this lookup's subject is the `subjectId` argument
	// filtered below, not an Undertaking. A waiver may be authored anywhere in the workspace and still cover this
	// subject, so narrowing the read to one Undertaking would hide legitimate overrides.
	return listDecisions(engine, { kind: 'WORKSPACE' }).some(
		(d) =>
			d.state.decisionType === 'WAIVER' &&
			d.state.status === 'EFFECTIVE' &&
			(d.state.subjectObjectIds as string[] | undefined)?.includes(subjectId)
	);
}

/** How many times the canonical exchange drain tries a write the store reported BUSY before recording the shortfall. */
const BUSY_ATTEMPTS = 3;

/**
 * ⭑ `JAN-CRITREAD` `DD-1`: a busy store must not lose a try (PER-9). Every outermost write now takes the store's
 * lock up front, so a write that meets another process's long commit waits the busy timeout and then fails with
 * `RPH_STORE_BUSY` — nothing written. For the record of an act that happened, that is a bounded retry, then the
 * disclosed shortfall the drain already reports. Any other failure is not retried.
 */
function retryingWhenBusy(handle: AuthedEngineHandle): Pick<AuthedEngineHandle, 'dispatch'> {
	return {
		dispatch(command) {
			for (let attempt = 1; ; attempt += 1) {
				try {
					return handle.dispatch(command);
				} catch (error) {
					if ((error as { code?: unknown }).code !== 'RPH_STORE_BUSY' || attempt >= BUSY_ATTEMPTS) throw error;
				}
			}
		}
	};
}

/** Run the de minimis floor over the current DRAFT PWA graph and RECORD it as canonical assessments/observations.
 *  Returns the composed view (or undefined if the PWA/graph is unavailable). `priorGaps` are surfaced to the
 *  Reasoning Review so a re-run judges whether the previous findings are genuinely resolved. */
export async function runPwaFloor(
	pwaId: string,
	opts: {
		prompt: string;
		/** REQUIRED: the actual resolved producer. An unresolved producer means §8.12 independence cannot be
		 *  established, so there is no honest default — callers must supply it or not run the floor. */
		producer: FloorProducer;
		/** The §9.7 contracted account the producer RETURNED. Undefined = it declared none; the Validator records
		 *  that shortfall rather than inferring anything from the silence. */
		rationale?: ProfessionalRationaleSummary;
		/** Exact app-local semantic hash of the PWA/PWU-Type candidate reviewed in this run. */
		candidateSubjectHash?: string;
		/** MXR-05: the model call, injectable so the retention wiring is reachable in a gate rather than only
		 *  by spawning a real agy. See createFloorRegistry's own note. */
		print?: AgyPrint;
		/**
		 * The CANONICAL handle the exchange records are written through.
		 *
		 * ⛔ NEVER PASS THE CANDIDATE FORK HERE. The default is the workbench's canonical engine, and it is
		 * correct: a `MODEL_EXCHANGE` records an act that HAPPENED, so it must survive a discarded turn. This
		 * exists because `runPwaFloor` otherwise reaches module state (`getEngine()`), which no test can
		 * observe — the drain would dispatch into an engine the caller cannot see, and the wiring would be
		 * unassertable. Tests pass their own host; production omits it.
		 *
		 * ⛔ AND IT IS REFUSED WHEN `engine` IS AN ACTIVE AUTHORING TURN'S FORK (`JAN-CRITREAD` `TT-2`). There
		 * the drain goes through the turn's canonical WITNESS (`canonicalActsOf`), which is what lets the turn's
		 * commit admit its own reviewer's records. An explicit handle would drain unwitnessed and silently
		 * reproduce `REG-F-425`: a really-reviewed turn that refuses its own candidate.
		 */
		canonical?: AuthedEngineHandle;
		/** The content plane, injectable so a gate can assert against a store it controls. */
		artifacts?: ArtifactStore;
		/** The producer's observable narration — §8.4 admits "other observable trace data". Never its interior. */
		narration?: string;
		priorGaps?: string[];
	},
	// This path RECORDS an assurance floor, so it needs a session. SESSION rather than SYSTEM: the floor
	// is run because a professional asked for it, and the record should say so.
	engine: AuthedEngineHandle = getEngine().as(SESSION_CREDENTIAL)
): Promise<FloorView | undefined> {
	const witness = canonicalActsOf(engine);
	if (witness && opts.canonical) {
		throw new Error(
			'runPwaFloor on an authoring turn records its tries through the turn’s own canonical witness; ' +
				'an explicit `canonical` would drain them unwitnessed and the turn would refuse its own candidate.'
		);
	}
	const pwa = getObject(engine, pwaId);
	const graphExport = buildPwaExport(pwaId, engine);
	if (!pwa || !graphExport) return undefined;
	const report = analyzePwaGraph(graphExport);
	const subject: AssuranceSubject = {
		subjectId: pwaId,
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: Number(pwa.semanticVersion ?? 1),
		isAiProduced: true,
		producer: { actorType: 'AGENT' as const, ...opts.producer }
	};
	const ctx: ValidatorContext = {
		schemaInvariant: {
			schemaValid: true, // the PWA + PWU Types are engine-validated on creation
			invariantViolations: report.valid ? [] : ['PWA_GRAPH_NOT_WELL_FORMED']
		},
		identityProvenance: identityProvenanceFactsOf(pwa, opts.producer),
		reasoningReview: {
			// The POLICY's criteria, read from the store — not a constant. See reasoningReviewCriteria().
			criteria: reasoningReviewCriteria(engine),
			// ⭑ `R14` — DECLARED, NOT INFERRED. This arm is the original framing and the one the reviewers used to
			// reach as the FALSE half of a boolean; naming it means the graph arm is now chosen rather than
			// defaulted into, which is what stopped a third subject kind arriving there silently.
			framing: 'PWA_GRAPH',
			prompt: opts.prompt,
			content: JSON.stringify({
				...graphExport,
				...(opts.candidateSubjectHash ? { candidateSubjectHash: opts.candidateSubjectHash } : {})
			}),
			// §8.4 orders what Reasoning Review reviews: the contracted rationale summary FIRST, then outputs and
			// tool records, then other observable trace data. Both are passed through unconditionally — §9.7
			// forbids treating presence or absence as a signal, and a constant-shape input is also what makes the
			// §14.3 ablation a real test rather than a null one.
			...(opts.rationale ? { rationale: opts.rationale } : {}),
			narration: opts.narration ?? '',
			...(opts.priorGaps?.length ? { prior: { gaps: opts.priorGaps } } : {})
		}
	};
	// MXR-05. BOTH OR NEITHER: `captureTry` refuses a store supplied without a sink, because bytes retained
	// with no record referencing them are the orphan REG-F-336 C-2 forbids.
	//
	// ⚠ THE STORE IS PROCESS-LOCAL AND THAT IS LAWFUL ONLY BECAUSE IT IS DISCLOSED. This record plane is
	// durable (SQLite) while the content plane is not, so after a restart a permanent record names bytes that
	// are gone. REG-F-342 made that visible instead of silent: the store DECLARES its durability and every
	// stored ref carries it, so the record says on its face that its content is process-local. The §31 durable
	// adapter (MXR-07) is what turns the disclosure into a fix.
	const artifacts = opts.artifacts ?? getArtifactStore();
	const exchanges = createExchangeSink();
	const plan = await runFloorAndPlanRecording(
		subject,
		ctx,
		createFloorRegistry({
			testMode: isTestMode(),
			artifacts,
			exchanges,
			...(opts.print ? { print: opts.print } : {}),
			// ⭐ THE GRAPH ARM'S SUBJECT IS THE PWA ITSELF, so its registration is looked up by that id — and nothing is
			// read from any engine to do it, so a turn's fork sees no extra by-id read (`REG-D-072` D6).
			stipulations: (s, framing) => (framing === 'PWA_GRAPH' ? stipulationFor(s.subjectId, 'PWA_GRAPH') : undefined)
		}),
		// ⭐ THE ENGINE THIS FLOOR RECORDS INTO decides whether a stipulated answer counts (`REG-D-071` Q5) — the same
		// engine whose Gate E will judge the completion, so the two cannot disagree. Never `isTestMode()`.
		{ admitStipulatedAnswers: engine.admitStipulatedAnswers }
	);
	recordAssuranceRecordingPlan(engine, plan, {
		issuedAt: hostNow(),
		correlationId: opts.candidateSubjectHash
			? `authoring-floor:${opts.candidateSubjectHash}`
			: 'authoring-floor',
		idPrefix: mintUiId('floorrun'),
		newId: (prefix) => mintUiId(prefix)
	});
	// ⭑ THE DRAIN — PER-9's durable exchange record, one per bounded try.
	//
	// ⛔ ON THE CANONICAL HANDLE, DELIBERATELY, AND NOT ON `engine`. This function is called with
	// `turn.engine` — the authoring fork's CANDIDATE engine (`+server.ts:127`, `:153`). Dispatching there
	// would make every exchange record live or die with the turn, and a try that was MADE, cost money and
	// produced a bad answer is precisely the try PER-9 wants kept. Recording an act that happened is not
	// candidate state. That property is why REG-D-055 made this record its own aggregate, and routing it
	// through the fork would silently hand it back.
	//
	// ⭐ ON A TURN, THROUGH THE TURN'S WITNESS (`JAN-CRITREAD` `TT-2`, `REG-F-425`): the same canonical store and
	// the same SESSION principal, one dispatch per try — but the events it produces are NOTED as the turn's own
	// acts, so its commit admits them. Undrained through the witness, each try refused the turn's own candidate.
	const canonical = retryingWhenBusy(
		opts.canonical ?? witness?.as(SESSION_CREDENTIAL) ?? getEngine().as(SESSION_CREDENTIAL)
	);
	const drained = exchanges.drain();
	if (drained.length > 0) {
		const outcome = recordExchanges(
			(payload, aggregateId) =>
				canonical.dispatch({
					commandId: mintUiId('cmd'),
					commandType: 'RecordModelExchange',
					commandSchemaVersion: 1,
					targetAggregateType: 'MODEL_EXCHANGE',
					targetAggregateId: aggregateId,
					issuedAt: hostNow(),
					correlationId: `model-exchange:${pwaId}`,
					idempotencyKey: `mex:${aggregateId}`,
					payload
				}),
			drained,
			{
				runToken: mintUiId('floorrun'),
				plane: 'ASSURANCE',
				invokerId: 'agy.reasoning-review',
				assurancePolicyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				subjectObjectId: pwaId,
				subjectObjectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
				subjectSemanticVersion: 1,
				newId: (prefix) => mintUiId(prefix)
			}
		);
		// A retention fault must not fail an assurance run that already reached its conclusion — but it must
		// not vanish either. Surfacing it is the disclosed shortfall PER-9 permits; swallowing it is the
		// silent omission it forbids.
		if (outcome.failures.length > 0)
			console.warn(
				`[MXR] ${outcome.recorded}/${drained.length} exchange records written; ${outcome.failures.length} failed: ${outcome.failures.join('; ')}`
			);
	}

	const rr = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	return {
		subjectId: pwaId,
		aggregate: plan.aggregate,
		satisfied: plan.gatePermitsTransition,
		waived: hasEffectiveWaiver(engine, pwaId),
		policies: plan.assessments.map((a) => ({
			policyId: a.policyId,
			disposition: a.disposition,
			independenceOk: a.independenceOk,
			observations: a.observations.map((o) => ({
				code: o.code,
				severity: o.severity,
				statement: o.statement
			})),
			criteria: tallyCriteria(a.criteria)
		})),
		reasoningGaps: rr ? rr.observations.map((o) => o.statement) : []
	};
}

const includesSubject = (state: Record<string, unknown>, pwaId: string): boolean => {
	const s = state.subjectObjectIds;
	return Array.isArray(s) && (s as string[]).includes(pwaId);
};

interface LatestAssessment {
	readonly id: string;
	readonly state: Record<string, unknown>;
	readonly at: string;
}

/** Latest recorded floor assessment per policy for the subject (by updatedAt; ties → last seen). */
function latestFloorAssessments(
	engine: AuthedEngineHandle,
	pwaId: string
): Map<string, LatestAssessment> {
	const latest = new Map<string, LatestAssessment>();
	// WORKSPACE: the subject here is a PWA, which is not owned by any Undertaking — the `includesSubject(…, pwaId)`
	// filter on the next line is this query's real scope. An UNDERTAKING scope would return nothing.
	for (const a of listAssessments(engine, { kind: 'WORKSPACE' })) {
		if (!includesSubject(a.state, pwaId) || !isFloorPolicy(a.state.assurancePolicyId)) continue;
		const policyId = String(a.state.assurancePolicyId as string);
		const at = String((a.state.updatedAt ?? '') as string);
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at) latest.set(policyId, { id: a.id, state: a.state, at });
	}
	return latest;
}

/** Floor observations for the subject, grouped by their assessment id. */
function observationsByAssessment(
	engine: AuthedEngineHandle,
	pwaId: string
): Map<string, { code: string; severity: string; statement: string }[]> {
	const byId = new Map<string, { code: string; severity: string; statement: string }[]>();
	// WORKSPACE, for the same reason as the assessment fold above: the subject is a PWA.
	for (const o of listObservations(engine, { kind: 'WORKSPACE' })) {
		if (!includesSubject(o.state, pwaId)) continue;
		const aid = String((o.state.assessmentId ?? '') as string);
		const list = byId.get(aid) ?? [];
		list.push({
			code: String((o.state.findingCode ?? o.state.observationType ?? '') as string),
			severity: String((o.state.severity ?? '') as string),
			statement: String((o.state.statement ?? '') as string)
		});
		byId.set(aid, list);
	}
	return byId;
}

/** The panel's display aggregate from the per-policy dispositions. */
function floorAggregate(satisfied: boolean, policies: FloorPolicyView[]): string {
	if (satisfied) return 'SATISFIED';
	if (policies.some((p) => p.disposition === 'REJECTED')) return 'REJECTED';
	return 'UNASSESSED';
}

/**
 * The latest recorded result of each criterion of each named assessment, from `AssuranceCriterionEvaluated` — the
 * judgement lives on the EVENT (no state delta), so this is a fold, latest wins, as Gate E folds it.
 */
function latestCriterionRows(
	engine: AuthedEngineHandle,
	assessmentIds: ReadonlySet<string>
): Map<string, { result?: string; stipulated?: string }[]> {
	const byAssessment = new Map<string, Map<string, { result?: string; stipulated?: string }>>();
	for (const e of engine.readAllEvents()) {
		if (e.eventType !== 'AssuranceCriterionEvaluated' || !assessmentIds.has(e.aggregateId)) continue;
		const p = e.payload as { criterionId?: string; result?: string; stipulated?: string };
		if (typeof p.criterionId !== 'string') continue;
		const rows = byAssessment.get(e.aggregateId) ?? new Map();
		rows.set(p.criterionId, { result: p.result, stipulated: p.stipulated });
		byAssessment.set(e.aggregateId, rows);
	}
	return new Map([...byAssessment].map(([id, rows]) => [id, [...rows.values()]]));
}

/** The latest recorded floor outcome for a PWA, read back from the canonical ASSURANCE_ASSESSMENT/OBSERVATION
 *  objects (the read surface the UI renders). Undefined if no floor has been recorded for the subject yet. */
export function loadPwaFloor(
	pwaId: string,
	engine: AuthedEngineHandle = getEngine().as(SESSION_CREDENTIAL)
): FloorView | undefined {
	const latest = latestFloorAssessments(engine, pwaId);
	if (latest.size === 0) return undefined;
	const obsByAssessment = observationsByAssessment(engine, pwaId);
	const criteriaByAssessment = latestCriterionRows(engine, new Set([...latest.values()].map((a) => a.id)));
	const order = [
		FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
		FLOOR_POLICY_IDS.REASONING_REVIEW
	];
	const policies: FloorPolicyView[] = [];
	for (const policyId of order) {
		const a = latest.get(policyId);
		if (!a) continue;
		const obs = obsByAssessment.get(a.id) ?? [];
		policies.push({
			policyId,
			disposition: String((a.state.assessmentState ?? 'INCONCLUSIVE') as string),
			// Derived from the RECORDED violation, never asserted. This read-back path hardcoded `true`, so every
			// reader — the UI, any caller of loadPwaFloor — saw independence certified regardless of what actually
			// happened, while the run-path (runPwaFloor) carried the real value and dropped it at persistence. The
			// composer now persists an INDEPENDENCE_VIOLATION observation (§8.12), so its absence is a real signal.
			independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION'),
			observations: obs,
			criteria: tallyCriteria(criteriaByAssessment.get(a.id) ?? [])
		});
	}
	const satisfied = order.every((p) => latest.get(p)?.state.assessmentState === 'SATISFIED');
	const rr = latest.get(FLOOR_POLICY_IDS.REASONING_REVIEW);
	return {
		subjectId: pwaId,
		aggregate: floorAggregate(satisfied, policies),
		satisfied,
		waived: hasEffectiveWaiver(engine, pwaId),
		policies,
		reasoningGaps: rr ? (obsByAssessment.get(rr.id) ?? []).map((o) => o.statement) : []
	};
}
