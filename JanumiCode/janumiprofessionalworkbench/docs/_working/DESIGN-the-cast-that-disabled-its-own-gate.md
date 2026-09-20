# DESIGN — `JAN-ASSERTED`: the boundary asserted what it was supposed to check

**Finding:** `REG-F-411` · **Date:** 2026-09-20 · **Status:** design only, nothing implemented
**Sponsor rulings:** `R29` (stop supplying `{expectedOutputs}`), `R30` (parse the projection at the boundary)

---

## 1. What was measured

Every executing model, and every reviewer shown the producer's instruction, receives:

```
Subject: Route Assessment
Required outputs: [object Object]
```

Confirmed live in the retained `materializedInputRef` bytes of the most recent run. The reviewer then judges
`RR-07-no-contradiction` — *"no contradiction with intent, constraints, inputs"* — against an instruction that
names its required outputs as `[object Object]`.

The chain, read end to end:

| step | site | what it does |
|---|---|---|
| declare | `objects.ts:556` | `expectedOutputs: z.array(OutputDefinitionSchema)` — and `OutputDefinitionSchema = z.record(z.string(), z.unknown())`. **Objects.** |
| read | `+page.server.ts:988` | `getObject(getEngine(), pwuId)` — ⚠ *type-blind* |
| launder | `+page.server.ts:1249` | `(pwu?.expectedOutputs as string[] \| undefined) ?? []` |
| receive | `execution-invocation.ts:28` | `readonly expectedOutputs?: readonly string[]` |
| render | `execution-invocation.ts:94` | `subject.expectedOutputs?.join(', ')` → `[object Object]` |

⭐ **`check-types` CANNOT CATCH THIS, BECAUSE THE CAST EXISTS PRECISELY TO STOP IT.** The gate that would have
caught the defect is the one the defect disabled. That is the finding; `[object Object]` is only its symptom.

---

## 2. The population, DERIVED — and it is small

⛔ **HAND-LISTING WOULD BE THE DEFECT ONE LEVEL UP**, so the population was built mechanically by **two
independent instruments** which agree exactly: a TypeScript AST walk (`AsExpression` / `TypeAssertionExpression`
/ `NonNullExpression`) and a full `TypeChecker` program recording each assertion's inner-expression type, its
asserted type, and the resolved parameter type of the enclosing call. Both were then cross-referenced against
all **349** `z.strictObject` schemas in `packages/rph-contracts/src/objects.ts`, with each field's zod
expression resolved through its alias chain.

| population | count |
|---|---|
| production assertion nodes, repo-wide | **987** |
| of those, projection-sourced | **622** |
| landing at a real typed parameter of a project function | **8** |
| **contradicting their contract schema** | **2** |

⭐ **AND AN INDEPENDENT ROUTE FOUND THE SAME TWO.** A separate pass over every `.join(…)` / `.toString()` /
template interpolation in production code found 149 candidates, 19 on non-primitive receivers, of which 18 are
string-literal unions. The only two that are not are `execution-invocation.ts:94` and `:95`.

⭑ **THE INSTRUMENT DISCRIMINATES** — four synthetic rows were injected; the two that should be caught
(`boundaries as string`, `riskProfile as string[]`) were, and the two that should not (`obligationIds as
string[]`, `title as string`) were not.

⚠ **ONE HALF IS LATENT, AND SAYING OTHERWISE WOULD BE A FABRICATED MEASUREMENT.** `inputRequirements` renders
`""` today, because `handlers/pwu.ts:336` writes `inputRequirements: []` hard-coded and no command payload
carries the field. The cast is identical; only `expectedOutputs` currently has a value to corrupt.

---

## 3. ⭐⭐ The fact that decides the remedy: nobody authored this value

`+page.server.ts:957`, inside the `proposePwu` action, hard-codes for **every** PWU the demo creates:

```ts
expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }]
```

Identical at `undertakings/+page.server.ts:233` and `rph-engine/src/reference-undertaking.ts:449`. **No form
anywhere authors `PWU.expectedOutputs`** — a grep over `packages/*/src` and `apps/rph-demo/src` returns only
the three seeds, the two casts, two guards and two schemas.

⛔ **SO THE BEST POSSIBLE FORMATTER RENDERS `out_pwu_01ARZ3NDEKTSV4RRFFQ69G5K10 (DOCUMENT)`** — a minted ULID
and a constant the surface invented — into a professional's instruction. **That is not a rendering problem. It
is a claim the record cannot support.** And a key-precedence formatter (`description ?? name ?? outputId`)
would additionally fabricate: `vocab/m1-object-fields.json:2662` records `OutputDefinition` as *"NOT
field-defined in either doc. Source TBD."*, and two rival key sets exist with neither as authority.

