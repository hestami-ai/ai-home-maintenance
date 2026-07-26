// The DECLARED MUTANT LEDGER — JAN-VERIF V-1.
//
// WHY THIS EXISTS. Across JAN-EXECREM (WP-0..17), JAN-EXEBIND and JAN-REVREM (RW-0..5) roughly eighty mutants
// were declared — in commit messages, in roadmap tables, and in `enforcement-register.ts`'s `declaredMutations`
// field. Every one was applied ONCE, BY HAND, BY THE AUTHOR DEFENDING THE GUARD, and never run again.
//
// That is not a test. **A declared mutation that is not re-runnable is a CLAIM.** The evidence that the
// distinction matters is already on the record: two of `enforcement-register.ts`'s three declared mutations had
// silently become UNAPPLICABLE (one named a call site a later work package deleted, one named a limb that was
// withdrawn) and nothing noticed until an adversarial review read them; and one mutant reported a FALSE GREEN
// because it was measured against a stale cross-package `dist`.
//
// WHY MUTATION AND NOT COVERAGE. Merged coverage is 94.6% statements / 83.0% branches, and NOT ONE of the 36
// findings confirmed across two adversarial reviews was a coverage gap. Coverage asks "did this line run"; the
// defects here were missing guards (no line to cover), vacuous negatives (line ran, assertion satisfied by a
// DIFFERENT check), and fixtures that could not produce what they asserted. A surviving mutant is a real gap.
// An uncovered line is a question.
//
// HARVESTED, NOT TRANSCRIBED. These entries were extracted programmatically from the per-work-package harnesses
// that originally ran them. Retyping thirty multi-line anchors by hand is exactly where rot enters, and rot in
// THIS file is indistinguishable from a passing test.
//
// FOUR VERDICTS, AND THREE ARE FAILURES:
//   KILLED      the expected suites failed -> the guard is genuinely tested.
//   SURVIVED    they passed -> THE GUARD IS UNTESTED. The finding.
//   UNANCHORED  `find` is absent or ambiguous -> the ledger has rotted against the code. Equally a finding:
//               it means a mutation someone once cited as evidence can no longer be performed at all.
//   NO_COMPILE  the mutant does not typecheck, so it never reached the code and proves nothing either way.
//   RETIRED     its target was legitimately removed and the successor mutant is NAMED (`supersededBy`).
//   TYPE_PREVENTED  it is DECLARED as not compiling, and that refusal IS the guarantee (`expectNoCompile`).
//   KILLED_UNNAMED  killed, but package-wide, because the declaring work package never named its victim.
//   ABORTED_DIRTY   the tree was already dirty — EVERY VERDICT FROM HERE ON IS VOID, and the run stops.
//
// ON THAT LAST VERDICT. It exists because this harness produced two complete, plausible, entirely worthless
// verdict tables before it did: once when an external timeout killed a run mid-mutant, and once when a manual
// check of a single mutant was run CONCURRENTLY with a full run. In both cases a leaked edit became the baseline
// for every later mutant — their `original` snapshot already contained it, so their "restore" wrote it back — and
// their typechecks then failed on a line in a file they never touched, reporting NO_COMPILE, which reads exactly
// like a well-behaved verdict. A short table that says why it stopped is worth far more than a full one that is
// quietly meaningless.
//
// THE DISCLOSED LIMIT (JAN-VERIF-DS-001 §4): a DECLARED ledger is not the possible mutant space. This proves the
// declared set still bites; it says nothing about operators nobody thought of. Generated mutation (Stryker) is
// the honest successor and is deliberately out of scope — recorded so this is not mistaken for completeness.

