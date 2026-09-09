# DESIGN — the execution governance layer, measured whole (`JAN-EXECGOV`)

**Date:** 2026-09-08. Written at sponsor direction: *"This needs to be addressed holistically and systemically…
and not just a point fix while the wider issue remains unaddressed."*

---

## 1. What was measured

Four carrier surfaces and the ratified corpus, each with stated searches and positive controls. **142 declared
fields** across `RUNTIME_BINDING` (10), `PWU_TYPE`/`EXECUTION_STEP`/`EXECUTION_PLAN` (24), `ASSURANCE_POLICY`
and its sub-objects (79), and the authoring surface (39, overlapping).

⭑ Verified personally, not taken from the census: `STA-8`'s text, `REG-D-052`'s ruling, the absence of any
`RequestRuntimeBinding` dispatch, the `OUT_OF_SCOPE` fall-through, and the capability schema.

## 2. ⛔⛔ ONE RATIFIED RULE IS UNMET ON EVERY PRODUCTION EXECUTION

`STA-8` (`JPWB-DOC-003:203`), verbatim:

> *"Execution requires an approved plan and **authorized Runtime Bindings**, and high-risk irreversible
> execution requires plan approval before it begins."*

**No `RUNTIME_BINDING` is ever created.** `RequestRuntimeBinding` has **zero** production dispatch sites — its
only occurrence is a contract declaration at `messages.ts:3605`. **POSITIVE CONTROL, same form, same
population:** `ApproveExecutionPlan` → **4** production sites. Both production `ActivateExecutionPlan` call
sites pass `authorizedRuntimeBindingIds: []`.

⚠ **And the gate that would notice cannot.** `bindingAuthorityVerdict` (`rph-domain/src/execution.ts:279-280`)
returns `{ ok: true, limb: 'OUT_OF_SCOPE' }` when the step names no binding — correctly, since two absences mean
opposite things. But because *every* production step names none, **every step takes `OUT_OF_SCOPE`** and the
four binding checks are live, tested, and unreachable on real work.

⭑ **This is disclosed, not hidden.** The kernel says so itself: *"every plan in the reference seed — which
authors no RuntimeBinding whatsoever — permanently unstartable"* (`execution.ts:195-196`), and
`SPEC-001:10145` records the confirmed absence with its own control. What has NOT been done is state it as a
**standing breach of `STA-8`**, which is what it is.

## 3. ⛔ AND IT CANNOT BE FIXED WITHOUT A GRANT

Minting a binding requires naming at least one capability — `RequestRuntimeBinding` refuses an empty request
(N-20: *"a request for nothing is refused here, and only here"*) and `AuthorizeRuntimeBinding` refuses an
authorization granting nothing (N-22).

But a capability is `{ capability: z.string() }` — a **free string** — and its vocab note reads *"Helper
undefined (persistence: capability_requests §31)."*

⚠ **So the schema will accept anything, and that is exactly the danger.** Naming a capability
`'model.invoke'` would be **coining governed vocabulary** — the same act as minting
`CONTEXT_ASSEMBLY_POLICY`, which required `D-1`. The difference is that the schema stopped me last time and
will not stop me here. **A ratification act that nothing enforces is still a ratification act.**

## 4. ⛔⛔ WHAT MUST NOT BE WIRED — and this is the larger half of the finding

The instinct behind "make the layer govern" is right in one place and **wrong in most of them**. Canon has
deliberately declined to govern several of these, and implementing them would invent rules the corpus refused
to make.

| Carrier | Status | Evidence |
|---|---|---|
| **`modelSelectionPolicy`** | ⛔ **DO NOT WIRE** | `REG-D-052`, sponsor verbatim: *"We won't be pinning judge model because that will be selected based on performance parameters that have yet to be determined. Meaning that it will need to be configurable."* And `ASR-4`: prompts and models are *"runtime assets of the policy, never the policy itself."* Which model runs a step is **configuration**, by ruling. |
| **`ModelSelectionPolicy`'s shape** | ⛔ explicitly DEFERRED | `REG-005:31738` — *"`ModelSelectionPolicy` is DEFERRED, as `REG-D-048` requires be done explicitly. Grounds: no field shape anywhere in the corpus, no reader, no command that can set it."* |
| **"the declaration must match what ran"** | ⛔ **NOT A RULE** | `PER-9` requires recording *"the resolved provider, model, and version actually invoked"* — and canon **never requires declaring an allowed one, nor binds the two**. *"allowed and resolved"* occurs **once** in the whole corpus, in an observability section, with no stated consequence. Control: canon knows how to write identity-binding (`ASR-16`, *"exactly matching the reviewed version"*) — and did not write it here. |
| **context selection beyond constraints** | ⚠ doctrine, no invariant | `DEC-4`'s SCOPE binds context assembly **for mandatory constraints only**. Selection, prioritization, freshness and compression are assigned to Context Engineering (`DOC-001:154`) with no invariant behind them. |
| **`memoryPolicyId`** | ⛔ ratified field, no writer, no shape | Same class as `ModelSelectionPolicy`. |
| **`riskConditions`, `lifecycleTriggers`, `eventTriggers`, `semanticChangeConditions`** | ⛔ disclosed deferral | The kernel: *"ACTIVATION conditions (§5.3), not SCOPE conditions… activation is a separate concern and is not silently folded in here."* Element types *"DEFINED NOWHERE in the corpus."* |

