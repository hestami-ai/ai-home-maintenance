# DESIGN — The PWU write path: four axes, one setter, and what canon actually requires

**Status:** DESIGN (authored under the sponsor's delegated-authoring grant, 2026-08-08 — see REG-D-029).
**Answers:** REG-F-079, which was recorded BLOCKED pending exactly this Decision.
**Supersedes no ratified text.** Everything below is authored; every canon citation is byte-exact and named.

---

## 0. The question, and why it was blocked

REG-F-079 recorded that twelve `PWU.workLifecycleState` arrows have no named command and are reachable only
through the generic setter `ChangePwuState`. JPWB-DOC-003 §9 PER-3 wants them named. The Coding Agent Guide
(L1097) forbids an agent to mint the missing commands alone:

> *"when the required semantic Command is absent, **stop for a contract Decision rather than inventing one**."*

So the item stopped. It also posed the question the Decision has to settle first:

> Should the six §8.1 "middle" arrows be **commanded**, or **derived** — computed from the execution and
> assurance axes rather than commanded at all?

**That question is now answered, and the answer is the opposite of the one the codebase's own prose implies.**

---

## 1. DERIVATION IS OFF THE TABLE — but NOT for the reason this document first gave

### 1.0 ⚠ THE FIRST VERSION OF THIS SECTION MISQUOTED CANON IN ITS OWN FAVOUR. Recorded, not edited away.

It rested the whole design on JPWB-DOC-003 §6 STA-1's NON-EXAMPLE, quoting it as:

> `**SCOPE:** … **NON-EXAMPLE:** a *derived* rollup view for humans is legal — provided it is a projection,
> cannot be written…`

**The ellipsis deleted the clause that decides the question.** STA-1's SCOPE reads, in full (`:177`):

> **SCOPE:** governs semantic state **representation** and every **projection** that renders it: execution
> success and assurance satisfaction must remain visually distinct.

STA-1 governs *representation*. §3 of this document then said, in terms, *"This is STA-1 read as a write-path
rule rather than a display rule"* — applying an invariant outside its declared scope, having first removed the
sentence that declares the scope. **And the write path has its own rule with its own scope**, which this
document was already citing for other purposes — PER-3 (`:345`): *"**SCOPE:** governs semantic writes."*

Two further paraphrase errors in the same sentence, both pushing the same way: *"a derived rollup **view for
humans** is legal"* lost the words scoping it to presentation, and *"legal — **provided** …"* became *"legal
**only** where it cannot be written"*, converting a conditioned permission into an exclusive prohibition.

This is the defect class this repository catalogues in others' work — a quote whose ellipsis removes the
deciding clause — committed here, in the foundation of a design document, by its author. It was caught by the
adversarial pass this document was written to receive. **The conclusion survives; the argument is replaced.**

### 1.1 The argument that actually holds

**Orthogonality, byte-exact, DOC-003 §6 (L171):**

> Every PWU carries four **orthogonal** state axes: **work lifecycle**, **execution state**, **assurance
> state**, and **shape-integrity state**. At birth the axes initialize **independently**.

A `workLifecycleState` that is a total function of the other three is not a fourth orthogonal axis — it leaves
three degrees of freedom, not four. Orthogonality is the textual bar, and derivation fails it.

**And the state list refutes total derivation empirically, which is stronger than any reading.** `PWU.workLifecycleState`
has twenty values. Eleven — `BLOCKED, CHALLENGED, RESHAPING, ESCALATED, INVALIDATED, REJECTED, ABANDONED,
SUPERSEDED, RECOMPOSING, RECOMPOSED, BASELINED` — are not functions of execution, assurance or shape integrity
at any reading. No derivation rule could produce them. **The derive option was never available for the axis;
it was only ever a live question for the six middles**, which is where §3.5 lives.

**The answer to REG-F-079 remains COMMAND, not derive** — now on orthogonality and the state list, with PER-3
supplying the write-path obligation.

⚠ **AND STA-1 STILL BEARS, correctly scoped.** `aggregateAssuranceDisposition` folding assessments inside one
projection is exactly STA-1's NON-EXAMPLE working as intended. Nothing in this design disturbs it — but §1's
first version *mislabelled* it as the model for §3.2, and that conflation is what §3.2 then had to disclaim.
The real warrant for folding assessments into `assuranceState` is **ASR-10 (`:281`): "Composition is
strictest-wins. Aggregate assurance preserves the strictest unresolved required disposition."** Canon supplies
a composition rule *within* the assurance dimension and supplies none *across* axes. That is the principled
difference, and it does not depend on STA-1 at all.

## 2. THE DEEPER FINDING: every hole this session closed is one defect wearing different clothes

Measured, not asserted. `pwu.ts` is the **only** production writer of all four PWU axes, and after birth
(`pwu.ts:216-218`) the only writer is `changePwuState` (`pwu.ts:1085-1088`), which takes all four values from
the command payload. Grepped across `packages/*/src` excluding tests and generated files:

| axis | who canon says owns it | who actually writes it |
|---|---|---|
| `executionState` | Execution (plans, steps) | `changePwuState`, from the payload |
| `assuranceState` | Assurance (assessments) | `changePwuState`, from the payload |
| `shapeIntegrityState` | Shape (reshape, revise) | `changePwuState`, from the payload |
| `workLifecycleState` | the lifecycle acts | `changePwuState`, from the payload |

**The execution plane never moves the PWU's execution axis. The assurance plane never moves its assurance axis.**
`completeExecutionStep` moves `ExecutionStep.stepState`; nothing propagates to the PWU. `completeAssuranceAssessment`
moves `AssuranceAssessment.state`; nothing propagates to the PWU. A controller then asserts both, and three of
the four "may not be asserted" guards in `pwu.ts` exist solely to make those assertions cite something.

Seen this way, the session's findings stop being five findings:

| finding | what it actually was |
|---|---|
| REG-F-070 — abandonment needed no authority | the setter writing `workLifecycleState` unguarded |
| REG-F-078 — rejection needed no authority and no finding | the same, one arrow over |
| REG-F-072 — `SHAPING → READY` skipped the eight readiness limbs | the same, bypassing a command that had the guard |
| C-0b — 44 of 82 declared guards UNENFORCED | **10 of the 44** are setter-written PWU arrows — *not* "overwhelmingly", a figure this document first overstated. The other 34 are Claim, Assumption, Evidence, Baseline, Intent, Plan, Step and Assessment arrows the PWU write path cannot reach. **The five findings are a real family; the family does not explain the ledger.** |
| REG-F-079 — twelve arrows with no command | the twelve the setter never needed a command for |

**JPWB-DOC-003 §9 PER-3 (L343) names the mechanism exactly:**

> **PER-3 · One authoritative write path.** Canonical state is mutated only through authenticated, authorized,
> **semantically named commands** that check expected revision, **validate preconditions and invariants**, enforce
> required assurance, and atomically persist state, version history, events, outbox, and command receipt.
> **No generic CRUD/PATCH path** … bypasses this pipeline.

`ChangePwuState` is a PATCH over four fields. It is the generic path PER-3 forbids, and the holes are what a
forbidden path produces.

---

## 3. THE DESIGN: each axis is written by the discipline that owns it

One rule, from which everything else follows:

> **A PWU axis is moved only by a semantically named command belonging to the discipline that owns that axis,
> and never by a value the caller supplies for it.**

This is STA-1 read as a write-path rule rather than a display rule. Four independent axes ⇒ four independent
write paths. It is also what makes the axes *verifiable*: an axis moved by its own discipline carries that
discipline's preconditions with it, which is precisely what the 44 UNENFORCED guards are missing.

### 3.0 ⚠ THE MECHANISM IS *DERIVE-ON-READ*, NOT CROSS-AGGREGATE WRITE — a correction to this design's own first draft

This section first said the owning plane would write the PWU's axis "inside the same transaction". **That is
forbidden twice over, and I found it while verifying my own design rather than after building it.**

**JPWB-DOC-003 §4 AGG-1 (L147), byte-exact:**

> **AGG-1 · Cross-aggregate change flows through Commands and Events.** One aggregate never directly mutates
> another's internal state. Cross-aggregate flows use Commands, Events, durable processes, compensation, and
> reconciliation — not direct table mutation, and **not one broad transaction constructed to simulate workflow
> atomicity**.

And the storage port already enforces it: `CommitInput` (`packages/rph-ports/src/ports/storage.ts:43`) carries a
**single** `aggregateId`. One commit, one aggregate. The single-aggregate commit is not a limitation to route
around — it is AGG-1 expressed in a type.

**So the mechanism is inverted, and it is better for it.** The axis stays on the PWU and is moved by a PWU
command, but the command **DERIVES its target by READING the owning aggregate** instead of accepting a value the
caller supplies. AGG-1 forbids one aggregate *mutating* another; it does not forbid *reading* one. The property
that matters — the caller cannot assert an axis value — is preserved exactly, with no cross-aggregate write, no
broad transaction, and no change to the storage port.

The difference from today is small in code and total in meaning: the existing guards read the plan **to validate
a claim the caller made**; these commands read the plan **to decide, so no claim is possible.**

⚠ **Timeliness is the cost, and it is disclosed rather than hidden.** Derive-on-read means the PWU's axis is
correct as of the last time such a command ran, not continuously. Canon expects exactly this — AGG-1 names
"reconciliation" as part of the legitimate mechanism — but any surface that reads the PWU's axes must not
present them as live. **This is the design's replacement for the atomicity it may not have.**

### 3.1 `executionState` — DERIVED from the Execution Plan by a PWU command

`planEvidencesExecutionSuccess` (`rph-domain`) already encodes "what does this plan evidence?" and is already
called by both planes. It becomes the derivation rule: a PWU command loads the plan named by the PWU, computes
the axis, writes it. The caller names no state.

**This retires `rejectUnbackedExecutionSuccess`, not by weakening it but by making its premise unassertable.**
A guard that exists to check a caller's claim is unnecessary when the caller cannot make the claim.

### 3.2 `assuranceState` — DERIVED from this PWU's assessments by a PWU command

Same shape in principle, warranted by **ASR-10** (strictest-wins composition within the assurance dimension),
not by STA-1.

⚠ **BUT THE OBVIOUS MECHANISM DOES NOT TYPE-CHECK, AND W-3 IS BLOCKED UNTIL IT IS SETTLED.**
`aggregateAssuranceDisposition` returns a **6**-value enum; `PWU.assuranceState` is an **11**-value enum.
`INCONCLUSIVE` — the fold's own fail-closed default — **is not a value of the axis at all**, which `pwu.ts`
already records. Six axis values (`NOT_REQUIRED`, `READY_FOR_ASSESSMENT`, `ASSESSING`, `WAIVED`, `INVALIDATED`,
`ESCALATED`) are unproducible by the fold, and `ESCALATED` is deliberately mapped away to `INCONCLUSIVE` by a
line whose own comment calls that *"a genuine gap … recorded rather than papered over"*. Installing a
knowingly-lossy projection-grade fold as the authoritative axis would destroy the `ESCALATED` distinction on
canonical state.

**W-3 therefore needs a value-mapping decision before it can be built**, and this document does not make one:
the fold must either be widened to the axis's codomain or a total mapping authored with the lossy cases named.
Until then `rejectUnbackedDisposition` **stays**.

⚠ **This is NOT the rollup STA-1 forbids.** The forbidden thing is `workLifecycleState` summarising the other
three. `assuranceState` summarising *the assessments of this PWU* is the assurance axis holding the assurance
answer — one axis, one meaning. **This distinction is the design's load-bearing subtlety and an adversarial
reviewer should attack it first.**

**This retires `rejectUnbackedDisposition` by the same argument.**

### 3.3 `shapeIntegrityState` — moved by the shape acts

`reshapePwu` and the revision acts already own this; they simply need to move the axis instead of letting the
controller carry it.

### 3.4 `workLifecycleState` — named commands, one per governed act

Not one per arrow: several arrows are the same act from different sources (all seventeen `→ ABANDONED` are one
act). The set, with the acts already commanded shown for completeness:

| act | arrows | status |
|---|---|---|
| `BeginPwuShaping` · `MarkPwuReady` · `ChallengePwu` · `ReshapePwu` · `InvalidatePwu` · `SupersedePwu` | existing | **already commanded** (REG-F-072 closed the setter's route to them) |
| `AbandonPwu` | 17 | **authority guard already built** (REG-F-070); needs its command + `PwuAbandoned` |
| `RejectPwu` | 1 | **authority+fact guard already built** (REG-F-078); needs its command + `PwuRejected` |
| `BlockPwu` / `UnblockPwu` | 3 + recovery | new; `PwuBlocked` exists unemitted |
| `EscalatePwu` | 1 | new; no event exists — must be authored |
| the six §8.1 middles | 6 | **NOT commanded — see 3.5** |

### 3.5 ⚠ The six middles are not commands, and not derivations either

`READY→PLANNED`, `PLANNED→EXECUTING`, `EXECUTING→EVIDENCE_PENDING`, `EVIDENCE_PENDING→UNDER_ASSURANCE`,
`UNDER_ASSURANCE→CONDITIONALLY_SATISFIED`, `UNDER_ASSURANCE→SATISFIED`.

These are the arrows the derive-vs-command question was really about, and the honest answer is a third thing:
**they are consequences of the other three axes moving, advanced by the SAME PWU command that moved them.**
Because §3.0 keeps every write inside one aggregate, the command that derives `executionState` may advance
`workLifecycleState` along whichever middle arrow the machine and its cross-axis guards permit — one aggregate,
one commit, no AGG-1 problem.

**Why this is not the forbidden derivation.** The forbidden thing is a *stored field that is a summary* —
recomputed on read, unwritable, meaningless on its own. What is proposed is a stored, versioned, evented,
independently-guarded axis that a named command *advances* as part of a governed act. The distinction is
whether the value has its own history and its own guard, and here it does: `STA-3`'s triad and STA-2's
prohibition remain enforced on the arrow, as `WORK_LIFECYCLE_CROSS_AXIS_GUARDS` enforces them today.

**⚠ I flag this as the weakest joint in the design.** If an adversarial reading finds that advancing an axis
inside another discipline's command IS the collapse STA-1 forbids, then the middles need their own six commands
and the increment count rises — the rest of the design is unaffected. **Recommended fail-closed default if it
cannot be settled: mint the six commands.** More commands is the safe error; a silent collapse is not.

---

## 4. What this retires

`ChangePwuState` **is retired**, not scoped. Once each axis has its owner, the generic setter has no remaining
legitimate caller — and REG-F-072 already measured that the production surface for its owned-arrow use was zero.

Three of the four "may not be asserted" guards go with it (`rejectUnbackedDisposition`,
`rejectUnbackedBaselining`, `rejectUnbackedExecutionSuccess`). **Their disappearance is a strengthening, not a
loss**: each exists to make a caller's assertion cite evidence, and after this the caller cannot assert. The
fourth and fifth (`rejectUnauthorizedAbandonment`, `rejectUnauthorizedRejection`) migrate intact onto
`AbandonPwu` and `RejectPwu`, where they were always meant to live.

⚠ **`markPwuReady`'s `expectedSemanticVersion` staleness check survives and generalises.** Every new lifecycle
command should carry it: an attestation about a shape is stale if the shape moved. This is the one guard the
setter *could not* carry (REG-F-072 residue) and the decomposition is what makes it available everywhere.

---

## 5. Increments

Sequenced so each lands green, and ordered so the riskiest structural change is proved on one axis before the
others follow.

| # | increment | why here |
|---|---|---|
| **W-0** | Correct `pwu.ts`'s header prose; record the STA-1 reading in the register | the wrong comment is what made "derive" look right; fix it before anyone reads it again |
| **W-1** | `AbandonPwu` + `RejectPwu` commands; migrate the two authority guards; emit `PwuAbandoned` / `PwuRejected`; **AND add `ABANDONED`/`REJECTED` to `PWU_SEMANTIC_LIFECYCLE_COMMANDS` in the same commit** | ⚠ **WITHOUT the ownership-table conjunct this increment RE-OPENS REG-F-070 and REG-F-078.** "Migrate" means the guards leave `changePwuState`, and the setter does not refuse those targets until they are in the table — so between W-1 and W-7 the setter would abandon and reject unguarded again. Red-first test required. |
| **W-2** | Propagate `executionState` from the execution plane; retire `rejectUnbackedExecutionSuccess` | the axis with the clearest owner and an existing kernel rule |
| **W-3** | Propagate `assuranceState` from the assurance plane; retire `rejectUnbackedDisposition` | the load-bearing subtlety of 3.2 — do it second, with W-2's pattern proved |
| **W-4** | `shapeIntegrityState` onto the shape acts | smallest surface |
| **W-5** | `BlockPwu`/`UnblockPwu`/`EscalatePwu`; author the missing `PwuEscalated` | new contract shapes — needs its own ratification note |
| **W-6** | The six middles: propagate (or mint six commands if §3.5 is refuted) | depends on W-2/W-3 |
| **W-7** | Retire `ChangePwuState`; delete the ownership guard it needed | only when nothing calls it |
| **W-8** | Re-drive every affected C-0b ledger row; the UNENFORCED count must fall and be *shown* to fall | the control is how we prove the program worked rather than asserting it |

**W-8 is not bookkeeping.** C-0b exists so that "this closed N of 44" is checkable. Any increment that changes a
guard's enforcement without re-driving its ledger row has not finished.

---

## 6. Risks, stated rather than discovered later

1. **§3.2 and §3.5 may be wrong.** Both are readings of STA-1's boundary. Each carries its fail-closed default
   (mint the command). Neither is load-bearing for W-0/W-1.
1b. **⚠ THIS DESIGN'S FIRST DRAFT PROPOSED A CANON VIOLATION, and that is recorded rather than edited away.** It
   had the owning plane writing the PWU's axis "inside the same transaction" — which AGG-1 names in terms as
   *"one broad transaction constructed to simulate workflow atomicity"*, and which the storage port's
   single-aggregate `CommitInput` already forbids. It was caught by checking the port before the review returned.
   The corrected mechanism (§3.0, derive-on-read) is stronger, but the episode is the reason §3.2 and §3.5 carry
   fail-closed defaults instead of confidence: **this document has already been wrong once about what canon
   permits.** Timeliness (§3.0) is the new cost and must not be discovered by a surface later.
2. **Blast radius is large and mostly in fixtures.** REG-F-072's much smaller change cost 49 tests across five
   files. This will cost more, and the repair is again the point — a fixture that asserts an axis it should not
   be able to write is testing the defect.
3. **Contract authoring.** W-1 and W-5 need command payload shapes, and `PwuEscalated` has none. All of it is
   `UNRATIFIED-AUTHORED` and must be annotated so, per this repository's own convention. **The grant authorises
   the authoring; it does not make the shapes ratified.**
4. **This design does not touch the four infrastructure races, the assurance plane's own gaps, or the demo
   surface.** It is the PWU write path only.

---

## 7. What is authored here versus what canon supplies

| claim | basis |
|---|---|
| The four axes are **orthogonal**, initialized independently | **CANON** — DOC-003 §6 L171 |
| STA-1 governs REPRESENTATION and projections, **not the write path** | **CANON** — STA-1's own SCOPE, L177. ⚠ §1's first version elided this and applied STA-1 to the write path anyway |
| Eleven of twenty lifecycle states are not functions of the other axes | **MEASURED** — the state list |
| Canonical state is mutated only by semantically named commands; no generic PATCH | **CANON** — DOC-003 §9 PER-3 |
| Satisfaction requires the full triad; execution never confers satisfaction | **CANON** — STA-3, STA-2 |
| Abandonment / rejection are Governance-reserved | **CANON** — DOC-001 §5.2, and Guide L336 for the rejection carve-out |
| An absent semantic command needs a contract Decision, not invention | **CANON** — Guide L1097. ⚠ **NOT YET DISCHARGED.** The sponsor's grant of 2026-08-08 is real but **no register entry records it**; REG-D-026 (cited by an earlier draft) is about tenant scope and discharges nothing. **W-0 must mint the REG-D entry REG-F-079 asked for** before W-1 authors any payload. |
| *`ChangePwuState` IS the generic CRUD/PATCH path PER-3 forbids* | **AUTHORED** — and PER-3's SCOPE (L345, *"governs semantic writes … the existence and completeness of the gate is the semantic requirement"*) is a counterweight: the setter does pass through the gate. The live claim is narrower — that it is not *semantically named*. |
| One aggregate never mutates another; no broad transaction for atomicity | **CANON** — DOC-003 §4 AGG-1, and enforced by `CommitInput`'s single `aggregateId` |
| *Each axis is written by a command that DERIVES it by reading the owning aggregate* | **AUTHORED** — this document, §3.0, after its first draft proposed a cross-aggregate write AGG-1 forbids |
| *The six middles are consequences committed by the owning command* | **AUTHORED, and flagged weakest** — §3.5 |
| *The command set in §3.4* | **AUTHORED** |

---

## 8. REVIEW FINDINGS STILL OWED — this design is NOT ready to build past W-0

A four-lens adversarial pass ran against the version above. §1, §2, §3.2, W-1 and §7 are corrected in place.
**These remain outstanding and must be resolved before their increments start:**

1. **Three states appear in no table**: `RECOMPOSING`, `RECOMPOSED`, `BASELINED`, and four arrows with them —
   including both `→ BASELINED` arrows, whose owning discipline is **Governance**, which §3.1–3.3 has no plane
   for. `completeRecomposition` and `promoteBaseline` each advance their OWN aggregate and say so in comment;
   the seed must separately dispatch the setter to move the PWU. **After W-7 as written, `BASELINED` becomes
   unreachable** — and it is terminal, and RPH-PWU-010 is ratified over it. A **W-4.5** is owed.
2. **`rejectUnbackedBaselining` is one of C-0b's fourteen ENFORCED rows** and §4 retires it with no replacement.
   That row would go ENFORCED → UNENFORCED. §4's "retiring three guards is a strengthening" is true for one.
3. **W-8's success criterion is unsound as stated.** An arrow whose enforcing site is deleted with no writer
   replacing it becomes `ARROW_UNREACHABLE`, not `ENFORCED` — capability deletion scoring as enforcement. W-8
   must be a per-row delta table distinguishing the two, never a count.
4. **W-7 would delete `OwnedLifecycleTarget`**, the `keyof` narrowing REG-F-072 built so a seventh lifecycle
   command cannot be added without a ledger row — removed exactly when this program mints five new ones.
5. **W-4 is not the smallest surface.** `shapeIntegrityState` has nine arrows; `reshapePwu` owns one; two are
   triggered from the Assumption aggregate; one names the controller lever being retired; three name no command.
6. **`PwuStateChanged` is a ratified required first-slice event and W-7 kills its only emitter** — and no test
   would redden. Its disposition must be stated.
7. **§37's Controller Decision Contract is never mentioned.** It ratifies an 18-value `ControlAction` menu and
   six mandatory records per control action; `pwu.ts` cites it as the basis for `reasonCode` +
   `supportingObjectIds`. The design retires the vehicle without saying where the six records go.
8. **The One Rule binds outside the PWU too** — `RecordClaimAssessment` and `completeAssuranceAssessment` both
   take caller-supplied targets, and §3.2 would propagate the PWU's axis *from* a state the ledger already
   records as unchecked. Either extend the rule or say why the PWU is the only place it binds.

**Standing on this:** W-0 (mint the REG-D entry; correct the four rollup assertions in code and register) is
unblocked and safe. W-1 is unblocked once its ownership-table conjunct is written in. **Everything from W-2
onward is blocked on the items above**, and this document should not be read as authorising them.
