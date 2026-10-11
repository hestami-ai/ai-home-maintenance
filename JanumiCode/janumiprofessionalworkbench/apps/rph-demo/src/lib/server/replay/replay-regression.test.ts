// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-D-111` (5); `REG-F-530`) — THE REPLAY REGRESSION, ON A
// SMALL RECORDING MADE HERE: §3.2's PWA published, its Undertaking created, the root begun and ONE phase — Requirements —
// run through the Undertaking page's own actions, in test mode, with `JPWB_REPLAY` set and PATH emptied.
//
// ⭑ HOW THE RECORDING IS MADE, AND WHY THAT IS NOT CIRCULAR: the first pass stands in for the paid run. Its "models" are
// a scripted double of the replay (`paidRun`, below) that answers by order, checks nothing, and records what the product
// sent — the turn text and every reviewer prompt, scrubbed — and grades its replies `PROVIDER_REPORTED`, as a live tool
// does. Its matrix is the run report's over the stores it left (`observedMatrix`). The recording is then made of what the
// first pass SENT and SERVED, hashed, as the recorder makes one of a paid run's archive; and the second pass replays it
// with the product's REAL replay (`replay-run.ts`), whose every call is checked.
//
// ⭑ WHAT MUST HOLD (D3):
//   · the replay reproduces the recorded matrix — and the matrix is not vacuous: the phase ran, was reviewed, and its
//     floor passed ("as intended" in stages 3, 4, 5a and 8), so two broken runs agreeing would not pass;
//   · no exchange is graded PROVIDER_REPORTED — and the check discriminates: the first pass's are, and it names them;
//   · no program is spawned — `child_process` is counted here, and PATH names an empty folder;
//   · the whole recording is served;
//   · ⛔ a stale recording fails it: REPLAY_STALE, and the matrix moves.
// ⛔ HERMETIC. No model is called and nothing runs: every program start throws and is counted.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** Every program start anything here asked for, and the double standing in for the paid run, when one does. */
const seam = vi.hoisted(() => ({ spawned: [] as string[], paid: undefined as unknown }));

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	const refuse =
		(name: string) =>
		(...args: unknown[]) => {
			seam.spawned.push(`${name} ${String(args[0])}`);
			throw new Error('hermetic: a replay starts no program');
		};
	return {
		...actual,
		spawn: refuse('spawn'),
		spawnSync: refuse('spawnSync'),
		execFile: refuse('execFile'),
		execFileSync: refuse('execFileSync'),
		exec: refuse('exec'),
		execSync: refuse('execSync'),
		fork: refuse('fork')
	};
});

// ⭑ The paid run's double, when a pass asks for it; else the product's own replay, untouched.
vi.mock('./replay-run.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./replay-run.js')>();
	return {
		...actual,
		replayRunFor: (dir: string) =>
			(seam.paid as ReturnType<typeof actual.replayRunFor> | undefined) ?? actual.replayRunFor(dir)
	};
});

