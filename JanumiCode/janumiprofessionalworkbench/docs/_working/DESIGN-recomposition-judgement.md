# DESIGN — Making recomposition a judged act (REG-F-041, and why its scoped remedy is not the next increment)

**Status:** DESIGN COMPLETE. **Implementation deliberately NOT started.** The design's conclusion is that the
work REG-F-041 scoped for itself is correct in direction, ranks LAST of three approaches on two of three
judging lenses, and — more importantly — is **sequenced wrong**. What changes first is below.

**Occasion.** REG-F-041 (OPEN) records that recomposition is composable-by-default: `buildRecompositionInput`
(`handlers/decomposition.ts:641/:647/:648`) supplies three of `evaluateRecomposition`'s five inputs from an
OPTIONAL payload with permissive defaults, so a payload carrying nothing but a claim id reaches **COMPOSABLE /
parentSatisfied: true**. Its recorded interim act is *"making the three payload fields REQUIRED"*, available
*"without any ratification"* since the shapes are AUTHORED. It has been gated on **REG-E-028**, which was
**withdrawn the same day it was filed** — so the entry has been blocked since 2026-08-06 on a closed question.
That unblocking (recorded 2026-08-20) is what put this design on the table.

---

## 1. The measured ground

Three independent investigators, then three judges on separate lenses. Everything here is measured.

