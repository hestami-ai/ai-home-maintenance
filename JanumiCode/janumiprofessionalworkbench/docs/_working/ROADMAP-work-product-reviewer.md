# ROADMAP — `JAN-WPREVIEW`: the reviewer reads a work product

**Design:** `DESIGN-work-product-reviewer.md` · **Date:** 2026-09-05

### `WR-01` — the work-product judgement

`judgeWorkProduct(content, prompt)` beside the existing `judge(content)`. Structural only, with a recorded
limitation.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| return `SATISFIED` for anything parseable | the empty-product test AND the echo test |
| drop the limitation | the limitation test |
| echo fires on **any** value rather than **every** | the fixture-shaped test |
| use an invented criterion id | the criterion-id test (ids must come from the policy) |
| **CONTROL** | a substantive work product IS satisfied — else "reject everything" passes the above |

### `WR-02` — selection by subject type

The mock validator routes on `subject.objectType === 'ARTIFACT'`. **The graph arm must be untouched**: every
existing floor spec still passes, unedited.

### `WR-03` — the step completes

**Exit:** ⭑ the execution e2e shows a model-executed work unit reaching `COMPLETED`, its work product
assured. **The refusal path stays asserted** via a second case whose product is empty or an echo.

### `WR-04` — honesty

File it; state that `SATISFIED` here is a STRUCTURAL pass with a recorded limitation, and that the real
reviewer's work-product prompt is owed.

## Gates

check-types · lint · vitest (**269 files / 2264 baseline**) · playwright.
