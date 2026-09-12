/**
 * The PURE half of `guards:export` — the predicate that decides what counts as a consumer, and the comparison
 * that decides what counts as a finding.
 *
 * ⭑ SEPARATE FROM THE IO FOR THE REASON `scope-core.ts` IS: the CLI's answer is one pass/fail over the whole
 * repository, which cannot show that the two limbs — *a guard was LOST* and *the population MOVED* — fail
 * independently. Two limbs that always fail together are one check wearing two names.
 *
 * ── ⭐ THE UNIT IS THE EXPORT, AND IT TOOK A SECOND PASS TO ACTUALLY BE THE EXPORT ──────────────────────────
 * The first version recorded a per-FILE mutant COUNT and computed the obligation as
 * `consumedExports.length - mutants`. ⛔ That made guards FUNGIBLE WITHIN A FILE: six mutants piled on one
 * export discharged a six-export file completely. Measured instance: `assurance-rules.ts` reported 6 exports
 * and 2 guards — "owes 4" — with BOTH guards sitting on `BLOCKING_SEVERITIES`, so five of its exports were bare
 * and the figure understated the work. A ratchet satisfiable without meaning anything is not a ratchet.
 *
 * Guards are now ATTRIBUTED: every mutant anchor resolves to a line range and every exported declaration has a
 * span, so attribution is an INTERSECTION of machinery that already existed rather than a new record to keep.
 */

/** Per production file: which exports promise something to production code, and which of them are guarded. */
export interface GuardEntry {
	/** Exported VALUES imported by at least one non-test, non-tooling module. Sorted, so the diff is readable. */
	readonly consumedExports: readonly string[];
	/** The subset carrying at least one declared mutant ANCHORED INSIDE that export's own declaration. */
	readonly guardedExports: readonly string[];
	/**
	 * Mutants on this file whose anchor fell OUTSIDE every exported declaration — module-level code, a private
	 * helper, a shared constant.
	 *
	 * ⚠ THEY DISCHARGE NOTHING, AND THAT IS DELIBERATE RATHER THAN AN OVERSIGHT. Such a mutant is a real guard
	 * over real behaviour, but nothing says WHICH promise it defends, and crediting it to an arbitrary export
	 * would re-open exactly the fungibility this field exists to end. They are RECORDED so the work is not
	 * invisible, and excluded from the credit so the obligation stays honest.
	 */
	readonly unattributedMutants: number;
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
	/** Exports that HAD a guard and no longer do. The ratchet limb. */
	readonly guardLost: readonly string[];
	/** Files added, removed, or whose consumed-export set moved without the baseline being regenerated. */
	readonly populationChanged: readonly string[];
}

/**
 * Compare a recorded census against a measured one.
 *
 * ⛔ THE TWO LIMBS ARE COMPUTED OVER DIFFERENT QUESTIONS ON PURPOSE. `guardLost` asks only about files BOTH
 * sides know about and only about exports BOTH sides still have, so an added or removed file — or a renamed
 * export — cannot trip it; `populationChanged` asks only about membership and shape, so a dropped guard cannot
 * trip it. Without that separation a new file would report as a lost guard and nobody could tell which happened.
 *
 * ⭑ IT NAMES THE EXPORT, NOT JUST THE FILE. "This file has one fewer mutant" does not say what stopped being
 * defended; "`governance.ts#canPromoteBaseline` lost its guard" does, and it is the difference between a number
 * and a finding.
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
		const nowGuarded = new Set(now.guardedExports);
		const stillPresent = new Set(now.consumedExports);
		for (const exported of [...before.guardedExports].sort())
			if (stillPresent.has(exported) && !nowGuarded.has(exported))
				guardLost.push(`${file}#${exported} was guarded at baseline and is not guarded now`);

		const was = [...before.consumedExports].sort().join(',');
		const is = [...now.consumedExports].sort().join(',');
		if (was !== is)
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
	guardedExports: number;
	unattributedMutants: number;
	filesWithNoGuard: number;
	owed: number;
} {
	let consumedExports = 0;
	let guardedExports = 0;
	let unattributedMutants = 0;
	let filesWithNoGuard = 0;
	let owed = 0;
	for (const entry of Object.values(census)) {
		const guarded = new Set(entry.guardedExports);
		const bare = entry.consumedExports.filter((n) => !guarded.has(n)).length;
		consumedExports += entry.consumedExports.length;
		guardedExports += entry.guardedExports.length;
		unattributedMutants += entry.unattributedMutants;
		// ⛔ PER-EXPORT, SO A SURPLUS CANNOT OFFSET A DEFICIT. Summing signed differences would let a heavily
		// guarded export conceal a bare one — the averaging defect this whole programme exists to remove,
		// reappearing inside the instrument that measures it.
		owed += bare;
		if (entry.guardedExports.length === 0 && entry.consumedExports.length > 0) filesWithNoGuard += 1;
	}
	return {
		files: Object.keys(census).length,
		consumedExports,
		guardedExports,
		unattributedMutants,
		filesWithNoGuard,
		owed
	};
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

/** The line span of one exported declaration. */
export interface ExportSpan {
	readonly name: string;
	readonly startLine: number;
	readonly endLine: number;
}

/**
 * Which exports own the declaration a guard's anchor sits in.
 *
 * ⭐ THIS IS THE FUNCTION THAT ENDED FUNGIBILITY, so it is pure and it is tested. An empty result is the HONEST
 * answer for a mutant anchored in module-level code or a private helper — such a guard defends real behaviour,
 * but nothing says WHICH promise, and crediting it to a nearby export would restore exactly the defect
 * attribution was introduced to remove. Measured: 58 of the repository's existing mutants land there.
 *
 * ⚠ SEVERAL NAMES CAN OWN ONE LINE — `export const a = 1, b = 2;` is one statement — so this returns a LIST
 * rather than a first match. Returning the first would silently pick one of two equally-entitled owners.
 */
export function attributeGuard(spans: readonly ExportSpan[], anchorStartLine: number): string[] {
	return spans
		.filter((e) => e.startLine <= anchorStartLine && anchorStartLine <= e.endLine)
		.map((e) => e.name);
}
