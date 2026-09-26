// ⭐ `JAN-CRITREAD` J2-2 — THE TRANSPORTS A QUALIFICATION RUN STANDS BEHIND THE VALIDATOR'S `print` SEAM (DESIGN §5.3).
//
// A transport answers one question — "send this prompt; what came back?" — and classifies every way it can fail to
// answer as a TIMEOUT or a REFUSAL (§5.4), which the record carries as not re-scorable. Anything else it throws is the
// HARNESS's fault and stops the run: a candidate is never charged with the harness's defect.
//
//   · `agy` and `devin` ARE THE PRODUCT'S OWN `agyPrint` and `devinPrint`, with their own bounds — deployable. They
//     choose their model from the environment and their program at module load (`REG-D-072` D12), so
//     `loadTransport` refuses a program override BEFORE it loads either module, then sets the model variable to the
//     RECORDED label, and the agy transport asserts the argv it is handed through `agyPrint`'s exec seam — the
//     recorded label is the `--model` the program was given, and the program is the product's own.
//   · `ollama` is the HARNESS transport (`ollama-transport.ts`), not deployable.
//
// ⚠ NO STATIC IMPORT OF EITHER PRODUCT TRANSPORT. Types only; the modules are loaded inside `loadTransport`, after the
// refusal — a static import here would capture `JPWB_AGY_BIN` before anything could check it.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgyExec } from '../../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import type { ToolInvocationResult } from '../../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { HarnessRefusal, modelLabelProblem, refuseProgramOverrides } from './preflight.js';
import type {
	CandidateIdentity,
	ServedFacts,
	TransportFailureClass,
	TransportName
} from './record.js';

/** The transport answered nothing: its bound cut the call, or it refused it. Recorded, never re-scored. */
export class TransportFailure extends Error {
	/** What the server was found serving for this call, when it was reached. */
	readonly served: ServedFacts | null;
	/** True only when the TRANSPORT refused the call itself, before the tool or server was touched — so nothing was
	 *  served, and no bound can have been reached. */
	readonly preContact: boolean;
	constructor(
		readonly failureClass: TransportFailureClass,
		/** The HARNESS's words, built from facts (an exit code, a bound) — never a tool's diagnostic, which for agy
		 *  carries the whole prompt (`agy-cli.ts`, finding #60). */
		readonly reason: string,
		facts: { readonly served?: ServedFacts | null; readonly preContact?: boolean } = {}
	) {
		super(`${failureClass}: ${reason}`);
		this.name = 'TransportFailure';
		this.served = facts.served ?? null;
		this.preContact = facts.preContact ?? false;
	}
}

/** What one call returned — exactly what the validator's `print` seam accepts — and what the transport was served. */
export interface TransportReply {
	readonly returned: string | ToolInvocationResult;
	readonly served: ServedFacts | null;
}
export interface Transport {
	readonly name: TransportName;
	/** Who the candidate is, and what it is served, for the RUN line. */
	identify(): Promise<CandidateIdentity>;
	/** Throws `TransportFailure` for a call that got no reply, `HarnessRefusal` for the harness's own fault. */
	call(prompt: string): Promise<TransportReply>;
	/** Release what the transport holds — Ollama unloads its model. */
	close?(): Promise<void>;
}

export interface OllamaSpec {
	readonly baseUrl: string;
	readonly options: Readonly<Record<string, number>>;
	readonly think?: string | boolean;
}
export interface CandidateSpec {
	readonly transport: Exclude<TransportName, 'stub'>;
	readonly modelLabel: string;
	readonly ollama?: OllamaSpec;
}
export interface TransportDeps {
	/** agy's exec seam, for tests. Absent → the real `execFile`. The argv assertion wraps whichever is used. */
	readonly agyExec?: AgyExec;
	/** A monotonic clock in ms, for tests. */
	readonly now?: () => number;
}

/** The variable each product transport reads its model from, at call time (`agy-cli.ts` `judgeModel`, `devin-reviewer.ts`
 *  `assuranceModel`). */
export const MODEL_VARIABLE = { agy: 'JPWB_JUDGE_MODEL', devin: 'JPWB_ASSURANCE_MODEL' } as const;
/** `agyPrint`'s own bounds, as its exec seam receives them: the execFile kill, and agy's `--print-timeout 3m`. */
export const AGY_KILL_MS = 240_000;
export const AGY_PRINT_TIMEOUT_MS = 180_000;
/** `devinPrint`'s execFile kill. */
export const DEVIN_KILL_MS = 240_000;

/**
 * The transport a candidate stands behind. ⛔ In this order, and the order is the guarantee (`REG-D-072` D12): refuse a
 * program override, set the model variable to the recorded label, THEN load the product module.
 *
 * ⚠ `env` IS WRITTEN, and must be the environment the product reads — `process.env` — for the label to reach it.
 */
