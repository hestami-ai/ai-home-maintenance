// ⭐ `JAN-EXEC` Phase 7 `P7-1a` (`docs/_working/DESIGN-the-live-end-to-end-run.md` §5, §6; `REG-D-102`) — THE ROUTE'S
// BEHAVIOUR WHERE THE LIVE RUN IS PREDICTED TO BREAK, DRIVEN FREE.
//
// ⛔⛔ THESE ARE CHARACTERIZATION TESTS. THEY PIN TODAY'S BEHAVIOUR, DEFECTS INCLUDED, AND THEY ARE NEVER EVIDENCE FOR THE
// RUN'S STAGES 3 TO 5. Each case drives the route the way the measured run will, but with the stand-in executor and a
// scripted reviewer, so what it shows is what the CODE does with a given reply — never what a live model would reply,
// nor whether a phase of the run was carried out as intended. A green here says the break is still where the design
// predicted it; it says nothing for the run's matrix. ⚠ So when a remedy lands, the case that pins the defect it removes
// goes RED — that is the case doing its job — and is restated, in the commit that lands the remedy, to pin the new
// behaviour; each case names the register id it pins so that commit can find it.
//
//   · K1  (`REG-F-511`; `REG-F-520`'s last bullet) — ~~a review that ends INCONCLUSIVE leaves a unit that no page action
//         completes: Begin & Execute is not offered again and refuses if posted, Retry re-queues the step and runs no
//         model and no floor, the assurance acts are refused, a hand-completed step leaves the unit as unassurable as
//         before, and the one way out is Abandon.~~ ⭐ RESTATED WITH P7-6R R-1b (`REG-D-104` (1);
//         `DESIGN-the-stopped-unit-recovery.md` RD2): the refusal now leaves the unit and its step WAITING for a person,
//         no step act is admitted on the waiting step — Fail, Retry, Start and Complete refused by the engine at the step's
//         state, and ⭐ Resume and Cancel, which the engine WOULD admit from WAITING, refused by the server on a step awaiting
//         the person's choice (`P76F-A` A5: until then both were admitted, while this line said none was) — the
//         sign-off acts are refused, and the page offers the person's three choices; Abandon asks for their rationale and
//         cancels the waiting step. The re-runs themselves are held by `stopped-unit-recovery.route.test.ts`.
//   · K2r (`REG-F-520`; `REG-F-489`) — a timed-out command gives a BLOCKING finding and the completion is refused; a
//         reply that stays malformed after its repair is INCONCLUSIVE.
//   · K5  (`REG-F-517`) — 33 completed command runs yield 32 evidence objects, the 33rd is in no record, and the step
//         completes anyway.
//   · P7-2b at the route (`REG-D-102` (2); `REG-F-525`) — a reviewer that throws once and then answers lets the step
//         complete, its two calls recorded. ⭐ The one case here whose CLAIM was false before this landing — the route's
//         half of `assurance/thrown-reviewer-call.test.ts`. ⚠ Run against the validator before it, K1 fails too, at its
//         arrangement, which counts the retry `P7-2b` adds.
//
// ⭑ THE ARRANGEMENT is `execution/begin-execute-escalated-review.test.ts`'s, restated here because a route test's mocks are
// its own file's: test mode; the executor unconfigured, so the selector answers the declared STAND-IN, whose session is
// the real one, observed; the reviewer devin, NAMED with a model, its real `devinPrint` handed an exec seam that answers
// — or throws — as the case scripts, and writes the ATIF export naming the CONFIGURED model; and a case may say what the
// host's process-run observer saw (`processRuns`), which the route then joins as evidence and reviews.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; the agy executor's seam answers the fixture and Pi's opener refuses,
// though the stand-in opens neither; no process is started (a run is a value); PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every call of the devin program, in order. */
	devin: [] as { readonly file: string; readonly args: readonly string[] }[],
	/** What devin's program does on call N (1-based): a string is its stdout, an Error what it throws. */
	script: [] as (string | Error)[],
	/** What devin answers once the script runs out. */
	answer: '',
	/** Every turn the producer was sent, in order. */
	turns: [] as string[],
	/** What the host's process-run observer saw this step — none unless a case says so. */
	observed: undefined as
		| undefined
		| {
				readonly runs: readonly unknown[];
				readonly observedCount: number;
				readonly recordedLimit: number;
		  }
}));

