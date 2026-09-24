// ⭐ `JAN-CRITREAD` J2-2 — WHAT THE RUNNER REFUSES BEFORE IT LOADS ANYTHING (`REG-D-072` D11, D12).
//
// ⛔ PURE, AND IMPORTING NOTHING. The CLI (`run.ts`) asks both questions before it loads the runner, the validator or a
// transport, because each question is about what LOADING would do:
//
//   · D11 — under bare `bun`, every `@janumipwb/*` specifier resolves to the package's built `dist`, which is stale
//     the moment a source file is edited. A qualification run that silently measured last build's reviewer would be
//     recorded against today's fingerprint. So the runner runs FROM SOURCE — `bun --conditions=source`, which every
//     package's export map answers with `./src/…` — and refuses to run on anything else.
//   · D12 — `agy-cli.ts` and `devin-reviewer.ts` read `JPWB_AGY_BIN` / `JPWB_DEVIN_BIN` ONCE, AT MODULE LOAD, and any
//     program named there is recorded as the real tool (`REG-F-441`: every stand-in measurement so far reached its
//     stand-in that way). So the refusal has to come before the first import of either module, or the override is
//     already captured when it is checked.

/** The program overrides a qualification run refuses (`REG-D-072` D12; `REG-F-441`). */
export const PROGRAM_OVERRIDE_VARIABLES = ['JPWB_AGY_BIN', 'JPWB_DEVIN_BIN'] as const;

/** A refusal by the HARNESS — not the candidate's failure, and never recorded against it. The run stops. */
export class HarnessRefusal extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'HarnessRefusal';
	}
}

/**
 * Is this the harness's refusal? ⚠ BY NAME AS WELL AS BY CLASS: the CLI loads the runner after its own checks, and a
 * second copy of this module (vitest's `resetModules`, a bundle) makes a second `HarnessRefusal` class — `instanceof`
 * alone would then turn a refusal into a crash.
 */
export function isHarnessRefusal(e: unknown): e is HarnessRefusal {
	return e instanceof HarnessRefusal || (e instanceof Error && e.name === 'HarnessRefusal');
}

/** Why a run may not start with this environment, or undefined. Set — even to the empty string — is refused. */
export function programOverrideProblem(
	env: Readonly<Record<string, string | undefined>>
): string | undefined {
	const set = PROGRAM_OVERRIDE_VARIABLES.filter((v) => env[v] !== undefined);
	if (set.length === 0) return undefined;
	return (
		`REFUSED (REG-D-072 D12; REG-F-441): ${set.map((v) => `${v} is set`).join(' and ')}. The product reads it once, ` +
		'when its transport module loads, and records whatever program it names as the real tool — so a qualification ' +
		'run could be measuring a stand-in under the real tool’s name. Unset it; the runner uses the product’s own ' +
		'program, and asserts the argv it is given.'
	);
}

/** Throw the D12 refusal, if there is one. */
export function refuseProgramOverrides(env: Readonly<Record<string, string | undefined>>): void {
	const problem = programOverrideProblem(env);
	if (problem) throw new HarnessRefusal(problem);
}

/**
 * Why a model label may not be recorded, or undefined. ⛔ BLANK OR PADDED IS THE HARNESS'S FAULT: the product trims
 * what it reads (`resolveJudgeModel`, `resolveAssuranceModel`), so a padded label is recorded as one model while the
 * tool is given another, and a blank one resolves to nothing — which would reach the record as the CANDIDATE's
 * refusal. Refused before anything is written.
 */
export function modelLabelProblem(label: string): string | undefined {
	if (label.trim() !== '' && label === label.trim()) return undefined;
	return (
		`REFUSED: the model label ${JSON.stringify(label)} is blank or carries surrounding whitespace. The product trims ` +
		'the label it reads, so the label recorded would not be the model run — a harness fault, never the candidate’s.'
	);
}

/** The package whose resolution stands for all of them: the runner's scoring comes from it. */
export const SOURCE_PROBE = '@janumipwb/rph-assurance';

/** Why the runner may not run with `SOURCE_PROBE` resolved to `resolved`, or undefined when it resolves to source. */
export function sourceResolutionProblem(resolved: string): string | undefined {
	if (/\/packages\/rph-assurance\/src\/index\.ts$/.test(resolved.replace(/\\/g, '/')))
		return undefined;
	return (
		`REFUSED (REG-D-072 D11): ${SOURCE_PROBE} resolves to ${resolved}, not to its source. Under bare bun every ` +
		'@janumipwb package resolves to its built dist, which is stale after any source edit, so a run would measure the ' +
		'last build’s reviewer. Run it from source: bun --conditions=source scripts/reviewer-qual/run.ts …'
	);
}
