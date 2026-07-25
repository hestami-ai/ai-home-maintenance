# JAN-REVREM-DS-001 — Post-Build Review Remediation: Design

*v0.1.0 · 2026-07-25 · Provenance: the **post-build adversarial verification of JAN-EXECREM (WP-0…17) and
JAN-EXEBIND (WP-B0…B3)** — 80 agents, 36 candidates, **24 confirmed / 19 distinct** (1 BLOCKER, 10 MAJOR,
8 MINOR), 12 refuted. Every finding survived two independent refuters that defaulted to REFUTED. Roadmap:
`JAN-REVREM-DR-001`.*

---

## 1. The verdict, stated plainly

**The review that JAN-EXECREM recorded as OWED has now been executed, and it did not discharge the exit
criteria.** It found a BLOCKER and a shipped regression, both introduced **the same day**, by the work package
that was supposed to be closing this lineage's last open finding.

**The through-line, and it is the same one as the original 46:** every one of the 19 defects is compatible with a
green suite. `check-types` 21/21, vitest 21/21, 545 application tests, `rph-engine` 69 unchanged, boundary 0,
Playwright 50 — all green, with a BLOCKER live in the code.

## 2. The BLOCKER, and why it is the worst possible instance

> `bindingAuthorityRefusal` has **one call site**. **Two arrows drive a step into RUNNING.**

`startExecutionStep` carries the guard; `resolveExecutionStepWait` (`execution.ts:1414`) passes **no precheck at
all**. Proved live through `Engine.dispatch`:

```
Start (binding AUTHORIZED, allowlisted)  -> ACCEPTED
EnterExecutionStepWait                   -> WAITING
RevokeRuntimeCapability                  -> binding REVOKED
ResolveExecutionStepWait                 -> ACCEPTED     <-- step is RUNNING against a REVOKED binding
```

**Revocation is unenforceable for any step that can be parked in WAITING.** The engine's own refusal message says
this state is impossible: *"a step may only execute against an AUTHORIZED or PARTIALLY_AUTHORIZED binding
(RPH-EXE-003 / §8.1)"*.

