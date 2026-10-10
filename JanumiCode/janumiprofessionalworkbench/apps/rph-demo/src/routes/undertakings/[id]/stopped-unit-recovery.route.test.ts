// ⭐⭐ `JAN-EXEC` Phase 7, P7-6R, R-1b to R-1d (`docs/_working/DESIGN-the-stopped-unit-recovery.md` RD2-RD8, §7 items 2-4;
// `REG-D-104` (1); `REG-D-105` (3); `REG-F-511`) — A UNIT WHOSE REVIEW REFUSED IT WAITS FOR A PERSON, WHO RE-RUNS ITS REVIEW,
// RE-RUNS ITS WORK WITH THE FINDINGS, OR ABANDONS IT — DRIVEN THROUGH THE UNDERTAKING PAGE'S OWN ACTIONS.
//
// ⭑ WHAT EACH CASE HOLDS, BY THE DESIGN'S NUMBERING:
//   · RD2 — the refusal records the wait: the step WAITING with a reason naming each refusing policy and its disposition,
//     the unit's execution WAITING; and RD6 — each work product names the attempt that made it, `<stepId>#<n>`.
//   · RD3/R-1d — the page offers re-run the review ONLY after a review that did not conclude, and the SERVER refuses it
//     after one that concluded against the work or escalated (`REG-D-105` (3)); re-run the work and abandon always.
//   · RD4 — each choice is a Decision whose authority is the person, a HUMAN actor, and whose rationale they typed.
//   · RD5 — each re-run is a plan revision: A SUPERSEDED, its waiting step CANCELLED, B started, B completed, the unit
//     SUCCEEDED citing B.
//   · RD7 — a re-review runs no producer and rebuilds what the floor needs from the record, refusing — the unit still
//     waiting — when a part does not check.
//   · RD8 — a re-run of the work opens a FRESH session whose first turn holds the instruction AND the subject findings, and
//     carries nothing from a review that did not conclude.
//
// ⭑ THE ARRANGEMENT is `phase7-route.characterization.test.ts`'s, restated because a route test's mocks are its own file's:
// test mode; the executor unconfigured, so the selector answers the declared STAND-IN, whose session is the real one,
// observed (every turn, and every session opened); the reviewer devin, NAMED with a model, its real `devinPrint` handed an
// exec seam that answers — or throws — as the case scripts.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; the stand-in opens no program; no process is started; PATH finds none.
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
	/** Every turn the producer was sent, in order, each with the session it was sent on (1-based). */
	turns: [] as { readonly session: number; readonly text: string }[],
	/** How many producer sessions were opened. */
	sessions: 0,
	/** What the host's process-run observer saw this step — none unless a case says so. */
	observed: undefined as
		| undefined
		| {
				readonly runs: readonly unknown[];
				readonly observedCount: number;
				readonly recordedLimit: number;
		  },
	/** Set, the producing prompt re-renders under this fingerprint: the type's template is not the one that produced it. */
	templateMovedTo: undefined as string | undefined,
	/** ⭐ `P76F-A` A4 — the model devin's export says answered: the configured one unless a case arranges a substitute. */
	reportedModel: 'fixture-assurance-model'
}));

// ⭑ THE REAL `prepareModelInvocation`, its fingerprint moved only when a case says the template moved (RD7's check): the
// types a published PWA declares cannot change, so a moved template is arranged at the one seam that renders it.
vi.mock('@janumipwb/rph-application', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@janumipwb/rph-application')>();
	return {
		...actual,
		prepareModelInvocation: vi.fn((...args: Parameters<typeof actual.prepareModelInvocation>) => {
			const plan = actual.prepareModelInvocation(...args);
			return plan.ready && seam.templateMovedTo !== undefined
				? { ...plan, fingerprint: seam.templateMovedTo }
				: plan;
		})
	};
});

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
			// ⭑ THE REAL SESSION, OBSERVED: each opening counted, and every turn recorded with the session it went to.
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				const n = ++seam.sessions;
				return {
					...session,
					turn: (text: string) => {
						seam.turns.push({ session: n, text });
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
						JSON.stringify({ steps: [{ extra: { generation_model: seam.reportedModel } }] }),
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
import { assurancePreflight } from '../../../lib/server/assurance/preflight.js';
import { RATIONALE_REQUIRED, stoppedUnitOf } from '../../../lib/server/execution/stopped-unit-recovery.js';
import {
	ABANDON_FROM_WAITING_CITATION,
	RERUN_REVIEW_CITATION,
	RERUN_WORK_CITATION
} from '../../../lib/server/execution/recovery-authority.js';
import {
	createProcessRunObserver,
	type ObservedProcessRun
} from '../../../lib/server/tools/process-run-observer.js';
import { getArtifactStore, getEngine, resetEngine, uiSession } from '../../../lib/server/workbench.js';
import { actions, load } from './+page.server.js';

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

/** devin's reply over the seeded criteria — each unfailed, the first failed when `fault` is set — recommending `rec`. */
const reply = (rec: 'SATISFIED' | 'REJECTED' | 'ESCALATED', fault?: string): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
			criterionId: c.id,
			failed: fault !== undefined && i === 0,
			statement: fault !== undefined && i === 0 ? fault : 'evaluated; the failure class is absent'
		})),
		recommendation: rec,
		residualUncertainty: []
	});
