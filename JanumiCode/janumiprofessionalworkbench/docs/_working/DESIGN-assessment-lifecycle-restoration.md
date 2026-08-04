# Assurance Assessment lifecycle — restoring the three skipped states (REG-F-021)

> **Status: DESIGN. No code accompanies it.** This records the ratified target, the measured current state, the
> one blocker that had to be resolved before the increment could be called feasible at all, the blast radius, and
> the decisions that remain. It is written because the increment is a domain change — two new commands, two new
> event contracts, and a re-sequencing of every caller that today requests-and-starts in one dispatch — and this
> repository's practice is design → roadmap → implementation, never straight to code.
>
> **Revised 2026-08-04 after adversarial re-checking (§8).** Five load-bearing claims were put to independent
> verifiers told to refute rather than confirm. **Two stood and were widened; three needed narrowing**, one of
> which (§5.4) changes the build order. Three of the four "open decisions" turned out to be measurable questions
> rather than decisions. Every correction is recorded in place rather than silently rewritten.

---

## 1. The ratified target

`packages/rph-domain/src/transitions.data.ts`, machine `AssuranceAssessment.state`, verbatim:

| from | to | trigger | guard |
|---|---|---|---|
| `REQUESTED` | `EVIDENCE_PENDING` | `AssuranceAssessmentRequested`; claims instantiated, evidence requirements evaluated, missing evidence requested (`AssuranceEvidenceRequired`) | one or more required EvidenceRequirements not yet satisfied |
| `EVIDENCE_PENDING` | `READY` | `submitEvidenceForAssessment` (`AssuranceEvidenceReceived`) | all required evidence present and admissible per §6.2 |
| `READY` | `ASSESSING` | `selectAssuranceEvaluator` (`AssuranceEvaluatorSelected`) **then** `beginAssuranceAssessment` (`AssuranceAssessmentStarted`) | — |
| `ASSESSING` | `SATISFIED` / `CONDITIONALLY_SATISFIED` / `REJECTED` / `INCONCLUSIVE` / `ESCALATED` | `completeAssuranceAssessment` | per outcome |

The lifecycle is **ratified**. This is not an elicitation item, and REG-F-021 first recorded it as one — that
record was a claim about a search, corrected in place.

## 2. The measured current state

`requestAssuranceAssessment` (`handlers/assurance.ts`) creates the assessment object with
`assessmentState: 'ASSESSING'`, `startedAt: command.issuedAt`, and emits **`AssuranceAssessmentStarted`** — the
event belonging to the *last* arrow.

Measured, not read:

* `REQUESTED`, `EVIDENCE_PENDING` and `READY` are written by **no production line** (`assessmentState: '<S>'`
  appears zero times for each outside tests).
* `AssuranceAssessmentRequested` is **declared and bound** in the vocab and **emitted by nothing** — the finding
  that started this.
* Of the four commands `completeAssuranceAssessment`'s own note calls missing, **three** are:
  `selectAssuranceEvaluator`, `recordCriterionResult`, `beginAssuranceAssessment`.
  `submitEvidenceForAssessment` **has since been built and is registered**; the note was stale in the safe
  direction and is corrected.

**What the collapse does and does not cost.** There are two evidence controls in the engine today, and they are
not in equal health:

* **Admissibility at admission — real and non-vacuous.** `admitEvidence` runs the ratified `evidenceAdmissibility`
  rule (RPH-EVD-007, with its own enforcement probe). Evidence that is admitted *is* checked.
* **Required-evidence at completion ("Gate A") — real logic, vacuous in practice.** `completeAssuranceAssessment`
  refuses a `SATISFIED` / `CONDITIONALLY_SATISFIED` disposition while a policy's mandatory evidence is unmet,
  computing required-minus-received exactly as the §38 view does. It has a test that proves it fires. But it reads
  `policy.requiredEvidence`, and **that array is empty on every policy this product can produce** (§3) — so on
  shipped policies the gate evaluates an empty set and admits everything. The test that proves it works builds its
  own policy with `requiredEvidence` explicitly; nothing shipped exercises it.

