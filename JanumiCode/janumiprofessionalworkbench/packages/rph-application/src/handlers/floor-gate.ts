// Shared de minimis floor protected-transition logic (guide §8.4 step 4), PLANE-AGNOSTIC: given a subject, is its
// recorded assurance floor SATISFIED (or waived)? Reused by the authoring-plane PublishPwa gate (pwa-authoring) and
// the execution-plane completeExecutionStep gate (execution).
//
// The floor policy ids below were duplicated as literals here, justified in this comment by "the package DAG forbids
// rph-application -> rph-assurance". No such rule exists: .dependency-cruiser.cjs forbids circularity,
// contracts-as-foundation, domain/ports purity, projections browser-safety, and app-in-core — and rph-assurance
// imports only contracts/domain/ports, so the edge is acyclic and legal. The copy was defended by a constraint
// nobody checked. The edge is now taken (see assurance.ts), and these literals should collapse into
// FLOOR_POLICY_IDS; that is a follow-on, tracked in HARMONIZATION-LOG.md, not smuggled into this increment.
import type { HandlerContext } from './kit.js';

export const FLOOR_POLICY_IDS_REQUIRED = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
] as const;
/** A subject is AI-produced (floor-relevant) when its producing actor is an AGENT or MODEL. */
export const AI_ACTOR_TYPES = new Set(['AGENT', 'MODEL']);

/** Step types whose output is AI-shaped by construction — §8.4 step 3 applies "when the transformation is
 *  produced by or materially shaped by an AI/agent", and a MODEL_INVOCATION is that by definition. */
const AI_STEP_TYPES = new Set(['MODEL_INVOCATION']);

/**
 * Is this execution step's output produced or materially shaped by an AI/agent (§8.4 L841 floor step 3)?
 *
 * Derived from the signals the accepted contract actually carries, never asserted. Three POSITIVE signals,
 * any of which is sufficient:
 *   1. `stepType` is a MODEL_INVOCATION — AI-shaped by construction;
 *   2. the completing actor is an AGENT/MODEL (`AI_ACTOR_TYPES`);
 *   3. the step runs under a Runtime Binding — which per DOC-009 §10.5 carries `model_selection_policy`, so a
 *      bound step is one that selects and invokes a model.
 *
 * KNOWN GAP, disclosed rather than papered over: none of these is the *producer of the output*. `issuedBy`
 * names who COMPLETED the step, which is not the same actor — `execution-detail.test.ts` completes an
 * agent's MODEL_INVOCATION under a HUMAN. The field that would answer this directly is
 * `CompleteExecutionStepPayload.executionProvenance`, and it is `z.unknown()` (`messages.ts`), so it cannot
 * be read without inventing a shape (§16 item 23 withholds "producing-Attempt/context binding" by name).
 * Signal 1 covers the case that matters — a model call is a MODEL_INVOCATION — and signals 2/3 catch the
 * agent-completes and bound-runtime cases. When `executionProvenance` is contracted, it becomes signal 0 and
 * this function stops inferring.
 *
 * Deliberately NOT claimed: §8.4 L844's "ambiguity resolves to material" is about the materiality of a known
 * AI result, not about whether producership is known. Using it here would be a different inference wearing
 * its citation.
 */
export function stepOutputIsAiProduced(
	ctx: HandlerContext,
	step: Record<string, unknown>,
	command: { readonly issuedBy: { readonly actorType: string } }
): boolean {
	if (AI_STEP_TYPES.has(String(step.stepType))) return true;
	if (AI_ACTOR_TYPES.has(String(command.issuedBy.actorType))) return true;
	const bindingId = step.runtimeBindingId;
	return typeof bindingId === 'string' && bindingId !== '' && !!ctx.store.loadObject(bindingId);
}

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
