// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73's rule with D87 and D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.27, §12.41, §12.26;
// `REG-D-166` (2), (5), (6); `REG-D-167` (1), (2); the lead's rulings 3, 4, 7 and 14 on L17b2's Stage 0) — THE WAY BACK THE STRUCTURE OFFERS, CHOSEN FROM
// THE ROUND'S RECORDS ALONE.
//
// ⭑ THE CHOICE (`wayBackChoice`), one pure function over the round as the record holds it, in order:
//   · ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A01; the lead's r26 (1)(a), r26a) — the round's stage, or its
//     Historian's re-ask, running in this process now (the stage's hold, read through the reader its caller hands in): no way back and no sponsor's
//     case, since the step-back an open recurrence brings "before the way back" (D82, D75) may yet be recorded;
//   · no stage of the round yet: the stage, and no way back (D72's "When", with D76's interim; ruling 3);
//   · the Historian's latest answer recommending `REQUEST_HUMAN_DECISION`: no way back — the sponsor decides (D79, D87);
//   · the Historian not concluded — INCONCLUSIVE, refused at its completion, not run, or no answer at all: asked once more (ruling 7); not concluded
//     twice: no way back — the sponsor decides;
//   · ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26a) — read from the record as the stage and the re-ask read it: the round holding an open
//     `KNOWN_FAILURE_RECURRENCE` observation (`openRecurrencesOf`) and NO step-back record of any status — recorded, failing, refused or not run, each
//     counts, as the re-ask's `steppedBack` counts them (one step-back a round, D73): no way back — the sponsor decides, a third case. After the
//     Historian's own cases, so that where its latest ask did not conclude the re-ask stays offered, and runs the step-back the round has not had;
//   · otherwise — `RESHAPE_PWU` as nothing recommended, its reason carried (D87; ruling 4), and any other action, which the policy does not permit and Gate
//     B refuses at completion, read as nothing recommended — by the diagnosis: naming the rejected unit, its own work re-run in place (D71); naming an
//     earlier candidate, the work sent back to that unit alone (D72); naming none, or a diagnosis refused, failing or not run, the person's choice — the
//     re-run beside every candidate. ⛔ No count bounds the rounds: the spend limit stays the one hard stop (`REG-D-148`).
// ⭑ ITS READING FROM THE RECORD (`wayBackOffer`, below) is the one reading the page's offers, its acts and the lane read (§16 (4): each act checks its own
// rationale, target and state first, then this). ⭑ Read from the engine alone — the stage records, the Historian's assessments and their completion
// events — since the page's `load` is synchronous (L17b2 facts §26.4, reading 1).
import type { EngineHandle } from '@janumipwb/rph-engine';
import { historianAsksOf, STAGE_PART, stageRecordsIn } from '../assurance/assurance-stage-records.js';
import { rejectedRerunOffer, rejectingVerdictFindings } from './rejected-rerun.js';
import { sendBackOffer } from './send-back.js';

/** One ask of the Historian in a round, as the record holds it: whether it concluded, and the control action it recommended, if any. */
export interface HistorianAsk {
	readonly concluded: boolean;
	readonly recommendedControlAction: { readonly action: string; readonly reason: string } | null;
}

/** One candidate the work may be sent back to (D72): its id and its title. */
export interface WayBackCandidate {
	readonly id: string;
	readonly title: string;
}

/** ⭐ The round as the rule reads it (see the header). */
export interface RoundReading {
	/**
	 * ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26 (1)(a), r26a) — whether this process runs the round's stage or its Historian's re-ask now: the
	 * stage's own hold, read through `StageReaders.isRunning`, since a stage records its parts one by one and its step-back last.
	 */
	readonly stageRunning: boolean;
	/** Whether the round's assurance stage has run: it has recorded the round's chapter part. */
	readonly stageRan: boolean;
	/**
	 * ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26a) — whether the round holds an open `KNOWN_FAILURE_RECURRENCE` observation, as the stage reads it
	 * (`StageReaders.openRecurrences`), and no step-back record of any status: the step-back that recurrence brings has no record in this round.
	 */
	readonly stepBackNotRecorded: boolean;
	/** The round's asks of the Historian, in the order recorded. */
	readonly historianAsks: readonly HistorianAsk[];
	/** The round's diagnosis: its status as recorded and the unit it names; undefined where none is recorded. */
	readonly diagnosis: { readonly status: string; readonly named: string | null } | undefined;
	readonly rejectedUnitId: string;
	/** The units whose work the rejected unit's work used (D72's candidates, in their order). */
	readonly candidates: readonly WayBackCandidate[];
	/** Whether D71's re-run in place may be offered on the unit at all: a model does its work (`rejectedRerunOffer`). */
	readonly rerunInPlaceOffered: boolean;
}

