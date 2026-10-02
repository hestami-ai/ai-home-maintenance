// recordAssuranceRecordingPlan — persist a floor RECORDING PLAN as canonical ASSURANCE_ASSESSMENT +
// ASSURANCE_OBSERVATION objects, entirely through live commands (§8.9 layer 3 — the Assurance-Service recording arm).
// For each policy that produced a Validator result: request the assessment (created directly in ASSESSING), record each
// observation the plan carries (OPEN, at its finding code + severity: the Validator's own, then the two the plan
// authors), then complete the assessment to the floor-computed disposition. Boundary pseudo-dispositions were already
// folded to INCONCLUSIVE by assuranceRecordingPlan, and the AssuranceAssessment.state machine independently rejects any
// illegal transition. This is validator-AGNOSTIC and plane-AGNOSTIC: authoring- and execution-plane hosts hand it the
// same plan shape. exec≠assurance (INV-5) is upheld structurally — nothing here reads executionState.
import type { AssuranceRecordingPlan, Identity } from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand, ObservationType } from '@janumipwb/rph-contracts';
import { driveAssessmentToAssessing } from './assessment-drive.js';
import type { AuthedEngineHandle } from './engine.js';

/** The ratified DOC-007 ActorType enum. The assurance-island `Identity.actorType` is a free string by design
 *  (the island is plane-agnostic), so the seam below must coerce it to a valid contract value. */
const CONTRACT_ACTOR_TYPES = new Set<ActorReference['actorType']>([
	'HUMAN',
	'AGENT',
	'MODEL',
	'SERVICE',
	'POLICY_ENGINE',
	'EXTERNAL_SYSTEM'
]);

/** Coerce an assurance-island actorType to a valid contract ActorType. The deterministic floor validators run
 *  as the island's internal `SYSTEM` evaluator, which is not a DOC-007 ActorType — a deterministic policy check
 *  is a `POLICY_ENGINE`. Anything else unexpected falls back to `SERVICE` (an assurance-service action). */
function toContractActorType(t: string | undefined): ActorReference['actorType'] {
	if (t && CONTRACT_ACTOR_TYPES.has(t as ActorReference['actorType']))
		return t as ActorReference['actorType'];
	return t === 'SYSTEM' ? 'POLICY_ENGINE' : 'SERVICE';
}

/**
 * Map an assurance-island `Identity` (the shape checkIndependence reasons over) onto the ratified DOC-007
 * `ActorReference` the Assessment object persists. The two are different by design — `Identity` is the
 * independence-check view, `ActorReference` the wire/storage view — so this is the single translation seam.
 * `invocationId` lands on `executionInstanceId` (§8.12's "actual invocation"); `roleId` is intentionally NOT
 * synthesized from a label — §8.12 forbids resting independence on a role label, and `Identity` carries none.
 */
function identityToActorReference(e: Identity): ActorReference {
	const label = e.agentId ?? e.modelId ?? 'evaluator';
	return {
		actorId: e.agentId ?? label,
		actorType: toContractActorType(e.actorType),
		displayName: e.modelId ? `${label} (${e.modelId})` : label,
		...(e.modelId ? { modelId: e.modelId } : {}),
		...(e.providerId ? { providerId: e.providerId } : {}),
		...(e.invocationId ? { executionInstanceId: e.invocationId } : {})
	};
}

