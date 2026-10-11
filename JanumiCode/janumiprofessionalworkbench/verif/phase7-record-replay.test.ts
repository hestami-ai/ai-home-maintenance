// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1, D4; `REG-D-111` (5); `REG-F-530`; `REG-F-536`) — THE
// RECORDER, ON A RUN FOLDER BUILT HERE: a final archive whose stores are written by the product's own driver and turned
// to a rollback journal, as the lane archives them, holding one unit's executor try, its command, and two reviewer calls
// (one that threw, its retry).
//
// ⭑ WHAT MUST HOLD:
//   · it writes a recording that reads back (`readRecording`): the turn hashed over its SCRUBBED text, the tool calls with
//     their arguments and the host's outcomes, the command's capture bytes, the reviewer's calls with their elapsed time —
//     a THROWN reply carrying the tool's own message — and the report's matrix; no path of the run left in it;
//   · ⛔ it refuses, writing nothing, when a file of the recording names the account (`REG-F-536`);
//   · ⛔ it refuses when the recorded writes do not rebuild a unit archive's workspace (`REG-F-530`'s "inferred");
//   · it refuses a run with no final archive; and the bound it records is the validator's own.
// ⛔ It drives the command line under bun, as an operator does: bun:sqlite does not exist under Node.
// No model is called; nothing is read from any real run.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { createSqliteDriver, SCHEMA_SQL } from '@janumipwb/rph-persistence';
import { afterAll, describe, expect, it } from 'vitest';
import { REVIEWER_CALL_BOUND_MS } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { readRecording, sha256Hex } from '../apps/rph-demo/src/lib/server/replay/recording.js';
import {
	buildRecording,
	RECORDED_CALL_BOUND_MS,
	type RecorderInput
} from '../scripts/phase7/record-replay-core.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RECORDER = fileURLToPath(new URL('../scripts/phase7/record-replay.ts', import.meta.url));
/** The account name the command line is told to scan for — one no host's own environment names. */
const ACCOUNT = 'zz-operator';
const made: string[] = [];
afterAll(() => {
	for (const dir of made)
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
const tempDir = (label: string): string => {
	const dir = mkdtempSync(join(tmpdir(), `jpwb-record-${label}-`));
	made.push(dir);
	return dir;
};
const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

const UND = 'und_01RECORDED';
const UNIT = 'pwu_01REQUIREMENTS';
const TURN_HEAD = 'Work unit: Requirements. Write docs/requirements.md, then show it.';
const DOC = '# Requirements\nR1: wordfreq counts words.\n';
const ARGV = [
	'node',
	'-e',
	"console.log(require('fs').readFileSync('docs/requirements.md','utf8'))"
];
const ANSWER = JSON.stringify({
	workProduct: { document: 'docs/requirements.md' },
	rationale: { rationale: 'written' }
});
const REVIEW_PROMPT = 'Judge the requirements of wordfreq. The artifact: docs/requirements.md';
const CLEAN = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":[]}';
const TRANSPORT = 'devin exited with code 1: connection reset by peer';

interface Arranged {
	readonly run: string;
	readonly workspace: string;
	readonly home: string;
}

/**
 * A run folder of one unit. `stdoutTail` is appended to the command's captured stdout (a case puts the account name
 * there); `archivedExtra` is a file the unit archive's workspace holds that no write made.
 */
function arrange(
	o: {
		readonly stdoutTail?: string;
		readonly archivedExtra?: boolean;
		readonly final?: boolean;
	} = {}
): Arranged {
	const run = tempDir('run');
	const home = resolve(run, 'home', 'operator');
	const demoDb = join(run, 'demo.sqlite');
	const workspace = resolve(join(`${demoDb}.workspaces`, `${UND}-${sha(UND).slice(0, 16)}`));
	const stdout = `${DOC}${o.stdoutTail ?? ''}`;
	const content = new Map<string, string>();
	const ref = (bytes: string) => {
		const key = `tnt-local/RETAINED_BY_PARTICIPATION/${sha(bytes)}`;
		content.set(key, bytes);
		return {
			status: 'STORED',
			storageKey: key,
			contentHash: `sha256:${sha(bytes)}`,
			byteSize: Buffer.byteLength(bytes)
		};
	};
	const pending = { status: 'PENDING_CONTENT_PLANE', reason: 'none' };
	// ⭑ Pi's composite: the turn text with the cwd Pi appends (`REG-F-536`), then the calls and their outputs.
	const turnText = `${TURN_HEAD}\nCurrent working directory: ${workspace.replaceAll('\\', '/')}`;
	const composite = {
		model: 'fixture-executor-model',
		input: [
			{ role: 'user', content: [{ type: 'input_text', text: turnText }] },
			{
				type: 'function_call',
				call_id: 'c1',
				name: 'write_file',
				arguments: JSON.stringify({ path: 'docs/requirements.md', contents: DOC })
			},
			{
				type: 'function_call_output',
				call_id: 'c1',
				output: 'Wrote 44 UTF-8 bytes to docs/requirements.md.'
			},
			{
				type: 'function_call',
				call_id: 'c2',
				name: 'run_command',
				arguments: JSON.stringify({ argv: ARGV })
			},
			{
				type: 'function_call_output',
				call_id: 'c2',
				output: `exit 0 in 42ms\n--- stdout ---\n${stdout}\n--- stderr ---\n\n\nStructured result:\n{"exitCode":0,"timedOut":false,"durationMs":42,"outputComplete":true}`
			}
		]
	};
	const exchange = (id: string, state: Record<string, unknown>) => ({
		id,
		objectType: 'MODEL_EXCHANGE',
		state,
		firstSequence: 0
	});
	const objects = [
		{ id: UND, objectType: 'UNDERTAKING', state: { name: 'wordfreq realization' } },
		{
			id: 'pwa_1',
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			state: { publicationStatus: 'PUBLISHED' }
		},
		{
			id: 'pwut_1',
			objectType: 'PWU_TYPE',
			state: { pwaId: 'pwa_1', name: 'Requirements', promptTemplate: { templateText: TURN_HEAD } }
		},
		exchange('mex_try', {
			plane: 'EXECUTION',
			subjectObjectId: UNIT,
			invokerId: 'execution.model-invocation:pwut_1',
			requestedAt: '2026-10-11T08:00:00.000Z',
			respondedAt: '2026-10-11T08:01:00.000Z',
			resolvedModel: { value: 'fixture-executor-model', evidence: 'PROVIDER_REPORTED' },
			resolvedProvider: { value: 'fixture-provider', evidence: 'PROVIDER_REPORTED' },
			materializedInputRef: ref(JSON.stringify(composite)),
			rawOutputBeforeCoercionRef: ref(ANSWER),
			volunteeredReasoningRef: pending,
			observedToolCalls: {
				observation: 'OBSERVED',
				calls: [
					{ ordinal: 1, toolName: 'write_file', outcome: 'COMPLETED' },
					{ ordinal: 2, toolName: 'run_command', outcome: 'COMPLETED' }
				],
				observedCount: 2
			}
		}),
		{
			id: 'evd_1',
			objectType: 'EVIDENCE',
			state: {
				contentReference: {
					command: ARGV,
					exitCode: 0,
					timedOut: false,
					durationMs: 42,
					capture: {
						retained: true,
						stdoutPath: 'captures/cap-1/stdout.txt',
						stderrPath: 'captures/cap-1/stderr.txt'
					}
				}
			}
		},
		// ⭑ The first review call threw short of its bound — its cause printing devin's temp folder under the home folder.
		exchange('mex_review_1', {
			plane: 'ASSURANCE',
			subjectObjectId: 'art_1',
			subjectObjectType: 'ARTIFACT',
			exchangeRole: 'INITIAL',
			disposition: 'NO_RESPONSE',
			requestedAt: '2026-10-11T08:01:00.000Z',
			respondedAt: '2026-10-11T08:02:37.674Z',
			resolvedModel: { value: 'fixture-reviewer-model' },
			resolvedProvider: { value: 'devin' },
			materializedInputRef: ref(REVIEW_PROMPT),
			rawOutputBeforeCoercionRef: pending,
			parseOutcome: {
				outcome: 'NOT_ATTEMPTED',
				detail: `The reviewing tool’s call failed after 97674 ms with no reply, short of the tool’s 240000 ms bound, so it is run once more (REG-D-102). What the tool reported, sanitised: reasoning-review backing tool invocation failed: ${TRANSPORT} --prompt-file ${join(home, 'AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt')}`
			}
		}),
		// ⭑ Its retry answered — the reply kept in two halves, as the reviewer's replies are (`REG-D-057`).
		exchange('mex_review_2', {
			plane: 'ASSURANCE',
			subjectObjectId: 'art_1',
			subjectObjectType: 'ARTIFACT',
			exchangeRole: 'RETRY',
			disposition: 'ACCEPTED',
			requestedAt: '2026-10-11T08:02:37.674Z',
			respondedAt: '2026-10-11T08:03:04.274Z',
			resolvedModel: { value: 'fixture-reviewer-model' },
			resolvedProvider: { value: 'devin' },
			materializedInputRef: ref(REVIEW_PROMPT),
			rawOutputBeforeCoercionRef: pending,
			answerSpanRef: ref(CLEAN),
			volunteeredReasoningRef: ref('\n'),
			omittedRegions: [{ role: 'MODEL_ANSWER', byteSize: Buffer.byteLength(CLEAN), byteOffset: 0 }],
			parseOutcome: { outcome: 'PARSED' }
		}),
		{
			id: 'asa_1',
			objectType: 'ASSURANCE_ASSESSMENT',
			state: {
				assurancePolicyId: 'floor.reasoning-review',
				evaluator: { actorType: 'AGENT', actorId: 'devin' }
			}
		}
	];

	const lane = join(run, 'lane');
	const archives = join(lane, 'archive');
	for (const name of ['02-requirements', ...(o.final === false ? [] : ['06-final'])]) {
		const dir = join(archives, name);
		mkdirSync(join(dir, 'workspace', 'docs'), { recursive: true });
		writeFileSync(join(dir, 'workspace', 'docs', 'requirements.md'), DOC);
		if (o.archivedExtra) writeFileSync(join(dir, 'workspace', 'made-by-a-command.txt'), 'x');
	}
	if (o.final !== false) {
		const final = join(archives, '06-final');
		const db = createSqliteDriver(join(final, 'demo.sqlite'));
		try {
			db.exec(SCHEMA_SQL);
			const now = '2026-10-11T08:00:00.000Z';
			const putObject = db.prepare(
				'INSERT INTO professional_work_objects(id, object_type, aggregate_type, revision, semantic_version, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
			);
			for (const ob of objects)
				putObject.run(
					ob.id,
					ob.objectType,
					ob.objectType,
					1,
					1,
					JSON.stringify(ob.state),
					now,
					now
				);
			db.exec('PRAGMA journal_mode = DELETE');
		} finally {
			db.close();
		}
		const store = new Database(join(final, 'demo.sqlite.content.sqlite'));
		try {
			store.exec(
				'CREATE TABLE artifact_content (storage_key TEXT PRIMARY KEY, content_hash TEXT, byte_size INTEGER, media_type TEXT, purgeability TEXT, purged INTEGER, bytes TEXT)'
			);
			const put = store.prepare('INSERT INTO artifact_content VALUES (?,?,?,?,?,?,?)');
			for (const [key, bytes] of content)
				put.run(
					key,
					`sha256:${sha(bytes)}`,
					Buffer.byteLength(bytes),
					'text/plain',
					'RETAINED_BY_PARTICIPATION',
					0,
					bytes
				);
			store.pragma('journal_mode = DELETE');
		} finally {
			store.close();
		}
		const capture = join(final, 'process-output', 'captures', 'cap-1');
		mkdirSync(capture, { recursive: true });
		writeFileSync(join(capture, 'stdout.txt'), stdout);
		writeFileSync(join(capture, 'stderr.txt'), '');
		writeFileSync(
			join(capture, 'omissions.json'),
			JSON.stringify({ note: 'COMPLETE.', omittedRegions: [] })
		);
	}
	writeFileSync(
		join(lane, 'run.json'),
		JSON.stringify({
			units: [{ order: 2, slug: 'requirements', unitId: UNIT, archive: '02-requirements' }]
		})
	);
	writeFileSync(join(lane, 'boot.json'), JSON.stringify({ overlay: { JPWB_DEMO_DB: demoDb } }));
	mkdirSync(join(lane, 'report'), { recursive: true });
	writeFileSync(
		join(lane, 'report', 'report.json'),
		JSON.stringify({
			matrix: [{ stage: '3', row: 'requirements', value: 'as intended', basis: ['one try'] }]
		})
	);
	return { run, workspace, home };
}

/** The command line's own `main`, run in bun, handed the account name to scan for and the home folder to scrub. */
function record(a: Arranged, out: string): { readonly code: number | null; readonly out: string } {
	const script =
		`const { main } = await import(${JSON.stringify(pathToFileURL(RECORDER).href)});\n` +
		`process.exitCode = main(${JSON.stringify([a.run, out, '--commit', 'fixture-commit', '--fingerprint', 'fixture-fingerprint'])}, ` +
		`(s) => process.stdout.write(s), ${JSON.stringify([ACCOUNT])}, ${JSON.stringify(a.home)});`;
	const r = spawnSync('bun', ['--eval', script], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
	return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('⭐ the recorder (D1) — a final archive into a replay recording, scrubbed, hashed, checked', () => {
	it('writes a recording that reads back, the turn hashed over its scrubbed text and no path of the run left in it', () => {
		const a = arrange();
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.out).toContain('writes replayed through 02-requirements: the workspace tree matches');
		expect(r.code, r.out).toBe(0);
		const recording = readRecording(out);
		expect(recording.manifest).toMatchObject({
			commit: 'fixture-commit',
			reviewerFingerprint: 'fixture-fingerprint',
			models: {
				executor: {
					agentId: 'execution.model-invocation',
					modelId: 'fixture-executor-model',
					providerId: 'fixture-provider'
				},
				reviewer: {
					agentId: 'devin',
					modelId: 'fixture-reviewer-model',
					providerId: 'devin',
					callBoundMs: 240_000
				}
			},
			expectedMatrix: [{ stage: '3', row: 'requirements', value: 'as intended' }]
		});
		const [tried] = recording.executor;
		// ⭐ Hashed over the SCRUBBED text: the cwd Pi printed is the workspace token, so a replay elsewhere compares equal.
		expect(tried!.turnSha256).toBe(
			sha256Hex(`${TURN_HEAD}\nCurrent working directory: JPWB_REPLAY_WORKSPACE_POSIX`)
		);
		expect(tried!.toolCalls).toEqual([
			{
				name: 'write_file',
				arguments: { path: 'docs/requirements.md', contents: DOC },
				outcome: 'COMPLETED'
			},
			{ name: 'run_command', arguments: { argv: ARGV }, outcome: 'COMPLETED' }
		]);
		expect(tried!.answer).toEqual({ arrived: true, text: ANSWER });
		expect(recording.commands).toEqual([
			{
				argv: ARGV,
				ran: true,
				exitCode: 0,
				timedOut: false,
				durationMs: 42,
				outputComplete: true,
				omissions: [],
				stdout: DOC,
				stderr: ''
			}
		]);
		expect(
			recording.reviewer.map((c) => [c.unit, c.framing, c.role, c.reply.status, c.elapsedMs])
		).toEqual([
			['requirements', 'work-product', 'initial', 'THROWN', 97_674],
			['requirements', 'work-product', 'retry', 'ANSWERED', 26_600]
		]);
		// ⭑ The thrown call's message as the tool printed it — the seam's prefix off, the home folder a token.
		expect(recording.reviewer[0]!.reply).toEqual({
			status: 'THROWN',
			message: `${TRANSPORT} --prompt-file ${join('JPWB_REPLAY_HOME_NATIVE', 'AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt')}`
		});
		// ⭑ The two halves, reassembled (`REG-D-057`).
		expect(recording.reviewer[1]!.reply).toEqual({ status: 'ANSWERED', text: `${CLEAN}\n` });
		expect(recording.reviewer[1]!.promptSha256).toBe(sha256Hex(REVIEW_PROMPT));
	});

	it('⛔ refuses, writing nothing, when a file of the recording names the account (REG-F-536)', () => {
		const a = arrange({ stdoutTail: `owner: ${ACCOUNT}\n` });
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.code).toBe(1);
		expect(r.out).toMatch(
			/refused, and nothing was written: the recording names the account or an absolute path \(REG-F-536\)/
		);
		expect(r.out).toMatch(/commands\.jsonl:1:\d+ account-name/);
		expect(r.out, 'a refusal printed the name it refused').not.toContain(`owner: ${ACCOUNT}`);
		expect(existsSync(out)).toBe(false);
	});

	it('⛔ refuses when the recorded writes do not rebuild a unit archive’s workspace (REG-F-530)', () => {
		const a = arrange({ archivedExtra: true });
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.code).toBe(1);
		expect(r.out).toContain(
			'writes replayed through 02-requirements: the workspace tree DIFFERS (1 file(s): made-by-a-command.txt)'
		);
		expect(r.out).toContain(
			'the recorded write_file calls do not rebuild the archived workspace (REG-F-530)'
		);
		expect(existsSync(out)).toBe(false);
	});

	it('refuses a run with no final archive: a recording is of the whole run', () => {
		const a = arrange({ final: false });
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.code).toBe(2);
		expect(r.out).toContain('refused: the run has no lane/archive/06-final holding a store');
		expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
	});

	it('the bound it records for each reviewing tool is the validator’s own', () => {
		expect(RECORDED_CALL_BOUND_MS).toEqual(REVIEWER_CALL_BOUND_MS);
	});
});

