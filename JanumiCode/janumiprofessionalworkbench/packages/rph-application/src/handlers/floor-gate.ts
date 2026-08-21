// Shared de minimis floor protected-transition logic (guide §8.4 step 4), PLANE-AGNOSTIC: given a subject, is its
// recorded assurance floor SATISFIED? Reused by the authoring-plane PublishPwa gate (pwa-authoring) and the
// execution-plane completeExecutionStep gate (execution).
//
// ⚠ THAT QUESTION USED TO READ "SATISFIED (or waived)", and the parenthesis was the whole defect. ASR-3
// (JPWB-DOC-003 §Semantic Model, ratified) — "The de minimis assurance floor is UNCONDITIONAL. Risk
// proportionality governs assurance above a mandatory floor; it never makes the floor optional." The discharge
// apparatus was deleted here on 2026-08-20 (REG-F-202): this module now consults NO waiver at any point. A waiver
// over a floor policy stays RECORDABLE and stands as accepted risk (ASR-14) — it simply moves no gate.
//
// The three required floor policy ids come from the single canonical source, @janumipwb/rph-assurance's
// FLOOR_POLICY_IDS. They were previously duplicated as string literals here, justified by "the package DAG forbids
// rph-application -> rph-assurance" — a rule that does not exist (.dependency-cruiser.cjs forbids only circularity,
// contracts-as-foundation, domain/ports purity, projections browser-safety, and app-in-core; rph-assurance imports
// only contracts/domain/ports, so the edge is acyclic). The edge is taken (see assurance.ts), so the copy is gone.
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import type { ExecutionProvenance } from '@janumipwb/rph-contracts';
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

/** ExecutionProvenance.originType values that ARE AI/agent-produced — the ratified §7.1 OriginType enum's
 *  machine-authored classes. USER_INPUT / HUMAN_DECISION are human; MIGRATION / DERIVED / IMPORTED are neither
 *  direct-human nor direct-AI (not treated as AI-produced here). */
const AI_ORIGIN_TYPES = new Set(['MODEL_GENERATION', 'TOOL_OUTPUT']);

/**
 * Signal 0 (authoritative): does the recorded ExecutionProvenance itself say the result was AI/agent-produced?
 * Positive-only by contract — it may only RETURN TRUE. A human, empty, or absent provenance yields false so the
 * caller falls through to the heuristics; provenance can raise aiProduced but never lower it. The two positive
 * facts, either sufficient: the origin class is machine-authored (originType ∈ {MODEL_GENERATION, TOOL_OUTPUT}),
 * or the recorded producer is an AGENT/MODEL (executedBy.actorType).
 */
function provenanceIndicatesAiProduced(prov: ExecutionProvenance | undefined): boolean {
	if (!prov) return false;
	if (prov.executedBy && AI_ACTOR_TYPES.has(prov.executedBy.actorType)) return true;
	return prov.originType !== undefined && AI_ORIGIN_TYPES.has(prov.originType);
}

/**
 * Is this execution step's output produced or materially shaped by an AI/agent (§8.4 L841 floor step 3)?
 *
 * Signal 0 — AUTHORITATIVE — is the recorded ExecutionProvenance (now a contracted shape, §16 item 23 filled
 * under §0.3): its originType (the ratified §7.1 class) or executedBy directly names the producer. When it says
 * AI, that is the answer. When it is absent or human, we FALL THROUGH to three heuristic signals (unchanged),
 * any of which is still sufficient — the derivation the system used before provenance was contracted:
 *   1. `stepType` is a MODEL_INVOCATION — AI-shaped by construction;
 *   2. the completing actor is an AGENT/MODEL (`AI_ACTOR_TYPES`) — note `issuedBy` names who COMPLETED the step,
 *      not necessarily who produced it (execution-detail.test.ts completes an agent's step under a HUMAN), which
 *      is exactly the gap signal 0 closes when provenance is supplied;
 *   3. the step runs under a Runtime Binding — which per DOC-009 §10.5 carries `model_selection_policy`, so a
 *      bound step is one that selects and invokes a model.
 * aiProduced = signal0 OR signal1 OR signal2 OR signal3 — monotonic: provenance can only RAISE it, never clear a
 * heuristic that already fired, so a caller omitting provenance keeps the prior (fail-toward-review) behavior.
 *
 * Deliberately NOT claimed: §8.4 L844's "ambiguity resolves to material" is about the materiality of a known
 * AI result, not about whether producership is known. Using it here would be a different inference wearing
 * its citation.
 */