export async function loadTransport(
	spec: CandidateSpec,
	env: Record<string, string | undefined> = process.env,
	deps: TransportDeps = {}
): Promise<Transport> {
	refuseProgramOverrides(env);
	const labelProblem = modelLabelProblem(spec.modelLabel);
	if (labelProblem) throw new HarnessRefusal(labelProblem);
	if (spec.transport === 'ollama') {
		if (!spec.ollama) throw new HarnessRefusal('an ollama candidate needs its server and options');
		const { createOllamaTransport } = await import('./ollama-transport.js');
		return createOllamaTransport({
			...spec.ollama,
			model: spec.modelLabel,
			...(deps.now ? { now: deps.now } : {})
		});
	}
	env[MODEL_VARIABLE[spec.transport]] = spec.modelLabel;
	if (spec.transport === 'agy')
		return createAgyTransport(
			await import('../../apps/rph-demo/src/lib/server/assurance/agy-cli.js'),
			spec.modelLabel,
			deps
		);
	const devin = await import('../../apps/rph-demo/src/lib/server/tools/devin-reviewer.js');
	// ⛔ devin's argv is not seen here: `devinPrint` has an exec seam (`DevinExec`, `JAN-SELREV` SR-1), but this harness
	// runs it with the default exec, the real program. So the label is held to what the PRODUCT resolves instead: an `env`
	// the product does not read, or a variable something else overrode, would otherwise record one model and run another.
	const problem = devinModelProblem(devin.resolveAssuranceModel(), spec.modelLabel);
	if (problem) throw new HarnessRefusal(problem);
	return createDevinTransport(devin, spec.modelLabel, deps);
}

/** Why devin would not be given the recorded label, or undefined. */
function devinModelProblem(resolved: string | undefined, label: string): string | undefined {
	if (resolved === label) return undefined;
	const given = resolved === undefined ? 'nothing' : JSON.stringify(resolved);
	return (
		`devin: the product resolves its assurance model to ${given}, not the recorded label ${JSON.stringify(label)} — ` +
		'a harness fault, never the candidate’s'
	);
}

/** What the agy transport needs of `agy-cli.ts` — injected, so a test can hand it a module loaded under an override. */
export interface AgyModule {
	readonly agyPrint: (prompt: string, exec?: AgyExec) => Promise<string>;
	readonly MAX_AGY_PROMPT_CHARS: number;
}

/** The argv agy is given, `<prompt>` standing for the prompt — `agyPrint`'s own, restated so it can be CHECKED. */
const agyArgv = (label: string, prompt = '<prompt>'): string[] => [
	'--print',
	prompt,
	'--print-timeout',
	'3m',
	'--model',
	label
];

/**
 * ⛔ THE ARGV ASSERTION (`REG-D-072` D12). What `agyPrint` hands its exec seam must be the product's own program, the
 * run's own prompt, the recorded label as `--model`, and the product's own kill. The model is resolved from the
 * environment at call time, so anything that changed it after `loadTransport` is caught here, before a spawn.
 */
function agyArgvProblem(
	file: string,
	args: readonly string[],
	timeout: number,
	prompt: string,
	label: string
): string | undefined {
	if (file !== 'agy') return `agy argv: the program is "${file}", not the product’s own "agy"`;
	const model = args[args.indexOf('--model') + 1];
	if (model !== label) return `agy argv: --model is "${model}", not the recorded label "${label}"`;
	if (JSON.stringify(args) !== JSON.stringify(agyArgv(label, prompt)))
		return `agy argv: ${JSON.stringify(agyArgv(label))} expected, with the run’s prompt`;
	if (timeout !== AGY_KILL_MS)
		return `agy argv: the kill is ${timeout} ms, not the recorded ${AGY_KILL_MS}`;
	return undefined;
}

/**
 * A failed spawn, classified from what execFile reports — the kill, or agy's own print timeout, is a TIMEOUT.
 * ⛔ A SIGNAL IS NOT A BOUND. execFile's own kill is `killed === true`; any other signal is a crash or an outside kill,
 * and reads as the bound only when it arrives past it — otherwise a crash 5 ms in would be recorded as a call that ran
 * 240 s (§5.1 (6) Boundedness).
 */
function classifyAgyFailure(
	error: unknown,
	elapsedMs: number
): { failureClass: TransportFailureClass; reason: string } {
	const e = (error ?? {}) as { killed?: unknown; signal?: unknown; code?: unknown };
	if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
		return { failureClass: 'REFUSAL', reason: 'the output overran execFile’s maxBuffer' };
	if (e.killed === true)
		return {
			failureClass: 'TIMEOUT',
			reason: `killed after ${elapsedMs} ms, at the ${AGY_KILL_MS} ms bound`
		};
	if (elapsedMs >= AGY_PRINT_TIMEOUT_MS)
		return {
			failureClass: 'TIMEOUT',
			reason: `exit ${String(e.code)} after ${elapsedMs} ms — agy’s own 3m print timeout`
		};
	if (typeof e.signal === 'string')
		return {
			failureClass: 'REFUSAL',
			reason: `terminated by ${e.signal} after ${elapsedMs} ms, before any bound — not execFile’s kill`
		};
	return {
		failureClass: 'REFUSAL',
		reason:
			typeof e.code === 'number'
				? `exit ${e.code}`
				: `the program did not start (${String(e.code)})`
	};
}

