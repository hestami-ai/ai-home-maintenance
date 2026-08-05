# DESIGN — the §36 control-action mapping needs a provenance layer, because one of its rows is ratified and six are mine

**Date:** 2026-08-05 · **Status:** measured, ready to implement · **Follows:** REG-E-025 (`ac134b6a`), REG-F-032 (`20696b99`)

---

## 1. The trigger, and why it is not really about one value

`EXECUTION_FAILURE_CONTROL_ACTIONS` shipped as seven rows of authored judgement with the reasoning in comments.
Mid-session the `TOOL_FAILURE` row acquired `REQUEST_WAIVER`. Both gates caught the *spelling* (§37 says `WAIVE`;
the contract uses DOC-004 §11's `REQUEST_WAIVER`) — and **nothing caught, or could have caught, that the row's
membership had changed at all**, because there is no structure that distinguishes:

- an action present because the **corpus requires it**, from
- an action present because **someone added it**.

I flagged the value for the sponsor. That was the wrong shape of answer: the next edit to any of the seven rows
has exactly the same problem, and flagging values one at a time does not scale past the one I happened to notice.

**The general form: an authored governance table with no basis field is indistinguishable from a ratified one, and
its comments cannot fail.** This repository already solved that, one artifact over.

## 2. The solved precedent

`FindingAnnotation` carries `severityBasis: RATIFIED_* | AUTHORED`, `severityQuote`, and `severityRationale`, with
three locks in `doc004-conformance.test.ts`:

1. **Anti-laundering** — a `RATIFIED_*` claim must quote words that are **verbatim in the ratified corpus**
   (whitespace-normalized, never word-normalized).
2. **The inverse** — an `AUTHORED` row must carry **no quote**, so authority cannot be implied decoratively.
3. **The ratio, pinned as a number** — *"19 of 99 severities are ratified and 80 are authored"* — so the honest
   split cannot drift upward unnoticed.

That machinery exists and is proven. The §36 mapping simply does not use it.

## 3. What is actually ratified — measured, not assumed

**One row of seven.** RPH-EXE-008 (*Executable Invariant and Conformance Test Specification*) states the exhaustion
remedy set verbatim:

> **Then** the controller must not issue a fourth retry. It must select: change tactic; replan; escalate; reject;
> abandon.

That is `RETRY_EXHAUSTION`, and it is already referenced rather than copied (REG-F-032 fixed that). Both candidate
quotes verify against the normalized corpus.

**The other six are authored**, and saying so in a field is the whole deliverable — today they *look* exactly like
the ratified one.

## 4. A second question this answers: does the mapping stay inside the controller's menu?

§36's rule is *"Each failure class must map to permitted **control actions**"* — the controller's actions, which
DOC-002 §37 enumerates as **eighteen**. The contract enum is DOC-004 §11's **twenty-three**. So a mapping could
quietly reach for a §11 action that §37 never gave the controller, and nothing would notice.

**Measured: it does not.** Every action used is in §37, *including* `REQUEST_WAIVER` — which is §37's `WAIVE` under
the spelling §11 ratified. So the flagged value turns out to be **inside the controller's ratified menu after all**,
and the honest concern about it is not "is this action allowed" but "who chose it, and on what basis" — which is
exactly what §2's machinery records.

This containment becomes an assertion, with the rename named explicitly rather than hidden in a normalization.

## 5. Deliverable

- `EXECUTION_FAILURE_MAPPING` — the **single source**: per row `{ actions, basis, quote?, rationale }`.
  `EXECUTION_FAILURE_CONTROL_ACTIONS` is **derived** from it, not maintained beside it. (Two constants naming one
  governed set is the drifting twin this register has now caught three times, most recently in this very file.)
- The three locks from §2, applied to the mapping.
- The §37 containment assertion from §4.
- The split pinned: **1 RATIFIED / 6 AUTHORED**.

## 6. What this deliberately does not do

- **It does not settle whether `REQUEST_WAIVER` belongs on `TOOL_FAILURE`.** It makes the claim *auditable* — the
  row says AUTHORED, carries a rationale a sponsor can reject, and can never silently acquire ratified standing.
  Recording provenance is a repository act; deciding the governance content is not.
- **It does not mint §36.1/§36.3/§36.4/§36.5.** Still four families with no field to travel in (REG-E-025).
- **It does not add a per-ACTION basis.** Per row is the granularity the corpus states things at — RPH-EXE-008
  ratifies a *set*, not five independent permissions — and a per-action table would invite exactly the
  false precision the anti-laundering lock exists to prevent.
