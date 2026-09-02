# DESIGN — the instruction and context plane: what an agent is told to do, and what it is told with

## 0. Normative keywords, and the authority this document does *not* have

`MUST` / `MUST NOT` / `SHOULD` / `MAY` are RFC-2119. This document is a DESIGN RECORD. It decides nothing that
belongs to the sponsor, and it marks every such point `SPONSOR RULING REQUIRED` rather than choosing quietly.

⚠ **AND IT OPENS ON A CORPUS TENSION IT CANNOT RESOLVE ALONE.** The central question — where an authored
instruction lives — has two ratified answers that do not agree (§2). Nothing below should be read as settling
that; the design's job is to state the tension byte-exactly, show what each reading costs, and put the choice
where it belongs.

---

## 1. The problem, measured

**The sponsor's statement, which is the origin of this document:** *"the core of PWU is a prompt template for the
agent that will be tasked with performing that PWU. I don't see that being visible in rph-demo."*

The second half is true and the first half is the design question. Measured, in both directions:

- **F-1. No object in the contract surface carries a prompt template.** An exhaustive walk of
  `packages/rph-contracts/src/objects.ts` for `prompt|template|instruction|systemPrompt` as a FIELD yields
  **one** match — `AssurancePolicyDefinition.defaultClaimTemplates`, a claim template, unrelated.
  **Positive control:** the same walk for ordinary field names returns hundreds.
- **F-2. `PWU_TYPE` carries sixteen fields and none of them is an instruction.** `pwaId, pwaVersion, pwuKind,
  name, purpose, isRoot, permittedParentTypeIds, permittedChildTypeIds, permittedChildren, executionBoundary,
  boundaryContract, requiredInputs, requiredOutputs, requiredAssurancePolicyIds, completionRule, status`. It
  declares WHAT work is to be done and to what standard. It does not say what to tell anyone.
- **F-3. `ExecutionStep` carries no template either.** Twelve fields; the nearest is `purpose: string`, which
  has **no vocab note at all** — nothing in the corpus or the code claims it is the prompt, so reading it that
  way would be an inference presented as a finding.
- **F-4. The three policies that would govern context do not exist.** `RUNTIME_BINDING` declares
  `contextAssemblyPolicyId`, `observabilityPolicyId` and `memoryPolicyId` as bare `z.string()`.
  `CONTEXT_ASSEMBLY_POLICY`, `OBSERVABILITY_POLICY`, `MEMORY_POLICY` return **0** as object types.
  Every binding is minted at `handlers/runtime-binding.ts:67` with `contextAssemblyPolicyId: 'ctx-default'`,
  `observabilityPolicyId: 'obs-default'`, `modelSelectionPolicy: {}`, `sandboxPolicy: {}` — **four governance
  points, all constant, none resolving to anything.**
- **F-5. `modelSelectionPolicy` is an untyped placeholder and the ontology says so.**
  `m1-object-fields.json:2792` — *"NOT field-defined. Source TBD."*
- **F-6. Decomposition propagates context downward with no budget term.** `DECOMPOSITION_CONTRACT` carries
  `obligationAllocations`, `constraintPropagations`, `assumptionPropagations`, `retainedParentObligationIds`
  and `intentMappings` — five downward-propagating collections — and no depth, breadth, size or budget field.

**Why this matters beyond tidiness, in the sponsor's own words:** in the predecessor system, recursive
decomposition for user stories produced prompts so large and so complex that they stopped working, *and the
coding agent could not diagnose the fault because it could not perceive the aggregate prompt.* The instruction
and the accumulated context were ONE artifact. When it grew past comprehension there was nothing to inspect
separately, so the failure was invisible to the only party positioned to fix it.

---

## 2. ⚠⚠ THE CORPUS DISAGREES WITH ITSELF, AND THE DESIGN TURNS ON WHICH READING BINDS

