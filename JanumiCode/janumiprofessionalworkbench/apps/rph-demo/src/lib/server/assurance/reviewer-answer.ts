// MXREAD-03 — the consumer, without which the resolution layer is a hollow one.
//
// ⭑ THIS MODULE EXISTS FOR A REASON THE DESIGN STATES BEFORE THE CODE. `verifyExchangeContent` and
// `readAnswerSpan` have exactly two natural callers: a diagnostic surface (blocked behind `REG-Q-077`) and a
// purge scheduler (`REG-F-245`, separate work). Shipped with neither, their only consumer would be their own
// gate — which is `project_jpwb_hollow_governed_layer`'s shape, and this repository found 74% of a kernel dead
// that way. So the read path lands WITH a reader or it does not land.
//
// ── WHAT IT SHOWS, AND THE LINE IT DOES NOT CROSS ───────────────────────────────────────────────────────────
// The ANSWER the reviewer returned — the material a recorded Assessment concluded from, classified
// `RETAINED_BY_PARTICIPATION` by `REG-D-050`, whose sponsor words are *"fully auditable and reconstructable"*.
// ⛔ NOT the volunteered reasoning, and NOT the reassembled reply: `PER-12` restricts that material, reads are
// authority-checked nowhere in this system (`rph-engine/src/engine.ts:195`), and a surface returning it would
// be the first read anyone needed permission for. That is `REG-Q-077`.
import { listByType } from '@janumipwb/rph-engine';
import {
	readAnswerSpan,
	verifyExchangeContent,
	type ResolvableExchange
} from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
// ⭐ `P76F-C` C2 — the validator's own I5 marker, imported (this module runs in the app, where the validator is loaded
// anyway); the run report RESTATES it instead (`REG-D-072` D12), held equal by verif.
import { NO_CRITERION_ANSWERED } from './reasoning-review-validator.js';
import { outputLimitOf } from '../tools/output-limit.js';

export interface ReviewerAnswerView {
	readonly exchangeId: string;
	readonly attemptOrdinal: number;
	/** The reviewer's answer, when it is retained AND verified. Absent otherwise — never a partial claim. */
	readonly answer?: string;
	/** ⭑ ALWAYS POPULATED. When `answer` is absent this says why, in terms a reader can act on; when it is
	 *  present this says what was checked, so a verified read is distinguishable from an unchecked one. */
	readonly disclosure: string;
	/** The per-element verdicts, so the panel can show that a record's OWN claim about its bytes was tested. */
	readonly verdicts: readonly { readonly field: string; readonly verdict: string }[];
}

/** The fields of a stored try this reader decides by. */
export type Try = { readonly id: string; readonly state: unknown };
const tryState = (r: Try) =>
	r.state as {
		readonly runToken?: string;
		readonly subjectObjectId?: string;
		readonly attemptOrdinal?: number;
		readonly disposition?: string;
		readonly parseOutcome?: { readonly outcome?: string; readonly detail?: string };
	};
const ordinalOf = (r: Try): number => Number(tryState(r).attemptOrdinal ?? 0);

/**
 * ⭐ `P76F-D` D3 — THE DISPOSITIONS A REVIEW CONCLUDES ON, as the run report names a concluding call (`concludedBy`,
 * `scripts/phase7/run-report-core.ts`): an answer, a call that threw (the review then records it got none), a refusal.
 * ⛔ Never `REPAIR_REQUESTED` — a reply that asked to be repaired concluded nothing — nor `QUARANTINED`.
 */
const CONCLUDES: ReadonlySet<string> = new Set(['ACCEPTED', 'NO_RESPONSE', 'REJECTED']);

