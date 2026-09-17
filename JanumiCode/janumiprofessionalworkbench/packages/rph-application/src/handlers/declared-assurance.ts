// A PWU'S OWN DECLARED ASSURANCE POLICIES BIND — the quantifier `rejectUnbackedDisposition` never had.
//
// ── THE HOLE THIS CLOSES, AS THE ENFORCEMENT REGISTER RECORDED IT ───────────────────────────────────────────
// `rejectUnbackedDisposition` (pwu.ts) is an EXISTENTIAL over the assessments the CALLER CITES: it asks whether
// ONE cited ASSURANCE_ASSESSMENT carries the asserted disposition over this subject. It is alive, it refuses, and
// it is probed — and it never enumerates the policies the PWU ITSELF declares. So the controller selected its own
// evidence. Driven: a PWU whose `assurancePolicyIds` named a policy whose assessment came back REJECTED reached
// `assuranceState = SATISFIED` — and through the UNDER_ASSURANCE -> SATISFIED cross-axis guard,
// `workLifecycleState = SATISFIED` — by citing a SECOND assessment under an UNRELATED policy, with the rejecting
// one still reading REJECTED in the store.
//
// Two register rows recorded that one absence on two axes, both `UNENFORCED_DISCLOSED` with OBSERVED_ADMISSION
// guards and both saying the same thing about why no predicate could be named: *"the missing thing is not a
// predicate but a QUANTIFIER with nothing to quantify over at the call site"*.
//   RPH-PWU-007 (work lifecycle) — canon: *"Any rejected mandatory assessment blocks satisfaction."*
//   RPH-ASR-012 (assurance axis)  — canon: *"Aggregate assurance preserves the strictest unresolved required
//                                   disposition"*, with §28.2 supplying the fold.
//
// ── THE RULE IS THE RATIFIED KERNEL'S, NOT A SECOND OPINION ─────────────────────────────────────────────────
// This module supplies FACTS — which policies the subject declares, and each one's latest verdict — and
// `aggregateAssuranceDisposition` (rph-domain) supplies the RULE. That is the same discipline `aggregateDispositionFor`
// follows in the projections layer, and it matters here more than there: §28.2's rung order IS §28.1's strictness
// order, and a hand-rolled "is any of them REJECTED" test at this site would have been a SECOND, WEAKER copy of a
// fold this repository already ratified and unit-proved. It would also have got RPH-ASR-012's own example wrong —
// four SATISFIED and one CONDITIONALLY_SATISFIED is not a satisfied aggregate either.
//
// ── WHAT IT DELIBERATELY DOES **NOT** DO, so a green is not read wider than it is ────────────────────────────
//
// 1. ~~⛔ IT DOES NOT FIRE ON A DECLARED POLICY WITH NO CONCLUDED ASSESSMENT (§28.2 rung 3, "any required
//    assessment missing") … WHY IT IS NOT TAKEN HERE: folding an ABSENT assessment in makes
//    `aggregateAssuranceDisposition([])` — which returns UNASSESSED by design — into a COMMAND refusal that no
//    PWU declaring zero policies could ever escape.~~
//    ⭐⭐ **CLOSED 2026-09-17 (`JAN-EXEC` PHASE 6 / `R19`), AND THE OBJECTION IS ANSWERED RATHER THAN OVERRIDDEN.**
//    The case it names — a PWU declaring ZERO policies — NEVER REACHES THIS FOLD: `rejectUnsupportedDeclaredSatisfaction`
//    short-circuits on `if (declared.length === 0) return undefined;` before calling. The objection was true of
//    the arrangement it described and that arrangement was already excluded two lines above.
//    ⛔ AND THE RESIDUAL TURNED OUT TO BE WIDER THAN "a policy nobody assessed", WHICH IS WHY IT WAS TAKEN. The
//    skip had NO FALLBACK to the previous concluded record, so ONE further `RequestAssuranceAssessment` under an
//    already-REJECTED declared policy made that verdict stop being `latest` and vanish from the fold — **DRIVEN:
//    the repository's own `RPH-PWU-007` refusal fixture plus one accepted command returned ACCEPTED,
//    workLifecycleState SATISFIED.** A residual that erases an ENFORCED row's own refusal is not a rung nobody
//    reached; it is the row's bypass, and `RPH-ASR-012`'s `declaredMutations` had already recorded that this
//    limb "is a real limb guarded by nothing" without anyone reading it that way.
//
// 2. ~~⛔ IT DOES NOT CHECK THE SUBJECT'S SEMANTIC VERSION … the limb is one comparison away when that row is
//    taken up.~~ ⭐ **CLOSED 2026-09-17 (`R19`), AND ITS DEFERRAL IS ANSWERED ON ITS OWN TERMS.** The deferral
//    pointed at `RPH-ASR-010`, *"which lives on the ASSESSMENT path (`completeAssuranceAssessment` binding a
//    version the subject is not at), not on this one."* ⭑ That is right, and THIS is the other one: a READER
//    ignoring the version a verdict bound. Two sites, two rules — and a refusal here composes through rung 3
//    (the verdict is MISSING at this version) rather than through the rejection rung, so the arrangement does
//    NOT trip two guards. ⚠ The asymmetry that made it worth taking: `floorGateBlock` version-binds out of the
//    SAME `SubjectAssessmentRecord`, in the same index, and this reader did not.
//
// 3. ⛔ IT DOES NOT TREAT `WAIVED`, `INVALIDATED`, `CANCELLED`, `VALIDATOR_FAILED`, `WAIVER_EXPIRED` OR
//    `INDEPENDENCE_VIOLATION` AS VERDICTS. Those are six of the fifteen §30 assessment states and NONE of them is
//    a §28.2 rung: the fold has no reading for them, and inventing one at this site would be exactly the
//    unratified extrapolation REG-F-202 deleted from the floor gate. They therefore contribute nothing — which is
//    permissive, and said plainly here rather than discovered later.
import type { AggregateAssuranceDisposition } from '@janumipwb/rph-contracts';
import { AGGREGATE_STRICTNESS, aggregateAssuranceDisposition } from '@janumipwb/rph-domain';
import type { SubjectAssessmentRecord } from './assessment-index.js';

