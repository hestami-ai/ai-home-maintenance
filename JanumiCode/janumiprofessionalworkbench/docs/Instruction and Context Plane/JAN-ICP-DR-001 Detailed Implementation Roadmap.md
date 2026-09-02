# JAN-ICP-DR-001 — Detailed Implementation Roadmap: the instruction and context plane

- **Design authority:** `docs/_working/DESIGN-instruction-and-context-plane.md`, obligations `D-1` … `D-5`,
  perceivability properties `P-1` … `P-3`, falsifiers `FAL-1` … `FAL-5` (four driven, none triggered).
- **Governing ruling:** `REG-D-048` — an instruction template is a GOVERNED OBJECT declared by a PWU Type, on
  the shape `ASSURANCE_POLICY` already uses. Sponsor, 2026-08-31.
- **Normative keywords:** RFC-2119.

⚠ **THIS ROADMAP LIVES HERE AND NOT IN `docs/_working/`, DELIBERATELY.** `verif/slice-subsumption.test.ts` pins
the working-roadmap population at 19 as a RATCHET, on the ground that *"a programme that leaves the nineteen
working roadmaps standing has become the twentieth"*. `JAN-SLICE` put its own roadmap in a programme directory
for exactly this reason and recorded that it did. This follows that precedent rather than spending the ratchet.

---

## 1. What this programme is for, in one paragraph

The sponsor observed that a PWU's instruction to an agent is invisible in `rph-demo`. Investigation found it is
absent from the ENGINE, at the layer the corpus assigns it, and that the corpus assigns it inconsistently
(`DESIGN` §2). `REG-D-048` settled what to build. This roadmap builds it — **and it builds the ability to SEE a
composed prompt before it builds the ability to GOVERN one**, for a reason given in §4.

---

## 2. Current-state findings

Each was driven before this roadmap was written; the command or the file:line is given so a reader can re-drive
rather than trust.

- **F-1. No contract object carries a prompt template.** One `prompt|template|instruction` field across the
  whole surface — `AssurancePolicyDefinition.defaultClaimTemplates`, a claim template, unrelated.
- **F-2. `ExecutionStep`'s nearest field is `purpose: string`, and it carries NO vocab note.** Nothing in the
  corpus or the code assigns it the meaning "the model instruction".
- **F-3. Four governance points are constants.** `handlers/runtime-binding.ts:67` mints every binding with
  `contextAssemblyPolicyId: 'ctx-default'`, `observabilityPolicyId: 'obs-default'`, `modelSelectionPolicy: {}`,
  `sandboxPolicy: {}`. `CONTEXT_ASSEMBLY_POLICY`, `OBSERVABILITY_POLICY` and `MEMORY_POLICY` return **0** as
  object types. `contextAssemblyPolicyId` has exactly two occurrences outside `dist`: the schema and that
  single writer.
- **F-4. No durable record of a composed prompt exists.** `AUTHORING_CONVERSATION` carries two fields —
  `pwaId`, `entries` — and a repo-wide search for `promptBytes|contextBytes|tokenCount|promptSize` returns hits
  only inside `packages/csaa`'s TypeScript compiler-input journal, which measures COMPILER inputs.
  ⚠ **That near-miss is the finding's own trap**: the keyword search DOES return results, and every one belongs
  to another subsystem.
- **F-5. `ModelSelectionPolicy` has no defined shape.** `m1-object-fields.json` — *"NOT field-defined.
  Source TBD."*
- **F-6. Decomposition propagates five collections downward with no budget term** — `obligationAllocations`,
  `constraintPropagations`, `assumptionPropagations`, `retainedParentObligationIds`, `intentMappings`.
  ⚠ **AND WHETHER THAT ACTUALLY EXPLODES IN JPWB IS UNMEASURED.** The predecessor's failure is evidence about
  the predecessor. See `ICP-00`.
- **F-7. The pattern this programme copies is real and built.** `PwuType.requiredAssurancePolicyIds` declares
  policies by id; `Pwu.assurancePolicyIds` carries them resolved; the policy itself is an independently
  versioned governed object with an editor and an e2e-tested lifecycle. `REG-D-048` adopts this shape.

---

## 3. Target-state gap analysis