export function stepOutputIsAiProduced(
	ctx: HandlerContext,
	step: Record<string, unknown>,
	command: { readonly issuedBy: { readonly actorType: string } },
	provenance?: ExecutionProvenance
): boolean {
	if (provenanceIndicatesAiProduced(provenance)) return true; // signal 0 — authoritative, OR-only
	if (AI_STEP_TYPES.has(String(step.stepType))) return true;
	if (AI_ACTOR_TYPES.has(String(command.issuedBy.actorType))) return true;
	const bindingId = step.runtimeBindingId;
	return typeof bindingId === 'string' && bindingId !== '' && !!ctx.store.loadObject(bindingId);
}

/** A floor subject: a Professional Work Object id bound to the exact semanticVersion the floor is judged at. */
export interface FloorSubject {
	readonly subjectId: string;
	readonly version: number;
}

export interface StepResultSubjects {
	/** Results that resolve to a stored Professional Work Object, each with its CURRENT semanticVersion. */
	readonly subjects: FloorSubject[];
	/** Result ids naming no stored object — an output that cannot be assessed because it was never recorded. */
	readonly unresolved: string[];
}

/**
 * The floor subjects for a completing execution step: its downstream-consumable RESULTS, never the step.
 *
 * THE STEP IS NOT A LEGAL SUBJECT, and this is not a preference. DOC-004 assessment invariant 2 requires
 * "Every assessment identifies its subject semantic version", and DOC-009 §11.7's
 * `assurance_assessment_subjects` requires `subject_object_id references professional_work_objects(id)` with a
 * NOT NULL `subject_semantic_version`. An ExecutionStep has no envelope (DOC-002 §21's interface does not
 * extend ObjectEnvelope), is absent from DOC-002 §4's ProfessionalWorkObjectType union, and DOC-009 §10.2's
 * `execution_steps` is the one execution table whose id does NOT reference `professional_work_objects`. So a
 * step can never carry a semanticVersion, and a step-subject waiver can never satisfy DOC-004 §12.2's "exact
 * object and semantic version". Binding a version to a step would have meant inventing one for a non-object.
 *
 * WHAT THE SUBJECT IS, per guide §8.4: "Every material professional transformation…"; "bind the exact
 * subject/output…"; and the individuation rule at L844 — "Each independently downstream-consumable result is
 * its own transformation boundary unless an explicit grouping records every subject/version and its
 * rationale." So: one subject PER RESULT, not one per step. §8.4 never says "step" and never says "artifact";
 * it says result/output — Artifacts and Evidence are the two the contract carries, and §8.4 names Evidence
 * explicitly ("proposes a Claim or Evidence item … necessarily triggers Reasoning Review").
 *
 * Versions are DERIVED from the store, never read from the payload — a caller that could assert its own
 * subject version could assert a floor was current when it was stale.
 *
 * NOT grouped: §8.4 L844 permits an "explicit grouping" only when it "records every subject/version and its
 * rationale". No such grouping record exists in the contract, so each result is judged on its own.
 *
 * PARTLY-CLOSED GAP (JAN-EXECREM WP-11 / F-01 limb B). `structuredResult` is `z.unknown()`, so a step can carry
 * professional content that is neither an Artifact nor Evidence and therefore attracts no subject here. This
 * paragraph used to disclose that as wholly unfixed, and it was worse than disclosed: with BOTH id arrays empty,
 * `resultIds` is `[]`, this function returns zero subjects, and the caller's floor loop then iterates ZERO times —
 * so an AI-produced step escaped the §8.4 floor entirely by the cheapest possible move, naming nothing. The
 * zero-subject case is now refused by `unassessableAiContentBlock` below. What REMAINS open is the narrower
 * individuation residual: a step naming ONE floor-satisfied artifact may still ship additional inline content in
 * `structuredResult` un-individuated (§8.4 L844). Closing that means requiring such content to be recorded as an
 * Artifact — a contract change for every AI step, registered as an open question rather than silently carried.
 */