/** ⭐ Why the sponsor decides, where no way back is offered (ruling 14). */
// ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26a) — and a third: the step-back a recurrence brings has no record in this round.
export type SponsorDecidesBecause = 'REQUEST_HUMAN_DECISION' | 'NOT_CONCLUDED_TWICE' | 'STEP_BACK_NOT_RECORDED';

/** ⭐ The way back the structure offers (see the header). */
export type WayBackChoice =
	// ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26 (1)(a)) — no way back yet: the round's stage or its re-ask running.
	| { readonly kind: 'STAGE_RUNNING' }
	| { readonly kind: 'RUN_STAGE' }
	| { readonly kind: 'SPONSOR_DECIDES'; readonly because: SponsorDecidesBecause }
	| { readonly kind: 'ASK_HISTORIAN_AGAIN' }
	| { readonly kind: 'RERUN_IN_PLACE'; readonly reshapeReason?: string }
	| { readonly kind: 'SEND_BACK'; readonly candidate: WayBackCandidate; readonly reshapeReason?: string }
	| { readonly kind: 'PERSON_CHOOSES'; readonly rerunInPlace: boolean; readonly candidates: readonly WayBackCandidate[]; readonly reshapeReason?: string };

/** ⭐ D87 — the one recommendation the rule reads beside `REQUEST_HUMAN_DECISION`. */
export const RESHAPE_PWU = 'RESHAPE_PWU';
/** ⭐ D73, D87 — the recommendation that pauses the run for the sponsor. */
export const REQUEST_HUMAN_DECISION = 'REQUEST_HUMAN_DECISION';

/** ⭐⭐ THE WAY BACK, CHOSEN FROM THE ROUND'S RECORDS ALONE (see the header). */
export function wayBackChoice(r: RoundReading): WayBackChoice {
	if (r.stageRunning) return { kind: 'STAGE_RUNNING' };
	if (!r.stageRan) return { kind: 'RUN_STAGE' };
	const latest = r.historianAsks.at(-1);
	if (latest?.recommendedControlAction?.action === REQUEST_HUMAN_DECISION) return { kind: 'SPONSOR_DECIDES', because: REQUEST_HUMAN_DECISION };
	if (latest === undefined || !latest.concluded)
		return r.historianAsks.filter((a) => !a.concluded).length >= 2
			? { kind: 'SPONSOR_DECIDES', because: 'NOT_CONCLUDED_TWICE' }
			: { kind: 'ASK_HISTORIAN_AGAIN' };
	if (r.stepBackNotRecorded) return { kind: 'SPONSOR_DECIDES', because: 'STEP_BACK_NOT_RECORDED' };
	const action = latest.recommendedControlAction;
	const reason = action?.action === RESHAPE_PWU ? { reshapeReason: action.reason } : {};
	const d = r.diagnosis;
	if (d?.status === 'recorded' && d.named === r.rejectedUnitId && r.rerunInPlaceOffered) return { kind: 'RERUN_IN_PLACE', ...reason };
	const named = d?.status === 'recorded' ? r.candidates.find((c) => c.id === d.named) : undefined;
	if (named !== undefined) return { kind: 'SEND_BACK', candidate: named, ...reason };
	return { kind: 'PERSON_CHOOSES', rerunInPlace: r.rerunInPlaceOffered, candidates: r.candidates, ...reason };
}

/** ⭐ What the round's rule offers a unit, read from the record: the round, its reading, and the way back chosen from it. */
export interface WayBackOffer {
	readonly roundId: string;
	readonly reading: RoundReading;
	readonly choice: WayBackChoice;
}

/**
 * ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26 (1), r26a) — WHAT THE RULE READS OF THE STAGE: whether the round's stage or its re-ask runs in this
 * process now (the stage's hold, through its reader), and the round's open recurrences as the stage and the re-ask read them. Handed in by the caller —
 * the stage's own readers (`WAY_BACK_STAGE_READERS`), for the page's `load`, each act and the re-ask alike (§16 (4)) — since the stage's module reads
 * this one, and an import back would be a cycle.
 */