| # | Gap | Closed by |
|---|---|---|
| G-1 | A composed prompt leaves no durable trace, so its size has no reviewer | `ICP-00`, `ICP-02` |
| G-2 | No authored instruction exists to review, version, or reach for | `ICP-01` |
| G-3 | Context assembly is a constant naming no object | `ICP-03` |
| G-4 | Nothing a professional can see: no template surface, no composition view | `ICP-04` |
| G-5 | Decomposition may accumulate without bound — unmeasured here | `ICP-05`, gated on `ICP-00` |

---

## 4. ⚠ THE SEQUENCE IS REFINED FROM THE DESIGN'S, AND THE REASON IS STATED RATHER THAN SLIPPED IN

`DESIGN` §7 ordered: ruling → context assembly as a governed object → durable manifest → instruction template →
surfaces. **This roadmap inverts the middle two: MEASURE FIRST, then govern.**

The design's argument for policy-first was that it *"makes the rest possible"*. That is true of the governance
but not of the observation: a manifest can record what today's ungoverned composition produces, and until it
does, **nobody knows whether JPWB has a size problem at all.** The predecessor's explosion is evidence about the
predecessor's architecture. Building a context-assembly policy first would be building governance for a problem
this system has not been shown to have — which is the shape this repository has recorded repeatedly as
*a guard arranged over a population that never occurs*.

So `ICP-00` measures, and `ICP-05`'s existence is conditional on what it finds.

---

## 5. Work-package register

⚠ **NO `delivery_state` FIELD, DELIBERATELY** — following `JAN-SLICE-DR-001 §15`. A roadmap that records its own
progress becomes the stale progress substrate the last programme was built to end.

```yaml
id: JAN-ICP-00
title: "Measure what a composed prompt actually is today, and record the perceivability RED"
design_obligations: [P-2, D-3]
outcome: "The reload test of DESIGN §5 exists and is observed FAILING, with its message recorded verbatim; and
  the current composed prompt/context sizes are MEASURED for the paths this system actually drives."
knowledge_status: >
  UNMEASURED and that is the point. It is not known whether JPWB composes large prompts, because nothing records
  a size. The predecessor's failure is evidence about the predecessor.
repository_scope:
  files_or_symbols:
    - "packages/rph-authoring/src/broker.ts — where a turn is composed"
    - "apps/rph-demo/src/lib/server/authoring-turn.ts, routes/pwa/[id]/agent/+server.ts"
required_changes:
  - "A test asserting a durable per-turn manifest survives reload. It MUST fail; the failure is the deliverable."
  - "A one-off measurement, recorded in the register: composed instruction bytes, assembled context bytes by
     source, tool-schema bytes, for the reference authoring turn."
invariants:
  - "Nothing is built to make the red green in this work package."
prohibited_shortcuts:
  - "MUST NOT assert the red from reading. A predicted red that has not been observed is a hypothesis, and this
     programme's predecessor had three of four such hypotheses turn out false (REG-F-309)."
  - "MUST NOT measure against `pi` if `pi` is absent and silently report zero. State which harness was driven
     (`JPWB_AGENT=mock` is legitimate; pretending it was `pi` is not) and give a positive control."
open_questions:
  - "~~Can a compacting turn be driven under the mock harness at all?~~ WITHDRAWN 2026-08-31 — MALFORMED.
     JPWB HAS NO COMPACTION MECHANISM: `grep -rn compact` over packages/rph-authoring/src and the demo server
     lib returns ZERO, and the authoring path has no turn retry either. The question asked whether a phenomenon
     this system does not have could be provoked, and it was imported from how other agent runtimes behave.
     ⚠ THAT IS THE OVER-ATTRIBUTION §4 OF THIS ROADMAP WARNS AGAINST, COMMITTED IN THE SAME DOCUMENT. The
     provocation is the RELOAD, not compaction: the property is durability, and a turn need not be large for
     its record to be tested for survival."
  - "OPEN, and this one is real: what does a turn record TODAY? `AUTHORING_CONVERSATION` is durable and its
     `ConversationEntry` carries `role, kind, text, success?` — so SOME text survives, and whether the composed
     instruction is among it is not established (`authoring-turn.ts` never mentions `instruction`). ICP-00 MUST
     establish this before ICP-02 designs a manifest, because part of it may already exist."
```

