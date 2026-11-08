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
//   · it refuses a run with no final archive; and the bound it records is the validator's own;
//   · ⭐ (the review of E4) the try's KEY is read off the payload — its system prompt less Pi's trailer, its tools — and
//     equals what the replay computes from this code (`executorKeyOf`; finding 1); the published PWA is recorded whole,
//     with the OS family (findings 4, 6); ⛔ a half-B archive records the execution half only, the authoring floor's
//     review left out (`REG-D-112` (c) — predicted red, observed 2026-10-15 with the recorder's rule removed: the
//     recording's first reviewer call was it); and the scan reads DECODED values — JSON-escaped code passes, a decoded
//     drive path is refused (finding 3 — predicted red, observed 2026-10-15 with the recorder scanning each file's
//     text as before: `executor.jsonl:1:543 unc-path`) ~~.~~ ⭐ — but decoding undoes one level, and the re-review of
//     the fix round found code two levels deep still read as a share. Now the code sits where a recording holds it —
//     the write_file argument, the answer envelope's files, a review prompt embedding the work product — and passes at
//     every depth by the share pattern's own rule (predicted red, observed 2026-10-15 with the old pattern restored:
//     `executor.jsonl:1 $.answer.text:1:200 unc-path`, `reviewer.jsonl:1 $.prompt:2:185 unc-path`); and the account
//     name after a newline inside the envelope is refused ~~, which a scan of the file's text passes~~ (⭐ a scan of the
//     file's text finds it too since an escape ends a token at any depth — the lead's delegated decision of 2026-10-15,
//     to be registered — and the refusal names its place in the value).
// ⛔ It drives the command line under bun, as an operator does: bun:sqlite does not exist under Node.
// No model is called; nothing is read from any real run.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { createSqliteDriver, SCHEMA_SQL } from '@janumipwb/rph-persistence';
import { afterAll, describe, expect, it } from 'vitest';
import { REVIEWER_CALL_BOUND_MS } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { splitExecutionEnvelope } from '../apps/rph-demo/src/lib/server/execution/execution-contract.js';
import { decisionModelBody, unloadBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	indicationBodySha256,
	instructionsSha256,
	osFamilyOf,
	readRecording,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	toolDefinitionsSha256
} from '../apps/rph-demo/src/lib/server/replay/recording.js';
import { fixtureKeyOf } from '../apps/rph-demo/src/lib/server/replay/replay-fixture.testing.js';
import { outputLimitDetail } from '../apps/rph-demo/src/lib/server/tools/output-limit.js';
import { freeTierRefusalsFigures, type FreeTierRefusals } from '../apps/rph-demo/src/lib/server/tools/free-tier-refusals.js';
import { scanText } from '../scripts/phase7/archive-scan.js';
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
/** ⭐ What this code gives the executor (finding 1): the payload below carries it as Pi sends it. */
const KEY = fixtureKeyOf();
const same = (text: string): string => text;

/**
 * ⭐ A payload's head as Pi sends it (finding 1): the system prompt first — the contract, then Pi's date and working
 * directory (`pi-coding-agent`, `buildSystemPrompt`) — and the tools as `pi-ai` lists them (`convertResponsesTools`).
 */
const payloadHead = (cwd: string) => ({
	instructionsMessage: {
		role: 'developer',
		content: `${KEY.instructions}\nCurrent date: 2026-10-11\nCurrent working directory: ${cwd}`
	},
	tools: KEY.tools.map((t) => ({ type: 'function', ...t, strict: false }))
});
const TRANSPORT = 'devin exited with code 1: connection reset by peer';
/** ⭐ P5 package A (F1) — devin's diagnostic for a reply it cut at the model's output-token limit, its stderr's last line. */
const CUT = 'devin invocation failed: Error: Response truncated: model hit max output token limit. The output above is incomplete.';
/**
 * ⭐ What the model READ of each call — its `function_call_output` — which the recording keys (`resultSha256`; the
 * lead's delegated decision of 2026-10-15, to be registered). ⭑ The write's names the workspace, so its key is taken
 * over the SCRUBBED text, as every hash in a recording is.
 */
const wroteOutput = (workspace: string): string =>
	`Wrote 44 UTF-8 bytes to ${workspace.replaceAll('\\', '/')}/docs/requirements.md.`;