export interface StageReaders {
	readonly isRunning: (roundId: string) => boolean;
	readonly openRecurrences: (engine: EngineHandle, pwuId: string, roundId: string) => readonly unknown[];
}

/** The unit's lifecycle, execution and assurance states, as D71's offer reads them. */
const isRejectedState = (unit: { workLifecycleState?: unknown; executionState?: unknown; assuranceState?: unknown } | undefined): boolean =>
	unit?.workLifecycleState === 'UNDER_ASSURANCE' && unit.executionState === 'SUCCEEDED' && unit.assuranceState === 'REJECTED';

/**
 * ⭐⭐ THE ROUND'S RULE, READ FROM THE RECORD — on a unit in D71's rejected state with a governing declared policy's latest verdict REJECTED: its round, by
 * its opening verdict (the stage's offer's reading); whether the round's stage ran (its chapter part recorded); each ask of its Historian
 * (`historianAsksOf`); its diagnosis, its status and the unit it names; the units its work used (`sendBackOffer`'s candidates); and whether D71's
 * re-run may be offered on it at all (`rejectedRerunOffer`). `undefined` on any other unit: it has no round, and each act refuses it in its own words.
 * ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26 (1), r26a) — and, through the stage's readers handed in (`stage`), whether the round's stage or its
 * re-ask runs now, and whether the round holds an open recurrence with no step-back record of any status. ⛔ `stage` has no default: a caller that
 * read no hold would offer the way back while a step-back is pending.
 */
export function wayBackOffer(engine: EngineHandle, pwuId: string, stage: StageReaders): WayBackOffer | undefined {
	const unit = engine.loadObject(pwuId)?.state as { workLifecycleState?: unknown; executionState?: unknown; assuranceState?: unknown } | undefined;
	if (!isRejectedState(unit)) return undefined;
	const { rejected } = rejectingVerdictFindings(engine, pwuId);
	if (rejected.length === 0) return undefined;
	const roundId = rejected[0]!.assessmentId;
	const ofRound = stageRecordsIn(engine).filter((r) => r.roundId === roundId);
	const diagnosis = ofRound.filter((r) => r.part === STAGE_PART.DIAGNOSIS).at(-1);
	const sendBack = sendBackOffer(engine, pwuId);
	const reading: RoundReading = {
		stageRunning: stage.isRunning(roundId),
		stageRan: ofRound.some((r) => r.part === STAGE_PART.CHAPTER),
		stepBackNotRecorded: stage.openRecurrences(engine, pwuId, roundId).length > 0 && !ofRound.some((r) => r.part === STAGE_PART.STEP_BACK),
		historianAsks: historianAsksOf(engine, roundId).map((a) => ({ concluded: a.concluded, recommendedControlAction: a.recommendedControlAction })),
		diagnosis: diagnosis === undefined ? undefined : { status: diagnosis.status, named: diagnosis.named ?? null },
		rejectedUnitId: pwuId,
		candidates: 'refusedBecause' in sendBack ? [] : sendBack.candidates,
		rerunInPlaceOffered: !('refusedBecause' in rejectedRerunOffer(engine, pwuId))
	};
	return { roundId, reading, choice: wayBackChoice(reading) };
}

/** ⭐ D71 — whether the round's choice offers the rejected unit's own work re-run in place. */
export function offersRerunInPlace(choice: WayBackChoice): boolean {
	return choice.kind === 'RERUN_IN_PLACE' || (choice.kind === 'PERSON_CHOOSES' && choice.rerunInPlace);
}

/** ⭐ D72 — the units the round's choice offers the work sent back to: the one its diagnosis names, or every candidate where the person chooses. */
export function sendBackCandidatesOf(choice: WayBackChoice): readonly WayBackCandidate[] {
	if (choice.kind === 'SEND_BACK') return [choice.candidate];
	if (choice.kind === 'PERSON_CHOOSES') return choice.candidates;
	return [];
}

/**
 * ⭐⭐ Ruling 14, §7 — THE SPONSOR'S CASE IN PLAIN WORDS, where no way back is offered: the Historian asks for the sponsor's decision, with its reason as it
 * gave it; or it did not reach a judgment twice. Then that no way back is offered and the sponsor decides. The page shows it (`sponsor-decides`), and the
 * lane names the case in its words.
 */
