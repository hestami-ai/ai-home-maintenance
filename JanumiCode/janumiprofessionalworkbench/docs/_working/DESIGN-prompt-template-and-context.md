# DESIGN — the prompt template and the context a work unit acts on

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-04 · **Programme:** `JAN-PROMPT`
**Sponsor ruling this rests on:** *"I will assert a prompt templates are owned."* (2026-09-04)
**Answers:** the sponsor's own diagnosis — *"a PWU is an agent with a prompt template and relevant context,
and none of that existed in reality, so a PWA actually could not truly run and do real work."*

---

## 1. The gap, measured

Every object definition in the system was searched for a prompt, template, context or instruction field.
**Two hits in the whole model, and neither is a template.** *(Positive control, same instrument and
population: `name`/`description` → 14 hits, so the search resolves.)*

| Hit | What it actually is |
|---|---|
| `contextAssemblyPolicyId` on `RUNTIME_BINDING` | written **once**, as the hardcoded literal `'ctx-default'` (`packages/rph-application/src/handlers/runtime-binding.ts:67`), and **read nowhere**. *(Control: `assurancePolicyIds`, a field that IS read, resolves at 7 production sites.)* It points at an object type that does not exist. |
| `promptTemplateFingerprint` on `MODEL_EXCHANGE` | ⭑ **a fingerprint of a template with no home.** `PER-9`: *"A prompt or template fingerprint identifies that record; it never substitutes for it."* There is nothing for it to identify. |

`PWU_TYPE` carries `pwaId, pwaVersion, pwuKind, name, purpose, isRoot, permittedParentTypeIds,
permittedChildTypeIds, permittedChildren, executionBoundary, boundaryContract, requiredInputs,
requiredOutputs, requiredAssurancePolicyIds, completionRule, status` — **what must be done, and nothing about
how.** `RUNTIME_BINDING` declares `modelSelectionPolicy`, `contextAssemblyPolicyId`, `memoryPolicyId`,
`sandboxPolicy`: the frame for *how an agent would run* exists and every slot is an ungrounded id.

---

## 2. ⚠ What canon already ratifies — three findings that change the design

This is **not greenfield**. Searching the corpus first turned up three ratified statements, two of which
constrain the sponsor's framing and one of which supplies most of the hard half.

### 2.1 A PWU is not an agent, and prompt rendering is a STEP — `DEC-1`

`JPWB-DOC-003:211`, verbatim: *"**Do not create a PWU for prompt rendering**, retrieval, an API call,
formatting, a database write, a retry, or a UI click. **Those are execution steps** unless they independently
carry professional meaning, obligation, evidence, and lifecycle."*

⭑ **This does not refute the sponsor; it locates the parts.** A PWU is a unit of professional obligation. It
may **own** a prompt template, and its **execution steps** render it. The design must therefore put the
template on the type and the *rendering* on the step — and must not let a PWU become a wrapper around a
prompt, which is the shape `DEC-1` forbids by name.

### 2.2 A prompt is a RUNTIME ASSET of the thing that owns it, never its meaning — `ASR-4`

`JPWB-DOC-003:241`, verbatim: *"Policy meaning is stable across validator replacement: **prompts, models, and
deterministic checks are runtime assets of the policy, never the policy itself.**"*

⭑⭑ **This is the ratified pattern for exactly the ownership the sponsor just asserted**, stated for assurance
policies. Carried across, it settles the question I flagged as the hard one:

> **Does editing a prompt invalidate the assurance already recorded against the work?**
> **No — and that is ratified, not chosen.** A prompt is a runtime asset; the type's *meaning* is its purpose,
> boundary, inputs, outputs and completion rule. Editing a prompt does not restate what the work IS.
>
> ⛔ **But it is not free either**, because `ASR-4`'s sentence is about MEANING and says nothing about
> REPRODUCIBILITY. `REG-D-050` (sponsor) requires the stream *"fully auditable and reconstructable"*, and
> `PER-9` requires the exact materialized input retained per try. So: **the template a run used is pinned by
> that run's exchange record; a later edit cannot reach backwards.** Assurance stays valid; the audit trail
> stays exact. *That* is what `promptTemplateFingerprint` was always for, and it finally has a referent.

### 2.3 Context assembly is ALREADY GOVERNED, and the rule is exhaustive — `DEC-4`

`JPWB-DOC-003:224-225`, verbatim: *"For every mandatory parent constraint, exactly one holds per relevant
child: propagated (retaining authority and strength); retained at parent level; marked inapplicable with
rationale; waived through authority; or superseded by a stronger constraint. **No silent omission**"* —
and its **SCOPE** names this explicitly: *"governs decomposition, delegation, semantic revision, **and context
assembly (a context omission must not silently remove a mandatory constraint)**."*

⚠ **I told the sponsor context "does not exist as a concept." That was wrong about the concept and right about
the carrier.** The rule is ratified and exhaustive: assembling context is a governed act in which every
mandatory constraint gets exactly one of five named fates, and silence is illegal. **The design does not
invent a context model — it builds the carrier for a rule that already exists.**

---

## 3. Design

### 3.1 `PROMPT_TEMPLATE` — owned by the type, versioned with the architecture

Per the sponsor's ruling, the template is **owned**, not bound. Ownership has three consequences and they
follow from ownership rather than being separate choices:

