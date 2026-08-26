# ROADMAP — Wiring the recomposition acceptance (REG-D-044 → REG-F-085 → REG-F-041 S-1)

**Authority:** REG-D-044 (delegated ruling, 2026-08-21). **Design:** `DESIGN-recomposition-judgement.md` §4.
**Shape decision, delegated under REG-D-004 and taken here:** the command **targets the object being moved and
CITES the authorizing Decision**. That is this engine's established idiom — `baselineBacksPwu` (`pwu.ts:809`,
"is there an AUTHORITATIVE Baseline naming this PWU?"), `rejectPwu`'s rejection-decision citation, and
`waiver-authorization`'s `resolveWaiverAuthorization`. The alternative — advancing the contract as a side effect
inside `approveDecision` — is a **cross-aggregate write** from the Decision aggregate, the shape
`execution.ts:394-408` already declined once and recorded why ("inventing a shape to satisfy a guard").

⚠ **AND THE NAMING CARRIES THE RULING.** `AcceptRecomposition` does **not** perform the acceptance — the
**Decision** does, and REG-D-044 Ruling 3 is that `decide` is the ratified act. This command RECORDS THE EFFECT of
an already-EFFECTIVE Decision on the contract aggregate. That distinction is the difference between wiring a
ratified act and inventing an unratified one, and every artifact below must keep it.

---

## S-1a — the acceptance reaches the contract

**Guarantee claimed, exactly:** `RecompositionContract.status` reaches `SATISFIED` only when an EFFECTIVE
`APPROVAL` Decision names this contract AND an explicit assessment covering the parent completion claim has
concluded. **NOT claimed:** that the assessment evaluated DEC-6's nine checks (REG-F-042: eight are
unimplemented, and that is a capability, not this increment).

**A-1 · Vocab + generator.** `packages/rph-contracts/vocab/m3-commands-events.json`: one command
`AcceptRecomposition` (target `RECOMPOSITION_CONTRACT`, emits `RecompositionAccepted`, `drivesMachine:
RecompositionContract.status`, `drivesFrom: COMPOSABLE`, `drivesTo: SATISFIED`), one event, both annotated
`UNRATIFIED-AUTHORED (REG-D-044)`. Payload: `acceptanceDecisionId` (required), `parentAssessmentId` (required).
Then `bun run gen`.
⚠ **`bun run gen` is run by NO CI step** (design §1.2) — exactly two files read a field's `required` flag, both
emitters. **A-1 is not complete without `verif/accept-recomposition-shape.test.ts`** asserting the emitted shape,
patterned on `verif/transition-provenance-carried.test.ts`. Without it the whole increment is one un-run
generator away from silent reversion, detectable by nothing.

**A-2 · The two wrong BINDINGS rows.** `messages.ts:3156-3170` declares `BeginRecomposition` and
`CompleteRecomposition` drive `PWU.workLifecycleState`; their handlers drive `RecompositionContract.status` and
say so in their own comments. `ProposeRecomposition`'s row is correct. **Fix both in A-1's regeneration** — with
`AcceptRecomposition` present, leaving them would give two commands the same claimed arrows.

**A-3 · Handler.** `acceptRecomposition` in `handlers/decomposition.ts` via `advanceStatus`, with
`precondition: fromStates('COMPOSABLE')` and a guard composing two predicates, each its own function so each is
independently mutable:
- `decisionAcceptsRecomposition(ctx, contractId, decisionId)` — mirror of `baselineBacksPwu`: `objectType ===
  'DECISION'`, `decisionType === 'APPROVAL'`, `status === 'EFFECTIVE'`, `subjectObjectIds.includes(contractId)`.
- `assessmentCoversParentClaim(ctx, contract, assessmentId)` — §14.1 b6: `objectType ===
  'ASSURANCE_ASSESSMENT'`, `assessmentHasConcluded(state.assessmentState)` (`rph-domain/src/governance.ts:599`,
  a POSITIVE list that fails closed on an unknown state — invoke it, do not re-enumerate), and its `claimIds`
  include the contract's `parentCompletionClaimId`.