```yaml
id: JAN-ICP-01
title: "INSTRUCTION_TEMPLATE as a governed object, declared by a PWU Type"
design_obligations: [D-1]
governing_ruling: REG-D-048
outcome: "An instruction template is authored, versioned and reviewed independently; a PWU Type declares which
  template governs it; a PWU instance carries it resolved."
knowledge_status: CONFIRMED absent — 0 prompt/instruction/template fields across the contract surface (F-1)
required_changes:
  - "Follow the object-plane pattern EXACTLY, as JAN-SLICE-SWP-05 did: vocab entry in m1-object-fields.json,
     REGENERATE (objects.ts is generated and its first line forbids editing), id prefix, command + event in m3,
     handler, registry, and a PRODUCER in the reference undertaking."
  - "Declare it on PwuType the way policies are declared — by id, mirroring `requiredAssurancePolicyIds`."
  - "Every field traced in the vocab note to the sentence that grounds it, or NOT ADDED."
invariants:
  - "No parallel representation alongside `requiredAssurancePolicyIds`. The declaration mechanism is the SAME."
  - "24 of 24 object types were reachable by a command before SWP-05 and 29 of 29 after; this type MUST NOT be
     the first shape-only exception."
prohibited_shortcuts:
  - "MUST NOT invent parameter-substitution syntax. REG-D-048 explicitly left it open; if the roadmap needs it,
     it is a separate ruling, not a field someone adds."
  - "MUST NOT overload `ExecutionStep.purpose`. It is an undocumented string and adopting it would be an
     inference dressed as a finding (DESIGN A-3)."
  - "MUST NOT claim REG-D-048 resolved the corpus tension. It did not; DESIGN §2 stands."
open_questions:
  - "One template per PWU Type, or several? Left open by the ruling."
  - "Does editing a template migrate dependent PWAs, as EditAssurancePolicy versioning does? Left open."
tests:
  - "Object-plane conformance, which objects.test.ts derives from OBJECT_SCHEMAS automatically."
  - "A refusal with its own driven mutant, per SL-3a — single-victim or declared prefix-subsumed."
```

```yaml
id: JAN-ICP-02
title: "The durable context manifest — ICP-00's red discharged by work"
design_obligations: [D-3, D-4, P-2, P-3]
outcome: "Every completed model invocation leaves a durable, itemised record of what it was composed from, and
  ICP-00's recorded red goes green because the fact now exists."
knowledge_status: CONFIRMED absent (F-4), including its near-miss in packages/csaa
required_changes:
  - "Persist the manifest where it survives the session — beside the assurance subject, so `AI origin SHALL
     remain visible after review or acceptance` can bind to it."
  - "Record what was INJECTED, not only what was authored (P-3): context files, skills, prior-turn carryover."
invariants:
  - "The manifest is DURABLE. A stream is not a record."
prohibited_shortcuts:
  - "MUST NOT satisfy this with SSE `status` lines. DESIGN §5 names that as the mutant that MUST fail — status
     lines are dropped at the transcript boundary and vanish on reload."
  - "MUST NOT report a byte count without saying what it counted. `contextBytes` already exists in this
     repository meaning something else entirely."
tests:
  - "The reload test from ICP-00, now green, with the SSE-only mutant driven RED."
```

```yaml
id: JAN-ICP-03
title: "CONTEXT_ASSEMBLY_POLICY as a governed object — 'ctx-default' resolves to something"
design_obligations: [D-2]
outcome: "Context assembly is governed by an object with an identity, versioned and reviewable."
knowledge_status: CONFIRMED absent — 0 as an object type; one writer, one constant (F-3)
required_changes:
  - "The object, its declaration, and a producer. Same pattern as ICP-01."
invariants:
  - "Existing bindings MUST keep working. A fail-closed default breaks every binding ever created; a permissive
     seeded default reproduces the vacuous route. DESIGN §8 leaves this open and it MUST be measured, not picked."
prohibited_shortcuts:
  - "MUST NOT define `ModelSelectionPolicy` in passing. The ontology records it as 'Source TBD' and inventing a
     shape here would be a fifth restatement of the kind assessment-criterion-contract.test.ts exists to prevent."
sequencing_note: >
  Deliberately AFTER the manifest. Governing context before measuring it is building a guard over a population
  nobody has observed — see §4.
```

