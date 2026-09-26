# ROADMAP — `JAN-SELREV`: the selected reviewer in the product

**Design:** `DESIGN-the-selected-reviewer.md` (revision 2) · **Authority:** `REG-D-084` (sponsor selection); the
design's decisions are delegated under `REG-D-071` and recorded as `REG-D-085`, confirmed with `Q1` approved (`REG-D-086`) · **Date:** 2026-09-26 · **Status:** IN
PROGRESS.

⭑ **Exit.**
- **A misconfigured host is refused before paid work.** Misconfigured means: the tool unset outside test mode, the tool
  unknown or unwired, the chosen tool's model unset, or a program override outside test mode. The guidance names
  `REG-D-084`'s selection and the independence guidance.
- **A refusal that reaches a floor is recorded** as `VALIDATOR_EXECUTION_FAILED` and never thrown.
- **devin reviews with the model configured**, or the review fails closed with both models named.
- **agy, and devin with another model, stay configurable** (`REG-D-052`).
- **The gate never inherits a live-backend selection.**
- **The documents say what the product does.**
- The reviewer fingerprint is unmoved, and `gate:fast` is green. Nothing is pushed.

**Before `SR-1`.** File the gaps the design names (findings before counts):
- the selection gaps G1, G2, G3, G5, G6 and G8;
- G10, the agy executor's model.

Record `REG-D-085`.

## `SR-1` — one selector; a refused reviewer is recorded; the gate is hermetic (D2, D3, D4, D5, D8)

- **The selector** is `assurance/reviewer-selection.ts`, with the full table of D2 and D3. It trims the tool, and `''`
  means unset. Unknown tools are refused through `selectBackingTool(tool, 'ASSURANCE')`, and `pi` as *"no adapter
  wired"*.
- **`createFloorRegistry` reads the selector.**
  - On REFUSED it registers the refusing validator `reasoning-review.unconfigured`.
  - devin's model is resolved inside `evaluate`.
  - It accepts `devinExec?`, backed by the new `DevinExec` seam in `devinPrint`. The optional parameter keeps the
    qualification harness's `DevinModule` type.
- **The preflights.** The authoring preflight reads the selector, and `JPWB_ASSESSOR` is retired, which closes
  `REG-F-443`. `beginExecute` refuses a MODEL step before its dispatch batch, dispatching nothing.
- **The gate starts with the eight live-backend variables as `''`** at all three entry points: the Playwright
  webServer, the root vitest configs, and `apps/rph-demo`'s own vitest. Every reader treats `''` as unset.
- **Tests rewritten, not deleted:** `preflight.test.ts:17, :28-41, :49-53, :60` (design §4). Moved anchors are
  re-anchored in this commit; new mutants attack each limb.

| Instrument | Must show first |
|---|---|
| the selector's full table | new |
| the registry reaches devin through `devinExec`, with no `print` | red today |
| each server-mode misconfiguration records `VALIDATOR_EXECUTION_FAILED` naming the tool and `REG-D-084`'s guidance; nothing spawns | red today (the statement is the judge-model message) |
| the preflight and the registry agree both ways; a devin-only host is READY | red today |
| `beginExecute` refuses a model step before the executor opens; a TRANSFORMATION step is not refused | red today |
| a child run with the eight variables exported still selects the stand-in and the fixture executor | red today |
| the reviewer fingerprint | unmoved |

## `SR-2` — the model and the program that ran are the ones configured (D6, D7)

- **The model.** `requireReportedModel` in the validator's `timed()`, set only by the devin branch. On a mismatch, the
  try is captured as `rejected` with both ids, there is no repair, and the review fails closed. The guidance says to
  re-qualify or re-select.
- **The program.** The adapters export their captured overrides. The selector refuses an override for the SELECTED tool
  outside test mode. `REG-F-441` closes for the reviewer. Its executor half, the agy executor honouring `JPWB_AGY_BIN`,
  is filed.

| Instrument | Must show first |
|---|---|
| a reported ≠ configured model: one exchange record with the reported id, no repair, both ids named | red today |
| the fingerprint unmoved with the option off; a mutant turning it on in the fingerprint's seams reddens the fingerprint test | new |
| an override outside test mode refuses; under the never-honour mutant the test fails at the seam, never at a real program | red today |

## `SR-3` — the documents (D9)

- **The host documents.** README and `AUTHORING-BACKBONE.md` are rewritten, which closes `REG-F-442`. They cover the
  selected configuration and independence guidance, the working directory devin runs in and the host-profile
  precondition, that agy stays configurable, and that the agy executor runs `JPWB_JUDGE_MODEL`.
- **The rest.** `harness/README.md` and the header comments are corrected.
- **The live lane.** Its REQUIRED list depends on the tool; its spec asserts the RECORDED reviewer identity against
  the tool's model variable; its stale comments are corrected; `REG-F-445` is fixed or cited. Its test timeout is
  checked against the reviewer's worst case.

## `SR-4` — the gate holds the SELECTED reviewer to today's definition (`Q1`, ruled yes: `REG-D-086`)

- **The record.** A `SELECTION` line kind in `docs/tracking/reviewer-qualification/runs.ndjson` names the
  selected candidate (transport `devin`, model label `glm-5-3-flash-max`) and cites `REG-D-084`. It is
  validated like every other line, and the LAST `SELECTION` line is in force.
- **The check.** When a `SELECTION` is in force, the coverage limb also requires every current case to be
  covered by a deployable RUN of the selected candidate under today's fingerprint, or by a RESCORED record of
  such a run when only the scoring moved. A missing one is a COVERAGE problem that names the selected
  candidate.
- **Today.** The selected candidate's v3 run (`qr-2026-09-25-devin-glm-5-3-flash-max-v3`) covers all 26 current
  cases, so the check stays GREEN when the line is appended.

| Instrument | Must show first |
|---|---|
| a record whose current cases are covered only by ANOTHER candidate, with a `SELECTION` in force | RED, naming the selected candidate |
| the same record with the selected candidate's run | GREEN |
| only the scoring moved: a RESCORED record of the selected candidate's run suffices | GREEN |
| a malformed `SELECTION` line | refused by the record's validation |
| the committed record, with the `SELECTION` line appended | GREEN |

## Order

~~`SR-1` → `SR-2` → `SR-3`. Each lands with its mutants, `gate:fast` green and a local commit. `Q1` (the selected
reviewer held to today's definition) is built as `SR-4` only if the sponsor rules yes.~~ ⭑ **Restated 2026-09-26
(`REG-D-086`):** `SR-1` → `SR-2` → `SR-3` → `SR-4`. Each lands with its mutants, `gate:fast` green and a local
commit.
