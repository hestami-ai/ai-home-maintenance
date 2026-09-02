# JAN-ICP-DR-001 — Detailed Implementation Roadmap: the instruction and context plane

- **Design authority:** `docs/_working/DESIGN-instruction-and-context-plane.md` (REWRITTEN 2026-09-02).
- **Governing invariants:** `DOC-003 PER-9` (the exchange record), `PER-12`/`REG-D-015` (retention of
  volunteered reasoning), `PER-8` (no hard delete after participation).
- **Governing ruling:** `REG-D-048` — an instruction template is a GOVERNED OBJECT declared by a PWU Type, on
  the shape `ASSURANCE_POLICY` already uses. Sponsor, 2026-08-31.
- **Normative keywords:** RFC-2119.

⚠ **THIS ROADMAP LIVES HERE AND NOT IN `docs/_working/`, DELIBERATELY.** `verif/slice-subsumption.test.ts` pins
the working-roadmap population at 19 as a RATCHET, on the ground that *"a programme that leaves the nineteen
working roadmaps standing has become the twentieth"*. `JAN-SLICE` put its own roadmap in a programme directory
for exactly this reason and recorded that it did. This follows that precedent rather than spending the ratchet.

> ## ⚠⚠ REWRITTEN 2026-09-02 — THE PROGRAMME'S PREMISE WAS WRONG, AND IT WAS WRONG IN THE EXPENSIVE DIRECTION
>
> The first version scoped this as **building a new capability**: a context manifest, designed here, to make
> composed prompts perceivable. Re-grounding on `PER-9` found that **most of what it proposed to design is
> already ratified, already measured, and in one case already specified field-by-field in this repository.**
>
> | What v1 treated as | What it actually is |
> |---|---|
> | a manifest to design | `PER-9`'s **exchange record**, ratified, six required elements (`DESIGN` §4) |
> | an unmeasured gap | **15 filed `governed-stream` findings** — 1 CRITICAL, 6 BLOCKING, 8 MATERIAL (`DESIGN` §5) |
> | a record to invent | `JAN-CSAA-007`'s **`ModelExchangeRecord`**, specified field-by-field (`DESIGN` §7a) |
> | an unraised storage gap | **`DEF-W2-001`**, a registered deferral, audited `STILL_TRUE` 2026-08-20 |
> | a fingerprint to define | **`DigestDescriptor`**, defined; JPWB already has the JCS canonicalization |
>
> **THE PROGRAMME IS THEREFORE SMALLER AND ITS CHARACTER IS DIFFERENT.** Half A (retention) is **DISCHARGE**:
> re-check filed findings, adopt a specified shape, ratify an authored-pending contract. Half B (instruction)
> is genuine design, and is where `REG-D-048` applies.
>
> ⚠ **AND THE ORIGINAL SEQUENCING ARGUMENT IS WITHDRAWN.** v1 §4 argued *"measure before govern"* — that
> nobody knew whether JPWB had a size problem, so `ICP-00` should measure it. **That argument was made without
> having read `PER-9`.** The obligation to retain the exchange does not wait on evidence of a size problem; it
> binds today, and fifteen findings already measure its absence. Measurement of *accumulation* survives, but
> demoted: it gates only the decomposition budget (`ICP-06`), which was always the conditional item.

---

## 1. What this programme is for, in one paragraph

The sponsor observed that a PWU's instruction to an agent is invisible in `rph-demo`. Investigation found two
different things wearing one appearance. **The instruction half** is genuinely absent from the engine and the
corpus assigns it inconsistently (`DESIGN` §2) — settled by `REG-D-048`, and real design work. **The context
half** is not a design gap at all: `PER-9` ratifies exactly what must be retained for every model try, and the
system retains none of it. This roadmap **discharges the second and designs the first**, in that order, because
the retention obligation binds regardless of where an instruction ends up living.

---

## 2. Current-state findings

Each driven before this roadmap was written; the command or `file:line` is given so a reader can re-drive.

- **F-1. No contract object carries a prompt template.** One `prompt|template|instruction` field across the
  whole surface — `AssurancePolicyDefinition.defaultClaimTemplates`, a claim template, unrelated.
