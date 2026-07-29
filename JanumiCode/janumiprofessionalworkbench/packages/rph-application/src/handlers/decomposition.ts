// Decomposition / Recomposition handlers. ProposeDecomposition creates a DecompositionContract already submitted
// for review (UNDER_REVIEW; the DRAFT→UNDER_REVIEW hop has no command — see OPEN-QUESTIONS). ValidateDecomposition
// carries the validator's disposition (VALID | CONDITIONALLY_VALID | INVALID) to the matching terminal state; the
// deeper obligation-conservation / constraint-propagation checks (P2/P3) live in @janumipwb/rph-domain and are a
// further wiring increment. Recomposition begin/complete advance the RecompositionContract.status machine.
import type {
	CommandResult,
	CompleteRecompositionPayload,
	ConstraintPropagation,
	DomainCommand,
	ProposeDecompositionPayload,
	ProposeRecompositionPayload,
	ValidateDecompositionPayload
} from '@janumipwb/rph-contracts';
import {
	evaluateRecomposition,
	validateConstraintPropagation,
	validateObligationConservation,
	type ConstraintDispositionRecord,
	type ParentConstraint,
	type ParentObligation,
	type RecompositionInput,
	type RequiredChildResult
} from '@janumipwb/rph-domain';
import {
	advanceStatus,
	createObject,
	newEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';
import { fromStates } from './command-precondition.js';

const DECOMP = 'DECOMPOSITION_CONTRACT';
const RECOMP = 'RECOMPOSITION_CONTRACT';

/** ProposeDecomposition — create a DecompositionContract (submitted for review, UNDER_REVIEW). */
export const proposeDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeDecompositionPayload;
	const id = command.targetAggregateId;
	if (!ctx.store.loadObject(p.parentWorkUnitId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeDecomposition requires an existing parent work unit ${p.parentWorkUnitId}`,
			[id]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, DECOMP, id, {
			lifecycleStatus: 'UNDER_REVIEW',
			sourceObjectIds: [p.parentWorkUnitId, ...p.childWorkUnitIds]
		}),
		parentWorkUnitId: p.parentWorkUnitId,
		childWorkUnitIds: p.childWorkUnitIds,
		rationale: p.rationale,
		intentMappings: p.intentMappings ?? [],
		obligationAllocations: p.obligationAllocations ?? [],
		constraintPropagations: p.constraintPropagations ?? [],
		assumptionPropagations: p.assumptionPropagations ?? [],
		retainedParentObligationIds: p.retainedParentObligationIds ?? [],
		coverageClaims: p.coverageClaims ?? [],
		siblingDependencyIds: p.siblingDependencyIds ?? [],
		recompositionContractId: p.recompositionContractId ?? '',
		status: 'UNDER_REVIEW'
	};
	return createObject(ctx, command, {
		objectType: DECOMP,
		aggregateId: id,
		state,
		eventType: 'DecompositionProposed',
		// The event records the RESULTING state. DecompositionProposed declares the decomposition + the created
		// `status` (UNDER_REVIEW); the raw command payload omits `status` (a required field). Emit the declared
		// shape — the required decomposition fields + status, plus any optional propagation fields the command
		// actually supplied (absent = not specified, never a fabricated empty). (Pinned defect; now conforms.)
		eventPayload: {
			parentWorkUnitId: p.parentWorkUnitId,
			childWorkUnitIds: p.childWorkUnitIds,
			rationale: p.rationale,
			status: 'UNDER_REVIEW',
			...(p.intentMappings?.length ? { intentMappings: p.intentMappings } : {}),
			...(p.obligationAllocations?.length
				? { obligationAllocations: p.obligationAllocations }
				: {}),
			...(p.constraintPropagations?.length
				? { constraintPropagations: p.constraintPropagations }
				: {}),
			...(p.assumptionPropagations?.length
				? { assumptionPropagations: p.assumptionPropagations }
				: {}),
			...(p.retainedParentObligationIds?.length
				? { retainedParentObligationIds: p.retainedParentObligationIds }
				: {}),
			...(p.coverageClaims?.length ? { coverageClaims: p.coverageClaims } : {}),
			...(p.siblingDependencyIds?.length ? { siblingDependencyIds: p.siblingDependencyIds } : {}),
			...(p.recompositionContractId ? { recompositionContractId: p.recompositionContractId } : {})
		}
	});
};

const DECOMP_DISPOSITIONS: Record<string, { target: string; event: string }> = {
	VALID: { target: 'VALID', event: 'DecompositionValidated' },
	CONDITIONALLY_VALID: { target: 'CONDITIONALLY_VALID', event: 'DecompositionValidated' },
	INVALID: { target: 'INVALID', event: 'DecompositionRejected' }
};

/**
 * WIRE-1/2 (Property P2 / P3 — the object-plane wiring authorized at G1/C1). Before a ValidateDecomposition may
 * mark a contract VALID or CONDITIONALLY_VALID, independently verify — over the FIRST-CLASS Obligation/Constraint
 * objects the parent PWU references — that the decomposition actually conserves them. A validator's VALID verdict
 * cannot stand if:
 *   - a MANDATORY parent obligation is left neither allocated, retained, satisfied, nor waived
 *     (§35.1 "no obligation disappears" / RPH-DEC-002 / RPH-DEC-007 / validateObligationConservation), or
 *   - a MANDATORY applicable parent constraint silently drops a relevant child, or a disposition is malformed
 *     (§35.1 "no constraint silently drops" / RPH-CNS-001..004 / RPH-DEC-003 / validateConstraintPropagation).
 *
 * NON-VACUOUS BUT NON-BREAKING: parent obligations/constraints are LOADED (their `strength` is what the gates key
 * on). A parent carrying no first-class obligations/constraints — e.g. the Field Service reference fixture, whose
 * PWUs propose `obligationIds: []` / `constraintIds: []` — has nothing to conserve and trivially passes. The gate
 * fires only when there IS a mandatory obligation/constraint to account for. An obligation id that does not resolve
 * to a live OBLIGATION object is skipped (its strength is unknown, so it cannot be gated — sound, fail-open only
 * where the object plane is genuinely absent). Runs for VALID/CONDITIONALLY_VALID only; an INVALID verdict already
 * rejects the decomposition, so there is nothing to re-gate.
 */
const LIVE_CONSTRAINT_STATUSES = new Set(['PROPOSED', 'ACTIVE']);

/** Read an object-state field as a string ('' when absent/non-string) — avoids Object default stringification. */
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Load an object's state from the store, or undefined; narrows to a plain record for field reads. */
function loadState(ctx: HandlerContext, id: string): Record<string, unknown> | undefined {
	return ctx.store.loadObject(id)?.state as Record<string, unknown> | undefined;
}

/** Build the P2 obligation-conservation input from the parent PWU's first-class OBLIGATION objects + the
 *  contract's allocations/retentions. Object-level ALLOCATED/SATISFIED/WAIVED count as dispositions too. */
function buildObligationInput(
	ctx: HandlerContext,
	parent: Record<string, unknown>,
	state: Record<string, unknown>
) {
	const parentObligations: ParentObligation[] = [];
	const objAllocated: string[] = [];
	const objSatisfied: string[] = [];
	const objWaived: string[] = [];
	for (const oid of (parent.obligationIds as string[] | undefined) ?? []) {
		const o = loadState(ctx, oid);
		if (o?.objectType !== 'OBLIGATION') continue; // strength unknown → not gatable (sound)
		const status = str(o.status);
		if (status === 'SUPERSEDED') continue; // no longer live
		parentObligations.push({ obligationId: oid, strength: str(o.strength) });
		if (status === 'ALLOCATED') objAllocated.push(oid);
		else if (status === 'SATISFIED') objSatisfied.push(oid);
		else if (status === 'WAIVED') objWaived.push(oid);
	}
	const allocations = (state.obligationAllocations as { obligationId: string }[] | undefined) ?? [];
	return {
		parentObligations,
		allocatedObligationIds: [...allocations.map((a) => a.obligationId), ...objAllocated],
		retainedObligationIds: (state.retainedParentObligationIds as string[] | undefined) ?? [],
		satisfiedObligationIds: objSatisfied,
		authorizedWaiverObligationIds: objWaived
	};
}

/** Build the P3 constraint-propagation input from the parent PWU's first-class CONSTRAINT objects + the
 *  contract's propagation records. A live (PROPOSED/ACTIVE) mandatory constraint is relevant to every child. */
function buildConstraintInput(
	ctx: HandlerContext,
	parent: Record<string, unknown>,
	state: Record<string, unknown>,
	childWorkUnitIds: string[]
) {
	const parentConstraints: ParentConstraint[] = [];
	for (const cid of (parent.constraintIds as string[] | undefined) ?? []) {
		const c = loadState(ctx, cid);
		if (c?.objectType !== 'CONSTRAINT') continue;
		// A live constraint is applicable+gated; waived/inapplicable/superseded/invalidated is already
		// dispositioned at the object level and left ungated (applicable=false).
		const applicable = LIVE_CONSTRAINT_STATUSES.has(str(c.status));
		parentConstraints.push({
			constraintId: cid,
			strength: str(c.strength),
			applicable,
			relevantChildWorkUnitIds: applicable ? childWorkUnitIds : []
		});
	}
	const propagations = (state.constraintPropagations as ConstraintPropagation[] | undefined) ?? [];
	const dispositions: ConstraintDispositionRecord[] = propagations.map((r) => ({
		constraintId: r.constraintId,
		disposition: (r.disposition ?? 'PROPAGATED') as ConstraintDispositionRecord['disposition'],
		childWorkUnitIds: r.childWorkUnitIds ?? [],
		rationale: r.rationale,
		authorityDecisionId: r.authorityDecisionId,
		supersededByConstraintId: r.supersededByConstraintId
	}));
	return { parentConstraints, dispositions };
}

function checkDecompositionConservation(
	state: Record<string, unknown>,
	ctx: HandlerContext,
	command: DomainCommand
): CommandResult | null {
	const parent = loadState(ctx, str(state.parentWorkUnitId));
	if (!parent) return null; // ProposeDecomposition already required the parent; nothing more to gate.
	const childWorkUnitIds = (state.childWorkUnitIds as string[] | undefined) ?? [];

	const oblResult = validateObligationConservation(buildObligationInput(ctx, parent, state));
	const conResult = validateConstraintPropagation(
		buildConstraintInput(ctx, parent, state, childWorkUnitIds)
	);
	if (oblResult.ok && conResult.ok) return null;

	const parts = [
		...oblResult.findings.map((f) => `${f.code}(${f.obligationId})`),
		...conResult.findings.map((f) => {
			const child = f.childWorkUnitId ? `->${f.childWorkUnitId}` : '';
			return `${f.code}(${f.constraintId}${child})`;
		})
	];
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`ValidateDecomposition cannot mark ${command.targetAggregateId} valid: the decomposition does not conserve its parent's obligations/constraints (§35.1 / RPH-DEC-002/007 / RPH-CNS-001..004): ${parts.join('; ')}`
	);
}

/** ValidateDecomposition — UNDER_REVIEW -> VALID|CONDITIONALLY_VALID|INVALID per the validator disposition. */
export const validateDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as ValidateDecompositionPayload;
	const mapping = DECOMP_DISPOSITIONS[p.disposition];
	if (!mapping) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ValidateDecomposition disposition must be VALID|CONDITIONALLY_VALID|INVALID (got ${p.disposition})`
		);
	}
	return advanceStatus(ctx, command, {
		objectType: DECOMP,
		statusField: 'status',
		machine: 'DecompositionContract.status',
		target: mapping.target,
		// JAN-CMDPRE DWP-03: the target is payload-derived (VALID|CONDITIONALLY_VALID|INVALID), but ALL THREE share
		// a SINGLE in-arrow — from UNDER_REVIEW — so the source precondition is a clean state set, NOT a D10-shaped
		// predicate (the roadmap's DWP-03 note over-worried: a payload-derived TARGET does not imply a varying
		// SOURCE, unlike ChangePwuState where the source itself varied). This refuses a re-issue against a contract
		// that already left review (VALID/COND/INVALID -> the same disposition is a NOOP checkTransition admits;
		// a different disposition is not even an arrow), which would flip/append a contradicting DecompositionValidated.
		precondition: fromStates('UNDER_REVIEW'),
		eventType: mapping.event,
		// P2/P3 conservation gate — only when the validator claims the decomposition holds (VALID/COND); an
		// INVALID verdict already rejects it. See checkDecompositionConservation.
		guard:
			mapping.target === 'INVALID'
				? undefined
				: (guardState) => checkDecompositionConservation(guardState, ctx, command),
		// The event records the RESULTING status. DecompositionValidated declares `status` (the VALID /
		// CONDITIONALLY_VALID it transitioned to), which `command.payload` carries as `disposition` (a field the
		// event does not declare — a strict schema rejects it) while omitting `status` entirely. Emit the declared
		// shape: the target status, the optional validatorRole when supplied, and observationIds — the assurance
		// observations the validator CONSIDERED (the validation basis). Contract-drift fix: observationIds was
		// validated then discarded into neither store, so the governed stream could not say what the verdict rested
		// on. Optional field now declared on both validation events (VALID/COND -> DecompositionValidated, INVALID ->
		// DecompositionRejected), distinct from Rejected.blockingObservationIds (the blocking subset).
		eventPayload: () => ({
			status: mapping.target,
			...(p.validatorRole ? { validatorRole: p.validatorRole } : {}),
			...(p.observationIds?.length ? { observationIds: p.observationIds } : {})
		})
	});
};

/** ReviseDecomposition — supersede the prior contract (a revision creates a successor, DOC-002 §13.2). */
/**
 * The revision fields this handler CANNOT honour, and the DOC-003 rule each one carries.
 *
 * JPWB-SPEC-001-DR-002 F-I. `ReviseDecompositionPayloadSchema` declares all three, and they are precisely the
 * carriers for DOC-003's revision obligations — DEC-3 (obligation conservation) and DEC-4 (constraint
 * disposition), both of which SCOPE themselves to revision explicitly, plus DEC-2's impact analysis. This handler
 * implements none of that: it advances status and bumps the semantic version.
 *
 * IMPLEMENTING THEM IS WIRING, NOT NEW DOMAIN LOGIC, AND IT IS SCHEDULED NOWHERE. The kernel exists and is
 * adversarially reviewed under M9 — `validateObligationConservation` and `validateConstraintPropagation` in
 * `@janumipwb/rph-domain`, which `validateDecomposition` already calls a hundred lines below (`:210-211`). The
 * revise path is a second call site nobody wired: the tracker defers it M9 → "M10/M11" → "M11/M13" → "M13" →
 * "live-command-drive handlers deferred", every station ✅, and no milestone holds it now. Nor is a ratification
 * evidently required: DOC-003 is OPERATIVE and already binds revision, so the semantics are settled. (An earlier
 * version of this comment said it "awaits a decomposition-model increment awaiting ratification" — a phrase that
 * named no plan item and invented a governance blocker. REG-F-006 carries the correction.)
 *
 * ACCEPTING the fields meanwhile is not a
 * deferral, it is a false assertion — the caller is told the revision succeeded and has no way to learn the
 * children, allocations and dispositions were dropped. So they are REFUSED, by name, citing the obligation. A
 * refusal to do what this handler does not do needs no ratification; it is CON-000 B7 discharged rather than
 * deferred, and it makes the missing capability visible on every attempt instead of never.
 */
const UNHONOURED_REVISION_FIELDS: readonly (readonly [string, string])[] = [
	['childWorkUnitIds', 'DOC-003 DEC-2 — a revised child set changes the parent claim and triggers impact analysis'],
	['obligationAllocations', 'DOC-003 DEC-3 — obligation conservation across a revision'],
	['constraintPropagations', 'DOC-003 DEC-4 — constraint disposition across a semantic revision']
];

export const reviseDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = (payload ?? {}) as Record<string, unknown>;
	const offered = UNHONOURED_REVISION_FIELDS.filter(([field]) => p[field] !== undefined);
	if (offered.length > 0) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ReviseDecomposition cannot perform a content revision: ${offered
				.map(([field, rule]) => `${field} (${rule})`)
				.join('; ')}. This command supersedes the contract and bumps its semantic version; it does not ` +
				`apply a revised decomposition. Propose a new DecompositionContract for the parent instead. ` +
				`(JPWB-SPEC-001-DR-002 F-I — the capability is declared on the payload and not yet implemented.)`
		);
	}
	return advanceStatus(ctx, command, {
		objectType: DECOMP,
		statusField: 'status',
		machine: 'DecompositionContract.status',
		target: 'SUPERSEDED',
		// JAN-CMDPRE DWP-03: DecompositionContract.status has THREE in-arrows to SUPERSEDED — from VALID,
		// CONDITIONALLY_VALID, INVALID (a revision supersedes a REVIEWED contract; DRAFT/UNDER_REVIEW do not revise).
		// A re-issue bumps semanticVersion, so an un-guarded re-revise would inflate the version with no real change.
		precondition: fromStates('VALID', 'CONDITIONALLY_VALID', 'INVALID'),
		eventType: 'DecompositionRevised',
		bumpSemanticVersion: true,
		// F-I: emit the shape `DecompositionRevisedPayloadSchema` DECLARES. Without this builder `advanceStatus`
		// defaults to the raw command payload, which failed that schema four ways — omitting the supersession id,
		// the bumped version and the resulting status, which are the only facts this event exists to record. It
		// went undetected because the event is absent from RATIFIED_EVENT_PAYLOADS (its vocab entry is annotated
		// UNRATIFIED-AUTHORED, and `gen-messages` skips those), so the engine's own event gate never ran for it.
		// `decomposition-revise-conformance.test.ts` asserts the shape instead — a test claims no ratification.
		eventPayload: (next) => ({
			supersedesDecompositionContractId: command.targetAggregateId,
			rationale: String(p.rationale ?? ''),
			semanticVersion: Number(next.semanticVersion ?? 0),
			status: String(next.status ?? '')
		})
	});
};

