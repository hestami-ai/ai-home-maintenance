# DESIGN — the professional's `outputContract` reaches the producer and the reviewer (`JAN-OUTCONTRACT`)

**Status:** design. **Date:** 2026-09-06.

---

## 1. The measured state

`PromptTemplate.outputContract` is authored through the PWA Designer form
(`routes/pwa/[id]/+page.server.ts:339`, `+page.svelte:517`), stored on the type, and **read by nothing**.

| Where it could be used | What happens |
|---|---|
| the rendered instruction | `assembleStepContext`'s closed list is `subject, title, description, statement, purpose, expectedOutputs, inputRequirements` — no `outputContract` |
| the reviewer's prompt | `judgePrompt` receives `criteria`, `prompt`, `content`, `narration`, `rationale`, `prior` — no `outputContract` |
| the floor | `schemaValid` is `splitAnswerSpan(answer).located` — parseable, nothing more |

⭑ **CONTROL — the threading mechanism works.** `expectedOutputs` travels handler → `InvocationSubject` →
`assembleStepContext` → rendered prompt. So this is a field left off a working conveyor, not a missing
capability. Every other `grep` hit for `outputContract` in `packages/` and `apps/` is a **comment mentioning
it**.

⚠ **This is the fifth authored-with-no-consumer field found in this programme's recent slices** —
`contextAssemblyPolicyId`, `retainsHistory`, `readReportedModel`, `contextSpecification.requiredElements`, and
now this. The pattern is worth naming even where each instance is fixed separately.

## 2. ⭑⭑ The obligation is the harness's OWN PROMISE, already written

`EXECUTION_CONTRACT_PROMPT` — the system prompt every executing model is given — opens:

> *"You will be given an instruction that states the work **and the exact output it requires**."*

⛔ **The assembly does not keep that promise.** The instruction states the required output only when the
template author happened to repeat it inside `templateText`. `outputContract` is the field where a professional
declares exactly that, and it never arrives. No new obligation is invented here — the harness already tells the
producer this will be present.

⚠ **AND THE FIELD'S OWN VOCAB NOTE MISCITES ITS AUTHORITY, which is worth correcting rather than repeating.**
The note reads *"What a conforming answer looks like, so a malformed one is INERT (`ASR-11`) rather than
interpreted."* `ASR-11` is *"Validator failure is not a verdict; invalid output is inert"*, and its **SCOPE**
is *"governs assurance-process failures and observation quality"* — it is about **validator** output, not the
producer's work product. The citation is a stretch. The honest grounding is §2's promise above, and it is
stronger, because it is a commitment this system already makes in writing to every model it invokes.

## 3. Where it belongs — and the boundary that decides it

`execution-contract.ts` states the rule in terms:

> ⛔ *"IT LIVES HERE, NOT IN THE TYPE'S PROMPT TEMPLATE. `REG-D-058` ruled the template is OWNED by the
> work-unit type and authored by a professional. The type says WHAT work; the harness says the EXECUTION
> CONTRACT. Injecting this into the template would silently edit someone else's contract."*

⭑ **That cuts both ways, and it settles the placement.** The harness must not inject into the type's
instruction — and equally, the **type's contract must not be injected into the harness's system prompt**, which
is set once per SESSION (`pi-executor.ts:88`, `systemPromptOverride`) and would then carry one type's contract
across every work unit that session touches.

So the output contract joins **the rendered instruction**, in `prepareModelInvocation`. Both `templateText` and
`outputContract` are the type's own content; assembling them is not a boundary crossing, it is the type
finally stating its whole requirement.

⭑ **AND THIS IS NOT A NEW CONTEXT SOURCE UNDER `CP-04`.** The instruction is `RENDERED_INSTRUCTION` at
`THIS_TRY` and remains so; the ceiling is unchanged and no policy needs widening. A reader coming from
`JAN-CTXPOL` will ask, so it is answered here.

## 4. The reviewer half

`ReasoningReviewInput` gains an optional `outputContract`. ⭑ It is a plain TS interface in `rph-assurance`,
absent from all three vocabulary files — so this is not a ratification act.

⛔ **RENDERED CONDITIONALLY, AND THAT IS DELIBERATE — the opposite of the rationale section.** `judgePrompt`
renders rationale and narration UNCONDITIONALLY because *"the reviewer's input shape never encodes whether the
producer said anything (§9.7 — presence or absence is never a signal)"*. That reasoning does not transfer: an
absent output contract is a fact about **the type's authoring**, not about the producer. Telling a reviewer
*"no output contract was declared"* invites a finding against a work product for a gap its author had no part
in — which is `ASR-11`'s **WHY** exactly: *"conflating evaluator breakage with subject failure punishes the
work for the harness."* So when there is no contract, the reviewer is told nothing and can manufacture nothing.

## 5. ⛔ What this does NOT do

- **`schemaValid` still means PARSEABLE.** A machine-checkable contract is a structured-vocabulary change and
  would need its own grant, exactly as `CONTEXT_ASSEMBLY_POLICY` did. The floor's disclosure at
  `work-product-floor.ts:62-67` stands unchanged and is still owed.
- **No seeded type declares an `outputContract`**, so — like `CP-04b` — the path is exercised by tests and
  dormant in the demo's data. ⚠ Authoring one to make the check fire would be inventing professional content to
  justify my own wiring, which is the seeded-policy-as-projection defect this register keeps recording.
- **The prompt budget is respected, not extended.** The contract is excerpted like every other slice
  (`MAX_AGY_PROMPT_CHARS` on the review side).

## 6. Decisions

| # | Decision | Recommendation |
|---|---|---|
| O-1 | Append to the instruction, or add `{outputContract}` as a declarable placeholder? | ⭑ **Append.** A placeholder is opt-in: a template that does not declare it still ignores the contract, so the harness's promise would remain unkept for exactly the templates whose authors forgot. |
| O-2 | Should a template with an `outputContract` and no mention of it in `templateText` be refused? | ⛔ **No.** That would make the two fields restate one another — and the whole point is that the field carries what the text need not repeat. |
| O-3 | Reviewer section conditional or unconditional? | **Conditional** — §4's reasoning. |