⭑ **This is the systemic answer, and it is mostly a restraint.** The layer looks under-connected because much of
it was deliberately left open — a fork, a deferral, or a ruling that the value is configuration. **Wiring those
would not be a fix; it would be an implementer inventing governance.**

## 5. ⚠ The part that needs no grant: the authoring surface tells the author things that are not true

The sponsor's own case — *"the human user may use the UI to make manual changes as well"* — is where the
measurement bites hardest, because a setting a person edits and nothing reads is a **fiction presented as
control**. The authoring lane found the delta in both directions across 39 fields: 22 govern, and **11 are
settable-but-unread** (including `AssessmentCriterion.criterionType`, `evaluationMethod`, `mayBeNotApplicable`,
`requiredEvidenceIds`, `ASSURANCE_POLICY.evaluatorRole`, `evaluatedClaimTypes`, `findingDefinitions`).

⛔ **The remedy is NOT to wire eleven fields.** Several are legitimately descriptive, and some belong to
deferred concerns. The remedy is that **a surface must not present an unread setting as though editing it
does something** — which is a disclosure problem, not a wiring problem, and it is checkable.

## 5b. ⚠⚠ §5 MEASURED, AND THE MEASUREMENT MOVED THE DEFECT — 2026-09-08, before `EG-04` was built

§5 above stands as written, with **one clause corrected and one defect added that is larger than the one it
names**. Both came from re-deriving the census from code instead of building against the recorded list.

**⭑ FIRST, THE CORRECTION I ALMOST MADE AND WHICH WAS ITSELF WRONG.** The re-derivation found **no form control
on the surface whose posted value nothing reads**, and the obvious conclusion — *"§5 is wrong in direction"* —
was drafted, put to four adversarial readers, and **refuted**. §5 censused **object fields the surface writes**;
the re-derivation censused **form controls the author fills**. Five of §5's eleven names have no control at all
(`criterionType`, `evaluationMethod`, `mayBeNotApplicable`, `requiredEvidenceIds` are minted as constants inside
`policy-fields.ts:44-48`; `findingDefinitions` is hardcoded `[]` at `+page.server.ts:771`), so they are outside
the second census **by construction**. It refutes §5 on **0 of the 11 names**. ⛔ **These are two findings, not
one overturning the other** — and a dissolution that survives only by changing the population is not a
dissolution.

⚠ **AND §5'S DIRECTION IS NOT EMPTY EVEN INSIDE THE STRICTER POPULATION.** `ASSURANCE_POLICY.evaluatorRole` has
a real control (`+page.svelte:1361`), is stored (`assurance.ts:218`) and is patchable (`assurance.ts:276`) — and
**nothing anywhere compares it**; every other occurrence is an assignment or a projection. Policy `rationale` is
the same shape. Both clear "is it read?" only on the render limb, and only via the same editor form that posted
them. **A field echoed back by the form that set it is not thereby consulted**, and §5's remedy — disclosure —
is exactly right for them.

---

**⛔⛔ SECOND, AND THIS IS THE LARGER ONE: THE INVERSE DEFECT IS LIVE AND IT WIDENS GOVERNANCE.**

`ASSURANCE_POLICY.applicableObjectTypes` is read from the form at `policy-fields.ts:62` and **no control in the
3,122-line markup emits it** — measured, and measured across history: `name="applicableObjectTypes"` has
**never** appeared in any `.svelte` file in this repository. The reader was written on 2026-07-15 (`691aa014`)
for a control that was never built, and `+page.server.ts:173-179` still projects the stored value into the form
model under a comment describing *"a comma-separated text input"* that does not exist.