/**
 * ⚠ `actor` IS GONE, AND IT WAS THE LAST SELF-DECLARED ISSUER IN A PRODUCTION BUILDER (REG-F-062).
 *
 * It read *"the actor recording the assessments (the Assurance Service acting on behalf of the host)"* — a
 * DELEGATION, stated in a field and backed by nothing. This repository has no delegation record (see
 * `proposeDecision`'s guard and REG-F-014's disposition), so "on behalf of" was the same fiction that guard
 * refuses, written one layer down where no guard was looking. Every caller passed a literal — `assurance-svc`
 * — that no authenticator has ever issued.
 *
 * The issuer is now whoever the CALLER'S HANDLE is authenticated as. That is less flattering and more true:
 * when the authoring turn runs the floor, the record says the turn's principal recorded it. Nothing is lost,
 * because the identity that actually matters here is the EVALUATOR — the independent reviewer §8.12 checks —
 * and that rides in `validatorResult.executionProvenance`, resolved per run, never a constant.
 *
 * ⚠ AND THE ISSUER MUST STAY THE CALLER'S. Recording under a dedicated assurance credential was the obvious
 * alternative and it is WRONG HERE: a staged authoring turn replays its recorded commands through ONE session,
 * so a command dispatched into the fork as a different principal would produce a different `createdBy` on
 * replay and fail the commit's content-hash postcondition. Per-command principals need a mechanism this
 * repository does not have; inventing one to make a nicer-looking `createdBy` is not a trade worth making.
 */
export interface RecordAssuranceOptions {
	readonly issuedAt: string;
	readonly correlationId: string;
	/** A stable prefix (unique per recording run) for command bookkeeping (commandId / idempotencyKey). */
	readonly idPrefix: string;
	/** Mints a ULID-format object id (`<prefix>_<26 Crockford chars>`) for each assessment/observation. */
	readonly newId: (prefix: string) => string;
}

export interface RecordedAssurance {
	readonly assessmentIds: readonly string[];
	readonly observationIds: readonly string[];
}

/** Map a floor policy to the closest ASSURANCE_OBSERVATION.observationType (§21). Contract/provenance floor failures
 *  are POLICY_VIOLATIONs; reasoning-review failures are FINDINGs. The precise floor code rides in `findingCode`.
 *  ⭐ `JAN-ESCREC` D2: the DEFAULT, for an observation the plan does not type — which is every one but the review's
 *  ESCALATED recommendation. Typed `ObservationType` so the plan's own union is checked against the ratified enum below. */
function observationTypeFor(policyId: string): ObservationType {
	return policyId === 'floor.reasoning-review' ? 'FINDING' : 'POLICY_VIOLATION';
}

