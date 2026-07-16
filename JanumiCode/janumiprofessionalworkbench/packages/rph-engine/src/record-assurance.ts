// recordAssuranceRecordingPlan — persist a floor RECORDING PLAN as canonical ASSURANCE_ASSESSMENT +
// ASSURANCE_OBSERVATION objects, entirely through live commands (§8.9 layer 3 — the Assurance-Service recording arm).
// For each policy that produced a Validator result: request the assessment (created directly in ASSESSING), record
// each proposed observation (OPEN, carrying the Validator's specific finding code + severity), then complete the
// assessment to the floor-computed disposition. Boundary pseudo-dispositions were already folded to INCONCLUSIVE by
// assuranceRecordingPlan, and the AssuranceAssessment.state machine independently rejects any illegal transition.
// This is validator-AGNOSTIC and plane-AGNOSTIC: authoring- and execution-plane hosts hand it the same plan shape.
// exec≠assurance (INV-5) is upheld structurally — nothing here reads executionState.
import type { AssuranceRecordingPlan, Identity } from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { EngineHandle } from './engine.js';

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

export interface RecordAssuranceOptions {
	/** The actor recording the assessments (the Assurance Service acting on behalf of the host). */
	readonly actor: ActorReference;
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
 *  are POLICY_VIOLATIONs; reasoning-review failures are FINDINGs. The precise floor code rides in `findingCode`. */
function observationTypeFor(policyId: string): string {
	return policyId === 'floor.reasoning-review' ? 'FINDING' : 'POLICY_VIOLATION';
}

export function recordAssuranceRecordingPlan(
	handle: EngineHandle,
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
			issuedBy: opts.actor,
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
		send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			assessmentId,
			assurancePolicyId: a.policyId,
			policyVersion: a.policyVersion,
			subjectObjectIds: [plan.subjectId],
			subjectSemanticVersions: { [plan.subjectId]: plan.subjectSemanticVersion },
			claimIds: []
		});
		// Record each proposed observation while ASSESSING (observations require the assessment to exist).
		a.observations.forEach((o) => {
			const observationId = opts.newId('obs');
			observationIds.push(observationId);
			send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', observationId, {
				assessmentId,
				observationType: observationTypeFor(a.policyId),
				findingCode: o.code,
				severity: o.severity,
				statement: o.statement
			});
		});
		// Complete to the floor-computed disposition; the state machine rejects any illegal ASSESSING→disposition.
		// Carry the evaluator identity through validatorResult (an open channel) so the handler records WHO judged —
		// §9.7 "the resolved provider/model/version actually invoked", §8.4 "actual identities and lineage recorded".
		send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				dispositionRecommendation: a.disposition,
				...(a.evaluator ? { evaluator: identityToActorReference(a.evaluator) } : {})
			}
		});
	});

	return { assessmentIds, observationIds };
}