/** ProposeRecomposition — mint a RecompositionContract in READY (parallel to ProposeDecomposition; WIRE-3a /
 *  §14 / WP-1-006). Before this existed the contract could never be instantiated, so BeginRecomposition and
 *  CompleteRecomposition — and the evaluateRecomposition kernel they should drive — were dead at the write path. */
export const proposeRecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeRecompositionPayload;
	const id = command.targetAggregateId;
	if (!ctx.store.loadObject(p.parentWorkUnitId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeRecomposition requires an existing parent work unit ${p.parentWorkUnitId}`,
			[id]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, RECOMP, id, {
			lifecycleStatus: 'READY',
			sourceObjectIds: [p.parentWorkUnitId, ...p.requiredChildWorkUnitIds]
		}),
		parentWorkUnitId: p.parentWorkUnitId,
		requiredChildWorkUnitIds: p.requiredChildWorkUnitIds,
		aggregationRules: p.aggregationRules ?? [],
		conflictResolutionRules: p.conflictResolutionRules ?? [],
		parentCompletionClaimId: p.parentCompletionClaimId,
		status: 'READY'
	};
	return createObject(ctx, command, {
		objectType: RECOMP,
		aggregateId: id,
		state,
		eventType: 'RecompositionProposed',
		eventPayload: {
			recompositionContractId: id,
			parentWorkUnitId: p.parentWorkUnitId,
			requiredChildWorkUnitIds: p.requiredChildWorkUnitIds,
			parentCompletionClaimId: p.parentCompletionClaimId,
			status: 'READY'
		}
	});
};

/** BeginRecomposition — RecompositionContract.status READY -> EVALUATING. */
export const beginRecomposition: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: RECOMP,
		statusField: 'status',
		machine: 'RecompositionContract.status',
		target: 'EVALUATING',
		// JAN-CMDPRE DWP-03: RecompositionContract.status has THREE in-arrows to EVALUATING — READY (first pass) and
		// CONFLICTED/INSUFFICIENT ("re-evaluation after remediation"). No separate re-evaluation command exists
		// (registry has only Propose/Begin/CompleteRecomposition), so BeginRecomposition IS the re-evaluation driver;
		// authoring the machine's full set keeps that legitimate. A re-issue from EVALUATING (already evaluating) is
		// the only NOOP, and it is refused. RESOLVED (DWP-03 UNCLEAR row): no consumer treats a duplicate
		// RecompositionStarted as a distinct attempt — replay-conformance checks event-TYPE set membership only, and
		// the §26 canonical fixture (expected-events.jsonl / m13-replay.json) carries exactly one. (The live seed
		// driveReferenceUndertaking drives NO recomposition at all — replay-conformance pins RecompositionStarted in
		// its `missing` list — so it is silent on the count either way.) Admitting re-evaluations (which legitimately
		// re-emit) therefore breaks nothing; refusing the true NOOP is the only thing needed.
		precondition: fromStates('READY', 'CONFLICTED', 'INSUFFICIENT'),
		eventType: 'RecompositionStarted'
	});

// §14.1 acceptable-child set: a required child contributes acceptably to recomposition when its assurance rollup
// is SATISFIED / CONDITIONALLY_SATISFIED / WAIVED. (Child COMPLETION alone is necessary but NOT sufficient.)
const ACCEPTABLE_CHILD_ASSURANCE = new Set(['SATISFIED', 'CONDITIONALLY_SATISFIED', 'WAIVED']);

// evaluateRecomposition outcome -> RecompositionContract.status machine state.
const RECOMP_OUTCOME_STATE: Record<string, string> = {
	SATISFIED: 'COMPOSABLE',
	CONFLICTED: 'CONFLICTED',
	INSUFFICIENT: 'INSUFFICIENT'
};

/** Build the §14.1 recomposition input. Child acceptability is DERIVED (load each required child PWU; the caller
 *  cannot fake it); detected conflicts + the two whole-checks are the recomposition author's evaluation, carried
 *  on the command; conflict-resolution rules come from the contract. */
function buildRecompositionInput(
	ctx: HandlerContext,
	contract: Record<string, unknown>,
	p: CompleteRecompositionPayload
): RecompositionInput {
	const requiredChildResults: RequiredChildResult[] = (
		(contract.requiredChildWorkUnitIds as string[] | undefined) ?? []
	).map((childWorkUnitId) => ({
		childWorkUnitId,
		acceptable: ACCEPTABLE_CHILD_ASSURANCE.has(str(loadState(ctx, childWorkUnitId)?.assuranceState))
	}));
	const rules = (contract.conflictResolutionRules as
		| { conflictType: string; action: string }[]
		| undefined) ?? [];
	return {
		requiredChildResults,
		detectedConflicts: (p.detectedConflicts ?? []).map((c) => ({
			conflictType: c.conflictType,
			conflictingChildWorkUnitIds: c.conflictingChildWorkUnitIds,
			description: c.description
		})),
		conflictResolutionRules: rules.map((r) => ({ conflictType: r.conflictType, action: r.action })),
		parentCompletionClaimSupported: p.parentCompletionClaimSupported ?? true,
		parentConstraintsHoldAgainstWhole: p.parentConstraintsHoldAgainstWhole ?? true
	};
}

/**
 * CompleteRecomposition — evaluate the recomposition (§14.1 / RPH-DEC-005/006) and advance the contract to
 * COMPOSABLE / CONFLICTED / INSUFFICIENT accordingly. This is the WIRE-3a wiring: before it, the handler
 * unconditionally advanced to COMPOSABLE, so a recomposition with a detected conflict (or an unacceptable
 * required child) was still marked composable — the §19-prohibited "recomposition = concatenation" shortcut. Now
 * a detected conflict forces CONFLICTED even when every child is individually SATISFIED, and an unacceptable
 * required child or a failed whole-check forces INSUFFICIENT.
 */
export const completeRecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as CompleteRecompositionPayload;
	const contract = loadState(ctx, command.targetAggregateId);
	if (!contract) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`CompleteRecomposition requires an existing recomposition contract ${command.targetAggregateId}`
		);
	}
	const evaluation = evaluateRecomposition(buildRecompositionInput(ctx, contract, p));
	return advanceStatus(ctx, command, {
		objectType: RECOMP,
		statusField: 'status',
		machine: 'RecompositionContract.status',
		target: RECOMP_OUTCOME_STATE[evaluation.status] ?? 'INSUFFICIENT',
		// JAN-CMDPRE DWP-03: like validateDecomposition, the target is EVALUATION-derived
		// (COMPOSABLE|CONFLICTED|INSUFFICIENT) but ALL THREE share a SINGLE in-arrow — from EVALUATING — so the
		// source precondition is a clean state set, NOT a D10 predicate (roadmap over-worried). This is the
		// EVALUATING -> outcome hop (NOT the machine's COMPOSABLE -> SATISFIED arrow its `completeRecomposition`
		// trigger label names); a re-issue from a settled outcome is refused, so no contradicting second evaluation.
		precondition: fromStates('EVALUATING'),
		eventType: evaluation.event,
		eventPayload: () => ({
			status: RECOMP_OUTCOME_STATE[evaluation.status] ?? 'INSUFFICIENT',
			...(evaluation.reasons.length ? { reasons: evaluation.reasons } : {}),
			...(evaluation.unsatisfiedChildWorkUnitIds.length
				? { unsatisfiedChildWorkUnitIds: evaluation.unsatisfiedChildWorkUnitIds }
				: {})
		})
	});
};
