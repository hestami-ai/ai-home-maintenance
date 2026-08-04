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
	/**
	 * REG-F-014's fifth instance (2026-08-03). `authorityDecisionId` reached the kernel STRAIGHT FROM THE
	 * PAYLOAD, and all three arms that read it test only TRUTHINESS — so ANY NON-EMPTY STRING was authority.
	 * A constraint could be declared INAPPLICABLE, WAIVED, or weakened from MANDATORY by citing an id that
	 * named nothing.
	 *
	 * RESOLVED AT THE BOUNDARY, DECIDED IN THE KERNEL — which is why the kernel is untouched. It cannot load
	 * objects and should not: the arms are correct, they were simply fed an unverified fact. An id that does
	 * not resolve to an EFFECTIVE Decision is passed on as ABSENT, so the kernel's existing ratified findings
	 * (CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY / INAPPLICABLE_WITHOUT_RATIONALE / WAIVED_WITHOUT_AUTHORITY) fire
	 * exactly as they do for a citation nobody made. An authority that does not exist is no authority.
	 *
	 * EFFECTIVE, not merely present: a PROPOSED decision has decided nothing, and canon ASR-15 checks authority
	 * BEFORE effect. A decision that has not become effective cannot be the basis for dropping a constraint.
	 *
	 * SURVEYED FIRST, as every behaviour change in this series has been: across the whole suite exactly TWO
	 * dispositions carried an `authorityDecisionId`, both the same literal, and BOTH named an object the store
	 * has never held — the enforcement register's own RPH-CNS-003 probe, which now cites a real one.
	 *
	 * KNOWN IMPRECISION, PRE-EXISTING AND NOT INTRODUCED HERE: `INAPPLICABLE_WITHOUT_RATIONALE` is the code the
	 * kernel emits for `!rationale || !authorityDecisionId`, so a caller who supplied a rationale and an
	 * unresolvable authority is told the rationale is missing. The code name was already wrong for that half
	 * before this change; it is recorded rather than silently widened.
	 */
	const authorityBasis = (id: string | undefined): string | undefined => {
		if (!id) return undefined;
		const decision = ctx.store.loadObject(id)?.state as
			| { status?: string; decisionType?: string }
			| undefined;
		return decision?.status === 'EFFECTIVE' ? id : undefined;
	};
	const propagations = (state.constraintPropagations as ConstraintPropagation[] | undefined) ?? [];
	const dispositions: ConstraintDispositionRecord[] = propagations.map((r) => ({
		constraintId: r.constraintId,
		disposition: (r.disposition ?? 'PROPAGATED') as ConstraintDispositionRecord['disposition'],
		childWorkUnitIds: r.childWorkUnitIds ?? [],
		rationale: r.rationale,
		authorityDecisionId: authorityBasis(r.authorityDecisionId),
		supersededByConstraintId: r.supersededByConstraintId
	}));
	return { parentConstraints, dispositions };
}

function checkDecompositionConservation(
	state: Record<string, unknown>,
	ctx: HandlerContext,
	command: DomainCommand,
	// NAMED BY THE CALLER (REG-F-006). Two commands now run this gate — ValidateDecomposition over a proposed
	// contract, and ReviseDecomposition over a REVISED one — and a shared message saying "ValidateDecomposition"
	// would misreport which act was refused. The findings are the same; the act is not.
	act = `ValidateDecomposition cannot mark ${command.targetAggregateId} valid`
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
		`${act}: the decomposition does not conserve its parent's obligations/constraints (§35.1 / RPH-DEC-002/007 / RPH-CNS-001..004): ${parts.join('; ')}`
	);
}