Register at `handlers/registry.ts`.

**A-4 · Tests.** New `recomposition-acceptance.test.ts`.
- **RED-1** (the claim): a COMPOSABLE contract + EFFECTIVE APPROVAL Decision naming it + concluded assessment
  covering the claim → ACCEPTED, status `SATISFIED`. **Fails at HEAD: the command does not exist.**
- **RED-2**: a Decision that names ANOTHER object → REJECTED, status unchanged.
- **RED-3**: a Decision still PROPOSED → REJECTED.
- **RED-4**: no assessment / an assessment still ASSESSING → REJECTED (§14.1 b6).
- **RED-5**: from EVALUATING rather than COMPOSABLE → REJECTED, `RPH_ILLEGAL_STATE_TRANSITION`.
- **CONTROL**: RED-1's arrangement is the control. Its own mutant is **unconditional refusal**.

**A-5 · Mutants — and the panel got these WRONG, which is why they are specified here.**
| id | mutation | reddens |
|---|---|---|
| `MU-F085A-acceptance-needs-no-decision` | drop the `decisionAcceptsRecomposition` conjunct | RED-2, RED-3 |
| `MU-F085A-acceptance-needs-no-assessment` | drop the `assessmentCoversParentClaim` conjunct | RED-4 |
| `MU-F085A-acceptance-refuses-everything` | guard → `return false` | **CONTROL / RED-1 alone** |
⚠ **The control's mutant is UNCONDITIONAL REFUSAL, not a `SATISFIED`→`COMPOSABLE` swap.** The panel proposed the
swap and called it a control mutant; it reddens a REFUSAL test the same document authored — **a main-test mutant
wearing a control's label**. Its complement (`return true`) reddens the refusal tests alone.

**A-6 · Gates that MOVE, each verified by the panel at HEAD.**
1. `verif/guard-enforcement-ledger.test.ts` `unreachabilityFaults` — **trips automatically**: the
   `COMPOSABLE → SATISFIED` guard is currently classified `ARROW_UNREACHABLE`, and covering the arrow makes that
   a false dismissal. Row → `ENFORCED` with `enforcingSite` + an `enforcingAnchor` that resolves EXACTLY ONCE.
   Counts `{ARROW_UNREACHABLE: 21, ENFORCED: 15, …}` → `{20, 16, …}`; the total 82 must be preserved.
2. `verif/arrow-command-census.baseline.json` — delete the `COMPOSABLE -> SATISFIED` uncovered line.
3. `verif/arrow-census-coverage.test.ts` — `declarationRows +1`, `distinctArrowsDeclared +1`,
   `ratifiedArrowsCovered +1`. `machinesDeclared`, `machinesSeen`, `arrowsRatified` UNCHANGED.
4. `verif/event-surface-census.test.ts` — `RecompositionAccepted` enters BOUND. **EMITTED is a HAND-PINNED
   snapshot**, so the repair is an argued dated edit, not a count bump.
5. `packages/rph-engine/src/replay-conformance.test.ts` — a NEW authored event cannot enter the §26 fixture's
   `missing` list. **Verify by running; do not assume.**
6. `verif/binding-row-truth.test.ts` / `trigger-claim-truth.test.ts` — `RecompositionContract.status` goes
   7/15 → 8/15 arrows covered. **Still incomplete → stays in `unanalysed` → NO move.**

---

## S-1b — the PWU arrows, guarded literally

**REVISED 2026-08-21 against DESIGN §6.** The first draft of this section named the two acts by their §8.1 prose
labels, prescribed a binding-row fix the register had already retracted, and cited no authority for the two events
it minted. All three are corrected below; §6 carries the reasoning. Only after S-1a, because `SATISFIED` must be
reachable first — that is the whole reason REG-F-085 blocked.

