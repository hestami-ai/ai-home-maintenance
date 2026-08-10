# DESIGN — self-declaring lifecycle arrows

**Builds REG-F-114's ruling on REG-F-087's residue.** Authored 2026-08-10.

---

## 1. The finding, in one line

`advancePwuLifecycle` takes `{ target }` and resolves the source state at runtime, so **a PWU lifecycle command
declares a destination, not an arrow**. The arrow census cannot read what was never declared — and, more
seriously, neither can anything else: the command accepts whatever `canAdvanceWorkLifecycle` happens to allow.

The repository already solved this for the other machine. `STEP_COMMAND_SPECS` gives each step command a
declared `sourceStates`, and `advanceStep`'s docblock records why:

> the three used to be loose, optional arguments supplied per call site and declared nowhere a reader or a test
> could enumerate, **which is why four source sets went unkilled and four plan-ACTIVE omissions went unstated**.
> A new step command cannot now be added without a row.

**The PWU axes are in the state the step commands were in before JAN-EXECREM.**

## 2. Measured surface

- **11** `advancePwuLifecycle` call sites in `pwu.ts` (targets: SHAPING, READY, CHALLENGED, RESHAPING,
  INVALIDATED, SUPERSEDED, BLOCKED, ESCALATED, BASELINED, ABANDONED, REJECTED).
- **5** `advanceIntent` call sites in `intent.ts` (UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED).
- Census today: **115 of 304 arrows, 14 of 27 machines** — pinned by `verif/arrow-census-coverage.test.ts`.

**Derived from `STATE_MACHINES['PWU.workLifecycleState']` rather than read off the handlers** (57 transitions,
19 targets):

- **49 of the 57 arrows land on the 11 semantic-command targets.** The census sees **none** of them today, so
  this slice is worth ~49 arrows — coverage would move from 115 toward ~164 of 304.
- **`ABANDONED` and `SUPERSEDED` carry 17 in-edges each** — §8.2's *"Any active"* and *"Any non-baselined"*
  umbrellas — which is 34 of the 49 on their own. Their `sourceStates` are long by nature, not by sloppiness,
  and are generated from the machine rather than typed.
- **The remaining 8 arrows land on targets no semantic command owns** (PLANNED, EXECUTING, EVIDENCE_PENDING,
  UNDER_ASSURANCE, CONDITIONALLY_SATISFIED, SATISFIED, RECOMPOSING, RECOMPOSED) — the `ChangePwuState` hops.

**⚠ THAT LAST GROUP IS A THIRD CATEGORY THE ROADMAP DID NOT ANTICIPATE, and it must not be filed as
"unimplemented".** Those arrows ARE performed — by the generic setter, whose own rule (REG-F-072) is that it may
not perform an arrow a semantic command owns. So the gate's second limb has three outcomes, not two: **CLAIMED**
by a spec, **PERFORMED BY THE GENERIC SETTER**, or **UNIMPLEMENTED**. Collapsing the middle one into either of
the others would either invent a coverage gap or hide a real one.

**AND THE SOURCE SETS NEED NO JUDGEMENT**, which is what makes this slice safe to mechanise: every handler
already intends exactly its target's in-edges (§3), so each `sourceStates` is generated from the machine and
reviewed, not authored.

## 3. What the declaration is worth — stated honestly, because it is less than it looks

Checked against §8.1/§8.2: **every handler already intends exactly the machine's in-edges for its target.**
`invalidatePwu` means all three of SATISFIED/CONDITIONALLY_SATISFIED/RECOMPOSED; `reshapePwu` means both of
EXECUTING/UNDER_ASSURANCE. **So declaring the source set narrows nothing today**, and it would be dishonest to
sell this as closing a live hole.

What it is actually worth, in order:

1. **DRIFT.** Today, if the ratified machine gains an in-edge to `BLOCKED`, every command targeting BLOCKED
   silently accepts it. With a declared set, the new arrow is **unimplemented until someone says otherwise** —
   the same property `STEP_COMMAND_SPECS` gives step commands.
2. **VISIBILITY.** The census reads the table as data (its own second idiom) and 11 arrows stop being invisible.
3. **A PLACE TO BE NARROWER.** The first command that means less than its machine allows currently has nowhere
   to say so.

**⚠ AND (1) IS THE ONE THAT MUST BE MECHANISED, or this is decoration.** A declaration nobody compares against
the machine is a comment. §5's gate is therefore not optional garnish — it is the increment.

## 4. The design

### 4.1 `PWU_LIFECYCLE_COMMAND_SPECS` (rph-domain)

Mirrors `STEP_COMMAND_SPECS`: `commandType → { machine, sourceStates, target, event }`. Lives in `rph-domain`
beside the machine it describes, so the gate that compares them imports no handler.

### 4.2 The handler reads it, and REFUSES outside it

`advancePwuLifecycle` takes the spec instead of a bare `target`, and refuses a source state outside
`sourceStates` **before** `canAdvanceWorkLifecycle` — so the declared set is the first thing checked and the
machine is the second. Order matters: a state the machine allows but the command does not claim must be refused
**as an undeclared arrow**, not as an illegal transition, because those are different mistakes and the caller
needs the right one.

### 4.3 The agreement gate (this is the increment, not a nicety)

Two directions, both derived from `STATE_MACHINES`:

- **No spec may claim an arrow the machine does not have.** `sourceStates ⊆ inEdges(machine, target)`. A spec
  claiming a non-existent arrow is a command that can never fire — the hollow, arriving in the fix for a hollow.
- **Every machine in-edge must be either CLAIMED by some spec or DECLARED UNIMPLEMENTED.** This is the drift
  guard, and it is a shrink-only list exactly as REG-F-113's and REG-D-042's are. Without this half the table
  tracks the machine only until someone adds an arrow.

### 4.4 The census reads the table

`declaredArrows()` gains the table as a third source — **as data, not as a new AST idiom**. This is the same
move it already made for `STEP_COMMAND_SPECS`, which is why it is safe: reading a declaration cannot fabricate.

## 5. Scope: PWU only, end to end

`advanceIntent` is an identical second slice and is **deliberately not in this one**. One machine carried all
the way through — table, handler, gate, census, pin — is a complete vertical; two machines half-done is a table
with a partial reader, which is the shape this whole entry is about.

**A table landed without its reader would be the hollow it exists to cure**, so the slice is not divisible below
"census reads it and the pin moves".

## 6. Acceptance — behavioural, reds named in advance

1. **The declared set is CHECKED**: a fixture spec omitting a state the machine allows must REFUSE that arrow,
   with an *undeclared-arrow* reason distinct from the illegal-transition one. Tested against a synthetic spec,
   because no real command is narrower than its machine today — and testing the mechanism on a fixture is
   honest, whereas inventing a narrow real command to have something to test would not be.
2. **The agreement gate discriminates both ways**: a spec claiming a phantom source state fails; a machine
   in-edge claimed by nothing and not declared-unimplemented fails.
3. **CONTROL — every existing PWU lifecycle command still performs its arrow.** Without it, every refusal above
   is equally consistent with a handler that now refuses everything.
4. **The coverage pin MOVES** in the same commit, from 115/304 and 14/27 to the measured new values — which is
   the mechanism REG-F-087 built for exactly this moment, forcing its conclusions to be re-read.