/** A review that passes. */
const CLEAN = reply('SATISFIED');
/** A review that CONCLUDED AGAINST THE WORK: the first criterion failed (`REFINE_SUBJECT`). */
const FAULT = 'The work product substitutes an easier problem.';
const REJECTED = reply('REJECTED', FAULT);
/** A clean review whose reviewer recommends ESCALATED: escalated (`REG-D-090` rule (a); `ESCALATE_REVIEW`). */
const ESCALATED = reply('ESCALATED');
/** What devin's program throws when it fails at the transport, with no reply. */
const transportFailure = () => new Error('devin exited with code 1: connection reset by peer');
const FIRST_CRITERION = SEEDED_REASONING_REVIEW_CRITERIA[0]!.id;

const RATIONALE =
	'The reviewer failed at the transport; I want the same work product reviewed again.';

type Result = { readonly advanced?: string; readonly data?: { readonly error?: string } };
const act = async (
	action: 'rerunReview' | 'rerunWork' | 'abandonPwu',
	fields: Readonly<Record<string, string>>
): Promise<Result> => (await actions[action](actionEvent(action, fields) as never)) as Result;

/** Every plan of the unit, in the order proposed, with each step. */
function plansOf(pwuId: string) {
	return listByType(getEngine(), 'EXECUTION_PLAN')
		.filter((p) => p.state.workUnitId === pwuId)
		.map((p) => ({
			id: p.id,
			status: String(p.state.status),
			steps: (p.state.steps as Record<string, unknown>[]).map((s) => ({
				id: String(s.id),
				stepType: String(s.stepType),
				stepState: String(s.stepState),
				runtimeBindingId: s.runtimeBindingId as string | undefined,
				inputBindings: s.inputBindings as { artifactId?: string }[]
			}))
		}));
}

/** The unit's lifecycle and execution axes. */
const axesOf = (pwuId: string): string[] => {
	const u = getObject(getEngine(), pwuId) as Record<string, unknown>;
	return [String(u.workLifecycleState), String(u.executionState)];
};

/** The unit's work products, in the order recorded. */
const workProductsOf = (pwuId: string) =>
	listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.producingPwuId === pwuId);

/** The REPLAN and ABANDON Decisions naming the unit. */
const decisionsOf = (pwuId: string) =>
	listByType(getEngine(), 'DECISION').filter((d) =>
		(d.state.subjectObjectIds as readonly string[]).includes(pwuId)
	);

/** The event payloads of `eventType` on `aggregateId`. */
const payloads = (eventType: string, aggregateId: string): Record<string, unknown>[] =>
	getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === eventType && e.aggregateId === aggregateId)
		.map((e) => e.payload as Record<string, unknown>);

/** The reasoning reviews over a subject, in the order recorded. */
const reviewsOf = (subjectId: string): string[] =>
	listByType(getEngine(), 'ASSURANCE_ASSESSMENT')
		.filter(
			(a) =>
				a.state.assurancePolicyId === 'floor.reasoning-review' &&
				(a.state.subjectObjectIds as readonly string[]).includes(subjectId)
		)
		.map((a) => String(a.state.assessmentState));

/** The page's recovery view of the unit, as `load` returns it. */
async function recoveryShown(pwuId: string) {
	const undertakingId = String(
		(getObject(getEngine(), pwuId) as Record<string, unknown>).undertakingId
	);
	const data = (await load({ params: { id: undertakingId } } as never)) as unknown as {
		readonly recoveryByPwu: Readonly<
			Record<
				string,
				{
					readonly kind: string;
					readonly offers: Record<string, boolean>;
					readonly rerunsWithheld: string | null;
					readonly findings: number;
					readonly reruns: number;
					readonly stepId: string;
				}
			>
		>;
		readonly awaitingChoiceStepIds: readonly string[];
	};
	return { view: data.recoveryByPwu[pwuId], awaiting: data.awaitingChoiceStepIds };
}

/** A unit begun and refused at its floor by what devin scripts — so it WAITS — with its plan, step and work product. */
async function aWaitingUnit(script: readonly (string | Error)[], answer = CLEAN) {
	seam.script.push(...script);
	seam.answer = answer;
	const pwuId = await modelWorkUnit();
	const stopped = await beginExecute(pwuId);
	// Either arm of the refusal: the work product's review, or a command's beside a work product that passed.
	expect(stopped.data?.error ?? '', 'arrangement: the floor did not refuse the completion').toMatch(
		/the assurance floor is (NOT satisfied|satisfied — but the step still did not complete)/
	);
	const [planA] = plansOf(pwuId);
	expect(planA?.steps[0]?.stepState, 'arrangement: the refused step does not wait').toBe('WAITING');
	const art = workProductsOf(pwuId).at(-1)!.id;
	return { pwuId, planA: planA!.id, stepA: planA!.steps[0]!.id, art };
}

