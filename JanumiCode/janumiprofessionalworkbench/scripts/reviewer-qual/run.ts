/**
 * ⭐ `JAN-CRITREAD` J2-2 — a reviewer-qualification run, from the command line (DESIGN-what-the-tests-prove.md §5.3).
 *
 *   bun --conditions=source scripts/reviewer-qual/run.ts --transport agy|devin|ollama --model <label> --out <file.ndjson>
 *       [--repetitions 2] [--cases <id>,<id>…] [--run-id <id>]
 *       [--ollama-url http://host:11434 (required for ollama)] [--think <level>] [--temperature 0] [--seed 42]
 *       [--num-ctx 131072]
 *       [--exports <folder outside the repository> (required for devin: D47)]
 *       [--mode rederive (devin: D53's re-derivation pass — every case re-derived live, no reviewer called; no
 *        --repetitions, no --run-id)]
 *
 * ⛔ AN OLLAMA RUN NAMES ITS SERVER (`JAN-CRITREAD` J2-3). `--ollama-url` is required — no default, and no `OLLAMA_HOST`
 * fallback: the machine the harness runs on may BE the shared server (`REG-F-427`), so a run that forgot the flag, or a
 * test whose flag a mutant dropped, would otherwise reach it. The server a run measures is the one its command says.
 *
 * ⛔ IT LOADS FROM SOURCE (`REG-D-072` D11). Under bare `bun` every `@janumipwb/*` specifier resolves to built `dist`,
 * stale after any source edit; `--conditions=source` makes every package's export map answer with `./src/…`. The first
 * thing this file does is ask where `@janumipwb/rph-assurance` resolves, and it refuses to run on anything but source.
 * ⛔ THEN IT REFUSES THE PROGRAM OVERRIDES (`REG-D-072` D12), before any transport module is loaded.
 * ⚠ So this file imports nothing at load but the two pure modules those checks need; everything else is loaded after.
 *
 * ⭐ `JAN-CRITREAD` J2-3 — EVERY RUN LINE IS STAMPED WITH TODAY'S REVIEWER FINGERPRINT, scoring digest and case-set
 * digest (§5.5), computed by the one function the check shares (`fingerprint.ts` `reviewerFingerprint`) from the source
 * this run loads — so the check can say whether a run covers the reviewer in force. Until J2-3 the CLI stopped here
 * (`exit 3`); a fingerprint that cannot be computed still stops it there, before anything is written.
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
import type { IndicationsSource } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { QualificationCase } from './cases.js';
import type { CallReply } from './record.js';
import type { RunFingerprint, RunInputs } from './runner.js';
import type { RecordsOnFile } from './recorded-indications.js';
import type { CandidateSpec, TransportDeps } from './transports.js';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54 — THE CLI'S DECISION MODEL: a test's double, as handed; else the committed records'
 * static source with their identity, read once, which the RUN line writes beside the candidate.
 */
async function decisionModelOf(
	handed: IndicationsSource | undefined
): Promise<{ indications: IndicationsSource; decisionModel?: { model: string; digest: string; serverVersion: string } }> {
	if (handed) return { indications: handed };
	const { COMMITTED_INDICATIONS, committedRecordsIdentity } = await import('./recorded-indications.js');
	const identity = committedRecordsIdentity();
	return 'refusal' in identity ? { indications: COMMITTED_INDICATIONS } : { indications: COMMITTED_INDICATIONS, decisionModel: identity };
}