So what the collapse costs is the **ordering** the machine specifies — nothing requires admitted evidence to be in
place *before* an assessment is in `ASSESSING` — and the completion-time backstop that might have compensated is
itself waiting on REG-F-022. Stated plainly so the ordering restoration is not oversold as closing a hole it does
not close, and the vacuity is not left implied.

## 3. The blocker that had to be resolved first, and its resolution

The `EVIDENCE_PENDING → READY` guard is *"all required evidence present and admissible"*. The **de minimis floor**
recording path (`rph-engine/src/record-assurance.ts`) requests assessments with `claimIds: []` and **never submits
or admits any evidence** — zero references to `SubmitEvidenceForAssessment`, `AdmitEvidence` or `ProposeEvidence`.

Taken naively that deadlocks the floor, and the floor gates publication and step completion. It would have made
this increment infeasible rather than merely large.

**It does not deadlock, and the reason is measurable — but the measurement is much worse than "the floor is
exempt".** Probing a live seeded engine (`seedFloorPolicies` + `seedAdditivePolicies`, objects read back out of
the store rather than from the source literals):

```
POLICIES WITH NON-EMPTY requiredEvidence ON THE OBJECT:  0 of 15
ONTOLOGY seedPolicies DECLARING requiredEvidenceTypes:  12 of 12
```

> **The first version of this measurement was blind, and the number survived by luck.** The probe read
> `getObject(engine, id)?.state`; `getObject` returns the state itself, so it read `state.state` → `undefined` →
> `[]` for every policy. Promoting it to `verif/policy-evidence-requirement-census.test.ts` with a **control** —
> a policy created through the real command path carrying an `EvidenceRequirement` — reddened the control at once
> while the finding's own assertion stayed green, because a blind reader and a real gap look identical. Both
> counts are now derived by a reader proven able to see a non-empty value, and mutation-checked.

**Every policy this product can produce has `requiredEvidence: []`** — the 3 floor policies, all 12 ratified
catalog policies, and any policy authored through the UI (`createPolicy` in the demo's PWA route does not send
the field). So *"all required evidence present"* is **vacuously true everywhere**, not just on the floor path.

That is not a convenient exemption; it is a defect, filed as **REG-F-022** (§7). It changes this design in two
ways: the `EVIDENCE_PENDING → READY` arrow is trivially takeable *today* by every caller, and it will stop being
trivially takeable the moment REG-F-022 is fixed. The arrow must therefore be written for the fixed world.

> **This must be an EXPLICIT vacuous-pass, not an accident.** If the arrow is implemented as "advance when the
> required set is empty", that is a real rule with a real reason, and it keeps working when the required set stops
> being empty. If it is implemented as "advance unless something objects", every assessment passes for a reason
> nobody wrote down, and fixing REG-F-022 silently changes the behaviour of every caller at once.

## 4. What must be built

**Two commands**, both absent: `selectAssuranceEvaluator`, `beginAssuranceAssessment`.

**Two event contracts**, both absent from `EVENTS`: `AssuranceEvaluatorSelected`, `AssuranceEvidenceRequired`.