/** One command the host ran to completion and retained, exiting 0 — as `phase7-route.characterization.test.ts` builds one. */
const aRun = (n: number): Omit<ObservedProcessRun, 'ordinal'> => ({
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
	stderr: ''
});

/** What the host's REAL observer reports after `runs` complete. */
function observedRuns(runs: readonly Omit<ObservedProcessRun, 'ordinal'>[]) {
	const observer = createProcessRunObserver();
	for (const run of runs) observer.ran(run);
	return observer.observed();
}

/** The page's markup, read as source: what the server's data DOES with a row is decided there. */
const MARKUP = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

/** The `{#if …}` / `{:else if …}` branch a form posting `action` sits in — the last opener before it; one form only. */
function branchOf(action: string): string {
	const at = MARKUP.indexOf(`action="?/${action}"`);
	expect(at, `the page has no form posting ?/${action}`).toBeGreaterThan(-1);
	expect(MARKUP.indexOf(`action="?/${action}"`, at + 1), `two forms post ?/${action}`).toBe(-1);
	const openers = [...MARKUP.slice(0, at).matchAll(/\{(?:#if|:else if) [^}]*\}/g)];
	return openers.at(-1)?.[0] ?? '';
}

// ⚠ Each case drives Begin & Execute and then a recovery act through the route, floors and all: under the full suite's
// load that outlasts vitest's default 5 s, as K5's case in `phase7-route.characterization.test.ts` does.
vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
	resetEngine('reference');
	seam.devin.length = 0;
	seam.script.length = 0;
	seam.answer = CLEAN;
	seam.turns.length = 0;
	seam.sessions = 0;
	seam.observed = undefined;
	seam.templateMovedTo = undefined;
	seam.reportedModel = 'fixture-assurance-model';
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe('⭐ R-1b (RD2, RD6) — the refusal records the wait, and each work product names the attempt that made it', () => {
	it('⛔ the step WAITS with a reason naming each refusing policy and its disposition, the unit’s execution WAITS, and no completion is recorded', async () => {
		const { pwuId, planA, stepA, art } = await aWaitingUnit([
			transportFailure(),
			transportFailure()
		]);
		expect(axesOf(pwuId)).toEqual(['EXECUTING', 'WAITING']);
		expect(payloads('ExecutionStepWaiting', planA).map((p) => p.waitReason)).toEqual([
			`The assurance floor refused the completion — ${art}: floor.reasoning-review=INCONCLUSIVE. The unit waits for a person to choose: re-run the review, re-run the work with the findings, or abandon it (REG-D-104 (1)).`
		]);
		expect(
			payloads('ExecutionStepSucceeded', planA),
			'the refused completion was recorded'
		).toEqual([]);
		// RD6 — the work product names the attempt that made it: the step's first Start.
		expect(getObject(getEngine(), art)?.producingExecutionAttemptId).toBe(`${stepA}#1`);
	});
});

describe('⭐ R-1c — re-run the review (RD4, RD5, RD7): no producer runs, the floors run again over the recorded work product', () => {
	it('⭐ after a review that did not conclude: a Decision REPLAN / RERUN_REVIEW by the person; A superseded and its step cancelled; B, a review step, completes NAMING A’s work product; the unit SUCCEEDS citing B — and can be signed off', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const turns = seam.turns.length;
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result, `the re-review was refused: ${result.data?.error ?? ''}`).toEqual({
			advanced: 'review-rerun'
		});
		// ⛔ NO PRODUCER RAN: no turn, no session — and the reviewer ran once more, over the work product.
		expect(seam.turns, 'a re-review sent the producer a turn').toHaveLength(turns);
		expect(seam.devin, 'the re-review did not call the reviewer once').toHaveLength(calls + 1);
		expect(reviewsOf(k.art)).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		// RD4 — the person's Decision: ⭐ `P76F-A` A3 — its rationale the person's typed text, verbatim, THEN the ruling that
		// authorises the act, since no policy object does (RD4: "cited in the rationale's template … and the record says so").
		const [decision] = decisionsOf(k.pwuId);
		expect(decision?.state).toMatchObject({
			decisionType: 'REPLAN',
			selectedOption: 'RERUN_REVIEW',
			status: 'EFFECTIVE',
			rationale: `${RATIONALE}\n\n${RERUN_REVIEW_CITATION}`,
			authority: { actorId: 'local-professional', actorType: 'HUMAN' },
			subjectObjectIds: [k.pwuId, k.planA, k.art]
		});
		expect((decision!.state.consideredObservationIds as string[]).length).toBeGreaterThan(0);
		// RD5 — the plan revision.
		const [a, b] = plansOf(k.pwuId);
		expect([a?.status, a?.steps[0]?.stepState]).toEqual(['SUPERSEDED', 'CANCELLED']);
		expect(payloads('ExecutionStepCancelled', k.planA)[0]?.reason).toContain(decision!.id);
		expect(b).toMatchObject({ status: 'ACTIVE' });
		expect(b!.steps[0]).toMatchObject({
			stepType: 'ASSURANCE_INVOCATION',
			stepState: 'SUCCEEDED',
			runtimeBindingId: undefined,
			inputBindings: [{ artifactId: k.art, required: true }]
		});
		const done = payloads('ExecutionStepSucceeded', b!.id);
		expect(done.map((p) => p.outputArtifactIds)).toEqual([[k.art]]);
		expect(
			(done[0]!.executionProvenance as { producingExecutionAttemptId?: string })
				.producingExecutionAttemptId
		).toBe(`${k.stepA}#1`);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'SUCCEEDED']);
		// ⭐ THE WAY OUT IS NOW THE ORDINARY ONE: the unit can be assured.
		expect(
			await actions.recordAssurance(actionEvent('recordAssurance', { pwuId: k.pwuId }) as never)
		).toEqual({ advanced: 'assured' });
	});

	it('⛔ the reviewer is asked BEFORE anything is dispatched, as Begin & Execute asks it (`JAN-SELREV` SR-1): one that cannot run refuses the re-review in its own words, nothing is recorded, and the unit still waits', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		// devin named with no model: the selector refuses it (`assurancePreflight`).
		vi.stubEnv('JPWB_ASSURANCE_MODEL', undefined);
		const preflight = assurancePreflight({ testMode: true });
		expect(preflight.ready, 'arrangement: the reviewer can still run').toBe(false);
		const events = getEngine().readAllEvents().length;
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error).toBe(preflight.ready ? '' : preflight.guidance);
		expect(getEngine().readAllEvents().length, 'a refused re-review recorded something').toBe(
			events
		);
		expect(seam.devin).toHaveLength(calls);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'WAITING']);
	});

	it('⛔ RD4 — with no rationale typed, the re-review is refused and nothing is recorded', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const events = getEngine().readAllEvents().length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: '   ' });
		expect(result.data?.error).toBe(RATIONALE_REQUIRED);
		expect(getEngine().readAllEvents().length, 'a refused re-review recorded something').toBe(
			events
		);
		expect(seam.devin).toHaveLength(2);
	});

	it('⛔ REG-D-105 (3) — after a review that CONCLUDED AGAINST THE WORK the server refuses a re-review, runs no reviewer and records nothing', async () => {
		const k = await aWaitingUnit([], REJECTED);
		const events = getEngine().readAllEvents().length;
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error ?? '').toMatch(
			/^Re-running the review refused: the review concluded against the work \(.*floor\.reasoning-review=REJECTED.*\); the floor reads the latest assessment, so a second review of the same work product could clear a reasoned refusal\. Re-run the work with the findings, or abandon the unit \(REG-D-105 \(3\)\)\.$/
		);
		expect(getEngine().readAllEvents().length).toBe(events);
		expect(seam.devin).toHaveLength(calls);
	});

	it('⛔ REG-D-105 (3), REG-F-474 — after an ESCALATED review the server refuses a re-review: an automated reviewer would clear an escalation meant for a person', async () => {
		const k = await aWaitingUnit([], ESCALATED);
		const events = getEngine().readAllEvents().length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error ?? '').toMatch(
			/^Re-running the review refused: the review escalated \(.*floor\.reasoning-review=ESCALATED.*\); a re-review would let an automated reviewer clear an escalation meant for a person \(REG-F-474\)\. Re-run the work, or abandon the unit \(REG-D-105 \(3\)\)\.$/
		);
		expect(getEngine().readAllEvents().length).toBe(events);
	});

	it('⛔ RD7 — a work product whose stored bytes no longer hash to its record is not re-reviewed: refused, nothing recorded, no reviewer called, and the unit still waits', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const key = String(getObject(getEngine(), k.art)?.storageKey);
		const store = getArtifactStore();
		const real = store.get.bind(store);
		vi.spyOn(store, 'get').mockImplementation(async (storageKey: string) =>
			storageKey === key ? '{"tampered":true}' : real(storageKey)
		);
		const events = getEngine().readAllEvents().length;
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error ?? '').toMatch(
			new RegExp(
				`^The review cannot be re-run, and the unit keeps waiting: the work product’s bytes at '${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' hash to sha256:[0-9a-f]{64}, not the sha256:[0-9a-f]{64} its record names\\.$`
			)
		);
		expect(getEngine().readAllEvents().length).toBe(events);
		expect(seam.devin).toHaveLength(calls);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'WAITING']);
	});

	it('⭐ RD6, RD7 — a COMMAND’s review that did not conclude: its run is rebuilt from its evidence and re-reviewed alone, the work product’s concluded review left as it was, and B completes naming both', async () => {
		// The work product's review passes (call 1); the one command's review fails at the transport, and on its retry.
		seam.observed = observedRuns([aRun(1)]);
		const k = await aWaitingUnit([CLEAN, transportFailure(), transportFailure()]);
		const evidence = listByType(getEngine(), 'EVIDENCE').filter(
			(e) =>
				(e.state.contentReference as { producingExecutionAttemptId?: string })
					.producingExecutionAttemptId === `${k.stepA}#1`
		);
		expect(evidence, 'RD6: the command’s evidence does not name its attempt').toHaveLength(1);
		const evd = evidence[0]!.id;
		expect(reviewsOf(evd), 'arrangement: the command’s review concluded').toEqual(['INCONCLUSIVE']);
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result, `the re-review was refused: ${result.data?.error ?? ''}`).toEqual({
			advanced: 'review-rerun'
		});
		expect(
			seam.devin,
			'the re-review did not call the reviewer once, for the command'
		).toHaveLength(calls + 1);
		expect(reviewsOf(evd)).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(reviewsOf(k.art), 'the work product’s concluded review was run again').toEqual([
			'SATISFIED'
		]);
		const [, b] = plansOf(k.pwuId);
		expect(
			payloads('ExecutionStepSucceeded', b!.id).map((p) => [
				p.outputArtifactIds,
				p.proposedEvidenceIds
			])
		).toEqual([[[k.art], [evd]]]);
		expect(decisionsOf(k.pwuId)[0]?.state.subjectObjectIds).toEqual([k.pwuId, k.planA, k.art, evd]);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'SUCCEEDED']);
	});

	it('⛔ RD7 — a template that is not the one that produced the work product: refused, nothing recorded, no reviewer called, and the unit still waits', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const recorded = String(
			listByType(getEngine(), 'MODEL_EXCHANGE').find((x) => x.state.plane === 'EXECUTION')?.state
				.promptTemplateFingerprint
		);
		seam.templateMovedTo = `${recorded}-moved`;
		const events = getEngine().readAllEvents().length;
		const calls = seam.devin.length;
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error ?? '').toMatch(
			new RegExp(
				`^The review cannot be re-run, and the unit keeps waiting: the prompt re-renders under ${recorded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-moved, and exchange \\S+ records ${recorded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: the template is not the one that produced the work product\\.$`
			)
		);
		expect(getEngine().readAllEvents().length).toBe(events);
		expect(seam.devin).toHaveLength(calls);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'WAITING']);
	});

	it('⭐ a re-review refused AGAIN waits on B’s step, and the page counts the re-run and offers the review again', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		seam.script.push(transportFailure(), transportFailure());
		const result = await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE });
		expect(result.data?.error ?? '').toContain('the assurance floor is NOT satisfied');
		const [, b] = plansOf(k.pwuId);
		expect([b?.status, b?.steps[0]?.stepState]).toEqual(['ACTIVE', 'WAITING']);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'WAITING']);
		const { view } = await recoveryShown(k.pwuId);
		expect(view).toMatchObject({
			kind: 'NOT_CONCLUDED',
			offers: { rerunReview: true, rerunWork: true, abandon: true },
			reruns: 1,
			stepId: b!.steps[0]!.id
		});
	});
});