import { listByType, listPwus } from '@janumipwb/rph-engine';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	PHASE7_PWA,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT,
	promptMarkers
} from '../../../../../../scripts/phase7/pwa-content.js';
import { workspaceTreeSha256 } from '../../../../../../scripts/phase7/node-tests.js';
import {
	observedMatrix,
	replayRegressionProblems,
	type ReplayObservation
} from '../../../../../../scripts/phase7/replay-regression.js';
import type { ArchiveFacts, LaneRows } from '../../../../../../scripts/phase7/run-report-core.js';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { actionEvent } from '../execution/begin-execute.testing.js';
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import {
	expandText,
	RECORDING_FORMAT,
	recordingFiles,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	type ExecutorTry,
	type RecordedCell,
	type RecordedCommand,
	type Recording,
	type ReviewerCall,
	type ScrubPair
} from './recording.js';
import { forgetReplayRuns, REPLAY_ROOT_NAME, replayRunFor, type ReplayRun } from './replay-run.js';
import { inMemoryStoreRows } from './replay-store-rows.testing.js';

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};
const EXECUTOR = {
	agentId: 'execution.model-invocation',
	modelId: 'fixture-executor-model',
	providerId: 'fixture-provider'
};
const REVIEWER = { agentId: 'devin', modelId: 'fixture-reviewer-model', providerId: 'devin' };
const DOC = '# wordfreq requirements\n\n1. It prints the N most frequent words.\n';
const CHECK = [
	'node',
	'-e',
	"console.log(require('fs').readFileSync('docs/requirements.md','utf8').length)"
];
/** The executor's answer: the execution contract's envelope, its work product the shape the output contract asks. */
const ANSWER = JSON.stringify({
	workProduct: {
		documents: [{ path: 'docs/requirements.md', text: DOC }],
		files: [],
		hashes: [{ path: 'docs/requirements.md', sha256: sha256Hex(DOC) }],
		commands: [{ command: CHECK.join(' '), exitCode: 0 }]
	},
	rationale: {
		rationale: 'The requirements are written and their file checked.',
		assumptions: [],
		limitations: [],
		residualUncertainty: []
	}
});
/** The paid run's one executor try, before its turn's hash is known. */
const TRY: Omit<ExecutorTry, 'turnSha256'> = {
	unit: 'requirements',
	toolCalls: [
		{
			name: 'write_file',
			arguments: { path: 'docs/requirements.md', contents: DOC },
			outcome: 'COMPLETED'
		},
		{ name: 'run_command', arguments: { argv: CHECK }, outcome: 'COMPLETED' }
	],
	answer: { arrived: true, text: ANSWER },
	producer: EXECUTOR
};
const RUN: RecordedCommand = {
	argv: CHECK,
	ran: true,
	exitCode: 0,
	timedOut: false,
	durationMs: 37,
	outputComplete: true,
	omissions: [],
	stdout: `${Buffer.byteLength(DOC)}\n`,
	stderr: ''
};

/** A clean judgement over every criterion the prompt names — what a reviewer answers that judged and faulted nothing. */
function cleanJudgementOf(prompt: string): string {
	const ids = [...new Set(prompt.match(/\b[A-Z]{2,4}-\d{2}-[a-z0-9-]+\b/g) ?? [])];
	return JSON.stringify({
		findings: ids.map((criterionId) => ({
			criterionId,
			failed: false,
			statement: 'evaluated; the failure class is absent'
		})),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
}

/**
 * ⭑ THE PAID RUN'S DOUBLE: the replay's interface, answering by order, checking nothing, recording what it was sent —
 * scrubbed, as the recorder reads a paid run's archive — and grading its replies PROVIDER_REPORTED, as a live tool does.
 */
function paidRun(
	root: string
): ReplayRun & { readonly turns: string[]; readonly calls: ReviewerCall[] } {
	let pairs: readonly ScrubPair[] = [];
	let ms = Date.parse('2026-10-11T08:00:00.000Z');
	const turns: string[] = [];
	const calls: ReviewerCall[] = [];
	let served = { executor: 0, commands: 0, reviewer: 0 };
	const scrub = (t: string) => scrubText(t, pairs);
	const expand = (t: string) => expandText(t, pairs);
	const expandValue = (v: unknown): unknown =>
		typeof v === 'string'
			? expand(v)
			: Array.isArray(v)
				? v.map(expandValue)
				: v && typeof v === 'object'
					? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expandValue(x)]))
					: v;
	const run = {
		turns,
		calls,
		// ⭑ Only its manifest is read (the reviewer's identity and bound, `replayReviewer`): the double serves its own script.
		recording: {
			manifest: {
				format: RECORDING_FORMAT,
				commit: '',
				reviewerFingerprint: '',
				pwaContentDigest: '',
				models: { executor: EXECUTOR, reviewer: { ...REVIEWER, callBoundMs: 240_000 } },
				scrub: { tokens: [...SCRUB_TOKENS] },
				expectedMatrix: []
			},
			executor: [],
			commands: [],
			reviewer: []
		} satisfies Recording,
		root: () => root,
		useSandbox: (p: { workspace: string; processOutput: string }) => {
			pairs = scrubPairs({ WORKSPACE: p.workspace, PROCESS_OUTPUT: p.processOutput });
		},
		scrub,
		expand,
		expandArguments: (v: Readonly<Record<string, unknown>>) =>
			expandValue(v) as Record<string, unknown>,
		stale: () => {
			throw new Error('the paid run does not go stale');
		},
		consumed: () => served,
		poisonedBy: () => undefined,
		clock: () => new Date(ms).toISOString(),
		nextExecutorTry(text: string) {
			turns.push(scrub(text));
			served = { ...served, executor: served.executor + 1 };
			return { ...TRY, turnSha256: sha256Hex(scrub(text)) };
		},
		nextCommand() {
			served = { ...served, commands: served.commands + 1 };
			return { recorded: RUN };
		},
		async reviewerPrint(prompt: string): Promise<ToolInvocationResult> {
			const text = cleanJudgementOf(prompt);
			ms += 1_000;
			served = { ...served, reviewer: served.reviewer + 1 };
			calls.push({
				unit: 'requirements',
				framing: calls.length === 0 ? 'work-product' : 'command',
				role: 'initial',
				promptSha256: sha256Hex(scrub(prompt)),
				prompt: scrub(prompt),
				reply: { status: 'ANSWERED', text },
				evaluator: REVIEWER,
				elapsedMs: 1_000
			});
			return {
				answer: { arrived: true, text },
				rawOutput: text,
				producer: REVIEWER,
				identityEvidence: 'PROVIDER_REPORTED',
				observedToolCalls: { canObserve: false, reason: 'the paid run’s double' }
			};
		}
	};
	return run as unknown as ReplayRun & { readonly turns: string[]; readonly calls: ReviewerCall[] };
}

