// THE LATEST ASSESSMENT PER POLICY OVER ONE SUBJECT — the single store-side index two gates need.
//
// ── WHY IT IS A MODULE AND NOT A SECOND COPY ────────────────────────────────────────────────────────────────
// This walk lived as `latestFloorDispositions`, private to `floor-gate.ts`, and was named for the only caller
// it then had. Nothing about it is floor-specific: it answers "for this subject, what is the most recent
// assessment recorded under each policy", which is exactly the question the declared-policy satisfaction guard
// (`declared-assurance.ts`) also has to ask. Copying it would have put the SAME derivation behind two names,
// and the two would then differ on the one thing that decides both answers — which record wins when a policy
// has been assessed more than once.
//
// ── THE ORDERING RULE, STATED BECAUSE IT IS THE WHOLE DERIVATION ────────────────────────────────────────────
// LATEST BY `updatedAt`, ties resolved by LAST SEEN. A re-assessment supersedes its predecessor: a policy that
// rejected version n and satisfied it after remediation must read SATISFIED, or remediation could never clear a
// finding. `updatedAt` is the assessment aggregate's own envelope stamp, written by the kit from the COMMAND's
// `issuedAt` — so this replays deterministically from the event log rather than from a wall clock.
//
// ⚠ IT RETURNS EVERY LATEST ASSESSMENT, NOT ONLY CONCLUDED ONES. `assessmentState` is the assessment aggregate's
// own 15-value machine (DOC-004 §30): before completion it holds a lifecycle state (REQUESTED / EVIDENCE_PENDING
// / READY / ASSESSING), after completion it holds the disposition. Filtering here would make the floor gate — for
// which an assessment still ASSESSING is precisely NOT a satisfied floor — read an in-progress assessment as
// absent. Each caller states which states it treats as a verdict.
//
// ⛔ `StorageAdapter` OFFERS NO LIST-BY-TYPE, which is why this walks the event log for the aggregate ids and
// then loads each object. `handlers/assurance.ts` states the same constraint at its own SUPPORTS relation. The
// walk is bounded by the assessment count, and both callers are on refusal paths that run once per command.
import type { HandlerContext } from './kit.js';

/** One policy's most recent assessment over a subject, reduced to the four fields both gates read. */
export interface SubjectAssessmentRecord {
	/** The ASSURANCE_ASSESSMENT aggregate id — so a refusal can name the record a reader must go and look at. */
	readonly assessmentId: string;
	/** `assurancePolicyId` — the key this index is grouped by. */
	readonly policyId: string;
	/** The assessment's own state: a §30 lifecycle value before completion, the disposition after it. */
	readonly assessmentState: string;
	/**
	 * The subject semanticVersion this assessment BOUND (DOC-004 assessment invariant 2), or `undefined` when
	 * the record names none. `undefined` is "not stated", never "the current one".
	 */
	readonly subjectSemanticVersion: number | undefined;
	/** The ordering key this index resolved on, carried so a caller can explain a tie rather than assert one. */
	readonly at: string;
}

interface StoredAssessmentState {
	readonly assurancePolicyId?: string;
	readonly subjectObjectIds?: string[];
	readonly assessmentState?: string;
	readonly updatedAt?: string;
	readonly subjectSemanticVersions?: Record<string, number>;
}

/**
 * Index `subjectId`'s assessments by policy, keeping the LATEST per policy (see the ordering rule above).
 *
 * Pure with respect to the store: it reads events and objects and writes nothing.
 */
export function latestAssessmentByPolicy(
	ctx: HandlerContext,
	subjectId: string
): Map<string, SubjectAssessmentRecord> {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'ASSURANCE_ASSESSMENT') ids.add(e.aggregateId);
	const latest = new Map<string, SubjectAssessmentRecord>();
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as StoredAssessmentState | undefined;
		if (!s || !Array.isArray(s.subjectObjectIds) || !s.subjectObjectIds.includes(subjectId)) continue;
		const policyId = String(s.assurancePolicyId);
		const at = String(s.updatedAt ?? '');
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at)
			latest.set(policyId, {
				assessmentId: id,
				policyId,
				assessmentState: String(s.assessmentState),
				subjectSemanticVersion: s.subjectSemanticVersions?.[subjectId],
				at
			});
	}
	return latest;
}
