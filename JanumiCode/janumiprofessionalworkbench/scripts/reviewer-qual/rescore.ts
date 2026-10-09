// ⭐ `JAN-CRITREAD` J2-3 — RE-SCORING A RECORDED EVALUATION THROUGH TODAY'S PATH, WITH NO MODEL CALL
// (DESIGN-what-the-tests-prove.md §5.4 RESCORED, §5.6 limbs 1 and 2).
//
// The recorded replies are replayed at the validator's print seam, in order, as the tool's report of the recorded
// evaluator (`runner.ts` `replayReplies`), and scored by the runner's own `evaluateCase` — the same path a run scores
// through. Two uses: the check's REPRODUCTION limb (does a record still score what it scored at run time?) and the
// RESCORED lines that discharge a move where no case prompt changed (`rescoredLines`; §5.6 limb 1).
//
// ⛔ A RE-SCORING THAT WOULD NEED A DIFFERENT NUMBER OF CALLS IS NOT ONE. If today's parse accepts a first reply the run
// had to repair, or rejects one the run accepted, the evaluation today's reviewer would make is not the recorded one:
// the repair call is owed (§5.6 limb 1), and this refuses rather than score half a replay.
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { QualificationCase } from './cases.js';
import {
	restampable,
	type CallLine,
	type CasePromptHashes,
	type RescoredLine,
	type RunLine,
	type ScoredOutcome
} from './record.js';
import { evaluateCase, replayReplies } from './runner.js';

/** Why a recorded evaluation cannot be re-scored today — the check reports it as a non-reproduction. */
export class NotRescorable extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotRescorable';
	}
}

/** `calls` — one evaluation of `c` in `run`, in order — scored through today's path under `scoringDigest`. */
export async function rescoreEvaluation(
	run: RunLine,
	c: QualificationCase,
	calls: readonly CallLine[],
	scoringDigest: string,
	criteria: readonly AssessmentCriterion[] = SEEDED_REASONING_REVIEW_CRITERIA
): Promise<ScoredOutcome> {
	const failed = calls.find((k) => k.reply.status === 'TRANSPORT_FAILURE');
	if (failed) throw new NotRescorable(`its ${failed.role} call returned nothing to replay (a transport failure)`);
	let replayed;
	try {
		replayed = await evaluateCase({
			case: c,
			criteria,
			candidate: run.candidate,
			call: replayReplies(calls),
			scoringDigest
		});
	} catch (e) {
		throw new NotRescorable(
			/ran out of recorded replies/.test(String(e))
				? `today's path asks for a repair the run never made — the first try's parse outcome changed, so the repair call is owed`
				: `the replay failed — ${String(e)}`
		);
	}
	if (replayed.calls.length !== calls.length)
		throw new NotRescorable(
			`today's path makes ${replayed.calls.length} call(s) where the run made ${calls.length} — the first try's parse ` +
				'outcome changed, so the evaluation is not re-scorable'
		);
	return replayed.scored;
}

/** Today's stamps, as a RESCORED line carries them. */
export interface RescoreStamp {
	readonly rescoreId: string;
	readonly date: string;
	readonly commit: string;
	readonly reviewer: string;
	readonly scoring: string;
	readonly caseSet: string;
}

/**
 * ⭐ THE RESCORED LINES FOR A SOURCE RUN — one per complete evaluation that is re-scorable today, re-derived from its
 * recorded spans and stamped with today's fingerprint (§5.4). `cases` is today's case set: an evaluation of a case it
 * no longer holds has nothing to be scored against, and is skipped.
 * ⭐ `JAN-ESCREC` ER-2 — WHICH EVALUATIONS, BY THE ONE PREDICATE THE CHECK DEMANDS THEM BY (`record.ts` `restampable`),
 * then re-scorability (`rescoreEvaluation`): the check refuses a RESCORED record that leaves out one this yields, or
 * re-stamps one it does not (`check-core.ts`). `casePrompts` is today's prompt hashes (`fingerprint.ts`), what limb 2
 * compares first: an evaluation whose recorded prompt is not today's owes a model call, not a re-scoring, and is
 * skipped (the ER-2 fix round's re-verifier's finding [0]).
 */
export async function rescoredLines(
	source: RunLine,
	calls: readonly CallLine[],
	cases: readonly QualificationCase[],
	casePrompts: CasePromptHashes,
	stamp: RescoreStamp,
	criteria: readonly AssessmentCriterion[] = SEEDED_REASONING_REVIEW_CRITERIA
): Promise<RescoredLine[]> {
	const byEvaluation = new Map<string, CallLine[]>();
	for (const call of calls.filter((k) => k.runId === source.runId)) {
		const key = `${call.caseId}#${call.repetition}`;
		byEvaluation.set(key, [...(byEvaluation.get(key) ?? []), call]);
	}
	const out: RescoredLine[] = [];
	for (const evaluation of byEvaluation.values()) {
		if (!restampable(evaluation, (id) => cases.some((k) => k.id === id), casePrompts)) continue;
		const last = evaluation.at(-1)!;
		const c = cases.find((k) => k.id === last.caseId)!;
		let scored: ScoredOutcome;
		try {
			scored = await rescoreEvaluation(source, c, evaluation, stamp.scoring, criteria);
		} catch (e) {
			if (e instanceof NotRescorable) continue;
			throw e;
		}
		out.push({
			kind: 'RESCORED',
			rescoreId: stamp.rescoreId,
			sourceRunId: source.runId,
			date: stamp.date,
			commit: stamp.commit,
			reviewerFingerprint: stamp.reviewer,
			scoringDigest: stamp.scoring,
			caseSetDigest: stamp.caseSet,
			caseId: last.caseId,
			repetition: last.repetition,
			scored
		});
	}
	return out;
}
