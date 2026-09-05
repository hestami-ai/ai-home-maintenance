# DESIGN — a work unit that actually runs: executing a MODEL_INVOCATION step

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-05 · **Programme:** `JAN-EXECRUN`
**Follows:** `REG-D-058` / `REG-F-350` (the type owns a prompt), `JAN-MXREAD` (the record is readable)
**Answers:** the sponsor's *"a PWA actually could not truly run and do real work."*

---

## 1. There is no boundary here, and I nearly deferred to one

An audit of this repository reported that *"the register records that this system governs plans and hosts no
tool invocation, and allocates actually running things to a platform layer that does not exist yet,"* and
recommended the sponsor decide whether that boundary still holds.

**Searched at HEAD, and the corpus says the opposite.**

- **Guide `:1137`, verbatim:** *"An **Execution Step** is temporal machinery: **model/tool invocation**,
  retrieval, transformation, human interaction, wait, branch, parallel group, or assurance invocation."*
  ⭑ A step **is** the invocation. That is the ratified definition of the thing.
- **`StepTypeSchema`** (`packages/rph-contracts/src/enums.ts:770-780`) has **`MODEL_INVOCATION` as its first
  member**, generated and in the contracts today.
- **Searched both directions:** `"hosts no"`, `"platform layer"`, `"does not execute"`, `"no tool invocation"`
  → **0 in DOC-003, 0 in the Guide, 0 relevant in the register.** *(Positive control, same instrument:
  `"execution"` → 26 in DOC-003, 118 in the Guide, so the corpus is being read.)*

⚠ **The audit's sentence was a paraphrase, not a quotation, and it would have cost a sponsor round-trip.**
No ruling is needed. The caller is unbuilt, not forbidden.

## 2. What exists, and the one honest sentence about it

`stepType` is mentioned in 37 places in shipped code and **exactly two branch on it**: one copies it to a
string (`handlers/execution.ts:111`), one tests for `BRANCH` (`transition-gate.ts:778`). **Neither runs
anything.**

The demo's execute button (`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:875-948`) fires eleven
commands: shape → ready → propose a plan with one `TRANSFORMATION` step → approve → activate → start →
complete with `noOutputResult: NO_DOWNSTREAM_CONSUMABLE_RESULT`. ⭑ **It is honest about this in its own
comment** — *"the demo shows the lifecycle, not artifact authoring"* — which is why this is a gap to fill
rather than a lie to correct.

## 3. Design

**Execute one `MODEL_INVOCATION` step, on a PWU whose type carries an ACTIVE prompt template.**

Between `StartExecutionStep` and `CompleteExecutionStep`:

1. **Resolve the template.** PWU → `pwuTypeId` → `promptTemplate`. Absent or `DRAFT` ⇒ the step is not a model
   invocation; fall back to today's behaviour and say so. **No silent substitution of a default prompt** —
   that would be the seeded-policy-as-projection defect this repository already records.
2. **Assemble context** from the PWU's own fields, keyed by the template's declared placeholders.
3. **Render** via `renderPromptTemplate`. A missing or undeclared placeholder **REFUSES** (sponsor, 2026-09-04)
   and the step fails with the refusal as its reason — a failure that names its cause, not a silent skip.
4. **Call the model** through the same injected seam the assurance path uses, so the gate never spawns a
   subprocess and a live run is a configuration rather than a code path.
5. **Record the `MODEL_EXCHANGE`** with `plane: 'EXECUTION'`, `subjectObjectId` = the PWU, and
   `promptTemplateFingerprint` resolved to `<pwuTypeId>@v<n>`. ⭑ **Every field of that record was built for
   this and has never had an execution-plane run to record.**
6. **Record the answer as an `ARTIFACT`** and complete the step with `outputArtifactIds: [id]` instead of
   `noOutputResult`.

### 3.1 ⚠ The consequence this design must not hide

The demo's comment says the step is *"Non-AI (TRANSFORMATION + HUMAN operator), so the floor gate admits it."*
⭑ **Making the step AI-executed is exactly what makes assurance bite** — an AI-produced output is what the
assurance floor exists to judge. That is the system working, not an obstacle:

- The step's `executionProvenance` must name the model as executor, not the human operator. Recording a human
  for work a model did is the fiction `REG-F-062`'s neighbourhood already records.
- If a floor then blocks the PWU, **that is the correct outcome** and the surface must say why rather than
  routing around it.

**This design does not weaken any gate to make the demo pass.** If the honest path blocks, the finding is the
deliverable.

## 4. Boundaries

1. **One step, one model call.** No branching, no parallel groups, no retries beyond what the plan already
   declares.
2. **No new command or event.** `StartExecutionStep`, `CompleteExecutionStep`, `RecordArtifact` and
   `RecordModelExchange` all exist.
3. **No context-assembly editor.** `constraintDispositions` still has no constraints to point at
   (`REG-F-350`); context is assembled from the PWU's own fields and the omission is disclosed.
4. **No read-authority mechanism** (`REG-Q-077`), **no new vocabulary values** (`REG-Q-056`), no CSAA.

## 5. Open question, asked now rather than discovered

**Which model runs an execution step?** `RUNTIME_BINDING.modelSelectionPolicy` is the ratified slot and is an
ungrounded string today. **Recommendation: reuse the assurance path's resolution for this increment** — the
same host configuration, the same refusal when nothing is configured — and leave `modelSelectionPolicy` for
the increment that gives runtime bindings an editor. Inventing a selection vocabulary now would walk through
`REG-Q-056`'s door for no gain.
