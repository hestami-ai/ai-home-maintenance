# DESIGN — JAN-EXEC Phase 7, P7-8: the answer is the whole JSON text when it is one, and "parseable" means it parses

**Programme:** `JAN-EXEC` Phase 7, after P2. It answers `REG-F-557`, under the sponsor's ruling `REG-D-108`: *"Fix REG-F-557, then P3"*.
**Status:** DESIGN, 2026-10-11.

## 1. The defect, as driven

- **The rule.** `splitAnswerSpan` and `extractJson` (`apps/rph-demo/src/lib/server/assurance/agy-cli.ts`) look first for a fenced block anywhere in a model's text. If they find one, they take what is inside it as the answer.
- **Where it bites.** The work-product floor's schema fact is that span's `located` (`execution/work-product-floor.ts:84`).
- **P2: a false refusal.** Six of the seven work products were valid JSON objects, each with a markdown document holding a code block. Each was read as its first code block's contents, so `floor.schema-invariant` refused it as `SCHEMA_INVALID`. That stopped three of the four phases.
- **The first measured run: a false pass.** Its design work product was read as a 126-character TypeScript type inside a fence. That span has a brace pair, so the floor was SATISFIED on a fragment that is not JSON.
- **The record, too.** The execution exchange keeps no answer bytes when no span is located (`REG-D-056`). So P2's refused answers are unreadable.

## 2. The fix

- **AS1. The whole text first.**
  - `extractJson` and `splitAnswerSpan` first try the whole trimmed text. If it parses as a JSON object, that object is the answer. `splitAnswerSpan` then reports it located, with the surrounding whitespace as its prefix and suffix, so `prefix + answer + suffix === raw` still holds.
  - Only when the whole text is not a JSON object do they take today's path: the first fence, then the outermost braces.
  - The pinned equivalence holds: when the span is located, `splitAnswerSpan(raw).answer === extractJson(raw)` (`REG-F-339`).
- **AS2. "Parseable" means it parses.** The work-product floor's schema fact becomes: the span is located, and the located span parses as JSON.
  - Today it is only that the span is located, which the floor's own comment calls "locatable". That is how a brace pair in a TypeScript type passed.
  - The violation code stays `WORK_PRODUCT_NOT_PARSEABLE`, and now it says what it means.
  - A machine-checkable output contract is still owed, as the comment records.
- **AS3. The qualification harness follows.**
  - `scripts/reviewer-qual/malformations.ts` reads replies through `splitAnswerSpan`, so it follows AS1 by construction. Its own copy of the fence expression is checked against the product's.
  - **What re-scoring would change: nothing recorded.** None of the 522 recorded reviewer replies holds a fence pair (counted from `runs.ndjson`), so no recorded extraction changes.
  - `reviewer:qual:check` must stay GREEN. If the scoring digest moves, that is a scoring-only move, which RESCORED lines discharge with no model call.

## 3. What must turn red first

1. **A P2-shaped work product passes.** The fixture is a JSON object whose document string holds a fenced block. The schema floor must be SATISFIED; at HEAD it is REJECTED.
2. **A design-shaped work product is read whole.** The fixture is a JSON object whose document holds a fenced TypeScript type. `splitAnswerSpan(...).answer` must be the whole object; at HEAD it is the fragment.
3. **Prose with a fenced brace pair is refused.** The fixture is a work product that is markdown prose holding a fenced `{ help: boolean }`. The schema floor must be REJECTED; at HEAD it is SATISFIED (AS2).
4. **A reviewer reply quoting code is read whole.** The fixture is a judgement JSON whose statement holds a fenced snippet. `extractJson` must return the whole object; at HEAD it returns the snippet.
- **Controls that stay green:**
  - a reply wrapped in a ```` ```json ```` fence is still extracted;
  - prose then JSON with no fence reads as today;
  - the `REG-F-339` equivalence pin holds;
  - the execution exchange for a P2-shaped answer now keeps its answer span (`REG-D-056`, separable).

## 4. Then P3

- **The tree.** From the main checkout at the commit that carries the fix, after a dry run.
- **The run.** The measured run once more, and P7-4's checks with it.
- **The budget.** About 45 reviewer calls, within the sponsor's 230 (`REG-D-108`); 174 are spent.
- **What it should show.** Whether all four phases complete. Two command reviews in P2 concluded against the work, one in requirements and one in end-to-end, so those two phases may still stop on their reviews. If they do, the run plan's rule handles them, and P7-4f judges whether each review was right.
