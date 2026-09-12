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
// ── A SECOND DISCLOSED LIMIT, CLOSED 2026-07-28 BY S-3 (recorded and struck the same day) ────────────────────
//
// UNTIL 2026-07-28 the runner executed only `bunx vitest run <victim>`. Playwright specs are not vitest specs, so
// **no guard whose only red-proof was an e2e could be carried here** — and this ledger HAD, by census, zero entries
// with `file: 'apps/…'` and zero `expectRed` naming an `*.e2e.ts`. b06dfa99 closed that the same day: `isE2eTarget`
// in run.ts dispatches an e2e victim set to Playwright. RE-MEASURED at HEAD rather than arithmetic-shifted, the
// census is now 23 entries with `file: 'apps/…'` and 16 whose `expectRed` names an `*.e2e.ts`.
//
// THAT IS A GAP, NOT A POLICY, AND THE TEMPTING WORKAROUND IS THE DANGEROUS ONE. Naming an e2e file as the victim
// would not fail cleanly: vitest would find no matching spec, exit non-zero under `passWithNoTests: false`, and
// the runner would record **KILLED** — a verdict produced by the file-matcher rather than by any guard. That is
// exactly the shape this instrument exists to detect, and it would be manufactured by the instrument itself.
//
// The live instance: `runSteps` in `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` was made atomic on
// 2026-07-28 (JPWB-SPEC-001 `SPEC-001-INV-14`, FORK-23 (b)); its red-proof is `e2e/undertaking-atomicity.e2e.ts`,
// which was written first and observed FAILING on the assessment-count assertion before the fix landed. No entry
// was added for it AT THE TIME, deliberately, because an honest one could not then be run; the entry is now
// `S3-runSteps-loses-atomicity` below, added by b06dfa99 the same day. Closing it required the
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
	// ── SPEC-001 §11.4.22 FORK-22 item 2 / JPWB-DOC-003 §9 PER-4 ────────────────────────────────────────────
	// The ruling names a red-proof mutant as part of its own conformance. These are it. Both anchor on the ONE
	// conjunct that decides whether a declared revision is honoured, and they fail in OPPOSITE directions —
	// which is what distinguishes a real gate from one that merely refuses a lot.
	{
		id: 'MU-FRESH-18-A-neutralise-revision-check',
		file: 'packages/rph-application/src/handlers/kit.ts',
		find: "return {\n\t\t\tok: false,\n\t\t\tresult: reject(\n\t\t\t\tcommand,\n\t\t\t\t'RPH_REVISION_CONFLICT',\n\t\t\t\t`Revision conflict on ${id}: command expected revision ${command.expectedRevision}, actual is ${existing.revision}`,\n\t\t\t\t[id]\n\t\t\t)\n\t\t};",
		replace: "return {\n\t\t\tok: true,\n\t\t\tstate: existing.state as Record<string, unknown>,\n\t\t\trevision: existing.revision,\n\t\t\tsemanticVersion: existing.semanticVersion\n\t\t};",
		expectRed: ["verif/optimistic-concurrency-surface.test.ts"],
		why: 'PER-4 fail-open: neutralising the compare-and-swap reproduces last-write-wins, which is what all 28 surface dispatch sites did before FORK-22 item 2. Observed: reddens ONLY the stale-page test; the control and the tautology control stay green.',
		source: 'SPEC-001 §11.4.22 item 2'
	},
	{
		id: 'MU-FRESH-18-B-refuse-any-declared-revision',
		file: 'packages/rph-application/src/handlers/kit.ts',
		find:
			'if (command.expectedRevision !== undefined && command.expectedRevision !== existing.revision)',
		replace: 'if (command.expectedRevision !== undefined)',
		expectRed: ['verif/optimistic-concurrency-surface.test.ts'],
		why: 'THE CONTROL NEEDS ITS OWN MUTANT (a control that cannot fail is not a control). A guard that refused every command carrying a revision would satisfy the stale-page test while protecting nothing. Observed: reddens ONLY the CONTROL and the tautology control; the stale-page test stays green.',
		source: 'SPEC-001 §11.4.22 item 2'
	},
	// A and B above pin the ENGINE's half. C and D pin the SURFACE's half — the round-trip through the form,
	// which is where the protection actually lives and where nothing measured it until now.
	{
		id: 'MU-FRESH-18-C-empty-string-parses-as-zero',
		file: 'apps/rph-demo/src/lib/server/optimistic-concurrency.ts',
		find: 'if (!/^\\d+$/.test(trimmed)) return null;',
		replace: 'if (!/^\\d*$/.test(trimmed)) return null;',
		expectRed: ['apps/rph-demo/src/lib/server/optimistic-concurrency.test.ts'],
		why: "ONE CHARACTER IS THE WHOLE DEFENCE. `+`->`*` admits the empty string, `Number('')` is 0, and a form that round-tripped NOTHING then declares 'expect revision 0' — which MATCHES every freshly created aggregate, because createObject commits `newRevision: alsoEvents.length` (kit.ts). MEASURED end to end on /baselines: under this mutant the `submit` step (acting on a row at revision 0) is ACCEPTED and its e2e assertion stays GREEN; only `approve` (revision 1) reddens. So the defect hides behind the first step of the only test that drives it. Observed at unit level: reddens exactly 2 of 8 assertions — the empty-string case and the discrimination case — leaving the other 6 green.",
		source: 'DOC-003 §9 PER-4; SPEC-001 §11.4.22 item 2'
	},
	{
		id: 'MU-FRESH-18-D-template-stops-carrying-the-revision',
		file: 'apps/rph-demo/src/routes/baselines/+page.svelte',
		find:
			'<input type="hidden" name="expectedRevision" value={b.revision} />\n\t\t\t\t\t\t\t<button class="primary small" type="submit">Approve</button>',
		replace:
			'<input type="hidden" name="expectedRevision" value="" />\n\t\t\t\t\t\t\t<button class="primary small" type="submit">Approve</button>',
		expectRed: ['apps/rph-demo/e2e/baselines.e2e.ts'],
		why: "THE VALUE MUST COME FROM THE RENDER, and only an e2e can prove the round-trip. Emptying the rendered value (rather than deleting the element) is deliberate: a DELETED input posts no key at all, so `form.get` returns null and the missing-key branch fires — a different branch. Keeping the element and emptying it is the exact wire shape a broken interpolation produces, and it is the one the strict parser exists to refuse. Observed: reddens the APPROVED assertion (baselines.e2e.ts:31) via fail-closed, while the earlier UNDER_REVIEW assertion stays green because only the approve form was mutated.",
		source: 'DOC-003 §9 PER-4; SPEC-001 §11.4.22 item 2'
	},
	{
		id: 'MU-FRESH-18-E-a-new-mutating-action-appears-unnoticed',
		file: 'apps/rph-demo/src/routes/baselines/+page.server.ts',
		find: 'export const actions: Actions = {\n',
		replace:
			"export const actions: Actions = {\n\tsmuggled: async () => fail(400, { error: 'an unwired mutating action nobody classified' }),\n\n",
		expectRed: ['verif/route-action-census.test.ts'],
		why: "THE CENSUS'S OWN CONTROL, and the only capability no other test in the repo has. Once a route is correctly wired its e2e reddens on any break in the chain — so the single thing nothing could see was an action that was NEVER wired. ADDING an action is the right mutant shape rather than renaming one: a rename breaks a live form post and reddens that route's e2e, making a red unattributable (which is why the larger ratchet design was refused — see ROADMAP-fork22-surface-wiring.md §5). Observed: reddens ONLY the population assertion (1 of 6 in the census file), and `baselines`, `optimistic-concurrency` and `dispatch-expected-revision` — 13 tests — all stay GREEN, so the kill is attributable to the census alone.",
		source: 'DOC-003 §9 PER-4 (population, not wiring — the census asserts no coverage)'
	},
	{
		id: 'MU-FRESH-18-F-lifecycle-form-stops-carrying-the-revision',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
		find:
			'<form method="POST" action="?/deprecate" use:enhance>\n\t\t\t\t\t\t<input type="hidden" name="expectedRevision" value={data.pwa.revision} />',
		replace:
			'<form method="POST" action="?/deprecate" use:enhance>\n\t\t\t\t\t\t<input type="hidden" name="expectedRevision" value="" />',
		expectRed: ['apps/rph-demo/e2e/pwa-lifecycle-deprecate.e2e.ts'],
		why: 'The five PWA publication-lifecycle forms posted ZERO fields before PER-4 — the subject came from params.id — so the declared revision is the only thing any of them submits, and only an e2e can prove the round-trip. NARROW BY DESIGN: mutating just the deprecate form makes the kill attributable to ONE spec. Observed: exactly 1 of 65 e2e tests fails, and it is pwa-lifecycle-deprecate.e2e.ts:13; the four specs that drive submitForReview (pwa-authoring, agent-sse, assurance-floor, policy-manager) all stay green.',
		source: 'DOC-003 §9 PER-4; SPEC-001 §11.4.22 item 2'
	},
	{
		id: 'MU-FRESH-18-G-declared-revision-taken-from-the-authoring-fork',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.server.ts',
		find: 'const pwaRevision = canonicalEngine.loadObject(params.id)?.revision;',
		replace: 'const pwaRevision = engine.loadObject(params.id)?.revision;',
		expectRed: ['apps/rph-demo/src/lib/server/pwa-loader-revision-provenance.test.ts'],
		why: "THE EXPECTATION MUST DESCRIBE THE STORE THE COMMAND WILL HIT. This is the only loader in the app that can render from a FORK (`candidate?.engine ?? canonicalEngine`), while every action on the page dispatches into CANONICAL — so a fork-sourced revision is an expectation about a store the command never touches, which either conflicts spuriously or happens to match and protects nothing. ⚠ THIS MUTANT SURVIVED ALL 65 E2E SPECS when first measured: no lifecycle spec stages an authoring candidate, so the two engines are the same object wherever those forms are driven. The named victim was written FOR this mutant, and its own control asserts the two stores actually disagree first — otherwise the assertion would hold under either implementation. Observed: fork 17 vs canonical 18.",
		source: 'DOC-003 §9 PER-4; REG-F-050 (a revision that cannot conflict protects nothing)'
	},
	{
		id: 'MU-FRESH-18-H-batch-element-stops-declaring-its-revision',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.server.ts',
		find: '\t\t\t\texpectedRevision\n\t\t\t}\n\t\t];',
		replace: '\t\t\t}\n\t\t];',
		expectRed: ['apps/rph-demo/src/lib/server/batch-revision-rollback.test.ts'],
		why: "THE ONLY PAGE-DERIVABLE EXPECTATION IN A BATCH, AND NO E2E CAN SEE IT. `newPolicyVersion` mints a successor, activates it, migrates PWU-Type references, then supersedes the predecessor — and only that LAST element touches an aggregate the page rendered. A single-actor happy path never produces a conflict, so the wiring is invisible to every test that merely exercises it; the named victim drives the ACTION directly with a stale revision. It also guards more than itself: because dispatchBatch runs one store transaction, a conflict here rolls element 0 back, so this one expectation covers the successor's entire content copy (read from the predecessor AFTER render). Observed: reddens 1 of that file's 4 cases — the action-level stale case — while its two engine-level cases, its control, and 15 other surface tests all stay GREEN, so the kill is attributable.",
		source: 'DOC-003 §9 PER-4; SPEC-001 §11.4.22 item 2'
	},
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
		find: "if (observed.status !== (expected.refusalStatus ?? 'REJECTED')) return 'ADMITTED';",
		replace: "if (observed.status !== (expected.refusalStatus ?? 'REJECTED')) return 'KILLED';",
		expectRed: ["packages/rph-domain/src/enforcement-register.test.ts"],
		why: 'the primitive SELFTEST: a classifier that greens everything',
		source: 'wp16_mutants.py'
	},
	{
		id: 'M5-layerOfTestFile-fail-open',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "return 'UNKNOWN';",
		replace: "return 'COMMAND';",
		expectRed: ["packages/rph-domain/src/enforcement-register.test.ts"],
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
		find: "'RPH-EXE': {",
		replace: "'RPH-EXE': { status: 'COVERED' }, '__M7_SHUNTED_ROW': {",
		expectRed: ["packages/rph-domain/src/enforcement-register.test.ts"],
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
		find: "return { kind: 'return', provenance: deadPredecessorCutProvenance(source, step, edge) };",
		replace: "return PRUNE_EDGE_SKIP;",
		expectRed: ["packages/rph-domain/src/revrem-wp7-prune-provenance-cause.test.ts"],
		why: 'N-8 ITSELF: a step cut by a CANCELLED/SUPERSEDED predecessor emits provenance-free ExecutionStepPruned, byte-identical in content to a waived skip',
		source: 'RW-7 inline'
	},
	{
		id: 'P2-branch-source-reported-as-dead-predecessor',
		file: 'packages/rph-domain/src/transition-gate.ts',
		// THE ORDER PROOF. Never reporting BRANCH_DECISION means a settled branch's recorded selection is discarded and
		// the cut is attributed to the branch merely being terminal — the more specific fact lost to the less.
		// RE-ANCHORED 2026-08-09 (REG-F-100): `2bda6423` (sonar decompose pruneProvenance, S3776) dedented this
		// line from four tabs to one. The CODE is unchanged — only its indentation moved — which is the ledger's
		// own rule #4 firing: leading whitespace disambiguates and rots on reindent. Content alone is unique here.
		find: "\tif (step.stepType === 'BRANCH')",
		replace: '\tif (false as boolean)',
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
		find: "if (ctx.localOf(edge) !== 'NEUTRALIZED') return PRUNE_EDGE_SKIP;",
		replace: "if (ctx.localOf(edge) === 'SATISFIED') return PRUNE_EDGE_SKIP;",
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
	// since each was written. AS HARVESTED, none of them named the test it reddens — their work packages declared
	// the mutation and never said which suite catches it — so each ran without a named victim and reported
	// KILLED_UNNAMED. Such a run is WHOLE-WORKSPACE, never PACKAGE-WIDE: scoping a mutant to its own package was the
	// wrong first attempt, and `targetSuites` in run.ts records why. JAN-VERIF V-3 then MEASURED and NAMED them —
	// re-measured at HEAD, 9 of the 10 entries below carry a victim and the tenth is a `duplicateOf`, which reports
	// DUPLICATE before anything is applied — and an empty `expectRed` on a mutant expected to be KILLED is now
	// BLOCKING: it reports KILLED_UNNAMED, which `unnamedVictims` in run.ts folds into `failures`. That is a
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
		find: "frontier.push(action.source); // keep walking back through the dead subgraph",
		replace: "seen.add(action.source); // MUTANT WP14-M4: the enqueue is dropped \u2014 the walk stops after one hop",
		expectRed: ["packages/rph-domain/src/transition-gate-prune-provenance.test.ts"],
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
		find: "if (!live.has(source)) return { kind: 'walk', source };",
		replace: "if (live.has(source) !== live.has(source)) return { kind: 'walk', source };",
		expectRed: ["packages/rph-domain/src/transition-gate-prune-provenance.test.ts"],
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
		// RE-ANCHORED 2026-08-09 (REG-F-100) — same dedent by `2bda6423`. Shares its `find` with P2 and differs in
		// `replace`, so the ledger's one-declaration-per-mutation rule is satisfied by the mutations being distinct.
		find: "\tif (step.stepType === 'BRANCH')",
		replace: "\tif (step.stepType !== '__never__')",
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
		find: "return edge.id === undefined ? {} : { excludedEdgeId: edge.id };",
		replace: "return edge.id === undefined ? {} : {};",
		expectRed: ["packages/rph-domain/src/transition-gate-prune-provenance.test.ts"],
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
		find: "boundStepId: String((state.executionStepId ?? '') as string | number | boolean)\n",
		replace: "boundStepId: s.id\n",
		expectRed: ["packages/rph-application/src/handlers/bindexcl-propose-binding-scope.test.ts"],
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
		find: "boundStepId: String((state.executionStepId ?? '') as string | number | boolean)\n\t\t});\n\t\tif (verdict.limb !== 'WRONG_STEP') continue;",
		replace: "boundStepId: String((state.executionStepId ?? '') as string | number | boolean),\n\t\t\tauthorizationStatus: String((binding.state as { authorizationStatus?: unknown }).authorizationStatus)\n\t\t});\n\t\tif (verdict.ok) continue;",
		expectRed: ["packages/rph-application/src/handlers/bindexcl-propose-binding-scope.test.ts"],
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
		// the EVIDENCE the step produced (`reference-undertaking.ts`, the `satisfyFloor(evidenceId)` call). The
		// result emptied the OWNING Undertaking's Assurance tab — a leak fix that over-corrected into hiding the
		// subject's own records.
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
		// `{ objectId, semanticVersion, contentHash }` (`objects.ts`, `BaselineItemVersionSchema`; the field itself
		// is `BaselineObjectSchema.itemObjectVersions`) — not a string list and not a map, though the vocab field name
		// reads like both. `String(entry)` yields "[object Object]", which matches
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
		// ⚠ RECLASSIFIED 2026-08-09 (REG-F-099) — IT REPORTED **SURVIVED**, AND THE REASON IS THE FINDING.
		//
		// The victim asserted `restarted.recoverOutbox() === 0`, on the reasoning "if startup already recovered
		// them, a second call finds nothing left." But `drainOutbox` returns 0 AND LEAVES EVERY ROW PENDING when no
		// subscriber is registered, and `openWorkbench` registers none. **0 is the pass value for both worlds.**
		//
		// SO THE MUTATED LINE IS INERT, MEASURED: on a real restart the startup call returns 0 and delivers 0;
		// attach a subscriber and the same call recovers **446** messages that were stranded the whole time.
		// Deleting a no-op cannot be observed, so no honest victim exists TODAY — and recording KILLED by finding
		// some suite that happens to redden would be the manufactured verdict this ledger exists to prevent.
		//
		// DECLARED `expectSurvive` WITH THE INVARIANT PINNED, which is this file's own prescription for an inert
		// mutation: the victim now asserts the invariant (no subscriber ⇒ work stays stranded) as an ADMISSION, so
		// **the day a subscriber is wired at startup the admission reddens, this becomes killable, and its verdict
		// flips to a build-failing SURVIVED.** The entry stops lying and starts waiting.
		expectRed: [],
		why: 'DR-002 W-2: work enqueued before a restart must be re-driven after it, not stranded PENDING forever. The obligation is real; the CALL is currently inert — see expectSurvive.',
		source: 'JPWB-SPEC-001-DR-002 W-2; reclassified by REG-F-099',
		expectSurvive:
			'Provably inert while the demo host registers no event subscriber: `drainOutbox` leaves rows PENDING and ' +
			'returns 0 with nobody to deliver to, so removing the startup call changes no observable. Pinned by ' +
			"workbench-durability.test.ts's ADMISSION case, which fails the moment a subscriber is wired — at which " +
			'point this mutation becomes observable and must be re-declared with a real victim.'
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
		find: "const HONOURED_REVISION_FIELDS = ['obligationAllocations', 'constraintPropagations'] as const;",
		replace: "const HONOURED_REVISION_FIELDS = ['constraintPropagations'] as const; // MUTANT: the DEC-3 carrier is neither gated nor applied",
		expectRed: ["packages/rph-application/src/handlers/decomposition-revise-conservation.test.ts"],
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
		// ⚠ RE-ANCHORED 2026-08-21 (ledger rule #5: re-anchor IN THIS COMMIT). The one-line anchor
		// `status: String((next.status ?? '') as ...)` became AMBIGUOUS the moment `acceptRecomposition` was
		// added to this file and built its event payload the same idiomatic way — 2 occurrences, reported
		// UNANCHORED by verif/mutant-ledger.test.ts before any mutation was attempted.
		// ⚠ THE COLLISION IS NOT THE NEW CODE'S FAULT. That line is this file's normal way to record a
		// resulting status, so a UNIQUE anchor has to carry the field naming WHICH event it belongs to.
		// Anchoring on a common idiom is a LATENT ambiguity that surfaces only when someone writes the idiom
		// a second time — which is what happened, and the gate caught it rather than a mutation run.
		find:
			"supersedesDecompositionContractId: command.targetAggregateId,\n\t\t\trationale: String((p.rationale ?? '') as string | number | boolean),\n\t\t\tsemanticVersion: Number(next.semanticVersion ?? 0),\n\t\t\tstatus: String((next.status ?? '') as string | number | boolean)",
		replace:
			"supersedesDecompositionContractId: command.targetAggregateId,\n\t\t\trationale: String((p.rationale ?? '') as string | number | boolean),\n\t\t\tsemanticVersion: Number(next.semanticVersion ?? 0),\n\t\t\tstatus: '' // MUTANT: the resulting status is not recorded",
		expectRed: ["packages/rph-application/src/handlers/decomposition-revise-conformance.test.ts"],
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
	},

	// ── D-1, THE TRUST BOUNDARY (REG-D-027, REG-D-028; REG-F-054..056, REG-F-061, REG-F-062) ────────────────────
	//
	// The guarantee D-1 buys is that NO SURFACE CAN AUTHOR AN ACTING IDENTITY. That is not one guard, it is four
	// separable ones, and the four mutants below are one per limb. They were all applied and measured by hand at
	// the point of landing — which, by this ledger's own founding argument, makes them CLAIMS until they are
	// re-runnable. Recorded here the same day so they never become the eighty this file was built to replace.
	{
		id: 'D1-authenticator-defaults-instead-of-refusing',
		file: 'apps/rph-demo/src/lib/server/identity.ts',
		find: "\t\t\treturn principal ? { ok: true, principal } : { ok: false, reason: 'UNKNOWN_CREDENTIAL' };",
		replace:
			'\t\t\treturn { ok: true, principal: principal ?? PRINCIPALS[SESSION_CREDENTIAL]! }; // MUTANT: open directory',
		expectRed: ['apps/rph-demo/src/lib/server/floor-recording.test.ts'],
		why: "THE WHOLE GATE IS ON THIS SIDE OF THE PORT. `?? { ok: false }` rather than `?? SOME_PRINCIPAL` is the entire standalone adapter's contribution — a default here makes every refusal path in the engine unreachable FROM THE APP, and D-1 becomes decorative while every test that exercises the happy path stays green. The victim's third case is a purpose-built CONTROL with its own failure mode: it drives an unresolvable credential and asserts the floor records NOTHING. Observed: reddens that ONE case and leaves the two recording cases green, which is the right sensitivity — a mutant that reddened all three would be measuring the recording path over again rather than the directory.",
		source: 'REG-D-027; DOC-004 §5; measured at 71573265'
	},
	{
		id: 'D1-recorder-declares-its-own-issuer-again',
		file: 'packages/rph-engine/src/record-assurance.ts',
		find: '\t\t\tissuedAt: opts.issuedAt,\n\t\t\tcorrelationId: opts.correlationId,',
		replace:
			"\t\t\tissuedAt: opts.issuedAt,\n\t\t\tissuedBy: { actorId: 'assurance-svc', actorType: 'SERVICE', displayName: 'MUTANT' },\n\t\t\tcorrelationId: opts.correlationId,",
		expectRed: ['apps/rph-demo/src/lib/server/floor-recording.test.ts'],
		why: "THE REGRESSION THAT ACTUALLY HAPPENED, PRESERVED AS A MUTANT (REG-F-062). This exact line shipped and took nine e2e specs down while the product blamed the reviewer. It is a REINSTATEMENT mutant rather than a deletion one: the defect was an ADDED declaration, so the only faithful mutation is to add it back. Observed: reddens BOTH recording cases with the engine's own refusal text — `declares an issuer it is not: it names SERVICE assurance-svc while the authenticated principal is HUMAN local-professional` and the AGENT equivalent — and leaves the unauthenticated control green.",
		source: 'REG-F-062; REG-D-027(b); measured at 71573265'
	},
	{
		id: 'D1-stamp-corrects-a-disagreeing-issuer-instead-of-refusing',
		file: 'packages/rph-application/src/command-bus.ts',
		find: '\t\t\treturn refuse(\n\t\t\t\t`This command declares an issuer it is not:',
		replace: '\t\t\tvoid refuse(\n\t\t\t\t`This command declares an issuer it is not:',
		expectRed: ['verif/trust-boundary.test.ts'],
		why: "SILENT CORRECTION IS THE FLATTERING FAILURE, AND IT LOOKS LIKE A FIX. Overwriting a disagreeing `issuedBy` produces a record showing the TRUE actor and no trace that anyone claimed otherwise — the audit trail is tidy and the forgery attempt is gone from it. Refusing is what makes the attempt observable, which is why the guarantee is 'refused, not corrected' rather than merely 'correct'. ⚠ THE OPERATOR IS THE CONSEQUENCE, NOT THE CONDITION, AND I LEARNED THAT THE HARD WAY HERE: the first version replaced the `if` test with `false` and reported NO_COMPILE — `declared &&` narrows `declared` for the refusal body's `String(declared.actorType)`, and TypeScript does not narrow inside statically dead code. That is the V-2c lesson firing on the very entry whose comment cited it, so the citation is kept as a warning rather than deleted. `void refuse(...)` keeps the check, keeps the narrowing, discards the refusal, and falls through to the stamp — which is exactly the silent overwrite.",
		source: 'REG-D-027(b); DOC-004 §5; V-2c mutation-operator rule'
	},
	{
		id: 'D1-payload-actor-reverts-to-the-ui-user-literal',
		file: 'apps/rph-demo/src/routes/decisions/+page.server.ts',
		find: '\t\t\tauthority: actingActor(uiSession()),',
		replace:
			"\t\t\tauthority: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' }, // MUTANT",
		expectRed: ['apps/rph-demo/e2e/decisions.e2e.ts'],
		why: "REG-F-061 EXACTLY AS IT SHIPPED. Stamping covers the envelope and reaches no payload field that names an actor in its own right, so this literal survived the whole D-1 migration and refused every governance Decision the workbench proposed — `proposeDecision` compares payload authority to the stamped issuer (ASR-15) and `ui-user` is neither the issuer nor an identity any authenticator issues. THE VICTIM IS AN E2E, DELIBERATELY: no unit test drives this route's action, and naming a unit victim that does not exist is how a declared mutant becomes an unrunnable claim. If the e2e leg is not part of a given run this reports UNANCHORED-by-absence rather than a false KILL.",
		source: 'REG-F-061; DOC-004 §5; measured at 71573265'
	},
	// ── REG-F-096, THE EVIDENCE GATE'S REACHABILITY ─────────────────────────────────────────────────────────────
	//
	// ONE FIELD decides whether an assessment is born waiting for evidence or ready to be judged, and no production
	// policy sets it to the value that gates. These three prove the census, the claim and the control each fail on
	// their own — which is the property the split into separate `it`s exists to give them.
	{
		id: 'F096-catalog-requirement-gates-assessing',
		file: 'packages/rph-product-realization-pwa/src/ontology.data.ts',
		find: "\t\t\t\t\trequiredForDispositions: 'SATISFIED_ONLY',\n\t\t\t\t\tmayBeWaived: false\n\t\t\t\t},\n\t\t\t\t{\n\t\t\t\t\tid: 'EV-15-02',",
		replace:
			"\t\t\t\t\trequiredForDispositions: 'ALL',\n\t\t\t\t\tmayBeWaived: false\n\t\t\t\t},\n\t\t\t\t{\n\t\t\t\t\tid: 'EV-15-02',",
		expectRed: ['verif/evidence-gate-reachability.test.ts'],
		why: "THE CENSUS IS THE MECHANISM, so it must fail the moment the catalog stops being uniform. ⚠ THE BLAST RADIUS IS WIDER THAN THE NAMED VICTIM AND IS DISCLOSED RATHER THAN NARROWED: measured over `verif` + `rph-product-realization-pwa`, this reddens SIX tests in THREE files — the two census-reading tests here, `doc004-conformance.test.ts`'s uniformity assertion (which already guarded the field), and three in `causation-provenance.test.ts`, because an EVIDENCE_PENDING birth changes which commands the drive synthesizes. That third file is the useful surprise: it is independent corroboration that this field reaches the lifecycle, found by mutating rather than by reading. The victim is named narrowly so the verdict is attributable to THIS guard; the others are recorded here so the kill is not mistaken for exclusive.",
		source: 'REG-F-096; DOC-004 §6.1 + §15.9; REG-E-026'
	},
	{
		id: 'F096-blocking-set-stops-filtering-on-ALL',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		find:
			"\t\t\t(r) =>\n\t\t\t\t(r as { requiredForDispositions?: string } | undefined)?.requiredForDispositions === 'ALL'\n\t\t)\n\t\t.filter(demandsAnInstance)\n\t\t.map((r) => r?.id)\n\t\t.filter((id): id is string => typeof id === 'string');\n\t//\n\t// ── THE FLIP",
		replace:
			"\t\t\t(r) =>\n\t\t\t\t(r as { requiredForDispositions?: string } | undefined)?.requiredForDispositions !== undefined\n\t\t)\n\t\t.filter(demandsAnInstance)\n\t\t.map((r) => r?.id)\n\t\t.filter((id): id is string => typeof id === 'string');\n\t//\n\t// ── THE FLIP",
		expectRed: ['verif/evidence-gate-reachability.test.ts'],
		why: "THE CLAIM'S OWN MUTANT. Widening `blockingEvidenceIds` to every declared requirement makes the 13 catalog `SATISFIED_ONLY` items gate ASSESSING, so the production shape is born EVIDENCE_PENDING instead of READY. Observed: reddens the production-shape test ALONE — the census stays green (the catalog did not move) and the CONTROL stays green (an `ALL` requirement still lands EVIDENCE_PENDING, which this mutant cannot change). That one-test kill is what makes `READY` mean *this field decided it* rather than *nothing ever lands elsewhere*. ⚠ The anchor runs past the closing `.filter(...)` to `── THE FLIP` because the same `=== 'ALL'` predicate appears twice in this file — the second is `submitEvidenceForAssessment`'s outstanding-set — and a two-occurrence anchor reports UNANCHORED.",
		source: 'REG-F-096; assurance.ts `blockingEvidenceIds`; DOC-004 §6.1'
	},
	{
		id: 'F096-control-asks-for-the-production-shape',
		file: 'verif/evidence-gate-reachability.test.ts',
		find: "expect(birthStateFor('ALL')).toBe('EVIDENCE_PENDING');",
		replace: "expect(birthStateFor('SATISFIED_ONLY')).toBe('EVIDENCE_PENDING');",
		expectRed: ['verif/evidence-gate-reachability.test.ts'],
		why: "THE CONTROL'S OWN MUTANT, which this repository has shipped three controls without. A control that only ever reddens alongside the test it guards proves nothing about the test; asking the control for the production shape removes its discriminating power and MUST redden it and nothing else. Observed: reddens the CONTROL alone, the production-shape test and both census tests staying green. Mutating a test file is deliberate here — the guarantee under test is *the probe can see the other outcome*, and that guarantee lives in the probe.",
		source: 'REG-F-096; feedback: a control needs its own mutant'
	},
	// ── REG-F-100, THE ANCHOR GATE ITSELF ───────────────────────────────────────────────────────────────────────
	//
	// The census that stops this ledger rotting silently needs its own proof, and its CONTROL needs a separate
	// one. Written as one test they reddened together, which is no control at all — the defect recorded at
	// REG-F-099 and fixed here by splitting them over a shared `MEASURABLE`.
	{
		id: 'F100-a-a-refactor-rewrites-an-anchored-line',
		file: 'packages/rph-domain/src/transition-gate.ts',
		find: "if (step.stepType === 'BRANCH')",
		replace: "if ('BRANCH' === step.stepType)",
		expectRed: ['verif/mutant-ledger.test.ts'],
		why: "THE REAL INCIDENT, REPRODUCED. A behaviour-identical mechanical rewrite — the kind a linter suggests and the kind `6992b7b0` performed — detaches every mutant anchored on that text. Observed: reddens the census ALONE, naming both victims by id (`P2-branch-source-reported-as-dead-predecessor: 0 occurrence(s)` and `WP14-M6 …: 0 occurrence(s)`), with the CONTROL green. ⚠ A PURE REINDENT WAS TRIED FIRST AND DID NOT WORK, which is a property of the instrument worth knowing: anchoring is SUBSTRING matching, so a one-tab anchor is still contained in two tabs — a DEDENT rots an anchor and an INDENT does not. Rewriting the line's content is what breaks it, and that is also what actually happened.",
		source: 'REG-F-100; the ledger gate added to verif/mutant-ledger.test.ts'
	},
	{
		id: 'F100-b-the-anchor-census-loses-its-population',
		file: 'verif/mutant-ledger.test.ts',
		find: ') => m.supersededBy === undefined && m.duplicateOf === undefined\n);',
		replace: ') => m.supersededBy === undefined && m.duplicateOf === undefined\n).slice(0, 0);',
		expectRed: ['verif/mutant-ledger.test.ts'],
		why: "THE CONTROL'S OWN MUTANT. An empty population makes the census pass VACUOUSLY — zero entries checked, zero offenders, green — which is the exact shape the census exists to prevent elsewhere. Emptying the SHARED `MEASURABLE` must therefore redden the CONTROL and nothing else. Observed: 1 failed / 8 passed, the failure being `CONTROL — the anchor census has a population and a reader that resolves`. Mutating a test file is deliberate: the guarantee under test is that the census has something to census, and that lives in the census.",
		source: 'REG-F-100; feedback: a control needs its own mutant'
	},
	// ── REG-F-102, THE CATEGORY-ERROR HOLE IN `authorityBasis` ──────────────────────────────────────────────────
	{
		id: 'F102-authority-basis-accepts-any-EFFECTIVE-object-again',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		find:
			"\t\tconst stored = ctx.store.loadObject(id);\n\t\tif (stored?.objectType !== 'DECISION') return undefined;\n\t\tconst parsed = DecisionObjectSchema.safeParse(stored.state);\n\t\treturn parsed.success && parsed.data.status === 'EFFECTIVE' ? id : undefined;",
		replace:
			"\t\tconst stored = ctx.store.loadObject(id);\n\t\tif (stored === undefined) return undefined;\n\t\tconst parsed = { success: true, data: stored.state as { status?: string } } as const;\n\t\treturn parsed.success && parsed.data.status === 'EFFECTIVE' ? id : undefined;",
		expectRed: ['packages/rph-application/src/handlers/decomposition-conservation.test.ts'],
		why: "THE DEFECT EXACTLY AS IT SHIPPED, and it is a COMBINED mutant because neither limb is independently killable — measured, not assumed. Dropping ONLY the objectType check leaves all 24 green (an Artifact's state fails DecisionObjectSchema anyway); dropping ONLY the parse leaves all 24 green (the objectType check already refused it). Each limb alone catches the ARTIFACT forgery, so a single-limb mutant reports SURVIVED and would read as an unguarded hole. Both together redden exactly one test — REG-F-015's shape, where a combined mutant was likewise the only honest instrument. ⚠ AND THE REDUNDANCY IS NOT SYMMETRIC: the PARSE is the operative limb for anything the store can actually hold, because `createObject` validates produced state, so a DECISION-typed object whose state does not parse is currently unconstructible. The objectType check is defence in depth AND the semantically correct question — 'is this a Decision?' — which is why it leads.",
		source: 'REG-F-102; the pre-fix behaviour, driven to ACCEPTED before the repair'
	},
	{
		id: 'F102-authority-basis-again-asked-of-the-S4-census',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		find:
			"\t\tconst stored = ctx.store.loadObject(id);\n\t\tif (stored?.objectType !== 'DECISION') return undefined;\n\t\tconst parsed = DecisionObjectSchema.safeParse(stored.state);\n\t\treturn parsed.success && parsed.data.status === 'EFFECTIVE' ? id : undefined;",
		replace:
			"\t\tconst stored = ctx.store.loadObject(id);\n\t\tif (stored === undefined) return undefined;\n\t\tconst parsed = { success: true, data: stored.state as { status?: string } } as const;\n\t\treturn parsed.success && parsed.data.status === 'EFFECTIVE' ? id : undefined;",
		expectRed: ['verif/authority-resolution-census.test.ts'],
		why: "THE SAME EDIT, ASKED OF A DIFFERENT INSTRUMENT — the B4/B5 shape this ledger explicitly admits, and the reason it is worth a second entry is that the two verdicts mean different things. `F102-authority-basis-accepts-any-EFFECTIVE-object-again` asks the BEHAVIOUR test whether an Artifact can still authorize; this asks the S-4 CENSUS whether the defect is still DETECTABLE AS A CLASS. A repository can pass the first and fail the second — that is exactly what happened for the four days REG-F-102 was live under a register entry recording it CLOSED, with three behaviour tests passing and no census able to see it. Observed: reddens the census alone, naming `decomposition.ts:243`; its three controls (catches the pre-fix fixture, does not flag the repaired fixture, the walk reaches 157 files) stay green.",
		source: 'REG-F-102 + S-4 of ROADMAP-decision-subject-scope'
	},
	{
		id: 'F105-mandatoriness-goes-back-to-the-skippers-payload',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find:
			"\t\t\t\tmandatory: step.strength !== 'ADVISORY',",
		replace:
			"\t\t\t\tmandatory: (p as { mandatory?: boolean }).mandatory ?? true,",
		expectRed: ['packages/rph-application/src/handlers/step-strength-authority.test.ts'],
		why: "THE REGRESSION MUTANT — the defect exactly as it shipped for the whole life of SkipExecutionStep, restored in one line. `p.mandatory ?? true` is fail-closed on ABSENCE and powerless against ASSERTION: the party §21.1 constrains supplied the fact deciding whether §21.1 applied to them, which Guide §8.4 L844 forbids in terms ('the producer cannot exempt its own output'). ⚠ THE PREDICTED RED IS THE **ACCEPT** CASE, NOT A REFUSAL, and that is what makes this mutant honest: under the mutation the three refusals (MANDATORY, CONDITIONAL, LEGACY) all still pass, because `?? true` refuses everything. Only 'ACCEPTS an unauthorized skip of a step the plan declares ADVISORY' can tell the two worlds apart — a repository that kept only the negative cases would grade this SURVIVED and read as enforced. The `as` cast is required because the payload field is GONE from the contract; that the mutant does not even compile without it is itself the guarantee.",
		source: 'REG-F-105, ruled REG-D-041; the pre-2026-08-10 handler line'
	},
	{
		id: 'F105-absent-and-conditional-strength-fall-open',
		file: 'packages/rph-application/src/handlers/execution.ts',
		find:
			"\t\t\t\tmandatory: step.strength !== 'ADVISORY',",
		replace:
			"\t\t\t\tmandatory: step.strength === 'MANDATORY',",
		expectRed: ['packages/rph-application/src/handlers/step-strength-authority.test.ts'],
		why: "THE NAIVE READ, and the likeliest future regression — it is what anyone adding this field would write first. Reading the enum positively ('is it MANDATORY?') instead of negatively ('is it anything but ADVISORY?') silently fails OPEN on the two values that carry no explicit MANDATORY: an ABSENT strength (every plan authored before 2026-08-10, including the seeded reference undertaking) and CONDITIONAL (which has no ratified applicability predicate to evaluate, so Guide §8.4 L844 fixes it at material). Distinct from the regression mutant above and deliberately so: that one flips the SOURCE of the fact, this one flips its DEFAULT, and a repository can hold either while failing the other. ⚠ ONE VICTIM NAMED, DELIBERATELY, AND THE LEDGER'S OWN CONTROL IS WHY. I first named two — this census AND `execution-step-skip-cancel.test.ts`, on the reasoning that duplicate coverage of the unauthored cases was 'the point'. `verif/mutant-ledger.test.ts` refused it: a longer victim list is a LOWER bar, because it passes if ANY named suite reddens. The DWP-02 suite does also carry the absent and CONDITIONAL cases and will also redden; that is coverage, not the assertion. The assertion is the suite whose reason for existing is this guard.",
		source: 'REG-F-105, ruled REG-D-041; DESIGN-step-strength-and-decision-subjects §2.3 items 3-4'
	},
	{
		id: 'F106-decisions-propose-stops-requiring-a-subject',
		file: 'apps/rph-demo/src/routes/decisions/+page.server.ts',
		find: "\t\tif (subjectObjectIds.length === 0)\n\t\t\treturn fail(400, {\n\t\t\t\terror:\n\t\t\t\t\t'A decision must name what it is about — an authorization is bound to exact subjects and versions (ASR-15). Select at least one subject.'\n\t\t\t});\n",
		replace: "",
		expectRed: ['apps/rph-demo/e2e/decisions.e2e.ts'],
		why: "THE DEFECT AS IT SHIPPED, minus one refusal. `/decisions` proposed every Decision with `subjectObjectIds: []` for the whole life of the route. `subjectObjectIds` is a REQUIRED field of DecisionObject in BOTH ratified contracts (CDM \u00a723.1 L1373; Contract Package \u00a722 L1632) for all nine decision types, and OBJ-1 (DOC-003 L105) forbids reading meaning into the empty case \u2014 'No semantic state may be inferred from null values, empty arrays, missing rows'. So the record was not a decision about nothing; per ASR-15 it was 'not authority \u2014 provenance at best', while the surface offered eight decision types as though it were. \u26a0 THE CLIENT-SIDE `required` ON THE PICKER DOES NOT COVER THIS, which is why the victim test posts to the action directly: a validation that only the browser performs is one a curl request walks past, and deleting this server guard leaves the page looking identical.",
		source: 'REG-F-106, ruled REG-D-041; the pre-2026-08-10 route'
	},
	{
		id: 'F106-approve-goes-back-to-an-empty-version-pin',
		file: 'apps/rph-demo/src/routes/decisions/+page.server.ts',
		find: "\t\tconst stored = getObject(getEngine(), id)?.subjectObjectIds;",
		replace: "\t\tconst stored = undefined;",
		expectRed: ['apps/rph-demo/e2e/decisions.e2e.ts'],
		why: "THE VACUITY, REPRODUCED EXACTLY. `approve` sent `subjectSemanticVersions: {}`; with `stored` forced to undefined the subject list is empty, the map stays empty, and the payload is `{}` again. `approveDecision` compares the stated versions against the pin taken at propose, so `{}` compares nothing against nothing and CANNOT refuse \u2014 the check was present, reachable, and incapable of failing. \u26a0 THE PREDICTED RED IS THE STALENESS CASE, AND IT ONLY EXISTS BECAUSE THE SUBJECT IS AN INTENT: measured while writing it, a PWU's semanticVersion is 1 FOREVER (only INTENT, DECOMPOSITION_CONTRACT and PWA bump), so the same test written against a PWU subject would stay green under this mutation and would have proved the pin works by choosing the one subject type that cannot move. Recorded as REG-F-109.",
		source: 'REG-F-106, ruled REG-D-041; ASR-15 (DOC-003 L307) \u2014 a decision approving version n never authorizes version n+1'
	},
	{
		id: 'F110-the-exemption-widens-to-skip-everything',
		file: 'verif/mutant-ledger.test.ts',
		find: "			if (m.id === appliedId) return [];",
		replace: "			if (appliedId !== undefined) return [];",
		expectRed: ['verif/mutant-ledger.test.ts'],
		why: "THE TEMPTING FIX, WHICH IS THE DEFECT. REG-F-110's symptom was four declared CONTROLS blocking the gate because the anchor census cannot pass while a mutation is applied. The one-line 'fix' is to skip the census whenever the runner is driving — exactly this mutation. It makes the gate GREEN and makes `F100-a-a-refactor-rewrites-an-anchored-line` UNKILLABLE, because a mechanical rewrite that detaches two OTHER mutants' anchors would no longer be seen. A control that cannot fail, produced by curing a control that always did. ⚠ SELF-REFERENTIAL AND SOUND: with this mutant applied the runner sets RPH_MUTANT_APPLIED to its own id, the widened predicate exempts EVERY row, the census passes VACUOUSLY — and the narrowness control is the one thing that reddens. Predicted red: 'CONTROL — exempting the applied mutant exempts THAT ONE ONLY', alone.",
		source: 'REG-F-110'
	},
	{
		id: 'F108-the-cold-start-guard-stops-guarding',
		file: 'apps/rph-demo/src/routes/decisions/+page.svelte',
		find: "	{#if !data.subjects.length}",
		replace: "	{#if false}",
		expectRed: ['apps/rph-demo/e2e/decisions.e2e.ts'],
		why: "THE GUARD THIS ENTRY EXISTS TO GIVE A READER. `/decisions` declines to render the propose form when the subject catalog is empty; without it a cold-start workbench shows an EMPTY PICKER beside a live Propose button, the form posts, the action refuses, and the professional learns that the surface offers acts it cannot perform — REG-F-106 in miniature. ⚠ THIS MUTANT WAS UNDECLARABLE UNTIL THE `bare` RESET MODE EXISTED (REG-F-108). Neither demo seed could reach the branch: `empty` still seeds the policy library, and an ASSURANCE_POLICY is a governed object and therefore a selectable subject. A mutant over a branch no test can enter reports SURVIVED and reads as an unguarded hole; declaring it before the reader existed would have been recording a defect I had manufactured. The victim also carries the CONTROL that the picker IS offered on a populated workbench, so a mutation that simply deleted the picker cannot pass either.",
		source: 'REG-F-108'
	},
	{
		id: 'B1-the-signoff-forecloses-nothing',
		file: 'apps/rph-demo/src/lib/server/assurance/demo-policy.ts',
		find: "			forbiddenOpenSeverities: [...DEMO_FORBIDDEN_OPEN_SEVERITIES]",
		replace: "			forbiddenOpenSeverities: []",
		expectRed: ['apps/rph-demo/src/lib/server/assurance/blocking-finding-forecloses-signoff.test.ts'],
		why: "THE STATE THIS SURFACE SHIPPED IN UNTIL 2026-08-10, and the reason S-1b could not simply add a reject button. DOC-004 §10.3's foreclosure IS implemented and IS reachable — GATE C, `rejectForeclosedDisposition` — but it reads the POLICY's own rule and returns null the moment the policy has nothing to say (`if (forbidden.size === 0) return null`). `dispositionRules` is `.optional()` on CreateAssurancePolicyPayload and the demo policy declared none, so an operator could record a BLOCKING finding and sign the work off SATISFIED in the same breath. ⚠ AN OPTIONAL POLICY FIELD THAT DEFAULTS TO 'NO CONSTRAINT' IS A GATE SWITCHED OFF BY SILENCE — nothing is missing, nothing is broken, and nothing fires. Measured before committing by deleting the rule: EXACTLY ONE test reddens (the foreclosure), and all three controls stay green — including the ADVISORY control, which is what proves the gate is severity-sensitive rather than refusing every observation.",
		supersededBy: 'D042-the-signoff-floor-becomes-opt-in-again',
		source:
			'S-1b / DESIGN-blocking-finding-capability §2 — SUPERSEDED 2026-08-10: emptying this policy\'s declaration no longer weakens anything, because the floor is unioned in at the gate. A mutant whose edit the system now ignores is not a weaker mutant, it is a mutant measuring nothing.'
	},
	{
		id: 'B2-the-finding-is-recorded-as-advisory',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts',
		find: "					severity: 'BLOCKING',",
		replace: "					severity: 'ADVISORY',",
		expectRed: ['apps/rph-demo/e2e/pwu-rejection.e2e.ts'],
		why: "THE ADVERSE ARM STOPS BEING ADVERSE. `hasBlockingObservationFor` reads severity OFF THE STORED OBSERVATION, never off RejectPwu's payload — so downgrading what the assurance act records makes rejection unreachable again while every screen still looks right: a finding is listed, the statement is there, and the act it exists to license silently disappears. ⚠ THE VICTIM IS AN E2E BY NECESSITY, not by preference: the guarantee spans an ASSURANCE act and a later GOVERNANCE act in two separate transactions, and any unit test that drove both would have to construct the observation itself — which is the manufactured-evidence shortcut this whole increment refuses. Observed before declaring: reddens BOTH specs in the victim file (the chain, and the subject-scope control), because the affordance predicate reads the same severity the engine does.",
		source: 'S-1b / B-2, DESIGN-blocking-finding-capability §3.2'
	},
	{
		id: 'B3-rejection-stops-checking-the-subject',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.svelte',
		find: "o.subjectObjectIds.includes(p.id)",
		replace: "o.subjectObjectIds.length >= 0",
		expectRed: ['apps/rph-demo/e2e/pwu-rejection.e2e.ts'],
		why: "THE AFFORDANCE STOPS ASKING WHAT THE FINDING IS ABOUT. Offered on every PWU the moment ANY blocking finding exists anywhere in the undertaking — so a professional is invited to reject work nobody faulted, and the engine's refusal (`hasBlockingObservationFor` checks subjectObjectIds) becomes a dead end reached by clicking a button the surface offered. ⚠ THE HAPPY PATH STAYS GREEN UNDER THIS MUTATION, which is exactly why the subject-scope CONTROL exists: it stands up two PWUs, faults one, and asserts the other offers nothing. A repository with only the chain test would grade this SURVIVED. The predicate is deliberately the SAME question the engine asks of the same field, so affordance and gate cannot drift apart.",
		source: 'S-1b / B-3'
	},
	{
		id: 'D042-the-signoff-floor-becomes-opt-in-again',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		find: "	const floor = POSITIVE_DISPOSITIONS.has(disposition) ? BLOCKING_SEVERITIES : new Set<string>();",
		replace: "	const floor = new Set<string>();",
		expectRed: ['apps/rph-demo/src/lib/server/assurance/blocking-finding-forecloses-signoff.test.ts'],
		why: "THE DE MINIMIS ASSURANCE FLOOR BECOMES AN OPT-IN AGAIN — the state this repository shipped in until 2026-08-10, and the one JPWB-DOC-001 forbids in terms: 'core correctness and the de minimis assurance floor are not enterprise features'. With the floor removed, a policy that declares no `dispositionRules` gets NO §10.3 foreclosure, so a CRITICAL or BLOCKING finding can stand open while the assessment completes SATISFIED. REG-F-111 fixed one policy by declaring the rule on it; this line is what fixes the CLASS, and this mutant is what holds the class. ⚠ IT ALSO RE-OPENS A DISCLOSED ENFORCEMENT GAP: RPH-ASR-008's completion site was UNENFORCED_DISCLOSED until this landed, and `disclosure-observed.test.ts` is a SECOND, independent reader that would notice — the victim named here is the one whose assertions are ABOUT the floor. Supersedes `B1-the-signoff-forecloses-nothing`, whose edit the system now ignores.",
		source: 'REG-D-042 / DESIGN-tier-tailoring-is-a-ratchet T-1'
	},
	{
		id: 'F113-prose-about-a-status-counts-as-a-status',
		file: 'verif/register-status.test.ts',
		find: "			.map((l) => l.replace(/`[^`]*`/g, ''))",
		replace: "			.map((l) => l)",
		expectRed: ['verif/register-status.test.ts'],
		why: "THE FALSE POSITIVE THAT WOULD GET THE GATE LOOSENED. Without the code-span strip, any entry that DESCRIBES the status convention — quoting the marker inside backticks — is counted as carrying extra live statuses and is reported as an offender. REG-F-113 is exactly such an entry, so the gate's first act was to reject the entry announcing it. ⚠ THE DANGER IS THE OBVIOUS REPAIR, NOT THE FAILURE: faced with a false positive on a correct entry, the tempting fix is to relax the rule (ignore lines containing backticks, or drop the exactly-one requirement), and either would let a genuinely statusless entry through forever. Prose about a status is not a status, and stripping code spans is the narrowest rule that separates them — narrower than ignoring backticked lines, because a real status line may cite a rule id in code. Predicted red: the offender limb names REG-F-113 itself.",
		source: 'REG-F-113'
	},
	{
		id: 'F114-the-declared-source-set-stops-being-checked',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "if (!declared.ok) return reject(command, 'RPH_ILLEGAL_STATE_TRANSITION', declared.reason!);",
		replace: "",
		expectRed: ['packages/rph-application/src/handlers/pwu-undeclared-arrow.test.ts'],
		why: "THE DECLARATION BECOMES A COMMENT. With this line gone the spec still exists, the census still reads it, and the table still agrees with the machine — but nothing CHECKS it at dispatch, so a command performs any arrow the machine allows regardless of what it claims. ⚠ THIS MUTANT WAS UNKILLABLE WHEN I FIRST WENT TO DECLARE IT, and that is why its victim file exists. No real spec is narrower than its machine, so no command can be driven from a state it fails to claim while the machine permits it; and the refusal reuses RPH_ILLEGAL_STATE_TRANSITION — exactly what canAdvanceWorkLifecycle returns — while NO test in the repository asserted the MESSAGE. A guard whose removal is invisible: the shape this programme keeps finding, arriving inside the fix for it. What makes it observable is the ORDER, chosen for a different reason: the declared-set check runs FIRST, so a machine-forbidden state now reports 'UNDECLARED ARROW' where it used to report 'Cannot advance PWU'. Same code, different sentence — and the sentence is the assertion.",
		source: 'REG-F-114 / A-5'
	},
	{
		id: 'F114-a-spec-quietly-drops-an-arrow',
		file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
		find: "sourceStates: ['SHAPING', 'PLANNED', 'EXECUTING']",
		replace: "sourceStates: ['SHAPING', 'EXECUTING']",
		expectRed: ['verif/lifecycle-arrow-declarations.test.ts'],
		why: "THE DRIFT GUARD, KILLED BY MUTATING WHAT IT GUARDS RATHER THAN THE GUARD ITSELF. `BlockPwu` claims SHAPING, PLANNED and EXECUTING because the machine declares all three in-edges to BLOCKED; dropping PLANNED leaves a ratified arrow no command claims, and the agreement gate's 'every command-owned arrow is claimed by its spec' limb reports `PLANNED->BLOCKED`. That limb is the entire present value of the table — the specs narrow nothing today, so all they buy is that a machine in-edge cannot go unimplemented in silence. ⚠ IT REPLACES A MUTANT THAT SURVIVED, AND THE SURVIVAL WAS THE FINDING: `F114-a-machine-arrow-goes-unclaimed-quietly` deleted the gate's OWN assertion, so the only test that could have objected was the one being disabled. A mutation of an assertion is unkillable by that assertion — measured, not reasoned: it reported SURVIVED with all 7 cases green. To hold a guard, mutate the thing it guards.",
		source: 'REG-F-114 / A-5 — replaces F114-a-machine-arrow-goes-unclaimed-quietly, which SURVIVED'
	},
	// ── REG-F-116, THE RUNNER'S OWN ATTRIBUTION ─────────────────────────────────────────────────────────────────
	//
	// Every verdict in `run.ts` is inferred from ONE bit — the exit status — and V-4a proved that bit can be
	// non-zero for a reason that never touched the mutation. `timeoutEvidence` is what separates "measured and bad"
	// from "not measured". It is the first logic in this harness to be under test at all: `run.ts` exports nothing
	// and 700 lines of gate logic have never had a single assertion made about them, which is why the predicate was
	// extracted rather than inlined.
	{
		id: 'F116-a-hung-arrangement-is-graded-as-a-kill',
		file: 'scripts/mutants/measured.ts',
		find: '\t/^[ \\t]*Error: (?:Test|Hook) timed out in \\d+ms/m,',
		replace: '\t/^[ \\t]*Error: Test timed out in \\d+ms/m,',
		expectRed: ['verif/mutant-verdict.test.ts'],
		why: "A SLOW ARRANGEMENT STOPS COUNTING AS A NON-MEASUREMENT. Vitest words a hung `beforeEach` differently from a hung assertion — `Error: Hook timed out in 10000ms` — and a fixture that never completed measures the mutation exactly as little as a body that never completed. With `Hook` dropped, a mutant whose victim hangs in setup is graded KILLED and the guard is recorded as proven by a test that never reached its first assertion. Predicted red: the HOOK case alone; the vitest, Playwright and all three CONTROL cases stay green.",
		source: 'REG-F-116 / JAN-VERIF V-4b'
	},
	{
		id: 'F116-the-e2e-runner-loses-its-timeout-marker',
		file: 'scripts/mutants/measured.ts',
		find: '\t/^[ \\t]*Test timeout of \\d+ms exceeded/m',
		replace: '\t/^[ \\t]*Test timeout of \\d+ms elapsed/m',
		expectRed: ['verif/mutant-verdict.test.ts'],
		why: "THE OTHER RUNNER GOES BLIND. `run.ts` reaches `apps/` through Playwright, which reports timeouts in words vitest never uses; a marker list that covers only vitest leaves every e2e victim's timeout graded as a verdict. ⚠ THIS IS THE HALF MOST LIKELY TO ROT SILENTLY, because the e2e path is the rarer one and a stale marker fails OPEN — it produces confident KILLED rows, not errors. The same shape S-3 recorded when an unmatched vitest filter produced `KILLED` from the file-matcher rather than from any guard. Predicted red: the Playwright case alone.",
		source: 'REG-F-116 / JAN-VERIF V-4b'
	},
	{
		id: 'F116-the-instrument-reads-its-subjects-data-as-its-own-signal',
		file: 'scripts/mutants/measured.ts',
		find:
			'\t/^[ \\t]*Error: (?:Test|Hook) timed out in \\d+ms/m,\n\t/^[ \\t]*Test timeout of \\d+ms exceeded/m',
		replace: '\t/(?:Test|Hook) timed out in \\d+ms/,\n\t/Test timeout of \\d+ms exceeded/',
		expectRed: ['verif/mutant-verdict.test.ts'],
		why: "THE DEFECT AS IT ACTUALLY SHIPPED, RESTORED — this is not a hypothetical mutation, it is the first version of this file. `run.ts` scans the CHILD'S stdout, so a test that ASSERTS on timeout text prints that text into stdout the moment it fails: vitest renders the expected value on a line of its own, in quotes, `\"Hook timed out in 10000ms\"`. Un-anchored, the check reads the FIXTURE OF THE FAILING TEST as a diagnostic from the runner and reports INCONCLUSIVE for a mutant its victim killed cleanly. ⚠ MEASURED, NOT FEARED: the first run of the two mutants above both reported INCONCLUSIVE for exactly this reason, and the only reason a third did not is that `run.ts` holds the unmutated function in memory while the child holds the mutated one. Third sighting of one shape — REG-F-110 (the census could not run under the runner that mutates anchors), REG-F-113 (prose ABOUT a status counted as a status), this. Predicted red: the fixture-quoting CONTROL, plus the two vitest cases that assert the `Error: ` prefix.",
		source: 'REG-F-116 / feedback: a control needs its own mutant'
	},
	{
		id: 'F116-the-timeout-check-widens-and-nothing-is-ever-measured',
		file: 'scripts/mutants/measured.ts',
		find: '\t/^[ \\t]*Test timeout of \\d+ms exceeded/m\n];',
		replace: '\t/^[ \\t]*Test timeout of \\d+ms exceeded/m,\n\t/timed out/\n];',
		expectRed: ['verif/mutant-verdict.test.ts'],
		why: "THE OTHER CONTROL'S OWN MUTANT, and it is the failure mode a REPAIR would introduce. Faced with a timeout the markers missed, the obvious fix is to add a loose fallback — and a loose fallback reads the WORDS IN A TEST TITLE as evidence of a timeout, so every genuine failure in a suite named after timeouts is reported INCONCLUSIVE. A gate that answers 'not measured' to everything blocks forever while proving nothing, which is strictly worse than the false KILL it was widened to prevent. ⚠ THE FIXTURE IS THE V-4a REPAIR'S OWN TEST TITLE, deliberately: the tests most likely to carry those words are the ones written to stop timeouts. Predicted red: both CONTROL cases; the three positive cases stay green because the added marker is last and the specific ones still win.",
		source: 'REG-F-116 / feedback: a control needs its own mutant'
	},
	// ── REG-F-117, THE INTENT ARROWS ────────────────────────────────────────────────────────────────────────────
	//
	// REG-F-114 recorded `advanceIntent` as "an identical second slice" of the PWU work. It is not: all five sites
	// ALREADY declared their source set (`precondition: fromStates(...)`, required by the type since JAN-CMDPRE
	// DWP-06) and it was ALREADY enforced before `checkTransition`. Only the machine attribution was missing,
	// because the primitive closed over a module constant instead of being told. These three hold the two halves
	// that are now load-bearing — the census reading the sites, and the sites declaring truthfully.
	{
		id: 'F117-the-census-stops-reading-advanceIntent',
		file: 'verif/arrow-command-census.ts',
		find: "const ADVANCE_PRIMITIVES: ReadonlySet<string> = new Set(['advanceStatus', 'advanceIntent']);",
		replace: "const ADVANCE_PRIMITIVES: ReadonlySet<string> = new Set(['advanceStatus']);",
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "THE READER GOES BACK TO ONE PRIMITIVE AND SIX ARROWS VANISH. This is the exact state the repository was in before REG-F-117: `Intent.intentStatus` invisible to the census, not because the commands failed to declare their arrows but because the reader only knew one primitive's name. ⚠ IT MUST BE KILLED BY THE COVERAGE PIN AND NOT BY A COUNT SOMEWHERE ELSE — the pin exists to make any movement in either direction loud, and this is the direction that LOOKS like nothing happened: coverage silently drops and every conclusion drawn from the census becomes wrong by six arrows. Predicted red: `declarationRows` 174 -> 168 and `machinesSeen` 16 -> 15 on the PINNED test, and `Intent.intentStatus` returning to the census-blind set. ⚠ THIS CITATION HAS NOW MOVED THREE TIMES AND WAS RE-MEASURED EACH TIME, NEVER ARITHMETIC-SHIFTED: `arrowsSeen` 170 -> 164 until REG-F-119 added 8 rows; `declarationRows` 178 -> 172 after REG-F-121 renamed the field (the old name counted ROWS while its percentage claimed ARROWS); 174 -> 168 after REG-F-124 stopped the census manufacturing 4 arrows. The delta stays 6 because this mutant removes a PRIMITIVE and REG-F-124 removed a FABRICATION — unrelated populations — but that is a fact to be measured, not assumed, which is why the number was re-derived rather than adjusted.",
		source: 'REG-F-117'
	},
	{
		id: 'F117-a-site-declares-a-machine-it-does-not-drive',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find: "\t\tmachine: MACHINE,\n\t\ttarget: 'UNDER_DISCOVERY',",
		replace: "\t\tmachine: 'PWU.workLifecycleState',\n\t\ttarget: 'UNDER_DISCOVERY',",
		expectRed: ['packages/rph-application/src/handlers/intent.test.ts'],
		why: "THE DECLARATION IS LOAD-BEARING, AND THIS IS WHAT PROVES IT RATHER THAN ASSERTING IT. `machine` was added so the census could attribute an arrow — a field added for a reader is exactly how a hollow is born, and all five sites pass the same constant, so replacing `args.machine` with the module constant inside the primitive would change nothing any test could see. What makes it real is that `checkTransition` READS it: declaring a machine this command does not drive validates an Intent arrow against the PWU state machine, which has no RAW state, so the command is refused. ⚠ MEASURED BEFORE BEING DECLARED — applied by hand, 4 of 6 tests in the victim redden. Predicted red: `intent.test.ts` alone; the census still sees six arrows because the SITE still declares six.",
		source: 'REG-F-117'
	},
	{
		id: 'F117-the-only-multi-source-site-loses-an-arrow',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find: "\t\tprecondition: fromStates('FORMALIZED', 'REVISED'),",
		replace: "\t\tprecondition: fromStates('FORMALIZED'),",
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "THE CENSUS READS THE SOURCE SET, NOT THE SITE COUNT — and `ApproveIntent` is the only site that can tell the difference, because it is the only one declaring TWO sources. Five sites yielding six arrows is the whole claim; a reader that counted sites would report five and be indistinguishable from a correct one on every other command. Dropping REVISED also removes the ratified re-approval cycle (REVISED -> APPROVED), which the handler's own docstring says it exists to keep. ⚠ ITS `why` IS ALSO A RECORD OF A DELIBERATE WIDENING: that precondition is authored from the MACHINE and is deliberately wider than the vocab's `drivesFrom` (FORMALIZED only, DS-001 D4) — so this mutant would silently restore the vocab's narrower claim, which is the disagreement the site was written to resolve. Predicted red: `declarationRows` 174 -> 173 on the PINNED test (was `arrowsSeen` 170 -> 169, then 178 -> 177; re-measured at REG-F-124, not shifted — see the sibling entry).",
		source: 'REG-F-117'
	},
	{
		id: 'F117-a-replayed-revision-can-void-an-approval',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find: "\t\tprecondition: fromStates('APPROVED'),",
		replace: "\t\tprecondition: fromStates('APPROVED', 'REVISED'),",
		expectRed: ['packages/rph-application/src/handlers/command-reissue-guard.test.ts'],
		why: "THE FIFTH `advanceIntent` SITE, WHICH HAD NO MUTANT — found while checking whether DWP-03's claim to cover \"each\" site was true. It covers four; `ReviseIntent` is held elsewhere, by JAN-NOOP-01's `semanticVersion inflation cannot void an approval`. ⚠ AND THE OBVIOUS REASON TO SKIP THIS MUTANT IS FALSE, WHICH IS WHY IT EXISTS: the refusal code is `RPH_ILLEGAL_STATE_TRANSITION`, the same code `checkTransition` returns, so the precondition looks redundant — the machine has no `REVISED -> REVISED` arrow and would surely refuse anyway. **Measured: it does NOT.** With this widening the re-issue is ACCEPTED, because a self-transition is ABSORBED rather than refused — exactly the \"absorbed as a NOOP yet still bumped semanticVersion\" behaviour the handler's own comment records. Since `ApproveIntent` requires `approvedSemanticVersion === current`, that replayed no-op silently VOIDS an outstanding approval. The precondition is the only thing standing between those two facts. Predicted red: 1 test in the named victim, measured before declaring.",
		source: 'REG-F-117 / JAN-CMDPRE DWP-03 residue'
	},
	// ── REG-F-118, THE TWO GROUNDS FOR A DEADNESS CLAIM ─────────────────────────────────────────────────────────
	//
	// A dead arrow invites deleting code, so the census may only assert one on evidence that carries it. Two
	// independent grounds now do: the SOUND one (no ratified in-arrow and no birth) needs no coverage at all, and
	// the WEAK one (occupancy) is gated on complete coverage. Each needs its own mutant, because either could be
	// removed while the other kept the summary looking plausible.
	{
		id: 'F118-the-sound-deadness-ground-stops-proving-anything',
		file: 'verif/arrow-command-census.ts',
		find: '\t\tconst unreachable = (def?.states ?? []).filter((s) => !hasInArrow.has(s) && !born.has(s));',
		replace: '\t\tconst unreachable = (def?.states ?? []).filter((s) => hasInArrow.has(s) && born.has(s));',
		expectRed: ['verif/trigger-claim-truth.test.ts'],
		why: "THE GROUND THAT SURVIVES PARTIAL COVERAGE STOPS FINDING ANYTHING, and REG-F-088 and REG-F-089 go quiet. Inverting the predicate makes `provablyUnoccupiable` report states that DO have an in-arrow and ARE born — the opposite population, which is empty of anything interesting. ⚠ THE POINT IS WHAT IT DOES **NOT** BREAK: the occupancy ground is untouched, so the summary still reports a plausible census and only the three ratified-trigger rows vanish. Those three are the whole of C-0d's PINNED DEFECT set and the only deadness claims in the repository that partial coverage cannot dismiss. Predicted red: C-0d's `ratified arrows whose command cannot reach the source state`, whose expectations were never edited when the completeness rule landed — which is why they are the right victim.",
		source: 'REG-F-118'
	},
	{
		id: 'F118-completeness-stops-gating-the-occupancy-ground',
		file: 'verif/arrow-command-census.ts',
		find: '\t\tif (!complete.has(a.machine)) continue;\n\t\tif (!set.has(a.from)) dead.push(arrowKey(a.machine, a.from, a.to));',
		replace: '\t\tif (!set.has(a.from)) dead.push(arrowKey(a.machine, a.from, a.to));',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "THE STATE THE REPOSITORY WAS IN UNTIL REG-F-118, RESTORED. Without the gate, `occupiable()` — which grows along DECLARED arrows and therefore UNDER-estimates — is read as unreachability on machines whose arrows are only partly declared, and the census goes from 2 provable dead arrows to 37. Thirty-five of those are false, including the whole PWU spine READY -> PLANNED -> EXECUTING -> ... , states the workbench occupies every day. ⚠ THIS IS THE FAIL-OPEN DIRECTION AND IT LOOKS LIKE A RICHER RESULT: more findings, all confidently worded, each inviting someone to delete a ratified arrow. Predicted red: C-0's `lists every COVERED arrow whose source state can never be occupied`.",
		source: 'REG-F-118'
	},
	{
		id: 'F118-a-creation-stops-declaring-its-birth',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find:
			"\t\tbirths: [{ machine: 'Intent.intentStatus', statusField: 'intentStatus', values: ['RAW'] }]\n\t});",
		replace: '\t});',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "THE RATCHET'S POSITIVE CASE, which had no mutant until the one I wrote first SURVIVED and taught me what to hold instead. A `commitState` site that CREATES (`expectedRevision: undefined`) and declares no `births` must FAIL the census, not be skipped — because a machine that never appears is `unanalysed`, which reads as *\"not yet reached\"* rather than *\"nobody said\"*, and those are opposite claims. Removing this declaration reproduces exactly the state `Intent.intentStatus` was in before REG-F-086. ⚠ IT REPLACES `F118-the-birth-ratchets-exemption-stops-being-structural`, WHICH SURVIVED AND WAS RIGHT TO: I had added a structural exemption so `createObject`'s own delegating call would not trip the ratchet, but `handlerFiles()` has excluded `kit.ts` since long before any of this, so the census never walks that site. **The exemption guarded a case that cannot arise — a hollow, authored inside the fix for a census — and only its mutant said so.** Predicted red: C-0's suite, which cannot build a birth map at all.",
		source: 'REG-F-118 — replaces F118-the-birth-ratchets-exemption-stops-being-structural, which SURVIVED'
	},
	// ── REG-F-119, THE GENERIC SETTER'S SPINE ───────────────────────────────────────────────────────────────────
	//
	// Three properties, three mutants, because each fails differently: the census must READ the table, the table
	// must AGREE with the machine, and the accountability gate must stay FALSIFIABLE now that two tables between
	// them claim all 57 arrows.
	{
		id: 'F119-the-census-stops-reading-the-setter-table',
		file: 'verif/arrow-command-census.ts',
		find: '\tfor (const spec of Object.values(PWU_GENERIC_SETTER_SPECS)) {',
		// ⚠ REFORMULATED IN ITS OWN COMMIT (ledger rule #5). The first spelling was `Object.values({})`, which
		// reported NO_COMPILE — `{}` widens `spec` to `unknown`, so the mutation was measuring tsc rather than the
		// guard. `.slice(0, 0)` keeps the type and empties the population, which is also the more realistic drift:
		// a reader that silently narrows its own input is the defect this census exists to catch.
		replace: '\tfor (const spec of Object.values(PWU_GENERIC_SETTER_SPECS).slice(0, 0)) {',
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "THE SPINE GOES BACK TO BEING INVISIBLE. This is the exact state the repository was in before REG-F-119: forty-nine PERIPHERAL arrows visible (abandon, supersede, block, challenge) and the eight the workbench actually drives — READY -> PLANNED -> EXECUTING -> ... -> RECOMPOSED — read by nothing, because `ChangePwuState` takes its target from `payload.newState` at runtime and its call site declares nothing. ⚠ THE DANGEROUS PART IS WHAT STAYS GREEN: the machine simply drops back to 49/57, which is no longer COMPLETE, so under REG-F-118 it silently stops being occupancy-analysable and every unreachability question about it becomes unanswerable again — quietly, with no test naming that as the loss. Predicted red: `arrowsSeen` 178 -> 170 on the coverage pin.",
		source: 'REG-F-119'
	},
	{
		id: 'F119-a-transcribed-source-drifts-from-the-machine',
		file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
		find: "\tEXECUTING: {\n\t\tcommandType: 'ChangePwuState',\n\t\ttarget: 'EXECUTING',\n\t\teventType: 'PwuStateChanged',\n\t\tsourceStates: ['PLANNED']",
		replace: "\tEXECUTING: {\n\t\tcommandType: 'ChangePwuState',\n\t\ttarget: 'EXECUTING',\n\t\teventType: 'PwuStateChanged',\n\t\tsourceStates: ['READY']",
		expectRed: ['verif/lifecycle-arrow-declarations.test.ts'],
		why: "THE WHOLE RISK OF TRANSCRIBING RATHER THAN DERIVING, AND THE REASON THE AGREEMENT GATE HAD TO BE EXTENDED IN THE SAME COMMIT. A hand-written `sourceStates` can simply be WRONG — here `EXECUTING` is declared reachable from `READY`, which the machine does not ratify (its only in-edge is `PLANNED`). Before REG-F-119 extended `claimedArrows()` to span both tables, this drift would have been READ BY THE CENSUS and AUDITED BY NOTHING: the census would report `READY -> EXECUTING` as a covered arrow the machine never declared, which is fabricated coverage — the precise failure REG-F-114 forbade, arriving through a declaration instead of an inference. Predicted red: BOTH A-2 directions — the spec claims an arrow the machine does not declare, AND the real `PLANNED -> EXECUTING` becomes unclaimed.",
		source: 'REG-F-119'
	},
	{
		id: 'F119-the-accountability-gate-is-handed-a-derived-set',
		file: 'verif/lifecycle-arrow-declarations.test.ts',
		find: '\tObject.values(PWU_GENERIC_SETTER_SPECS).map((s) => s.target)\n);',
		replace:
			"\tObject.keys(STATE_MACHINES['PWU.workLifecycleState']?.states ?? {}).length >= 0\n\t\t? (STATE_MACHINES['PWU.workLifecycleState']?.states ?? []).filter(\n\t\t\t\t(s) => !COMMAND_TARGETS_FOR_CONTROL.has(s)\n\t\t\t)\n\t\t: []\n);",
		expectNoCompile:
			'DERIVING THE SETTER TARGETS CANNOT EVEN BE WRITTEN HERE without inventing a second owned-set constant, because `COMMAND_TARGETS` is declared BELOW this point. The mutation names `COMMAND_TARGETS_FOR_CONTROL`, which does not exist, so it fails to compile.',
		why: "THE GUARANTEE IS THE ONE REG-F-119 EXISTS FOR: if the two target sets were computed as COMPLEMENTS of each other, `COMMAND_TARGETS ∪ GENERIC_TARGETS` would cover all twenty states BY CONSTRUCTION and the accountability test — *\"no arrow is unaccounted for\"* — could never fail. A control that cannot fail, authored inside the increment meant to strengthen it, which is this repository's most-repeated defect. ⚠ RECORDED HONESTLY AS THE WEAKER FENCE IT IS: a declaration-order accident is what makes the derived form awkward to write, not a rule anyone stated, and TYPE_PREVENTED here means 'this particular spelling does not compile' rather than 'the mistake is unreachable'. Someone who wanted the derived form could hoist a constant and get it. The real defence is the transcription itself plus the both-directions agreement gate; this row exists so that the day the derived form DOES compile, the ledger reports the change rather than absorbing it.",
		expectRed: [],
		source: 'REG-F-119'
	},
	// ── REG-F-120, FROM AN AUDIT OF THIS SESSION'S OWN COMMITS ──────────────────────────────────────────────────
	//
	// ⚠ ONLY ONE OF THE TWO FIXES GETS A MUTANT, AND THE OTHER'S ABSENCE IS THE RECORD.
	//
	// The leaked-report fix (`rmSync` before the spawn in `run.ts`) guards a condition NO CURRENT TEST CAN REACH:
	// it needs a control that PASSES — leaving `.control-run.json` behind — followed by one that exits non-zero
	// without writing a report. Today no control passes, because one suite is red, so every control takes the
	// differencing path and `failedFiles` deletes the report on the way through. **A mutant for it would report
	// SURVIVED and be RIGHT to.** Declaring one anyway would either block the gate on a false finding or teach
	// someone to weaken the mutant until it passed.
	//
	// This repository has the precedent and states it in `run.ts`: the atomicity guard "shipped with no ledger
	// entry and a comment saying so", because a fake measurement is worse than a declared absence. Same here —
	// the guard is commented at its site with its trigger condition, and the register entry says it is unguarded.
	// ⚠ ~~IT BECOMES KILLABLE THE DAY THE SUITE GOES GREEN, which is also the day it becomes NECESSARY. Whoever
	// fixes that suite should add the mutant in the same commit.~~
	//
	// ⚠⚠ CORRECTED 2026-08-17 (REG-F-195): THAT DAY CAME — the CSAA suite went green at `0018a34b` — AND THE
	// MUTANT IS STILL NOT DECLARABLE, for a second reason this note did not anticipate. The green was NECESSARY
	// AND NOT SUFFICIENT. `run.ts` has ZERO exports, executes on import, and is imported by nothing: a walk over
	// every .ts/.tsx/.svelte/.js/.mjs outside node_modules|dist|.svelte-kit|.turbo|coverage finds 0 importers,
	// while the same walk finds `verdict.js` and `measured.js` imported from `verif/`, so the search reaches.
	// The parent runner holds the UNMUTATED module in memory and no spawned child loads it, so a mutation here
	// is a no-op for every process the harness starts — the entry would report SURVIVED and be RIGHT to, which
	// is the outcome this note exists to refuse. `verif/control-verdict.test.ts:3-7` states the general form:
	// "the mutation ledger cannot mutate what nothing observes."
	//
	// THE BLOCKER IS AN OBSERVER, NOT A GREEN SUITE. The remedy is REG-F-165's move performed a second time:
	// lift the freshness DECISION ("is this report the one THIS run produced?") out of `run.ts` into an exported
	// pure predicate in `verdict.ts`, consumed by `controlVerdict`, its arms asserted in
	// `verif/control-verdict.test.ts` beside the existing undefined / [] / populated cases. The `rmSync` stays
	// where it is — it is the EFFECT; what must become checkable is the decision it protects. Only then declare
	// the mutant, re-deriving its `find` byte-exact from `verdict.ts` at that commit.
	{
		id: 'F120-the-playwright-anchor-is-deleted-as-redundant',
		file: 'scripts/mutants/measured.ts',
		find: '\t/^[ \\t]*Test timeout of \\d+ms exceeded/m',
		replace: '\t/Test timeout of \\d+ms exceeded/',
		expectRed: ['verif/mutant-verdict.test.ts'],
		why: "THE DELETION A READER IS ACTIVELY INVITED TO MAKE, AND WHICH WAS UNGUARDED FOR AS LONG AS THE ANCHOR EXISTED. The two vitest markers carry a `Error: ` prefix AND a line anchor, and the prefix does the separating on its own — measured: drop `^[ \\t]*` from them and all cases stay green. So the anchor LOOKS redundant, and REG-F-116's own summary said as much (\"the runner's own prefix does\"). ⚠ THE PLAYWRIGHT MARKER HAS NO PREFIX. Its anchor is its entire defence against a quoted fixture, and every poisoning fixture written for REG-F-116 was vitest-shaped, so dropping THIS anchor was green too — the e2e half of the self-poisoning hole could have been re-opened by someone acting correctly on the vitest evidence. Measured before declaring: with the quoted-Playwright fixture added, this mutation reddens that control ALONE (1 failed / 7 passed).",
		source: 'REG-F-120 — from the 43-agent audit of this session'
	},
	{
		id: 'F122-the-census-resumes-inferring-the-from-half',
		file: 'verif/arrow-command-census.ts',
		find: "\t\tfind(pp.initializer);\n\t\tif (call === undefined)\n\t\t\treturn fail(\n\t\t\t\tsite,\n\t\t\t\t'declares a precondition with no readable `fromStates(…)`. The census does NOT infer a from-half ' +\n\t\t\t\t\t'from STATE_MACHINES (REG-F-114) — if this command is genuinely un-narrowed by source state, ' +\n\t\t\t\t\t'that is a new idiom to be taught deliberately, with its own ruling, not defaulted into'\n\t\t\t);",
		replace:
			'\t\tfind(pp.initializer);\n\t\tif (call === undefined) {\n\t\t\tfor (const to of targets)\n\t\t\t\tfor (const f of STATE_MACHINES[machine]!.transitions.filter((t) => t.to === to).map((t) => t.from))\n\t\t\t\t\tarrows.push({ machine, from: f, to, site });\n\t\t\treturn;\n\t\t}',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "THE RESURRECTION, VERBATIM. This is the expression REG-F-122 deleted — the census's own REG-F-114 violation: with no readable `fromStates`, the from-half is taken from the MACHINE'S in-edges, and a fabricated arrow enters the census indistinguishable from a declared one. Measured while it was live: exactly ONE of 46 sites ever reached it (`governance.ts:293`), and its fabrication coincided with the callers' real declaration only because `Decision.status` has a single in-arrow to EFFECTIVE — luck, not soundness. ⚠ THE VICTIM IS A SYNTHETIC FIXTURE BY NECESSITY, AND THE REPO-WIDE PINS CANNOT KILL THIS MUTANT: after REG-F-122 every real site declares a readable `fromStates`, so against the live tree this fallback is DEAD CODE and the coverage pins stay bit-identical under the mutation. The predicate-only fixture in the victim is the entire population of the failing arm — which is why `declaredArrowsInFile` is exported as a seam. Predicted red: 'refuses a precondition with no readable fromStates' alone; the two uninspectable-name refusals and the reading CONTROL all stay green.",
		source: 'REG-F-122'
	},
	{
		id: 'F124-the-factory-parameters-are-crossed-again',
		file: 'verif/arrow-command-census.ts',
		find:
			'\t\t\tfor (const { targets: perCallTargets, sources: perCallSources } of tuples)\n' +
			'\t\t\t\tfor (const to of perCallTargets)\n' +
			'\t\t\t\t\tfor (const f of perCallSources) arrows.push({ machine, from: f, to, site });',
		replace:
			'\t\t\tvoid tuples;\n' +
			'\t\t\tfor (const to of targets) for (const f of sources) arrows.push({ machine, from: f, to, site });',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "THE RECTANGLE, RESTORED — the reader goes back to crossing two flattened factory parameters and manufacturing arrows no call declares. This is the state the census shipped in for its whole life until REG-F-124: `validator-registry.ts`'s four `statusChange` calls declare FIVE arrows between them and were read as NINE, and the four extra sat in REG-F-121's pinned unratified list looking exactly like commands over-claiming. ⚠ NOTE THE ARITHMETIC IN THE MUTATION, because it is the finding: `tuples` is still computed (so the `fail()` arm is untouched and this measures the EMISSION alone) and is then discarded in favour of the crossed sets. ⚠ AND THE VICTIM IS THE SYNTHETIC FIXTURE, NOT THE COUNT PINS, DELIBERATELY: `arrow-census-coverage.test.ts` WOULD also redden (174 -> 178), but a count pin cannot say WHICH reading is right — it fails identically whether the number moved by fabrication or by a real declaration landing. The two-call fixture with disjoint targets and disjoint sources is the only assertion that distinguishes paired from crossed, and it is why one call would not do (a single tuple's cross product IS that tuple). Predicted red: 'pairs a factory's (target, sources) PER CALL instead of crossing the flattened sets' — measured ALONE before declaring.",
		source: 'REG-F-124 — from the 7-agent adversarial audit that corrected the finding three times'
	},
	{
		id: 'F125-the-fiction-census-reads-the-diagram-again',
		file: 'verif/arrow-command-census.ts',
		find: '\t\tif (!born.has(declared))',
		replace: '\t\tif (born.has(declared))',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "THE PREDICATE INVERTED, WHICH IS THE ONLY WAY THIS DERIVATION CAN LIE WITHOUT LOOKING BROKEN. `initialStateFictions()` answers \"does any creation write the state the machine calls initial?\" — flip the sense and it reports the machines that AGREE as fictions and stays silent about the five that do not. ⚠ AND THE POINT IS THAT THE COUNT WOULD STILL LOOK PLAUSIBLE: the inverted set is non-empty (every machine born exactly where it declares), so a reader checking only \"is the number about right\" sees a list of similar length and no failure. That is precisely how the ORIGINAL defect survived — REG-F-071 measured four, the answer became five, and fourteen comments across nine files went on asserting four because nothing compared the claim to the machines. Predicted red: the by-NAME pin AND both controls (`Intent`/`PWU` would now appear, and the birth-declaration scope check would fail on machines that have none) — measured before declaring.",
		source: 'REG-F-125'
	},
	{
		id: 'F127-the-reassessment-rule-widens-to-every-self-edge',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		find:
			'\t\tconst adds = (CLAIM_REASSESSMENT_DISCRIMINATORS[target] ?? []).some(\n' +
			'\t\t\t(f) => supplied[f] !== undefined && !isDeepStrictEqual(supplied[f], before[f])\n' +
			'\t\t);',
		replace: '\t\tconst adds = false;\n\t\tvoid supplied;',
		expectRed: ['packages/rph-application/src/handlers/claim-assessment.test.ts'],
		why: "THE OVER-BROAD FORMULATION — the one this repository has already adopted and withdrawn ONCE, at `runtime-binding.ts` N-22, whose own comment records it: *\"MY FIRST FORMULATION REFUSED EVERY `from === to`, AND IT WAS OVER-BROAD … the defect is 'NOTHING CHANGED', not 'THE STATUS STAYED THE SAME'.\"* With `adds` forced false, every same-state re-assessment is refused, including a genuinely DISTINCT one by a second assessor — which is what DIFFERENT_AGENT independence looks like, so the guard would strand the act the assurance plane most wants. ⚠ AND THE DUPLICATE-REFUSAL TESTS STAY GREEN UNDER IT, which is the entire reason this mutant exists: a widened guard still refuses the identical re-issue, so the two tests that MOTIVATED the fix cannot tell the narrow rule from the broad one. Only the CONTROL can. Measured before declaring: reddens `CONTROL — a DISTINCT re-assessment at the same status is still ACCEPTED` ALONE (1 failed / 8 passed).",
		source: 'REG-F-127'
	},
	{
		id: 'F128-the-split-collapses-back-into-one-list',
		file: 'verif/arrow-command-census.ts',
		find: '\t\tif (a.from === a.to && !explicitlyIllegal) machineAdmittedSelfEdges.push(key);\n\t\telse overClaimed.push(key);',
		replace: '\t\tvoid explicitlyIllegal;\n\t\toverClaimed.push(key);',
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "THE SPLIT STOPS DISCRIMINATING — every unratified declaration is reported as an over-claim and the self-edge list empties. This is the state the pin was in for its whole life before REG-F-128: ONE population, one number, and no way to say which kind of thing moved. ⚠ THE HAZARD IT GUARDS IS SPECIFIC, and it is why the CONTROL exists rather than the two name-pins alone: a collapsed classifier still produces two lists of the right TYPE, and if someone re-pinned the names to match it the suite would be green over a classifier that classifies nothing. The control asserts the discrimination itself — no `from !== to` pair may sit in the self-edge list, no self-edge may sit in the over-claim list, and the two must be disjoint — so it fails on the SHAPE rather than on the contents. ⚠ AND THIS MATTERS MORE SINCE REG-F-127: the five machine-admitted self-edges went two different ways (three were duplicate-append DEFECTS and are now refused; two are deliberate HOLDS), so a reader who cannot tell the categories apart cannot look up which disposition applies to the arrow in front of them. Predicted red: the by-name self-edge pin AND the CONTROL.",
		source: 'REG-F-128'
	},
	{
		id: 'F129-the-creation-gate-reuses-the-readiness-set',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "\tif ((intentObj.state as { intentStatus?: string }).intentStatus === 'SUPERSEDED') {",
		replace:
			"\tif (\n\t\t!['PROVISIONAL', 'FORMALIZED', 'APPROVED', 'REVISED'].includes(\n" +
			"\t\t\tString((intentObj.state as { intentStatus?: string }).intentStatus)\n\t\t)\n\t) {",
		expectRed: ['packages/rph-application/src/handlers/sta6-superseded-intent.test.ts'],
		why: "THE TEMPTING REUSE, AND THE ONE THE MOTIVATING TEST CANNOT SEE. STA-6 has FOUR clauses and two of them are about intent maturity, so the obvious move when writing the creation gate is to reach for the set the READINESS gate already uses — `INTENT_AT_LEAST_PROVISIONAL` (pwuGuards.ts), which is {PROVISIONAL, FORMALIZED, APPROVED, REVISED}. This mutation is that reuse, spelled inline. ⚠ THE SUPERSEDED TEST STAYS GREEN UNDER IT — a widened gate still refuses SUPERSEDED — so the test that MOTIVATED this guard cannot distinguish the ratified rule from a gate four times too wide. Only the controls can. And the over-refusal is not hypothetical: proposing under a RAW intent is the repository's normal pattern, measured at 56 of the 71 files that dispatch both `CaptureIntent` and `ProposePwu` without maturing it in between. Predicted red, measured before declaring: the RAW control AND the WITHDRAWN non-rule pin, 2 failed / 2 passed — clause (a) governs readiness, clause (d) governs creation, and this is what keeps them apart.",
		source: 'REG-F-129'
	},
	{
		id: 'F134-the-dismissal-check-returns-nothing',
		file: 'verif/guard-enforcement-ledger.ts',
		find: "\t\tif (ledger[guard]?.disposition !== 'ARROW_UNREACHABLE') continue;",
		replace:
			"\t\tif (ledger[guard]?.disposition !== 'ARROW_UNREACHABLE') continue;\n" +
			'\t\tif (arrows.length >= 0) continue;',
		expectRed: ['verif/guard-enforcement-ledger.test.ts'],
		why: "THE CHECK STOPS CHECKING WHILE READING AS GREEN. `unreachabilityFaults` returns [] unconditionally, which is EXACTLY what a correct ledger also produces — so the main assertion cannot tell the two apart, and that is the whole reason CONTROL 5 exists rather than the assertion alone. ⚠ THIS IS NOT A HYPOTHETICAL SHAPE: the identical failure is what let \"Replacement intent identified\" sit false for four commits. There was no check at all, and no-check and check-that-returns-nothing are indistinguishable from the outside. MEASURED BEFORE DECLARING by neutering the function by hand: 1 failed / 13 passed, and the one failure was CONTROL 5 — the main test stayed GREEN under it, which is the point. Predicted red: CONTROL 5 alone.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-the-two-censuses-key-arrows-differently',
		file: 'verif/guard-enforcement-ledger.ts',
		find: '\t\t\t.map((a) => arrowKey(a.machine, a.from, a.to))',
		replace: '\t\t\t.map((a) => `${a.machine} ${a.from} -> ${a.to}`)',
		expectRed: ['verif/guard-enforcement-ledger.test.ts'],
		why: "THE JOIN SILENTLY AGREES ON NOTHING. This function joins TWO censuses — C-0b's guarded arrows and C-0's covered set — and its characteristic failure is therefore not a wrong answer but a KEY-FORMAT MISMATCH, which yields an empty intersection and reads as \"no faults\". Swapping the shared `arrowKey` for a private format is the mutation the file's own header warns against in its second paragraph: two censuses over one table must not each keep their own idea of the table. ⚠ AND IT IS THE MUTATION MOST LIKELY TO BE WRITTEN BY ACCIDENT, because a hand-rolled `${machine} ${from} -> ${to}` differs from the real key by ONE SPACE and nothing about it looks wrong. Predicted red: CONTROL 5 — not the main assertion, which a mismatched join leaves green.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-the-successor-is-merely-required-to-exist',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find: "\tif (successor?.objectType !== 'INTENT') {",
		replace: '\tif (!successor) {',
		expectRed: ['packages/rph-application/src/handlers/sta6-superseded-intent.test.ts'],
		why: "THE SUCCESSOR GOES BACK TO BEING THE CALLER’S WORD. Weakening the resolution to an EXISTENCE test (`!successor`) is the tempting version, and it is precisely the shape `proposePwu`’s PWU-002 already has — which DISCLOSES its own hole at pwu.ts:255: \"a non-INTENT id would carry intentStatus: undefined and pass this check\". ⚠ THE GHOST-SUCCESSOR TEST STAYS GREEN UNDER THIS MUTATION, because a nonexistent id fails an existence test too; only the NOT-AN-INTENT case can tell the two apart. That is why this arrow departs from PWU-002 rather than copying it, and why the decoy PWU exists in the suite. Predicted red: \"REFUSES a supersession whose successor is not an INTENT\" alone.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-an-intent-may-supersede-itself',
		file: 'packages/rph-application/src/handlers/intent.ts',
		find: '\tif (p.supersedingIntentId === command.targetAggregateId) {',
		replace: '\tif (false as boolean) {',
		expectRed: ['packages/rph-application/src/handlers/sta6-superseded-intent.test.ts'],
		why: "THE SELF-SUPERSESSION ARM IS DELETED. Without it an intent can name ITSELF its own replacement, which moves it to a TERMINAL state whose recorded successor is the dead intent — the stranding this increment exists to close, reached by a second route that the existence-and-type check cannot see (the intent trivially exists and is trivially an INTENT). ⚠ EVERY OTHER TEST IN THE SUITE STAYS GREEN, including the ghost and decoy refusals and the CONTROL, so this arm has exactly one witness and the mutation proves it is a real one rather than a defensive line nothing reaches. Predicted red: \"REFUSES an intent superseding itself\" alone.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-the-enforcedAt-citation-is-the-literal-it-is-checked-against',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\t\t\t'packages/rph-application/src/handlers/execution.ts \u2014 activateExecutionPlan / canActivatePlan',",
		replace: "\t\t\t'packages/',",
		expectRed: [],
		why: "THE CITATION IS REPLACED BY THE LITERAL IT IS CHECKED AGAINST. `enforcedAt` is supposed to name the site that refuses; the ONLY assertion on it in the whole repository is `toContain(‘packages/’)` at enforcement-register.test.ts:255, so the bare string \"packages/\" satisfies it while naming no file, no function and no line. This mutation is that string.",
		expectSurvive: "SURVIVAL IS THE FINDING, AND IT IS THE EVIDENCE REG-F-134 PROMISED — a claim that a check CANNOT FAIL must be demonstrated, not asserted. The field's own doc comment already concedes it (\"Prose, checked by a reader, not by the gate\"), and one directory over verif/guard-enforcement-ledger.ts demands an anchor that resolves EXACTLY ONCE in the file it names — the unofficial instrument is stricter than the canonical one. ⚠ A KILL HERE IS THE GOOD NEWS AND MUST BE ACTED ON, NOT SILENCED: it means someone content-gated `enforcedAt`, at which point this entry is RETIRED deliberately and REG-F-134’s open limb closes.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-a-declared-mutation-need-not-exist',
		file: 'packages/rph-domain/src/enforcement-register.ts',
		find: "\t\t\t'delete the `if (!check.ok)` arm in activateExecutionPlan',",
		replace: "\t\t\t'delete the `if (!thisFunctionDoesNotExist)` arm in aHandlerThatWasNeverWritten',",
		expectRed: [],
		why: "A DECLARED MUTATION IS REPLACED BY ONE THAT DOES NOT EXIST. `declaredMutations` is supposed to say what to break to prove the guard; the ONLY assertion on it in the whole repository is `.length > 0` at enforcement-register.test.ts:256, so the strings need not name mutations that exist, apply, or redden anything. This mutation replaces a real entry with an invented one.",
		expectSurvive: "SURVIVAL IS THE FINDING. ⚠ AND THE DEEPER GAP IS THAT THE TWO SYSTEMS ARE UNLINKED: this ledger — the file you are reading — is where mutations actually live, and `enforcement-register.ts` mentions it nowhere. Searched scripts/mutants/ledger.ts for the RPH-EVD-002 guard text and rule id: 0 hits; positive control CLAIM_REASSESSMENT_DISCRIMINATORS in the same file: 1 hit, so the search discriminates. Making `declaredMutations` resolve to ledger ids is a separate work package, filed rather than smuggled into a disposition move. ⚠ A KILL HERE MEANS THE JOIN WAS BUILT — retire this entry deliberately.",
		source: 'REG-F-134'
	},
	{
		id: 'F134-the-evd002-refusal-code-is-unpinned',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		// `RPH_INVARIANT_VIOLATION` occurs three times in this file, so the anchor MUST carry the message line
		// beneath it to satisfy the exactly-once rule.
		find:
			"\t\t\t\t'RPH_INVARIANT_VIOLATION',\n" +
			'\t\t\t\t`Claim ${command.targetAggregateId} cannot be SUPPORTED: no ADMISSIBLE evidence supports it `',
		replace:
			"\t\t\t\t'RPH_VALIDATION_SEMANTIC_FAILED',\n" +
			'\t\t\t\t`Claim ${command.targetAggregateId} cannot be SUPPORTED: no ADMISSIBLE evidence supports it `',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: "THE REFUSAL CHANGES IDENTITY WHILE STAYING A REFUSAL. ⚠ THIS MUTATION WAS MEASURED SURVIVING BEFORE THE PROBE EXISTED, and that measurement is the entire justification for REG-F-138: with the code swapped, the whole workspace stayed GREEN — 269 files, 2732 passed, nothing anywhere reddened. It survived because (a) `claim-assessment.test.ts` is 300 lines about this rule and asserts on NO `error.code` or message anywhere (positive control: `assumption-falsification.test.ts:223` DOES assert `r.error?.code`, same grep shape, different answer); (b) the message is untouched, so the guard-ledger anchor still resolves; and (c) `RPH_VALIDATION_SEMANTIC_FAILED` is not a key of `STATUS_FOR_CODE`, so the status stays REJECTED and every `.not.toBe(‘ACCEPTED’)` stays green. What was \"covered\" was the rule’s NON-ACCEPTANCE, never its IDENTITY. Predicted red now: the WP-16 (c) enforcement probe, whose `classifyRefusal` compares `code === refusalCode`.",
		source: 'REG-F-138'
	},
	{
		id: 'F134-admissible-collapses-into-present',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		// ⚠ TWO LINES, because the identical ADMISSIBLE test appears TWICE in this file — assurance.ts:705 in
		// `claimsWithAdmissibleEvidence` (the GUARD's set) and :935 in `admissibleEvidenceFor` (the MUTATE
		// path). Only the following line distinguishes them, and only the first is the one this rule refuses on.
		find:
			"\t\tif (!st || String(st.status) !== 'ADMISSIBLE') continue;\n" +
			'\t\tif (!Array.isArray(st.supportsClaimIds)) continue;',
		replace:
			"\t\tif (!st) continue;\n" +
			'\t\tif (!Array.isArray(st.supportsClaimIds)) continue;',
		expectRed: ['packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts'],
		why: "ADMISSIBLE COLLAPSES INTO MERELY PRESENT — the one distinction this rule exists to draw. RPH-EVD-002 is the single NON-FORGEABLE refusal in this command precisely because admissibility is a fact the ENGINE holds: evidence reaches ADMISSIBLE only through `AdmitEvidence`, and the guard folds COMMITTED events rather than reading the payload. Weakening the status test to a presence check hands that fact back to the caller, who can then reach SUPPORTED on evidence it merely PROPOSED. ⚠ THE ENFORCEMENT PROBE’S CONTROL CANNOT SEE THIS — the control ADMITS its evidence, so it stays ACCEPTED either way; only the OBSERVED arm, whose evidence was never admitted, flips from REJECTED to ACCEPTED. That asymmetry is why the probe carries two claim aggregates instead of asserting a refusal alone.",
		source: 'REG-F-138'
	},
	// ── REG-F-159: THE GUARD THE OCCUPANCY CENSUS RESTS ON, AND THE DECLARATION THAT FEEDS IT ────────────────
	//
	// These two are a PAIR and they fail in opposite directions, which is what distinguishes a real gate from
	// one that merely refuses a lot: the first kills the ENFORCEMENT, the second kills the DECLARATION.
	{
		id: 'F159-birth-drift-refusal-neutered',
		file: 'packages/rph-application/src/handlers/kit.ts',
		// TWO LINES: `for (const b of births ?? []) {` alone would be unique, but anchoring on the CONDITION is
		// what makes the mutation the one described — the loop is not the guard, the predicate is.
		find:
			'\t\tconst actual = state[b.statusField];\n' +
			"\t\tif (typeof actual !== 'string' || !b.values.includes(actual)) {",
		replace: '\t\tconst actual = state[b.statusField];\n\t\tif (false as boolean) {',
		expectRed: ['packages/rph-application/src/handlers/birth-drift.test.ts'],
		why: "THE OCCUPANCY CENSUS'S ONLY RUNTIME DEFENCE, AND IT WAS MEASURED UNFALSIFIABLE BEFORE ITS TEST EXISTED. `refuseOnBirthDrift` runs at BOTH commit seams and its header states the stake: a declaration that has drifted from the code makes the census confidently wrong, which is worse than no census. MEASURED 2026-08-14 with this exact mutation applied: the `rph-application` project ran 99 files / 884 tests, ALL PASSING — every declaration in the repository agrees with the state its site commits, which is what the census passing MEANS, so no production path ever entered the refusing arm and no test ever constructed one. A guard nothing distinguishes from `return null` is this programme's hollow, sitting underneath the instrument that finds hollows. `birth-drift.test.ts` enters the arm directly with synthetic declarations, and reddens on 3 of its 5 cases here while both `toBeNull` controls correctly HOLD — the discrimination that stops it reddening with the herd.",
		source: 'REG-F-159'
	},
	{
		id: 'F159-fourth-birth-declaration-deleted',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find:
			"\t\t\t{ machine: 'PWU.shapeIntegrityState', statusField: 'shapeIntegrityState', values: ['UNKNOWN'] }",
		replace:
			"\t\t\t{ machine: 'PWU.workLifecycleState', statusField: 'workLifecycleState', values: ['PROPOSED'] }",
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "A DECLARATION SILENTLY STOPS BEING MADE, AND NOTHING ELSE IN THE REPOSITORY NOTICES. Deleting an entry does not break any commit — `refuseOnBirthDrift` simply stops checking that axis — so the failure mode is a machine quietly returning to `unanalysable`, which every occupancy layer reads as \"nobody said\" and skips. ⚠ THE REPLACEMENT IS A DUPLICATE OF AN EXISTING ENTRY RATHER THAN A DELETION, deliberately: it keeps the array's LENGTH at four, so a pin counting entries would stay green and only a pin naming MACHINES can catch it. That is the REG-F-121 shape — a count improves by destroying the evidence — and it is why the REG-F-159 pin asserts machine and value rather than size.",
		source: 'REG-F-159'
	},
	// ── REG-F-160: THE POPULATION ITSELF ────────────────────────────────────────────────────────────────────
	//
	// One mutant on the LIST (can it grow silently?) and one on the READER (does C-0c actually consult it?).
	{
		id: 'F160-a-real-coverage-gap-is-moved-into-the-exclusion-list',
		file: 'packages/rph-domain/src/machine-exclusions.ts',
		find: '/** True when `machine` is a declared key that no control should treat as a lifecycle. */',
		replace:
			"Object.assign(NOT_STATE_MACHINES as Record<string, string>, {\n" +
			"\t'Harness.status': 'a plausible-sounding reason that cites nothing'\n" +
			'});\n' +
			'/** True when `machine` is a declared key that no control should treat as a lifecycle. */',
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "THE ALLOWLIST ROT `machine-exclusions.ts` NAMES IN ITS OWN HEADER, PERFORMED. It warns that *\"moving a real gap in here would be the allowlist rot this repository keeps recording\"* — and until REG-F-160 NOTHING CHECKED THAT LIST'S MEMBERSHIP. The move is cheap and flattering in both directions at once: `Harness.status` is a genuine coverage gap (harness.ts has exactly one commit site, the `createObject` birth at :34), so excluding it SHORTENS the blind list AND RAISES the coverage percentage by shrinking the denominator. PRIMARY VICTIM: the new `PINNED — exactly which machines are EXCLUDED from the population` pin, which asserts the membership BY NAME WITH ARROW COUNTS. The blind-list pin and the coverage-figures pin also redden, and that is the design rather than a weakness — the point is that this cannot happen quietly, not that exactly one assertion notices.",
		source: 'REG-F-160'
	},
	{
		id: 'F160-the-coverage-figures-stop-asking-the-population',
		file: 'verif/arrow-census-coverage.test.ts',
		find: '\t\tconst declared = inScopeMachines();',
		replace: '\t\tconst declared = Object.keys(MACHINES);',
		expectRed: ['verif/arrow-census-coverage.test.ts'],
		why: "C-0c REVERTS TO ITS OWN IDEA OF THE TABLE — the exact state REG-F-160 found it in, and the state `machine-exclusions.ts` exists to prevent: *\"Two censuses over one table must not each keep their own idea of the table.\"* Three instruments applied `isExcludedMachine` (C-0 :944/:955, C-0b :83, binding-row-truth :249) and this one did not, so `arrowsRatified` carried 9 arrows belonging to `AssuranceAssessment.disposition` — a machine over a field the ratified object schema DOES NOT HAVE (`z.strictObject`; `commitState` validates the produced state), permanently uncoverable. ISOLATING BY CONSTRUCTION: this anchors the FIGURES site alone, so only the `machinesDeclared/arrowsRatified` pin reddens (25 -> 27, 295 -> 304) while the blind-list pin and the excluded-set pin stay green — which is what distinguishes 'the figures consult the population' from 'something somewhere consults it'.",
		source: 'REG-F-160'
	},
	// ── REG-F-161: TWO READ BRANCHES STARVED BY A BIRTH-ONLY MACHINE ────────────────────────────────────────
	//
	// Both are CONTROLS whose SURVIVAL is the finding, and both retire together the day an observation-disposition
	// command exists. ⚠ UPDATED 2026-08-20 (REG-F-199 residue 2): “both” now describes 2 of 3 — professional-work-graph.ts
	// reads the observation’s CURRENT disposition as of that date, so its WAIVED branch is dead for the same reason
	// and revives on the same day. The line below continues its original sentence.
	// command is authored — at which point a KILL is the signal, not a regression.
	{
		id: 'F161-the-baseline-waiver-escape-is-starved',
		file: 'packages/rph-application/src/handlers/governance.ts',
		find: "\t\t\twaived: disposition === 'WAIVED'",
		replace: '\t\t\twaived: false',
		expectRed: [],
		why: "RPH-BAS-003's WAIVER ESCAPE CANNOT FIRE, AND THE SUBSTITUTION IS EXACT. `AssuranceObservation.disposition` has ONE write in the repository — the birth at `assurance.ts:2324`, value `OPEN` — verified by the write funnel (`objectType: OBSERVATION` occurs at exactly one commit site) rather than by grep. So `disposition === 'WAIVED'` is permanently false, and `findOpenBlockingObservations`' `if (o.blocking && !o.waived)` reduces to `if (o.blocking)`. ⚠ NOT A LOCAL FILTER PROBLEM, WHICH WAS THE FIRST HYPOTHESIS AND IT WAS WRONG: `UNSETTLED_DISPOSITIONS` three lines above DOES contain `WAIVED`, so the value is admitted and then can never occur.",
		expectSurvive: "SURVIVAL IS THE FINDING. MEASURED 2026-08-14 with this exact substitution: `rph-application` + `rph-domain` ran 132 files / 1464 tests, ALL PASSING. ⚠ AND `governance.test.ts:242` ASSERTS THE WAIVED CASE — it passes `waived: true` STRAIGHT INTO the kernel predicate, bypassing the producer, so the kernel branch is tested while the production path that would elicit it cannot exist. FAIL-CLOSED: the gate is STRICTER than canon intends, never laxer — a waived blocking finding is refused rather than excused — so this is a dead branch, not a hole. ⚠ A KILL MEANS AN OBSERVATION-DISPOSITION COMMAND WAS BUILT — retire this entry deliberately and re-drive RPH-BAS-003's C-0b row.",
		source: 'REG-F-161'
	},
	{
		id: 'F161-the-floor-gate-resolved-finding-filter-is-starved',
		// ⚠ RETIRED 2026-08-20 (REG-F-202). Its target — `openFindingCodes` in floor-gate.ts — was DELETED with the
		// whole waiver-discharge apparatus, because ASR-3 makes the de minimis floor UNCONDITIONAL. This is the
		// RETIRED case the ledger's header distinguishes from UNANCHORED: the code did not drift out from under a
		// claim, it was removed deliberately and this entry says where the finding went. The starvation this
		// documented (a disposition filter over a field only ever written 'OPEN') SURVIVES at its pair, which is
		// the other consumer of the same root cause and is still anchored.
		supersededBy: 'F161-the-baseline-waiver-escape-is-starved',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: "\t\tif (s.disposition && s.disposition !== 'OPEN') continue; // already resolved/waived elsewhere",
		replace: '\t\t// already resolved/waived elsewhere',
		expectRed: [],
		why: "THE SAME STARVATION AT THE OTHER END OF THE SYSTEM, AND ITS POLARITY IS WORTH RECORDING SEPARATELY. `openFindingCodes` skips observations whose disposition is anything but `OPEN`; since `OPEN` is the only value ever written, the `continue` never fires and the filter excludes nothing. So a waiver must name EVERY finding code the assessment ever raised, including any that were resolved — which is again STRICTER, not laxer.",
		expectSurvive: "SURVIVAL IS THE FINDING. MEASURED 2026-08-14 with this exact deletion: `rph-application` + `rph-domain` + `rph-assurance` ran 137 files / 1511 tests, ALL PASSING. ⚠ PAIRED WITH `F161-the-baseline-waiver-escape-is-starved` — one root cause, two consumers, and BOTH fail closed, which is why this is filed as a dead-branch census rather than as a defect needing a hotfix. A KILL means the disposition machine acquired a writer; retire both entries together.",
		source: 'REG-F-161'
	},
	// ── REG-F-202: THE SURFACE MUST NOT OFFER A WAIVER AS A ROUTE PAST THE FLOOR ──────────────────────────────
	// ASR-3 makes the de minimis floor UNCONDITIONAL and commit d24c19ec deleted the discharge apparatus. That
	// headline was proven at PACKAGE level and nowhere on the surface, which went on saying the opposite. These
	// three defend the three distinct claims `assurance-floor-waiver.e2e.ts` makes; the third defends its CONTROL,
	// because a control that cannot fail is the defect this ledger exists to catch.
	{
		id: 'MU-F202-the-blocked-hint-offers-a-waiver-again',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
		find: 'Publishing is blocked until the floor is SATISFIED — revise the graph and re-run.',
		replace:
			'Publishing is blocked until the floor is SATISFIED — revise the graph and re-run, or record a waiver.',
		expectRed: ['apps/rph-demo/e2e/assurance-floor-waiver.e2e.ts'],
		why: "THE EXACT TEXT THAT WAS THERE, restored verbatim — this is a REGRESSION mutant, not an invented one. The hint is the sentence a blocked professional reads to learn what to do next, and naming a waiver there sends them down a route ASR-3 abolished: they record it, retry, and get the identical refusal. The spec's claim is `expect(hint).not.toContainText(/waiv/i)`, so the substring alone reddens it without touching the form below.",
		source: 'REG-F-202 (ASR-3, JPWB-DOC-003 §Semantic Model)'
	},
	{
		id: 'MU-F202-the-publish-refusal-offers-a-waiver-again',
		file: 'packages/rph-application/src/handlers/pwa-authoring.ts',
		find:
			'for the current version before publishing. The floor is unconditional: no governance waiver discharges it.',
		replace: 'for the current version, or a governance waiver, before publishing.',
		expectRed: ['apps/rph-demo/e2e/assurance-floor-waiver.e2e.ts'],
		why: "THE ENGINE'S OWN VOICE, and the highest-traffic false statement the sweep found — this refusal is the demo's answer to \"why can't I publish?\", surfaced verbatim through `advancePwa` -> `refuse(r)` -> the `{#if form?.error}` block. It survived the d24c19ec landing untouched because that increment changed the GATE and never read what the gate SAYS. Restoring the old wording reddens two assertions at once (the required `no governance waiver discharges it` and the forbidden `or a governance waiver`), which is deliberate: the spec pins both the presence of the correction and the absence of the error.",
		source: 'REG-F-202 (ASR-3, JPWB-DOC-003 §Semantic Model)'
	},
	{
		id: 'MU-F202-the-blocked-hint-renders-on-a-satisfied-floor',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
		find: '{#if !data.floor.satisfied}',
		replace: '{#if data.floor}',
		expectRed: ['apps/rph-demo/e2e/assurance-floor-waiver.e2e.ts'],
		why: "THE CONTROL'S OWN MUTANT, which the other two cannot supply. Both of them arrange a BLOCKING floor, so a panel that rendered the blocked hint and the waiver form UNCONDITIONALLY would pass both while lying on every satisfied floor — and the spec's third test exists precisely for that world. `{#if data.floor}` rather than `{#if true}` is the realistic slip (an existence check standing in for a state check) and it typechecks, where `if (true)` invites the dead-code NO_COMPILE this ledger's header documents. It is inside the outer `{#if data.floor}` block, so it is unconditionally true there. OBSERVED 2026-08-20, and the attribution is the point rather than the kill: tests 1 and 2 both PASS under this mutation (they arrange BLOCKING floors, where the hint renders either way) and ONLY the control at :213 fails, on `floor-blocked-hint` toHaveCount(0). A control whose mutant reddened a sibling would be measuring nothing of its own.",
		source: 'REG-F-202 (a control needs its own mutant)'
	},
	// ── REG-F-202: floorGateBlock's OWN decision, which had no declared mutant ────────────────────────────────
	// ⚠ FILED AS A COVERAGE GAP IN THE LEDGER ITSELF. Three mutants already name `floor-gate.ts` (WP11-M7/M8/M9)
	// and ALL THREE aim at ADMISSIBILITY — `aiProduced`, `subjectCount`, `structuredResultHasContent` — i.e. at
	// whether the gate RUNS. Not one aimed at what it DECIDES once it runs. The ASR-3 increment rewrote exactly
	// that line and retired the only mutant that had touched the surrounding function, so the post-change
	// predicate shipped with no declared mutation at all. A ledger can be dense around a file and empty at its
	// decision.
	{
		id: 'MU-F202-the-floor-blocks-only-on-REJECTED',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: "\t\t.filter((r) => r.disposition !== 'SATISFIED')",
		replace: "\t\t.filter((r) => r.disposition === 'REJECTED')",
		expectRed: ['apps/rph-demo/e2e/assurance-floor-waiver.e2e.ts'],
		why: "THE REALISTIC FAIL-OPEN, not an invented one: narrowing 'anything that is not SATISFIED blocks' to 'only an explicit REJECTED blocks' lets an assessment that is still ASSESSING, or INCONCLUSIVE, or MISSING entirely, pass the de minimis floor. ⚠ THE VICTIM WAS CHOSEN BECAUSE ITS ARRANGEMENT DISCRIMINATES: `assurance-floor-waiver.e2e.ts` stages a blocking floor by leaving the latest reasoning-review assessment in ASSESSING with a BLOCKING observation — deliberately NOT completed to REJECTED — so under this mutation that floor stops blocking and PublishPwa is admitted where the spec asserts refusal. `assurance-floor.e2e.ts` would NOT discriminate: its blocked case is a genuinely REJECTED review, which this mutation still blocks. OBSERVED 2026-08-21: KILLED, and the discrimination held as reasoned.",
		source: 'REG-F-202 (ASR-3: the de minimis floor is UNCONDITIONAL)'
	},
	{
		id: 'MU-F202-the-floor-blocks-everything',
		file: 'packages/rph-application/src/handlers/floor-gate.ts',
		find: "\t\t.filter((r) => r.disposition !== 'SATISFIED')",
		replace: '\t\t.filter(() => true)',
		expectRed: ['apps/rph-demo/e2e/assurance-floor.e2e.ts'],
		why: "THE OPPOSITE-POLARITY PAIR, and the one that defends the CONTROL. A gate that blocked unconditionally would satisfy every refusal assertion in the suite — including its sibling's — while making publication impossible for a perfectly satisfied floor. The victim is the spec whose FIRST test drives a clean graph all the way to PUBLISHED, so the kill lands on the admit path rather than on any refusal. ⚠ Same anchor as its sibling by design: the one line IS the decision, and the two mutations fail in opposite directions. OBSERVED 2026-08-21: KILLED.",
		source: 'REG-F-202 (a control needs its own mutant)'
	},
	// ── REG-F-041 S-0: an empty composition is not a composition ──────────────────────────────────────────────
	// `requiredChildWorkUnitIds` had no `.min(1)` (both schemas are GENERATED, so the constraint has no home
	// there) and `buildRecompositionInput` read it `?? []`. With an empty list the kernel's child rung —
	// `unsatisfied.length > 0` — is VACUOUSLY FALSE, so every child-acceptability check passed by having nothing
	// to check. These two are opposite polarities on the one guard that closes it.
	{
		id: 'MU-F041S0-the-empty-composition-is-admitted-again',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		find: '\tif (p.requiredChildWorkUnitIds.length === 0) {',
		replace: '\tif (false && p.requiredChildWorkUnitIds.length === 0) {',
		expectRed: ['packages/rph-application/src/handlers/recomposition.test.ts'],
		why: "THE FAIL-OPEN RESTORED. ⚠ `&& ` RATHER THAN A BARE `if (false)`, deliberately: the ledger's own V-2c lesson (header, ~:38-56) records that `if (cond) -> if (false)` makes the guarded block STATICALLY DEAD and TypeScript then reports the `return` as unreachable — 21 harvested mutants died that way. Preserving the operand keeps the block live to the compiler while the condition can never hold. Reddens `refuses a recomposition contract naming NO required children`, which asserts REJECTED and that no contract is minted. OBSERVED 2026-08-21: EXACTLY ONE test fails, so the kill is precisely attributable to the refusal claim and to nothing else.",
		source: 'REG-F-041 S-0 (OBJ-1: no semantic state inferred from an empty array; DEC-6)'
	},
	{
		id: 'MU-F041S0-the-guard-refuses-every-proposal',
		file: 'packages/rph-application/src/handlers/decomposition.ts',
		find: '\tif (p.requiredChildWorkUnitIds.length === 0) {',
		replace: '\tif (p.requiredChildWorkUnitIds.length >= 0) {',
		expectRed: ['packages/rph-application/src/handlers/recomposition.test.ts'],
		why: "THE CONTROL'S OWN MUTANT, and the pair's whole point: `=== 0` -> `>= 0` is the realistic operator slip, and it makes the guard refuse EVERY proposal — including valid ones. The refusal test above would pass perfectly in that world, which is why it cannot be the only claim. Reddens `CONTROL: a contract naming one required child is proposed normally`. ⚠ Same anchor as its sibling BY DESIGN — the one line IS the whole guard and the two mutations fail in opposite directions; `F201-broker-asserts-the-wrong-type` states the same discipline. ⚠ It also reddens `dwp03-precondition-coverage.test.ts`, which arranges recompositions for an unrelated subject; the victim named here is the file whose tests make the CLAIM, and the collateral is recorded rather than left for a reader to discover. OBSERVED 2026-08-21: NINE tests fail, against exactly ONE for its sibling. ⚠ READ THAT ASYMMETRY HONESTLY — it is the pair that discriminates, not this mutant alone: the sibling proves the refusal fires ONLY on emptiness (1 red), and this one proves the control is load-bearing (the control is among the 9). This mutation does NOT isolate the control, and saying otherwise would be the vacuous-control claim the ledger exists to refuse.",
		source: 'REG-F-041 S-0 (a control needs its own mutant)'
	},
	{
		id: 'MU-F202B-gate-b-collapses-absent-and-empty-again',
		file: 'packages/rph-application/src/handlers/assurance.ts',
		find: '\t// nothing. Only the first is a skip.\n\tif (permittedControlActions === undefined) return null;',
		replace: '\t// nothing. Only the first is a skip.\n\tif ((permittedControlActions ?? []).length === 0) return null;',
		expectRed: ['packages/rph-application/src/handlers/assurance-independence.test.ts'],
		why: "THE EXACT FAIL-OPEN THAT WAS THERE (REG-F-202 (b)), restored as a REGRESSION mutant. Gate B read `new Set(permittedControlActions ?? [])` then `if (permitted.size === 0) return null`, collapsing UNDECLARED (unconstrained, un-subset-checkable) into EXPLICIT `[]` (a constraint permitting nothing) — so a policy permitting NO control action admitted every recommendation. ⚠ THE ANCHOR CARRIES ITS COMMENT LINE BECAUSE IT MUST: `if (permittedControlActions === undefined) return null;` and `const permitted = new Set(permittedControlActions);` are BYTE-IDENTICAL in the file-mate `rejectRemediationActionsNotPermitted` twenty lines up (:148-149), so either line alone is ambiguous and would report UNANCHORED. The comment at :1852 is unique to Gate B.",
		source: 'REG-F-202 (b) — §11 permittedControlActions; the file-mate at assurance.ts:143 already ruled it'
	},
	// ── JAN-PWUWP W-5.5 (REG-D-043 / REG-F-193 / REG-F-194) ──────────────────────────────────────────────────
	// ⚠ THESE FOUR EXIST BECAUSE THE GATE WAS GREEN AND SAID NOTHING. The W-5.5 run measured 205 distinct
	// mutations — IDENTICAL IN EVERY CELL to the run before it — while the increment added a command, a guard
	// limb, a census idiom and a fail-closed refusal. A search of this ledger for `unblock|blockedfrom|
	// ownerofarrow|recovery_command|recoverytargets` returned 0, with `handlers/pwu.ts` (4) and
	// `arrow-command-census.ts` (8) as positive controls proving the search reached the file. Green over the OLD
	// surface is not a pass on the new one.
	{
		id: 'F193-the-union-guard-loses-its-arrow-limb',
		file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
		find: '\tfor (const spec of Object.values(PWU_RECOVERY_COMMAND_SPECS)) {\n\t\tif (spec.arrows.some((a) => a.from === from && a.to === to)) return spec.commandType;\n\t}\n',
		replace: '',
		expectRed: ['packages/rph-application/src/handlers/block-escalate.test.ts'],
		why: "REG-F-193's WHOLE RULING IN ONE MUTANT. Ownership is a UNION — arrow first, the eleven-row target table as a fail-closed backstop — because a target key cannot say that `BLOCKED -> PLANNED` belongs to `UnblockPwu` while `READY -> PLANNED` stays the generic setter's. Delete the arrow limb and the lookup falls through to the target table, where PLANNED is NOT owned, so `ChangePwuState` performs recovery: exactly the hole W-5.5 landed three parts in one commit to avoid, and it was MEASURED at that value (BLOCKED -> PLANNED returns ACCEPTED).",
		source: 'REG-F-193'
	},
	{
		id: 'F193-recovery-guesses-an-origin-it-was-never-told',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: '\t\tconst origin = recordedBlockOrigin(ctx, id);',
		replace: '\t\tconst origin = recordedBlockOrigin(ctx, id) ?? candidates[0]!;',
		expectRed: ['packages/rph-application/src/handlers/block-escalate.test.ts'],
		why: "THE FAIL-CLOSED HALF OF AX-8, AND THE ONLY MUTANT THAT CAN SHOW IT IS LOAD-BEARING. A PWU blocked before `blockedFrom` existed records no origin, and the two ways to produce one are to fold the event prefix — which CON-000 AX-6 forbids, *'never inferred from ... ordering'* — or to guess. This mutant guesses, plausibly, by taking the first declared candidate. It is the shape a well-meaning fix would take, which is why the refusal needs a mutant rather than a comment.",
		source: 'REG-F-193'
	},
	{
		id: 'F193-the-cardinality-branch-stops-deciding-anything',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: '\tif (candidates.length > 1) {',
		replace: '\tif (candidates.length > 0) {',
		expectRed: ['packages/rph-application/src/handlers/block-escalate.test.ts'],
		why: "WHETHER A RECORDED ORIGIN IS OWED IS DECIDED BY THE DECLARATION'S CARDINALITY, NOT BY A HARDCODED STATE LIST — which is why `PwuEscalated` deliberately carries no `escalatedFrom`. ESCALATED has ONE ratified in-arrow, so its target is derivable from the DECLARED MACHINE (permitted by AX-6) rather than from event ordering (forbidden). Widen the branch to `> 0` and ESCALATED recovery demands an origin no escalation event records, so it fails closed and de-escalation becomes unperformable. Kills the claim that the `> 1` is incidental.",
		source: 'REG-F-193'
	},
	{
		id: 'F194-the-census-goes-blind-to-the-recovery-command-again',
		file: 'verif/arrow-command-census.ts',
		find: '\tfor (const spec of Object.values(PWU_RECOVERY_COMMAND_SPECS)) {',
		replace: '\t\tfor (const spec of [] as (typeof PWU_RECOVERY_COMMAND_SPECS)[string][]) {',
		expectRed: ['verif/arrow-command-census.test.ts'],
		why: "REG-F-114's DEFECT HAS NOW RECURRED THREE TIMES AND THIS IS THE FIRST MUTANT THAT WOULD CATCH THE FOURTH. `UnblockPwu` resolves its target at runtime, so a syntactic reader sees no arrow; the fifth data idiom reads the DECLARATION instead. Starve that loop and all four recovery arrows return to *'arrows no command can perform'* and coverage falls 166 -> 162 — which is precisely the state C-0 reported when W-5.5 first landed, before the idiom existed. The idiom was added in response to a red; nothing until now would have noticed it being removed.",
		source: 'REG-F-194'
	},
	/*
	 * ⚠⚠ THE FIRST TWO `packages/csaa` ENTRIES IN THIS LEDGER, AND THE ABSENCE THEY END WAS NOT A CHOICE ANYONE MADE.
	 * Of the 224 entries above, ZERO name a csaa file — including `subject/analyzer-closure.ts`, the module the
	 * whole derived-capsule programme rests on. It has eight controls and, until these entries, nothing that could
	 * show any of them capable of failing.
	 *
	 * ⚠ AND THE OBVIOUS EXPLANATION IS WRONG, WHICH IS WHY IT IS WRITTEN DOWN. `EXCLUDED_PROJECTS = ['csaa']` in
	 * `run.ts` looks like a blanket bar on csaa mutants. It is not: `vitestVictimArgs()` in `run.ts` applies
	 * `projectFilters()` ONLY when `target.length === 0` — one hoisted `projects` binding feeding both argv arms —
	 * so the exclusion reaches CONTROLS and the BASELINE — the whole-workspace
	 * runs REG-F-136 was protecting from csaa's 5000ms timeouts — and never reaches a mutant that NAMES its victim.
	 * A named-victim csaa mutant has always been declarable. Nobody had declared one. Reading the exclusion as
	 * "csaa cannot be mutated" would have retired a real gap by misreading a filter.
	 *
	 * ⚠ THE COROLLARY IS A GENUINE LIMIT AND IS NOT FIXED HERE: a csaa CONTROL (`expectSurvive`, `expectRed: []`)
	 * still cannot be graded, because controls run the whole workspace MINUS csaa and would never observe the code.
	 * Both entries below therefore name their victim. That is the STRONGER form in any case — but here it is also
	 * the only available one, and a later reader must not mistake the constraint for a preference.
	 */
	{
		id: 'MU-TRACKER-01-boundary-check-always-passes',
		file: 'scripts/tracker/match.ts',
		find: 'if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) return true;',
		replace: 'return true;',
		expectRed: ['verif/tracker-name-match.test.ts'],
		why: 'THE INSTRUMENT NEEDS ITS OWN MUTANT. A measurement tool that cannot be shown to fail is a claim about the codebase with no standing — the REG-F-196 shape, applied to the thing that grades everything else. Collapsing the boundary test to a bare `return true` IS `String.includes`, the exact behaviour that reported the ratified query `getPwu` as implemented because `getPwuTemplate` starts the same way.',
		source: 'REG-F-199'
	},
	{
		id: 'MU-TRACKER-02-trailing-boundary-unchecked',
		file: 'scripts/tracker/match.ts',
		find: 'if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) return true;',
		replace: 'if (!IDENTIFIER_CHAR.test(before)) return true;',
		expectRed: ['verif/tracker-ingest.test.ts'],
		why: 'SHARPER THAN MU-TRACKER-01 AND AIMED ELSEWHERE. Dropping only the TRAILING check admits exactly one class of false positive — a ratified name that is a PREFIX of a longer identifier — which is the 2026-08-20 incident precisely, and nothing else. Its victim is the CENSUS leg, so what this proves is not that the matcher is wrong but that the tracker gate can SEE the matcher being wrong: it reddens through the live `measure.ts` run, not through the committed journal. Observed: reddens EXACTLY 1 of the census suite’s 24 tests — the live-instrument assertion and nothing else, which is the discrimination a broad red cannot give you.',
		source: 'REG-F-199'
	},
	// ── REG-F-199 residue (3): the hierarchy that returned a superset ───────────────────────────────────────────
	{
		id: 'MU-F199-3-withdrawal-keys-on-the-wrong-event',
		file: 'packages/rph-engine/src/professional-work-graph.ts',
		find: "const WITHDRAWING_DECOMPOSITION_EVENT = 'DecompositionRejected';",
		replace: "const WITHDRAWING_DECOMPOSITION_EVENT = 'DecompositionRevised';",
		expectRed: ['packages/rph-engine/src/decomposition-edge-withdrawal.test.ts'],
		why: "THE GUARD IS ONE STRING, so the mutant is that string. Naming a REAL BUT WRONG event keeps every piece of machinery intact — the set is still built, the filter still runs, the types still check — and withdraws the wrong edges, which is the shape a plausible edit actually takes. A nonsense literal would break the build and prove less. \u26a0 The plausible-looking ALTERNATIVE DESIGN, keying on the contract's status being 'INVALID', is the one this fix rejected and the suite's ESCAPE test exists to kill: one accepted ReviseDecomposition moves the contract to SUPERSEDED (handlers/decomposition.ts:491) while the refusal it recorded still stands, so a status-keyed guard resurrects the withdrawn edge. That test fails the status design and passes this one, which is the only reason to prefer it. Observed: KILLED, reddening EXACTLY 1 of the suite’s 4 tests — the guard. Worth recording, because it is counter-intuitive: the ESCAPE test passes ACCIDENTALLY under this mutant, since its own ReviseDecomposition emits DecompositionRevised, the very event the mutant names, so the withdrawal fires for the wrong reason. The two tests are complementary rather than redundant, and neither alone would have caught both designs.",
		source: 'REG-F-199 residue (3)'
	},
	{
		id: 'MU-F199-2-graph-reads-recording-event-disposition',
		file: 'packages/rph-engine/src/professional-work-graph.ts',
		find: "const current = handle.loadObject(p.observationId ?? '')?.state as",
		replace: 'const current = event.payload as',
		expectRed: ['packages/rph-engine/src/professional-work-graph-current-disposition.test.ts'],
		why: "REVERTS THE FIX TO THE TAUTOLOGY IT REPLACED, and the closed-form argument matters more than the red: `disposition` on AssuranceObservationRecorded is a hard-coded 'OPEN' literal at the emitter (handlers/assurance.ts) and NO command transitions the field, so the mutated line is behaviourally IDENTICAL to HEAD for every event the system can currently produce. KILLED_UNNAMED is therefore impossible by construction \u2014 no suite anywhere can tell the difference except one that constructs a WAIVED observation at the seam, which is exactly what the named victim does. That is why this control had to be built by decorating a handle rather than by driving a command: the defect is real and, today, unobservable end to end.",
		source: 'REG-F-199 residue (2) half A'
	},
	// ── REG-F-199 residue (1): the type-blind read, and the CONTROL that keeps its fix honest ──────────────────
	// TWO mutants, one victim each, and BOTH name the DEMO LOADER suite on purpose. The first proves the guard;
	// the second proves the CONTROL inside that same suite — a guard that refused EVERY id would satisfy the
	// refusal test while breaking the page for everyone, and only the control can catch that.
	//
	// \u26a0 OPERATIONAL: `bun run build` MUST precede `bun run mutants` for the first of these. `compileVerdict`
	// picks the tsconfig from `pkgOf(m.file)`, so a mutant in apps/rph-demo compiles under that app's config,
	// which resolves `@janumipwb/rph-engine` through the GITIGNORED `dist/`. Against a stale dist it reports
	// `TS2305: … has no exported member 'getObjectOfType'` and scores NO_COMPILE — a false verdict about the
	// instrument, not the guard. `check-types` is safe because turbo gives it `^build`; `mutants` is not.
	{
		id: 'F199-undertaking-loader-goes-back-to-the-type-blind-read',
		file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts',
		find: "const u = getObjectOfType(engine, 'UNDERTAKING', params.id);",
		replace: 'const u = getObject(engine, params.id);',
		expectRed: ['apps/rph-demo/src/lib/server/undertaking-loader-object-type.test.ts'],
		why: "REVERTS THE LOADER TO THE EXACT LINE THAT SHIPPED THE DEFECT. It is not a synthetic weakening: this is verbatim what the file said before, and it left `/undertakings/<a PWA id>` rendering the PWA's own name as the Undertaking's without throwing, because the existence guard on the next line is satisfied by ANY object. Every other read on the page degrades silently to empty, so nothing downstream turns it into a visible failure \u2014 which is why 135 rph-demo tests and two adversarial reviews of the surface never saw it.",
		source: 'REG-F-199 residue (1)'
	},
	{
		id: 'F199-the-typed-read-refuses-every-id',
		file: 'packages/rph-engine/src/queries.ts',
		find: 'return state?.objectType === objectType ? state : undefined;',
		replace: 'return undefined;',
		expectRed: ['apps/rph-demo/src/lib/server/undertaking-loader-object-type.test.ts'],
		why: "THE CONTROL NEEDS ITS OWN MUTANT (a control that cannot fail is not a control). A seam that refused EVERY id would satisfy the refusal test above perfectly while 404-ing the Undertaking Workbench for every real user. Its victim is deliberately the DEMO LOADER suite and not the engine seam suite, because the assertion that must redden is the CONTROL \u2014 'a real Undertaking id still renders' \u2014 and that control lives with the loader. Measured: reddens the control alone, leaving the refusal test green, which is the opposite polarity from the mutant above and is what makes the pair discriminating rather than redundant.",
		source: 'REG-F-199 residue (1)'
	},
	{
		id: 'MU-TRACKER-03-walk-searches-comments-again',
		file: 'scripts/tracker/measure.ts',
		find: 'if (!cache.has(p)) cache.set(p, stripComments(readFileSync(p, \'utf8\')));',
		replace: "if (!cache.has(p)) cache.set(p, readFileSync(p, 'utf8'));",
		expectRed: ['verif/tracker-ingest.test.ts'],
		why: "PROSE ABOUT A CAPABILITY IS NOT THE CAPABILITY, and this mutant is the day I proved it by accident. A docblock added to queries.ts explaining that getObject 'stands in for four ratified typed queries (getUndertaking, getPwu, getBaseline, getPwaVersion)' flipped all four from ABSENT to DECLARED \u2014 the walk read a sentence ABOUT missing capabilities as evidence they existed. Writing the documentation would have manufactured the implementation. Reverting the strip restores exactly that, and the census leg reddens through its LIVE measure.ts run, which is the second time that live assertion has earned its place. Blast radius when the strip was added, derived over all 118 consumer-walk items: 5 \u2014 the 4 self-inflicted, plus ClaimRejected, which had been scored TESTED since W-3 because its ONLY test mention is a header comment (claim-assessment.test.ts:4) while production emits it (assurance.ts:723).",
		source: 'REG-F-201'
	},
	// ── REG-F-201: the type-blind PWA surfaces, and the permissive default that inverted a guard ───────────────
	{
		id: 'F201-pwa-loader-goes-back-to-the-type-blind-read',
		file: 'apps/rph-demo/src/routes/pwa/[id]/+page.server.ts',
		find: "const pwa = getObjectOfType(engine, 'PROFESSIONAL_WORK_ARCHITECTURE', params.id);",
		replace: 'const pwa = getObject(engine, params.id);',
		expectRed: ['apps/rph-demo/src/lib/server/pwa-surface-object-type.test.ts'],
		why: "REVERTS THE LOADER TO THE LINE THAT SHIPPED IT, verbatim. The consequence is not merely a wrong render: `publicationStatus` exists only on PWAs, so on any other object the loader's own `?? 'DRAFT'` fabricates a draft status, `isDraft` goes true, and the FULL authoring surface unlocks \u2014 more editing surface on a non-PWA than on the genuine seeded PWA, which is PUBLISHED and correctly offers none. Nor is it ULID-gated: `/pwa/floor.reasoning-review`, a module-constant policy id, rendered as a draft PWA named 'Reasoning Review'.",
		source: 'REG-F-201'
	},
	{
		id: 'F201-broker-fabricates-draft-for-any-object',
		file: 'packages/rph-authoring/src/broker.ts',
		find: "const s = getObjectOfType(this.engine, 'PROFESSIONAL_WORK_ARCHITECTURE', this.pwaId);",
		replace: 'const s = getObject(this.engine, this.pwaId);',
		expectRed: ['apps/rph-demo/src/lib/server/pwa-surface-object-type.test.ts'],
		why: "THIS ONE INVERTED AN EXPLICIT GUARD, which is why it is filed separately from the loader rather than as the same defect twice. routes/pwa/[id]/agent/+server.ts refuses unless `publicationStatus === 'DRAFT'` \u2014 a real lifecycle check, correct for real PWAs. With a type-blind read, `getPwa`'s `?? 'DRAFT'` synthesizes exactly the value that guard admits, so it REFUSED THE LEGITIMATE PUBLISHED PWA AND ADMITTED EVERY NON-PWA. Past it lies a persistent process-local authoring turn keyed to a non-PWA id, a forked engine, an external model call, and fork-recorded assurance objects asserting objectType PROFESSIONAL_WORK_ARCHITECTURE about something that is not one.",
		source: 'REG-F-201'
	},
	{
		id: 'F201-broker-asserts-the-wrong-type',
		file: 'packages/rph-authoring/src/broker.ts',
		find: "const s = getObjectOfType(this.engine, 'PROFESSIONAL_WORK_ARCHITECTURE', this.pwaId);",
		replace: "const s = getObjectOfType(this.engine, 'UNDERTAKING', this.pwaId);",
		expectRed: ['apps/rph-demo/src/lib/server/pwa-surface-object-type.test.ts'],
		why: "THE CONTROL NEEDS ITS OWN MUTANT. A broker that asserted the WRONG type would satisfy both refusal tests above perfectly \u2014 non-PWAs still refused \u2014 while breaking authoring for every real PWA. Only the control ('the broker still returns the real PWA, PUBLISHED and not fabricated') can catch that, and it reddens in the opposite direction from its two siblings. \u26a0 It shares an anchor with F201-broker-fabricates-draft-for-any-object by design: the same one line is the whole guard, and the two mutations of it fail in OPPOSITE directions, which is what distinguishes a real assertion from one that merely refuses a lot.",
		source: 'REG-F-201'
	},
	// ── JAN-CSAA total-capability completion: load-bearing fail-closed seams ───────────────────────────────────
	{
		id: 'CSAA-M14-mutation-baseline-admits-an-unstaged-edit',
		file: 'scripts/mutants/tree-baseline.ts',
		find: '\tif (!completedSuccessfully(worktree)) return null;',
		replace: '\tif (false) return null;',
		expectRed: ['verif/mutation-tree-baseline.test.ts'],
		why: 'A staged candidate is safe to mutate only while its tracked worktree still equals the index. Ignoring the worktree comparison would admit a pre-existing edit or a leaked prior mutant as the next measurement baseline.',
		source: 'JAN-CSAA completion review 2026-08-26'
	},
	{
		id: 'CSAA-M15-mutation-baseline-ignores-index-replacement',
		file: 'scripts/mutants/tree-baseline.ts',
		find: '\treturn current !== null && current.indexEntries === baseline.indexEntries;',
		replace: '\treturn current !== null;',
		expectRed: ['verif/mutation-tree-baseline.test.ts'],
		why: 'The staged index is part of the measured subject. Accepting any clean current index would let concurrent staging replace the candidate between mutants while the runner continued to report one coherent mutation result.',
		source: 'JAN-CSAA completion review 2026-08-26'
	},
	// ── REG-D-044 S-1b — the two PWU recomposition arrows, and the first mutants this surface has ever had ──
	// REG-F-194 recorded the general form on the increment before this one: "an increment that added a command, a
	// guard limb, a census idiom and a fail-closed refusal declared ZERO new mutants, so nothing in this gate
	// names any of W-5.5's new logic. The green tells me I broke nothing that was already measured — it says
	// nothing whatever about what I just built." S-1a repeated it. These five are the correction.
	{
		id: 'MU-F085B-begin-accepts-a-contract-for-another-parent',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "\tif (s.parentWorkUnitId !== pwuId) return undefined;",
		replace: "\tif (false && s.parentWorkUnitId !== pwuId) return undefined;",
		expectRed: ['packages/rph-application/src/handlers/pwu-recomposition.test.ts'],
		why: "DROPS THE PARENT-MATCH LIMB, so ANY RecompositionContract in the store discharges §8.1's \"Parent exists\" for ANY PWU. ⚠ THIS IS THE LIMB THAT CARRIES REG-Q-028, which is OPEN: canon does not say whether RECOMPOSING/RECOMPOSED ride on the parent or the child, and its recorded SAFE DEFAULT is parent-owned. Deleting the check does not pick the other side of an open question — it abandons the question, admitting a contract that names neither. `&& ` rather than a bare `if (false)`: the ledger's V-2c lesson records that `if (cond) -> if (false)` makes the block statically dead and tsc then reports 21 such mutants as unreachable-code NO_COMPILE.",
		source: 'REG-D-044 S-1b (REG-Q-028 safe default)'
	},
	{
		id: 'MU-F085B-begin-admits-an-empty-composition',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "\tif ((contract.requiredChildWorkUnitIds ?? []).length === 0) {",
		replace: "\tif ((contract.requiredChildWorkUnitIds ?? []).length < 0) {",
		expectRed: ['packages/rph-application/src/handlers/pwu-recomposition.test.ts'],
		why: "RESTORES THE VACUOUS RUNG one object over from where REG-F-041 S-0 closed it. §8.1's trigger has TWO conjuncts — \"Parent exists AND recomposition is required\" — and this is the second. A contract requiring no children makes every downstream child-acceptability check trivially true, so a parent could enter RECOMPOSING on a composition of nothing. `< 0` rather than deleting the block: it keeps the branch live to the compiler while the condition can never hold, and it is a DIFFERENT mutation from the S-0 pair's `>= 0` so the two cannot be confused in a run summary.",
		source: 'REG-D-044 S-1b (OBJ-1; REG-F-041 S-0 one object over)'
	},
	{
		id: 'MU-F085B-complete-accepts-the-candidate-state',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "\tif (contract.status !== 'SATISFIED') {",
		replace: "\tif (contract.status !== 'COMPOSABLE') {",
		expectRed: ['packages/rph-application/src/handlers/pwu-recomposition.test.ts'],
		why: "THE WHOLE INCREMENT IN ONE LINE, and it is the mutation REG-F-085 said a build agent would be TEMPTED to ship: accept COMPOSABLE and \"silently weaken a ratified guard — substituting 'no contradiction found' for 'contract satisfied'\". Three independent lanes converged on exactly this reading and it was refuted — §8.1's other cross-object rows cite enum literals in the same lowercase participle form. MEASURED, not predicted: reddens the accept case, the COMPOSABLE-refusal case and the fold control; it does NOT redden the ownership control, which is how the two claims are kept distinct.",
		source: 'REG-D-044 Ruling 1'
	},
	{
		id: 'MU-F085B-the-setter-performs-both-arrows-again',
		file: 'packages/rph-application/src/handlers/pwu.ts',
		find: "\tRECOMPOSING: 'BeginPwuRecomposition',\n\tRECOMPOSED: 'CompletePwuRecomposition'",
		replace: "\tRECOMPOSING: 'BeginPwuRecomposition'",
		expectRed: ['verif/recomposition-ungoverned.test.ts'],
		why: "THE CONTROL'S OWN MUTANT, AND IT IS DELIBERATELY NOT A GUARD MUTATION. Every guard above can be perfect while the generic setter still performs both arrows on an empty citation list — which is precisely the state REG-F-085 pinned for twelve days. It also ships HALF THE PAIR, the failure mode the roadmap called worse than doing nothing: `rejectArrowOwnedBySemanticCommand` has no fallback, so RECOMPOSING stays owned while RECOMPOSED becomes settable by anyone. ⚠ ONE VICTIM, AND THE CHOICE IS THE CLAIM: the inverted REG-F-085 pin, whose whole existence is that these two arrows were performable through the setter. The guard tests in pwu-recomposition.test.ts stay GREEN under this mutation — measured — which is the evidence that the ownership record and the guard records are independent rather than one fact asserted twice. A longer expectRed list would have been a LOWER bar.",
		source: 'REG-F-072 / PER-3; feedback: a control needs its own mutant'
	},
	{
		id: 'MU-F085B-the-fold-forgets-both-new-events',
		file: 'packages/rph-projections/src/pwu-replay.ts',
		find: "\t\tcase 'PwuRecompositionBegun':\n\t\tcase 'PwuRecomposed':\n",
		replace: '',
		expectRed: ['packages/rph-application/src/handlers/pwu-recomposition.test.ts'],
		why: "THE OMISSION THIS FILE RECORDS SHIPPING THREE TIMES — W-1 latent, W-4.5 found by accident, W-5 shipped DEAD with 1203 tests green. Without these labels both events fall to `default: return axes` and a replay carries the OLD workLifecycleState forward, diverging the rebuild from the object. ⚠ THE SEED CANNOT CATCH THIS: the §26 reference undertaking never occupies RECOMPOSING or RECOMPOSED, which is exactly why `pwu-fold-drive-sites.test.ts` demands a NAMED drive site and why the victim below is a test that calls `expectPwuReplayEquivalence` after EACH hop rather than only at the end.",
		source: 'REG-F-084 / JAN-PWUWP B-4'
	},
	// ── JAN-CSAAEXT S3 — THE SALVAGED GUARDS EARN THEIR OWN MUTANTS ─────────────────────────────────────────────
	//
	// S1 and S2 reproduced, as JPWB-owned code, two guarantees `csaa:inventory:check` and
	// `scripts/csaa-product-boundary.ts` hold over JPWB today. ⛔ THE DISCRIMINATION PROOF DOES NOT TRAVEL WITH
	// THEM: the incumbent's red-proving corpus is ~1,813 lines written against the ENGINE entry point and leaves
	// with the engine at S6. A guard whose mutants no longer redden is not the same guarantee, so the
	// replacements earn their own here rather than inheriting the incumbent's reputation.
	//
	// ⚠ MUTATING TEST FILES IS DELIBERATE AND HAS PRECEDENT IN THIS LEDGER — see
	// `F096-control-asks-for-the-production-shape`, whose `why` records the reason exactly: *"the guarantee under
	// test is the probe can see the other outcome, and that guarantee lives in the probe."* These guards assert
	// over the repository's OWN STRUCTURE — a file population, a manifest — so there is no production module to
	// mutate. The reader and the predicate ARE the guard.
	//
	// ⛔ ONE ARM IS NOT PROVEN HERE AND SAYING SO IS THE POINT. `targetsCsaa`'s RELATIVE-PATH arm cannot be
	// killed by any mutant against the live tree, because nothing in the tree violates it — that is the guarantee
	// holding. It was proven instead by a probe at `apps/rph-demo/src/lib/__boundary-probe.ts`, driven by hand,
	// recorded in the S2 commit, and never committed. Declaring a mutant for it would produce a SURVIVED verdict
	// that looks like a defect and is not; declaring it `expectSurvive` would be worse, because that field means
	// "behaviour cannot depend on this" and behaviour very much does.
	{
		id: 'CSAAEXT-S1-floor-reader-blinded',
		file: 'verif/assurance-surface.test.ts',
		find: "entry.isFile() && entry.name.endsWith('.test.ts')",
		replace: "entry.isFile() && entry.name.endsWith('.spec.ts')",
		expectRed: ['verif/assurance-surface.test.ts'],
		why: "THE FLOOR'S READER IS WHAT MAKES IT A MEASUREMENT RATHER THAN A CONSTANT. This repository uses `.test.ts` throughout, so blinding the suffix returns ZERO files and the floor must redden — proving the check counts the live population rather than asserting a number against itself. ⚠ NOTE WHICH DIRECTION IS TESTABLE: lowering `VERIF_TEST_FLOOR` silently WEAKENS the guard and reddens nothing, which is a property of every floor and is disclosed in that constant's own comment. A mutant can prove the reader is live; only a reader can prove the floor is current.",
		source: 'JAN-CSAAEXT S1; REG-D-061 D-2'
	},
	{
		id: 'CSAAEXT-S1-command-predicate-inverted',
		file: 'verif/assurance-surface.test.ts',
		find: "typeof scripts[name] !== 'string'",
		replace: "typeof scripts[name] === 'string'",
		expectRed: ['verif/assurance-surface.test.ts'],
		why: 'Inverting the presence predicate reports all seven root commands as missing. Proves the check EVALUATES each name against the parsed manifest rather than returning an empty list by construction — the distinction between a guard that passed and a guard that never ran.',
		source: 'JAN-CSAAEXT S1; salvaged from assertJpwbRequiredRootCommands'
	},
	{
		id: 'CSAAEXT-S1-required-list-emptied',
		file: 'verif/assurance-surface.test.ts',
		find: "] as const;\n\n/** Counted from DISK",
		replace: "].slice(0, 0) as unknown as readonly string[];\n\n/** Counted from DISK",
		expectRed: ['verif/assurance-surface.test.ts'],
		why: "THE HOLE THIS MUTANT WAS WRITTEN TO EXPOSE WAS REAL, AND DECLARING IT IS WHAT FOUND IT. Before S3 the command check computed `missing` and asserted it empty — which is satisfied BOTH when every command is present AND when the required list is empty. A satisfied guard and an absent one were the same observation. The length pin added in the same increment closes it, and this mutant is its proof: emptying the list reddens the PIN while leaving the presence check green. ⭑ The two limbs are independent in both directions — removing a command from `package.json` reddens the presence check and leaves the pin green.",
		source: 'JAN-CSAAEXT S3; feedback: a control that cannot fail'
	},
	{
		id: 'CSAAEXT-S2-specifier-arm-deleted',
		file: 'verif/product-boundary.test.ts',
		find: "\tif (specifier === '@janumipwb/csaa' || specifier.startsWith('@janumipwb/csaa/')) return true;\n",
		replace: '',
		expectRed: ['verif/product-boundary.test.ts'],
		why: "THE ARM THAT OUTLIVES THE MOVE, AND THE ONLY ONE THAT CAN BE KILLED TODAY. `targetsCsaa` has two arms: the npm specifier (`@janumipwb/csaa`) and a relative path resolving inside `packages/csaa`. At S6 the directory leaves and the PATH arm goes permanently dead, making this arm the whole guard. Nothing in the live tree imports CSAA by package name, so this arm could break in total silence — and the third test in that file exists precisely to notice. ⭑ OBSERVED BY HAND BEFORE DECLARING: reddens the third test ALONE, `1 failed | 2 passed`, with the boundary check and the inspected-floor both green. A control that only reddens alongside its subject proves nothing about the subject; this one reddens while its subject stays green.",
		source: 'JAN-CSAAEXT S2; REG-F-389'
	},
	{
		id: 'CSAAEXT-S2-walk-blinded',
		file: 'verif/product-boundary.test.ts',
		find: 'const SOURCE = /\\.[cm]?[jt]sx?$|\\.svelte$/;',
		replace: 'const SOURCE = /\\.never-matches-any-real-source-file$/;',
		expectRed: ['verif/product-boundary.test.ts'],
		why: "A WALK THAT INSPECTS NOTHING FINDS NO VIOLATIONS, AND THAT IS THE FAILURE THIS PERIMETER WAS BUILT AGAINST. `REG-F-389` is exactly this shape one level up: `depcruise packages` reported no violations because it never scanned `apps/`, and the absence of a violation and the absence of a scan were the same observation. Blinding the source pattern drops the inspected count from 548 to 0, which must redden the INSPECTED_FLOOR while the boundary check stays green — because with no files walked there is genuinely nothing to violate. ⭑ That asymmetry is the proof: the floor is the only limb that can tell an empty perimeter from a clean one.",
		source: 'JAN-CSAAEXT S2; REG-F-389'
	},
	// ── JAN-PFA S0.1 — the two halves of BLOCKING_SEVERITIES, which nothing asserted until 2026-09-12 ────────
	// The pilot's PILOT-01 mutation (A below) survived the ENTIRE suite: 358 files, 3,614 tests, zero failures,
	// in a file at 85.34% branch coverage. A and B redden DIFFERENT limbs of the same round-trip and were
	// observed doing so — that separation is the evidence the pair is two checks rather than one wearing two
	// names, which is what the first draft of the admitting limb actually was.
	{
		id: 'MU-PFA-S01-A-drop-critical-from-the-blocking-set',
		file: 'packages/rph-assurance/src/assurance-rules.ts',
		find: "\t'BLOCKING',\n\t'CRITICAL'\n]);",
		replace: "\t'BLOCKING'\n]);",
		expectRed: ['packages/rph-assurance/src/assurance-rules.test.ts'],
		why: 'BLOCKING_SEVERITIES exists so a ratified severityIfNotMet is answered the SAME way the §10.3 ladder answers it. Dropping CRITICAL makes an open critical finding non-blocking for every caller that asks the set instead of re-deciding — handlers/assurance.ts, handlers/reject-authorization.ts, validators.ts. Observed: reddens ONLY "every severity the ladder rejects on IS in the set"; the other three limbs stay green.',
		source: 'JAN-PFA S0.1; REG-F-391'
	},
	{
		id: 'MU-PFA-S01-B-widen-the-blocking-set-with-material',
		file: 'packages/rph-assurance/src/assurance-rules.ts',
		find: "\t'BLOCKING',\n\t'CRITICAL'\n]);",
		replace: "\t'BLOCKING',\n\t'CRITICAL',\n\t'MATERIAL'\n]);",
		expectRed: ['packages/rph-assurance/src/assurance-rules.test.ts'],
		why: 'THE ADMITTING HALF — a guard that only ever refuses is not a guard (MU-FRESH-18-B\'s recorded shape). A set that blocked MATERIAL, which the ladder only CONDITIONALLY_SATISFIES, would satisfy the "nothing is missing" limb completely while quietly hardening assurance. Observed: reddens ONLY "every severity IN the set genuinely forces REJECTED"; the missing-member limb stays green.',
		source: 'JAN-PFA S0.1; REG-F-391'
	},
	// ── JAN-PFA S0.2 — canPromoteBaseline's AUTHORITY conjunct ──────────────────────────────────────────────
	// A survived the ENTIRE suite (358 files, 3,614 tests, zero failures) in a file at 95.31% branch coverage.
	// Its three sibling conjuncts were all proved — the STATUS limb by the test directly above the new one, the
	// KIND and SCOPE limbs elsewhere — so the gap was a single unasserted limb inside a well-tested predicate.
	// ⚠ ALL FOUR LIMBS PUSH THE SAME CODE AND THE SAME DETAIL, so no assertion on the finding can say which one
	// fired. The victim test is therefore a DIFFERENTIAL — one field flipped on an otherwise identical input —
	// and these two mutants are what prove it discriminates on the authority field specifically.
	{
		id: 'MU-PFA-S02-A-promotion-drops-the-authority-requirement',
		file: 'packages/rph-domain/src/governance.ts',
		find: "d.authorityHeld &&\n\t\t(d.decisionType === 'PROMOTE_BASELINE'",
		replace: "(d.decisionType === 'PROMOTE_BASELINE'",
		expectRed: ['packages/rph-domain/src/governance.test.ts'],
		why: 'RPH-BAS-006 requires an effective, AUTHORITY-BACKED PROMOTE_BASELINE/APPROVAL decision — a commit is not a baseline, and neither is an unbacked decision. Dropping the conjunct promotes a baseline to AUTHORITATIVE on a decision whose actor held no authority, which also silently re-arms REG-F-073 downstream because rejectUnbackedBaselining gates on exactly that status. Observed: reddens ONLY the new differential test; the STATUS-limb test and the happy path stay green.',
		source: 'JAN-PFA S0.2; REG-F-391'
	},
	{
		id: 'MU-PFA-S02-B-invert-the-authority-conjunct',
		file: 'packages/rph-domain/src/governance.ts',
		find: "d.authorityHeld &&\n\t\t(d.decisionType === 'PROMOTE_BASELINE'",
		replace: "!d.authorityHeld &&\n\t\t(d.decisionType === 'PROMOTE_BASELINE'",
		expectRed: ['packages/rph-domain/src/governance.test.ts'],
		why: 'THE ADMITTING HALF — a gate that refused every promotion would satisfy the refusal assertion completely (MU-FRESH-18-B\'s recorded shape). Inverting the conjunct refuses the authority-backed promotion and admits the unbacked one, so it attacks the differential from the opposite side: A proves the test notices a MISSING refusal, B proves it notices a WRONGLY WITHHELD admission.',
		source: 'JAN-PFA S0.2; REG-F-391'
	},
	// ── JAN-PFA S0.3 — RphErrorSchema is CLOSED, in a file at 100% BRANCH COVERAGE ──────────────────────────
	// A survived the ENTIRE suite (358 files, 3,614 tests, zero failures). The file was FULLY covered: every
	// existing assertion checked what the schema ACCEPTS, and strictness is only observable in what it REFUSES.
	// ⭐ It is the cleanest exhibit this programme produced for "coverage counts execution, not assertion".
	{
		id: 'MU-PFA-S03-A-widen-the-error-shape-to-accept-unknown-keys',
		file: 'packages/rph-contracts/src/errors.ts',
		find: 'export const RphErrorSchema = z.strictObject({',
		replace: 'export const RphErrorSchema = z.object({',
		expectRed: ['packages/rph-contracts/src/errors.test.ts'],
		why: 'RphError is the serialized error carried in CommandResult.error and in event/observation payloads, and is PUBLISHED to clients as schemas/objects/RphError.json with additionalProperties:false. Widening strictObject to object accepts untrusted extra fields at a boundary the contract declares shut, and leaves the published schema describing an enforcement that no longer happens. Observed: reddens ONLY the new closed-shape test.',
		source: 'JAN-PFA S0.3; REG-F-391'
	},
	{
		id: 'MU-PFA-S03-B-make-the-error-shape-refuse-every-real-error',
		file: 'packages/rph-contracts/src/errors.ts',
		find: '\tcorrelationId: z.string()\n});',
		replace: '\tcorrelationId: z.string().min(500)\n});',
		expectRed: ['packages/rph-contracts/src/errors.test.ts'],
		why: 'THE ADMITTING HALF — a schema that refused EVERY object would satisfy the unknown-key rejection completely (MU-FRESH-18-B\'s recorded shape). Requiring a 500-character correlationId makes the shape reject an error this package itself constructs, so A proves the test notices a shape gone too LOOSE and B proves it notices one gone too TIGHT. ⚠ THE OBVIOUS FORM WAS WITHDRAWN AFTER MEASUREMENT: adding a required FIELD reported NO_COMPILE, because the inferred type is consumed by makeRphError — this ledger header\'s own trap 1, mutate the CONSEQUENCE rather than the declaration. Tightening an existing field at runtime leaves every static type identical.',
		source: 'JAN-PFA S0.3; REG-F-391'
	},
	// ── JAN-PFA R1 — the per-file coverage ratchet, one mutant per limb ─────────────────────────────────────
	// FIVE limbs, FIVE mutants, and each was observed reddening EXACTLY ONE test with the other four green.
	// That separation is the entire claim: a per-file mechanism whose limbs fail together is one check wearing
	// several names, and it cannot tell a regressed file from a new one — the distinction it exists to make.
	{
		id: 'MU-PFA-R1-A-neutralise-the-ratchet-limb',
		file: 'scripts/coverage-floor.ts',
		find: '\t\tif (now > then)',
		replace: '\t\tif (now > then + 1000)',
		expectRed: ['verif/coverage-floor.test.ts'],
		why: 'The RATCHET limb is the whole guarantee that a file may not add uncovered code. Slackening the comparison by 1000 lets any realistic regression through while the check still reports success. Observed: reddens ONLY the FLOOR_REGRESSED test; both population limbs and the blinded-reader limb stay green.',
		source: 'JAN-PFA R1 S1.2'
	},
	{
		id: 'MU-PFA-R1-B-blind-the-population-limb-to-new-files',
		file: 'scripts/coverage-floor.ts',
		find: 'const added = Object.keys(measured).filter((f) => !(f in recorded)).sort();',
		replace: 'const added = Object.keys(measured).filter(() => false).sort();',
		expectRed: ['verif/coverage-floor.test.ts'],
		why: 'A BRAND-NEW FILE FULL OF UNCOVERED CODE CANNOT REGRESS AGAINST A BASELINE THAT HAS NEVER HEARD OF IT, so the ratchet limb has nothing to say about it and this limb is the only thing standing between the mechanism and its own largest hole. Observed: reddens ONLY the new-file test; the ratchet limb stays green, which is exactly the point.',
		source: 'JAN-PFA R1 S1.2'
	},
	{
		id: 'MU-PFA-R1-C-blind-the-population-limb-to-vanished-files',
		file: 'scripts/coverage-floor.ts',
		find: 'const removed = Object.keys(recorded).filter((f) => !(f in measured)).sort();',
		replace: 'const removed = Object.keys(recorded).filter(() => false).sort();',
		expectRed: ['verif/coverage-floor.test.ts'],
		why: 'A file silently dropping OUT of the measured population is how a weak file stops being counted without anyone deleting it — the coverage analogue of the CSAA denominator defect this whole programme began with. Declared separately from B because the two halves of POPULATION_CHANGED are independent and were observed failing independently.',
		source: 'JAN-PFA R1 S1.2'
	},
	{
		id: 'MU-PFA-R1-D-blind-the-reader-to-a-missing-summary',
		file: 'scripts/coverage-floor.ts',
		find: '\tif (!existsSync(summaryPath))',
		replace: '\tif (false && !existsSync(summaryPath))',
		expectRed: ['verif/coverage-floor.test.ts'],
		why: 'THE CONTROL-THAT-CANNOT-FAIL, DECLARED RATHER THAN HOPED FOR. This check runs immediately after `test:coverage`, so "the coverage run did not happen" is a live possibility, and a checker that reads an absent summary as "no regressions" passes precisely when it has measured nothing. This repository has shipped that shape more than once; here it is a named mutant.',
		source: 'JAN-PFA R1 S1.2'
	},
	{
		id: 'MU-PFA-R1-E-accept-an-empty-population',
		file: 'scripts/coverage-floor.ts',
		find: '\tif (Object.keys(out).length === 0)',
		replace: '\tif (Object.keys(out).length < 0)',
		expectRed: ['verif/coverage-floor.test.ts'],
		why: 'A summary reporting ZERO files makes every per-file assertion vacuously true — the same vacuity as a blinded reader, arriving through a summary that exists and is empty rather than one that is absent. Both doors are guarded because closing only the obvious one is how the shape survives.',
		source: 'JAN-PFA R1 S1.2'
	},
	// ── JAN-PFA R2 — change-scoped mutation's pure core ─────────────────────────────────────────────────────
	// The last two entries are REGRESSION mutants for defects this feature actually shipped and then had
	// removed, both found by RUNNING it rather than reading it, and both in the classifier that decides whether
	// a finding is being claimed at all. They are declared because a defect found that way returns the moment
	// the reasoning that produced it is repeated.
	{
		id: 'MU-PFA-R2-A-drop-pure-deletion-hunks',
		file: 'scripts/mutants/scope-core.ts',
		find: 'hunks.push({ file, startLine: start, endLine: count === 0 ? start : start + count - 1 });',
		replace: 'hunks.push({ file, startLine: start, endLine: start + count - 1 });',
		expectRed: ['verif/mutants-scope.test.ts'],
		why: 'A `+0` hunk is a PURE DELETION and has no lines on the new side; the arithmetic yields an end BEFORE the start, so the region can never overlap a guard and the edit becomes invisible. Deleting a guarded block is the edit most likely to remove a guarantee, so it is the last shape this reader may be blind to.',
		source: 'JAN-PFA R2 S2.1'
	},
	{
		id: 'MU-PFA-R2-B-accept-an-ambiguous-anchor',
		file: 'scripts/mutants/scope-core.ts',
		find: '\tif (hits !== 1) return `anchor occurs ${hits} times (expected exactly 1)`;',
		replace: '\tif (hits < 1) return `anchor occurs ${hits} times (expected exactly 1)`;',
		expectRed: ['verif/mutants-scope.test.ts'],
		why: 'An anchor matching twice means the ledger cannot say WHERE the guard is. Taking the first match invents a location, and the intersection then reports a diff as guarded or unguarded on the strength of a guess. Absent and ambiguous are both "cannot decide" and must both be refused.',
		source: 'JAN-PFA R2 S2.1'
	},
	{
		id: 'MU-PFA-R2-C-miss-boundary-line-touches',
		file: 'scripts/mutants/scope-core.ts',
		find: '\tfile === hunk.file && range.startLine <= hunk.endLine && hunk.startLine <= range.endLine;',
		replace: '\tfile === hunk.file && range.startLine < hunk.endLine && hunk.startLine < range.endLine;',
		expectRed: ['verif/mutants-scope.test.ts'],
		why: 'The first and last lines of an anchor are part of the guard. An off-by-one at the boundary silently reclassifies an edit to the first line of a guarded region as UNGUARDED — the false all-clear, which is worse than no signal because it is reported as reassurance.',
		source: 'JAN-PFA R2 S2.1'
	},
	{
		id: 'MU-PFA-R2-D-claim-a-verdict-from-a-run-that-produced-none',
		file: 'scripts/mutants/scope-core.ts',
		find: "\tconst reachedAVerdict = transcript.includes('MUTATION LEDGER SUMMARY');",
		replace: '\tconst reachedAVerdict = true;',
		expectRed: ['verif/mutants-scope.test.ts'],
		why: 'REGRESSION MUTANT FOR A DEFECT THIS FEATURE SHIPPED. The classifier first read `status !== 0` alone and announced BROKEN GUARANTEE when the runner had ABORTED on a dirty tree — a finding about a mutation that was never applied. The rule that survived is that a verdict is claimed only when the runner demonstrably reached one.',
		source: 'JAN-PFA R2 S2.3'
	},
	{
		id: 'MU-PFA-R2-E-match-aborted-dirty-as-a-bare-substring',
		file: 'scripts/mutants/scope-core.ts',
		find: '/ABORTED_DIRTY\\s+[1-9]/.test(transcript)',
		replace: '/ABORTED_DIRTY/.test(transcript)',
		expectRed: ['verif/mutants-scope.test.ts'],
		why: 'REGRESSION MUTANT FOR THE FIX TO THE DEFECT ABOVE, WHICH WAS ITSELF A DEFECT AND A WORSE ONE. The runner\'s summary prints one row per verdict kind, so every HEALTHY run contains the literal `ABORTED_DIRTY 0`; matching it as a substring classified a genuinely SURVIVED mutant as "the instrument did not run", suppressing the exact finding this command exists to raise. A false positive gets investigated; this false negative is silent.',
		source: 'JAN-PFA R2 S2.3'
	},
	// ── JAN-PFA R3 — the export-guard census and ratchet ────────────────────────────────────────────────────
	// Three JUDGMENTS decide this census, and each was wrong once before it was measured: what counts as a
	// CONSUMER, what counts as a FILE, and what counts as a FINDING. Between them they moved the obligation by
	// hundreds of exports. A census whose predicates carry no mutant is a number nobody can defend.
	{
		id: 'MU-PFA-R3-A-count-colocated-tests-as-production',
		file: 'scripts/export-guard-core.ts',
		find: "\t!/[.](test|spec)[.](ts|tsx)$/.test(path) && !path.includes('/verif/') && !path.includes('/scripts/');",
		replace: "\t!path.includes('/verif/') && !path.includes('/scripts/');",
		expectRed: ['verif/export-guard.test.ts'],
		why: 'REGRESSION MUTANT FOR THE DEFECT THIS PREDICATE SHIPPED. It first asked "is this path under packages/?" — an INTRINSIC property — and so counted a colocated foo.test.ts as a production consumer, inflating the obligation by ~50 exports. The question is RELATIONAL: is this consumer a test? An export whose only importer is its own test makes no promise to the system.',
		source: 'JAN-PFA R3 S3.1; REG-F-391'
	},
	{
		id: 'MU-PFA-R3-B-read-the-generated-banner-from-anywhere',
		file: 'scripts/export-guard-core.ts',
		find: '\t/^\\/\\/ GENERATED FILE\\b/m.test(text.slice(0, 400));',
		replace: '\t/^\\/\\/ GENERATED FILE\\b/m.test(text);',
		expectRed: ['verif/export-guard.test.ts'],
		why: 'Generated files are excused the obligation because a declared mutant is an anchored hand-edit that rots on the next regeneration, and because the guarantee lives in the GENERATOR rather than the emitted constant. Reading the banner from anywhere lets a passing mention deep inside a hand-written file excuse it silently — an exemption granted by a substring.',
		source: 'JAN-PFA R3 S3.1'
	},
	{
		id: 'MU-PFA-R3-C-neutralise-the-guard-lost-limb',
		file: 'scripts/export-guard-core.ts',
		// ⚠ RE-ANCHORED 2026-09-12 when the limb became PER-EXPORT. The old anchor compared per-FILE mutant
		// COUNTS; that comparison no longer exists, and re-anchoring in the same commit as the move is this
		// repository's rule precisely because an UNANCHORED mutant is a claim nobody can perform any more.
		find: '\t\t\tif (stillPresent.has(exported) && !nowGuarded.has(exported))',
		replace: '\t\t\tif (!stillPresent.has(exported) && !nowGuarded.has(exported))',
		expectRed: ['verif/export-guard.test.ts'],
		why: 'The ratchet limb is the whole guarantee that a file may not SHED a guard it earned. Slackening it by 100 lets any realistic loss through while the check still reports success — and a guard silently removed is worse than one never written, because the census still claims it.',
		source: 'JAN-PFA R3 S3.2'
	},
	{
		id: 'MU-PFA-R3-D-compare-the-export-set-by-length',
		file: 'scripts/export-guard-core.ts',
		find: '\t\tif (was !== is)',
		replace: '\t\tif (before.consumedExports.length !== now.consumedExports.length)',
		expectRed: ['verif/export-guard.test.ts'],
		why: 'A RENAME AT EQUAL COUNT IS STILL A MOVE. Comparing lengths lets a guarded export be swapped for an unguarded one with the obligation unchanged and nothing said — the census would go on asserting a promise about a name that no longer exists.',
		source: 'JAN-PFA R3 S3.2'
	},
	{
		id: 'MU-PFA-R3-E-let-a-surplus-offset-a-deficit',
		file: 'scripts/export-guard-core.ts',
		find: '\t\towed += bare;',
		replace: '\t\towed += bare - entry.unattributedMutants;',
		expectRed: ['verif/export-guard.test.ts'],
		why: 'A file carrying extra guards does not discharge another file\'s promise. Summing signed shortfalls lets a heavily-guarded file conceal an unguarded one — THE AVERAGING DEFECT THIS ENTIRE PROGRAMME EXISTS TO REMOVE, reappearing inside the instrument that measures it.',
		source: 'JAN-PFA R3 S3.2'
	},
	{
		id: "MU-PFA-BD1-10-noop-child-picks-a-sink",
		file: "packages/rph-ports/src/defaults/logger.ts",
		find: "\toverride child(_bindings: LogFields): Logger {\n\t\treturn this;\n\t}",
		replace: "\toverride child(_bindings: LogFields): Logger {\n\t\treturn consoleLogger();\n\t}",
		expectRed: ["packages/rph-ports/src/defaults/logger.test.ts"],
		why: "NoopLogger is the library's silent default: the Logger port states \"Default is a no-op - the library never picks a sink\", and the class doc promises it \"discards everything\". child() returning `this` is the seam that makes that silence hereditary - every logger derived from the default must still discard. CommandBus takes `deps.logger ?? new NoopLogger()` and hands that logger to every command handler via HandlerContext, so a NoopLogger whose child picks the console sink makes the engine write diagnostic JSON to the host's stdout/stderr with no host opt-in, the exact thing the port forbids.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-07-stale-revision-commit-reports-success",
		file: "packages/rph-persistence/src/sqlite-storage-adapter.ts",
		find: "\t\t\t} else if (actualRevision !== input.expectedRevision) {\n\t\t\t\treturn { ok: false, reason: 'REVISION_CONFLICT', actualRevision };\n\t\t\t}",
		replace: "\t\t\t} else if (actualRevision !== input.expectedRevision) {\n\t\t\t\treturn { ok: true };\n\t\t\t}",
		expectRed: ["packages/rph-persistence/src/sqlite-storage-adapter.test.ts"],
		why: "Breaks the optimistic-concurrency contract `StorageAdapter.commit` publishes to its single caller (the command bus): when `expectedRevision` does not match the stored revision the store SHALL refuse with `{ok:false, reason:'REVISION_CONFLICT'}`. The mutant keeps the detection but converts the refusal into an admission — the adapter still writes nothing (no state, no version row, no event, no outbox row, no receipt) yet reports `ok:true`, so the engine treats a lost update as a durable commit and the conflict is never surfaced.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-02-empty-guard-swallows-one-type-graph",
		file: "packages/rph-authoring/src/lint.ts",
		find: "\tif (types.length === 0) return findings;",
		replace: "\tif (types.length <= 1) return findings;",
		expectRed: ["packages/rph-authoring/src/lint.test.ts"],
		why: "lintComposition promises its consumers that an empty result means the graph WAS examined and is structurally clean (\"empty = clean\"); the agent's review_composition tool reports \"No structural issues — the decomposition looks clean\" and stops the moment findings.length === 0, and apps/rph-demo/src/routes/pwa/[id]/+page.server.ts renders that same list to the professional. Widening the nothing-to-lint guard past the genuinely empty graph makes an unexamined one-type graph (missing root, undeclared workDischarge) report clean to both, so the instrument's silence stops meaning \"I looked\".",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-05-transaction-does-not-roll-back",
		file: "packages/rph-persistence/src/sql-driver.ts",
		find: "\t\ttransaction: <T>(fn: () => T): T => db.transaction(fn)(),",
		replace: "\t\ttransaction: <T>(fn: () => T): T => fn(),",
		expectRed: ["packages/rph-persistence/src/sqlite-storage-adapter.test.ts"],
		why: "createSqliteDriver is the production SqlDriver, and the guarantee its interface states in so many words is `Run fn inside a single transaction; commit on return, roll back on throw`. Running fn bare in autocommit keeps every statement that succeeded before the throw, so SqliteStorageAdapter.commit is no longer all-or-nothing — the exact atomicity CommandBus.dispatchBatch, the replay guard, pwa-authoring's two-aggregate version bump, and the schema-migration ladder all rely on to never leave a half-written store.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-08-retention-class-key-identity",
		file: "packages/rph-ports/src/artifact-store-contract.ts",
		find: "expect(volunteered.storageKey).not.toBe(participating.storageKey);",
		replace: "expect(volunteered.storageKey).toBe(participating.storageKey);",
		expectRed: ["packages/rph-ports/src/defaults/artifact-store.test.ts"],
		why: "The suite's promise to every adapter that runs it is that it REJECTS a key derivation which omits retention class — the REG-F-337 PER-8 hard-delete vector the file's own header names as its reason for being shared rather than copied ('that defect is a property of the KEY DERIVATION, so every adapter can reproduce it independently'). Inverted, the contract instead DEMANDS that a PURGEABLE re-put of participating bytes address the same entry, so it would certify exactly the downgrade-then-purge vector and reject a correct adapter; both createInMemoryArtifactStore and SqliteArtifactStore rely on this single assertion as their only proof that retention class is part of storage identity.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-04-overlay-reads-canonical-after-the-fork",
		file: "packages/rph-persistence/src/snapshot-overlay-storage-adapter.ts",
		find: "\t\tconst object = this.stagedObjects.get(id) ?? this.baseObjects.get(id);",
		replace: "\t\tconst object =\n\t\t\tthis.stagedObjects.get(id) ?? this.baseObjects.get(id) ?? this.source.loadObject(id);",
		expectRed: ["packages/rph-engine/src/engine.test.ts"],
		why: "The class's first documented promise — \"the canonical adapter is consulted ONLY during construction to capture the base snapshot\" — is what makes a fork POINT-IN-TIME, and it is the whole reason `EngineHandle.fork()` can hand an authoring turn (apps/rph-demo/src/lib/server/authoring-turn.ts, the /pwa/[id] candidate page) a candidate it may reason about as an exact, frozen fork. Falling `loadObject` through to the live source lets a canonical write made AFTER the fork appear inside the candidate, so the agent authors against — and the human reviews — a state the candidate never actually contains, and the replay's expectedRevision/contentHash guards are then computed off canonical's moving revision rather than off the snapshot they were taken from. (This is the same fall-through the sibling `getReceipt` carries an explicit comment refusing.)",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-12-error-ranks-below-warn",
		file: "packages/rph-ports/src/ports/logger.ts",
		find: "\terror: 40,",
		replace: "\terror: 5,",
		expectRed: ["packages/rph-ports/src/defaults/logger.test.ts"],
		why: "LOG_LEVEL_ORDER promises a single MONOTONIC severity ranking (debug<info<warn<error<fatal) that is the only thing any level-threshold filter compares against; StructuredLogger.log encodes that promise as `LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel] -> drop`, so a host configuring minLevel 'warn' or 'info' relies on error/fatal records always clearing the gate. Ranking error below warn inverts the order and makes the filter silently discard the highest-severity diagnostics while still emitting the noise beneath them.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-03-schema-sql-recreates-existing-tables",
		file: "packages/rph-persistence/src/schema.ts",
		find: "CREATE TABLE IF NOT EXISTS command_receipts (",
		replace: "CREATE TABLE command_receipts (",
		expectRed: ["packages/rph-persistence/src/durability.test.ts"],
		why: "SCHEMA_SQL promises every statement is CREATE … IF NOT EXISTS, so running it against an ALREADY-POPULATED store is a no-op — the guarantee that lets SqliteStorageAdapter exec it unconditionally in its constructor on every open and lets a migration only ever ALTER. Any durable store (apps/rph-demo opens one by filename) then fails to reopen at all.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-03-version-understates-the-shape-it-stamps",
		file: "packages/rph-persistence/src/schema.ts",
		find: "export const SCHEMA_VERSION = 2;",
		replace: "export const SCHEMA_VERSION = 1;",
		expectRed: ["packages/rph-persistence/src/schema-migration.test.ts"],
		why: "SCHEMA_VERSION promises to name the shape SCHEMA_SQL actually builds, so that the adapter's version gate can tell an out-of-date store from a current one; understating it declares every v1 store already current, the v1→v2 ladder becomes unreachable, and the engine reads a store missing payload_hash while believing it understands it — the exact silent misread user_version exists to prevent.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-03-ladder-skips-a-missing-step",
		file: "packages/rph-persistence/src/schema.ts",
		find: "\t\t\tthrow new Error(\n\t\t\t\t`RPH persistence: no forward migration registered from schema version ${v} to ${v + 1} ` +\n\t\t\t\t\t`(migrating ${from} → ${to}). Refusing to open — an engine must not read a store whose shape ` +\n\t\t\t\t\t`it cannot account for.`\n\t\t\t);",
		replace: "\t\t\tcontinue;",
		expectRed: ["packages/rph-persistence/src/schema-migration.test.ts"],
		why: "planMigration promises to REFUSE a gap in the ladder rather than skip it; turning the refusal into a silent skip lets SqliteStorageAdapter stamp a store at SCHEMA_VERSION having never run the step that would have given it that shape, which is the unknown-schema misread the version gate exists to stop.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-09-per8-purge-guard-inverted",
		file: "packages/rph-ports/src/defaults/artifact-store.ts",
		find: "\t\t\tif (entry.meta.purgeability === 'RETAINED_BY_PARTICIPATION')",
		replace: "\t\t\tif (entry.meta.purgeability === 'PURGEABLE_AT_EXPIRY')",
		expectRed: ["packages/rph-ports/src/defaults/artifact-store.test.ts"],
		why: "The store's reason for existing is the PARTICIPATION-GUARDED purge: PER-8 holds that content that has participated in execution, assurance, governance, a baseline or traceability is never hard-deleted, so purge() must REFUSE for RETAINED_BY_PARTICIPATION and succeed only for PURGEABLE_AT_EXPIRY. Inverting which class the guard recognises turns the default ArtifactStore into the hard-delete vector it was written to prevent — the exchange-capture and work-product-floor callers that store participating evidence behind this seam rely on that refusal, and the durable adapter is specified against it.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-01-architecture-blueprint-skips-the-behavior-handoff",
		file: "packages/rph-authoring/src/catalog.ts",
		find: "\t\tpurpose: 'A coherent technical structure realizing approved behavior.',\n\t\trequiredInputs: ['approved-behavior'],",
		replace: "\t\tpurpose: 'A coherent technical structure realizing approved behavior.',\n\t\trequiredInputs: ['product-definition'],",
		expectRed: ["packages/rph-authoring/src/broker.test.ts"],
		why: "The catalog's stated promise to its consumers is that the requiredInputs/requiredOutputs of its blueprints line up into the canonical §7 hand-off chain, so a scaffolded graph shows the right data-flow edges out of the box. Re-pointing Architecture Definition's input at the artifact Intent & Product Definition produces silently routes it around Product Behavior Definition entirely: every copy-on-use graph still draws a plausible edge, but one that skips a whole work area's approved behavior.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-01-lookup-returns-a-blueprint-it-was-not-asked-for",
		file: "packages/rph-authoring/src/catalog.ts",
		find: "\treturn PWU_TYPE_CATALOG.find((t) => t.key === key);",
		replace: "\treturn PWU_TYPE_CATALOG.find((t) => t.key !== key);",
		expectRed: ["packages/rph-authoring/src/broker.test.ts"],
		why: "catalogTemplate's whole promise is key-to-blueprint identity: a key a consumer obtained from the catalog itself (the form's `<option value={t.key}>`, the agent tool's templateKey) resolves to THAT blueprint, and to nothing at all if no entry carries it. The mutant hands back a neighbouring blueprint instead of refusing, so defineFromTemplate reports success while instantiating a PWU Type — kind, purpose and hand-offs — that the professional or agent never chose.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-06-durable-store-is-silently-process-local",
		file: "packages/rph-persistence/src/sqlite-artifact-store.ts",
		find: "\t\tthis.db = opts.driver ?? createSqliteDriver(opts.filename);",
		replace: "\t\tthis.db = opts.driver ?? createSqliteDriver();",
		expectRed: ["packages/rph-persistence/src/sqlite-artifact-store.test.ts"],
		why: "SqliteArtifactStore's whole reason for existing over the in-memory default is that the bytes it stores survive a process restart, which is why it declares durability = 'DURABLE'. Dropping the caller's filename silently backs every instance with a private ':memory:' database, so the class keeps CLAIMING DURABLE while behaving PROCESS_LOCAL — exactly REG-F-342's inverse orphan, where a permanent ARTIFACT record names a storageKey whose content a restart erased and the record still looks intact. getArtifactStore() in apps/rph-demo passes `{ filename: `${DB_PATH}.content.sqlite` }` and relies on that argument being honoured.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-11-credential-narrowing-collapses-distinct-sessions",
		file: "packages/rph-ports/src/ports/authentication.ts",
		find: "\treturn raw as Credential;",
		replace: "\treturn raw.slice(0, 4) as Credential;",
		expectRed: ["apps/rph-demo/src/lib/server/floor-recording.test.ts"],
		why: "asCredential is the trust boundary's ONE narrowing point and its runtime guarantee is that the branded value IS the host's bearer string verbatim — so two different host sessions remain two different credentials. apps/rph-demo/src/lib/server/identity.ts relies on exactly that: it keys the PRINCIPALS directory with the results and hands the same values to engine.as(), so a narrowing point that normalises the string collapses the human session, the authoring agent, the seeder and the reference owner onto one key and every recorded act names the same principal — the 'who did what' loss REG-F-054/REG-F-056 exist to prevent.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	{
		id: "MU-PFA-BD1-01-completion-rule-reclaims-a-guarantee-nothing-makes",
		file: "packages/rph-authoring/src/catalog.ts",
		find: "\tcompletionRule:\n\t\t'Your statement of when work of this type is DONE. RECORDED AND SHOWN, not evaluated — no gate reads it, ' +\n\t\t'and editing it changes no outcome. What actually holds a PWU back is its assurance: the locked floor plus ' +\n\t\t'the policies selected by this type\\u2019s kind and declared policy ids.',",
		replace: "\tcompletionRule:\n\t\t'When an Instance of this type is DONE. ENFORCED AT COMPLETION: an Instance cannot be marked DONE ' +\n\t\t'until the completion gate evaluates this rule and finds it met.',",
		expectRed: ["verif/authoring-field-disposition.test.ts"],
		why: "PWU_TYPE_HELP is the text BOTH authors of a PWU Type read — the professional at the inspector form and the agent holding the tool schema — and its EG-06 guarantee is that a field measured as UNENFORCED admits so in the words the reader sees. completionRule is evaluated by nothing; re-attaching the real \"no green without assurance\" guarantee to that inert textbox leaves both readers confident and wrong, which is worse than leaving them uninformed. ⚠ ITS ANCHOR IS EXTRACTED FROM THE FILE, NOT RETYPED: the source carries the literal escape sequence backslash-u2019, and an author reproducing the RENDERED apostrophe produces an anchor that matches nothing.",
		source: "JAN-PFA R3 S3.3 burn-down increment 1"
	},
	// ── JAN-PFA R3 S3.3 — the provider stamp, which NOTHING asserted until this increment ───────────────────
	// The burn-down could not declare a mutant for SQLITE_STORAGE_PROVIDER: no test in the repository touched
	// it, so every mutation would have SURVIVED. The agent authoring this file said so rather than inventing a
	// token, which is the honest answer and is itself the finding. These two entries exist because a test was
	// written first. ⭑ B is the mutation A CANNOT catch — both sides of A's comparison move together.
	{
		id: 'MU-PFA-BD1-06-ref-carries-a-provider-that-is-not-this-store',
		file: 'packages/rph-persistence/src/sqlite-artifact-store.ts',
		find: 'return { storageProvider: SQLITE_STORAGE_PROVIDER, storageKey, contentHash, byteSize };',
		replace: "return { storageProvider: 'jpwb:in-memory', storageKey, contentHash, byteSize };",
		expectRed: ['packages/rph-persistence/src/sqlite-artifact-store.test.ts'],
		why: 'The provider on a StoredArtifactRef is how the ref says WHICH store holds its bytes, so a later get or purge can be routed to it. Stamping another store\'s identifier makes every durable ref claim to live in a process-local store, and REG-F-342 records that a durable RECORD naming process-local CONTENT is the inverse-orphan defect.',
		source: 'JAN-PFA R3 S3.3 burn-down increment 1'
	},
	{
		id: 'MU-PFA-BD1-06-durable-and-in-memory-providers-collide',
		file: 'packages/rph-persistence/src/sqlite-artifact-store.ts',
		find: "export const SQLITE_STORAGE_PROVIDER = 'jpwb:sqlite';",
		replace: "export const SQLITE_STORAGE_PROVIDER = 'jpwb:in-memory';",
		expectRed: ['packages/rph-persistence/src/sqlite-artifact-store.test.ts'],
		why: 'THE LIMB THE OBVIOUS ASSERTION CANNOT REACH. Comparing the ref against the constant passes whenever BOTH SIDES MOVE TOGETHER, so aliasing the constant to the in-memory store\'s identifier leaves that check green while making the two stores indistinguishable to every consumer of a ref. Distinctness is a separate claim from consistency and needs its own limb.',
		source: 'JAN-PFA R3 S3.3 burn-down increment 1'
	},
	{
		id: "MU-PFA-BD2-09-risk-ladder-inverted",
		file: "packages/rph-assurance/src/applicability.ts",
		find: "\t\t\treturn actualIdx >= 0 && requiredIdx >= 0 && actualIdx >= requiredIdx;",
		replace: "\t\t\treturn actualIdx >= 0 && requiredIdx >= 0 && actualIdx <= requiredIdx;",
		expectRed: ["packages/rph-assurance/src/applicability.test.ts"],
		why: "RISK_AT_LEAST promises a monotone LOWER bound on the subject's risk profile - true exactly when the subject's actual risk sits at or above the declared level. Inverting the ladder comparison turns it into an upper bound, so the risk-gated applicability that rph-engine/src/governing-policies.ts and rph-application/src/handlers/assurance.ts resolve policies, disposition conditions, waiver revalidation and escalation triggers with would fire on the lowest-risk subjects and silently NOT apply to CRITICAL ones.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-11-category-ignores-code-mapping",
		file: "packages/rph-contracts/src/errors.ts",
		find: "\t\tcategory: ERROR_CODE_CATEGORY[code],",
		replace: "\t\tcategory: 'VALIDATION',",
		expectRed: ["packages/rph-contracts/src/errors.test.ts"],
		why: "makeRphError's whole contract is that `category` is DERIVED from the canonical code->category mapping, so the coarse bucket on every RphError in CommandResult.error, events and observations always agrees with the code. The file's own comment records that hosts route on category (the RPH_IDEMPOTENCY_CONFLICT note deliberately moves a refusal from VALIDATION to CONCURRENCY); pinning the field to a constant makes every code report the same bucket, so any consumer routing on category mis-routes while the payload still parses as a valid RphError.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-11-thrown-message-drops-code",
		file: "packages/rph-contracts/src/errors.ts",
		find: "\t\tsuper(`${error.code}: ${error.message}`);",
		replace: "\t\tsuper(error.message);",
		expectRed: ["packages/rph-contracts/src/errors.test.ts"],
		why: "RphErrorException is the fail-loud throw for invariant breaches, and its promise is that the Error.message a catch-all handler or log line sees is self-classifying — it names the RphErrorCode, not just prose. Dropping the code from the super() message leaves every caller that only has the Error (rph-domain/src/stateMachine.ts throws it; generic handlers log err.message) unable to tell an invariant violation from any other throw without reaching into the structured payload.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-07-schema-id-version-segment-drifts",
		file: "packages/rph-contracts/src/validate.ts",
		find: "\treturn `${SCHEMA_URI_PREFIX}:${category}:${name}:${version}`;",
		replace: "\treturn `${SCHEMA_URI_PREFIX}:${category}:${name}:${version + 1}`;",
		expectRed: ["packages/rph-contracts/src/json-schema.test.ts"],
		why: "schemaId promises a STABLE id whose last segment is the schema version; the 107+ committed artifacts under packages/rph-contracts/schemas/ bake that exact string into their `$id` (e.g. `urn:janumi:rph:schema:object:ObjectEnvelope:1`) and external client generators resolve schemas by it. Emitting a different version segment for the same schema silently desynchronizes every published `$id` from what consumers pin.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-07-json-schema-wrong-dialect",
		file: "packages/rph-contracts/src/validate.ts",
		find: "{ target: 'draft-2020-12' }",
		replace: "{ target: 'draft-07' }",
		expectRed: ["packages/rph-contracts/src/json-schema.test.ts"],
		why: "jsonSchemaFor promises a Draft 2020-12 document as the single source for the committed schemas/ artifacts (docs D4). Zod sets `$schema` (and `$defs` vs `definitions`, and `$ref` handling) from that target, so the emitted contract would declare a dialect the Ajv2020 validator and any `schemas/`-driven client generator do not compile as 2020-12.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-07-validation-issues-dropped",
		file: "packages/rph-contracts/src/validate.ts",
		find: "\t\t\t\tissues: parsed.error.issues.map((i) => ({",
		replace: "\t\t\t\tissues: parsed.error.issues.slice(0, 0).map((i) => ({",
		expectRed: ["packages/rph-contracts/src/validate.test.ts"],
		why: "validateAgainst promises that a boundary refusal carries STRUCTURED issues, not just a code: the command bus propagates `details.issues` unchanged (rph-application/src/command-bus.ts:320) and the enforcement register resolves a SCHEMA row's `<issueCode>@<dottedPath>` marker by equality against `error.details.issues` (rph-domain/src/enforcement-register.ts:4067). Emptying the array still refuses, but no consumer can say WHICH field failed.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-10-boundary-pseudo-disposition-recorded-as-satisfied",
		file: "packages/rph-assurance/src/recording.ts",
		find: "return 'INCONCLUSIVE';",
		replace: "return 'SATISFIED';",
		expectRed: ["packages/rph-assurance/src/recording.test.ts"],
		why: "assuranceRecordingPlan promises that the boundary-only pseudo-dispositions (VALIDATOR_FAILED / BOUNDARY_REJECTED, §8.13) are folded into the recordable INCONCLUSIVE that blocks the gate, never into an authoritative admission; the mutant makes a malformed or non-independent Validator result record as SATISFIED. packages/rph-engine/src/record-assurance.ts relies on exactly this (its own header: \"Boundary pseudo-dispositions were already folded to INCONCLUSIVE by assuranceRecordingPlan\") and completes the governed ASSURANCE_ASSESSMENT to the plan's `disposition` verbatim, so the governed stream would assert that AI-produced work passed assurance when no authoritative finding was ever made.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-05-blocking-finding-no-longer-rejects",
		file: "packages/rph-assurance/src/assurance-rules.ts",
		find: "\tif (open.some((f) => f.severity === 'BLOCKING')) return 'REJECTED';",
		// ⚠ REFORMULATED AFTER A NO_COMPILE. The authored form compared `f.severity` against
		// `'CONDITIONALLY_SATISFIED'`, which is a Disposition and not a Severity — TS2367, so the mutant never
		// reached a test. That is trap (b) in this header: it mutated the COMPARISON rather than the
		// CONSEQUENCE. Downgrading the returned disposition leaves every type intact and attacks the same
		// promise: an open BLOCKING finding must REJECT, not conditionally satisfy.
		replace: "\tif (open.some((f) => f.severity === 'BLOCKING')) return 'CONDITIONALLY_SATISFIED';",
		expectRed: ["packages/rph-assurance/src/assurance-rules.test.ts"],
		why: "The §10.3 ladder promises that an OPEN BLOCKING finding forces REJECTED and can never be downgraded to a conditional pass — the Assurance Service overrides a validator's SATISFIED recommendation on exactly this rung, and BLOCKING_SEVERITIES is exported so callers asking 'does this block?' get the ladder's own answer. The mutant keeps the check but turns its refusal into CONDITIONALLY_SATISFIED, so work proceeds with conditions on a blocking finding and the exported set now disagrees with the ladder it mirrors.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-05-aggregate-needs-unanimous-rejection",
		file: "packages/rph-assurance/src/assurance-rules.ts",
		find: "\tif (required.some((a) => a.disposition === 'REJECTED')) return 'REJECTED';",
		replace: "\tif (required.every((a) => a.disposition === 'REJECTED')) return 'REJECTED';",
		expectRed: ["packages/rph-assurance/src/assurance-rules.test.ts"],
		why: "The aggregate promises the STRICTEST UNRESOLVED disposition among required policies, never an average or a vote (§28.2 / Inv-17): one rejected required policy dominates however many satisfied ones surround it. Requiring unanimity makes rejection dilutable by adding satisfied required policies, which is precisely the averaging the rule forbids; every consumer that reads an aggregate to gate release relies on one REJECTED being enough.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-05-inadmissible-evidence-reported-admissible",
		file: "packages/rph-assurance/src/assurance-rules.ts",
		find: "\treturn { admissible: failed.length === 0, failed };",
		replace: "\treturn { admissible: failed.length >= 0, failed };",
		expectRed: ["packages/rph-assurance/src/assurance-rules.test.ts"],
		why: "The promise is that absence of ANY of the 8 conditions makes the evidence inadmissible (§6.2), and `admissible` is the single boolean the Evidence admission path reads before a claim may be SATISFIED (Inv-3) — packages/rph-application/src/handlers/evidence-admissibility-gate.test.ts asserts on `verdict.admissible` directly. The mutant still collects every failure but reports success alongside it, which is the cannot-fail-guard shape REG-F-008 recorded in this very function, now moved to the verdict itself.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-05-independence-violation-reports-independent",
		file: "packages/rph-assurance/src/assurance-rules.ts",
		find: "\tconst fail = (reason: string) => ({ independent: false, reason });",
		replace: "\tconst fail = (reason: string) => ({ independent: true, reason });",
		expectRed: ["packages/rph-assurance/src/assurance-rules.test.ts"],
		why: "checkIndependence promises that an unmet independence requirement yields independent:false, because §8 / Inv-8 makes independence a precondition for SATISFIED and classifyValidatorResult boundary-rejects a result whose independence is unsatisfied. The mutant leaves every dimension's test and diagnostic reason intact while flipping the verdict to satisfied, so a producer evaluating its own output on the same model, org or a non-human evaluator is admitted as independent and still carries the word 'same model' as its reason.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-05-crashed-validator-classified-valid",
		file: "packages/rph-assurance/src/assurance-rules.ts",
		find: "\t\treturn { klass: 'VALIDATOR_FAILED', reason: 'validator execution failed' };",
		replace: "\t\treturn { klass: 'VALID', reason: 'validator execution failed' };",
		expectRed: ["packages/rph-assurance/src/assurance-rules.test.ts"],
		why: "The classifier's promise to the Assurance Service (§34, Inv-9/10) is that ONLY a VALID result may be turned into an authoritative disposition, and a validator execution failure is VALIDATOR_FAILED — a statement about the validator, never about the subject. Classifying a crashed validator's output VALID hands the recommendation of a run that did not complete straight into authoritative state, collapsing the distinction the whole boundary exists to hold.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-06-floor-drops-the-mandatory-reasoning-review",
		file: "packages/rph-assurance/src/floor-policies.ts",
		find: "\tIDENTITY_PROVENANCE,\n\tREASONING_REVIEW\n];",
		replace: "\tIDENTITY_PROVENANCE\n];",
		expectRed: ["packages/rph-authoring/src/catalog.floor-consistency.test.ts"],
		why: "FLOOR_POLICY_DEFINITIONS promises the COMPLETE de minimis floor — §8.4 mandates all three and §8.10 makes Reasoning Review the non-suppressible floor for AI-produced work. It is the single list both production seeders read (seed-workbench.seedFloorPolicies and reference-undertaking both `for (const def of FLOOR_POLICY_DEFINITIONS)`), plus floor-fixtures and two verif censuses, so dropping the AI-work floor silently un-seeds its ASSURANCE_POLICY object everywhere at once and leaves the browser catalog's F-13 label map with an id the server store cannot name.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-06-finding-out-claims-its-policy-action",
		file: "packages/rph-assurance/src/floor-policies.ts",
		find: "\t\t\t...policy.permittedControlActions",
		replace: "\t\t\t'RETRY', ...policy.permittedControlActions",
		expectRed: ["packages/rph-engine/src/seed-finding-definitions.test.ts"],
		why: "findingsFor promises that a finding CANNOT out-claim its own policy: `defaultControlActions` is DERIVED from the policy's `permittedControlActions` at construction rather than repeated per finding, which is what the floorPolicy doc calls the structural guarantee that makes it 'impossible for a finding to claim an action its own policy does not permit'. Nothing else enforces that subset — the handler's §11 subset gate (assurance.ts rejectUnpermittedControlActions / the create-time check) covers remediationRules and validator recommendations, never findingDefinitions — so this derivation is the only thing standing between a seeded finding and an action its policy forbids.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-06-humanized-name-loses-sentence-case",
		file: "packages/rph-assurance/src/floor-policies.ts",
		find: "\treturn words.charAt(0).toUpperCase() + words.slice(1);",
		replace: "\treturn words;",
		expectRed: ["packages/rph-engine/src/seed-finding-definitions.test.ts"],
		why: "humanizeCode promises §9.1's `name` is a MECHANICAL sentence-casing of an existing finding code (SOLUTION_SUBSTITUTION -> 'Solution substitution') — the claim that licenses calling all 99 seeded FindingDefinition names transcribed rather than authored, and the property seed-workbench.ts records as load-bearing ('humanizeCode sentence-cases' is why it is deliberately NOT used for published type names). Every seeded finding name, floor and additive, reaches the store through it via findingsFor, so dropping the casing silently re-authors all of them.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-08-rphid-schema-accepts-any-string",
		file: "packages/rph-contracts/src/ids.ts",
		find: "export const RphIdSchema = z.string().regex(RPH_ID_REGEX);",
		replace: "export const RphIdSchema = z.string();",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "RphIdSchema's whole promise is STRUCTURAL: an id is `<lowercase-prefix>_<ULID>` (docs §5), and line 2 of this file states that human-readable display labels like \"FSM-ARCH-001\" are NEVER ids. Its one consumer, `envelopes.ts:50`, installs it as `objectEnvelopeShape.id` — the shape every concrete PWO schema spreads — so without the regex any arbitrary string is accepted as an object's persisted identity and a display label validates as an id.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-08-mintid-prefix-not-from-registry",
		file: "packages/rph-contracts/src/ids.ts",
		find: "ID_PREFIXES[entity]",
		replace: "entity.toLowerCase()",
		expectRed: ["packages/rph-contracts/src/ids.test.ts"],
		why: "mintId promises an id for a REGISTERED entity: the prefix is the one the ratified registry assigns, and `ids.test.ts` holds ID_PREFIXES equal to `canonical-vocabulary.json`'s `idPrefixRegistry` precisely so that binding cannot drift. Deriving the prefix from the entity NAME instead still satisfies RPH_ID_REGEX and RphIdSchema, so every structural guard stays green while `command-bus.ts:147` begins stamping domain events `event_…` instead of `evt_…` and prefix-selecting consumers (`startsWith('pwu_')`, `startsWith('mex_')`) silently match nothing.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-04-rename-the-canonical-floor-policy-id",
		file: "packages/rph-assurance/src/floor.ts",
		find: "\tREASONING_REVIEW: 'floor.reasoning-review'",
		replace: "\tREASONING_REVIEW: 'floor.reasoning-review-v2'",
		expectRed: ["packages/rph-authoring/src/catalog.floor-consistency.test.ts"],
		why: "FLOOR_POLICY_IDS is the single canonical IDENTITY of the three de minimis floor policies, and three authorities are pinned to it rather than to each other: floor-policies.ts mints FLOOR_POLICY_DEFINITIONS[].policyId from it (the values seeded as the ASSURANCE_POLICY objects), rph-application's floor-gate.ts builds FLOOR_POLICY_IDS_REQUIRED from it, and the browser-safe rph-authoring catalog CANNOT import it (node:crypto) so it duplicates the three ids as literals by design. Renaming one splits the store identity from the display identity, which is exactly the silent drift the F-13 guard exists to refuse.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-04-drop-reasoning-review-model-independence",
		file: "packages/rph-assurance/src/floor.ts",
		find: "\t\t\tindependence: 'DIFFERENT_MODEL'",
		replace: "\t\t\tindependence: 'NONE'",
		expectRed: ["packages/rph-assurance/src/floor.test.ts"],
		why: "The plan's documented guarantee is that an AI-produced subject's Reasoning Review requires MODEL-LEVEL independence from the producer (exec != assurance, Inv-8). 'NONE' makes checkIndependence return independent for every evaluator, so composeAssuranceOutcome stops boundary-rejecting a self-review and the producing model can satisfy the floor on its own output — the one thing the step exists to prevent.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-04-downgrade-a-schema-failure-below-blocking",
		file: "packages/rph-assurance/src/floor.ts",
		find: "\t\t\tseverity: 'CRITICAL',",
		replace: "\t\t\tseverity: 'MATERIAL',",
		expectRed: ["packages/rph-assurance/src/floor.test.ts"],
		why: "The validator promises in terms that a schema failure is CRITICAL, and the severity is not decoration: recording.ts:106 persists it verbatim onto the canonical ASSURANCE_OBSERVATION, and the gates that read the recorded object ask severity membership of BLOCKING_SEVERITIES = {BLOCKING, CRITICAL} (reject-authorization.ts, governance.ts's baseline gate) rather than re-deriving the disposition. MATERIAL only CONDITIONALLY satisfies in the §10.3 ladder, so a recorded schema failure stops blocking for every consumer that asks the severity.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-04-observe-the-met-elements-instead-of-the-missing",
		file: "packages/rph-assurance/src/floor.ts",
		find: "\t\t.filter((c) => c.outcome === 'NOT_MET')",
		replace: "\t\t.filter((c) => c.outcome === 'MET')",
		expectRed: ["packages/rph-assurance/src/floor.test.ts"],
		why: "The validator promises that ANY missing identity/version/provenance/producer/trace element surfaces as an OPEN BLOCKING observation — the finding-type record recording.ts writes and the open-blocking-observation gates downstream read. Inverted, a subject with no provenance emits NO observation at all (the gate sees a clean result) while the five satisfied elements are reported as open BLOCKING findings: the instrument reports the exact complement of what it measured.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-04-open-the-gate-on-anything-but-rejected",
		file: "packages/rph-assurance/src/floor.ts",
		find: "\t\tgatePermitsTransition: aggregate === 'SATISFIED'",
		replace: "\t\tgatePermitsTransition: aggregate !== 'REJECTED'",
		expectRed: ["packages/rph-assurance/src/floor.test.ts"],
		why: "composeAssuranceOutcome's stated contract is that the protected downstream transition opens on a SATISFIED aggregate ONLY, and the blocked cases are precisely the ones that are NOT REJECTED: a MISSING floor result aggregates to UNASSESSED, and VALIDATOR_FAILED / BOUNDARY_REJECTED deliberately map to INCONCLUSIVE rather than REJECTED (§8.13, Inv-9/10) so that a failed control can never be read as an authoritative finding. This mutation converts that careful distinction into permission — 'assurance never completed' becomes a pass for the rph-application floor gate that consumes this boolean.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-timestamp-admits-offset",
		file: "packages/rph-contracts/src/common.ts",
		find: "export const RfcTimestampSchema = z.iso.datetime();",
		replace: "export const RfcTimestampSchema = z.iso.datetime({ offset: true });",
		expectRed: ["packages/rph-contracts/src/json-schema.test.ts"],
		why: "The promise is an RFC-3339 instant in UTC with offsets and local times REFUSED (DOC-007 §4), and it is the promise behind every createdAt/updatedAt/issuedAt/occurredAt plus the committed schemas/ artifacts external clients generate from. Admitting '...T22:00:00+02:00' lets two records name the same instant with different bytes, so contentHash canonicalization and any string ordering of timestamps stop agreeing with each other.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-nonnegative-admits-negative",
		file: "packages/rph-contracts/src/common.ts",
		find: "export const NonNegativeIntSchema = z.number().int().nonnegative();",
		replace: "export const NonNegativeIntSchema = z.number().int();",
		expectRed: ["packages/rph-contracts/src/json-schema.test.ts"],
		why: "Its name IS its contract: the shared primitive behind schemaVersion/semanticVersion/revision and envelopes.ts's aggregateRevision guarantees a floor of 0. A negative revision is unreachable from the engine (newRevision = events.length) so it can only arrive from a caller, and the emitted schemas would stop telling external clients that 0 is the floor — the nonnegative conjunct is the half of this export that no behavioural test asserts.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-schema-version-unconstrained",
		file: "packages/rph-contracts/src/common.ts",
		find: "export const SchemaVersionSchema = NonNegativeIntSchema;",
		replace: "export const SchemaVersionSchema = z.number();",
		expectRed: ["packages/rph-contracts/src/json-schema.test.ts"],
		why: "The PAYLOAD schema version drives upcaster selection, and envelopes.ts stamps it on the object envelope, commandSchemaVersion, eventSchemaVersion and every extension record. De-linking the alias from the constrained primitive admits 1.5 or -1, which no upcaster can match and which contentHash then refuses after the contract has already accepted it.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-semantic-version-admits-fraction",
		file: "packages/rph-contracts/src/common.ts",
		find: "export const SemanticVersionSchema = NonNegativeIntSchema;",
		replace: "export const SemanticVersionSchema = z.number();",
		expectRed: ["packages/rph-contracts/src/number-integrity.test.ts"],
		why: "The MEANING version is relied on by handlers that compare it by exact equality (approvedSemanticVersion / policySemanticVersion) and by contentHash, which refuses a non-integer in hashed state. A fractional semanticVersion accepted here is accepted by the contract and then thrown out of Engine.dispatch as a CanonicalJsonError — the exact REG-F-018 drift this file's constraint exists to close.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-revision-rejects-zero",
		file: "packages/rph-contracts/src/common.ts",
		find: "export const RevisionSchema = NonNegativeIntSchema;",
		replace: "export const RevisionSchema = PositiveIntSchema;",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "The concurrency revision promises that 0 is a LEGITIMATE value: kit.ts commits newRevision = alsoEvents.length, so a freshly created aggregate sits at revision 0, and every object envelope plus every expectedRevision compare-and-swap depends on 0 being expressible. Tightening to positive makes every newly created object fail envelope validation and makes the first update to each one unvalidatable.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-03-extension-data-defaulted",
		file: "packages/rph-contracts/src/common.ts",
		find: "data: z.record(z.string(), z.unknown())",
		replace: "data: z.record(z.string(), z.unknown()).default({})",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "This is declared the ONLY forward-compatible extensibility channel, so refusal is the whole mechanism by which a malformed extension is noticed — an extension must be namespaced, schema-versioned AND carry the data it claims. Substituting {} silently turns a producer's dropped or misnamed payload into an accepted, empty extension, so the one channel the corpus left open loses content with no reader ever learning.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-actor-reference-admits-an-anonymous-actor",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\tactorId: z.string().min(1),\n\tactorType: ActorTypeSchema,\n\tdisplayName: z.string().min(1),",
		replace: "\tactorId: z.string(),\n\tactorType: ActorTypeSchema,\n\tdisplayName: z.string(),",
		expectRed: ["packages/rph-application/src/handlers/execrem-wp16-enforcement-observed.test.ts"],
		why: "ActorReferenceSchema promises that every reference NAMES somebody — a non-empty actorId and a non-empty displayName — and the enforcement register leans on exactly that: RPH-EVD-003's producing-actor half is recorded as SCHEMA-FORECLOSED rather than handler-enforced, so ProposeEvidence.producedBy has no other guard, and objectEnvelopeShape.createdBy/updatedBy plus DomainEvent.actor have none either. BOTH limbs must be loosened in one mutation because the sole fixture asserting the refusal zeroes BOTH fields, so a single-field mutant would be killed by the other field's refusal and prove nothing.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-object-envelope-admits-undeclared-properties",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "export const ObjectEnvelopeSchema = z.strictObject(objectEnvelopeShape);",
		replace: "export const ObjectEnvelopeSchema = z.object(objectEnvelopeShape);",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "RPH-CON-002: the object envelope is CLOSED — unknown properties are REFUSED and extensibility flows only through extensions[]. validateAgainst() at every write boundary depends on that refusal to raise RPH_VALIDATION_SCHEMA_FAILED, and schemas/objects/ObjectEnvelope.json publishes additionalProperties:false to clients who generate against it; widened to z.object the key is silently stripped, so untrusted fields vanish without a refusal and the published contract describes an enforcement that no longer happens.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-envelope-shape-admits-a-fractional-semantic-version",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\tsemanticVersion: SemanticVersionSchema,",
		replace: "\tsemanticVersion: z.number(),",
		expectRed: ["packages/rph-contracts/src/number-integrity.test.ts"],
		why: "objectEnvelopeShape is the shape all 22 generated object schemas spread, so its field constraints are the ONLY place the version quartet is constrained for every Professional Work Object; REG-F-018 binds semanticVersion to contentHash's refusal of non-integers (\"a float in hashed content is a modeling smell and is rejected loudly\"). Loosening it to a bare z.number() re-opens the drift where the contract admits a value the store's canonicalizer throws on, which is the defect ArtifactObjectSchema.byteSize already exhibited in production dispatch.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-command-admits-a-malformed-issued-at",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\t\tissuedAt: RfcTimestampSchema,",
		replace: "\t\tissuedAt: z.string(),",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "RPH-CON-004: a command carrying a non-RFC-3339 timestamp must fail schema validation, and command-bus.ts relies on DomainCommandSchema to catch it at the envelope — before idempotency and before the payload. kit.ts makeEvent copies command.issuedAt verbatim into every produced event's occurredAt, so admitting '2026-07-10' here writes a malformed timestamp into the event store that no downstream check re-examines.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-event-envelope-refuses-an-aggregates-first-event",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\t\taggregateRevision: NonNegativeIntSchema,",
		replace: "\t\taggregateRevision: NonNegativeIntSchema.min(2),",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "DomainEventSchema's documented guarantee is over aggregateRevision — monotonic, equal to prior + 1 — which means it must ADMIT an aggregate's creation event at revision 1, the first thing every handler emits via kit.ts makeEvent and the first thing the StorageAdapter appends. A floor of 2 makes every aggregate's birth unrepresentable; this is the admitting-half direction (MU-PFA-S03-B's shape) and it is the only killable direction, because nothing in the repository asserts any REFUSAL by this schema.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-command-result-cannot-report-a-refusal",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\tproducedEventIds: z.array(z.string()),",
		replace: "\tproducedEventIds: z.array(z.string()).min(1),",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "CommandResultSchema promises that a REFUSAL is a representable outcome — CONFLICT / VALIDATION_FAILED with producedEventIds EMPTY and an RphError attached — which is what every dispatch caller receives instead of a throw, and what schemas/objects/CommandResult.json publishes to clients. Requiring at least one produced event makes every refused command's result invalid, so the shape would only describe the happy path; this is the admitting half, the only killable direction since nothing asserts a refusal by this schema.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-01-provenance-forbids-a-root-object",
		file: "packages/rph-contracts/src/envelopes.ts",
		find: "\tsourceObjectIds: z.array(z.string()),",
		replace: "\tsourceObjectIds: z.array(z.string()).min(1),",
		expectRed: ["packages/rph-contracts/src/envelopes.test.ts"],
		why: "ProvenanceRecordSchema promises that lineage is always DECLARED and may legitimately be EMPTY: a ROOT object — USER_INPUT or HUMAN_DECISION origin — cites no source object, which is why the arrays are required-but-unbounded rather than optional. Requiring at least one source makes every root object unrepresentable, so nothing could ever enter the object graph at all; objectEnvelopeShape.provenance carries this into all 22 object schemas and kit.ts commitState validates produced state against them.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-evidence-integrity-class-dropped",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\t{\n\t\tid: 'RR-08-evidence-integrity',\n\t\tlabel: 'No omitted inconvenient evidence and no hidden/unacknowledged uncertainty.'\n\t},\n",
		replace: "",
		expectRed: ["apps/rph-demo/src/lib/server/pwa-export.test.ts"],
		why: "The constant PROMISES it IS the nine §8.4/§11.7.5 derivational-integrity failure classes, and it is the SEED for the floor.reasoning-review ASSURANCE_POLICY from which both the judge's rubric and the scored criterion set are now read (floor-policies.ts REASONING_REVIEW.criteria + findingDefinitions). Dropping RR-08 deletes 'omitted inconvenient evidence / hidden unacknowledged uncertainty' from the seeded policy, so no rubric asks about it and no criterion can ever score it — §8.4's requirement that unacknowledged uncertainty be an OBSERVABLE failure class is left with no observer. Predicted red: the G-5 control in pwa-export.test.ts, `expect(REASONING_REVIEW_CRITERIA.map((c) => c.id)).toEqual([...nine ids...])`.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-registry-serves-no-validator",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\t\tget: (id) => map.get(id)",
		replace: "\t\tget: () => undefined",
		expectRed: ["packages/rph-assurance/src/validators.test.ts"],
		why: "The registry's whole promise is that a Validator REGISTERED for a floor policy is the one the floor runner then executes for it — runFloorResults does `registry.get(p.policyId)` and treats undefined as MISSING. A get that never serves a registered Validator silently empties the floor for every composition root that staffed it (apps/rph-demo assurance/index.ts, floor.ts, work-product-floor.ts, agy-failure-sanitisation.test.ts). Predicted red: 'all floor validators present + clean → aggregate SATISFIED, gate OPEN' — `expect(out.aggregate).toBe('SATISFIED')` becomes UNASSESSED.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-identity-floor-ignores-supplied-facts",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\t\t\t\tctx.identityProvenance ?? {\n\t\t\t\t\thasStableId: false,\n\t\t\t\t\thasSemanticVersion: false,\n\t\t\t\t\thasProvenance: false,\n\t\t\t\t\thasProducer: false,\n\t\t\t\t\ttraceComplete: false\n\t\t\t\t}",
		replace: "\t\t\t\t{\n\t\t\t\t\thasStableId: false,\n\t\t\t\t\thasSemanticVersion: false,\n\t\t\t\t\thasProvenance: false,\n\t\t\t\t\thasProducer: false,\n\t\t\t\t\ttraceComplete: false\n\t\t\t\t}",
		expectRed: ["packages/rph-assurance/src/validators.test.ts"],
		why: "This instance promises to judge §8.4 step 2 against the CALLER'S identity/provenance facts — and because the validators never inspect the subject (REG-F-354), those context facts ARE the assessment. Severing the ctx read discards every fact its consumers derive (apps/rph-demo floor.ts `identityProvenanceFactsOf`, work-product-floor.ts's store-measured `traceComplete`), so step 2 stops being a measurement of the subject at all. Predicted red: 'all floor validators present + clean → aggregate SATISFIED, gate OPEN' — identity/provenance returns five NOT_MET mandatory criteria against an all-true fact bag.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-found-failure-class-scores-met",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\t\t\toutcome: f?.failed ? 'NOT_MET' : 'MET',",
		replace: "\t\t\toutcome: 'MET',",
		expectRed: ["packages/rph-assurance/src/validators.test.ts"],
		why: "The mapper's stated guarantee is that every policy criterion is scored MET IFF its failure class is ABSENT from the judgement. Pinning the outcome to MET means a judge that positively reports a derivational-integrity failure still yields an all-MET criterion set, so the `mandatoryCriterionUnmet` limb of composeAssuranceOutcome's §10.3 ladder can never fire — and this is the ONE mapping shared by the agy/Gemini adapter, the mock validator and any future backend. Predicted red: `expect(r.criteria.find((c) => c.criterionId === 'RR-05-no-premature-convergence')?.outcome).toBe('NOT_MET')`.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-recording-plan-truncates-the-floor",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\treturn assuranceRecordingPlan(subject, plan, results);",
		replace: "\treturn assuranceRecordingPlan(subject, plan.slice(0, 1), results);",
		expectRed: ["packages/rph-engine/src/record-assurance.test.ts"],
		why: "It promises the recording plan covers the WHOLE ordered de minimis floor with the same run and blocking semantics as runDeMinimisFloor — one canonical ASSURANCE_ASSESSMENT per planned policy. Truncating the plan records step 1 only and opens the gate on a floor where identity/provenance and the non-suppressible Reasoning Review were actually run but never assessed, aggregated or persisted: the §8.4 floor suppressed at the exact recording seam apps/rph-demo floor.ts and work-product-floor.ts gate on. Predicted red: `expect(assessments).toHaveLength(3)` (and the policyId-sort assertion beside it) in 'a fully-satisfied floor records one SATISFIED assessment per policy'.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	{
		id: "MU-PFA-BD2-02-schema-floor-certifies-without-facts",
		file: "packages/rph-assurance/src/validators.ts",
		find: "\t\t\t\tctx.schemaInvariant ?? {\n\t\t\t\t\tschemaValid: false,\n\t\t\t\t\tinvariantViolations: ['SCHEMA_FACTS_UNAVAILABLE']\n\t\t\t\t}",
		replace: "\t\t\t\t{\n\t\t\t\t\tschemaValid: true,\n\t\t\t\t\tinvariantViolations: []\n\t\t\t\t}",
		expectRed: ["packages/rph-engine/src/record-assurance.test.ts"],
		why: "This instance promises §8.4 step 1 is decided by the CALLER'S schema/invariant facts, and fails CLOSED when they are absent. Certifying schemaValid unconditionally admits a subject that is not parseable or violates a deterministic invariant — apps/rph-demo work-product-floor.ts derives exactly those facts (WORK_PRODUCT_NOT_PARSEABLE) and apps/rph-demo floor.ts supplies PWA_GRAPH_NOT_WELL_FORMED — so 'a candidate that fails its contract cannot be admitted' is enforced nowhere. Predicted red: 'a schema failure records a REJECTED assessment + an observation carrying the specific finding code' — `expect(plan.gatePermitsTransition).toBe(false)` flips to true.",
		source: "JAN-PFA R3 S3.3 burn-down increment 2a"
	},
	// ── JAN-PFA R3 — ATTRIBUTION, the function that ended fungibility ───────────────────────────────────────
	// Added 2026-09-12 when the census moved from a per-FILE mutant COUNT to a per-EXPORT credit. The count made
	// guards fungible within a file — six mutants on one export discharged a six-export file — and it understated
	// the obligation by 41% (156 -> 220). These two entries guard the credit decision itself.
	{
		id: 'MU-PFA-R3-F-credit-the-nearest-export-not-the-containing-one',
		file: 'scripts/export-guard-core.ts',
		find: '\t\t.filter((e) => e.startLine <= anchorStartLine && anchorStartLine <= e.endLine)',
		replace: '\t\t.filter((e) => e.startLine <= anchorStartLine)',
		expectRed: ['verif/export-guard.test.ts'],
		why: 'Dropping the upper bound turns CONTAINMENT into "any declaration that starts earlier", so a mutant anchored in a private helper is credited to every export above it. That is the fungibility defect restored by a missing comparison: 58 of this repository\'s existing mutants anchor outside every export, and crediting them would discharge obligations nothing defends.',
		source: 'JAN-PFA R3 S3.2 per-export attribution'
	},
	{
		id: 'MU-PFA-R3-G-credit-only-the-first-owner-of-a-shared-line',
		file: 'scripts/export-guard-core.ts',
		find: '\t\t.map((e) => e.name);',
		replace: '\t\t.map((e) => e.name)\n\t\t.slice(0, 1);',
		expectRed: ['verif/export-guard.test.ts'],
		why: '`export const a = 1, b = 2;` is ONE statement, so both names own the same lines and both are equally entitled to a guard anchored there. Taking the first silently leaves the second bare while the census reports it guarded — a false credit, which is worse than a missing one because nothing will ever look again.',
		source: 'JAN-PFA R3 S3.2 per-export attribution'
	},
	{
		id: "MU-PFA-BD3-07-evaluator-selected-after-the-begin",
		file: "packages/rph-engine/src/assessment-drive.ts",
		find: "\tif (args.evaluator)\n\t\tsend('SelectAssuranceEvaluator', ASSESSMENT, args.assessmentId, { evaluator: args.evaluator });\n\tsend('BeginAssuranceAssessment', ASSESSMENT, args.assessmentId, {\n\t\t...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {})\n\t});\n",
		replace: "\tsend('BeginAssuranceAssessment', ASSESSMENT, args.assessmentId, {\n\t\t...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {})\n\t});\n\tif (args.evaluator)\n\t\tsend('SelectAssuranceEvaluator', ASSESSMENT, args.assessmentId, { evaluator: args.evaluator });\n",
		expectRed: ["packages/rph-engine/src/assessment-drive.test.ts"],
		why: "The helper's whole reason to exist is that the three production drive sites cannot disagree about the §30 lifecycle, and the ordering it owns on the READY -> ASSESSING arrow is the one DOC-004 §32 names as 'selectAssuranceEvaluator (AssuranceEvaluatorSelected) then beginAssuranceAssessment' — the selection must be committed while the assessment is still READY. Moving the selection after the begin breaks that promise for its consumers (packages/rph-engine/src/record-assurance.ts de-minimis floor recorder, packages/rph-engine/src/reference-undertaking.ts, apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts), and it breaks it SILENTLY: selectAssuranceEvaluator enforces fromStates('READY') (packages/rph-application/src/handlers/assurance.ts:1630 — 'Selecting one for an assessment already ASSESSING would change the assessor mid-judgment'), so a live engine REFUSES the late command, and this helper deliberately never inspects a send result. The assessment still reaches ASSESSING, with no AssuranceEvaluatorSelected event, so 'who assessed' reverts to being read off the verdict — precisely the governance guarantee this increment was built to buy, lost with no error anywhere.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-05-absent-policy-counted-as-governing",
		file: "packages/rph-engine/src/governing-policies.ts",
		find: "if (!pol) {",
		replace: "if (!pol) { selected.push(policyId);",
		expectRed: ["packages/rph-engine/src/governing-policies.test.ts"],
		why: "The doc comment's DETERMINED half promises that `selected` holds only the declared policies that EXIST as objects in the store, and that anything declared-but-absent is RETURNED in `excluded` with its reason rather than counted as governing. The mutant still records the exclusion but ALSO admits the phantom id into `selected`, so the same policy id is simultaneously reported as excluded and as governing. `requireGoverningPolicies` -> `driveReferenceUndertaking` requests one assurance assessment per selected policy and the §24 promotion gate cites that same set as `assuranceAssessmentIds`, so a policy id that is not an object in the store would be counted as governing a PWU and as backing its promotion — the exact 'declaration says four policies govern this work and the engine runs three' failure the extraction was made to expose, inverted into a phantom fourth.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-05-empty-selection-returns-quietly",
		file: "packages/rph-engine/src/governing-policies.ts",
		find: "if (selected.length === 0) {",
		replace: "if (selected.length === -1) {",
		expectRed: ["packages/rph-engine/src/governing-policies.test.ts"],
		why: "This export's entire reason for existing on top of `selectGoverningPolicies` is the promise its doc comment states: an empty selection is NOT a quiet `[]` but a loud failure naming what was declared and why none of it survived. The mutant keeps the guard and its message but compares the length against a value it can never hold, so a PWU that nothing can assess is handed back an empty governing set instead of a throw. The drive (`driveReferenceUndertaking` / the PWU disposition path) relies on this refusal: RPH-PWU-006 requires an assessment behind a disposition, so the quiet `[]` resurfaces several layers away as a missing assessment, or as a PWU driven to SATISFIED with nothing backing it — which is precisely the diagnosis the comment gives for why empty must not be returned.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-08-fork-writes-straight-to-canonical",
		file: "packages/rph-engine/src/engine.ts",
		find: "store: new SnapshotOverlayStorageAdapter(store)",
		replace: "store",
		expectRed: ["packages/rph-engine/src/engine.test.ts"],
		why: "createEngine is the sole place the facade's `fork()` promise is actually constructed: \"Create a point-in-time, isolated engine fork. Commands exercise the same handlers and invariants but write only to an overlay; closing or abandoning the fork cannot mutate this engine's canonical state.\" Interposing SnapshotOverlayStorageAdapter between the fork's Engine and the canonical adapter IS that guarantee — handing the fork the canonical store instead keeps every handler and invariant intact (so nothing looks wrong) while every candidate write lands directly in canonical's event log, objects and outbox. apps/rph-demo/src/lib/server/authoring-turn.ts:237 (`beginAuthoringTurn` -> `const isolated = canonical.fork()`) relies on exactly this: it records an agent's commands into the fork, snapshots base revisions from it, and only later replays them against canonical under expectedRevision / expectedContentHash guards. With the overlay gone, the staged candidate a human is still reviewing has already been committed to canonical, `snapshotRevisions` reads a state the turn itself just mutated, and the guarded replay then re-applies commands whose effects are already present — the candidate/canonical separation the authoring surface is built on disappears with no error anywhere.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-03-pwa-library-tombstone-filter",
		file: "packages/rph-engine/src/queries.ts",
		find: "(r) => r.state.publicationStatus !== 'DISCARDED'",
		replace: "(r) => r.state.publicationStatus !== 'PUBLISHED'",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "listPwas promises the PWA Library exactly the PWAs that have NOT been tombstoned: DeletePwa sets publicationStatus DISCARDED and the Library must treat that PWA as gone, while every live PWA must still be there. The home page (apps/rph-demo/src/routes/+page.server.ts), the Undertaking creation form's pwaOptions (routes/undertakings/+page.server.ts) and the introspection harness each render whatever this returns, and `enforcement-register.ts` cites listPwas as one of the two queries that DO filter tombstoned rows. Moving the excluded status from DISCARDED to PUBLISHED breaks the predicate in both directions at once: deleted PWAs reappear in the Library and the published PWA a new Undertaking must bind to vanishes. Probed on the seeded engine: listPwas returns 1 row, publicationStatus PUBLISHED, so the mutant returns 0 and the 'publishes one Product Realization PWA' case reddens on toHaveLength(1).",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-03-pwu-type-pwa-scope-join-key",
		file: "packages/rph-engine/src/queries.ts",
		find: "return pwaId ? byField(live, 'pwaId', pwaId) : live;",
		replace: "return pwaId ? byField(live, 'pwuKind', pwaId) : live;",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "listPwuTypes promises that, given a pwaId, the rows are the live PWU Types belonging to THAT PWA — and the thing that makes a type belong to a PWA is its own `pwaId` field (confirmed present on PWU_TYPE state). Every authoring and read surface depends on that join: the PWA Designer's type list and root lookup (routes/pwa/[id]/+page.server.ts), PwaAuthoringBroker.listTypes, workbench.ts's graph nodes, and the Undertaking's pwuTypeOptions. Re-keying the scope onto `pwuKind` silently degrades every scoped read to EMPTY — the precise wrong-field failure recorded in apps/rph-demo/src/lib/server/undertaking-loader-object-type.test.ts, where a read keyed on the wrong field 'degraded to empty' and 'the page did not even look broken'. Probed: pwuTypes(SEED_PWA) = 14 and pwuKind values are kind codes (never 'pwa_...'), so the mutant returns 0 and toBeGreaterThanOrEqual(8) / toHaveLength(14) redden.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-03-undertaking-portfolio-reads-wrong-type",
		file: "packages/rph-engine/src/queries.ts",
		find: "listUndertakings = (h: EngineHandle): ObjectRow[] => listByType(h, 'UNDERTAKING');",
		replace: "listUndertakings = (h: EngineHandle): ObjectRow[] => listByType(h, 'PROFESSIONAL_WORK_UNIT');",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "listUndertakings' whole guarantee is the identity of the rows it serves the RPH-DOC-010 Undertaking Portfolio: they ARE the UNDERTAKING aggregates, which is what lets routes/undertakings/+page.server.ts read `u.pwaId` for the PWA column and use `u.id` as the undertakingId for its per-row listPwus count, and what lets routes/pwa/[id]/+page.server.ts list the fixtures bound to a PWA. Reading a different aggregate type returns objects that are not undertakings at all — probed: 13 PROFESSIONAL_WORK_UNIT rows, none carrying pwaId — so the portfolio would list PWUs as undertakings and every pwaId read would be undefined. Victim: 'instantiates one Undertaking bound to the published PWA' asserts toHaveLength(1) and unds[0].state.pwaId === SEED_PWA; the mutant gives 13.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-03-pwu-undertaking-ownership-filter",
		file: "packages/rph-engine/src/queries.ts",
		find: "? byField(listByType(h, 'PROFESSIONAL_WORK_UNIT'), 'undertakingId', undertakingId)",
		replace: "? byField(listByType(h, 'PROFESSIONAL_WORK_UNIT'), 'pwuTypeId', undertakingId)",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "listPwus promises that, given an undertakingId, the rows are exactly the PWUs that Undertaking OWNS (CON-009) — decided by the PWU's own `undertakingId` field, which is why this query takes a bare id rather than a QueryScope (stated in governed-object-catalog.test.ts: 'PWUs carry undertakingId directly'). That set is the seed of the Undertaking Workbench's two-hop execution scope (pwuIdSet in routes/undertakings/[id]/+page.server.ts, cited again in rph-projections' execution-view), the Professional Work Graph's node set, and the portfolio's pwuCount. Re-keying ownership onto `pwuTypeId` (a real PWU field holding 'pwut_...', never 'und_...') makes an Undertaking own nothing: graph empty, lifecycle rollups empty, every execution plan judged out of scope. Probed: pwus(SEED_UNDERTAKING) = 13 and the mutant returns 0, so toHaveLength(13) reddens.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-03-observation-scope-widened-to-workspace",
		file: "packages/rph-engine/src/queries.ts",
		find: "withinScope(h, listByType(h, 'ASSURANCE_OBSERVATION'), scope, 'subjectObjectIds');",
		replace: "withinScope(h, listByType(h, 'ASSURANCE_OBSERVATION'), scope.kind === 'UNDERTAKING' ? { kind: 'WORKSPACE' } : scope, 'subjectObjectIds');",
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "listObservations promises JPWB-SPEC-001 SPEC-001-INV-02: an assurance observation is presented ONLY inside the declared QueryScope, an UNDERTAKING scope admitting only observations whose subjectObjectIds intersect that Undertaking's own object closure. The Undertaking Workbench's assurance tab consumes it with `undertakingScope` (routes/undertakings/[id]/+page.server.ts:377), and this is one of the four queries whose unscoped form rendered the SEEDED Undertaking's findings on a brand-new Undertaking (F-6 / FORK-9) — the defect the required-scope signature exists to make impossible. The mutation keeps the parameter and the check and turns its refusal into an admission: a declared UNDERTAKING scope is silently widened back to WORKSPACE, which is the leak itself rather than a near-miss. Probed on the seeded engine: 1 observation workspace-wide, 0 for the stranger Undertaking, so `expect(listObservations(e, OTHER)).toEqual([])` goes 0 -> 1 and reddens.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-06-drive-evaluator-not-independent",
		file: "packages/rph-engine/src/reference-undertaking.ts",
		find: "executionProvenance: { evaluator: EVALUATOR }",
		replace: "executionProvenance: { evaluator: ACTOR }",
		expectRed: ["packages/rph-engine/src/reference-undertaking.test.ts"],
		why: "The drive's central promise is that the canonical fixture's assurance facts are EARNED by a party INDEPENDENT of the one that produced the work — the module states it at the EVALUATOR declaration (\"the assurance EVALUATOR is a DISTINCT party from the work producer (ACTOR) — the whole point of independence (DOC-004 §39 invariant 8, §8.4)\"), and the fitness policy the drive creates declares independenceRequirement DIFFERENT_AGENT. The verdict's executionProvenance.evaluator is the operand that makes that real: completeAssuranceAssessment reads the evaluator off validatorResult.executionProvenance.evaluator (assurance.ts:2050), compares it with the supplied producer (here `producer: ACTOR`) via checkIndependence, and WRITES it onto the assessment object (assurance.ts:2388, and 2270 on the violation path). Stamping ACTOR there makes producer and evaluator the same identity, so every fitness assessment the reference undertaking records is self-assessed. Relied on by: (1) reference-undertaking.test.ts's \"Increment I1\" guarantee, which reads each completed assessment's recorded evaluator and asserts it is evaluator-1/reviewer-agent-1 and never a producer identity — the test written so the later enforcement increment would have honest operands; (2) the §38 assurance view's independenceStatus (assurance-view.test.ts asserts VERIFIED for the Mobile & Offline fitness assessment and that nothing is VIOLATED); (3) every downstream consumer of the seed graph, since an INDEPENDENCE_VIOLATION assessment can no longer back the controller's SATISFIED hop that rejectUnbackedDisposition guards.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-02-row-revision-off-by-one",
		file: "packages/rph-engine/src/queries.ts",
		find: "\t\t\t\trevision: loaded.revision",
		replace: "\t\t\t\trevision: loaded.revision + 1",
		expectRed: ["packages/rph-engine/src/queries-revision.test.ts"],
		why: "ObjectRow.revision promises THE aggregate revision this row was read at - the value PER-4 (JPWB-DOC-003 s9; JPWB-SPEC-001 s11.4.22 item 2) requires a caller to round-trip as `expectedRevision`. listByType is the SOLE constructor of every ObjectRow on this read surface, so every typed wrapper (listPwas/listPwus/listExecutionPlans/...) and every rph-demo loader that derives a page's expectedRevision inherits whatever it supplies, and `loadOrReject` then honours it. An off-by-one keeps the field PRESENT and typed - so the weaker presence assertion still passes - while making every governed write dispatched from a page contest a revision that was never current. It is killed only by the assertion that the value is the TRUE one, which is the discrimination the file's own comment says it spent a commit learning to demand.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-02-decisions-ignore-the-declared-scope",
		file: "packages/rph-engine/src/queries.ts",
		find: "\twithinScope(h, listByType(h, 'DECISION'), scope, 'subjectObjectIds');",
		replace: "\twithinScope(h, listByType(h, 'DECISION'), { kind: 'WORKSPACE' }, 'subjectObjectIds');",
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "listDecisions promises JPWB-SPEC-001 SPEC-001-INV-02 / FORK-9: a subject-bindable read returns nothing outside the QueryScope its caller DECLARED, and WORKSPACE is never a default. The Undertaking Workbench's decisions tab relies on it - this is the shipped defect that rendered the seeded Undertaking's 2 decisions inside a brand-new Undertaking that owns nothing. Answering WORKSPACE regardless re-opens that leak while the repaired signature still advertises the fix, which is worse than the original because the compile-time enforcement the file argues for is now satisfied and meaningless.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-02-governed-catalog-scopes-on-the-type-not-the-id",
		file: "packages/rph-engine/src/queries.ts",
		find: "\t\t\tif (owned && !owned.has(id)) continue;",
		replace: "\t\t\tif (owned && !owned.has(objectType)) continue;",
		expectRed: ["packages/rph-engine/src/governed-object-catalog.test.ts"],
		why: "listGovernedObjects promises that under an UNDERTAKING scope every candidate Decision subject is OWNED by that Undertaking - membership by the object's OWN id in the undertaking's production closure, not by the subject-field intersection withinScope performs (REG-F-106 / REG-D-041, ASR-15, INV-02). The /decisions subject picker relies on it: each row it offers becomes `subjectObjectIds` on a proposed Decision, so a leaked row is authority claimed over an object this Undertaking does not own. Keying the membership test on the aggregate TYPE makes the guard structurally un-fireable (owned holds ids, never type names), so the scoped catalog silently equals the whole workspace.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-02-execution-plans-read-the-wrong-aggregate-type",
		file: "packages/rph-engine/src/queries.ts",
		find: "listExecutionPlans = (h: EngineHandle): ObjectRow[] => listByType(h, 'EXECUTION_PLAN')",
		replace: "listExecutionPlans = (h: EngineHandle): ObjectRow[] => listByType(h, 'PROFESSIONAL_WORK_UNIT')",
		// ⚠ RE-POINTED FROM AN e2e VICTIM. Declared first against `apps/rph-demo/e2e/execution-plan.e2e.ts`, the
		// run came back INCONCLUSIVE — TIMED OUT: with no plans to render the page never reaches the state the
		// spec waits for, so the spec HANGS rather than failing. ⛔ A test that hangs when its subject is wrong
		// cannot kill a mutant — neither KILLED nor SURVIVED is available — and that is WORSE than a red, because
		// the harness has measured nothing. A fast vitest assertion of the same promise was added to
		// `query-scope.test.ts`, whose own header records why such rules belong where the ledger can reach them.
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "listExecutionPlans promises every EXECUTION_PLAN aggregate in the engine, deliberately UNSCOPED - its one filter is the aggregate type. Two consumers depend on the rows actually being plans: the Undertaking Workbench's execution tab, which is scoped by filtering this global list on `workUnitId` into this Undertaking's PWUs (the F-6 fix, undertakings/[id]/+page.server.ts), and /test-api/introspect, which publishes it as the e2e harness's GROUND TRUTH for 'this Undertaking has a plan'. Rows of another type carry no `workUnitId`, so the scoped panel renders zero plan cards and the harness's in-scope plan set is empty - while the page still returns 200 and the endpoint still reports a populated field.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-02-conversations-read-the-wrong-aggregate-type",
		file: "packages/rph-engine/src/queries.ts",
		find: "\tlistByType(h, 'AUTHORING_CONVERSATION');",
		replace: "\tlistByType(h, 'PROFESSIONAL_WORK_ARCHITECTURE');",
		expectRed: ["apps/rph-demo/e2e/agent-retention.e2e.ts"],
		why: "listConversations promises the DURABLE, event-sourced AUTHORING_CONVERSATION aggregates and nothing else - it is the line the authoring-retention contract is drawn on. Before acceptance the transcript lives only in the in-process candidate, and /test-api/introspect deliberately publishes `conversations` (canonical) apart from `authoringCandidates[].conversations` (preview) so a spec cannot conflate staged with committed. Pointing the single filter this query has at another aggregateType makes canonical conversations appear for a PWA that has committed none, i.e. the read surface asserts the chat history is durable domain state before any ConversationEntriesAppended event exists.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-04-seed-undertaking-id-not-a-wellformed-rphid",
		file: "packages/rph-engine/src/seed-workbench.ts",
		find: "export const SEED_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5Z10';",
		replace: "export const SEED_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5Z1O';",
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "SEED_UNDERTAKING promises a WELL-FORMED RphId — `<lowercase-prefix>_<ULID>`, Crockford base32 excluding I/L/O/U — and that this exact value IS the aggregate identity the seeded Undertaking is persisted under. The guarantee is enforced at runtime: `createUndertaking` builds the state via `newEnvelope(command, UNDERTAKING, p.undertakingId, …)` and `createObject` -> `commitState` validates that state against `UndertakingSchema`, which spreads `objectEnvelopeShape` whose `id` is `RphIdSchema` (`^([a-z]+)_([0-9A-HJKMNP-TV-Z]{26})$`). Swapping the trailing `0` for `O` — the exact confusion Crockford base32 exists to exclude — keeps the id 26 chars and plausible while making it unstorable: the command is REJECTED and the seed's fail-loud `sender` throws. Who relies on it: every consumer that resolves the Undertaking BY this value — the UNDERTAKING `QueryScope` subject in query-scope.test.ts (`listAssessments`/`listBaselines`/`listPwus`), the demo's `/undertakings/<id>` route loader, and the hardcoded copy in apps/rph-demo/e2e/undertaking-atomicity.e2e.ts — all get no Undertaking at all.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-04-policy-library-omits-the-ratified-catalog",
		file: "packages/rph-engine/src/seed-workbench.ts",
		find: "seedAdditivePolicies(handle);",
		replace: "seedFloorPolicies(handle);",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "seedPolicyLibrary promises the FULL workbench policy library — the 3 locked de minimis floor policies PLUS the additive DOC-004 Product Realization catalog — seeded in EVERY engine (reference AND empty) so the PWA Designer's policy manager and picker are always populated. The mutation seeds the floor twice (the repeat returns DUPLICATE on the same idempotency keys) and the ratified catalog never, reproducing exactly the state the victim test's own comment records: 9 policies where there should be 15, with six ratified DOC-004 policies existing as ontology data and as NO object — invisible to `list_assurance_policies`, which is an instruction to the authoring agent to fabricate duplicates of ratified policies. Who relies on it: the PWA Designer's policy manager/picker, the authoring agent's reuse-before-create rule, and seedWorkbench itself, which hands `pol_fitness_for_purpose` to the reference drive on the assumption the catalog is present.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-04-pwu-type-join-names-an-unpublished-type",
		file: "packages/rph-engine/src/seed-workbench.ts",
		find: "for (const t of derivedTypes(handle)) pwuTypeByKind[t.kind] = t.id;",
		replace: "for (const t of derivedTypes(handle)) pwuTypeByKind[t.kind] = PT_BY_KIND['ARCHITECTURE_DECISION']!;",
		expectRed: ["packages/rph-engine/src/seed-workbench.test.ts"],
		why: "seedWorkbench promises that the Undertaking side and the PWA side AGREE: its kind->PWU-Type map is built from the SAME `derivedTypes` the publish loop used, so — in the code's own words — \"the instance-side kind->type map cannot name a type the PWA did not publish\". That `pwuTypeId` is the join key the Assurance View follows from a PWU to its type's `requiredAssurancePolicyIds` (and the seeded path deliberately leaves the PWU's own `assurancePolicyIds` empty, so the type IS the whole declaration). `ARCHITECTURE_DECISION` is described by the ontology but named in no `candidateChildren` list, so `derivedTypes` drops it as unreachable and `pwut_01ARZ3NDEKTSV4RRFFQ69G5ZF0` is never published — pointing every kind at it makes every proposed PWU cite a type the PWA does not contain, so the type join dangles and the governing-policy declaration resolves to nothing.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-01-assessments-ignore-the-declared-scope",
		file: "packages/rph-engine/src/queries.ts",
		find: "\twithinScope(h, listByType(h, 'ASSURANCE_ASSESSMENT'), scope, 'subjectObjectIds');",
		replace: "\twithinScope(h, listByType(h, 'ASSURANCE_ASSESSMENT'), { kind: 'WORKSPACE' }, 'subjectObjectIds');",
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "PROMISE: JPWB-SPEC-001 SPEC-001-INV-02 / FORK-9 — a subject-bindable query presents only objects INSIDE the declared scope, and the scope is a required parameter precisely so it cannot be forgotten. The Undertaking Workbench's Assurance tab relies on it (apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:336 and :445 pass `undertakingScope`); floor.ts:482 and the baselines route are the callers that legitimately say WORKSPACE, and the whole point of the signature repair is that those two statements must stay distinguishable. Substituting WORKSPACE here re-ships the measured defect verbatim: a brand-new Undertaking with zero PWUs renders the seeded Undertaking's 65 assessments. It reddens the LEAK case only (`listAssessments(e, OTHER)).toEqual([])`), leaving the CONTROL green — the opposite polarity from the listBaselines mutant below, so the pair tells the two halves apart rather than pushing the same assertion twice.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-01-baseline-subjects-read-from-the-wrong-field",
		file: "packages/rph-engine/src/queries.ts",
		find: "\twithinScope(h, listByType(h, 'BASELINE'), scope, 'itemObjectVersions');",
		replace: "\twithinScope(h, listByType(h, 'BASELINE'), scope, 'subjectObjectIds');",
		expectRed: ["packages/rph-engine/src/query-scope.test.ts"],
		why: "PROMISE: a BASELINE is subject-bound through `itemObjectVersions[].objectId` and through nothing else — `BaselineObjectSchema` is a z.strictObject (packages/rph-contracts/src/objects.ts:774) with no `subjectObjectIds` at all — so the field name this declaration passes IS the binding, and it is the one thing that differs from its three sibling queries. The Undertaking Workbench's Baselines tab relies on it (+page.server.ts:465). Naming the assessment/observation/decision field instead makes subjectIdsOf read an absent field, fail CLOSED, and admit every Baseline to no Undertaking: the owning Undertaking's Baselines tab empties. That is the direction that LOOKS like a successful scope fix, so it reddens the CONTROL (`listBaselines(e, UNDERTAKING).length > 0`) and leaves the leak case green — the mirror of the listAssessments mutant.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-01-policy-library-hides-every-non-active",
		file: "packages/rph-engine/src/queries.ts",
		find: "\tlistByType(h, 'ASSURANCE_POLICY');",
		replace: "\tlistByType(h, 'ASSURANCE_POLICY').filter((r) => r.state.status === 'ACTIVE');",
		expectRed: ["packages/rph-authoring/src/broker.test.ts"],
		why: "PROMISE (stated in its own doc comment): EVERY ASSURANCE_POLICY definition, ANY status — the library is the complete list and STATUS is the consumer's to interpret, not this query's to apply. broker.listPolicies() (packages/rph-authoring/src/broker.ts:348) surfaces `status` and `isFloor` so the picker can offer only ACTIVE ones and show the three de minimis floor policies locked (§8.4); apps/rph-demo/src/routes/pwa/[id]/+page.server.ts:159 renders the manager from the same rows. Pre-filtering to ACTIVE makes a policy invisible to the author who just created it — a newly authored policy is born DRAFT (DOC-002 §18) — and degrades defineType's diagnostic from 'is DRAFT' to 'does not exist', i.e. a governance state becomes indistinguishable from a missing object.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-01-conversation-bound-to-the-wrong-pwa",
		file: "packages/rph-engine/src/queries.ts",
		find: "\treturn byField(listByType(h, 'AUTHORING_CONVERSATION'), 'pwaId', pwaId)[0];",
		replace: "\treturn listByType(h, 'AUTHORING_CONVERSATION').find((r) => r.state.pwaId !== pwaId);",
		expectRed: ["apps/rph-demo/src/lib/server/authoring-turn.test.ts"],
		why: "PROMISE: the durable authoring conversation FOR THIS PWA, keyed on pwaId, one per PWA. Two consumers rest on different halves of it: workbench.ts:349 uses the result as `existing` to decide append-vs-create, so a wrong answer mints a SECOND conversation for a PWA and breaks the one-per-PWA cardinality; workbench.ts:372 and authoring-turn.ts:140 read `.state.entries` as the transcript the authoring surface renders. Inverting the key makes the lookup return some OTHER PWA's conversation when one exists and never its own — a cross-PWA transcript leak and a permanently 'absent' conversation for the PWA being authored.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	},
	{
		id: "MU-PFA-BD3-01-type-blind-read-answers-one-type-only",
		file: "packages/rph-engine/src/queries.ts",
		find: "\treturn handle.loadObject(id)?.state as Record<string, unknown> | undefined;",
		replace: "\treturn handle.loadObject(id)?.objectType === 'UNDERTAKING' ? (handle.loadObject(id)?.state as Record<string, unknown>) : undefined;",
		expectRed: ["packages/rph-engine/src/assessment-startedat-contract.test.ts"],
		why: "PROMISE: this is the deliberately TYPE-BLIND by-id read — it hands back whatever object carries the id, asserting nothing about what it is, and stands in for the four ratified typed queries (getUndertaking, getPwu, getBaseline, getPwaVersion). Its blindness is load-bearing, which is exactly why `getObjectOfType` was added as a SEPARATE seam for ids arriving from a URL instead of narrowing this one. Every internal-id read depends on it: the assessment state read (assessment-startedat-contract.test.ts:78, :136), the floor policy reads (floor-declared-scope.test.ts:104, :162), the PWU/policy censuses, seed-policy-arrays' accessor. Narrowing it to a single objectType returns undefined for every non-Undertaking object, and each caller's optional-chain / `?? ''` fallback then degrades to empty without throwing — the 'did not even look broken' failure its own neighbouring docblock records. Victim is deliberately NOT queries-object-type.test.ts: that file's header declares it is intentionally not a declared mutant's victim.",
		source: "JAN-PFA R3 S3.3 burn-down increment 3a"
	}
];
