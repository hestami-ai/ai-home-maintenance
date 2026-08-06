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
	BaselineSupersededPayload,
	CreateBaselinePayload,
	DecisionEffectivePayload,
	DecisionObject,
	DecisionRevokedPayload,
	DomainCommand,
	GrantWaiverPayload,
	ProposeDecisionPayload,
	PromoteBaselinePayload,
	RequestWaiverPayload,
	WaiverRequestedPayload,
	RevokeDecisionPayload,
	SupersedeBaselinePayload,
	WaiverGrantedPayload,
	WaiverRule
} from '@janumipwb/rph-contracts';
import {
	allOf,
	fromStates,
	predicate,
	type Precondition
} from './command-precondition.js';
import {
	assessmentHasConcluded,
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
	// REG-F-014 (2026-08-03). `authority` was copied STRAIGHT FROM THE PAYLOAD with no reference to
	// `command.issuedBy`, so an AGENT could propose a decision recording a HUMAN as its authority and then
	// approve it itself: the governed record asserted a human decided when none had. The authority check in
	// `makeDecisionEffective` reads the RECORDED authority, so it fired exactly when a caller declared an
	// insufficient authority and could not fire when it declared a sufficient one — it stopped the agent that
	// said what it was, and not the agent that did not.
	//
	// The sibling handler `requestWaiver` has always set `authority: command.issuedBy` and is not forgeable this
	// way. This REFUSES the disagreement rather than silently overwriting the payload, so the ratified field
	// keeps its meaning: the caller must state the authority, and what it states must be true. The test is
	// IDENTITY, not a ranking of actor types — this repository has no such ranking and inventing one here would
	// be a convenient interpretation encoded as architecture (DOC-004 §0.3). Both directions are refused.
	//
	// DELEGATION IS THE ABSENT MECHANISM. Canon permits authority to be DELEGATED (DOC-003 §8 ASR-15) and this
	// repository has no object for a delegation record. Until one is ratified, declaring an authority you are
	// not is refused rather than admitted on trust — see REG-F-014's disposition.
	if (
		p.authority.actorId !== command.issuedBy.actorId ||
		p.authority.actorType !== command.issuedBy.actorType
	) {
		return reject(
			command,
			'RPH_AUTHORITY_INSUFFICIENT',
			`ProposeDecision: the declared authority (${p.authority.actorType} ${p.authority.actorId}) is not the ` +
				`issuing actor (${command.issuedBy.actorType} ${command.issuedBy.actorId}) — a Decision records the ` +
				`authority of its issuer, and no delegation record exists to carry one actor's authority for another ` +
				`(DOC-003 ASR-15).`,
			[id]
		);
	}
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
		// JAN-EXECREM WP-12c (F-30). The EXECUTION-plane skip scope, carried onto the object so
		// `resolveSkipAuthorization` has something to RESOLVE. Validating it at the door and discarding it would
		// leave §21.1's authorization exactly as unresolvable as the bare id it replaces.
		...(p.executionSkipAuthorization
			? { executionSkipAuthorization: p.executionSkipAuthorization }
			: {}),
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
			// The authorization is a governed FACT, so it rides the event too: replay must be able to see WHICH
			// steps a decision authorized, not merely that some decision existed.
			...(p.executionSkipAuthorization
				? { executionSkipAuthorization: p.executionSkipAuthorization }
				: {}),
			...(p.effectiveAt ? { effectiveAt: p.effectiveAt } : {})
		}
	});
};