vi.mock('../../../lib/server/execution/model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../lib/server/execution/model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) => {
			const open = actual.getExecutionSession(selection, {
				agyExec: async (_file, args) => ({
					stdout: await actual.deterministicExecutionPrint(args[1] ?? '')
				}),
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			});
			// ⭑ THE REAL SESSION, OBSERVED: every turn is recorded, and `processRuns` reports what the case scripted.
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				return {
					...session,
					turn: (text: string) => {
						seam.turns.push(text);
						return session.turn(text);
					},
					processRuns: () =>
						seam.observed
							? (seam.observed as ReturnType<typeof session.processRuns>)
							: session.processRuns()
				};
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — the CONFIGURED model reported, so no review is refused for
// who answered, and `execFile` is never reached.
vi.mock('../../../lib/server/tools/devin-reviewer.js', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../lib/server/tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.devin.push({ file, args: [...args] });
				const step = seam.script[seam.devin.length - 1];
				if (step instanceof Error) throw step;
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				return { stdout: step ?? seam.answer };
			})
		)
	};
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { getObject, listByType } from '@janumipwb/rph-engine';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../../../lib/server/assurance/no-programs.testing.js';
import {
	actionEvent,
	beginExecute,
	modelWorkUnit
} from '../../../lib/server/execution/begin-execute.testing.js';
import {
	createProcessRunObserver,
	type ObservedProcessRun
} from '../../../lib/server/tools/process-run-observer.js';
import { getArtifactStore, getEngine, resetEngine } from '../../../lib/server/workbench.js';
import { actions, load } from './+page.server.js';

/** D8's live-backend variables — each case sets only what it names. */
const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

/** devin's reply over the seeded criteria, every one answered unfailed and recommending SATISFIED: a review that passes. */
const CLEAN_SATISFIED = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	})),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

/** What devin's program throws when it fails at the transport, with no reply. */
const transportFailure = () => new Error('devin exited with code 1: connection reset by peer');

/** One command the host ran to completion and retained, marked with `n` in its argv and its output. */
const aRun = (
	n: number,
	over: Partial<Omit<ObservedProcessRun, 'ordinal'>> = {}
): Omit<ObservedProcessRun, 'ordinal'> => ({
	argv: ['node', '--test', `run-${n}`],
	exitCode: 0,
	timedOut: false,
	durationMs: 12,
	outputComplete: true,
	omittedRegions: [],
	retention: {
		retained: true,
		workspaceOwnerId: 'und_1',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		stdoutPath: `captures/run-${n}/stdout.txt`,
		stderrPath: `captures/run-${n}/stderr.txt`,
		omittedRegions: [],
		omissionsPath: `captures/run-${n}/omissions.json`
	},
	stdout: `marker-${n}: 12 passed\n`,
	stderr: '',
	...over
});

/** What the host's REAL observer reports after `runs` complete — its own bound applied (`process-run-observer.ts`). */
function observedRuns(runs: readonly Omit<ObservedProcessRun, 'ordinal'>[]) {
	const observer = createProcessRunObserver();
	for (const run of runs) observer.ran(run);
	return observer.observed();
}

