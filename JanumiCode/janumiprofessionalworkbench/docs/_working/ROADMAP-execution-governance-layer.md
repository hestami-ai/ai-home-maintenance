# ROADMAP — `JAN-EXECGOV`: the execution governance layer

**Design:** `DESIGN-execution-governance-layer.md` · **Date:** 2026-09-08

⛔ **`EG-02` and `EG-03` are GATED ON SPONSOR DECISION `G-1`** (grant to name capability vocabulary). Minting a
`RUNTIME_BINDING` requires naming a capability; a capability is a free string the corpus never defines, so
naming one is a ratification act that the schema will not stop. Nothing there starts until that is answered.

---

### `EG-01` — the breach is FILED, before anything is built  *(needs no grant)*

A register entry recording: `STA-8` is unmet on every production execution; `RequestRuntimeBinding` has zero
production dispatch sites with its positive control; both activation sites pass `authorizedRuntimeBindingIds:
[]`; the `OUT_OF_SCOPE` fall-through makes the four binding checks unreachable on real work; and ⭑ **the far
larger half — the carriers canon has deliberately left open, which must NOT be wired.**

⚠ This is filed FIRST and separately because the finding stands whether or not `G-1` is granted, and because a
standing breach of a ratified invariant should not wait on a build.

---

### `EG-02` — a step that runs has an authorized binding  *(gated on `G-1`)*

| Mutant | Must redden |
|---|---|
| mint the binding but never authorize it | `STA-8` — *"authorized* Runtime Bindings", not merely requested |
| leave `authorizedRuntimeBindingIds: []` while naming a binding on the step | ⚠ the withdrawn-limb trap: `REG-005` records that refusing on this list produced *"an UNRECOVERABLE WEDGE"* — the plan cannot be re-activated. Any use of the list must be reachable-from-here, and the test must prove a step can still start |
| name a capability the step does not need | the capability test — `N-20` refuses an empty request; an inflated one is the opposite failure and nothing catches it |
| **CONTROL** | a step with NO binding still starts — `OUT_OF_SCOPE` stays reachable, or every existing plan becomes unstartable (the disclosed reason the fall-through exists) |

---

### `EG-03` — the binding's four checks become REACHABLE, proved  *(gated on `G-1`)*

The point of `EG-02` is not the object; it is that `bindingAuthorityVerdict`'s live limbs stop being dead code.

| Mutant | Must redden |
|---|---|
| bind a step to a binding authorized for a DIFFERENT step | `WRONG_STEP` — currently unreachable in production |
| execute against a `REVOKED` binding | the revocation limb — §22.1: *"Revoked bindings cannot be used for new attempts"* |
| **CONTROL** | the happy path completes, so this is not "refuse every execution" |

---

### `EG-04` — a form key nobody can set stops widening governance  *(needs no grant)*

⚠ **RE-AIMED 2026-09-08 AFTER MEASURING — see `DESIGN` §5b.** This item was written to disclose *"eleven
settable-but-unread fields"*. Re-derived from code, the surface's live defect is the **inverse**: a form key with
a reader and **no control**, whose empty default is truthy and therefore passes every guard on the way to the
engine. `ASSURANCE_POLICY.applicableObjectTypes` — read at `policy-fields.ts:62`, emitted by no `.svelte` file
in this repository's history — makes every UI-authored policy universally applicable, driven and confirmed
against the engine (`NOT_APPLICABLE` → **`REQUIRED`** on a rename).

⛔ **AND THE ORIGINAL ITEM IS NOT SUPERSEDED BY IT.** Four adversarial readers refuted the tidy conclusion that
one census overturned the other: the two measure different populations, overlapping on **0 of 11 names**. The
disclosure work is real and moves to `EG-05`.

| Mutant | Must redden |
|---|---|
| restore `applicableObjectTypes: []` on the edit payload | the round-trip test — a rename must not change what a policy applies to. ⭑ The assertion is the **applicability outcome**, not the field: asserting the field alone passes on the day someone "fixes" it by writing `[]` into both places |
| swap the fixed guard back to bare truthiness (`f.x ? … : {}`) | the same test — this is the exact live shape, and `[]` is truthy |
| drop `applicability` from `successorPolicyPayload` | the successor test — versioning a kind-scoped policy must not unscope it. ⚠ This is a SECOND live path onto the same harm, and the one that destroys the `pwuKindConditions` arm that is currently the only reason the twelve catalog policies are safe |
| add a `form.get('newThing')` with no control | the surface gate below |
| **CONTROL** | a policy whose scope the author never touches keeps it — the kernel's *"scope untouched by this edit"* limb (`assurance.ts:340`) must become REACHABLE, not merely present |
| **CONTROL** | `version` — a reader with no control whose default is FALSY — is left alone, so the gate is not "every unmatched key is a bug" |

