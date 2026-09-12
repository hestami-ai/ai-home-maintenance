// CSAA'S OWN DECLARED MUTANTS — moved out of JPWB's ledger by JAN-CSAAEXT S5, 2026-09-11.
//
// ── WHY THESE ARE HERE AND NOT DELETED ───────────────────────────────────────────────────────────────────────
// These TWENTY entries mutate CSAA source and expect CSAA tests to redden. They lived in
// `scripts/mutants/ledger.ts` — JPWB's ledger — because CSAA lived inside JPWB. Under the sponsor's ruling that
// CSAA is not part of JPWB (REG-D-061), `packages/csaa` moves to `JanumiCode/csaa/` at S6, and a ledger entry
// whose `file` no longer exists reports FILE MISSING and reddens `verif/mutant-ledger.test.ts`.
//
// ⛔ DELETING THEM WAS NOT AVAILABLE, AND THE LEDGER SAYS SO IN ITS OWN WORDS. `DeclaredMutant.supersededBy`'s
// doc reads: *"Deleting the entry instead would erase the fact that the guard ever needed proving."* That is the
// rule this file obeys. ⚠ `supersededBy` itself was NOT usable: `verif/mutant-ledger.test.ts:82` requires every
// `supersededBy` to resolve to an entry that EXISTS in the same ledger, and no JPWB mutant proves a CSAA guard.
// Marking them superseded would have been a false claim in a field designed to make claims checkable.
//
// ── ⚠ WHAT IS TRUE TODAY, STATED PLAINLY: NOTHING RUNS THESE ─────────────────────────────────────────────────
// JPWB's harness no longer sees them and CSAA has no harness of its own. They are a PRESERVED RECORD, not a
// live gate, and reading them as coverage would be exactly the mistake this repository keeps recording. CSAA
// owes itself a runner; that debt is filed at REG-D-061 `D-5` alongside the non-vacuity check it also lacks.
// ⭑ The entries are kept VERBATIM — anchors, victims and rationale — so a future runner needs no archaeology.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────────────────────────────────────
// The interface is declared LOCALLY rather than imported from `scripts/mutants/ledger.ts`. Importing it would
// create a dependency from CSAA into JPWB's tooling — the exact direction `verif/product-boundary.test.ts`
// exists to forbid, and one that would not survive the move at all.

// ── ⛔ IT WAS NINETEEN, AND THE TWENTIETH WAS FOUND BY THE GATE, NOT BY ME ────────────────────────────────────
// S5 extracted the entries whose `file` began `packages/csaa/`. `CSAA-M13-technical-completion-skips-the-full-
// repository-gate` mutates `scripts/csaa-technical-completion.ts` with a victim in `verif/` — CSAA's subject,
// JPWB's paths — so that filter missed it, and S6's move left it pointing at two files that no longer existed.
// `verif/mutant-ledger.test.ts` caught it as FILE MISSING and VICTIM MISSING on the first post-move gate.
// ⭑ THE DEFECT WAS THE CRITERION, NOT THE COUNT. I enumerated a path prefix where the real predicate was
// "entries whose subject moves with CSAA". The instrument that actually found the whole population asks nothing
// about csaa at all: *which entries point at a path that is not on disk?* Run that way, the answer was one, and
// an independent sweep of the remaining 254 confirmed no others — including one entry whose `{` is followed by a
// comment before `id:`, which a naive block-splitter merges into its predecessor and silently never checks.
//
// ── PATHS ARE CSAA-ROOT-RELATIVE AS OF S6 ────────────────────────────────────────────────────────────────────
// All 38 `packages/csaa/…` paths were rewritten to `src/…`, and the `verif/` victim to `scripts/…`, because CSAA
// now lives at `JanumiCode/csaa/` and a record whose paths describe the old layout is a fixture that no longer
// resembles its subject.

/** The subset of JPWB's `DeclaredMutant` these twenty use. Kept structurally identical so they can be read back. */
export interface CsaaDeclaredMutant {
	/** Stable id, as used in the work package that declared it. */
	readonly id: string;
	/** Repo-relative path of the file to mutate, as of before the S6 move. */
	readonly file: string;
	/** The anchor. MUST occur exactly once, or the verdict is UNANCHORED. */
	readonly find: string;
	readonly replace: string;
	/** The suites that MUST fail. */
	readonly expectRed: readonly string[];
	/** The guard this mutant proves, in one line. */
	readonly why: string;
	/** Where it came from, so a reader can find the original argument. */
	readonly source: string;
}