/** The page's data for the Undertaking `pwuId` belongs to, as its `load` returns it. */
async function page(pwuId: string) {
	const undertakingId = String(
		(getObject(getEngine(), pwuId) as Record<string, unknown> | undefined)?.undertakingId ?? ''
	);
	expect(undertakingId, 'arrangement: the work unit names no Undertaking').not.toBe('');
	const data = (await load({ params: { id: undertakingId } } as never)) as unknown as {
		readonly pwuList: readonly {
			readonly id: string;
			readonly workLifecycleState: string;
			readonly executionState: string;
			readonly assuranceState: string;
		}[];
		readonly plans: readonly {
			readonly id: string;
			readonly workUnitId: string;
			readonly status: string;
			readonly steps: readonly {
				readonly id: string;
				readonly stepState: string;
				readonly advanceCommands: readonly string[];
			}[];
		}[];
	};
	const row = data.pwuList.find((p) => p.id === pwuId);
	const plan = data.plans.find((p) => p.workUnitId === pwuId);
	expect(row, 'arrangement: the page lists no row for the work unit').toBeDefined();
	expect(plan, 'arrangement: the page shows no plan for the work unit').toBeDefined();
	return { row: row!, plan: plan!, step: plan!.steps[0]! };
}

/** The event types appended since the log held `from` events. */
const appendedSince = (from: number): string[] =>
	getEngine()
		.readAllEvents()
		.slice(from)
		.map((e) => e.eventType);

/** How many objects of `type` the engine holds. */
const countOf = (type: string): number => listByType(getEngine(), type).length;

/**
 * Each floor policy's RECORDED state for the unit's work product — what the record says its review came to, read from the
 * assessment objects rather than inferred from the message the route printed.
 */
function workProductFloor(pwuId: string): Record<string, string> {
	const products = listByType(getEngine(), 'ARTIFACT')
		.filter((a) => a.state.producingPwuId === pwuId)
		.map((a) => a.id);
	return Object.fromEntries(
		listByType(getEngine(), 'ASSURANCE_ASSESSMENT')
			.filter((a) =>
				(a.state.subjectObjectIds as readonly string[] | undefined)?.some((s) =>
					products.includes(s)
				)
			)
			.map((a) => [String(a.state.assurancePolicyId), String(a.state.assessmentState)])
	);
}

/** A work product's floor whose reasoning review ended INCONCLUSIVE, its two deterministic policies satisfied. */
const REVIEW_INCONCLUSIVE = {
	'floor.schema-invariant': 'SATISFIED',
	'floor.identity-provenance': 'SATISFIED',
	'floor.reasoning-review': 'INCONCLUSIVE'
};

/** The page's markup, read as source: what the server's data DOES with a row is decided there. */
const MARKUP = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

/**
 * The `{#if …}` / `{:else if …}` branch a form posting `action` sits in — the last branch opener before it. ⚠ A reading of
 * the template's text, not a render: it holds the one form the page has for `action`, and refuses if there are more.
 */