describe('⭐ R-1c — re-run the work (RD5, RD8): a fresh session whose first turn is the instruction and the findings', () => {
	it('⭐ after a review that concluded against the work: a Decision REPLAN / RERUN_WORK; a FRESH session whose FIRST turn holds the instruction AND the subject finding; B’s binding authorized; B’s own work product reviewed clean; the unit SUCCEEDS citing B', async () => {
		const k = await aWaitingUnit([], REJECTED);
		const instruction = seam.turns[0]!.text;
		const sessions = seam.sessions;
		seam.answer = CLEAN;
		const result = await act('rerunWork', { pwuId: k.pwuId, rationale: 'Address the finding.' });
		expect(result, `the re-run was refused: ${result.data?.error ?? ''}`).toEqual({
			advanced: 'work-rerun'
		});
		expect(seam.sessions, 'the re-run did not open a fresh session').toBe(sessions + 1);
		const first = seam.turns.find((t) => t.session === sessions + 1)!;
		expect(
			first.text.startsWith(instruction),
			'the first turn does not open with the instruction'
		).toBe(true);
		expect(first.text).toContain(`- ${FIRST_CRITERION}: ${FAULT}`);
		const [decision] = decisionsOf(k.pwuId);
		expect(decision?.state).toMatchObject({
			decisionType: 'REPLAN',
			selectedOption: 'RERUN_WORK',
			status: 'EFFECTIVE',
			authority: { actorId: 'local-professional', actorType: 'HUMAN' },
			subjectObjectIds: [k.pwuId, k.planA, k.art]
		});
		const [a, b] = plansOf(k.pwuId);
		expect([a?.status, a?.steps[0]?.stepState]).toEqual(['SUPERSEDED', 'CANCELLED']);
		expect(b!.steps[0]).toMatchObject({ stepType: 'MODEL_INVOCATION', stepState: 'SUCCEEDED' });
		const binding = getObject(getEngine(), b!.steps[0]!.runtimeBindingId!) as Record<
			string,
			unknown
		>;
		expect([binding.executionStepId, binding.authorizationStatus]).toEqual([
			b!.steps[0]!.id,
			'AUTHORIZED'
		]);
		const artB = workProductsOf(k.pwuId).at(-1)!;
		expect(artB.id).not.toBe(k.art);
		expect(artB.state.producingExecutionAttemptId).toBe(`${b!.steps[0]!.id}#1`);
		expect(payloads('ExecutionStepSucceeded', b!.id).map((p) => p.outputArtifactIds)).toEqual([
			[artB.id]
		]);
		expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'SUCCEEDED']);
	});

	it('⛔ REG-D-059 — after a review that did not conclude, a re-run of the work carries NOTHING: its first turn is the instruction exactly', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const instruction = seam.turns[0]!.text;
		const sessions = seam.sessions;
		const result = await act('rerunWork', { pwuId: k.pwuId, rationale: 'Try the work again.' });
		expect(result).toEqual({ advanced: 'work-rerun' });
		expect(seam.turns.find((t) => t.session === sessions + 1)?.text).toBe(instruction);
	});

	it('⛔ REG-D-090 — after an ESCALATED review, the escalation is never fed back: the first turn is the instruction exactly', async () => {
		const k = await aWaitingUnit([], ESCALATED);
		const instruction = seam.turns[0]!.text;
		const sessions = seam.sessions;
		seam.answer = CLEAN;
		expect(await act('rerunWork', { pwuId: k.pwuId, rationale: 'Re-run it.' })).toEqual({
			advanced: 'work-rerun'
		});
		const first = seam.turns.find((t) => t.session === sessions + 1)!.text;
		expect(first).toBe(instruction);
		expect(first).not.toContain('REVIEWER_RECOMMENDED_ESCALATION');
	});

	it('⛔ RD4 — with no rationale typed, the re-run of the work is refused, opens no session and records nothing', async () => {
		const k = await aWaitingUnit([], REJECTED);
		const events = getEngine().readAllEvents().length;
		const sessions = seam.sessions;
		expect((await act('rerunWork', { pwuId: k.pwuId, rationale: '' })).data?.error).toBe(
			RATIONALE_REQUIRED
		);
		expect(getEngine().readAllEvents().length).toBe(events);
		expect(seam.sessions).toBe(sessions);
	});
});

