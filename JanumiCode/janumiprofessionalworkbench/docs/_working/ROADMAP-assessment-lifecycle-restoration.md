# Implementation roadmap — restoring the three skipped Assurance Assessment states (REG-F-021)

> **Status: ROADMAP. No code accompanies it.** Companion to
> `DESIGN-assessment-lifecycle-restoration.md`, which establishes *what* and *why*. This is *in what order, with
> what red first, and what breaks*. It exists because the design's build order turned out to be wrong in one place
> and its blast radius wrong in another — both found by measurement after the design was written.
>
> **One decision is still the sponsor's (design §5.1)** — faithful four-dispatch sequencing versus a fused
> composite. This roadmap is written for the **recommended** option (faithful sequencing plus an engine-layer
> helper). If the sponsor chooses otherwise, increments 3–5 change shape; 0–2 do not.

---

## 1. What the design got wrong, and why the order below is not the obvious one

**The obvious order is: change the state machine, then fix the callers.** It fails on the first dispatch.

`startedAt` is a **REQUIRED `z.string()`** on `AssuranceAssessmentSchema`, and `kit.ts` validates produced state on
every write ("never persist an object that is not a valid domain object"). An assessment created in `REQUESTED`
has not started, so it cannot carry `startedAt`, so **it cannot be persisted at all**. Every
`RequestAssuranceAssessment` would be rejected `RPH_VALIDATION_SCHEMA_FAILED`, the floor would stop recording, and
`PublishPwa` would stay blocked. **The contract relaxation is increment 0, not a tidy-up at the end.**

**And the blast radius is not four callers.** The design named the four sites that request-and-start in one
dispatch. Measured, `assessmentState` is read at **nine production sites**, and several of them treat the field
**as a disposition** — which is currently harmless only because the field never holds anything but `ASSESSING` or
a terminal disposition. Introducing three new values changes what those readers see. §4 works through them.

---

## 2. Increment 0 — relax `startedAt`, and pay for it

**Change.** `AssuranceAssessment.startedAt` becomes optional (vocab `m1-object-fields.json` → `bun run gen`).

**This weakens a contract, so it must buy the guarantee back in the same increment.** A field that may be absent
in `REQUESTED` must still be *present by the time it means something*. Add a precondition: an assessment in
`ASSESSING` or any terminal disposition **must** carry `startedAt`. Optional at the schema, mandatory at the
state that implies it — the guarantee moves rather than evaporating (REG-D-013: guarantee-strength over economy;
relaxing a required field without a compensating check is exactly the economy that ruling forbids).

**Red first.** Before the change: a test that builds an assessment state without `startedAt` and asserts the
schema **rejects** it — must be GREEN (proving the constraint is real and this increment is not a no-op). After:
that test inverts, and a *new* test asserts an `ASSESSING` assessment without `startedAt` is refused. Naming both
in advance, because "made a field optional" is the kind of change whose test suite goes green by subtraction.

**Gate.** Full suite. Expect zero behavioural change — nothing writes an assessment without `startedAt` yet.

---

## 3. Increments 1–3 — contracts, commands, then the flip

### Increment 1 — the four contracts (declared and bound, emitted by nothing)

Two events and two commands into `m3-commands-events.json`, then `bun run gen`.

| artifact | provenance to record in `sourceSection` |
|---|---|
| `AssuranceEvidenceRequired` | RATIFIED NAME (DOC-004 §31) + **the §31 L1783-1785 ruling names it**: schema-and-wiring, not ratification |
| `AssuranceEvaluatorSelected` | RATIFIED NAME (DOC-004 §31) — **no ruling covers it**; authored on the standing grant, and its comment must say so rather than borrowing the ruling |
| `SelectAssuranceEvaluator` | RATIFIED NAME (DOC-004 §32) |
| `BeginAssuranceAssessment` | RATIFIED NAME (DOC-004 §32) |

**The two events are not on equal footing and the record must not flatten them** — that conflation was the design's
first error, and re-introducing it in a `sourceSection` is how it would become permanent.

**Predicted red — and it is the census, working.** `verif/event-surface-census.test.ts` pins *bound-but-unemitted*
as exactly `['AssuranceAssessmentRequested']`. Binding two more events that nothing emits makes it three. **Update
the pin with the reason, do not widen the assertion into a `length` check** — the value of that pin is that it
names them.

### Increment 2 — `selectAssuranceEvaluator` + `beginAssuranceAssessment`

Handlers, registered, emitting their events. `beginAssuranceAssessment` is where `startedAt` is now stamped
(design §5.4). Still nothing creates an assessment in `REQUESTED`, so the machine is not yet live: these commands
exist and can be dispatched against an assessment that is already `ASSESSING`, which is a no-op-ish state error —
so each needs its precondition (`READY` only) from the first commit, not later.

**This also closes a second-order gap neither the design nor the register named.** `completeAssuranceAssessment`
currently reads its evaluator off `p.validatorResult?.executionProvenance?.evaluator` — the evaluator is
**smuggled through the verdict** because no governed selection act existed. Once `selectAssuranceEvaluator` emits,
*who assessed* has a home in the event stream. Worth stating as a benefit of this increment, because it is the
one place the restoration buys a governance guarantee rather than only ordering fidelity.