**1.1 — The recorded cost objection is VOID.** REG-F-041 declined to act partly because required-ness
*"refuses every existing caller"*. Derived population: **6 dispatch statements, 12 runtime invocations, all in
`.test.ts`, across 3 files. ZERO production call sites** in `packages/`, `apps/`, `verif/` or `scripts/`. The
repo already says so in its own voice (`acceptable-child-assurance.test.ts:22` — *"recomposition is undispatched
in production"*), and `apps/` authors no recomposition at all: no route, no form action, no agent tool, no e2e.

Sharpest single number: **not one caller anywhere has ever supplied `parentConstraintsHoldAgainstWhole`.**
Requiring that one field refuses 100% of existing dispatches; requiring all three refuses the same 100%. So the
statement is literally true and costs **test edits only** — which is the condition REG-F-041 itself named as
decision-changing.

⚠ Of the three test files, exactly one edit is non-mechanical: `disclosure-observed.test.ts`'s RPH-EVD-001 probe
asserts its control is exactly `'REJECTED'`, while a boundary schema failure returns `'VALIDATION_FAILED'`
(`command-bus.ts:414`). And the remedy **does not close RPH-EVD-001** — that row's disclosed gap is that
`parentCompletionClaimId` is never LOADED as a Claim aggregate, which a required boolean does not reify.

**1.2 — Nothing holds a vocab flip in place.** `messages.ts` is GENERATED from
`packages/rph-contracts/vocab/m3-commands-events.json`; exactly two files read a field's `required` flag
(`gen-messages.ts:220`, `gen-objects.ts:192`), both emitters, and **no CI or gate step runs `bun run gen`**. Any
change here is one un-run generator away from silently reverting, detectable by nothing. **Any approach that
edits the vocab MUST ship a verif test asserting the emitted optionality** (pattern:
`verif/transition-provenance-carried.test.ts`, which already gates note survival for the sibling generator).

**1.3 — The corpus verdict: a required boolean improves the RECORD, not the CORRECTNESS.** It removes an
inference-from-absence that OBJ-1 prohibits by name, and that is real. But under DEC-6 read with OBJ-5, ASR-1,
ASR-2, ASR-9 and AX-8, a compulsory `parentCompletionClaimSupported: true` is **the fabrication moved from the
engine to the caller and given a signature**. DEC-6 is *"a judged act, never a sum"*; forcing a caller to type a
bit is not a judgement. The distinction between an ACCOUNTABILITY gain and a CORRECTNESS gain is the whole of
this design's disagreement with the scoped remedy.

---

## 2. Three approaches, three lenses

| Approach | corpus-fidelity | honest-guarantee | buildability |
|---|---|---|---|
| **A** — flip the three vocab fields to required, regenerate, reverse the note | 3rd | 2nd | 3rd |
| **B / RAC** — cite a CONCLUDED `ASSURANCE_ASSESSMENT`; derive the whole-check from its disposition | **1st** | 3rd | **1st** |
| **C / Derive-on-Read** — carry ids not verdicts; read both conjuncts off governed objects | 2nd | **1st** | 2nd |

**A ranks last on two of three lenses**, and its own strongest advocate supplies the reason: `RecompositionCompleted`'s
payload fields are exactly `{parentCompletionClaimId, status, workLifecycleState}`
(`m3-commands-events.json:6416-6442`) and `command_receipts` stores `payload_hash`, not the payload
(`rph-persistence/src/schema.ts:119-131`). **So A compels a judgement, acts on it, and retains no readable record
of it** — the accountability column that is A's entire case is not delivered by A as scoped. What A proves is
only that the wire refuses silence.

**RAC (B)** wins corpus-fidelity and buildability. Every mechanism it needs already exists and was verified:
`assessmentHasConcluded` (`rph-domain/src/governance.ts:599-624`) is a positive list that fails closed on an
unknown state; the Request/Begin/Complete lifecycle is registered; the assessment persists the three fields its
predicate reads. It over-priced its own arrangement (4 dispatches + `seedPolicy`, not 6) and it is the only
approach whose mutants discriminate among its own arms.

**Derive-on-Read (C)** wins honest-guarantee — the best corpus argument and the only design closing BOTH limbs of
RPH-EVD-001's `why` — but drags the whole evidence chain in (~8 dispatches), proposes one control with one mutant
that cannot separate its most contentious arm boundary, and offers no first increment that stands alone.

---

## 3. ⚠ THE FINDING THAT REORDERS THE WORK

**All three approaches harden the front door of a house whose side door is a pinned, driven, ACCEPTED defect —
and the repository has already measured it.** Verified directly, not taken on an agent's word:

**(a) The verdict has no consumer.** `COMPOSABLE` appears outside `handlers/decomposition.ts` only in the enum
(`enums.ts:634`) and the transition table (`transitions.data.ts:1283-1363`). **No handler, no kernel predicate,
no gate reads a RecompositionContract's status to decide anything.** All three approaches are arguing about the
evidentiary weight of an output nothing downstream consumes. This is the hollow-governed-layer shape.

**(b) The professional consequence is reachable without any of it.** `verif/recomposition-ungoverned.test.ts`
(REG-F-085) is a characterization pin whose header reads: *"the two PWU recomposition arrows are performable by
ANYONE, with NOTHING cited… `RECOMPOSING -> RECOMPOSED` is guarded on 'Recomposition contract satisfied'… Then I
drove the engine. Both hops are ACCEPTED with `reasonCode: 'CONTROLLER'` and `supportingObjectIds: []`."* The
ledger corroborates with its own drive: a PWU reaches RECOMPOSED with **zero RecompositionContract objects in the
store**. So the parent being declared RECOMPOSED is reachable today via `ChangePwuState`, citing nothing.
**Not one of the three approaches names `ChangePwuState`.**

**(c) A recomposition of NOTHING reaches parent-satisfied, and it is the finding's own exhibit.**
`requiredChildWorkUnitIds` has no `.min(1)` on either schema (`messages.ts:475`, `objects.ts:648`) and no handler
guards it. `buildRecompositionInput` reads it `?? []`, so `requiredChildResults` is empty, the kernel's rung 2
(`unsatisfied.length > 0`, `rph-domain/src/decomposition.ts:335`) is **vacuously false**, and the recomposition
sails through. REG-F-041's live exhibit, `recomposition.test.ts:162`, is `propose([])` — **a recomposition of
nothing.** That is OBJ-1's prohibition on inferring semantic state from empty arrays, applied to the one field
none of the three examined. It survives all three *structurally*: the field lives on the CONTRACT, written at
propose, while every approach operates on the `CompleteRecomposition` payload boundary. **No payload-side remedy
can reach it.**

**Consequence for REG-F-041's own cost clause:** *"it refuses every existing caller"* is true, cheap, and
**nearly irrelevant**. Refusing every caller of a command whose outcome nothing reads, on a path a second command
bypasses entirely, buys less than any of the three approaches claims. **Unreachable and ungoverned are opposite
problems, and the engine was driven and found to have the second.**

---

## 4. Recommended sequencing

The honest order is the reverse of what all three approaches assume. **Make the verdict load-bearing before
arguing about how strong the verdict must be.**

- **S-0 — Refuse an empty composition.** `proposeRecomposition` rejects a contract naming no required children.
  Cheapest, entirely independent of the other three, and it needs its own red because none of the nine predicted
  reds across the three approaches would notice it. ⚠ It changes `recomposition.test.ts:162`, which is
  simultaneously the suite's discriminating control and REG-F-041's live exhibit — so the control must be
  re-arranged with real children, not deleted.
- **S-1 — ✅ UNBLOCKED 2026-08-21 BY REG-D-044 (delegated ruling), AND THE UNBLOCKING IS NOT THE ONE ANYONE
  EXPECTED.** The fork REG-F-085 posed was incomplete. Both limbs are refuted; the acceptance act is REQUIRED and
  is NOT a missing command. Full reasoning in REG-D-044; the buildable consequence is here.
  - **The guard means the enum literal, and the cheap reading was REFUSED.** Three independent lanes converged on
    reading §8.1's *"Recomposition contract satisfied"* as ordinary language, which would have licensed gating the
    PWU arrow on `COMPOSABLE`. It is refuted: §8.1's other two cross-object rows cite enum literals in lowercase
    participle form — *"Active execution plan **approved**"* ↔ `'APPROVED'` (CDM:1239), *"Runtime bindings
    **authorized**"* ↔ `'AUTHORIZED'` (CDM:1335) — as does the sister contract at CDM:904 (*"valid or
    conditionally valid"* ↔ `'VALID'`/`'CONDITIONALLY_VALID'`). ⚠ The three lanes' agreement was **one inference
    counted three times**, and each had flagged it as its own weakest link. The adversary set to attack the
    convenient answer is what caught it. **So the earlier §4 option "gate on COMPOSABLE, disclosed as a floor" is
    now CLOSED, not merely disfavoured.**
  - **`COMPOSABLE` is the CANDIDATE state and canon says so in its own voice** — JPWB-DOC-001:244: *"recompose …
    creating **candidate parent state subject to assessment and decision**"*; :228: *"Parent completion remains
    unavailable until required recomposition is **accepted**."* So `completeRecomposition` producing COMPOSABLE is
    correct, and REG-F-042 was right that the machine models this better than anyone credited.
  - **The acceptance act is `decide` — already ratified, merely UNWIRED.** JPWB-DOC-001:244 lists nine primary
    verbs including `decide` (*"records authorized disposition over an identified version"*), and the apparatus
    exists: `decisionType: 'APPROVAL'` (CDM:1363) over `subjectObjectIds` (CDM:1373), `DecisionProposed` /
    `DecisionEffective`, `proposeDecision` / `approveDecision`. **No new Minimum-API-Surface command**, which is
    why this is not the "new work" authority REG-F-085 feared. The corpus even exhibits the shape: the FSM
    fixture runs `RecompositionCompleted → DecisionProposed: Approve Architecture → DecisionEffective →
    BaselineCreated`, and its Intent block states the template twice.
  - ⚠ **And REG-Q-011 forbids the shortcut** (register:229): *"A passing Assessment never advances assurance or
    lifecycle automatically; advancement requires a validated Command/Event."* So §14.1's sixth invariant cannot
    be discharged by an assessment alone — locating it in Assurance PROVES an acceptance is needed.

  **THE BUILDABLE SEQUENCE, replacing the old S-1/S-2:**
  - **S-1a — wire the acceptance.** `RecompositionContract.status COMPOSABLE → SATISFIED`, driven by an EFFECTIVE
    `APPROVAL` Decision naming the contract as subject, gated on §14.1 b6 (an explicit assessment over the
    parent completion claim the contract already carries as `parentCompletionClaimId`). Whether that is a thin
    command over the ratified Decision surface or a guard on `approveDecision` is a SHAPE question, delegated
    under REG-D-004. ⚠ This also makes `SATISFIED` reachable, which is the precondition everything else waited on.
  - **S-1b — mint the two PWU acts and enforce the guard LITERALLY.** §8.1 names them: *"Begin recomposition"*
    (SATISFIED→RECOMPOSING, *"Parent exists and recomposition is required"*) and *"Complete recomposition"*
    (RECOMPOSING→RECOMPOSED, *"Recomposition contract satisfied"* = `status === 'SATISFIED'`). **No weakening, no
    disclosure carve-out, and REG-F-076's substitution class is avoided entirely** — a real Decision is present
    rather than substituted for. ⚠ Mint BOTH in one commit: `PWU_SEMANTIC_LIFECYCLE_COMMANDS` membership refuses
    the generic setter with NO fallback, so half the pair leaves an arrow unperformable.
  - **⚠ A DEFECT TO FIX ON THE WAY, found while grounding this:** `messages.ts` BINDINGS (:3156-3170) declare
    `BeginRecomposition` and `CompleteRecomposition` drive **`PWU.workLifecycleState`** — but their handlers drive
    `RecompositionContract.status`, and their own comments say so. `ProposeRecomposition`'s row correctly names the
    contract machine. Those two rows are wrong today and must be corrected when the PWU commands are minted, or
    two commands will claim the same arrows.
  - **The blast radius the panel verified, all of it still applies:** `pwu-replay.ts`'s axis fold ends
    `default: return axes` (new events would diverge replay from the object — that file records this miss shipping
    THREE times); `verif/event-surface-census.test.ts` pins EMITTED as a hand-authored snapshot; the
    `PWU_GENERIC_SETTER_SPECS` rows must MOVE, not be copied; and `pwu-fold-drive-sites.test.ts` demands an
    explicit drive site per semantic command.
  - **⚠ MUTATION DISCIPLINE, carried from the panel because it was wrong there:** the proposed "control mutants"
    swapped `SATISFIED` for `COMPOSABLE`, which reddens a REFUSAL test — **a main-test mutant wearing a control's
    label**. The control's own mutant is UNCONDITIONAL REFUSAL (`return false`); its complement is `return true`.

- **S-1 — ⚠⚠ SPONSOR-BLOCKED, AND THIS DESIGN GOT IT WRONG (corrected 2026-08-21).** As first written, S-1 read
  *"gate the PWU arrow on a SATISFIED contract"*. **REG-F-085 forbids both ways of doing that, by name, and I had
  not read its body** — only the header comment of the pin file it produced. Verbatim, at
  `JPWB-REG-005:2481-2487`:
  - *"a build agent has only two ways out, **both forbidden**: require `SATISFIED` and ship a command that can
    never succeed, or accept `COMPOSABLE` and **silently weaken a ratified guard** — substituting 'no
    contradiction found' for 'contract satisfied', which is precisely the APPROVAL-for-decision substitution class
    already open as REG-F-076."*
  - *"**THE CANON QUESTION A BUILD AGENT MAY NOT ANSWER.** … Either (a) a third command is missing that takes an
    evaluated contract to `SATISFIED` (an acceptance act) … or (b) `completeRecomposition` is implemented on the
    wrong arrow. **These have different authorities: (a) is new work, (b) is a defect.**"*
  - *"**The sequencing question … is a contract Decision, not a build one**"*, and its Merge target is
    **Corpus then Repository**, Status **OPEN — contract Decision owed**.
  A nine-agent panel independently produced exactly the two forbidden options, designed both in full, and had
  **both attacked to `sound: false`** — one of the attackers landing on this same register line. That is a costly
  way to rediscover a block that was already written down. **[[feedback_search_the_register_first]]**, and the
  sharper form of it: *a pin's header is not the register entry it points at.*
  **So S-1 is ESCALATED, not built.** What a build agent MAY do without the ruling: nothing on this arrow.
  ⚠ Note the safe default is a WEAK one and the register says so: both arrows stay performable by the generic
  setter with nothing cited. Holding is not safety here — it is the status quo, which is the defect.
- **⚠ WHAT THE PANEL FOUND THAT IS WORTH KEEPING FOR WHEN THE RULING LANDS.** Two attackers verified blast-radius
  omissions that would have bitten whichever branch was taken: (i) `packages/rph-projections/src/pwu-replay.ts`'s
  PWU axis fold ends `default: return axes`, so new `PwuRecompositionBegun`/`PwuRecomposed` events would carry the
  OLD workLifecycleState forward and diverge replay from the object — that file's own comments record this exact
  miss shipping THREE times; (ii) `verif/event-surface-census.test.ts` pins EMITTED as a hand-authored snapshot,
  so any new bound event reddens it and the repair is an argued edit, not a count bump; (iii) `PWU_SEMANTIC_
  LIFECYCLE_COMMANDS` membership REFUSES the generic setter **without a fallback**, so adding the two states
  without minting real commands makes both arrows UNPERFORMABLE rather than governed. And a mutation-discipline
  catch worth carrying: the proposed "control mutants" swapped `SATISFIED` for `COMPOSABLE`, which reddens a
  REFUSAL test the same document authored — **a main-test mutant wearing a control's label**. The control's own
  mutant is unconditional refusal.

- **S-2 — Then, and only then, strengthen the verdict.** Take **RAC**, grafting: the second `?? []` at
  `handlers/decomposition.ts:735` (a dormant fail-open in the event builder that A alone found); the verif test
  pinning emitted optionality (§1.2); Derive-on-Read's REFUSE arm for INCONCLUSIVE/ESCALATED rather than mapping
  them to `false` (writing *"evidence does not support the parent claim"* about an INCONCLUSIVE assessment is a
  false entry in an append-only log); the assessment id carried in the event payload (since `command_receipts`
  keeps only a hash, the event is the ONLY place a citation can survive); and the subject-version pin, which is a
  conjunct rather than a capability because `floorGateBlock` already has the kernel for it.
- **S-3 — The other eight DEC-6 checks are a capability, not a fix** (REG-F-042). Out of scope here.

**What NOT to do:** do not take REG-F-041's interim act as scoped, as the next increment. It is not wrong; it is
third-best on corpus fidelity, third on buildability, retains no record of the judgement it compels, and lands a
guard on a path nothing walks while the path something DOES walk stays open.

---

## 5. Provenance

Nine agents: three grounding lanes (caller census, corpus grounding, generation pipeline), three independent
approaches, three judges on separate lenses. The reordering in §3 came from the buildability judge's
"what did all three miss" answer; its three limbs were re-verified by hand before being written here — §3(a) by
grep over `packages/`+`apps/`+`verif/`, §3(b) by reading the pin's header, §3(c) against both schemas.
⚠ The judges were given the approaches, not each other's verdicts; the split (2–1 for RAC, with the dissenting
lens ranking it LAST) is real disagreement and is recorded rather than averaged away.
