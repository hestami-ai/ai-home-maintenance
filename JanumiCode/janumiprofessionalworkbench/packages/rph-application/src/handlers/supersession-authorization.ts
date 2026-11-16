// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.26, "The link, and its check";
// `REG-D-166` (1); `REG-F-643`; `REG-F-212`, its remedy (2) for this path) — WHAT A SUPERSESSION OF A WORK UNIT MAY NAME AS ITS SUCCESSOR,
// AND WHAT AUTHORIZES IT.
//
// ⛔ WHAT WAS WRONG (`REG-F-212`). `supersedePwu` copied the caller's successor id into its event and never loaded it: a supersession naming a
// successor that was never created was ACCEPTED (driven, *"A workLifecycleState = SUPERSEDED | successor exists in store? = false"*), and
// SUPERSEDED is terminal, so a unit superseded by fiction is stranded with no successor to carry its work — the harm `supersedeIntent`'s own
// refusal names. `supersedeIntent` resolves its successor (`intent.ts`), and `supersedeExecutionPlan` holds its successor to the same PWU.
// ⭐ D72 (the lead's): the kernel refuses a supersession whose successor is missing, is the unit itself, is of another type or Undertaking, is
// not PROPOSED or already succeeds another unit, or that cites no EFFECTIVE `REPLAN` Decision naming the old unit. ⭑ DERIVE-ON-READ, as
// `abandon-authorization.ts`: the caller names WHICH successor and WHICH Decision; this reads both from the record, and asserts neither.
// ⚠ AN EXISTENCE-ONLY RESOLVE IS NOT ENOUGH, as `REG-F-212` records of `supersedeIntent`'s copy: the successor's object type is checked with it.
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import { withScanContext } from '@janumipwb/rph-ports';
import type { HandlerContext } from './kit.js';

const PWU = 'PROFESSIONAL_WORK_UNIT';

export interface SupersessionQuery {
	/** The unit being superseded. */
	readonly pwuId: string;
	/** Its stored state, as the command loaded it: its Undertaking and its type are read from it. */
	readonly pwuState: Readonly<Record<string, unknown>>;
	/** Its CURRENT semanticVersion — the version the Decision must pin (ASR-15). */
	readonly pwuSemanticVersion: number;
	/** The successor the command names (`supersedingWorkUnitId`). */
	readonly successorId: string;
	/** The Decision the command cites (`supersessionDecisionId`). */
	readonly decisionId: string;
}

export type SupersessionVerdict =
	| { readonly ok: true }
	| {
			readonly ok: false;
			/** `RPH_VALIDATION_SEMANTIC_FAILED` for a successor that names the wrong thing, as `supersedeIntent`'s; `RPH_INVARIANT_VIOLATION` for missing authority, as `abandonPwu`'s. */
			readonly code: 'RPH_VALIDATION_SEMANTIC_FAILED' | 'RPH_INVARIANT_VIOLATION';
			readonly reason: string;
	  };

/**
 * The work unit, other than `pwuId`, whose recorded successor is `successorId`; undefined when none. ⭑ AN ENUMERATION, NOT A BY-ID READ
 * (`JAN-CRITREAD` `DD-6b`): the store lists no type, so the event log is walked for the work units' ids and each is loaded in a scan context,
 * as `latestAssessmentByPolicy` finds a subject's assessments.
 */
function predecessorOf(ctx: HandlerContext, successorId: string, pwuId: string): string | undefined {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents()) if (e.aggregateType === PWU && e.aggregateId !== pwuId) ids.add(e.aggregateId);
	return withScanContext(() =>
		[...ids].find(
			(id) => (ctx.store.loadObject(id)?.state as { supersedingWorkUnitId?: unknown } | undefined)?.supersedingWorkUnitId === successorId
		)
	);
}

