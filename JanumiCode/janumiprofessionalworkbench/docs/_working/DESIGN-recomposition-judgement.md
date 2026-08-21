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
- **S-1 — Gate the PWU arrow on a SATISFIED contract.** `RECOMPOSING -> RECOMPOSED` stops being performable with
  nothing cited. This is what makes the contract's verdict mean anything. ⚠ It retires
  `verif/recomposition-ungoverned.test.ts`'s pin, which that file exists to force — *"so that fixing it FORCES
  the register entry to be revisited rather than left stale."* REG-F-085 must move with it.
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
