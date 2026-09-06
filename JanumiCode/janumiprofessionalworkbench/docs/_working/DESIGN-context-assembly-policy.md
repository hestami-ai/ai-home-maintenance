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