/**
 * §8.16's blocking set, as `governance.ts`'s baseline gate reads it (`BLOCKING_SEVERITIES`) — the two
 * `AssuranceSeverity` values that block, not a new ranking authored here.
 *
 * THE SEVERITY SET IS SHARED; THE SURROUNDING PREDICATE IS NOT, and that difference is stated rather than left to
 * be inferred from the name. `governance.ts`'s baseline gate filters on severity AND on `disposition`
 * (`UNSETTLED_DISPOSITIONS`), so an observation that has been WAIVED or otherwise settled stops blocking a
 * promotion. The derivation below keys on severity ALONE, so a settled blocking-severity observation still
 * appears in `blockingObservationIds`.
 *
 * WHETHER THAT IS RIGHT IS A REAL QUESTION AND IS NOT DECIDED HERE. Promotion and decomposition-validation are
 * different acts: a waiver granted against a promotion is not obviously a waiver against a parent's right to
 * decompose. Copying `UNSETTLED_DISPOSITIONS` across would be assuming they are the same act; adding a
 * disposition filter authored here would be inventing one. The field records what the VALIDATOR cited as
 * blocking, which is severity, and the narrower reading is left to a rule that states it.
 */
const BLOCKING_OBSERVATION_SEVERITIES = new Set(['BLOCKING', 'CRITICAL']);

/**
 * The BLOCKING SUBSET of the observations the validator cited — `DecompositionRejected.blockingObservationIds`.
 *
 * DERIVED, NOT ASSERTED: `severity` is read off each cited ASSURANCE_OBSERVATION object, so the caller cannot
 * declare a non-blocking observation to be the thing that blocked. The vocab entry says exactly this — the field
 * is "distinct from ... observationIds (the blocking subset)" — and `ValidateDecompositionPayloadSchema` offers no
 * `blockingObservationIds` to copy, so copying `observationIds` wholesale would assert every considered
 * observation was blocking. An id that does not resolve to a live ASSURANCE_OBSERVATION is omitted: its severity
 * is unknown and an unknown severity is not evidence of blocking.
 */
