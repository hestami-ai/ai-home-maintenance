# DESIGN — Step strength, and a Decision that names its subject

**Rulings on REG-F-105 and REG-F-106.** Authored 2026-08-10 under an explicit sponsor grant:
*"use your delegated authority so authorized to author solutions to the rulings … which are most consistent with
the intent and objectives of the system that must work across the three tiers of standalone, SaaS and enterprise
use cases and needs."*

The grant is recorded as **REG-D-041**. It is narrower than it looks and its bounds are stated in §6: it
authorizes me to CHOOSE among carriers the corpus already defines, and to annotate what I author as
UNRATIFIED-AUTHORED in the shape this repository already uses for `selectedTransitionId`. It does not authorize
inventing a vocabulary the corpus lacks, and §6 names the two places I stopped for that reason.

---

## 1. Both rulings are the same defect, which is why they are decided together

They arrived as unrelated items of `ROADMAP-decision-subject-scope` (S-2 and S-3). They are one shape:

> **A governed act was recorded without the fact that makes it governed, and the missing fact was supplied — or
> not supplied — by the party the rule constrains.**

- **REG-F-105:** §21.1 governs skipping a *mandatory* step. Nothing records which steps are mandatory, so
  `canSkipStep` reads `p.mandatory ?? true` **out of the skipper's own request payload**.
- **REG-F-106:** ASR-15 binds a Decision to *exact subjects and versions*. `/decisions` proposes with
  `subjectObjectIds: []`, so the record names nothing and authorizes nothing, while the surface offers eight
  decision types as though it did.

In both, the repository is fail-closed in form (`?? true`; a subjectless decision satisfies no scope gate) and
hollow in substance. The correction in both is the same: **move the load-bearing fact onto a stored, versioned,
authority-set object, and make the gate read it there.**

This repository has already written that principle down, about a sibling field, in the module this ruling
touches — `execution.ts:869-873`, on why `runtimeBindingId` is read from the step and not from the command:

> *"a step's `runtimeBindingId` is fixed when the plan is authored and approved, so the producer must read it
> from the step rather than accept it from the caller. Taking it from the command would create a second, later,
> unauthorized source of truth for a fact the approved plan already settled."*

`mandatory` is that sentence's own counter-example, sitting nine hundred lines below it.

---

## 2. RULING 1 — `ExecutionStep` gains `strength: ObligationStrength`

### 2.1 What was wrong with how I escalated this

Two corrections to REG-F-105 land with this design, both against me:

**(a) It is not a new question.** `JAN-EXECPLAN-DR-003:41` (2026-07-24) already found it, in terms:
*"`canSkipStep({mandatory, hasAuthorizedWaiverOrRevision})` needs `mandatory`, which has **no source on the
step** (no contract field) … Disclosed: mandatory-ness is caller-asserted until a step-level field is
ratified."* Line 225 defers *"a step-level `mandatory`/`ordinal` contract field"* as a named 3C-ii item. I
escalated as novel a question this programme had already disclosed and deferred. My own standing rule —
grep the register before escalating — failed because I searched the register and not the design corpus one
directory over.

**(b) The corpus is not silent; it gestures.** My grep was for `mandatory:` as a FIELD, which is a claim about
my search. The concept is defined **five times** under other spellings:

| Site | Spelling | Values |
|---|---|---|
| RPH-DOC-002 §10.1 `Obligation.strength` | `strength` | MANDATORY · CONDITIONAL · ADVISORY |
| RPH-DOC-002 §11.1 `Constraint.strength` | `strength` | MANDATORY · PREFERRED · ADVISORY |
| CPCO | `enforcementLevel` | — |
| JSDL `CompletionCondition` | `mandatory: Boolean` | — |
| `ApplicabilityOutcome` | — | REQUIRED · RECOMMENDED · OPTIONAL |

**In every one of them the strength is a declared property of a governed object, set by an authority, and in
none of them is it a claim made by the party performing the act.** That is the corpus's answer to the *shape*
of the question, and it is unanimous. What the corpus does not do is attach such a property to `ExecutionStep`.

