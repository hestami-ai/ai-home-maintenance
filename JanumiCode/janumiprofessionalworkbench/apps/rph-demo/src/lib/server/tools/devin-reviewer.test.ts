// JAN-TOOLSUITE TS-07 — the Devin assurance adapter.
//
// ~~⭑ THE SUBJECT OF MOST OF THIS FILE IS `diagnosticCarriesPrompt`, because it is what turns a DECLARATION into
// a CONTROL. The suite records Devin as `diagnostics: PROMPT_FREE`, measured by driving it — but a declaration
// that is merely trusted is exactly the "control that cannot fail" this repository keeps finding. Checking each
// diagnostic against the prompt actually sent means a wrong declaration fails SAFE.~~ ⭐ L17b4 (design D93; the lead's
// L4-Q3; the §15.5 (f) sweep) — `devinPrint` no longer measures its failure for the prompt: it records the failure's kind
// and names alone (`devinFailureRecord`), which holds no word of devin's, so no prompt can reach it. The measurement
// stays at the validator's seam (`sanitiseToolFailure`), which this file's first block holds as a pure function.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import {
	assuranceModel,
	// ⭐ L17b4 (the lead's §15.5 (c)) — devin's own sentence for a cut, which a value whose stdout throws is cut by.
	DEVIN_OUTPUT_LIMIT,
	DEVIN_REVIEWER_PREAMBLE,
	devinPrint,
	readReportedModel,
	resolveAssuranceModel,
	type DevinExec
} from './devin-reviewer.js';
// ⭑ THE LEAK CHECK MOVED TO A PURE MODULE so the ASSURANCE SEAM can use it without dragging
// `node:child_process` into the Validator. Adapter-level sanitising is a discipline; seam-level is a
// property, and TS-06 made it the seam's.
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';
import { OutputLimitReached } from './output-limit.js';
// ⭐⭐ Package X — D34 (`REG-F-590`) — the class a killed call is thrown as, its one reading and its one statement.
import { killedCallFacts, killedCallOf, ToolCallKilled } from './killed-call.js';

const LONG = 'Assess the northern delivery route against the safety rubric. '.repeat(8);

// ⭐⭐ L17b4 (design D93; `REG-F-685`; the lead's L4-Q2) — A FAILED CALL'S RECORD: its kind alone, and each known phrase by its name, in the lead's words.
/** The record of a failed devin call of `kind` (and its names), as the lead worded it. */
const recordOf = (kind: string): string =>
	`devin invocation failed (${kind}). Its diagnostic is not recorded (PER-12): execFile's message holds devin's command line, which names the ` +
	"call's folder, and devin's stderr, which holds its login banner (REG-F-685).";
/** A home folder named `fixture`, its parts joined here, so that no line of this file holds an absolute path. */
const FIXTURE_HOME = ['C:', 'Users', 'fixture'].join('\\');
/** What devin's stderr opens with: its login banner, with a made-up address at example.invalid. */
const BANNER = ' ✓ Logged in as fixture@example.invalid.\n ✓ Organization: Your Organization\n';
/** Text shaped as an e-mail address. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** What node's `execFile` rejects with when devin fails: the command line, its folder under the home folder, then devin's stderr, in its message. */
function devinRejection(o: { readonly code?: unknown; readonly signal?: unknown; readonly killed?: boolean; readonly syscall?: string; readonly stderr?: string }): Error {
	const folder = [FIXTURE_HOME, 'AppData', 'Local', 'Temp', 'jpwb-devin-fixture'].join('\\');
	const cmd = `devin --print --model glm-5-3-flash-max --prompt-file ${folder}\\prompt.txt --export ${folder}\\export.json --respect-workspace-trust false`;
	const stderr = `${BANNER}${o.stderr ?? ''}`;
	return Object.assign(new Error(`Command failed: ${cmd}\n${stderr}`), {
		code: o.code ?? null,
		killed: o.killed ?? false,
		signal: o.signal ?? null,
		cmd,
		stdout: '',
		stderr,
		...(o.syscall === undefined ? {} : { syscall: o.syscall })
	});
}
/** The three a record must never hold: execFile's own words, the home folder, and text shaped as an e-mail address. */
function holdsNoneOfTheThree(text: string, what: string): void {
	expect.soft(text, `${what} holds execFile's words`).not.toContain('Command failed');
	expect.soft(text, `${what} holds the home folder`).not.toContain(FIXTURE_HOME);
	expect.soft(text, `${what} holds an e-mail address`).not.toMatch(EMAIL);
}

describe('JAN-TOOLSUITE — the diagnostic is MEASURED for the prompt, not assumed clean', () => {
	it('⛔ catches a diagnostic that echoes the whole prompt', () => {
		// THE MUTANT: `return false` — i.e. trust the PROMPT_FREE declaration. The whole prompt then reaches a
		// projected VALIDATOR_EXECUTION_FAILED observation, which is finding #60, on a tool we merely believed.
		expect(diagnosticCarriesPrompt(`Command failed: ${LONG}`, LONG)).toBe(true);
	});

	it('⛔ catches a TRUNCATED echo from the middle and from the end', () => {
		// ⚠ A WHOLE-STRING COMPARISON MISSES THIS, and it is the case that matters: a tool that echoes part of
		// the prompt has still leaked it. THE MUTANT: compare only `diagnostic.includes(prompt)`.
		const middle = LONG.slice(Math.floor(LONG.length / 2), Math.floor(LONG.length / 2) + 120);
		const tail = LONG.slice(-120);
		expect(diagnosticCarriesPrompt(`error near: ${middle}`, LONG)).toBe(true);
		expect(diagnosticCarriesPrompt(`error near: ${tail}`, LONG)).toBe(true);
	});

	it('⭑ CONTROL — a genuinely clean diagnostic is NOT flagged, so the check is not "always withhold"', () => {
		// Without this, the fix destroys every diagnostic it was meant to save — repeating agy's disclosed loss
		// for no reason. This is the real message Devin returns for an unknown model, measured.
		const real =
			'Warning: Model "no-such-model" not found for provider "openai-codex".\n' +
			"Codex error: The 'no-such-model' model is not supported when using Codex with a ChatGPT account.";
		expect(diagnosticCarriesPrompt(real, LONG)).toBe(false);
	});

	it('⚠ a SHORT prompt is compared whole, so ordinary English does not false-positive', () => {
		// A 120-char probe taken from a 20-char prompt would match almost any sentence. THE MUTANT: use the
		// probe path for every length — the check then withholds diagnostics that leaked nothing.
		expect(diagnosticCarriesPrompt('the route is fine', 'the route is fine')).toBe(true);
		expect(diagnosticCarriesPrompt('some unrelated failure', 'the route is fine')).toBe(false);
	});

	it('an empty prompt cannot be leaked', () => {
		expect(diagnosticCarriesPrompt('anything at all', '   ')).toBe(false);
	});
});