- **F-2. `ExecutionStep`'s nearest field is `purpose: string`, and it carries NO vocab note.**
- **F-3. Four governance points are constants.** `handlers/runtime-binding.ts:67` mints every binding with
  `contextAssemblyPolicyId: 'ctx-default'`, `observabilityPolicyId: 'obs-default'`, `modelSelectionPolicy: {}`,
  `sandboxPolicy: {}`. `CONTEXT_ASSEMBLY_POLICY`, `OBSERVABILITY_POLICY`, `MEMORY_POLICY` return **0** as object
  types.
- **F-4. ~~No durable record of a composed prompt exists.~~** ⚠ **RESTATED — v1's phrasing carried the defect.**
  The claim is true but was established by searching `promptBytes|contextBytes|tokenCount|promptSize` — **the
  field names of the manifest v1 invented.** The correct statement, established against the OBLIGATION:
  `AUTHORING_CONVERSATION`'s `ConversationEntry` = `{role, kind, text, success?}` carries **zero of `PER-9`'s
  six elements**, and `ExecutionAttemptView` (the built projection) carries **zero of six** as well.
- **F-5. `ModelSelectionPolicy` has no defined shape** in `m1-object-fields.json` — *"NOT field-defined. Source
  TBD."* ⚠ **But `packages/rph-domain/vocab/m11-execution.json:148` gives it a `description` and a `sourceRef`
  pointing at `DOC-009 §10.5 model_selection_policy jsonb`, with no TBD.** Two shape-authority files disagree
  about whether it is dispositioned; `ICP-05` must reconcile them rather than quote one.
- **F-6. Decomposition propagates five collections downward with no budget term.**
  ⚠ **AND WHETHER THAT EXPLODES IN JPWB IS UNMEASURED.** See `ICP-06`.
- **F-7. The pattern `REG-D-048` copies is real and built.** `PwuType.requiredAssurancePolicyIds` declares
  policies by id; `Pwu.assurancePolicyIds` carries them resolved; the policy is an independently versioned
  governed object with an editor and an e2e-tested lifecycle.
- **F-8 (NEW). JPWB never holds the prompt it sends.** `pi-agent.ts:119` passes a `systemPromptOverride` and
  `:166` calls `session.prompt(instruction)`; Pi's `DefaultResourceLoader` composes the rest. **`PER-9`'s E-1 is
  not merely unrecorded — it is unavailable**, which is why `ICP-01` exists and is not a recording task.
- **F-9 (NEW). Two bounded tries happen in one function and neither becomes a record.**
  `reasoning-review-validator.ts:176-182`: `let raw = await print(prompt)` … `catch { raw = await print(...) }`.
  The materialized `prompt` is never retained; the pre-coercion `raw` is **overwritten**; the `catch` is bare.
  ⚠ `JAN-CSAA-007` forbids this by name — *"Repair never rewrites predecessor raw output."*

---

## 3. Target-state gap analysis

| # | Gap | Closed by |
|---|---|---|
| G-1 | The 15 `governed-stream` findings stand at a 2026-07-15 measurement; ≥2 have moved | `ICP-00` |
| G-2 | `PER-9` E-1 is unavailable — JPWB cannot see its own composed prompt | `ICP-01` |
| G-3 | No exchange record carries E-1..E-6 on either plane | `ICP-02` |
| G-4 | E-2/E-6 and `PER-12` need a purgeable content plane that is deferred, not built | `ICP-03` (`REG-Q-B`) |
| G-5 | Context assembly is a constant naming no object | `ICP-04` |
| G-6 | No authored instruction exists to review, version, or reach for; no surface | `ICP-05` |
| G-7 | Decomposition may accumulate without bound — unmeasured here | `ICP-06`, gated on `ICP-00` |

---

## 4. Ordering, and what each step unblocks

```
ICP-00 ──▶ ICP-01 ──▶ ICP-02 ──┬──▶ ICP-04 ──▶ ICP-05
   │                            │
   │         ICP-03 (REG-Q-B) ──┘   (E-2/E-6 + PER-12 only)
   └──────────────────────────────▶ ICP-06 (conditional)
```

