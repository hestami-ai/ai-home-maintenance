# ROADMAP — `JAN-NOANS`: a turn that yielded nothing is not a turn that answered badly

**Design:** `DESIGN-no-answer-is-not-an-answer.md` · **Date:** 2026-09-20 · **Finding:** `REG-F-410`

⭑ **Exit:** the live lane is driven with a model the provider refuses, and the record names *that* — in the
provider's own words — with **no artifact recorded, no floor run, and no reviewer asked to judge something that
does not exist**. ⭐ **The control is the run that already passes**: the same lane on `gpt-6-astra` stays green
and its record stays byte-identical, or the gate has learned to refuse real work.

⛔ **`NA-01` AND `NA-02` LAND FIRST, AND THAT IS A DESIGN CONSTRAINT RATHER THAN A PREFERENCE.** Three
independent adversarial passes each found the same defect in each of three candidate designs: a
downstream-only remedy records *"The model returned no bytes at all"* for a model that was never invoked —
`REG-F-410`'s own class, one level down, inside the record meant to fix it. Nothing below `NA-02` may land
before it, and no increment below may be described as closing `REG-F-410`.

---

### `NA-01` — the adapter reads the terminal event it is already subscribed to

`pi-executor.ts`'s `turn()` handles `message_update` only. Add `message_end` and read `stopReason` /
`errorMessage`.

⚠ **`else if (e.type === 'error')` on `message_update` WOULD NEVER FIRE** — `pi-agent-core/agent-loop.js:209-227`
forwards only the nine streaming deltas there, and `:228-242` routes **both** `done` and `error` through
`message_end`. Anchor on `message_end`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| handle `error` on `message_update` instead of `message_end` | the refusal test — the fixture emits the SDK's real event order and nothing is observed |
| paraphrase the provider's message instead of carrying it verbatim | the verbatim test — the recorded sentence must be the provider's, not a gloss |
| treat `stopReason: 'aborted'` as a normal empty turn | the abort test — an abort is not a model that chose silence |
| **CONTROL** | a normal turn that legitimately produces no text is still reported as *the model said nothing*, NOT as a refusal — `NA-02` |

---

### `NA-02` — `ToolInvocationResult` gains a no-answer arm, because `answerText: ''` cannot carry the fact

⭑ **The precedent is eight fields down in the same interface.** `AdapterToolObservation` is a union because
*"a shape with an optional list would let a caller read `calls` off an adapter that cannot observe, and the
value it would read — the empty list — is the one that reads as a clean bill of health while asserting nothing
at all."* `answerText: ''` **is** that empty list.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep `answerText: string` and signal with a sibling boolean | the discrimination test — a caller can still read `''` as an answer without consulting the flag |
| collapse *provider refused* and *model said nothing* into one member | ⭐ the two-facts test: they have different remedies and must not share a member |
| make the no-answer arm optional rather than a union member | the fail-closed test — an absent field reads as "fine" |
| **CONTROL** | a real answer round-trips unchanged; `gpt-6-astra`'s 1144-byte envelope is byte-identical |

---

### `NA-03` — the step derives its disposition instead of hardcoding `'accepted'`

`run-model-step.ts:414`'s literal becomes a derivation over `NA-02`'s union. `ExchangeDisposition`
(`exchange-record.ts:44`) gains a fifth member; `DISPOSITION` (`exchange-recorder.ts:59-64`) gains its key.

⭐ **No `packages/rph-contracts` change and no `gen:check` involvement** — `NO_RESPONSE` is already in the
ratified enum (`objects.ts:1025`). The block is app-local, and because `DISPOSITION` is an indexed `as const`
map, a missing entry is a **`check-types` failure**: the wiring cannot be half-done.

⛔ **The `:222` fallback (`rec.disposition ? … : 'NO_RESPONSE'`) MUST GO in this increment.** The moment
`NO_RESPONSE` becomes a decision, a fallback that also emits it makes a decided value indistinguishable from
an omission — the finding, reintroduced by the fix.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| restore the hardcoded `'accepted'` | the disposition test — a no-answer try is not an accepted try |
| leave the `:222` fallback in place | ⭐ the omission test — an absent disposition must not be reported as a decided `NO_RESPONSE` |
| hoist `produced.identityEvidence` into the new arm | the identity test — `PROVIDER_REPORTED` for a provider that refused the model is a false record |
| pass `rawOutput: ''` into `captureTry` | the §9.7 test — the refs must not explain an absence with the *"retaining the blob whole"* sentence; there is no blob |
| **CONTROL** | the existing `catch` arm is untouched and `run-model-step.test.ts:193` still reads `REJECTED` (see `OPEN-1`) |

---

### `NA-04` — nothing downstream may treat a non-answer as a work product

No zero-byte artifact recorded (**measured: three were**); no assurance floor run over one (**measured: nine
were**); no zero-byte object written to the content plane under a retaining class.