describe('JAN-TOOLSUITE — Devin reports the model it actually ran', () => {
	it('⭑ reads generation_model back from an ATIF export', async () => {
		// ⚠ THE FIXTURE SHAPE IS DERIVED FROM A REAL EXPORT, not invented: `devin --export` emits ATIF-v1.7 with
		// `steps[].extra.generation_model`, and the LAST agent step carries the model that produced the answer.
		const dir = await mkdtemp(join(tmpdir(), 'jpwb-atif-'));
		const p = join(dir, 'export.json');
		await writeFile(
			p,
			JSON.stringify({
				schema_version: 'ATIF-v1.7',
				agent: { name: 'devin', version: '3000.6.14', model_name: 'GLM-5.2 High' },
				steps: [
					{ step_id: 1, source: 'system', extra: {} },
					{ step_id: 2, source: 'agent', extra: { generation_model: 'glm-5-2' } }
				]
			}),
			'utf8'
		);
		expect(await readReportedModel(p)).toBe('glm-5-2');
	});

	it('⭑ an unreadable export yields UNDEFINED — absence of evidence, not evidence of another model', async () => {
		// THE MUTANT: return the configured model on failure. The record would then claim the tool CONFIRMED an
		// identity it never reported, which is the fabricated-measurement defect the grade exists to prevent.
		expect(await readReportedModel(join(tmpdir(), 'jpwb-no-such-export.json'))).toBeUndefined();
	});
});