⚠ **THE GUARDS THAT SHOULD HAVE CAUGHT IT FAIL BECAUSE `[]` IS TRUTHY.** `csvList(null)` returns `[]`;
`+page.server.ts:766`'s `f.applicableObjectTypes || 'PROFESSIONAL_WORK_UNIT'` is therefore **dead** (and
type-wrong — a string where the schema demands an array, so it would be REJECTED had it ever fired), and
`:811`'s `f.applicableObjectTypes ? {…} : {}` is **always taken**. Three lines below, `:819` guards `criteria`
with `f.criteria.length`. ⭑ **Two spellings of the same guard, in one function, on one screen** — and the wrong
spelling is used on all three array fields.

**MEASURED BY DRIVING THE ENGINE, not by reading it.** Create with `['PROFESSIONAL_WORK_UNIT']`, then send
exactly what a *rename* sends:

| | `applicableObjectTypes` | `applicability.objectTypeConditions` | applies to a PWA? |
|---|---|---|---|
| after create | `['PROFESSIONAL_WORK_UNIT']` | `['PROFESSIONAL_WORK_UNIT']` | `NOT_APPLICABLE` |
| after a rename | `[]` | `[]` | ⛔ **`REQUIRED`** |

Both commands `ACCEPTED`. ⛔ **The empty list does not narrow — it WIDENS.** `governance.ts:767-769` guards the
`NOT_APPLICABLE` limb on `objectTypes.length > 0`, so an empty condition set skips the guard and falls through
to `REQUIRED`. `reconcileApplicability` (`assurance.ts:336-346`) early-returns only on `undefined`, so `[]`
propagates into `applicability` — **the field the enforced §5.1 determination prefers**. The kernel's *"scope
untouched by this edit"* limb exists and **this surface can never reach it**.

⭑ **WHAT KEEPS IT FROM BEING CATASTROPHIC IS A PROPERTY OF THE DATA, NOT OF THE CODE.** All twelve seeded
catalog policies carry a second `pwuKindConditions` arm that still refuses. The reachable population is the demo
sign-off policy (`demo-policy.ts:58`, object-type arm only) plus **every policy created through the UI**, which
is born unscoped with no edit required.

**⛔ AND THE SECOND ARM IS DESTROYED BY A THIRD PATH.** `successorPolicyPayload` (`+page.server.ts:411-437`)
says *"every field of the predecessor copied verbatim"* and copies **seventeen**, omitting `applicability` and
`remediationRules`. Since create derives `applicability ?? { objectTypeConditions: applicableObjectTypes }`,
**versioning any kind-scoped policy returns a successor with no `pwuKindConditions`** — the one arm protecting
the twelve.

---

**⭑ THE GENERAL FORM, WHICH IS WHY THIS IS A GATE AND NOT A POINT FIX.** *A server action that reads a form key
no control emits does not fail — it silently writes the reader's default, and whether that is benign or
destructive turns on whether the default is falsy.* Derived across the whole route tree, the reader-without-a-
control set is exactly two, and they land on opposite sides of that line: `version` (`+page.server.ts:840`)
defaults to `''`, which is **falsy**, so its `||` rescues it and the only cost is an unreachable feature;
`applicableObjectTypes` defaults to `[]`, which is **truthy**, so its guard does not.

⚠ **AND THE DERIVATION THAT FOUND THEM IS NOT THE GATE.** A literal `form.get('X')` scan is blind to five reader
idioms in this application — template-literal keys (`cardinality:${typeId}`), a callback reader
(`parseRiskProfile(read)`), a line-split `form\n.getAll(…)`, `getAll` itself, and dynamic emitters
(`name={riskFieldName(d.field)}`) — and it was correct here **only because each blind spot happened to pair a
missed reader with a missed emitter**. ⛔ That is cancellation, not method. The gate must handle the idioms or
DECLARE what it cannot analyse, in the recorded-fail-open shape `SPEC-001-NF-32` requires of an ungated offer.

**⛔ WHAT CANON DOES AND DOES NOT SAY ABOUT THIS.** The nearest ratified rule is `SPEC-001` O-4's exclusion —
*"a display-only computation that gates nothing … SHALL NOT be rendered as an Affordance"* — and it does not
reach here: a form input is not an Affordance, and the defect is a control that is **absent**, not one that is
inert. This is doctrine with a measured harm behind it, and it is recorded as such rather than dressed as an
invariant.

## 6. Decisions

