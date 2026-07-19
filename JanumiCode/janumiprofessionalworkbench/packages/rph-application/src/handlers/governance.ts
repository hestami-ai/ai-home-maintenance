// Governance handlers: Decisions (propose/approve/revoke), Waivers (a Decision of decisionType WAIVER —
// request/grant/deny), and Baselines (create/submit/approve/promote/supersede). Authority is the load-bearing
// rule: approval requires authority (GOV-001/002) — an AGENT actor may recommend but not approve; only a HUMAN
// (or delegated) authority makes a decision EFFECTIVE. Baseline promotion runs the full canPromoteBaseline gate
// (effective promotion decision + required assessments satisfied/waived + no open blocking + version pinning —
// "no green without assurance", INV-20 / P7 immutability afterwards).
import type {
	ApproveBaselinePayload,
	ApproveDecisionPayload,
	BaselineObject,
	BaselinePromotedPayload,
	CreateBaselinePayload,
	DecisionEffectivePayload,
	DecisionObject,
	DomainCommand,
	ProposeDecisionPayload,
	PromoteBaselinePayload,
	RequestWaiverPayload,
	WaiverRule
} from '@janumipwb/rph-contracts';
import {
	authorizeDecisionEffective,
	canPromoteBaseline,
	decisionAuthorizesVersions
} from '@janumipwb/rph-domain';
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
const OBSERVATION = 'ASSURANCE_OBSERVATION';

/** The severities §8.16 L1122 makes promotion-blocking: "no unresolved blocking/critical finding except a
 *  policy-permitted scoped waiver". MATERIAL and below do not block a baseline. */
const BLOCKING_SEVERITIES = new Set(['BLOCKING', 'CRITICAL']);

/** AssuranceObservation.disposition values that leave a finding UNRESOLVED (`OPEN`) or resolved by waiver
 *  (`WAIVED`) — the only two §8.16 L1122 speaks to. ACCEPTED / REMEDIATED / REJECTED / SUPERSEDED are
 *  resolutions the ratified `AssuranceObservation.disposition` machine treats as terminal-and-settled, so they
 *  are not findings the promotion gate re-adjudicates. */
const UNSETTLED_DISPOSITIONS = new Set(['OPEN', 'WAIVED']);

/**
 * The observations recorded against the items this Baseline freezes, projected onto the kernel's
 * `OpenObservationView`. `promoteBaseline` passed `openObservations: []` — a hard-coded empty list — so
 * `canPromoteBaseline`'s RPH-BAS-003 arm iterated nothing and no observation a professional recorded could
 * ever block a promotion. The rule was never missing; it is `findOpenBlockingObservations` in rph-domain,
 * unit-proven at `governance.test.ts:189` and reachable only through `canPromoteBaseline`. This function
 * supplies its input; it decides nothing itself.
 *
 * Every field is READ from the accepted contract, none asserted:
 *   - `subjectObjectIds` (`AssuranceObservationSchema`, objects.ts:421) — inherited from the observation's
 *     Assessment by `recordAssuranceObservation`; an observation is in scope when it names any item the
 *     Baseline freezes. Scoped to the Baseline's OWN `itemObjectVersions` (written at CreateBaseline), not to
 *     the promoting command's `expectedItemObjectVersions`, so a narrowed payload cannot shrink the set of
 *     findings that get to speak.
 *   - `severity` (`AssuranceSeveritySchema`) → `blocking`, per §8.16 L1122's "blocking/critical".
 *   - `disposition` (`ObservationDispositionSchema`) → `waived`. WAIVED is a distinct terminal state from
 *     OPEN on the ratified `AssuranceObservation.disposition` machine, reached only by the `WaiverGranted`
 *     trigger, so the mapping is the contract's own and not a re-scoping of the waiver.
 *
 * DELIBERATELY NOT CLAIMED: whether a WAIVED observation's waiver was "policy-permitted [and] scoped" (§8.16
 * L1122) is NOT decided here. That is the §16 item 12 gap — a waiver has no criterion wire home — which
 * `floor-gate.ts`'s `waiverDischargesFloorPolicy` fails closed on. This function does not re-open it: it
 * reports the disposition the machine recorded and lets the kernel apply RPH-BAS-003. Passing a waived
 * finding as still-blocking would be inventing a rule §8.16 L1122 contradicts; adjudicating the waiver's
 * scope here would be inventing the shape item 12 withholds.
 */
