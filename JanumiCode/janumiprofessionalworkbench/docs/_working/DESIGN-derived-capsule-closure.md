# DESIGN — deriving the retained-analyzer capsule closure

**Status:** Proposed (unratified) · **Date:** 2026-08-17 · **Programme:** JAN-CSAA
**Occasioned by:** REG-F-195 · **Merge target:** `packages/csaa` (main-side; the defect is CSAA's, not the
merging branch's)

---

## 1. The problem

CSAA's guard-enforcement-ledger provider executes a *retained analyzer* — `verif/guard-enforcement-ledger.ts` —
inside an isolated capsule: a temporary directory populated with byte-frozen copies of exactly the artifacts the
provider decided the analyzer needs. Membership is decided by `usesForPath`
(`packages/csaa/src/providers/jpwb-guard-enforcement-ledger/artifact-set.ts:388-407`), an eight-limb ladder of
literal path equality. Anything earning zero uses is dropped at `artifact-set.ts:469`
(`if (uses.length === 0) continue;`) — **silently, with no excluded count and no diagnostic.**

The only `verif/` paths that can earn a use are the three literals in
`GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS` (`packages/csaa/src/contracts/guard-enforcement-ledger.ts:34-38`,
built from the constants at `:31-33`).

A correctly-motivated change on another branch added a third import to the analyzer:

```
verif/guard-enforcement-ledger.ts:25   import { arrowKey } from './arrow-command-census.js';
```

`verif/arrow-command-census.ts` matches no limb of the ladder. It is therefore never materialised, the dynamic
`import()` at `worker.ts:464` cannot resolve `./arrow-command-census.js`, `--no-install` (on the spawn argv at
`observe-guard-enforcement-ledger.ts:443`) forbids any fallback, and Bun raises a `ResolveMessage`.

⚠⚠ **The cause is a recorded virtue.** REG-F-134 praises precisely this import — the analyzer uses C-0's own
`arrowKey` rather than re-implementing it, because a two-census join's characteristic failure is a key-format
mismatch that returns `[]` and reads as green. The correct upstream decision and the downstream outage are one
event. That is the argument for **deriving the closure**, not for discouraging the import.

⚠ **No merge could have caught this.** `packages/csaa` was not touched by the merge at all — the staged diff over
that tree is empty. One side changed the analyzer's import graph; the other owns the allowlist that decides what
reaches the capsule. The two never overlapped, so there was no textual conflict to report. This class of break is
invisible to `git merge` by construction.

### 1.1 Why it was opaque

Two independent diagnostic defects stacked:

* `worker.ts:510-511` — `error instanceof Error ? error.message : 'guard-enforcement-ledger worker: unknown
  failure'`. Bun's `ResolveMessage` is **not** an `Error`, so the message that literally named the missing
  specifier was replaced by a 49-byte constant, and `process.exitCode = 1` was set at `:513`.
* `observe-guard-enforcement-ledger.ts:877` — replaces stderr entirely with `sha256(stderr)`.

Because the surviving message is **path-free**, its digest is byte-identical on every run even though the capsule
root is a random `mkdtempSync`. Confirmed: sha256 of those 49 bytes is
`a17fe5d41d9219f22c2b78ee04ee3127f081332da3f72f82ea16ea6fbf1412b5`, exactly the digest the failing test reported.
An "impossible" determinism was the tell that the message carried no path — and that is the only reason it was
reconcilable at all.

**Causation was proved by control, not inference:** copying that one file into a reproduced capsule and running
the *unpatched* worker gives exit 0, empty stderr, and a valid 141,259-byte result.

---

## 2. The chosen design

The population must be **derived from the analyzer's own source**, not enumerated. The derivation must be decidable
from frozen bytes alone, must be provider-neutral — both providers carry the defect, one live and one latent — and
must fail loudly when it cannot decide.

### 2.1 A shared module, not a provider patch

`packages/csaa/src/subject/analyzer-closure.ts`, depending on `FrozenSubject`, `ts` and `posix` only:

```ts
export interface FrozenModuleClosureRequest {
	readonly entryPaths: readonly string[];
	readonly maxClosureNodes: number;
	readonly subject: FrozenSubject;
}

export type FrozenModuleClosureFindingCode =
	| 'BYTES_UNAVAILABLE' | 'CLOSURE_BUDGET_EXHAUSTED' | 'ENTRY_INVALID' | 'ENTRY_NOT_IN_SUBJECT'
	| 'SOURCE_SYNTAX_INVALID' | 'SOURCE_UNDECODABLE' | 'SPECIFIER_AMBIGUOUS'
	| 'SPECIFIER_ESCAPES_SUBJECT' | 'SPECIFIER_EXCLUDED_FROM_SUBJECT' | 'SPECIFIER_NOT_LITERAL'
	| 'SPECIFIER_UNRESOLVED';

export function resolveFrozenModuleClosure(request: FrozenModuleClosureRequest): FrozenModuleClosure;
```

**Fail-closed invariant, stated as a law and tested:** `paths.size === 0` **iff** `findings.length > 0`. There is
no partial closure, because a partial closure is exactly what the capsule cannot survive.

### 2.2 The walk

Breadth-first, with `paths` serving as the visited set and membership added at **enqueue** time. Two structures
collapse into one and termination becomes a one-line proof: a path enters `paths` at most once, so total pushes
≤ `maxClosureNodes`, and each iteration performs exactly one `shift`. **The loop is bounded regardless of graph
shape, cycles included.**

⚠ **Correction to an earlier reading of ours: the live graph is a DAG, not cyclic.** The complete relative-edge map
of non-test `verif/`, verified at the worktree, at `185c700d` and at `6d83aa3a`:

```
verif/guard-enforcement-ledger.ts:25       -> ./arrow-command-census.js
verif/binding-row-truth.ts:31              -> ./arrow-command-census.js
verif/trigger-claim-truth.ts:39            -> ./binding-row-truth.js         (import type)
verif/guard-enforcement-ledger.data.ts:12  -> ./guard-enforcement-ledger.js  (import type)
```

The data→analyzer edge points back at a *root*: convergence, not a cycle. The visited set is load-bearing **today**
for convergence — both roots reach the analyzer/census pair, and without it the census is parsed twice per
derivation and roughly eight times per observation — and load-bearing **in general** because nothing else would
stop a future cycle. This design does not claim a cycle exists; it claims the walk must not depend on its absence.

### 2.3 Why a fixpoint and not a depth-1 walk

`verif/arrow-command-census.ts` is a **terminal** node: exactly four specifiers, all bare (`node:fs`, `typescript`,
`@janumipwb/rph-domain` on the multi-line `:17-22` `from` clause, `@janumipwb/rph-contracts`), zero relative. For
*this* closure a depth-1 walk provably halts at depth 1 and adds nothing.

Depth-1 is nonetheless unsound as the resolver, and **the counterexample is live in the same directory today**:
rooted at `verif/trigger-claim-truth.ts`, a depth-1 walk materialises `binding-row-truth.ts` and omits
`arrow-command-census.ts` — reproducing the identical `ResolveMessage` one hop deeper, swallowed by the identical
`instanceof Error` filter.

⚠ That chain runs through an `import type` edge, which makes the fixpoint requirement and the type-blindness rule
below **the same decision**. Adopt "skip type-only imports" and depth-2 becomes unreachable *for the wrong reason*:
because we guessed at elision rather than proved reachability.

### 2.4 Resolution — wide candidates, strict selection

Bun performs the `.js`→`.ts` rewrite at runtime. That is measured, not assumed: `./arrow-command-census.js` has no
`.js` on disk, and the control (copying only the `.ts`) makes the unpatched worker exit 0. The capsule resolver
must perform the same rewrite.

| specifier suffix | candidates generated |
|---|---|
| `.js` | `.ts`, `.tsx`, `.js` |
| `.mjs` / `.cjs` | `.mts`/`.mjs`, `.cts`/`.cjs` |
| `.ts` / `.tsx` / `.json` | itself |
| none | `p.ts`, `p.tsx`, `p/index.ts`, `p` |

**Exactly-one is required, not first-match.** Zero present candidates → `SPECIFIER_UNRESOLVED`; more than one →
`SPECIFIER_AMBIGUOUS`. Returning the first present candidate would be a *preference* — a bet on which file Bun
picks. Requiring exactly one is a *refusal*. Today `verif/arrow-command-census.js` does not exist so the two
behave identically; the refusal is honest where the preference is a wager, and the wager is the class of thing
under repair.

### 2.5 Determinism rules

* Path comparison is **exact-string**, over a `Map<string, number>` index built once from `subject.artifacts`. It
  must **not** route through `canonicalPathKey` (`subject/paths.ts:34-43`), which consults
  `ts.sys.useCaseSensitiveFileNames`. Closure membership feeds `artifacts` → `artifactContentDigest`
  (`artifact-set.ts:625`) → the artifact-set id, so routing through it would make a **content-addressed identity
  platform-dependent**. Exact-case is safe because `canonicalPathKey` is paired with
  `assertNoCanonicalPathCollisions` (`subject/paths.ts:92-106`); a subject that survives freezing has no
  case-colliding paths. ⚠ This rule belongs in the module header, or the next editor will route through it.
* `findings` are sorted canonically before return. `derivePopulation` runs ~4× per observation and
  `artifact-set.test.ts:191-192` asserts a rebuild `toEqual`s the first build; unstable ordering would break
  reproduction.
* Byte access only, never the filesystem: `readFrozenSubjectArtifact` (`subject/frozen-store.ts:12-18`) and
  `hasFrozenSubjectArtifact` (`:20-22`) for presence probing, so we never `.slice()` a whole file merely to test
  whether it is there.

### 2.6 Type-only imports are traversed

We do **not** attempt to model elision. An `import type` edge is followed like any other. Rationale: the
`trigger-claim-truth → binding-row-truth` edge is type-only, and treating it as absent is precisely how a depth-2
requirement disappears from view. Cost: at most a few extra bytes in the capsule. Benefit: the closure is a
statement about the *source graph*, which is decidable, rather than about *what the runtime will elide*, which is
a guess about a toolchain we do not control.

### 2.7 Rooting the walk — a trap worth naming

⚠⚠ **Root the walk at the worker's actual import roots, not at `RETAINED_VERIFIER_PATHS`.** The worker imports
exactly two modules (`worker.ts:464-465`): the analyzer and the data file. The third retained path is the
*test*, which is materialised but never executed
(`GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION='NOT_EXECUTED_BY_CSAA'`).

Rooting at all three drags in the test's specifiers — including **`vitest`**, which the capsule cannot satisfy:
`linkModule` (`observe-guard-enforcement-ledger.ts:424-428`) junctions only `typescript`, `ulid` and `zod`. A
design that roots at the convenient list turns a fixed bug into a new one.

### 2.8 Bare specifiers are collected, never traversed

`@janumipwb/rph-contracts` is a new package edge for the closure — the analyzer itself never imported it — but it
costs nothing: the ladder already carries both contracts constants, and `worker.ts` already resolves
`contractsResolvedPath` unconditionally. Had it not been materialised, the worker would have been failing at main.
**Admitting `arrow-command-census.ts` adds no new package requirement.**

---

## 3. Failure closure

Today an unresolved specifier is *silent* — `artifact-set.ts:469` drops the artifact and records nothing. That
silence is the bug, not a side effect of it. Every finding code in §2.1 surfaces as a typed diagnostic on the
artifact-set outcome.

⚠ **Cap-plus-summary, not dedupe.** `limitDiagnostics` (`artifact-set.ts:554-566`) replaces the *last* slot with a
synthetic `BUDGET_EXHAUSTED`, and at `maximum === 1` returns **only** that synthetic — erasing every real cause.
Verified byte-exact. Closure findings must therefore be sorted canonically, capped at eight, and followed by
exactly one summary diagnostic carrying the residual count, so a real cause can never be displaced by the cap.

Each finding carries `importerPath`, `specifier` **as written**, and `resolvedCandidate` — the three facts a human
needs in order to act. The original outage produced none of them.

---

## 4. The election — widening a closed union

`GuardEnforcementLedgerArtifactUse` is a **closed** union of eight members. Closure-derived modules need a use, and
there are two ways to give them one:

* **Reuse `ANALYZER_SOURCE`.** Smallest diff, but it silently inflates
  `analyzerArtifacts: count('ANALYZER_SOURCE')` (`artifact-set.ts:540`) from 1 to 2 for the real subject — a
  change of output meaning under an unchanged schema id.
* **Add `ANALYZER_DEPENDENCY_SOURCE`** and bump `GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION`
  **1.0.0 → 2.0.0**, with a matching coverage field.

**We elect the second.** `JAN-CSAA-007` §18.2 classes both "add enum value to a closed enum" and "change output
meaning" as **Major**; under `unknown majors fail`, readers must move in the same change. Silently widening a
closed union under a `1.0.0` id is the one branch that is affirmatively wrong — and not merely formally: a
1.0.0-labelled record produced by the new code carries a `uses` value that a 1.0.0 consumer rejects as
`INVALID_VALUE` against its own `ARTIFACT_USES` set. Same label, incompatible instances.

⚠ **Corrected during implementation: the bump is 2.0.0, not the 1.1.0 this document first proposed.** There is
**no semver parsing anywhere in `packages/csaa`** — no major extraction, no range satisfaction, no compatibility
map (those exist only as prose in JAN-CSAA-007 §18.4). Conformance is strict byte-identical literal equality
against a frozen `as const` string, enforced by `artifact-set.ts:995` plus the literal type at `contracts:97`.
So "unknown majors fail" here means *any* non-identical string is rejected; the code cannot distinguish a major
bump from a typo. A MINOR bump would therefore buy nothing, and the change is a **hard cut, not a migration**.
It also rotates four content-addressed identities — artifact-set id and contentDigest, observation id and
contentDigest — because `schemaVersion` sits in the id preimage. No test pins those as literals, so the rotation
is absorbed by the reproduction checks, but it is a real change of observable identity rather than a relabelling.

⚠ **Also corrected: `POPULATION_RECONCILIATION_FAILED` already exists** and is already emitted eight lines from
the silent drop. The new diagnostic code this document originally proposed was unnecessary.

⚠ This is recorded **as an election, not as compliance.** `JAN-CSAA-005:347` expressly disclaims full
JAN-CSAA-007/008 conformance, and 007 is itself a commissioned Draft. We follow §18.2 voluntarily because it is
right here, and we say so rather than implying an obligation this provider does not claim.

---

## 5. Authority — stated honestly

**Nothing ratified commands this remedy, and nothing ratified forbids it. No sponsor gate is required.**

All 43 ratified decisions (REG-D-001 … REG-D-043) were read; none adjudicates enumeration versus derivation of a
population. The two nearest are narrower: REG-D-043 derives *the arrow set* from §8.2, and REG-D-042 makes tier
tailoring a ratchet.

The strongest citation is the programme's own `JAN-CSAA-W4-DESIGN-001` §5.2:240 — "The resolver SHALL derive
populations, not depend on lists that silently rot" — with `W4D-REQ-017`. ⚠ But that document is `Status: Draft`,
has never been before the sponsor, and greps to **zero hits** in the register.

So the honest framing, and the only one that survives adversarial review: **this restores internal consistency with
the programme's own normative design requirement, and that requirement is unratified.** It is an
internal-consistency argument, not an appeal to canon. Nothing here discharges a ratified SHALL.

Supporting precedent exists as *method* rather than law — REG-F-172 ("prefer a closed predicate to an open
enumeration … the enumeration is at best a better ERROR MESSAGE, never the guarantee"), REG-F-091, and REG-F-194
Finding 2 ("the DERIVATION stopped being total over commands"). Most sit in CLOSED entries, so they bind nothing.

---

## 6. Blast radius

| File | Change |
|---|---|
| `subject/analyzer-closure.ts` | **new** — the shared resolver |
| `contracts/guard-enforcement-ledger.ts:34-38` | add `ANALYZER_DEPENDENCY_SOURCE` to the union; bump schema version |
| `providers/jpwb-guard-enforcement-ledger/artifact-set.ts:388-407` | new `usesForPath` arm fed by the closure |
| `providers/jpwb-guard-enforcement-ledger/artifact-set.ts:469` | emit findings instead of dropping silently |
| `providers/jpwb-guard-enforcement-ledger/artifact-set.ts:532-551` | coverage field for the new use |
| `providers/jpwb-arrow-command-census/artifact-set.ts:148` | same arm — retires the latent twin |
| `worker.ts:510-511` | preserve non-`Error` throwables (specifier + referrer) |
| `observe-guard-enforcement-ledger.ts:877` | bounded stderr prefix alongside the digest |

⚠ **Do not add the closure paths to `REQUIRED_PATHS` (`artifact-set.ts:59`).** That reddens
`artifact-set.test.ts:191-193`, whose 13-artifact fixture expects `diagnostics: []` and carries no census path.

---

## 7. Controls, each with its own mutant

A control without its own mutant is a control that cannot fail. Each entry below pairs the control with the mutant
that must redden **the control**, not the end-to-end test.

| Control | Mutant that must redden it |
|---|---|
| **C1 — synthetic closure.** Synthetic `FrozenSubject` whose analyzer imports `./synthetic-dep.js`; assert the artifact set binds `verif/synthetic-dep.ts` with `ANALYZER_DEPENDENCY_SOURCE`. ⚠ The dependency **must not** be named `arrow-command-census` — a fourth-hardcoded-literal fix passes a test naming the real file and fails this one. | Stub the extractor to return an empty set. |
| **C2 — fixpoint, not depth-1.** `synthetic-dep.ts` itself imports `./synthetic-dep-2.js`; assert that file is bound too. | Cap the walk at depth 1. |
| **C3 — fail-closed law.** Omit `verif/synthetic-dep.ts` from `subject.artifacts`; assert `SPECIFIER_UNRESOLVED` naming the specifier, and `paths.size === 0`. | Delete the diagnostic emission, keep the selection. |
| **C4 — the non-`Error` swallow.** Drive the worker standalone (the `worker.test.ts:143` `spawnSync` pattern) against a capsule deliberately missing the file; assert stderr **contains** `arrow-command-census`. | Restore the `instanceof Error` ternary. |
| **C5 — hashed-away stderr.** Stubbed child emitting known stderr with non-zero exit; assert the `EXECUTOR_FAILED` message contains a prefix of that text, not only the digest. | Revert to digest-only. |

**End-to-end witness (necessary, not sufficient):** `observe-guard-enforcement-ledger.integration.test.ts:193`
turns green, and `:216-217` then read 21/15. ⚠ Its anti-suppression guard must stay red-capable: with `:216-217`
updated, corrupting the anchor at `packages/rph-application/src/handlers/intent.ts:421` must **still** fail, via
`enforcedAnchorBroken`/`enforcedWithoutSite` becoming non-empty. If it passes, the count edit was a suppression.

⚠ The `a17fe5d4…` digest ceases to be this failure's fingerprint the moment C4 lands. Any control that reverts the
selector must be re-baselined against the new specifier-naming message, or it becomes a control that cannot fail.

---

## 8. What this design does **not** fix

* **The 43 remaining literal `verif/…` path sites across 14 non-test files** (ripgrep
  `'verif/[A-Za-z0-9./_-]*'` over `packages/csaa/src/**/*.ts`, excluding `*.test.ts` and `*.test-support.ts`).
  `collect-inventory.ts` alone holds 21, including a `path === 'verif/arrow-command-census.ts'` special-case **in
  the very generator that publishes JAN-CSAA-005**. Out of scope here; recorded so the next occurrence is not
  discovered as a surprise.
* ~~**`JAN-CSAA-005`'s over-claim.**~~ **✅ CORRECTED 2026-08-17 at its generator and regenerated.** Originally: The Qualification cell states unqualified that the provider "binds exact
  FrozenSubject artifacts". That text is *generated* from `collect-inventory.ts` `capabilities()` (~:1168) into
  both the document region and `verif/csaa/jan-csaa-005.inventory.baseline.json`. Correcting the wording is a
  **code** change plus regeneration, or the doc and the baseline disagree and `csaa:inventory:check` stays red.
* **Package-boundary closure.** Bare specifiers are collected, never traversed. A missing *package* would fail
  differently and is not addressed.

---

## 9. Open questions for the author

1. Should `resolveFrozenModuleClosure` live in `subject/` (proposed) or in a new `closure/` peer? It is
   subject-shaped but provider-consumed.
2. Does retiring the latent twin in `jpwb-arrow-command-census` belong in this increment or the next? It is a
   no-op today (that analyzer has no relative imports), which makes it cheap **and** unwitnessed.
3. `maxClosureNodes` — derive from the existing artifact budget, or give the closure its own? A shared budget
   couples two failure modes under one number.
