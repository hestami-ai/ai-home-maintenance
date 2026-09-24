// ⭐ `JAN-CRITREAD` J2-2 — THE TRANSPORTS AND HOW THE RUNNER LOADS (DESIGN-what-the-tests-prove.md §5.3; ROADMAP J2-2;
// `REG-D-072` D11, D12, D14).
//
// Two kinds of transport stand behind the validator's `print` seam. The product's own `agyPrint` and `devinPrint`,
// deployable, with their own bounds; and a harness Ollama transport, NOT deployable, rebuilt from `REG-F-427`'s scratch
// shim — which unloads the model before every call, records the served template's hash and the server's clock, and
// re-imposes the bounds an injected `print` would bypass (240 s, and the 28,000-character prompt limit).
//
// ⛔ NO MODEL IS CALLED HERE. `agyPrint` is driven through its exec seam, `devinPrint` is stood in for, and Ollama is a
// local HTTP server this file starts. What is asserted is what each transport SENDS, what it RECORDS, and how it
// CLASSIFIES a failure:
//   · D12 — the runner refuses `JPWB_AGY_BIN` / `JPWB_DEVIN_BIN` before a transport module is loaded; it sets the
//     model variable to the RECORDED label; and it asserts agy's argv through the exec seam, so the recorded label is
//     the `--model` the program was actually given.
//   · A TIMEOUT AND A REFUSAL ARE CLASSIFIED APART, on every transport.
//   · D11 — the CLI runs from SOURCE (`bun --conditions=source`), and refuses to run on built `dist`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import * as agyCli from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { assuranceModel } from '../apps/rph-demo/src/lib/server/tools/devin-reviewer.js';
import { CASE_SET_V1_FILE, type CaseSet } from '../scripts/reviewer-qual/cases.js';
import {
	createOllamaTransport,
	OLLAMA_BOUND_MS
} from '../scripts/reviewer-qual/ollama-transport.js';
import {
	HarnessRefusal,
	PROGRAM_OVERRIDE_VARIABLES,
	sourceResolutionProblem
} from '../scripts/reviewer-qual/preflight.js';
import { recordProblems, type CallLine, type RunLine } from '../scripts/reviewer-qual/record.js';
import { main } from '../scripts/reviewer-qual/run.js';
import { runQualification, type RunFingerprint } from '../scripts/reviewer-qual/runner.js';
import {
	AGY_PRINT_TIMEOUT_MS,
	createAgyTransport,
	createDevinTransport,
	loadTransport,
	TransportFailure,
	type Transport
} from '../scripts/reviewer-qual/transports.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
const TWO = CASES.filter((c) => c.id === 'G-CLEAN' || c.id === 'W-CLEAN');
const LABEL = 'gemini-3.1-pro-high';
const FINGERPRINT: RunFingerprint = {
	reviewer: 'a'.repeat(64),
	scoring: 'b'.repeat(64),
	caseSet: 'c'.repeat(64)
};
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
		criterionId: k.id,
		failed: false,
		statement: 'absent'
	})),
	recommendation: 'SATISFIED'
});
type Exec = agyCli.AgyExec;
interface Spawned {
	readonly file: string;
	readonly args: readonly string[];
	readonly options: { timeout: number; maxBuffer: number; windowsHide: boolean };
}
const capturing =
	(spawned: Spawned[], stdout = CLEAN): Exec =>
	async (file, args, options) => {
		spawned.push({ file, args: [...args], options });
		return { stdout };
	};