export function recordAssuranceRecordingPlan(
	handle: AuthedEngineHandle,
	plan: AssuranceRecordingPlan,
	opts: RecordAssuranceOptions
): RecordedAssurance {
	const assessmentIds: string[] = [];
	const observationIds: string[] = [];
	let seq = 0;
	const send = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): void => {
		seq += 1;
		const command: DomainCommand = {
			commandId: `${opts.idPrefix}-cmd-${seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: opts.issuedAt,
			correlationId: opts.correlationId,
			idempotencyKey: `${opts.idPrefix}-idem-${seq}`,
			payload
		};
		const r = handle.dispatch(command);
		if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE') {
			throw new Error(
				`recordAssuranceRecordingPlan failed at ${commandType} (${targetAggregateId}): ${r.status} ${JSON.stringify(r.error)}`
			);
		}
	};

	plan.assessments.forEach((a) => {
		const assessmentId = opts.newId('asmt');
		assessmentIds.push(assessmentId);
		// Request-and-begin: the assessment is created directly in ASSESSING (see requestAssuranceAssessment).
		// The ratified §30 sequence, issued through the one helper that knows it (REG-F-021 increment 4). The floor
		// policies declare no ALL-gating evidence (REG-F-022), so the request lands in READY and the begin follows
		// directly; the helper stays correct the day that stops being true.
		driveAssessmentToAssessing(send, {
			assessmentId,
			assurancePolicyId: a.policyId,
			policyVersion: a.policyVersion,
			subjectObjectIds: [plan.subjectId],
			subjectSemanticVersions: { [plan.subjectId]: plan.subjectSemanticVersion },
			claimIds: []
		});
		// ⭐⭐ THE CRITERION RESULTS, WHICH USED TO STOP HERE (`JAN-CRITREAD` L3 `CB-03`).
		//
		// The floor computes every criterion's outcome (`a.criteria`) and, until now, dropped all of them at
		// this boundary — `claimResults: []` below, disclosed but unrepaired, because §20's only route for
		// per-criterion results is claim-keyed and a floor assessment carries `claimIds: []`. §32's
		// `recordCriterionResult` is the route that needs no claim id, and it was never built.
		//
		// ⛔ ONE DISPATCH PER CRITERION, AND THE HANDLER REFUSES ANY ID THE POLICY DOES NOT DECLARE — which
		// makes this loop a live check that the floor's computed ids and its policies' declared ids agree.
		// They do by construction (`floor.ts` mints `FS-01-schema`…`IP-05-trace` and `floor-policies.ts`
		// declares exactly those; the Reasoning Review derives its ids FROM the policy). ⚠ `send` THROWS on
		// any refusal, so a drift between those two lists takes the whole floor recording down rather than
		// silently recording less — which is the correct failure for a record that claims to be complete.
		//
		// ⭑ `mandatory` IS NOT SENT. The payload carries what was JUDGED; whether a criterion is mandatory is
		// the POLICY's declaration, derived at read time from `severityIfNotMet`. `R25`: the judged party
		// does not set its own stakes, and a payload that carried them would let it.
		a.criteria.forEach((c) => {
			send('RecordCriterionResult', 'ASSURANCE_ASSESSMENT', assessmentId, {
				criterionId: c.criterionId,
				// ⭑ THE RENAME IS THE WHOLE MAPPING, and it is between two spellings of ONE ratified vocabulary:
				// the kernel's `FloorCriterion.outcome` and DOC-007 §20.1's `CriterionResult.result` are both
				// `CriterionResultOutcome`. Nothing is converted; only the field name differs.
				result: c.outcome,
				// ⛔ CARRIED ONLY WHEN THE EVALUATOR PRODUCED ONE, AND NEVER SYNTHESIZED. `floor-policies.ts`
				// declares a `rationale` per criterion, and reusing it here would be a conflation: that is the
				// policy's reason for HAVING the criterion, not this assessment's reason for its OUTCOME. A MET
				// criterion the floor judged mechanically has no rationale, and an absent one stays absent.
				...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
				// ⭐ `REG-D-071` Q4 (form D): a stipulated row keeps `result: UNABLE_TO_DETERMINE` and carries the
				// test's answer BESIDE it. Carried only when present; absence means no stipulation.
				...(c.stipulated !== undefined ? { stipulated: c.stipulated } : {})
			});
		});
		// Record each observation the plan carries while ASSESSING (observations require the assessment to exist).
		a.observations.forEach((o) => {
			const observationId = opts.newId('obs');
			observationIds.push(observationId);
			// ⭐ `JAN-ESCREC` D2 — THE PLAN'S TYPE WHERE IT CARRIES ONE, ELSE THE POLICY'S DEFAULT. The review's ESCALATED
			// recommendation arrives typed RECOMMENDATION (`REG-D-090`); dropping that here would file it as a FINDING — a
			// fault the reviewer never reported. ⭑ The annotation is the compile-time tie between `rph-assurance`'s LOCAL
			// union (its `recording.ts` imports no contracts) and the ratified §21 enum; the command schema still refuses
			// any other value at dispatch. ⚠ The OBJECT keeps the type; the event does not carry one.
			const observationType: ObservationType = o.observationType ?? observationTypeFor(a.policyId);
			send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', observationId, {
				assessmentId,
				observationType,
				findingCode: o.code,
				severity: o.severity,
				statement: o.statement
			});
		});
		// Complete to the floor-computed disposition; the state machine rejects any illegal ASSESSING→disposition.
		//
		// THE VALIDATOR RESULT IS THE VERDICT. It is now the ratified DOC-007 §20 shape — sixteen fields, checked.
		// It used to be `{ dispositionRecommendation, evaluator }`: two fields, one of which §20 does not define,
		// and none of §20's sixteen. The comment here called validatorResult "an open channel" and used it to
		// smuggle the evaluator through — which was true only because `ValidatorResultSchema` was
		// `z.record(z.string(), z.unknown())`. Every field below was already computed by the island and thrown
		// away at this line. The starkest: `subjectSemanticVersions` — RequestAssuranceAssessment twenty lines
		// above already binds the assessment to the subject's semantic version, and the VERDICT named neither the
		// subject nor its version, which is exactly the binding Increment 10b established the floor cannot do
		// without (DOC-004 invariant 2: "Every assessment identifies its subject semantic version").
		send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				validatorId: a.validatorId,
				validatorVersion: a.validatorVersion,
				policyId: a.policyId,
				policyVersion: a.policyVersion,
				assessmentId,
				subjectObjectIds: [plan.subjectId],
				subjectSemanticVersions: { [plan.subjectId]: plan.subjectSemanticVersion },
				// STILL EMPTY, AND THE REASON IS NOW NARROWER (`JAN-CRITREAD` L3 `CB-03`). ⭐ THE CRITERION RESULTS
				// ARE NO LONGER DROPPED — every one is recorded above through §32's `recordCriterionResult`,
				// emitting the ratified §31 `AssuranceCriterionEvaluated`. What remains empty is this FIELD, and
				// only because §20 routes it through a CLAIM id the floor does not have. The paragraph below stated
				// that as a total loss; it was a loss of ROUTE, and the route existed in §32 unbuilt.
				// ⚠ WHAT IS STILL OPEN: nothing READS the recorded results yet. `RPH-CON-005`'s coverage gate asks
				// `validatorResult.claimResults`, which this does not change, so that rule stays
				// UNENFORCED_DISCLOSED. Recording is a precondition of enforcing, not the enforcing.
				//
				// ~~EMPTY, AND NOT BECAUSE THE FLOOR HAS NOTHING TO SAY — a surfaced gap, not a silent drop.~~
				// §20 routes per-criterion results ONLY through `claimResults: ClaimAssessmentResult[]`, and §33's
				// worked example nests them under a `claimId`. The floor's assessments carry `claimIds: []` (see
				// RequestAssuranceAssessment above): it evaluates CRITERIA against a subject, not claims. So its
				// criterion results have no ratified home in §20 without inventing a claim id, and inventing one
				// is the disease this whole program is treating. The verdict loses nothing — each criterion's
				// outcome already drives the disposition, and its failures already ride as observations below —
				// but the per-criterion detail the island computes (`a.criteria`) stops here. Recorded in
				// HARMONIZATION-LOG PART 4 rather than papered over.
				claimResults: [],
				evidenceConsideredIds: [...a.consideredEvidenceIds],
				evidenceRejected: [...a.rejectedEvidenceIds],
				// Shaped per §33's worked observation: `{findingCode, severity, statement, subjectObjectIds, …}`.
				// `ProposedAssuranceObservation` is referenced by §20 and defined nowhere in the corpus, so its
				// schema is a placeholder; §33 is the only ratified statement of its shape, so it is the model.
				observations: a.observations.map((o) => ({
					findingCode: o.code,
					severity: o.severity,
					statement: o.statement,
					subjectObjectIds: [plan.subjectId]
				})),
				dispositionRecommendation: a.disposition,
				// The floor recommends none: it reports whether the floor is met. Choosing control actions is the
				// controller's under §11 ("The controller selects and executes them under policy").
				recommendedControlActions: [],
				residualUncertainty: [...a.residualUncertainty],
				limitations: [...a.limitations],
				// WHERE THE EVALUATOR IDENTITY BELONGS. §9.7 asks for "the resolved provider/model/version actually
				// invoked" and §8.4 L851 for "actual identities and lineage recorded" — that is execution
				// provenance, not a field invented next to it. `ExecutionProvenance` is referenced by §20 and
				// defined nowhere, so its schema is a placeholder and this is the honest shape available.
				executionProvenance: a.evaluator ? { evaluator: identityToActorReference(a.evaluator) } : {}
			}
		});
	});

	return { assessmentIds, observationIds };
}
