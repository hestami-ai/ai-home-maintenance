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
// 1. ⛔ IT DOES NOT FIRE ON A DECLARED POLICY WITH NO CONCLUDED ASSESSMENT (§28.2 rung 3, "any required
//    assessment missing"). Only policies carrying one of §28.2's five recognised outcomes vote. The rung is real
//    and this is a genuine residual — recorded, and OBSERVED by a test in
//    `declared-assurance-binds.test.ts` rather than left to a reader's inference.
//    WHY IT IS NOT TAKEN HERE: the rung's blast radius is a different rule with a different subject. Folding an
//    ABSENT assessment in makes `aggregateAssuranceDisposition([])` — which returns UNASSESSED by design, because
//    for a READ MODEL "no policy governs this" must not render as SATISFIED — into a COMMAND refusal that no PWU
//    declaring zero policies could ever escape. That is a rule about whether work may be satisfied without any
//    declared assurance at all; it is worth having, it is not RPH-PWU-007 or RPH-ASR-012, and landing it inside
//    them would have been one arrangement tripping two rules, which proves neither.
//
// 2. ⛔ IT DOES NOT CHECK THE SUBJECT'S SEMANTIC VERSION. A verdict recorded against version n still counts at
//    version n+1 here. That is RPH-ASR-010's disclosed gap — *"a verdict on version n accepted as satisfying
//    version n+1"* — which lives on the ASSESSMENT path (`completeAssuranceAssessment` binding a version the
//    subject is not at), not on this one, and still carries its own OBSERVED_ADMISSION probe. Adding the limb
//    here would have made a single arrangement trip two guards and left neither individually proven.
//    `SubjectAssessmentRecord` carries `subjectSemanticVersion`, so the limb is one comparison away when that row
//    is taken up; it is absent because it is unproven here, not because the datum is missing.
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

/** One declared policy's own verdict on this subject. */
export interface DeclaredPolicyVerdict {
	readonly policyId: string;
	readonly assessmentId: string;
	/** One of `CONCLUDED_ASSESSMENT_STATES` — never a §30 lifecycle value. */
	readonly disposition: string;
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
	latest: ReadonlyMap<string, SubjectAssessmentRecord>
): readonly DeclaredPolicyVerdict[] {
	const verdicts: DeclaredPolicyVerdict[] = [];
	for (const policyId of declaredPolicyIds) {
		const rec = latest.get(policyId);
		if (!rec || !CONCLUDED_ASSESSMENT_STATES.has(rec.assessmentState)) continue;
		verdicts.push({ policyId, assessmentId: rec.assessmentId, disposition: rec.assessmentState });
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
		verdicts.map((v) => ({ policyId: v.policyId, disposition: v.disposition, assessed: true }))
	);
	const assertedRank = strictnessOf(asserted);
	if (assertedRank <= strictnessOf(composed)) return null;
	const blocking = verdicts.filter((v) => strictnessOf(v.disposition) < assertedRank);
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
	const rows = result.blocking
		.map((b) => `${b.policyId} is ${b.disposition} (assessment ${b.assessmentId})`)
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
