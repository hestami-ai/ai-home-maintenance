# ROADMAP — `JAN-OUTCONTRACT`: the professional's output contract reaches the work

**Design:** `DESIGN-output-contract-reaches-the-work.md` · **Date:** 2026-09-06

⭑ No sponsor decision gates this. `outputContract` is ratified free text already authored through the UI; this
slice makes it reach the two places that need it, and mints nothing.

---

### `OC-01` — the instruction states the output the type requires

`prepareModelInvocation` appends the type's `outputContract` to the rendered instruction.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| render the template and drop the contract | the delivery test — the promise `EXECUTION_CONTRACT_PROMPT` already makes (*"an instruction that states the work and the exact output it requires"*) goes unkept |
| append it to the SYSTEM prompt instead | the boundary test — that prompt is set once per SESSION, so one type's contract would follow every later work unit |
| append when absent (an empty trailer) | the absence test — a contract section with nothing in it tells the producer a contract exists |
| **CONTROL** | a template with NO contract renders EXACTLY as before, byte for byte |

⭑ **And it is still `RENDERED_INSTRUCTION` at `THIS_TRY`** — `CP-04`'s ceiling is untouched, which a test
asserts so a future reader does not have to re-derive it.

---

### `OC-02` — the reviewer can judge conformance against it

`ReasoningReviewInput.outputContract?`, threaded into `judgePrompt` and supplied by the work-product floor.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| accept the field and never render it | the reviewer test — another authored-with-no-consumer field, which is the defect this slice exists to fix |
| render the section UNCONDITIONALLY with a "(none declared)" fallback | ⛔ the manufactured-finding test — `ASR-11`'s WHY: *"conflating evaluator breakage with subject failure punishes the work for the harness"* |
| render it unexcerpted | the budget test — `MAX_AGY_PROMPT_CHARS` |
| **CONTROL** | with no contract the judge prompt is unchanged, so absence cannot become a signal |

---

### `OC-03` — filings

Register entry recording: the measurement with its CONTROL, ⚠ **the correction to `outputContract`'s own vocab
note** (it cites `ASR-11`, whose SCOPE is *"assurance-process failures and observation quality"* — validator
output, not the producer's work product), and the disclosed non-fixes.

⛔ **NOT taken:** a machine-checkable contract — `schemaValid` still means PARSEABLE, and structuring the
contract is a vocabulary change wanting its own grant. Authoring an `outputContract` onto a seeded type to make
the new path fire — that would be inventing professional content to justify my own wiring.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