export function sponsorDecidesStatement(offer: Pick<WayBackOffer, 'reading'> & { readonly choice: Extract<WayBackChoice, { kind: 'SPONSOR_DECIDES' }> }): string {
	// ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26a) — the third case, in the lead's plain words.
	if (offer.choice.because === 'STEP_BACK_NOT_RECORDED')
		return 'The Historian found a known failure coming back, and the step-back it brings has no record in this round. No way back is offered: the sponsor decides.';
	if (offer.choice.because === 'NOT_CONCLUDED_TWICE')
		return 'The Historian did not reach a judgment of the loop twice: asked once, and asked once more. No way back is offered: the sponsor decides.';
	const reason = offer.reading.historianAsks.at(-1)?.recommendedControlAction?.reason.trim() ?? '';
	return `The Historian asks for the sponsor’s decision${reason === '' ? ', and gave no reason' : `: “${reason}”`}. No way back is offered: the sponsor decides.`;
}

/** ⭐ Why the round's rule offers no way back of either kind yet, or none at all: its stage not run, its Historian not concluded, or the sponsor deciding. */
function noWayBackYet(offer: WayBackOffer): string | undefined {
	const { choice, roundId } = offer;
	// ⭐ L17b2 (Codex's L17B2C-A01; the lead's r26 (1)(a)) — the round's stage, or its re-ask, running: said in its own words.
	if (choice.kind === 'STAGE_RUNNING')
		return (
			`the assurance stage of this round (${roundId}) is running now — its Historian, or the Unsticking Agent a recurrence brings, may yet record a ` +
			'part: no way back is offered until it has ended (design D73, D82)'
		);
	if (choice.kind === 'RUN_STAGE')
		return `the assurance stage of this round (${roundId}) has not run: no way back is offered until the round's Historian assessment is recorded (design D72, D73; L17b2 ruling 3)`;
	if (choice.kind === 'ASK_HISTORIAN_AGAIN')
		return `the Historian of this round (${roundId}) has not concluded: it is asked once more before any way back is offered (design D73; L17b2 ruling 7)`;
	if (choice.kind === 'SPONSOR_DECIDES') return sponsorDecidesStatement({ reading: offer.reading, choice });
	return undefined;
}

/**
 * ⭐⭐ §16 (4) — THE ROUND'S RULE, AS D71'S ACT READS IT, after its own rationale, target and state checks: why the re-run in place is not offered by the
 * round's records, or undefined where it is (or where the unit has no round, which its own check refuses first).
 */
export function rerunRefusedByRule(offer: WayBackOffer | undefined): string | undefined {
	if (offer === undefined || offersRerunInPlace(offer.choice)) return undefined;
	const yet = noWayBackYet(offer);
	if (yet !== undefined) return yet;
	if (offer.choice.kind === 'SEND_BACK')
		return (
			`the round's diagnosis names "${offer.choice.candidate.title}" (${offer.choice.candidate.id}), so the work is sent back to that unit alone, and ` +
			"the rejected unit's own work is not re-run in place (design D73, D72)"
		);
	return "the round's records offer no re-run in place of this unit's work (design D73)";
}

/** ⭐⭐ §16 (4) — THE ROUND'S RULE, AS D72'S ACT READS IT, after its own checks: why the work is not sent back to `targetId`, or undefined where it is. */
export function sendBackRefusedByRule(offer: WayBackOffer | undefined, targetId: string): string | undefined {
	if (offer === undefined || sendBackCandidatesOf(offer.choice).some((c) => c.id === targetId)) return undefined;
	const yet = noWayBackYet(offer);
	if (yet !== undefined) return yet;
	if (offer.choice.kind === 'RERUN_IN_PLACE')
		return "the round's diagnosis names the rejected unit itself, so its own work is re-run in place, and no work is sent back (design D73, D72)";
	if (offer.choice.kind === 'SEND_BACK')
		return (
			`the round's diagnosis names "${offer.choice.candidate.title}" (${offer.choice.candidate.id}), so the work is sent back to that unit alone, ` +
			`not to ${targetId || 'no unit'} (design D73, D72)`
		);
	return "the round's records offer no unit to send this work back to (design D73)";
}