export interface CliDeps {
	/** The environment the product reads — `process.env`, which the runner WRITES the model variable into. */
	readonly env: Record<string, string | undefined>;
	/** `import.meta.resolve`. */
	readonly resolve: (specifier: string) => string;
	readonly write: (text: string) => void;
	/** The run's stamps (§5.5) — `fingerprint.ts`'s `reviewerFingerprint`, over the committed case set. */
	readonly fingerprint: () => Promise<RunFingerprint>;
	readonly commit: () => string;
	readonly now: () => Date;
	readonly transportDeps?: TransportDeps;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; design §12.2) — the decision model each case's review asks for its
	 * potential indications, once, before its first reviewer call. ⛔ The CLI run from the command line hands none in Z1: no client
	 * exists until package Z2's, so a paid run is refused at its first case before any call to the model it measures — its RUN
	 * line written, no CALL line. A test hands a double here, as it hands `transportDeps`.
	 * ⛔ MOVED (`JAN-EXEC` Phase 7, package Z2b — D54): ~~The CLI run from the command line hands none~~ — absent, the CLI reads the
	 * COMMITTED RECORDS (`recorded-indications.ts`, `COMMITTED_INDICATIONS`), so a run renders every prompt from D54's scores and
	 * writes their identity on its RUN line; a case whose questions no record holds is refused before any call.
	 */
	readonly indications?: IndicationsSource;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D53 — D54's records, with the sha256 of the files they were read from, that a devin run reads
	 * (`recorded-indications.ts`, `committedRecordsOnFile`); a test hands its own. Absent, the committed records.
	 */
	readonly records?: () => RecordsOnFile;
}

/**
 * ⭐ TODAY'S FINGERPRINT, from the source this process loads. ⚠ LOADED ONLY WHEN CALLED — after D11 and D12 — because
 * the fingerprint drives the product's validator, whose module chain includes the transport module D12 guards.
 * A fingerprint that cannot be computed is the harness's fault: no line is written (`exit 3`).
 */
const TODAYS_FINGERPRINT = async (): Promise<RunFingerprint> => {
	try {
		const { committedCaseSet, reviewerFingerprint } = await import('./fingerprint.js');
		const f = await reviewerFingerprint(committedCaseSet(new URL('../../', import.meta.url)).cases);
		return { reviewer: f.reviewer, scoring: f.scoring, caseSet: f.caseSet };
	} catch (e) {
		throw new HarnessRefusal(
			`REFUSED: the reviewer fingerprint (§5.5) could not be computed, so no RUN line can say which reviewer it ` +
				`measured — ${String(e)}`
		);
	}
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
	'num-ctx',
	// ⭐ Z3 — D47 — the folder outside the repository each devin call's session export is kept in.
	'exports',
	// ⭐ Z3 — the lead's ruling (`z3-p1-rulings.md`) — `rederive`: D53's re-derivation pass, which calls no reviewer.
	'mode'
]);
/** ⭐ Z3 — the flags only a run reads: the re-derivation pass calls no reviewer and appends nothing, so each would be ignored. */
const RUN_ONLY = ['repetitions', 'run-id'] as const;
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
	if (args.transport === 'ollama' && args['ollama-url'] === undefined)
		return '--ollama-url is required for the ollama transport: the server a run measures is named, never assumed';
	const ignored =
		args.transport === 'ollama' ? undefined : OLLAMA_ONLY.find((f) => args[f] !== undefined);
	if (ignored)
		return `--${ignored} is an ollama option: the ${args.transport} transport would ignore it`;
	// ⭐ Z3 — the re-derivation pass is D53's, before its devin runs; nothing it would ignore is taken in silence.
	if (args.mode !== undefined && args.mode !== 'run' && args.mode !== 'rederive') return '--mode is run or rederive';
	if (args.mode === 'rederive' && args.transport !== 'devin')
		return '--mode rederive is D53’s pass before its devin runs: --transport devin';
	const runOnly = args.mode === 'rederive' ? RUN_ONLY.find((f) => args[f] !== undefined) : undefined;
	if (runOnly) return `--${runOnly} is a run’s: --mode rederive calls no reviewer and appends nothing`;
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