export function stepResultSubjects(
	ctx: HandlerContext,
	resultIds: readonly string[]
): StepResultSubjects {
	const subjects: FloorSubject[] = [];
	const unresolved: string[] = [];
	for (const id of resultIds) {
		const obj = ctx.store.loadObject(id);
		if (obj) subjects.push({ subjectId: id, version: obj.semanticVersion });
		else unresolved.push(id);
	}
	return { subjects, unresolved };
}

/**
 * Does `structuredResult` carry professional CONTENT, as opposed to being an empty placeholder?
 *
 * PINNED DEFINITION, because the design defined it inconsistently and both readings are wrong in opposite
 * directions. A stricter reading ("anything not undefined is content") refuses the reference seed and the demo,
 * which both send `structuredResult: {}`. A looser ad-hoc reading (the design's "non-empty object/array/string OR
 * number OR boolean") calls the number `0` content while calling `''` empty — an arbitrary line that a truth
 * table would then enshrine as if it meant something.
 *
 * So: CONTENT iff (an object with >= 1 own key) OR (an array with length > 0) OR (a string with a non-whitespace
 * character). EVERYTHING else is EMPTY — including `null`, `undefined`, `0`, `false`, `{}`, `[]`, `''` and `'  '`.
 *
 * The rationale for excluding bare scalars is not squeamishness about `0`: `structuredResult` reaches this
 * predicate as parsed JSON, and a professional result that is a bare scalar carries no field naming what it IS.
 * Such a value cannot be individuated as a downstream-consumable result under §8.4 L844 anyway, so treating it as
 * content would refuse a step while naming no content it could plausibly be asked to record.
 */
export function structuredResultHasContent(value: unknown): boolean {
	if (typeof value === 'string') return /\S/.test(value);
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
	return false;
}

/** The inputs to the zero-subject admissibility rule. No `ctx`, so its truth table is unit-testable in isolation. */
export interface FloorSubjectAdmissibility {
	/** Is the step's output AI-produced (§8.4 L841)? Derived by `stepOutputIsAiProduced`, never asserted. */
	readonly aiProduced: boolean;
	/** How many of the named results resolved to a recorded, assessable Professional Work Object. */
	readonly subjectCount: number;
	/** Does the completion carry professional content inline? `structuredResultHasContent(p.structuredResult)`. */
	readonly structuredResultHasContent: boolean;
}

/**
 * §8.4, fail-closed restatement: **AI-produced professional content may not enter the governed stream without an
 * assessable subject.** Returns the refusal reason, or null when the completion is admissible.
 *
 * WHY THIS EXISTS. The floor gate is a `for (const subject of subjects)` loop, and a loop over an empty list is
 * not a gate — it is a no-op that looks like one. An AI-produced step naming zero results therefore skipped §8.4
 * entirely (reproduced live: `ACCEPTED | state=SUCCEEDED`), while its sibling naming one real artifact was
 * REJECTED. The single population the floor exists to catch escaped it by naming nothing.
 *
 * WHY IT DOES NOT SIMPLY REFUSE EVERY ZERO-SUBJECT AI COMPLETION. Coding Agent Guide L1964: "A timeout/no-output
 * Attempt remains recorded but has no candidate output to review." A blanket refusal would over-refuse exactly
 * that legitimate case. The discriminator is whether the step SHIPPED something: content with no subject is the
 * defect; nothing with no subject is an honest empty attempt.
 *
 * WHY THE CONTENT LIMB MATTERS RATHER THAN BEING BELT-AND-BRACES. `execution.ts` persists `structuredResult`
 * verbatim onto `ExecutionStepSucceeded`, `condition-grammar.ts` folds it into the condition subject, and
 * `RESULT_EQUALS` resolves a dot-path over it — so unassessed AI content does not merely sit in the log, it
 * carries BRANCH-selection authority.
 *
 * DELIBERATE DEVIATION FROM THE DESIGN, recorded rather than silently taken: the designed interface carried a
 * fourth input, `explicitNoOutput`. It is omitted because it cannot change the answer. Composed with WP-11's
 * RPH-EXE-006 fix, `subjectCount === 0` already IMPLIES the caller asserted no-output (a completion naming
 * nothing without the assertion is refused before this predicate is reached), so the fourth input would be an
 * unkillable parameter and a 16-cell table over it would be eight duplicated rows presented as coverage — the
 * precise shape of vacuity this program exists to remove. The composition is asserted at the call site instead.
 */