describe('JAN-TOOLSUITE — the reviewing model is configured, never pinned', () => {
	it('⛔ REFUSES when JPWB_ASSURANCE_MODEL is unset', () => {
		const saved = process.env.JPWB_ASSURANCE_MODEL;
		delete process.env.JPWB_ASSURANCE_MODEL;
		try {
			expect(() => assuranceModel()).toThrow(/JPWB_ASSURANCE_MODEL is not set/);
			// ⭑ And it must warn about the collision, or an operator sets it equal to the executor model and
			// meets an INDEPENDENCE_VIOLATION with no idea why.
			expect(() => assuranceModel()).toThrow(/must differ from JPWB_EXECUTOR_MODEL/);
		} finally {
			if (saved !== undefined) process.env.JPWB_ASSURANCE_MODEL = saved;
		}
	});

	it('⭑ CONTROL — a configured value is returned and trimmed', () => {
		expect(resolveAssuranceModel('glm-5-2')).toBe('glm-5-2');
		expect(resolveAssuranceModel('  glm-5-2 \n')).toBe('glm-5-2');
		expect(resolveAssuranceModel('  ')).toBeUndefined();
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 P7-6 (`DESIGN-the-reviewer-isolated.md` §2 I1, §4b I4; `REG-F-548`, `REG-F-549`, `REG-D-104`) ──
//
// In the measured run the reviewer ran in the SERVER's folder, auto-approved to read it (`REG-F-548`), and given a work
// product it reached for a tool, which ended its session (`REG-F-549`, the probes of §4a). The two fixes the sponsor
// chose (`REG-D-104` (2), "Prompt + isolate, test first") are both in `devinPrint`, so both are held HERE, through the
// exec seam, where a real devin is never started: what folder devin is given, what that folder holds, the argv, and
// the bytes of the prompt file.

/**
 * ⭐ THE DENY-ALL PROJECT CONFIG, AS THE PAID REPLAY WROTE IT (design §2 I1, §4c) — read back byte for byte from the
 * replay's own `.devin/config.json`, identical in all four of its folders: the seven names, two-space indented, one per
 * line, and a closing line break (150 bytes). ⛔ NOT the minified line the first build pinned (`P76F-A`): that was the
 * design's list written out by hand, never the file devin read when the deny rules were driven to hold.
 */
const DENY_ALL =
	'{\n  "permissions": {\n    "deny": [\n      "read",\n      "edit",\n      "grep",\n      "glob",\n      "exec",\n      "Fetch(*)",\n      "mcp__*"\n    ]\n  }\n}\n';

/**
 * ⭐ THE PREAMBLE'S BYTES, AS THE PAID REPLAY MEASURED THEM (`REG-D-104` (2); design §4c) — read back from the replay's
 * own prompt files, the first 355 bytes of every one of its eight: the three lines joined by `\n`, then `\n\n---\n`, and
 * the prompt starts on the very next line. Written here as ONE string literal (each `\n` a line break), so a change of
 * one character, a line break included, is a change to what was tested.
 * ⛔ CORRECTED (`P76F-A`): the first build ended it `\n\n---\n\n`, from a build note, and pinned this literal to the same
 * wrong bytes — a pin of the note, not of the measurement. ⚠ Not `JSON.parse` of a literal: doubled backslashes read as a
 * network path to this repository's own archive scan (`REG-F-536`).
 */
const MEASURED_PREAMBLE =
	'You are answering as a reviewer that has NO TOOLS. You cannot read files, list folders, run commands or fetch anything,\nand you must not try: any tool call ends this session without an answer. Everything you may judge is in the text below.\nJudge only that text, and reply with the single JSON object the instructions below ask for, and nothing else.\n\n---\n';

/** Every file under `dir`, as a path relative to it with forward slashes, sorted. */
function filesUnder(dir: string): string[] {
	const out: string[] = [];
	const walk = (d: string): void => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, e.name);
			if (e.isDirectory()) walk(p);
			else out.push(relative(dir, p).replaceAll('\\', '/'));
		}
	};
	walk(dir);
	return out.sort();
}

interface SeenCall {
	readonly file: string;
	readonly args: readonly string[];
	readonly options: Readonly<Record<string, unknown>>;
	/** What the folder devin was given held when devin started, or null when it was given none. */
	readonly listing: string[] | null;
	/** The bytes of `.devin/config.json` in that folder, or null. */
	readonly config: string | null;
	/** The bytes of the file `--prompt-file` names, or null. */
	readonly promptFile: string | null;
}

/**
 * A stand-in for the devin PROGRAM behind `devinPrint`'s exec seam: it records what it was handed — and, AT THE MOMENT
 * devin would start, what the folder it was given holds — then writes the export devin writes and answers.
 */
function standIn(answer = '{"findings":[],"recommendation":"SATISFIED"}') {
	const seen: SeenCall[] = [];
	const exec: DevinExec = async (file, args, options) => {
		const cwd = (options as { cwd?: unknown }).cwd;
		const promptPath = args[args.indexOf('--prompt-file') + 1];
		seen.push({
			file,
			args: [...args],
			options: { ...options },
			listing: typeof cwd === 'string' && existsSync(cwd) ? filesUnder(cwd) : null,
			config:
				typeof cwd === 'string' && existsSync(join(cwd, '.devin', 'config.json'))
					? readFileSync(join(cwd, '.devin', 'config.json'), 'utf8')
					: null,
			promptFile: promptPath !== undefined && existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : null
		});
		await writeFile(
			args[args.indexOf('--export') + 1]!,
			JSON.stringify({ steps: [{ step_id: 1, source: 'agent', extra: { generation_model: 'glm-test' } }] }),
			'utf8'
		);
		return { stdout: answer };
	};
	return { seen, exec };
}

describe('⭐⭐ P7-6 I1 — the reviewer runs isolated: its own fresh folder, every tool denied, the trust check off (REG-F-548)', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ devin is run IN the adapter’s own fresh folder, which holds only the prompt and the deny-all project config', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-test');
		const { seen, exec } = standIn();
		await devinPrint('Judge the work product.', exec);
		expect(seen, 'devin was run once').toHaveLength(1);
		const call = seen[0]!;
		const cwd = call.options.cwd;
		// ⛔ THE MUTANT: no `cwd`. devin then runs in the SERVER's folder, which is this repository's app, auto-approved
		// to read it — the arrangement `REG-F-548` records, in which a verdict reported what the reviewer found there.
		expect(cwd, 'devin is given a working folder of its own').toBeTypeOf('string');
		expect(resolve(cwd as string), 'not the server’s own folder').not.toBe(resolve(process.cwd()));
		expect(resolve(cwd as string).startsWith(resolve(tmpdir())), 'a temporary folder').toBe(true);
		// ⭐ ONLY THE PROMPT AND THE CONFIG, as devin starts: the export is devin's to write, after.
		expect(call.listing, 'what the folder holds when devin starts').toEqual(['.devin/config.json', 'prompt.txt']);
		// ⭐ The prompt file is IN that folder, so nothing devin is told to read lives outside it.
		expect(resolve(call.args[call.args.indexOf('--prompt-file') + 1]!), 'the prompt file is in that folder').toBe(
			resolve(cwd as string, 'prompt.txt')
		);
		expect(resolve(call.args[call.args.indexOf('--export') + 1]!), 'and so is the export devin writes').toBe(
			resolve(cwd as string, 'export.json')
		);
		// ⭐ AND THE FOLDER IS GONE AFTERWARDS — the `finally` still removes it, the config with it.
		expect(existsSync(cwd as string), 'the folder is removed once devin has answered').toBe(false);
	});

	it('⭐ the project config denies every tool by name — read, edit, grep, glob, exec, Fetch(*) and mcp__* — byte for byte', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-test');
		const { seen, exec } = standIn();
		await devinPrint('Judge the work product.', exec);
		// ⛔ THE MUTANT: a name dropped from the list. devin's permission rules check deny first and a deny always wins,
		// so the one tool not named is the one devin may still auto-approve (design §2 I1). Probe 1 (§4a) drove these
		// seven names to hold in print mode under devin 3000.11.3.
		// ⭐ AND THE FILE IS THE REPLAY'S, BYTE FOR BYTE (`P76F-A`): what ships is the file the measurement put in front of
		// devin, so no reading of "the same JSON, laid out differently" is left to a parser nobody has driven.
		expect(seen[0]!.config, 'the bytes of .devin/config.json').toBe(DENY_ALL);
		expect(JSON.parse(DENY_ALL), 'arrangement: the pinned bytes are the seven names').toEqual({
			permissions: { deny: ['read', 'edit', 'grep', 'glob', 'exec', 'Fetch(*)', 'mcp__*'] }
		});
	});

	it('⭐ the argv: print mode, the model, the prompt file, the export — and the workspace-trust check OFF', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-test');
		const { seen, exec } = standIn();
		await devinPrint('Judge the work product.', exec);
		const call = seen[0]!;
		// A folder that was not given is shown as such in the diff, rather than throwing before the argv is compared.
		const cwd = typeof call.options.cwd === 'string' ? call.options.cwd : '(no working folder given)';
		// ⛔ THE MUTANT: no `--respect-workspace-trust false`. A fresh folder is untrusted BY CONSTRUCTION, and devin
		// refuses `--print` in a folder it has not been told to trust (`REG-F-547`): every review would be refused in a
		// quarter of a second, as P7-3a's second attempt was.
		expect(call.args).toEqual([
			'--print',
			'--model',
			'glm-test',
			'--prompt-file',
			join(cwd, 'prompt.txt'),
			'--export',
			join(cwd, 'export.json'),
			'--respect-workspace-trust',
			'false'
		]);
		// ~~The bounds are unchanged (`REVIEWER_CALL_BOUND_MS.devin`, `thrown-reviewer-call.test.ts`).~~ ⛔ MOVED 2026-10-31 (package X
		// fix — the independent check's problem 1; design D35, revision 5): true when P7-6 B1 wrote it, stale since D35 — the kill
		// moved, 240 s to 480 s, with `REVIEWER_CALL_BOUND_MS.devin`, which `thrown-reviewer-call.test.ts` holds to the kill read at
		// this exec seam; the buffer and the window did not move.
		// ⛔ MOVED 2026-10-31 (`JAN-EXEC` Phase 7, package X; design D35, revision 5; `REG-F-590`) — ~~`timeout: 240_000`~~: devin's
		// kill is raised to 480 s, a planning figure (about twice the longest answered call, 231,362 ms); the buffer and the
		// window are unchanged.
		expect(call.options).toMatchObject({ timeout: 480_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
	});
});