**Guarantee claimed, exactly:** `PWU.workLifecycleState` reaches `RECOMPOSING` only when a RecompositionContract
names this PWU as its parent AND requires at least one child; and reaches `RECOMPOSED` only when that contract's
`status` is the enum literal `SATISFIED`. **NOT claimed:** that the recomposition was correct (DEC-6's nine checks
— REG-F-042 measures eight as unimplemented), nor that the parent-vs-child ownership question is answered
(REG-Q-028 — its SAFE DEFAULT is enforced, the question stays OPEN).

**B-0 · Names, decided in DESIGN §6.1.** Commands `BeginPwuRecomposition` / `CompletePwuRecomposition` (both names
already used in REG-F-085's own body); events `PwuRecompositionBegun` / `PwuRecomposed`. ⚠ **NOT
`PwuRecompositionStarted`** — it contains the existing `RecompositionStarted` as a substring, and this repository
has at least three substring-matching readers (mutation anchors, `recomposition-ungoverned`'s `indexOf` CONTROL,
`command-dispatch-census`'s literal scan). Authority for the shapes: **REG-D-029**, annotated
`UNRATIFIED-AUTHORED`, precedent REG-D-032's `PwuEscalated`.

**B-1 · Mint BOTH PWU acts in ONE commit.** ⚠ `PWU_SEMANTIC_LIFECYCLE_COMMANDS` membership refuses the generic
setter **with no fallback** — verified at `pwu.ts:1422`, a two-branch total whose only escape is
`owner === undefined`. Ship the RECOMPOSING row without its command and the state becomes reachable by NOTHING;
ship RECOMPOSED's without its command and any PWU parked in RECOMPOSING is stranded (its only other exits are
`SupersedePwu` / `AbandonPwu`). **Half the pair is worse than today**, not merely incomplete.

**B-2 · The guards are LITERAL, and each conjunct is independently mutable.** One shared loader
`recompositionContractForPwu(ctx, pwuId, contractId)` — `objectType === 'RECOMPOSITION_CONTRACT'` and
`parentWorkUnitId === pwuId` (**REG-Q-028's safe default, enforced not resolved**) — then one distinct conjunct per
command:
- `BeginPwuRecomposition` — §8.1 *"Parent exists and recomposition is required"*: the contract loads, and
  `requiredChildWorkUnitIds.length > 0`. Both halves of the trigger, read literally.
- `CompletePwuRecomposition` — §8.1 *"Recomposition contract satisfied"*: `status === 'SATISFIED'`, **the enum
  literal**. No `COMPOSABLE` fallback and no disclosure carve-out — REG-D-044 Ruling 1 closed that, and the reading
  survived an adversary set specifically to break it.

**B-3 · Move the spec rows, do not copy them.** `PWU_GENERIC_SETTER_SPECS.RECOMPOSING` / `.RECOMPOSED`
(`pwu-lifecycle-command-spec.ts:272-283`) MOVE into `PWU_LIFECYCLE_COMMAND_SPECS`, and `PwuLifecycleCommandType`
extends 11 → 13 (that union is what makes `check-types` a gate on the move; `PWU_GENERIC_SETTER_SPECS` is
`Record<string, …>` and is NOT type-protected, so deleting its rows is silent to `tsc`). Counts, re-derived by
executing the tables: `lifecycle-arrow-declarations.test.ts` 11 → 13 and 8 → 6; the by-arrow split
`{semantic 49, genericSetter 8, recovery 4}` → `{51, 6, 4}`; **`allClaimedArrows().length` stays 61** — a COPY
pushes it to 63, which is the cheap tell. `arrow-census-coverage.test.ts` moves on NOTHING (185/182/167 all hold);
a copy would show 185 → 187 rows against 182 distinct, the census's own signature for a duplicated declaration.

**B-4 · ⚠ THE OMISSION THAT SHIPPED THREE TIMES.** `pwu-replay.ts`'s fold ends `default: return axes` (:144-145).
Both events join the named case group at :123-133 **in the same commit**. ⚠ That group's body reads
`p.workLifecycleState` (:139) — so both events MUST declare that field, or they need their own case, exactly as
`PwuBaselined` does for carrying `newState` instead. `pwu-fold-drive-sites.test.ts` then demands an
`EXPLICIT_DRIVE_SITES` entry per event, keyed by EVENT type, naming a file that calls `expectPwuReplayEquivalence`
and a title occurring EXACTLY ONCE; its `uncovered` pin goes 9 → 11 names in sort order.
⚠ **BEING IN THE RIGHT COMMIT IS NECESSARY AND NOT SUFFICIENT** — W-5 added its two fold cases in exactly the right
commit and both were still dead code, with a mutant deleting BOTH leaving 1203 tests green. The drive site is what
makes the case load-bearing.

**B-5 · The four binding rows (REG-F-082), NOT two corrected ones.** DESIGN §6.2. Rows 1-2 retarget
`BeginRecomposition` / `CompleteRecomposition` to `RecompositionContract.status` **with their real alternations**
(`READY|CONFLICTED|INSUFFICIENT -> EVALUATING`; `EVALUATING -> COMPOSABLE|CONFLICTED|INSUFFICIENT` — note the
existing `note` strings say `EVALUATING->SATISFIED`, which is now AcceptRecomposition's arrow and was already
stale); rows 3-4 are NEW, for the two new commands. **Both copies of the claim must move** — the `bindings[]` row
(which generates `BINDINGS`) and the `commands[].drives*` triple (which the generator does NOT emit and which
`verif/binding-row-truth.ts` reads alone; its own comment records that this copy "had never been read by any
control at all, and it carried four of the five defects"). Then `bun run gen` — **the package-level `gen`, never
`gen:messages` alone, which skips prettier and produces a file `format:check` rejects.** REG-F-082 CLOSES here.

**B-6 · Mark the dead slots.** The optional `workLifecycleState` field on `RecompositionStarted` /
`RecompositionCompleted` becomes permanently unpopulatable once the PWU events exist. Say so in both notes, naming
AGG-1 and REG-F-046 — an unmarked live-looking slot is an invitation to reintroduce the cross-plane write.

**B-7 · Retire the pin PROPERLY, and close two entries.** `verif/recomposition-ungoverned.test.ts` exists *"so that
fixing it FORCES the register entry to be revisited rather than left stale."* Invert its two `ACCEPTED` assertions
IN PLACE, invert the committed-state assertion (the PWU must NOT have moved), and flip its ledger CONTROL from
`UNENFORCED` to `ENFORCED` so the runtime↔ledger conjunction survives. ⚠ **THE CONTROL LOCATES ROWS BY
`ledger.indexOf(guard)` AND REGEXES THE FIRST `disposition:` WITHIN 400 CHARS** — S-1a tripped exactly this by
quoting another row's guard string inside its own evidence prose. Neither rewritten evidence block may contain the
other guard's literal text. **REG-F-085 and REG-F-082 both move to CLOSED in this commit**, each by STRIKING its
old `**Status:**` line as `- ~~…~~` and adding a replacement — REG-F-085 is no longer grandfathered in
`register-status.test.ts`, so two live statuses or zero both redden.

**B-8 · Gates that MOVE, each verified at HEAD by measurement rather than prediction.**
| gate | at HEAD | after |
|---|---|---|
| `lifecycle-arrow-declarations.test.ts` | 11 / 8 / 61, `{49,8,4}` | 13 / 6 / **61**, `{51,6,4}` |
| `guard-enforcement-ledger.test.ts` COUNTS | `ENFORCED 16, UNENFORCED 44` | `18 / 42` (total **82 preserved**) |
| `csaa/…/observe-guard-enforcement-ledger.integration.test.ts` | `16 ENFORCED, 44 UNENFORCED` | `18 / 42` |
| `validate.test.ts` registry ids | 356 | **360** (2 commands + 2 events; count what `gen` emits, do not assume) |
| `tracker-ingest.test.ts` w2 census | `n: 267` | **269** (+1 per COMMAND only; EVENTS is not a w2 population) |
| `event-surface-census.test.ts` `EMITTED_2026_08_04` | — | +2 names, an **ARGUED dated edit**, not a count bump |
| `pwu-fold-drive-sites.test.ts` `uncovered` | 9 names | **11**, plus 2 `EXPLICIT_DRIVE_SITES` rows |
| `csaa/jan-csaa-005.inventory.baseline.json` | — | regenerate with `bun run csaa:inventory`; NEVER hand-edit |
| `arrow-census-coverage` · `binding-row-truth` · `trigger-claim-truth` · `replay-conformance` · `generic-setter-scope` | — | **NO CHANGE** — each verified by running it, not by assuming |

⚠ **`generic-setter-scope.test.ts` STAYS GREEN WITH ZERO EDITS, AND THAT IS THE PROBLEM.** Its six pairs are
hardcoded *"NOT imported from `PWU_SEMANTIC_LIFECYCLE_COMMANDS`"* precisely so it proves CLASSIFICATION rather than
totality — which means it cannot notice that its own coverage just went stale. It will report green over 6 of 8
owned targets. **Two cases and the header's "SIX" are owed by discipline, not by the gate.**

⚠ **`trigger-claim-truth` is CONDITIONAL ON THE NAMES AND MUST BE RE-RUN.** Its resolver scans every ratified
trigger for `/\b([a-z]+[A-Z][a-zA-Z]*)\b/`, capitalises, and counts a claim if the token names a real command —
so **adding a command can move `namingAKnownCommand` with no trigger text changing at all.** The chosen names
appear in no trigger, which is why the prediction is NO CHANGE; verify by running.

**B-9 · Mutants — the first increment to declare any for this surface.** S-1a added ZERO ledger entries, and
REG-F-194 already recorded the general form: *"an increment that added a command, a guard limb, a census idiom and
a fail-closed refusal declared ZERO new mutants, so nothing in this gate names any of W-5.5's new logic. The green
tells me I broke nothing that was already measured — it says nothing whatever about what I just built."*

| id | mutation | must redden |
|---|---|---|
| `MU-F085B-begin-needs-no-contract` | drop the parent-match conjunct | Begin's wrong-parent refusal |
| `MU-F085B-begin-admits-an-empty-composition` | `length > 0` → `>= 0` | Begin's no-children refusal |
| `MU-F085B-complete-accepts-the-candidate` | `'SATISFIED'` → `'COMPOSABLE'` | Complete's COMPOSABLE refusal |
| `MU-F085B-the-setter-performs-the-arrows-again` | delete both `PWU_SEMANTIC_LIFECYCLE_COMMANDS` rows | `recomposition-ungoverned` |
| `MU-F085B-the-fold-forgets-the-two-events` | delete both `case` labels | the replay-equivalence CONTROL |
⚠ **THE CONTROL'S OWN MUTANT IS UNCONDITIONAL REFUSAL**, not a `SATISFIED`→`COMPOSABLE` swap. The swap reddens a
REFUSAL test this same document authored — a main-test mutant wearing a control's label.
⚠ **ANCHOR COLLISION IS THE LIKELIEST RED AND IT FIRES BEFORE ANY MUTATION RUNS.** Two new handlers written into
`pwu.ts` will structurally mirror the existing eleven; `F114-a-spec-quietly-drops-an-arrow` anchors on a bare
`sourceStates: [...]` line and `F119-a-transcribed-source-drifts-from-the-machine` on a whole 5-line
`PWU_GENERIC_SETTER_SPECS` entry. Run `./node_modules/.bin/vitest run verif/mutant-ledger.test.ts` **before**
committing — that is the cheap half, and it is what caught S-1a's `UNANCHORED` before any mutation was attempted.
⚠ **`bun run mutants` REFUSES A DIRTY TREE** (`ABORTED_DIRTY`), so mutants are committed first and measured after.

---

## What remains open after both, stated so it is not later claimed as closed

REG-F-041's child-existence and paired-DecompositionContract limbs; the `?? true` whole-check booleans (S-2, and
REG-D-044 does not touch them); DEC-6's other eight checks (REG-F-042 — a capability); and REG-F-043's 152
unevaluated guards. **This roadmap makes the recomposition verdict load-bearing. It does not make it complete.**
