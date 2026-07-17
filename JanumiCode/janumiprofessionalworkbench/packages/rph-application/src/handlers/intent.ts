// Intent lifecycle handlers — the Intent.intentStatus machine RAW -> UNDER_DISCOVERY -> PROVISIONAL ->
// FORMALIZED -> APPROVED <-> REVISED (DOC-002 §6). CaptureIntent creates; the rest advance an existing Intent,
// each gated by the state machine (checkTransition) and, for approval, the INT-004 invariant (an approved intent
// must carry at least one desired outcome — DOC-008 INT-004 / DOC-002 §6.3).
import type {
	ApproveIntentPayload,
	CaptureIntentPayload,
	DomainCommand,
	FormalizeIntentPayload,
	ProvisionIntentPayload
} from '@janumipwb/rph-contracts';
import {
	checkTransition,
	commitState,
	loadOrReject,
	makeEvent,
	nextEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';

const INTENT = 'INTENT';
const MACHINE = 'Intent.intentStatus';

/** CaptureIntent — (initial) -> RAW. Creates the Intent aggregate. */
export const captureIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as CaptureIntentPayload;
	const ts = command.issuedAt;
	const actor = command.issuedBy;
	const intent: Record<string, unknown> = {
		id: p.intentId,
		objectType: INTENT,
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'RAW',
		createdAt: ts,
		createdBy: actor,
		updatedAt: ts,
		updatedBy: actor,
		provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] },
		ontologyId: p.ontologyId,
		ontologyVersion: p.ontologyVersion,
		tags: [],
		extensions: [],
		originatingExpression: p.originatingExpression,
		desiredOutcomes: [],
		successConditions: [],
		nonGoals: [],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: [],
		intentStatus: 'RAW'
	};
	// Event payload per DOC-007 §10.3 (IntentCapturedPayload) — was the raw CaptureIntent command payload, which
	// lacks intentStatus. The command's four fields carry over; intentStatus is the 'RAW' the transition lands on.
	const event = makeEvent(ctx, command, {
		eventType: 'IntentCaptured',
		aggregateType: INTENT,
		aggregateId: p.intentId,
		aggregateRevision: 0,
		payload: {
			intentId: p.intentId,
			originatingExpression: p.originatingExpression,
			intentStatus: 'RAW',
			ontologyId: p.ontologyId,
			ontologyVersion: p.ontologyVersion
		}
	});
	return commitState(ctx, command, {
		objectType: INTENT,
		aggregateId: p.intentId,
		expectedRevision: undefined,
		newRevision: 0,
		newSemanticVersion: 1,
		nextState: intent,
		event
	});
};

/** Shared advance of the Intent.intentStatus machine: load -> optional precheck -> transition guard -> commit. */
function advanceIntent(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly target: string;
		readonly eventType: string;
		readonly mutate?: (current: Record<string, unknown>) => Record<string, unknown>;
		readonly precheck?: (current: Record<string, unknown>) => CommandHandlerReject | null;
		readonly bumpSemanticVersion?: boolean;
		/** Build the EVENT payload from the loaded semantic versions. Omitted = pass the command payload through
		 * (correct only where DOC-007 schematizes no event interface — the caller must have checked). */
		readonly eventPayload?: (versions: {
			readonly prior: number;
			readonly next: number;
		}) => unknown;
	}
) {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const precheckFailure = args.precheck?.(loaded.state);
	if (precheckFailure) return precheckFailure;
	const from = String(loaded.state.intentStatus);
	const illegal = checkTransition(command, MACHINE, from, args.target);
	if (illegal) return illegal;
	const newRevision = loaded.revision + 1;
	const newSemanticVersion = args.bumpSemanticVersion
		? loaded.semanticVersion + 1
		: loaded.semanticVersion;
	const base = nextEnvelope(
		loaded.state,
		command,
		newRevision,
		args.bumpSemanticVersion ? newSemanticVersion : undefined
	);
	const mutated = args.mutate ? args.mutate(base) : base;
	const next = { ...mutated, lifecycleStatus: args.target, intentStatus: args.target };
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: INTENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: args.eventPayload
			? args.eventPayload({ prior: loaded.semanticVersion, next: newSemanticVersion })
			: command.payload
	});
	return commitState(ctx, command, {
		objectType: INTENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion,
		nextState: next,
		event
	});
}

