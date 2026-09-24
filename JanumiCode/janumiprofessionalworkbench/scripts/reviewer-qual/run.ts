/**
 * ⭐ `JAN-CRITREAD` J2-2 — a reviewer-qualification run, from the command line (DESIGN-what-the-tests-prove.md §5.3).
 *
 *   bun --conditions=source scripts/reviewer-qual/run.ts --transport agy|devin|ollama --model <label> --out <file.ndjson>
 *       [--repetitions 2] [--cases <id>,<id>…] [--run-id <id>]
 *       [--ollama-url http://host:11434] [--think <level>] [--temperature 0] [--seed 42] [--num-ctx 131072]
 *
 * ⛔ IT LOADS FROM SOURCE (`REG-D-072` D11). Under bare `bun` every `@janumipwb/*` specifier resolves to built `dist`,
 * stale after any source edit; `--conditions=source` makes every package's export map answer with `./src/…`. The first
 * thing this file does is ask where `@janumipwb/rph-assurance` resolves, and it refuses to run on anything but source.
 * ⛔ THEN IT REFUSES THE PROGRAM OVERRIDES (`REG-D-072` D12), before any transport module is loaded.
 * ⚠ So this file imports nothing at load but the two pure modules those checks need; everything else is loaded after.
 *
 * ⚠ IN J2-2 IT STOPS AT THE FINGERPRINT. A RUN line is stamped with the reviewer fingerprint, scoring digest and
 * case-set digest (§5.5), which J2-3 computes; a run recorded without them could never be checked for coverage or
 * reproduction, so until then the CLI refuses rather than write one (`exit 3`). Every step after it is exercised in
 * process with a fingerprint handed in (`verif/reviewer-qualification-transports.test.ts`).
 *
 * The record is APPENDED to `--out`, line by line as each call is measured, so a run killed part-way keeps what it
 * measured. An `--out` that is not already a valid record is refused and left untouched.
 */
import {
	refuseProgramOverrides,
	HarnessRefusal,
	isHarnessRefusal,
	modelLabelProblem,
	sourceResolutionProblem,
	SOURCE_PROBE
} from './preflight.js';
import type { RunFingerprint } from './runner.js';
import type { CandidateSpec, TransportDeps } from './transports.js';

export interface CliDeps {
	/** The environment the product reads — `process.env`, which the runner WRITES the model variable into. */
	readonly env: Record<string, string | undefined>;
	/** `import.meta.resolve`. */
	readonly resolve: (specifier: string) => string;
	readonly write: (text: string) => void;
	/** The run's stamps (§5.5) — J2-3's function. */
	readonly fingerprint: () => Promise<RunFingerprint>;
	readonly commit: () => string;
	readonly now: () => Date;
	readonly transportDeps?: TransportDeps;
}

/** Until J2-3: no fingerprint, so no run. */
const NO_FINGERPRINT_YET = async (): Promise<RunFingerprint> => {
	throw new HarnessRefusal(
		'REFUSED: the reviewer fingerprint (§5.5) lands in J2-3. A RUN line must carry it, the scoring digest and the ' +
			'case-set digest, or the check could never say whether the run covers today’s reviewer — so no run is recorded ' +
			'without them.'
	);
};

type Args = Readonly<Record<string, string>>;
/** ⛔ THE FLAGS ARE CLOSED: a misspelt flag would otherwise be dropped in silence, and its default run in its place. */
const FLAGS: ReadonlySet<string> = new Set([
	'transport',
	'model',
	'out',
	'repetitions',
	'cases',
	'run-id',
	'ollama-url',
	'think',
	'temperature',
	'seed',
	'num-ctx'
]);
/** The flags only the ollama transport reads — given to another transport, each would be ignored in silence. */
const OLLAMA_ONLY = ['ollama-url', 'think', 'temperature', 'seed', 'num-ctx'] as const;
/**
 * ⛔ EVERY NUMBER, STRICTLY, before anything is loaded or written. `Number()` reads '' as 0, 'abc' as NaN (which a RUN
 * line serialises as null) and '0x10' as 16, so a value is refused unless it is decimal digits, finite and in range.
 */