describe('⭐ R-1c — abandon from waiting: the existing path, and the waiting step cancelled', () => {
	it('⛔ refused with no rationale; with one, a Decision ABANDON naming the refused plan and work product, the waiting step CANCELLED, and the unit ABANDONED', async () => {
		const k = await aWaitingUnit([transportFailure(), transportFailure()]);
		const events = getEngine().readAllEvents().length;
		expect((await act('abandonPwu', { pwuId: k.pwuId })).data?.error).toBe(
			`Abandonment refused: ${RATIONALE_REQUIRED}`
		);
		expect(getEngine().readAllEvents().length).toBe(events);
		expect(await act('abandonPwu', { pwuId: k.pwuId, reason: 'Not worth another call.' })).toEqual({
			advanced: 'abandoned'
		});
		expect(plansOf(k.pwuId)[0]?.steps[0]?.stepState).toBe('CANCELLED');
		expect(axesOf(k.pwuId)[0]).toBe('ABANDONED');
		const [decision] = decisionsOf(k.pwuId);
		expect(decision?.state).toMatchObject({
			decisionType: 'ABANDON',
			status: 'EFFECTIVE',
			// ⭐ `P76F-A` A3 — the person's words, then the ruling that authorises abandoning a WAITING unit (RD4).
			rationale: `Not worth another call.\n\n${ABANDON_FROM_WAITING_CITATION}`,
			authority: { actorType: 'HUMAN' },
			subjectObjectIds: [k.pwuId, k.planA, k.art]
		});
		expect(payloads('ExecutionStepCancelled', k.planA)[0]?.reason).toContain(decision!.id);
	});
});