/**
 * The FIVE assessment states §28.2 has a rung for — the only ones this fold reads as a verdict.
 *
 * `ESCALATED` is here because the kernel maps it (to INCONCLUSIVE) and states why; the other nine §30 states are
 * excluded by item 3 of the header, and the exclusion is what makes them permissive rather than fail-closed.
 */
const CONCLUDED_ASSESSMENT_STATES = new Set([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED'
]);

/**
 * The two PWU `assuranceState` values that ARE a claim of satisfaction, and therefore the only two this rule
 * governs. Canon says the rejected assessment "blocks SATISFACTION" — so a controller recording REJECTED,
 * ESCALATED, WAIVED or any lifecycle value is untouched here. A guard that read the fold in both directions would
 * make a PWU its own policy rejected unable to be RECORDED as rejected, which is the over-refusal shape.
 */
const SATISFACTION_CLAIMS = new Set(['SATISFIED', 'CONDITIONALLY_SATISFIED']);

/**
 * Why a declared policy has NOT spoken — three facts one `undefined` disposition would have flattened into one.
 *
 * ⛔ THE DISCRIMINATION IS THE POINT, NOT DECORATION. All three compose to the SAME §28.2 rung, so a refusal
 * that named only the rung would tell an operator "a policy has not been assessed" for an arrangement in which
 * the policy WAS assessed, REJECTED, and then had its verdict displaced. Each of the three has a different
 * remedy: request an assessment; conclude the one in flight; re-assess at the current version.
 */
export type DeclaredPolicySilence =
	/** No assessment for this policy over this subject exists at all. */
	| 'NEVER_ASSESSED'
	/** One exists and has not concluded — so it displaces any earlier verdict without replacing it. */
	| 'IN_PROGRESS'
	/** A concluded verdict exists, and it bound a DIFFERENT semantic version of this subject. */
	| 'STALE_VERSION';