**Reading A — the conformance mapping places it on the Execution Step.** *Legacy JanumiCode — Semantic Inventory
and RPH Conformance Mapping*, §7 *Current-to-Canonical Object Mapping*, verbatim row:

> `| Prompt | Prompt template within an Execution Step |`

and the same document's per-phase migration checklist enumerates `Prompt templates`, `Context sources`,
`Models/providers invoked`, `Tools invoked` as things that must be inventoried.

**Reading B — the canonical domain model defines the Execution Step and omits it.** *Canonical Domain Model,
Invariant Catalog, State Machines, and Event Contract* §21 gives the `ExecutionStep` interface in full:
`id, executionPlanId, stepType, purpose, inputBindings, outputBindings, runtimeBindingId?, preconditions,
postconditions, stepState`. **There is no prompt template field**, and `stepType` includes `MODEL_INVOCATION`
— so the corpus contemplates invoking a model from a step whose interface says nothing about what it is told.

**THE ENGINE IMPLEMENTS READING B FAITHFULLY.** `ExecutionStep` in `m1-object-fields.json` is §21's interface
plus `selectedTransitionId` and `strength`. So the absence the sponsor noticed is **not an implementation
defect** — it is the implementation being correct against one ratified document while another names a placement
that document does not provide.

⚠ **DO NOT RESOLVE THIS BY PRECEDENCE ALONE.** `REG-D-010` and the corpus-precedence record make canon
authoritative over historical material for DETAIL, and §21 is the more canonical artifact — which would settle
it for Reading B and leave the mapping row as an aspiration. **But that reading concludes that RPH has no home
for an authored instruction at all**, which is a substantive claim about the product, not a documentation
cleanup. It needs a ruling.

- ~~**SPONSOR RULING REQUIRED — `REG-Q-A`: where does an authored instruction live?** (a) On the Execution Step,
  per the mapping row. (b) On the PWU Type, per the sponsor's stated model. (c) Nowhere as authored text —
  derived at execution time. **This document does not choose.**~~
  **✅ RULED 2026-08-31 — `REG-D-048`, OPTION (d).**

> **`REG-D-048` — AN INSTRUCTION TEMPLATE IS A GOVERNED OBJECT, DECLARED BY A PWU TYPE.**
> Sponsor's words: *"Option (d) sounds most like the balance and tradeoffs the system needs."*
>
> ⚠ **OPTION (d) WAS NOT IN THIS DOCUMENT WHEN IT WAS FILED.** It was proposed after the sponsor asked for
> clarity on what they were ruling on, and it is recorded here as the fourth option rather than back-written
> into the original three, because the reason it exists is that the first three did not fit.
>
> **The shape, and why it is not an invention:** the corpus already solved this once. An `ASSURANCE_POLICY` is
> not a string on a PWU Type — it is a governed object, authored and versioned independently, which a PWU Type
> DECLARES by id (`requiredAssurancePolicyIds`) and an instance carries resolved (`assurancePolicyIds`). The
> ruling adopts that same shape for the instruction.
>
> ⚠ **THE PATTERN IS RATIFIED; THIS APPLICATION OF IT IS NOT**, and that was said before the ruling was made.
> Option (a) has a corpus row behind it; (d) has an architectural precedent behind it. They are different kinds
> of warrant and a later reader must not conflate them.
>
> ⚠⚠ **AND THE §2 TENSION IS NOT RESOLVED BY THIS RULING.** (d) is neither (a) nor (b). The mapping row still
> names a placement — *within an Execution Step* — that no ratified interface provides, and §21 still defines
> an interface with no instruction. `REG-D-048` decides what THIS SYSTEM WILL BUILD. It amends no document, and
> it MUST NOT be cited as having reconciled the corpus with itself. **The tension stands.**

---

## 3. The distinction this design exists to establish

Whatever ruling `REG-Q-A` receives, **the instruction and the context MUST be separable artifacts.** This is the
one thing the design asserts on its own authority, because it is what the predecessor's failure demonstrates.

