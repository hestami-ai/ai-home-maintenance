# ROADMAP — `JAN-SELRES`: what `JAN-SELREV` left

**Design:** `DESIGN-the-selection-residuals.md` (revision 2). · **Authority:** `REG-D-071`'s delegation. The design's
decisions are recorded as `REG-D-087`, flagged for sponsor confirmation. · **Date:** 2026-09-28. · **Status:** IN
PROGRESS.

⭑ **Exit.**
- **The agy executor runs the model it records** (`REG-F-458` closed).
- **An executor's program is not replaced outside test mode** (`REG-F-459` closed).
- **A misconfigured executor is refused before dispatch.** The model run, the model configured and the model recorded
  are one read.
- **A substituted reviewer model** is recorded with its own code and answered with its own action and guidance
  (`REG-F-460` closed).
- **The PWA page's blocked hint** no longer says "revise the graph" beside a review that failed or was refused
  (`REG-F-462` closed).
- **The documents say what the product does.**
- The reviewer fingerprint is unmoved, the SELECTION in force stays covered, and `gate:fast` is green. Nothing is
  pushed.

**Before `RS-1`: file the findings first, then the counts.**
- File `REG-F-462` to `REG-F-466`.
- Record `REG-D-087`, with the three superseding notes of design §6.6 and a pointer from each superseded entry.
- The register edits are Codex's (the standing split), and are audited by git before they are committed.
- They are committed with the design and this roadmap.

**The landing pattern for every increment** is `JAN-SELREV`'s:
1. An implementing agent builds the increment.
2. An adversarial verifier attacks it. Its OWN mutants find test gaps.
3. A fix agent applies its notes, and every survivor becomes a ledger mutant.
4. The caller lands it:
   - append the ledger entries and stage by explicit path;
   - run `bun run mutants` on the new ids plus every prior id anchored in a touched file;
   - fill `observe.py`, then run `gate:fast`, then commit with `-F`.

No agent stages or commits.

## `RS-1` — the executor: one selector, the model it records, no replaced program (D1–D5; D9's executor half)

**Order within the increment, red first:**
1. **The seam.** `getExecutionSession(selection, deps?)` with `deps = { agyExec?, openPi? }`, and no change of
   behaviour: agy still runs `agyPrint` → `judgeModel()`.
   - Then the argv test goes in: it opens `getExecutionSession(AGY)` with an injected exec and asserts `--model` is
     the selection's model. It must be RED on the judge model.
2. **D2.** `agyPrintWithModel`, one implementation with one sanitising catch, and a role-parameterised failure text.
   `agyPrint` stays byte-identical. The argv test goes GREEN.
3. **D1 and D3.** `execution/executor-selection.ts`, with its full table, per-tool overrides, and the UNSET guidance
   listing the wired tools only.
4. **D4.**
   - `beginExecute` asks the selector after the reviewer preflight and before `runSteps`.
   - The record's fallback identity comes from the selection.
   - `openPiExecutionSession(context, modelId)`.
   - `model.ts:16`, `executorToolId()` and `executorModel()` are removed, with the successor table of design §4.5.
5. **D5.** The lane's executor limb, restated import-free, with the lane-labelled agy refusal. It is pinned against the
   product selector over a table.
6. **D9's executor half.** README, AUTHORING-BACKBONE, `SELECTED_REVIEWER_GUIDANCE`'s REG-F-458 clause, the comment
   sites, and `SR2-M20`'s `why`.

| Instrument | Must show first |
|---|---|
| `getExecutionSession(AGY)` argv `--model` = the selection's model | RED on the judge model (step 1) |
| the route records the executor model `x`, `HOST_CONFIGURED`, with the judge model `y` absent from the argv | red today |
| every executor refusal code reachable through `beginExecute`: guidance returned, nothing dispatched, executor never opened | red today (G3: found after `StartExecutionStep`) |
| `PROGRAM_OVERRIDDEN` in its own file (`vi.hoisted` `JPWB_AGY_BIN`) | red today (G5) |
| a server-mode TRANSFORMATION step with nothing configured SUCCEEDS | control, with its own mutant |
| `deps.openPi` receives `selection.modelId` and is not called before the opener is | new |
| a rejecting exec through `getExecutionSession(AGY)` leaves no prompt fragment in the failure detail | new |
| STAND_IN in test mode, the awaited fixture turn, and the probe asks `selectExecutor` | replaces `model.test.ts:124-131` |
| the selector's table, including a PI executor admitted with `overrides.agy` set (`SR2-M20`'s new *who relies*) | new |
| the lane limb agrees with `selectExecutor` over a table | new |
| the reviewer fingerprint | unmoved |

- **Anchors that must still occur exactly once:**
  - `SR1-M17`, `M18` and `M37` in `beginExecute`;
  - `SR2-M27` and `SR2-M29` in `agy-cli.ts`;
  - `SR3-M5`, `M6`, `M23`, `M24` and `M26` in `lane-config.ts`.