/** §3.2's PWA, as the designer stores it, published — the arrangement `phase7-run-report.store.test.ts` makes. */
function publishThePwa(): string {
	const pwaId = mintUiId('pwa');
	const typeIds = new Map<string, string>();
	const steps: [string, string, string, Record<string, unknown>][] = [
		[
			'CreatePwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{
				pwaId,
				name: PHASE7_PWA.name,
				description: 'The run’s PWA.',
				domain: PHASE7_PWA.domain,
				version: '0.1.0'
			}
		]
	];
	for (const t of PHASE7_PWA.types) {
		const id = mintUiId('pwut');
		typeIds.set(t.name, id);
		const children = (t.children ?? []).map((name) => typeIds.get(name)!);
		steps.push([
			'DefinePwuType',
			'PWU_TYPE',
			id,
			{
				pwuTypeId: id,
				pwaId,
				pwuKind: t.pwuKind,
				name: t.name,
				purpose: t.purpose,
				isRoot: t.isRoot === true,
				permittedChildTypeIds: children,
				permittedChildren: children.map((typeId) => ({ typeId, cardinality: 'M1' })),
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [...t.policyIds],
				executionBoundary: 'INTERNAL',
				...(t.prompt
					? {
							promptTemplate: {
								templateText: t.prompt,
								templateVersion: 1,
								declaredPlaceholders: promptMarkers(t.prompt),
								...(t.outputContract ? { outputContract: t.outputContract } : {}),
								status: 'ACTIVE'
							}
						}
					: {}),
				workDischarge: t.workDischarge
			}
		]);
	}
	steps.push(
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		[
			'PublishPwa',
			'PROFESSIONAL_WORK_ARCHITECTURE',
			pwaId,
			{ rootPwuTypeId: typeIds.get(PHASE7_ROOT.name) }
		]
	);
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	return pwaId;
}

/** A page action's answer as the lane keeps it: its envelope type. */
const envelopeOf = (r: unknown): 'success' | 'failure' => {
	const failure = r as { status?: number } | undefined;
	return typeof failure?.status === 'number' && failure.status >= 400 ? 'failure' : 'success';
};

/** What an archive taken now would hold of the run's workspace and its captures (`run-archive.ts`), as facts. */
function archiveFacts(name: string, root: string): ArchiveFacts {
	const workspaces = existsSync(root) ? readdirSync(root).filter((n) => !n.includes('.')) : [];
	const workspace = workspaces[0] === undefined ? null : join(root, workspaces[0]);
	const captures = workspace === null ? null : join(`${workspace}.process-output`, 'captures');
	return {
		name,
		workspaceTree: workspace === null ? null : workspaceTreeSha256(workspace),
		captures:
			captures !== null && existsSync(captures)
				? readdirSync(captures).sort()
				: workspace === null
					? null
					: [],
		processOutputRecorded: workspace !== null
	};
}

/**
 * ⭐ THE LANE, IN REPLAY MODE, IN PROCESS: the PWA published, the Undertaking created, the root begun, then Requirements —
 * each press through the page's own action — and the lane's own record of it, as `phase7.live.ts` keeps one.
 */
