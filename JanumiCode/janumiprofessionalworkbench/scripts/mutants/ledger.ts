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
//   DUPLICATE   another entry declares the SAME mutation and is NAMED (`duplicateOf`).
//   ABORTED_DIRTY   the tree was already dirty — EVERY VERDICT FROM HERE ON IS VOID, and the run stops.
//
// ── THE V-2c LESSON: WHY SO MANY HARVESTED MUTANTS DID NOT COMPILE ──────────────────────────────────────────
//
// Of 90 entries, 21 reported NO_COMPILE and 2 UNANCHORED. Almost all 21 failed for ONE reason, and it is a property
// of the MUTATION OPERATOR rather than of any guard:
//
//   `if (cond)` -> `if (false)` (or `if (false && cond)`) MAKES THE GUARDED BLOCK STATICALLY DEAD, AND TYPESCRIPT
//   DOES NOT NARROW INSIDE DEAD CODE. So every use of a narrowed variable in the refusal it guards — `stored.
//   objectType`, `auth.executionPlanId`, `authorized.reason`, `step.selectedTransitionId` — loses its narrowing and
//   fails to typecheck. The mutation never reached the code.
//
// The systemic repair is to stop mutating the CONDITION and mutate the CONSEQUENCE: keep the check exactly as
// written and replace the refusal it returns with an admission (`return null`, `return { ok: true }`). At runtime
// that is the same fail-open; to the compiler the branch is still reachable and still narrows, so the defect is
// EXPRESSIBLE and therefore measurable. It is also the sharper operator for refusal-shaped code, because it
// separates "the check ran and decided wrongly" from "the check was deleted".
//
// AND THE DISTINCTION THAT MATTERS MOST HERE: a mutation that fails to compile because it made code unreachable
// looks IDENTICAL to one that fails because the guard IS the narrowing (`if (!stored) return` — remove it and
// nothing below can prove `stored` exists). The second is a genuine type-level guarantee and belongs in
// `expectNoCompile`; the first is an artifact. Declaring an artifact as TYPE_PREVENTED would be the worst instance
// of this programme's recurring defect yet, because TYPE_PREVENTED reads as STRONGER than KILLED. Every one of the
// 21 was therefore re-formulated and re-measured rather than reclassified — and every one turned out expressible.
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
//
// ── A SECOND DISCLOSED LIMIT: THE SURFACE LAYER IS UNREACHABLE FROM THIS LEDGER (recorded 2026-07-28) ────────
//
// The runner executes `bunx vitest run <victim>`. Playwright specs are not vitest specs, so **no guard whose only
// red-proof is an e2e can be carried here** — and this ledger has, by census, zero entries with `file: 'apps/…'`
// and zero `expectRed` naming an `*.e2e.ts`.
//
// THAT IS A GAP, NOT A POLICY, AND THE TEMPTING WORKAROUND IS THE DANGEROUS ONE. Naming an e2e file as the victim
// would not fail cleanly: vitest would find no matching spec, exit non-zero under `passWithNoTests: false`, and
// the runner would record **KILLED** — a verdict produced by the file-matcher rather than by any guard. That is
// exactly the shape this instrument exists to detect, and it would be manufactured by the instrument itself.
//
// The live instance: `runSteps` in `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` was made atomic on
// 2026-07-28 (JPWB-SPEC-001 `SPEC-001-INV-14`, FORK-23 (b)); its red-proof is `e2e/undertaking-atomicity.e2e.ts`,
// which was written first and observed FAILING on the assessment-count assertion before the fix landed. **No
// entry was added for it**, deliberately, because an honest one cannot be run today. Closing this needs the
// runner to dispatch e2e victims to Playwright — which is the same boundary JPWB-SPEC-001 FORK-19 rules on when
// it adds a `SURFACE` layer to the enforcement register, whose `LAYER_BY_PACKAGE` likewise maps `packages/`
// prefixes only and fail-closes every `apps/` path to `UNKNOWN`.

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
	/**
	 * Set when ANOTHER entry declares the same mutation of the same guard, naming it. Reports DUPLICATE, decided
	 * before anything is applied.
	 *
	 * DISTINCT FROM `supersededBy`, which means the code MOVED and the guard's proof went elsewhere. This means two
	 * work packages independently declared the same mutation and the harvest merged both — so running it twice
	 * measures nothing new while inflating the ledger's apparent size. That inflation is not hypothetical: the first
	 * authoritative run reported "90 mutants, 0 SURVIVED" when three of the ninety were byte-identical copies, so
	 * three of its 35 KILLED_UNNAMED verdicts were the same three kills counted twice.
	 *
	 * Recorded rather than deleted because "two work packages thought this guard needed proving" is itself a fact
	 * about which guards were felt to be load-bearing, and deleting the entry erases it.
	 */
	readonly duplicateOf?: string;
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
		// RE-SITED BY RW-6, IN THE COMMIT AFTER THE ONE THAT MOVED IT — which is a miss worth recording. RW-6's own
		// roadmap step 3 said these anchors must be updated "in the same commit … doing it in a later commit is how
		// the ledger rots", and I wrote that sentence and then skipped the step. The harness reported UNANCHORED on the
		// next full run, which is exactly the verdict it exists to produce; the gap between writing the instruction and
		// following it is the reason the verdict is not optional.
		//
		// The guard did not change. Its four checks moved from `bindingAuthorityRefusal` into `bindingAuthorityVerdict`
		// so the read-model could consult the same declaration (MAJOR #5).
		file: 'packages/rph-domain/src/execution.ts',
		// RE-ANCHORED 2026-07-26 (N-18's ruling). The status limb moved inside an `if (authorizationStatus !==
		// undefined)` block when the NOTHING_GRANTED limb was added after it, so the old single-tab anchor is gone.
		// Re-expressed as the CONSEQUENCE (the V-2c operator): the check still runs and still decides, and its
		// refusal is simply not returned.
		find: "\t\tif (!check.ok)\n\t\t\treturn {\n\t\t\t\tok: false,\n\t\t\t\tlimb: 'NOT_AUTHORIZED',",
		replace:
			"\t\tif (!check.ok && (false as boolean))\n\t\t\treturn {\n\t\t\t\tok: false,\n\t\t\t\tlimb: 'NOT_AUTHORIZED',",
		expectRed: ['packages/rph-domain/src/revrem-wp6-binding-authority-verdict.test.ts'],
		why: 'the RPH-EXE-003 status limb (K1/K2/K3) — now proved at BOTH the decision and the refusal, since RW-6 split them',
		source: 'exebind_mutants.py (re-sited RW-6)'
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
		// RE-ANCHORED BY RW-6, AND IT CAUGHT A REAL REGRESSION ON THE WAY. RW-6's first draft replaced this narrowing
		// early-return with `const resolves = binding?.objectType === 'RUNTIME_BINDING'` plus `(binding?.state ?? {})`,
		// so nothing below required `binding` to be PROVEN — the fail-OPEN became expressible for the first time since
		// JAN-EXEBIND. This entry duly reported SURVIVED ("declared type-prevented, but it COMPILES"), which is
		// precisely what `expectNoCompile` exists to detect: a guarantee downgraded from UNEXPRESSIBLE to merely
		// tested, silently, by a refactor whose subject was something else. The narrowing was restored.
		file: 'packages/rph-application/src/handlers/execution.ts',
		// RE-ANCHORED AGAIN BY JAN-BINDEXCL, and the reason is worth stating because it is the SECOND time this one
		// anchor has rotted and the two causes are opposite. RW-6 broke it by changing the code it named. This time
		// the code it names is untouched: `rejectMisboundStep` added a SECOND site that resolves a binding and checks
		// its objectType, at two tabs instead of one — and the one-tab anchor is a SUBSTRING of the two-tab line, so
		// it went ambiguous without either site changing a character.
		//
		// The collision is legitimate and must not be "fixed" in the production code. Both sites ask the same
		// question and reach OPPOSITE dispositions on purpose: at Start an unresolvable binding fails CLOSED (an
		// authority that cannot be read authorizes nothing), while at propose it is ALLOWED THROUGH, because
		// refusing it there is the wedge N3 exists to catch. Collapsing them into a shared helper would hide exactly
		// that difference, and renaming a local to protect a test anchor is the tail wagging the dog.
		//
		// So the anchor takes the preceding line as context instead. WP14-M7's rule said tabs disambiguate but rot on
		// reformat; this is its other half — tabs also fail to disambiguate the moment a sibling site appears at a
		// different depth. CONTENT is what makes an anchor unique, and `const binding = ctx.store.loadObject(...)`
		// followed at the SAME depth by the type check is content only this site has.
		find: "\tconst binding = ctx.store.loadObject(bindingId);\n\tif (binding?.objectType !== 'RUNTIME_BINDING')",
		replace:
			"\tconst binding = ctx.store.loadObject(bindingId);\n\tif (binding !== undefined && binding.objectType === '__never__')",
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
		// TWO VICTIMS SINCE RW-6, and the pair is the point. One character of declaration must redden BOTH the engine's
		// refusal battery AND the read-model's affordance battery — which is the only way to prove that the column is
		// genuinely the single source for both layers rather than two implementations that happen to agree today.
		expectRed: ['packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts'],
		why: 'THE BLOCKER, re-expressed as ONE CHARACTER of declaration — and since RW-6, one character that must move two layers at once',
		source: 'revrem_mutants.py (second victim added RW-6)'
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
		// RE-SITED BY RW-6 (see B1). Same limb, now inside the shared verdict.
		file: 'packages/rph-domain/src/execution.ts',
		find: '\tif (facts.boundStepId !== undefined && facts.boundStepId !== stepId)',
		replace: '\tif (false as boolean)',
		expectRed: ['packages/rph-domain/src/revrem-wp6-binding-authority-verdict.test.ts'],
		why: 'the binding SCOPE limb (review #1 finding 2)',
		source: 'RW-3 inline (re-sited RW-6)'
	},
	{
		id: 'S2-scope-always-refuses',
		file: 'packages/rph-domain/src/execution.ts',
		find: '\tif (facts.boundStepId !== undefined && facts.boundStepId !== stepId)',
		// OVER-refusal, and the RW-6 form is STRICTLY SHARPER than the pre-move one. It drops only the
		// `!== undefined` guard, so a caller that resolved the binding without reading `executionStepId` now has
		// EVERY step refused — the precise over-refusal the extracted verdict introduced the possibility of, and the
		// cell `revrem-wp6-binding-authority-verdict.test.ts` was written to pin.
		replace: '\tif (facts.boundStepId !== stepId)',
		expectRed: ['packages/rph-domain/src/revrem-wp6-binding-authority-verdict.test.ts'],
		why: 'OVER-refusal: scope must not refuse its own step, nor refuse a step whose binding simply did not report one',
		source: 'RW-3 inline (re-sited and sharpened RW-6)'
	},
	// ── JAN-REVREM RW-6: the read-model's THIRD authority limb (MAJOR #5) ─────────────────────────────────────
	//
	// Both are CONSEQUENCE mutations rather than condition mutations, for the reason V-2c established: replacing the
	// `if` with `false` makes the block dead, and `binding` — narrowed by `binding !== undefined` — stops narrowing
	// inside it, so the mutant would report NO_COMPILE and prove nothing about the limb.
	{
		id: 'W5-readmodel-binding-limb-never-withholds',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: '\t\tconst verdict = bindingAuthorityVerdict(binding.stepId, binding);\n\t\tif (!verdict.ok) return false;',
		replace:
			'\t\tconst verdict = bindingAuthorityVerdict(binding.stepId, binding);\n\t\tif (!verdict.ok) return true;',
		expectRed: ['packages/rph-projections/src/revrem-wp6-readmodel-binding-authority.test.ts'],
		why: 'MAJOR #5 ITSELF: the engine still refuses, and the UI offers Start on a step whose binding is REQUESTED, DENIED, REVOKED or scoped to another step',
		source: 'RW-6 inline'
	},
	{
		id: 'W6-readmodel-binding-limb-always-withholds',
		file: 'packages/rph-projections/src/execution-view.ts',
		find: '\t\tconst verdict = bindingAuthorityVerdict(binding.stepId, binding);\n\t\tif (!verdict.ok) return false;',
		replace:
			'\t\tconst verdict = bindingAuthorityVerdict(binding.stepId, binding);\n\t\tif (verdict.ok) return false;',
		expectRed: ['packages/rph-projections/src/revrem-wp6-readmodel-binding-authority.test.ts'],
		why: 'OVER-refusal: an AUTHORIZED binding stops affording Start, which withholds the action on every correctly-authorized step',
		source: 'RW-6 inline'
	},
	// ── JAN-CAPBIND WP-2: N-4, a grant may not exceed its request (§22.1) ─────────────────────────────────────
	{
		id: 'C1-grant-containment-never-refuses',
		file: 'packages/rph-domain/src/execution.ts',
		// N-4 ITSELF: the containment kernel admits everything, so a first authorization may confer any capability
		// the binding never requested — privilege expansion with no new authorization event.
		find: '\tconst excess = input.granted.filter((c) => !requested.has(c));\n\tif (excess.length === 0) return { ok: true };',
		replace:
			'\tconst excess = input.granted.filter((c) => !requested.has(c));\n\tif (excess.length >= 0) return { ok: true };',
		expectRed: ['packages/rph-domain/src/capbind-granted-within-request.test.ts'],
		why: 'N-4: an unrequested capability is granted inside someone else’s authorization — expansion without its own event (§22.1)',
		source: 'JAN-CAPBIND WP-2'
	},
	{
		id: 'C2-grant-containment-inverted',
		file: 'packages/rph-domain/src/execution.ts',
		// THE OPERAND-SWAP, expressed as one character of set membership: this is what a positional signature would
		// have permitted silently. It still REFUSES things, so it still looks like a working guard — it just refuses
		// the legal narrow grant and admits the illegal wide one.
		find: '\tconst excess = input.granted.filter((c) => !requested.has(c));',
		replace: '\tconst excess = input.requested.filter((c) => !new Set(input.granted).has(c));',
		expectRed: ['packages/rph-domain/src/capbind-granted-within-request.test.ts'],
		why: 'OVER-refusal AND under-refusal at once: the legal narrower grant is refused while the illegal wider one is admitted',
		source: 'JAN-CAPBIND WP-2'
	},
	{
		id: 'C3-n4-guard-unwired',
		file: 'packages/rph-application/src/handlers/runtime-binding.ts',
		// THE WIRING, separately from the kernel. The predicate can be correct while nothing asks it — which is the
		// exact shape (F-28) that left RPH-EXE-003/004/005 certified COVERED and enforced nowhere.
		// RE-ANCHORED 2026-07-26: the N-22 self-arrow limb turned the guard's tail from `if (check.ok) return null`
		// into `if (!check.ok) return reject(...)` followed by more checks, so the old anchor is gone. Same defect,
		// expressed as the consequence: the containment check runs and its refusal is discarded.
		find: "\t\t\tif (!check.ok)\n\t\t\t\t// The kernel's label travels in the MESSAGE",
		replace:
			"\t\t\tif (!check.ok && (false as boolean))\n\t\t\t\t// The kernel's label travels in the MESSAGE",
		expectRed: ['packages/rph-application/src/handlers/capbind-n4-grant-containment.test.ts'],
		why: 'the ENFORCEMENT: a correct kernel asked by nothing is the F-28 shape, and N-4 is that shape at the authorization boundary',
		source: 'JAN-CAPBIND WP-2'
	},

	// ── JAN-CAPBIND WP-3: N-3, RPH-EXE-005 input readiness ───────────────────────────────────────────────────
	{
		id: 'C4-input-readiness-limb-unwired',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// The DECLARATION can be right while nothing consults it — the F-28 shape, and the exact reason RPH-EXE-005
		// sat certified-COVERED and enforced nowhere for four milestones.
		find: "\tif (spec.inputReadiness === 'REQUIRES_PRESENT_INPUTS') {",
		replace: '\tif (false as boolean) {',
		expectRed: ['packages/rph-application/src/handlers/capbind-wp3-input-readiness.test.ts'],
		why: 'N-3 ITSELF: a step whose required input artifact does not resolve starts anyway, and the model/tool invocation the rule forbids is performed',
		source: 'JAN-CAPBIND WP-3'
	},
	{
		id: 'C5-input-readiness-truthiness-not-resolution',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// THE F-30 SHAPE, re-expressed. WP-12 found `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId`, where a
		// governed act was satisfied by any non-empty string. Passing a COUNT instead of a RESOLUTION is the same
		// substitution: it answers "were inputs declared?" while the rule asks "do the required ones exist?".
		find: '\tconst check = stepMayBecomeReady(missing.length === 0);',
		replace:
			'\tconst check = stepMayBecomeReady((Array.isArray(step.inputBindings) ? step.inputBindings : []).length >= 0);',
		expectRed: ['packages/rph-application/src/handlers/capbind-wp3-input-readiness.test.ts'],
		why: 'a truthiness test standing in for a resolved fact — the rule would pass on a step whose required artifact does not exist',
		source: 'JAN-CAPBIND WP-3'
	},
	{
		id: 'C6-required-defaults-open-not-closed',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// FAIL-OPEN vs FAIL-CLOSED on an unmarked input. A typo in `required` silently downgrades a requirement,
		// which is how a governed obligation stops being one without anybody deciding.
		find: "\t\t.filter((b) => (typeof b?.required === 'boolean' ? b.required : true))",
		replace: "\t\t.filter((b) => (typeof b?.required === 'boolean' ? b.required : false))",
		expectRed: ['packages/rph-application/src/handlers/capbind-wp3-input-readiness.test.ts'],
		why: 'the `required ?? true` fail-closed default: an unmarked input must count as REQUIRED, mirroring WP-12’s `mandatory ?? true`',
		source: 'JAN-CAPBIND WP-3'
	},
	{
		id: 'C7-resolve-arrow-stops-consuming',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		// THE TWO-ARROWS OMISSION, re-expressed as one character of declaration — the same shape that made the
		// binding limb a BLOCKER. If this survives, siting the check per-handler would have been indistinguishable
		// from declaring it as a column, and the column's whole argument collapses.
		find: "\t\tinputReadiness: 'REQUIRES_PRESENT_INPUTS',\n\t\tinputReadinessRationale:\n\t\t\t'THE SECOND CONSUMING ARROW",
		replace:
			"\t\tinputReadiness: 'NOT_CONSUMING',\n\t\tinputReadinessRationale:\n\t\t\t'THE SECOND CONSUMING ARROW",
		// IT SURVIVED AT FIRST, AND THAT WAS THE FINDING. My WP-3 battery had a case NAMED "Resolve out of WAITING is
		// refused on the same ground" whose body only asserted the POSITIVE resume — a test claiming more than it
		// observed, which is the false-record shape inside the suite meant to prevent it. C7 reddened nothing and
		// exposed it.
		//
		// THE REFUSAL IS GENUINELY UNREACHABLE, structurally: a step reaches WAITING only by STARTING; Start already
		// refuses an unresolvable required input; `RecordArtifact` is the ONLY artifact command in the registry
		// (nothing deletes, retracts or supersedes one); and no command rewrites a step's inputBindings after
		// propose. So no sequence produces a WAITING step whose required input has stopped resolving.
		//
		// SO THE DECLARATION IS WHAT IS PINNED — and pinning it is what makes this mutant KILLABLE rather than a
		// control. The battery now asserts `STEP_COMMAND_SPECS.ResolveExecutionStepWait.inputReadiness` directly.
		// That is the stronger arrangement: an unreachable-today guard whose DECLARATION is nevertheless enforced,
		// so the limb is already correct the day an artifact retraction or step-input revision command lands —
		// instead of being the second arrow somebody forgot, which is how the binding limb shipped a BLOCKER.
		expectRed: ['packages/rph-application/src/handlers/capbind-wp3-input-readiness.test.ts'],
		why: 'the RESUME arrow must DECLARE that it consumes inputs — the refusal is unreachable today, but the declaration is what makes the limb correct in advance of its case existing',
		source: 'JAN-CAPBIND WP-3'
	},

	// ── JAN-REVREM RW-7: prune provenance for the NON-BRANCH cut (N-8) ────────────────────────────────────────
	{
		id: 'P1-dead-predecessor-arm-continues-again',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// THE PRE-RW-7 BEHAVIOUR, restored exactly: `continue` instead of reporting the cause. If this survives, N-8
		// can return silently — a prune event once again indistinguishable in content from a waived skip.
		find: "\t\t\t\tif (IRRECOVERABLE_TERMINAL.has(step.stepState))\n\t\t\t\t\treturn {\n\t\t\t\t\t\tcause: 'DEAD_PREDECESSOR',\n\t\t\t\t\t\tdeadStepId: source,\n\t\t\t\t\t\tdeadStepState: step.stepState,\n\t\t\t\t\t\t...excluded\n\t\t\t\t\t};\n\t\t\t\tcontinue;",
		replace: '\t\t\t\tcontinue;',
		expectRed: ['packages/rph-domain/src/revrem-wp7-prune-provenance-cause.test.ts'],
		why: 'N-8 ITSELF: a step cut by a CANCELLED/SUPERSEDED predecessor emits provenance-free ExecutionStepPruned, byte-identical in content to a waived skip',
		source: 'RW-7 inline'
	},
	{
		id: 'P2-branch-source-reported-as-dead-predecessor',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// THE ORDER PROOF. Never reporting BRANCH_DECISION means a settled branch's recorded selection is discarded and
		// the cut is attributed to the branch merely being terminal — the more specific fact lost to the less.
		find: "\t\t\t\tif (step.stepType === 'BRANCH')",
		replace: '\t\t\t\tif (false as boolean)',
		expectRed: ['packages/rph-domain/src/revrem-wp7-prune-provenance-cause.test.ts'],
		why: 'ORDER: BRANCH must be checked FIRST, so a CANCELLED branch still reports its recorded selection rather than being downgraded to DEAD_PREDECESSOR',
		source: 'RW-7 inline'
	},
	{
		id: 'P3-pending-source-invents-a-cause',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// OVER-attribution: the disposition gate is what stops an UNDECIDED branch being reported as the cut. Weaken it
		// and a branch that has resolved nothing yet is recorded as having excluded the step — a decision nobody made.
		//
		// REFORMULATED TWICE, and the detour is worth recording. The first form compared against `'__never__'`, not an
		// `InEdgeDisposition` member, so TypeScript rejected it (TS2367) and the mutant never ran. Making it compile
		// forced the question of what this gate guards — and I concluded, WRONGLY, that the dead-predecessor arm's
		// `IRRECOVERABLE_TERMINAL` check merely re-derived it, and deleted the check. `localOf` returning NEUTRALIZED
		// says the edge is dead, NOT which of two reasons killed it: off a non-BRANCH source a guard-false CONDITIONAL
		// edge is also neutralized, and that case must yield NO provenance. The pre-existing WP-14 test pinned exactly
		// that and went red on the next run, so the check was restored.
		//
		// The gate's real victim is therefore the BRANCH arm, and the victim named below is the suite that proves it.
		find: "\t\t\t\tif (ctx.localOf(edge) !== 'NEUTRALIZED') continue;",
		replace: "\t\t\t\tif (ctx.localOf(edge) === 'SATISFIED') continue;",
		expectRed: [],
		why: 'A DECLARED CONTROL over a PROVABLY UNREACHABLE fail-safe — see expectSurvive. Kept because unreachable-BY-INVARIANT is not the same as unnecessary, and RW-4 already corrected one wrongly-declared-dead floor in this lineage.',
		source: 'RW-7 inline',
		expectSurvive:
			'The gate cannot be reached, and the proof is structural rather than a survey of fixtures. ' +
			'`computeLiveStepIds` propagates reachability through EVERY edge whose local disposition is not NEUTRALIZED ' +
			"(`if (ctx.localOf(e) !== 'NEUTRALIZED') frontier.push(...)`), and `pruneProvenance` only ever examines the " +
			'in-edges of steps it has already established are NOT live. So a dead target reached from a LIVE source must ' +
			'have a NEUTRALIZED in-edge: were it PENDING or UNRESOLVED, the target would itself be live and the walk ' +
			'would never have visited it. Probes across FAILED / CANCELLED / QUEUED / RUNNING sources and the ' +
			'undecided-BRANCH (UNRESOLVED) case all agree. ' +
			"IT IS NOT DELETED, deliberately: the line is a LOCAL restatement of reachability's own predicate, and it is " +
			'what stops a fabricated cause if the two ever drift apart — which is exactly how the F-06 class arose (one ' +
			'question, several independently-maintained answers). The invariant it depends on is pinned by ' +
			"`revrem-wp7-prune-provenance-cause.test.ts`'s liveness assertions, so if reachability stops using this " +
			'predicate those go RED and this mutant becomes killable.'
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
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M2 delete the RPH-EXE-006 reject entirely [wp11_mutants.py harvest]',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (!check.ok)',
		replace: '\t\t\tif (false && !check.ok)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py',
		duplicateOf:
			"WP11-M2 delete the RPH-EXE-006 reject at the CALL SITE — the same mutation of the same site, differing only in that the twin's anchor carries the following comment line and is therefore UNAMBIGUOUS. This bare `if (!check.ok)` now matches THREE guards (plan activation, RPH-EXE-006 completion, and the §21.1 skip) because two more were added after the harvest, so it would land on whichever came first — a site nobody chose. The twin is the same mutation, correctly aimed."
	},
	{
		id: 'WP11-M3 drop noOutputResult from the emitted event',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '...(p.noOutputResult !== undefined ? { noOutputResult: p.noOutputResult } : {})',
		replace: '...({})',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp1-dormancy.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M4 admit TIMEOUT as success-compatible',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.noOutputReasonIsSuccessCompatible === false)',
		replace: 'if (false && input.noOutputReasonIsSuccessCompatible === false)',
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M5 drop the outputBindings corroboration limb',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.declaresOutputBindings === true)',
		replace: 'if (false && input.declaresOutputBindings === true)',
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M6 contradictory cell folded into the OK arm',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.hasOutput && input.explicitNoOutput)',
		replace: 'if (false && input.explicitNoOutput)',
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M7 zero-subject floor never fires (aiProduced -> false)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: '\tif (!input.aiProduced) return null;',
		replace: '\tif (true) return null;',
		expectRed: ['packages/rph-application/src/handlers/execution-floor-zero-subject.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M8 structuredResultHasContent is constant TRUE (over-refusal)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		// REFORMULATED by JAN-VERIF V-2c, and this is the clearest instance of the dead-code trap in the ledger.
		//
		// The harvested form PREPENDED `if (true) return true;`. That made all three arms below unreachable, and
		// TypeScript does not narrow inside unreachable code — so `value`, declared `unknown`, stopped being a
		// `string` inside `/\S/.test(value)` and the mutant failed to compile without ever running.
		//
		// Replacing the WHOLE body says the same thing with nothing unreachable. `value` goes unused, which is fine:
		// the base tsconfig sets neither `noUnusedLocals` nor `noUnusedParameters`.
		find:
			"\tif (typeof value === 'string') return /\\S/.test(value);\n" +
			'\tif (Array.isArray(value)) return value.length > 0;\n' +
			"\tif (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;\n" +
			'\treturn false;',
		replace: '\treturn true;',
		// NAMED VICTIM, newly possible: the emptiness line is pinned by an explicit truth table, so the ten EMPTY
		// rows (`{}`, `[]`, `''`, whitespace, undefined, null, 0, 42, false, true) all redden at once.
		expectRed: ['packages/rph-application/src/handlers/floor-gate-admissibility.test.ts'],
		why: 'the PINNED emptiness line: every EMPTY row becomes content, which over-refuses every AI completion carrying no assessable subject',
		source: 'wp11_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP11-M9 subjectCount === 0 -> >= 0 (refuse every AI completion)',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: '\tif (input.subjectCount !== 0) return null;',
		replace: '\tif (input.subjectCount < 0) return null;',
		expectRed: ['packages/rph-application/src/handlers/floor-gate-admissibility.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	{
		id: 'WP11-M10 declaresOutputBindings never derived (always false)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: 'declaresOutputBindings: Array.isArray(outputBindings) && outputBindings.length > 0',
		replace: 'declaresOutputBindings: false',
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants.py'
	},
	// ── THREE BYTE-IDENTICAL COPIES, and they are why `duplicateOf` exists ────────────────────────────────────
	//
	// wp11_mutants.py and wp11_mutants2.py both declared M4, M5 and M6 with the same id, file, anchor, replacement
	// and (absent) victim. The harvest merged both without deduplicating, so the first authoritative run's "90
	// mutants" was really 87 distinct mutations and three of its 35 KILLED_UNNAMED verdicts were the same three
	// kills counted twice. The figure was overstated; the guarantee was not, since each was killed on its own.
	{
		id: 'WP11-M4 admit TIMEOUT as success-compatible [wp11_mutants2.py harvest]',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.noOutputReasonIsSuccessCompatible === false)',
		replace: 'if (false && input.noOutputReasonIsSuccessCompatible === false)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py',
		duplicateOf:
			'WP11-M4 admit TIMEOUT as success-compatible (source wp11_mutants.py) — byte-identical'
	},
	{
		id: 'WP11-M5 drop the outputBindings corroboration limb [wp11_mutants2.py harvest]',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.explicitNoOutput && input.declaresOutputBindings === true)',
		replace: 'if (false && input.declaresOutputBindings === true)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py',
		duplicateOf:
			'WP11-M5 drop the outputBindings corroboration limb (source wp11_mutants.py) — byte-identical'
	},
	{
		id: 'WP11-M6 contradictory cell folded into the OK arm [wp11_mutants2.py harvest]',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (input.hasOutput && input.explicitNoOutput)',
		replace: 'if (false && input.explicitNoOutput)',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py',
		duplicateOf:
			'WP11-M6 contradictory cell folded into the OK arm (source wp11_mutants.py) — byte-identical'
	},
	{
		id: 'WP11-M11 kernel MISSING cell never fires',
		file: 'packages/rph-domain/src/execution.ts',
		find: 'if (!input.hasOutput && !input.explicitNoOutput)',
		replace: 'if (false && !input.explicitNoOutput)',
		expectRed: ['packages/rph-application/src/handlers/execution-exe006-explicit-result.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP11-M2 delete the RPH-EXE-006 reject at the CALL SITE',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (!check.ok)\n\t\t\t\t// MISSING is the ratified',
		replace: '\t\t\tif (false && !check.ok)\n\t\t\t\t// MISSING is the ratified',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp11_mutants2.py'
	},
	{
		id: 'WP12A-M1 `every` becomes `some` (1-of-5 backs a full claim again)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tconst offendingStepStates = input.stepStates.filter((s) => s !== 'SUCCEEDED' && s !== 'SKIPPED');",
		replace:
			"\tconst offendingStepStates = input.stepStates.some((s) => s === 'SUCCEEDED' || s === 'SKIPPED')\n\t\t? []\n\t\t: input.stepStates.filter((s) => s !== 'SUCCEEDED' && s !== 'SKIPPED');",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-execution-success.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M2 the STATUS term is dropped (a killed plan backs the claim)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (input.planStatus !== 'ACTIVE' && input.planStatus !== 'COMPLETED')",
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-execution-success.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M3 the >=1-SUCCEEDED limb is dropped (all-skipped backs the claim)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (!input.stepStates.includes('SUCCEEDED'))",
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-execution-success.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M4 narrowed to COMPLETED-only (breaks the reference seed)',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (input.planStatus !== 'ACTIVE' && input.planStatus !== 'COMPLETED')",
		replace: "\tif (input.planStatus !== 'COMPLETED')",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-execution-success.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12a_mutants.py'
	},
	{
		id: 'WP12A-M5 the PWU plane stops calling the kernel (restores the weak copy)',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: '\t\tif (!verdict.ok) failures.push(`${oid}: ${verdict.reason} (${verdict.errorCode})`);\n\t\treturn verdict.ok;',
		replace:
			"\t\tif (!verdict.ok) failures.push(`${oid}: ${verdict.reason} (${verdict.errorCode})`);\n\t\treturn (s.steps ?? []).some((step) => step.stepState === 'SUCCEEDED');",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-execution-success.test.ts'],
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
		source: 'wp12b_m3m9.py',
		supersededBy:
			"WP12B-M3b Cancel pwuOpenness hardened to REQUIRES_OPEN_PWU — this entry never expressed the mutation its title names. `CLEANUP_EXEMPT_X` is not a PlanLiveness member, so the harvested form was a TYPO that the closed union rejected; it says nothing about whether hardening Cancel is caught, because hardening Cancel was never applied. M3b performs the actual hardening. The separate fact this stumbled into — that a bogus liveness value is UNWRITABLE — is worth proving on purpose, and now is: see 'V2C-T1'."
	},
	{
		// PROMOTED FROM AN ACCIDENT. WP12B-M3's typo revealed a real type-level guarantee nobody had recorded: the
		// authority columns are CLOSED unions, so an unrecognised value cannot be declared at all. That matters more
		// than it sounds — every one of the three columns is consumed by an exhaustive `switch`-free lookup in
		// `stepAuthorityRefusal`, and a value outside the union would silently match no limb and gate NOTHING.
		//
		// Declared `expectNoCompile` deliberately, because here the refusal IS the guarantee: no test can be deleted
		// to lose it. Contrast the 21 NO_COMPILE entries V-2c reformulated, where the compiler was objecting to the
		// mutation operator rather than defending a rule.
		id: 'V2C-T1 PlanLiveness is a closed union — an unrecognised authority value is UNWRITABLE',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		replace: "\t\teventType: 'ExecutionStepCancelled',\n\t\tplanLiveness: 'CLEANUP_EXEMPT_X',",
		expectRed: [],
		why: 'a spec row cannot declare an authority value outside the union, so no command can be gated by a limb that matches nothing',
		source: 'JAN-VERIF V-2c (promoted from WP12B-M3’s typo)',
		expectNoCompile:
			"`planLiveness` is `PlanLiveness = 'REQUIRES_ACTIVE_PLAN' | 'CLEANUP_EXEMPT'`, and STEP_COMMAND_SPECS is a total `Readonly<Record<StepCommandType, StepCommandSpec>>`. A row declaring `CLEANUP_EXEMPT_X` is TS2820 at the declaration site. The consequence being prevented is specific: `stepAuthorityRefusal` tests each column by equality, so a fourth value would match no limb and the command would be gated by nothing at all — a fail-OPEN produced by a typo. The type forecloses it; nothing else does."
	},
	{
		id: 'WP12B-M3b Cancel pwuOpenness hardened to REQUIRES_OPEN_PWU',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tpwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
		replace:
			"\t\tpwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_m3m9.py'
	},
	{
		id: 'WP12B-M9 pwuOpennessRefusal admits a WRONG-TYPED work unit',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (pwu?.objectType !== 'PROFESSIONAL_WORK_UNIT')",
		replace: '\tif (pwu === undefined)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_m3m9.py'
	},
	{
		id: 'WP12B-M1 Complete reverts to CLEANUP_EXEMPT (the F-26 hole reopens)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\tcommandType: 'CompleteExecutionStep',\n\t\ttarget: 'SUCCEEDED',\n\t\tsourceStates: ['RUNNING'],\n\t\teventType: 'ExecutionStepSucceeded',\n\t\tplanLiveness: 'REQUIRES_ACTIVE_PLAN',",
		replace:
			"\t\tcommandType: 'CompleteExecutionStep',\n\t\ttarget: 'SUCCEEDED',\n\t\tsourceStates: ['RUNNING'],\n\t\teventType: 'ExecutionStepSucceeded',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M2 Fail is "hardened" to REQUIRES_ACTIVE_PLAN (the exemption is killed)',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		find: "\t\teventType: 'ExecutionStepFailed',\n\t\tplanLiveness: 'CLEANUP_EXEMPT',",
		replace: "\t\teventType: 'ExecutionStepFailed',\n\t\tplanLiveness: 'REQUIRES_ACTIVE_PLAN',",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
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
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M5 the PWU-openness limb never fires',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (spec.pwuOpenness === 'REQUIRES_OPEN_PWU') {",
		replace: '\tif (false) {',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M6 activation stops checking PWU openness',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\t\tif (closed) return closed;',
		replace: '\t\t\tif (false && closed) return closed;',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M7 canResumeExecutionOnPwu drops the generalised terminal set',
		file: 'packages/rph-domain/src/execution.ts',
		find: "\tif (isTerminalState('PWU.workLifecycleState', pwuLifecycleState))",
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M8 the non-PWU workUnitId read fails OPEN again',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\tif (ctx.store.loadObject(p.workUnitId)?.objectType !== 'PROFESSIONAL_WORK_UNIT') {",
		replace: '\tif (!ctx.store.loadObject(p.workUnitId)) {',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12b_mutants.py'
	},
	{
		id: 'WP12B-M9 pwuOpennessRefusal admits an unresolvable work unit',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// REFORMULATED by JAN-VERIF V-2c — the CONSEQUENCE, not the condition.
		//
		// `if (false)` could not compile: the guard's `return` is what proves `pwu` exists for `pwu.state` on the very
		// next line, so deleting the condition left `pwu` possibly-undefined. Keeping the check and admitting instead
		// of refusing is the same fail-open at runtime and preserves the narrowing, so it actually reaches the code.
		//
		// Its sibling — 'admits a WRONG-TYPED work unit' — weakens the condition to `pwu === undefined`, which keeps
		// the existence limb and drops only the KIND limb. Between them the two cells are separated: one guard doing
		// double duty, one mutant per duty.
		find:
			"\t\treturn reject(\n\t\t\tcommand,\n\t\t\t'RPH_VALIDATION_SEMANTIC_FAILED',\n\t\t\t`${command.commandType} blocked: the plan's workUnitId ${workUnitId} does not resolve to a " +
			'PROFESSIONAL_WORK_UNIT, so the RPH-PWU-010 openness of the owning work unit cannot be established.`,\n\t\t\t[targetId]\n\t\t);',
		replace: '\t\treturn null;',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-authority.test.ts'],
		why: 'an unresolvable workUnitId is ADMITTED rather than refused, so RPH-PWU-010 openness is never established for it',
		source: 'wp12b_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M1 the refusal is swallowed (restores the truthiness check)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// REFORMULATED by JAN-VERIF V-2c. `if (false && !authorized.ok)` made the reject unreachable, and inside dead
		// code `authorized` is no longer narrowed to the `{ ok: false; reason }` member — so `authorized.reason` was a
		// type error and the mutant never ran. Swallowing the refusal outright says the same thing and compiles.
		find:
			"\t\t\t\tif (!authorized.ok)\n\t\t\t\t\treturn reject(\n\t\t\t\t\t\tcommand,\n\t\t\t\t\t\t'RPH_VALIDATION_SEMANTIC_FAILED',\n\t\t\t\t\t\t`Cannot skip step ${p.stepId}: ${authorized.reason} " +
			'(§21.1 requires an AUTHORIZED plan revision or waiver — a bare id is not an authorization).`,\n\t\t\t\t\t\t[p.stepId, p.waiverOrRevisionId]\n\t\t\t\t\t);',
		replace: '\t\t\t\tif (!authorized.ok) return null;',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'the resolution runs and its REFUSAL is discarded — §21.1 resolved, then ignored',
		source: 'wp12c_m2.py (reformulated V-2c)'
	},
	// ── THE wp12c_m2.py HARVEST: SIX ENTRIES, ALL RETIRED AS DUPLICATE FORMULATIONS ───────────────────────────
	//
	// This harness attempted the RIGHT operator — mutate the returned VERDICT so the check admits — and expressed it
	// as `return { ok: true } || { …the real refusal }`. TypeScript rejects that outright (TS2872, "this kind of
	// expression is always truthy"), so all six failed to compile and none ever ran.
	//
	// Their instinct was sound and their syntax was not. The six WP-12C entries from wp12c_mutants.py cover the same
	// six guards and V-2c reformulated each to the clean form (`return { ok: true };`), which is precisely what these
	// were reaching for. Retiring these rather than deleting them keeps the record that two harnesses independently
	// judged these six checks worth proving.
	{
		id: 'WP12C-M2 a nonexistent id is ADMITTED [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\t\treason: `waiverOrRevisionId ${query.authorizationId} names no recorded object`\n\t\t};',
		replace: '\t\treason: `unused`\n\t\t} && { ok: true };',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M2 a nonexistent id is admitted (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M3 the object-KIND check ADMITS [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: "\tif (stored.objectType !== 'DECISION')\n\t\treturn {",
		replace: "\tif (stored.objectType !== 'DECISION')\n\t\treturn { ok: true } || {",
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M3 the object-KIND check is dropped (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M6 a decision with no execution scope ADMITS [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth)\n\t\treturn {',
		replace: '\tif (!auth)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M6 a decision with no execution scope authorizes a skip (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M8 the plan-id scope ADMITS [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.executionPlanId !== query.planId)\n\t\treturn {',
		replace: '\tif (auth.executionPlanId !== query.planId)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M8 the plan-id scope is dropped (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M9 the STEP list is IGNORED (one decision retires every step) [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!auth.executionStepIds.includes(query.stepId))\n\t\treturn {',
		replace: '\tif (!auth.executionStepIds.includes(query.stepId))\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M9 the STEP list is ignored (one decision retires every step) (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M10 expiry is IGNORED [wp12c_m2.py harvest]',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)\n\t\treturn {',
		replace:
			'\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)\n\t\treturn { ok: true } || {',
		expectRed: [],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_m2.py',
		duplicateOf:
			'WP12C-M10 expiry is ignored (source wp12c_mutants.py) — same guard, same intent; the twin now carries the compiling formulation'
	},
	{
		id: 'WP12C-M1 the resolution never runs (restores the truthiness check)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// REFORMULATED by JAN-VERIF V-2c. `if (false) {` killed the whole block, and inside it neither
		// `p.waiverOrRevisionId` (string | undefined) nor `authorized.reason` narrowed any more — three type errors,
		// none of them about the guard. Replacing the resolution with a hardcoded PASS is exactly F-30's original
		// defect: the id is never resolved, so any non-empty string authorizes a mandatory skip again.
		find: '\t\t\t\tconst authorized = resolveSkipAuthorization(ctx, {\n\t\t\t\t\tplanId: command.targetAggregateId,\n\t\t\t\t\tstepId: p.stepId,\n\t\t\t\t\tauthorizationId: p.waiverOrRevisionId,\n\t\t\t\t\tnow: command.issuedAt\n\t\t\t\t});',
		// A STUB FUNCTION, not a literal, and the reason is instructive. The first formulation was
		// `const authorized: { ok: true } | { ok: false; reason: string } = { ok: true };` — which TypeScript narrows
		// BY ITS INITIALIZER regardless of the annotation, so `!authorized.ok` became `never` and `.reason` did not
		// exist. Annotating a RETURN TYPE instead gives the union at the call, where nothing narrows it.
		replace:
			'\t\t\t\tconst authorized = ((): { ok: true } | { ok: false; reason: string } => ({ ok: true }))();',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'F-30 ITSELF: the §21.1 authorization is never resolved, so `!!waiverOrRevisionId` is back and any non-empty id retires a mandatory step',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	// ── THE SIX §21.1 CHECKS, REFORMULATED AS VERDICT MUTATIONS (JAN-VERIF V-2c) ───────────────────────────────
	//
	// Each of these six previously read `if (<check>)` -> `if (false)`, and each failed to compile for the same
	// reason: the guard's early return is what narrows `stored` / `auth` for the refusal message it guards, and
	// TypeScript abandons narrowing inside statically dead code. So the mutation objected to itself.
	//
	// Each now keeps the check verbatim and turns its REFUSAL into an ADMISSION. Runtime behaviour is the intended
	// fail-open; the compiler still sees a reachable, narrowed branch. `SkipAuthorizationVerdict` is
	// `{ ok: true } | { ok: false; reason: string }`, so `return { ok: true };` is the exact admission — no cast, no
	// excess property, nothing that could make the mutant pass for a syntactic reason.
	{
		id: 'WP12C-M2 a nonexistent id is admitted',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\t\t\tok: false,\n\t\t\treason: `waiverOrRevisionId ${query.authorizationId} names no recorded object`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 1 (existence): a dangling id — "the cheapest possible forgery" — is ADMITTED',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M3 the object-KIND check is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find:
			'\t\t\tok: false,\n\t\t\treason: `waiverOrRevisionId ${query.authorizationId} is a ${stored.objectType}, not a DECISION — only a governed decision ' +
			'authorizes a mandatory skip (§21.1)`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 2 (kind): naming an Artifact or a PWU authorizes a mandatory skip',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M4 any decisionType authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!AUTHORIZING_DECISION_TYPES.has(decision.decisionType))',
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M5 a PROPOSED (unapproved) decision authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: "\tif (decision.status !== 'EFFECTIVE')",
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M6 a decision with no execution scope authorizes a skip',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find:
			'\t\t\tok: false,\n\t\t\treason: `decision ${query.authorizationId} carries no executionSkipAuthorization, so it authorizes no step skip ' +
			'(an assurance-plane waiver does not reach the execution plane — INV-5)`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 5 (scope, fail-closed default): a Decision carrying NO execution-skip detail authorizes a skip — the INV-5 plane crossing',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M7 the plan-subject scope is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (!decision.subjectObjectIds.includes(query.planId))',
		replace: '\tif (false)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M8 the plan-id scope is dropped',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\t\t\tok: false,\n\t\t\treason: `decision ${query.authorizationId} authorizes skips on plan ${auth.executionPlanId}, not ${query.planId}`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 5 (plan scope): an authorization written for ANOTHER plan authorizes a skip on this one',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M9 the STEP list is ignored (one decision retires every step)',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find:
			"\t\t\tok: false,\n\t\t\treason: `decision ${query.authorizationId} authorizes skipping [${auth.executionStepIds.join(', ') || 'no steps'}], which does not include ${query.stepId} " +
			'— an authorization does not bleed to another step (RPH-GOV-005)`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 5 (step exactness): ONE decision retires EVERY mandatory step in the plan — the unscoped waiver REG-Q-012 forbids',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M10 expiry is ignored',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\t\t\tok: false,\n\t\t\treason: `decision ${query.authorizationId} expired at ${auth.expiresAt} (command issued ${query.now})`\n\t\t};',
		replace: '\t\t\tok: true\n\t\t};',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'check 6 (expiry, against the command’s issuedAt): a lapsed authorization still authorizes',
		source: 'wp12c_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP12C-M11 EVERY dated authorization is treated as expired',
		file: 'packages/rph-application/src/handlers/skip-authorization.ts',
		find: '\tif (auth.expiresAt !== undefined && auth.expiresAt <= query.now)',
		replace: '\tif (auth.expiresAt !== undefined)',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP12C-M12 the authorization is validated then DISCARDED (not persisted)',
		file: 'packages/rph-application/src/handlers/governance.ts',
		find: "\t\t...(p.executionSkipAuthorization\n\t\t\t? { executionSkipAuthorization: p.executionSkipAuthorization }\n\t\t\t: {}),\n\t\tstatus: 'PROPOSED'",
		replace: "\t\tstatus: 'PROPOSED'",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp12-skip-authorization.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp12c_mutants.py'
	},
	{
		id: 'WP14-M1 Start stops reading the authored binding (F-31 reopens)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: "\t\t\t...(typeof step.runtimeBindingId === 'string' && step.runtimeBindingId !== ''",
		replace:
			"\t\t\t...(false && typeof step.runtimeBindingId === 'string' && step.runtimeBindingId !== ''",
		expectRed: ['packages/rph-application/src/handlers/execrem-wp14-provenance.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M2 the activation allowlist is emitted but not PERSISTED again',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find: '\t\tmutate: (base) => ({\n\t\t\t...base,\n\t\t\tauthorizedRuntimeBindingIds:',
		replace: '\t\tmutate: (base) => ({\n\t\t\t...base,\n\t\t\t_unusedAuthorizedRuntimeBindingIds:',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp14-provenance.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},
	{
		id: 'WP14-M3 prune provenance is not derived (F-37 reopens)',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// REFORMULATED by JAN-VERIF V-2c. The harvested form was `undefined ?? pruneProvenance0(` — a name that does
		// not exist, plus TS2871 for a `??` whose left side is literally `undefined`. It could never have run; it was
		// a sketch of an intention, recorded as if it were evidence. Declaring the variable undefined outright is the
		// intention, expressed. `gatePlanForPrune` then goes unused, which the base tsconfig permits.
		find: '\tconst provenance = pruneProvenance(\n\t\tgatePlanForPrune,\n\t\tp.stepId,\n\t\tguardEvaluatorFor(ctx, command.targetAggregateId, gatePlanForPrune)\n\t);',
		replace: '\tconst provenance = undefined as ReturnType<typeof pruneProvenance>;',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp14-provenance.test.ts'],
		why: 'F-37: ExecutionStepPruned carries no provenance, so it differs from a waived skip only by TYPE and never by CONTENT',
		source: 'wp14_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP14-M4 provenance reads the step OWN in-edges (transitive case breaks)',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// REFORMULATED by JAN-VERIF V-2c: mutate the EFFECT, not the condition. `if (false && !seen.has(source))` made
		// the block dead, so `source` (string | undefined) stopped narrowing inside it — three type errors about the
		// mutation, none about the walk. Dropping only the `frontier.push` keeps the visited-set bookkeeping and stops
		// the backward walk after one hop, which is exactly "reads the step's OWN in-edges".
		find: '\t\t\tif (!seen.has(source)) {\n\t\t\t\tseen.add(source);\n\t\t\t\tfrontier.push(source); // keep walking back through the dead subgraph\n\t\t\t}',
		replace: '\t\t\tif (!seen.has(source)) {\n\t\t\t\tseen.add(source);\n\t\t\t}',
		expectRed: ['packages/rph-domain/src/transition-gate-prune-provenance.test.ts'],
		why: 'the TRANSITIVE case: a step cut off two or more hops below the branch gets no provenance at all',
		source: 'wp14_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP14-M5 the CUT predicate drops the live-source requirement (a JOIN is mis-attributed)',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// REFORMULATED by JAN-VERIF V-2c. `if (true)` made everything after the block unreachable and cost `source` its
		// narrowing there. The live-source requirement IS the condition, so this one has to stay a condition mutation:
		// a comparison of two identical calls is always true at runtime and is NOT constant-folded by the compiler, so
		// the code below stays reachable and narrowed. Deliberately degenerate — a mutant should read as obviously
		// wrong; the point is that a test must notice.
		find: '\t\t\tif (live.has(source)) {',
		replace: '\t\t\tif (live.has(source) === live.has(source)) {',
		expectRed: ['packages/rph-domain/src/transition-gate-prune-provenance.test.ts'],
		why: 'a DEAD source is attributed as the cut, so a JOIN below two dead branches names the wrong decision',
		source: 'wp14_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP14-M6 provenance attributes a non-BRANCH source',
		// RE-ANCHORED BY RW-7. `if (step?.stepType !== 'BRANCH') continue;` became `if (step.stepType === 'BRANCH')` —
		// a POSITIVE branch, because the non-BRANCH path is now a real arm rather than a `continue`. Mutant P2 already
		// covers "never report BRANCH_DECISION"; this entry keeps the ORIGINAL intent, which is the converse: report a
		// BRANCH_DECISION for a source that is not a branch.
		file: 'packages/rph-domain/src/transition-gate.ts',
		// REFORMULATED by JAN-VERIF V-2c: keep the EXISTENCE limb, drop only the KIND limb — the same split as
		// WP12B-M9's sibling pair. `if (false) continue;` cost `step` its narrowing for `step.selectedTransitionId`
		// two lines down; `if (step === undefined) continue;` keeps `step` proven and admits every non-BRANCH source,
		// which is precisely what the title claims.
		find: "\t\t\t\tif (step.stepType === 'BRANCH')",
		replace: "\t\t\t\tif (step.stepType !== '__never__')",
		expectRed: ['packages/rph-domain/src/transition-gate-prune-provenance.test.ts'],
		why: 'a non-BRANCH source is named as the deciding branch — exclusive first-match belongs to a BRANCH and to nothing else (D2)',
		source: 'wp14_mutants.py (reformulated V-2c)'
	},
	{
		id: 'WP14-M7 the branch decision (selectedEdgeId) is dropped from provenance',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// RE-ANCHORED by JAN-VERIF V-2c. The harvested anchor carried FIVE leading tabs; the code now sits at SIX,
		// so the mutant reported "anchor text is GONE" — nothing about this guard changed, only its indentation.
		//
		// THE RULE THIS ESTABLISHES: anchor on CONTENT, and include leading whitespace only when content alone is
		// ambiguous. Indentation both disambiguates (see WP11-M2, where three sites share `if (!check.ok)` and only
		// the tab depth told them apart) and rots on any reformat or renesting. Content first, tabs only as a
		// tiebreak, and never a tab the anchor does not need.
		find: '{ selectedEdgeId: step.selectedTransitionId }',
		replace: '{}',
		expectRed: ['packages/rph-domain/src/transition-gate-prune-provenance.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py (re-anchored V-2c)'
	},
	{
		id: 'WP14-M8 the CUT edge (excludedEdgeId) is dropped from provenance',
		// RE-ANCHORED BY RW-7: the inline spread became a `const excluded` shared by both provenance arms, so dropping
		// the field is now one edit that must redden BOTH causes rather than only the BRANCH one.
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: '\t\t\t\tconst excluded = edge.id === undefined ? {} : { excludedEdgeId: edge.id };',
		replace: '\t\t\t\tconst excluded = edge.id === undefined ? {} : {};',
		expectRed: ['packages/rph-domain/src/transition-gate-prune-provenance.test.ts'],
		why: 'harvested from a work-package harness that recorded no one-line rationale',
		source: 'wp14_mutants.py'
	},

	// ── JAN-BINDEXCL: propose-time runtime-binding admissibility (N-11) ───────────────────────────────────────
	//
	// `plan-proposal.ts` had NO declared mutants before this work package, which is worth saying out loud: it is the
	// single decision point for whether a plan is structurally executable at all, and every one of its seven rules
	// was defended only by tests nobody had ever tried to break.
	//
	// TWO OF THESE FIVE (N3, N5) MUTATE THE FIX INTO A WEDGE rather than into a fail-open. That is the operator this
	// finding demanded: N-11 is a defect whose first attempted repair was itself a wedge, so the mutants that matter
	// are the ones that make the guard refuse TOO MUCH, and the tests that kill them are positive cases.
	{
		id: 'N1-exclusivity-ledger-is-never-written',
		file: 'packages/rph-domain/src/plan-proposal.ts',
		// THE FINDING ITSELF, restored exactly: the rule still runs, still looks up, and never sees a collision
		// because nothing is ever recorded. Mutating the CONSEQUENCE rather than the condition, per the V-2c lesson.
		find: '\t\tclaimedBy.set(bindingId, s.id);',
		replace: '\t\tclaimedBy.delete(bindingId);',
		expectRed: ['packages/rph-domain/src/plan-proposal.test.ts'],
		why: 'N-11 itself: two steps may name one binding, so one of them is refused at Start forever by a remedy no command can perform',
		source: 'JAN-BINDEXCL WP-1'
	},
	{
		id: 'N2-empty-string-becomes-a-claim',
		file: 'packages/rph-domain/src/plan-proposal.ts',
		// OVER-refusal. Dropping the empty-string arm lets two steps collide on `''` — a binding nobody named —
		// which is the reference seed's shape one keystroke away.
		find: "\t\tif (typeof bindingId !== 'string' || bindingId === '') continue;",
		replace: "\t\tif (typeof bindingId !== 'string') continue;",
		expectRed: ['packages/rph-domain/src/plan-proposal.test.ts'],
		why: 'the empty string is ABSENCE, not a binding id: two unbound steps must not collide on it',
		source: 'JAN-BINDEXCL WP-1'
	},
	{
		id: 'N3-dangling-binding-is-refused-THE-WEDGE',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// THIS IS THE FIRST DRAFT OF THE FIX, RESTORED. It looks strictly safer and it is a WEDGE:
		// `RequestRuntimeBinding` carries an `executionStepId`, so a binding for step 2 cannot be requested before
		// step 2 has an id. Refuse the dangling case and there is no authoring order that works at all.
		//
		// A mutant that reddens ONLY positive cases. If it survives, the fix for a near-wedge has shipped a real one
		// and every suite still passes — which is exactly what happened during the first attempt at this finding.
		find: "\t\tif (binding?.objectType !== 'RUNTIME_BINDING') continue;",
		replace:
			"\t\tif (binding?.objectType !== 'RUNTIME_BINDING')\n\t\t\treturn reject(command, 'RPH_VALIDATION_SEMANTIC_FAILED', 'dangling binding', [bindingId]);",
		expectRed: ['packages/rph-application/src/handlers/bindexcl-propose-binding-scope.test.ts'],
		why: 'the dangling binding must PROPOSE: it is "not yet right", not "wrong forever", and refusing it leaves no authoring order that works',
		source: 'JAN-BINDEXCL WP-1'
	},
	{
		id: 'N4-store-half-compares-the-step-to-itself',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// The fail-OPEN half: the verdict is still consulted, still returns, and can never say WRONG_STEP because it
		// is asked whether the step is itself. Indistinguishable from the fix at every call site and in every type.
		find: "\t\t\tboundStepId: String(state.executionStepId ?? '')\n\t\t});",
		replace: '\t\t\tboundStepId: s.id\n\t\t});',
		expectRed: ['packages/rph-application/src/handlers/bindexcl-propose-binding-scope.test.ts'],
		why: 'the store half must read what the BINDING says it authorizes — comparing the step to itself makes the check total and vacuous',
		source: 'JAN-BINDEXCL WP-1'
	},
	{
		id: 'N5-propose-starts-asking-about-authorization-status',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// THE SECOND WEDGE, one move further on than N3. Authorization is a LATER act too, so a propose-time check
		// that consults `authorizationStatus` refuses every plan whose bindings are not yet authorized — and they
		// cannot be authorized before the plan names the steps they are for.
		//
		// TWO LINES, ONE EDIT, DELIBERATELY. The guard is defence in depth — the status is OMITTED from the facts
		// AND the verdict is gated on the WRONG_STEP limb specifically — so mutating either alone is equivalent to
		// the fix and would SURVIVE for a correct reason. Declaring a mutant known to survive would be the false
		// record this ledger exists to prevent, so the mutant removes both guards at once, which is the only edit
		// that actually expresses the defect.
		find: "\t\t\tboundStepId: String(state.executionStepId ?? '')\n\t\t});\n\t\tif (verdict.limb !== 'WRONG_STEP') continue;",
		replace:
			"\t\t\tboundStepId: String(state.executionStepId ?? ''),\n\t\t\tauthorizationStatus: String((state as { authorizationStatus?: unknown }).authorizationStatus)\n\t\t});\n\t\tif (verdict.ok) continue;",
		expectRed: ['packages/rph-application/src/handlers/bindexcl-propose-binding-scope.test.ts'],
		why: 'propose-time asks exactly ONE question — is this binding somebody else’s? — because every other question it could ask is about an act that has not happened yet',
		source: 'JAN-BINDEXCL WP-1'
	},

	// ── JAN-RETRYCAP: the read-model mirrors RPH-EXE-008's retry cap (N-12) ───────────────────────────────────
	//
	// THE AGREEMENT SUITE IS THE VICTIM FOR MOST OF THESE, and that is the point. F-29's invariant is not "each
	// layer is individually right", it is "no affordance the engine would reject" — a statement about the PAIR. A
	// mutant that breaks one side alone must redden a test that watches both, or the two can drift apart while
	// every single-layer suite stays green, which is exactly how N-12 survived four work packages.
	{
		id: 'R1-readmodel-limb-never-withholds',
		file: 'packages/rph-projections/src/execution-view.ts',
		// N-12 ITSELF, restored: the limb runs, decides, and throws the decision away. Mutating the CONSEQUENCE
		// rather than the condition (the V-2c lesson) — at runtime a fail-open, to the compiler still reachable.
		find: '\t\tif (!decision.mayRetry) return false;',
		replace: '\t\tif (!decision.mayRetry) void decision;',
		expectRed: ['packages/rph-projections/src/retrycap-readmodel-cap.test.ts'],
		why: 'N-12 itself: retry is offered on an exhausted step and the engine refuses the click — F-29’s fourth instance',
		source: 'JAN-RETRYCAP WP-3'
	},
	{
		id: 'R2-readmodel-limb-withholds-the-wrong-half',
		file: 'packages/rph-projections/src/execution-view.ts',
		// OVER-refusal, the failure a refusal-only battery cannot see: retry withheld exactly while attempts REMAIN.
		// Every "at the cap" assertion still passes; only the positive half falls.
		find: '\t\tif (!decision.mayRetry) return false;',
		replace: '\t\tif (decision.mayRetry) return false;',
		expectRed: ['packages/rph-projections/src/retrycap-readmodel-cap.test.ts'],
		why: 'the limb must remove only the ILLEGAL affordance — withholding a legal retry is the same defect wearing the other sign',
		source: 'JAN-RETRYCAP WP-3'
	},
	{
		id: 'R4-the-shared-default-cap-changes',
		file: 'packages/rph-domain/src/execution.ts',
		// If the default lived in two places this would redden only one side. It reddens the AGREEMENT suite, which
		// is the evidence that both sides now read the same constant.
		find: 'export const DEFAULT_RETRY_CAP = 3;',
		replace: 'export const DEFAULT_RETRY_CAP = 99;',
		expectRed: ['packages/rph-application/src/handlers/retrycap-engine-readmodel-agree.test.ts'],
		why: 'ONE default for the engine and the read-model — the whole reason the cap convention moved into the kernel',
		source: 'JAN-RETRYCAP WP-1'
	},
	{
		id: 'R5-a-degenerate-cap-is-taken-literally',
		file: 'packages/rph-domain/src/execution.ts',
		// `maxAttempts: 0` would become a real cap and refuse the FIRST retry — a plan made unusable by a typo,
		// which is fail-DANGEROUS in the direction that looks conservative.
		find: "\treturn typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : DEFAULT_RETRY_CAP;",
		replace: "\treturn typeof raw === 'number' && Number.isInteger(raw) ? raw : DEFAULT_RETRY_CAP;",
		expectRed: ['packages/rph-projections/src/retrycap-readmodel-cap.test.ts'],
		why: 'a degenerate maxAttempts must fall back to the convention, not become a cap of zero',
		source: 'JAN-RETRYCAP WP-1'
	},
	{
		id: 'R6-a-retry-marker-is-counted-as-an-attempt',
		file: 'packages/rph-domain/src/execution.ts',
		// §19 L3-3, as one clause: ExecutionStepRetried is a re-queue MARKER. Counting it double-counts every retry,
		// so a plan with maxAttempts=3 exhausts after two — and the engine and the view would still AGREE, both
		// being wrong together. Only the declared-cap assertion catches it, which is why that test asserts the flip
		// lands on the plan's own number rather than merely that the two sides match.
		find: "\t\t\te.eventType === 'ExecutionStepStarted' &&",
		replace:
			"\t\t\t(e.eventType === 'ExecutionStepStarted' || e.eventType === 'ExecutionStepRetried') &&",
		expectRed: ['packages/rph-application/src/handlers/retrycap-engine-readmodel-agree.test.ts'],
		why: 'one Started = one attempt; counting the re-queue marker halves every plan’s effective budget',
		source: 'JAN-RETRYCAP WP-1'
	},
	{
		id: 'R7-retry-stops-declaring-that-it-spends-budget',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		// The column is what tells the read-model WHICH command the cap governs. Flip this and the limb is still
		// present, still correct, and never consulted — the omission shape that made the binding limb a BLOCKER.
		find: "\t\tretryBudget: 'CONSUMES_RETRY_BUDGET',",
		replace: "\t\tretryBudget: 'UNCAPPED',",
		expectRed: ['packages/rph-application/src/handlers/retrycap-engine-readmodel-agree.test.ts'],
		why: 'the declared column is the only thing connecting RPH-EXE-008 to the affordance filter',
		source: 'JAN-RETRYCAP WP-1'
	},
	{
		id: 'R8-a-resume-is-declared-to-spend-budget',
		file: 'packages/rph-domain/src/step-command-spec.ts',
		// The asymmetry that matters on this row: Resolve is REQUIRES_* for binding and inputs and UNCAPPED here.
		// Marking it as spending would let a wait/resume cycle exhaust a plan that had run exactly once.
		find: "\t\tretryBudget: 'UNCAPPED',\n\t\tretryBudgetRationale:\n\t\t\t'THE SECOND ARROW INTO RUNNING",
		replace:
			"\t\tretryBudget: 'CONSUMES_RETRY_BUDGET',\n\t\tretryBudgetRationale:\n\t\t\t'THE SECOND ARROW INTO RUNNING",
		expectRed: ['packages/rph-projections/src/retrycap-readmodel-cap.test.ts'],
		why: 'suspension is not an attempt — a resume emits no ExecutionStepStarted and must not be charged',
		source: 'JAN-RETRYCAP WP-1'
	},
	{
		id: 'R9-the-plans-own-cap-never-reaches-the-step',
		file: 'packages/rph-projections/src/execution-view.ts',
		// The threading, not the rule. Drop the plan's RetryPolicy on the way to the step and every cap silently
		// becomes the default — correct-looking on any plan that happens to declare 3, wrong on every other.
		find: '\t\t\tstepView(step, row.status, row.pwuWorkLifecycleState, row.retryPolicy)',
		replace: '\t\t\tstepView(step, row.status, row.pwuWorkLifecycleState, undefined)',
		expectRed: ['packages/rph-application/src/handlers/retrycap-engine-readmodel-agree.test.ts'],
		why: 'the cap must be the PLAN’s; a fixture declaring the default value would hide this entirely',
		source: 'JAN-RETRYCAP WP-3'
	},

	// ── JAN-PARTAUTH: PARTIALLY_AUTHORIZED becomes reachable by DERIVATION (N-6) ──────────────────────────────
	{
		id: 'PA1-the-outcome-is-always-full-authorization',
		file: 'packages/rph-domain/src/execution.ts',
		// N-6 ITSELF, restored: every grant reports AUTHORIZED and the ratified PARTIALLY_AUTHORIZED state goes back
		// to being unreachable — with a binding that was granted less than it asked for now CLAIMING full authority,
		// which is worse than the original gap.
		find: "\treturn input.requested.every((c) => granted.has(c)) ? 'AUTHORIZED' : 'PARTIALLY_AUTHORIZED';",
		replace: "\treturn input.requested.every(() => true) ? 'AUTHORIZED' : 'PARTIALLY_AUTHORIZED';",
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'N-6 itself: a partial grant must produce PARTIALLY_AUTHORIZED, not a binding claiming authority it was not given',
		source: 'JAN-PARTAUTH WP-1'
	},
	{
		id: 'PA2-the-outcome-is-always-partial',
		file: 'packages/rph-domain/src/execution.ts',
		// The over-refusal half. Reddens ONLY positive cases: every full authorization in the system silently
		// downgrades to PARTIALLY_AUTHORIZED, which still permits execution — so nothing fails at the point of use
		// and the defect surfaces only as a wrong record.
		find: "\treturn input.requested.every((c) => granted.has(c)) ? 'AUTHORIZED' : 'PARTIALLY_AUTHORIZED';",
		replace:
			"\treturn input.requested.every((c) => granted.has(c)) ? 'PARTIALLY_AUTHORIZED' : 'PARTIALLY_AUTHORIZED';",
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'a grant that COVERS the request is full authorization — a rule that always says "partial" satisfies every negative case',
		source: 'JAN-PARTAUTH WP-1'
	},
	{
		id: 'PA3-an-authorization-may-silently-shrink-the-grant',
		file: 'packages/rph-domain/src/execution.ts',
		// THE GUARD N-6's FIX OWES. Reachable only because this work package made PARTIALLY_AUTHORIZED reachable:
		// a second authorization drops capability and records the removal as an authorization, while
		// RevokeRuntimeCapability exists to record removal with a reason and drive to a terminal state.
		find: '\tconst dropped = input.current.filter((c) => !next.has(c));',
		replace: '\tconst dropped = input.current.filter((c) => !next.has(c) && false);',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'an authorization EXPANDS a grant (§22.1); a reduction recorded as an authorization is a false entry in an append-only log',
		source: 'JAN-PARTAUTH WP-2'
	},
	{
		id: 'PA4-the-derived-target-is-ignored-by-the-committed-state',
		file: 'packages/rph-application/src/handlers/kit.ts',
		// THE SEAM, not the rule. `target` is derived once and used for the transition check, the status field and
		// the mirrored lifecycleStatus. Re-deriving — or here, pinning the committed field to the checked arrow's
		// source — is how an aggregate ends up in a state the machine never validated.
		find: '\t\t[args.statusField]: target,',
		replace: '\t\t[args.statusField]: from,',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'the state that is CHECKED must be the state that is COMMITTED — one derivation, used everywhere',
		source: 'JAN-PARTAUTH WP-1'
	},
	{
		id: 'S1-the-schema-manifest-silently-shrinks',
		file: 'packages/rph-contracts/src/gen/schema-manifest.ts',
		// N-14's shape as a mutation: the enumeration quietly covers fewer artifacts. Before the manifest was shared,
		// this was UNDETECTABLE — the drift suite read one file out of 107 and would have passed on any subset. It is
		// caught in two independent ways now: the count floor, and the stale-artifact check, which sees 90-odd
		// committed files the manifest no longer claims.
		find: '\tfor (const entry of Object.values(OBJECT_SCHEMAS))',
		replace: '\tfor (const entry of Object.values(OBJECT_SCHEMAS).slice(0, 0))',
		expectRed: ['packages/rph-contracts/src/json-schema.test.ts'],
		why: 'the drift check must be TOTAL over the committed artifacts — a shrinking enumeration is how "we check them all" becomes "we check one"',
		source: 'JAN-BINDEXCL N-14'
	},

	// ── THE 2026-07-26 RULINGS: N-18 (R4), N-20, N-21, N-22, R2 ───────────────────────────────────────────────
	{
		id: 'X1-a-binding-granting-nothing-authorizes-a-start',
		file: 'packages/rph-domain/src/execution.ts',
		// N-18 ITSELF. The sponsor ruled the STATE legitimate and the PREDICATE wrong; this restores the predicate.
		find: '\tif (facts.grantedCapabilities !== undefined && facts.grantedCapabilities.length === 0)',
		replace:
			'\tif (facts.grantedCapabilities !== undefined && facts.grantedCapabilities.length < 0)',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'N-18: a reviewed binding that conferred nothing must not authorize a start — the state is right, the permission was not',
		source: 'N-18 ruling (R4)'
	},
	{
		id: 'X2-an-absent-grant-is-read-as-an-empty-one',
		file: 'packages/rph-domain/src/execution.ts',
		// THE ASYMMETRY THAT MATTERS, in one clause: ABSENT is "the caller did not resolve it" and must be UNGATED;
		// only a RESOLVED empty set gates. Collapsing them withholds Start on every step whose binding facts the
		// caller could not look up — the disclosed fail-open turned into a silent fail-closed.
		find: '\tif (facts.grantedCapabilities !== undefined && facts.grantedCapabilities.length === 0)',
		replace: '\tif ((facts.grantedCapabilities ?? []).length === 0)',
		// IT SURVIVED FIRST, AND THE VICTIM WAS THE MISTAKE — not the guard. I named the exebind suite, which drives
		// the ENGINE, and `bindingAuthorityRefusal` ALWAYS supplies `grantedCapabilities` (it resolves them from the
		// store). So the absent case does not exist on that path and the mutation was invisible there.
		//
		// THE ABSENT CASE LIVES ONLY IN THE READ-MODEL, where a caller may know a binding resolves and its status
		// without having projected its grant — which is exactly the disclosed fail-open. That is where it must be
		// measured. A mutant is only as good as the suite it is pointed at, and "the suite I happened to think of"
		// is not the same as "the suite where the case exists".
		expectRed: ['packages/rph-projections/src/revrem-wp6-readmodel-binding-authority.test.ts'],
		why: 'ABSENT means UNGATED, RESOLVED-EMPTY gates — two absences that mean opposite things (DS §6b R9), and only the read-model can produce the absent one',
		source: 'N-18 ruling (R4)'
	},
	{
		id: 'X3-the-verdict-renderer-falls-through-again',
		file: 'packages/rph-application/src/handlers/execution.ts',
		// THE FINDING INSIDE THE FIX. A limb the renderer has not been taught about must still REFUSE. Without the
		// totality arm the N-18 verdict fell to `return null` and the engine PERMITTED the start it had just refused.
		find: "\tif (verdict.limb === 'NOTHING_GRANTED')",
		replace: "\tif (verdict.limb === '__no_bespoke_arm__' as typeof verdict.limb)",
		expectRed: [],
		why: 'A DECLARED CONTROL over defence in depth — see expectSurvive.',
		source: 'N-18 ruling (R4)',
		expectSurvive:
			'IT MUST SURVIVE, AND THAT IS THE PROOF. Removing the BESPOKE NOTHING_GRANTED rendering leaves the ' +
			"TOTALITY arm below it, which refuses any non-ok limb with the kernel's own reason — so the kill test " +
			'still passes, and it passes for the RIGHT reason. The two arms are deliberately redundant: the bespoke ' +
			'one gives the best message, the total one guarantees a limb nobody wrote an `if` for cannot be silently ' +
			'admitted. A mutant that reddened here would mean the totality arm is not doing its job. Its absence is ' +
			'what SHOULD redden, and that is a different edit — but the reverse mutation (disabling the totality arm) ' +
			'is equally covered by this bespoke one, so NEITHER can be measured alone. Declaring one as a control ' +
			'and stating why is the honest record; declaring a mutant known to survive as a guard test would be the ' +
			'false record this ledger exists to prevent. THE DEFECT ITSELF IS REAL AND WAS OBSERVED: before the ' +
			'totality arm existed, the N-18 verdict fell through to `return null` and the engine PERMITTED the start ' +
			'it had just decided to refuse — caught by the kill test, not by any mutant.'
	},
	{
		id: 'X4-a-vacuous-request-is-accepted-again',
		file: 'packages/rph-application/src/handlers/runtime-binding.ts',
		// N-20: it reaches AUTHORIZED, which cannot be re-authorized, so nothing downstream can repair it. The only
		// point with a remedy is creation.
		find: '\tif (capabilityIdentities(p.requestedCapabilities).length === 0)',
		replace: '\tif (capabilityIdentities(p.requestedCapabilities).length < 0)',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'N-20: a request for nothing becomes an AUTHORIZED binding conferring nothing, with no command able to repair it',
		source: 'N-20'
	},
	{
		id: 'X5-the-partially-authorized-self-arrow-reopens',
		file: 'packages/rph-application/src/handlers/runtime-binding.ts',
		// N-22: `checkTransition` admits `from === to` as a NOOP, so without this an identical re-authorization
		// appends an event for a change that did not happen.
		//
		// RE-ANCHORED when N-22 was NARROWED — the guard is now `from === to && added.length === 0`, because the
		// defect is that nothing CHANGED, not that the status stayed the same. See X8 for the over-refusal.
		find: '\t\t\tif (from === to && added.length === 0)',
		replace: '\t\t\tif (from === to && added.length === 0 && (false as boolean))',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'N-22: an authorization that grants nothing new must not be recorded as one — events record ACCEPTED STATE CHANGES (§27)',
		source: 'N-22'
	},
	{
		id: 'X8-n22-over-refuses-every-same-state-authorization',
		file: 'packages/rph-application/src/handlers/runtime-binding.ts',
		// THE OVER-REFUSAL I SHIPPED FIRST, AS A MUTANT. Dropping the `added` clause refuses EVERY same-state
		// authorization — which blocks incremental multi-party authorization (approver 1 grants A, approver 2 adds
		// B) and was disclosed to the sponsor as an unavoidable cost of the ratified machine. It was not: a
		// same-state transition here is UNDECLARED, not forbidden, and this codebase already runs two of them
		// (`ApplyTacticalChange` ACTIVE -> ACTIVE). Reddens ONLY positive cases, which is exactly why the first
		// formulation looked correct and passed its own battery.
		find: '\t\t\tif (from === to && added.length === 0)',
		replace: '\t\t\tif (from === to)',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'the defect is "nothing changed", NOT "the status stayed the same" — refusing every self-transition makes incremental multi-party authorization inexpressible',
		source: 'N-22 (narrowed)'
	},
	{
		id: 'X6-the-input-readiness-mirror-goes-silent',
		file: 'packages/rph-projections/src/execution-view.ts',
		// N-21 ITSELF: the read-model stops mirroring RPH-EXE-005 and offers start/resolve on a step whose required
		// input does not resolve — F-29's fifth instance, restored.
		find: "\t\tspec.inputReadiness === 'REQUIRES_PRESENT_INPUTS' &&",
		// A REAL enum member, not a sentinel: comparing against a non-member is TS2367 and the mutant never runs
		// (the V-2c lesson, in its other form). `NOT_CONSUMING` points the limb at the wrong commands, so the two
		// arrows into RUNNING go ungated — which is precisely N-21.
		replace: "\t\tspec.inputReadiness === 'NOT_CONSUMING' &&",
		expectRed: ['packages/rph-projections/src/retrycap-readmodel-cap.test.ts'],
		why: 'N-21: the read-model must withhold what the engine refuses — RPH-EXE-005 is ratified and was mirrored nowhere',
		source: 'N-21'
	},
	{
		id: 'X7-the-authorization-event-stops-recording-its-outcome',
		file: 'packages/rph-application/src/handlers/runtime-binding.ts',
		// R2: the log carries the grant but not the resulting status, so an auditor cannot tell a full authorization
		// from a partial one — the exact distinction JAN-PARTAUTH's derivation exists to make.
		find: '\t\t\tauthorizationStatus: nextState.authorizationStatus\n\t\t}),',
		replace: '\t\t\tauthorizationStatus: undefined\n\t\t}),',
		expectRed: ['packages/rph-application/src/handlers/partauth-derived-outcome.test.ts'],
		why: 'R2: the event must record the outcome the vocabulary declares REQUIRED on it, or the audit log cannot distinguish full from partial',
		source: 'R2 ruling'
	},
	{
		id: 'V1-ontology-references-resolve-against-the-SHIPPED-set',
		file: 'packages/rph-product-realization-pwa/src/ontology.ts',
		// THE TRAP THE V-2d PARAMETERISATION COULD EASILY HAVE WALKED INTO. If the reference checks resolve against
		// the module-level SHIPPED policies instead of the SUBJECT's, an ontology whose policies were removed still
		// validates clean — its templates resolve against a set it does not contain. The validator then reports a
		// verdict it did not earn, which is worse than not checking: a broken ontology looks partly fine.
		//
		// Same shape as every "second copy that claims to be derived" defect in this lineage, expressed as a scope
		// slip rather than a duplication.
		find: '\treturn subject.seedPolicies.find((p) => stripVersion(p.policyId) === target);',
		replace: '\treturn seedPolicies.find((p) => stripVersion(p.policyId) === target);',
		expectRed: ['packages/rph-product-realization-pwa/src/verif-2d-ontology-validator.test.ts'],
		why: 'a validator must judge the ontology it was GIVEN — resolving against the shipped set makes a broken subject look partly valid',
		source: 'JAN-VERIF V-2d'
	},
	{
		id: 'V4-a-carriage-claim-cites-text-that-is-not-in-canon',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		// THE GATE V-4a EXISTS FOR. A carriage claim is a citation, and a citation nobody resolves is exactly the
		// kind of true-sounding sentence this whole programme keeps finding: it reads as evidence that the rule
		// survives retirement, while pointing at text that is not there.
		//
		// This mutation stands in for the REAL event it guards against, which is not someone mistyping an anchor —
		// it is a canon AMENDMENT that reworks STA-8 and quietly leaves three rules citing a sentence that no longer
		// exists. The register would keep reporting CARRIED, and the retirement decision would be taken on it.
		find: "\t\t\tcanonAnchor: 'A PWU has at most one active Execution Plan',",
		replace: "\t\t\tcanonAnchor: 'A PWU has at most three active Execution Plans',",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'V-4a: a CARRIED claim whose anchor is absent from the six canon artifacts must fail, or the register reports carriage it does not have',
		source: 'JAN-VERIF V-4a'
	},
	{
		id: 'V4-a-provenance-sidecar-satisfies-a-carriage-claim',
		file: 'packages/rph-domain/src/enforcement-register.test.ts',
		// MUTATES THE GATE ITSELF, deliberately — this file's standing rule is that a gate mechanism must be proved,
		// and the sidecar exclusion is the subtle half of the mechanism. `.provenance.md` records where canon text
		// CAME FROM. If a sidecar could satisfy an anchor, the map would impersonate the territory: a rule could be
		// certified as carried by a file whose entire content is a list of the sources canon was drawn FROM.
		//
		// Two gates catch it, which is the intended redundancy — the artifact COUNT goes from six to twelve, and the
		// provenance selftest resolves a string that exists in exactly one sidecar and in no artifact.
		find: "\t\t\t\tf.endsWith('.md') &&\n\t\t\t\t!f.includes('.provenance.')",
		replace: "\t\t\t\tf.endsWith('.md')",
		expectRed: ['packages/rph-domain/src/enforcement-register.test.ts'],
		why: 'V-4a: a provenance sidecar is NOT canon, and the exclusion that says so must be load-bearing rather than decorative',
		source: 'JAN-VERIF V-4a'
	},
	{
		id: 'S1-scope-closure-loses-the-evidence-hop',
		file: 'packages/rph-engine/src/queries.ts',
		// NOT A HYPOTHETICAL — this is the first implementation of the scope, restored. It closed over the
		// Undertaking's PWU ids alone, which is the obvious reading of "belongs to this Undertaking" and is wrong:
		// only the per-PWU FITNESS assessments name a PWU, while the three de-minimis FLOOR assessments per PWU name
		// the EVIDENCE the step produced (`reference-undertaking.ts:602`). The result emptied the OWNING
		// Undertaking's Assurance tab — a leak fix that over-corrected into hiding the subject's own records.
		//
		// It was caught by a CONTROL, never by the leak case, and that is the transferable lesson: scoping
		// EVERYTHING to nothing satisfies a leak test perfectly. Any scope guard needs both halves.
		find: '\tfor (const id of planIds) ids.add(id);',
		replace: '\tplanIds.clear();',
		expectRed: ['packages/rph-engine/src/query-scope.test.ts'],
		why: 'INV-02: the Undertaking closure must reach the Evidence its own execution produced, or the owning Undertaking loses its floor assessments',
		source: 'JPWB-SPEC-001-DR-001 S-1'
	},
	{
		id: 'S1-baseline-items-stringify-to-object-Object',
		file: 'packages/rph-engine/src/queries.ts',
		// ALSO A RESTORED REAL DEFECT. `BASELINE.itemObjectVersions` is `BaselineItemVersion[]` — records of
		// `{ objectId, semanticVersion, contentHash }` (`objects.ts:139-144`, `:674`) — not a string list and not a
		// map, though the vocab field name reads like both. `String(entry)` yields "[object Object]", which matches
		// no id, so every Baseline silently leaves the owning Undertaking's scope.
		//
		// The failure is SILENT in the direction that looks correct: an over-narrow scope shows less, and "less" is
		// what a scoping fix is expected to produce. Only the CONTROL distinguishes it from success.
		find: '\t\t\tconst objectId = (entry as { objectId?: unknown } | null)?.objectId;',
		replace: '\t\t\tconst objectId = String(entry);',
		expectRed: ['packages/rph-engine/src/query-scope.test.ts'],
		why: 'INV-02: a Baseline is subject-bound through itemObjectVersions[].objectId, and stringifying the record admits it to no Undertaking at all',
		source: 'JPWB-SPEC-001-DR-001 S-1'
	},
	{
		id: 'S3-runSteps-loses-atomicity',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts',
		// THE FIRST LEDGER ENTRY WITH AN E2E VICTIM, and the first with a file under `apps/`. Both were impossible
		// until S-3 taught the runner to dispatch `*.e2e.ts` to Playwright — see `isE2eTarget` in run.ts for why
		// naming one before that would have recorded a FALSE `KILLED` from the file-matcher rather than a real one.
		//
		// The mutation restores the pre-2026-07-28 shape: dispatch each command singly and return on the first
		// refusal, leaving everything before it committed. That is the defect the sponsor actually hit — clicking
		// Record Assurance on the seeded root PWU minted two orphan assessments and THEN reported "Illegal
		// transition on PWU".
		find: '\tif (batch.ok) return null;',
		replace:
			'\tif (batch.ok) return null;\n\tif (batch.failedIndex !== undefined) return null; // MUTANT: swallow the refusal',
		expectRed: ['apps/rph-demo/e2e/undertaking-atomicity.e2e.ts'],
		why: 'INV-14: a refused multi-Command action must commit nothing — and a Surface must not report success for a sequence the engine refused',
		source: 'JPWB-SPEC-001-DR-001 S-3'
	},
	{
		id: 'S3-CONTROL-e2e-victim-is-actually-run',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		// A CONTROL OVER THE NEW RUNNER PATH ITSELF, not over any guard.
		//
		// Without it, a Playwright dispatch that silently failed to run anything — wrong cwd, unresolved spec path,
		// a webServer that never started — would exit non-zero and be recorded as KILLED for EVERY e2e victim. A
		// runner that reports KILLED unconditionally is indistinguishable from one that works, which is the exact
		// vacuity this ledger exists to detect. So: mutate something the atomicity spec cannot possibly observe (a
		// comment word in a different package) and require it to SURVIVE. If this ever reports KILLED, the e2e
		// dispatch is reddening on something other than the guard and every e2e verdict above it is void.
		find: '// apps/* — the projection surface a professional drives, observed end to end',
		replace: '// apps/* — the projection surface a professional drives, observed end-to-end',
		expectRed: ['apps/rph-demo/e2e/undertaking-atomicity.e2e.ts'],
		expectSurvive:
			'A DECLARED CONTROL over the Playwright dispatch path (S-3). It edits a COMMENT in rph-domain, which no ' +
			'e2e can observe. Its survival proves the e2e victim is genuinely executed and genuinely passes; a KILL ' +
			'would mean the runner reddens on something other than the mutation, voiding every e2e verdict.',
		why: 'S-3: proves the new Playwright dispatch distinguishes a real kill from a runner that always fails',
		source: 'JPWB-SPEC-001-DR-001 S-3'
	},
	{
		id: 'W1-a-the-workbench-loses-its-scroll-container',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.svelte',
		// THE DEFECT ITSELF, restored exactly. `+layout.svelte` clips this route on the strength of a comment
		// promising full-bleed surfaces manage their own scrolling; before W-1 this page had no vertical scroll
		// container at all, so every tab but `graph` was unreachable below the fold. That is what the sponsor hit.
		//
		// NOTE FOR ANYONE WEAKENING THE SPEC LATER: `overflow: hidden` is still scrollable PROGRAMMATICALLY, so a
		// victim written with `scrollIntoViewIfNeeded()` would go GREEN against this mutation and certify the bug.
		// The victim asserts on a WHEEL for that reason. Changing it back re-opens the defect silently.
		find: '\t\toverflow-y: auto;',
		replace: '\t\toverflow-y: hidden;',
		expectRed: ['apps/rph-demo/e2e/undertaking-scroll.e2e.ts'],
		why: 'DR-002 W-1: a Surface a professional cannot scroll does not present the work it claims to present',
		source: 'JPWB-SPEC-001-DR-002 W-1'
	},
	{
		id: 'W1-b-the-canvas-is-sized-by-a-guess-again',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.svelte',
		// THE OPPOSITE FAILURE, and the reason the victim carries a CONTROL case. Making the workbench scroll is
		// only half a repair: the `graph` tab is a genuinely viewport-locked canvas that pans internally, and a fix
		// that lets it scroll off the bottom of the page has broken it while turning the main assertion green.
		//
		// The mutation is the sizing mistake W-1 retired, restored in the only form still available after
		// `height: calc(100vh - 320px)` was replaced by `flex: 1 1 auto`: a floor tall enough that the canvas can no
		// longer shrink into the space it is actually given, so it overflows and the page scrolls on a locked tab.
		find: '\t\tmin-height: 420px;',
		replace: '\t\tmin-height: 900px;',
		expectRed: ['apps/rph-demo/e2e/undertaking-scroll.e2e.ts'],
		why: 'DR-002 W-1: the CONTROL case is load-bearing — a repair that makes EVERYTHING scroll is not a repair',
		source: 'JPWB-SPEC-001-DR-002 W-1'
	},
	{
		id: 'W2-a-the-store-path-is-ignored',
		file: 'apps/rph-demo/src/lib/server/workbench.ts',
		// THE FIRST UNIT VICTIM UNDER `apps/`, and it was unreachable until the same work package fixed the runner.
		// `packagesWithTests()` scanned `packages/` only, so a victim here matched no vitest project, the run exited
		// non-zero for "no test files found", and this entry would have been recorded KILLED WITH NO MUTATION
		// APPLIED — the vacuity `S3-CONTROL-e2e-victim-is-actually-run` catches on the Playwright path, lying in
		// wait on the vitest one. See `vitest.projects.ts` → `appsWithTests()`.
		//
		// The mutation restores the pre-W-2 host: construct the engine with no store, so `createEngine` falls back
		// to its documented in-memory default and every authored Undertaking, Decision and Baseline dies with the
		// server process.
		find: '\t\t...(dbPath ? { store: new SqliteStorageAdapter({ filename: dbPath }) } : {})',
		replace: '\t\t...(dbPath ? {} : {}) // MUTANT: the path is accepted and discarded',
		expectRed: ['apps/rph-demo/src/lib/server/workbench-durability.test.ts'],
		why: 'DR-002 W-2: professional work that does not survive a restart was never recorded, only displayed',
		source: 'JPWB-SPEC-001-DR-002 W-2'
	},
	{
		id: 'W2-b-the-durable-host-never-recovers-its-outbox',
		file: 'apps/rph-demo/src/lib/server/workbench.ts',
		// THE OBLIGATION THAT BECOMING DURABLE ACTIVATES. `EngineHandle.recoverOutbox` states it in its own doc
		// comment — "re-drive PENDING outbox on (re)open of a durable store … A DURABLE HOST SHALL CALL THIS AT
		// STARTUP" — and it had bound nothing here because there was no durable store to bind. Measured before the
		// call existed: a restart left **300** entries PENDING and never re-drove them.
		//
		// THIS ENTRY REPLACED ONE THAT DID NOT REDDEN. W-2's first candidate mutated the seed guard, on the
		// reasoning that a durable store without it would re-seed every boot. It left all victims GREEN: the seed
		// dispatches fixed aggregate ids, so the engine's own idempotency already prevents the duplicate, and the
		// guard is defence in depth rather than the mechanism. Under V-3d a victim that never reddens must not be
		// recorded, so it is not — and the reasoning is kept here because the next person will have the same idea.
		find: '\tif (dbPath) engine.recoverOutbox();',
		replace: '\t// MUTANT: startup recovery is skipped',
		expectRed: ['apps/rph-demo/src/lib/server/workbench-durability.test.ts'],
		why: 'DR-002 W-2: work enqueued before a restart must be re-driven after it, not stranded PENDING forever',
		source: 'JPWB-SPEC-001-DR-002 W-2'
	},
	{
		id: 'W3-a-every-permitted-child-becomes-mandatory',
		file: 'packages/rph-projections/src/composition-plan.ts',
		// THE CARDINALITY RULE ITSELF. `mandatoryMinimum` is the ONE place the M/C distinction is decided, so this
		// mutation is the whole "instantiate everything permitted" defect in a single return.
		//
		// On the SEEDED architecture it is worth exactly one PWU — root + 7 becomes root + 7 + the C+ concern, 8
		// against 9 — which is why the e2e asserts a NUMBER rather than `toBeGreaterThan(0)`. The unit victim is
		// named instead because it states the rule directly and does not need a browser to do it.
		find: "	return code === 'M1' || code === 'M+' ? 1 : 0;",
		replace: '\treturn 1; // MUTANT: conditional children become mandatory',
		expectRed: ['packages/rph-projections/src/composition-plan.test.ts'],
		why: 'DR-002 W-3: a C1/C+ child is a professional judgement the surface must OFFER, never make on their behalf',
		source: 'JPWB-SPEC-001-DR-002 W-3'
	},
	{
		id: 'W3-b-a-rule-less-permitted-child-defaults-to-conditional',
		file: 'packages/rph-projections/src/composition-plan.ts',
		// THE DEFAULT, AND IT FAILS SILENTLY IN THE DIRECTION THAT LOOKS FINE. `permittedChildren` is OPTIONAL on a
		// PWU Type, so a PWA authored before the field existed carries only the flat `permittedChildTypeIds`.
		// Defaulting those to conditional instantiates NOTHING for such a PWA — and an empty result is
		// indistinguishable from a correctly-instantiated architecture whose children are all optional. Mandatory
		// fails loudly instead, which is the only reason anyone would find out.
		find: "	return declared ?? { typeId, cardinality: 'M1' };",
		replace: "\treturn declared ?? { typeId, cardinality: 'C+' }; // MUTANT: absent rule means optional",
		expectRed: ['packages/rph-projections/src/composition-plan.test.ts'],
		why: 'DR-002 W-3: an unstated cardinality must fail loudly, not resolve to "instantiate nothing"',
		source: 'JPWB-SPEC-001-DR-002 W-3'
	},
	{
		id: 'W3-c-an-unresolvable-architecture-is-instantiated-anyway',
		file: 'apps/rph-demo/src/routes/undertakings/+page.server.ts',
		// THE REFUSAL. A PWA whose root permits a type that does not exist PUBLISHES CLEANLY today — `definePwuType`
		// never checks that `permittedChildTypeIds` resolve, and the graph projection drops what it cannot resolve.
		// Without this guard the Undertaking is built anyway, silently missing mandatory work, and the professional
		// is handed a decomposition that is smaller than the architecture it claims to realize and says nothing
		// about it. The mutation returns null (no error) so instantiation proceeds.
		find: '	if (plan.unresolved.length > 0) {',
		replace: '\tif (false) {',
		expectRed: ['apps/rph-demo/e2e/pwa-instantiation.e2e.ts'],
		why: 'DR-002 W-3: an architecture that cannot be instantiated in full must be refused, not quietly truncated',
		source: 'JPWB-SPEC-001-DR-002 W-3'
	},
	{
		id: 'W3-d-the-instantiated-tree-is-flat',
		file: 'apps/rph-demo/src/routes/undertakings/+page.server.ts',
		// THE STRUCTURE, as distinct from the COUNT. Dropping `parentWorkUnitId` leaves every count in the e2e
		// intact — 8 PWUs on the seed, 3 on the depth fixture — and produces a set of unrelated work units rather
		// than a decomposition. `professional-work-graph` folds the parent link into the graph, so this is the
		// difference between an architecture and a list.
		find: '					: { parentWorkUnitId: pwuIdByKey.get(instance.parentKey)! }),',
		replace: '					: {}), // MUTANT: the child is created without its parent link',
		expectRed: ['apps/rph-demo/e2e/pwa-instantiation.e2e.ts'],
		why: 'DR-002 W-3: instantiating the right NUMBER of work units is not instantiating an architecture',
		source: 'JPWB-SPEC-001-DR-002 W-3'
	},
	{
		id: 'W4-a-the-authored-risk-judgement-is-discarded',
		file: 'apps/rph-demo/src/routes/undertakings/+page.server.ts',
		// FINDING F-D, RESTORED EXACTLY. Until W-4 every PWU the surface created carried these five literals, and
		// they are not cosmetic: `riskProfile` selects the assurance profile (rph-assurance/src/applicability.ts
		// resolves `$.riskProfile`), and HIGH_ASSURANCE gates on RISK_AT_LEAST(CONSEQUENCE,HIGH) OR
		// RISK_AT_LEAST(SECURITY_SENSITIVITY,HIGH) OR RISK_AT_LEAST(IRREVERSIBILITY,HIGH) OR
		// RISK_AT_LEAST(REGULATORY_EXPOSURE,HIGH). Five MEDIUMs and a LOW fail every disjunct, so the surface
		// silently placed EVERY PWU a professional created below the high-assurance floor, whatever the work was.
		find: '\t\t\t\triskProfile\n\t\t\t}',
		replace:
			"\t\t\t\triskProfile: { consequence: 'MEDIUM', uncertainty: 'MEDIUM', irreversibility: 'MEDIUM', securitySensitivity: 'MEDIUM', regulatoryExposure: 'LOW' }\n\t\t\t}",
		expectRed: ['apps/rph-demo/e2e/risk-profile-authored.e2e.ts'],
		why: 'DR-002 W-4: a fabricated risk profile is indistinguishable downstream from a professional judgement',
		source: 'JPWB-SPEC-001-DR-002 W-4'
	},
	{
		id: 'W4-b-an-undeclared-dimension-quietly-defaults',
		file: 'apps/rph-demo/src/lib/authoring/riskProfile.ts',
		// THE FIX FOR A FABRICATED VALUE IS NOT A BETTER-CHOSEN ONE. `?? 'MEDIUM'` instead of `?? ''` is a one-token
		// slip that turns every unanswered dimension back into a literal the surface chose — the same defect W4-a
		// restores, arriving through the parser instead of the payload. MEDIUM is legal on all five dimensions, so
		// it parses cleanly and nothing downstream complains.
		//
		// THIS IS THE MUTANT THE FIRST VERSION OF THE CONTROL COULD NOT HAVE KILLED. That control drove the browser
		// form with the risk selects empty and asserted nothing was created — which passed, but only because
		// `required` stopped the submit before it reached the server. The action never ran, so this mutation would
		// have SURVIVED behind a green test. The control now POSTs the form action directly.
		find: "		const raw = (read(riskFieldName(field)) ?? '').trim();",
		replace: "\t\tconst raw = (read(riskFieldName(field)) ?? 'MEDIUM').trim();",
		expectRed: ['apps/rph-demo/e2e/risk-profile-authored.e2e.ts'],
		why: 'DR-002 W-4: absent a judgement the work is refused, because a default is the same defect with a different literal',
		source: 'JPWB-SPEC-001-DR-002 W-4'
	},
	{
		id: 'W5-a-silence-is-reported-as-a-finding-of-none',
		file: 'packages/rph-projections/src/uncertainty-disclosure.ts',
		// O-8-R7: a Surface SHALL NOT present incomplete professional understanding as settled. This mutation makes
		// every subject read NONE_DECLARED — so a PWU nobody has assessed announces that a validator looked and
		// found nothing outstanding. It is the single most plausible way to get this component wrong, because the
		// two states differ in NO rendered statement: both show an empty list.
		//
		// It is also the mistake W-5 nearly shipped. The first design read `AssuranceAssessment.residualUncertainty`
		// from the object store, which is `[]` for every assessment ever made — the assurance handler records that
		// "the object's [] is SILENCE, not a finding of 'none'", and reconciling it is the §32 increment. Reading
		// it would have hardcoded exactly this mutation into the design.
		find: "	return hasAssessment ? 'NONE_DECLARED' : 'UNASSESSED';",
		replace: "\treturn 'NONE_DECLARED'; // MUTANT: unassessed work reports a finding of none",
		expectRed: ['packages/rph-projections/src/uncertainty-disclosure.test.ts'],
		why: 'DR-002 W-5: "nobody looked" and "someone looked and found nothing" are different facts about the work',
		source: 'JPWB-SPEC-001-DR-002 W-5'
	},
	{
		id: 'W5-b-a-later-clean-assessment-erases-an-earlier-finding',
		file: 'packages/rph-projections/src/uncertainty-disclosure.ts',
		// A DISCLOSURE MUST NOT BE RETRACTED BY ORDERING. Folding residuals as "the last completion wins" would let
		// a subsequent clean assessment silently delete an unresolved finding — a retraction nobody made, arriving
		// as a side effect of event order. The mutation replaces accumulation with last-write-wins.
		//
		// Deliberately NOT a mutation of the count: `disclosedCount` follows `statements`, so attacking the count
		// alone would prove only that one derives from the other.
		find: '			if (existing) existing.push(...residuals);',
		replace: '\t\t\tif (existing) bySubject.set(subject, [...residuals]); // MUTANT: last completion wins',
		expectRed: ['packages/rph-projections/src/uncertainty-disclosure.test.ts'],
		why: 'DR-002 W-5: retracting a recorded uncertainty is an act someone performs, never a fold order',
		source: 'JPWB-SPEC-001-DR-002 W-5'
	},
	{
		id: 'FI-a-an-unperformable-revision-is-accepted-again',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		// F-I ITSELF, restored. Before this guard, a revise carrying childWorkUnitIds returned ACCEPTED and the
		// contract was untouched — the caller told the revision succeeded, with no way to learn the children were
		// dropped. The capability remains unimplemented (DOC-003 DEC-2/3/4 is a model increment awaiting
		// ratification); what this refuses to do is ASSERT it. CON-000 B7 discharged rather than deferred.
		find: '	if (offered.length > 0) {',
		replace: '\tif (false) { // MUTANT: accept a revision this handler cannot perform',
		expectRed: ['packages/rph-application/src/handlers/decomposition-revise-conformance.test.ts'],
		why: 'F-I: accepting a command you cannot perform is a false assertion, not a deferral',
		source: 'JPWB-SPEC-001-DR-002 F-I'
	},
	{
		id: 'FI-b-the-obligation-carrier-drops-out-of-the-guard',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		// NARROWER THAN FI-a, AND THE MORE LIKELY SLIP. A guard that caught only `childWorkUnitIds` would look
		// complete — the headline case refuses — while obligation conservation went on being silently unperformed.
		// DEC-3 is the rule whose whole subject is that mandatory obligations do not disappear quietly, so it is
		// the one that must not fall out of the list unnoticed.
		find: "	['obligationAllocations', 'DOC-003 DEC-3 — obligation conservation across a revision'],",
		replace: '\t// MUTANT: the DEC-3 carrier is no longer refused',
		expectRed: ['packages/rph-application/src/handlers/decomposition-revise-conformance.test.ts'],
		why: 'F-I: a partial guard refuses the obvious field and leaves the obligation carrier silently dropped',
		source: 'JPWB-SPEC-001-DR-002 F-I'
	},
	{
		id: 'FI-c-the-event-stops-recording-what-it-supersedes',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		// THE AUDIT RECORD. This mutation stops the event recording the status it transitions to.
		//
		// ITS VERDICT CHANGED MEANING ON 2026-07-29, and the change is the point. `DecompositionRevised` used to be
		// absent from RATIFIED_EVENT_PAYLOADS — its vocab provenance carried the not-yet-ratified marker, which
		// `gen-messages` skips — so the engine's (d2) event gate never ran for it and the emitted shape had drifted
		// from its own declared schema unobserved for as long as it existed. Then, the conformance victim was the
		// ONLY thing standing between this event and silence. Since the sponsor conferred ratification (REG-F-006),
		// the gate runs: this mutation is now refused by the ENGINE at dispatch (VALIDATION_FAILED), and the victim
		// reddens on the dispatch assertion rather than on the payload assertion. Two independent kills, which is
		// what ratification bought.
		find: "\t\t\tstatus: String(next.status ?? '')",
		replace: "\t\t\tstatus: '' // MUTANT: the resulting status is not recorded",
		expectRed: ['packages/rph-application/src/handlers/decomposition-revise-conformance.test.ts'],
		why: 'F-I: an audit record that omits the transition it records is not an audit record',
		source: 'JPWB-SPEC-001-DR-002 F-I'
	},
	{
		id: 'W4a-invalidated-evidence-names-no-claim',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		// P4 / CT-10, and the last of the W1 triage's five WIRE gaps. Before the call site existed, invalidating
		// evidence advanced its status and stopped — every claim it had been supporting stayed exactly as supported
		// as before, which is the silent-loss case CT-10 forbids. The mutation restores that: the kernel is not
		// consulted and the declared `affectedClaimIds` goes back to empty.
		find: '			affectedClaimIds: classifyEvidenceInvalidation(',
		replace: '\t\t\taffectedClaimIds: [] as string[], // MUTANT: the kernel is not consulted\n\t\t\t_unused: classifyEvidenceInvalidation(',
		expectRed: ['packages/rph-application/src/handlers/evidence-invalidation-impact.test.ts'],
		why: 'W1 WIRE #4: evidence that is withdrawn must re-contest what it was holding up, not leave it silently supported',
		source: 'W1 hollow-kernel triage — WIRE #4'
	},
	{
		id: 'W4b-only-the-first-supported-claim-is-named',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		// THE NARROWER SLIP, and the likelier one. Reporting the FIRST supported claim satisfies "not silently
		// supported" for the headline case and leaves every other claim exactly as silently supported as before —
		// which is why the victim asserts on TWO claims rather than one. A single-claim fixture would have been
		// green under this mutation.
		find: '			).map((impact) => impact.objectId),',
		replace: '\t\t\t).map((impact) => impact.objectId).slice(0, 1), // MUTANT: only the first',
		expectRed: ['packages/rph-application/src/handlers/evidence-invalidation-impact.test.ts'],
		why: 'W1 WIRE #4: a partial disclosure leaves the un-named claims exactly as unre-contested as no disclosure',
		source: 'W1 hollow-kernel triage — WIRE #4'
	}
];
