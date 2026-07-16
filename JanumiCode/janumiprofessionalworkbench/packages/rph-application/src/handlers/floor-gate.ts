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
import { waiverCovers, waiverStillDischarges, type WaiverView } from '@janumipwb/rph-domain';
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
	/** The assessment's own id — the key its finding-type Observations link back to via `assessmentId`. */
	readonly assessmentId: string;
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
				at,
				assessmentId: id
			});
	}
	return latest;
}

/** The OPEN finding codes recorded against `assessmentId` — the exact criteria that failed, which a waiver must
 *  name to discharge (DOC-004 §12.2 "exact policy and criterion"). An assessment that never ran has none. */
function openFindingCodes(ctx: HandlerContext, assessmentId: string): string[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'ASSURANCE_OBSERVATION') ids.add(e.aggregateId);
	const codes: string[] = [];
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			| { assessmentId?: string; findingCode?: string; disposition?: string }
			| undefined;
		if (s?.assessmentId !== assessmentId) continue;
		if (s.disposition && s.disposition !== 'OPEN') continue; // already resolved/waived elsewhere
		if (s.findingCode) codes.push(String(s.findingCode));
	}
	return codes;
}

/**
 * Every EFFECTIVE WAIVER Decision naming `subjectId`. Deliberately NOT a Boolean: §16 item 12's safe default is
 * "Never implement waiver as a Boolean—require a version-bound Decision with scope, expiry, rationale, controls,
 * and preserved finding." Callers must decide per policy, and must be able to see WHY a waiver was insufficient.
 */
export interface FloorWaiver {
	/** The kernel's read-model — what `waiverCovers` / `waiverStillDischarges` reason over. */
	readonly view: WaiverView;
	/** DOC-004 §12.2's "exact policy" half. `waiverCovers` scopes by criterion; this stops a criterion id that
	 *  happens to repeat across two policies from bleeding between them. */
	readonly waivedPolicyId: string;
}

export function effectiveFloorWaivers(
	ctx: HandlerContext,
	subjectId: string,
	now: string
): FloorWaiver[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === 'DECISION') ids.add(e.aggregateId);
	const out: FloorWaiver[] = [];
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			| {
					decisionType?: string;
					status?: string;
					subjectObjectIds?: string[];
					subjectSemanticVersions?: Record<string, number>;
					waiver?: {
						waivedPolicyId?: string;
						waivedCriterionId?: string;
						expiresAt?: string;
					};
			  }
			| undefined;
		if (
			s?.decisionType !== 'WAIVER' ||
			s.status !== 'EFFECTIVE' ||
			!Array.isArray(s.subjectObjectIds) ||
			!s.subjectObjectIds.includes(subjectId)
		)
			continue;
		// A WAIVER Decision with no `waiver` detail cannot name its policy/criterion, so it can discharge nothing
		// (§16 item 12's "never a Boolean"). Skipping it here is the fail-closed path for legacy/malformed waivers.
		const w = s.waiver;
		if (!w?.waivedPolicyId || !w.waivedCriterionId) continue;
		out.push({
			waivedPolicyId: String(w.waivedPolicyId),
			view: {
				decisionId: id,
				status: String(s.status),
				waivedCriterionId: String(w.waivedCriterionId),
				subjectObjectId: subjectId,
				subjectSemanticVersion: s.subjectSemanticVersions?.[subjectId] ?? -1,
				// The kernel is clock-free by design (§ RPH-GOV-006 leaves `expired` caller-computed), so expiry is
				// resolved here against the command's own issuedAt — never a wall clock, which would make replay
				// non-deterministic.
				expired: !!w.expiresAt && w.expiresAt <= now
			}
		});
	}
	return out;
}

/**
 * Does an EFFECTIVE waiver discharge floor policy `policyId` over this subject/version?
 *
 * Routes through `rph-domain`'s `waiverCovers` + `waiverStillDischarges` — written and unit-proven since before
 * this program began, and callable only now that `WaiverDetail` gives the criterion a wire home (§16 item 12's
 * gap, closed under the sponsor's 2026-07-16 grant by serializing DOC-004 §12.2's ratified field list).
 *
 * The rule is CRITERION-EXACT, not policy-broad, because §8.15 L1101 / DOC-004 §12.2 require a waiver to name
 * "the exact policy, criterion, finding, object and semantic version" and RPH-GOV-005 says a waiver "does not
 * bleed to another criterion, another object, or another version." So a policy is discharged only when EVERY
 * open finding recorded against it is individually covered. A waiver of RR-01 does not discharge a policy that
 * failed RR-04 — which is exactly the bleeding that made any waiver nuke the whole floor.
 *
 * Fail-closed branches, each deliberate:
 *   - no open findings (e.g. the review is MISSING — it never ran): nothing to waive, and §8.4 L854 says "A
 *     missing … required review cannot satisfy assurance or permit its protected transition." A waiver cannot
 *     manufacture a review that never happened.
 *   - `subjectVersion` unknown: version-exactness is unverifiable, so the waiver is not honored.
 *   - a WAIVER Decision carrying no `waiver` detail (legacy/malformed) names no criterion → discharges nothing.
 */
function waiverDischargesFloorPolicy(
	ctx: HandlerContext,
	subjectId: string,
	policyId: string,
	subjectVersion: number | undefined,
	assessmentId: string | undefined,
	now: string
): boolean {
	if (subjectVersion === undefined || !assessmentId) return false;
	const openFindings = openFindingCodes(ctx, assessmentId);
	if (openFindings.length === 0) return false;
	const waivers = effectiveFloorWaivers(ctx, subjectId, now).filter(
		(w) => w.waivedPolicyId === policyId && waiverStillDischarges(w.view)
	);
	return openFindings.every((code) =>
		waivers.some((w) => waiverCovers(w.view, code, subjectId, subjectVersion))
	);
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
 * The waiver decision is PER POLICY and CRITERION-EXACT, never one bypass for the whole floor: §8.15 L1101 requires a
 * waiver to record "the exact policy, criterion, finding, object and semantic version", so one waiver discharging
 * everything is not a broad waiver — it is an unscoped one. See `waiverDischargesFloorPolicy`.
 *
 * `now` resolves waiver expiry (§8.15: expiration triggers review). Pass the COMMAND's `issuedAt`, never a wall clock:
 * the gate must replay deterministically from the event log (§10.2).
 */
export function floorGateBlock(
	ctx: HandlerContext,
	subjectId: string,
	opts: { readonly aiProduced: boolean; readonly subjectVersion?: number; readonly now: string }
): FloorBlock[] | null {
	const latest = latestFloorDispositions(ctx, subjectId);
	if (!opts.aiProduced && latest.size === 0) return null;
	const blocking = FLOOR_POLICY_IDS_REQUIRED.map((policyId) => {
		const rec = latest.get(policyId);
		const versionOk = opts.subjectVersion === undefined || rec?.version === opts.subjectVersion;
		return {
			policyId,
			disposition: rec && versionOk ? rec.disposition : 'MISSING',
			assessmentId: rec && versionOk ? rec.assessmentId : undefined
		};
	})
		.filter((r) => r.disposition !== 'SATISFIED')
		.filter(
			(r) =>
				!waiverDischargesFloorPolicy(
					ctx,
					subjectId,
					r.policyId,
					opts.subjectVersion,
					r.assessmentId,
					opts.now
				)
		)
		.map((r) => ({ policyId: r.policyId, disposition: r.disposition }));
	return blocking.length === 0 ? null : blocking;
}