/** A precheck returns a rejecting CommandResult or null. (Alias for readability.) */
type CommandHandlerReject = ReturnType<typeof reject>;

/** BeginIntentDiscovery — RAW -> UNDER_DISCOVERY. */
export const beginIntentDiscovery: CommandHandler = (ctx, command) =>
	advanceIntent(ctx, command, {
		target: 'UNDER_DISCOVERY',
		eventType: 'IntentDiscoveryStarted',
		// The event records the RESULTING status. IntentDiscoveryStarted declares `intentStatus`, which the
		// BeginIntentDiscovery command payload ({}) does not carry — so the default emitted `{}` recorded nothing of
		// the transition it exists to announce. Ambiguities are discovered later (ProvisionIntent), so none here.
		eventPayload: () => ({ intentStatus: 'UNDER_DISCOVERY' })
	});

/** ProvisionIntent — UNDER_DISCOVERY -> PROVISIONAL (records objective + known ambiguities, DOC-002 §6.1). */
export const provisionIntent: CommandHandler = (ctx, command, payload) =>
	advanceIntent(ctx, command, {
		target: 'PROVISIONAL',
		eventType: 'IntentProvisioned',
		mutate: (c) => {
			const p = payload as ProvisionIntentPayload;
			return { ...c, ambiguityIds: p.ambiguityIds };
		}
	});

/** FormalizeIntent — PROVISIONAL -> FORMALIZED (records objective, outcomes, conditions, non-goals). */
export const formalizeIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as FormalizeIntentPayload;
	return advanceIntent(ctx, command, {
		target: 'FORMALIZED',
		eventType: 'IntentFormalized',
		mutate: (c) => ({
			...c,
			formalizedObjective: p.formalizedObjective,
			desiredOutcomes: p.desiredOutcomes,
			successConditions: p.successConditions,
			nonGoals: p.nonGoals,
			ambiguityIds: p.ambiguityIds,
			constraintIds: p.constraintIds,
			stakeholderIds: p.stakeholderIds
		}),
		// Event payload per DOC-007 §10.5 (IntentFormalizedPayload) — was the raw FormalizeIntent command payload,
		// which lacks the two semanticVersion fields + intentStatus and carries three ids the event does not
		// schematize (ambiguityIds/constraintIds/stakeholderIds — they land on the OBJECT via mutate, not the event).
		// prior === next here: FORMALIZED is not a material change, so this command does not bump (no
		// bumpSemanticVersion), and the event reports the versions the handler actually has.
		eventPayload: (v) => ({
			priorSemanticVersion: v.prior,
			newSemanticVersion: v.next,
			formalizedObjective: p.formalizedObjective,
			desiredOutcomes: p.desiredOutcomes,
			successConditions: p.successConditions,
			nonGoals: p.nonGoals,
			intentStatus: 'FORMALIZED'
		})
	});
};

/** ApproveIntent — FORMALIZED|REVISED -> APPROVED. Enforces INT-004: an approved intent needs a desired outcome. */
export const approveIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as ApproveIntentPayload;
	return advanceIntent(ctx, command, {
		target: 'APPROVED',
		eventType: 'IntentApproved',
		// Event payload per DOC-007 §10.7 (IntentApprovedPayload) — was the raw ApproveIntent command payload, which
		// lacks intentStatus. Contract-drift fix: approvalScope (WHAT the approval authorized) is required on the
		// command but §10.7 dropped it, so it was validated then discarded — the governed stream recorded that the
		// intent was approved and by which decision, but not the scope the approval covered. Now carried (optional
		// atop the ratified §10.7 shape, authored under §0.3; the event stays ratified/gated).
		eventPayload: () => ({
			decisionId: p.decisionId,
			approvedSemanticVersion: p.approvedSemanticVersion,
			intentStatus: 'APPROVED',
			...(p.approvalScope ? { approvalScope: p.approvalScope } : {})
		}),
		precheck: (current) => {
			const outcomes = current.desiredOutcomes;
			if (!Array.isArray(outcomes) || outcomes.length === 0) {
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					'An approved intent must record at least one desired outcome (INT-004)'
				);
			}
			return null;
		}
	});
};

/** ReviseIntent — APPROVED -> REVISED (a material change: increments the semantic version, DOC-002 §6.3). */
export const reviseIntent: CommandHandler = (ctx, command) =>
	advanceIntent(ctx, command, {
		target: 'REVISED',
		eventType: 'IntentRevised',
		bumpSemanticVersion: true
	});