/** The authority gate shared by ApproveDecision + GrantWaiver: PROPOSED -> EFFECTIVE requires a held authority
 * (an AGENT/MODEL actor may recommend but not approve — GOV-001/002).
 *
 * `precondition` (JAN-CMDPRE DWP-01a/01b, DS-001 D1/D8): one advanceStatus literal serves TWO command types whose
 * legality differs on `decisionType` — a NON-state field no source-state set can reach. Each caller declares
 * which decision KIND its command may address; a single predicate on the shared literal would refuse every
 * ApproveDecision on a non-waiver decision. Without this, ApproveDecision aimed at a PROPOSED WAIVER drove it
 * EFFECTIVE — discharging the assurance floor with a DecisionEffective where a WaiverGranted should be. The
 * discharge stayed criterion-scoped and expiry-bound (the floor gate reads the OBJECT's WaiverDetail, written at
 * RequestWaiver and untouched by the exploit), but the GRANT itself went unrecorded: no WaiverGranted fact to
 * audit (authorizeDecisionEffective checks only legality + authority, and floor-gate reads the resulting OBJECT
 * without regard to which command produced it).
 *
 * Each caller composes its kind predicate with `fromStates('PROPOSED')` — explicit and LIVE since DWP-01b sited
 * precondition enforcement AHEAD of the guard. DELIBERATE refusal-code change: a wrong-state re-issue (e.g.
 * re-approving an EFFECTIVE decision) now refuses RPH_ILLEGAL_STATE_TRANSITION where the guard's legality arm
 * previously surfaced RPH_AUTHORITY_INSUFFICIENT — the state fact is the true refusal; authority was never the
 * defect there. The guard below is authority-only again. */
