// WAIVING IS THE FIRST ACT §5.2 RESERVES, AND THE ASSURANCE AXIS REACHED IT WITH NOTHING CITED.
//
// C-0b measured the hole and drove it live: `ChangePwuState` moved `PWU.assuranceState` to `WAIVED` with
// `supportingObjectIds: []`, `reasonCode: 'CONTROLLER'`, **no Decision, no WaiverGranted event, no authority of
// any kind** — and the committed object read `assuranceState: 'WAIVED'`. Three arrows share that path
// (`ASSESSING`, `EVIDENCE_REQUIRED`, `CONDITIONALLY_SATISFIED` -> `WAIVED`) through one branch-free code path.
//
// ── WHY THIS IS NOT THE ASSESSMENT GUARD WEARING A NEW NAME ──────────────────────────────────────────────────
// `rejectUnbackedDisposition` already refuses an unbacked disposition — but it SHORT-CIRCUITS on this exact
// value, because `ASSESSMENT_BACKED_DISPOSITIONS` is {SATISFIED, CONDITIONALLY_SATISFIED, REJECTED, ESCALATED}
// and `WAIVED` is deliberately not in it. `pwu.ts` says so in terms: *"NOT here, deliberately: WAIVED is
// authorized by a WAIVER, not an assessment (§18.1 …). Both need their own citation and their own guard."*
// **The repository named the gap and then left it open.** This is the guard that sentence promised.
//
// ── THE AUTHORITY, AND THE CORPUS PUTS WAIVER FIRST ──────────────────────────────────────────────────────────
// Guide L336, the provenance source of JPWB-DOC-001 §5.2, byte-exact: *"Governance is an authority function
// outside the six engineering disciplines and alone authorizes **waiver**, risk acceptance, rejection or
// abandonment of governed work, and promotion."* Waiver is named first. Same class as the abandonment guard
// (REG-F-070) and the rejection guard (REG-F-078); this is the third and last of §5.2's acts to reach the PWU.
//
// ── AND THE MECHANISM IS RATIFIED, WHICH IT WAS NOT WHEN THOSE TWO WERE BUILT ─────────────────────────────────
// REG-Q-030 CLOSED on 2026-08-09 (REG-D-038): WAIVED enters ONLY through the two-step waiver pair
// (`requestAssuranceWaiver` -> `grantAssuranceWaiver`, emitting `WaiverRequested`/`WaiverGranted`), requiring
// governance-tier authority. Its safe default — *"Validators never recommend WAIVED"* — was already correct.
// ⚠ THAT SWEEP ALSO WARNED AGAINST THE OVER-STRONG READING, and this module obeys it: `WaiverGranted` does NOT
// imply `WAIVED`. DOC-002 Scenario 4 reads *"assurance state becomes `WAIVED` **or conditionally satisfied**"*.
// So this resolver answers only *"is this waiver authority for THIS PWU?"* — never *"therefore the axis is
// WAIVED"*, which remains the caller's transition to request and the machine's to permit.
//
// ⚠ AND ASR-14, REPAIRED HOURS EARLIER, BOUNDS WHAT A WAIVER MAY COVER: *"Critical integrity failures … cannot be
// waived by ordinary product authority — waiver authority is tiered."* This module checks that a waiver EXISTS,
// is EFFECTIVE and BINDS THIS VERSION. **It does not check the tier**, because no field on the Decision records
// one; that is a separate, real gap and is recorded rather than silently treated as satisfied.
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import type { HandlerContext } from './kit.js';

export interface WaiverAuthorizationQuery {
	/** the Decision the caller names as authorizing the waiver */
	readonly authorizationId: string;
	/** the PWU whose assurance axis would move to WAIVED */
	readonly pwuId: string;
	/** the PWU's CURRENT semanticVersion — the waiver must be bound to this one (ASR-15) */
	readonly pwuSemanticVersion: number;
}

export type WaiverAuthorization = { ok: true } | { ok: false; reason: string };

/**
 * Seven ordered checks, each failing with its own reason so a refusal names the limb that failed.
 *
 * Ordered cheapest-first and, more importantly, so that a category error is reported AS a category error: a
 * caller who cites an Intent should be told it is not a DECISION, not told its `decisionType` is wrong.
 */
export function resolveWaiverAuthorization(
	ctx: HandlerContext,
	query: WaiverAuthorizationQuery
): WaiverAuthorization {
	const stored = ctx.store.loadObject(query.authorizationId);
	if (!stored) return { ok: false, reason: `${query.authorizationId} names no recorded object` };

	if (stored.objectType !== 'DECISION')
		return {
			ok: false,
			reason: `${query.authorizationId} is a ${stored.objectType}, not a DECISION`
		};

	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success)
		return {
			ok: false,
			reason: `${query.authorizationId} does not parse as a DECISION: ${parsed.error.message}`
		};
	const decision = parsed.data;

	// ⚠ 'WAIVER', not 'WAIVE'. The §37 ControlAction menu spells the control action differently from the
	// DecisionType enum, and the rejection guard was written against exactly this trap ('REJECTION', not
	// 'REJECT'). Checked against DecisionTypeSchema rather than remembered.
	if (decision.decisionType !== 'WAIVER')
		return {
			ok: false,
			reason:
				`${query.authorizationId} is a ${decision.decisionType} decision; waiving assurance requires ` +
				`decisionType=WAIVER. CON-000 AX-2 defaults authority to denied, and no clause licenses one ` +
				`decisionType standing in for another (RPH-GOV-005: authorization does not bleed).`
		};

	if (decision.status !== 'EFFECTIVE')
		return {
			ok: false,
			reason:
				`${query.authorizationId} is ${decision.status}, not EFFECTIVE. A proposed waiver is a request, ` +
				`not a grant — GrantWaiver drives PROPOSED -> EFFECTIVE through the authority gate.`
		};

	if (!(decision.subjectObjectIds ?? []).includes(query.pwuId))
		return {
			ok: false,
			reason:
				`${query.authorizationId} does not name ${query.pwuId} among its subjects. A waiver of one ` +
				`object's finding is not a waiver of another's (ASR-14: a waiver does not "apply to another ` +
				`criterion, another object, or a future semantic version unless explicitly renewed").`
		};

	// ASR-15 version-binding, and ASR-14 states the same rule from the waiver side in the sentence quoted above:
	// a decision approving version n never authorizes version n+1.
	const pinned = (decision.subjectSemanticVersions ?? {})[query.pwuId];
	if (pinned !== query.pwuSemanticVersion)
		return {
			ok: false,
			reason:
				`${query.authorizationId} waives ${query.pwuId} at semanticVersion ${String(pinned)}, but the PWU ` +
				`is at ${query.pwuSemanticVersion}. ASR-14 bars a waiver applying to "a future semantic version ` +
				`unless explicitly renewed"; ASR-15 says the same of decisions generally.`
		};

	return { ok: true };
}
