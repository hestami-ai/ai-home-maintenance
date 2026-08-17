# ROADMAP — deriving the retained-analyzer capsule closure

Implements `DESIGN-derived-capsule-closure.md`.

**Status:** Proposed (unratified) · **Date:** 2026-08-17 · **Occasioned by:** REG-F-195

---

## 0. Standing constraints on every increment below

* ⚠ **The merge is parked, not abandoned.** `HEAD=185c700d`, `MERGE_HEAD=6d83aa3a`, 98 files staged, one conflict
  already resolved and verified. W-0…W-2 require the merge to be **aborted and re-made** at W-3; the resolution is
  deterministic and has been reproduced byte-identically once already.
* ⚠ **Commit caveat, binding.** REG-F-123 is OPEN and its recorded safe default binds: no claim of "full mutation
  gate green" may be made while the INCONCLUSIVE stands, and commits carry
  `1 standing INCONCLUSIVE (P3 control, external cause — REG-F-123)` until it clears. **W-4 is the increment that
  clears it.** W-0…W-3 carry the caveat.
* **No number in any increment may be copied from the register.** Both recorded remedies are wrong (§W-4).
  Re-derive from the tree, every time.
* **Full gate** = `bun run gate:fast` (`csaa:inventory:check` → `check-types` → `lint` → `boundary` → `build` →
  `test` → `test:coverage` → `rph-demo check` → `e2e`) **and** `bun run mutants`. Playwright is part of it.
* **Binary-mode edits only.** A text-mode write flipped a 22-line addition into a 1940-line diff and resolved four
  mutant anchors to zero (REG-F-194 Finding 3). Verify `git diff --stat` before writing any commit message.

---

## 1. Why the register work cannot come first

The register is **arrows-side**. Main's copy stops at **REG-F-114** (111 entries, 3108 lines); the merging branch
carries **190 entries through REG-F-194** (4329 lines), and main never touched the file. Seventy-nine entries —
116 through 194 — exist only on the branch.

So `REG-F-195` cannot be filed before the merge; its number depends on 194 existing. The same applies to these two
documents: `verif/register-citations.test.ts` scans `docs/` and requires every cited id to resolve, so a design doc
citing REG-F-172/194 would redden on main. That gate is itself arrows-only — main has only
`register-status.test.ts`.

⚠ But it **exempts CSAA** — `if (e === 'node_modules' || … || e === 'csaa') continue;` at `:48`, and
`docs/ASTs and Code Analysis` at `:52`. **Therefore the code increments may land on main pre-merge; only the
register entry and these two documents must wait.** Design-first is satisfied by authoring order: both documents
are written before any code and committed where they can legally cite.

---

## 2. Increments

### W-0 — Repair the instrument (pre-merge, on main)

Fix `worker.ts:510-511` to preserve non-`Error` throwables (specifier + referrer for a `ResolveMessage`), and
`observe-guard-enforcement-ledger.ts:877` to carry a bounded stderr prefix alongside the digest.

**Predicted red before the fix:** C4 — drive the worker standalone against a capsule deliberately missing
`verif/arrow-command-census.ts`; stderr must **contain** `arrow-command-census`. Today it is the 49-byte constant,
so C4 is red. C5 likewise against `:877`.
**Mutants:** restore the `instanceof Error` ternary → C4 must redden. Revert to digest-only → C5 must redden.
⚠ A weaker assertion such as "stderr is non-empty" passes today and proves nothing.

**Why first:** every later control is otherwise validated against an opaque constant hash. Two of the design's own
open risks — an unaudited transitive import, an unsatisfiable bare specifier — would each produce another
path-free constant if they fire. This increment is what makes the rest debuggable in one run rather than one day.

**Gate:** full. **Expected on main:** green (no behavioural change; the branch is only taken on failure).

---

### W-1 — The shared closure module (pre-merge, on main)

Add `subject/analyzer-closure.ts` per DESIGN §2. Not yet wired into any provider.