function observationsAgainstBaselineItems(
	ctx: HandlerContext,
	itemObjectIds: ReadonlySet<string>
): { readonly observationId: string; readonly blocking: boolean; readonly waived: boolean }[] {
	const ids = new Set<string>();
	for (const e of ctx.store.readAllEvents())
		if (e.aggregateType === OBSERVATION) ids.add(e.aggregateId);
	const out: { observationId: string; blocking: boolean; waived: boolean }[] = [];
	for (const id of ids) {
		const s = ctx.store.loadObject(id)?.state as
			{ subjectObjectIds?: string[]; severity?: string; disposition?: string } | undefined;
		if (!s || !Array.isArray(s.subjectObjectIds)) continue;
		if (!s.subjectObjectIds.some((subjectId) => itemObjectIds.has(subjectId))) continue;
		const disposition = String(s.disposition);
		if (!UNSETTLED_DISPOSITIONS.has(disposition)) continue;
		out.push({
			observationId: id,
			blocking: BLOCKING_SEVERITIES.has(String(s.severity)),
			waived: disposition === 'WAIVED'
		});
	}
	return out;
}

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
		eventType: 'DecisionProposed',
		// The event records the RESULTING state. DecisionProposed declares the decision + the created `status`
		// (PROPOSED); the raw command payload omits `status`. Emit the declared shape — the required decision fields
		// + status, plus the optional considered-evidence/observation ids and effectiveAt when supplied. (Pinned.)
		eventPayload: {
			decisionType: p.decisionType,
			subjectObjectIds: p.subjectObjectIds,
			selectedOption: p.selectedOption,
			rationale: p.rationale,
			authority: p.authority,
			status: 'PROPOSED',
			...(p.consideredEvidenceIds?.length
				? { consideredEvidenceIds: p.consideredEvidenceIds }
				: {}),
			...(p.consideredObservationIds?.length
				? { consideredObservationIds: p.consideredObservationIds }
				: {}),
			...(p.effectiveAt ? { effectiveAt: p.effectiveAt } : {})
		}
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
			mutate: (base) => (extraMutate ? extraMutate(base, command) : base),
			// DOC-007 §22.2 "Decision effective event". This emitted the raw ApproveDecision COMMAND payload —
			// {selectedOption, rationale, consideredEvidenceIds, consideredObservationIds, subjectSemanticVersions} —
			// which fails §22.2 with FOUR missing fields (decisionId, decisionType, subjectObjectIds, effectiveAt)
			// and two unrecognized keys. That is load-bearing, not cosmetic: replay.ts asserts DecisionEffective
			// precedes the authoritative BaselinePromoted (RPH-GOV-003 / property P5), so the governance approval's
			// audit record was missing the very fields that bind the approval to the subject objects and versions it
			// approved. Every value is read from the committed next state, which commitState validates against
			// DecisionObjectSchema before anything is emitted.
			eventPayload: (next) => {
				const d = next as unknown as DecisionObject;
				const event: DecisionEffectivePayload = {
					decisionId: d.id,
					decisionType: d.decisionType,
					subjectObjectIds: d.subjectObjectIds,
					subjectSemanticVersions: d.subjectSemanticVersions,
					selectedOption: d.selectedOption ?? '',
					rationale: d.rationale ?? '',
					effectiveAt: d.effectiveAt ?? command.issuedAt
				};
				return event;
			}
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

/**
 * RequestWaiver — create a WAIVER Decision in PROPOSED, carrying the scope DOC-004 §12.2 requires.
 *
 * A waiver "must record: exact policy and criterion; exact object and semantic version; finding being waived;
 * authority; rationale; duration or expiration; compensating controls; downstream impact; review conditions"
 * (DOC-004 §12.2; guide §8.15 L1101). Object/version/authority/rationale already lived on the Decision
 * envelope; the rest had NO WIRE HOME, so `scope` and `duration` were collected by the payload and silently
 * dropped here — the Decision could not hold them. That is why any waiver naming the subject discharged the
 * ENTIRE floor: nothing distinguished a waiver of "naming-convention style guide deviation" from a waiver of a
 * REJECTED independent Reasoning Review. §16 item 12 names it: "waiver lacks a complete instance/wire/storage
 * contract", and forbids the consequence by name — "Never implement waiver as a Boolean".
 *
 * `waiver: WaiverDetail` is AUTHORED under the sponsor's 2026-07-16 grant to serialize DOC-004 §12.2's RATIFIED
 * field list, which DOC-007 never schematized. The semantics are ratified; only the wire shape was missing.
 * It is what lets `waiverCovers` / `waiverStillDischarges` (rph-domain — already written, already unit-proven,
 * previously uncallable) be honored at the floor gate instead of a Boolean bypass.
 */