⚠ **THE GATE'S REACH IS STATED, NOT CLAIMED AWAY.** The derivation that found these two is blind to five reader
idioms in this app (template-literal keys, a callback reader, a line-split `.getAll`, `getAll` itself, dynamic
`name={…}` emitters) and was right here **only by cancellation** — each blind spot paired a missed reader with a
missed emitter. The gate must either analyse the idiom or **DECLARE** it, in the recorded-fail-open shape
`SPEC-001-NF-32` requires; a silent skip is the defect one level up. Controls must prove it SEES the dynamic
pairs it declares.

---

### `EG-05` — the authoring surface stops presenting unread settings as control  *(needs no grant)*

⭑ The sponsor's own case, and `EG-04`'s original subject, now stated against measurement rather than against a
recorded list. **MEASURED 2026-09-08** across the eight controls of the Assurance Policy form, by reading every
production site of each name and separating a CONSULTATION from a copy:

| control | disposition | evidence |
|---|---|---|
| `name` · `purpose` | ⭑ read by a PROFESSIONAL — rendered on the policy card | `+page.svelte` card meta |
| `criteria` | ✓ consulted — assessed, and its severity decides the disposition | assessment path |
| `independenceRequirement` | ✓ consulted | `assurance.ts:2198`, a real comparison |
| `permittedControlActions` | ✓ consulted | `assurance.ts:149`, `:1855` — subset validation |
| `evaluatorRole` | ⛔ **NOT consulted** | 45 production sites, every one an assignment or a projection |
| `rationale` | ⛔ **NOT consulted** | three sites, all `String((x.state.rationale ?? '') as string)` view projections |
| `evaluatedClaimTypes` | ⛔ **NOT consulted for a policy this surface can author** | its one reader copies it into a FLOOR policy's finding definitions (`floor-policies.ts:88`), and floor policies are seeded and locked |

⛔ **The remedy is DISCLOSURE, not wiring.** `evaluationMethod`'s absent reader is **already filed**
(`REG-F-243`, OPEN), so wiring here would re-file a finding this register has answered.

⚠⚠ **AND THE OBVIOUS GATE IS ALREADY DEFEATED — MEASURED, NOT FEARED.** A gate that derives "consulted" by
looking for the field name in a conditional reports `evaluatorRole` and `evaluatedClaimTypes` as CONSULTED at
HEAD, because `EG-04`'s own `policyEditPatch` added `if (f.evaluatorRole)` — a presence guard, not a
consultation. **The commit that fixed their sibling would silence the gate for them.** So the disposition is
DECLARED, and the declaration is made falsifiable instead: a `consulted` claim must name a file and QUOTE the
reader, and the gate fails if that quote is not in that file. A quote rather than a line, because
`REG-005` already records that line citations rot.

| Mutant | Must redden |
|---|---|
| add a control to the policy form and declare no disposition for it | the population pin — derived from the markup, never hand-listed |
| flip a `NOT consulted` field to `consulted` with an invented reader | the quote check — the claim must resolve in the named file |
| delete a disclosure's rendering from the markup while keeping the text | the render check: a declared disclosure a professional cannot see is the fiction this item exists to end |
| **CONTROL** | `independenceRequirement` and `permittedControlActions` are consulted and get NO disclosure — two of them, on the same form, so this is not "label everything" |
| **CONTROL** | a professional actually SEES a disclosure in the browser (playwright), because a note that renders only in a unit test discloses nothing |

⚠ **Its reach is stated, not claimed away:** the gate checks that a declaration EXISTS, is falsifiable, and is
rendered. It cannot judge whether a reader is *meaningful*, and it does not try — that limit is in the gate's
own header, and it is why the dispositions above cite what they cite.

---

### `EG-06` — the PWU Type form's help stops claiming governance that does not exist  *(needs no grant)*

