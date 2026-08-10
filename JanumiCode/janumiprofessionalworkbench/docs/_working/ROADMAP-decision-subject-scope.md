# ROADMAP — Decision subject scope (REG-F-077)

Implements `DESIGN-decision-subject-scope.md`. **Each increment is separately acceptable and separately
gate-able.** The order is chosen so that **the act end is reachable before the write end is widened** — the
inverse order would ship H-1 (§6) by construction.

**Standing rule for every increment:** red-first, then the fix, then a named mutant whose predicted victim is
written down *before* it runs. A green with no predicted red is not evidence.

---

## S-0 · Make one act reachable, on the path that already works — `PROMOTE_BASELINE`

**Why first.** §4: promotion is the **only** path whose version limb can fire, and §6: its sibling floor path is
already demo-reachable. So it is the one increment that can prove scope *and* staleness against the real engine.

- Drive `PromoteBaseline` from the demo — measured today: **zero** dispatches anywhere in `apps/rph-demo`.
- Red-first: an e2e that promotes and is **refused** for want of an authorizing Decision.
- **The staleness arrangement, and it belongs here or nowhere:** approve at v1, revise the subject (an INTENT or
  DECOMPOSITION_CONTRACT — the two that can `bumpSemanticVersion`), promote, observe refusal.
- **Gate:** the e2e performs the ACT, not a render. **Mutant:** neutralise `decisionAuthorizesVersions`; predicted
  victim is the staleness case alone, with the scope case staying green.

**⚠ Do not widen to the other acts here.** If S-0 cannot be made to work, the design's premise is wrong and the
rest must be re-thought rather than pushed.

---

## S-1a · Author abandonment next to the PWU — ✅ SHIPPED (REG-F-104)

- The act is on the undertaking surface, deriving `subjectObjectIds: [pwuId]` from the row.
- Propose, approve and abandon go through **one `dispatchBatch`**: a partial application would leave an EFFECTIVE
  abandonment authority attached to a PWU that was never abandoned — a standing permission nobody asked for.
- **The engine's refusal is driven**, which S-0's spec could not do: the unauthorized attempt is posted at
  `/test-api/dispatch` (the same bus the UI uses), so `resolveAbandonAuthorization` is what refuses it, not a form.
- Asserted on the **stored** decision's `subjectObjectIds` (H-3), never on the form.
- **No staleness case**, per §4, with the reason written in the spec.

## S-1b · Rejection — DEFERRED, and on a reason of substance rather than effort

`RejectPwu` requires **both** an EFFECTIVE `REJECTION` Decision **and** a real `ASSURANCE_OBSERVATION` of BLOCKING
or CRITICAL severity naming the PWU (`hasBlockingObservationFor`). **Measured: `RecordAssuranceObservation` is
dispatched ZERO times anywhere in `apps/rph-demo`** — the workbench cannot record a blocking finding at all, and
`recordAssurance` drives only a SATISFIED disposition with `observations: []`.

**⚠ AND THE OBVIOUS SHORTCUT IS THE DEFECT.** A `rejectPwu` action could mint its own assessment and its own
BLOCKING observation inside the same batch, satisfying the gate. **That is manufacturing the guard's own input** —
REG-F-022's Gate A shape (*"the logic is right and its population is supplied by the party it judges"*) and
REG-F-014's `detectedConflicts`. It would ship green and prove nothing.

**So S-1b needs a capability first: the professional records a blocking finding as its own deliberate act**, and
rejection then cites a finding somebody actually made. That is a product increment, not authorization wiring, and
it is not in this roadmap's scope. Recorded rather than quietly dropped.

---

## S-2 · Make the skip gate honest — ✅ DONE, and the answer was a CORPUS gap (REG-F-105)

`SkipExecutionStep` is dispatched today with `mandatory: false` (`undertakings/[id]:762`), which is the flag that
switches its authorization off — C-0b already records the rule as escapable by exactly that boolean.

- Drive at least one skip with `mandatory: true` and observe the refusal.
- **This is a test increment, not a behaviour change**, unless the survey shows the demo should be sending `true`.
- **⚠ Read C-0b's row first**: it classifies this rule UNENFORCED with recorded evidence. If S-2 makes it
  enforceable, **the ledger row moves in the same commit** — the same-commit discipline REG-F-101 found missing.

**OUTCOME: THE ROW CANNOT MOVE, AND THAT IS THE FINDING.** Both arms were already driven at unit level. What
was missing is why they can both be true: **`ExecutionStep` has no mandatory field, and neither does the
corpus** — RPH-DOC-002's interface declares twelve fields and none is optionality (`mandatory:` as a field:
zero hits corpus-wide; positive control `preconditions: Condition[]`: 1). The corpus states the rule and
defines no fact that could enforce it, so **no repository change can move the C-0b row**. Shipped instead: a
single ADMISSION test driving the SAME step refused-then-skipped on the caller's own boolean, the C-0b row's
evidence extended to name the corpus as the cause, and REG-F-105 escalating the ratification question.

---

## S-3 · Retire the `/decisions` propose form, or scope it

Once S-0..S-2 land, `/decisions` is the only place that mints a Decision with **no** subject. Two options, and the
design recommends the first:

1. **Remove propose** and leave the route listing + approving. Its own header already argues this for waivers.
2. Keep it, offering only `decisionType`s that no scope gate reads.

Either way: **delete `subjectObjectIds: []`** rather than leaving it, and fix `subjectSemanticVersions: {}` at
`:85` in the same commit (§7 — benign today, and the next reader will meet it).

---

## S-4 · Close the census hole the design exposed

REG-F-102 showed a gate census rooted at `subjectObjectIds` is structurally blind. Build the derivation of §3 as a
**control**, not a document:

- Enumerate decision-resolving sites by all four selectors **plus** the authority root (`status`/`objectType`/parse).
- Pin the set. A new resolver that reads a Decision and checks no subject **reddens on arrival**.
- **Predicted red, named in advance:** re-introducing REG-F-102's pre-fix `authorityBasis` must redden this
  control *as well as* its own test — if it reddens only the latter, the control is not measuring what it claims.

---

## Sequencing notes

- **S-0 before everything.** It is the only increment that can fail informatively.
- **S-4 may run in parallel** — it touches `verif/` only.
- **S-3 last**, because removing the propose form before its replacements exist would remove the only way to mint
  a Decision at all.
- **Governance is not blocking any of this**: REG-F-076 (the `APPROVAL` disjunct) and the `decisionType` conjunct
  on `authorityBasis` are named in DESIGN §7 and touch none of S-0..S-4.