export interface DeclaredMutant {
	/** Stable id, as used in the work package that declared it. */
	readonly id: string;
	/** Repo-relative path of the file to mutate. */
	readonly file: string;
	/** The anchor. MUST occur exactly once, or the verdict is UNANCHORED. */
	readonly find: string;
	readonly replace: string;
	/** The suites that MUST fail. Empty means the mutant was declared without a named victim — itself a defect. */
	readonly expectRed: readonly string[];
	/** The guard this mutant proves, in one line. */
	readonly why: string;
	/** Where it came from, so a reader can find the original argument. */
	readonly source: string;
	/**
	 * Set when the code this mutant targeted was legitimately REMOVED or MOVED, and another mutant now proves the
	 * same guard. Such a mutant reports RETIRED rather than UNANCHORED — it is not ledger rot, it is history.
	 *
	 * The distinction is the whole point: an UNANCHORED mutant means a claim someone once cited as evidence can no
	 * longer be performed and NOBODY NOTICED. A RETIRED one means somebody noticed and said where the guard went.
	 * Deleting the entry instead would erase the fact that the guard ever needed proving.
	 */
	readonly supersededBy?: string;
	/**
	 * Set when the mutant is expected NOT to TYPECHECK, and that refusal IS the guarantee.
	 *
	 * A defect the compiler makes unexpressible is guarded more strongly than one a test catches: the test can be
	 * deleted, the type cannot be worked around without a deliberate signature change. Declaring it here converts
	 * "my mutant is broken" — the flattering reading — into a CHECKED claim, because a mutant that suddenly
	 * compiles reports SURVIVED and fails the build.
	 */
	readonly expectNoCompile?: string;
	/**
	 * Set when the mutation is expected to SURVIVE, because it edits something behaviour cannot depend on — a
	 * rationale string, a comment. Such an entry is a CONTROL: its survival proves the suite is not failing
	 * spuriously, and a KILL is the finding, because a test that reddens on a prose change is asserting on prose.
	 *
	 * Without this field an INERT mutation is indistinguishable from an UNTESTED GUARD, and the harvest produced
	 * several: a rationale-string edit and an invalid-enum edit both reported SURVIVED and both looked like defects.
	 */
	readonly expectSurvive?: string;
}