describe('⛔ REG-F-518 — a try whose commands completed out of the order they were called cannot be replayed', () => {
	// ⭑ DRIVEN FIRST ON P3's ARCHIVE (2026-10-11, uncommitted, in the builder's scratch folder): its recording replayed
	// four executor tries, seventeen commands and sixteen reviewer calls hash for hash, then went REPLAY_STALE at the
	// end-to-end phase's second command review — the prompt the replay sent was the RECORDED eighteenth's. Pi ran that
	// message's calls together (`REG-F-518`), the host minted each run's evidence as it COMPLETED, and the command reviews
	// were dispatched in that order; a replay runs the calls one at a time, in call order, so its reviews come in call
	// order. The recorder now says so, rather than writing a recording that goes stale where the run raced.
	const row = (
		id: string,
		objectType: string,
		state: Record<string, unknown>,
		firstSequence: number
	) => ({ id, objectType, state, firstSequence });
	const A = ['node', '--test', 'test/a.test.js'];
	const B = ['node', '--test', 'test/b.test.js'];
	const ranOutput =
		'exit 0 in 5ms\n--- stdout ---\nok\n\n--- stderr ---\n\n\nStructured result:\n{"exitCode":0,"timedOut":false,"durationMs":5,"outputComplete":true}';
	const composite = {
		input: [
			{ role: 'user', content: [{ type: 'input_text', text: 'Run both suites.' }] },
			{
				type: 'function_call',
				call_id: 'a',
				name: 'run_command',
				arguments: JSON.stringify({ argv: A })
			},
			{
				type: 'function_call',
				call_id: 'b',
				name: 'run_command',
				arguments: JSON.stringify({ argv: B })
			},
			{ type: 'function_call_output', call_id: 'a', output: ranOutput },
			{ type: 'function_call_output', call_id: 'b', output: ranOutput }
		]
	};
	/** One try calling A then B; its two runs' evidence minted in `evidenceOrder` — the order they COMPLETED. */
	const input = (evidenceOrder: readonly (readonly string[])[]): RecorderInput => ({
		store: {
			objects: [
				row('pwa', 'PROFESSIONAL_WORK_ARCHITECTURE', { publicationStatus: 'PUBLISHED' }, 1),
				row(
					'mex',
					'MODEL_EXCHANGE',
					{
						plane: 'EXECUTION',
						subjectObjectId: 'pwu',
						invokerId: 'execution.model-invocation:t',
						requestedAt: '2026-10-11T08:00:00.000Z',
						materializedInputRef: { status: 'STORED', storageKey: 'payload' },
						rawOutputBeforeCoercionRef: { status: 'STORED', storageKey: 'answer' },
						observedToolCalls: {
							observation: 'OBSERVED',
							calls: [{ outcome: 'COMPLETED' }, { outcome: 'COMPLETED' }],
							observedCount: 2
						}
					},
					2
				),
				...evidenceOrder.map((argv, k) =>
					row(
						`evd_${k}`,
						'EVIDENCE',
						{
							contentReference: {
								command: argv,
								exitCode: 0,
								timedOut: false,
								durationMs: 5,
								capture: { retained: true, stdoutPath: `captures/${argv[2]}/stdout.txt` }
							}
						},
						10 + k
					)
				)
			],
			events: [],
			content: null
		},
		content: new Map([
			['payload', JSON.stringify(composite)],
			['answer', '{}']
		]),
		units: [{ slug: 'end-to-end', unitId: 'pwu', archive: '05-end-to-end' }],
		workspace: resolve(tmpdir(), 'jpwb-no-such-workspace'),
		home: resolve(tmpdir(), 'jpwb-no-such-home'),
		captures: new Map(
			[A, B].map(
				(argv) =>
					[
						`captures/${argv[2]}`,
						{ stdout: 'ok\n', stderr: '', omissions: { omittedRegions: [] } }
					] as const
			)
		),
		expectedMatrix: [{ stage: '3', row: 'end-to-end', value: 'as intended' }],
		commit: 'c',
		reviewerFingerprint: 'f'
	});

	it('⭑ CONTROL — commands that completed in the order they were called record, in call order', () => {
		const built = buildRecording(input([A, B]));
		expect(built.problems).toEqual([]);
		expect(built.recording?.commands.map((c) => c.argv)).toEqual([A, B]);
	});

	it('⛔ commands that completed out of call order refuse the recording, naming REG-F-518', () => {
		const built = buildRecording(input([B, A]));
		expect(built.recording).toBeNull();
		expect(built.problems).toEqual([
			'executor try 1 (mex): its commands completed out of the order they were called — Pi ran them together (REG-F-518) — so their reviews were dispatched in an order a replay, which runs them one at a time, cannot reproduce'
		]);
	});
});