- **THE INSTRUCTION** is authored, small, stable, reviewable, versioned by a human. It is what the professional
  controls.
- **THE ASSEMBLED CONTEXT** is composed, variable, potentially unbounded, and grows with decomposition depth.
  It is what escapes.

**D-1.** The system **MUST NOT** represent an authored instruction and its assembled context as one artifact.
Conflating them is the predecessor's defect stated structurally: when the aggregate is the only artifact, its
size has no owner and its growth has no reviewer.

**D-2.** Context assembly **MUST** be a governed object with an identity, not a constant.
`contextAssemblyPolicyId` already exists as a field; `'ctx-default'` names nothing. A policy that cannot be
read cannot be reviewed, changed, or blamed.

**D-3.** Every completed model invocation **MUST** leave a durable record of what it was composed from —
a **context manifest**. See §5 for its testable property.

**D-4.** The manifest **MUST** be durable, not transient. A record that exists only in a stream is not
perceivable by a professional who arrives after the fact — which is precisely the party who needs it.

**D-5.** Decomposition **SHOULD** carry a budget term. `DECOMPOSITION_CONTRACT` propagates five collections
downward with no bound; the predecessor's explosion happened one level above the prompt, in the recursion.
⚠ Marked SHOULD and not MUST deliberately: no ratified corpus text imposes a decomposition budget, and
inventing a MUST here would be this document legislating rather than recording. See §7.

---

## 4. What is already present, and must be reused rather than reinvented

⚠ **THE CORPUS HAS ALREADY NAMED THIS PLANE. NOTHING BELOW IS A NEW CONCEPT** — which is why the work is
promotion, not invention, and why proposals that mint parallel vocabulary should be refused.

| Named in the corpus / contracts | Status today |
|---|---|
| `RuntimeBinding.contextAssemblyPolicyId` | field exists; constant `'ctx-default'`; no object |
| `RuntimeBinding.observabilityPolicyId` | field exists; constant `'obs-default'`; no object |
| `RuntimeBinding.memoryPolicyId` | field exists; unset |
| `RuntimeBinding.modelSelectionPolicy` | untyped placeholder, `{}`; *"Source TBD"* |
| `ExecutionStep.stepType = 'MODEL_INVOCATION'` | ratified; drivable |
| `AUTHORING_CONVERSATION` | object type exists (durable turn record) |
| "Prompt templates" / "Context sources" | named in the migration checklist; no field, no object |

**The plane is declared and empty.** That is the same shape `REG-F-302`'s promotion addressed for the
product-behavior objects, and the same shape the register records as *the hollow governed layer*: a field whose
only writer is a default.

---

## 5. Perceivability, stated as a property that can fail

⚠ **A PANEL IS NOT PERCEIVABILITY.** The requirement is not that a screen exists; it is that the fact survives
the session in which it was produced. So the obligation is written as a test, and the test names its own mutant.

**P-1 — the static half is a RATCHET, not a screen.** A byte ceiling on the composed system prompt and tool
schemas, asserted in a test. A panel that displays a constant is a screen nobody reopens; a ratchet fails the
build the day the constant moves.

**P-2 — the variable half is a DURABLE MANIFEST.** Every completed model invocation records: composed
instruction bytes; assembled context bytes, itemised by source; tool-schema bytes; cumulative tool-result
bytes; ~~compaction and retry counts;~~ and the identity of the context-assembly policy that governed it
(once one exists).

⚠ **`compaction and retry counts` STRUCK 2026-08-31, AND THE REASON IS THE POINT OF THIS WHOLE DOCUMENT.**
**JPWB HAS NEITHER MECHANISM.** `grep -rn "compact"` over `packages/rph-authoring/src` and the demo's server
lib returns ZERO; the only `retry` hits in the authoring path are an outbox drain and prose inside error
messages. Both fields were imported — one from how other agent runtimes behave, one from `ExecutionPlan`'s
`retryPolicy`, which governs execution steps and not authoring turns.