async function laneRun(root: string): Promise<LaneRows> {
	resetEngine('empty');
	const pwaId = publishThePwa();
	const created = (await undertakings.create(
		actionEvent('create', {
			name: 'wordfreq realization',
			pwaId,
			product: 'wordfreq',
			...RISK
		}) as never
	)) as { created?: string };
	expect(created.created, 'arrangement: the Undertaking').toBeDefined();
	const unitIds = new Map(
		listPwus(getEngine(), created.created!).map((p) => [String(p.state.title), p.id])
	);
	const units = [
		{ order: 1, slug: 'root', title: PHASE7_ROOT.name, archive: '01-root' },
		{ order: 2, slug: 'requirements', title: PHASE7_REQUIREMENTS.name, archive: '02-requirements' }
	];
	const archives: ArchiveFacts[] = [];
	const runUnits: Record<string, unknown>[] = [];
	for (const u of units) {
		const unitId = unitIds.get(u.title)!;
		const envelopeType = envelopeOf(
			await actions.beginExecute(actionEvent('beginExecute', { pwuId: unitId }))
		);
		archives.push(archiveFacts(u.archive, root));
		runUnits.push({
			...u,
			unitId,
			beginExecute: { status: 200, envelopeType },
			stopped: envelopeType !== 'success',
			signOff: null
		});
	}
	archives.push(archiveFacts('06-final', root));
	return {
		run: { mode: 'replay', units: runUnits, end: { reason: 'complete' } },
		boot: { mode: 'replay', overlay: { JPWB_DEMO_DB: root.slice(0, -'.workspaces'.length) } },
		posts: [],
		actions: [],
		archives,
		archiveRead: '06-final',
		problems: []
	};
}

/** What the regression observes of a pass: the matrix over the stores it left, its exchanges, its program starts. */
async function observe(lane: LaneRows, run: ReplayRun): Promise<ReplayObservation> {
	const poisoned = run.poisonedBy();
	return {
		matrix: observedMatrix(await inMemoryStoreRows(), lane),
		exchanges: listByType(getEngine(), 'MODEL_EXCHANGE').map((x) => ({
			id: x.id,
			modelEvidence:
				String((x.state.resolvedModel as { evidence?: unknown } | undefined)?.evidence ?? '') ||
				null,
			providerEvidence:
				String((x.state.resolvedProvider as { evidence?: unknown } | undefined)?.evidence ?? '') ||
				null
		})),
		spawned: seam.spawned.length,
		consumed: run.consumed(),
		...(poisoned ? { poisonedBy: poisoned.message } : {})
	};
}

const made: string[] = [];
const saved = { path: process.env.PATH, replay: process.env.JPWB_REPLAY };
const freshRoot = (): string => {
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-regression-'));
	made.push(dir);
	const root = join(dir, REPLAY_ROOT_NAME);
	mkdirSync(root);
	return root;
};
const recordingDir = (recording: Recording): string => {
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-recording-'));
	made.push(dir);
	for (const [file, text] of Object.entries(recordingFiles(recording)))
		writeFileSync(join(dir, file), text);
	return dir;
};

/** The first pass — the paid run — and the recording made of it. */
const recorded = {
	recording: undefined as unknown as Recording,
	observation: undefined as unknown as ReplayObservation
};

beforeAll(async () => {
	process.env.PATH = noProgramsDirectory();
	const root = freshRoot();
	const paid = paidRun(root);
	seam.paid = paid;
	process.env.JPWB_REPLAY = join(root, 'the-paid-run-reads-no-recording');
	try {
		const lane = await laneRun(root);
		recorded.observation = await observe(lane, paid);
		expect(paid.turns, 'arrangement: the paid run took one executor turn').toHaveLength(1);
		recorded.recording = {
			manifest: {
				format: RECORDING_FORMAT,
				commit: 'fixture-commit',
				reviewerFingerprint: 'fixture-fingerprint',
				pwaContentDigest: 'fixture-digest',
				models: { executor: EXECUTOR, reviewer: { ...REVIEWER, callBoundMs: 240_000 } },
				scrub: { tokens: [...SCRUB_TOKENS] },
				expectedMatrix: recorded.observation.matrix
			},
			executor: [{ ...TRY, turnSha256: sha256Hex(paid.turns[0]!) }],
			commands: [RUN],
			reviewer: paid.calls
		};
	} finally {
		seam.paid = undefined;
	}
});