| # | Decision | Recommendation |
|---|---|---|
| **G-1** | **Grant to name capability vocabulary**, so a `RUNTIME_BINDING` can be minted and `STA-8` satisfied on the live path. | ⭑ The only decision that unblocks the one real breach. Smallest honest form: one capability per step type that a model invocation actually needs, named in the vocabulary with its note, exactly as `D-1` was handled. |
| **G-2** | Should the authoring surface **disclose** unread settings, or should the settings be removed from it? | ⭑ **Disclose.** Removal loses the author's intent; disclosure keeps it and stops the fiction. |
| **G-3** | `producer`-omission independence dodge (`REG-F-364`) | Sponsor's, still open. ⚠ Note it becomes far less urgent under `G-1`: a binding names the role that ran the step, so the producer becomes resolvable from the record rather than caller-supplied. |

⛔ **NOT proposed:** wiring anything in §4. Each would invent a rule canon declined to make, and the register
already records the deferral for most of them.

## 7. ⭑⭑ THE TWO AUTHORS OF A PWA DO NOT SEE THE SAME THING — in BOTH directions, and nothing checks it

**SPONSOR DIRECTION, 2026-09-09, verbatim:** *"the (presumably PWA) authoring agent should be able to declare
how work is discharged and that the human reviewing the full PWA before approving its use would be the model."*

That direction is answerable, and the measurement underneath it turned out to be larger than the asymmetry it
names. A PWU Type has **two** authors — the authoring agent and the professional — and each is blind to things
the other sees. Three instances, all verified, all pointing the same way:

| # | direction | what was measured |
|---|---|---|
| 1 | agent cannot WRITE | `DefineTypeInput` carries 12 fields; `workDischarge`, `promptTemplateText`, `promptOutputContract`, `promptActive`, `promptTemplateVersion` are none of them, and the tool schema names none. The only production writer of `'MODEL'` is a human choosing it in a select |
| 2 | agent cannot READ BACK | `PwuTypeView` / `toTypeView` do not project `workDischarge` or `promptTemplate`, so the agent cannot even see what a human declared. ⭑ The repository already states this rule for the human at `+page.server.ts:151` — *"a field the page can write and cannot read back is the sponsor's original complaint with the arrow reversed"* |
| 3 | ⛔⛔ human cannot SEE, **at the approval moment** | `editable = isDraft && (!hasStagedCandidate \|\| running)`, and the type FORM — the only surface in the repository that renders `workDischarge` or the prompt — sits behind `{:else if editable && formMode !== null}`. With a candidate STAGED, the panel falls to the read-only inspector, which shows Kind · Boundary · Purpose · Completion rule · Required inputs · Required outputs, **and neither discharge nor prompt** |

⛔ **INSTANCE 3 IS THE ONE THAT MATTERS, BECAUSE IT IS THE SPONSOR'S OWN CONTROL FAILING AT ITS CONTROL POINT.**
`acceptAgentCandidate` is documented as *"explicit human acceptance of the exact assured preview"*. The human
accepting it cannot see how the work will be discharged, or what an agent will be told to do.

⭑ **AND A FOURTH, IN THE SAME SHAPE.** `lint.ts`'s own header says *"The agent runs this on itself … **and a
human can read the same list**."* Its only production caller is `tools.ts:249`, the agent's tool. **The sentence
is false.** An advisory authored for a human that only the agent consumes is `EG-06`'s dead help string with the
arrow reversed — the third such inversion this programme has found in two days.

**⚠ AND A ONE-LINE BUG ON EXACTLY THE PATH THIS DESIGN OPENS.** `defineFromTemplate` forwards six fields —
`name`, `pwuKind`, `purpose`, `isRoot`, `requiredInputs`, `requiredOutputs` — and **drops `workDischarge`**,
which is a REQUIRED field of `PwuTypeTemplate` (`catalog.ts:97`, no `?`). The blueprint's own answer is
discarded. `REG-005:31400` calls that required field *"the structural guard"*; it is defeated on the very path
the agent will use.

---

## 7.1 The design — and it adds no refusal, no command, no object, no wire-schema change

⭑ **THE SPINE IS SYMMETRY, NOT A NEW RULE.** Everything below either makes an existing engine limb reachable,
projects a value that is already stored, or renders a string that already exists. Three independent designs were
put against this question; the one that minted new surface (a `DeclarationCensus` projection and a count above
the publish buttons) was **rejected for inventing governance** — a running count of undeclared types rendered at
the approval moment is one step from a rule the corpus has not made.