const ticking = (step = 5) => {
	let t = 0;
	return () => (t += step);
};
/** Nothing the product reads may leak in from the developer's own shell. */
const cleanEnv = () => {
	for (const v of [...PROGRAM_OVERRIDE_VARIABLES, 'JPWB_JUDGE_MODEL', 'JPWB_ASSURANCE_MODEL'])
		vi.stubEnv(v, undefined);
};
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('JAN-CRITREAD J2-2 — the product transports (REG-D-072 D12)', () => {
	it('⛔ loadTransport refuses JPWB_AGY_BIN or JPWB_DEVIN_BIN for every transport, before it writes or loads anything', async () => {
		for (const variable of PROGRAM_OVERRIDE_VARIABLES)
			for (const transport of ['agy', 'devin', 'ollama'] as const) {
				const env: Record<string, string | undefined> = { [variable]: 'C:/stand-in/program.exe' };
				await expect(
					loadTransport(
						{
							transport,
							modelLabel: LABEL,
							ollama: { baseUrl: 'http://127.0.0.1:9', options: {} }
						},
						env
					),
					`${transport} with ${variable}`
				).rejects.toThrow(HarnessRefusal);
				expect(Object.keys(env), `${transport}: no model variable written`).toEqual([variable]);
			}
	});

	it('⛔ the recorded model label equals the argv’s --model — the runner sets the variable, whatever the shell had', async () => {
		cleanEnv();
		vi.stubEnv('JPWB_JUDGE_MODEL', 'a-decoy-the-runner-must-replace');
		const spawned: Spawned[] = [];
		const transport = await loadTransport({ transport: 'agy', modelLabel: LABEL }, process.env, {
			agyExec: capturing(spawned)
		});
		const lines = await runQualification({
			runId: 'qr-agy-1',
			date: '2026-09-24T12:00:00.000Z',
			commit: 'e5f9358b'.repeat(5),
			fingerprint: FINGERPRINT,
			cases: TWO,
			caseSetVersion: 1,
			oracleVersion: 1,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			transport,
			repetitions: 1,
			env: process.env
		});
		const run = lines[0] as RunLine;
		const calls = lines.slice(1) as CallLine[];
		expect(spawned).toHaveLength(2);
		for (const s of spawned) {
			expect(s.args[s.args.indexOf('--model') + 1], 'the argv’s --model').toBe(
				run.candidate.modelLabel
			);
			expect(s.file, 'the product’s own program').toBe('agy');
			expect(s.options.timeout, 'the product’s 240 s kill').toBe(240_000);
		}
		expect(run.candidate).toMatchObject({
			transport: 'agy',
			agentId: 'agy',
			provider: 'google',
			modelLabel: LABEL,
			bounds: {
				wallClockMs: 240_000,
				promptChars: agyCli.MAX_AGY_PROMPT_CHARS,
				printTimeout: '3m'
			},
			argv: ['--print', '<prompt>', '--print-timeout', '3m', '--model', LABEL]
		});
		expect(run.deployable).toBe(true);
		for (const c of calls) expect(c.evaluator.modelId).toBe(LABEL);
		expect(
			recordProblems(lines.map((l) => `${JSON.stringify(l)}\n`).join(''), { tracked: true })
		).toEqual([]);
	});

	it('⛔ the argv assertion refuses a program captured at module load, and a model changed after loading — before anything is spawned', async () => {
		cleanEnv();
		vi.resetModules();
		vi.stubEnv('JPWB_AGY_BIN', 'C:/stand-in/agy-shim.exe');
		const tainted = await import('../apps/rph-demo/src/lib/server/assurance/agy-cli.js');
		vi.stubEnv('JPWB_AGY_BIN', undefined);
		// ⚠ The tainted instance is this test's alone. Left in the registry, every later `loadTransport` would load it —
		// and be refused by exactly this assertion, which is the hazard it exists for, but not the limb under test.
		vi.resetModules();
		vi.stubEnv('JPWB_JUDGE_MODEL', LABEL);
		const spawned: Spawned[] = [];
		await expect(
			createAgyTransport(tainted, LABEL, { agyExec: capturing(spawned) }).call('a prompt')
		).rejects.toThrow(
			'agy argv: the program is "C:/stand-in/agy-shim.exe", not the product’s own "agy"'
		);
		const loaded = await loadTransport({ transport: 'agy', modelLabel: LABEL }, process.env, {
			agyExec: capturing(spawned)
		});
		vi.stubEnv('JPWB_JUDGE_MODEL', 'changed-after-loading');
		await expect(loaded.call('a prompt')).rejects.toThrow(
			`agy argv: --model is "changed-after-loading", not the recorded label "${LABEL}"`
		);
		expect(spawned, 'refused before the real program would have been started').toEqual([]);
	});

	it('⭐ a timeout and a refusal are classified apart on agy — the kill, agy’s own print timeout, a non-zero exit, a spawn failure, an over-long prompt', async () => {
		cleanEnv();
		vi.stubEnv('JPWB_JUDGE_MODEL', LABEL);
		const failing =
			(fields: object): Exec =>
			async () => {
				throw Object.assign(new Error('Command failed: agy --print <THE WHOLE PROMPT>'), fields);
			};
		const classify = async (exec: Exec, prompt = 'a prompt', now = ticking()) => {
			const err = await createAgyTransport(agyCli, LABEL, { agyExec: exec, now })
				.call(prompt)
				.then(
					() => undefined,
					(e: unknown) => e
				);
			expect(err, 'a transport failure').toBeInstanceOf(TransportFailure);
			expect(
				(err as TransportFailure).reason,
				'the reason is the harness’s, never the diagnostic'
			).not.toContain('PROMPT');
			return (err as TransportFailure).failureClass;
		};
		expect(
			await classify(failing({ killed: true, signal: 'SIGTERM', code: null })),
			'killed at the 240 s bound'
		).toBe('TIMEOUT');
		expect(
			await classify(failing({ code: 1 }), 'a prompt', ticking(AGY_PRINT_TIMEOUT_MS)),
			'agy’s own 3-minute print timeout'
		).toBe('TIMEOUT');
		expect(await classify(failing({ code: 1 })), 'a prompt refused at once').toBe('REFUSAL');
		expect(await classify(failing({ code: 'ENOENT' })), 'no program to spawn').toBe('REFUSAL');
		expect(
			await classify(failing({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true })),
			'output over maxBuffer'
		).toBe('REFUSAL');
		const spawned: Spawned[] = [];
		expect(
			await classify(capturing(spawned), 'x'.repeat(agyCli.MAX_AGY_PROMPT_CHARS + 1)),
			'over the argv budget'
		).toBe('REFUSAL');
		expect(spawned, 'the over-long prompt never reached the program').toEqual([]);
		expect(AGY_PRINT_TIMEOUT_MS).toBe(180_000);
	});

	it('⛔ a signal is a TIMEOUT only when execFile’s own kill sent it, or the call ran past the bound — a crash or an outside kill is a REFUSAL, in the harness’s words', async () => {
		cleanEnv();
		vi.stubEnv('JPWB_JUDGE_MODEL', LABEL);
		const failing =
			(fields: object): Exec =>
			async () => {
				throw Object.assign(new Error('Command failed: agy --print <THE WHOLE PROMPT>'), fields);
			};
		const outcome = async (fields: object, step = 5) => {
			const e = (await createAgyTransport(agyCli, LABEL, {
				agyExec: failing(fields),
				now: ticking(step)
			})
				.call('a prompt')
				.catch((x: unknown) => x)) as TransportFailure;
			expect(e, JSON.stringify(fields)).toBeInstanceOf(TransportFailure);
			return { failureClass: e.failureClass, reason: e.reason };
		};
		// A crash 5 ms in: no bound was reached and execFile killed nothing.
		const crash = await outcome({ killed: false, signal: 'SIGSEGV', code: null });
		expect(crash.failureClass, 'SIGSEGV at 5 ms').toBe('REFUSAL');
		expect(crash.reason, 'named for what happened, by the harness').toBe(
			'terminated by SIGSEGV after 5 ms, before any bound — not execFile’s kill'
		);
		expect(
			(await outcome({ killed: false, signal: 'SIGKILL', code: null })).failureClass,
			'killed from outside at 5 ms'
		).toBe('REFUSAL');
		// The controls: execFile's own kill, and a signal that arrives past the bound, are the bound.
		expect(
			(await outcome({ killed: true, signal: 'SIGTERM', code: null })).failureClass,
			'execFile’s kill'
		).toBe('TIMEOUT');
		expect(
			(await outcome({ killed: false, signal: 'SIGTERM', code: null }, AGY_PRINT_TIMEOUT_MS))
				.failureClass,
			'a signal past agy’s own bound'
		).toBe('TIMEOUT');
	});

	it('⭐ devin — the runner sets JPWB_ASSURANCE_MODEL to the label the product then resolves; a timeout and a refusal classified apart', async () => {
		cleanEnv();
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'a-decoy-the-runner-must-replace');
		await loadTransport({ transport: 'devin', modelLabel: 'glm-5-2' }, process.env);
		expect(assuranceModel(), 'the product’s own resolution').toBe('glm-5-2');
		const refusing = (at: number) =>
			createDevinTransport(
				{
					devinPrint: async () => {
						throw new Error('devin invocation failed: exit 1');
					},
					resolveAssuranceModel: () => 'glm-5-2'
				},
				'glm-5-2',
				{ now: ticking(at) }
			);
		const cls = async (t: ReturnType<typeof refusing>) =>
			((await t.call('p').catch((e: unknown) => e)) as TransportFailure).failureClass;
		expect(await cls(refusing(240_000)), 'failed at the 240 s bound').toBe('TIMEOUT');
		expect(await cls(refusing(5)), 'failed at once').toBe('REFUSAL');
		const identity = await refusing(5).identify();
		expect(identity).toMatchObject({
			transport: 'devin',
			agentId: 'devin',
			provider: 'devin',
			modelLabel: 'glm-5-2',
			argv: null
		});
	});

	it('⛔ a blank or padded model label is the HARNESS’s fault — refused on every transport before anything is written (the product trims it, so the label recorded would not be the model run)', async () => {
		cleanEnv();
		for (const transport of ['agy', 'devin', 'ollama'] as const)
			for (const modelLabel of ['', '   ', ` ${LABEL}`, `${LABEL} `, `${LABEL}\n`]) {
				const env: Record<string, string | undefined> = {};
				const refused = await loadTransport(
					{ transport, modelLabel, ollama: { baseUrl: 'http://127.0.0.1:9', options: {} } },
					env
				).catch((e: unknown) => e);
				expect(refused, `${transport} ${JSON.stringify(modelLabel)}`).toBeInstanceOf(
					HarnessRefusal
				);
				expect((refused as Error).message).toContain(
					`the model label ${JSON.stringify(modelLabel)} is blank or carries surrounding whitespace`
				);
				expect(env, `${transport}: no model variable written`).toEqual({});
			}
	});

	it('⛔ devin — once the variable is set, the product must resolve the RECORDED label, or the run is refused (no argv the harness can see carries it to devin)', async () => {
		cleanEnv();
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'a-decoy-the-product-would-run');
		// The variable is written — into an environment the product does not read.
		const detached: Record<string, string | undefined> = {};
		const refused = await loadTransport(
			{ transport: 'devin', modelLabel: 'glm-5-2' },
			detached
		).catch((e: unknown) => e);
		expect(refused).toBeInstanceOf(HarnessRefusal);
		expect((refused as Error).message).toContain(
			'devin: the product resolves its assurance model to "a-decoy-the-product-would-run", not the recorded label "glm-5-2"'
		);
		expect(detached, 'the variable was set, where the product does not look').toEqual({
			JPWB_ASSURANCE_MODEL: 'glm-5-2'
		});
		// The control: the environment the product reads.
		expect(
			(await loadTransport({ transport: 'devin', modelLabel: 'glm-5-2' }, process.env)).name
		).toBe('devin');
	});

	it('⛔ agy — a judge model that does not resolve is the HARNESS’s fault, not the candidate’s REFUSAL; a run stopped by it leaves no line', async () => {
		cleanEnv();
		const spawned: Spawned[] = [];
		const agy = createAgyTransport(agyCli, LABEL, { agyExec: capturing(spawned) });
		const refused = await agy.call('a prompt').catch((e: unknown) => e);
		expect(refused, 'JPWB_JUDGE_MODEL unset').toBeInstanceOf(HarnessRefusal);
		expect((refused as Error).message).toContain('the judge model did not resolve');
		const written: unknown[] = [];
		await expect(
			runQualification({
				runId: 'qr-agy-unresolved',
				date: '2026-09-24T12:00:00.000Z',
				commit: 'e5f9358b'.repeat(5),
				fingerprint: FINGERPRINT,
				cases: TWO,
				caseSetVersion: 1,
				oracleVersion: 1,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				transport: agy,
				repetitions: 1,
				env: process.env,
				onLine: (l) => written.push(l)
			})
		).rejects.toThrow('the judge model did not resolve');
		expect(written, 'no RUN line with no CALL behind it').toEqual([]);
		expect(spawned).toEqual([]);
	});

	it('⛔ devin — an assurance model that no longer resolves when it is called is the HARNESS’s fault, refused before devin is invoked', async () => {
		cleanEnv();
		const devin = await loadTransport({ transport: 'devin', modelLabel: 'glm-5-2' }, process.env);
		// ⚠ UNSET, never CHANGED, against the product's own devinPrint: unset, it refuses before it spawns anything.
		vi.stubEnv('JPWB_ASSURANCE_MODEL', undefined);
		const refused = await devin.call('a prompt').catch((e: unknown) => e);
		expect(refused, 'JPWB_ASSURANCE_MODEL gone').toBeInstanceOf(HarnessRefusal);
		expect((refused as Error).message).toContain(
			'devin: the product resolves its assurance model to nothing, not the recorded label "glm-5-2"'
		);
		// CHANGED after loading, against a stand-in devin that records whether it was invoked.
		let invoked = 0;
		const stand = createDevinTransport(
			{
				devinPrint: async () => {
					invoked += 1;
					return CLEAN;
				},
				resolveAssuranceModel: () => 'changed-after-loading'
			},
			'glm-5-2'
		);
		await expect(stand.call('a prompt')).rejects.toThrow(
			'devin: the product resolves its assurance model to "changed-after-loading", not the recorded label "glm-5-2"'
		);
		expect(invoked, 'refused before devin was invoked').toBe(0);
	});
});