- `ICP-01` before `ICP-02` because **E-1 cannot be recorded before it can be obtained** (F-8).
- `ICP-03` runs **beside** `ICP-02`, not before it: E-1/E-3/E-4/E-5 need no content store; E-2/E-6 do.
- `ICP-06` exists **only if** `ICP-00` shows accumulation is real here rather than inherited.

---

## 5. Work-package register

### `ICP-00` — RE-DISPOSITION THE FIFTEEN AT HEAD

**Why first.** The 32 *refuted* findings were re-checked at HEAD on 2026-08-23. **The 75 confirmed ones never
were.** They stand as of 2026-07-15 with thirty-odd increments landed since, and spot-checks already show
movement in **both directions**: #24/#25/#62 are TRUE at HEAD at the same file with drifted line numbers, #65
is STALE, and **#26 is PARTLY STALE — an Execution Attempt read-model now exists** (`rph-projections/src/
execution-attempts.ts`, Fork A, 2026-07-21) **carrying zero of PER-9's six elements.** A roadmap that schedules
these as work without re-checking builds against a stale measurement.

**Deliverable.** One row per finding: `TRUE AT HEAD` / `FALSE AT HEAD` / `PARTLY STALE` / `OUT OF SCOPE`, each
re-checked **at the site** with a positive control, in the manner of the 2026-08-23 pass. Findings **#10, #24,
#25, #26, #27, #28, #29, #56, #57, #58, #59, #60, #61, #62, #63**, plus adjacent **#46, #52, #55, #65, #68**.

⚠ **THE CONTROL.** A re-disposition sweep that returns "all still true" is indistinguishable from one that did
not run. **#65 and #26 are the known-moved pair** — any sweep that reports them unchanged has failed, and that
is the check on the instrument.

⚠ **AND TWO CENSUS LIMBS ARE OWED FILINGS, NOT RE-DISPOSITIONS** (`REG-F-317`). The W-3b invariant census
(`docs/tracking/w3b/invariant-verdicts.ndjson`) drove `PER-9` as **eleven limbs** and named what each owes.
`limb:PER-9:6` and `:9` are discharged by `REG-F-316`. **Two remain:**
- **`limb:PER-9:7`** — *"PER-9's fingerprint clause has no implementation surface: no prompt or template
  identity of any kind is minted, versioned or recorded, on either plane."*
- **`limb:PER-9:10`** — *"the log/record plane distinction is asserted only in prose … the Logger port's 'MUST
  NOT carry secrets / PII / raw payloads' is unenforceable."* ⚠ The design record quotes that very line as
  corroboration for the log/record split **without noticing the line itself is unenforced.**

⚠⚠ **AND `docs/tracking/` IS A THIRD PLACE TO SEARCH BEFORE FILING ANYTHING.** It is neither the register nor
the per-programme design corpus, it holds **driven verdicts with positive controls**, and this programme
re-derived from the corpus what it already contained. Add it to the standing pre-filing sweep.

**Exit.** Twenty-two rows — the twenty findings plus `limb:PER-9:7` and `:10` — each with a command a reader
can re-drive. **No code changes.**

---

### `ICP-01` — MAKE THE COMPOSED PROMPT OBTAINABLE

**Why it is a build and not a recording step.** `PER-9` E-1 is *"the exact materialized input presented to the
model."* Today JPWB hands Pi an override plus an instruction and Pi composes the rest (F-8). **There is nothing
to record.** This is also, structurally, the sponsor's original complaint: the party that must diagnose an
oversized prompt cannot see it.

**Deliverable.** The composed input crosses back to JPWB before dispatch, or JPWB composes it and Pi is given
the finished text. Whichever, the bytes actually presented are held on this side of the boundary.

**Exit + THE TEST THAT MUST REDDEN.** A conformance test asserts the captured input is **byte-identical** to
what was sent. **The mutant:** capture the template *before* substitution/assembly instead of after. This MUST
fail — a pre-assembly capture is exactly the fingerprint `PER-9` forbids substituting for the record, and a
test that passes on it is asserting nothing.

⚠ ~~**RISK, NAMED:** this may not be fully achievable through Pi's public surface.~~
✅ **LANDED 2026-09-02. THE RISK IS RETIRED, AND MORE CHEAPLY THAN PRICED.** Pi exposes a documented hook —
`onPayload`: *"Optional callback for inspecting or replacing provider payloads before sending. Return undefined
to keep the payload unchanged"* — which fires **once per provider request**, i.e. exactly PER-9's unit.
`Agent.onPayload` is a public writable property and `AgentSession.agent` is public, so no internal is touched.
**No disclosed partial was needed.** `materialized-input.ts` + 6 mutants, all SOUND against declared predictions,
with a BASELINE control that caught a broken instrument before any verdict was believed.
⚠ **AND IT YIELDS E-3 FOR FREE:** `onPayload(payload, model)` carries the resolved model, so the producer's
identity — the surviving half of finding `#10` — arrives on the same seam.
⚠ **WHAT IT DOES NOT YIELD:** `onResponse` fires *"before its body stream is consumed"*, so it is HTTP-level
and is **not** E-2. The pre-coercion output still needs its own capture in `ICP-02`.