// ── ⭐⭐ `P76F-A` A3 (RD4; `REG-D-104` (1); `REG-D-105` (3)) — THE DECISION CITES ITS AUTHORITY, AFTER THE PERSON'S OWN WORDS ──
//
// RD4: *"The authorising policy is the ruling itself, cited in the rationale's template. No policy object exists for a
// person's re-run, and the record says so."* ⛔ The first build recorded the typed text alone, so a Decision of the
// person's re-run named no authority at all, and nothing on the record said none was a policy object.
describe('⭐⭐ P76F-A A3 — each choice’s Decision is the person’s words, verbatim, then the ruling that authorises it (RD4)', () => {
	it('⭐ each act’s citation names its ruling, and says no policy object authorises the person’s choice', () => {
		for (const [act, citation, rulings] of [
			['re-run the review', RERUN_REVIEW_CITATION, ['REG-D-104 (1)', 'REG-D-105 (3)']],
			['re-run the work', RERUN_WORK_CITATION, ['REG-D-104 (1)', 'REG-D-105 (3)']],
			['abandon from waiting', ABANDON_FROM_WAITING_CITATION, ['REG-D-104 (1)']]
		] as const) {
			for (const ruling of rulings) expect(citation, `${act} does not cite ${ruling}`).toContain(ruling);
			expect(citation, `${act} does not say no policy object authorises it`).toMatch(/No policy object authorises/);
			expect(citation, `${act} does not point at RD4`).toContain('RD4');
		}
		// ⛔ One citation per act: a re-run of the work is not authorised by the re-review's reading of `REG-D-105` (3).
		expect(new Set([RERUN_REVIEW_CITATION, RERUN_WORK_CITATION, ABANDON_FROM_WAITING_CITATION]).size).toBe(3);
	});

	it('⛔ the typed text survives VERBATIM — its inner spacing, a tab, quotes and markup-like characters — and the re-run of the work cites ITS ruling', async () => {
		const k = await aWaitingUnit([], REJECTED);
		// ⚠ NO LINE BREAK, and that is the form's, not the server's: the page's field is a single-line input, and a posted
		// form's encoding turns a line break into CR LF before the server reads it (measured: this case first carried one).
		const typed = 'Address the finding — “the easier problem”.  Then: <b>keep</b>\t100% of the tests & the CLI.';
		seam.answer = CLEAN;
		expect(await act('rerunWork', { pwuId: k.pwuId, rationale: typed })).toEqual({ advanced: 'work-rerun' });
		const [decision] = decisionsOf(k.pwuId);
		expect(decision?.state.rationale).toBe(`${typed}\n\n${RERUN_WORK_CITATION}`);
	});

	it('⭑ CONTROL — abandoning a unit that is NOT waiting is the S-1 path as before: its rationale cites nothing it was not given', async () => {
		const pwuId = await modelWorkUnit();
		expect(await act('abandonPwu', { pwuId, reason: 'Not needed after all.' })).toEqual({ advanced: 'abandoned' });
		const [decision] = decisionsOf(pwuId);
		expect(decision?.state.rationale).toBe('Not needed after all.');
	});
});