> **CORRECTED 2026-08-04.** This section first said both were *"named only in trigger prose"* and would therefore
> be **UNRATIFIED-AUTHORED under the standing sponsor grant**. That was wrong, and the error was a claim about my
> search: I looked in DOC-007 and stopped. Both are **ratified names**, listed in **DOC-004 §31 "Assurance
> Events"** (`AssuranceEvidenceRequired` L1737, `AssuranceEvaluatorSelected` L1739) alongside
> `AssuranceIndependenceVerified`, `AssuranceCriterionEvaluated` and `AssuranceAssessmentInvalidated`.
>
> **The correction needed a correction of its own, and the two events are NOT on equal footing.** §31 carries an
> explicit ruling — *"Both events are ratified **names** here but **schematized nowhere** in the corpus (DOC-007
> omits them) … So it is a schema-and-wiring task, **not** a ratification decision"* — and I first read that as
> covering both. It does not. The paragraph's subject is the §38 "missing evidence" field, and its *"Both events"*
> is **`AssuranceEvidenceRequired` + `AssuranceEvidenceReceived`**. `AssuranceEvaluatorSelected` appears nowhere
> in it (checked exhaustively: its four occurrences in DOC-004 are the §31 list, the composition bullet, and the
> §32 command list twice — none inside the ruling). `HARMONIZATION-LOG.md` spells the pair out the same way.
>
> | event | name | schema | corpus ruling on authoring it |
> |---|---|---|---|
> | `AssuranceEvidenceRequired` | RATIFIED (§31) | absent | **YES** — "schema-and-wiring, not a ratification decision" |
> | `AssuranceEvaluatorSelected` | RATIFIED (§31) | absent | **NONE** — authored schema, no explicit blessing |
>
> **The precedent is already walked for the first**: `submitEvidenceForAssessment`'s handler comment cites that
> exact sentence by line (`assurance.ts` — *"Ratified NAMES, AUTHORED schema (§31 L1770 …)"*). The second is
> authored on the ordinary standing grant, and should say so in its own comment rather than borrowing a ruling
> that does not name it.

**Blast radius — four production callers** that today request-and-start in one dispatch, plus fixtures:

| caller | notes |
|---|---|
| `rph-engine/src/record-assurance.ts` | the de minimis floor path; bulk, no evidence (§3) |
| `rph-engine/src/reference-undertaking.ts` | the canonical drive. It **admits** evidence (`AdmitEvidence`) but never calls `SubmitEvidenceForAssessment` — so even the drive does not take the `EVIDENCE_PENDING → READY` arrow by its ratified trigger. Checked, because "the drive already does this" was the comfortable assumption |
| `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` | a UI action |
| `handlers/__tests__/floor-fixtures.ts` | fixture helper, already throws on non-ACCEPTED |

## 5. The four decisions — three settled by measurement, one genuinely open

These were first written as *"decisions that remain — none of them mine to make silently"*. Three of the four
turned out not to be decisions at all: they were questions with measurable answers I had not yet measured.
Recording them as sponsor decisions would have been asking someone else to guess at something checkable.

**5.2 — SETTLED. `AssuranceEvidenceRequired` is an event.** It is a ratified name in DOC-004 §31, which
explicitly classes it among *"the fine steps that drive the §30 state machine"* and assigns it to a §32 command.
Not prose. See §4's correction. It needs an authored schema and an emitter, on the precedent already used for
`AssuranceEvidenceReceived`.

**5.3 — DISSOLVED, and what replaces it is worse.** The question was whether `requiredEvidenceTypes` participates
in the `EVIDENCE_PENDING → READY` guard. It cannot: `requiredEvidenceTypes` is a field of the **PWA ontology's**
`SeedPolicy` type, not of `AssurancePolicy`, and `seedAdditivePolicies` maps eleven fields into
`CreateAssurancePolicy` without it. The whole repository mentions the name in exactly three files — the type
declaration, the data, and the vocab — and **nothing reads it**.

So the guard reads `requiredEvidence` and could never have seen it. But the finding that replaces the question is
larger than the question: **12 of 12 ratified catalog policies declare which evidence types they require, and the
seeding drops the declaration on the floor.** Filed as REG-F-022 (§7). Every value dropped is a valid
`EvidenceType` (`SOURCE`, `ARTIFACT`, `TRACE`, `ANALYSIS`, `TEST_RESULT`, `MEASUREMENT`, `OBSERVATION`, `REVIEW`,
`APPROVAL` — all nine enum members are used), so this is well-typed authored governance that never arrives.

**And it is wider than the policies.** Adversarial re-checking found the same field declared a *second* time, on
the ontology's **`PwuTemplate`** type, with **14 further carriers** among the templates — equally unread. So the
dropped surface is **26 authored declarations**, not 12.