export function unassessableAiContentBlock(input: FloorSubjectAdmissibility): string | null {
	if (!input.aiProduced) return null;
	if (input.subjectCount !== 0) return null;
	if (!input.structuredResultHasContent) return null;
	return 'AI-produced content with no assessable subject';
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

/**
 * ⚠ THE DISCHARGE APPARATUS WAS DELETED HERE (2026-08-20, REG-F-202 — sponsor ruling on ASR-3).
 *
 * `openFindingCodes`, `FloorWaiver`, `effectiveFloorWaivers` and `waiverDischargesFloorPolicy` lived at this
 * point and let a governed waiver discharge a REQUIRED floor policy. **ASR-3 (JPWB-DOC-003:249) makes the de
 * minimis floor UNCONDITIONAL** — *"Risk proportionality governs assurance above a mandatory floor; it never
 * makes the floor optional"* — so no waiver has reach over it, and the whole apparatus was an UNRATIFIED
 * EXTRAPOLATION: the general waiver mechanism canon provides for assurance policies (DOC-004 §12.2, guide
 * §8.15), applied to the three policies canon exempts from that relief.
 *
 * ⚠ WHY THE DELETION IS TOTAL RATHER THAN SCOPED. `floorGateBlock` iterates `FLOOR_POLICY_IDS_REQUIRED` and
 * nothing else, and `waiverDischargesFloorPolicy` had exactly ONE call site — inside it. So "do not consult
 * the discharge path for the three required policies" IS "do not consult it at all"; there is no non-floor
 * discharge path for it to keep serving. Leaving the code in place fails `bun run lint` (no-unused-vars) and
 * would leave a reader believing a discharge route exists.
 *
 * ⚠ WHAT THIS DID **NOT** REMOVE, because the distinction decides whether RPH-GOV-005 still has teeth.
 * RPH-GOV-005 ("authorization does not bleed") applies in TWO places, and only one of them was here:
 *   - DISCHARGE — whether an existing waiver clears a floor finding. That was this code. It is gone.
 *   - AUTHORIZATION — whether a cited Decision may authorize a waive at all: `resolveWaiverAuthorization`
 *     (`waiver-authorization.ts:54`), reached in production from `pwu.ts:1529` via `rejectUnauthorizedWaiver`,
 *     which refuses on decisionType, object and version pin and names RPH-GOV-005 in its own refusal text.
 * That site is untouched, touches no floor code, and keeps its control at `waiver-authority.test.ts:248`. The
 * rule is NOT retired; it loses its discharge site and keeps its authorization site.
 *
 * ⚠ AND A WAIVER OVER A FLOOR POLICY IS STILL RECORDABLE. `RequestWaiver` still accepts one and `GrantWaiver`
 * still makes it EFFECTIVE — deliberately. ASR-14 (*"a waiver accepts risk; it never rewrites truth"*)
 * describes exactly a recorded risk-acceptance that changes no outcome, so refusing to RECORD it would be an
 * over-refusal: this ruling narrows a waiver's REACH, not its RECORDABILITY. What must never happen again is
 * the recorded waiver silently changing a gate.
 */

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
		.map((r) => ({ policyId: r.policyId, disposition: r.disposition }));
	return blocking.length === 0 ? null : blocking;
}
