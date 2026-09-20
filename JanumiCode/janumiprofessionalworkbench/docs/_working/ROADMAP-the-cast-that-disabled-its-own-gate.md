# ROADMAP — `JAN-ASSERTED`: the boundary asserted what it was supposed to check

**Design:** `DESIGN-the-cast-that-disabled-its-own-gate.md` · **Date:** 2026-09-20 · **Finding:** `REG-F-411`
**Sponsor rulings:** `R29` (stop supplying `{expectedOutputs}`), `R30` (parse the projection at the boundary)

⭑ **Exit:** a professional's instruction never contains `[object Object]`; a template declaring a placeholder
the work unit cannot supply is **REFUSED** rather than rendered empty; and the invocation subject is built by
parsing a stored object against its own contract. ⭐ **The control is the live lane** — `gpt-6-astra` must still
produce a work product and still satisfy all three floors.

⛔ **`AS-01` MUST LAND FIRST, AND NOT FOR TIDINESS.** Three suites build their PWU from a literal the store
**rejects at write**, so every later increment measured against them would be measured against an object that
cannot exist. The suite that should have caught this was blind because of its FIXTURE, not its assertion.

---

### `AS-01` — the fixtures stop describing a PWU the store cannot hold

Measured through the real engine + SQLite adapter: `ProposePwu` with `expectedOutputs: ['a viability finding']`
is `VALIDATION_FAILED` — *"expected record, received string"* — and nothing persists.

Affects `execution-invocation.test.ts:14`, `run-model-step.test.ts:38`, `no-answer-is-not-an-answer.test.ts:37`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep a `string[]` fixture | ⭐ the storability test — a fixture must describe an object the store would accept |
| make the store accept strings | the contract test — `OutputDefinitionSchema` is the write gate, not the fixture's convenience |
| **CONTROL** | every assertion those three suites already make still passes on the corrected fixture |

---

### `AS-02` — the red test drives a REAL store, because a literal cannot hold the laundered type

New `packages/rph-application/src/execution-invocation-projection.test.ts`, on the
`handlers/assumption-falsification.test.ts` harness pattern (`SqliteStorageAdapter` + `Engine` +
`testAuthenticator`).

⚠ **A pure-function suite CANNOT express this red.** A hand-built fixture can only ever carry the type the
author asserts; the defect is that the STORED shape differs from the asserted one. Only a real write-then-read
reproduces it.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| build the subject from a literal instead of a stored PWU | ⭐ the whole point — **measured**: the stored path returns `"expectedOutputs":"[object Object]"` |
| assert only that the prompt is non-empty | the value test — assert the rendered text, never merely its existence |
| **CONTROL** | a well-formed stored PWU resolves and renders; *"refuse everything"* must not pass |

---

### `AS-03` — `R29`: `{expectedOutputs}` stops being supplied, and the DEC-4 refusal becomes reachable

`execution-invocation.ts` supplies no value for `{expectedOutputs}` until `OutputDefinition` is ratified.

⭐⭐ **THIS RESTORES A SPONSOR-RATIFIED RULE; IT DOES NOT MINT ONE.** `JAN-PROMPT`'s sponsor default #2,
accepted 2026-09-04 under `REG-D-058`: *"A missing declared placeholder at render time is a **REFUSAL**, not a
disclosed gap."* `prompt-render.ts:66-71` implements it and `execution-invocation.test.ts:79-86` pins it. ⛔
**`?? []` defeated it at the only production call site** by turning ABSENT into PRESENT-BUT-EMPTY — a ratified
rule, a live guard and a green test, all made unreachable by four characters in a route.

⚠ **THE COST IS IN SCOPE, NOT A CONSEQUENCE TO DISCOVER:** four templates in this repository declare
`{expectedOutputs}` and are rewritten in this increment.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| restore `?? []` | ⭐ the DEC-4 test — the refusal must fire on a genuinely absent field |
| supply `''` instead of omitting | the same test: empty is not absent |
| leave a template declaring `{expectedOutputs}` | the template test — a declared placeholder nothing supplies is a refused render |
| **CONTROL** | `outputContract` still reaches the instruction, so the producer is still told what output is required |

---