export const requestWaiver: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestWaiverPayload;
	const id = command.targetAggregateId;
	// #1c — waiverRules ENFORCED (settable -> governing). A policy governs its OWN waivability (DOC-004 §12;
	// WaiverRule). When the target policy declares waiver rules, the request must satisfy them: the criterion must
	// be eligible under a rule that ALLOWS waiving, and that rule's required compensating controls must all be
	// present — a waiver may never drop a control to nothing (DOC-004 §12.2 / JCPWA §36.4). An EMPTY waiverRules
	// array (the seeded default) stays permissive, so the floor + reference + demo waivers are unaffected;
	// enforcement fires only for a policy that deliberately declared rules.
	const policy = ctx.store.loadObject(p.waivedPolicyId)?.state as
		| { waiverRules?: ReadonlyArray<WaiverRule> }
		| undefined;
	const waiverRules = policy?.waiverRules ?? [];
	if (waiverRules.length > 0) {
		const applies = (r: WaiverRule) =>
			r.eligibleCriteriaIds.length === 0 || r.eligibleCriteriaIds.includes(p.waivedCriterionId);
		const allowingRule = waiverRules.find((r) => r.waiverAllowed && applies(r));
		if (!allowingRule) {
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`RequestWaiver: policy ${p.waivedPolicyId} does not permit waiving criterion '${p.waivedCriterionId}' — no waiver rule allows it (DOC-004 §12 waiverRules).`,
				[id, p.waivedPolicyId]
			);
		}
		const provided = new Set(p.compensatingControls ?? []);
		const missing = (allowingRule.requiredCompensatingControls ?? []).filter((c) => !provided.has(c));
		if (missing.length > 0) {
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`RequestWaiver: policy ${p.waivedPolicyId}'s waiver rule requires compensating control(s) [${missing.join(', ')}] that the request does not declare (DOC-004 §12.2 / JCPWA §36.4 — a waiver may not drop a control to nothing).`,
				[id, p.waivedPolicyId]
			);
		}
	}
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
		waiver: {
			waivedPolicyId: p.waivedPolicyId,
			waivedCriterionId: p.waivedCriterionId,
			waivedFindingIds: p.waivedFindingIds,
			...(p.expiresAt ? { expiresAt: p.expiresAt } : {}),
			compensatingControls: p.compensatingControls,
			// DOC-004 §12.2 "downstream impact" — the payload's long-standing `affectedObjectIds`.
			downstreamImpactObjectIds: p.affectedObjectIds,
			reviewConditions: p.reviewConditions
		},
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
		eventType: 'BaselineCreated',
		// The event records the RESULTING state. BaselineCreated declares `{ baselineType, itemObjectIds, status }`
		// (+ optional assuranceAssessmentIds); the raw command payload omits the created `status: 'CANDIDATE'`. Emit
		// the declared shape. (Pinned defect in emitted-event-conformance; now conforms.)
		eventPayload: {
			baselineType: p.baselineType,
			itemObjectIds: p.itemObjectIds,
			status: 'CANDIDATE',
			...(p.assuranceAssessmentIds?.length
				? { assuranceAssessmentIds: p.assuranceAssessmentIds }
				: {})
		}
	});
};

/** SubmitBaselineForReview — CANDIDATE -> UNDER_REVIEW. */
export const submitBaselineForReview: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'UNDER_REVIEW',
		eventType: 'BaselineSubmittedForReview',
		// The event records the RESULTING status. BaselineSubmittedForReview declares `status` (UNDER_REVIEW), which
		// the empty command payload does not carry. (Pinned defect in emitted-event-conformance; now conforms.)
		eventPayload: () => ({ status: 'UNDER_REVIEW' })
	});

/** ApproveBaseline — UNDER_REVIEW -> APPROVED. Records the authorizing decision (approvalDecisionId) in BOTH the
 *  governed stream (BaselineApproved event) and the Baseline object (the optional sibling of promotionDecisionId)
 *  when the approval cites one. Contract-drift fix: the command validated approvalDecisionId then discarded it
 *  into neither store, so nothing could answer WHICH decision approved the baseline — an authorization id-ref in a
 *  "no green without assurance" flow. Optional by design (mirrors the command field); absent when uncited. */