// ── ⭐⭐ `P76F-A` A4 (RD3; `REG-D-105` (3); `JAN-SELREV` D6, `JAN-SELRES` D7; ASR-13) — A REFUSAL ONLY A DIFFERENT OR
// RE-QUALIFIED REVIEWER CAN FIX OFFERS NEITHER RE-RUN ─────────────────────────────────────────────────────────────────────
//
// ⛔ A review refused because devin reported a SUBSTITUTED model (`REQUALIFY_OR_RESELECT_REVIEWER`), or because it was not
// independent of the producer (`CHANGE_REVIEWER`), was sorted as one that "did not conclude" — so a re-review was offered,
// and the paid lane's rule pressed it: another billed call to the reviewer just refused. The classifier's own guidance for
// the first: *"Retrying or reconfiguring the same selection does not fix this: another call is billed and may be served
// the same way."* A re-run of the WORK is reviewed by that same reviewer too, so neither re-run is offered, and the SERVER
// refuses both: the unit waits for the reviewer to change, or is abandoned.

/** The finding codes recorded on observations about `subjectId`. */
const observationCodesOf = (subjectId: string): string[] =>
	listByType(getEngine(), 'ASSURANCE_OBSERVATION')
		.filter((o) => (o.state.subjectObjectIds as readonly string[] | undefined)?.includes(subjectId))
		.map((o) => String(o.state.findingCode));

/** What the floor's classifier answers each refused subject of the waiting unit with — read as the server reads it. */
const refusalActionsOf = (pwuId: string): string[] => {
	const stopped = stoppedUnitOf(uiSession(), pwuId);
	return stopped.ok ? stopped.unit.refusals.map((r) => r.action) : [];
};