const NUMBERS: Readonly<Record<string, { integer: boolean; min: number; max?: number }>> = {
	repetitions: { integer: true, min: 1 },
	temperature: { integer: false, min: 0, max: 2 },
	seed: { integer: true, min: 0 },
	'num-ctx': { integer: true, min: 1 }
};
function numberProblem(flag: string, value: string): string | undefined {
	const rule = NUMBERS[flag]!;
	const n = Number(value);
	const shaped = rule.integer
		? /^\d+$/.test(value) && Number.isSafeInteger(n)
		: /^\d+(\.\d+)?$/.test(value);
	if (shaped && Number.isFinite(n) && n >= rule.min && (rule.max === undefined || n <= rule.max))
		return undefined;
	const range = rule.max === undefined ? `≥ ${rule.min}` : `from ${rule.min} to ${rule.max}`;
	return `--${flag} ${JSON.stringify(value)} is not ${rule.integer ? 'an integer' : 'a number'} ${range}`;
}
function parseArgs(argv: readonly string[]): Args | string {
	const out: Record<string, string> = {};
	for (let i = 0; i < argv.length; i += 2) {
		const flag = argv[i]!;
		const value = argv[i + 1];
		if (!flag.startsWith('--') || value === undefined)
			return `expected --flag value pairs, at "${flag}"`;
		if (!FLAGS.has(flag.slice(2))) return `unknown flag ${flag}`;
		out[flag.slice(2)] = value;
	}
	return argsProblem(out) ?? out;
}
/** What is wrong with a complete set of flags, or undefined. */
function argsProblem(args: Args): string | undefined {
	for (const required of ['transport', 'model', 'out'])
		if (args[required] === undefined) return `--${required} is required`;
	if (!['agy', 'devin', 'ollama'].includes(args.transport!))
		return `--transport is agy, devin or ollama`;
	const labelProblem = modelLabelProblem(args.model!);
	if (labelProblem) return labelProblem;
	if (!args.out!.endsWith('.ndjson')) return '--out must name an .ndjson record file';
	const ignored =
		args.transport === 'ollama' ? undefined : OLLAMA_ONLY.find((f) => args[f] !== undefined);
	if (ignored)
		return `--${ignored} is an ollama option: the ${args.transport} transport would ignore it`;
	return Object.keys(NUMBERS)
		.map((flag) => (args[flag] === undefined ? undefined : numberProblem(flag, args[flag])))
		.find((problem) => problem !== undefined);
}

/** The cases `--cases` names (all of them when it is absent), or why it names one the set does not hold. */
function selectCases<C extends { readonly id: string }>(
	all: readonly C[],
	named: string | undefined
): readonly C[] | string {
	if (named === undefined) return all;
	const wanted = named.split(',');
	if (new Set(wanted).size !== wanted.length) return `--cases names a case twice: ${named}`;
	const selected = all.filter((c) => wanted.includes(c.id));
	const missing = wanted.filter((w) => !selected.some((c) => c.id === w));
	return missing.length === 0
		? selected
		: `--cases names a case the set does not hold: ${missing.join(', ')}`;
}

/** The candidate the flags name — every number already checked by `argsProblem`. */
function candidateSpec(args: Args, env: CliDeps['env']): CandidateSpec {
	const transport = args.transport as CandidateSpec['transport'];
	if (transport !== 'ollama') return { transport, modelLabel: args.model! };
	return {
		transport,
		modelLabel: args.model!,
		ollama: {
			baseUrl: args['ollama-url'] ?? env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
			options: {
				temperature: Number(args.temperature ?? 0),
				seed: Number(args.seed ?? 42),
				num_ctx: Number(args['num-ctx'] ?? 131072)
			},
			...(args.think ? { think: args.think } : {})
		}
	};
}

/**
 * The run. Returns the exit code: 0 run recorded, 2 refused before anything was written, 3 no fingerprint (J2-3),
 * 4 the harness stopped the run part-way — the lines appended before it stay, and name no fault of the candidate's.
 */