**This is the exact error §1 warns against, committed inside the document that warns against it:** the
predecessor's phenomena treated as evidence about this system. It was caught when the sponsor asked what
"a compacting turn" meant and the answer turned out to be "nothing here". The remaining fields are ones this
system can actually produce; anything further MUST come from `ICP-00`'s measurement rather than from what a
manifest usually contains.

**THE TEST THAT MUST REDDEN** — without which `P-2` is decoration:

> ~~Drive a turn that compacts.~~ **Drive any completed turn. Reload.** The manifest is still there, itemised.
>
> **The mutant:** emit the identical facts as a live status stream only. This **MUST** fail — status lines are
> dropped at the transcript boundary and vanish on reload. A manifest that only exists while you are watching
> is exactly the artifact the predecessor's agent could not consult.
>
> ⚠ **THE PROVOCATION IS THE RELOAD, NOT COMPACTION.** The property under test is DURABILITY, and a turn does
> not need to be large to test whether its record survives. Requiring compaction made the test depend on a
> mechanism JPWB does not have — and would have made it unrunnable for a reason that had nothing to do with
> what it asserts.

**P-3.** The manifest **MUST** record what was *injected*, not merely what was *authored* — context files,
skills, prior-turn carryover. An instruction inventory that omits the injected half reproduces the original
defect with better paperwork.

---

## 6. Alternatives considered

**A-1 — Add a `promptTemplate` field to `PWU_TYPE` and an editor, and stop.** REJECTED as sufficient, though it
may be the right first move under ruling (b). It delivers control without perceivability: the authored half
becomes visible while the assembled half — the half that exploded in the predecessor — stays a constant named
`'ctx-default'`. This is the failure mode where the fix addresses the part that was already fine.

**A-2 — Build a settings screen for model and harness configuration.** REJECTED. It is a screen over four
fields that are `{}`, `{}`, `'ctx-default'` and `'obs-default'`; `modelSelectionPolicy` has no defined shape to
edit. Measured additionally: `RequestRuntimeBinding` / `AuthorizeRuntimeBinding` have **zero call sites**
outside the registry and their own handler, so the population such a screen would configure is empty on every
load that has ever run.

**A-3 — Treat `ExecutionStep.purpose` as the instruction.** REJECTED. It is an undocumented `string` with no
vocab note; nothing in the corpus assigns it that meaning. Adopting it would be an inference dressed as a
finding, and it would silently overload a ratified field.

**A-4 — Resolve the §2 tension by precedence and proceed.** REJECTED as a unilateral act. The precedence rule
would favour Reading B, whose consequence is that RPH has no home for an authored instruction — a product
decision, not an editorial one.

**SELECTED — A-5.** Obtain the `REG-Q-A` ruling; establish the instruction/context split (`D-1`) whichever way
it falls; promote context assembly to a governed object; add the durable manifest with its predicted red; and
only then build surfaces, each reading a fact that exists.

---

## 7. Sequence

1. ~~**`REG-Q-A` ruling.** Everything downstream depends on where the instruction lives. Nothing is built
   first.~~ **✅ DISCHARGED 2026-08-31 by `REG-D-048` — option (d).** The instruction is a governed object
   declared by the PWU Type; steps 2-6 stand as written and step 4 now reads "the instruction template object
   and its declaration on PWU Type", not "a field".
2. **Context assembly as a governed object.** Independent of the ruling: whichever artifact carries the
   instruction, the assembled context needs an identity. This is the item that makes the rest possible.
3. **The durable context manifest**, with the reload test of §5 driven RED before it is made green.
4. **The instruction field**, wherever `REG-Q-A` places it, with its authoring surface.
5. **The composition view** — instruction, plus context itemised by source, plus totals.
6. **Decomposition budget** (`D-5`), last, and only if a measurement shows the accumulation is real here rather
   than inherited from the predecessor's architecture.

