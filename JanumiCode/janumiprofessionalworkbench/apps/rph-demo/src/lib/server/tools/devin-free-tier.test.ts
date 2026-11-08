// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D46 — DEVIN'S FREE-TIER REFUSAL AT THE ADAPTER: `devinPrint` waits it out and makes the same
// call again, at most three times (`REG-D-145`; design §11.7; roadmap §9b.5b, Z3 predicted red 2).
// ⛔ MOVED 2026-11-07 from `devin-reviewer.test.ts`, whole, its rows unchanged: EVERY ROW HERE HANDS `devinPrint` ITS WAIT. The
// rows of that file that fail a call hand it none, so a mutant that waits out a failure it must not (`P6X-Z3-M22`) made each of
// them wait the real 45 s three times, past the 60 s test timeout: measured there, it was `INCONCLUSIVE … the run TIMED OUT
// (Error: Test timed out in 60000ms)`, 15 tests failed (2026-11-07), and a hang establishes nothing. Measured here, this file's
// control row reddens instead.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
	DEVIN_FREE_TIER_REFUSAL,
	DEVIN_FREE_TIER_RETRIES,
	DEVIN_FREE_TIER_WAIT_MS,
	devinPrint,
	freeTierRefusalsOf,
	type DevinExec
} from './devin-reviewer.js';
import { isToolInvocationResult } from './backing-tool.js';
import { killedCallOf } from './killed-call.js';

/** What `devinPrint` threw. */
async function thrownBy(p: Promise<unknown>): Promise<unknown> {
	return p.then(
		() => new Error('fixture: devinPrint resolved where it was to throw'),
		(e: unknown) => e
	);
}