### 2.2 The three candidate carriers, and why the corpus picks one

**(a) Declared `strength` on the step, fixed at plan proposal.**
**(b) Derived — mandatory iff the step discharges a MANDATORY obligation / invokes a REQUIRED policy.**
**(c) `mandatory: Boolean` set at plan proposal (the JSDL spelling).**

**The rule's own remedy selects (a).** §21.1 does not say "requires a waiver"; it says *"requires an authorized
**plan revision** or waiver."* A plan revision is the act that changes the plan. **A remedy of "revise the plan"
is only coherent if the mandatoriness is a fact OF THE PLAN.** Under (b) the remedy would be to revise the
*obligation*, and revising the plan would change nothing. Under a caller-asserted reading the remedy would be
unnecessary — you would simply assert `false`. The ratified sentence therefore already tells us where the fact
lives, and it has been telling us since before the field was missed.

**(c) is refused by ratified canon, twice, and by this repository's own precedent.** Guide §16 item 12 (L2509)
and REG-Q-012's safe default (register L234): *"**Never implement waiver as a Boolean** — require a
version-bound Decision with scope, expiry, rationale, controls, and the preserved finding."* And this
repository has already applied that lesson at a sibling site: `assessment-criterion-contract.test.ts` records
that `AssessmentCriterion` shipped an invented `{id, statement, mandatory}` in which *"a FIVE-level
`severityIfNotMet` [was] collapsed into a Boolean — the same disease §16 item 12 names for waivers"*, and the
ratified shape replaced the Boolean with a graded enum. **`mandatory: boolean` on a step is that same collapse,
one object over.** The migration there mapped `mandatory:false → ADVISORY`; this design uses the same word.

**(b) is right about something, and it is not the carrier.** "A step discharging a MANDATORY obligation should
not be markable ADVISORY" is a real rule — but it is a **consistency check at plan proposal**, over a declared
field, not a replacement for declaring it. Made the carrier, it would be a derivation with no author and no
authority, and no way to express a step that is mandatory for a reason the obligation graph does not carry
(a regulator's procedure, a customer's contract term). §5 puts (b) where it belongs.

### 2.3 The decision

**`ExecutionStep.strength: ObligationStrength`** — `MANDATORY | CONDITIONAL | ADVISORY`, optional in the
schema, **absent ⇒ MANDATORY** at the gate.

1. **The enum is reused, not minted.** `ObligationStrengthSchema` already exists, generated, exported and
   registered (`enums.ts:542`), sourced to RPH-DOC-002 §10.1. Minting a new two-valued enum for this field
   would be the invention the corpus-precedence ruling (REG-D-034) exists to prevent.
2. **The field name is the corpus's word.** Obligation and Constraint both spell it `strength`. A third
   spelling on a third object is how four restatements of `AssessmentCriterion` came to disagree.
3. **Optional, not required — and that is fail-closed, not fail-open.** `ExecutionStepSchema` is a
   `strictObject`; making `strength` required would refuse every plan authored before today, including the
   seeded reference undertaking. Optional-in-schema with **`(step.strength ?? 'MANDATORY') !== 'ADVISORY'`** at
   the gate means a legacy step is treated as MANDATORY and needs an authorization to skip — the same posture
   `?? true` had, now defeasible only by a declaration on the plan instead of a sentence in the request.
4. **`CONDITIONAL` gates exactly as `MANDATORY` does, and says something `MANDATORY` cannot.** No ratified
   applicability predicate exists (the Guide defers the structured predicate to M7/M9/M11), so there is nothing
   to evaluate the condition against. Guide §8.4 L844 settles the posture: *"ambiguity resolves to material."*
   CONDITIONAL therefore records the author's real meaning — *mandatory when X holds* — and is skippable only
   with an authorization until X is machine-evaluable. **Only `ADVISORY` is freely skippable.**
5. **`SkipExecutionStepPayload.mandatory` is REMOVED.** This is the ruling's whole point and the only change
   that cannot be half-made. Guide §8.4 L844: *"the producer cannot exempt its own output."* `p.mandatory` read
   from the skipper's payload **is** a producer exempting its own output. Leaving the field as a fallback would
   leave the bypass; `strictObject` turns a stale caller into a schema refusal, which is the loud failure.