describe('⭐⭐ P7-6 I2 — devin’s EXPORT of the session is read before its folder is removed, and returned with the answer (REG-F-351)', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ the result carries the export’s bytes, exactly as devin wrote them — the record of every step and any tool it called', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-test');
		const EXPORT = JSON.stringify({
			schema_version: 'ATIF-v1.7',
			steps: [{ step_id: 1, source: 'agent', extra: { generation_model: 'glm-test' }, tool_calls: [] }]
		});
		let folder = '';
		const exec: DevinExec = async (_file, args, options) => {
			folder = options.cwd;
			await writeFile(args[args.indexOf('--export') + 1]!, EXPORT, 'utf8');
			return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
		};
		const result = await devinPrint('Judge the work product.', exec);
		// ⛔ THE MUTANT: the export not returned. The `finally` removes the folder, so the bytes are gone by the time any
		// caller holds the answer — `readReportedModel`'s lesson, a second time: read it HERE, or never.
		expect(typeof result === 'string' ? undefined : result.sessionExport).toBe(EXPORT);
		expect(existsSync(folder), 'arrangement: the folder, export and all, is removed').toBe(false);
	});
});

describe('⭐⭐ P7-6 I4 — the reviewer is told it has NO TOOLS: the preamble before every prompt devinPrint writes (REG-D-104 (2))', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ the preamble is the bytes the paid replay measured, byte for byte, its line breaks included', () => {
		// ⛔ THE MUTANT: one character of it changed. The replay that passed the sponsor's gate (3 of 4 concluded, no tool
		// call in any of the four, design §4c) measured THESE bytes; another text is an untested one.
		expect(Buffer.byteLength(MEASURED_PREAMBLE, 'utf8'), 'arrangement: the replay’s preamble is 355 bytes').toBe(355);
		expect(DEVIN_REVIEWER_PREAMBLE).toBe(MEASURED_PREAMBLE);
	});

	it('⭐ the prompt file holds the preamble and then the prompt, exactly', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-test');
		const { seen, exec } = standIn();
		const prompt = 'Judge the work product.\nReturn ONLY a single-line minified JSON object.';
		await devinPrint(prompt, exec);
		// ⛔ THE MUTANT: the prompt written without the preamble — the reviewer is again an agent that may reach for a
		// tool, and in print mode a tool it may not use ends its session with no answer (`REG-F-549`, probe 2).
		expect(seen[0]!.promptFile).toBe(`${MEASURED_PREAMBLE}${prompt}`);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REPLY DEVIN ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT IS ITS OWN CLASS ──
//
// In P5, 7 of 44 reviewer calls ended so: devin exited non-zero with the two stderr lines below, and `devinPrint` threw
// its message alone — the partial reply, the exit code and the export devin wrote all dropped — so the call was recorded
// as one that got no reply. These cases throw what `execFile` really rejects with: the command and stderr in the message,
// the exit code, stdout and stderr beside it.

/** devin's stderr when it ends a reply at the model's output-token limit — verbatim from P5's seven records. */
const DEVIN_TRUNCATED_STDERR =
	'warning: response truncated (model hit max output token limit)\nError: Response truncated: model hit max output token limit. The output above is incomplete.\n';

/** How a fixture devin's call ends: its exit code (null for a kill, beside its signal), stdout and stderr. */
interface Exit {
	readonly code: number | null;
	readonly signal?: string;
	readonly stdout: string;
	readonly stderr: string;
}

/** What node's `execFile` rejects with when its program fails: the command and stderr in the message. */
function exitRejection(file: string, args: readonly string[], exit: Exit): Error {
	const cmd = [file, ...args].join(' ');
	return Object.assign(new Error(`Command failed: ${cmd}\n${exit.stderr}`), {
		code: exit.code,
		killed: exit.signal !== undefined,
		signal: exit.signal ?? null,
		cmd,
		stdout: exit.stdout,
		stderr: exit.stderr
	});
}

/**
 * A devin export as devin 3000.11.92 writes one (the shape of P5's 37 retained exports): the agent's step last, its
 * completion tokens counted, its model in `extra`. `extra` adds to the last step's.
 */
const exportOf = (completionTokens: number, extra: Record<string, unknown> = {}) =>
	JSON.stringify({
		schema_version: 'ATIF-v1.7',
		steps: [
			{ step_id: 1, source: 'user', message: 'the prompt', extra: {} },
			{
				step_id: 2,
				source: 'agent',
				model_name: 'GLM-5.3 Flash Max',
				message: '',
				reasoning_content: 'thinking',
				tool_calls: [],
				metrics: { prompt_tokens: 17_409, completion_tokens: completionTokens, cached_tokens: 4_480 },
				extra: { generation_model: 'glm-5-3-flash-max', ...extra }
			}
		]
	});

/** A devin that writes `exportBody` where its argv says (unless undefined), then fails as `exit` says. */
function failingDevin(exportBody: string | undefined, exit: Exit) {
	let folder = '';
	const exec: DevinExec = async (file, args, options) => {
		folder = options.cwd;
		if (exportBody !== undefined) await writeFile(args[args.indexOf('--export') + 1]!, exportBody, 'utf8');
		throw exitRejection(file, args, exit);
	};
	return { exec, folder: () => folder };
}

/** What `devinPrint` threw. */
async function thrownBy(p: Promise<unknown>): Promise<unknown> {
	return p.then(
		() => new Error('fixture: devinPrint resolved where it was to throw'),
		(e: unknown) => e
	);
}

describe('⭐⭐ P5 package A (F1) — a reply devin ended at the model’s output-token limit is thrown as its own class', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⛔ devin’s truncation on stderr: OutputLimitReached, with the export’s output tokens, the partial reply, the model and the export — the folder still removed', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const EXPORT = exportOf(25_000);
		const devin = failingDevin(EXPORT, { code: 1, stdout: '{"findings":[PARTIAL', stderr: DEVIN_TRUNCATED_STDERR });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: the catch keeps the message alone, as before — a plain Error, read downstream as a call with no reply.
		expect(thrown, 'the truncation was thrown as a plain failure').toBeInstanceOf(OutputLimitReached);
		const cut = thrown as OutputLimitReached;
		expect(cut.facts, 'what the export counted of the cut').toEqual({ outputTokens: 25_000 });
		expect(cut.partialReply, 'stdout, the reply devin printed before it cut it').toBe('{"findings":[PARTIAL');
		expect(cut.producer, 'the model the export names').toEqual({
			agentId: 'devin',
			modelId: 'glm-5-3-flash-max',
			providerId: 'devin'
		});
		expect(cut.sessionExport, 'the export devin wrote, read before the folder went').toBe(EXPORT);
		expect(cut.observedToolCalls.canObserve).toBe(false);
		// ~~⭐ The diagnostic is the one every failure carries, devin's own words in it, unchanged.~~ ⭐ RESTATED (L17b4, design D93; REG-F-685): the
		// message is the record every failure carries, its kind alone and devin's sentence by its name, never devin's words —
		// ~~`expect(cut.message).toMatch(/^devin invocation failed: Command failed: devin --print --model glm-5-3-flash-max /);`~~
		// ~~`expect(cut.message.endsWith(`\n${DEVIN_TRUNCATED_STDERR}`)).toBe(true);`~~
		expect(cut.message, 'the cut’s message is not its kind and the output limit’s name').toBe(recordOf("exited with code 1; its reply reached the model's output limit"));
		expect(existsSync(devin.folder()), 'arrangement: the folder, export and all, is removed').toBe(false);
	});

	it('⛔ the export’s finish_reason max_tokens, with stderr that names no truncation: the same class, the finish reason carried', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const devin = failingDevin(exportOf(25_000, { finish_reason: 'max_tokens' }), {
			code: 1,
			stdout: '',
			stderr: 'Error: the turn ended\n'
		});
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: the export's finish reason not read — only devin's sentence on stderr tells the class.
		expect(thrown, 'a finish reason of max_tokens was not read as the class').toBeInstanceOf(OutputLimitReached);
		expect((thrown as OutputLimitReached).facts).toEqual({ finishReason: 'max_tokens', outputTokens: 25_000 });
		expect((thrown as OutputLimitReached).partialReply).toBe('');
	});

	it('⛔ a finish reason that is not a bounded token is not carried — the class still told by devin’s sentence', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const devin = failingDevin(exportOf(25_000, { finish_reason: 'max tokens; and the prompt was: Judge' }), {
			code: 1,
			stdout: '',
			stderr: DEVIN_TRUNCATED_STDERR
		});
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		expect(thrown).toBeInstanceOf(OutputLimitReached);
		// ⛔ THE MUTANT: any string taken — tool-written free text would reach the record plane in E-5's detail.
		expect((thrown as OutputLimitReached).facts, 'free text carried as a finish reason').toEqual({
			outputTokens: 25_000
		});
	});

	// ⭐ RESTATED (L17b4, design D93; §11's rule for titles): ~~'⭐ CONTROL — every other non-zero exit is thrown as before: a plain Error, its message
	// unchanged'~~ — its message is the failure's kind alone now (REG-F-685), and names no phrase its stderr does not hold.
	it('⭐ CONTROL — every other non-zero exit is thrown as before: a plain Error, its message its kind alone (D93)', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const stderr = 'Error: upstream connection reset by peer\n';
		const devin = failingDevin(exportOf(812), { code: 1, stdout: '', stderr });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: every non-zero exit read as the class — a transport failure would claim a cut reply.
		expect(thrown, 'another failure was thrown as the output-limit class').not.toBeInstanceOf(OutputLimitReached);
		expect(thrown).toBeInstanceOf(Error);
		// ⭐ L17b4 (D93) — ~~`expect((thrown as Error).message).toMatch(/^devin invocation failed: Command failed: devin --print --model glm-5-3-flash-max /);`~~
		// ~~`expect((thrown as Error).message.endsWith(`\n${stderr}`)).toBe(true);`~~
		expect((thrown as Error).message, 'a plain exit’s message is not its kind alone, or names a phrase its stderr does not hold').toBe(recordOf('exited with code 1'));
	});

	it('⭐ CONTROL — a kill, which carries a signal and no exit code, is not the class, whatever stderr says', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const devin = failingDevin(exportOf(25_000), {
			code: null,
			signal: 'SIGTERM',
			stdout: '',
			stderr: DEVIN_TRUNCATED_STDERR
		});
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: the exit code not asked — a call killed at its bound, a timeout, would be recorded as a cut reply.
		expect(thrown, 'a kill was thrown as the output-limit class').not.toBeInstanceOf(OutputLimitReached);
		// ⭐ L17b4 (D93) — ~~`expect((thrown as Error).message).toMatch(/^devin invocation failed: Command failed: /);`~~ — the kill's kind, at its bound
		// (execFile made it), and the sentence its stderr holds by its name (the lead's L4-Q2: each phrase read from the message, whatever the kind).
		expect((thrown as Error).message).toBe(recordOf("killed by SIGTERM, at its time bound of 480000 ms; its reply reached the model's output limit"));
	});

	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q3, and §11's rule for titles): ~~'⛔ the prompt is still measured out of the diagnostic: a
	// truncation whose stderr echoes the prompt is the class, its diagnostic WITHHELD'~~ — the record holds no word of devin's, so no prompt it echoes
	// can reach it, and the check that measured it out has left this path.
	it('⛔ the prompt never reaches the record: a truncation whose stderr echoes the prompt is the class, its message its kind alone (D93)', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const devin = failingDevin(exportOf(25_000), {
			code: 1,
			stdout: '',
			stderr: `${LONG}\n${DEVIN_TRUNCATED_STDERR}`
		});
		const thrown = await thrownBy(devinPrint(LONG, devin.exec));
		expect(thrown).toBeInstanceOf(OutputLimitReached);
		// ⛔ THE MUTANT: the class's message built from the raw rejection — the prompt would reach E-5's detail (PER-12).
		// ⭐ L17b4 (D93) — ~~`expect((thrown as Error).message).toMatch(/^devin invocation failed\. Its diagnostic is WITHHELD/);`~~
		expect((thrown as Error).message).toBe(recordOf("exited with code 1; its reply reached the model's output limit"));
		expect(diagnosticCarriesPrompt((thrown as Error).message, LONG)).toBe(false);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package X — D34 (`REG-F-590`; `DESIGN-data-flow-order-and-deliverable-review.md` §10.5, revision 5) ──
// A call devin's program was KILLED during — a signal and no exit code, as `execFile` rejects at its `timeout` — is thrown as its
// own class, carrying what the kill left: whether devin had written its export, what that export's last agent step counted, how
// many characters devin printed before the kill, and the signal. ⛔ Before X the catch read the export only for an output-limit
// exit (`devinOutputLimit` returns nothing without a numeric exit code), so a kill was thrown with its diagnostic alone and the
// `finally` removed the folder with the export in it (`REG-F-554`). ⚠ Whether devin leaves either before a kill is untested
// (design D34): these cases hold what the catch reads of what it finds, whatever it finds.

/** What devin printed before the kill in the first case: 13 characters of a reply it never finished. */
const PRINTED = '{"findings":[';

describe('⭐⭐ package X — D34 — a call killed during its run is thrown with what it left: its export, its last step’s counts, what it printed, the signal', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// ⭐ RESTATED (L17b4, design D93; §11's rule for titles): ~~'⛔ PREDICTED RED — devin wrote an export and printed, then was killed: ToolCallKilled,
	// its facts carried, its diagnostic unchanged, the folder still removed'~~ — its message is the kill's kind alone now (REG-F-685).
	it('⛔ PREDICTED RED — devin wrote an export and printed, then was killed: ToolCallKilled, its facts carried, its message its kind alone (D93), the folder still removed', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin(exportOf(812, { finish_reason: 'stop' }), { code: null, signal: 'SIGTERM', stdout: PRINTED, stderr: '' });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: the facts dropped — the kill thrown with its diagnostic alone, as before X.
		expect(thrown, 'a kill was thrown with its diagnostic alone').toBeInstanceOf(ToolCallKilled);
		expect(killedCallOf(thrown), 'what the kill left').toEqual({
			signal: 'SIGTERM',
			printedChars: 13,
			exportWritten: true,
			lastStep: { finishReason: 'stop', outputTokens: 812 }
		});
		// ⭐ The diagnostic is the one every failure carries, ~~unchanged~~ ⭐ (L17b4, D93) its kind alone: the facts ride beside it, never in it.
		// ⭐ L17b4 — ~~`expect((thrown as Error).message).toMatch(/^devin invocation failed: Command failed: devin --print --model glm-5-3-flash-high /);`~~
		expect((thrown as Error).message).toBe(recordOf('killed by SIGTERM, at its time bound of 480000 ms'));
		expect((thrown as Error).message, 'the printed reply reached the diagnostic').not.toContain(PRINTED);
		expect(thrown, 'a kill is no cut at the output-token limit').not.toBeInstanceOf(OutputLimitReached);
		expect(existsSync(devin.folder()), 'arrangement: the folder, export and all, is removed').toBe(false);
	});

	it('⛔ PREDICTED RED — a kill before devin wrote any export or printed anything: the class, saying so', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin(undefined, { code: null, signal: 'SIGTERM', stdout: '', stderr: '' });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		expect(killedCallOf(thrown), 'a kill that left nothing').toEqual({ signal: 'SIGTERM', printedChars: 0, exportWritten: false, lastStep: {} });
	});

	it('⛔ a kill while the export was half written: written, and nothing counted from it — never a parse failure thrown in its place', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin('{"schema_version":"ATIF-v1.7","steps":[{"step_id":1,', { code: null, signal: 'SIGKILL', stdout: '', stderr: '' });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		expect(killedCallOf(thrown)).toEqual({ signal: 'SIGKILL', printedChars: 0, exportWritten: true, lastStep: {} });
	});

	it('⛔ a finish reason that is not a bounded token, and a signal that is not a signal’s name, are not carried as such', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin(exportOf(9, { finish_reason: 'stopped; and the prompt was: Judge' }), {
			code: null,
			signal: 'SIGTERM',
			stdout: '',
			stderr: ''
		});
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: any string taken — tool-written free text would reach the record plane in the validator's detail.
		expect(killedCallOf(thrown)?.lastStep, 'free text carried as a finish reason').toEqual({ outputTokens: 9 });
		// ⭐ And the statement names a signal only in its shape, whatever the class was handed.
		expect(killedCallFacts({ signal: 'SIGTERM; and more', printedChars: 0, exportWritten: false, lastStep: {} })).toBe(
			'killed by a signal not named, 0 characters printed on stdout before the kill, no export written'
		);
	});

	it('⭐ the one statement of the facts, as the validator’s detail and the transport’s TIMEOUT reason write it', () => {
		expect(killedCallFacts({ signal: 'SIGTERM', printedChars: 13, exportWritten: true, lastStep: { finishReason: 'stop', outputTokens: 812 } })).toBe(
			'killed by SIGTERM, 13 characters printed on stdout before the kill, its export written, whose last agent step counted output_tokens 812, finish_reason stop'
		);
		expect(killedCallFacts({ signal: 'SIGTERM', printedChars: 0, exportWritten: true, lastStep: {} })).toBe(
			'killed by SIGTERM, 0 characters printed on stdout before the kill, its export written, whose last agent step counted output_tokens not reported, finish_reason not reported'
		);
		expect(killedCallFacts({ signal: 'SIGTERM', printedChars: 0, exportWritten: false, lastStep: {} })).toBe(
			'killed by SIGTERM, 0 characters printed on stdout before the kill, no export written'
		);
		// ⛔ A finish reason the statement is handed is stated only in its shape, whatever the class carries.
		expect(
			killedCallFacts({ signal: 'SIGTERM', printedChars: 0, exportWritten: true, lastStep: { finishReason: 'stop; and the prompt was: Judge', outputTokens: 1 } })
		).toBe(
			'killed by SIGTERM, 0 characters printed on stdout before the kill, its export written, whose last agent step counted output_tokens 1, finish_reason not reported'
		);
	});

	it('⭑ CONTROL — a non-zero exit is no kill: a plain Error, or the output-limit class for a cut, as before — never ToolCallKilled', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const plain = await thrownBy(
			devinPrint('Judge the work product.', failingDevin(exportOf(812), { code: 1, stdout: '', stderr: 'Error: connection reset\n' }).exec)
		);
		expect(plain, 'an exit was read as a kill').not.toBeInstanceOf(ToolCallKilled);
		expect(plain).toBeInstanceOf(Error);
		const cut = await thrownBy(
			devinPrint('Judge the work product.', failingDevin(exportOf(25_000), { code: 1, stdout: '', stderr: DEVIN_TRUNCATED_STDERR }).exec)
		);
		expect(cut).toBeInstanceOf(OutputLimitReached);
		expect(killedCallOf(cut)).toBeUndefined();
	});

	it('⭑ CONTROL — a rejection whose signal is not a signal’s name is no kill: never carried onto the record as one', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin(exportOf(812), { code: null, signal: 'not a signal; the prompt was: Judge', stdout: '', stderr: '' });
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin.exec));
		// ⛔ THE MUTANT: the signal's shape not asked — free text would reach the record as a kill's signal.
		expect(thrown, 'a rejection with no signal’s name was read as a kill').not.toBeInstanceOf(ToolCallKilled);
		expect(thrown).toBeInstanceOf(Error);
	});

	it('⭑ CONTROL — a spawn that failed, a string code and no signal, is no kill', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin: DevinExec = async () => {
			// ⭐ L17b4 (D93) — ~~`throw Object.assign(new Error('spawn devin ENOENT'), { code: 'ENOENT' });`~~ — the spawn's error as node gives it, its
			// `syscall` beside its code, which the record reads to say the program could not start.
			throw Object.assign(new Error('spawn devin ENOENT'), { code: 'ENOENT', errno: -4058, syscall: 'spawn devin', path: 'devin' });
		};
		const thrown = await thrownBy(devinPrint('Judge the work product.', devin));
		expect(thrown).not.toBeInstanceOf(ToolCallKilled);
		// ⭐ L17b4 (D93) — ~~`expect((thrown as Error).message).toBe('devin invocation failed: spawn devin ENOENT');`~~
		expect((thrown as Error).message).toBe(recordOf('could not start: ENOENT'));
	});

	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q3, and §11's rule for titles): ~~'⛔ the prompt is still measured out of the diagnostic: a kill
	// whose rejection echoes the prompt is the class, its diagnostic WITHHELD'~~ — the record holds no word of devin's, so no prompt it echoes can reach it.
	it('⛔ the prompt never reaches the record: a kill whose rejection echoes the prompt is the class, its message its kind alone (D93)', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-high');
		const devin = failingDevin(undefined, { code: null, signal: 'SIGTERM', stdout: '', stderr: `${LONG}\n` });
		const thrown = await thrownBy(devinPrint(LONG, devin.exec));
		expect(thrown).toBeInstanceOf(ToolCallKilled);
		// ⭐ L17b4 (D93) — ~~`expect((thrown as Error).message).toMatch(/^devin invocation failed\. Its diagnostic is WITHHELD/);`~~
		expect((thrown as Error).message).toBe(recordOf('killed by SIGTERM, at its time bound of 480000 ms'));
		expect(diagnosticCarriesPrompt((thrown as Error).message, LONG)).toBe(false);
	});
});