/** One declared policy's standing on this subject — its verdict, or the reason it has none. */
export interface DeclaredPolicyVerdict {
	readonly policyId: string;
	/** The assessment that speaks for this policy, or the one whose silence is being reported. */
	readonly assessmentId?: string;
	/** One of `CONCLUDED_ASSESSMENT_STATES` — never a §30 lifecycle value. Absent when the policy is silent. */
	readonly disposition?: string;
	/** Set exactly when `disposition` is absent. See `DeclaredPolicySilence`. */
	readonly silence?: DeclaredPolicySilence;
	/**
	 * §28.2's own discriminator for rung 3: does an assessment EXIST, even unconcluded? `false` → UNASSESSED,
	 * `true` → EVIDENCE_REQUIRED. Both are stricter than SATISFIED, so both refuse; the pair is what makes a
	 * refusal say whether anything is underway.
	 */
	readonly assessed: boolean;
	/**
	 * ⭐ `R19` — `false` when this policy does NOT currently govern the subject, so it is excluded from the fold.
	 *
	 * ⛔ ASYMMETRIC, AND THAT IS THE RULING RATHER THAN A CONVENIENCE. A policy that HAS a verdict votes whatever
	 * its status — so nothing already enforced is weakened by a policy being suspended after it rejected. Only a
	 * policy being DEMANDED is checked for governance, because demanding a verdict from a policy that is absent,
	 * SUSPENDED, or §5.1-excluded is a refusal with no route forward.
	 */
	readonly applicable?: boolean;
}

/** The composition's answer when an asserted satisfaction is not supported by the subject's own declarations. */
export interface UnsupportedSatisfaction {
	/** What §28.2's fold makes of the declared policies' verdicts. */
	readonly composed: AggregateAssuranceDisposition;
	/**
	 * The declared policies whose own verdict is STRICTER than what the controller asserted.
	 *
	 * NEVER EMPTY, and by construction rather than by assertion: `composed` is the STRICTEST verdict present
	 * (§28.2's rungs descend and the first match wins), so if `composed` is stricter than what was asserted, the
	 * verdict that produced it is itself stricter than what was asserted and is in this list.
	 */
	readonly blocking: readonly DeclaredPolicyVerdict[];
}

/**
 * Keep the declared policies whose LATEST assessment carries a §28.2 verdict, in declaration order.
 *
 * `latest` is the shared index (`latestAssessmentByPolicy`), so "which assessment speaks for this policy" is
 * decided in one place for this gate and the floor gate alike.
 */
export function declaredPolicyVerdicts(
	declaredPolicyIds: readonly string[],
	latest: ReadonlyMap<string, SubjectAssessmentRecord>,
	subjectSemanticVersion: number,
	governs: (policyId: string) => boolean
): readonly DeclaredPolicyVerdict[] {
	const verdicts: DeclaredPolicyVerdict[] = [];
	for (const policyId of declaredPolicyIds) {
		const rec = latest.get(policyId);
		// ⭐⭐ `R19` — EVERY DECLARED POLICY NOW RETURNS A ROW. It used to `continue` here, and the three ways a
		// policy can fail to speak were all spelled as ABSENCE from this list — which the fold reads as "nothing
		// to compose" rather than "something required is missing". §28.2 rung 3 was therefore unreachable from
		// this call site, and `assessed` was dead code.
		const silent = (silence: DeclaredPolicySilence, assessed: boolean): void => {
			verdicts.push({
				policyId,
				...(rec ? { assessmentId: rec.assessmentId } : {}),
				silence,
				assessed,
				// ⛔ GOVERNANCE IS ASKED ONLY HERE, ON THE DEMANDING ARM. A policy WITH a verdict votes whatever its
				// status; see `DeclaredPolicyVerdict.applicable`.
				applicable: governs(policyId)
			});
		};
		if (!rec) {
			silent('NEVER_ASSESSED', false);
			continue;
		}
		if (!CONCLUDED_ASSESSMENT_STATES.has(rec.assessmentState)) {
			// ⛔ THE ERASURE, AND IT IS WHY THIS ARM EXISTS. `latestAssessmentByPolicy` returns the latest record
			// WHATEVER its state — correctly, because for the floor gate an assessment still ASSESSING is precisely
			// NOT a satisfied floor. Skipping it here, with no fallback to the previous concluded record, meant one
			// further `RequestAssuranceAssessment` under an already-REJECTED policy DELETED that policy's vote.
			// DRIVEN before this was written: the ENFORCED `RPH-PWU-007` fixture plus one accepted command returned
			// ACCEPTED, workLifecycleState SATISFIED.
			//
			// ⭑ AND THE ANSWER IS NOT "FALL BACK TO THE PREVIOUS CONCLUDED RECORD". That would make this gate walk
			// assessment history looking for one it likes, which is the controller-selects-its-own-evidence shape
			// this module exists to close, applied to time instead of to citation. A policy whose CURRENT word is
			// an unconcluded assessment has not spoken — that is the honest reading, and it is rung 3's.
			silent('IN_PROGRESS', true);
			continue;
		}
		if (rec.subjectSemanticVersion !== subjectSemanticVersion) {
			// ⛔ A VERDICT BOUND TO ANOTHER VERSION IS NOT THIS SUBJECT'S VERDICT. `floorGateBlock` version-binds out
			// of this SAME record and this reader did not — an asymmetry between two consumers of one index.
			// ⚠ `undefined` (the record bound no version) takes this arm too, and that is deliberate: the index
			// documents `undefined` as *"not stated, never the current one"*, and a verdict that named no version
			// cannot be shown to be about this one.
			silent('STALE_VERSION', true);
			continue;
		}
		verdicts.push({
			policyId,
			assessmentId: rec.assessmentId,
			disposition: rec.assessmentState,
			assessed: true
		});
	}
	return verdicts;
}