describe('⭐⭐ P76F-A A4 — a refusal only a different or re-qualified reviewer can fix: Abandon alone is offered, and the server refuses both re-runs', () => {
	const CLASSES = [
		[
			'the reviewing tool reported a SUBSTITUTED model',
			{
				action: 'REQUALIFY_OR_RESELECT_REVIEWER',
				code: 'VALIDATOR_MODEL_SUBSTITUTED',
				arrange: () => {
					seam.reportedModel = 'substituted-model';
				}
			}
		],
		[
			'the review was NOT INDEPENDENT of the producer',
			{
				action: 'CHANGE_REVIEWER',
				code: 'INDEPENDENCE_VIOLATION',
				// The stand-in producer's model is recorded `unresolved` (`executorIdentity`): a reviewer configured — and
				// reported — as that same model is the same model, which DIFFERENT_MODEL refuses.
				arrange: () => {
					vi.stubEnv('JPWB_ASSURANCE_MODEL', 'unresolved');
					seam.reportedModel = 'unresolved';
				}
			}
		]
	] as const;

	it.each(CLASSES)('⛔ %s — the PAGE offers Abandon alone, and says why neither re-run is', async (_label, c) => {
		c.arrange();
		const k = await aWaitingUnit([]);
		expect(observationCodesOf(k.art), 'arrangement: the refusal is not this class’s').toContain(c.code);
		// ⚠ THE CODE ALONE DOES NOT PIN THE CLASS: a validator that failed records INDEPENDENCE_VIOLATION beside its execution
		// failure too (measured: the substitution's own record carries one). The classifier's ACTION is the class.
		expect(refusalActionsOf(k.pwuId), 'arrangement: the classifier does not answer this class’s action').toEqual([c.action]);
		const { view, awaiting } = await recoveryShown(k.pwuId);
		expect(view).toMatchObject({
			kind: 'REVIEWER_MUST_CHANGE',
			offers: { rerunReview: false, rerunWork: false, abandon: true }
		});
		expect(view?.rerunsWithheld, 'the page does not say why').toContain(`(${c.action})`);
		expect(awaiting, 'the waiting step’s own controls are offered').toEqual([k.stepA]);
	});

	it.each(CLASSES)(
		'⛔ %s — the SERVER refuses a re-review AND a re-run of the work, naming why: no reviewer called, no session opened, nothing recorded, the unit still waiting; Abandon still closes it',
		async (_label, c) => {
			c.arrange();
			const k = await aWaitingUnit([]);
			const events = getEngine().readAllEvents().length;
			const calls = seam.devin.length;
			const sessions = seam.sessions;
			const why = (act: string) =>
				new RegExp(
					`^Re-running the ${act} refused: the reviewer must change before anything is re-run \\(.*\\(${c.action}\\)\\)\\. .*re-qualified or re-selected.*abandoned\\.$`
				);
			expect((await act('rerunReview', { pwuId: k.pwuId, rationale: RATIONALE })).data?.error ?? '').toMatch(
				why('review')
			);
			expect((await act('rerunWork', { pwuId: k.pwuId, rationale: 'Try the work again.' })).data?.error ?? '').toMatch(
				why('work')
			);
			expect(getEngine().readAllEvents().length, 'a refused re-run recorded something').toBe(events);
			expect(seam.devin, 'a refused re-run called the reviewer').toHaveLength(calls);
			expect(seam.sessions, 'a refused re-run opened a producer session').toBe(sessions);
			expect(axesOf(k.pwuId)).toEqual(['EXECUTING', 'WAITING']);
			expect(
				await act('abandonPwu', { pwuId: k.pwuId, reason: 'The reviewer must be re-selected first.' })
			).toEqual({ advanced: 'abandoned' });
		}
	);
});

describe('⭐ R-1d (RD3) — what the page offers, by what the refusal was', () => {
	it.each([
		[
			'a review that did not conclude',
			[transportFailure(), transportFailure()],
			CLEAN,
			'NOT_CONCLUDED',
			true,
			0
		],
		['a review that concluded against the work', [], REJECTED, 'CONCLUDED', false, 1],
		['a review that escalated', [], ESCALATED, 'ESCALATED', false, 0]
	] as const)(
		'⭐ RD3 — after %s: what refused it, whether re-run the review is offered, and the findings re-run the work would carry',
		async (_label, script, answer, kind, rerunReview, findings) => {
			const k = await aWaitingUnit([...script], answer);
			const { view, awaiting } = await recoveryShown(k.pwuId);
			expect(view).toMatchObject({
				kind,
				offers: { rerunReview, rerunWork: true, abandon: true },
				findings,
				reruns: 0,
				stepId: k.stepA
			});
			// ⭑ The waiting step's own controls are withheld: Resume and Cancel run nothing (`REG-F-466`).
			expect(awaiting).toEqual([k.stepA]);
		}
	);

	it('⭐ the markup: re-run the review is offered only where the view offers it, re-run the work likewise, both on a WAITING unit’s row, ahead of the sign-off acts', () => {
		expect(branchOf('rerunReview')).toBe('{#if r.offers.rerunReview}');
		expect(branchOf('rerunWork')).toBe('{#if r.offers.rerunWork}');
		const waitingRow = MARKUP.indexOf(
			"{:else if p.workLifecycleState === 'EXECUTING' && data.recoveryByPwu[p.id]}"
		);
		expect(waitingRow, 'the page has no branch for a waiting unit').toBeGreaterThan(-1);
		expect(waitingRow, 'the waiting branch is not ahead of the sign-off acts').toBeLessThan(
			MARKUP.indexOf("{:else if p.workLifecycleState === 'EXECUTING'}")
		);
		expect(MARKUP.indexOf('action="?/rerunReview"')).toBeGreaterThan(waitingRow);
		expect(MARKUP.indexOf('action="?/recordAssurance"')).toBeGreaterThan(
			MARKUP.indexOf("{:else if p.workLifecycleState === 'EXECUTING'}")
		);
		// RD3's first row: a re-run of the work after a review that gave no findings says so.
		expect(MARKUP).toContain('{#if r.findings === 0}');
		// ⭐ `P76F-A` A4: a refusal only a different reviewer can fix says why NEITHER re-run is offered.
		expect(MARKUP).toMatch(/\{#if r\.rerunsWithheld\}\s*<span[^>]*data-testid="recovery-reruns-withheld"/);
		// R-1c: abandoning a waiting unit asks for the person's rationale.
		expect(MARKUP).toMatch(
			/\{#if data\.recoveryByPwu\[p\.id\]\}\s*<input\s+name="reason"[^>]*required/
		);
		// R-1d: a waiting step offers none of its own controls (REG-F-466).
		expect(MARKUP).toContain(
			'{#each data.awaitingChoiceStepIds.includes(s.id) ? [] : s.controlCommands as ctl (ctl)}'
		);
	});
});