⭑⭑ **THIS IS THE HARDER HALF OF `EG-05`, AND THE DEFECT IS THE OPPOSITE ONE.** The policy form had bare labels
and no help. The PWU Type form **already has help** — `PWU_TYPE_HELP`, single-sourced and rendered — and
measurement says **five of its strings claim a guarantee the code does not make**. A field with no explanation
leaves a professional uncertain; a field whose explanation is false leaves them confident and wrong.

**MEASURED 2026-09-09** across the form's twenty controls, four adjudication lanes each attacked by a skeptic:
**15 CONSULTED · 3 RENDERED_ONLY · 1 NOT_CONSULTED · 5 whose help OVERCLAIMS.**

| control | verdict | the overclaim |
|---|---|---|
| `completionRule` | ⛔ **RENDERED_ONLY** | ⭑ **the worst of the five.** *"When an Instance of this type is DONE … Defaults to the RPH rule … (no green without assurance)"*. Nothing evaluates it — every production site is a default, a presence guard, or a projection. *"No green without assurance"* is a REAL platform guarantee, and the help attaches it to an inert textbox |
| `permittedChildTypeIds` | CONSULTED | *"which PWU Types **may be** decomposed UNDER this type — the **allowed** composition"* reads as a permission constraint. **There is none**: the name occurs ZERO times in `rph-domain/src`, `handlers/pwu.ts` and `handlers/decomposition.ts`. It GENERATES the initial tree and feeds an `info` lint; it does not gate decomposition |
| `cardinality:<childId>` | CONSULTED | same class — it decides whether a child is instantiated, not whether one is permitted |
| `attestedAssurancePolicyIds` | CONSULTED | ⚠ the counterparty's own claim, not a verified treatment — *"disclosure is not verification"*, which the markup says beside the control and the help does not |
| `promptOutputContract` | CONSULTED | claims a shape the engine does not check |

⚠ **AND TWO CORRECTIONS RUN THE OTHER WAY, so this is not "every string is too strong":** `pwuKind`'s help
UNDER-states — it does not say the kind SELECTS WHICH ASSURANCE POLICIES GOVERN the instance, nor that the
server silently rewrites what is typed to SCREAMING_SNAKE. `name`'s help does not say a duplicate raises a graph
finding.

---

**⛔ TWO FINDINGS THIS ITEM FILES AND DOES NOT FIX** — each would be inventing governance:

1. **Decomposition does not enforce permitted children.** A PWU can be decomposed into a type its parent's type
   does not permit and nothing refuses. Whether it SHOULD is a ratification question, not an implementer's.
2. ⭑⭑ **The two authors of a PWU Type do not have the same surface, and the gap reaches `STA-8`.** The authoring
   AGENT cannot set `workDischarge`, `promptTemplateText`, `promptOutputContract`, `promptActive` or
   `promptTemplateVersion` — `DefineTypeInput` carries none of them and the tool schema names none of them.
   Measured: `workDischarge: 'MODEL'` is reachable **only** by a human choosing it in the form's select
   (`execution-model-invocation.e2e.ts:37`), so an agent-authored type is never `MODEL`, never gets a
   `RUNTIME_BINDING` from `stepBindingFor`, and takes `bindingAuthorityVerdict`'s `OUT_OF_SCOPE` limb —
   **the exact pre-`EG-02` condition `REG-F-365` measured.** `EG-02`/`EG-03` closed `STA-8` for the human path
   only, and that boundary was not stated at the time.