function makeDecisionEffective(
	target: 'EFFECTIVE',
	eventType: string,
	precondition: Precondition,
	extraMutate?: (base: Record<string, unknown>, command: DomainCommand) => Record<string, unknown>,
	/**
	 * The EVENT payload, when this caller's event is not `DecisionEffective`. ONE advanceStatus literal serves two
	 * command types that emit two DIFFERENT event types (`DecisionEffective` and `WaiverGranted`), and the two
	 * declare DIFFERENT interfaces — so a single hard-coded payload builder is wrong for whichever event it was
	 * not written for. It was written for `DecisionEffective`, so `GrantWaiver` emitted a `DecisionEffective`
	 * payload under a `WaiverGranted` type: `waiverDecisionId` absent, `duration` absent, `status` absent, and
	 * five keys `WaiverGrantedPayloadSchema` (a `z.strictObject`) rejects outright. Omitted → the DecisionEffective
	 * shape below, which is what `ApproveDecision` still uses.
	 */
	eventPayload?: (nextState: Record<string, unknown>, command: DomainCommand) => unknown
): CommandHandler {
	return (ctx, command) =>
		advanceStatus(ctx, command, {
			objectType: DECISION,
			statusField: 'status',
			machine: 'Decision.status',
			target,
			eventType,
			precondition,
			guard: (state) => {
				const authority = state.authority as { actorType?: string } | undefined;
				// ── HUMAN ONLY, AND THE `|| 'SYSTEM'` THAT USED TO SIT HERE COULD NEVER BE TRUE ──────────────────────
				// REG-F-040. `authority` is schema-validated as an `ActorReference`, whose `actorType` is
				// `ActorTypeSchema` — HUMAN | AGENT | MODEL | SERVICE | POLICY_ENGINE | EXTERNAL_SYSTEM. There is no
				// `SYSTEM` member and there never has been, so the second disjunct was unsatisfiable from the day the
				// enum was minted and the operative rule has always been the one that remains.
				//
				// It is REMOVED rather than left as harmless dead code because it was a fail-open aimed at the FUTURE:
				// the day `SYSTEM` is added to `ActorTypeSchema` for any unrelated reason, a SYSTEM actor would
				// silently acquire the authority to make a governance decision EFFECTIVE, with nobody having decided
				// that. A dead branch that GRANTS A PERMISSION defers the decision to whoever next edits an enum.
				//
				// `decision-authority-provenance.test.ts` pins the enum's membership, so minting `SYSTEM` reddens and
				// forces the question — may a non-human hold decision authority? — at the moment it becomes answerable.
				const authorityHeld = authority?.actorType === 'HUMAN';
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
				// PER-EVENT: `GrantWaiver` emits `WaiverGranted`, whose declared interface is NOT this one.
				// See the `eventPayload` parameter above.
				if (eventPayload) return eventPayload(next, command);
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

/** ApproveDecision — PROPOSED -> EFFECTIVE (records the approved subject versions + selected option).
 * Addresses any decision kind EXCEPT a waiver (`!== 'WAIVER'`, not `=== 'APPROVAL'` — the seed approves a
 * PROMOTE_BASELINE decision). Granting a waiver is GrantWaiver's act, which is what records the waiver fact
 * the floor gate scopes by. */
export const approveDecision: CommandHandler = makeDecisionEffective(
	'EFFECTIVE',
	'DecisionEffective',
	// Kind BEFORE state: a mis-aimed approval refuses as the category error it is, whatever the waiver's status.
	allOf(
		predicate(
			"the target decision's decisionType is not WAIVER (granting is GrantWaiver's act)",
			({ state, command }) =>
				String(state.decisionType) === 'WAIVER'
					? `ApproveDecision cannot make WAIVER decision ${command.targetAggregateId} effective: a waiver becomes effective only via GrantWaiver, whose WaiverGranted event is the waiver fact the assurance floor audits. Approving it here would discharge the floor with no WaiverGranted fact recorded.`
					: null
		),
		fromStates('PROPOSED'),
		// The ratified payload field is no longer WRITTEN (above), so this is what stops it becoming decorative:
		// an approver may still state the versions it believes it is approving, and what it states must match the
		// pin. Scoped to subjects the PIN covers — `proposeDecision` pins only objects the store could load, so a
		// payload entry for a subject that never existed has nothing to disagree with. Whether a Decision may name
		// a subject that was never created is a SEPARATE question (11 of the 13 divergences the REG-F-017 survey
		// found were exactly that), and bundling it here would make one fix carry two rules.
		predicate(
			'the stated subject versions disagree with the versions pinned when the decision was proposed',
			({ state, payload, command }) => {
				const claimed = (payload as { subjectSemanticVersions?: Record<string, number> })
					.subjectSemanticVersions;
				if (!claimed) return null;
				const pinned = (state.subjectSemanticVersions as Record<string, number> | undefined) ?? {};
				const wrong = Object.entries(claimed)
					.filter(([id, v]) => pinned[id] !== undefined && pinned[id] !== v)
					.map(([id, v]) => `${id} stated@${v} pinned@${pinned[id]}`);
				return wrong.length === 0
					? null
					: `ApproveDecision ${command.targetAggregateId}: the approval states subject version(s) that are ` +
						`not the ones this decision pinned when it was proposed (${wrong.join('; ')}). A decision binds ` +
						`the versions that were REVIEWED; to approve different ones, propose again (DOC-003 ASR-15).`;
			}
		)
	),
	(base, command) => {
		const p = command.payload as ApproveDecisionPayload;
		return {
			...base,
			selectedOption: p.selectedOption,
			rationale: p.rationale,
			consideredEvidenceIds: p.consideredEvidenceIds,
			consideredObservationIds: p.consideredObservationIds,
			// REG-F-017 / REG-F-014 instance 2 (2026-08-03): `subjectSemanticVersions: p.subjectSemanticVersions`
			// USED TO BE HERE, overwriting the pin `proposeDecision` read from the store one command earlier. So the
			// version binding RPH-GOV-003 and canon ASR-15 both rest on was, at the moment of approval, whatever the
			// approver said it was. THE PIN IS NOW IMMUTABLE: it records the versions that existed when the decision
			// was PROPOSED, which is what the approver reviewed.
			//
			// DERIVING IT AFRESH AT APPROVAL WAS TRIED AND REJECTED, and the reason is worth keeping: it would make
			// the ENGINE perform the laundering the rule forbids. An approver who reviewed v1 and approves after the
			// subject silently moved to v2 would be RECORDED as approving v2 — the caller's untrue number replaced by
			// an engine's untrue number. `authority` got the opposite remedy (derive/refuse) because it is a fact
			// about the CALLER; a subject version is a fact about a MOMENT, and the moment that binds is the review.
			// Staleness is caught where the rule places it — at promotion, by `decisionAuthorizesVersions`.
			effectiveAt: command.issuedAt
		};
	}
);

/** RevokeDecision — EFFECTIVE -> REVOKED (triggers impact analysis; cannot retroactively change evidence).
 * AUDITED for the Decision-family kind asymmetry (JAN-CMDPRE DWP-01a): deliberately NO decisionType predicate —
 * revocation legitimately addresses BOTH kinds. Revoking a granted waiver reinstates the floor obligation it
 * discharged; revoking an approval withdraws the authorization.
 *
 * `precondition: fromStates('EFFECTIVE')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2, INV-1/INV-2) — the machine's single
 * EFFECTIVE -> REVOKED in-arrow (Decision.status). Before this, a REVOKED -> REVOKED re-issue was a NOOP admitted by
 * checkTransition, appending a second DecisionRevoked recording a revocation that did not happen — a permanent false
 * entry in the append-only log (AX-7). NONE site: the wrong-source code was already RPH_ILLEGAL_STATE_TRANSITION via
 * checkTransition, so the precondition changes NO refusal code — only WHICH re-issue is refused (the same-state NOOP).
 * No decisionType predicate on purpose: an APPROVAL-family decision AND a WAIVER are both revocable from EFFECTIVE. */
export const revokeDecision: CommandHandler = (ctx, command, payload) => {
	const p = payload as RevokeDecisionPayload;
	return advanceStatus(ctx, command, {
		objectType: DECISION,
		statusField: 'status',
		machine: 'Decision.status',
		target: 'REVOKED',
		eventType: 'DecisionRevoked',
		precondition: fromStates('EFFECTIVE'),
		// REG-F-020. `DecisionRevokedPayloadSchema` (a `z.strictObject`) declares `{ revocationRationale, status }`
		// and the site supplied no `eventPayload`, so the event carried the raw `RevokeDecision` COMMAND payload —
		// `{ revocationRationale }` — and the one event that records "this decision became REVOKED" did not contain
		// the word REVOKED. `status` is read from the COMMITTED NEXT STATE, not written as the literal 'REVOKED':
		// the event must record where the aggregate actually went, and `advanceStatus` has already run the
		// `Decision.status` transition check and set the field by the time this builder is called. Nothing is
		// dropped — `revocationRationale` is the command payload's only field and it is carried through.
		eventPayload: (next) => {
			const d = next as unknown as DecisionObject;
			const event: DecisionRevokedPayload = {
				revocationRationale: p.revocationRationale,
				status: d.status
			};
			return event;
		}
	});
};

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
		// REG-F-020 — CLOSED by widening the AUTHORED shape, which is what was actually wrong.
		//
		// THE FIRST PASS REFUSED THIS, and the refusal was right about the danger and wrong about the constraint.
		// The danger is real and is why the naive fix must not be made: `foldWaiverRequested` in
		// `rph-projections/src/assurance-view.ts` is a PURE FOLD over the event log with no store handle, and it
		// reads `waivedPolicyId` off THIS event as its attachment predicate. Emitting only the fields the shape then
		// declared would make that undefined at every real waiver, taking the projection's permissive
		// `waivedPolicyId === undefined ||` branch: every waiver attaching to every assessment whose subjects it
		// intersects, under ANY policy — and staying GREEN, because that projection's tests build their events by
		// hand. The live path is `apps/rph-demo/.../undertakings/[id]/+page.server.ts`, built from `readAllEvents()`.
		//
		// WHAT THE REFUSAL GOT WRONG: it called widening the shape "editing ratified-material". It is not.
		// `WaiverRequested`'s vocab entry is annotated **UNRATIFIED-AUTHORED** — "DOC-007 schematizes NO interface
		// for this, so these fields were AUTHORED, not derived … Do NOT treat this sourceSection as proof the shape
		// is ratified. Ratification pending." So the shape is OURS, and a shape we authored that cannot carry what
		// its only consumer requires is the defect. The command declares those five fields REQUIRED; the event
		// omitted them; the projection needs three of them. The event was the thing that was wrong.
		//
		// So the vocab entry now carries `waivedPolicyId`, `waivedCriterionId`, `waivedFindingIds`,
		// `compensatingControls`, `reviewConditions` and optional `expiresAt`, and this emits the full declared
		// shape. NOTHING IS DROPPED — the projection keeps reading exactly what it read before — and `decisionType`
		// and `status` are now present, which the shape always required and the raw command payload never carried.
		//
		// Both are read off the COMMITTED NEXT STATE rather than restated as literals: `state` above sets them, and
		// an event recording what happened should read the fact rather than assert it a second time.
		eventPayload: {
			subjectObjectIds: p.subjectObjectIds,
			scope: p.scope,
			rationale: p.rationale,
			duration: p.duration,
			affectedObjectIds: p.affectedObjectIds,
			decisionType: state.decisionType as WaiverRequestedPayload['decisionType'],
			status: state.status as WaiverRequestedPayload['status'],
			waivedPolicyId: p.waivedPolicyId,
			waivedCriterionId: p.waivedCriterionId,
			waivedFindingIds: p.waivedFindingIds,
			compensatingControls: p.compensatingControls,
			reviewConditions: p.reviewConditions,
			...(p.expiresAt ? { expiresAt: p.expiresAt } : {})
		} satisfies WaiverRequestedPayload,
		eventType: 'WaiverRequested'
	});
};

/** GrantWaiver — PROPOSED -> EFFECTIVE (same authority gate as an approval).
 * Addresses ONLY a waiver: a non-waiver decision carries no WaiverDetail to scope by, so "granting" it would
 * mint an effective decision whose WaiverGranted event describes an act that never happened. */
export const grantWaiver: CommandHandler = makeDecisionEffective(
	'EFFECTIVE',
	'WaiverGranted',
	allOf(
		predicate(
			"the target decision's decisionType is WAIVER (a non-waiver becomes effective via ApproveDecision)",
			({ state, command }) =>
				String(state.decisionType) !== 'WAIVER'
					? `GrantWaiver cannot make ${String(state.decisionType)} decision ${command.targetAggregateId} effective: only a Decision of decisionType WAIVER carries the waiver detail the floor gate scopes by. A non-waiver decision becomes effective via ApproveDecision.`
					: null
		),
		fromStates('PROPOSED')
	),
	(base, command) => ({
		...base,
		effectiveAt: command.issuedAt
	}),
	// REG-F-020. `WaiverGrantedPayloadSchema` (a `z.strictObject`) declares `{ waiverDecisionId, effectiveAt,
	// duration, status }`. This site shares `makeDecisionEffective` with ApproveDecision, so it inherited that
	// helper's hard-coded `DecisionEffective` payload: the emitted WaiverGranted carried `decisionId` /
	// `decisionType` / `subjectObjectIds` / `subjectSemanticVersions` / `selectedOption` / `rationale` — five keys
	// the strict shape rejects — and NONE of `waiverDecisionId`, `duration`, `status`. The grant of a waiver is the
	// fact the assurance floor audits (see the decisionType predicate above); its record could not say the waiver
	// became EFFECTIVE, nor for how long.
	//
	// `waiverDecisionId` / `effectiveAt` / `status` come from the COMMITTED NEXT STATE — the event records what
	// HAPPENED, and `effectiveAt` in particular is the value `extraMutate` above actually wrote (`command.issuedAt`),
	// not the `effectiveAt` the grant command asked for. `duration` is read from the COMMAND payload because it is
	// the one declared field with no home on `DecisionObjectSchema` (`WaiverDetail` carries `expiresAt`, a distinct
	// datum), and inventing one from `expiresAt` would be minting a governance fact. The dropped keys all live on
	// the Decision object, which is where a reader of an aggregate's identity should look; the only projection that
	// folds WaiverGranted (`rph-projections/src/assurance-view.ts` `foldWaiverResolved`) reads `effectiveAt` and the
	// event's own `aggregateId`, both of which survive.
	(next, command) => {
		const d = next as unknown as DecisionObject;
		const p = command.payload as GrantWaiverPayload;
		const event: WaiverGrantedPayload = {
			waiverDecisionId: d.id,
			effectiveAt: d.effectiveAt ?? command.issuedAt,
			duration: p.duration,
			status: d.status
		};
		return event;
	}
);

/** DenyWaiver — PROPOSED -> SUPERSEDED (a denied waiver request; DecisionStatus has no DENIED value, §23.1 gap).
 * Two preconditions (JAN-CMDPRE DWP-01a, migrated to the union in DWP-01b), composed KIND-first so a mis-aimed
 * denial refuses as the category error it is (preserving DWP-01a's refusal codes exactly):
 *  - decisionType === 'WAIVER': the machine legalises EFFECTIVE -> SUPERSEDED too, so ANY state set derived from
 *    it admits DenyWaiver aimed at an EFFECTIVE non-waiver — driving a governance authorization to SUPERSEDED
 *    while emitting WaiverDenied about a decision that never requested a waiver (DS-001 §5 / F-10).
 *  - fromStates('PROPOSED') (hand-authored from Decision.status's PROPOSED -> SUPERSEDED row): denial addresses
 *    the REQUEST. Unmaking a GRANTED (EFFECTIVE) waiver is RevokeDecision's act, with its own impact analysis;
 *    the EFFECTIVE -> SUPERSEDED arrow belongs to supersede flows. */
export const denyWaiver: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: DECISION,
		statusField: 'status',
		machine: 'Decision.status',
		target: 'SUPERSEDED',
		eventType: 'WaiverDenied',
		precondition: allOf(
			predicate(
				"the target decision's decisionType is WAIVER (denial addresses a waiver request)",
				({ state, command }) =>
					String(state.decisionType) !== 'WAIVER'
						? `DenyWaiver cannot supersede ${String(state.decisionType)} decision ${command.targetAggregateId}: it denies a WAIVER request, and this decision never requested one. Superseding a non-waiver decision is a supersede/revoke flow, not a waiver denial.`
						: null
			),
			fromStates('PROPOSED')
		)
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

/** SubmitBaselineForReview — CANDIDATE -> UNDER_REVIEW. `precondition: fromStates('CANDIDATE')` (JAN-CMDPRE DWP-06)
 *  — the machine's single in-arrow to UNDER_REVIEW (Baseline.status). NONE site: an already-UNDER_REVIEW re-issue
 *  was a NOOP appending a second BaselineSubmittedForReview. This site was outside DWP-04's six; the D5
 *  required-precondition flip (making `precondition` mandatory on `advanceStatus`) is exactly what surfaced it. */
export const submitBaselineForReview: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'UNDER_REVIEW',
		eventType: 'BaselineSubmittedForReview',
		precondition: fromStates('CANDIDATE'),
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
		// The machine's only in-arrow to APPROVED is UNDER_REVIEW. Re-approving an already-APPROVED baseline REWROTE
		// approvalDecisionId — the field that exists to answer WHICH decision authorized this baseline — and appended a
		// second BaselineApproved naming a different decision, with no revocation of the first.
		precondition: fromStates('UNDER_REVIEW'),
		eventType: 'BaselineApproved',
		mutate: (base) =>
			p.approvalDecisionId ? { ...base, approvalDecisionId: p.approvalDecisionId } : base,
		eventPayload: () => ({
			status: 'APPROVED',
			...(p.approvalDecisionId ? { approvalDecisionId: p.approvalDecisionId } : {})
		})
	});
};