/**
 * ⭐⭐ `JAN-EXEC` P7-6 fix round C, C2 (`DESIGN-the-reviewer-isolated.md` §4d I5; `REG-F-552`) — THE TRY ONE FLOOR RUN'S
 * REVIEW CONCLUDED FROM, its tries sorted by ordinal: the HIGHEST ordinal (the answered try, or the repair or retry whose
 * reply the review read last) — save a P7-6 I5 chain, a reply that PARSED and answered no criterion, told by the I5 pair on
 * its record (`SCHEMA_COERCION_FAILED` and the validator's marker `NO_CRITERION_ANSWERED` opening the detail — never the
 * outcome alone, which a JSON repair's first reply carries too). I5's one repair may only ADD a conclusion: answering, it
 * concluded the review; answering none, not parsing or getting no reply, the review kept the FIRST reply's judgement —
 * while the record ENDS on the repair. ⛔ Read by its highest ordinal, the page showed that repair's reply (prose, or none)
 * under an assessment that concluded from the first. ⚠ A repair refused for WHO answered it (a substitute, recorded
 * `NOT_ATTEMPTED`) failed the review: the general rule stands, as in the Phase 7 run report (`criterionRepairConclusion`,
 * `scripts/phase7/run-report-core.ts`), which reads the same rule from the same records.
 * ⭐⭐ `P76F-D` D3 — ~~reads the same rule~~ ⛔ IT DID NOT, ON A REPAIR THE RECORD DOES NOT HOLD (its capture threw, or its
 * record was lost): the reader returned the FIRST reply — the one that ASKED for a repair — while the report names no call
 * (`concludedBy`: *"which concludes no review: the call that concluded it is not in the record"*). The report is right:
 * a review does not conclude from a reply that asked to be repaired, and with no repair on the record nothing there
 * concluded it. So the reader now reads the report's two rules as the report does: outside an I5 chain the general rule,
 * which takes the highest ordinal only when its disposition concludes a review (`CONCLUDES`); inside one, an answering
 * repair, else the first reply only where the record holds a repair that ENDED without concluding (no reply, or refused
 * — `keptFirst` below; a substitute's refusal is the general rule's), else none. ⭑ And
 * the claim is now CHECKED, not stated: `reviewer-answer.test.ts` reads every chain it builds through both, the report's
 * own entry (`pairRun`) beside this, and holds them to the same try, or none.
 * ⭑ Exported for `reviewer-answer.test.ts`, which holds each conjunct on its own arrangement — including the two the
 * product's validator never writes (the marker beside another outcome; the outcome without the marker).
 */
export function concludedTry(sorted: readonly Try[]): Try | undefined {
	const last = sorted.at(-1);
	// ⭐ `P76F-D` D3 — THE GENERAL RULE, as the run report's (`concludedBy`): the highest ordinal, when a review concludes on
	// it; none when it is a reply that asked for a repair the record does not hold.
	const general = last !== undefined && CONCLUDES.has(String(tryState(last).disposition)) ? last : undefined;
	// The first try that got a reply: the call's, or its retry's after a throw — ⭐ or (P5 package A) after a reply the tool
	// ended at the model's output-token limit, from which nothing was judged (`outputLimitOf`).
	const asked = sorted.find((r) => tryState(r).disposition !== 'NO_RESPONSE' && outputLimitOf(r.state) === undefined);
	if (asked === undefined) return general;
	const outcome = tryState(asked).parseOutcome;
	const i5 =
		tryState(asked).disposition === 'REPAIR_REQUESTED' &&
		outcome?.outcome === 'SCHEMA_COERCION_FAILED' &&
		(outcome.detail ?? '').startsWith(NO_CRITERION_ANSWERED);
	if (!i5) return general;
	const after = sorted.filter((r) => ordinalOf(r) > ordinalOf(asked));
	const answered = after.find((r) => tryState(r).disposition === 'ACCEPTED');
	if (answered !== undefined) return answered;
	// ⚠ A substitute is REFUSED unread (`REJECTED`, `NOT_ATTEMPTED`); a repair that got no reply is `NO_RESPONSE`, whose
	// outcome is `NOT_ATTEMPTED` too — so the disposition tells them apart, never the outcome alone.
	const ended = tryState(after.at(-1) ?? asked);
	// ⭐ P5 package A (F1) — a repair the tool cut at the model's output-token limit shares a substitute's REJECTED and
	// NOT_ATTEMPTED, and is none: it ended without concluding, and the review kept the first reply's judgement.
	if (outputLimitOf(ended) !== undefined) return asked;
	const substituted = ended.disposition === 'REJECTED' && ended.parseOutcome?.outcome === 'NOT_ATTEMPTED';
	// ⭐⭐ `P76F-D` D3 — THE FIRST REPLY'S JUDGEMENT WAS KEPT ONLY BY A REPAIR THE RECORD HOLDS, ENDED WITHOUT CONCLUDING: no
	// reply, or refused. With no repair on the record, `ended` is the request itself (`REPAIR_REQUESTED`) — and a repair
	// recorded any other way, which the validator never writes, ended nothing — so nothing there concluded the review, and
	// no answer is shown, as the report names none (`concludedBy` of a call that concludes no review). ⛔ It returned the
	// request — the reply that asked to be repaired. ⭑ `undefined`, never `general`: the two agree on every such record
	// (its last try concludes nothing), and `general` would answer an ANSWERING repair too, leaving the `answered` branch
	// above with nothing to decide (measured: `P76F-C-M12` survived it).
	const keptFirst = ended.disposition === 'NO_RESPONSE' || ended.disposition === 'REJECTED';
	if (!keptFirst) return undefined;
	return substituted ? last : asked;
}