afterEach(() => {
	vi.unstubAllEnvs();
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D46 (`REG-D-145`; design §11.7: *"`devinPrint` recognises "free model rate limit", waits
// 45 s and makes the same call again, at most three times. Such a refusal did not reach the model. It is no reviewer call and no
// exchange. State the refusal count in the eventual exchange's tool observation. A fourth refusal fails the call as today."*).
// ⭑ PREDICTED RED, WRITTEN FIRST: devin's free-tier refusal is a failure like any other today — the first one fails the call.
// ⛔ No real wait: the adapter's wait is handed in (`wait`), and each wait it asks for is recorded.
describe('⭐⭐ Z3 (D46) — devin’s free-tier refusal is waited out and the same call made again, at most three times', () => {
	/** A devin that refuses `refusals` times for its free tier, then answers, writing an export that names `model`. */
	const refusingDevin = (refusals: number, model: string | null = 'swe-2-max') => {
		const calls: (readonly string[])[] = [];
		const exec: DevinExec = async (_file, args) => {
			calls.push(args);
			if (calls.length <= refusals)
				throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached, try again later`), {
					code: 1,
					stdout: '',
					stderr: `Error: ${DEVIN_FREE_TIER_REFUSAL} reached, try again later`
				});
			const exportPath = args[args.indexOf('--export') + 1]!;
			await writeFile(exportPath, JSON.stringify({ steps: model === null ? [] : [{ extra: { generation_model: model } }] }));
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		return { calls, exec };
	};
	const waits: number[] = [];
	// ⭐ Z3 (the lead's correction to ruling 3) — the clock the caller times the call by, which each wait passes: devinPrint measures
	// what came before the last attempt on it (`now`), so a row that reads the carrier hands it this one.
	const clock = { ms: 0 };
	const now = () => clock.ms;
	const wait = async (ms: number) => {
		waits.push(ms);
		clock.ms += ms;
	};
	afterEach(() => {
		waits.length = 0;
		clock.ms = 0;
	});

	it('⭑ the rule’s figures: the phrase devin prints, 45 s, three times', () => {
		expect([DEVIN_FREE_TIER_REFUSAL, DEVIN_FREE_TIER_WAIT_MS, DEVIN_FREE_TIER_RETRIES]).toEqual(['free model rate limit', 45_000, 3]);
	});

	it('⭐ three refusals, then an answer: the same call made four times, three waits of 45 s, one answer — the three refusals stated in its tool observation', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const devin = refusingDevin(3);
		const result = await devinPrint('Judge the work product.', devin.exec, wait, now);
		expect(devin.calls, 'the same call, made again').toHaveLength(4);
		expect(new Set(devin.calls.map((a) => JSON.stringify(a))).size, 'each time with the same argv').toBe(1);
		expect(waits).toEqual([45_000, 45_000, 45_000]);
		expect(isToolInvocationResult(result) && result.answer.arrived ? result.answer.text : 'NO ANSWER').toBe('{"findings":[],"recommendation":"SATISFIED"}');
		expect(isToolInvocationResult(result) ? result.observedToolCalls : null).toMatchObject({ canObserve: false });
		// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z3 — the lead's correction to ruling 3): ~~'devin refused this call 3 times
		// for its free tier (“free model rate limit”) before it answered, each refusal waited out for 45 s …'~~ — the statement
		// names the figures the record keeps (`freeTierRefusalsFigures`), so a recording reads them back off it.
		expect(isToolInvocationResult(result) ? (result.observedToolCalls as { reason: string }).reason : '').toContain(
			'devin answered after 3 free-tier refusals: 0 ms of refused attempts and 135000 ms of waits (“free model rate limit”), each refusal waited out for 45 s and the same call made again: no refusal reached the model, and none is a reviewer call (D46).'
		);
		// ~~`{ count: 3, waitedMs: 135_000 }`~~ ⛔ MOVED (Z3 — the correction): and what came before the last attempt, on the clock.
		expect(freeTierRefusalsOf(result)).toEqual({ count: 3, waitedMs: 135_000, beforeLastAttemptMs: 135_000 });
	});

	it('⛔ a fourth refusal fails the call as today: three waits, then the refusal’s own failure', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const devin = refusingDevin(4);
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec, wait, now));
		expect(devin.calls).toHaveLength(4);
		expect(waits, 'no fourth wait').toEqual([45_000, 45_000, 45_000]);
		expect((thrown as Error).message).toBe(
			`devin invocation failed: Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached, try again later`
		);
		// ~~`{ count: 3, waitedMs: 135_000 }`~~ ⛔ MOVED (Z3 — the correction): and what came before the last attempt, on the clock.
		expect(freeTierRefusalsOf(thrown), 'the waits it made, on the failure it throws').toEqual({
			count: 3,
			waitedMs: 135_000,
			beforeLastAttemptMs: 135_000
		});
	});

	it('⭑ CONTROL — any other failure is not waited out: it fails at once, as today', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		let calls = 0;
		const devin: DevinExec = async () => {
			calls += 1;
			throw Object.assign(new Error('Command failed: devin --print\nError: model not available'), { code: 1, stdout: '', stderr: '' });
		};
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin, wait));
		expect([calls, waits]).toEqual([1, []]);
		expect((thrown as Error).message).toBe('devin invocation failed: Command failed: devin --print\nError: model not available');
		expect(freeTierRefusalsOf(thrown)).toBeUndefined();
	});

	// ⭐ Z3, 2026-11-07 — the phrase is read off the failure's message alone (`isFreeTierRefusal`): a call that failed after devin
	// printed a reply quoting it reached the model, and waiting it out would pay for it again.
	it('⭑ CONTROL — a failure whose printed reply only QUOTES the phrase is not waited out: that call reached the model', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		let calls = 0;
		const devin: DevinExec = async () => {
			calls += 1;
			throw Object.assign(new Error('Command failed: devin --print\nError: the session ended'), {
				code: 1,
				stdout: `{"findings":[{"evidence":"devinPrint waits out \\"${DEVIN_FREE_TIER_REFUSAL}\\" three times"}]`,
				stderr: ''
			});
		};
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin, wait));
		expect([calls, waits]).toEqual([1, []]);
		expect(freeTierRefusalsOf(thrown)).toBeUndefined();
	});

	it('⭑ an answer whose export names no model still carries its refusals: the observation states them, the identity stays the host’s', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const devin = refusingDevin(1, null);
		const result = await devinPrint('Judge the work product.', devin.exec, wait);
		expect(isToolInvocationResult(result), 'a report, so the observation has somewhere to be').toBe(true);
		if (!isToolInvocationResult(result)) return;
		expect([result.producer.modelId, result.identityEvidence]).toEqual(['', 'HOST_CONFIGURED']);
		// ~~'devin refused this call 1 time for its free tier'~~ ⛔ MOVED (Z3 — the correction): the statement names its figures.
		expect((result.observedToolCalls as { reason: string }).reason).toContain('devin answered after 1 free-tier refusal: ');
		expect(waits).toEqual([45_000]);
	});

	it('⭑ CONTROL — an answer with no refusal is as today: no wait, no statement of refusals', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const devin = refusingDevin(0);
		const result = await devinPrint('Judge the work product.', devin.exec, wait);
		expect([devin.calls.length, waits]).toEqual([1, []]);
		expect(isToolInvocationResult(result) ? (result.observedToolCalls as { reason: string }).reason : '').not.toContain('refused');
		expect(freeTierRefusalsOf(result)).toBeUndefined();
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S CORRECTION TO RULING 3 (`z3-p1-rulings.md`, "The follow-up hand-back"): a call's
// time is its last attempt's. The refused attempts' own run time is no part of it either (D46: *"It is no reviewer call"*), so
// `devinPrint` measures everything before the last attempt — the refused attempts and their waits together — on the clock its
// callers time the call by, and carries it beside the count (`beforeLastAttemptMs`).
// ⭑ PREDICTED RED, WRITTEN FIRST: the carrier holds the waits alone, and `devinPrint` reads no clock.
describe('⛔ PREDICTED RED (Z3; the lead’s correction to ruling 3) — the refusals carried with all that came before the last attempt', () => {
	it('⛔ three refusals of 10 s each, then an answer: carried, the count, the waits, and the refused attempts with their waits, on the caller’s clock', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const clock = { ms: 0 };
		let attempts = 0;
		const exec: DevinExec = async (_file, args) => {
			attempts += 1;
			if (attempts <= 3) {
				clock.ms += 10_000;
				throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached`), { code: 1, stdout: '' });
			}
			clock.ms += 200_000;
			await writeFile(args[args.indexOf('--export') + 1]!, JSON.stringify({ steps: [{ extra: { generation_model: 'swe-2-max' } }] }));
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		const result = await devinPrint(
			'Judge the work product.',
			exec,
			async (ms) => {
				clock.ms += ms;
			},
			() => clock.ms
		);
		expect(freeTierRefusalsOf(result), '3 × 10 s of refused attempts and 3 × 45 s of waits, before the last attempt began').toEqual({
			count: 3,
			waitedMs: 135_000,
			beforeLastAttemptMs: 165_000
		});
		expect(isToolInvocationResult(result) ? (result.observedToolCalls as { reason: string }).reason : '').toContain(
			'devin answered after 3 free-tier refusals: 30000 ms of refused attempts and 135000 ms of waits'
		);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING ON THE SECOND FOLLOW-UP (`z3-p1-rulings.md`): THE WAITS ARE MEASURED. The
// carrier's waits were the rule's figure (the count × 45 s), and the refused attempts' time the measured total less it, so any
// lateness of the real waits was stated as refused attempts' time. Each wait is measured on the callers' clock, around the wait;
// the observation keeps the rule's "45 s".
// ⭑ PREDICTED RED, WRITTEN FIRST: the waits are the rule's figure.
describe('⛔ PREDICTED RED (Z3; the second follow-up) — the waits measured on the callers’ clock, not the rule’s figure', () => {
	it('⛔ three refusals of 10 s each, each wait 10 ms late, then an answer: 30000 ms of refused attempts and 135030 ms of waits', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const clock = { ms: 0 };
		let attempts = 0;
		const exec: DevinExec = async (_file, args) => {
			attempts += 1;
			if (attempts <= 3) {
				clock.ms += 10_000;
				throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached`), { code: 1, stdout: '' });
			}
			clock.ms += 200_000;
			await writeFile(args[args.indexOf('--export') + 1]!, JSON.stringify({ steps: [{ extra: { generation_model: 'swe-2-max' } }] }));
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		const asked: number[] = [];
		const result = await devinPrint(
			'Judge the work product.',
			exec,
			async (ms) => {
				asked.push(ms);
				clock.ms += ms + 10;
			},
			() => clock.ms
		);
		expect(asked, 'the rule’s wait, asked for each time').toEqual([45_000, 45_000, 45_000]);
		expect(freeTierRefusalsOf(result), 'each wait as long as it took on the clock').toEqual({
			count: 3,
			waitedMs: 135_030,
			beforeLastAttemptMs: 165_030
		});
		const reason = isToolInvocationResult(result) ? (result.observedToolCalls as { reason: string }).reason : '';
		expect(reason).toContain('devin answered after 3 free-tier refusals: 30000 ms of refused attempts and 135030 ms of waits');
		expect(reason, 'the rule’s wait, stated as the rule').toContain('each refusal waited out for 45 s and the same call made again');
	});

	// ⭐ Z3 — FOUND WHILE BUILDING THE ABOVE: devinPrint's own clock (`performance.now()`, its default, the one production uses) reads
	// fractions of a millisecond, and every reader of the figures takes whole ones — the figures' pattern (`FREE_TIER_REFUSALS_FIGURES`),
	// a CALL line's `elapsedMs` (an integer, `scripts/reviewer-qual/record.ts`) and the run report's "failed after N ms". So the carrier
	// is in whole milliseconds, each figure rounded once, at the end: rounding keeps order, so the waits never exceed what came before
	// the last attempt.
	// ⭑ PREDICTED RED, WRITTEN FIRST: the figures are carried as the clock read them.
	it('⛔ on a clock that reads fractions of a millisecond, the figures are carried in whole ones', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const clock = { ms: 0.25 };
		let attempts = 0;
		const exec: DevinExec = async (_file, args) => {
			attempts += 1;
			if (attempts <= 3) {
				clock.ms += 10_000.4;
				throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached`), { code: 1, stdout: '' });
			}
			clock.ms += 200_000.7;
			await writeFile(args[args.indexOf('--export') + 1]!, JSON.stringify({ steps: [{ extra: { generation_model: 'swe-2-max' } }] }));
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		const result = await devinPrint(
			'Judge the work product.',
			exec,
			async (ms) => {
				clock.ms += ms + 0.3;
			},
			() => clock.ms
		);
		// ⭑ 3 × 10 000.4 ms of refused attempts and 3 × 45 000.3 ms of waits: 165 002.1 ms before the last attempt, 135 000.9 of waits.
		expect(freeTierRefusalsOf(result), 'whole milliseconds').toEqual({ count: 3, waitedMs: 135_001, beforeLastAttemptMs: 165_002 });
		expect(isToolInvocationResult(result) ? (result.observedToolCalls as { reason: string }).reason : '').toContain(
			'devin answered after 3 free-tier refusals: 30001 ms of refused attempts and 135001 ms of waits'
		);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S FOLLOW-UP (`z3-p1-rulings.md`): THE SESSION EXPORT IS THE LAST ATTEMPT'S. Every
// attempt is given one export path, read after the loop (the reported model, the session export) and in the catch (the cut, the
// kill), so a refused attempt's export is removed before the same call is made again.
// ⭑ PREDICTED RED, WRITTEN FIRST: nothing removes it, so a refused attempt's export is read as the call's.
describe('⛔ PREDICTED RED (Z3; the lead’s follow-up) — the session export is the last attempt’s', () => {
	/** devin at its exec seam: each attempt writes the export `exports[n]` names (none where `null`), and all but the last are refused. */
	const attempting = (exports: readonly (string | null)[], last: 'answer' | 'kill') => {
		let attempts = 0;
		const exec: DevinExec = async (_file, args) => {
			const written = exports[attempts];
			attempts += 1;
			if (written !== null && written !== undefined) await writeFile(args[args.indexOf('--export') + 1]!, written);
			if (attempts < exports.length)
				throw Object.assign(new Error(`Command failed: devin --print\nError: ${DEVIN_FREE_TIER_REFUSAL} reached`), { code: 1, stdout: '' });
			if (last === 'kill')
				throw Object.assign(new Error('Command failed: devin --print'), { code: null, signal: 'SIGTERM', stdout: '' });
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		return exec;
	};
	const exportNaming = (model: string): string => JSON.stringify({ steps: [{ extra: { generation_model: model } }] });
	const noWait = async () => undefined;

	it('⛔ a refused attempt writes an export, and the last attempt none: the call has none — no model read off it, nothing kept', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const result = await devinPrint('Judge the work product.', attempting([exportNaming('the-refused-attempts-model'), null], 'answer'), noWait);
		expect(isToolInvocationResult(result), 'a report, which states its refusal').toBe(true);
		if (!isToolInvocationResult(result)) return;
		expect([result.producer.modelId, result.identityEvidence], 'no model the call did not report').toEqual(['', 'HOST_CONFIGURED']);
		expect(result.sessionExport, 'no export the call did not write').toBeUndefined();
	});

	it('⛔ and a last attempt killed with no export of its own: the kill’s facts say none was written', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const thrown = await thrownBy(
			devinPrint('Judge the work product.', attempting([exportNaming('the-refused-attempts-model'), null], 'kill'), noWait)
		);
		expect(killedCallOf(thrown)?.exportWritten, 'the refused attempt’s export is not the killed call’s').toBe(false);
	});

	it('⭑ CONTROL — an answer with its own export keeps it, whatever a refused attempt before it wrote', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'swe-2-max');
		const own = exportNaming('swe-2-max');
		const result = await devinPrint('Judge the work product.', attempting([exportNaming('the-refused-attempts-model'), own], 'answer'), noWait);
		expect(isToolInvocationResult(result)).toBe(true);
		if (!isToolInvocationResult(result)) return;
		expect([result.producer.modelId, result.sessionExport]).toEqual(['swe-2-max', own]);
	});
});
