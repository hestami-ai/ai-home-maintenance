# DESIGN — `JAN-NOANS`: a turn that yielded nothing is not a turn that answered badly

**Finding:** `REG-F-410` · **Date:** 2026-09-20 · **Status:** design only, nothing implemented
**Companion findings:** `REG-F-409` (the same class on the assurance plane), `REG-F-411`

---

## 1. What was measured

A live execution run was configured with `JPWB_EXECUTOR_MODEL=openai-codex/gpt-5.4-mini`. The provider refused
the model outright:

```
Codex error: The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account.
```

**No model ran.** What the record says happened instead, on all three exchanges:

| Field | Recorded value | What it asserts |
|---|---|---|
| `disposition` | `ACCEPTED` | the try was accepted |
| `parseOutcome.outcome` | `SCHEMA_COERCION_FAILED` | the producer's answer was malformed |
| `parseOutcome.detail` | *"The answer is not a JSON object…"* | the producer ignored its contract |
| `workProductDerivation.contentHash` | `sha256:e3b0c442…` | — the hash of the **empty string** |
| `ArtifactRecorded` ×3 | `byteSize: 0` | a professional work product exists |

Nine assurance assessments then ran over those zero-byte artifacts, and a live reviewer returned nine findings
at `CRITICAL` — *"The agent produced no output, failing entirely to discharge the delegated obligation"*.

⭐ **Every sentence in that judgement is defensible given its inputs. The judgement as a whole is fiction.**
Wall-clock confirms it independently: the three calls took **408ms, 458ms and 1.25s**.

---

## 2. Why it happened — four layers, each correct in isolation

1. `pi-executor.ts:265-274` accumulates its answer from `message_update` / `text_delta` **only**. A provider
   error emits no delta, so `answer` stays `''`.
2. `session.prompt()` resolves **without throwing**, so the turn looks successful.
3. `run-model-step.ts` has exactly **two** arms: a `catch` (`:310`, `disposition: 'rejected'`, `NOT_ATTEMPTED`)
   and a success path (`:398`, `disposition: 'accepted'` hardcoded). A call that *returns holding nothing*
   falls down the success path. There is no third arm.
4. `describeWorkProductDerivation(envelope)` (`execution-contract.ts:216`) is handed **only the parsed
   envelope, never the raw string**, so it is structurally incapable of asking "did any bytes arrive?" — it can
   return only `PARSED` or `SCHEMA_COERCION_FAILED`.

⛔ **The defect is not a missing vocabulary member.** `EMPTY_RESPONSE` has been in
`ExchangeParseOutcomeSchema` all along (`objects.ts:291-301`) and `NO_RESPONSE` in the `MODEL_EXCHANGE`
disposition enum (`objects.ts:1025`). It is **a classifier never given its input, and a disposition never
derived.**

### 2.1 The assurance plane already gets this right

`reasoning-review-validator.ts:302-313` asks the question first, and its docblock states the whole argument:

> *"THE THREE FAULTS HAVE THREE DIFFERENT REMEDIES … an empty response is an INFRASTRUCTURE OR BUDGET
> problem, prose is a PROMPT problem, and well-formed JSON of the wrong shape is a CONTRACT problem.
> Collapsing them loses the only thing the record was kept for."*

**The execution plane never asks it.** One plane has the instrument; the other has the same hazard and no
instrument.

---

## 3. ⭐⭐ The finding that decides the architecture

Three independent designs were produced — remedy at the **adapter**, at the **classifier**, at the **record** —
and three independent adversarial passes were run against them. **All three refutations found the same defect
first, and it was not the defect any of the designs was looking for.**

> **None of them distinguishes *"the provider refused"* from *"the model answered with nothing."***

Writing `EMPTY_RESPONSE` with the detail *"The model returned no bytes at all"* for a model that **was never
invoked** is a claim about a model that does not exist. That is `REG-F-410`'s own class, one level down, inside
the record that was supposed to fix it.

⛔ **And the repository already refutes it in the adjacent field.** `observed-tool-calls.ts:95-102` grades the
same turn `NONE_OBSERVED` — *"This adapter observes tool calls and observed none on this try … and the model
called nothing on it."* On this path no model ran, so that is an absence wearing a measurement's words. The
record cannot be internally consistent while one field says *"nothing was in a position to look"* and the next
says *"the model produced nothing."*