6. **The ratified kernel is not touched.** `canSkipStep({mandatory, hasAuthorizedWaiverOrRevision})` keeps its
   signature. The handler stops passing an assertion and starts passing a **resolved fact** derived from the
   step the plan already settled — precisely the move `resolveSkipAuthorization` made for the other input when
   `!!p.waiverOrRevisionId` meant `'x'` could retire a mandatory step.

**Who sets it, and when.** The plan author, at `ProposeExecutionPlan`, on the step. It is thereafter part of an
approved, versioned plan and changes only by authorized plan revision — which is the remedy §21.1 already
names. The skipper cannot set it, and after this change cannot mention it.

### 2.4 Why this holds across all three tiers

The sponsor's condition is that the answer work standalone, SaaS and enterprise. This is where a Boolean in the
request payload fails hardest and where (a) is clearly right rather than merely defensible.

- **Standalone — one professional authors and executes.** There is no second party, so the separation cannot be
  organisational; it is **temporal and recorded**. The author declares strength at proposal, before the moment
  of temptation exists, and the declaration is inside a versioned object. Changing it later is a revision and
  leaves a trace. A per-skip Boolean has neither property: it is authored at the instant of the skip, by the
  skipper, and is not even recorded — the handler's own comment notes that `mandatory` *"does not ride the
  event"*, so the one tier with no second pair of eyes was also the tier where the assertion vanished entirely.
- **SaaS — multi-tenant, and the audit trail is the product.** "Who declared this step optional, and when" must
  be answerable from stored state months later, per tenant, without replaying request bodies. A field on a
  stored plan answers it; a transient payload flag cannot, at any price.
- **Enterprise — the authorizer is not the actor, and org policy constrains the author.** An enterprise needs
  to say *"steps discharging a MANDATORY obligation may not be marked ADVISORY"* and *"only role R may propose
  a plan with ADVISORY steps."* Both are checks over a **declared field on a proposed object**, evaluable at
  plan approval, before execution. Neither is expressible over a Boolean that appears for the first time inside
  a skip request that has already been authorised to execute. This is also the tier that needs `CONDITIONAL`:
  regulated work is full of steps that are mandatory *unless* an exemption applies, and collapsing that to
  `false` at skip time is exactly the laundered de-scoping STA-8's WHY names.

### 2.5 What this ruling does NOT decide