**5.4 — SETTLED, but NOT free, and the correction changes the build order.** `startedAt` moves to
`beginAssuranceAssessment`. No production reader consumes its **value**: no view, projection, query or demo route
names it, the demo's assessment recency ordering keys on `updatedAt`, and the `rph-projections` hits belong to
execution attempts — a different object type. The only surface that serializes it to a client is the test-mode
`/test-api/introspect` endpoint.

> **I called this "a free correction today", and it is not.** `startedAt` is a **REQUIRED `z.string()`** on
> `AssuranceAssessmentSchema` (`objects.ts`, mirrored in the JSON schema's `required` list and in
> `vocab/m1-object-fields.json`), and `kit.ts` validates the produced state on **every** assessment write under an
> explicit "never persist an object that is not a valid domain object" contract. So an assessment created in
> `REQUESTED` — which by definition has not started — **cannot be persisted at all** until `startedAt` becomes
> optional. Every `RequestAssuranceAssessment` would be rejected `RPH_VALIDATION_SCHEMA_FAILED`, the floor would
> stop recording, and `PublishPwa` would stay blocked.
>
> **Consequence for the roadmap: relaxing `startedAt` to optional is a contract change that must land BEFORE the
> first state-machine change, not alongside it.** "No reader consumes it" was true and was the wrong question —
> the writer's schema was the binding constraint, and a validator is a reader.

**5.1 — GENUINELY OPEN, and narrower than it was.** Does `RequestAssuranceAssessment` still create the object?

What changed: DOC-004 **§32 lists `requestAssuranceAssessment` (L1795) and `beginAssuranceAssessment` (L1798) as
two separate ratified commands**, alongside `submitEvidenceForAssessment` (L1796), `selectAssuranceEvaluator`
(L1797) and `recordCriterionResult` (L1799). **Of those five, two are registered in this engine and three appear
nowhere in the repository except as prose and one trigger string.**

> **I first wrote that this "contradicts a shape the corpus does name", and that is overstated.** §32's entire
> normative content after the name list is *"Every mutation must enforce: policy version; object semantic version;
> independence; authorization; expected revision"* (L1810-1816). There is **no exhaustiveness clause and no rule
> that each listed command be its own dispatch**, so "contradicts §32" imports a requirement the section does not
> carry — and §31's own annotation rules the *other* way on precisely this granularity question, holding that a
> coarser event set which "spans" finer steps **composes** with them rather than conflicting.
>
> What a fused composite actually does: it leaves a §32-named command **unbuilt** *and* invents a command shape
> the corpus does not name. Both, not one instead of the other. That is a weaker objection than a contradiction,
> and it is the true one.

What remains is a cost question, and it is smaller than first stated. "Four times the traffic" is a per-assessment
multiplier on a small base: the floor recording path issues one assessment per floor policy — **three per
subject** — so the restoration adds roughly six to nine in-process dispatches per floor recording. That is not the
kind of cost that should buy a contradiction of the ratified command list.

**Recommendation: faithful sequencing, with an engine-layer helper** that issues the four commands in order, so
callers compose ratified commands instead of each re-implementing the sequence. To be explicit about what the
helper does *not* do: it does not reduce the traffic, it only stops four call sites from drifting apart. The
sponsor's call is whether the traffic is acceptable; the recommendation is that it is.

## 6. What this design does not claim

It does not claim the increment is small. It does not claim 5.1 has an obvious answer — it trades fidelity against
the floor's ergonomics, and the floor is the mechanism this product exists to demonstrate; the recommendation in
§5.1 is a recommendation, not a decision taken. It does not claim the ratified machine is complete:
`ASSESSING → INDEPENDENCE_VIOLATION`, `WAIVED`, `INVALIDATED` and `WAIVER_EXPIRED` arrows exist and are out of
this increment's scope. And it does not claim REG-F-022 is fixed by this increment — see §7.

## 7. REG-F-022 — the sibling finding this design surfaced, and its sequencing

