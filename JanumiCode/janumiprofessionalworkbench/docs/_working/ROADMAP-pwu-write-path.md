# ROADMAP — PWU write path (JAN-PWUWP)

**Authority:** REG-D-029 (sponsor grant discharging Guide L1097 for this program).
**Design:** `DESIGN-pwu-write-path.md`, whose §8 recorded eight findings from a four-lens adversarial review and
declared everything from W-2 onward blocked on them. **This roadmap's first job is to resolve those eight.**
A roadmap that inherited them would be a schedule for building on open questions.

**Status of the design's conclusion:** unchanged — `workLifecycleState` is **commanded, not derived** (four
orthogonal axes; eleven of twenty states are not functions of the others). Only the mechanism and the sequence
are settled here.

---

## Part A — Resolving the design's §8 blockers

### R1 · DERIVE-ON-READ, stated precisely enough to build against

The design said the caller "cannot assert" but never drew the line. It is:

> **A command may let the caller name WHICH object grounds a transition. It may never let the caller name WHAT
> STATE results. The resulting state is computed by the handler from the named object's committed state **and its committed event stream** (amended 2026-08-09, REG-F-080: `RETRYING` is producible from `ExecutionStepRetried` and invisible in object state, and `attemptsMadeFrom` already folds events precisely to stay replay-stable).**

This is exactly what the three existing "unbacked" guards already do, minus the assertion they exist to check:
`rejectUnbackedBaselining` reads a cited BASELINE and checks `status === 'AUTHORITATIVE'`. Inverted, it *is* the
derivation. **Citing an id is not asserting a state**, and the distinction matters because the PWU does not
carry links to everything that governs it.

**Measured:** `ProfessionalWorkUnitSchema` carries **no baseline field**, so baselining must be
citation-grounded (R3). It carries `activeExecutionPlanId` — but see the correction below.

⚠ **CORRECTED 2026-08-09 (REG-F-080). `activeExecutionPlanId` has ZERO writers AND ZERO readers**, verified at
runtime across the 13-PWU reference drive: not one carries it, before or after Propose → Approve → Activate →
Supersede. An earlier reader was deleted when `canActivatePlan` was rewritten to derive. **Nothing would notice
if the field were removed.** Giving it a writer is not available either: the only candidate act belongs to the
EXECUTION aggregate, so writing the PWU there is the cross-aggregate write AGG-1 forbids — and the repository
already considered and rejected exactly that, in terms, at `execution.ts:397-402`. Citation (R1) is the
mechanism; the pointer is not.

### R2 · `rejectUnbackedBaselining` is NOT retired. It is relocated, and C-0b keeps its ENFORCED row

The design's §4 claimed retiring three guards was a strengthening. It is true of one. This guard checks a
**cross-aggregate** fact — a cited BASELINE that is AUTHORITATIVE and whose `itemObjectVersions` include this
PWU at its frozen version — that no propagation from the three named planes would check, because its owning
discipline is **Governance**, which §3.1–3.3 has no plane for. It becomes the derivation inside `BaselinePwu`
(R3), unchanged in substance, and its ledger row moves with it rather than lapsing.

### R3 · The three unaddressed states get commands — W-4.5, and it is not optional

`RECOMPOSING`, `RECOMPOSED` and `BASELINED` appear in no table in the design, and their four arrows have no
owner. `completeRecomposition` and `promoteBaseline` each advance their OWN aggregate and say so in comment;
the reference seed must separately dispatch the setter to move the PWU. **After W-7 as designed, `BASELINED`
becomes unreachable** — a declared terminal state with ratified RPH-PWU-010 over it.