const ranOutput = (stdout: string): string =>
	`exit 0 in 42ms\n--- stdout ---\n${stdout}\n--- stderr ---\n\n\nStructured result:\n{"exitCode":0,"timedOut":false,"durationMs":42,"outputComplete":true}`;

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
		/** ⭐ Half B's shape: the authoring floor reviewed the PWA before the Undertaking (`REG-D-112` (c)). */
		readonly authoringFloor?: boolean;
		/** A second file the executor wrote — code, whose JSON spelling doubles every backslash. */
		readonly extraWrite?: { readonly path: string; readonly contents: string };
		/** ⭐ What `lane/boot.json` names as `JPWB_DEMO_DB`, when not the run's own (finding 6). */
		readonly bootDemoDb?: string;
		/** The executor's answer, when not `ANSWER`: the contract's envelope, its work product carrying files' text. */
		readonly answer?: string;
		/** The prompt both review calls were sent, when not `REVIEW_PROMPT`: one that embeds the work product. */
		readonly reviewPrompt?: string;
		/** ⭐ The payload holds no output for the command's call: what the model read of it is not there to key. */
		readonly unanswered?: boolean;
		/** ⭐ P5 package A (F1) — the first review call's reply the tool cut at the model's output-token limit, this partial reply. */
		readonly cutFirstReview?: string;
		/** ⭐ P5 package C (F5 (b)) — and that partial reply NOT retained: its ref pending, as a store that kept none records it. */
		readonly cutNotRetained?: boolean;
		/**
		 * ⭐ Z3 (the lead's ruling on question 5) — the first review call met these free-tier refusals before it failed, and its retry
		 * met `retryRefusals` before it answered: each stated as the product states them, in the failure's detail and in the
		 * answer's observation (`freeTierRefusalsFigures`).
		 */
		readonly refusedFirstReview?: FreeTierRefusals;
		readonly retryRefusals?: FreeTierRefusals;
		/**
		 * ⭐ Z3 (the lead's ruling on the second follow-up) — what is not the product's sentence, and what looks like it: text the
		 * first review call's tool report ends with (`firstReportTail`), after its own words; the sentence the first call's detail
		 * states in place of the product's (`firstStatement`), and the one the retry's observation states (`retryStatement`); and a
		 * retry whose reply did not parse (`retryUnparsed`), its parse outcome's detail the message, a repair answering after it.
		 */
		readonly firstReportTail?: string;
		readonly firstStatement?: string;
		readonly retryStatement?: string;
		readonly retryUnparsed?: { readonly reply: string; readonly detail: string };
		/**
		 * ⭐ Z3 (the lead's ruling on the third follow-up: the bound read only off a failed call's own part) — a review of the
		 * command's evidence answered before the work product's review, its reply unparsed and its parse detail the message, a repair
		 * after it (`earlierCommandReview`); the clause the first call's detail states in place of "short of the tool’s 240000 ms
		 * bound, …" (`firstClause`); and no retry after it (`noRetry`), as a clause that says the call is not run again has it.
		 */
		readonly earlierCommandReview?: { readonly reply: string; readonly detail: string };
		readonly firstClause?: string;
		readonly noRetry?: boolean;
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
	const head = payloadHead(workspace.replaceAll('\\', '/'));
	const composite = {
		model: 'fixture-executor-model',
		tools: head.tools,
		input: [
			head.instructionsMessage,
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
				output: wroteOutput(workspace)
			},
			...(o.extraWrite
				? [
						{
							type: 'function_call',
							call_id: 'c0',
							name: 'write_file',
							arguments: JSON.stringify(o.extraWrite)
						},
						{ type: 'function_call_output', call_id: 'c0', output: 'Wrote the code.' }
					]
				: []),
			{
				type: 'function_call',
				call_id: 'c2',
				name: 'run_command',
				arguments: JSON.stringify({ argv: ARGV })
			},
			...(o.unanswered
				? []
				: [{ type: 'function_call_output', call_id: 'c2', output: ranOutput(stdout) }])
		]
	};
	const exchange = (id: string, state: Record<string, unknown>) => ({
		id,
		objectType: 'MODEL_EXCHANGE',
		state,
		firstSequence: 0
	});
	// ⭐ Z3 — what each review call's record states of its refusals: the first call's in the validator's sentence
	// (`refusalsBeforeTheFailure`), the retry's in devin's adapter's (`refusalsStated`) — or the sentence a row puts in their place.
	const firstStatement =
		o.firstStatement ??
		(o.refusedFirstReview === undefined
			? undefined
			: `Before this, the call met ${freeTierRefusalsFigures(o.refusedFirstReview)}, each refusal waited out and the same call made again: all left out of the time shown here (D46).`);
	const retryStatement =
		o.retryStatement ??
		(o.retryRefusals === undefined
			? undefined
			: `devin answered after ${freeTierRefusalsFigures(o.retryRefusals)} (“free model rate limit”), each refusal waited out for 45 s and the same call made again: no refusal reached the model, and none is a reviewer call (D46).`);
	const retryReply = o.retryUnparsed?.reply ?? CLEAN;
	const objects = [
		{ id: UND, objectType: 'UNDERTAKING', state: { name: 'wordfreq realization' } },
		{
			id: 'pwa_1',
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			state: {
				publicationStatus: 'PUBLISHED',
				name: 'wordfreq',
				description: 'The run’s PWA.',
				domain: 'software',
				version: '0.1.0',
				rootPwuTypeId: 'pwut_1'
			}
		},
		{
			id: 'pwut_1',
			objectType: 'PWU_TYPE',
			state: {
				pwaId: 'pwa_1',
				name: 'Requirements',
				pwuKind: 'REQUIREMENT_DEFINITION',
				isRoot: true,
				promptTemplate: { templateText: TURN_HEAD }
			}
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
			rawOutputBeforeCoercionRef: ref(o.answer ?? ANSWER),
			volunteeredReasoningRef: pending,
			observedToolCalls: {
				observation: 'OBSERVED',
				calls: [
					{ ordinal: 1, toolName: 'write_file', outcome: 'COMPLETED' },
					...(o.extraWrite ? [{ ordinal: 2, toolName: 'write_file', outcome: 'COMPLETED' }] : []),
					{ ordinal: o.extraWrite ? 3 : 2, toolName: 'run_command', outcome: 'COMPLETED' }
				],
				observedCount: o.extraWrite ? 3 : 2
			}
		}),
		// ⭐ HALF B's AUTHORING FLOOR (`REG-D-112` (c)): the Reasoning Review of the authored PWA, requested BEFORE the
		// Undertaking's first try — what `floor.ts` (`runPwaFloor`) recorded before the review in parts, its subject the PWA
		// itself.
		...(o.authoringFloor
			? [
					exchange('mex_authoring_review', {
						plane: 'ASSURANCE',
						subjectObjectId: 'pwa_1',
						subjectObjectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
						exchangeRole: 'INITIAL',
						disposition: 'ACCEPTED',
						requestedAt: '2026-10-11T07:59:00.000Z',
						respondedAt: '2026-10-11T07:59:30.000Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: ref('Judge the authored graph of wordfreq.'),
						rawOutputBeforeCoercionRef: ref(CLEAN),
						parseOutcome: { outcome: 'PARSED' }
					}),
					// ⭐ The review in parts, B3 (`REG-D-125`) — and the authoring floor's review of ONE TYPE, as it records it now:
					// one review per part, its subject the type.
					exchange('mex_authoring_part_review', {
						plane: 'ASSURANCE',
						subjectObjectId: 'pwut_1',
						subjectObjectType: 'PWU_TYPE',
						exchangeRole: 'INITIAL',
						disposition: 'ACCEPTED',
						requestedAt: '2026-10-11T07:59:40.000Z',
						respondedAt: '2026-10-11T07:59:50.000Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: ref('Judge one type of the authored PWA of wordfreq.'),
						rawOutputBeforeCoercionRef: ref(CLEAN),
						parseOutcome: { outcome: 'PARSED' }
					})
				]
			: []),
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
		// ⭐ Z3 (the lead's ruling on the third follow-up) — a review answered BEFORE any call threw: the command's evidence reviewed,
		// its reply unparsed, its parse outcome `classifyParse`'s (the class and the parser's message), and the repair that answered it.
		// ⭑ Requested just before the work product's review — in this one-try fixture inside the try's span; a run of several units
		// holds an answered review ahead of a thrown one in the same order.
		...(o.earlierCommandReview === undefined
			? []
			: [
					exchange('mex_command_review_1', {
						plane: 'ASSURANCE',
						subjectObjectId: 'evd_1',
						subjectObjectType: 'EVIDENCE',
						exchangeRole: 'INITIAL',
						disposition: 'REPAIR_REQUESTED',
						requestedAt: '2026-10-11T08:00:58.000Z',
						respondedAt: '2026-10-11T08:00:59.000Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: ref(o.reviewPrompt ?? REVIEW_PROMPT),
						rawOutputBeforeCoercionRef: pending,
						answerSpanRef: ref(o.earlierCommandReview.reply),
						volunteeredReasoningRef: ref('\n'),
						omittedRegions: [{ role: 'MODEL_ANSWER', byteSize: Buffer.byteLength(o.earlierCommandReview.reply), byteOffset: 0 }],
						parseOutcome: { outcome: 'JSON_PARSE_FAILED', detail: o.earlierCommandReview.detail }
					}),
					exchange('mex_command_review_2', {
						plane: 'ASSURANCE',
						subjectObjectId: 'evd_1',
						subjectObjectType: 'EVIDENCE',
						exchangeRole: 'REPAIR',
						disposition: 'ACCEPTED',
						requestedAt: '2026-10-11T08:00:59.000Z',
						respondedAt: '2026-10-11T08:00:59.900Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: ref(`${o.reviewPrompt ?? REVIEW_PROMPT}\n\nIMPORTANT: reply with ONLY the minified JSON object.`),
						rawOutputBeforeCoercionRef: pending,
						answerSpanRef: ref(CLEAN),
						volunteeredReasoningRef: ref('\n'),
						omittedRegions: [{ role: 'MODEL_ANSWER', byteSize: Buffer.byteLength(CLEAN), byteOffset: 0 }],
						parseOutcome: { outcome: 'PARSED' }
					})
				]),
		// ⭑ The first review call threw short of its bound — its cause printing devin's temp folder under the home folder.
		// ⭐ P5 package A (F1) — or, with `cutFirstReview`, its reply the tool cut at the model's output-token limit, recorded
		// as the validator records one: REJECTED, its output DECLARED cut, the reply kept whole, E-5 the class's detail.
		exchange('mex_review_1', {
			plane: 'ASSURANCE',
			subjectObjectId: 'art_1',
			subjectObjectType: 'ARTIFACT',
			exchangeRole: 'INITIAL',
			disposition: o.cutFirstReview === undefined ? 'NO_RESPONSE' : 'REJECTED',
			requestedAt: '2026-10-11T08:01:00.000Z',
			respondedAt: '2026-10-11T08:02:37.674Z',
			resolvedModel: { value: 'fixture-reviewer-model' },
			resolvedProvider: { value: 'devin' },
			materializedInputRef: ref(o.reviewPrompt ?? REVIEW_PROMPT),
			...(o.cutFirstReview === undefined
				? {
						rawOutputBeforeCoercionRef: pending,
						parseOutcome: {
							outcome: 'NOT_ATTEMPTED',
							detail: `The reviewing tool’s call failed after 97674 ms with no reply, ${o.firstClause ?? 'short of the tool’s 240000 ms bound, so it is run once more (REG-D-102)'}.${firstStatement === undefined ? '' : ` ${firstStatement}`} What the tool reported, sanitised: reasoning-review backing tool invocation failed: ${TRANSPORT} --prompt-file ${join(home, 'AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt')}${o.firstReportTail ?? ''}`
						}
					}
				: {
						outputTruncation: 'DECLARED',
						rawOutputBeforeCoercionRef: o.cutNotRetained === true ? pending : ref(o.cutFirstReview),
						answerSpanRef: pending,
						volunteeredReasoningRef: pending,
						parseOutcome: {
							outcome: 'NOT_ATTEMPTED',
							detail: outputLimitDetail({
								facts: { outputTokens: 25_000 },
								partialChars: o.cutFirstReview.length,
								elapsedMs: 97_674,
								// ⭐ Z3 — and the refusals the cut call met, stated as the validator states them: in its clause (`withRefusals`).
								clause: `short of the tool’s 240000 ms bound, so it is run once more (REG-D-102)${firstStatement === undefined ? '' : `. ${firstStatement.replace(/\.$/, '')}`}`,
								reported: `reasoning-review backing tool invocation failed: ${CUT} --prompt-file ${join(home, 'AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt')}`
							})
						}
					})
		}),
		// ⭑ Its retry answered — the reply kept in two halves, as the reviewer's replies are (`REG-D-057`).
		// ⭐ Z3 (the third follow-up) — none, with `noRetry`.
		...(o.noRetry === true
			? []
			: [
		exchange('mex_review_2', {
			plane: 'ASSURANCE',
			subjectObjectId: 'art_1',
			subjectObjectType: 'ARTIFACT',
			exchangeRole: 'RETRY',
			// ⭐ Z3 — or its reply did not parse, so a repair was asked (the validator's `repair-requested`).
			disposition: o.retryUnparsed === undefined ? 'ACCEPTED' : 'REPAIR_REQUESTED',
			requestedAt: '2026-10-11T08:02:37.674Z',
			// ⭐ Z3 (Q5) — a retry that met a refusal before it answered spans the refusal and its wait too.
			respondedAt: retryStatement === undefined ? '2026-10-11T08:03:04.274Z' : '2026-10-11T08:03:50.274Z',
			resolvedModel: { value: 'fixture-reviewer-model' },
			resolvedProvider: { value: 'devin' },
			materializedInputRef: ref(o.reviewPrompt ?? REVIEW_PROMPT),
			rawOutputBeforeCoercionRef: pending,
			answerSpanRef: ref(retryReply),
			volunteeredReasoningRef: ref('\n'),
			omittedRegions: [{ role: 'MODEL_ANSWER', byteSize: Buffer.byteLength(retryReply), byteOffset: 0 }],
			// ⭐ Z3 — an unparsed reply's outcome is `classifyParse`'s: the class and the parser's message, which can quote the reply.
			parseOutcome: o.retryUnparsed === undefined ? { outcome: 'PARSED' } : { outcome: 'JSON_PARSE_FAILED', detail: o.retryUnparsed.detail },
			// ⭐ Z3 (Q5) — what devin's adapter said of the call, its refusals stated where it states them.
			...(retryStatement === undefined
				? {}
				: {
						observedToolCalls: {
							observation: 'NOT_OBSERVABLE',
							reason: `devin cannot be watched here. ${retryStatement}`
						}
					})
		})
				]),
		// ⭐ Z3 — and the repair that answered it, as the validator asks one (`repairPrompt`): no refusal met.
		...(o.retryUnparsed === undefined
			? []
			: [
					exchange('mex_review_3', {
						plane: 'ASSURANCE',
						subjectObjectId: 'art_1',
						subjectObjectType: 'ARTIFACT',
						exchangeRole: 'REPAIR',
						disposition: 'ACCEPTED',
						requestedAt: '2026-10-11T08:03:50.274Z',
						respondedAt: '2026-10-11T08:04:11.000Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: ref(`${o.reviewPrompt ?? REVIEW_PROMPT}\n\nIMPORTANT: reply with ONLY the minified JSON object.`),
						rawOutputBeforeCoercionRef: pending,
						answerSpanRef: ref(CLEAN),
						volunteeredReasoningRef: ref('\n'),
						omittedRegions: [{ role: 'MODEL_ANSWER', byteSize: Buffer.byteLength(CLEAN), byteOffset: 0 }],
						parseOutcome: { outcome: 'PARSED' }
					})
				]),
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
		if (o.extraWrite) {
			const at = join(dir, 'workspace', ...o.extraWrite.path.split('/'));
			mkdirSync(join(at, '..'), { recursive: true });
			writeFileSync(at, o.extraWrite.contents);
		}
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
	writeFileSync(
		join(lane, 'boot.json'),
		JSON.stringify({ overlay: { JPWB_DEMO_DB: o.bootDemoDb ?? demoDb } })
	);
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
		// ⭐ The published PWA, whole (`REG-D-112` (c)), and the family it was made on (finding 6).
		expect(recording.manifest.osFamily).toBe(osFamilyOf());
		expect(recording.manifest.pwa).toEqual({
			id: 'pwa_1',
			name: 'wordfreq',
			description: 'The run’s PWA.',
			domain: 'software',
			version: '0.1.0',
			rootTypeId: 'pwut_1',
			types: [
				{
					id: 'pwut_1',
					declared: {
						pwuKind: 'REQUIREMENT_DEFINITION',
						name: 'Requirements',
						isRoot: true,
						promptTemplate: { templateText: TURN_HEAD }
					}
				}
			],
			policies: []
		});
		const [tried] = recording.executor;
		// ⭐ FINDING 1 — the key read off the payload is the key the replay computes from this code.
		expect(tried!.instructionsSha256).toBe(instructionsSha256(KEY.instructions, same));
		expect(tried!.toolsSha256).toBe(toolDefinitionsSha256(KEY.tools, same));
		// ⭐ Hashed over the SCRUBBED text: the cwd Pi printed is the workspace token, so a replay elsewhere compares equal.
		expect(tried!.turnSha256).toBe(
			sha256Hex(`${TURN_HEAD}\nCurrent working directory: JPWB_REPLAY_WORKSPACE_POSIX`)
		);
		// ⭐ And what the model READ of each call, keyed over the scrubbed text (the lead's delegated decision of 2026-10-15,
		// to be registered): the write's output named the workspace, which its key holds as the token.
		expect(tried!.toolCalls).toEqual([
			{
				name: 'write_file',
				arguments: { path: 'docs/requirements.md', contents: DOC },
				outcome: 'COMPLETED',
				resultSha256: sha256Hex('Wrote 44 UTF-8 bytes to JPWB_REPLAY_WORKSPACE_POSIX/docs/requirements.md.')
			},
			{
				name: 'run_command',
				arguments: { argv: ARGV },
				outcome: 'COMPLETED',
				resultSha256: sha256Hex(ranOutput(DOC))
			}
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

	// ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REVIEW CALL THE TOOL CUT AT THE MODEL'S OUTPUT-TOKEN LIMIT is recorded as its
	// own form, the cut replayed as a cut: what the tool printed, the partial reply and what it reported of the cut.
	it('⛔ P5 A — a review call the tool cut at the output-token limit is recorded OUTPUT_LIMIT — never as a reply that ANSWERED', () => {
		const out = join(tempDir('out'), 'recording');
		const r = record(arrange({ cutFirstReview: '{"findings":[' }), out);
		expect(r.code, r.out).toBe(0);
		const recording = readRecording(out);
		// ⛔ THE MUTANT: the cut read by its disposition alone — a reply REJECTED, kept whole: recorded ANSWERED, and replayed
		// to the validator as a reply to parse and repair, a call the recorded run never made.
		expect(recording.reviewer.map((c) => [c.role, c.reply.status]), 'a cut reply was recorded as an answer').toEqual([
			['initial', 'OUTPUT_LIMIT'],
			['retry', 'ANSWERED']
		]);
		expect(recording.reviewer[0]!.reply).toEqual({
			status: 'OUTPUT_LIMIT',
			message: `${CUT} --prompt-file ${join('JPWB_REPLAY_HOME_NATIVE', 'AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt')}`,
			partialReply: '{"findings":[',
			finishReason: null,
			outputTokens: 25_000
		});
	});

	// ⭐ P5 package C (F5 (b); package A's check, finding 4) — A CUT WHOSE PARTIAL REPLY THE STORE DID NOT RETAIN CANNOT BE
	// REPLAYED AS THE RUN MADE IT: the recorder refuses it, by name, and writes nothing — never a cut with an invented reply.
	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING ON QUESTION 5 (`z3-p1-rulings.md`): THE RECORDING KEEPS EACH REVIEWER
	// CALL'S CARRIED FREE-TIER REFUSALS, read back off what the run's record states of them — the failure's detail, the answer's
	// observation (`freeTierRefusalsIn`) — in the carrier's form, so the replay can attach them as devin's adapter did.
	// ⭑ PREDICTED RED, WRITTEN FIRST: the recorder keeps the span alone, and the replay of the call decides on it.
	it('⛔ PREDICTED RED — Z3 (Q5) — a review call’s refusals are recorded with it: the failure’s from its detail, the answer’s from its observation', () => {
		const out = join(tempDir('out'), 'recording');
		const failed = { count: 1, waitedMs: 45_000, beforeLastAttemptMs: 46_000 };
		const answered = { count: 1, waitedMs: 45_000, beforeLastAttemptMs: 46_000 };
		const r = record(arrange({ refusedFirstReview: failed, retryRefusals: answered }), out);
		expect(r.code, r.out).toBe(0);
		const recording = readRecording(out);
		expect(recording.reviewer.map((c) => c.freeTierRefusals)).toEqual([failed, answered]);
		expect(recording.reviewer.map((c) => c.elapsedMs), 'the spans, as the run kept them').toEqual([97_674, 72_600]);
	});

	it('⭑ CONTROL — Z3 (Q5) — a review call with no refusals is recorded as today: no refusals field at all', () => {
		const out = join(tempDir('out'), 'recording');
		const r = record(arrange(), out);
		expect(r.code, r.out).toBe(0);
		expect(readRecording(out).reviewer.map((c) => 'freeTierRefusals' in c)).toEqual([false, false]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING ON THE SECOND FOLLOW-UP (`z3-p1-rulings.md`): THE READER READS ONLY THE
	// PRODUCT'S OWN SENTENCE. A record's detail holds text that is not the product's — a failure's tool report, after "What the tool
	// reported, sanitised: ", and the parser's message for an answer that did not parse, which can quote the reply — so the refusals
	// are read by the call's class, from the product's part only, at the sentence's opening: a failure's (thrown or cut) in its detail
	// before the tool's report, at "Before this, the call met "; an answer's in its observation, at "devin answered after ".
	// ⛔ An opening whose figures do not read is the recorder's problem for that call, never "no refusals".
	// ⭑ PREDICTED RED, WRITTEN FIRST: the reader looks for the figures anywhere in the detail, then in the observation.
	describe('⛔ PREDICTED RED (Z3; the second follow-up) — a call’s refusals are read off the product’s own sentence only', () => {
		const quoted = { count: 2, waitedMs: 90_000, beforeLastAttemptMs: 91_500 };
		// ⭑ Both of the product's sentences, as a text that is not the product's can quote them: a review of devin's adapter, or of
		// a run's record, that the tool echoed or the reply carried.
		const quoting =
			`Before this, the call met ${freeTierRefusalsFigures(quoted)}, each refusal waited out and the same call made again: ` +
			`all left out of the time shown here (D46). devin answered after ${freeTierRefusalsFigures(quoted)} (“free model rate limit”)`;

		it('⛔ (i) a failure with no refusals whose tool report quotes the figures records none — the quote kept as the tool’s words', () => {
			const out = join(tempDir('out'), 'recording');
			const r = record(arrange({ firstReportTail: ` while sending “${quoting}”` }), out);
			expect(r.code, r.out).toBe(0);
			const recording = readRecording(out);
			expect(recording.reviewer.map((c) => c.freeTierRefusals), 'refusals read off the tool’s report').toEqual([undefined, undefined]);
			const first = recording.reviewer[0]!.reply;
			expect(first.status === 'THROWN' ? first.message : '', 'the tool’s words, kept whole').toContain(quoting);
		});

		// ⭑ CONTROL — the class rule's other failure: a call cut at the output limit states its refusals in its detail's own part too
		// (`outputLimitDetail`, its clause the validator's `withRefusals`), and they are read there, as a thrown call's are. Not a red:
		// the old reader read them too. Its own mutant (`P6X-Z3-M55`, a cut read as an answer) shows the row tells the classes apart.
		it('⭑ CONTROL — a call cut at the output limit, its refusals stated in its detail’s own part, records them there', () => {
			const out = join(tempDir('out'), 'recording');
			const cut = { count: 1, waitedMs: 45_000, beforeLastAttemptMs: 47_000 };
			const r = record(arrange({ cutFirstReview: '{"findings":[', refusedFirstReview: cut }), out);
			expect(r.code, r.out).toBe(0);
			expect(readRecording(out).reviewer.map((c) => [c.reply.status, c.freeTierRefusals]), 'the cut’s refusals').toEqual([
				['OUTPUT_LIMIT', cut],
				['ANSWERED', undefined]
			]);
		});

		it('⛔ (ii) an answered call whose parse detail quotes the figures records none from it, while its observation’s refusals are read', () => {
			const out = join(tempDir('out'), 'recording');
			const observed = { count: 1, waitedMs: 45_000, beforeLastAttemptMs: 46_000 };
			// ⭑ A reply that does not parse (its trailing comma), and a parser's message that quotes it whole: `classifyParse` records the
			// parser's message as it is.
			const reply = `{"findings":[{"statement":"${quoting}"}],}`;
			const r = record(
				arrange({ retryRefusals: observed, retryUnparsed: { reply, detail: `Unexpected token '}', "${reply}" is not valid JSON` } }),
				out
			);
			expect(r.code, r.out).toBe(0);
			expect(readRecording(out).reviewer.map((c) => [c.role, c.freeTierRefusals]), 'refusals read off the parser’s message').toEqual([
				['initial', undefined],
				['retry', observed],
				['repair', undefined]
			]);
		});

		it('⛔ (iii) a failure’s statement of refusals whose figures do not read is the recorder’s problem for that call: refused, nothing written', () => {
			const out = join(tempDir('out'), 'recording');
			const r = record(
				arrange({
					firstStatement:
						'Before this, the call met 2 free-tier refusals: 1.5 s of refused attempts and 90 s of waits, each refusal waited out and ' +
						'the same call made again: all left out of the time shown here (D46).'
				}),
				out
			);
			expect(r.out, 'a statement that does not read was taken for none').toContain(
				'reviewer call 1 (mex_review_1): its record states free-tier refusals (“Before this, the call met …”) in figures that do ' +
					'not read, so the refusals it met cannot be replayed'
			);
			expect(r.code, r.out).toBe(1);
			expect(existsSync(out), 'a recording was written').toBe(false);
		});

		// ⭑ The figures are read right after the opening, where the sentence writes them: figures further on are no figures of it.
		it('⛔ (iii) and a statement whose figures are not at its opening, though some follow later, is the same problem', () => {
			const out = join(tempDir('out'), 'recording');
			const r = record(
				arrange({
					firstStatement:
						'Before this, the call met the free tier’s refusal twice — 2 free-tier refusals: 1500 ms of refused attempts and 90000 ' +
						'ms of waits — each refusal waited out and the same call made again: all left out of the time shown here (D46).'
				}),
				out
			);
			expect(r.out, 'figures read from further on than the opening').toContain(
				'reviewer call 1 (mex_review_1): its record states free-tier refusals (“Before this, the call met …”) in figures that do ' +
					'not read, so the refusals it met cannot be replayed'
			);
			expect(r.code, r.out).toBe(1);
		});

		it('⛔ (iii) and an answer’s, the same', () => {
			const out = join(tempDir('out'), 'recording');
			const r = record(
				arrange({
					retryStatement:
						'devin answered after 2 free-tier refusals: 1.5 s of refused attempts and 90 s of waits (“free model rate limit”), each ' +
						'refusal waited out for 45 s and the same call made again: no refusal reached the model, and none is a reviewer call (D46).'
				}),
				out
			);
			expect(r.out, 'a statement that does not read was taken for none').toContain(
				'reviewer call 2 (mex_review_2): its record states free-tier refusals (“devin answered after …”) in figures that do not ' +
					'read, so the refusals it met cannot be replayed'
			);
			expect(r.code, r.out).toBe(1);
			expect(existsSync(out), 'a recording was written').toBe(false);
		});
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING ON THE THIRD FOLLOW-UP (`z3-p1-rulings.md`; package X's reader, found by
	// the general-form sweep, `z3-facts.md` §13.4): THE BOUND A RECORDING CARRIES IS READ ONLY OFF A FAILED CALL'S OWN CLAUSE — a
	// thrown or cut row's, in its detail's own part (`productsPart`) — never off an answer's parse detail or a tool's report.
	// ⭑ PREDICTED RED, WRITTEN FIRST: the reader takes the first "tool’s N ms bound" in any reviewer row's whole detail.
	// ⭑ THE CONTROL is the first row of this file: a thrown call's own clause, "short of the tool’s 240000 ms bound", is the
	// recording's bound (240 000), not the tool's known one (480 000).
	describe('⛔ PREDICTED RED (Z3; the third follow-up) — the recorded bound is read only off a failed call’s own clause', () => {
		// ⭑ The validator's whole sentence for a call that threw, quoted, as a review of a run's record can quote it: its bound, and
		// the opening of its tool's report.
		const quotedDetail =
			'The reviewing tool’s call failed after 1200 ms with no reply, short of the tool’s 999 ms bound, so it is run once more ' +
			'(REG-D-102). What the tool reported, sanitised: devin exited with code 1';

		it('⛔ an answered call ahead of any thrown one, whose parse detail quotes “the tool’s 999 ms bound”: the bound is the thrown call’s own', () => {
			const out = join(tempDir('out'), 'recording');
			const reply = `{"findings":[{"statement":"${quotedDetail}"}],}`;
			const r = record(
				arrange({ earlierCommandReview: { reply, detail: `Unexpected token '}', "${reply}" is not valid JSON` } }),
				out
			);
			expect(r.code, r.out).toBe(0);
			const recording = readRecording(out);
			expect(recording.reviewer.map((c) => [c.framing, c.role, c.reply.status]), 'arrangement: the answered review first').toEqual([
				['command', 'initial', 'ANSWERED'],
				['command', 'repair', 'ANSWERED'],
				['work-product', 'initial', 'THROWN'],
				['work-product', 'retry', 'ANSWERED']
			]);
			expect(recording.manifest.models.reviewer.callBoundMs, 'the bound read off an answer’s parse detail').toBe(240_000);
		});

		// ⭑ A clause that names no bound is the validator's when its reviewer declares none (`thrownCallDisposal`): the search
		// then runs on into the tool's report, and only the product's own part keeps it out.
		it('⛔ a thrown call whose clause names no bound, and whose tool report quotes one: the tool’s known bound, never the quote', () => {
			const out = join(tempDir('out'), 'recording');
			const r = record(
				arrange({
					firstClause: 'this reviewer declares no bound, so a call that throws is not run again',
					firstReportTail: ` while sending “${quotedDetail}”`,
					noRetry: true
				}),
				out
			);
			expect(r.code, r.out).toBe(0);
			const recording = readRecording(out);
			expect(recording.reviewer.map((c) => [c.role, c.reply.status]), 'arrangement: one call, thrown, not run again').toEqual([
				['initial', 'THROWN']
			]);
			expect(recording.manifest.models.reviewer.callBoundMs, 'the bound read off the tool’s report').toBe(RECORDED_CALL_BOUND_MS.devin);
		});
	});

	it('⛔ P5 C — refuses, writing nothing, a review call cut at the output-token limit whose partial reply is not retained', () => {
		const out = join(tempDir('out'), 'recording');
		const r = record(arrange({ cutFirstReview: '{"findings":[', cutNotRetained: true }), out);
		expect(r.out, 'the cut not retained was not refused by name').toContain(
			'reviewer call 1 (mex_review_1): its reply was cut at the model’s output-token limit, and the partial reply is not ' +
				'retained, so the cut cannot be replayed'
		);
		expect(r.code, r.out).toBe(1);
		expect(existsSync(out), 'a recording was written').toBe(false);
	});

	it('⛔ refuses, writing nothing, when a file of the recording names the account (REG-F-536)', () => {
		const a = arrange({ stdoutTail: `owner: ${ACCOUNT}\n` });
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.code).toBe(1);
		expect(r.out).toMatch(
			/refused, and nothing was written: the recording names the account or an absolute path \(REG-F-536\)/
		);
		expect(r.out).toMatch(/commands\.jsonl:1 \$\.stdout:\d+:\d+ account-name/);
		expect(r.out, 'a refusal printed the name it refused').not.toContain(`owner: ${ACCOUNT}`);
		expect(existsSync(out)).toBe(false);
	});

	it('⛔ refuses a try whose call has no output in its payload: what the model read of it cannot be keyed', () => {
		// ⭐ (the lead's delegated decision of 2026-10-15, to be registered) Keyed as nothing, the call would replay STALE
		// against any rendering, for a reason that is the recorder's; refused here, by name, nothing is written.
		const out = join(tempDir('out'), 'recording');
		const r = record(arrange({ unanswered: true }), out);
		expect(r.code).toBe(1);
		expect(r.out).toContain(
			'executor try 1 (mex_try): its call 2 (run_command) has no output in its payload, so the result the model read of it cannot be keyed'
		);
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

	it('⭐ REG-D-112 (c) — a half-B archive records the execution half only: the authoring floor’s reviews are left out, ⭐ the whole graph’s and each type’s (REG-D-125)', () => {
		const a = arrange({ authoringFloor: true });
		const out = join(tempDir('out'), 'recording');
		const r = record(a, out);
		expect(r.code, r.out).toBe(0);
		const recording = readRecording(out);
		expect(
			recording.reviewer.map((c) => [c.unit, c.framing, c.role, c.reply.status]),
			'the authoring floor’s review was recorded as a call the replay would be asked'
		).toEqual([
			['requirements', 'work-product', 'initial', 'THROWN'],
			['requirements', 'work-product', 'retry', 'ANSWERED']
		]);
	});

	it('⭐ the archive scan holds at every depth a recording carries: code in a write_file argument, the answer envelope’s files and a review prompt embedding the work product is written; a decoded drive path, and the account name inside the envelope, are refused', () => {
		// ⭑ Code the executor wrote: `/\r\n|\n/`, a regular expression of single backslashes, where a Phase 7 recording
		// carries it — the write_file call (P3's 199 hits were this kind), the contract's envelope, whose work product holds
		// each file's full text as the phases' output contract asks, and the work-product review's prompt, which embeds that
		// work product re-serialised (`splitExecutionEnvelope`). The last two sit two JSON levels deep in their lines.
		const code = {
			path: 'src/lines.js',
			contents: 'export const lines = (text) => text.split(/\\r\\n|\\n/);\n'
		};
		const answer = (rationale: string): string =>
			JSON.stringify({
				workProduct: {
					documents: [{ path: 'docs/requirements.md', text: DOC }],
					files: [{ path: code.path, text: code.contents }],
					hashes: [],
					commands: []
				},
				rationale: { rationale, assumptions: [], limitations: [], residualUncertainty: [] }
			});
		const escaped = record(
			arrange({
				extraWrite: code,
				answer: answer('written'),
				reviewPrompt: `${REVIEW_PROMPT}\n${splitExecutionEnvelope(answer('written')).workProduct}\n`
			}),
			join(tempDir('out'), 'recording')
		);
		expect(escaped.code, escaped.out).toBe(0);
		// ⛔ And a real drive path in a decoded value still hits — built here, never spelled (`REG-F-536`).
		const drive = [`${String.fromCodePoint(81)}:`, 'elsewhere', 'notes.txt'].join('\\');
		const out = join(tempDir('out'), 'recording');
		const pathed = record(arrange({ stdoutTail: `see ${drive}\n` }), out);
		expect(pathed.code).toBe(1);
		expect(pathed.out).toMatch(/commands\.jsonl:1 \$\.stdout:\d+:\d+ drive-path/);
		expect(existsSync(out)).toBe(false);
		// ⛔ And the account name after a newline in the envelope's rationale — `\\n` in the line's own text ~~, where no
		// token ends,~~ and `\n` decoded: an escape ends a token at any depth now, and the refusal is placed in the value.
		const named = join(tempDir('out'), 'recording');
		const r = record(arrange({ answer: answer(`ran as\n${ACCOUNT}`) }), named);
		expect(r.code, r.out).toBe(1);
		expect(r.out).toMatch(/executor\.jsonl:1 \$\.answer\.text:\d+:\d+ account-name/);
		expect(r.out.includes(ACCOUNT), 'a refusal printed the name it refused').toBe(false);
		expect(existsSync(named)).toBe(false);
	});

	it('⛔ (finding 6) refuses a run whose store path is spelled by the OTHER OS family: a run is recorded on its own', () => {
		// ⭑ Built, never spelled (`REG-F-536`): an absolute path of the family this host is not.
		const otherFamily =
			osFamilyOf() === 'windows'
				? ['', 'srv', 'runs', 'demo.sqlite'].join('/')
				: [`${String.fromCodePoint(81)}:`, 'runs', 'demo.sqlite'].join('\\');
		const out = join(tempDir('out'), 'recording');
		const r = record(arrange({ bootDemoDb: otherFamily }), out);
		expect(r.code).toBe(1);
		expect(r.out).toContain(
			`lane/boot.json's JPWB_DEMO_DB is not an absolute path as this host's OS family (${osFamilyOf()}) spells one`
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

	it('⛔ a path relative to a scrub token is never the start of an absolute path to the archive scan: every token ends in a word character (REG-F-536)', () => {
		// ⭑ THE PROPERTY `scrubToken` NAMES, ASKED OF EVERY TOKEN (the confirm of E4's second fix round: E4-M30 had died by
		// this file's pinned token text alone). The scan reads a separator after a character that is no part of a word as
		// a path's start — a folder of one letter after `/`, git's shell's drive; `/home/` and `/Users/` — so a token closed
		// by a brace (`}`) would turn every path the run printed under its directory into a hit, and refuse the recording.
		// Each continuation is a path RELATIVE to the token's directory, built here, never spelled (`REG-F-536`).
		const B = '\\';
		const relative: readonly (readonly [string, string])[] = [
			['a one-letter folder, posix', ['', 'a', 'x.js'].join('/')],
			['a folder named home, posix', ['', 'home', 'x'].join('/')],
			['a folder named Users, posix', ['', 'Users', 'x'].join('/')],
			['a one-letter folder, native', ['', 'a', 'x.js'].join(B)],
			['a one-letter folder, JSON-escaped', ['', 'a', 'x.js'].join(B + B)]
		];
		for (const token of SCRUB_TOKENS)
			for (const [what, rest] of relative)
				expect(
					scanText(`${token}${rest}`, 'f', [ACCOUNT]).map((h) => h.kind),
					`${token}, then ${what}`
				).toEqual([]);
	});
});

describe('⛔ REG-F-518 — a try whose commands completed out of the order they were called cannot be replayed', () => {
	// ⭑ DRIVEN FIRST ON P3's ARCHIVE (2026-10-11, uncommitted, in the builder's scratch folder): its recording replayed
	// four executor tries, seventeen commands and sixteen reviewer calls hash for hash, then went REPLAY_STALE at the
	// end-to-end phase's second command review — the prompt the replay sent was the RECORDED eighteenth's. Pi ran that
	// message's calls together (`REG-F-518`), the host minted each run's evidence as it COMPLETED, and the command reviews
	// were dispatched in that order; a replay runs the calls one at a time, in call order, so its reviews come in call
	// order. The recorder now says so, rather than writing a recording that goes stale where the run raced.
	// ⭐ `REG-D-112` (d): Pi now runs a turn's tool calls one at a time (`pi-execution-tools.ts`), so a run made since
	// completes its commands in the order they were called; the refusal stays, for any archive that did not.
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
	const head = payloadHead('the-fixture-cwd');
	const composite = {
		tools: head.tools,
		input: [
			head.instructionsMessage,
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
				row(
					'pwa',
					'PROFESSIONAL_WORK_ARCHITECTURE',
					{ publicationStatus: 'PUBLISHED', rootPwuTypeId: 'pwut' },
					1
				),
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

describe('⭐ The merge of E12 and E4 (J3) — a DECLARED review’s reviewer call is recorded, named by the unit it reviewed', () => {
	// ⭑ E12's Record Assurance asks the reviewer once per declared policy of the unit (`reviewDeclaredPolicies`), each call an
	// ASSURANCE exchange whose subject is the UNIT itself — `PROFESSIONAL_WORK_UNIT`, never the PWA — so `REG-D-112` (c)'s
	// exclusion of the authoring floor's review keeps it. A sign-off comes after every phase has run.
	const row = (id: string, objectType: string, state: Record<string, unknown>, firstSequence: number) => ({
		id,
		objectType,
		state,
		firstSequence
	});
	const head = payloadHead('the-fixture-cwd');
	const composite = (text: string): string =>
		JSON.stringify({
			tools: head.tools,
			input: [head.instructionsMessage, { role: 'user', content: [{ type: 'input_text', text }] }]
		});
	/** One executor try of `unitId`, at `at`, that called no tool. */
	const tryOf = (id: string, unitId: string, at: string, n: number) =>
		row(
			id,
			'MODEL_EXCHANGE',
			{
				plane: 'EXECUTION',
				subjectObjectId: unitId,
				invokerId: 'execution.model-invocation:t',
				requestedAt: at,
				materializedInputRef: { status: 'STORED', storageKey: `payload-${id}` },
				rawOutputBeforeCoercionRef: { status: 'STORED', storageKey: 'answer' },
				observedToolCalls: { observation: 'OBSERVED', calls: [], observedCount: 0 }
			},
			n
		);
	const DECLARED_PROMPT = 'Judge the requirements of wordfreq against Requirement Coverage, criterion by criterion.';
	const input: RecorderInput = {
		store: {
			objects: [
				row('pwa', 'PROFESSIONAL_WORK_ARCHITECTURE', { publicationStatus: 'PUBLISHED', rootPwuTypeId: 'pwut' }, 1),
				tryOf('mex_req', 'pwu_req', '2026-10-11T08:00:00.000Z', 2),
				tryOf('mex_des', 'pwu_des', '2026-10-11T09:00:00.000Z', 3),
				// ⭐ Requirements' sign-off, AFTER Design ran: one declared review of it, its subject the unit itself.
				row(
					'mex_declared',
					'MODEL_EXCHANGE',
					{
						plane: 'ASSURANCE',
						invokerId: 'declared-policy-review',
						assurancePolicyId: 'pol_requirement_coverage',
						subjectObjectId: 'pwu_req',
						subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
						exchangeRole: 'INITIAL',
						disposition: 'ACCEPTED',
						requestedAt: '2026-10-11T10:00:00.000Z',
						respondedAt: '2026-10-11T10:00:05.000Z',
						resolvedModel: { value: 'fixture-reviewer-model' },
						resolvedProvider: { value: 'devin' },
						materializedInputRef: { status: 'STORED', storageKey: 'declared-prompt' },
						rawOutputBeforeCoercionRef: { status: 'STORED', storageKey: 'declared-reply' },
						parseOutcome: { outcome: 'PARSED' }
					},
					4
				)
			],
			events: [],
			content: null
		},
		content: new Map([
			['payload-mex_req', composite('Write the requirements.')],
			['payload-mex_des', composite('Design wordfreq.')],
			['answer', '{}'],
			['declared-prompt', DECLARED_PROMPT],
			['declared-reply', CLEAN]
		]),
		units: [
			{ slug: 'requirements', unitId: 'pwu_req', archive: '02-requirements' },
			{ slug: 'design', unitId: 'pwu_des', archive: '03-design' }
		],
		workspace: resolve(tmpdir(), 'jpwb-no-such-workspace'),
		home: resolve(tmpdir(), 'jpwb-no-such-home'),
		captures: new Map(),
		expectedMatrix: [{ stage: '5b', row: 'requirements', value: 'as intended' }],
		commit: 'c',
		reviewerFingerprint: 'f'
	};

	// ⛔ THE PREDICTED RED: the recorder names a call's unit by the last executor try before it (`unitAt`) — Design's, for a
	// sign-off that comes after Design ran — and reads a unit's subject type as no framing it knows.
	it('⛔ J3 — kept by the recorder, keyed by its full prompt, and named by its SUBJECT — the unit it reviewed, not the last to run — in the declared framing', () => {
		const built = buildRecording(input);
		expect(built.problems).toEqual([]);
		expect([
			built.authoringCallsLeftOut,
			built.recording?.reviewer.map((c) => [c.unit, c.framing, c.promptSha256])
		]).toEqual([0, [['requirements', 'declared-policy', sha(DECLARED_PROMPT)]]]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; design §12.3): a review's decision-model requests are ASSURANCE exchanges
	// of their own, made before its first reviewer call — never a reviewer call to replay, nor the authoring floor's call left out.
	// ⚠ What a replay serves for them is package Z2b's (Z1's departure 10); until then a replayed review is refused for its indications.
	// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z2b): ~~its row the declared review's own state, its prompt and reply~~ — the row
	// a decision-model request leaves, its body a request's (`decisionModelBody`) and its parse outcome the score read, since the
	// recorder now writes each request into the recording (the test below) and refuses a row it cannot read as one.
	const DM_MODEL = 'pplx-decider:27b-q4_K_M';
	const DM_MATERIAL = `Work unit: Requirements.\nThe files: ${input.workspace}${sep}docs${sep}requirements.md\n`;
	const C00 = { kind: 'check', key: 'c00', id: 'RC-01', label: 'Requirement RC-01 is covered.' } as const;
	const S00 = { kind: 'statement', key: 's00', statement: `requirements: R1 is written in ${input.workspace}${sep}docs.` } as const;
	const dm = (id: string, key: string, state: Record<string, unknown>, at: string, n: number) =>
		row(
			id,
			'MODEL_EXCHANGE',
			{
				plane: 'ASSURANCE',
				invokerId: 'reasoning-review',
				subjectObjectId: 'pwu_req',
				subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
				exchangeRole: 'INITIAL',
				resolvedModel: { value: DM_MODEL },
				resolvedProvider: { availability: 'REPORTED', evidence: 'PROVIDER_REPORTED', value: 'ollama' },
				requestedAt: at,
				respondedAt: at,
				materializedInputRef: { status: 'STORED', storageKey: key },
				...state
			},
			n
		);
	const DM_CONTENT: [string, string][] = [
		['dm-unload', unloadBody(DM_MODEL)],
		['dm-c00', decisionModelBody(DM_MODEL, DM_MATERIAL, C00)],
		['dm-s00', decisionModelBody(DM_MODEL, DM_MATERIAL, S00)]
	];
	const DM_ROWS = [
		dm('mex_dm_unload', 'dm-unload', { disposition: 'ACCEPTED', parseOutcome: { outcome: 'NOT_ATTEMPTED', detail: 'Step 1’s unload request: its answer is not read (D51).' } }, '2026-10-11T09:58:00.000Z', 4),
		dm('mex_dm_c00', 'dm-c00', { disposition: 'ACCEPTED', parseOutcome: { outcome: 'PARSED', detail: 'answers.c00.noul read: 0.12345678901234568' } }, '2026-10-11T09:59:00.000Z', 5),
		dm('mex_dm_s00', 'dm-s00', { disposition: 'NO_RESPONSE', parseOutcome: { outcome: 'TIMEOUT', detail: 'the request took more than 120 s (D51)' } }, '2026-10-11T09:59:30.000Z', 6)
	];
	const withRequests = (rows: readonly ReturnType<typeof row>[]): RecorderInput => ({
		...input,
		store: { ...input.store, objects: [...input.store.objects.slice(0, 3), ...rows, { ...input.store.objects[3]!, firstSequence: 9 }] },
		content: new Map([...input.content, ...DM_CONTENT])
	});
	it('⛔ Z2a (D51) — a decision model’s request is no reviewer call of the recording, and no authoring call left out', () => {
		// ~~const request = row('mex_dm', 'MODEL_EXCHANGE', { ...input.store.objects[3]!.state, resolvedModel: …, resolvedProvider: …, requestedAt: …, respondedAt: … }, 4);~~
		const built = buildRecording(withRequests([DM_ROWS[1]!]));
		expect(built.problems).toEqual([]);
		expect([
			built.authoringCallsLeftOut,
			built.recording?.reviewer.map((c) => [c.unit, c.framing, c.promptSha256])
		]).toEqual([0, [['requirements', 'declared-policy', sha(DECLARED_PROMPT)]]]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D51's record (Z1's departure 10; the brief's item 7): THE RECORDER WRITES EACH REQUEST INTO
	// THE RECORDING, in the order the run made them, for the replay to serve its review's indications from: its key, its model, its
	// body's hash with every string in it scrubbed (the workspace named inside the material and a statement found as the run spelled
	// it, never inside JSON's escapes), and its score or the reason it got none. Step 1's unload request asks no question: left out.
	it('⭐ Z2b (D51) — each decision-model request is written into the recording: key, model, scrubbed body hash, score or why none; the unload request left out', () => {
		const built = buildRecording(withRequests(DM_ROWS));
		expect(built.problems).toEqual([]);
		const pairs = scrubPairs({ WORKSPACE: input.workspace, PROCESS_OUTPUT: `${input.workspace}.process-output`, HOME: input.home });
		const scrubbed = (t: string) => scrubText(t, pairs);
		expect(scrubbed(DM_MATERIAL), 'arrangement: the material names the run’s workspace').not.toBe(DM_MATERIAL);
		expect(built.recording?.indications).toEqual([
			{
				key: 'c00',
				model: DM_MODEL,
				bodySha256: indicationBodySha256(decisionModelBody(DM_MODEL, scrubbed(DM_MATERIAL), C00), (t) => t),
				outcome: { kind: 'SCORED', score: 0.12345678901234568 }
			},
			{
				key: 's00',
				model: DM_MODEL,
				bodySha256: indicationBodySha256(decisionModelBody(DM_MODEL, scrubbed(DM_MATERIAL), { ...S00, statement: scrubbed(S00.statement) }), (t) => t),
				outcome: { kind: 'FAILED', reason: 'the request took more than 120 s (D51)' }
			}
		]);
	});

	it('⛔ Z2b — a decision-model row whose body is no request refuses the recording, writing nothing, named', () => {
		const built = buildRecording({
			...withRequests([DM_ROWS[1]!]),
			content: new Map([...input.content, ['dm-c00', 'not a request']])
		});
		expect(built.recording).toBeNull();
		expect(built.problems).toEqual(['decision-model request 1 (mex_dm_c00): its body is no decision-model request (D51), so it cannot be keyed']);
	});
});