const monotonic = () => performance.now();

export function createAgyTransport(
	agy: AgyModule,
	label: string,
	deps: TransportDeps = {}
): Transport {
	const inner = deps.agyExec ?? (promisify(execFile) as unknown as AgyExec);
	const now = deps.now ?? monotonic;
	return {
		name: 'agy',
		identify: async () => ({
			transport: 'agy',
			agentId: 'agy',
			provider: 'google',
			modelLabel: label,
			servedModelDigest: null,
			servedTemplateSha256: null,
			servedModelfileSha256: null,
			templateInjectsDate: null,
			serverVersion: null,
			serverUtcOffset: null,
			options: {},
			bounds: {
				wallClockMs: AGY_KILL_MS,
				promptChars: agy.MAX_AGY_PROMPT_CHARS,
				printTimeout: '3m'
			},
			argv: agyArgv(label)
		}),
		call: async (prompt) => {
			const started = now();
			let harness: HarnessRefusal | undefined;
			let failure: { failureClass: TransportFailureClass; reason: string } | undefined;
			// ⚠ `agyPrint` catches EVERY exec rejection and rethrows a sanitised message, so what the seam learns has to
			// leave by these two variables — a refusal thrown through it would arrive as "agy invocation failed".
			const exec: AgyExec = async (file, args, options) => {
				const problem = agyArgvProblem(file, args, options.timeout, prompt, label);
				if (problem) {
					harness = new HarnessRefusal(problem);
					throw harness;
				}
				try {
					return await inner(file, args, options);
				} catch (e) {
					failure = classifyAgyFailure(e, Math.round(now() - started));
					throw e;
				}
			};
			try {
				return { returned: await agy.agyPrint(prompt, exec), served: null };
			} catch {
				if (harness) throw harness;
				if (failure) throw new TransportFailure(failure.failureClass, failure.reason);
				// Refused before anything was spawned. The argv budget is a fact about the prompt, recorded as a refusal;
				// the only other refusal agyPrint makes before spawning is an unresolved judge model — the harness's
				// configuration, never the candidate's answer.
				if (prompt.length > agy.MAX_AGY_PROMPT_CHARS)
					throw new TransportFailure(
						'REFUSAL',
						`the prompt is ${prompt.length} characters, over agy’s ${agy.MAX_AGY_PROMPT_CHARS}-character argv budget`,
						{ preContact: true }
					);
				throw new HarnessRefusal(
					'agy refused before spawning: the judge model did not resolve (JPWB_JUDGE_MODEL) — a harness fault, never ' +
						'the candidate’s'
				);
			}
		}
	};
}

export type DevinPrint = (prompt: string) => Promise<string | ToolInvocationResult>;
/** What the devin transport needs of `devin-reviewer.ts` — injected, as agy's module is. */
export interface DevinModule {
	readonly devinPrint: DevinPrint;
	/** The model the product will hand devin, read from the environment at call time. */
	readonly resolveAssuranceModel: () => string | undefined;
}

/**
 * The product's `devinPrint`. ⚠ Its argv is not asserted here: it has an exec seam (`DevinExec`, `JAN-SELREV` SR-1),
 * but this harness calls it with the default exec, the real program. The label reaches it through
 * `JPWB_ASSURANCE_MODEL`, and what devin REPORTS having run is recorded as the resolved evaluator. Its failure carries
 * no kill flag through the sanitised message, so a failure at the 240 s bound is classified a TIMEOUT by the clock.
 * ⛔ SO THE LABEL IS HELD TO WHAT THE PRODUCT RESOLVES, before every call: a model that no longer resolves, or resolves to
 * another label, is the harness's fault and is refused before devin is invoked — never recorded as the candidate's.
 */
export function createDevinTransport(
	devin: DevinModule,
	label: string,
	deps: TransportDeps = {}
): Transport {
	const now = deps.now ?? monotonic;
	return {
		name: 'devin',
		identify: async () => ({
			transport: 'devin',
			agentId: 'devin',
			provider: 'devin',
			modelLabel: label,
			servedModelDigest: null,
			servedTemplateSha256: null,
			servedModelfileSha256: null,
			templateInjectsDate: null,
			serverVersion: null,
			serverUtcOffset: null,
			options: {},
			bounds: { wallClockMs: DEVIN_KILL_MS, promptChars: null, printTimeout: null },
			argv: null
		}),
		call: async (prompt) => {
			const problem = devinModelProblem(devin.resolveAssuranceModel(), label);
			if (problem) throw new HarnessRefusal(problem);
			const started = now();
			try {
				return { returned: await devin.devinPrint(prompt), served: null };
			} catch {
				const elapsed = Math.round(now() - started);
				throw elapsed >= DEVIN_KILL_MS
					? new TransportFailure(
							'TIMEOUT',
							`failed after ${elapsed} ms, at the ${DEVIN_KILL_MS} ms bound`
						)
					: new TransportFailure('REFUSAL', `devin failed after ${elapsed} ms`);
			}
		}
	};
}
