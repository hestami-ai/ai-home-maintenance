// recordAssuranceRecordingPlan — persist a floor RECORDING PLAN as canonical ASSURANCE_ASSESSMENT +
// ASSURANCE_OBSERVATION objects, entirely through live commands (§8.9 layer 3 — the Assurance-Service recording arm).
// For each policy that produced a Validator result: request the assessment (created directly in ASSESSING), record
// each proposed observation (OPEN, carrying the Validator's specific finding code + severity), then complete the
// assessment to the floor-computed disposition. Boundary pseudo-dispositions were already folded to INCONCLUSIVE by
// assuranceRecordingPlan, and the AssuranceAssessment.state machine independently rejects any illegal transition.
// This is validator-AGNOSTIC and plane-AGNOSTIC: authoring- and execution-plane hosts hand it the same plan shape.
// exec≠assurance (INV-5) is upheld structurally — nothing here reads executionState.
import type { AssuranceRecordingPlan } from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { EngineHandle } from './engine.js';

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
		send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: { dispositionRecommendation: a.disposition }
		});
	});

	return { assessmentIds, observationIds };
}