⭐ **THE CHANNEL THAT CARRIES PROFESSIONAL INTENT ABOUT OUTPUTS ALREADY EXISTS AND ALREADY REACHES THE
INSTRUCTION.** `PromptTemplate.outputContract` (`objects.ts:417`) is authored in the PWA Designer and appended
by `withOutputContract` at `execution-invocation.ts:214`, against the harness's own promise of *"an instruction
that states the work and the exact output it requires."* `{expectedOutputs}` is not that channel and never was.

---

## 4. Three more defects at the same boundary, none of them filed

**4.1 ⭐⭐ `?? []` DEFEATS A SPONSOR-RATIFIED RULE, NOT MERELY A GUARD.** `ROADMAP-prompt-template-and-context.md`
records, as sponsor default #2 accepted 2026-09-04 under `REG-D-058`:

> *"A missing declared placeholder at render time is a **REFUSAL**, not a disclosed gap."*

`prompt-render.ts:66-71` implements it and `execution-invocation.test.ts:79-86` pins it — *"a declared field the
work unit genuinely lacks is absent, not empty."* ⛔ **Measured: `?? []` converts ABSENT into
PRESENT-BUT-EMPTY, so the refusal cannot fire at the only production call site.** The rule is ratified, the
guard is live, the test is green — and four characters in a route made it unreachable exactly where it governs.

⭑ **SO `R29` MINTS NO POLICY. IT RESTORES ONE.** That distinction matters for what this programme is allowed to
assume: the question *"should an unsuppliable placeholder refuse?"* was answered by the sponsor two weeks ago,
and this design does not reopen it.

**4.2 A THIRD LAUNDERED VALUE, AND IT FAILS HARDER THAN THE TWO FILED.** `+page.server.ts:991` —
`const template = pwuType?.promptTemplate as PromptTemplate | undefined` — asserts a whole strict structured
object whose `declaredPlaceholders` is read at `prompt-render.ts:57` as `new Set(template.declaredPlaceholders)`.
⛔ A wrong shape there is a **`TypeError`, not a refusal**.

**4.3 THE READS ARE TYPE-BLIND, AND THIS REPOSITORY SAYS SO IN TERMS.** `queries.ts:245-246`: *"⚠ TYPE-BLIND —
see `getObjectOfType` above before using this with an id that arrives from outside the system."* `pwuId`
arrives from the request. `getObjectOfType` is **imported in that same file and used 700 lines earlier** for
the undertaking — and not here.

⇒ **The boundary is not "two hand-asserted fields". It is: an unchecked id → a type-blind read → eleven
assertions across two objects, one of them a structured sub-object.**

---

## 5. The design

### 5.1 `R29` — `{expectedOutputs}` stops being a supplied placeholder

Until `OutputDefinition`'s fields are ratified, `execution-invocation.ts` supplies no value for it. A template
declaring `{expectedOutputs}` then meets the **existing** DEC-4 refusal rather than rendering a ULID — which is
`4.1`'s guard doing exactly what it was written to do, reachable for the first time.

⚠ **THE COST IS NAMED: four templates in this repository declare `{expectedOutputs}`** and must be rewritten to
state the required output in prose, or to rely on `outputContract`. That is in scope for this programme, not a
consequence to be discovered.

### 5.2 `R30` — the projection is PARSED at the boundary, not asserted across it

A `resolveInvocationSubject(find, pwuId)` in `packages/rph-application`, mirroring the existing
`resolveContextAssemblyPolicy(findByPolicyId, policyId)`: same signature shape, same refusal on absence **and
on shape**, same layer.

⭑ **PRECEDENT, NOT INVENTION — six production sites already do this**, and `abandon-authorization.ts:71-72`
states the argument verbatim: *"It must PARSE as one … guessing at the fields would be the field-name-inference
defect this repo has recorded."* `context-assembly.ts:69-70` adds: *"⚠ IT REFUSES ON SHAPE TOO, not only on
absence. A stored row that does not parse … is the same failure wearing a better disguise."*

⭐ **IT CLOSES THE FORM BY CONSTRUCTION RATHER THAN BY ENUMERATION.** One parse replaces eleven assertions, and
a twelfth field added later is checked for free.

