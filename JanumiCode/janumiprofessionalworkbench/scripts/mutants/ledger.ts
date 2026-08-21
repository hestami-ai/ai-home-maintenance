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
		find: "status: String((next.status ?? '') as string | number | boolean)",
		replace: "status: '' // MUTANT: the resulting status is not recorded",
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
		id: 'F195-the-capsule-stops-labelling-what-the-executor-imports',
		file: 'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
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
		expectRed: ['packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
		why: 'REG-F-195 W-6: without the label a derived closure member is not eligible, so the capsule refuses the whole population rather than shipping without a module the executor imports',
		source: 'DESIGN-derived-capsule-closure.md W-6'
	},
	{
		id: 'F195-the-binding-site-forgets-what-selection-decided',
		file: 'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
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
		expectRed: ['packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
		why: 'REG-F-195 W-6: an artifact selected by the closure and then bound without it is materialised into the capsule with no recorded reason for being there, and nothing fails',
		source: 'DESIGN-derived-capsule-closure.md W-6'
	},
	{
		id: 'F195-an-undecidable-import-closure-goes-silent-again',
		file: 'packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.ts',
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
		expectRed: ['packages/csaa/src/providers/jpwb-arrow-command-census/artifact-set.test.ts'],
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
		file: 'packages/csaa/src/subject/analyzer-closure.ts',
		// THE ONE REFUSAL THIS FILE ARGUES FOR IN PROSE, and until C9 nothing checked the bet was still refused:
		// "Returning the first present candidate would be a PREFERENCE — a bet on which file the runtime picks.
		// Requiring exactly one present candidate is a REFUSAL. The wager is the class of thing under repair."
		// This mutation makes the wager. It is the shape a well-meaning "just resolve it" fix would take, and it
		// is silent: a capsule would bind a real, present, WRONG file and the worker would run happily against it.
		find: "\tif (present.length > 1) return { kind: 'AMBIGUOUS', present };",
		replace:
			"\tif (present.length > 1) return { kind: 'RESOLVED', path: present[0]! }; // MUTANT: prefers, not refuses",
		expectRed: ['packages/csaa/src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: two present candidates is an undecidable question about the runtime, and answering it by position is a guess the capsule cannot audit',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-an-undecidable-edge-is-read-as-no-edge',
		file: 'packages/csaa/src/subject/analyzer-closure.ts',
		// A dynamic `import(variable)` cannot be resolved from bytes. Treating it as ABSENT rather than as a
		// REFUSAL is exactly the defect the whole programme exists to remove — the capsule ships without a module
		// the analyzer will load, and nothing anywhere says so. Reclassifying it as BARE is the plausible mistake:
		// bare specifiers are legitimately collected-and-not-traversed, so it reads as "handled".
		find: "\t\treturn fault('SPECIFIER_NOT_LITERAL', null, null);",
		replace: "\t\treturn { kind: 'BARE', specifier: '<non-literal>' }; // MUTANT: undecidable read as absent",
		expectRed: ['packages/csaa/src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: "we could not decide" and "there is nothing here" are different facts, and only one of them is safe to build a capsule from',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-the-decoder-substitutes-bytes-nobody-has',
		file: 'packages/csaa/src/subject/analyzer-closure.ts',
		// ONE WORD, AND IT IS THE WHOLE GUARANTEE. A non-fatal decoder substitutes U+FFFD for invalid sequences
		// and hands the parser a file that is not the one in the byte store — so the closure would be a true
		// statement about a text nobody has, derived from a subject that is supposed to be byte-frozen. It also
		// would not throw, would not warn, and would usually still parse.
		// Anchored on CONTENT without leading whitespace (ledger rule #4) — my first attempt counted three tabs
		// where the file has two, and the anchor gate caught it before it could become a claim nobody can perform.
		find: "text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);",
		replace:
			"text = new TextDecoder('utf-8', { fatal: false }).decode(bytes); // MUTANT: lossy decode",
		expectRed: ['packages/csaa/src/subject/analyzer-closure.test.ts'],
		why: 'REG-F-196: a byte-frozen subject decoded lossily is no longer byte-frozen, and the closure silently describes a file that does not exist',
		source: 'REG-F-196 Finding 2'
	},
	{
		id: 'F196-the-fail-closed-law-ships-a-partial-closure',
		file: 'packages/csaa/src/subject/analyzer-closure.ts',
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
		expectRed: ['packages/csaa/src/subject/analyzer-closure.test.ts'],
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
	}
];
