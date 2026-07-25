# JAN-REVREM-DR-001 — Post-Build Review Remediation: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-25 · Design authority `JAN-REVREM-DS-001` v0.1.0. Origin: the post-build adversarial review of
JAN-EXECREM + JAN-EXEBIND (80 agents; 19 distinct confirmed defects).*

## 1. Land order

| WP | Title | Covers | Depends on |
|---|---|---|---|
| **RW-0** | Binding authority becomes a COLUMN; the allowlist limb is withdrawn | **BLOCKER #1**, MAJOR #2, MAJOR #3, MAJOR #9, MINOR #14, MINOR #18 | — |
| **RW-1** | Read-model fidelity: prune gating, derived closed-PWU set | MAJOR #4, #5, #6 | RW-0 |
| **RW-2** | The four false records + the vacuous tests | MAJOR #7, #8, #10, #6-record; MINOR #17 | RW-1 |
| **RW-3** | Remaining MINORs + the completeness-critic gaps | MINOR #12, #13, #15, #16, #19 | RW-2 |

**RW-0 first and alone.** It carries the only BLOCKER and the only shipped regression, both introduced the same
day. Nothing else in this roadmap is urgent; batching them behind it would delay the fix that matters and make
the diff unreviewable — which is finding N-7's lesson from four hours ago.

## 2. RW-0 — the fix, and why it is a column and not a second call site

**The tempting fix is wrong.** Adding `bindingAuthorityRefusal(...)` to `resolveExecutionStepWait`'s precheck
closes the instance and leaves the class: the next command that targets RUNNING will omit it, exactly as this one
did. WP-8's own header says why — *"an omission is invisible in a list that does not exist"*.

**The fix:**

```ts
// step-command-spec.ts — a THIRD authority column, total over the nine commands
readonly bindingAuthority: 'REQUIRES_AUTHORIZED_BINDING' | 'NOT_EXECUTING';
readonly bindingAuthorityRationale: string;
```

`REQUIRES_AUTHORIZED_BINDING` for the two commands that drive a step **into RUNNING** — `StartExecutionStep` and
`ResolveExecutionStepWait`. `NOT_EXECUTING` for the other seven, each with a stated reason, so a silence is a
declaration rather than an absence (the WP-12b discipline).

Evaluated in `stepAuthorityRefusal`, beside `planLiveness` and `pwuOpenness`, from **one** site. `advanceStep`
already has the `step` in hand at that point, so the resolver needs no new plumbing.

**Withdraw the allowlist limb** (DS §3) — the third check in `bindingAuthorityRefusal`, its message, its two
tests, and the register's third `declaredMutation`. Deleted, not weakened.

### Kill tests

| # | Case | Expect |
|---|---|---|
| **B1** | Start → EnterWait → **Revoke** → ResolveWait | **REFUSED**, status marker — *the BLOCKER, verbatim* |
| B2 | Start on a REQUESTED / DENIED / REVOKED binding | REFUSED (regression-guards the existing behaviour) |
| **B3** | **Every** `REQUIRES_AUTHORIZED_BINDING` command, driven from the table, refuses an unauthorized binding | REFUSED — *the CLASS, not the instance* |
| B4 | Every `NOT_EXECUTING` command is unaffected by binding status | ACCEPTED |
| P1 | ResolveWait with the binding still AUTHORIZED | ACCEPTED |
| P2 | A step whose binding is **not** in `authorizedRuntimeBindingIds` starts | **ACCEPTED** — the withdrawn limb |
| P3 | Both shipped activation sites (seed + demo) still drive their plans | `rph-engine` 69; Playwright 50 |

**B3 is the one that closes the class.** It iterates `STEP_COMMAND_SPECS` rather than naming commands, so a tenth
command declaring `REQUIRES_AUTHORIZED_BINDING` without enforcement fails here — and, per the WP-12b ruling, the
**classification** is proved separately by hardcoded cases (B1, B4) that do *not* read the table, so the table and
its test cannot agree on a wrong value.

**Declared mutations (all must go RED):**

1. Flip `ResolveExecutionStepWait.bindingAuthority` to `NOT_EXECUTING` → **B1** RED. *(This is the BLOCKER,
   re-expressed as a one-character change — which is the point of the column.)*
2. Flip `StartExecutionStep.bindingAuthority` to `NOT_EXECUTING` → B2, B3 RED.
3. Delete the `bindingAuthority` limb from `stepAuthorityRefusal` → B1, B2, B3 RED.
4. Restore the allowlist limb → P2 RED.
5. Invert `bindingPermitsExecution`'s accept set → B1–B3 RED.

**Rebuild before measuring.** `rph-engine` and `rph-application` resolve `@janumipwb/rph-domain` to its **built
dist**; a `rph-domain` mutant validated without a rebuild proves nothing. This has produced a false GREEN twice in
this lineage, and the review's completeness critic flags it as unaccounted-for in its own method.

## 3. RW-1 — read-model fidelity

- `PruneExecutionStep` gains a `COMMAND_BY_AFFORDANCE` row so the totality type can see it, and `prunableStepIds`
  passes through `planPermitsAffordance`. The false template comment goes.
- `CLOSED_PWU_STATES` is **derived** via `getMachine('PWU.workLifecycleState').terminalStates`, as
  `pwu-behavior.ts` already does two files away. A test asserts the read-model set **equals** the machine's, so
  the two cannot drift — and it must not retype the literal, which is what made the existing test blind.
- MAJOR #5 (binding status absent from the projection) is attempted here; **if it does not land, it is disclosed
  in the register, not dropped.**

## 4. RW-2 — the records, and the tests that certified nothing

Correct the four false records (DS §4), each keeping a struck-through statement of what it claimed. Repair
`startableStepIds`' missing incoherence floor and the vacuous test that certified it, the empty-iteration
coherence matrix, and the dormancy fixture that cannot reach its own emitters.

## 5. Gate

`G-REVREM-001`: check-types · test · lint 0 · boundary 0 · svelte-check 0 · Playwright · **`rph-engine` 69** ·
the registry-totality gates · every new guard live mutation-red-proofed **after a rebuild**.

## 6. Delivery record

*(RW-3 writes this. Empty on purpose, and saying so — the lesson from `JAN-EXECPLAN-DR-004`, which shipped a
feature under a record reading "Nothing built".)*

## 7. The criterion this series must not repeat

JAN-EXECREM recorded its own missing review as OWED and shipped anyway; the review, when finally run, found a
BLOCKER introduced by the work package that was closing that programme's last finding. **This remediation gets
its own adversarial review before it is called complete**, and the review's own completeness critic named where
the last one was thin: no browser lens, no branch-coverage census, no re-run of the declared mutation ledgers.

---

*`READY_TO_BUILD` / v0.1.0 — 4 work packages. Nothing built yet.*
