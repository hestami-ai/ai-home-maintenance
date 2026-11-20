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
//
// ⭐ THE HISTORIAN'S ASSESSMENTS ARE LEFT OUT (`JAN-EXEC` Phase 7, package L17b2; the lead's ruling 18). At the sign-off of a unit its
// declared reviews reject, the harness's Historian assesses the unit under `pol_historical_consistency` — "a separate assessment, never
// folded into the unit's own assurance" (design D73). A unit whose type DECLARES that policy (ARCHITECTURE_DECISION's does; after
// D78 any kind may take it) would otherwise have the Historian's later assessment read here as its declared verdict, by every reader
// of this index: the satisfaction guard on both axes (RPH-PWU-007, RPH-ASR-012), D71's rework guard, the floor gate and the baseline
// promotion. A completed assessment's STATE names no validator; its completion EVENT does (`AssuranceAssessmentCompleted.validatorId`,
// measured: L17b2 facts §4.3), so the walk below, which already reads those events, tells the Historian's apart by it. ⚠ One the
// Historian has begun and not completed names no validator yet, so it cannot be told apart here: the harness records the Historian's
// assessment in ONE batch, from its request to its completion (ruling 5), so none is ever stored in progress.
import type { HandlerContext } from './kit.js';
import { withScanContext } from '@janumipwb/rph-ports';

/**
 * The validator id the harness's Historian completes its assessments under. ONE definition, shared by this index, which leaves those
 * assessments out, and by the app's Historian, which records it (exported from the package for that reason).
 */
export const HISTORIAN_VALIDATOR_ID = 'historian.historical-consistency';

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

/** Whether `e` completed an assessment under the Historian's validator id. */
function isHistorianCompletion(e: {
	readonly eventType: string;
	readonly payload: unknown;
}): boolean {
	if (e.eventType !== 'AssuranceAssessmentCompleted') return false;
	return (
		(e.payload as { readonly validatorId?: unknown } | undefined)?.validatorId ===
		HISTORIAN_VALIDATOR_ID
	);
}

/**
 * Index `subjectId`'s assessments by policy, keeping the LATEST per policy (see the ordering rule above), the Historian's left out.
 *
 * Pure with respect to the store: it reads events and objects and writes nothing.
 */
export function latestAssessmentByPolicy(
	ctx: HandlerContext,
	subjectId: string
): Map<string, SubjectAssessmentRecord> {
	const ids = new Set<string>();
	/** The assessments the Historian completed, read from the same walk (ruling 18). */
	const historians = new Set<string>();
	for (const e of ctx.store.readAllEvents()) {
		if (e.aggregateType !== 'ASSURANCE_ASSESSMENT') continue;
		ids.add(e.aggregateId);
		if (isHistorianCompletion(e)) historians.add(e.aggregateId);
	}
	const latest = new Map<string, SubjectAssessmentRecord>();
	// ⭑ AN ENUMERATION, NOT A BY-ID READ (`JAN-CRITREAD` `DD-6b`, `REG-D-070` §5.5): this walks the whole
	// population of a type, so its loads are the scan's, not a caller's dependency.
	withScanContext(() => {
		for (const id of ids) {
			if (historians.has(id)) continue;
			const s = ctx.store.loadObject(id)?.state as StoredAssessmentState | undefined;
			if (!s || !Array.isArray(s.subjectObjectIds) || !s.subjectObjectIds.includes(subjectId))
				continue;
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
	});
	return latest;
}