⚠ **STEPS 1–3 ARE ENGINE WORK AND STEPS 4–5 ARE THE ONLY UI.** The sponsor's question arrived as a UI question;
the answer is that four fifths of it is not.

---

## 8. What this design does not decide

- ~~**Where the instruction lives** — `REG-Q-A`, above.~~ **RULED: `REG-D-048`, option (d).** What the ruling
  left open, and what the roadmap must answer or defer explicitly: the object's field shape; whether a PWU Type
  declares ONE template or several; whether parameter substitution exists and in what syntax; and whether
  editing a template migrates dependent PWAs the way `EditAssurancePolicy` versioning already does.
- **The shape of `ModelSelectionPolicy`** — the ontology records it as *"Source TBD"*, and inventing a shape
  here would create a fifth restatement of the kind `assessment-criterion-contract.test.ts` exists to prevent.
- **Whether the decomposition budget is a MUST** — no corpus text imposes one.
- **Whether `'ctx-default'` should resolve to a seeded policy or refuse** — a fail-closed default would break
  every existing binding; a seeded permissive default reproduces the vacuous route. Both need measurement.
- **Anything about the `pi` / `agy` harnesses.** They are process-level today. Whether harness selection becomes
  governed state is a separate question this document deliberately leaves alone.

---

## 9. Falsifiers

This design is WRONG, and should be withdrawn or rewritten, if any of these is shown.

⚠ **FOUR OF THE FIVE WERE DRIVEN BEFORE THIS DOCUMENT WAS FILED, AND NONE TRIGGERED.** A falsifier that is
written and not run is a claim about the author's confidence, not a test of the design. The verdicts and their
commands are recorded inline below so a later reader can re-drive them rather than trust them.

- **FAL-1.** A ratified corpus document *does* define an instruction or prompt-template field on `PWU_TYPE`,
  `ExecutionStep`, or `RuntimeBinding`. Then §1's F-1..F-3 are a search failure, not an absence, and the
  §2 tension may be resolvable by reading rather than ruling.
  **DRIVEN 2026-08-31 — NOT TRIGGERED.** `grep -rin "promptTemplate|instructionTemplate|systemPrompt|
  agentInstruction"` over the whole RPH corpus and `docs/canon/` returns ZERO.
- **FAL-2.** `ExecutionStep.purpose` is documented anywhere as the model instruction. Then A-3 is not an
  inference and the field already exists.
  **DRIVEN — NOT TRIGGERED.** The field carries no `note` in `m1-object-fields.json`, and §21 declares
  `purpose: string` with no accompanying prose. Absence of documentation is the whole finding here, so this
  falsifier is the one most worth re-driving if §21 is ever annotated.
- **FAL-3.** Any production path writes a `contextAssemblyPolicyId` other than `'ctx-default'`. Then F-4
  overstates the constancy and the governance point is partly live.
  **DRIVEN — NOT TRIGGERED.** Exactly two occurrences repo-wide outside `dist`: the schema declaration
  (`objects.ts:685`) and the single writer (`handlers/runtime-binding.ts:67`), which is the constant.
- **FAL-4.** The predecessor's failure is shown to have been caused by something other than aggregate size and
  the inability to inspect it — in which case `D-1` is solving the wrong problem, however tidy the split.
- **FAL-5.** A durable manifest already exists somewhere and was missed. Then `P-2` is built and the work is
  a surface after all.
  **DRIVEN — NOT TRIGGERED.** `AUTHORING_CONVERSATION` carries exactly two fields — `pwaId` and
  `entries: ConversationEntry[]` — and a repo-wide search for `promptBytes|contextBytes|tokenCount|promptSize`
  finds hits only inside `packages/csaa`'s TypeScript compiler-input journal, which measures COMPILER inputs and
  has nothing to do with model invocation. ⚠ That near-miss is worth naming: a keyword search for this
  manifest DOES return results, and every one of them belongs to another subsystem.
