// Shared de minimis floor protected-transition logic (guide §8.4 step 4), PLANE-AGNOSTIC: given a subject, is its
// recorded assurance floor SATISFIED (or waived)? Reused by the authoring-plane PublishPwa gate (pwa-authoring) and
// the execution-plane completeExecutionStep gate (execution).
//
// The three required floor policy ids come from the single canonical source, @janumipwb/rph-assurance's
// FLOOR_POLICY_IDS. They were previously duplicated as string literals here, justified by "the package DAG forbids
// rph-application -> rph-assurance" — a rule that does not exist (.dependency-cruiser.cjs forbids only circularity,
// contracts-as-foundation, domain/ports purity, projections browser-safety, and app-in-core; rph-assurance imports
// only contracts/domain/ports, so the edge is acyclic). The edge is taken (see assurance.ts), so the copy is gone.
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import type { HandlerContext } from './kit.js';

export const FLOOR_POLICY_IDS_REQUIRED = [
	FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
	FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
	FLOOR_POLICY_IDS.REASONING_REVIEW
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

/**
 * Every EFFECTIVE WAIVER Decision naming `subjectId`. Deliberately NOT a Boolean: §16 item 12's safe default is
 * "Never implement waiver as a Boolean—require a version-bound Decision with scope, expiry, rationale, controls,
 * and preserved finding." Callers must decide per policy, and must be able to see WHY a waiver was insufficient.
 */
export function effectiveFloorWaivers(
	ctx: HandlerContext,
	subjectId: string
): { readonly decisionId: string; readonly subjectSemanticVersions: Record<string, number> }[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'DECISION') ids.add(e.aggregateId);
	const out: { decisionId: string; subjectSemanticVersions: Record<string, number> }[] = [];
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			| {
					decisionType?: string;
					status?: string;
					subjectObjectIds?: string[];
					subjectSemanticVersions?: Record<string, number>;
			  }
			| undefined;
		if (
			s?.decisionType === 'WAIVER' &&
			s.status === 'EFFECTIVE' &&
			Array.isArray(s.subjectObjectIds) &&
			s.subjectObjectIds.includes(subjectId)
		)
			out.push({ decisionId: id, subjectSemanticVersions: s.subjectSemanticVersions ?? {} });
	}
	return out;
}

/**
 * Does an EFFECTIVE waiver discharge floor policy `policyId` over this subject/version?
 *
 * **It cannot, today, for any waiver — and that is deliberate. BLOCKED ON §16 item 12.**
 *
 * §8.15 L1101 and DOC-004 §12.2 (the ratified authority) both require a waiver to record "exact policy and
 * criterion; exact object and semantic version; finding being waived; authority; rationale; duration or
 * expiration; compensating controls; downstream impact; review conditions." `rph-domain`'s `waiverCovers`
 * implements exactly that scoping — a waiver discharges ONLY its (criterion, object, version) triple — and is
 * called by nothing.
 *
 * It cannot be called here, because the criterion has NO WIRE HOME:
 *   - `DecisionObjectSchema` is a strictObject with no criterion/policy/expiry field;
 *   - `RequestWaiverPayload.scope` IS collected — and `requestWaiver` silently drops it, because the Decision
 *     could not hold it even if it tried;
 *   - RPH-DOC-007 mentions "waiver" twice in the whole document: `waiverRules: WaiverRule[]` (the policy-side
 *     rule) and the `'WAIVER'` DecisionType enum value. It defines no waiver instance shape. DOC-009 has no
 *     waivers table;
 *   - the vocab's own citation for `scope` is `"sourceSection": "DOC-002 §34.2 (requestWaiver)"`, and DOC-002
 *     §34.2 is a bare LIST OF COMMAND NAMES. The field was authored, and the citation points at a name.
 *
 * §16 item 12 states this precisely — "waiver lacks a complete instance/wire/storage contract" — and §0.3 is
 * unambiguous about what an agent may do here: "It must not choose a convenient interpretation and encode it
 * as architecture." Designing the criterion binding IS that choice, so it is not made here.
 *
 * What was here instead: any EFFECTIVE waiver naming the subject discharged the ENTIRE floor — including the
 * Reasoning Review that §8.4 L854 says a governance Decision must scope, not blanket. A waiver granted for
 * "naming-convention style guide deviation" silently discharged an AI transformation's mandatory independent
 * review. That is the Boolean item 12 forbids by name, and it is a CRITICAL defect, so it does not stay while
 * the contract is decided.
 *
 * Fail closed, per §13.3 L2227 ("Fail closed on missing identity, tenant, policy, schema, or authority
 * context") and §16 item 23's parallel default ("otherwise keep the PWA Draft or output provisional and block
 * the transition"). This is REVERSIBLE and one line: when item 12 lands a criterion binding, map the Decision
 * to a `WaiverView` and call `waiverCovers` + `waiverStillDischarges`. The kernel is already written.
 */
function waiverDischargesFloorPolicy(
	_ctx: HandlerContext,
	_subjectId: string,
	_policyId: string,
	_subjectVersion: number | undefined
): boolean {
	return false;
}

export interface FloorBlock {
	readonly policyId: string;
	readonly disposition: string;
}

/**
 * The de minimis floor decision for `subjectId` at a protected transition (guide §8.4 step 4). Returns null when the
 * transition is PERMITTED: the floor does not apply (not AI-produced AND never assessed), OR every required policy is
 * SATISFIED at the bound version, OR each non-SATISFIED policy is INDIVIDUALLY discharged by a waiver scoped to it.
 * Otherwise returns the blocking policies (a missing or non-SATISFIED required policy). When `subjectVersion` is
 * provided, a floor recorded against a DIFFERENT subject semanticVersion does NOT count — a stale floor cannot
 * authorize a re-versioned subject.
 *
 * The waiver decision is PER POLICY, never one bypass for the whole floor: §8.15 L1101 requires a waiver to record
 * "the exact policy, criterion, finding, object and semantic version", so one waiver discharging everything is not a
 * broad waiver — it is an unscoped one. See `waiverDischargesFloorPolicy` (currently fail-closed, blocked on item 12).
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
	})
		.filter((r) => r.disposition !== 'SATISFIED')
		.filter((r) => !waiverDischargesFloorPolicy(ctx, subjectId, r.policyId, opts.subjectVersion));
	return blocking.length === 0 ? null : blocking;
}