export const approveBaseline: CommandHandler = (ctx, command, payload) => {
	const p = payload as ApproveBaselinePayload;
	return advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'APPROVED',
		eventType: 'BaselineApproved',
		mutate: (base) =>
			p.approvalDecisionId ? { ...base, approvalDecisionId: p.approvalDecisionId } : base,
		eventPayload: () => ({
			status: 'APPROVED',
			...(p.approvalDecisionId ? { approvalDecisionId: p.approvalDecisionId } : {})
		})
	});
};

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
			// The item set the Baseline itself froze at CreateBaseline — the subjects whose findings §8.16 L1122
			// requires resolved. Read from the object, not the promoting payload.
			const baselineItemIds = new Set(
				((state.itemObjectVersions as { objectId: string }[] | undefined) ?? []).map(
					(i) => i.objectId
				)
			);
			const result = canPromoteBaseline({
				baselineStatus: String(state.status),
				promotionDecision,
				candidateItems,
				reviewedItems: candidateItems,
				requiredAssessments,
				openObservations: observationsAgainstBaselineItems(hctx, baselineItemIds)
			});
			if (!result.ok) {
				const codes = result.findings.map((f) => f.code).join(', ');
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot promote baseline ${command.targetAggregateId}: ${codes}`
				);
			}
			// W1 WIRE-4 (RPH-GOV-003 / Property P5): a promotion decision binds EXACT subject semantic versions.
			// canPromoteBaseline above proves the decision is EFFECTIVE; this proves it is still CURRENT. If a bound
			// subject's current semantic version no longer equals the version the decision approved, the decision is
			// stale — the subject became re-review-required and cannot be promoted under it. Wires the kernel
			// decisionAuthorizesVersions at the live write-path (promotionDecision already carries the DecisionView
			// shape); previously the kernel was unreachable and a stale-version approval promoted to AUTHORITATIVE.
			if (promotionDecision) {
				const currentSubjectVersions: Record<string, number> = {};
				for (const subjectId of Object.keys(promotionDecision.subjectSemanticVersions)) {
					const v = hctx.store.loadObject(subjectId)?.semanticVersion;
					if (typeof v === 'number') currentSubjectVersions[subjectId] = v;
				}
				const binding = decisionAuthorizesVersions(promotionDecision, currentSubjectVersions);
				if (!binding.ok) {
					const stale = binding.staleSubjects
						.map((s) => `${s.subjectId} approved@${s.approvedVersion} current@${s.currentVersion}`)
						.join('; ');
					return reject(
						command,
						'RPH_INVARIANT_VIOLATION',
						`Cannot promote baseline ${command.targetAggregateId}: STALE_DECISION_VERSION — the promotion decision ${p.promotionDecisionId} bound subject version(s) no longer current (${stale}); the subject is re-review-required (RPH-GOV-003).`
					);
				}
			}
			return null;
		},
		mutate: (base) => ({ ...base, promotionDecisionId: p.promotionDecisionId }),
		// DOC-007 §23.2 BaselinePromotedPayload. Emitted the raw COMMAND payload
		// ({promotionDecisionId, expectedItemObjectVersions, requiredAssessmentIds}) — three of its keys are not in
		// the ratified interface and five of the interface's six fields were absent. Read from the promoted state,
		// already validated against BaselineObjectSchema: `itemObjectVersions` is what the Baseline FROZE at
		// CreateBaseline, not the promoting command's `expectedItemObjectVersions` (a narrowed payload must not
		// narrow what the log records as baselined) — same object-over-payload rule the guard applies above.
		eventPayload: (next) => {
			// `next` is about to be validated against BaselineObjectSchema by commitState — it does not commit, and
			// so never emits, if these reads are not a valid Baseline.
			const b = next as unknown as BaselineObject;
			const event: BaselinePromotedPayload = {
				baselineId: b.id,
				baselineType: b.baselineType,
				promotionDecisionId: b.promotionDecisionId,
				itemObjectVersions: b.itemObjectVersions,
				assuranceAssessmentIds: b.assuranceAssessmentIds,
				status: b.status
			};
			return event;
		}
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