- **Mutants to write, at least one per limb:**
  - refusal codes and their order;
  - an override refused in test mode;
  - the environment read instead of the captured override;
  - `?? ''` dropped;
  - a non-agy executor refused by `JPWB_AGY_BIN`;
  - the route refuses nothing, asks with `testMode: true`, or asks after `runSteps`;
  - the record reads `resolveExecutorModel()`;
  - `agyPrintWithModel` ignores its model;
  - the PI branch reads the environment;
  - the lane admits an unknown, unwired or overridden executor.
- ⭑ *Landed 2026-09-28.*
  - **The selector** is `execution/executor-selection.ts`; one selection per model step, asked after the reviewer
    preflight and before dispatch, opens the executor and names the record. `executorToolId()`, `executorModel()` and
    `model.ts`'s own test-mode constant are gone, and every assertion on them moved to a named successor.
  - **The agy executor** runs `JPWB_EXECUTOR_MODEL` through `agyPrintWithModel`; `agyPrint` is byte-identical (200
    differential cases, 0 differ). Pi takes the selection's model through `openPiExecutionSession(context, modelId)`.
  - **The verifier's findings, applied.** No green route test reaches a real devin: a throwing mock stands behind PATH.
    The reviewer-first order, the executor's bounds and the lazy Pi load each have an instrument, the UNKNOWN reason
    offers only wired tools, and a repair turn is driven.
  - **Mutants:** RS1-M1..M35 added (M31..M35 from the verifier and the fix round); with the 93 prior entries anchored in, or victimised by, the touched files, 129 of 129 KILLED by the official runner on the staged tree. **gate:fast:** GREEN, 6174 passed / 4 skipped, e2e 95 of 95, the fingerprint unmoved.

## `RS-2` — a substituted reviewer model: its own code, its own action (D6, D7; D9's substitution half)

1. **`packages/rph-assurance`.**
   - The `validatorFailure: { code, statement }` carrier, read by property in `runFloorResults`' catch.
   - `VALIDATOR_FAILURE_CODES` = `['VALIDATOR_MODEL_SUBSTITUTED']`, exported with its type.
   - `failedResult` records `VALIDATOR_EXECUTION_FAILED` first, then the in-set observation.
   - Tests for the four limbs.
   - The export census regenerated, and the coverage floor held.
2. **The app's throw.**
   - `reasoning-review-validator.ts:588` carries the failure, and its message is unchanged.
   - `SR2-M6` and `SR2-M35` are re-anchored, and `SR2-M35`'s replacement is re-derived.
   - A mutant drops the carrier.
3. **`floor.ts`.**
   - The `REQUALIFY_OR_RESELECT_REVIEWER` action and its branch before the execution-failure branch.
   - `VALIDATOR_MODEL_SUBSTITUTED` in `OPERATIONAL_REVIEW_CODES`.
   - The exhaustive `isOperationalRemediation`, used by `agent/+server.ts`.
4. **D9's substitution half.** README and AUTHORING-BACKBONE.

| Instrument | Must show first |
|---|---|
| a causeless throw's `observations` `toEqual` exactly one `VALIDATOR_EXECUTION_FAILED` | holds today, and pins it |
| an in-set failure adds exactly one observation, second; out-of-set and non-Error add nothing | new |
| a REAL substituting devin validator through `runFloorResults` → `VALIDATOR_MODEL_SUBSTITUTED` recorded | red today |
| the same floor classified → `REQUALIFY_OR_RESELECT_REVIEWER`, `autoRefine` false, the D7 guidance, no "retry the reviewer" | red today (REG-F-460) |
| the execution plane's message names `REQUALIFY_OR_RESELECT_REVIEWER` beside a substitution | red today (G8) |
| `isOperationalRemediation` is exhaustive, and the authoring route marks a substitution EXTERNAL-blocked, never REVISION_REQUIRED | new |
| the reviewer fingerprint | unmoved |

- **Mutants:**
  - the carrier ignored;
  - an out-of-set code recorded;
  - a causeless throw gains an observation;
  - the new code replaces `VALIDATOR_EXECUTION_FAILED`;
  - the branch after the execution-failure branch;
  - `autoRefine` true;
  - the route's operational test missing the new action;
  - the code removed from `OPERATIONAL_REVIEW_CODES` (killed in `RS-3`, and noted if it survives here).

## `RS-3` — the PWA page's blocked hint follows the record (D8; `REG-F-462`)

1. **The page.** Its load exposes whether the reasoning-review policy's observations include a code in the exported
   `OPERATIONAL_REVIEW_CODES`.
2. **The hint.** It renders D8's sentence then, and today's sentence otherwise. No guidance and no waiver appear in it.
3. **A NEW e2e** stages a floor whose review recorded `VALIDATOR_EXECUTION_FAILED`, and asserts D8's sentence
   positively.
4. **D9's hint half.**

| Instrument | Must show first |
|---|---|
| the new e2e's positive assertion of D8's sentence | red today (G6) |
| `assurance-floor-waiver.e2e.ts:139-143` (`/revise/i`, not `/waiv/i`) | unchanged, green |
| `MU-F202`'s two anchors, each exactly once, still KILLED | unchanged |
| e2e | 95 existing plus the new, all green |

- **Mutants:**
  - the hint keyed on the action instead of the codes;
  - the operational sentence names a waiver;
  - the hint ignores `VALIDATOR_MODEL_SUBSTITUTED`, which kills `RS-2`'s set-membership mutant.