⛔ **SEQUENCING IS LOAD-BEARING.** `run-model-step.ts:380`'s `store.put` sits **outside** the try/catch at
`:295-363`. A content-plane refusal landing before `NA-03` would 500 the route and record **nothing** — the one
try that broke the run becoming the one try with no evidence, which is the original defect inverted. `NA-04`
lands with or after `NA-03`, never before.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| record the artifact anyway | the artifact test — `sha256:e3b0c442…` (the empty string) must never appear as a work product |
| run the floor and let it report `SATISFIED` | the floor test — a floor may not assess a subject that does not exist |
| run the floor and let it report `REJECTED` | ⭐ the sharper one: a producer-fault verdict is as false as a pass |
| land this before `NA-03` | the evidence test — the failing try must still produce a record |
| **CONTROL** | `gpt-6-astra`'s 572-byte work product is still stored, still assured, still `SATISFIED` |

---

### `NA-05` — the other two adapters, because the shape is the class

| Seam | How it fails today |
|---|---|
| `tools/devin-reviewer.ts:61-127` | `execFile` resolves on exit 0; exit 0 + empty stdout is indistinguishable from an answer |
| `assurance/agy-cli.ts:72-117` | same, returning a bare `string` |

⭐ **`execution/model.ts:27-44` is why the gate never caught this**: `deterministicExecutionPrint` cannot return
empty, so the only executor the gate runs is the one adapter immune to the defect. ⭑ `agent/pi-agent.ts:112-199`
already fails safe and is the model to copy.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| fix `pi-executor` only | ⭐ the generality test — driven per adapter, derived from the seam list, never hand-enumerated |
| treat exit 0 + empty stdout as an answer | the CLI-adapter test, once per CLI adapter |
| **CONTROL** | the deterministic executor is unchanged and every existing gate test still passes |

---

### `NA-06` — the vocabulary guard, derived rather than hand-listed

`EMPTY_RESPONSE` and `NO_RESPONSE` appear in **zero** `*.test.ts` today. A test per member closes the members
someone remembered — the hand-listing defect one level up. Instead: a `Record<Union, …>` keyed on the
**contract's own union**, where each member either names a path that actually drives it or states why it has no
producer.

⚠ **Disclosed limit:** the no-producer arm is an escape hatch. A lazy author can close a new member with a
sentence instead of a driver. That is a *disclosed* absence rather than a silent one — but it is a hatch, and
it is named here rather than discovered later.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| add a member to the contract enum | ⭐ **a compile error**, not a runtime skip |
| have a `drive` return a payload NOT carrying its member | the driver test — naming a path is not driving it |
| replace a real driver with a `unreachable` sentence | the hatch test — the arm must state a reason a reviewer can check |

---

### `NA-07` — the live control

Drive the lane twice: once on a model the provider refuses, once on `gpt-6-astra`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| any increment above, reverted | the refusal run — the record must not blame the producer |
| a gate that refuses on emptiness alone | ⭐ the `gpt-6-astra` run — it must stay green; a guard that reddens on real work is worse than the defect |

---

## Not in scope, and said here so no one reads it as done

- ⛔ **The reviewer class is NOT closed.** A work product of `" "`, `"{}"` or `"TODO"` is still delegated, and
  a live reviewer will still produce confident findings over it.
- ⛔ **`REG-F-408` is untouched.** The same criteria came back `CRITICAL` in one review and `BLOCKING` in two
  others on near-identical artifacts. This fixes the fabricated-**input** half; the unstable-**judgement** half
  is separate.
- ⚠ **`+page.server.ts:1285`** returns `fail(400)` on `!ran` *before* `joinProcessEvidence` (`:1408`), so
  commands the model ran before the transport died are never joined into governed evidence. Pre-existing;
  `NA-03` routes a second case down it. Fix in this increment or file it — do not leave it silently widened.

## OPEN — the sponsor's, not mine

1. **`OPEN-1`** — the `catch` arm records `disposition: 'rejected'` for a transport failure
   (`run-model-step.ts:319`): a producer-fault disposition on a fault the producer did not commit.
   `'no-response'` fits, and the ratified vocabulary note for `NO_RESPONSE` names *"a timeout or abort"* as its
   referent. **It changes `run-model-step.test.ts:193`'s passing assertion**, so it is argued, never slipped in.
2. **`OPEN-2`** — should the content-plane `put` refuse empty bytes, or should callers gate? Refusal at the
   port is the stronger guarantee and a breaking change to a port with two adapters and every caller. All five
   call sites audited safe — *an audit is not a type*.
3. **`OPEN-3`** — retry. After `NA-03` an empty answer fails on first occurrence instead of looping. Right for
   a refusing provider; a loss of recoverability for an intermittent empty stream. Retrying a refusing provider
   is a **billing** decision, not a record decision, and is not proposed.
