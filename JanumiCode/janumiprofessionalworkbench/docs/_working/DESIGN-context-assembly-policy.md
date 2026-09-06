# DESIGN — context assembly as a governed object (`ICP-04`)

**Status:** design. ✅ **D-1 GRANTED 2026-09-06**; implementation proceeds — see §6. This design exists
to make that grant a decision rather than a blank page.

---

## 1. What `ICP-04` is, and what it is not

`JAN-ICP-DR-001`'s work package **`ICP-04` — CONTEXT ASSEMBLY AS A GOVERNED OBJECT**:

> *"`contextAssemblyPolicyId` exists as a field with one writer and one constant (F-3). This gives it an object,
> an id that resolves, and **a reader**."*

⚠ **It is the CARRIER, not the memory design.** `ICP-04` makes context assembly a governed object with a reader.
It does not say what a work unit's context should *contain*. That second half — which prior artifacts, findings,
rationales and exchanges a producer is given — is what the sponsor is actually asking for, and §5 proposes it.

## 2. The measured state, with controls

| Claim | Evidence |
|---|---|
| Every binding is minted with a hardcoded id | `handlers/runtime-binding.ts:67` — `contextAssemblyPolicyId: 'ctx-default'` |
| ⭑ **`CONTEXT_ASSEMBLY_POLICY` is not a type at all** | `grep -rn CONTEXT_ASSEMBLY_POLICY` over `packages/` + `apps/` → **0 hits**. CONTROL: the same grep form finds `RUNTIME_BINDING` (1 hit in the vocab). |
| The name is coined by this programme | It appears in **exactly two files**, both ICP docs (`JAN-ICP-DR-001:61`, `DESIGN-instruction-and-context-plane.md:54,499,538`) |
| The corpus declares the REFERENCE but not the SHAPE | `…Canonical Domain Model…:1329` `contextAssemblyPolicyId: string;`; `…Persistence…:889` `context_assembly_policy_id text not null`; `…Migration…:1407` lists *"Context Assembly Service"* in a **bare list of 19 service names** with no fields |
| `memoryPolicyId` is ratified and has **no writer at all** | `objects.ts:758` `memoryPolicyId: z.string().optional()` |

⚠ **F-3's phrasing is true but reads wrongly**, and a reader would build on the wrong picture. *"`CONTEXT_ASSEMBLY_POLICY`
… return 0 as object types"* sounds like a declared type with no instances. There is **no type**. Querying
returns 0 because nothing could ever have been stored.

## 3. ⛔ Why this cannot be built as wiring

`ICP-04`'s exit test is *"point a binding at a policy that does not exist. This MUST refuse."* With no object
type, **nothing resolves**, so that check refuses every binding in the system — which is the first horn the
roadmap itself names:

> *"a fail-closed default breaks every existing binding; a permissive seed reproduces the vacuous route."*

⭑ **And there is no third horn that avoids the shape.** I looked for one: seeding a *real but minimal* policy
still requires the object to have fields. Every route to a resolving id passes through minting a governed
object type the ratified corpus does not define.

## 4. The proposed shape — CORRECTED after measurement

⚠⚠ **MY FIRST DRAFT OF THIS SECTION SHIPPED THE DEFECT IT WARNS ABOUT, and the vocabulary caught it.** I
proposed a `fate` union spelled `PROPAGATED | RETAINED_AT_PARENT | INAPPLICABLE | WAIVED | SUPERSEDED`. Two
ratified sub-types already exist:

- **`ConstraintDisposition`** — *"DEC-4 (DOC-003:224) made carriable. The five fates are QUOTED FROM CANON, not
  invented, and the union is CLOSED"*, spelled `PROPAGATED | RETAINED_AT_PARENT | INAPPLICABLE_WITH_RATIONALE |
  WAIVED_THROUGH_AUTHORITY | SUPERSEDED_BY_STRONGER`.
- **`ContextSpecification`** (on `PWU_TYPE`, added by `JAN-PROMPT`) — `requiredElements: string[]` +
  `constraintDispositions: ConstraintDisposition[]`.

⭑ So my union was a **second, differently-spelled copy of the ratified five** — `REG-F-353`'s *"a second way to
say one thing is how restated vocabulary comes to disagree"*, which §4 of this very document had invoked against
a sixth member. Corrected before any vocabulary was written.

### 4.1 What is actually missing

The two existing carriers say **what a type needs** (`ContextSpecification.requiredElements`) and **what became
of each mandatory constraint** (`ConstraintDisposition`). Neither says **which sources a deployment permits a
producer to be given**. That is the policy's job, and it is the only new thing:

```
CONTEXT_ASSEMBLY_POLICY
  policyId          string
  permittedSources  ContextSourceRule[]   // REQUIRED, possibly empty — an empty list is a CLAIM
                                          // ("this deployment assembles nothing"), an absent one says nothing