### `AS-04` — `R30`: `resolveInvocationSubject` parses the projection against its contract

In `packages/rph-application`, mirroring `resolveContextAssemblyPolicy`: refuses on absence **and on shape**.
Replaces eleven assertions across two objects, the `as PromptTemplate` at `+page.server.ts:991`, and both
`getObject` calls with `getObjectOfType`.

⛔ **IT LIVES IN `packages/`, NOT THE ROUTE** — `bun run boundary` cruises `packages` only, so a resolver in
`apps/` would sit outside the gate that governs it.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| assert instead of parse | ⭐ the shape test — a stored row that does not parse must REFUSE, not proceed |
| refuse on absence only, not on shape | the same test — *"the same failure wearing a better disguise"* |
| keep `getObject` | the type-blind test — an id from the request must not select an object of any type |
| put the resolver in `apps/` | `bun run boundary` — it must sit inside the gate |
| **CONTROL** | ⭐ a well-formed stored PWU resolves; a parse that refuses everything must not pass |

---

### `AS-05` — the type is corrected, which re-arms `check-types`

`InvocationSubject.expectedOutputs` / `.inputRequirements` stop being `readonly string[]`.

⛔ **ENTAILED BY `AS-04`, NEVER SHIPPED ALONE, AND THE REASON IS MEASURED.** Correcting the type reddens the
cast (`TS2322`) — but `.join(', ')` on `readonly OutputDefinition[]` **still compiles**, because
`Array.prototype.join` accepts any array. Alone this ships green and still prints `[object Object]`, while
*looking* like the gate did its job. That is the more dangerous of the two half-remedies.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| restore `readonly string[]` + the cast | `check-types` — **measured `TS2322`** when the parsed type meets the old interface |
| retype the cast to `as OutputDefinition[]` | the assertion test — it still ASSERTS; `AS-04` removed the need for one |
| **CONTROL** | `bun run check-types` is GREEN after the remedy — re-arming the gate must not leave it red |

---

### `AS-06` — the `exchangeId` limb, which only a contract parse reaches

`reviewer-answer.ts:57` asserts `as unknown as ResolvableExchange`; `handlers/model-exchange.ts:344`
destructures `exchangeId` out; `ModelExchangeSchema` neither declares nor accepts it. **Measured:**
`view.exchangeId` is `undefined`, and the string reaches a user via `pwa/[id]/+page.server.ts:262`.

⭐ **A FIELD-NAME-VS-SCHEMA INSTRUMENT CANNOT SEE THIS**, because the field exists in no schema. That is why it
is in this roadmap: it is the class the derivation could not derive.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| restore the assertion | ⭐ `floor-recording.test.ts` — `exchangeId` must match `/^mex/`, **measured red today** |
| assert only `Object.keys(view).sort()` | the value test — nine tests pass today because a key whose value is `undefined` still counts |
| **CONTROL** | the other nine assertions in that suite still pass |

---

### `AS-07` — the live control

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| any increment above, reverted | the live instruction — it must not contain `[object Object]` |
| a refusal that fires on well-formed data | ⭐ the `gpt-6-astra` run must stay green with all three floors SATISFIED |

---

## Not in scope, and said here so nothing reads as closed

- ⚠ **`OutputDefinition`'s fields stay unratified.** `vocab/m1-object-fields.json:2662` records *"Source TBD"*
  and two rival key sets exist. `R29` defers to that ratification rather than pre-empting it.
- ⚠ **Whether an EMPTY array counts as absent for DEC-4** is a separate design question; `pwuGuards.ts:148`
  already treats `length === 0` as an unmet readiness limb.
- ⚠ **`inputRequirements` is LATENT**, not live: `handlers/pwu.ts:336` writes `[]` hard-coded and no command
  payload carries the field, so it renders `""` today. The cast is identical and is fixed with its twin — but
  claiming a live defect there would be a fabricated measurement.
- ⛔ **The other 620 projection-sourced assertions are not cleared.** 127 are `String(…)`/`Number(…)` coercions
  and 78 are `FormDataEntryValue` — a different boundary. The instrument keys on field names resolved from
  contracts, so the `AS-06` class is **invisible to it**. That residual is disclosed, not excluded.