1. **It lives on the `PWU_TYPE` aggregate itself.** ⚠ **A first draft of this said "inside the PWA
   aggregate", and that was inferred rather than measured — `PWU_TYPE` is its OWN aggregate**
   (`packages/rph-application/src/handlers/pwa-authoring.ts:708`, `aggregateType: PWU_TYPE`), *scoped* to a
   PWA by `pwaId`/`pwaVersion` rather than contained by it. The correction makes ownership cleaner, not
   harder: the template rides the aggregate that already exists for the type, inherits the PWA scoping the
   type already carries, and needs no new containment rule. There is no separate template library, no
   cross-architecture reuse, and no id resolution across aggregates.
2. **It freezes when the PWA publishes.** A published PWA is immutable — asserted end to end at
   `apps/rph-demo/e2e/agent-sse.e2e.ts:78` (*"the agent refuses to author a non-DRAFT PWA (governance: published is immutable)"*). So a prompt change
   on a published architecture requires the same act as any other change to it, and gets the same review.
3. **It cannot outlive its type.** Deleting a type takes its template; there is no orphan to garbage-collect
   and no dangling id — the failure mode `REG-F-245` records for `storageKey` and `contextAssemblyPolicyId`
   cannot arise here by construction.

⭑ **Ownership is therefore the CHEAPER ruling as well as the sponsor's, and the design should say so rather
than treat it as a constraint to work around.**

Fields, derived from what a run actually needs and from `PER-9`'s retention duties:

| Field | Why it exists |
|---|---|
| `templateText` | the template itself, with named placeholders |
| `templateVersion` | monotonic within the type; what `promptTemplateFingerprint` resolves to |
| `declaredPlaceholders` | ⭑ **a CLOSED list.** An undeclared placeholder is the silent-omission defect: a template that renders `{obligations}` when nothing supplies it produces a prompt with a hole and no one is told. |
| `outputContract` | what a conforming answer looks like, so a malformed one is inert (`ASR-11`) rather than interpreted |
| `status` | `DRAFT`/`ACTIVE` — an inert draft is not a runnable asset |

### 3.2 `CONTEXT_SPECIFICATION` — the carrier for `DEC-4`, owned the same way

What the type declares it needs assembled, and what happens to each mandatory constraint. **The five fates are
`DEC-4`'s, quoted, not invented:** `PROPAGATED`, `RETAINED_AT_PARENT`, `INAPPLICABLE_WITH_RATIONALE`,
`WAIVED_THROUGH_AUTHORITY`, `SUPERSEDED_BY_STRONGER`.

- ⭑ **The disposition is per constraint and REQUIRED**, so "the context left something out" is unsayable
  without saying which and why. That is the whole content of `DEC-4`'s *"no silent omission"*, and it is the
  reason this object is not merely a list of things to interpolate.
- The assembled result is what `MODEL_EXCHANGE.materializedInputRef` already retains — **so the audit half of
  this is built.** Nothing new is needed to record what a run actually saw.

### 3.3 Rendering happens at the STEP, per `DEC-1`

An `EXECUTION_STEP` renders its PWU type's template against the assembled context and calls a model through
the `RUNTIME_BINDING` that already declares `modelSelectionPolicy`. ⛔ **No new PWU kind, no "prompt PWU"** —
`DEC-1` forbids it in terms.

The record of that call is `MODEL_EXCHANGE`, which exists, is durable, is verified, and is readable
(`REG-D-055`, `REG-D-056`, `REG-D-057`, `JAN-MXREAD`). ⭑ **The output side of a real run was built this week
and has never had an input to record. This design supplies it.**

---

## 4. What this makes possible, and what it does not

**Does:** a professional authors a work unit type that says what the work is *and* how an agent should attempt
it; a step renders it against governed context; a model is called; the answer is retained, verified and
readable; the assurance floor judges it with machinery that already exists.

**Does not:**

1. **It does not make execution real on its own.** Nothing today calls a model on behalf of a step — the
   demo's execute button is an eleven-command script. This design supplies the *asset*; a separate increment
   supplies the *caller*.
2. **It does not touch the assurance ladder.** Risk-graduated policy selection is inert and held pending a
   ruling; nothing here changes that.
3. **It does not model memory.** `memoryPolicyId` stays an ungrounded id, deliberately — one gap at a time,
   and memory is not needed for a first real run.

---

## 5. Open questions for the sponsor — asked now, not discovered mid-build

1. **May a DRAFT architecture's prompt be edited freely, or does every edit mint a template version?**
   Recommendation: **freely while DRAFT, frozen at publish.** Versioning every keystroke buys nothing and the
   PWA's own lifecycle already provides the boundary.
2. **When a step renders a template, is a missing declared placeholder a REFUSAL or a disclosed gap?**
   Recommendation: ⛔ **refusal.** A prompt with a hole is `PER-10`'s untrusted input assembled by us, and
   `DEC-4` says a context omission must not silently remove a constraint. Rendering it and disclosing
   afterwards inverts that.
3. **Does an ACTIVE template on a published architecture need its own approval, separate from publishing?**
   Recommendation: **no** — publishing is the review moment, and adding a second gate duplicates authority
   without adding a decision.

## 6. Boundaries

No new vocabulary values for the four unratified columns (`REG-Q-056` is open) · no read-authority mechanism
(`REG-Q-077`) · `handlers/artifact.test.ts:123-136` stays green and unedited · no CSAA.