Chasing §5.3 turned up a defect that is not part of this increment and should not be folded into it: **12 of 12
ratified catalog policies declare `requiredEvidenceTypes`, and `seedAdditivePolicies` never maps it, so every
`AssurancePolicy` object in every engine has `requiredEvidence: []`.** Measured live: 0 of 15 seeded policy
objects carry any. Consequence: Gate A admits every disposition, and §38's "missing evidence" is always empty.

**The vacuity covers the entire production surface, not just the seeded catalog.** Independently re-checked
against every production creation path: `seedFloorPolicies`, `seedAdditivePolicies`, the reference undertaking's
bespoke policy, the demo undertaking's policy, the PWA Designer's `createPolicy`/`editPolicy`, and the agent
broker (whose `CreatePolicyInput` has no such member). **None can supply `requiredEvidence`.** The one non-test
line that puts the field on a `CreateAssurancePolicy` payload is the supersede action, which copies the
predecessor's value — and the predecessor's value is always `[]`, so it propagates emptiness rather than
introducing content. A version-bump e2e asserts the field is preserved across supersede; it compares `[]` to `[]`.

**Causally precise:** the handler's `p.requiredEvidence ?? []` is the *defaulting*, not the cause. The cause is
that no production caller supplies the field — so fixing the default would change nothing.

**It is not a one-line fix, and that is the point of separating them.** `EvidenceRequirement` (§6.1) carries
`id`, `evidenceType`, `description`, `purpose` and `cardinality`. The ontology carries **only the type**. So
delivering the authored value means minting requirement ids and authoring descriptions, purposes and
cardinalities for 12 policies — authoring work against a ratified schema, not a mapping the compiler can check.

**Sequencing: REG-F-022 does not block this increment, and this increment must not assume it is fixed.** The
`EVIDENCE_PENDING → READY` guard is written against `requiredEvidence` either way; today it passes vacuously for
everything, and the day REG-F-022 lands it starts biting — which is exactly why §3 insists the vacuous pass be an
explicit rule rather than an absent one. Restoring the lifecycle on top of a silently-empty required set would
produce a lifecycle that *looks* like it gates evidence and does not, which is the failure mode this whole
programme exists to catch.

**Standing gate meanwhile.** `verif/event-surface-census.test.ts` pins the three unoccupied states and the
unemitted event. The day a handler writes `assessmentState: 'REQUESTED'`, that assertion reddens and the pin
comes out — so this design cannot be quietly half-implemented.

## 8. How this design was checked, and what that changed

Every load-bearing claim was handed to an independent verifier instructed to **refute** it, to default to
"refuted" on ambiguity, and to report a claim that is true-but-narrower-than-stated as refuted with corrected
wording. Absence claims had to be searched in both directions — the identifier *and* the content it would carry —
because the recurring failure in this repository is a search reported as a fact.

| claim | verdict | what it changed |
|---|---|---|
| `requiredEvidenceTypes` is read by nothing | **STANDS** (high) | widened: the field is on `PwuTemplate` too — 26 declarations, not 12 |
| Gate A is vacuous on shipped policies | **STANDS** (high) | widened to the *whole* production surface; causal framing corrected |
| Both new events sit under §31's "schema-and-wiring" ruling | **REFUTED** | the ruling names Required + **Received**; `AssuranceEvaluatorSelected` has no ruling (§4) |
| Fusing the commands contradicts §32 | **REFUTED** | §32 declares no exhaustiveness or dispatch granularity; the true objection is weaker (§5.1) |
| `startedAt` is consumed by no production reader | **REFUTED** | true of its *value*; it is schema-REQUIRED and validated on every write — **changes the build order** (§5.4) |

**The three refutations were worth more than the two confirmations.** Each was a case where I had stated something
slightly stronger than what I had checked: a ruling extended to an event it does not name, a list read as carrying
a rule it does not state, and "no reader" asserted while a validator was reading the field on every write. None
would have shown up as a failing test; the first two would have shipped as prose, and the third would have shown
up as every assessment write failing on the first day of implementation.