⭑ **Therefore the ordering is a design constraint, not a preference.** A downstream-only remedy — at the
classifier, at the recorder, at the artifact gate — is strictly better than today **and ships a second false
record in the same reachable case.** Any of them may be *implemented* later; none may land *first*, and none
may be described as closing `REG-F-410`.

### 3.1 The distinction is available and is being thrown away

`node_modules/@earendil-works/pi-ai/dist/types.d.ts:286-287` and `:333-334`:

```
stopReason: StopReason;
errorMessage?: string;
...
 * - `error` carrying the final AssistantMessage with stopReason "error" or "aborted"
 *   and errorMessage.
```

⚠ **A tempting one-line fix does NOT work, and the reason matters.** Adding `else if (e.type === 'error')` to
the existing `message_update` handler would never fire: `pi-agent-core/dist/agent-loop.js:209-227` forwards
only the nine streaming deltas as `message_update`, and `:228-242` routes **both** `done` and `error` through
`message_end`. The reachable discriminator is `message_end`, not a delta.

**So the provider's own sentence — the one that identifies the fault in a single line — is sitting in the
adapter's event stream and is discarded before anything can record it.**

---

## 4. The design

### 4.1 `D-1` — the adapter reports a typed outcome, never a bare empty string ⭐ MANDATORY FIRST

`ToolInvocationResult.answerText: string` (`backing-tool.ts:154`) **cannot carry this distinction** — every
"nothing happened" collapses to `''`. It gains a no-answer arm.

⭑ **The precedent is in the same interface, eight fields down.** `AdapterToolObservation` is a **union**, and
its docblock says exactly why: *"a shape with an optional list would let a caller read `calls` off an adapter
that cannot observe, and the value it would read — the empty list — is the one that reads as a clean bill of
health while asserting nothing at all."* `answerText: ''` **is** that empty list. The fix is to apply the
ruling the interface already contains to the field that did not get it.

The adapter distinguishes three facts it genuinely holds:

| What the adapter saw | Fact |
|---|---|
| `message_end` with `stopReason: 'error' \| 'aborted'` + `errorMessage` | **no model produced anything; here is the provider's sentence, verbatim** |
| turn ended normally, zero text deltas | the model ended its turn having said nothing |
| `session.prompt()` threw | the existing `catch` arm, unchanged |

⛔ **The provider's message is carried verbatim, never paraphrased** — this repository's standing rule that a
tool's own words are the record, not a gloss written from an id.

### 4.2 `D-2` — the step derives its disposition instead of hardcoding it

`run-model-step.ts:414`'s literal `'accepted'` becomes a derivation over `D-1`'s typed outcome. A third arm
records the no-answer case.

⭐ **No contracts change, and this was verified rather than assumed.** What blocks `NO_RESPONSE` today is
**app-local**: `ExchangeDisposition` (`exchange-record.ts:44`) has four members, and `DISPOSITION`
(`exchange-recorder.ts:59-64`) is an `as const` map with four keys, indexed at `:222`. Adding a fifth member
makes the missing map entry a **`check-types` failure**, so the wiring cannot be half-done.

⚠ **`NO_RESPONSE` is currently reachable only as a fallback for an *absent* disposition** (`:222`), while
`captureTry` requires one (`exchange-capture.ts:81`) — so it is unreachable as a decision. The moment it
becomes one, that fallback becomes an absence-as-value in its own right and must go. **Filed as part of this
design, not discovered later.**

### 4.3 `D-3` — nothing downstream may treat a non-answer as a work product

Fail closed, in order of the harm each prevents:

- no zero-byte artifact is recorded (measured: three were);
- no assurance floor runs over one (measured: nine did);
- no zero-byte object is written to the content plane under a **retaining** class.

⛔ **Sequencing is load-bearing.** `run-model-step.ts:380`'s `store.put` sits **outside** the try/catch at
`:295-363`. A content-plane refusal landing *before* `D-2` would 500 the route and record **nothing** — making
the one try that broke the run the one try with no evidence, which is the original defect inverted. `D-3`
lands with or after `D-2`, never before.

### 4.4 `D-4` — the class, not the instance

The shape is not one adapter's. **Three** production seams build an answer that cannot distinguish absence
from emptiness:

| Seam | How it fails |
|---|---|
| `tools/pi-executor.ts:239-311` | accumulates `text_delta` only; ignores `message_end` |
| `tools/devin-reviewer.ts:61-127` | `execFile` resolves on exit 0; exit 0 + empty stdout is indistinguishable |
| `assurance/agy-cli.ts:72-117` | same, returning a bare `string` |