export const CSAA_DECLARED_MUTANTS: readonly CsaaDeclaredMutant[] = [
	{
		id: 'F195-the-capsule-stops-labelling-what-the-executor-imports',
		file: 'src/providers/jpwb-arrow-command-census/artifact-set.ts',
		// THE LATENT TWIN OF THE DEFECT THAT BROKE THE MERGE, in the sibling provider that had not yet been hit.
		// The guard-enforcement-ledger capsule hand-enumerated its members; one correctly-motivated relative import
		// emptied it and the worker died. This provider carried the identical enumeration and was saved only by the
		// accident that `verif/arrow-command-census.ts` imports nothing relative.
		//
		// ⚠ THAT ACCIDENT IS ALSO WHY THIS MUTANT IS NECESSARY RATHER THAN DECORATIVE. The real executor's closure
		// is EMPTY, so `executorDependencyArtifacts` reads 0 in the repository-population test, and the
		// end-to-end capsule spawn in `repository-smoke.test.ts` reads 0 for the same reason AND is opt-in behind
		// `CSAA_REPOSITORY_SMOKE=1`, so it never runs in `gate:fast`. Deleting the wiring outright would leave the
		// entire standing gate green. The victim named below is the ONLY test in the repository that supplies an
		// executor which actually imports, and it is the only thing standing between this wiring and silent removal.
		// ⚠ THE MECHANISM RECORDED HERE WAS WRONG ON FIRST WRITING, AND THE MUTANT KILLED ANYWAY — which is exactly
		// why it needed driving rather than deriving. I wrote that dropping this rung leaves a member "selected but
		// bound with empty `uses`". It does not. The rung feeds `isEligiblePath`, so the dependency never enters
		// `rowsByPath` at all, and the required-presence loop — which includes the closure paths — then reports
		// REQUIRED_ARTIFACT_MISSING and the whole population is refused: measured `outcome: 'unavailable'`, not a
		// half-bound artifact. That is a STRONGER guard than the one I credited it with, and a KILL is not evidence
		// that the sentence beside it is true. The "selected but unlabelled" failure is real but belongs to a
		// DIFFERENT mutation, declared separately below.
		find: "\tif (executorDependencyPaths.has(path)) uses.add('EXECUTOR_DEPENDENCY_SOURCE');",
		replace: '\t// MUTANT: derived closure members are never labelled',
		expectRed: ['src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
		why: 'REG-F-195 W-6: without the label a derived closure member is not eligible, so the capsule refuses the whole population rather than shipping without a module the executor imports',
		source: 'DESIGN-derived-capsule-closure.md W-6'
	},
	{
		id: 'F195-the-binding-site-forgets-what-selection-decided',
		file: 'src/providers/jpwb-arrow-command-census/artifact-set.ts',
		// THE ONLY ONE OF THE THREE WHOSE FAILURE IS GENUINELY SILENT, and the reason it exists is that I checked
		// a claim instead of repeating it. W-2 warns that `usesForPath` has a third caller which is the BINDING
		// site, and that wiring only the selection sites leaves an artifact "selected but unusable". In THIS
		// provider the parameter is required, so simply forgetting the call site is a COMPILE error — the trap as
		// literally worded cannot happen here. Passing the WRONG set can, and does: selection still admits the
		// dependency, the binding drops its `uses`, and the result is a valid-looking artifact set whose
		// dependency counter silently reads 0. NO diagnostic, NO refusal — measured `expected +0 to be 2`.
		//
		// So the sibling's warning is sound in substance and wrong in mechanism for this file, and the guard it
		// points at is the one most worth holding: the other two mutants fail LOUDLY, this one only changes a number.
		find: '\t\tconst result = bindArtifact(subject, rows[0]!, usesForPath(path, closureSelection.paths));',
		replace:
			'\t\tconst result = bindArtifact(subject, rows[0]!, usesForPath(path, new Set())); // MUTANT: binding ignores the closure',
		expectRed: ['src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
		why: 'REG-F-195 W-6: an artifact selected by the closure and then bound without it is materialised into the capsule with no recorded reason for being there, and nothing fails',
		source: 'DESIGN-derived-capsule-closure.md W-6'
	},
	{
		id: 'F195-an-undecidable-import-closure-goes-silent-again',
		file: 'src/providers/jpwb-arrow-command-census/artifact-set.ts',
		// THE ORIGINAL DEFECT, EXACTLY — not an analogue of it. `resolveFrozenModuleClosure` obeys a fail-closed
		// law: `paths` is empty IFF `findings` is non-empty. Drop the findings on the floor and an UNRESOLVABLE
		// closure becomes indistinguishable from an EMPTY one, so the capsule is written without the module and
		// the executor's dynamic import fails inside the worker with the 49-byte constant that started all of this.
		//
		// ⚠ DELIBERATELY NOT A MUTATION OF THE COVERAGE COUNTER. Attacking the count would prove only that one
		// number follows another; this attacks the SILENCE, which is the property the programme exists to remove.
		// Measured before declaring: reddens exactly one test across the six-file provider suite, and the sibling
		// label mutant above reddens a different one — so neither is standing in for the other.
		find: '\tconst diagnostics: ArrowCommandCensusArtifactSetDiagnostic[] = [...closureSelection.diagnostics];',
		replace:
			'\tconst diagnostics: ArrowCommandCensusArtifactSetDiagnostic[] = []; // MUTANT: closure findings discarded',
		expectRed: ['src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
		why: 'REG-F-195 W-6: an import the capsule cannot resolve must refuse the population, because a silently empty closure IS the defect that broke the merge',
		source: 'DESIGN-derived-capsule-closure.md W-6'
	},
	/*
	 * ⚠⚠ THE MODULE THE WHOLE PROGRAMME RESTS ON, WHICH UNTIL NOW HELD NONE OF THESE. `subject/analyzer-closure.ts`
	 * is the derivation every capsule now depends on. It shipped with eight controls and nothing that could show
	 * any of them capable of failing.
	 *
	 * ⚠ AND THE GAP WAS WIDER THAN "NO MUTANTS", derived from the code rather than noticed in the tests: of the
	 * ELEVEN finding codes the module can emit, the original eight controls observed FIVE. Six refusals could have
	 * been deleted outright with every suite still green. C9-C14 close that; the four mutants below hold the
	 * sharpest of them plus the module's central law.
	 */
	{
		id: 'F196-the-resolver-bets-on-a-candidate-instead-of-refusing',
		file: 'src/subject/analyzer-closure.ts',
		// THE ONE REFUSAL THIS FILE ARGUES FOR IN PROSE, and until C9 nothing checked the bet was still refused:
		// "Returning the first present candidate would be a PREFERENCE — a bet on which file the runtime picks.
		// Requiring exactly one present candidate is a REFUSAL. The wager is the class of thing under repair."
		// This mutation makes the wager. It is the shape a well-meaning "just resolve it" fix would take, and it
		// is silent: a capsule would bind a real, present, WRONG file and the worker would run happily against it.
		find: "\tif (present.length > 1) return { kind: 'AMBIGUOUS', present };",
		replace:
			"\tif (present.length > 1) return { kind: 'RESOLVED', path: present[0]! }; // MUTANT: prefers, not refuses",
		expectRed: ['src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: two present candidates is an undecidable question about the runtime, and answering it by position is a guess the capsule cannot audit',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-an-undecidable-edge-is-read-as-no-edge',
		file: 'src/subject/analyzer-closure.ts',
		// A dynamic `import(variable)` cannot be resolved from bytes. Treating it as ABSENT rather than as a
		// REFUSAL is exactly the defect the whole programme exists to remove — the capsule ships without a module
		// the analyzer will load, and nothing anywhere says so. Reclassifying it as BARE is the plausible mistake:
		// bare specifiers are legitimately collected-and-not-traversed, so it reads as "handled".
		find: "\t\treturn fault('SPECIFIER_NOT_LITERAL', null, null);",
		replace: "\t\treturn { kind: 'BARE', specifier: '<non-literal>' }; // MUTANT: undecidable read as absent",
		expectRed: ['src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: "we could not decide" and "there is nothing here" are different facts, and only one of them is safe to build a capsule from',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-the-decoder-substitutes-bytes-nobody-has',
		file: 'src/subject/analyzer-closure.ts',
		// ONE WORD, AND IT IS THE WHOLE GUARANTEE. A non-fatal decoder substitutes U+FFFD for invalid sequences
		// and hands the parser a file that is not the one in the byte store — so the closure would be a true
		// statement about a text nobody has, derived from a subject that is supposed to be byte-frozen. It also
		// would not throw, would not warn, and would usually still parse.
		// Anchored on CONTENT without leading whitespace (ledger rule #4) — my first attempt counted three tabs
		// where the file has two, and the anchor gate caught it before it could become a claim nobody can perform.
		find: "text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);",
		replace:
			"text = new TextDecoder('utf-8', { fatal: false }).decode(bytes); // MUTANT: lossy decode",
		expectRed: ['src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: a byte-frozen subject decoded lossily is no longer byte-frozen, and the closure silently describes a file that does not exist',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-the-fail-closed-law-ships-a-partial-closure',
		file: 'src/subject/analyzer-closure.ts',
		// THE CENTRAL LAW: `paths` is empty IFF `findings` is non-empty. There is no partial closure, because a
		// partial closure is precisely what the capsule cannot survive — it is the ORIGINAL defect, a member list
		// that is quietly short. This mutation keeps the findings (so a caller that reads them still sees them)
		// and ships the paths anyway, which is the most plausible "why throw away the work we did" softening.
		// ⚠ BOTH PROVIDERS DEPEND ON THIS LAW rather than on their own checks: their diagnostics arms assume that
		// a non-empty `findings` guarantees an empty selection.
		//
		// ⚠ MEASURED BLUNTNESS, RECORDED RATHER THAN GLOSSED: this one reddens NINE tests where the other three
		// redden one apiece, because nearly every control in the file asserts `paths` is `[]` on refusal. That is
		// good news about the law's coverage and BAD news about this mutant's discrimination — a broad red cannot
		// tell you WHICH property failed. It is kept because the law is worth holding at all, not because a
		// nine-test red is strong evidence. A sharper replacement would target one arm of the law only.
		find: '\tif (findings.length > 0) return failed(findings);',
		replace:
			'\t// MUTANT: findings reported, partial closure shipped anyway (law was: paths empty IFF findings non-empty)',
		expectRed: ['src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: a closure that reports a problem AND returns a population invites the caller to use the population, which is the hand-enumerated defect with a diagnostic attached',
		source: 'REG-F-196 Finding 2'
	},
	// ── REG-F-199: the measuring instrument's own guard ─────────────────────────────────────────────────────────
	// The ground-truth tracker's consumer walk decides, for every ratified name, whether an implementation of it
	// exists. It did that with `String.includes` — and so reported the ratified query `getPwu` as implemented
	// because `getPwuTemplate` is spelled that way for its first six characters. That was the SOLE positive
	// result in the fourteen-name population the walk was commissioned to measure.
	//
	// TWO mutants, ONE victim each, and the split is not bookkeeping — it is the whole point. The one-victim
	// rule (verif/mutant-ledger.test.ts) caught a first draft that named both suites on one mutant: `run.ts`
	// invokes vitest ONCE over the named set, so a second name means "any of these reddens", which is WEAKER.
	// Split into two DISTINCT mutations, each aimed at the reader it is meant to prove, the claim gets stronger
	// AND the second one proves something the first cannot — that the CENSUS leg can see an instrument
	// regression at all, which is true only because a LIVE `measure.ts` run was added beside the DB-reading
	// assertion. Without it a broken matcher would leave the committed journal, and so the whole census gate,
	// green.
	{
		id: 'CSAA-M1-four-valued-short-circuit-inverts-the-decisive-truth',
		file: 'src/query/four-valued-query-algebra.ts',
		find: "\tif (node.kind === 'OR' || node.kind === 'ANY') return 'TRUE';",
		replace: "\tif (node.kind === 'OR' || node.kind === 'ANY') return 'FALSE';",
		expectRed: ['src/query/four-valued-query-algebra.test.ts'],
		why: 'A short-circuit witness is sound only when OR and ANY stop on TRUE while AND and ALL stop on FALSE. Inverting the OR/ANY decisive truth makes the optimized evaluator disagree with the eager four-valued algebra.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M2-native-projection-ignores-an-intersecting-unknown-population',
		file: 'src/rules/jpwb-harmonization-native-projection.ts',
		find: "\treturn intersects ? 'OPEN' : 'EXACT_RULE_ELIGIBLE_PATH_POPULATION';",
		replace: "\treturn 'EXACT_RULE_ELIGIBLE_PATH_POPULATION';",
		expectRed: ['src/rules/jpwb-harmonization-native-projection.test.ts'],
		why: 'A rule projection may close an eligible-path population only when no positive or unknown excluded record intersects it. Ignoring that intersection converts missing physical files into an absence conclusion.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M3-content-store-reuses-across-a-changed-dependency-digest',
		file: 'src/persistence/content-addressed-file-store.ts',
		find: '\t\t\t\tprior.dependencyDigest === dependencies &&\n',
		replace: '',
		expectRed: ['src/persistence/content-addressed-file-store.test.ts'],
		why: 'Incremental reuse is valid only when the exact dependency identities still hash to the prior dependency digest. Dropping this limb returns stale bytes after an input change while presenting them as a current generation.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M4-verification-accepts-any-passing-assertion',
		file: 'src/cli/compose-coding-agent-cli-handlers.ts',
		find: '\t\t\t\tassertionResults.every((assertion) => assertion.passed);',
		replace: '\t\t\t\tassertionResults.some((assertion) => assertion.passed);',
		expectRed: ['src/cli/compose-coding-agent-cli-handlers.test.ts'],
		why: 'Workflow verification is conjunctive: every declared assertion and both snapshot bindings must pass. Accepting one green assertion hides a simultaneously failed exact expectation and wrongly returns workflow completion.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M5-cancelled-commit-is-misreported-as-store-unavailable',
		file: 'src/cli/run-coding-agent-cli.ts',
		find: "\t\t\t\t} catch {\n\t\t\t\t\tawait rollbackArtifactTransaction(options.artifactTransaction);\n\t\t\t\t\tif (signalAborted(options.signal))\n\t\t\t\t\t\treturn interruptedResult(invocation.request, responseAt, 'CANCELLED');",
		replace:
			"\t\t\t\t} catch {\n\t\t\t\t\tawait rollbackArtifactTransaction(options.artifactTransaction);\n\t\t\t\t\tif (false)\n\t\t\t\t\t\treturn interruptedResult(invocation.request, responseAt, 'CANCELLED');",
		expectRed: ['src/cli/run-coding-agent-cli.test.ts'],
		why: 'If cancellation interrupts a rejected durable commit, rollback must be followed by the typed CANCELLED refusal. Falling through to store-unavailable erases the trusted host cancellation and gives the caller the wrong retry and currentness semantics.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M6-explanation-skips-hybrid-evidence-replay-equality',
		file: 'src/cli/compose-coding-agent-cli-handlers.ts',
		find: '\t\t\t\tcanonicalSemanticJson(replayedHybridEvidence) !==\n\t\t\t\t\tcanonicalSemanticJson(findings.hybridEvidence)',
		replace: '\t\t\t\tfalse',
		expectRed: ['src/cli/compose-coding-agent-cli-handlers.test.ts'],
		why: 'Explanation may accept stored hybrid evidence only when exact current frozen bytes and the referenced trace reproduce it canonically. Removing that equality lets a content-addressed findings artifact carry tampered runtime evidence into an apparently replayed explanation.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M7-hybrid-projector-analyzes-an-inventory-only-artifact',
		file: 'src/providers/runtime/project-hybrid-static-prerequisites.ts',
		find: "\tif (artifact.disposition !== 'ANALYZED' || artifact.bytes < 0 || !SHA256.test(artifact.sha256))",
		replace: '\tif (artifact.bytes < 0 || !SHA256.test(artifact.sha256))',
		expectRed: ['src/providers/runtime/project-hybrid-static-prerequisites.test.ts'],
		why: 'The five hybrid prerequisites are source-analysis claims, so an INVENTORY_ONLY artifact is not an admitted source region even when bytes and digest are present. Dropping the disposition guard promotes a non-analysis census artifact into DFG or taint evidence.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M8-persistence-validator-accepts-the-unimplemented-sqlite-backend',
		file: 'src/persistence/assess-dwp-007-persistence-selection.ts',
		find: "\texactJson(\n\t\trecord.selection,\n\t\t{\n\t\t\tacceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO',\n\t\t\treasons: [\n\t\t\t\t'SELECTED_BACKEND_PASSES_EVERY_REQUIRED_CRITERION',\n\t\t\t\t'BETTER_SQLITE3_IS_NOT_A_BUN_WINDOWS_SAFE_IMPLEMENTED_CSAA_STORE',\n\t\t\t\t'BUN_SQLITE_BUILTIN_WOULD_REQUIRE_A_DIFFERENT_UNIMPLEMENTED_ADAPTER',\n\t\t\t\t'REUSING_THE_VALIDATED_FILE_STORE_AVOIDS_SEMANTIC_AND_MIGRATION_RISK'\n\t\t\t],\n\t\t\tselectedBackend: 'CONTENT_ADDRESSED_FILES',",
		replace:
			"\texactJson(\n\t\trecord.selection,\n\t\t{\n\t\t\tacceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO',\n\t\t\treasons: [\n\t\t\t\t'SELECTED_BACKEND_PASSES_EVERY_REQUIRED_CRITERION',\n\t\t\t\t'BETTER_SQLITE3_IS_NOT_A_BUN_WINDOWS_SAFE_IMPLEMENTED_CSAA_STORE',\n\t\t\t\t'BUN_SQLITE_BUILTIN_WOULD_REQUIRE_A_DIFFERENT_UNIMPLEMENTED_ADAPTER',\n\t\t\t\t'REUSING_THE_VALIDATED_FILE_STORE_AVOIDS_SEMANTIC_AND_MIGRATION_RISK'\n\t\t\t],\n\t\t\tselectedBackend: 'SQLITE_BETTER_SQLITE3',",
		expectRed: ['src/persistence/assess-dwp-007-persistence-selection.test.ts'],
		why: 'The checked decision selected the already implemented file store and explicitly found better-sqlite3 ineligible on the active Bun/Windows host. A validator that canonizes SQLite would admit a forged decision for an adapter that was never implemented or accepted.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M9-g4-closes-over-a-wider-provider-module-population',
		file: 'src/graph/run-current-dependency-cruiser-differential.ts',
		find: '\t\t!samePaths(deepIndexedSourcePaths, expected) ||\n\t\t!samePaths(providerInputPaths, expected) ||\n\t\t!samePaths(providerModulePaths, expected)',
		replace:
			'\t\t!samePaths(deepIndexedSourcePaths, expected) ||\n\t\t!samePaths(providerInputPaths, expected) ||\n\t\tfalse',
		expectRed: ['src/graph/run-current-dependency-cruiser-differential.test.ts'],
		why: 'The G4 witness is same-perimeter evidence only if the provider module population equals the exact compiler build-root source population. Ignoring one extra provider module silently widens one side and invalidates the closure claim.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M10-g4-closes-despite-an-observed-provider-difference',
		file: 'src/graph/run-current-dependency-cruiser-differential.ts',
		find: '\t\tcomparison.observedDifferenceRecords !== 0 ||',
		replace: '\t\tfalse ||',
		expectRed: ['src/graph/run-current-dependency-cruiser-differential.test.ts'],
		why: 'The same-perimeter population witness is insufficient when the two providers retain even one observed difference. Dropping this refusal converts bounded disagreement into a closed-no-difference record.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M11-native-projection-ignores-a-missing-mandatory-governed-source',
		file: 'src/rules/jpwb-harmonization-native-projection.ts',
		find: '\t\tseed !== null && missingMandatoryInputIds.length === 0 && uncertainties.length === 0;',
		replace: '\t\tseed !== null && uncertainties.length === 0;',
		expectRed: ['src/rules/jpwb-harmonization-native-projection.test.ts'],
		why: 'A detector seed cannot close a rule when its governed mandatory source is absent. Ignoring the mandatory-input population promotes partial source coverage into a conclusive native finding.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M12-pre-operation-recapture-accepts-a-different-subject',
		file: 'src/cli/compose-coding-agent-cli-handlers.ts',
		find: '\tif (recapturedSubjectId !== snapshotArtifact.snapshot.subjectId)',
		replace: '\tif (false)',
		expectRed: ['src/cli/compose-coding-agent-cli-handlers.test.ts'],
		why: 'A current subject is still stale for this workflow when it is not the exact subject bound to the stored snapshot. Removing the identity refusal lets the owning operation run against a substituted pre-operation capture.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
	{
		id: 'CSAA-M13-technical-completion-skips-the-full-repository-gate',
		file: 'scripts/csaa-technical-completion.ts',
		find: '\tfor (const step of CSAA_TECHNICAL_COMPLETION_STEPS) executeStep(step);',
		replace:
			"\tfor (const step of CSAA_TECHNICAL_COMPLETION_STEPS.filter((step) => step.label !== 'FULL_REPOSITORY_GATE')) executeStep(step);",
		expectRed: ['scripts/csaa-technical-completion.test.ts'],
		why: 'Technical completion is the exact serialized conjunction of every retained evidence check, the current workflow, and the repository gate. Skipping the last step must not yield the same completion record.',
		source: 'JAN-CSAA completion review 2026-08-25'
	},
];