/** §28.2's own mapping of a verdict onto the aggregate vocabulary — ESCALATED has no rung and folds to INCONCLUSIVE. */
const strictnessOf = (disposition: string): number =>
	AGGREGATE_STRICTNESS.indexOf(
		(disposition === 'ESCALATED' ? 'INCONCLUSIVE' : disposition) as AggregateAssuranceDisposition
	);

/**
 * Does `asserted` stand against the subject's own declared policies? `null` when it does.
 *
 * THE COMPARISON IS §28.1's, MADE ADDRESSABLE BY `AGGREGATE_STRICTNESS`: an assertion may be as strict as the
 * composed disposition or stricter, never weaker. So SATISFIED stands only over a SATISFIED composition, while
 * CONDITIONALLY_SATISFIED stands over a SATISFIED one too — a controller recording a MORE cautious disposition
 * than it earned is not what "preserve the strictest unresolved disposition" forbids.
 *
 * EMPTY IS NO OPINION, NOT A REFUSAL — header item 1. With no declared policy carrying a verdict there is nothing
 * to compose, and `aggregateAssuranceDisposition([])` would answer UNASSESSED for a reason that belongs to the
 * read model.
 *
 * ⭑ `declaredVerdicts` IS A THUNK, AND NOT FOR STYLE. Assembling it costs a walk of the whole event log (see
 * `assessment-index.ts`: `StorageAdapter` offers no list-by-type), while the rule governs TWO of the PWU assurance
 * axis's ELEVEN values. Taking the rows eagerly would have paid that walk on every EVIDENCE_REQUIRED and
 * READY_FOR_ASSESSMENT hop, for a question that short-circuits on the line above. The laziness keeps the
 * satisfaction test — the one fact that decides whether the rule applies at all — in ONE place rather than
 * duplicating `SATISFACTION_CLAIMS` at the call site to guard the cost.
 */
