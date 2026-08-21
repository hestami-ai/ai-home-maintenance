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

Only after S-1a, because `SATISFIED` must be reachable first — that is the whole reason REG-F-085 blocked.

**B-1 · Mint BOTH PWU acts in ONE commit.** §8.1 names them: *"Begin recomposition"* (SATISFIED→RECOMPOSING,
*"Parent exists and recomposition is required"*) and *"Complete recomposition"* (RECOMPOSING→RECOMPOSED,
*"Recomposition contract satisfied"*). ⚠ `PWU_SEMANTIC_LIFECYCLE_COMMANDS` membership refuses the generic setter
**with no fallback**, so shipping half the pair makes an arrow UNPERFORMABLE rather than governed — worse than
today. `verif/recomposition-ungoverned.test.ts` loops BOTH guard strings and would catch it.

**B-2 · The guard is LITERAL.** `recompositionContractBacksPwu(ctx, pwuId, contractId)` requires
`status === 'SATISFIED'` and `parentWorkUnitId === pwuId`. **No COMPOSABLE fallback, no disclosure carve-out** —
REG-D-044 Ruling 1 closed that.

**B-3 · Move the spec rows, do not copy them.** `PWU_GENERIC_SETTER_SPECS` (`pwu-lifecycle-command-spec.ts`)
still declares `ChangePwuState` performs both arrows; it must MOVE to the semantic table, and the
`PwuLifecycleCommandType` union must extend. Counts: `lifecycle-arrow-declarations.test.ts` 11/8 → 13/6 and
`{semantic 49, genericSetter 8, recovery 4}` → `{51, 6, 4}`; `allClaimedArrows().length = 61` **unchanged**
(arrows change owner, not count).

**B-4 · ⚠ THE OMISSION THAT SHIPPED THREE TIMES.** `packages/rph-projections/src/pwu-replay.ts`'s PWU axis fold
ends `default: return axes`. New `PwuRecompositionBegun`/`PwuRecomposed` events MUST be added to its named case
group **in the same commit**, or replay carries the old `workLifecycleState` forward and diverges from the
object. That file's own comments record this exact miss shipping W-1 (latent), W-4.5 (found by accident) and W-5
(shipped dead with 1203 tests green). `pwu-fold-drive-sites.test.ts` additionally demands an `EXPLICIT_DRIVE_SITES`
entry per semantic command, each naming a test that calls `expectPwuReplayEquivalence`.

**B-5 · Retire the pin PROPERLY.** `verif/recomposition-ungoverned.test.ts` exists *"so that fixing it FORCES the
register entry to be revisited rather than left stale."* Invert its assertions IN PLACE, keep its runtime↔ledger
conjunction so the two records stay coupled, and move REG-F-085 to CLOSED in the same commit.

---

## What remains open after both, stated so it is not later claimed as closed

REG-F-041's child-existence and paired-DecompositionContract limbs; the `?? true` whole-check booleans (S-2, and
REG-D-044 does not touch them); DEC-6's other eight checks (REG-F-042 — a capability); and REG-F-043's 152
unevaluated guards. **This roadmap makes the recomposition verdict load-bearing. It does not make it complete.**
