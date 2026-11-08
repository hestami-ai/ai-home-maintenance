// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D46 (`REG-D-145`; design §11.7; roadmap §9b.5b, Z3 predicted red 2) — DEVIN'S FREE-TIER
// REFUSAL, THROUGH THE PRODUCT'S DEVIN BRANCH: *"A devin seam prints "free model rate limit" three times, then answers. Require one
// answered reviewer call, three refusals stated in the eventual exchange's tool observation and no exchange per refusal. Wait 45 s
// and repeat the same call, at most three times. Four refusals must fail the call as today."*
// ⭑ PREDICTED RED, WRITTEN FIRST: the registry hands `devinPrint` no wait, so a refusal fails the review's call at once.
// ⛔ No program and no model: devin is its exec seam here, and the wait is handed in and recorded.
import {
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVIN_FREE_TIER_REFUSAL, type DevinExec } from '../tools/devin-reviewer.js';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { createExchangeSink } from './exchange-capture.js';
import { createFloorRegistry } from './index.js';
import { TEST_INDICATIONS } from './indications.testing.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_free_tier',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'execution.model-invocation', modelId: 'fixture-executor-model', providerId: 'fixture-provider' }
};
const CTX: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Write the requirements for wordfreq.',
		content: '{"requirements":["R1: it counts words"]}',
		narration: ''
	}
};

/**
 * ⭐ Z3 (the lead's ruling on question 3) — ONE VIRTUAL CLOCK for the validator and devin: each call takes its own time and each
 * wait passes its own, so a call's span holds its refusals' waits as it would at the wall.
 * ~~the wall clock~~ ⛔ MOVED 2026-11-07: a wait handed in returns at once, so a span read off the wall is shorter than the waits
 * it holds, which the validator now refuses to place (`thrownCallDisposal`'s third rule).
 */
function virtualClock() {
	let ms = Date.parse('2026-11-07T00:00:00.000Z');
	return {
		now: () => new Date(ms).toISOString(),
		// ⭐ Z3 (the lead's correction to ruling 3) — the same clock, read as a number: devinPrint measures what came before the
		// last attempt on it (`devinNow`), so the validator's span and devinPrint's figure are taken off one clock.
		ms: () => ms,
		pass: (by: number) => {
			ms += by;
		}
	};
}

/** One devin call, as a script has it: a free-tier refusal, another failure, or the clearing judgement — each its own time. */
type DevinStep =
	| { readonly is: 'refusal'; readonly takesMs: number }
	| { readonly is: 'failure'; readonly takesMs: number; readonly error: string }
	| { readonly is: 'answer'; readonly takesMs: number };