export const DECLARED_MUTANTS: readonly DeclaredMutant[] = [
	{
		id: 'M1-widen-start-sources',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tsourceStates: ['QUEUED'],\n\t\teventType: 'ExecutionStepStarted',",
		replace: "\t\tsourceStates: ['QUEUED', 'WAITING'],\n\t\teventType: 'ExecutionStepStarted',",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-arrow-census.test.ts'],
		why: 'totality: a widened source set must lose its declared residual cell',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M2-narrow-cancel-sources',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "sourceStates: ['READY', 'QUEUED', 'RUNNING', 'WAITING', 'FAILED'],",
		replace: "sourceStates: ['RUNNING'],",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-arrow-census.test.ts'],
		why: 'the POSITIVE half: a narrowed source set must fail its accepted cases',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M3-delete-source-set-branch',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tif (!sourceStates.includes(String(step.stepState) as (typeof sourceStates)[number]))',
		replace: '\tif (false as boolean)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-arrow-census.test.ts'],
		why: 'the source-set guard itself',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M4-classifyRefusal-always-killed',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\tif (observed.status !== 'REJECTED') return 'ADMITTED';",
		replace: "\tif (observed.status === '__never__') return 'ADMITTED';\n\treturn 'KILLED';",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'the primitive SELFTEST: a classifier that greens everything',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M5-layerOfTestFile-fail-open',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\treturn 'UNKNOWN';\n}",
		replace: "\treturn 'COMMAND';\n}",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'the primitive SELFTEST: fail-open layer classification',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M6-manifest-cite-pure-kernel',
		file: 'packages/rph-domain/src/conformance-manifest.ts',
		find: "\t'RPH-PWU-010': 'packages/rph-application/src/handlers/execrem-wp12-authority.test.ts',",
		replace: "\t'RPH-PWU-010': 'packages/rph-domain/src/execution.test.ts',",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'THE ORIGINAL DEFECT: a command-refusal rule cited at the pure-kernel layer',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M7-unenforced-certified-covered',
		file: 'packages/rph-domain/src/conformance-manifest.ts',
		find: "\t'RPH-EXE': {\n\t\tstatus: 'PARTIAL',",
		replace: "\t'RPH-EXE': {\n\t\tstatus: 'COVERED',",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'an UNENFORCED rule certified COVERED \u2014 the original defect (RPH-EXE-004/005 are enforced nowhere). REFORMULATED by JAN-VERIF V-1: the harvested form added a DUPLICATE object key, which TypeScript rejects, so it reported NO_COMPILE and proved nothing. A mutant that does not compile never reaches the code.',
		source: 'wp16_mutants.py (reformulated V-1)'
	},
	{
		id: 'M8-wire-dead-predicate',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tcanResumeExecutionOnPwu,',
		replace: '\tcanResumeExecutionOnPwu,\n\tcapabilityAuthorized,',
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'the CALL-SITE CENSUS: a predicate disclosed as having NO production caller must go RED the moment one appears. RE-POINTED by JAN-VERIF V-1 from bindingPermitsExecution \u2014 which JAN-EXEBIND legitimately WIRED, so re-importing it is a duplicate identifier \u2014 to capabilityAuthorized, which is still genuinely dead (RPH-EXE-004, blocked on the Source-TBD corpus gap N-5).',
		source: 'wp16_mutants.py (re-pointed V-1)'
	},
	{
		id: 'M9-shared-marker',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\t\trefusalMarker: 'a baselined PWU requires a successor revision before new execution',",
		replace: "\t\trefusalMarker: 'the PWU is SUPERSEDED, a terminal workLifecycleState',",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'two rows satisfiable by one refusal',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M10-marker-not-in-message',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\t\trefusalMarker: 'a superseded or terminal plan mints no new success credit',",
		replace: "\t\trefusalMarker: 'a superseded plan mints no new success credit whatsoever',",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: 'the OBSERVATION: a declared marker the production message does not carry',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M11-planLiveness-exempt',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tplanLiveness: 'REQUIRES_ACTIVE_PLAN',\n\t\tactivePlanRationale:\n\t\t\t'starting OPENS AN ATTEMPT",
		replace:
			"\t\tplanLiveness: 'CLEANUP_EXEMPT',\n\t\tactivePlanRationale:\n\t\t\t'starting OPENS AN ATTEMPT",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: "RPH-EXE-002's enforcement point",
		source: 'wp16_mutants.py'
	},
	{
		id: 'M12-pwuOpenness-exempt',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tpwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'a closed PWU (BASELINED",
		replace:
			"\t\tpwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'a closed PWU (BASELINED",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: "RPH-PWU-009/010's enforcement point",
		source: 'wp16_mutants.py'
	},
	{
		id: 'B1-invert-accept-set',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tconst check = bindingPermitsExecution(status);\n\tif (!check.ok)',
		replace:
			"\tconst check = bindingPermitsExecution(status);\n\tif (check.ok && status === '__never__')",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the RPH-EXE-003 status limb (K1/K2/K3)',
		source: 'exebind_mutants.py'
	},
	{
		id: 'B2-delete-allowlist-limb',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tif (Array.isArray(allowlist) && !allowlist.includes(bindingId))',
		replace: '\tif (false as boolean)',
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the §15.3 allowlist limb — K5, the limb-separation proof',
		source: 'exebind_mutants.py',
		supersededBy:
			'R3-delete-the-column-limb — the §15.3 allowlist limb was WITHDRAWN by JAN-REVREM RW-0 (an unrecoverable wedge); the binding authority it half-guarded is now the bindingAuthority column, and R3 deletes that limb wholesale. P4 in the same suite pins the withdrawal.'
	},
	{
		id: 'B3-allowlist-before-status',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tconst status = String((binding.state as { authorizationStatus?: unknown }).authorizationStatus);',
		replace:
			"\tconst _early = plan.authorizedRuntimeBindingIds;\n\tif (Array.isArray(_early) && !_early.includes(bindingId))\n\t\treturn reject(command, 'RPH_INVARIANT_VIOLATION', `${command.commandType} blocked: runtime binding ${bindingId} is authorized, but it is not among the bindings THIS ACTIVATION authorized for plan reordered.`, [stepId, bindingId]);\n\tconst status = String((binding.state as { authorizationStatus?: unknown }).authorizationStatus);",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'ORDER: the authored limb must not mask the ratified one',
		source: 'exebind_mutants.py',
		supersededBy:
			"S1-delete-scope-limb / S2-scope-always-refuses — this mutant cannot be FORMULATED any more: RW-0 removed `plan` from bindingAuthorityRefusal's signature along with the allowlist limb, so reordering it is a signature change, not a mutation. That is a stronger barrier than a mutant, and the limb-ordering guard it protected is now carried by the SCOPE pair plus the ORDER PROOF case (K6)."
	},
	{
		id: 'B4-absent-binding-refuses',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (bindingId === '') return null;",
		replace:
			"\tif (bindingId === '') return reject(command, 'RPH_INVARIANT_VIOLATION', `${command.commandType} blocked: no binding.`, [stepId]);",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'R5 scope decision (P3) — an absent binding is OUT OF SCOPE, not refused',
		source: 'exebind_mutants.py'
	},
	{
		id: 'B5-absent-binding-refuses-SEED',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (bindingId === '') return null;",
		replace:
			"\tif (bindingId === '') return reject(command, 'RPH_INVARIANT_VIOLATION', `${command.commandType} blocked: no binding.`, [stepId]);",
		expectRed: ['packages/rph-engine/src/reference-undertaking.test.ts'],
		why: 'R5 is LOAD-BEARING: refusing the absent case must break the reference seed',
		source: 'exebind_mutants.py'
	},
	{
		id: 'B6-unresolvable-fails-open',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (binding?.objectType !== 'RUNTIME_BINDING')",
		replace: "\tif (binding !== undefined && binding.objectType === '__never__')",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'fail-CLOSED on an unresolvable authority (K4). REFORMULATED by JAN-VERIF V-1: the harvested form deleted the narrowing outright, so `binding` became possibly-undefined and TypeScript rejected it \u2014 NO_COMPILE, proving nothing. This form keeps the narrowing and inverts only the accepted type, so the fail-open path is genuinely reached.',
		source: 'exebind_mutants.py (reformulated V-1)',
		expectNoCompile:
			"The fail-OPEN cannot be EXPRESSED. `binding` is `StoredObject | undefined`, and the `binding?.objectType !== 'RUNTIME_BINDING'` early-return is what narrows it for every use below. Any mutation that lets an unresolvable binding through therefore leaves `binding` possibly-undefined and TypeScript rejects it (TS18048). The fail-closed behaviour is enforced by the TYPE, not by a test — a stronger guarantee, and one nothing recorded until JAN-VERIF V-1 tried to mutate it."
	},
	{
		id: 'B7-drop-the-precheck-entirely',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tconst unauthorized = bindingAuthorityRefusal(ctx, command, plan, step, p.stepId);\n\t\t\tif (unauthorized) return unauthorized;',
		replace: '\t\t\tconst unauthorized = null;\n\t\t\tif (unauthorized) return unauthorized;',
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the wiring itself — RPH-EXE-003 enforced NOWHERE, the original defect',
		source: 'exebind_mutants.py',
		supersededBy:
			"R3-delete-the-column-limb — RW-0 MOVED the check out of startExecutionStep's precheck into stepAuthorityRefusal, so 'drop the precheck' no longer names anything. R3 removes the shared limb, which is the same guard at its new site and covers BOTH arrows into RUNNING rather than one."
	},
	{
		id: 'R1-resolve-not-executing',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tbindingAuthority: 'REQUIRES_AUTHORIZED_BINDING',\n\t\tbindingAuthorityRationale:\n\t\t\t'THE SECOND ARROW INTO RUNNING",
		replace:
			"\t\tbindingAuthority: 'NOT_EXECUTING',\n\t\tbindingAuthorityRationale:\n\t\t\t'THE SECOND ARROW INTO RUNNING",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'THE BLOCKER, re-expressed as ONE CHARACTER of declaration',
		source: 'revrem_mutants.py'
	},
	{
		id: 'R2-start-not-executing',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tbindingAuthority: 'REQUIRES_AUTHORIZED_BINDING',\n\t\tbindingAuthorityRationale:\n\t\t\t'the FIRST of the two arrows",
		replace:
			"\t\tbindingAuthority: 'NOT_EXECUTING',\n\t\tbindingAuthorityRationale:\n\t\t\t'the FIRST of the two arrows",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the Start limb',
		source: 'revrem_mutants.py'
	},
	{
		id: 'R3-delete-the-column-limb',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (spec.bindingAuthority === 'REQUIRES_AUTHORIZED_BINDING') {",
		replace: '\tif (false as boolean) {',
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the shared enforcement site — the whole class',
		source: 'revrem_mutants.py'
	},
	{
		id: 'R5-invert-accept-set',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (authorizationStatus === 'AUTHORIZED' || authorizationStatus === 'PARTIALLY_AUTHORIZED')\n\t\treturn { ok: true };",
		replace: "\tif (authorizationStatus === '__never__') return { ok: true };",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the ratified kernel predicate itself',
		source: 'revrem_mutants.py'
	},
	{
		id: 'R6-cancel-becomes-gated',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tbindingAuthority: 'NOT_EXECUTING',\n\t\tbindingAuthorityRationale:\n\t\t\t'cancel is the exit of last resort",
		replace:
			"\t\tbindingAuthority: 'REQUIRES_AUTHORIZED_BINDING',\n\t\tbindingAuthorityRationale:\n\t\t\t'cancel is the exit of last resort",
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'OVER-refusal: gating cancel strands the revoked step',
		source: 'revrem_mutants.py'
	},
	{
		id: 'W1-prune-passthrough-restored',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: "\tif (!planPermitsAffordance(plan.status, 'prune', plan.pwuWorkLifecycleState)) return [];",
		replace: '\tif (false as boolean) return [];',
		expectRed: ['packages/rph-projections/src/revrem-wp1-readmodel-fidelity.test.ts'],
		why: 'the prune gate itself (#4)',
		source: 'rw1_mutants.py'
	},
	{
		id: 'W2-prune-row-not-gated',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: "\tprune: 'PruneExecutionStep'",
		replace: "\tprune: 'CancelExecutionStep'",
		expectRed: ['packages/rph-projections/src/revrem-wp1-readmodel-fidelity.test.ts'],
		why: 'prune reading the WRONG spec row (Cancel is CLEANUP_EXEMPT)',
		source: 'rw1_mutants.py'
	},
	{
		id: 'W3-hardcode-the-pwu-set',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: "const CLOSED_PWU_STATES: ReadonlySet<string> = new Set(\n\tgetMachine('PWU.workLifecycleState').terminalStates\n);",
		replace: "const CLOSED_PWU_STATES: ReadonlySet<string> = new Set(['BASELINED', 'ABANDONED']);",
		expectRed: ['packages/rph-projections/src/revrem-wp1-readmodel-fidelity.test.ts'],
		why: 'the DERIVATION (#6) — a stale copy must be caught',
		source: 'rw1_mutants.py'
	},
	{
		id: 'W4-gate-everything',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: "\tif (!planPermitsAffordance(plan.status, 'prune', plan.pwuWorkLifecycleState)) return [];",
		replace: '\treturn [];\n\tif (false as boolean) return [];',
		expectRed: ['packages/rph-projections/src/revrem-wp1-readmodel-fidelity.test.ts'],
		why: 'OVER-refusal: prune withheld unconditionally',
		source: 'rw1_mutants.py'
	},
	{
		id: 'S1-delete-scope-limb',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tif (boundStepId !== stepId)',
		replace: '\tif (false as boolean)',
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'the binding SCOPE limb (review #1 finding 2)',
		source: 'RW-3 inline'
	},
	{
		id: 'S2-scope-always-refuses',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tif (boundStepId !== stepId)',
		replace: '\tif (boundStepId === boundStepId)',
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'OVER-refusal: scope must not refuse its own step',
		source: 'RW-3 inline'
	},
	{
		id: 'F1-remove-incoherence-floor',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\tif (graphIsIncoherent(plan)) return [];\n\tif ((plan.transitions ?? []).length === 0) {',
		replace: '\tif ((plan.transitions ?? []).length === 0) {',
		expectRed: ['packages/rph-domain/src/revrem-wp2-incoherence-pin.test.ts'],
		why: 'the floor RW-2 wrongly called dead code (review #2 BLOCKER)',
		source: 'RW-4 inline'
	},

	// ── JAN-VERIF V-2: the OLDER ledger, harvested from JAN-EXECREM WP-2..WP-15 ──────────────────────────
	//
	// These are the entries most likely to have rotted: the code has moved through fifteen further work packages
	// since each was written. NONE of them names the test it reddens — their work packages declared the mutation
	// and never said which suite catches it — so each runs PACKAGE-WIDE and reports KILLED_UNNAMED. That is a
	// weaker claim, honestly labelled: it establishes the guard is tested somewhere, not that a named test does
	// it. Guessing a victim would have been worse than admitting the gap, because a guessed victim is how a
	// mutant comes to pass for the wrong reason.
	{
		id: 'WP11-M1 restore the tautology: explicitNoOutput: !hasOutput',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: 'explicitNoOutput: noOutput !== undefined,',
		replace: 'explicitNoOutput: !hasOutput,',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M2 delete the RPH-EXE-006 reject entirely',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (!check.ok)',
		replace: '\t\t\tif (false && !check.ok)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M3 drop noOutputResult from the emitted event',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '...(p.noOutputResult !== undefined ? { noOutputResult: p.noOutputResult } : {})',
		replace: '...({})',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M4 admit TIMEOUT as success-compatible',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.noOutputReasonIsSuccessCompatible === false)',
		replace: 'if (false && input.noOutputReasonIsSuccessCompatible === false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M5 drop the outputBindings corroboration limb',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.declaresOutputBindings === true)',
		replace: 'if (false && input.declaresOutputBindings === true)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M6 contradictory cell folded into the OK arm',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.hasOutput && input.explicitNoOutput)',
		replace: 'if (false && input.explicitNoOutput)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M7 zero-subject floor never fires (aiProduced -> false)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: '\tif (!input.aiProduced) return null;',
		replace: '\tif (true) return null;',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M8 structuredResultHasContent is constant TRUE (over-refusal)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: "\tif (typeof value === 'string') return /\\S/.test(value);",
		replace: "\tif (true) return true;\n\tif (typeof value === 'string') return /\\S/.test(value);",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M9 subjectCount === 0 -> >= 0 (refuse every AI completion)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: '\tif (input.subjectCount !== 0) return null;',
		replace: '\tif (input.subjectCount < 0) return null;',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M10 declaresOutputBindings never derived (always false)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: 'declaresOutputBindings: Array.isArray(outputBindings) && outputBindings.length > 0',
		replace: 'declaresOutputBindings: false',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M4 admit TIMEOUT as success-compatible',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.noOutputReasonIsSuccessCompatible === false)',
		replace: 'if (false && input.noOutputReasonIsSuccessCompatible === false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP11-M5 drop the outputBindings corroboration limb',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.declaresOutputBindings === true)',
		replace: 'if (false && input.declaresOutputBindings === true)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP11-M6 contradictory cell folded into the OK arm',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.hasOutput && input.explicitNoOutput)',
		replace: 'if (false && input.explicitNoOutput)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP11-M11 kernel MISSING cell never fires',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (!input.hasOutput && !input.explicitNoOutput)',
		replace: 'if (false && !input.explicitNoOutput)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP11-M2 delete the RPH-EXE-006 reject at the CALL SITE',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (!check.ok)\n\t\t\t\t// MISSING is the ratified',
		replace: '\t\t\tif (false && !check.ok)\n\t\t\t\t// MISSING is the ratified',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP12A-M1 `every` becomes `some` (1-of-5 backs a full claim again)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tconst offendingStepStates = input.stepStates.filter((s) => s !== 'SUCCEEDED' && s !== 'SKIPPED');",
		replace:
			"\tconst offendingStepStates = input.stepStates.some((s) => s === 'SUCCEEDED' || s === 'SKIPPED')\n\t\t? []\n\t\t: input.stepStates.filter((s) => s !== 'SUCCEEDED' && s !== 'SKIPPED');",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M2 the STATUS term is dropped (a killed plan backs the claim)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (input.planStatus !== 'ACTIVE' && input.planStatus !== 'COMPLETED')",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M3 the >=1-SUCCEEDED limb is dropped (all-skipped backs the claim)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (!input.stepStates.includes('SUCCEEDED'))",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M4 narrowed to COMPLETED-only (breaks the reference seed)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (input.planStatus !== 'ACTIVE' && input.planStatus !== 'COMPLETED')",
		replace: "\tif (input.planStatus !== 'COMPLETED')",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M5 the PWU plane stops calling the kernel (restores the weak copy)',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: '\t\tif (!verdict.ok) failures.push(`${oid}: ${verdict.reason} (${verdict.errorCode})`);\n\t\treturn verdict.ok;',
		replace:
			"\t\tif (!verdict.ok) failures.push(`${oid}: ${verdict.reason} (${verdict.errorCode})`);\n\t\treturn (s.steps ?? []).some((step) => step.stepState === 'SUCCEEDED');",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12B-M3 Cancel is hardened to REQUIRES_OPEN_PWU (live steps get stranded)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		replace: "\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT_X',",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_m3m9.py'
	},
	{
		id: 'WP12B-M3b Cancel pwuOpenness hardened to REQUIRES_OPEN_PWU',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tpwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
		replace:
			"\t\tpwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_m3m9.py'
	},
	{
		id: 'WP12B-M9 pwuOpennessRefusal admits a WRONG-TYPED work unit',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (pwu?.objectType !== 'PROFESSIONAL_WORK_UNIT')",
		replace: '\tif (pwu === undefined)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_m3m9.py'
	},
	{
		id: 'WP12B-M1 Complete reverts to CLEANUP_EXEMPT (the F-26 hole reopens)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tcommandType: 'CompleteExecutionStep',\n\t\ttarget: 'SUCCEEDED',\n\t\tsourceStates: ['RUNNING'],\n\t\teventType: 'ExecutionStepSucceeded',\n\t\tplanLiveness: 'REQUIRES_ACTIVE_PLAN',",
		replace:
			"\t\tcommandType: 'CompleteExecutionStep',\n\t\ttarget: 'SUCCEEDED',\n\t\tsourceStates: ['RUNNING'],\n\t\teventType: 'ExecutionStepSucceeded',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M2 Fail is "hardened" to REQUIRES_ACTIVE_PLAN (the exemption is killed)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\teventType: 'ExecutionStepFailed',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		replace: "\t\teventType: 'ExecutionStepFailed',\n\t\tplanLiveness: 'REQUIRES_ACTIVE_PLAN',",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M3 Cancel is "hardened" to REQUIRES_OPEN_PWU (live steps get stranded)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',\n\t\tactivePlanRationale:\n\t\t\t'INTENTIONAL: cancel is CLEANUP.",
		replace:
			"\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',\n\t\tactivePlanRationale:\n\t\t\t'MUTANT: cancel is CLEANUP.",
		expectRed: [],
		why: 'A CONTROL, not a guard test — see expectSurvive. Its TITLE is the original harness intent, which this mutation never expressed.',
		source: 'wp12b_mutants.py',
		expectSurvive:
			'Edits the activePlanRationale PROSE only (INTENTIONAL -> MUTANT). No behaviour reads that string, so survival is CORRECT and proves the suite is not failing spuriously. Investigated only after it was reported as a SURVIVED defect — it never mutated the guard its title names.'
	},
	{
		id: 'WP12B-M4 the plan-liveness limb never fires',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (spec.planLiveness === 'REQUIRES_ACTIVE_PLAN' && plan.status !== 'ACTIVE')",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M5 the PWU-openness limb never fires',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (spec.pwuOpenness === 'REQUIRES_OPEN_PWU') {",
		replace: '\tif (false) {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M6 activation stops checking PWU openness',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (closed) return closed;',
		replace: '\t\t\tif (false && closed) return closed;',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M7 canResumeExecutionOnPwu drops the generalised terminal set',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (isTerminalState('PWU.workLifecycleState', pwuLifecycleState))",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M8 the non-PWU workUnitId read fails OPEN again',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (ctx.store.loadObject(p.workUnitId)?.objectType !== 'PROFESSIONAL_WORK_UNIT') {",
		replace: '\tif (!ctx.store.loadObject(p.workUnitId)) {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M9 pwuOpennessRefusal admits an unresolvable work unit',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (pwu?.objectType !== 'PROFESSIONAL_WORK_UNIT')",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12C-M1 the refusal is swallowed (restores the truthiness check)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\t\tif (!authorized.ok)',
		replace: '\t\t\t\tif (false && !authorized.ok)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M2 a nonexistent id is ADMITTED',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\t\treason: `waiverOrRevisionId ${query.authorizationId} names no recorded object`\n\t\t};',
		replace: '\t\treason: `unused`\n\t\t} && { ok: true };',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M3 the object-KIND check ADMITS',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: "\tif (stored.objectType !== 'DECISION')\n\t\treturn {",
		replace: "\tif (stored.objectType !== 'DECISION')\n\t\treturn { ok: true } || {",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M6 a decision with no execution scope ADMITS',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth)\n\t\treturn {',
		replace: '\tif (!auth)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M8 the plan-id scope ADMITS',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.executionPlanId !== query.planId)\n\t\treturn {',
		replace: '\tif (auth.executionPlanId !== query.planId)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M9 the STEP list is IGNORED (one decision retires every step)',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth.executionStepIds.includes(query.stepId))\n\t\treturn {',
		replace: '\tif (!auth.executionStepIds.includes(query.stepId))\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M10 expiry is IGNORED',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)\n\t\treturn {',
		replace:
			'\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py'
	},
	{
		id: 'WP12C-M1 the resolution never runs (restores the truthiness check)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (p.waiverOrRevisionId) {',
		replace: '\t\t\tif (false) {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M2 a nonexistent id is admitted',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!stored)',
		replace: '\tif (false && !stored)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M3 the object-KIND check is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: "\tif (stored.objectType !== 'DECISION')",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M4 any decisionType authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!AUTHORIZING_DECISION_TYPES.has(decision.decisionType))',
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M5 a PROPOSED (unapproved) decision authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: "\tif (decision.status !== 'EFFECTIVE')",
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M6 a decision with no execution scope authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth)',
		replace: '\tif (false && !auth)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M7 the plan-subject scope is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!decision.subjectObjectIds.includes(query.planId))',
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M8 the plan-id scope is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.executionPlanId !== query.planId)',
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M9 the STEP list is ignored (one decision retires every step)',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth.executionStepIds.includes(query.stepId))',
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M10 expiry is ignored',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)',
		replace: '\tif (false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M11 EVERY dated authorization is treated as expired',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)',
		replace: '\tif (auth.expiresAt !== undefined)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M12 the authorization is validated then DISCARDED (not persisted)',
		file: 'packages/rph-application/src/handlers/governance.ts',
		find: "\t\t...(p.executionSkipAuthorization\n\t\t\t? { executionSkipAuthorization: p.executionSkipAuthorization }\n\t\t\t: {}),\n\t\tstatus: 'PROPOSED'",
		replace: "\t\tstatus: 'PROPOSED'",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP14-M1 Start stops reading the authored binding (F-31 reopens)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\t\t\t...(typeof step.runtimeBindingId === 'string' && step.runtimeBindingId !== ''",
		replace:
			"\t\t\t...(false && typeof step.runtimeBindingId === 'string' && step.runtimeBindingId !== ''",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M2 the activation allowlist is emitted but not PERSISTED again',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\tmutate: (base) => ({\n\t\t\t...base,\n\t\t\tauthorizedRuntimeBindingIds:',
		replace: '\t\tmutate: (base) => ({\n\t\t\t...base,\n\t\t\t_unusedAuthorizedRuntimeBindingIds:',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M3 prune provenance is not derived (F-37 reopens)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\tconst provenance = pruneProvenance(',
		replace: '\tconst provenance = undefined ?? pruneProvenance0(',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M4 provenance reads the step OWN in-edges (transitive case breaks)',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\t\t\tif (!seen.has(source)) {',
		replace: '\t\t\tif (false && !seen.has(source)) {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M5 the CUT predicate drops the live-source requirement (a JOIN is mis-attributed)',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\t\t\tif (live.has(source)) {',
		replace: '\t\t\tif (true) {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M6 provenance attributes a non-BRANCH source',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: "\t\t\t\tif (step?.stepType !== 'BRANCH') continue;",
		replace: '\t\t\t\tif (false) continue;',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M7 the branch decision (selectedEdgeId) is dropped from provenance',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\t\t\t\t\t? {}\n\t\t\t\t\t: { selectedEdgeId: step.selectedTransitionId }),',
		replace: '\t\t\t\t\t? {}\n\t\t\t\t\t: {}),',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M8 the CUT edge (excludedEdgeId) is dropped from provenance',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\t\t\t\t...(edge.id === undefined ? {} : { excludedEdgeId: edge.id })',
		replace: '\t\t\t\t...(edge.id === undefined ? {} : {})',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	}
];