---

### `ICP-02` — THE EXCHANGE RECORD, ADOPTED RATHER THAN DESIGNED

**Governing:** `PER-9` E-1..E-6 + `PER-9-a` (the TRY is the unit). **Starting shape:** `ModelExchangeRecord`
(`DESIGN` §7a) — **not a blank page.**

**Deliverable.**
1. **A field-by-field adoption decision** against `ModelExchangeRecord`'s seventeen fields, with **a written
   reason for every rejection.** ⚠ CSAA is another agent's subsystem and its types are CSAA-namespaced; this
   adopts the SHAPE, imports nothing.
2. The record carried on **both planes**: the execution plane (where the Attempt projection exists and is
   empty of exchange content) and — per `PER-9-c`, whose source says *"not to an Execution Attempt"* — the
   **authoring plane's own governed-stream record.**
3. `AUTHORING_CONVERSATION`'s shape **ratified**: it is currently `UNRATIFIED-AUTHORED` by its own m3 note
   (*"Ratification pending"*), so extending it is a ratification act, not only a build.

**Exit + THE TESTS THAT MUST REDDEN.**
- **A repair produces TWO records.** Mutant: emit one record per turn. MUST fail — `PER-9-a` counts tries, and
  `reasoning-review-validator.ts` produces two on every repair path (F-9).
- **The predecessor's raw output survives its repair.** Mutant: reassign `raw` as the current code does. MUST
  fail — this is finding #25 and `ModelExchangeRecord`'s *"Repair never rewrites predecessor raw output."*
- **A fingerprint does not satisfy the record.** Mutant: store `contentHash` and drop the input. MUST fail —
  `PER-9-b`. ⚠ **This is the mutant that would have caught v1's manifest**, and it is in the roadmap for that
  reason.

---

### `ICP-03` — `REG-Q-B`: THE CONTENT/RETENTION SEAM