/** devin, at its exec seam, on the clock: each call the script's next step, and the clearing judgement once it ends. */
function devinScripted(steps: readonly DevinStep[], clock: ReturnType<typeof virtualClock>) {
	const calls: string[][] = [];
	const exec: DevinExec = async (_file, args) => {
		calls.push([...args]);
		const step: DevinStep = steps[calls.length - 1] ?? { is: 'answer', takesMs: 1_000 };
		clock.pass(step.takesMs);
		if (step.is === 'refusal')
			throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached`), {
				code: 1,
				stdout: '',
				stderr: `Error: ${DEVIN_FREE_TIER_REFUSAL} reached`
			});
		if (step.is === 'failure')
			throw Object.assign(new Error(`Command failed: devin --print\n${step.error}`), { code: 1, stdout: '', stderr: step.error });
		writeFileSync(args[args.indexOf('--export') + 1]!, JSON.stringify({ steps: [{ extra: { generation_model: 'swe-2-max' } }] }));
		return { stdout: clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA) };
	};
	return { calls, exec };
}

/** The floor's review of SUBJECT, devin scripted on the clock: the review, devin's calls, the waits asked for, the exchanges. */
async function reviewedOnTheClock(steps: readonly DevinStep[]) {
	const clock = virtualClock();
	const devin = devinScripted(steps, clock);
	const waits: number[] = [];
	const exchanges = createExchangeSink();
	const registry = createFloorRegistry({
		testMode: false,
		devinExec: devin.exec,
		devinWait: async (ms) => {
			waits.push(ms);
			clock.pass(ms);
		},
		devinNow: clock.ms,
		clock: clock.now,
		indications: TEST_INDICATIONS,
		exchanges
	});
	const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return { review, calls: devin.calls, waits, records: exchanges.drain() };
}

/** `refusals` free-tier refusals of a second each, then the clearing judgement, its export naming swe-2-max. */
const reviewed = (refusals: number) =>
	reviewedOnTheClock(Array.from({ length: refusals }, (): DevinStep => ({ is: 'refusal', takesMs: 1_000 })));

beforeEach(() => {
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⛔ PREDICTED RED 2 (Z3; D46) — devin’s free-tier refusals, waited out inside the one reviewer call', () => {
	it('⭐ three refusals, then an answer: one answered call, one exchange, the three refusals stated in its tool observation', async () => {
		const { review, calls, waits, records } = await reviewed(3);
		expect(review.disposition, 'the review stands on the answer').toBe('SATISFIED');
		expect(calls, 'the same call made four times').toHaveLength(4);
		expect(waits).toEqual([45_000, 45_000, 45_000]);
		expect(records, 'one exchange: no exchange per refusal').toHaveLength(1);
		expect(records[0]!.observedToolCalls).toMatchObject({ observation: 'NOT_OBSERVABLE' });
		// ~~'devin refused this call 3 times for its free tier (“free model rate limit”) before it answered'~~ ⛔ MOVED 2026-11-07
		// (Z3 — the lead's correction to ruling 3): the statement names the figures the record keeps.
		expect((records[0]!.observedToolCalls as { reason: string }).reason).toContain(
			'devin answered after 3 free-tier refusals: 3000 ms of refused attempts and 135000 ms of waits (“free model rate limit”)'
		);
	});

	it('⛔ four refusals fail the call as today: the validator runs the thrown call once more (P7-2b), refused four times again, and the review ends with no answer — two exchanges, never one per refusal', async () => {
		const { review, calls, waits, records } = await reviewed(8);
		expect(calls, 'each of its two calls made four times, never a fifth').toHaveLength(8);
		expect(waits, 'three waits for each call, never a fourth').toEqual([45_000, 45_000, 45_000, 45_000, 45_000, 45_000]);
		expect(records.map((r) => r.disposition), 'one exchange for each call that failed, none for a refusal').toEqual([
			'no-response',
			'no-response'
		]);
		expect(review.disposition).toBe('INCONCLUSIVE');
	});

	it('⭑ CONTROL — an answer at once: one call, no wait, an observation with no refusal stated', async () => {
		const { review, calls, waits, records } = await reviewed(0);
		expect([review.disposition, calls.length, waits]).toEqual(['SATISFIED', 1, []]);
		expect((records[0]!.observedToolCalls as { reason: string }).reason).not.toContain('refused');
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING ON Z3'S QUESTION 3 (`z3-p1-rulings.md`): the exchange's times stay the
// span they are, but the timeout clause must not count the waits. The validator decides `thrownCallDisposal`'s clause on the
// call's own time, the span less the waits its failure carries (`freeTierRefusalsOf(...).waitedMs`), as the qualification's
// transport decides its class. The detail states the refusals and their waits beside that time.
// ⭑ PREDICTED RED, WRITTEN FIRST: the clause is decided on the span, so a failure 403 s into its own call, after 135 s of waits,
// reads "at or past the tool’s 480000 ms bound — a timeout", which is false.
describe('⛔ PREDICTED RED (Z3; the lead’s ruling 3) — a failure after free-tier refusals is placed against the bound by its own time', () => {
	it('⛔ three refusals, then a failure 400 s into its call: short of the 480 s bound, no timeout, its refusals and their waits stated beside its own time — the exchange still spanning them', async () => {
		const { calls, waits, records } = await reviewedOnTheClock([
			{ is: 'refusal', takesMs: 1_000 },
			{ is: 'refusal', takesMs: 1_000 },
			{ is: 'refusal', takesMs: 1_000 },
			{ is: 'failure', takesMs: 400_000, error: 'Error: the session ended' }
		]);
		expect([calls.length, waits], 'four calls and three waits, then the one further call, which answers').toEqual([
			5,
			[45_000, 45_000, 45_000]
		]);
		const failed = records[0]!;
		expect(failed.disposition).toBe('no-response');
		expect(Date.parse(failed.respondedAt) - Date.parse(failed.requestedAt), 'the exchange’s times: the span, waits and all').toBe(
			538_000
		);
		// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z3 — the lead's correction to ruling 3): ~~'… failed after 403000 ms …
		// Before this, the tool’s free tier refused the call 3 times, each refusal waited out and the same call made again: 135000 ms
		// of waits, left out of the time shown here (D46).'~~ — the time is the last attempt's, 400 s: the refused attempts' own
		// 3 s are no part of the call either, and the sentence states them beside the waits.
		expect(failed.parseOutcome.detail).toContain(
			'The reviewing tool’s call failed after 400000 ms with no reply, short of the tool’s 480000 ms bound, so it is run once ' +
				'more (REG-D-102). Before this, the call met 3 free-tier refusals: 3000 ms of refused attempts and 135000 ms of waits, ' +
				'each refusal waited out and the same call made again: all left out of the time shown here (D46). What the tool ' +
				'reported, sanitised: '
		);
		expect(failed.parseOutcome.detail, 'no timeout').not.toContain('a timeout');
	});

	it('⭑ CONTROL — a failure with no refusals is worded as today: 500 s into its call, at or past the bound, a timeout, no refusal stated', async () => {
		const { records } = await reviewedOnTheClock([{ is: 'failure', takesMs: 500_000, error: 'Error: the session ended' }]);
		expect(records[0]!.parseOutcome.detail.split(' What the tool reported, sanitised: ')[0]).toBe(
			'The reviewing tool’s call failed after 500000 ms with no reply, at or past the tool’s 480000 ms bound — a timeout, so it ' +
				'is run once more (REG-D-141 (2)).'
		);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S CORRECTION TO RULING 3 (`z3-p1-rulings.md`, "The follow-up hand-back"): the clause,
// and the time the detail shows, are the last attempt's. The validator takes off all that came before it — the refused attempts'
// run time and their waits together, as devinPrint measured them on the one clock (`beforeLastAttemptMs`).
// ⭑ PREDICTED RED, WRITTEN FIRST: the waits alone are taken off, so 3 refused attempts of 10 s, then a failure 475 s into the last,
// read 505 s — "at or past the tool’s 480000 ms bound — a timeout", which is false.
describe('⛔ PREDICTED RED (Z3; the lead’s correction to ruling 3) — the clause and the time shown are the last attempt’s', () => {
	it('⛔ three refused attempts of 10 s each, then a failure 475 s into the last: short of the bound, after 475000 ms', async () => {
		const { records } = await reviewedOnTheClock([
			{ is: 'refusal', takesMs: 10_000 },
			{ is: 'refusal', takesMs: 10_000 },
			{ is: 'refusal', takesMs: 10_000 },
			{ is: 'failure', takesMs: 475_000, error: 'Error: the session ended' }
		]);
		const failed = records[0]!;
		expect(Date.parse(failed.respondedAt) - Date.parse(failed.requestedAt), 'the exchange’s times: the span, all of it').toBe(640_000);
		expect(failed.parseOutcome.detail).toContain(
			'The reviewing tool’s call failed after 475000 ms with no reply, short of the tool’s 480000 ms bound, so it is run once ' +
				'more (REG-D-102). Before this, the call met 3 free-tier refusals: 30000 ms of refused attempts and 135000 ms of waits, ' +
				'each refusal waited out and the same call made again: all left out of the time shown here (D46).'
		);
		expect(failed.parseOutcome.detail, 'no timeout').not.toContain('a timeout');
	});
});