export function unsupportedSatisfaction(
	asserted: string,
	declaredVerdicts: () => readonly DeclaredPolicyVerdict[]
): UnsupportedSatisfaction | null {
	if (!SATISFACTION_CLAIMS.has(asserted)) return null;
	const verdicts = declaredVerdicts();
	if (verdicts.length === 0) return null;
	const composed = aggregateAssuranceDisposition(
		// ⭐ `R19` — THE ROWS ARE PASSED AS THEY ARE, AND THAT IS THE WHOLE CHANGE. This used to hard-code
		// `assessed: true` over a list from which every silent policy had already been dropped, so
		// `aggregateAssuranceDisposition`'s `missing` filter was ALWAYS empty and its `assessed` discriminator was
		// dead at this caller. The kernel implemented rung 3 the entire time; nothing here could reach it.
		verdicts.map((v) => ({
			policyId: v.policyId,
			...(v.disposition !== undefined ? { disposition: v.disposition } : {}),
			assessed: v.assessed,
			...(v.applicable !== undefined ? { applicable: v.applicable } : {})
		}))
	);
	const assertedRank = strictnessOf(asserted);
	if (assertedRank <= strictnessOf(composed)) return null;
	// ⚠ A SILENT ROW THAT DOES NOT GOVERN IS NOT BLOCKING, AND IT MUST NOT BE LISTED AS ONE. The fold already
	// excluded it (`applicable: false` never enters `required`), so including it here would name a policy in a
	// refusal it played no part in — the "refusal that names the wrong rule" defect this file's own message
	// docblock records having committed once.
	const blocking = verdicts.filter(
		(v) =>
			v.applicable !== false &&
			(v.disposition === undefined || strictnessOf(v.disposition) < assertedRank)
	);
	return { composed, blocking };
}

/**
 * The refusal text. Built here rather than at the call site so the marker the enforcement register pins lives
 * beside the rule that produces it.
 *
 * IT NAMES THE COMPOSED DISPOSITION AS WELL AS THE OFFENDING ROWS. §28.1 is a rule about the FOLD; a message
 * naming only the bad policy would read as "one bad apple" and invite the reader to argue about that one policy
 * rather than about the aggregate, which is the rule.
 *
 * ⚠ IT CITES BOTH §7 SENTENCES, NOT THE ONE THAT HAPPENED TO FIRE. An earlier draft ended "Any rejected mandatory
 * assessment blocks satisfaction (JPWB-DOC-003 §7)" unconditionally — which is RPH-PWU-007's sentence, and on
 * RPH-ASR-012's arrangement (four SATISFIED, one CONDITIONALLY_SATISFIED, NOTHING rejected) it told the reader a
 * rejection had blocked them when none existed. A refusal that names the wrong rule is the same defect as a
 * register row quoting more than it enforces. Both sentences are stated, and `composed disposition X` — which is
 * also what each register row pins as its marker — is what says which one bit.
 */
export function unsupportedSatisfactionMessage(
	pwuId: string,
	asserted: string,
	result: UnsupportedSatisfaction
): string {
	// ⭐ `R19` — A SILENT POLICY SAYS WHY IT IS SILENT, AND WHICH ASSESSMENT (IF ANY) IS DISPLACING ITS VERDICT.
	// ⛔ `${b.disposition}` over a silent row would render the word "undefined" into a governed refusal message,
	// and the three silences have three different remedies — request one, conclude the one in flight, re-assess
	// at the current version. A message that flattened them would send an operator to the wrong one.
	const SILENCE_TEXT: Record<DeclaredPolicySilence, string> = {
		NEVER_ASSESSED: 'has no assessment over this subject at all',
		IN_PROGRESS:
			'has no CONCLUDED assessment — its most recent one is still in progress, which displaces any earlier verdict without replacing it',
		STALE_VERSION: 'has no assessment bound to this subject’s CURRENT semantic version'
	};
	const rows = result.blocking
		.map((b) =>
			b.silence
				? `${b.policyId} ${SILENCE_TEXT[b.silence]}${b.assessmentId ? ` (most recent: ${b.assessmentId})` : ''}`
				: `${b.policyId} is ${b.disposition} (assessment ${b.assessmentId})`
		)
		.join('; ');
	return (
		`ChangePwuState would set PWU ${pwuId} assuranceState=${asserted}, but a policy this PWU itself ` +
		`declares has not been satisfied. Folding the declared policies' own verdicts (DOC-004 §28.2, whose rung ` +
		`order IS §28.1's "preserve the strictest unresolved required disposition") yields composed disposition ` +
		`${result.composed}, which does not support ${asserted}: ${rows}. Aggregate assurance preserves the ` +
		`strictest unresolved required disposition, and any rejected mandatory assessment blocks satisfaction ` +
		`(JPWB-DOC-003 §7) — a controller does not choose which of its own required policies count by choosing ` +
		`which assessments to cite.`
	);
}