function blockingObservationIds(ctx: HandlerContext, observationIds: readonly string[]): string[] {
	return observationIds.filter((oid) => {
		const o = loadState(ctx, oid);
		return (
			o?.objectType === 'ASSURANCE_OBSERVATION' &&
			BLOCKING_OBSERVATION_SEVERITIES.has(str(o.severity))
		);
	});
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
		//
		// ONE BUILDER, TWO DECLARED SHAPES (REG-F-020). This call site emits `DecompositionValidated` on two arms and
		// `DecompositionRejected` on the third, and the two interfaces are NOT the same object: Rejected REQUIRES
		// `blockingObservationIds` and declares no `validatorRole`, so the single shared shape emitted before was
		// missing a required field AND — whenever the validator named its role — carried a key a strictObject
		// rejects. Branch on the event actually being emitted, not on convenience.
		eventPayload: () =>
			mapping.event === 'DecompositionRejected'
				? {
						blockingObservationIds: blockingObservationIds(ctx, p.observationIds ?? []),
						...(p.observationIds?.length ? { observationIds: p.observationIds } : {}),
						status: mapping.target
					}
				: {
						status: mapping.target,
						...(p.validatorRole ? { validatorRole: p.validatorRole } : {}),
						...(p.observationIds?.length ? { observationIds: p.observationIds } : {})
					}
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
// NARROWED 2026-08-02 (REG-F-006's DOCS_STRONGER component). This list carried all three carrier fields while none
// was honoured. Two now are: `obligationAllocations` and `constraintPropagations` are applied, and gated by the
// same M9 conservation kernel `validateDecomposition` calls — a second call site, which is what the finding said
// the remaining work actually was.
//
// `childWorkUnitIds` STAYS REFUSED, and not for want of effort. DEC-2's operative clause is "triggers impact
// analysis", and impact analysis has no plane in this engine: `impactedObjects` is a hollow-kernel-triage deferral
// awaiting a TraceLink-minting command surface that does not exist. Applying a revised child set while silently
// performing no impact analysis would be the F-I defect exactly — a caller told the revision succeeded, with no
// way to learn what was not done. Refusing the one field that is genuinely blocked is the same B7 discharge as
// before, no longer standing in for the two that are not.
const UNHONOURED_REVISION_FIELDS: readonly (readonly [string, string])[] = [
	[
		'childWorkUnitIds',
		'DOC-003 DEC-2 — a revised child set changes the parent claim and triggers impact analysis, and this engine has no impact-analysis plane (impactedObjects has no caller and needs a TraceLink-minting surface)'
	]
];

/** The content fields a revision MAY carry, applied to the contract state when conservation holds. */
const HONOURED_REVISION_FIELDS = ['obligationAllocations', 'constraintPropagations'] as const;

export const reviseDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = (payload ?? {}) as Record<string, unknown>;
	const offered = UNHONOURED_REVISION_FIELDS.filter(([field]) => p[field] !== undefined);
	if (offered.length > 0) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ReviseDecomposition cannot perform a content revision: ${offered
				.map(([field, rule]) => `${field} (${rule})`)
				.join(
					'; '
				)}. This command supersedes the contract and bumps its semantic version; it does not ` +
				`apply a revised child set. Propose a new DecompositionContract for the parent instead. ` +
				`(JPWB-SPEC-001-DR-002 F-I — the capability is declared on the payload and not yet implemented.)`
		);
	}

	// DEC-3 / DEC-4 OVER THE REVISED CONTENT. The gate runs against the contract AS REVISED, not as stored —
	// checking the stored state would pass every revision by construction, which is the vacuity shape this
	// programme keeps finding. A revision carrying no content is unchanged content, and is still checked.
	const revisions = Object.fromEntries(
		HONOURED_REVISION_FIELDS.filter((f) => p[f] !== undefined).map((f) => [f, p[f]])
	);
	if (Object.keys(revisions).length > 0) {
		const stored = loadState(ctx, command.targetAggregateId);
		if (stored) {
			const conservation = checkDecompositionConservation(
				{ ...stored, ...revisions },
				ctx,
				command,
				`ReviseDecomposition cannot apply this revision to ${command.targetAggregateId}`
			);
			if (conservation) return conservation;
		}
	}

	return advanceStatus(ctx, command, {
		mutate: (base) => ({ ...base, ...revisions }),
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
			rationale: String((p.rationale ?? '') as string | number | boolean),
			semanticVersion: Number(next.semanticVersion ?? 0),
			status: String((next.status ?? '') as string | number | boolean)
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
		eventType: 'RecompositionStarted',
		// REG-F-020. Without this builder `advanceStatus` emitted the raw COMMAND payload —
		// `{recompositionContractId}` — which is not one field of the declared `RecompositionStartedPayloadSchema`:
		// all three required fields were absent, and the one key present is not declared. The event that records
		// "this recomposition began" could not say WHICH parent or WHICH children it began over.
		//
		// Every field comes from the COMMITTED next state, which is where those facts live (ProposeRecomposition
		// wrote them and `RecompositionContractSchema` requires them). `recompositionContractId` is not dropped
		// information: it IS `aggregateId` on the event envelope `makeEvent` builds.
		//
		// `workLifecycleState` is DECLARED OPTIONAL and deliberately NOT emitted: its vocab note is "parent PWU
		// SATISFIED->RECOMPOSING", and this handler advances the CONTRACT, never the parent PWU. Emitting a
		// lifecycle state no transition produced would be a fabricated fact in an append-only record.
		// (The quote was checked against `vocab/m3-commands-events.json` — an earlier draft of this comment cited
		// it as "RECOMPOSING->RECOMPOSED", which is the note on a DIFFERENT field. The conclusion is unchanged
		// either way, and a justification that misquotes its own source is still worth correcting.)
		eventPayload: (next) => ({
			parentWorkUnitId: str(next.parentWorkUnitId),
			requiredChildWorkUnitIds: (next.requiredChildWorkUnitIds as string[] | undefined) ?? [],
			status: str(next.status)
		})
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
	const rules =
		(contract.conflictResolutionRules as { conflictType: string; action: string }[] | undefined) ??
		[];
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
	// The caller must NAME the claim it believes it is settling, and it must be the one this contract was
	// proposed to settle (REG-F-020 residue).
	//
	// `parentCompletionClaimId` is REQUIRED on the command and, until now, READ BY NOTHING: the event payload
	// takes it from the CONTRACT, and no other line referenced `p.parentCompletionClaimId`. A required field that
	// nothing reads is the `GrantWaiver.effectiveAt` shape — a contract inviting a caller to believe they set
	// something — and there were two ways to close it. REMOVING the field was available (this command is
	// UNRATIFIED-AUTHORED, so the shape is ours) and is the WEAKER answer: the caller naming the claim is a
	// meaningful assertion, and checking it catches a caller completing the WRONG contract, which is a real
	// mistake at a real seam — the recomposition contract id and the claim id are different ids, and a caller
	// that has muddled them is otherwise told it succeeded.
	//
	// So it becomes a PRECONDITION rather than an ignored field — the REG-F-017 medicine: refuse on disagreement
	// rather than silently preferring one side. The event still records the CONTRACT's claim, which is now
	// provably the same value.
	const contractClaimId = str(contract.parentCompletionClaimId);
	if (contractClaimId !== undefined && p.parentCompletionClaimId !== contractClaimId) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`CompleteRecomposition names parent completion claim ${p.parentCompletionClaimId}, but recomposition ` +
				`contract ${command.targetAggregateId} was proposed to settle ${contractClaimId}. Completing a ` +
				`contract while naming a different claim would record a settlement of work this contract never ` +
				`covered — re-issue against the contract that owns the claim.`,
			[command.targetAggregateId]
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
		// REG-F-020. ONE CALL SITE, THREE DECLARED INTERFACES — the kernel picks the event (`evaluation.event`), so
		// the payload must be built for whichever one it picked. The single shape emitted before satisfied none of
		// them: it carried `reasons`, which NO ONE of the three declares (a strictObject hard-rejects it), and it
		// omitted every required field but `status` — so `RecompositionCompleted` did not name the parent completion
		// claim it completed, `RecompositionConflictDetected` did not name the conflicting children or say what the
		// conflict WAS, and `RecompositionFailed` did not carry a reason. The kernel's `reasons` are not lost: they
		// are the substance of `conflictDescription` / `reason`, which is the field each shape declares for them.
		eventPayload: (next) => {
			const status = str(next.status);
			if (evaluation.event === 'RecompositionCompleted') {
				// From the CONTRACT, not `p.parentCompletionClaimId`: the claim this contract was proposed to
				// settle is the one that was settled, and `RecompositionContractSchema` requires it.
				// `workLifecycleState` (optional, "parent PWU RECOMPOSING->RECOMPOSED") is omitted — this handler
				// advances the contract, not the parent PWU.
				return { parentCompletionClaimId: str(next.parentCompletionClaimId), status };
			}
			if (evaluation.event === 'RecompositionConflictDetected') {
				// The union of the children named by the detected conflicts, de-duplicated (a child can appear in
				// more than one conflict). `reasons` is one "conflictType: description" line per conflict — the
				// kernel's own rendering — which is what `conflictDescription` is for.
				return {
					conflictingChildWorkUnitIds: [
						...new Set((p.detectedConflicts ?? []).flatMap((c) => c.conflictingChildWorkUnitIds))
					],
					conflictDescription: evaluation.reasons.join('; '),
					status
				};
			}
			return {
				reason: evaluation.reasons.join('; '),
				...(evaluation.unsatisfiedChildWorkUnitIds.length
					? { unsatisfiedChildWorkUnitIds: [...evaluation.unsatisfiedChildWorkUnitIds] }
					: {}),
				status
			};
		}
	});
};