⚠ **A SCHEDULING DECISION, NOT A DESIGN ONE.** The store is specified (`Single-Node Runtime Profile §31`:
S3-compatible object storage + an artifact-metadata field list that **is** `ARTIFACT`'s). The seam is a
registered deferral (**`DEF-W2-001`**, `STILL_TRUE` 2026-08-20, destination W3/W10). Block-and-disclose is the
ratified default — Guide §9.7: *"block the capability and resolve Section 16 item 23."*

**The question for the sponsor:** does ICP pull `DEF-W2-001` forward, or record the dependency and stop at the
four elements that do not need it?

⚠ **AND ONE THING IS A DEFECT EITHER WAY.** The code currently omits at the write boundary (`transcript.ts`
drops `thinking`) **without disclosing that it is doing so.** `PER-9`: *"record-plane omission is not [legal]."*
Whatever is decided about building, **the undisclosed omission must become a disclosed one.**

⚠ **CONSTRAINT ON ANY SOLUTION:** Guide §9.7 — *"It adds no dedicated reasoning store; Section 10's typed
persistence remains authoritative."* The home is the typed `ARTIFACT` with `retentionClass` finally READ, **not
a new reasoning store.** A design that mints one contradicts the source.

⚠ **DO NOT RE-RAISE `REG-Q-056`** (what a retention class MAY BE). It is OPEN, and three candidate value
domains already exist (`DESIGN` §12). It is a choice among worked options.

---

### `ICP-04` — CONTEXT ASSEMBLY AS A GOVERNED OBJECT

`contextAssemblyPolicyId` exists as a field with one writer and one constant (F-3). This gives it an object,
an id that resolves, and a reader.

**Exit + THE MUTANT.** Point a binding at a policy that does not exist. This MUST refuse. ⚠ **The failure mode
to avoid is the one this repository has recorded repeatedly** — seeding a permissive default so the check can
never fire. Whether `'ctx-default'` resolves to a seeded policy or refuses is itself open (`DESIGN` §12): a
fail-closed default breaks every existing binding; a permissive seed reproduces the vacuous route.

---

### `ICP-05` — THE INSTRUCTION TEMPLATE OBJECT, AND THE ONLY UI

**Governing:** `REG-D-048`. **Open sub-questions (`DESIGN` §9 H-1..H-3):** the object's field shape; one
template per PWU Type or several; parameter substitution and its syntax; whether editing migrates dependent
PWAs the way `EditAssurancePolicy` versioning does.

**Deliverable.** The governed object + its declaration on `PwuType` + an authoring surface + a composition view
showing instruction, context itemised by source, and totals.

⚠ **`ModelSelectionPolicy` IS NOT IN SCOPE TO DEFINE**, but F-5's contradiction between the two shape-authority
vocab files **is** in scope to reconcile — reporting one of them as "the ontology" is what v1 did.

---

### `ICP-06` — DECOMPOSITION BUDGET (CONDITIONAL)

Runs **only if** `ICP-00` shows accumulation is real in JPWB. `SHOULD`, never `MUST`: no ratified text imposes
a budget, and the only budget-shaped rules found (`JSRP §26.2`, `§67.1`) are **candidate-tier.**

---

## 6. Exit criteria

1. `ICP-00`'s twenty rows exist, each re-driveable, and **#65 and #26 are recorded as moved** (the control).
2. The composed input is byte-captured, or its unobtainability is **disclosed**, never silently partial.
3. An exchange record carries E-1..E-6 on both planes, with the adoption decision written against
   `ModelExchangeRecord` field by field.
4. A repair produces two records, and the predecessor's raw output survives it — **both proven by a driven red.**
5. A fingerprint-only mutant **fails**.
6. `AUTHORING_CONVERSATION`'s shape is **ratified**, not authored-pending.
7. `REG-Q-B` is answered, and the current omission is disclosed either way.
8. `contextAssemblyPolicyId` resolves to an object, and a dangling id **refuses**.
9. Every finding this programme claims to discharge names the finding number and the commit.

---

## 7. Risk register

- **R-1. `ICP-01` may be blocked by Pi's surface.** Mitigation: disclosed partial with `truncationState:
  unknown`, never a silent capture of the pre-assembly template.
- **R-2. Re-dispositioning fifteen findings may find most already fixed**, collapsing the programme. That is a
  **good** outcome and must not be resisted; `ICP-00` is written to be allowed to end the programme.
- **R-3. Adopting a CSAA shape risks coupling.** Mitigation: shape only, no imports, no CSAA edits — the
  standing constraint is that CSAA belongs to the CSAA agent.
- **R-4. `REG-Q-B` may be declined**, leaving E-2/E-6 blocked. Mitigation: the other four elements proceed;
  the block becomes *disclosed* rather than silent, which is itself a discharge of the `PER-9` violation.
- **R-5. ⚠ THE PROGRAMME'S OWN RECORDED FAILURE MODE.** v1 invented what the corpus ratified, and its falsifier
  could not catch it because the falsifier was phrased in the invention's vocabulary. **Every absence claim in
  this programme MUST be phrased against the OBLIGATION, never against a proposed field name.** `FAL-5` and
  `FAL-7` in the design record are the worked examples; both were recorded `NOT TRIGGERED` and both were wrong.