| Mutant | Must redden |
|---|---|
| restore any of the five overclaiming strings | the disposition gate — a `RENDERED_ONLY` field whose help asserts a guarantee |
| declare `completionRule` CONSULTED with an invented reader | the quote check (`EG-05`'s limb, now covering both forms) |
| add a control to EITHER form and declare nothing | the population pin, derived per form region from the markup |
| **CONTROL** | the 15 consulted controls keep their help unchanged, so this is not "disclaim everything" |
| **CONTROL** | a professional still SEES the corrected text in a browser (playwright) |

---

### `EG-07` — the two authors of a PWA see the same thing  *(sponsor-directed 2026-09-09; two decisions ANSWERED)*

**SPONSOR DIRECTION:** *"the (presumably PWA) authoring agent should be able to declare how work is discharged
and that the human reviewing the full PWA before approving its use would be the model."* Design: §7.

⛔⛔ **THE ORDER BELOW IS A SPONSOR CONDITION, NOT A PREFERENCE.** Decision `G-4` was answered *"text plus
arming, **after the review surface lands**"*. `EG-07a` therefore GATES `EG-07b`: nothing may be armed that the
approval surface cannot show. This is written here because an ordering that lives only in a memory is an
ordering that gets lost.

**ANSWERED DECISIONS.** `G-4` (how far the agent's declare-surface reaches) → **text PLUS arming, sequenced
after the review surface.** `G-5` (does discharge enter the reasoning review's subject) → **yes, add both to
`buildPwaExport`; NO new criterion** — the ratified floor policy is not edited.

---

#### `EG-07a` — the approval moment can see what it approves  ⛔ **GATES `EG-07b`**

| Mutant | Must redden |
|---|---|
| hide either field from the read-only inspector | the acceptance e2e — with a candidate STAGED, `editable` is false and the type form is gone; this is the state a human actually approves in |
| collapse the four-way distinction to a boolean | the e2e — *never asked* and *not yet decided* are different facts and the code keeps them apart |
| revert `defineFromTemplate`'s `workDischarge` line | a broker test — the blueprint's REQUIRED answer is discarded today, on exactly the path `EG-07b` opens |
| **CONTROL** | a type whose discharge IS declared renders it plainly, so this is not "warn on everything" |

#### `EG-07b` — the agent may declare, and arm  *(only after `EG-07a`)*

| Mutant | Must redden |
|---|---|
| forward a field unconditionally instead of by conditional spread | ⚠ the ABSENCE test: writing `UNDECLARED` where the agent said nothing destroys *"never asked"*, which the corpus distinguishes |
| omit `workDischarge` from `PwuTypeView` | the read-back test — an agent that cannot see what a human declared is the same defect with the arrow reversed |
| **CONTROL** | a human-authored declaration still round-trips unchanged |

#### `EG-07c` — the consequence is spoken where the author is standing

| Mutant | Must redden |
|---|---|
| make the undeclared case a REFUSAL | ⛔ the wedge test — `JAN-EXEBIND` produced *"an UNRECOVERABLE WEDGE"* and that refusal stays withdrawn |
| emit one message for both undeclared and absent | the two-message test |
| render the lint to the agent only | ⭑ the human-render test, which makes `lint.ts`'s own header sentence true for the first time |
| **CONTROL** | `DELEGATED_EXTERNAL` stays silent — its own gate already refuses any discharge value |

#### `EG-07d` — the whole-PWA reviewer sees it too  *(sponsor decision `G-5`)*

| Mutant | Must redden |
|---|---|
| leave `buildPwaExport` at 8 fields | the export test — the one assurance act that reviews the whole PWA could not assess how work is discharged |
| **CONTROL** | the REASONING_REVIEW floor policy's criteria are UNCHANGED — a ratified policy is not edited to carry a new rule |

#### `EG-07e` — the symmetry becomes checkable, with no exemption

| Mutant | Must redden |
|---|---|
| add a help key one author can read and the other cannot | the symmetry limb, in EITHER direction |
| **CONTROL** | landing it requires no exemption — `childCardinalities` and `promptActive` are repaired first, because an exemption granted on a gate's first day is how a gate rots |

#### `EG-07f` — `STA-8` closes for the AGENT path, proved end to end

⭑ `REG-F-371` recorded that `EG-02`/`EG-03` closed `STA-8` for the HUMAN path only. This is the other half.

| Mutant | Must redden |
|---|---|
| revert `DefineTypeInput` to its 12 fields | the e2e — an agent-authored plan yields a step with no `RUNTIME_BINDING`, which is exactly `REG-F-365`'s measured state |

---

## ⛔ NOT TAKEN — and this is the larger half of the design

`modelSelectionPolicy` (configuration by `REG-D-052`), `ModelSelectionPolicy`'s shape (explicitly deferred),
`memoryPolicyId`, binding declared-vs-resolved model identity (**canon requires recording the resolved one and
never binds the two**), context selection beyond `DEC-4`'s constraint limb (doctrine, no invariant), and the
four activation-condition carriers (disclosed deferral, element types undefined in the corpus).

⭑ **Each would be an implementer inventing a rule the corpus declined to make.** The register already records
the deferral for most of them.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