⭐ **AND IT IS THE ONLY CANDIDATE THAT REACHES THE `exchangeId` LIMB** (`§6`), because a field-name-vs-schema
instrument cannot see a laundering whose asserted type declares a field **no schema carries**. A contract parse
turns that into a named compile error.

⚠ **THE COST IS MEASURED, NOT ESTIMATED.** A PWU written through the real command path already parses against
its own `strictObject` — `handlers/kit.ts:419-435` validates every `nextState` and rejects with
`produced_state_invalid`. So the read-side parse is a `safeParse` on an object the engine already validated: it
cannot spuriously refuse a well-formed store, and `apps/rph-demo` already imports runtime schemas from
`@janumipwb/rph-contracts`.

⛔ **IT MUST LIVE IN `packages/`, NOT IN THE ROUTE.** `bun run boundary` cruises `packages` only, so a resolver
in `apps/` would sit outside the gate that governs it.

---

## 6. `exchangeId` — the same class, found by asking

`reviewer-answer.ts:57` asserts `as unknown as ResolvableExchange`. But `handlers/model-exchange.ts:344`
destructures `exchangeId` **out**, and `ModelExchangeSchema` (`objects.ts:1001`) is a `strictObject` that does
not declare it and rejects one. Measured on a disposable copy of `floor-recording.test.ts`: `view.exchangeId`
is `undefined`, while the nine other tests in that file pass — **including the `Object.keys(view!).sort()`
assertion on the very same object**, because a key whose value is `undefined` still counts.

⚠ That string is user-visible, via `routes/pwa/[id]/+page.server.ts:262` → `+page.svelte:2087`.

---

## 7. What this design refuses to do

1. ⛔ **No typed formatter for `OutputDefinition`.** It would render a minted id and an invented constant, and
   it needs a vocabulary ratification that is blocked (`§3`).
2. ⛔ **Fixing the TYPE alone is not the remedy, and this was measured.** Correcting `InvocationSubject` does
   redden the cast (`TS2322`) — but `.join(', ')` on `readonly OutputDefinition[]` **still compiles**, because
   `Array.prototype.join` accepts any array. A repo applying that alone would retype the cast, ship green, and
   still print `[object Object]`.
3. ⛔ **Do not close this by fixing two fields.** That is the hand-listing defect committed inside its own fix —
   the same shape as filing `expectedOutputs` without `inputRequirements`, one level out.
4. ⛔ **Do not relax the unstorable fixtures by making the store accept them.** `§8` corrects the fixtures.

---

## 8. ⛔ Three test fixtures describe a PWU the store cannot hold

Measured through the real engine and real SQLite adapter: `ProposePwu` with `expectedOutputs:
['a viability finding']` is **REJECTED at write** — `VALIDATION_FAILED`, *"expected record, received string"*,
nothing persisted.

That is the fixture used by `execution-invocation.test.ts:14`, `run-model-step.test.ts:38`, and
`no-answer-is-not-an-answer.test.ts:37` — **the last of which I wrote this morning**. ⭐ So the suites that
should have caught this were blind because of their FIXTURE, not their assertion:
`execution-invocation.test.ts:31` *does* assert the rendered value. It asserts the rendering of a PWU that
cannot exist.

⇒ The red test must drive a **real store**, not a hand-built literal.

---

## 9. Open — not closed by this programme

- ⚠ **`OutputDefinition`'s fields are unratified** (`vocab/m1-object-fields.json:2662`: *"Source TBD"*), and two
  rival key sets exist. `R29` defers to that ratification rather than pre-empting it.
- ⚠ **Does an EMPTY array count as absent for DEC-4?** `pwuGuards.ts:148` already treats `length === 0` as an
  unmet readiness limb. Separate question; not answered here.
- ⚠ **The remaining 620 projection-sourced assertions** are not defects by this instrument — 127 are
  `String(…)`/`Number(…)` coercions and 78 are `FormDataEntryValue`, a different boundary. ⛔ That is a claim
  about **this search**: the instrument keys on field names resolved from contracts, so a laundering whose
  asserted type declares a field no schema carries (the `§6` class) is invisible to it. That residual is
  **disclosed and not excluded**.

---

## 10. Exit

A professional's instruction never contains `[object Object]`; a template that declares a placeholder the work
unit cannot supply is **refused** rather than rendered empty; and the invocation subject is built by parsing a
stored object against its own contract, so the eleven assertions — and any twelfth — are checked rather than
asserted.

⭑ **The control is the live lane**: `gpt-6-astra` must still produce a work product and still satisfy all three
floors, with its instruction now naming a real required output.