// ⭐⭐ L17b4 — design D93 (`REG-F-685`; the lead's L4-Q2) — A FAILED devin CALL IS RECORDED BY ITS KIND ALONE, by one definition
// (`devinFailureRecord`): an exit by its code; a kill by its signal, and its bound only where execFile made the kill (`killed`); a start that failed by
// the spawn's code; any other string code as itself; and anything else, a code or a signal of the wrong shape among it, as none of these. Never
// devin's own words: its command line names the call's folder under the home folder, and its stderr opens with its login banner.
describe('⭐⭐ L17b4 (D93; REG-F-685) — a failed devin call records its kind alone, by one definition', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});
	/** What `devinPrint` throws when its program throws `thrown`. */
	const recorded = async (thrown: unknown): Promise<string> => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
		const e = await thrownBy(
			devinPrint('Judge the work product.', async () => {
				throw thrown;
			})
		);
		return e instanceof Error ? e.message : String(e);
	};

	it('⛔ RED FIRST — an exit, a kill at its bound and a start that failed, from a devin whose error holds a command line under a home folder and a login banner: each records its kind, and no Command failed, no home folder and no e-mail address', async () => {
		const exit = devinRejection({ code: 1, stderr: 'Error: the session ended\n' });
		expect([exit.message.includes('Command failed'), exit.message.includes(FIXTURE_HOME), EMAIL.test(exit.message)], 'arrangement: the rejection holds all three').toEqual([
			true,
			true,
			true
		]);
		const spawn = Object.assign(new Error('spawn devin ENOENT'), { code: 'ENOENT', errno: -4058, syscall: 'spawn devin', path: 'devin', spawnargs: exit.message.split(' ') });
		const cases: readonly (readonly [string, unknown, string])[] = [
			['an exit', exit, recordOf('exited with code 1')],
			['a kill at its bound', devinRejection({ killed: true, signal: 'SIGTERM' }), recordOf('killed by SIGTERM, at its time bound of 480000 ms')],
			['a start that failed', spawn, recordOf('could not start: ENOENT')]
		];
		for (const [what, thrown, record] of cases) {
			const message = await recorded(thrown);
			expect.soft(message, `${what}: its record is not its kind alone`).toBe(record);
			holdsNoneOfTheThree(message, `${what}'s record`);
		}
	});

	it('⛔ RED FIRST — a kill execFile did not make (no `killed`) is recorded by its signal, with no bound: a signal is not a bound', async () => {
		const message = await recorded(devinRejection({ signal: 'SIGKILL' }));
		expect(message, 'a kill from outside is recorded at the call’s bound').toBe(recordOf('killed by SIGKILL'));
		holdsNoneOfTheThree(message, 'the outside kill’s record');
	});

	it('⛔ RED FIRST — a string code where the program had started (its output overran maxBuffer) is recorded as failed with its code, not as a start that failed', async () => {
		const overran = Object.assign(new RangeError('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', cmd: devinRejection({}).message });
		const message = await recorded(overran);
		expect(message, 'the overrun is not recorded as a failure with its code').toBe(recordOf('failed with code ERR_CHILD_PROCESS_STDIO_MAXBUFFER'));
		holdsNoneOfTheThree(message, 'the overrun’s record');
	});

	it('⛔ RED FIRST — a code or a signal of the wrong shape, and a throw with neither, are recorded as failed with no exit code, signal or error code: no free text rides in', async () => {
		const none = recordOf('failed with no exit code, signal or error code');
		const freeText = 'ENOENT; and the prompt was: Judge';
		const wrongCode = await recorded(devinRejection({ code: freeText, syscall: 'spawn devin' }));
		expect.soft(wrongCode, 'a string code of the wrong shape is carried').toBe(none);
		const wrongSignal = await recorded(devinRejection({ signal: `SIGTERM; ${freeText}`, killed: true }));
		expect.soft(wrongSignal, 'a signal of the wrong shape is carried').toBe(none);
		const plain = await recorded(new Error('devin exited with code 1: connection reset by peer'));
		expect.soft(plain, 'a throw with no code and no signal is not recorded as none of the kinds').toBe(none);
		for (const [what, text] of [['the wrong code', wrongCode], ['the wrong signal', wrongSignal], ['the plain throw', plain]] as const) {
			expect.soft(text, `${what}'s free text rides in`).not.toContain('the prompt was');
			holdsNoneOfTheThree(text, `${what}'s record`);
		}
	});

	// ⭐⭐ L17b4 — design D93 (the lead's §15.5 (c); `L4C-A02`) — EVERY READ OF THE THROWN VALUE IN `devinPrint`'s CATCH IS GUARDED: its message, code, signal,
	// stdout, `killed` and `syscall`. A reader that throws falls back to its safe default, and whatever is thrown carries the safe record alone — never the
	// read's own throw, whose words the writer would record in the record's place (`describedThrow`). ⭑ A value of a shape no native execFile error has: one
	// property's getter throws, its words the fixture's command line, home folder and banner; every other property is execFile's.
	it('⛔ RED FIRST — L17b4 (§15.5 (c); L4C-A02): a thrown value one of whose properties throws when read — its message, code, signal, stdout, killed or syscall — is recorded by its safe record alone, and nothing the read throws escapes', async () => {
		const secret = devinRejection({ code: 1 }).message;
		/** execFile's error `o`, its `key` read through a getter that throws `secret`. */
		const throwingAt = (key: string, o: Parameters<typeof devinRejection>[0]): Error => {
			const e = devinRejection(o);
			Object.defineProperty(e, key, {
				get: () => {
					throw new Error(secret);
				},
				configurable: true
			});
			return e;
		};
		const cut = `Error: ${DEVIN_OUTPUT_LIMIT}. The output above is incomplete.\n`;
		// ⭐ L17b4 (round 3, l17b4-facts.md §16.4) — and the class each is thrown as, with the facts it carries: a reader whose own read is guarded keeps the
		// class its readable facts make the call — the cut, the kill — where a reader that threw would fall back to none (`.catch` at its call). So a guard
		// lost behind that fallback is seen here, where the record's words alone would not show it.
		const cases: readonly (readonly [string, Error, string, string])[] = [
			['its message', throwingAt('message', { code: 1 }), recordOf('exited with code 1'), 'Error'],
			['its code', throwingAt('code', { code: 1 }), recordOf('failed with no exit code, signal or error code'), 'Error'],
			['its signal', throwingAt('signal', { killed: true, signal: 'SIGTERM' }), recordOf('failed with no exit code, signal or error code'), 'Error'],
			['its stdout, on a cut', throwingAt('stdout', { code: 1, stderr: cut }), recordOf("exited with code 1; its reply reached the model's output limit"), 'OutputLimitReached'],
			['its stdout, on a kill', throwingAt('stdout', { killed: true, signal: 'SIGTERM' }), recordOf('killed by SIGTERM, at its time bound of 480000 ms'), 'ToolCallKilled'],
			['its killed', throwingAt('killed', { signal: 'SIGTERM' }), recordOf('killed by SIGTERM'), 'ToolCallKilled'],
			['its syscall', throwingAt('syscall', { code: 'ENOENT' }), recordOf('failed with code ENOENT'), 'Error']
		];
		/** What `devinPrint` throws when its program throws `thrown`. */
		const thrownFor = async (thrown: unknown): Promise<unknown> => {
			vi.stubEnv('JPWB_ASSURANCE_MODEL', 'glm-5-3-flash-max');
			return thrownBy(
				devinPrint('Judge the work product.', async () => {
					throw thrown;
				})
			);
		};
		const classOf = (e: unknown): string =>
			e instanceof OutputLimitReached ? 'OutputLimitReached' : e instanceof ToolCallKilled ? 'ToolCallKilled' : e instanceof Error ? 'Error' : 'not an Error';
		for (const [what, thrown, record, thrownAs] of cases) {
			const e = await thrownFor(thrown);
			const message = e instanceof Error ? e.message : String(e);
			expect.soft(message, `a value whose ${what.slice(4)} throws when read: its record is not the safe record alone`).toBe(record);
			holdsNoneOfTheThree(message, `the record of a value whose ${what.slice(4)} throws`);
			expect.soft(classOf(e), `a value whose ${what.slice(4)} throws when read: it is not thrown as the class its readable facts make it`).toBe(thrownAs);
			if (thrownAs === 'OutputLimitReached')
				expect.soft(e instanceof OutputLimitReached ? e.partialReply : '(not the cut)', 'the cut whose stdout cannot be read carries no partial reply').toBe('');
			if (thrownAs === 'ToolCallKilled')
				expect.soft(e instanceof ToolCallKilled ? e.killed.printedChars : -1, `the kill whose ${what.slice(4)} cannot be read does not count none printed`).toBe(0);
		}
	});
});

// ⭐ `JAN-EXEC` Phase 7, package Z3 — D46: devin's free-tier refusal, waited out and the same call made again, is measured in
// `devin-free-tier.test.ts`, where every row hands `devinPrint` its wait (that file's header says why it is not here).