**A · WRITER AND READER SYMMETRY.** `DefineTypeInput`/`EditTypeInput` and the two tool schemas gain
`workDischarge`, `promptTemplateText`, `promptOutputContract`, `promptActive`; `PwuTypeView`/`toTypeView`
project `workDischarge` and `promptTemplate` back. ⛔ Forwarded by **conditional spread only** — never the
unconditional `bool(...)` idiom used elsewhere in `tools.ts` — because collapsing ABSENT into a written value
destroys the distinction the code deliberately keeps: *"Absent means the author was never asked; `UNDECLARED`
means they were asked and deferred."* **No contract change is needed:** `DefinePwuTypePayloadSchema`,
`EditPwuTypePayloadSchema` and `PwuTypeSchema` already accept all of it. **No new vocabulary is authored:**
`EG-06` single-sourced those three help strings hours earlier, under a comment naming them *"the three the
agent's tool schema cannot see"*.

**B · THE APPROVAL MOMENT CAN SEE WHAT IT APPROVES — and this is SEQUENCED FIRST BY SPONSOR CONDITION.** Two
fields in the read-only inspector, rendering the **four-way** distinction (*a model · a person · not yet decided
· never asked*) and the prompt's `ACTIVE`/`DRAFT` status, plus the same on the whole-PWA walkthrough — the
surface that literally is *"reviewing the full PWA"*. Both values are **already projected into page data**; no
new plumbing. ⛔ **The sponsor's condition is that nothing may be ARMED that this surface cannot show, so B
lands before the arming half of A.**

**C · THE EXECUTION CONSEQUENCE, SPOKEN WHERE THE AUTHOR IS STANDING.** `isModelStep = pwuType?.workDischarge
=== 'MODEL'` silently downgrades an undeclared type to `TRANSFORMATION`: no binding requested, `OUT_OF_SCOPE`,
and nothing says so. ⛔ **NOT a refusal** — `step-binding.ts` records the `JAN-EXEBIND` wedge, *"an UNRECOVERABLE
WEDGE whose refusal message prescribed a remedy the engine categorically forbids"*. Instead `lintComposition`
gains `checkDischargeDeclared`: silent for `MODEL`/`HUMAN`, silent for `DELEGATED_EXTERNAL` (whose own gate
already refuses any discharge value), and **two distinct `info` messages** for `UNDECLARED` versus absent, each
naming the consequence. ⭑ And the lint is rendered **for the human** beside the lifecycle buttons, which makes
its own header sentence true for the first time.

**D · THE REVIEWER SEES IT TOO** *(sponsor decision, 2026-09-09)*. `buildPwaExport` — exactly 8 fields, and the
content the independent reasoning review reads — gains `workDischarge` and the prompt's status. ⛔ **No new
criterion**: the ratified floor policy is untouched. `REG-005:6149-6154` already establishes the reading that
PWA metadata **is** reviewed content *because* it is a member of the export, so adding a member is transcription
rather than a new rule.

**E · THE GATE STOPS BEING GREEN OVER THE DEFECT.** `EG-06`'s disposition gate asserts no help key is read by
NOBODY — and the asymmetry needs **BOTH**. It already computes both-ness and discards it. One limb, its own
message: *"one author of a PWU Type can read this and the other cannot"*, symmetric so agent-only drift is
caught too. ⛔ **Landed with NO exemption**, which requires two small repairs first — `tools.ts`'s inline
`childCardinalities` description must point at `PWU_TYPE_HELP.permittedChildren`, and `promptActive` needs the
help key it never had. **An exemption granted on a gate's first day is how a gate rots.**

---

## 7.2 ⛔ NOT TAKEN, and why

- **No `ApprovePwa` command, no human-attestation object.** Approval is inferred from the lifecycle acts that
  exist. Minting an attestation object is a ratification act and the corpus has not asked for one. **Disclosed.**
- **No refusal anywhere.** Not at publish for an undeclared type, not at planning, not at decomposition. Every
  disclosure lands in a channel that already exists and is already advisory by charter.
- **`m1-object-fields.json:1383`** still says *"MODEL requires an ACTIVE promptTemplate"* — a contract authority
  describing a gate that was dropped on evidence. Real, and **filed as its own item** rather than annexed here.
- **Instance-time composition** (`permittedChildTypeIds` as an allow-list) stays unbuilt: `REG-005:1049` reads
  candidate children as *"a menu the PWA may narrow and may never contradict"* — an AUTHORING-time property,
  which is asserted, not an instance-time refusal.
