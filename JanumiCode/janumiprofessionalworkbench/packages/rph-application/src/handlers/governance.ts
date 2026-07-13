// Governance handlers: Decisions (propose/approve/revoke), Waivers (a Decision of decisionType WAIVER —
// request/grant/deny), and Baselines (create/submit/approve/promote/supersede). Authority is the load-bearing
// rule: approval requires authority (GOV-001/002) — an AGENT actor may recommend but not approve; only a HUMAN
// (or delegated) authority makes a decision EFFECTIVE. Baseline promotion runs the full canPromoteBaseline gate
// (effective promotion decision + required assessments satisfied/waived + no open blocking + version pinning —
// "no green without assurance", INV-20 / P7 immutability afterwards).
import type {
	ApproveDecisionPayload,
	CreateBaselinePayload,
	DomainCommand,
	ProposeDecisionPayload,
	PromoteBaselinePayload,
	RequestWaiverPayload
} from '@janumipwb/rph-contracts';
import { authorizeDecisionEffective, canPromoteBaseline } from '@janumipwb/rph-domain';
import {
	advanceStatus,
	createObject,
	newEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';

const DECISION = 'DECISION';
const BASELINE = 'BASELINE';

/** Current semantic versions of the given subject objects (best-effort; absent subjects are omitted). */
function subjectVersions(ctx: HandlerContext, ids: readonly string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const id of ids) {
		const obj = ctx.store.loadObject(id);
		if (obj) out[id] = obj.semanticVersion;
	}
	return out;
}

// ---- Decisions ----

/** ProposeDecision — create a governance Decision in PROPOSED, pinning the subjects' current semantic versions. */
export const proposeDecision: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeDecisionPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, DECISION, id, {
			lifecycleStatus: 'PROPOSED',
			originType: 'HUMAN_DECISION',
			sourceObjectIds: p.subjectObjectIds
		}),
		decisionType: p.decisionType,
		subjectObjectIds: p.subjectObjectIds,
		subjectSemanticVersions: subjectVersions(ctx, p.subjectObjectIds),
		selectedOption: p.selectedOption,
		rationale: p.rationale,
		authority: p.authority,
		consideredEvidenceIds: p.consideredEvidenceIds ?? [],
		consideredObservationIds: p.consideredObservationIds ?? [],
		...(p.effectiveAt ? { effectiveAt: p.effectiveAt } : {}),
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: DECISION,
		aggregateId: id,
		state,
		eventType: 'DecisionProposed'
	});
};

/** The authority gate shared by ApproveDecision + GrantWaiver: PROPOSED -> EFFECTIVE requires a held authority
 * (an AGENT/MODEL actor may recommend but not approve — GOV-001/002). */
function makeDecisionEffective(
	target: 'EFFECTIVE',
	eventType: string,
	extraMutate?: (base: Record<string, unknown>, command: DomainCommand) => Record<string, unknown>
): CommandHandler {
	return (ctx, command) =>
		advanceStatus(ctx, command, {
			objectType: DECISION,
			statusField: 'status',
			machine: 'Decision.status',
			target,
			eventType,
			guard: (state) => {
				const authority = state.authority as { actorType?: string } | undefined;
				const authorityHeld = authority?.actorType === 'HUMAN' || authority?.actorType === 'SYSTEM';
				const check = authorizeDecisionEffective({
					decisionId: command.targetAggregateId,
					decisionType: String(state.decisionType),
					status: String(state.status),
					subjectObjectIds: (state.subjectObjectIds as string[]) ?? [],
					subjectSemanticVersions: (state.subjectSemanticVersions as Record<string, number>) ?? {},
					authorityHeld
				});
				if (!check.ok) {
					return reject(
						command,
						'RPH_AUTHORITY_INSUFFICIENT',
						`Decision ${command.targetAggregateId} cannot become effective: ${check.reason ?? 'insufficient authority'}`
					);
				}
				return null;
			},
			mutate: (base) => (extraMutate ? extraMutate(base, command) : base)
		});
}

/** ApproveDecision — PROPOSED -> EFFECTIVE (records the approved subject versions + selected option). */
export const approveDecision: CommandHandler = makeDecisionEffective(
	'EFFECTIVE',
	'DecisionEffective',
	(base, command) => {
		const p = command.payload as ApproveDecisionPayload;
		return {
			...base,
			selectedOption: p.selectedOption,
			rationale: p.rationale,
			consideredEvidenceIds: p.consideredEvidenceIds,
			consideredObservationIds: p.consideredObservationIds,
			subjectSemanticVersions: p.subjectSemanticVersions,
			effectiveAt: command.issuedAt
		};
	}
);

/** RevokeDecision — EFFECTIVE -> REVOKED (triggers impact analysis; cannot retroactively change evidence). */
export const revokeDecision: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: DECISION,
		statusField: 'status',
		machine: 'Decision.status',
		target: 'REVOKED',
		eventType: 'DecisionRevoked'
	});

// ---- Waivers (a Decision of decisionType WAIVER) ----