/**
 * W1 WIRE-3b (Property P4 / conformance test CT-10 — the evidence-invalidation pull-guard authorized at G1/C1):
 * "invalidated evidence re-examines the claims it supported." A baseline promotion is an authoritative act
 * (master §10 / §19); it may not silently rest on evidence that has since been INVALIDATED. Following only
 * FORWARD references (so no reverse index / trace graph is needed — the trace-graph form was the structural
 * blocker recorded at G1), gather every Evidence the promotion relies on:
 *   (a) each required assessment's claims' supportingEvidenceIds — the §CT-10 "supported claims" path, and
 *   (b) the promotion decision's consideredEvidenceIds — the evidentiary basis the authority relied on;
 * and return those whose Evidence.status is INVALIDATED. This is the corpus's own PULL-GUARD framing
 * (transitions.data §16.2: "guard on claim support, not an intra-machine transition") rather than a push-cascade
 * that would contest N claim aggregates from one command.
 */
function invalidatedEvidenceUnderminingPromotion(
	hctx: HandlerContext,
	requiredAssessmentIds: readonly string[],
	consideredEvidenceIds: readonly string[]
): { evidenceId: string; via: string }[] {
	const undermining: { evidenceId: string; via: string }[] = [];
	const isInvalidated = (evidenceId: string): boolean =>
		(hctx.store.loadObject(evidenceId)?.state as { status?: string } | undefined)?.status ===
		'INVALIDATED';
	// (a) required assessment -> claims -> supporting evidence (the CT-10 "supported claims" path)
	for (const assessmentId of requiredAssessmentIds) {
		const a = hctx.store.loadObject(assessmentId)?.state as { claimIds?: string[] } | undefined;
		for (const claimId of a?.claimIds ?? []) {
			const c = hctx.store.loadObject(claimId)?.state as
				| { supportingEvidenceIds?: string[] }
				| undefined;
			for (const evidenceId of c?.supportingEvidenceIds ?? [])
				if (isInvalidated(evidenceId)) undermining.push({ evidenceId, via: `claim ${claimId}` });
		}
	}
	// (b) the promotion decision's considered evidence (the authority's evidentiary basis)
	for (const evidenceId of consideredEvidenceIds)
		if (isInvalidated(evidenceId))
			undermining.push({ evidenceId, via: 'promotion-decision considered evidence' });
	return undermining;
}