✅ `execution/model.ts:27-44` (`deterministicExecutionPrint`) cannot be empty — **which is exactly why the gate
never caught this.** The only executor the gate runs is the one adapter immune to the defect.

⭑ `agent/pi-agent.ts:112-199` **fails safe** and is the model to copy: it emits `{kind:'error'}` on the catch
and `{kind:'done'}` only on success. The authoring plane got this right; the execution plane did not.

---

## 5. What this design refuses to do

Each was proposed by one of the three candidate designs and refuted against the files.

1. ⛔ **Do not write *"The model returned no bytes at all"* on the refusal path.** It is false when no model
   ran. §3.
2. ⛔ **Do not hoist `produced.identityEvidence` into the new arm.** `pi-executor.ts:300` hardcodes
   `PROVIDER_REPORTED`; the record would assert the provider *confirmed* the model it actually *refused*. The
   `catch` arm's weaker `{modelId, providerId}` is the correct shape and is already in the file (`:316`).
3. ⛔ **Do not pass `rawOutput: ''` to `captureTry`.** `exchange-capture.ts:214` → `splitAnswerSpan('')` →
   `located: false` → three refs whose reason explains that *"retaining the blob whole would classify reasoning
   as participating…"*. There is no blob. The fixed record would explain an absence with a sentence about a
   different fact. ⚠ Pre-existing on the `catch` arm — **filed, and not made a second time.**
4. ⛔ **Do not touch `mock-reasoning-review-validator.ts:248-256`.** One design claimed it returns
   `unreadable`; it does not — it pushes a `BLOCKING` `RR-04` finding, pinned by
   `mock-reasoning-review-validator.test.ts:187-192`. Changing it would replace a substantive judgement with
   *"could not read"* — **weakening an assertion to accommodate a change**, which is forbidden.
5. ⛔ **Do not claim this closes the reviewer class.** A work product of `" "`, `"{}"` or `"TODO"` is still
   delegated, and a live reviewer will still produce confident findings over it. *A reviewer judges whatever it
   is handed* survives this design intact.

---

## 6. Guards, and the fact that the vocabulary is untested

`EMPTY_RESPONSE` and `NO_RESPONSE` appear in **zero** `*.test.ts` files in this repository. So even the
assurance plane's correct behaviour is unguarded, and the members this design makes reachable would arrive with
no pin at all.

⭑ **A hand-written test for each member is the same defect one level up** — it closes the two members someone
remembered. The guard is **derived from the contract's own union**, the idiom this repository already uses to
turn a missing arm into a compile error: a `Record<Disposition, …>` in which every member either names a path
that **actually drives it** or states, in the record, why it has no producer.

⚠ **Its honest limit:** the "no producer" arm is an escape hatch, and a lazy author can close a new member with
a sentence instead of a driver. That is a *disclosed* absence rather than a silent one — visible in review —
but it is a hatch, and naming it here is better than having it found.

---

## 7. Open — the sponsor's call, not mine

1. ⚠ **The `catch` arm records `disposition: 'rejected'` for a transport failure** (`run-model-step.ts:319`) —
   a producer-fault disposition on a fault the producer did not commit. `'no-response'` fits it better, and the
   ratified vocabulary note for `NO_RESPONSE` names *"a timeout or abort"* as its referent. **But it changes
   `run-model-step.test.ts:193`'s passing `expect(...).toBe('REJECTED')`**, so it must be argued, not slipped
   in alongside a fix it is merely adjacent to.
2. ⚠ **Should the content-plane `put` refuse empty bytes, or should callers gate?** Refusal at the port is the
   stronger guarantee and a **breaking change to a port with two adapters and every caller**. An audit of the
   five call sites found all currently safe — *an audit is not a type*.
3. ⚠ **Retry.** Today an empty answer loops on fabricated findings; after `D-2` it fails on first occurrence.
   For a refusing provider that is right. For an *intermittent* empty stream it is a loss of recoverability.
   Retrying a refusing provider is a **billing** decision, not a record decision, and is not proposed here.

---

## 8. Exit

The live lane is driven with a model the provider refuses, and the record says **a model was configured that
this provider would not run, in the provider's own words** — with no artifact recorded, no floor run, and no
reviewer asked to judge something that does not exist.

⭑ **The control is the run that already passes:** the same lane on `gpt-6-astra` must stay green and
byte-identical in its record, or the gate has learned to refuse real work.
