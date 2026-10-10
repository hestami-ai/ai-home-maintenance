// JAN-TOOLSUITE TS-07 — the Devin assurance adapter.
//
// ⭑ THE SUBJECT OF MOST OF THIS FILE IS `diagnosticCarriesPrompt`, because it is what turns a DECLARATION into
// a CONTROL. The suite records Devin as `diagnostics: PROMPT_FREE`, measured by driving it — but a declaration
// that is merely trusted is exactly the "control that cannot fail" this repository keeps finding. Checking each
// diagnostic against the prompt actually sent means a wrong declaration fails SAFE.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import {
	assuranceModel,
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

const LONG = 'Assess the northern delivery route against the safety rubric. '.repeat(8);

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

/** The deny-all project config, byte for byte as design §2 I1 names it. */
const DENY_ALL = '{"permissions":{"deny":["read","edit","grep","glob","exec","Fetch(*)","mcp__*"]}}';

/**
 * ⭐ THE PREAMBLE'S BYTES, AS THE PAID REPLAY MEASURED THEM (`REG-D-104` (2); design §4c) — the design's JSON string
 * literal, written here as ONE string literal with the same escapes (each `\n` a line break), so a change of one
 * character, a line break included, is a change to what was tested. ⚠ Not `JSON.parse` of the literal: its doubled
 * backslashes read as a network path to this repository's own archive scan (`REG-F-536`).
 */
const MEASURED_PREAMBLE =
	'You are answering as a reviewer that has NO TOOLS. You cannot read files, list folders, run commands or fetch anything,\nand you must not try: any tool call ends this session without an answer. Everything you may judge is in the text below.\nJudge only that text, and reply with the single JSON object the instructions below ask for, and nothing else.\n\n---\n\n';

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
		expect(seen[0]!.config, 'the bytes of .devin/config.json').toBe(DENY_ALL);
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
		// The bounds are unchanged (`REVIEWER_CALL_BOUND_MS.devin`, `thrown-reviewer-call.test.ts`).
		expect(call.options).toMatchObject({ timeout: 240_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
	});
});

describe('⭐⭐ P7-6 I4 — the reviewer is told it has NO TOOLS: the preamble before every prompt devinPrint writes (REG-D-104 (2))', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ the preamble is the bytes the paid replay measured, byte for byte, its line breaks included', () => {
		// ⛔ THE MUTANT: one character of it changed. The replay that passed the sponsor's gate (3 of 4 concluded, no tool
		// call in any of the four, design §4c) measured THESE bytes; another text is an untested one.
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