- **It does not author a plan-completion rule.** `packages/rph-domain/vocab/m11-execution.json:37` glosses
  `COMPLETED` as *"All required steps reached terminal success; plan finished."* with
  `sourceRef: "§20.1; Contract §15"`. **RPH-DOC-002 §20.1 states no such thing** — verified: §20.1 is the
  `ExecutionPlan` interface and a bare status enum with no per-value meanings, and the only corpus hit for the
  phrase family is a *contrary* sentence in the Assurance Policy Catalog (L2199: *"A baseline cannot be
  promoted solely because all execution steps completed."*). That gloss is an **authored attribution to a
  source that does not carry it** — a second, independent consumer of the undefined notion of a "required
  step", found only because this ruling went looking. It is recorded as a provenance defect (REG-F-107) and its
  `sourceRef` is corrected to disclose the authorship. **No completion rule is implemented**, because none is
  ratified; what changes is that "required" now has a definition to point at when one is.
- **It does not ratify.** §6.

---

## 3. RULING 2 — the `/decisions` propose form names its subject

### 3.1 Both options I put to the sponsor were wrong

I asked: *remove proposing, or keep it scoped to the three decision types no gate reads?* An adversarial sweep
of the corpus refuted both, and I verified every citation by hand afterwards.

**Removal has no warrant, and the corpus twice says the opposite.** SPEC-001 L2915, as an INV-02
**NON-EXAMPLE**, blesses *"a Decision Center listing governance acts across the whole workbench"* — each such
surface being *"legitimate and conformant"* — and CONFIRMS that `/decisions` and `/baselines` *"are exactly
such surfaces."* RPH-DOC-010 §4.7 (L216-218) goes past listing: the Decision Center is *"Used to **exercise
authority** over versions, waivers, escalations, and acceptance."* **Exercising authority is authoring.**

**Scoping to three types is refuted by the contract.** `subjectObjectIds: string[]` is a **required** field of
`interface DecisionObject` in **both** ratified contracts — CDM §23.1 L1373, and the Contract Package §22 L1632
(which adds a required `subjectSemanticVersions`) — and `'PROPOSED'` is a status of that same interface. There
is **no subjectless Decision shape, in any status, of any type.** My "three exempt types" premise was a fact
about *our gates*, not about the corpus: I read the absence of a scope check as the absence of a requirement.
That is REG-F-102's lesson repeating four days later.

One nuance the refuter was right to press: a *required key* does not by itself forbid `[]`. **OBJ-1**
(JPWB-DOC-003 L105) closes it: *"No semantic state may be inferred from null values, **empty arrays**, missing
rows…"*, with its SCOPE at L107 — *"requiredness is justified only where absence would cause semantic
ambiguity, never by implementer convenience."* An empty `subjectObjectIds` is not "a decision about nothing";
it is a decision whose subject cannot be inferred, which is what ASR-15 calls *"not authority — provenance at
best."*

### 3.2 The decision

**Repair the form.** `/decisions` keeps proposing, and a proposal must name at least one subject.

1. **`subjectObjectIds` is required by the surface**, selected from a **subject catalog** the route renders:
   every governed object in the workspace, with its id, type, name and current semantic version. The catalog is
   **derived from the contracts' object-type registry**, not hand-listed — hand-listing the types is the
   enumeration defect one level up.
2. **Empty selection is refused at the surface with a reason**, not silently accepted. The engine would refuse
   it downstream at the scope gates for five of eight types and accept it for three; a surface that mints a
   record three of eight gates will never find is the hollow this ruling is about.
3. **`approve` stops sending `subjectSemanticVersions: {}`.** It states the versions **read from the store at
   approval time**, exactly as S-0's baseline authorization does. The handler compares them to the pin taken at
   propose, so if the subject moved between proposal and approval the approval is **refused as stale** — which
   is ASR-15's *"A decision approving version n never authorizes version n+1"* becoming operative on this route
   for the first time. Today `{}` makes that comparison vacuous.
4. **The disclosure shipped with REG-F-106 is rewritten, not kept.** It currently tells the professional the
   form *"authorizes nothing."* Once the form names a subject that is **false**, and a stale warning on a
   repaired surface is worse than none. It is replaced by what remains true: that an EFFECTIVE decision is a
   standing, version-bound authority which the acting surface will find and honour.
5. **`WAIVER` stays absent from the offered types.** Unchanged and for the unchanged reason: `ProposeDecision`
   cannot carry DOC-004 §12.2's `WaiverDetail`, so a waiver minted here could discharge nothing. `RequestWaiver`
   is the authoring path.

### 3.3 Why this holds across all three tiers — the lens that settles it

The retire-vs-keep question looked balanced because I was weighing it in one tier. Across three it is not close.

- **Standalone.** The professional authorizes and acts. The natural path is the atomic one S-0 and S-1a built:
  propose + approve + act in a single dispatch, beside the object. Here the Decision Center is mostly the
  **register** — and proposing is still needed for the acts that have no dedicated surface (`ESCALATION`,
  `RESHAPE`, `REVOKE`).
- **SaaS.** Same shape, plus the register is the tenant's audit surface and the thing an auditor is shown.
- **Enterprise — this is the tier that decides it.** The authorizer is *not* the actor. A governance role, who
  will never open the Undertaking Workbench, mints and approves a subject-bound decision **centrally**; the
  professional later acts, and the gate — `resolveAbandonAuthorization`, the promotion resolver — **finds the
  standing authorization** and permits the act. That is the entire point of JPWB-DOC-001 §5.2 L168:
  *"Governance is an authority function **outside** the six disciplines. It alone authorizes waiver, risk
  acceptance, rejection or abandonment of governed work, and promotion. No discipline may absorb it."*

  **Removal would work in standalone and break enterprise**, by making the only way to authorize an act the act
  itself — that is a discipline absorbing governance, in the sentence's own words. And a subjectless propose
  is worse than removal: it *looks* like the enterprise path and cannot be it.

This also dissolves the circularity I recorded in REG-F-106 (*"if propose goes, `approve` has almost nothing
left to act on"*). Approve is not a leftover. **Propose-then-approve, subject-bound and separated in time, IS
the enterprise authorization flow**, and the atomic path is the standalone convenience over it.

### 3.4 The hazard this creates, stated rather than discovered later

An EFFECTIVE `ABANDON` decision minted centrally is **a standing permission to discard someone's work** — the
exact hazard S-1a avoided by making its three commands atomic. The difference is deliberate and bounded:

- **It is version-bound, and the bound is enforced.** `resolveAbandonAuthorization` requires the decision to
  bind the PWU's **current** semantic version (ASR-15). The moment the PWU changes, the standing authority
  stops resolving. Verified in code, not assumed.
- **It is visible.** The Decision Center lists every EFFECTIVE decision, which is what makes a standing
  authority reviewable and `RevokeDecision` actionable.
- **The atomic path stays** for the tier that wants no standing authority at all.

A time-bound expiry would narrow it further. **I am not adding one**: expiry is required by REG-Q-012's safe
default for *waivers*, ASR-15 requires it of no other decision type, and inventing an expiry field on
`DecisionObject` is exactly the unratified invention §6 forbids. It is recorded as an open question instead.

---

## 4. What the two rulings share, as a rule for next time

> **A gate whose input is supplied by the party it judges is not a gate.** The corpus never carries strength or
> subject as a claim by the actor; it carries them as declared properties of stored, versioned, authority-set
> objects. When a required fact has no home on such an object, the defect is the missing home — not the missing
> check.

Both fixes are the same edit: **read the fact from the object the authority already settled.**

---

## 5. Deliberately not built

- **Obligation-consistency at plan proposal** (candidate (b) in its proper place): refusing a step marked
  ADVISORY that discharges a MANDATORY obligation. It needs `strength` to exist first, and it needs a ratified
  statement that the two must agree — which the corpus does not currently make. Recorded as owed.
- **A plan-completion rule over "required steps"** — §2.5.
- **Expiry on non-waiver decisions** — §3.4.
- **Rejection (S-1b)** — unchanged: it needs a real blocking-observation capability, not a shortcut that
  manufactures the guard's own input.

---

## 6. Ratification status — what is authored under grant, and what is still owed

`ExecutionStep.strength` is a change to a **ratified contract** (RPH-DOC-002 §21). The sponsor's grant
authorizes authoring it; it does not make it ratified. It is therefore annotated in the vocabulary exactly as
`selectedTransitionId` was — **`UNRATIFIED-AUTHORED (annotated 2026-08-10 under sponsor grant REG-D-041)`** —
with the reasoning above compressed into the note and *"Ratification pending."*

**And the annotation must not become the reason nothing fires.** This repository has been burned by precisely
that: an "unratified" marking was once the mechanism that DISABLED a check. So the acceptance condition for
this increment is **behavioural, not declarative** — the skip gate must refuse a MANDATORY-by-declaration step
and accept an ADVISORY one, proved by a mutant that reddens a named test, and `SkipExecutionStepPayload` must
no longer accept `mandatory` at all. A field that is authored and unread would be this design failing.

**Owed to governance** (unchanged by the grant, and now narrower and better-evidenced than REG-F-105 was):

1. Ratify `ExecutionStep.strength` into RPH-DOC-002 §21, or name a different carrier.
2. Rule on whether step strength must agree with the obligations the step discharges (§5).
3. Settle the `COMPLETED` gloss: either ratify a "required steps" completion rule in §20.1, or strike the
   attribution (REG-F-107).
4. Rule on expiry for non-waiver decisions (§3.4).

Items 2–4 are recorded as OPEN and are not blocking: each is a narrowing of a rule this design implements
fail-closed, so a later ratification can only relax them.