| command | arrow | derives from |
|---|---|---|
| `BaselinePwu` | `SATISFIED\|RECOMPOSED → BASELINED` | cited BASELINE: AUTHORITATIVE + `itemObjectVersions` include this PWU at version (R2's predicate) |
| `BeginPwuRecomposition` | `SATISFIED → RECOMPOSING` | cited RECOMPOSITION_CONTRACT exists and names this PWU as parent |
| `CompletePwuRecomposition` | `RECOMPOSING → RECOMPOSED` | that contract's committed `status` |

### R4 · W-8's success criterion is a per-row delta table, never a count

An arrow whose enforcing site is deleted with no writer replacing it becomes `ARROW_UNREACHABLE`, not
`ENFORCED`. Under a count, **capability deletion scores as enforcement.** Every increment touching a guard must
emit rows classified `ENFORCED_NEW` · `UNCHANGED` · `RELOCATED` · `UNREACHABLE_BY_DELETION`, and the last
requires its own register note saying what capability went away and why that is intended.

### R5 · W-7 keeps `PWU_SEMANTIC_LIFECYCLE_COMMANDS` and its type narrowing

Only `rejectArrowOwnedBySemanticCommand` becomes dead when the setter goes. The **table** and
`OwnedLifecycleTarget = keyof typeof …` are REG-F-072's anti-rot tripwire — a new lifecycle command cannot be
added without a row, or `check-types` fails — and this program mints five or more. Deleting the tripwire while
minting its subjects is precisely backwards.

### R6 · W-4 is resequenced: it is the largest owner-gap, not the smallest surface

`shapeIntegrityState` has nine arrows. `reshapePwu` owns one. Two are triggered from the **Assumption**
aggregate (falsification → AT_RISK/VIOLATED) — cross-aggregate, and the assumption handler's own header says
*"⚠ THE CASCADE IS DELIBERATELY NOT BUILT"*. One names the controller lever being retired. Three name no command
at all. It moves after the assurance work and splits into the arrows that have owners and the arrows that need
a cascade decision.

### R7 · `PwuStateChanged` gets an explicit disposition, not a silent death

It is on DOC-007 §33's **Required First-Slice Events** list, `changePwuState` is its only emitter, and **no test
would redden** when it stops being emitted — the §26 fixture never contains it and the conformance test only
checks events that ARE emitted. W-7 must therefore carry a register entry recording either its retirement as a
deliberate divergence from §33, or a residual emitter. **Whichever is chosen, a test must be added that fails if
the event disappears unannounced**, because today nothing would.

### R8 · §37's six records ride on every new command

DOC-002 §37 ratifies an 18-value `ControlAction` menu and requires every control action to record triggering
condition, evidence/observations considered, authorizing policy, actor, affected objects, expected outcome.
`pwu.ts` already cites it as the basis for `reasonCode` + `supportingObjectIds`. Each new command carries both,
plus its derived citation; the "authorizing policy" record remains the one with no carrier and stays an open
item rather than being quietly dropped. **§37 also spells the act `REJECT` where `DecisionTypeSchema` spells it
`REJECTION`** — the trap REG-F-078 already hit once.

### R9 · The One Rule binds outside the PWU; that is registered, not fixed here

`RecordClaimAssessment` and `completeAssuranceAssessment` both take caller-supplied target states, and C-0b
already records the resulting arrows as UNENFORCED. So §3.2 would propagate the PWU's assurance axis *from* a
state the ledger says nothing checks. **The scope boundary is therefore justified by increment size, not by
principle**, and W-3 must not be described as making the assurance axis trustworthy — only as making it no
longer *asserted at the PWU*. The upstream instances are a follow-on program.

---

## Part B — The sequence

Each increment: red-first test → implement → full gate → C-0b delta rows → commit. No increment starts while
its listed blocker is open.

| # | increment | blocker | notes |
|---|---|---|---|
| ✅ **W-0** | correct both rollup assertions; record REG-D-029 | — | **SHIPPED** (`c1920dac`) |
| ✅ **W-1** | `AbandonPwu` + `RejectPwu`; migrate the two authority guards; emit `PwuAbandoned`/`PwuRejected`; **add both targets to `PWU_SEMANTIC_LIFECYCLE_COMMANDS` in the same commit** | none | ⚠ without the table conjunct this RE-OPENS REG-F-070 and REG-F-078 for six increments. The red-first test is: the setter must refuse `→ ABANDONED` *before* the guard is moved off it. **SHIPPED** (`390b3fa1`, REG-D-030) |
| ~~**W-2**~~ | ~~`executionState` derived~~ — **BLOCKED, see REG-F-080; resequenced after W-6** | — | `planEvidencesExecutionSuccess` answers ONE boolean; `FAILED`, `RETRYING`, `WAITING`, `CANCELLED` need stated rules. **Recording FAILURE must not become harder than recording success** — the retiring guard says so in terms |
| **W-3** ✅ **UNBLOCKED 2026-08-09 (REG-F-093)** | `assuranceState` derived | ~~BLOCKED on the value mapping~~ — **the block was wrong: REG-D-004 already delegated shapes to the repository** | The total mapping was derivable from the machine all along. `SATISFIED` / `CONDITIONALLY_SATISFIED` / `REJECTED` / `ESCALATED` are each axis values with exactly ONE in-arrow, from `ASSESSING` — determinate 1:1. `WAIVED` has three in-arrows and is waiver-authorized, not disposition-driven. `INCONCLUSIVE` and `VALIDATOR_FAILED` are NOT axis values, so they are no-change — and REG-Q-011's safe default says so in terms. **Author it in the repository citing REG-D-004; name the codomain `PWU.assuranceState` explicitly so the §28.2 fold and §26.2 projection union — both of which contain `INCONCLUSIVE` — cannot leak into the write path.** |
| ✅ **W-4.5** | `BaselinePwu` — command, ownership row, `rejectUnbackedBaselining` RELOCATED | R2, R3 | **SHIPPED** (REG-D-031). Also closed a latent W-1 gap: the replay fold knew none of the three new events |
| **W-4.6** ⛔ **BLOCKED 2026-08-09 (REG-F-085)** | ~~`BeginPwuRecomposition`, `CompletePwuRecomposition`~~ | **an UNREACHABLE ratified guard, not a missing shape** | `RECOMPOSING -> RECOMPOSED` is guarded on *"Recomposition contract satisfied"*, and the only arrow into contract `SATISFIED` is one C-0b already classifies ARROW_UNREACHABLE. Building it means shipping a command that can never fire, or silently substituting COMPOSABLE for SATISFIED. **And building only the Begin half would manufacture a second one-way door** one increment after REG-F-083 recorded the first as a defect. ⚠ REG-F-082's remedy was also CORRECTED here: retargeting those binding rows would have named arrows that do not exist on the contract machine — the rows are faithful to canon; the HANDLERS are the halves that diverge. |
| ~~**W-5**~~ ✅ **LANDED 2026-08-09 (REG-D-032)** | `BlockPwu` + `EscalatePwu`; `PwuEscalated` authored from scratch. **`UnblockPwu` NOT BUILT — no arrow exists to perform** (REG-F-083): `BLOCKED` goes only to ABANDONED/SUPERSEDED, yet is not declared terminal. | none | Confirmed: `ESCALATE` is ratified, only the shape was absent. **AND BOTH COMMANDS ARE DELIBERATELY UNGUARDED** — §5.2 does not reserve blocking or escalation, and all four arrows read `guard=undefined` at runtime. Mutation found the fold entries were dead code (REG-F-084). |
| **W-4** ⛔ **BLOCKED 2026-08-09 (REG-F-092)** | ~~`shapeIntegrityState` — the arrows that have owners~~ | **ONE undefined predicate, not nine arrow questions** | 2 of 9 arrows are buildable and **must not be built alone**: `AT_RISK`'s only exits are both blocked, so `FlagPwuShapeAtRisk` would manufacture a THIRD one-way door after REG-F-083 and W-4.6. The 7 blocks collapse into one gap — canon defines no computable fact for *"shape-integrity violation / obligation loss / constraint erosion"*, and two of its three limbs name machines frozen at birth. `VIOLATED` unreachable ⇒ the whole 4-state reshape chain is dead by construction. **A reader cannot be built first either** (REG-F-090): a guard keyed on `VIOLATED` could never fire. ⚠ `RESHAPING_IN_PROGRESS -> RESTORED` FIRES TODAY ungoverned — C-0b disposition **UNGOVERNED**, not ARROW_UNREACHABLE — and is a named **W-7 blocker**. |
| **W-6** | the six §8.1 middles, **carrying the execution axis as a consequence** (REG-F-080 inverts W-2 into this) | W-3 | **fail-closed default stands: if advancing the lifecycle axis inside another discipline's command is judged a collapse, mint six commands instead.** More commands is the safe error |
| **W-7** | retire `ChangePwuState`; delete only the ownership *guard* | R5, R7, and all of W-1..W-6 | keeps the table + type tripwire; carries the `PwuStateChanged` disposition and its new test |
| **W-8** | C-0b delta reconciliation across the whole program | R4 | per-row table, four outcomes, `UNREACHABLE_BY_DELETION` needs a register note |

---

## Part C — What this roadmap does not claim

- **It does not claim W-3 is buildable.** It is blocked on a value-mapping decision this document does not make.
- **It does not claim the assurance axis becomes trustworthy** (R9). It becomes un-asserted at the PWU, which is
  less than it sounds.
- **It does not settle whether W-6 propagates or mints six commands.** The fail-closed default is stated so the
  question cannot be resolved by drift.
- **It does not extend beyond the PWU write path.** Two caller-supplied-target instances upstream are registered
  as a follow-on, and the boundary is admitted to be one of size rather than principle.
- **Every shape authored under this roadmap is `UNRATIFIED-AUTHORED`** and must be annotated so. REG-D-029
  grants authoring, not ratification.