ContextSourceRule
  source  'RENDERED_INSTRUCTION' | 'PRIOR_WORK_PRODUCT' | 'PRIOR_REVIEW_FINDING' | 'PRIOR_RATIONALE'
  scope   'THIS_TRY' | 'THIS_WORK_UNIT' | 'THIS_UNDERTAKING'
```

⛔ **No `VOLUNTEERED_REASONING` source, and no `fate` field.** The first because `REG-Q-077` is OPEN and the slot
must not exist before the permission. The second because `ConstraintDisposition` already carries it — this
policy governs *sources*, not constraint fates.

⭑ **Every `source` member is drawn from the participating half** that `REG-Q-077`'s own table marks readable
now — so the union cannot express an unlawful assembly.

## 5. ⭑ What the policy should SAY — the sponsor's memory vision, expressed

This is the half `ICP-04` does not itself cover, and it is why the object is worth having.

`REG-Q-077`'s table settles what is readable **now**: the participating half — materialized inputs, answer
spans, artifacts, assessments, observations, §9.7 rationales — and reading it is *"`REG-D-050` **performed**,
not a new permission."* Enforced at `exchange-resolution.ts:218-225`, keyed on the stored class.

So a policy that says

```
permittedSources: [
  { source: 'RENDERED_INSTRUCTION',  scope: 'THIS_TRY' },
  { source: 'PRIOR_REVIEW_FINDING',  scope: 'THIS_WORK_UNIT' },
  { source: 'PRIOR_RATIONALE',       scope: 'THIS_WORK_UNIT' },
  { source: 'PRIOR_WORK_PRODUCT',    scope: 'THIS_WORK_UNIT' }
]
```

is **lawful today**, needs no new permission, and would reconstruct a producer's working context **from the
governed stream** rather than from a process-local session — which is `DOC-002:150-151`'s rule:

> *"Projections, chat transcripts, and **agent memory** are inputs, records, or renderings — **never the
> authority**."*

⭑ That is the sponsor's point, and it makes the held Pi session what it should always have been: a *rendering*
of a policy-declared, stream-sourced context, not the memory itself.

## 6. ⛔ The sponsor decisions this needs

| # | Decision | Recommendation |
|---|---|---|
| D-1 | **Grant to author `CONTEXT_ASSEMBLY_POLICY`** | ✅ **GRANTED by the sponsor, 2026-09-06.** Recorded in the enum's vocab note with the corpus verification and its controls. |
| D-2 | Does `'ctx-default'` **resolve or refuse**? | ⭑ **Seed a REAL minimal policy** stating today's actual behaviour (instruction only, nothing prior). It resolves, so no binding breaks; and it is a **true statement** rather than a permissive stub, so the refusal test still fires for an id that names nothing. |
| D-3 | Should the seeded default then be **widened** to the §5 rules? | **Not in the same change.** Widening is a behaviour change to every execution; it wants its own red test and its own live run. |
| D-4 | `memoryPolicyId` — ratified, never written. In scope? | **No.** One authored type at a time; and its content is the cross-PWU question, which is larger. |

⚠ **D-2/D-3/D-4 were not answered explicitly**, so this proceeds on the recommendations above and says so
rather than reading silence as approval: a true minimal seed, no widening in this change, `memoryPolicyId`
out of scope.

⚠ **Minting a governed object type is a ratification act**, Minting a governed object type is a ratification act, not a
wiring task, and this programme's own register records what happens when authored vocabulary ships without one.

---

## 7. ⭑ `CP-04` measured — what consulting the reader actually forced (2026-09-06)

`CP-04` says *"`prepareModelInvocation` obeys the policy: it assembles only the declared elements, and records
the fates of those it did not."* Working out what that means against the shipped execution path changed three
things in this design. All three are corrections, and two of them are corrections **to `CP-03`, which I wrote**.

### 7.1 ⛔ The seeded default is a FALSE statement, and the vocab note in the same commit already said so

`CP-03` seeded `'ctx-default'` as `RENDERED_INSTRUCTION`/`THIS_TRY` **only**, on the claim that this is *"what
the code does today"*. It is not. Measured at `HEAD`:

| What the producer is actually given | Where | Since |
|---|---|---|
| the rendered instruction, this try | `run-model-step.ts:138` | `JAN-EXECRUN` |
| **prior review findings, this work unit** | `run-model-step.ts:130-138` — the findings turn | `REG-D-059` / `JAN-EXECLOOP` |
| **its own prior work product, this work unit** | the held session — `pi-executor.ts:118` `retainsHistory: true` | `JAN-EXECSESS` |
| **its own prior rationale, this work unit** | same session, same turns | `JAN-EXECRAT` |

⭑ **I did not need the code to catch this.** `ContextSourceRule.scope`'s own vocab note — authored in the same
commit as the seed — reads *"`THIS_WORK_UNIT` is what a bounded repair loop needs (`REG-D-059`)"*. The
vocabulary and the seed contradict each other **inside one commit**, and nothing could notice because nothing
consulted the policy. That is precisely the property `CP-04` exists to remove.

⚠ **This is NOT `D-3`.** `D-3` is *widening the seeded policy to draw prior work from the STREAM* — a behaviour
change to every execution, still not taken. This is the opposite: the behaviour is untouched and the **claim**
is corrected to match it. The code was right (`REG-D-059` is a sponsor decision, landed and tested); the
statement about the code was wrong.

**Corrected seed** — and it still has teeth, because `THIS_UNDERTAKING` is permitted for nothing:

```
{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY'        },
{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT'  },
{ source: 'PRIOR_WORK_PRODUCT',   scope: 'THIS_WORK_UNIT'  },
{ source: 'PRIOR_RATIONALE',      scope: 'THIS_WORK_UNIT'  }
```

The session is opened and disposed **per work unit** (`+page.server.ts:991,1133`), so nothing crosses into a
second unit. `THIS_UNDERTAKING` is the falsifiable boundary that survives the correction.

### 7.2 `permittedSources` is a CEILING, not an obligation — so the consultation is a subset check

The vocab note settles it: *"WHICH SOURCE a deployment **permits** a producer to be given"*. So the rule is

> everything the step will place in front of the producer must be **within** the permitted set — otherwise refuse.

⭑ **`RENDERED_INSTRUCTION` is itself checked**, which is what stops the check being vacuous on the common path:
a policy with `permittedSources: []` — the empty list the field's note calls *"a CLAIM"* — refuses every
invocation, which is exactly what that claim should mean.

⛔ **The refusal must precede the render**, on the sponsor's own ordering argument at `prompt-render.ts:8-12`:
*"the disclosure arrives after the harm. Refusing is the only order that works."*

### 7.3 ⚠ `CP-04`'s second predicted red is ALREADY DISCHARGED — by a stronger mechanism, under a sponsor ruling

`CP-04` predicts *"omit an element without recording its fate → `DEC-4`"*. For **template placeholders** that
is already enforced, and by **refusal** rather than disposition: `renderPromptTemplate:66-71` refuses when the
assembled context supplies no value for a declared placeholder, and its docblock records the sponsor declining
the alternative on 2026-09-04. Building a disposition path for the same omission would be a second way to say
one thing (`REG-F-353`) **and** would soften a ruling the sponsor made. It is not built.

⭑ **What IS genuinely unenforced is one layer up**, and it needs the other no-reader slot. `PWU_TYPE.contextSpecification`
declares `requiredElements` — what the TYPE requires in its context — and **nothing reads it**. A type may
require an element its own template never declares: `assembleStepContext` walks `declaredPlaceholders`, and
`renderPromptTemplate` checks declared-vs-supplied and text-vs-declared. Neither ever looks at
`requiredElements`, so such an element is silently absent. That is `DEC-4`'s *"context omission"* with nothing
watching.

The remedy is the canonical one, using only ratified carriers: an omitted required element must be
**dispositioned** in the same `contextSpecification.constraintDispositions` the type already carries, or the
invocation refuses.

⚠ **And this does NOT re-open 2026-09-04.** That ruling refused *rendering a hole and disclosing it afterwards*
— disclosure arriving after the prompt reached the model. A `constraintDisposition` is authored **on the type**,
before any run, and is read **before** the prompt is built. Different order, and the order was the whole
argument.

### 7.4 ⛔ Where the policy id comes from, and the gap that is disclosed rather than papered

`contextAssemblyPolicyId` lives on `RUNTIME_BINDING`. The demo's execution action mints its plan inline and
activates it with `authorizedRuntimeBindingIds: []` (`+page.server.ts:951`) — **the step has no binding**. So:

- when a `RUNTIME_BINDING` names the step, its `contextAssemblyPolicyId` is used — the ratified carrier, read;
- when none does, the **host's** configured default id is used, and that is a **disclosed gap**, not a fallback
  dressed up as a resolution. Either way the id is **resolved against the store** and an id that names nothing
  REFUSES, which is `ICP-04`'s exit test now standing on the live path rather than in a unit test alone.

⛔ **Minting a binding for demo-run steps is not taken here.** `RequestRuntimeBinding` refuses an empty
capability request (N-20) and `AuthorizeRuntimeBinding` refuses an authorization granting nothing (N-22); doing
it properly is a capability-modelling exercise, not a line in this slice.

---

## 8. ⛔ `CP-04b` CORRECTED — the check read `constraintId` and ignored `fate` (2026-09-06)

Found by a general derivation of governed fields with no production reader: **`ConstraintDisposition.fate` was
on that list**, and the checker that was supposed to have given it one is the one I shipped at `CP-04b`.

```ts
const dispositioned = new Set(dispositions.map((d) => d.constraintId));   // fate never read
```

⭑ **The five fates are not interchangeable, and one of them cannot excuse an omission at all.** `DEC-4`
(`DOC-003:223`) lists them as alternatives — *"propagated (retaining authority and strength); retained at parent
level; marked inapplicable with rationale; waived through authority; or superseded by a stronger constraint."*
Four explain why something is ABSENT. **`PROPAGATED` asserts it is PRESENT.**

⚠ So a `PROPAGATED` disposition against an element the context does not supply is not a weak excuse — it is a
disposition that is **false about this assembly**, and it should refuse more loudly than a missing one, not less.

### 8.1 ⭑ The semantics are already ratified in the KERNEL, and are adopted rather than re-derived

`packages/rph-domain/src/decomposition.ts` — `checkConstraintDisposition` — already encodes what each
disposition REQUIRES to be valid:

| Kernel disposition | Its rule | Rule id |
|---|---|---|
| `PROPAGATED` | strength preserved; weakening needs authority | `RPH-CNS-001/002` |
| `RETAINED` | *"retention at parent level is always a valid disposition (§11.2)"* | — |
| `INAPPLICABLE` | **rationale AND an authority basis required** | `RPH-CNS-003` |
| `WAIVED` | authority required; an expired waiver fails | `RPH-CNS-004` |
| `SUPERSEDED` | a replacement constraint id required | — |

⛔ **AND THE CARRIER CANNOT EXPRESS TWO OF THOSE RULES, WHICH IS DISCLOSED RATHER THAN FAKED.**
`ConstraintDispositionSchema` is `{constraintId, fate, rationale?}` — three fields. It has **no**
`authorityDecisionId` and **no** `supersededByConstraintId`. So:

- `INAPPLICABLE_WITH_RATIONALE` → the rationale half **is** checkable, and the fate's own NAME demands it.
- `WAIVED_THROUGH_AUTHORITY` / `SUPERSEDED_BY_STRONGER` → their supporting facts have nowhere to live in this
  carrier. ⚠ **Not checked, and not pretended to be.** Adding those fields is a vocabulary change; asserting the
  check without the field would be the fabricated-measurement defect.

### 8.2 ⚠ And a pre-existing duplication this uncovered, recorded and NOT fixed here

`DEC-4`'s five fates are spelled **twice** in shipped code, by two different owners:

| | Spelling |
|---|---|
| `rph-domain` (kernel) | `PROPAGATED · RETAINED · INAPPLICABLE · WAIVED · SUPERSEDED` |
| `rph-contracts` (vocabulary) | `PROPAGATED · RETAINED_AT_PARENT · INAPPLICABLE_WITH_RATIONALE · WAIVED_THROUGH_AUTHORITY · SUPERSEDED_BY_STRONGER` |

⛔ This is `REG-F-353`'s shape — *"a second way to say one thing is how restated vocabulary comes to disagree"* —
and §4 of this very design missed it while congratulating itself for adopting the contracts spelling rather
than inventing a sixth. Both predate this programme, both are in use, and merging them is a cross-package
vocabulary change with its own blast radius. **Recorded as owed; not taken here.**

### 8.3 ⚠ A DISSENTING READING, RECORDED RATHER THAN RESOLVED

The triage that surfaced this defect also read the fates differently. Its agent argued that
`RETAINED_AT_PARENT` and `SUPERSEDED_BY_STRONGER` *"likewise assert the constraint still binds"* and therefore
cannot excuse an absence either — which would leave `WAIVED_THROUGH_AUTHORITY` and
`INAPPLICABLE_WITH_RATIONALE` as the only two excusing fates.

**Not adopted, and here is the argument against it.** The kernel is explicit that
`RETAINED` is *"always a valid disposition (§11.2)"*, and that a constraint relevant to no child *"is retained
wholly at the parent and needs no record"* — retention at the PARENT is precisely the case where the CHILD's
context does not carry it. `SUPERSEDED_BY_STRONGER` is weaker ground: the stronger constraint presumably ought
to be present in its place, and this carrier has no field naming it, so that cannot be checked either way.

⚠ **It is a question about what canon MEANS, not about what the code does**, so it is recorded for the sponsor
rather than settled by me. ⛔ The safe direction is clear if it is ever reopened: refusing MORE is fail-closed
and loud; excusing more is the silent omission `DEC-4` forbids. The implemented reading excuses four of five —
if that is wrong, it is wrong in the permissive direction, and this paragraph is the notice.

⭑ **What is NOT in dispute** — and is what this fix turns on — is `PROPAGATED`: every reading agrees it asserts
the constraint was carried forward, so it cannot explain an absence.