afterAll(() => {
	forgetReplayRuns();
	for (const [k, v] of [
		['PATH', saved.path],
		['JPWB_REPLAY', saved.replay]
	] as const)
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	for (const dir of made)
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

/** A replay pass over `recording`: the lane driven with JPWB_REPLAY naming it, and what the regression observes. */
async function replayPass(recording: Recording): Promise<ReplayObservation> {
	forgetReplayRuns();
	seam.spawned.length = 0;
	const dir = recordingDir(recording);
	process.env.JPWB_REPLAY = dir;
	const run = replayRunFor(dir);
	// ⭑ The replay's own disposable root, under a fresh temporary folder (`disposableRoot`).
	made.push(join(run.root(), '..'));
	const lane = await laneRun(run.root());
	return observe(lane, run);
}

const cell = (cells: readonly RecordedCell[], stage: string, row: string) =>
	cells.find((c) => c.stage === stage && c.row === row)?.value;

describe('⭐ the replay regression (D3) — a recorded run, replayed in process, at no call', () => {
	it('arrangement — the recorded run is not vacuous: Requirements ran, was reviewed, and its floor passed', () => {
		const m = recorded.observation.matrix;
		expect([
			cell(m, '3', 'requirements'),
			cell(m, '4', 'requirements'),
			cell(m, '5a', 'requirements'),
			cell(m, '8', 'requirements')
		]).toEqual(['as intended', 'as intended', 'as intended', 'as intended']);
		expect(
			recorded.recording.reviewer.length,
			'the work product and its one command were each reviewed'
		).toBe(2);
		// ⭑ THE CONTROL: the paid run's exchanges are PROVIDER_REPORTED, and the regression names every one of them.
		const reported = recorded.observation.exchanges.filter(
			(x) => x.modelEvidence === 'PROVIDER_REPORTED'
		);
		expect(reported.length).toBeGreaterThan(0);
		expect(replayRegressionProblems(recorded.recording, recorded.observation)).toEqual(
			reported.map(
				(x) =>
					`exchange ${x.id} is graded PROVIDER_REPORTED, and no provider reported a replayed call`
			)
		);
	});

	it('⭐ the replay reproduces the recorded matrix, grades no exchange PROVIDER_REPORTED, spawns nothing, and serves the whole recording', async () => {
		const observation = await replayPass(recorded.recording);
		expect(replayRegressionProblems(recorded.recording, observation)).toEqual([]);
		expect(observation.consumed).toEqual({ executor: 1, commands: 1, reviewer: 2 });
		expect(seam.spawned).toEqual([]);
	});

	it('the verdict names a program started and a refused replay, each on its own, and nothing else', () => {
		const clean: ReplayObservation = {
			matrix: recorded.recording.manifest.expectedMatrix,
			exchanges: [],
			spawned: 0,
			consumed: { executor: 1, commands: 1, reviewer: 2 }
		};
		expect(replayRegressionProblems(recorded.recording, clean)).toEqual([]);
		expect(replayRegressionProblems(recorded.recording, { ...clean, spawned: 1 })).toEqual([
			'1 program(s) were started: a replay runs none'
		]);
		expect(
			replayRegressionProblems(recorded.recording, { ...clean, poisonedBy: 'REPLAY_STALE: x' })
		).toEqual(['the replay refused: REPLAY_STALE: x']);
	});

	it('⛔ a stale recording fails the regression: REPLAY_STALE, and the matrix moves', async () => {
		const stale: Recording = {
			...recorded.recording,
			reviewer: recorded.recording.reviewer.map((c, i) =>
				i === 0 ? { ...c, promptSha256: sha256Hex(`${c.prompt} (another prompt)`) } : c
			)
		};
		const problems = replayRegressionProblems(stale, await replayPass(stale));
		expect(
			problems.some((p) =>
				p.startsWith(
					'the replay refused: REPLAY_STALE: reviewer call 1 (unit requirements, work-product, initial)'
				)
			)
		).toBe(true);
		// ⭑ The stale review gets no reply, so the phase's review stage breaks and the unit stops: the matrix moves.
		expect(problems).toContain(
			'the matrix: cell 4 requirements is "broke", and the recording expects "as intended"'
		);
		expect(problems).toContain("the replay served 0 of the recording's 2 reviewer calls");
	});
});