function branchOf(action: string): string {
	const at = MARKUP.indexOf(`action="?/${action}"`);
	expect(at, `the page has no form posting ?/${action}`).toBeGreaterThan(-1);
	expect(
		MARKUP.indexOf(`action="?/${action}"`, at + 1),
		`the page has two forms posting ?/${action}`
	).toBe(-1);
	const openers = [...MARKUP.slice(0, at).matchAll(/\{(?:#if|:else if) [^}]*\}/g)];
	return openers.at(-1)?.[0] ?? '';
}

beforeEach(() => {
	resetEngine('reference');
	seam.devin.length = 0;
	seam.script.length = 0;
	seam.answer = CLEAN_SATISFIED;
	seam.turns.length = 0;
	seam.observed = undefined;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐ K1 (REG-F-511; R-1, REG-D-104 (1)) — a model-run unit whose review is refused WAITS for a person', () => {
	it('⭐ a review that ends INCONCLUSIVE leaves the unit and its step WAITING: Begin & Execute is not offered again, no step act runs anything, the sign-off acts are refused, and the page offers the person’s choices — Abandon among them, now with their rationale', async () => {
		// The review ends INCONCLUSIVE: devin fails at the transport on its call AND on that call's one retry (`P7-2b`).
		seam.script.push(transportFailure(), transportFailure());
		const pwuId = await modelWorkUnit();

		const stopped = await beginExecute(pwuId);

		expect(
			stopped.data?.error ?? '',
			'arrangement: the review did not fail at the transport'
		).toMatch(
			/^The model ran, its work product was reviewed over 1 try, and the assurance floor is NOT satisfied: VALIDATOR_EXECUTION_FAILED: reasoning-review backing tool invocation failed: devin invocation failed: devin exited with code 1: connection reset by peer /
		);
		expect(stopped.data?.error).toContain('(RETRY_OR_CONFIGURE_REVIEWER)');
		expect(workProductFloor(pwuId), 'arrangement: the review did not end INCONCLUSIVE').toEqual(
			REVIEW_INCONCLUSIVE
		);
		const reviewerCalls = seam.devin.length;
		const turns = seam.turns.length;
		expect(
			[reviewerCalls, turns],
			'arrangement: the call, its retry, and one executor turn'
		).toEqual([2, 1]);

		// ── ⭐ WHAT THE PAGE SHOWS: the unit EXECUTING and WAITING, its step WAITING (R-1b, RD2) ─────────────────────────
		// ⛔ RESTATED WITH R-1b: until then the refusal wrote no event, and this case pinned the unit RUNNING with its step
		// RUNNING, offering Complete and Fail. Its first run against R-1b went red there, as predicted.
		const shown = await page(pwuId);
		expect(shown.row).toMatchObject({
			workLifecycleState: 'EXECUTING',
			executionState: 'WAITING',
			assuranceState: 'UNASSESSED'
		});
		expect(shown.plan.status).toBe('ACTIVE');
		expect(shown.step).toMatchObject({ stepState: 'WAITING', advanceCommands: [] });
		// ⛔ Begin & Execute is offered on a PROPOSED row alone (`+page.svelte`), so it is not offered on this one again.
		// ⭑ MOVED 2026-10-25 (`JAN-EXEC` Phase 7 package M; `REG-D-135` (2), design D3, which names this condition): ~~`{#if
		// p.workLifecycleState === 'PROPOSED'}`~~ — a PROPOSED row is offered it only where the engine would start it
		// (`start.offered`). Still on a PROPOSED row alone, so this EXECUTING one is still not offered it again.
		expect(branchOf('beginExecute')).toBe("{#if p.workLifecycleState === 'PROPOSED' && p.start?.offered}");
		const { id: planId } = shown.plan;
		const { id: stepId } = shown.step;

		// ── POSTED ANYWAY, BEGIN & EXECUTE IS REFUSED AT ITS FIRST COMMAND, AND RUNS NOTHING ───────────────────────────
		const again = await beginExecute(pwuId);
		expect(again.data?.error ?? '').toMatch(
			/^Execution failed: BeginPwuShaping: BeginPwuShaping does not declare EXECUTING as a source state — it claims \[PROPOSED\] for SHAPING\./
		);

		// ── NEITHER ASSURANCE ACT CAN BE RECORDED, AND NO GREEN: a waiting unit's execution cannot hop to SUCCEEDED ───────
		const noHop =
			'ChangePwuState: Illegal transition on PWU.executionState: WAITING -> SUCCEEDED (ILLEGAL_UNDEFINED: transition WAITING -> SUCCEEDED is not in the PWU.executionState matrix)';
		const assured = await actions.recordAssurance(
			actionEvent('recordAssurance', { pwuId }) as never
		);
		expect((assured as { data?: { error?: string } }).data?.error).toBe(
			`Assurance failed: ${noHop}`
		);
		const faulted = await actions.recordBlockingFinding(
			actionEvent('recordBlockingFinding', {
				pwuId,
				statement: 'The review never concluded.'
			}) as never
		);
		expect((faulted as { data?: { error?: string } }).data?.error).toBe(
			`Recording the finding failed: ${noHop}`
		);
		const green = await actions.markSatisfied(actionEvent('markSatisfied', { pwuId }) as never);
		expect((green as { data?: { error?: string } }).data?.error).toBe(
			'No green without assurance: ChangePwuState: ChangePwuState previousState UNDER_ASSURANCE does not match current EXECUTING (stale)'
		);

		// ── ⛔ NO STEP ACT RUNS ANYTHING, AND NONE IS ADMITTED ON A WAITING STEP (`REG-F-466`) ─────────────────────────────
		// Fail needs RUNNING, Retry FAILED, Start QUEUED, Complete RUNNING: each is refused at the step's state, and the
		// record, the executor and the reviewer are as the stop left them.
		const exchanges = countOf('MODEL_EXCHANGE');
		const assessments = countOf('ASSURANCE_ASSESSMENT');
		const from = getEngine().readAllEvents().length;
		const refusedAt = (command: string, needs: string) =>
			`${command} rejected — RPH_ILLEGAL_STATE_TRANSITION: ${command} requires step ${stepId} to be ${needs}, but it is WAITING. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom ${needs}.`;
		for (const [action, command, needs] of [
			['failStep', 'FailExecutionStep', 'RUNNING'],
			['retryStep', 'RetryExecutionStep', 'FAILED'],
			['startStep', 'StartExecutionStep', 'QUEUED'],
			['completeStep', 'CompleteExecutionStep', 'RUNNING']
		] as const) {
			const answered = (await actions[action](
				actionEvent(action, { planId, stepId }) as never
			)) as {
				data?: { error?: string };
			};
			expect(answered.data?.error, `${action} on a WAITING step`).toBe(refusedAt(command, needs));
		}
		// ⭐ `P76F-A` A5 — AND THE TWO ACTS THE ENGINE WOULD ADMIT FROM WAITING are refused by the SERVER, not only withheld by
		// the page: Resume would set the step running with nothing to run it, and Cancel would leave the unit waiting with no
		// step to choose on — either way the unit stays WAITING and its row offers no re-run (`REG-F-466`). ⛔ Until this fix
		// both were admitted (`phase7-run-report.store.test.ts` resumed one, to complete it by hand). Each refusal names the
		// person's three choices.
		for (const [action, verb] of [
			['resolveWaitStep', 'Resuming'],
			['cancelStep', 'Cancelling']
		] as const) {
			const answered = (await actions[action](
				actionEvent(action, { planId, stepId }) as never
			)) as {
				data?: { error?: string };
			};
			expect(answered.data?.error ?? '', `${action} on a step waiting for a person’s choice`).toMatch(
				new RegExp(
					`^${verb} the step refused: step ${stepId} waits for a person’s choice .*re-run the review, re-run the work with the findings, or abandon the unit`
				)
			);
		}
		expect(appendedSince(from), 'a step act recorded something').toEqual([]);
		expect(seam.devin, 'a step action ran the reviewer').toHaveLength(reviewerCalls);
		expect(seam.turns, 'a step action ran the executor').toHaveLength(turns);
		expect(countOf('MODEL_EXCHANGE'), 'a step action recorded a model call').toBe(exchanges);
		expect(countOf('ASSURANCE_ASSESSMENT'), 'a step action ran a floor').toBe(assessments);

		// ── ⭐ THE PERSON'S CHOICES (R-1d, RD3): after a review that did not conclude, all three ─────────────────────────
		const data = (await load({
			params: { id: String(getObject(getEngine(), pwuId)?.undertakingId) }
		} as never)) as unknown as {
			readonly recoveryByPwu: Readonly<
				Record<string, { readonly offers: Record<string, boolean> }>
			>;
		};
		expect(data.recoveryByPwu[pwuId]?.offers).toEqual({
			rerunReview: true,
			rerunWork: true,
			abandon: true
		});

		// ── ABANDON, NOW THE PERSON'S DECISION WITH THEIR RATIONALE — and it cancels the waiting step (R-1c) ─────────────
		const unexplained = (await actions.abandonPwu(
			actionEvent('abandonPwu', { pwuId }) as never
		)) as {
			data?: { error?: string };
		};
		expect(unexplained.data?.error, 'a waiting unit was abandoned with no rationale typed').toMatch(
			/^Abandonment refused: This unit waits for a person’s choice/
		);
		expect(
			await actions.abandonPwu(
				actionEvent('abandonPwu', { pwuId, reason: 'The reviewer is down; stop here.' }) as never
			)
		).toEqual({ advanced: 'abandoned' });
		expect((await page(pwuId)).row.workLifecycleState).toBe('ABANDONED');
		expect((await page(pwuId)).step.stepState).toBe('CANCELLED');
		expect(seam.devin, 'nothing after the stop ran the reviewer').toHaveLength(reviewerCalls);
	}, 60_000);
});

describe('⛔ K2r (REG-F-520, REG-F-489) — what refuses a completion by rule', () => {
	it('⛔ a timed-out command gives a BLOCKING finding on its evidence, and the completion is refused', async () => {
		// The work product's review passes; the one command the host ran was killed at its deadline (`R17`).
		seam.observed = observedRuns([
			aRun(1, { exitCode: null, timedOut: true, durationMs: 120_000 })
		]);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		const evidence = listByType(getEngine(), 'EVIDENCE').filter((e) =>
			String(e.state.scope ?? '').includes(pwuId)
		);
		expect(evidence, 'the timed-out command was not joined as evidence').toHaveLength(1);
		const evidenceId = evidence[0]!.id;
		const blocking = listByType(getEngine(), 'ASSURANCE_OBSERVATION').filter(
			(o) =>
				o.state.findingCode === 'PROCESS_VERDICT_UNOBSERVED' &&
				(o.state.subjectObjectIds as readonly string[] | undefined)?.includes(evidenceId)
		);
		expect(blocking.map((o) => o.state.severity)).toEqual(['BLOCKING']);
		expect(message).toMatch(
			/^The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete — and the command evidence did not pass its own floor: /
		);
		// ⭑ The refusal names the run, its two deterministic observations, then the engine's own refusal of the completion.
		expect(message).toContain(
			`${evidenceId} (["node","--test","run-1"]): SCHEMA_INVALID: Subject failed strict output-contract/schema validation. | PROCESS_VERDICT_UNOBSERVED: Deterministic invariant violated: PROCESS_VERDICT_UNOBSERVED CompleteExecutionStep: CompleteExecutionStep blocked: the de minimis assurance floor is not SATISFIED for result ${evidenceId} at v1`
		);
		expect(message).toContain('(floor.schema-invariant=REJECTED)');
		// ⭐ P7-6R R-1b (RD2): the refused completion leaves its step WAITING for a person, not RUNNING.
		expect((await page(pwuId)).step.stepState, 'the completion was not refused').toBe('WAITING');
		// ⭑ The command was reviewed too: the BLOCKING finding is the deterministic floor's, beside a review that ran.
		expect(seam.devin).toHaveLength(2);
	});

	it('⛔ a reply that stays malformed after its repair is INCONCLUSIVE: two calls, no third, and the completion is refused', async () => {
		seam.script.push('not JSON, and no judgement either', 'still not JSON');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			seam.devin,
			'a malformed reply is repaired once, and a repair is not run again'
		).toHaveLength(2);
		expect(message).toMatch(
			/^The model ran, its work product was reviewed over 1 try, and the assurance floor is NOT satisfied: VALIDATOR_EXECUTION_FAILED: /
		);
		expect(message).toContain('(RETRY_OR_CONFIGURE_REVIEWER)');
		expect(workProductFloor(pwuId), 'the review did not end INCONCLUSIVE').toEqual(
			REVIEW_INCONCLUSIVE
		);
		const review = listByType(getEngine(), 'MODEL_EXCHANGE')
			.filter((m) => m.state.plane === 'ASSURANCE')
			.map((m) => `${String(m.state.exchangeRole)}:${String(m.state.disposition)}`);
		expect(review).toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:REJECTED']);
		// ⭐ P7-6R R-1b (RD2): the refused completion leaves its step WAITING for a person, not RUNNING.
		expect((await page(pwuId)).step.stepState).toBe('WAITING');
	});
});

describe('⛔ K5 (REG-F-517) — a unit’s command runs after its 32nd become no evidence and get no review', () => {
	it('⛔ 33 completed runs yield 32 evidence objects, the 33rd is in no record, and the step completes anyway', async () => {
		seam.observed = observedRuns(Array.from({ length: 33 }, (_, i) => aRun(i + 1)));
		expect(
			[seam.observed.runs.length, seam.observed.observedCount],
			'arrangement: the host’s own observer kept 32 of 33'
		).toEqual([32, 33]);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		// ⛔ THE STEP COMPLETES: nothing in the completion counts the run that was left out.
		expect(result, 'the step did not complete').toEqual({ advanced: 'executed' });
		expect(seam.devin, 'the work product and each KEPT run, reviewed once each').toHaveLength(33);
		const evidence = listByType(getEngine(), 'EVIDENCE').filter((e) =>
			String(e.state.scope ?? '').includes(pwuId)
		);
		expect(
			evidence.map((e) => (e.state.contentReference as { command: readonly string[] }).command[2])
		).toEqual(Array.from({ length: 32 }, (_, i) => `run-${i + 1}`));
		// The record plane: the 32nd run is named in it; the 33rd nowhere, by its command or by its output.
		const events = JSON.stringify(getEngine().readAllEvents());
		expect(events, 'control: the record names the runs it kept').toContain('"run-32"');
		expect(events, 'the 33rd run is named in the record').not.toContain('"run-33"');
		expect(events).not.toContain('marker-33');
		// The content plane: each evidence's bytes are its own run's, and no evidence holds the 33rd.
		const store = getArtifactStore();
		const contents = await Promise.all(
			evidence.map((e) =>
				store.get((e.state.contentReference as { mint: { storageKey: string } }).mint.storageKey)
			)
		);
		expect(contents.map((c, i) => (c ?? '').includes(`marker-${i + 1}:`))).toEqual(
			Array.from({ length: 32 }, () => true)
		);
		expect(contents.some((c) => (c ?? '').includes('marker-33'))).toBe(false);
	}, 60_000);
});

describe('⭐ P7-2b at the route (REG-D-102 (2)) — a reviewer that throws once and then answers lets the step complete', () => {
	it('⛔ devin fails at the transport, is run once more, answers clean: the step completes, and both calls are on the ASSURANCE plane, the retry after the failure', async () => {
		seam.script.push(transportFailure());
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(result, 'one transport failure stopped the unit').toEqual({ advanced: 'executed' });
		expect(seam.devin).toHaveLength(2);
		expect((await page(pwuId)).row).toMatchObject({ executionState: 'SUCCEEDED' });
		expect(workProductFloor(pwuId), 'the review did not conclude on its second call').toEqual({
			'floor.schema-invariant': 'SATISFIED',
			'floor.identity-provenance': 'SATISFIED',
			'floor.reasoning-review': 'SATISFIED'
		});
		const review = listByType(getEngine(), 'MODEL_EXCHANGE').filter(
			(m) => m.state.plane === 'ASSURANCE'
		);
		expect(
			review.map((m) => `${String(m.state.exchangeRole)}:${String(m.state.disposition)}`)
		).toEqual(['INITIAL:NO_RESPONSE', 'RETRY:ACCEPTED']);
		expect(
			review[1]!.state.predecessorExchangeId,
			'the retry does not name the call it repeats'
		).toBe(review[0]!.id);
		expect(review[0]!.state.subjectObjectId).toBe(review[1]!.state.subjectObjectId);
		expect(String((review[0]!.state.parseOutcome as { detail: string }).detail)).toContain(
			'devin invocation failed: devin exited with code 1: connection reset by peer'
		);
	});
});
