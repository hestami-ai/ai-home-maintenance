/**
 * The PURE half of `guards:export` — the predicate that decides what counts as a consumer, and the comparison
 * that decides what counts as a finding.
 *
 * ⭑ SEPARATE FROM THE IO FOR THE REASON `scope-core.ts` IS: the CLI's answer is one pass/fail over the whole
 * repository, which cannot show that the two limbs — *a guard was LOST* and *the population MOVED* — fail
 * independently. Two limbs that always fail together are one check wearing two names.
 */

/** Per production file: the exports that make a promise to other production code, and the guards on it. */
export interface GuardEntry {
	/** Exported VALUES imported by at least one non-test, non-tooling module. Sorted, so the diff is readable. */
	readonly consumedExports: readonly string[];
	/** Declared, measurable mutants whose `file` is this file. */
	readonly mutants: number;
}

export type GuardCensus = Record<string, GuardEntry>;

/**
 * Is this importer a PRODUCTION consumer?
 *
 * ⚠ THE FIRST VERSION OF THIS PREDICATE WAS WRONG IN A WAY WORTH PINNING. It asked *"is this path under
 * `packages/`?"* — an INTRINSIC property — and so counted a colocated `foo.test.ts` as production, inflating
 * the obligation. The question is RELATIONAL: *is this consumer a test?* An export whose only importer is its
 * own test makes no promise to the system, and obliging a guard for it would manufacture exactly the token
 * count the sponsor rejected.
 */
export const isProductionConsumer = (path: string): boolean =>
	!/[.](test|spec)[.](ts|tsx)$/.test(path) && !path.includes('/verif/') && !path.includes('/scripts/');

export interface GuardComparison {
	/** Files whose guard count FELL. The ratchet limb. */
	readonly guardLost: readonly string[];
	/** Files added, removed, or whose consumed-export set moved without the baseline being regenerated. */
	readonly populationChanged: readonly string[];
}

/**
 * Compare a recorded census against a measured one.
 *
 * ⛔ THE TWO LIMBS ARE COMPUTED OVER DIFFERENT QUESTIONS ON PURPOSE. `guardLost` asks only about files BOTH
 * sides know about, so an added or removed file cannot trip it; `populationChanged` asks only about membership
 * and shape, so a dropped mutant cannot trip it. Without that separation a new file would report as a lost
 * guard and nobody could tell which had happened.
 *
 * ⚠ AND A RISING EXPORT COUNT IS A POPULATION CHANGE, NOT A FAILURE OF THE AUTHOR. Adding an export is normal
 * work; what is refused is adding it WITHOUT regenerating the census, because an obligation nobody recorded is
 * one nobody can discharge.
 */
export function compareGuardCensus(recorded: GuardCensus, measured: GuardCensus): GuardComparison {
	const guardLost: string[] = [];
	const populationChanged: string[] = [];

	for (const file of Object.keys(measured).sort()) {
		const before = recorded[file];
		if (before === undefined) {
			populationChanged.push(`${file} is measured but absent from the baseline`);
			continue;
		}
		const now = measured[file]!;
		if (now.mutants < before.mutants)
			guardLost.push(
				`${file}: ${before.mutants} declared guard(s) at baseline, ${now.mutants} now (-${before.mutants - now.mutants})`
			);
		const wasExports = [...before.consumedExports].sort().join(',');
		const nowExports = [...now.consumedExports].sort().join(',');
		if (wasExports !== nowExports)
			populationChanged.push(
				`${file}: its production-consumed exports moved (${before.consumedExports.length} -> ${now.consumedExports.length})`
			);
	}

	for (const file of Object.keys(recorded).sort())
		if (measured[file] === undefined)
			populationChanged.push(`${file} is in the baseline but is no longer measured`);

	return { guardLost, populationChanged };
}

/** How much of the obligation is outstanding, as a derived figure — never a constant quoted from a document. */
export function outstandingObligation(census: GuardCensus): {
	files: number;
	consumedExports: number;
	mutants: number;
	filesWithNoGuard: number;
	owed: number;
} {
	let consumedExports = 0;
	let mutants = 0;
	let filesWithNoGuard = 0;
	let owed = 0;
	for (const entry of Object.values(census)) {
		consumedExports += entry.consumedExports.length;
		mutants += entry.mutants;
		if (entry.mutants === 0 && entry.consumedExports.length > 0) filesWithNoGuard += 1;
		owed += Math.max(0, entry.consumedExports.length - entry.mutants);
	}
	return { files: Object.keys(census).length, consumedExports, mutants, filesWithNoGuard, owed };
}

/**
 * Is this source GENERATED?
 *
 * ⛔ GENERATED FILES ARE EXCLUDED FROM THE OBLIGATION, AND THE REASON IS THIS REPOSITORY'S OWN RULE: never
 * hand-edit a generated artifact, run its generator. A declared mutant is an anchored hand-edit — its `find`
 * string would rot on the next regeneration, and a ledger entry that rots is indistinguishable from a passing
 * one. More importantly the guarantee does not LIVE there: `enums.ts` is a projection of
 * `vocab/canonical-vocabulary.json` through `gen/gen-enums.ts`, so the claim worth guarding is the generator's,
 * and mutating the emitted constant would test the emitter's output rather than anyone's promise.
 *
 * ⚠ THIS IS A SCOPE CORRECTION, NOT PROGRESS. It removes ~121 exports from the count. The generated surface is
 * still unguarded in the ordinary sense; it is filed as its own question (whose guard is a generator-freshness
 * check — see `S0.3`, which found `bun run gen` is in no gate) rather than counted here and quietly never done.
 *
 * ⭑ DERIVED FROM THE FILE'S OWN BANNER, never a hand-maintained path list: five files repo-wide declare it, and
 * a sixth added tomorrow is excluded automatically instead of silently acquiring an obligation nobody meant.
 */
export const isGeneratedSource = (text: string): boolean =>
	/^\/\/ GENERATED FILE\b/m.test(text.slice(0, 400));