/** The candidate the flags name — every number, and an ollama run's server, already checked by `argsProblem`. */
function candidateSpec(args: Args): CandidateSpec {
	const transport = args.transport as CandidateSpec['transport'];
	if (transport !== 'ollama') return { transport, modelLabel: args.model! };
	return {
		transport,
		modelLabel: args.model!,
		ollama: {
			baseUrl: args['ollama-url']!,
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
 * The run's last line: the calls appended to `out`, and those of `replies` that failed at the transport — ⭐ and (P5
 * package C, F4) those the tool cut at the model's output-token limit, counted apart: each left no reply to score.
 */
export function runSummary(out: string, replies: readonly CallReply[]): string {
	const failures = replies.filter((r) => r.status === 'TRANSPORT_FAILURE').length;
	const cut = replies.filter((r) => r.status === 'OUTPUT_LIMIT').length;
	return `${replies.length} calls appended to ${out}; ${failures} transport failure(s), ${cut} cut at the model’s output-token limit`;
}

/**
 * The run. Returns the exit code: 0 run recorded, 2 refused before anything was written, 3 no fingerprint could be computed,
 * 4 the harness stopped the run part-way — the lines appended before it stay, and name no fault of the candidate's.
 */
/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D47 AND D53'S REFUSALS BEFORE A PAID CALL (`REG-D-145`, `REG-D-146`; design §11.7 D47, §12.5
 * D53's Prechecks; roadmap "D53 — the re-measurement", Step 1), for a devin run — D53's, the selected candidate's — each before the
 * transport is loaded and so before any call. ⭑ D48's refusals that stand are built where they were: one run id a record
 * (`main`), D11 and D12 (`preflight.ts`); the rest live in the run's driver, as `p12high/run.sh`'s did.
 *   · D47 — `--exports`, a folder outside the repository, where each call's session export is kept;
 *   · D53 — the SELECTION in force in the record this run appends to (`--out`, as D53's runs append to `runs.ndjson`) names this
 *     run's candidate, devin with its `--model`;
 *   · D53 — D54's records are read and hold every current case, 97 of 97 (the static source holds them to the product's identity,
 *     and the live client holds the server to theirs);
 *   · D53 — the decision model is configured, for the live re-derivation before each case's first paid call (`runner.ts`
 *     `rederiving`), its evidence kept beside the exports.
 * Returns what the run reads, or why it is refused.
 */
async function d53Prechecks(
	args: Args,
	cases: readonly { readonly id: string }[],
	root: URL,
	deps: CliDeps,
	say: (s: string) => void
): Promise<string | Pick<import('./runner.js').RunInputs, 'indications' | 'decisionModel' | 'exports' | 'rederive'>> {
	const { existsSync, readFileSync } = await import('node:fs');
	const { isAbsolute, join, relative, resolve } = await import('node:path');
	const { fileURLToPath } = await import('node:url');
	// D47 — the folder, outside the repository.
	const folder = args.exports === undefined ? undefined : resolve(args.exports);
	if (folder === undefined)
		return 'REFUSED (D47): a devin run keeps each call’s session export in a folder outside the repository: --exports is required. Nothing was run.';
	const inside = relative(fileURLToPath(root), folder);
	if (!inside.startsWith('..') && !isAbsolute(inside))
		return `REFUSED (D47): --exports names a folder inside the repository (${inside || '.'}): the exports are kept outside it. Nothing was run.`;
	// D53 — the SELECTION in force names this run's candidate.
	const lines = existsSync(args.out!) ? readFileSync(args.out!, 'utf8').split('\n').filter((l) => l.trim() !== '') : [];
	const selected = lines
		.map((l) => JSON.parse(l) as { kind?: string; candidate?: { transport?: string; modelLabel?: string } })
		.filter((l) => l.kind === 'SELECTION')
		.at(-1)?.candidate;
	if (selected?.transport !== 'devin' || selected.modelLabel !== args.model)
		return selected === undefined
			? `REFUSED (D53): ${args.out} holds no SELECTION, and a devin run measures the candidate selected. Nothing was run.`
			: `REFUSED (D53): the SELECTION in force names ${selected.transport} / ${selected.modelLabel}, not this run’s devin / ${args.model}. Nothing was run.`;
	// D53 — D54's records, read, and holding every current case.
	const ri = await import('./recorded-indications.js');
	const onFile = deps.records?.() ?? ri.committedRecordsOnFile(root);
	if ('refusal' in onFile.read) return `REFUSED (D53): D54’s records cannot be read — ${onFile.read.refusal}. Nothing was run.`;
	const read = onFile.read;
	const missing = cases.filter((c) => !read.entries.has(`CASE ${c.id}`)).map((c) => c.id);
	if (missing.length > 0)
		return `REFUSED (D53): D54’s records hold ${cases.length - missing.length} of the ${cases.length} current cases; none for ${missing.join(', ')}. Nothing was run.`;
	// ⭐⭐ Z3 phase 2 — D53 (the lead's reading, for d49) — A CASE WHOSE RECORD HOLDS A REFUSAL IS NOT PRESENT: the validator
	// refuses its review before any reviewer call (`recorded-indications.ts` `refusedEntries`), so D53 cannot measure it. Refused,
	// naming each such case and its refusal, the refusal's last full stop left to the sentence's own.
	const refusedCases = cases.flatMap((c) => {
		const why = read.refusedEntries.get(`CASE ${c.id}`);
		return why === undefined ? [] : [`${c.id} — ${why.replace(/\.$/, '')}`];
	});
	if (refusedCases.length > 0)
		return `REFUSED (D53): D54’s records hold a refusal, not a review, for ${refusedCases.length} of the ${cases.length} current cases: ${refusedCases.join('; ')}. Nothing was run.`;
	// ⭐ Z3 phase 2 — and what the records hold, said: every current case, none refused, and the files read by their sha256.
	say(`D53 — D54’s records hold ${cases.length} of the ${cases.length} current cases, none refused (${onFile.files.map((f) => `${f.name} sha256 ${f.sha256}`).join(', ')})`);
	// D53 — the decision model, for the live re-derivation.
	const { configuredIndications } = await import('../../apps/rph-demo/src/lib/server/assurance/decision-model.js');
	// ⭐⭐ Package L8 — D63 (`REG-D-152`; the lead's decision (A)): held to the records' version alone, `[]` — though the product's
	// reviews accept 0.40.16 — since D53 is the re-measurement: on a version nobody measured it refuses, and never re-derives on it.
	const live = configuredIndications([]);
	if (live === undefined)
		return 'REFUSED (D53): the live re-derivation asks the decision model, and it is not configured (JPWB_DECISION_MODEL_SERVER and JPWB_DECISION_MODEL). Nothing was run.';
	return {
		indications: ri.recordedIndications(read),
		decisionModel: read.identity,
		exports: { folder, log: say },
		rederive: { live, folder: join(folder, 'rederived'), records: onFile.files, model: read.identity.model, log: say }
	};
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE RE-DERIVATION PASS (the lead's ruling, `z3-p1-rulings.md`: *"the re-derivation as its own
 * pass, before any paid call"*), `--mode rederive`, past D53's prechecks.
 *   · Each case of the run — every current case, unless `--cases` names some — has its requests asked live through the paid run's
 *     own wrapper (`runner.ts` `rederiving`). That wrapper writes the evidence a paid run then reads, `<exports>/rederived/<case>.json`,
 *     with its sha256 in the log.
 *   · The requests are the ones the paid run's validator asks: the product's `reviewPrompt` renders the case's prompt from the same
 *     input (`caseReviewInput`) and criteria, and asks them of the source it is handed, as the validator does.
 *   · ⛔ NO REVIEWER IS CALLED: no transport is loaded, and nothing is appended to `--out`.
 *   · ⛔ A difference, or the client's refusal, stops the pass with exit 2, that case's evidence unwritten.
 * Why a pass (the ruling): a stale record is found before any spend, the sponsor can see every case re-derived beside the
 * materialized prompts, and the paid runs then read the evidence and do not hold the graphics card.
 */
async function rederivationPass(
	cases: readonly QualificationCase[],
	paid: Pick<RunInputs, 'indications' | 'rederive'>,
	criteria: readonly AssessmentCriterion[],
	say: (s: string) => void
): Promise<number> {
	const [{ reviewPrompt }, { caseReviewInput }, { rederiving }] = await Promise.all([
		import('../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js'),
		import('./materialize.js'),
		import('./runner.js')
	]);
	for (const [n, c] of cases.entries()) {
		try {
			await reviewPrompt(caseReviewInput(c, criteria), rederiving(paid.rederive!, c.id, paid.indications));
		} catch (e) {
			say(
				`${(e as Error).message} — the re-derivation pass stopped at ${c.id}, case ${n + 1} of ${cases.length}: no reviewer ` +
					'was called, and no evidence was written for it'
			);
			return 2;
		}
	}
	say(
		`re-derivation pass: ${cases.length} of ${cases.length} case(s) re-derived, every score equal to the records’; no reviewer ` +
			'was called, and nothing was appended to the record'
	);
	return 0;
}

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
	// ⭐ The CURRENT set and its oracles (`cases.ts`, `JAN-CRITREAD` J2-5) — the ones the check holds coverage to.
	const root = new URL('../../', import.meta.url);
	const caseSet = JSON.parse(
		readFileSync(new URL(cases.CURRENT_CASE_SET_FILE, root), 'utf8')
	) as import('./cases.js').CaseSet;
	const oracles = JSON.parse(
		readFileSync(new URL(cases.CURRENT_ORACLES_FILE, root), 'utf8')
	) as import('./cases.js').OracleSet;
	const selected = selectCases(caseSet.cases, args.cases);
	if (typeof selected === 'string') {
		say(selected);
		return 2;
	}
	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D47 and D53's refusals before a paid call (design §11.7, §12.5): a devin run is D53's.
	const paid = args.transport === 'devin' ? await d53Prechecks(args, caseSet.cases, root, deps, say) : undefined;
	if (typeof paid === 'string') {
		say(paid);
		return 2;
	}
	// ⭐⭐ Z3 — THE RE-DERIVATION PASS (the lead's ruling): past D53's prechecks, every case of the run re-derived, and here it ends —
	// before any transport is loaded. ⭑ `paid` is always present: `--mode rederive` is refused for any transport but devin.
	if (args.mode === 'rederive')
		return paid === undefined ? 2 : rederivationPass(selected, paid, assurance.SEEDED_REASONING_REVIEW_CRITERIA, say);
	const replies: CallReply[] = [];
	let appended = 0;
	try {
		const transport = await transports.loadTransport(
			candidateSpec(args),
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
			// ⭐⭐ Z2b — D54: the records' scores, and their identity on the RUN line; a double where a test hands one.
			// ⭐⭐ Z3 — D53 — and a devin run's: the records it was held to, each case re-derived live before its first call, and
			// each call's export kept (D47).
			...(paid ?? (await decisionModelOf(deps.indications))),
			onLine: (line) => {
				appendFileSync(args.out!, record.serializeLine(line));
				appended += 1;
				if (line.kind === 'CALL') replies.push(line.reply);
			}
		});
	} catch (e) {
		// A HARNESS refusal is reported, never recorded against the candidate. Anything else is a defect, and throws.
		if (!isHarnessRefusal(e)) throw e;
		say(e.message);
		return appended === 0 ? 2 : 4;
	}
	say(runSummary(args.out!, replies));
	return 0;
}

if (import.meta.main) {
	const { execFileSync } = await import('node:child_process');
	process.exitCode = await main(process.argv.slice(2), {
		env: process.env,
		resolve: (s) => import.meta.resolve(s),
		write: (s) => process.stderr.write(s),
		fingerprint: TODAYS_FINGERPRINT,
		commit: () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		now: () => new Date()
	});
}
