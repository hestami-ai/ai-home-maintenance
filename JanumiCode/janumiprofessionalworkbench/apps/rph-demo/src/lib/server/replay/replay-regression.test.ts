// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-D-111` (5); `REG-F-530`) — THE REPLAY REGRESSION, ON A
// SMALL RECORDING MADE HERE: §3.2's PWA published, its Undertaking created, the root begun and ONE phase — Requirements —
// run through the Undertaking page's own actions, in test mode, with `JPWB_REPLAY` set and PATH emptied.
//
// ⭑ HOW THE RECORDING IS MADE, AND WHY THAT IS NOT CIRCULAR: the first pass stands in for the paid run. Its "models" are
// a scripted double of the replay (`paidRun`, below) that answers by order, checks nothing, and records what the product
// sent — the turn text, the executor's key (finding 1), ⭐ the result it rendered of each tool call (the result key; the
// lead's delegated decision of 2026-10-15, to be registered) and every reviewer prompt, scrubbed — and grades its REVIEWER
// replies `PROVIDER_REPORTED`, as a live tool does. ⭐ ~~and grades its replies `PROVIDER_REPORTED`~~ — THE EXECUTOR ARM
// IS NOT THE DOUBLE'S (the review of E4, finding 12): the double stands behind `replayRunFor`, and the executor's session
// is still the product's REPLAY session (`replay-executor.ts`), which grades every turn HOST_CONFIGURED, in the paid pass
// as in the replay. So the first pass's PROVIDER_REPORTED exchanges are its reviews only, and the regression's limb is
// shown to discriminate on the reviewer arm alone; the executor arm's grade is held by `replay-executor.test.ts` (its
// HOST_CONFIGURED case, and the ledger's E4-M14). Its matrix is the run report's over the stores it left
// (`observedMatrix`). The recording is then made of what the first pass SENT and SERVED, hashed, as the recorder makes
// one of a paid run's archive — ⭐ with the published PWA and its digest read off the pass's store by the product's own
// `recordedPwaOf` and `pwaContentDigest`, and its reviewer calls kept by the recorder's own rule
// (`recordsAsReviewerCall`) — and the second pass replays it with the product's REAL replay (`replay-run.ts`), whose every
// call is checked.
// ⭐ THE REPLAY PASS RE-CREATES THE PUBLISHED PWA FROM THE RECORDING (`REG-D-112` (c); `replay-pwa.ts`), never types it:
// the replay covers the execution half from the published PWA, and a half-B PWA was authored live, by no list a test holds.
//
// ⭑ WHAT MUST HOLD (D3):
//   · the replay reproduces the recorded matrix — and the matrix is not vacuous: the phase ran, was reviewed, and its
//     floor passed ("as intended" in stages 3, 4, 5a and 8), so two broken runs agreeing would not pass;
//   · no exchange is graded PROVIDER_REPORTED — and the check discriminates on the reviewer arm: the first pass's
//     reviews are, and it names them;
//   · no program is spawned — `child_process` is counted here, and PATH names an empty folder;
//   · the whole recording is served;
//   · ⛔ a stale recording fails it: REPLAY_STALE, and the matrix moves;
//   · ⭐ (`REG-D-112` (c)) a recording of a HALF-B run — its PWA reviewed by the authoring floor first — replays without
//     reaching an authoring call (predicted red, observed 2026-10-15 with the recorder's rule removed and this test's
//     own check of it skipped: REPLAY_STALE at "reviewer call 1 (unit requirements, pwa, initial)", the authoring floor's
//     review kept as the first call);
//   · ⭐ (finding 4) a recording ~~of another published PWA~~ ⭐ whose PWA and digest disagree is refused before the
//     first call (predicted red, observed 2026-10-15 with the digest's check removed: it replayed, the digest read by
//     nothing) — ⭑ the check's real scope (the re-review of E4's fix round): the replay re-creates the recording's own
//     PWA, so the digest holds the recording to itself and the re-creation to what the engine stores;
//   · ⭐ (the re-review of E4's fix round) a recording whose author REMOVED a type before publishing replays: the
//     removed type is neither re-created — an orphan `ValidatePwa` refuses — nor digested (predicted red, observed
//     2026-10-15 with the removed type kept: REPLAY_STALE at `ValidatePwa`, "1 orphan(s): Dropped draft").
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