/** PromoteBaseline — APPROVED -> AUTHORITATIVE, gated by canPromoteBaseline (effective promotion decision +
 * required assessments satisfied/waived + no open blocking + item versions pinned). "No green without assurance."
 *
 * `precondition: fromStates('APPROVED')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2 + fork F-3) sits AHEAD of the guard. This
 * was a GUARD_ONLY_ACCIDENTAL site, not NONE: canPromoteBaseline routes through canTransition (NOOP-excluding), so an
 * AUTHORITATIVE -> AUTHORITATIVE re-issue was already refused — but by the promotion GATE, with the WRONG code
 * RPH_INVARIANT_VIOLATION (an ILLEGAL_PROMOTION_TRANSITION finding), as though the promotion rules were unmet when the
 * true defect is the state. ENUMERATED REFUSAL-CODE CHANGE (SPEC-001 INV-7; DS-001 §14; forks F-2/F-3): the re-issue
 * now refuses RPH_ILLEGAL_STATE_TRANSITION from the precondition, before the guard. The guard is RETAINED unchanged —
 * it carries the independent promotion-decision, stale-version (RPH-GOV-003), and invalidated-evidence (P4/CT-10)
 * rules, which still fire on the APPROVED inputs the precondition admits (INV-3 non-example). */
export const promoteBaseline: CommandHandler = (ctx, command, payload) => {
	const p = payload as PromoteBaselinePayload;
	return advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'AUTHORITATIVE',
		eventType: 'BaselinePromoted',
		// APPROVED is the machine's single in-arrow to AUTHORITATIVE (Baseline.status). Refuses the re-issue on STATE,
		// ahead of canPromoteBaseline — which would otherwise refuse it on the wrong (invariant) code. See header.
		precondition: fromStates('APPROVED'),
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
				// REG-F-021 increment 0. This was `disposition !== 'ASSESSING' && disposition !== 'REQUESTED'` — an
				// ad-hoc exclusion of TWO states from a machine with FOUR pre-conclusion ones, so EVIDENCE_PENDING
				// and READY counted as COMPLETE. Harmless only because those states are unreachable today; a
				// fail-OPEN defect (a baseline promoted over an assessment that has not begun, reporting
				// `disposition: 'EVIDENCE_PENDING'`) the moment REG-F-021 makes them reachable. Fixed BEFORE the
				// states exist, so the window never opens. Now a POSITIVE classification that fails closed on any
				// state it does not know — see ASSESSMENT_CONCLUDED_STATES and its exhaustiveness test.
				const complete = assessmentHasConcluded(disposition);
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
			// W1 WIRE-3b (Property P4 / CT-10): the promotion may not rest on INVALIDATED evidence. Invalidated
			// evidence must re-examine the claims it supported before an authoritative baseline can rest on them —
			// enforced here as a pull-guard over forward references (assessment->claim->evidence and the decision's
			// considered evidence), since no runtime trace graph exists. See invalidatedEvidenceUnderminingPromotion.
			const consideredEvidenceIds = (decision?.consideredEvidenceIds as string[] | undefined) ?? [];
			const undermined = invalidatedEvidenceUnderminingPromotion(
				hctx,
				p.requiredAssessmentIds,
				consideredEvidenceIds
			);
			if (undermined.length > 0) {
				const detail = undermined.map((u) => `${u.evidenceId} (via ${u.via})`).join('; ');
				// REG-F-010 group 3 (2026-08-03): this was `RPH_INVARIANT_VIOLATION`, with the actual condition living
				// only in the prose below. `RPH_EVIDENCE_INVALIDATED` is one of the ratified fifteen, is categorised
				// ASSURANCE, names exactly this failure — and until now was carried by NO refusal in the system. A typed
				// error contract whose discriminating value travels in free text is asserting a status nothing performs
				// (CON-000 B7), and `classifyRefusal` cannot tell apart two refusals reporting the same code. The message
				// is unchanged: the CODE says what kind, the prose says which evidence. Status is unaffected —
				// `STATUS_FOR_CODE` has no entry for either code, so both yield REJECTED, which is why RPH-PWU-008's
				// control (this very refusal) still holds.
				return reject(
					command,
					'RPH_EVIDENCE_INVALIDATED',
					`Cannot promote baseline ${command.targetAggregateId}: INVALIDATED_EVIDENCE — the promotion rests on invalidated evidence that must re-examine the claims it supported before an authoritative baseline can stand on it (${detail}); re-assess before promoting (P4 / CT-10).`
				);
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

/** SupersedeBaseline — AUTHORITATIVE -> SUPERSEDED (immutability: changes create a successor, P7).
 *
 * `precondition: fromStates('AUTHORITATIVE')` (JAN-CMDPRE DWP-04; SPEC-001 §5.2) — the machine's single
 * AUTHORITATIVE -> SUPERSEDED in-arrow (Baseline.status). NONE site: a SUPERSEDED -> SUPERSEDED re-issue was a NOOP
 * admitted by checkTransition (SUPERSEDED is terminal, but from === to still classifies NOOP), appending a second
 * BaselineSuperseded. No code change — the wrong-source code was already RPH_ILLEGAL_STATE_TRANSITION. */
export const supersedeBaseline: CommandHandler = (ctx, command, payload) => {
	const p = payload as SupersedeBaselinePayload;
	return advanceStatus(ctx, command, {
		objectType: BASELINE,
		statusField: 'status',
		machine: 'Baseline.status',
		target: 'SUPERSEDED',
		eventType: 'BaselineSuperseded',
		precondition: fromStates('AUTHORITATIVE'),
		// REG-F-020, and the finding RPH-BAS-007 in `enforcement-register.ts` already recorded: this site supplied
		// neither `mutate` nor `eventPayload`, so the emitted payload was the raw `SupersedeBaseline` COMMAND payload
		// `{ supersedingBaselineId }` and OMITTED `status`, which `BaselineSupersededPayloadSchema` (a
		// `z.strictObject`) declares REQUIRED. The supersession TRACE (ASR-16 "change creates a successor with a
		// supersession trace") therefore existed only as an event field that violated the shape this repository
		// authored for it. `status` is read from the COMMITTED NEXT STATE so the event says where the Baseline went;
		// `supersedingBaselineId` still has no object field to hold it (`BaselineObjectSchema` declares none) and so
		// is carried from the command payload, unchanged. Nothing is dropped — the command payload has one field.
		eventPayload: (next) => {
			const b = next as unknown as BaselineObject;
			const event: BaselineSupersededPayload = {
				supersedingBaselineId: p.supersedingBaselineId,
				status: b.status
			};
			return event;
		}
	});
};