// ── the harness Ollama transport, against a local stand-in server ─────────────────────────────────────────────────
const TEMPLATE = '<|start|>system<|message|>Current date: {{ currentDate }}\n{{ .Prompt }}';
const DATE_HEADER = 'Thu, 24 Sep 2026 12:00:00 GMT';
interface Seen {
	readonly method: string;
	readonly path: string;
	readonly body: Record<string, unknown> | undefined;
}
async function ollamaStandIn(
	mode: 'answer' | 'hang' | 'error',
	opts: { stayLoaded?: boolean } = {}
) {
	const seen: Seen[] = [];
	let loaded = true;
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		let raw = '';
		req.on('data', (c: Buffer) => (raw += c.toString('utf8')));
		req.on('end', () => {
			const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
			seen.push({ method: req.method ?? '', path: req.url ?? '', body });
			res.setHeader('Date', DATE_HEADER);
			res.setHeader('content-type', 'application/json');
			const send = (o: unknown) => res.end(JSON.stringify(o));
			if (req.url === '/api/version') return send({ version: '0.34.2' });
			if (req.url === '/api/tags')
				return send({ models: [{ name: 'gpt-oss:20b', digest: 'd'.repeat(64) }] });
			if (req.url === '/api/ps') return send({ models: loaded ? [{ name: 'gpt-oss:20b' }] : [] });
			if (req.url === '/api/show')
				return send({ template: TEMPLATE, modelfile: `FROM x\nTEMPLATE """${TEMPLATE}"""` });
			if (req.url === '/api/generate' && body?.prompt === undefined) {
				if (!opts.stayLoaded) loaded = false;
				return send({ model: body?.model, done: true, done_reason: 'unload' });
			}
			loaded = true;
			if (mode === 'hang') return; // never answers; the transport must cut it
			if (mode === 'error') {
				res.statusCode = 500;
				return send({ error: 'model runner crashed' });
			}
			send({ model: body?.model, response: CLEAN, thinking: 'SECRET-THINKING-9c1d', done: true });
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	const close = () =>
		new Promise<void>((r) => {
			server.closeAllConnections();
			server.close(() => r());
		});
	return { url, seen, close };
}
const OLLAMA_OPTIONS = { temperature: 0, seed: 42, num_ctx: 131072 };

describe('JAN-CRITREAD J2-2 — the harness Ollama transport (REG-F-427’s shim, rebuilt)', () => {
	it('⭐ it identifies what it is served, NOT deployable, with the product’s bounds re-imposed', async () => {
		const s = await ollamaStandIn('answer');
		try {
			const t = createOllamaTransport({
				baseUrl: s.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS,
				think: 'medium'
			});
			expect(await t.identify()).toEqual({
				transport: 'ollama',
				agentId: 'ollama',
				provider: 'ollama',
				modelLabel: 'gpt-oss:20b',
				servedModelDigest: 'd'.repeat(64),
				servedTemplateSha256: sha256(TEMPLATE),
				servedModelfileSha256: sha256(`FROM x\nTEMPLATE """${TEMPLATE}"""`),
				templateInjectsDate: true,
				serverVersion: '0.34.2',
				options: { ...OLLAMA_OPTIONS, think: 'medium' },
				bounds: {
					wallClockMs: 240_000,
					promptChars: agyCli.MAX_AGY_PROMPT_CHARS,
					printTimeout: null
				},
				argv: null
			});
			expect(OLLAMA_BOUND_MS, 'the product’s kill, the same as agyPrint’s execFile timeout').toBe(
				240_000
			);
		} finally {
			await s.close();
		}
	});

	it('⛔ it unloads the model before EVERY call, forwards the prompt verbatim, records the template hash and the server’s clock, and never returns the thinking', async () => {
		const s = await ollamaStandIn('answer');
		try {
			const t = createOllamaTransport({
				baseUrl: s.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS,
				think: 'medium'
			});
			for (const prompt of ['first prompt', 'second prompt']) {
				const before = s.seen.length;
				const reply = await t.call(prompt);
				expect(reply).toEqual({
					returned: CLEAN,
					served: { templateSha256: sha256(TEMPLATE), serverClock: DATE_HEADER }
				});
				expect(
					s.seen
						.slice(before)
						.map((r) => `${r.method} ${r.path}${r.body?.prompt === undefined ? '' : ' +prompt'}`)
				).toEqual([
					'POST /api/generate',
					'GET /api/ps',
					'POST /api/show',
					'POST /api/generate +prompt'
				]);
				expect(s.seen[before]!.body).toEqual({ model: 'gpt-oss:20b', keep_alive: 0 });
				expect(s.seen.at(-1)!.body).toEqual({
					model: 'gpt-oss:20b',
					prompt,
					stream: false,
					think: 'medium',
					keep_alive: 0,
					options: OLLAMA_OPTIONS
				});
			}
		} finally {
			await s.close();
		}
	});

	it('⛔ a model that will not unload is a HARNESS refusal — no warm call is ever made', async () => {
		const s = await ollamaStandIn('answer', { stayLoaded: true });
		try {
			const t = createOllamaTransport({
				baseUrl: s.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS,
				unloadPolls: 2,
				unloadPollMs: 1
			});
			await expect(t.call('p')).rejects.toThrow(HarnessRefusal);
			expect(
				s.seen.filter((r) => r.body?.prompt !== undefined),
				'no call with a prompt'
			).toEqual([]);
		} finally {
			await s.close();
		}
	});

	it('⭐ a timeout and a refusal are classified apart on Ollama — cut at the bound, an HTTP error, an over-long prompt', async () => {
		const hang = await ollamaStandIn('hang');
		const error = await ollamaStandIn('error');
		try {
			const cut = await createOllamaTransport({
				baseUrl: hang.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS,
				boundMs: 300
			})
				.call('p')
				.catch((e: unknown) => e);
			expect(cut).toBeInstanceOf(TransportFailure);
			expect(cut).toMatchObject({
				failureClass: 'TIMEOUT',
				served: { templateSha256: sha256(TEMPLATE), serverClock: DATE_HEADER }
			});
			const refused = await createOllamaTransport({
				baseUrl: error.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS
			})
				.call('p')
				.catch((e: unknown) => e);
			expect(refused).toMatchObject({ failureClass: 'REFUSAL', reason: 'HTTP 500' });
			const before = error.seen.length;
			const long = await createOllamaTransport({
				baseUrl: error.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS
			})
				.call('x'.repeat(agyCli.MAX_AGY_PROMPT_CHARS + 1))
				.catch((e: unknown) => e);
			expect(long).toMatchObject({ failureClass: 'REFUSAL' });
			expect(error.seen.length, 'the 28,000 check refuses before the server is touched').toBe(
				before
			);
		} finally {
			await hang.close();
			await error.close();
		}
	});
});

describe('JAN-CRITREAD J2-2 — an Ollama refusal made before the server is touched', () => {
	it('⭐ still makes a VALID tracked record — the one CALL of an ollama run that carries no served facts, because nothing was served', async () => {
		const s = await ollamaStandIn('answer');
		try {
			const t = createOllamaTransport({
				baseUrl: s.url,
				model: 'gpt-oss:20b',
				options: OLLAMA_OPTIONS
			});
			// ⚠ The product's own prompt never reaches 28,000 characters (the validator budgets it to 26,000), so the
			// arrangement lengthens it at the seam — the refusal under test is the transport's, before any request.
			const over: Transport = {
				name: t.name,
				identify: () => t.identify(),
				close: () => t.unload(),
				call: (prompt) => t.call(prompt.padEnd(agyCli.MAX_AGY_PROMPT_CHARS + 1, '.'))
			};
			const lines = await runQualification({
				runId: 'qr-ollama-over-long',
				date: '2026-09-24T12:00:00.000Z',
				commit: 'e5f9358b'.repeat(5),
				fingerprint: FINGERPRINT,
				cases: TWO.filter((c) => c.id === 'G-CLEAN'),
				caseSetVersion: 1,
				oracleVersion: 1,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				transport: over,
				repetitions: 1,
				env: {}
			});
			expect(
				s.seen.filter((r) => r.body?.prompt !== undefined),
				'no call with a prompt reached the server'
			).toEqual([]);
			const call = lines[1] as CallLine;
			expect(call.reply).toMatchObject({
				status: 'TRANSPORT_FAILURE',
				failureClass: 'REFUSAL',
				preContact: true
			});
			expect(call.served).toBeNull();
			expect(
				recordProblems(lines.map((l) => `${JSON.stringify(l)}\n`).join(''), { tracked: true })
			).toEqual([]);
		} finally {
			await s.close();
		}
	});
});

// ── how the runner loads (D11), and its CLI ──────────────────────────────────────────────────────────────────────
describe('JAN-CRITREAD J2-2 — the CLI runs from source (REG-D-072 D11) and refuses the overrides (D12)', () => {
	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});
	const tmp = () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-qualcli-'));
		dirs.push(d);
		return d;
	};
	const shellEnv = (extra: Record<string, string>) => {
		const env: Record<string, string | undefined> = { ...process.env, ...extra };
		for (const v of PROGRAM_OVERRIDE_VARIABLES) if (!(v in extra)) delete env[v];
		return env as NodeJS.ProcessEnv;
	};
	const cli = (bunArgs: readonly string[], extra: Record<string, string> = {}) => {
		const out = join(tmp(), 'run.ndjson');
		const r = spawnSync(
			'bun',
			[
				...bunArgs,
				'scripts/reviewer-qual/run.ts',
				'--transport',
				'agy',
				'--model',
				LABEL,
				'--out',
				out
			],
			{ cwd: REPO, encoding: 'utf8', env: shellEnv(extra), shell: true }
		);
		return { status: r.status, err: `${r.stdout ?? ''}${r.stderr ?? ''}`, wrote: existsSync(out) };
	};

	/** The CLI in process: a fingerprint handed in, agy's exec seam captured — so no model is ever called. */
	const inProcess = (spawned: Spawned[], written: string[], commit = 'e5f9358b'.repeat(5)) => ({
		env: process.env,
		resolve: () => 'file:///E:/repo/packages/rph-assurance/src/index.ts',
		write: (s: string) => written.push(s),
		fingerprint: async () => FINGERPRINT,
		commit: () => commit,
		now: () => new Date('2026-09-24T12:00:00.000Z'),
		transportDeps: { agyExec: capturing(spawned) }
	});

	it('⛔ the CLI refuses a blank or padded --model before anything is loaded or written', async () => {
		cleanEnv();
		for (const model of ['   ', ` ${LABEL}`]) {
			const out = join(tmp(), 'run.ndjson');
			const spawned: Spawned[] = [];
			const written: string[] = [];
			const code = await main(
				[
					'--transport',
					'agy',
					'--model',
					model,
					'--out',
					out,
					'--cases',
					'G-CLEAN',
					'--repetitions',
					'1'
				],
				inProcess(spawned, written)
			).catch((e: unknown) => e);
			expect(code, `${JSON.stringify(model)}: ${written.join('')}`).toBe(2);
			// `usage:` — refused by the argument check itself, before a module is loaded; `loadTransport`'s own
			// refusal (the next line of defence) would say the same without it.
			expect(written.join('')).toContain(
				`usage: REFUSED: the model label ${JSON.stringify(model)} is blank or carries surrounding whitespace`
			);
			expect(existsSync(out), 'nothing written').toBe(false);
			expect(spawned, 'nothing spawned').toEqual([]);
		}
	});

	it('⛔ the CLI refuses a bad number, a flag it does not know, or an ollama option on another transport — before anything is loaded or written', async () => {
		cleanEnv();
		// ⚠ The ollama rows name a LOCAL stand-in, so a CLI that failed to refuse would reach it and not a real server.
		const s = await ollamaStandIn('answer');
		try {
			const agy = ['--transport', 'agy', '--model', LABEL];
			const ollama = ['--transport', 'ollama', '--model', 'gpt-oss:20b', '--ollama-url', s.url];
			const rows: readonly (readonly [readonly string[], string])[] = [
				[[...agy, '--repetitions', '0'], '--repetitions "0" is not an integer ≥ 1'],
				[[...agy, '--repetitions', 'abc'], '--repetitions "abc" is not an integer ≥ 1'],
				[[...agy, '--repetitions', '1.5'], '--repetitions "1.5" is not an integer ≥ 1'],
				[[...agy, '--repetitions', ''], '--repetitions "" is not an integer ≥ 1'],
				[[...ollama, '--temperature', 'abc'], '--temperature "abc" is not a number from 0 to 2'],
				[[...ollama, '--temperature', '-1'], '--temperature "-1" is not a number from 0 to 2'],
				[
					[...ollama, '--temperature', 'Infinity'],
					'--temperature "Infinity" is not a number from 0 to 2'
				],
				[[...ollama, '--temperature', '3'], '--temperature "3" is not a number from 0 to 2'],
				[[...ollama, '--seed', '1.5'], '--seed "1.5" is not an integer ≥ 0'],
				[[...ollama, '--seed', '-1'], '--seed "-1" is not an integer ≥ 0'],
				[[...ollama, '--num-ctx', '0'], '--num-ctx "0" is not an integer ≥ 1'],
				[[...ollama, '--num-ctx', 'NaN'], '--num-ctx "NaN" is not an integer ≥ 1'],
				[[...agy, '--repetiton', '1'], 'unknown flag --repetiton'],
				[
					[...agy, '--temperature', '0'],
					'--temperature is an ollama option: the agy transport would ignore it'
				]
			];
			for (const [args, message] of rows) {
				const out = join(tmp(), 'run.ndjson');
				const spawned: Spawned[] = [];
				const written: string[] = [];
				const code = await main(
					[...args, '--out', out, '--cases', 'G-CLEAN'],
					inProcess(spawned, written)
				).catch((e: unknown) => e);
				expect(code, `${args.join(' ')}: ${written.join('')}`).toBe(2);
				expect(written.join(''), args.join(' ')).toContain(message);
				expect(existsSync(out), `${args.join(' ')}: nothing written`).toBe(false);
				expect(spawned, `${args.join(' ')}: nothing spawned`).toEqual([]);
			}
			expect(s.seen, 'the stand-in server was never asked anything').toEqual([]);
		} finally {
			await s.close();
		}
	});

	it('⛔ every line is checked before it is written — a RUN line the record would refuse stops the run before any call, and nothing is appended', async () => {
		cleanEnv();
		const args = [
			'--transport',
			'agy',
			'--model',
			LABEL,
			'--cases',
			'G-CLEAN',
			'--repetitions',
			'1'
		];
		for (const [label, extra, commit, message] of [
			[
				'a run id with spaces',
				['--run-id', 'qr second run'],
				'e5f9358b'.repeat(5),
				'RUN.runId: not an id'
			],
			['a commit that is not one', [], 'not-a-commit', 'RUN.commit: not a 40-hex commit']
		] as const) {
			const out = join(tmp(), 'run.ndjson');
			const spawned: Spawned[] = [];
			const written: string[] = [];
			const code = await main(
				[...args, ...extra, '--out', out],
				inProcess(spawned, written, commit)
			).catch((e: unknown) => e);
			expect(code, `${label}: ${written.join('')}`).toBe(2);
			expect(written.join(''), label).toContain(message);
			expect(existsSync(out), `${label}: nothing appended`).toBe(false);
			expect(spawned, `${label}: refused before any call`).toEqual([]);
		}
	});

	it('⭐ a harness refusal part-way stops the run with exit 4 — what was measured before it stays, and the record still validates', async () => {
		cleanEnv();
		const out = join(tmp(), 'run.ndjson');
		const spawned: Spawned[] = [];
		const written: string[] = [];
		const deps = inProcess(spawned, written);
		const first = capturing(spawned);
		// After the first spawn the judge model is changed under the run: the next call's argv no longer carries the label.
		const exec: Exec = async (file, args, options) => {
			const r = await first(file, args, options);
			vi.stubEnv('JPWB_JUDGE_MODEL', 'changed-mid-run');
			return r;
		};
		const code = await main(
			[
				'--transport',
				'agy',
				'--model',
				LABEL,
				'--out',
				out,
				'--cases',
				'G-CLEAN,W-CLEAN',
				'--repetitions',
				'1'
			],
			{ ...deps, transportDeps: { agyExec: exec } }
		);
		expect(code, written.join('')).toBe(4);
		expect(written.join('')).toContain(
			'agy argv: --model is "changed-mid-run", not the recorded label'
		);
		const text = readFileSync(out, 'utf8');
		expect(
			text
				.trimEnd()
				.split('\n')
				.map((l) => (JSON.parse(l) as { kind: string; caseId?: string }).caseId ?? 'RUN'),
			'the RUN line and the one evaluation measured'
		).toEqual(['RUN', 'G-CLEAN']);
		expect(recordProblems(text, { tracked: true })).toEqual([]);
		expect(spawned).toHaveLength(1);
	});

	it('⭐ the source check itself — a package resolved to src passes, to dist is refused', () => {
		expect(
			sourceResolutionProblem('file:///E:/repo/packages/rph-assurance/src/index.ts')
		).toBeUndefined();
		expect(
			sourceResolutionProblem('file:///E:/repo/packages/rph-assurance/dist/index.js')
		).toContain('REG-D-072 D11');
	});

	it('⛔ under bare bun the packages resolve to built dist, and the CLI refuses to run', () => {
		const r = cli([]);
		expect(r.status, r.err).toBe(2);
		expect(r.err).toContain('REG-D-072 D11');
		expect(r.err).toContain('dist/index.js');
		expect(r.wrote).toBe(false);
	});

	it('⛔ under --conditions=source it gets past D11, and refuses JPWB_AGY_BIN before loading a transport (D12)', () => {
		const r = cli(['--conditions=source'], { JPWB_AGY_BIN: 'C:/stand-in/agy-shim.exe' });
		expect(r.status, r.err).toBe(2);
		expect(r.err).not.toContain('REG-D-072 D11');
		expect(r.err).toContain('JPWB_AGY_BIN is set');
		expect(r.wrote).toBe(false);
	});

	it('⛔ with a clean environment it stops where J2-3 begins: no run is recorded without the reviewer fingerprint', () => {
		const r = cli(['--conditions=source']);
		expect(r.status, r.err).toBe(3);
		expect(r.err).toContain('the reviewer fingerprint (§5.5) lands in J2-3');
		expect(r.wrote).toBe(false);
	});

	it('⭐ in process, with a fingerprint and agy’s exec seam injected, it appends a record that validates — and refuses a broken one', async () => {
		cleanEnv();
		const out = join(tmp(), 'run.ndjson');
		const spawned: Spawned[] = [];
		const written: string[] = [];
		const deps = {
			env: process.env,
			resolve: () => 'file:///E:/repo/packages/rph-assurance/src/index.ts',
			write: (s: string) => written.push(s),
			fingerprint: async () => FINGERPRINT,
			commit: () => 'e5f9358b'.repeat(5),
			now: () => new Date('2026-09-24T12:00:00.000Z'),
			transportDeps: { agyExec: capturing(spawned) }
		};
		const args = [
			'--transport',
			'agy',
			'--model',
			LABEL,
			'--out',
			out,
			'--repetitions',
			'1',
			'--cases',
			'G-CLEAN,W-CLEAN'
		];
		expect(await main(args, deps), written.join('')).toBe(0);
		const text = readFileSync(out, 'utf8');
		expect(recordProblems(text, { tracked: true })).toEqual([]);
		const lines = text
			.trimEnd()
			.split('\n')
			.map((l) => JSON.parse(l) as { kind: string; caseId?: string });
		expect(lines.map((l) => `${l.kind}${l.caseId ? ` ${l.caseId}` : ''}`)).toEqual([
			'RUN',
			'CALL G-CLEAN',
			'CALL W-CLEAN'
		]);
		expect(spawned).toHaveLength(2);

		// A second run APPENDS, under its own id, and the record still validates. A run that would reuse an id the record
		// already declares — named, or the default from the same clock — is refused and the record left untouched: two
		// RUN lines under one id would make the record invalid, and every CALL under that id ambiguous.
		expect(await main([...args, '--run-id', 'qr-second'], deps)).toBe(0);
		const two = readFileSync(out, 'utf8');
		expect(two.startsWith(text)).toBe(true);
		expect(recordProblems(two, { tracked: true })).toEqual([]);
		expect(await main([...args, '--run-id', 'qr-second'], deps), 'a named id reused').toBe(2);
		expect(await main(args, deps), 'the default id, from the same clock').toBe(2);
		expect(readFileSync(out, 'utf8')).toBe(two);
		const broken = join(tmp(), 'broken.ndjson');
		writeFileSync(broken, '{"kind":"NOTE"}\n');
		expect(await main(['--transport', 'agy', '--model', LABEL, '--out', broken], deps)).toBe(2);
		expect(readFileSync(broken, 'utf8')).toBe('{"kind":"NOTE"}\n');
		expect(
			await main(['--transport', 'agy', '--model', LABEL, '--out', join(tmp(), 'run.json')], deps)
		).toBe(2);
	});
});
