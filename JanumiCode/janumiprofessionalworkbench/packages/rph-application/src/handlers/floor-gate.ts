// Shared de minimis floor protected-transition logic (guide §8.4 step 4), PLANE-AGNOSTIC: given a subject, is its
// recorded assurance floor SATISFIED (or waived)? Reused by the authoring-plane PublishPwa gate (pwa-authoring) and
// the execution-plane completeExecutionStep gate (execution). Canonical floor policy ids are duplicated as literals
// (source of truth: @janumipwb/rph-assurance FLOOR_POLICY_IDS) because the package DAG forbids rph-application ->
// rph-assurance; they are stable canonical ids.
import type { HandlerContext } from './kit.js';

export const FLOOR_POLICY_IDS_REQUIRED = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
] as const;
/** A subject is AI-produced (floor-relevant) when its producing actor is an AGENT or MODEL. */
export const AI_ACTOR_TYPES = new Set(['AGENT', 'MODEL']);

interface FloorRecord {
	readonly disposition: string;
	readonly version: number | undefined;
	readonly at: string;
}

/** Latest recorded assessment (state + the subject semanticVersion it was recorded against) per floor policy for
 *  `subjectId`, by updatedAt (ties: last seen). */
function latestFloorDispositions(ctx: HandlerContext, subjectId: string): Map<string, FloorRecord> {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'ASSURANCE_ASSESSMENT') ids.add(e.aggregateId);
	const latest = new Map<string, FloorRecord>();
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			| {
					assurancePolicyId?: string;
					subjectObjectIds?: string[];
					assessmentState?: string;
					updatedAt?: string;
					subjectSemanticVersions?: Record<string, number>;
			  }
			| undefined;
		if (!s || !Array.isArray(s.subjectObjectIds) || !s.subjectObjectIds.includes(subjectId))
			continue;
		const policyId = String(s.assurancePolicyId);
		const at = String(s.updatedAt ?? '');
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at)
			latest.set(policyId, {
				disposition: String(s.assessmentState),
				version: s.subjectSemanticVersions?.[subjectId],
				at
			});
	}
	return latest;
}

/** True iff an EFFECTIVE WAIVER Decision (governance) covers `subjectId` — a recorded, auditable human override that
 *  lets a non-SATISFIED floor proceed (guide §8: a Governance Decision, not the Validator, grants authority). */
export function hasEffectiveFloorWaiver(ctx: HandlerContext, subjectId: string): boolean {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'DECISION') ids.add(e.aggregateId);
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			{ decisionType?: string; status?: string; subjectObjectIds?: string[] } | undefined;
		if (
			s?.decisionType === 'WAIVER' &&
			s.status === 'EFFECTIVE' &&
			Array.isArray(s.subjectObjectIds) &&
			s.subjectObjectIds.includes(subjectId)
		)
			return true;
	}
	return false;
}

export interface FloorBlock {
	readonly policyId: string;
	readonly disposition: string;
}

/**
 * The de minimis floor decision for `subjectId` at a protected transition (guide §8.4 step 4). Returns null when the
 * transition is PERMITTED: the floor does not apply (not AI-produced AND never assessed), OR every required policy is
 * SATISFIED at the bound version, OR an EFFECTIVE governance waiver covers the subject. Otherwise returns the blocking
 * policies (a missing or non-SATISFIED required policy). When `subjectVersion` is provided, a floor recorded against a
 * DIFFERENT subject semanticVersion does NOT count — a stale floor cannot authorize a re-versioned subject.
 */
export function floorGateBlock(
	ctx: HandlerContext,
	subjectId: string,
	opts: { readonly aiProduced: boolean; readonly subjectVersion?: number }
): FloorBlock[] | null {
	const latest = latestFloorDispositions(ctx, subjectId);
	if (!opts.aiProduced && latest.size === 0) return null;
	const blocking = FLOOR_POLICY_IDS_REQUIRED.map((policyId) => {
		const rec = latest.get(policyId);
		const versionOk = opts.subjectVersion === undefined || rec?.version === opts.subjectVersion;
		return { policyId, disposition: rec && versionOk ? rec.disposition : 'MISSING' };
	}).filter((r) => r.disposition !== 'SATISFIED');
	if (blocking.length === 0) return null;
	if (hasEffectiveFloorWaiver(ctx, subjectId)) return null;
	return blocking;
}