**Predicted reds:** C1 (synthetic closure — dependency deliberately **not** named `arrow-command-census`), C2
(fixpoint, depth-2), C3 (fail-closed law: `paths.size === 0` iff `findings.length > 0`).
**Mutants:** stub the extractor to return ∅ → C1 reddens. Cap the walk at depth 1 → C2 reddens. Delete the
diagnostic emission while keeping the selection → C3 reddens.

⚠ **C1 is the increment's whole point.** A fourth-hardcoded-literal fix passes any test that names the real file
and fails C1. If C1 can be made green by adding a literal, it is the wrong test.

**Gate:** full. **Expected on main:** green.

---

### W-2 — Wire it in, and take the election (pre-merge, on main)

Add `ANALYZER_DEPENDENCY_SOURCE` to the closed union, bump the artifact-set schema 1.0.0 → 1.1.0 with its coverage
field, feed the closure into `usesForPath`, and replace the silent drop at `artifact-set.ts:469` with capped
findings plus one summary diagnostic.

**Predicted reds — and these are on main, by construction:** every test pinning the artifact-set coverage *shape*
or the schema version moves, because the coverage object gains a field. Name them before running: candidates are
`artifact-set.test.ts` (esp. `:191-194`), `normalize-guard-enforcement-ledger.test.ts:211-213`, and
`inventory.test.ts:475/:569/:2511`.
⚠ **Redness in those files means the fix was placed in `RETAINED_VERIFIER_PATHS`/`REQUIRED_PATHS` rather than in
`usesForPath`** — check that before re-pinning anything.

⚠ **The closure is empty on main** (the analyzer has no relative imports there), so a green W-2 proves only that
nothing broke. It is **not** evidence the derivation works — C1/C2 are, and W-3 is the end-to-end witness.

**Gate:** full. **Expected on main:** green after the coverage-shape pins move.

---

### W-3 — Re-make the merge (the end-to-end witness)

Abort nothing that matters: re-run `git merge --no-commit --no-ff jpwb/arrows`, re-apply the single saved
resolution in `verif/arrow-census-coverage.test.ts` (arrows' `inScopeMachines()` semantics + main's prettier
wrapping and 45s timeout), and confirm the staged diff is again **98 files / 9307+ / 732−**.

**The witness:** `observe-guard-enforcement-ledger.integration.test.ts:193` must now reach `outcome: 'complete'`
**without any change to the allowlist**. That is the whole exercise: the capsule materialises
`verif/arrow-command-census.ts` because it was derived, not because anyone remembered to list it.

**Predicted red, and it must move rather than vanish:** the test must then fail at `:216-217` with 21/15 against
the pinned 22/14. ⚠ If it fails at `:193` still, the derivation did not reach the capsule. If it goes straight to
green, something else re-pinned the counts and the run must be distrusted.

---

### W-4 — Re-pin, and arm a recorded hazard

