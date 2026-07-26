# JAN-REVREM-DR-001 — Post-Build Review Remediation: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-25 · Design authority `JAN-REVREM-DS-001` v0.1.0. Origin: the post-build adversarial review of
JAN-EXECREM + JAN-EXEBIND (80 agents; 19 distinct confirmed defects).*

## 1. Land order

| WP | Title | Covers | Depends on |
|---|---|---|---|
| **RW-0** | Binding authority becomes a COLUMN; the allowlist limb is withdrawn | **BLOCKER #1**, MAJOR #2, MAJOR #3, MAJOR #9, MINOR #14, MINOR #18 | — |
| **RW-1** | Read-model fidelity: prune gating, derived closed-PWU set | MAJOR #4, #5, #6 | RW-0 |
| **RW-2** | The four false records + the vacuous tests | MAJOR #7, #8, #10, #6-record; MINOR #17 | RW-1 |
| **RW-3** | Binding SCOPE (MAJOR #2) + remaining MINORs | MAJOR #2; MINOR #12, #13, #15, #16, #19 | RW-2 |
| **RW-4** | *(added by the second review)* The finding-#7 floor RW-2 wrongly refused | BLOCKER (2nd review) | RW-3 |
| **RW-5** | *(added by the second review)* The stale records RW-0/RW-3 left | 16 findings (2nd review) | RW-4 |
| **RW-6** | *(added 2026-07-26)* The read-model's THIRD authority limb — MAJOR #5, which C-3 disclosed rather than closed | MAJOR #5 | RW-5 |

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

## 4b. RW-6 — the read-model's third authority limb (DS §6b, R7–R9)

**Step 1 — extract the verdict (R8).** `bindingAuthorityVerdict(stepId, facts): BindingAuthorityVerdict` into
`packages/rph-domain/src/execution.ts`, beside `bindingPermitsExecution` which it calls. Four checks in the
established order, each returning a `limb` discriminator (`'OUT_OF_SCOPE' | 'UNRESOLVABLE' | 'WRONG_STEP' |
'NOT_AUTHORIZED' | 'PERMITTED'`). No messages, no wire codes, no store — those stay at the layer that owns them.

**Step 2 — the handler renders it.** `bindingAuthorityRefusal` resolves the store into `facts`, calls the verdict,
and switches on `limb` to produce the SAME rejections it produces today: same codes, same markers, same subject
lists. This is a pure refactor and the eight kill tests in `exebind-wp1-binding-authority.test.ts` must pass
**unchanged** — if any needs editing, the extraction changed behaviour and is wrong.

**Step 3 — the ledger follows the code.** `S1`, `S2`, `B1`, `B4` and `B6` anchor inside the function whose body is
moving. Their `file` and anchors are updated **in the same commit**, with a note that the guard did not change, only
its site. This is the maintenance the `UNANCHORED` verdict exists to force; doing it in a later commit is how the
ledger rots. `mutants:preflight` is the check that it was done.

**Step 4 — the read-model reads the column.** `ExecutionStepInput` gains an optional
`runtimeBinding?: { resolves: boolean; boundStepId?: string; authorizationStatus?: string }`, and
`planPermitsAffordance` gains its third limb: when `spec.bindingAuthority === 'REQUIRES_AUTHORIZED_BINDING'` and the
step names a binding and the caller supplied facts, withhold the affordance unless the verdict is `ok`. Fail-open on
absent facts, out-of-scope on an absent id (R9).

`planPermitsAffordance` and `planAffordancesFor` become step-aware — they currently take `stepState`, not the step —
so the signature carries the step's binding facts. `prunableStepIds` is unaffected: `PruneExecutionStep` declares
`NOT_EXECUTING`, and that is read off the column rather than assumed.

**Step 5 — the production caller supplies the facts.** Whatever builds `ExecutionPlanInput` resolves each step's
`runtimeBindingId` through the store, exactly as `plansForPwus` resolves `pwuWorkLifecycleState`. A caller that does
not is unchanged in behaviour, by R9.

### Kill tests (named, because an unnamed victim is a records defect)

`revrem-wp6-readmodel-binding-authority.test.ts` in `rph-projections`:

1. `REQUESTED` binding ⇒ **no `start`** in `advanceCommands` for a QUEUED step; every other affordance unchanged.
2. `AUTHORIZED` ⇒ `start` present. The positive half, without which limb 3 could be `return []`.
3. `PARTIALLY_AUTHORIZED` ⇒ `start` present — the acceptance limb the engine permits and N-6 makes command-unreachable.
4. Binding whose `boundStepId` names another step ⇒ **no `start`**, even though the status is `AUTHORIZED`.
5. `resolves: false` ⇒ **no `start`** (resolved negative fact gates).
6. Facts **absent** entirely ⇒ `start` PRESENT (R9's fail-open, asserted so it cannot be quietly tightened into a
   silently emptied action column).
7. **No `bindingId`** ⇒ `start` present (R9's out-of-scope; the reference-seed case).
8. A WAITING step with an unauthorized binding ⇒ **no `resolve`** — proving the gate follows the COLUMN and not a
   hardcoded `start`.
9. `cancel` on the same unauthorized step ⇒ **PRESENT.** The over-refusal guard: gating the exit of last resort
   would strand the step, which is what ledger mutant `R6` proves at the engine layer.

New ledger mutants: remove the third limb from `planPermitsAffordance` (⇒ 1, 4, 5, 8 RED); make it refuse
unconditionally (⇒ 2, 3, 6, 7, 9 RED); flip `ResolveExecutionStepWait`'s column to `NOT_EXECUTING` (⇒ 8 RED, proving
the column is genuinely the source).

**MEASURED, all three KILLED:**

| mutant | verdict | what it establishes |
|---|---|---|
| `W5-readmodel-binding-limb-never-withholds` | **KILLED** | MAJOR #5 itself is caught — the defect cannot silently return |
| `W6-readmodel-binding-limb-always-withholds` | **KILLED** (7 tests RED) | the over-refusal half; the limb is not `return false` wearing a gate's name |
| `R1-resolve-not-executing` | **KILLED** in *both* batteries, and **KILLED by the read-model battery alone** under `MUTANTS_TARGET` | one character of declaration moves BOTH layers independently — the actual proof that the column is a single source rather than two implementations that agree today |

That last row is the one worth having. Two implementations that happen to agree are indistinguishable from one shared
declaration *until something changes*, and a mutation of the declaration is the only thing that asks the question.

## 5. Gate

`G-REVREM-001`: check-types · test · lint 0 · boundary 0 · svelte-check 0 · Playwright · **`rph-engine` 69** ·
the registry-totality gates · every new guard live mutation-red-proofed **after a rebuild**.

## 6. Delivery record

**RW-0 … RW-5 DELIVERED, 2026-07-25.**

| WP | Commit | Outcome |
|---|---|---|
| RW-0 | `05518cc3` | BLOCKER closed as a CLASS: `bindingAuthority` becomes a column; the §15.3 wedge withdrawn. |
| RW-1 | `90d0eddd` | Prune joins the authority filter; the closed-PWU set becomes genuinely derived. |
| RW-2 | `10351de9` | Four false records corrected. **Its refusal of finding #7 was itself wrong** — see RW-4. |
| RW-3 | `0c093449` | A binding authorizes the step it NAMES and no other. |
| RW-4 | `fe109847` | The finding-#7 floor added; the pin test that could not falsify itself, fixed. |
| RW-5 | `91794cb8`-series | The stale records RW-0/RW-3 left behind — the second review's other 16 findings. |
| RW-6 | *(this commit)* | **MAJOR #5 CLOSED** — the read-model's third authority limb, gated on the COLUMN. The four checks moved to `rph-domain`'s `bindingAuthorityVerdict`, so engine and projection consult ONE declaration; the eight engine kill tests passed **unchanged**, which is what makes the extraction a refactor rather than a rewrite. 11 new named kill tests; `R1`'s one-character mutant now has TWO victims, one per layer. Production caller wired via `listByType('RUNTIME_BINDING')` — MAJOR #5 was closable in the projection alone, and closing it there only would have been closing it on paper. |

**Gate `G-REVREM-001` green** at each landing: check-types 21/21 · vitest 21/21 · lint 0 · boundary 0 ·
svelte-check 0 · Playwright 50 · **`rph-engine` 69 (the reference seed drives unchanged)** · every new guard live
mutation-red-proofed **after a rebuild**.

> **This section was empty, under a note saying it was "empty on purpose … the lesson from `JAN-EXECPLAN-DR-004`,
> which shipped a feature under a record reading 'Nothing built'" — while four work packages had already
> shipped under it.** The second adversarial review found that, and it is the sharpest single illustration in
> this lineage: writing the diagnosis is not the same as not having the disease. Recorded rather than quietly
> filled in.

## 7. The criterion this series must not repeat

JAN-EXECREM recorded its own missing review as OWED and shipped anyway; the review, when finally run, found a
BLOCKER introduced by the work package that was closing that programme's last finding. **This remediation gets
its own adversarial review before it is called complete**, and the review's own completeness critic named where
the last one was thin: no browser lens, no branch-coverage census, no re-run of the declared mutation ledgers.

---

*`DELIVERED` / v0.1.0 — 6 work packages (RW-0..RW-5; RW-4 and RW-5 were added BY the review of RW-0..RW-3). Its own adversarial review is EXECUTED: 30 candidates, 17 confirmed, and it found that RW-2 refused a real BLOCKER.*
