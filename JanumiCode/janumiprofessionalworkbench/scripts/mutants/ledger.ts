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
	}
];