```yaml
id: JAN-ICP-04
title: "The two surfaces: authoring a template, and seeing what a turn was composed from"
design_obligations: [P-1, P-2]
outcome: "A professional can author and version an instruction template, and can look at what any completed turn
  was actually told."
required_changes:
  - "Extend the EXISTING policy-manager surface rather than minting a second authoring idiom — the pattern,
     its lifecycle and its e2e coverage already exist."
  - "A composition view: instruction, context itemised by source, totals."
invariants:
  - "Every field rendered MUST be a fact the engine holds. This programme's predecessor recorded surfaces that
     were screens over empty populations; a composition view over an absent manifest is exactly that."
prohibited_shortcuts:
  - "MUST NOT be built before ICP-02. The view would render a fact that does not exist."
  - "MUST NOT be a settings screen over modelSelectionPolicy / sandboxPolicy while both are `{}` (DESIGN A-2)."
tests:
  - "A SURFACE Slice (`.slice.e2e.ts`) presupposing the ENGINE Slice that drives the manifest, per SL-6."
```

```yaml
id: JAN-ICP-05
title: "A decomposition budget — CONDITIONAL, and the condition is a measurement"
design_obligations: [D-5]
outcome: "Either a budget term on the decomposition contract, or a recorded finding that JPWB does not exhibit
  the accumulation and the obligation is withdrawn."
knowledge_status: >
  UNMEASURED. D-5 is a SHOULD and not a MUST precisely because no ratified text imposes a budget and no
  measurement shows the problem exists HERE.
invariants:
  - "This work package MUST NOT begin until ICP-00's measurement is in the register."
prohibited_shortcuts:
  - "MUST NOT import the predecessor's failure as evidence about this system. That is the over-attribution the
     last programme recorded twice (REG-F-301, REG-F-302)."
```

---

## 6. Ordering

**Strictly sequential:** `ICP-00` → `ICP-02` → `ICP-04`.
**`ICP-01` MAY run concurrently with `ICP-02`** — the template object and the manifest touch different planes.
**`ICP-03` MUST follow `ICP-02`** (§4).
**`ICP-05` MUST NOT begin** until `ICP-00`'s measurement is recorded.

---

## 7. Exit criteria

1. A composed prompt's size and composition are recorded durably and survive a reload — with the SSE-only
   mutant driven RED.
2. An instruction template is authorable, versioned, and declared by a PWU Type through the same mechanism
   assurance policies use.
3. `contextAssemblyPolicyId` resolves to a governed object, or the reason it still does not is a recorded
   finding rather than a silence.
4. A register entry exists for each work package recording what it discharged — **or `Discharges: none`.**
   ⚠ Checked by PARSING, not by grepping the work-package id: `JAN-SLICE` satisfied this criterion on a naïve
   check and failed it on a real one (`REG-F-312`).
5. Every predicted red in this roadmap has been OBSERVED, not asserted.

---

## 8. Risk register

- ~~**R-1. `ICP-00` cannot drive a compacting turn**~~ **WITHDRAWN — the risk rested on a mechanism JPWB does
  not have (see `ICP-00`'s open questions). REPLACED BY THE RISK IT REVEALED: this roadmap imported a
  phenomenon from the predecessor system into a test provocation, inside a document whose §4 warns against
  exactly that.** The standing risk is therefore that OTHER imported assumptions remain: every field
  `ICP-02`'s manifest records MUST be traced to something this system produces, or dropped. Two already were.
- **R-2. The measurement shows JPWB composes small prompts.** Then `ICP-03` and `ICP-05` are precautionary, and
  saying so is the correct outcome — not a reason to build them anyway.
- **R-3. `ICP-01` drifts into inventing template syntax.** `REG-D-048` left substitution open; a roadmap is not
  a ruling.
- **R-4. The surfaces get built first** because they are the visible part and the sponsor's question arrived as
  a UI question. Four fifths of this programme is engine work.