export async function main(argv: readonly string[], deps: CliDeps): Promise<number> {
	const say = (s: string) => deps.write(`reviewer-qual — ${s}\n`);
	const d11 = sourceResolutionProblem(deps.resolve(SOURCE_PROBE));
	if (d11) {
		say(d11);
		return 2;
	}
	try {
		refuseProgramOverrides(deps.env);
	} catch (e) {
		say((e as Error).message);
		return 2;
	}
	const args = parseArgs(argv);
	if (typeof args === 'string') {
		say(`usage: ${args}`);
		return 2;
	}
	let fingerprint: RunFingerprint;
	try {
		fingerprint = await deps.fingerprint();
	} catch (e) {
		say((e as Error).message);
		return 3;
	}
	// ⭐ Only now — past D11, D12 and the fingerprint — is anything that reaches the product loaded.
	const [
		{ appendFileSync, existsSync, readFileSync },
		record,
		runner,
		transports,
		cases,
		assurance
	] = await Promise.all([
		import('node:fs'),
		import('./record.js'),
		import('./runner.js'),
		import('./transports.js'),
		import('./cases.js'),
		import('@janumipwb/rph-assurance')
	]);
	const date = deps.now();
	const runId =
		args['run-id'] ?? `qr-${date.toISOString().replace(/[:.]/g, '-')}-${args.transport}`;
	if (existsSync(args.out!)) {
		const existing = readFileSync(args.out!, 'utf8');
		const problems = record.recordProblems(existing, { tracked: true });
		if (problems.length > 0) {
			say(`${args.out} is not a valid record, and is left untouched:\n  ${problems.join('\n  ')}`);
			return 2;
		}
		// A run id is declared once: a second RUN under it would make the record invalid and its calls ambiguous.
		if (record.declaredRunIds(existing).has(runId)) {
			say(
				`${args.out} already declares run ${runId}, and is left untouched: a run id is used once`
			);
			return 2;
		}
	}
	const root = new URL('../../', import.meta.url);
	const caseSet = JSON.parse(
		readFileSync(new URL(cases.CASE_SET_V1_FILE, root), 'utf8')
	) as import('./cases.js').CaseSet;
	const oracles = JSON.parse(
		readFileSync(new URL(cases.ORACLES_V1_FILE, root), 'utf8')
	) as import('./cases.js').OracleSet;
	const selected = selectCases(caseSet.cases, args.cases);
	if (typeof selected === 'string') {
		say(selected);
		return 2;
	}
	let calls = 0;
	let failures = 0;
	let appended = 0;
	try {
		const transport = await transports.loadTransport(
			candidateSpec(args, deps.env),
			deps.env,
			deps.transportDeps ?? {}
		);
		// ⭐ Every line reaching `onLine` has passed `lineProblems` in the runner — the RUN line before any call is made.
		await runner.runQualification({
			runId,
			date: date.toISOString(),
			commit: deps.commit(),
			fingerprint,
			cases: selected,
			caseSetVersion: caseSet.caseSetVersion,
			oracleVersion: oracles.oracleVersion,
			criteria: assurance.SEEDED_REASONING_REVIEW_CRITERIA,
			transport,
			repetitions: Number(args.repetitions ?? 2),
			env: deps.env,
			onLine: (line) => {
				appendFileSync(args.out!, record.serializeLine(line));
				appended += 1;
				if (line.kind !== 'CALL') return;
				calls += 1;
				if (line.reply.status === 'TRANSPORT_FAILURE') failures += 1;
			}
		});
	} catch (e) {
		// A HARNESS refusal is reported, never recorded against the candidate. Anything else is a defect, and throws.
		if (!isHarnessRefusal(e)) throw e;
		say(e.message);
		return appended === 0 ? 2 : 4;
	}
	say(`${calls} calls appended to ${args.out}; ${failures} transport failure(s)`);
	return 0;
}

if (import.meta.main) {
	const { execFileSync } = await import('node:child_process');
	process.exitCode = await main(process.argv.slice(2), {
		env: process.env,
		resolve: (s) => import.meta.resolve(s),
		write: (s) => process.stderr.write(s),
		fingerprint: NO_FINGERPRINT_YET,
		commit: () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		now: () => new Date()
	});
}