**THE ROOT CAUSE IS THE DEFECT FAMILY THIS ENTIRE LINEAGE EXISTS TO ELIMINATE.** JAN-EXECREM WP-8 built
`STEP_COMMAND_SPECS` because *"an omission is invisible in a list that does not exist"*; WP-12b moved
`planLiveness` and `pwuOpenness` into it as **columns**, evaluated once in `stepAuthorityRefusal`, precisely so
that no command could omit an authority. JAN-EXEBIND then added a third authority as **a hand-inlined precheck at
one call site** — the exact shape WP-8 replaced. The design document even specified it that way (*"sited inside
`startExecutionStep`'s existing precheck"*) and never asked which **other** commands target RUNNING.

A guard that must be remembered at each call site will be forgotten at one of them. That is not a lesson this
codebase needed to learn again.

## 3. The regression: an unrecoverable wedge whose remedy is forbidden

JAN-EXEBIND's §15.3 allowlist limb refuses a binding absent from `plan.authorizedRuntimeBindingIds`, and its
message instructs: *"Re-activate the plan naming this binding"*. `activateExecutionPlan` requires status
`APPROVED`; the plan is `ACTIVE`. **The prescribed remedy is categorically refused.** Proved live: Start →
`RPH_INVARIANT_VIOLATION`; re-activate → `RPH_ILLEGAL_STATE_TRANSITION … but it is ACTIVE`; Start → refused again.

And **both shipped activation sites hardcode `authorizedRuntimeBindingIds: []`** —
`packages/rph-engine/src/reference-undertaking.ts:563` and
`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:544`. So any step naming a binding is permanently
unstartable and its plan can never complete.

**RULING R2 — WITHDRAW THE LIMB.** Not repair it. The analysis that should have preceded it:

- If activation **derives** the list from the plan's own steps, the check always passes — vacuous.
- If a human supplies it, production supplies `[]` — everything with a binding bricks.
- There is no UI, API or command by which a sponsor could supply a meaningful list.

**The limb is inherently either vacuous or wedging, and there is no third state.** It was AUTHORED — §15.3
ratifies the *field*, not a refusal — so withdrawing it removes no ratified rule. `authorizedRuntimeBindingIds`
returns to what WP-14 left: persisted, read by nothing. **That is recorded as an open item, not as closed.** A
field written and never read is a real problem; a refusal that bricks the engine is a worse one, and shipping the
worse one to avoid admitting the first is how this family propagates.

## 4. What the review says about the RECORDS — the part that matters most

Four claims in JAN-EXECREM's own documents are **false**, and each is false in the reassuring direction:

| Record | Claims | Actually |
|---|---|---|
| `RESIDUALS.md` §2 | the closed-PWU set is *"derived rather than hardcoded"* | `execution-view.ts:217` hardcodes a **second copy**; nothing binds it to `terminalStates`; the only test retypes the same literal |
| `RESIDUALS.md` §1 A-3 | prune provenance **CLOSED** | `pruneProvenance` bails on non-BRANCH sources, so a prune below a CANCELLED step emits a payload **content-identical to a waived skip** — the sole justification DR-004 §19-M1 gave for minting the event |
| `execrem-wp1-dormancy.test.ts` | three fields DORMANT, with a *"deliberate tripwire"* | all three have producers since WP-10/13/14; the tripwire never fired because the fixture cannot reach any emitter |
| `exebind-wp1` P4 | covers the fail-open allowlist limb | it activates **with** the allowlist and **dispatches no Start**; inverting the branch leaves **545/545 green** |

**This is the seventh through tenth instance of one habit**, and it now has a name in this repo: recording the
absence of evidence as evidence of absence. Every one was written by the same author who wrote the code and chose
the tests. The gates cannot catch it — a register checks that a claim is *present*, never that it is *true*.

## 5. Rulings

- **R1 — Binding authority becomes a COLUMN**, `bindingAuthority`, on `STEP_COMMAND_SPECS`, evaluated in
  `stepAuthorityRefusal` beside `planLiveness` and `pwuOpenness`. Total over the nine commands, with a written
  rationale each, so adding a tenth command without declaring its binding disposition is a **compile error**.
  This closes the BLOCKER *and* the class, and it is the fix WP-8's own header prescribes.
- **R2 — Withdraw the §15.3 allowlist limb** (§3). Record the field's unread status honestly.
- **R3 — Derive `CLOSED_PWU_STATES` in the read-model** from the machine, as the authority does. The
  "one declaration" claim becomes true instead of asserted.
- **R4 — Prune joins the affordance filter.** `PruneExecutionStep` is absent from `COMMAND_BY_AFFORDANCE`, so the
  totality type could not see the omission — the same invisibility, one layer down. It gains a row.
- **R5 — Correct the four false records, and do not soften them.** Each keeps a struck-through statement of what
  it used to claim, per the standard set in WP-17.
- **R6 — Do NOT chase the MINORs in this series.** Eight are real and none is urgent; batching them behind the
  BLOCKER would delay the fix that matters. They land in RW-3 with the vacuous-test repairs.

## 6. Conflicts

- **C-1 — the enforcement register's `enforcedAt` for RPH-EXE-003 names a site that is about to move.** It must
  be updated in the same commit, or the register documents a call site that no longer exists.
- **C-2 — withdrawing the allowlist limb kills two tests** (`exebind` K5 and the "different plan" case) and the
  register's third `declaredMutation`. They are **deleted, not weakened** — the limb they prove is going away.
  The mutation ledger loses a row and gains the two-arrows mutant, which is a better trade than it sounds: the
  old row could not redden its own probe (MINOR #14).
- **C-3 — the read-model cannot see binding status.** `ExecutionStepInput` carries no `authorizationStatus`, so
  MAJOR #5 (the UI offering Start on a step the engine now refuses) is **not fully closable** without threading a
  fourth input through the projection. Scoped to RW-1 and disclosed if it does not land there.

## 7. Enumerated behaviour changes

`ResolveExecutionStepWait` on a step whose binding is not `AUTHORIZED`/`PARTIALLY_AUTHORIZED` → **REFUSED**
(new). Any step whose binding is absent from the plan's activation allowlist → **ACCEPTED** (the withdrawn limb).
Prune affordances on a closed PWU → **withheld** by the read-model (the engine already refused them).

## 8. Exit criteria

The BLOCKER closed **as a class, not as an instance** — proved by a mutant that removes the column from any one
command and turns a *named* test RED. The wedge gone, with both production activation sites re-verified. The four
false records corrected. Full gate green, `rph-engine` 69. And — the criterion this lineage keeps rediscovering —
**this remediation gets its own adversarial review before it is called complete.**

---

*`READY_TO_BUILD` — 19 confirmed defects, 1 BLOCKER, 1 shipped regression, 4 false records. The review that found
them was the one JAN-EXECREM recorded as owed; it took 80 agents to find what a green suite could not.*
