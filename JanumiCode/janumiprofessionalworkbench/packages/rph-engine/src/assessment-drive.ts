// Driving an assurance assessment through the ratified §30 lifecycle — one place, so the call sites cannot drift.
//
// ── WHY THIS EXISTS (REG-F-021 increment 4, design §5.1) ──────────────────────────────────────────────────────
// Reaching `ASSESSING` is no longer one dispatch. DOC-004 §32 names the acts separately and §30 orders them:
//
//   requestAssuranceAssessment   REQUESTED -> EVIDENCE_PENDING   (+ AssuranceEvidenceRequired names the required set)
//   submitEvidenceForAssessment  EVIDENCE_PENDING -> READY       (when the last ALL-gating requirement is satisfied)
//   selectAssuranceEvaluator     READY -> READY                  (records WHO will assess; does not advance)
//   beginAssuranceAssessment     READY -> ASSESSING              (+ AssuranceAssessmentStarted, and startedAt)
//
// Three production paths need that sequence: the de minimis floor recorder, the reference undertaking, and the
// demo's undertaking route. Each re-implementing it is how four call sites end up disagreeing about a lifecycle —
// which is the class of defect REG-F-021 itself is.
//
// ── WHAT IT DOES NOT DO, STATED PLAINLY ──────────────────────────────────────────────────────────────────────
// It does NOT reduce the traffic. Design §5.1 weighed a fused composite command against faithful sequencing and
// recommended sequencing: §32 names these commands separately, so fusing them would leave a §32-named command
// unbuilt AND invent a shape the corpus does not name. The cost is real and small — the floor recorder issues one
// assessment per floor policy, three per subject, so this adds roughly six in-process dispatches per recording.
// This helper buys ONE thing: the sequence is written once. Anyone reading it for a performance win will be
// disappointed, which is why the point is made here rather than left to be discovered.
//
// It is also NOT a way to skip a refusal. Every command goes through `send`, which is the caller's real dispatch
// path with its own accept/reject handling — the helper composes ratified commands, it does not privilege them.
import type { ActorReference } from '@janumipwb/rph-contracts';

/**
 * The caller's dispatch seam. Deliberately the shape the engine's own senders already have
 * `(commandType, targetAggregateType, targetAggregateId, payload)`, so no call site has to adapt to the helper.
 * Callers that check results do so inside their own `send`; this helper never inspects one, because a helper that
 * swallowed a refusal would be the "arrangement that did not happen" REG-F-015 exists to catch.
 */
export type AssessmentDriveSend = (
	commandType: string,
	targetAggregateType: string,
	targetAggregateId: string,
	payload: unknown
) => void;

/** Evidence to submit between the request and the begin — one entry per requirement being satisfied. */
export interface AssessmentEvidenceSubmission {
	readonly evidenceId: string;
	readonly satisfiesRequirementId: string;
	readonly evidenceType?: string;
}

export interface DriveAssessmentToAssessingArgs {
	readonly assessmentId: string;
	readonly assurancePolicyId: string;
	readonly policyVersion: string;
	readonly subjectObjectIds: readonly string[];
	readonly subjectSemanticVersions: Readonly<Record<string, number>>;
	readonly claimIds?: readonly string[];
	/**
	 * Evidence satisfying the policy's requirements. REQUIRED when the policy declares any requirement with
	 * `requiredForDispositions: 'ALL'` — those gate the EVIDENCE_PENDING -> READY arrow, so without them the
	 * assessment stays in EVIDENCE_PENDING and `beginAssuranceAssessment` is correctly REFUSED.
	 *
	 * Today no production policy declares any (REG-F-022), so every production caller passes none and every
	 * assessment lands in READY directly. That is a fact about the CATALOG, not about this helper — the parameter
	 * exists so the helper stays correct the day REG-F-022 is fixed, rather than starting to fail then.
	 */
	readonly evidence?: readonly AssessmentEvidenceSubmission[];
	/** The evaluator to record before beginning. Omitted → no `selectAssuranceEvaluator` act is performed. */
	readonly evaluator?: ActorReference;
	/** When assessment began; omitted → the engine's clock at the begin command. */
	readonly startedAt?: string;
}

const ASSESSMENT = 'ASSURANCE_ASSESSMENT';

/**
 * Request an assessment and drive it to `ASSESSING`, issuing each ratified §32 command in §30's order.
 *
 * SELECTING AN EVALUATOR IS OPTIONAL AND THAT IS DELIBERATE. §30 names both acts on the READY -> ASSESSING arrow,
 * but only `beginAssuranceAssessment` moves the machine; an omitted selection means no governed record of WHO
 * assessed, which the completion path still tolerates by reading the evaluator off the verdict. Callers that can
 * name their evaluator should — that record is the governance guarantee this increment buys — but the helper does
 * not fabricate one, because inventing an evaluator to fill a field is worse than the gap it papers over.
 */
export function driveAssessmentToAssessing(
	send: AssessmentDriveSend,
	args: DriveAssessmentToAssessingArgs
): void {
	send('RequestAssuranceAssessment', ASSESSMENT, args.assessmentId, {
		assessmentId: args.assessmentId,
		assurancePolicyId: args.assurancePolicyId,
		policyVersion: args.policyVersion,
		subjectObjectIds: [...args.subjectObjectIds],
		subjectSemanticVersions: { ...args.subjectSemanticVersions },
		claimIds: [...(args.claimIds ?? [])]
	});
	for (const e of args.evidence ?? [])
		send('SubmitEvidenceForAssessment', ASSESSMENT, args.assessmentId, {
			evidenceId: e.evidenceId,
			satisfiesRequirementId: e.satisfiesRequirementId,
			...(e.evidenceType !== undefined ? { evidenceType: e.evidenceType } : {})
		});
	if (args.evaluator)
		send('SelectAssuranceEvaluator', ASSESSMENT, args.assessmentId, { evaluator: args.evaluator });
	send('BeginAssuranceAssessment', ASSESSMENT, args.assessmentId, {
		...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {})
	});
}