Every figure below was derived from the tree, cross-checked three ways (filesystem enumeration, `git ls-tree` at
`185c700d`, and the merge's own add-list), and validated by reconstructing four merge-invariant pins exactly.

| Pin | Pinned | Actual | Register's recorded remedy |
|---|---|---|---|
| `subject.test.ts:1865` `scripts/tsconfig.json` | 6 | **8** | REG-F-123 says `6→7` — **wrong by 1** |
| `subject.test.ts:1866` `verif/tsconfig.json` | 40 | **45** | REG-F-123 says `40→41` — **wrong by 4** |
| `observe-...integration.test.ts:216-217` | 22 / 14 | **21 / 15** | — |
| `observe-state-machines.test.ts:476` `legalTransitions` | 304 | **308** | REG-F-194 says `308→312` — **wrong**, and cites `subject.test.ts:1707` for a pin that is at `:1865` |

⚠ `:1866` is **masked** — `:1865` throws first, so it never executes. Both edits must be made in one pass or the
file stays red. `:1867` (82) and `:1868-1871` (11) are masked but **correct**; do not touch them.

Also re-pin `csaa:inventory` — it is red on **digests**, not only counts: both `verif/guard-enforcement-ledger.ts`
and `verif/arrow-command-census.ts` have drifted from the sha256 recorded in JAN-CSAA-005. And
`apps/rph-demo/e2e/tsconfig.json` is merge-added and not excluded by the subject scope, so expect an **additional
discovered TypeScript project row** carrying `e2e/**/*.ts` + `../playwright.config.ts`.

⚠⚠ **This increment arms a fail-open.** REG-F-123:3235 records that REG-F-120 ① (the leaked `.control-*` report)
is dormant *only because* the CSAA suite is red — every control exits non-zero, takes the differencing path, and
deletes the report on the way through. When these pins clear, controls begin **passing**, the passing arm leaves
`.control-run.json` on disk, and the fail-open arms itself. The recorded instruction is explicit: **re-run the P3
control and declare the leaked-report mutant on the same day.** This is not bookkeeping.

**Anti-suppression guard, must stay red-capable:** with `:216-217` updated, corrupting the anchor at
`packages/rph-application/src/handlers/intent.ts:421` must **still** fail via `enforcedAnchorBroken` /
`enforcedWithoutSite`. If it passes, the count edit was a suppression and W-4 is illegitimate.

**Gate:** full — vitest **and** playwright. This is the commit that may drop the REG-F-123 caveat.

---

### W-5 — Record it (post-merge)

* **File REG-F-195** at EOF of `docs/canon/JPWB-REG-005 Decision and Divergence Register.md`, after REG-F-194's
  block. House form: `---`, `### REG-F-195 — <claim-shaped sentence>`, metadata line with ` · ` separators,
  ALL-CAPS bold lead clauses with byte-exact citations, closing `**Merge target:** … **Safe default:** …`, then
  `---`. Exactly **one** live `**Status:**` (gated by `verif/register-status.test.ts`); the grandfathered by-name
  list is shrink-only, so a new entry may not join it.
  **Safe default, written narrowly:** no CSAA provider may bind a retained analyzer whose relative-import closure
  is not derived; and no worker failure may be reported as a digest without the specifier or message that named it.
* **Extend REG-F-123** — strike `~~6→7~~` and `~~40→41~~` in place per soft-delete discipline, carry the derived
  8 and 45, and add the two drifted digests, because the re-pin is digests **and** counts.
* **Extend REG-F-194** — its `308→312` and its `subject.test.ts:1707` citation are both wrong; record the
  correction and note that its "PRE-EXISTING" was relative to commit `39f8f042` inside the branch, while the
  merge-frame answer is different. Both are true in their own frame; say which frame.
* **Land these two documents** into `docs/_working/`. ⚠ Not `docs/canon/` — that is the ratified corpus.

---

### W-6 — The latent twin (scheduled, not bundled)

Retire the identical enumeration in `providers/jpwb-arrow-command-census/artifact-set.ts:148`.

⚠ **It is a no-op today** — that analyzer has no relative imports — which makes it cheap **and unwitnessed**. It
therefore needs C1's synthetic-subject treatment in its own right, or it is a change with no control. Open
question 2 in the design asks whether this belongs here or in W-2; the honest default is here, so that a
no-op change cannot ride in on another increment's green.

---

## 3. Ordering summary

```
W-0 diagnostics ──► W-1 closure module ──► W-2 wire + election ──► W-3 re-merge (witness)
                                                                        │
                                              W-4 re-pins (arms REG-F-120 ①) ◄┘
                                                        │
                                              W-5 register + docs ──► W-6 latent twin
```

W-0…W-2 land on main and are green there. W-3 is the only increment whose green means the derivation works.
W-4 is the only increment that may drop the REG-F-123 commit caveat.

## 4. Residuals carried, not closed

The 43 literal `verif/…` path sites across 14 non-test files (21 of them in `collect-inventory.ts`, including a
`path === 'verif/arrow-command-census.ts'` special-case in the generator that publishes JAN-CSAA-005), and
~~JAN-CSAA-005's generated over-claim~~ (**✅ corrected at its generator, `collect-inventory.ts`, and regenerated; the doc cell had meanwhile drifted from :347 to :355**). Both are recorded
in the design's §8 and in REG-F-195, so the next occurrence is met with a record rather than a surprise.