// ⭐ `REG-D-112` (c) — the AUTHORING FLOOR, watched: the half-B pass runs it, and a replay must never reach it.
vi.mock('../floor.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../floor.js')>();
	return { ...actual, runPwaFloor: vi.fn(actual.runPwaFloor) };
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
import { recordsAsReviewerCall } from '../../../../../../scripts/phase7/record-replay-core.js';
import { runPwaFloor } from '../floor.js';
import { recreateRecordedPwa } from './replay-pwa.js';
import type { ExecutorKey } from './replay-run.js';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { actionEvent } from '../execution/begin-execute.testing.js';
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import {
	expandText,
	instructionsSha256,
	osFamilyOf,
	pwaContentDigest,
	RECORDING_FORMAT,
	recordedPwaOf,
	recordingFiles,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	toolDefinitionsSha256,
	type ExecutorTry,
	type RecordedCell,
	type RecordedCommand,
	type RecordedToolCall,
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
/**
 * The paid run's one executor try, before its turn's hash and its key (finding 1) are known — ⭐ and what the product
 * rendered of each call (`resultSha256`), which the paid pass records.
 */
const TRY: Omit<ExecutorTry, 'turnSha256' | 'instructionsSha256' | 'toolsSha256' | 'toolCalls'> & {
	readonly toolCalls: readonly Omit<RecordedToolCall, 'resultSha256'>[];
} = {
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
function paidRun(root: string): ReplayRun & {
	readonly turns: string[];
	readonly keys: { readonly instructionsSha256: string; readonly toolsSha256: string }[];
	readonly results: string[];
	readonly calls: ReviewerCall[];
} {
	let pairs: readonly ScrubPair[] = [];
	let ms = Date.parse('2026-10-11T08:00:00.000Z');
	const turns: string[] = [];
	const keys: { readonly instructionsSha256: string; readonly toolsSha256: string }[] = [];
	/** ⭐ What the product rendered of each tool call, in call order, hashed as the recorder hashes a payload's output. */
	const results: string[] = [];
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
		keys,
		results,
		calls,
		// ⭑ Only its manifest is read (the reviewer's identity and bound, `replayReviewer`): the double serves its own script.
		recording: {
			manifest: {
				format: RECORDING_FORMAT,
				commit: '',
				reviewerFingerprint: '',
				pwaContentDigest: '',
				osFamily: osFamilyOf(),
				pwa: {
					id: '',
					name: '',
					description: '',
					domain: '',
					version: '',
					rootTypeId: '',
					types: [],
					policies: []
				},
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
		// ⭑ The paid run typed its PWA itself: it holds nothing to a recording.
		checkPublishedPwa: () => undefined,
		nextExecutorTry(text: string, key: ExecutorKey) {
			turns.push(scrub(text));
			// ⭐ Finding 1 — what the product gave the executor beside the turn, hashed as the recorder hashes a payload's.
			const hashed = {
				instructionsSha256: instructionsSha256(key.instructions, scrub),
				toolsSha256: toolDefinitionsSha256(key.tools, scrub)
			};
			keys.push(hashed);
			served = { ...served, executor: served.executor + 1 };
			// ⭑ The double's own try keys no result: it records what the product renders instead (`checkToolResult`).
			return {
				...TRY,
				toolCalls: TRY.toolCalls.map((c) => ({ ...c, resultSha256: '' })),
				turnSha256: sha256Hex(scrub(text)),
				...hashed
			};
		},
		// ⭐ What the product rendered of a call, as the model would read it — recorded, as the recorder reads a payload's.
		checkToolResult(_tried: ExecutorTry, _index: number, rendered: string) {
			results.push(sha256Hex(scrub(rendered)));
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
	return run as unknown as ReplayRun & {
		readonly turns: string[];
		readonly keys: { readonly instructionsSha256: string; readonly toolsSha256: string }[];
		readonly results: string[];
		readonly calls: ReviewerCall[];
	};
}

/** §3.2's PWA, as the designer stores it, published — the arrangement `phase7-run-report.store.test.ts` makes. */
async function publishThePwa(
	o: { readonly authoringFloor?: boolean; readonly removedType?: boolean } = {}
): Promise<string> {
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
	// ⭐ (the re-review of E4's fix round) A TYPE THE AUTHOR DEFINED AND THEN REMOVED before submitting, as a live authoring
	// turn may: `RemovePwuType` tombstones it (`status: 'REMOVED'`), the engine's graph no longer counts it, and its row
	// stays in the store the recorder reads.
	if (o.removedType) {
		const dropped = mintUiId('pwut');
		steps.push(
			[
				'DefinePwuType',
				'PWU_TYPE',
				dropped,
				{
					pwuTypeId: dropped,
					pwaId,
					pwuKind: 'REQUIREMENT_DEFINITION',
					name: 'Dropped draft',
					purpose: 'A draft type the author removed before publishing.',
					isRoot: false,
					workDischarge: 'MODEL'
				}
			],
			['RemovePwuType', 'PWU_TYPE', dropped, { pwuTypeId: dropped }]
		);
	}
	for (const [commandType, aggregateType, aggregateId, payload] of steps.splice(0)) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	// ⭐ HALF B's SHAPE (`REG-D-112` (c)): the authoring floor reviews the DRAFT graph before it is submitted, as the
	// authoring route runs it after a turn (`floor.ts`, `runPwaFloor`) — its review a reviewer call of the paid run.
	if (o.authoringFloor)
		await runPwaFloor(pwaId, {
			prompt: 'Author the realization graph of wordfreq.',
			producer: {
				agentId: 'authoring.agent',
				modelId: 'fixture-author-model',
				providerId: 'fixture-provider'
			}
		});
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
async function laneRun(
	root: string,
	o: {
		readonly authoringFloor?: boolean;
		readonly removedType?: boolean;
		readonly replay?: ReplayRun;
	} = {}
): Promise<LaneRows> {
	resetEngine('empty');
	// ⭐ `REG-D-112` (c) — A REPLAY RE-CREATES THE RECORDED PWA, and holds it to the recording before the first call; the
	// paid pass types §3.2's PWA, as half A's lane does.
	const pwaId =
		o.replay === undefined
			? await publishThePwa(o)
			: recreateRecordedPwa(o.replay, {
					dispatch: (commandType, aggregateType, aggregateId, payload) =>
						dispatch(commandType, aggregateType, aggregateId, payload),
					rowsOf: (objectType) => listByType(getEngine(), objectType)
				});
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

/**
 * ⭐ A paid pass's recording, its manifest's PWA and digest read off the pass's store by the product's own functions
 * (`recordedPwaOf`, `pwaContentDigest`), as the recorder reads them off a final archive.
 */
async function recordingOfPass(
	paid: ReturnType<typeof paidRun>,
	matrix: readonly RecordedCell[],
	reviewer: readonly ReviewerCall[]
): Promise<Recording> {
	const objects = (await inMemoryStoreRows()).objects;
	const pwa = recordedPwaOf(objects);
	const digest = pwaContentDigest(objects);
	if (Array.isArray(pwa) || typeof digest !== 'string')
		throw new Error(`arrangement: the paid pass published no one PWA — ${JSON.stringify(pwa)}`);
	expect(paid.results, 'arrangement: the paid pass rendered a result for each of its calls').toHaveLength(
		TRY.toolCalls.length
	);
	return {
		manifest: {
			format: RECORDING_FORMAT,
			commit: 'fixture-commit',
			reviewerFingerprint: 'fixture-fingerprint',
			pwaContentDigest: digest,
			osFamily: osFamilyOf(),
			pwa,
			models: { executor: EXECUTOR, reviewer: { ...REVIEWER, callBoundMs: 240_000 } },
			scrub: { tokens: [...SCRUB_TOKENS] },
			expectedMatrix: matrix
		},
		executor: [
			{
				...TRY,
				// ⭐ Each call keyed by what the paid pass rendered of it — what its model read.
				toolCalls: TRY.toolCalls.map((c, k) => ({ ...c, resultSha256: paid.results[k]! })),
				turnSha256: sha256Hex(paid.turns[0]!),
				...paid.keys[0]!
			}
		],
		commands: [RUN],
		reviewer
	};
}

/** The first pass — the paid run — and the recording made of it. */
const recorded = {
	recording: undefined as unknown as Recording,
	observation: undefined as unknown as ReplayObservation,
	/** ⭐ A HALF-B-SHAPED paid run (`REG-D-112` (c)): the authoring floor reviewed the PWA before the Undertaking. */
	halfB: undefined as unknown as Recording,
	/** ⭐ A paid run whose author REMOVED a type before publishing (the re-review of E4's fix round). */
	removedType: undefined as unknown as Recording
};

/** What the recorder calls a reviewed subject's framing, by its object type (`record-replay-core.ts`, FRAMING). */
const FRAMING: Readonly<Record<string, string>> = {
	ARTIFACT: 'work-product',
	EVIDENCE: 'command',
	PROFESSIONAL_WORK_ARCHITECTURE: 'pwa',
	PROFESSIONAL_WORK_UNIT: 'declared-policy'
};

/**
 * ⭑ A paid pass's reviewer calls AS THE RECORDER KEEPS THEM: each call the double served, paired with the ASSURANCE
 * exchange it was recorded as (in request order, as the recorder reads them), and kept or left out by the recorder's
 * own rule (`recordsAsReviewerCall`).
 */
async function reviewerCallsAsRecorded(paid: {
	readonly calls: ReviewerCall[];
}): Promise<ReviewerCall[]> {
	const rows = (await inMemoryStoreRows()).objects
		.filter((o) => o.objectType === 'MODEL_EXCHANGE' && o.state.plane === 'ASSURANCE')
		.sort(
			(a, b) =>
				Date.parse(String(a.state.requestedAt)) - Date.parse(String(b.state.requestedAt)) ||
				a.firstSequence - b.firstSequence
		);
	expect(rows, 'arrangement: one ASSURANCE exchange per call the double served').toHaveLength(
		paid.calls.length
	);
	return paid.calls
		.map((c, k) => ({
			...c,
			framing: FRAMING[String(rows[k]!.state.subjectObjectType)] ?? c.framing
		}))
		.filter((_, k) => recordsAsReviewerCall(rows[k]!));
}

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
		recorded.recording = await recordingOfPass(
			paid,
			recorded.observation.matrix,
			await reviewerCallsAsRecorded(paid)
		);
		// ⭐ THE HALF-B PASS: the same run, its PWA reviewed by the authoring floor first.
		const rootB = freshRoot();
		const paidB = paidRun(rootB);
		seam.paid = paidB;
		const laneB = await laneRun(rootB, { authoringFloor: true });
		const observedB = await observe(laneB, paidB);
		expect(paidB.turns, 'arrangement: the half-B paid run took one executor turn').toHaveLength(1);
		// ⭐ The review in parts, B3 (`REG-D-125`) — the authoring floor reviews each type of the PWA as a part.
		const typesB = listByType(getEngine(), 'PWU_TYPE').filter((t) => t.state.status !== 'REMOVED').length;
		expect(
			paidB.calls.map((c) => c.prompt.length > 0),
			'arrangement: the half-B pass reviewed each type of the PWA, its work product and its command'
		).toHaveLength(typesB + 2);
		recorded.halfB = await recordingOfPass(
			paidB,
			observedB.matrix,
			await reviewerCallsAsRecorded(paidB)
		);
		// ⭐ THE PASS WHOSE AUTHOR REMOVED A TYPE (the re-review of E4's fix round): the same run, one type defined and removed.
		const rootR = freshRoot();
		const paidR = paidRun(rootR);
		seam.paid = paidR;
		const laneR = await laneRun(rootR, { removedType: true });
		const observedR = await observe(laneR, paidR);
		expect(paidR.turns, 'arrangement: the pass with a removed type took one executor turn').toHaveLength(1);
		expect(
			listByType(getEngine(), 'PWU_TYPE').filter((t) => t.state.status === 'REMOVED'),
			'arrangement: the store the recording is made from holds the removed type'
		).toHaveLength(1);
		recorded.removedType = await recordingOfPass(
			paidR,
			observedR.matrix,
			await reviewerCallsAsRecorded(paidR)
		);
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
	let lane: LaneRows | undefined;
	try {
		lane = await laneRun(run.root(), { replay: run });
	} catch (refused) {
		// ⭑ A refusal of the re-created PWA ends the pass before the Undertaking; the observation says so.
		if (run.poisonedBy() === undefined) throw refused;
	}
	return lane === undefined
		? {
				matrix: [],
				exchanges: [],
				spawned: seam.spawned.length,
				consumed: run.consumed(),
				poisonedBy: run.poisonedBy()!.message
			}
		: observe(lane, run);
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
		// ⭑ THE CONTROL: the paid run's REVIEWER exchanges are PROVIDER_REPORTED — its executor's are not, the executor arm
		// being the product's replay session in both passes (the review of E4, finding 12) — and the regression names every
		// one of them.
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

	it('⭐ REG-D-112 (c) — a recording from a HALF-B run replays without reaching an authoring call', async () => {
		// ⭑ The recorder's rule left the authoring floor's review out: two of the half-B pass's three calls are recorded.
		expect(recorded.halfB.reviewer.map((c) => c.framing)).toEqual(['work-product', 'command']);
		vi.mocked(runPwaFloor).mockClear();
		const observation = await replayPass(recorded.halfB);
		expect(replayRegressionProblems(recorded.halfB, observation)).toEqual([]);
		expect(observation.consumed).toEqual({ executor: 1, commands: 1, reviewer: 2 });
		expect(vi.mocked(runPwaFloor), 'the replay reached the authoring floor').not.toHaveBeenCalled();
		expect(
			listByType(getEngine(), 'MODEL_EXCHANGE').filter(
				(x) => x.state.subjectObjectType === 'PROFESSIONAL_WORK_ARCHITECTURE'
			),
			'the replay recorded a review of the PWA'
		).toEqual([]);
	});

	it('⭐ (the re-review of E4’s fix round) a recording whose author REMOVED a type before publishing replays: the removed type is neither re-created nor digested', async () => {
		const observation = await replayPass(recorded.removedType);
		expect(replayRegressionProblems(recorded.removedType, observation)).toEqual([]);
		expect(observation.consumed).toEqual({ executor: 1, commands: 1, reviewer: 2 });
		expect(
			recorded.removedType.manifest.pwa.types.map((t) => t.declared.name),
			'the recording holds the types the PWA has: the removed one is not among them'
		).toEqual(PHASE7_PWA.types.map((t) => t.name));
	});

	it('⛔ (finding 4) a recording whose PWA and digest disagree is refused before the first call — the digest is read, and the re-created PWA held to it', async () => {
		// ⭑ ITS REAL SCOPE (the re-review of E4's fix round): the replay re-creates the recording's own PWA (`REG-D-112`
		// (c)), so the digest holds the recording to itself — its `pwa` and its digest — and the re-creation to what the
		// engine stores. ~~A recording of another published PWA~~ A genuine recording of another PWA carries that PWA and its
		// digest, and replays. This case changes the digest alone.
		const another: Recording = {
			...recorded.recording,
			manifest: { ...recorded.recording.manifest, pwaContentDigest: sha256Hex('another PWA') }
		};
		const observation = await replayPass(another);
		// ⭐ (the confirm of E4's second fix round) The refusal says what the check catches — never "another PWA".
		expect(observation.poisonedBy ?? '').toMatch(
			/^REPLAY_STALE: the published PWA's content digest is [0-9a-f]{64}, and the recording's is [0-9a-f]{64}: the PWA the replay re-created from the recording \(REG-D-112 \(c\)\) does not digest as the recording says — the recording's own `pwa` and its digest disagree, or the engine stored the re-created PWA otherwise than recorded, in the fields the digest covers\. No try is served to it\.$/
		);
		expect(
			observation.consumed,
			'a call was served before the PWA was held to the recording'
		).toEqual({
			executor: 0,
			commands: 0,
			reviewer: 0
		});
	});

	it('⛔ (REG-D-112 (c)) a host whose policy is not the recorded one is refused BY NAME, before the PWA is re-created', async () => {
		const pwa = recorded.recording.manifest.pwa;
		expect(pwa.types, 'arrangement: §3.2’s five types are recorded').toHaveLength(5);
		expect(pwa.policies.length, 'arrangement: the types name policies').toBeGreaterThan(0);
		const [first, ...rest] = pwa.policies;
		const another: Recording = {
			...recorded.recording,
			manifest: {
				...recorded.recording.manifest,
				pwa: {
					...pwa,
					policies: [{ ...first!, contentSha256: sha256Hex('another policy') }, ...rest]
				}
			}
		};
		const observation = await replayPass(another);
		expect(observation.poisonedBy ?? '').toContain(
			`REPLAY_STALE: the published PWA's policy ${first!.policyId} hashes to ${first!.contentSha256} on this host`
		);
		expect(observation.consumed).toEqual({ executor: 0, commands: 0, reviewer: 0 });
		expect(
			listByType(getEngine(), 'PROFESSIONAL_WORK_ARCHITECTURE'),
			'a PWA was re-created under a policy the recording does not name'
		).toEqual([]);
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