### Increment 3 — the flip

`requestAssuranceAssessment` creates in `REQUESTED`, emits `AssuranceAssessmentRequested`, and the two arrows are
implemented:

* `REQUESTED → EVIDENCE_PENDING` — claims instantiated, required set evaluated, `AssuranceEvidenceRequired`
  emitted. The required set is **already computed** at this exact point today (the handler resolves
  `policy.requiredEvidence` into `requiredEvidenceIds` for the Started event), so this is a move, not new logic.
* `EVIDENCE_PENDING → READY` — **the explicit empty-required-set rule** (design §3). Written as *"advance when the
  required set is empty"*, never *"advance unless something objects"*. Today it passes vacuously for everything
  (REG-F-022); the day REG-F-022 lands it starts biting, and that must be a rule changing behaviour, not a
  silence changing behaviour.

**A blocker inside this increment.** `submitEvidenceForAssessment` today refuses unless
`assessmentState === 'ASSESSING'` — *"evidence may only be submitted while the assessment is open."* Under the
restored machine evidence is submitted in **`EVIDENCE_PENDING`**, which is precisely when that guard rejects it.
**The arrow's own trigger command is currently refused at the state the arrow starts from.** The guard must widen
to `EVIDENCE_PENDING` (and stay closed against terminal states — the reason it exists is that recording evidence
after the verdict silently shrinks the missing set).

**Predicted reds:** the census's three-unoccupied-states assertion reddens — **that is the fix landing, and the
pin comes out** rather than being extended. Bound-but-unemitted drops to `[]`.

---

## 4. The blast radius, measured — and the one that is unsafe

`assessmentState` is read at nine production sites. They fall into three groups, and only the third is dangerous.

**(a) Safe — reads a terminal value or compares to one.**
`floor.ts` (`=== 'SATISFIED'`), `pwu.ts` (compares to a caller-supplied state), `assurance-view.ts`'s fold.
New values simply do not match; no branch is wrong.

**(b) Fail-CLOSED — conservative, but will visibly block.**
`floor-gate.ts` builds `disposition: String(s.assessmentState)` with no filtering, then
`.filter((r) => r.disposition !== 'SATISFIED')` treats everything else as a floor failure. So an assessment
in flight blocks publication. **Arguably correct** — an unfinished assessment is not a satisfied one — but it is a
behaviour change the demo will show the moment increment 3 lands, and it should be a decision recorded here rather
than a surprise: *in-flight ⇒ not satisfied ⇒ publication blocked until the assessment completes.*

**(c) Fail-OPEN — the unsafe one, and it is already half-anticipated.**
`governance.ts` (baseline promotion, §8.16):

```ts
const disposition = a?.assessmentState ?? 'INCONCLUSIVE';
const complete = disposition !== 'ASSESSING' && disposition !== 'REQUESTED';
```

Someone already excluded `REQUESTED` — and stopped. **`EVIDENCE_PENDING` and `READY` would count as `complete`,
with `disposition: 'EVIDENCE_PENDING'`**, so a baseline could be promoted over an assessment that has not begun.
This is the one site where the increment does not merely change what is displayed; it would let a governance act
through that should be refused.

> **Fix it in increment 0, not increment 3.** It is correct *today* (those states are unreachable) and would be a
> live defect the moment the states exist. Fixing it first means the dangerous window never opens, and the fix can
> be verified in isolation against a hand-built assessment rather than against the whole new machine.
> **The check should be positive** — `complete` iff the disposition is one of the terminal set — not a growing
> list of exclusions, because the exclusion list is what failed here.

---

## 5. Increment 4 — the helper and the four callers

An engine-layer helper issuing the four commands in order (design §5.1's recommendation). It does **not** reduce
traffic; it stops four call sites drifting apart.

| caller | note |
|---|---|
| `record-assurance.ts` | the floor path — 3 assessments per subject, so +6–9 in-process dispatches per recording |
| `reference-undertaking.ts` | the canonical drive. Admits evidence but never calls `SubmitEvidenceForAssessment` — so it must now take that arrow by its ratified trigger, which is a genuine behaviour addition, not a rename |
| `undertakings/[id]/+page.server.ts` | UI action |
| `__tests__/floor-fixtures.ts` | fixture helper |

---

## 6. Increment 5 — close out

Register: REG-F-021 to CLOSED with the census pins removed (not extended). REG-F-022 stays **OPEN** — this
increment must not be read as having fixed it, and §3's explicit-empty-set rule is what keeps the two separable.

**Full gate:** `bunx vitest run` · `bun run test:dist` · `check-types` · `lint` · `boundary` ·
`apps/rph-demo` svelte-check · `bunx playwright test`.

---

## 7. What this roadmap does not promise

It does not promise the increment closes a soundness hole — the ordering is what it buys (design §2). It does not
promise §5.1 is settled. It does not cover `ASSESSING → INDEPENDENCE_VIOLATION`, `WAIVED`, `INVALIDATED` or
`WAIVER_EXPIRED`, which are ratified arrows out of scope. And it does not assume REG-F-022 is fixed — every guard
here is written for both worlds, which is the whole reason the empty-set rule is spelled out rather than implied.