/** RequestWaiver — create a WAIVER Decision in PROPOSED (scope + rationale + duration + affected objects). */
export const requestWaiver: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestWaiverPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, DECISION, id, {
			lifecycleStatus: 'PROPOSED',
			originType: 'HUMAN_DECISION',
			sourceObjectIds: p.subjectObjectIds
		}),
		decisionType: 'WAIVER',
		subjectObjectIds: p.subjectObjectIds,
		subjectSemanticVersions: subjectVersions(ctx, p.subjectObjectIds),
		selectedOption: 'WAIVE',
		rationale: p.rationale,
		authority: command.issuedBy,
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: DECISION,
		aggregateId: id,
		state,
		eventType: 'WaiverRequested'
	});
};

/** GrantWaiver — PROPOSED -> EFFECTIVE (same authority gate as an approval). */
export const grantWaiver: CommandHandler = makeDecisionEffective(
	'EFFECTIVE',
	'WaiverGranted',
	(base, command) => ({
		...base,
		effectiveAt: command.issuedAt
	})
);

/** DenyWaiver — PROPOSED -> SUPERSEDED (a denied waiver request; DecisionStatus has no DENIED value, §23.1 gap). */
export const denyWaiver: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: DECISION,
		statusField: 'status',
		machine: 'Decision.status',
		target: 'SUPERSEDED',
		eventType: 'WaiverDenied'
	});

// ---- Baselines ----

/** CreateBaseline — create a Baseline candidate (CANDIDATE), pinning each item to its current semantic version. */
export const createBaseline: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateBaselinePayload;
	const id = command.targetAggregateId;
	const itemObjectVersions = p.itemObjectIds.map((objectId) => {
		const obj = ctx.store.loadObject(objectId);
		return { objectId, semanticVersion: obj?.semanticVersion ?? 1 };
	});
	const state: Record<string, unknown> = {
		...newEnvelope(command, BASELINE, id, {
			lifecycleStatus: 'CANDIDATE',
			sourceObjectIds: p.itemObjectIds
		}),
		baselineType: p.baselineType,
		purpose: `Baseline of ${p.itemObjectIds.length} item(s)`,
		scope: 'undertaking',
		itemObjectVersions,
		assuranceAssessmentIds: p.assuranceAssessmentIds ?? [],
		promotionDecisionId: '',
		status: 'CANDIDATE'
	};
	return createObject(ctx, command, {
		objectType: BASELINE,
		aggregateId: id,
		state,
		eventType: 'BaselineCreated'
	});
};

/** SubmitBaselineForReview — CANDIDATE -> UNDER_REVIEW. */
export const submitBaselineForReview: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'UNDER_REVIEW',
		eventType: 'BaselineSubmittedForReview'
	});

/** ApproveBaseline — UNDER_REVIEW -> APPROVED. */
export const approveBaseline: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'APPROVED',
		eventType: 'BaselineApproved'
	});

/** PromoteBaseline — APPROVED -> AUTHORITATIVE, gated by canPromoteBaseline (effective promotion decision +
 * required assessments satisfied/waived + no open blocking + item versions pinned). "No green without assurance." */
export const promoteBaseline: CommandHandler = (ctx, command, payload) => {
	const p = payload as PromoteBaselinePayload;
	return advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'AUTHORITATIVE',
		eventType: 'BaselinePromoted',
		guard: (state, hctx) => {
			const decision = hctx.store.loadObject(p.promotionDecisionId)?.state as
				Record<string, unknown> | undefined;
			const promotionDecision = decision
				? {
						decisionId: p.promotionDecisionId,
						decisionType: String(decision.decisionType),
						status: String(decision.status),
						subjectObjectIds: (decision.subjectObjectIds as string[]) ?? [],
						subjectSemanticVersions:
							(decision.subjectSemanticVersions as Record<string, number>) ?? {},
						authorityHeld:
							(decision.authority as { actorType?: string } | undefined)?.actorType === 'HUMAN'
					}
				: undefined;
			const candidateItems = p.expectedItemObjectVersions.map((i) => ({
				objectId: i.objectId,
				semanticVersion: i.semanticVersion,
				...(i.contentHash ? { contentHash: i.contentHash } : {})
			}));
			const requiredAssessments = p.requiredAssessmentIds.map((assessmentId) => {
				const a = hctx.store.loadObject(assessmentId)?.state as
					{ assessmentState?: string } | undefined;
				const disposition = a?.assessmentState ?? 'INCONCLUSIVE';
				const complete = disposition !== 'ASSESSING' && disposition !== 'REQUESTED';
				return { assessmentId, complete, disposition };
			});
			const result = canPromoteBaseline({
				baselineStatus: String(state.status),
				promotionDecision,
				candidateItems,
				reviewedItems: candidateItems,
				requiredAssessments,
				openObservations: []
			});
			if (!result.ok) {
				const codes = result.findings.map((f) => f.code).join(', ');
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot promote baseline ${command.targetAggregateId}: ${codes}`
				);
			}
			return null;
		},
		mutate: (base) => ({ ...base, promotionDecisionId: p.promotionDecisionId })
	});
};

/** SupersedeBaseline — AUTHORITATIVE -> SUPERSEDED (immutability: changes create a successor, P7). */
export const supersedeBaseline: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'SUPERSEDED',
		eventType: 'BaselineSuperseded'
	});