/** Why `query.successorId` cannot succeed `query.pwuId`, or null when it can — the successor's limbs, the most fundamental first. */
function successorRefusal(ctx: HandlerContext, query: SupersessionQuery): string | null {
	if (query.successorId === query.pwuId) return 'it names the unit itself as its successor';
	const stored = ctx.store.loadObject(query.successorId);
	if (!stored) return `it names ${query.successorId} as its successor, and nothing by that id is recorded`;
	if (stored.objectType !== PWU) return `it names ${query.successorId} as its successor, a ${stored.objectType}, not a work unit`;
	const successor = stored.state as { undertakingId?: unknown; pwuTypeId?: unknown; workLifecycleState?: unknown };
	if (successor.undertakingId !== query.pwuState.undertakingId)
		return `its successor ${query.successorId} is a unit of Undertaking ${String(successor.undertakingId)}, not of this unit's ${String(query.pwuState.undertakingId)}`;
	if (successor.pwuTypeId !== query.pwuState.pwuTypeId)
		return `its successor ${query.successorId} is of type ${String(successor.pwuTypeId)}, not of this unit's ${String(query.pwuState.pwuTypeId)}`;
	if (successor.workLifecycleState !== 'PROPOSED')
		return `its successor ${query.successorId} is ${String(successor.workLifecycleState)}, not PROPOSED: a successor is a new unit, not one already at work`;
	const other = predecessorOf(ctx, query.successorId, query.pwuId);
	if (other !== undefined) return `its successor ${query.successorId} already succeeds ${other}`;
	return null;
}

/** Why `query.decisionId` does not authorize the supersession, or null when it does — ordered as `resolveAbandonAuthorization`'s seven. */
function decisionRefusal(ctx: HandlerContext, query: SupersessionQuery): string | null {
	const stored = ctx.store.loadObject(query.decisionId);
	if (!stored) return `the Decision it cites, ${query.decisionId}, names no recorded object`;
	if (stored.objectType !== 'DECISION') return `the Decision it cites, ${query.decisionId}, is a ${stored.objectType}, not a DECISION`;
	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success) return `the Decision it cites, ${query.decisionId}, does not parse as a DECISION, so its authority cannot be established`;
	const decision = parsed.data;
	if (decision.decisionType !== 'REPLAN') return `the Decision it cites, ${query.decisionId}, is a ${decision.decisionType} decision, not a REPLAN`;
	if (decision.status !== 'EFFECTIVE')
		return `the Decision it cites, ${query.decisionId}, is ${decision.status}, not EFFECTIVE: a proposed Decision is a request, not an authority`;
	// The schema requires both fields, and the Decision is read only through it, so each is read as given (package L16's facts §8.2).
	if (!decision.subjectObjectIds.includes(query.pwuId))
		return `the Decision it cites, ${query.decisionId}, does not name ${query.pwuId} among its subjects — an authorization does not bleed to another object (RPH-GOV-005)`;
	// ⚠ ASR-15's version pin, kept as every Decision guard of this kernel keeps it — though no command reaches it: a unit's semanticVersion never
	// moves (`REG-F-109`) and `proposeDecision` pins each subject at its own, so a Decision naming the unit pins it there (named in L17a's facts).
	const pinned = decision.subjectSemanticVersions[query.pwuId];
	if (pinned !== query.pwuSemanticVersion)
		return `the Decision it cites, ${query.decisionId}, pins ${query.pwuId} at semanticVersion ${String(pinned)}, but the PWU is at ${query.pwuSemanticVersion} (ASR-15)`;
	return null;
}

/**
 * ⭐⭐ D72 — MAY `query.pwuId` BE SUPERSEDED BY `query.successorId`, UNDER `query.decisionId`? ⛔ FAIL CLOSED, the successor first, then the
 * authority: a successor that is not this unit, recorded, a work unit of its Undertaking and of its type, PROPOSED, and the successor of no
 * other unit; and a person's EFFECTIVE `REPLAN` Decision naming the unit, pinned at its version.
 */
export function resolveSupersession(ctx: HandlerContext, query: SupersessionQuery): SupersessionVerdict {
	const successor = successorRefusal(ctx, query);
	if (successor !== null) return { ok: false, code: 'RPH_VALIDATION_SEMANTIC_FAILED', reason: successor };
	const decision = decisionRefusal(ctx, query);
	if (decision !== null) return { ok: false, code: 'RPH_INVARIANT_VIOLATION', reason: decision };
	return { ok: true };
}