/**
 * The reviewer's retained answer from the floor run `floorRunToken` names, verified before it is shown.
 *
 * ⚠ MOST RECENT BY `attemptOrdinal`, NOT BY INSERTION ORDER. A run makes up to four bounded tries; reading "the first row
 * back" would show the try that FAILED while labelling it the reviewer's answer. ~~and the repair is the one whose answer
 * the assessment used~~ ⛔ `P76F-C` C2: not of every chain — a P7-6 I5 repair that added nothing is NOT the one the
 * assessment used; the first reply is (`concludedTry`).
 * ⭐⭐ `JAN-EXEC` P7-6 B7 (`REG-F-433`; `DESIGN-the-stopped-unit-recovery.md` RD10, as corrected) — BUT BY ORDINAL ONLY
 * WITHIN ONE FLOOR RUN. ⛔ The sort above ran across ALL the subject's runs, and every run's first try is ordinal 1: two runs
 * of one try each TIED, and the stable sort returned the OLDER run's answer (the entry's probe, and the test that holds
 * this: `floor-recording.test.ts`). A re-review is exactly that arrangement. So a run's calls are grouped by its token
 * (`runToken`, which a floor run shares with its assessments' correlation — `floor.ts`, `floor-over-subject.ts`).
 * ⭐⭐ `P76F-C` C2 — AND THE RUN IS THE ONE WHOSE REVIEW THE PAGE SHOWS, named by the caller (`floorRunToken`, the shown
 * assessment's own correlation: `loadPwaFloor`'s `reasoningReviewRunToken`). ~~the MOST RECENT RUN is taken BY THE RECORD'S
 * OWN ORDER~~ ⛔ B7 took the latest run on the subject, and said so: *"a call from an authoring turn that was later
 * discarded stays recorded (its exchanges are canonical; its assessments died with the fork), and is still the most recent
 * run here"* — so the page showed a discarded turn's answer beside a floor that never concluded from it.
 * ⚠ `engine` IS WHERE THE EXCHANGES ARE: CANONICAL, always — a floor run on an authoring turn drains its tries to canonical
 * through the turn's witness (`runPwaFloor`), while its assessments go to the fork, whose point-in-time snapshot holds
 * none of them. ⚠ A token that names no call — a floor recorded before the key (B7), whose assessments' correlation no
 * call carries — gives `undefined`: no answer is shown rather than another run's.
 */
export async function loadReviewerAnswer(
	subjectId: string,
	floorRunToken: string | undefined,
	engine: AuthedEngineHandle,
	store: ArtifactStore
): Promise<ReviewerAnswerView | undefined> {
	if (floorRunToken === undefined) return undefined;
	const rows = listByType(engine, 'MODEL_EXCHANGE')
		.filter((r) => tryState(r).subjectObjectId === subjectId && tryState(r).runToken === floorRunToken)
		.sort((a, b) => ordinalOf(a) - ordinalOf(b));
	const shown = concludedTry(rows);
	if (shown === undefined) return undefined;

	const state = shown.state as unknown as ResolvableExchange;
	const report = await verifyExchangeContent(state, store);
	const verdicts = report.refs.map((r) => ({ field: r.field, verdict: r.verdict }));
	const read = await readAnswerSpan(state, store);

	return {
		// ⭐⭐ `JAN-ASSERTED` `AS-06` — THE AGGREGATE'S OWN ID, NOT A FIELD THE STATE NEVER CARRIED.
		//
		// ⛔ THIS READ `state.exchangeId`, AND THE VALUE WAS ALWAYS `undefined`. `state` is obtained by
		// `as unknown as ResolvableExchange` a few lines up; `handlers/model-exchange.ts` destructures
		// `exchangeId` OUT before persisting, and `ModelExchangeSchema` is a `strictObject` that neither
		// declares the field nor accepts one. The assertion invented a field no contract has ever had.
		//
		// ⭑ AND THAT IS WHY IT SURVIVED A DERIVED SWEEP. An instrument comparing an asserted type against a
		// contract schema can only see a field the schema HAS and disagrees about; a field the schema has never
		// heard of is invisible to it. `REG-F-411`'s remedy — parse rather than assert — is the only one that
		// reaches this class, which is why it is filed with it rather than on its own.
		//
		// ⚠ THE ENGINE ALREADY RETURNED THE ANSWER. `listByType` yields rows keyed by aggregate id, and a
		// `MODEL_EXCHANGE` aggregate IS its exchange — so the id is a fact this function already holds, was
		// already sorting on, and threw away in favour of an assertion.
		exchangeId: shown.id,
		attemptOrdinal: ordinalOf(shown),
		...(read.available ? { answer: read.bytes } : {}),
		disclosure: read.available
			? `Retained and verified: the stored bytes were re-hashed and match what this record claims.`
			: read.refusedBecause,
		verdicts
	};
}
