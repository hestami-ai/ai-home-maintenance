# DESIGN — the blocking finding, and the rejection that may cite it

**S-1b of `ROADMAP-decision-subject-scope`, deferred twice on purpose.** Authored 2026-08-10.

REG-F-104 deferred rejection with a reason worth restating, because it is the whole constraint on this design:

> A `rejectPwu` action could mint its own assessment and its own BLOCKING observation in the same batch and
> satisfy the gate. **That is manufacturing the guard's own input** — REG-F-022's Gate A in terms (*"the logic is
> right and its population is supplied by the party it judges"*). It would be green, reachable, and worth nothing.

So this design is not "make rejection work". It is **give the workbench a way to record an adverse professional
judgement as its own deliberate act**, after which rejection works by finding one.

---

## 1. What the engine already requires, verified

`RejectPwu` needs **both**:

1. an **EFFECTIVE `REJECTION` Decision** naming the PWU (`resolveRejectAuthorization`), and
2. a real **`ASSURANCE_OBSERVATION` of BLOCKING or CRITICAL severity** whose `subjectObjectIds` include the PWU
   (`hasBlockingObservationFor`) — *"Severity is read off the stored observation, never from this payload."*

An observation is not free-standing: `RecordAssuranceObservationPayload` requires an `assessmentId`, so every
finding belongs to an **assessment** — a judgement someone made, under a policy, about a subject at a version.
That is the corpus being coherent, not an obstacle: **a finding with no assessment is an opinion.**

**Measured: `RecordAssuranceObservation` is dispatched ZERO times anywhere in `apps/rph-demo`.** The one assurance
affordance (`recordAssurance`, on the Undertaking Workbench) drives the whole §30 sequence in a single batch and
completes with a SATISFIED disposition and `observations: []`. **The workbench can sign work off and cannot fault
it.**

---

## 2. The precondition nobody would have found without building this — Gate C is inert here

The §10.3 precedence ladder **is** enforced, and I nearly filed it as dead. `dispositionFromFindings` in
`rph-assurance` has no reader but its own unit test — but the rule is implemented **inline** as **GATE C**,
`rejectForeclosedDisposition` in `completeAssuranceAssessment`. (The register already recorded this at REG-F-020's
limb (e); searching it first is what stopped a false finding.)

**But Gate C fires only when the policy says so:**

```ts
const dispositionRule = (dispositionRules ?? []).find((r) => r?.disposition === disposition);
const forbidden = new Set(dispositionRule?.forbiddenOpenSeverities ?? []);
if (forbidden.size === 0) return null;   // ← no rule, no foreclosure
```

`dispositionRules` is **`.optional()`** on `CreateAssurancePolicyPayload`, and **the demo policy declares none**
(`grep -c dispositionRules` on the route: **0**). So on the only assurance surface the workbench has, **an
operator could record a BLOCKING finding and still complete the assessment SATISFIED.** The gate is correct,
reachable, and switched off by omission — the "hollow" shape, produced here by an optional field defaulting to
"no constraint".

**This is the first thing to fix, and it is not optional to fix it.** Adding an adverse arm to a surface whose
policy cannot foreclose a positive disposition would ship the ability to record a finding and ignore it.

---

## 3. The design

### 3.1 The demo policy declares its dispositionRules

`Workbench Demo Sign-off` gains:

```
dispositionRules: [{ disposition: 'SATISFIED', condition: {}, forbiddenOpenSeverities: ['BLOCKING', 'CRITICAL'] }]
```

so a SATISFIED sign-off is **foreclosed while a blocking finding stands**. This is a policy declaration, not a
code path: the professional's own governing policy states what it will not permit, and Gate C reads it. That is
the governed layer being a source rather than a projection.

### 3.2 A second outcome on the assurance affordance: RECORD A FINDING

Today the Undertaking Workbench offers one assurance act ("sign off"). It gains a second, **beside it and equal
to it**: *record a blocking finding*. The act:

1. drives the same ratified §30 sequence to `ASSESSING` (the identical helper — `driveAssessmentToAssessing`);
2. dispatches **`RecordAssuranceObservation`** with `severity: 'BLOCKING'`, the operator's `statement`, and the
   policy's `findingDefinitions` code;
3. completes the assessment with a **`REJECTED`** disposition recommendation.

**Step 3 is not the operator asserting a verdict — it is the only verdict Gate C will now accept.** Attempting to
sign off after recording the finding is refused by the engine with §10.3's own sentence. The operator supplies
the *judgement*; the ladder supplies the *disposition*.

**⚠ AND THIS IS NOT THE SHORTCUT REG-F-104 REFUSED.** The distinction is exact and worth pinning:

| | manufactured (refused) | this design |
|---|---|---|
| who creates the observation | `rejectPwu`, in its own batch | the professional, at the assurance surface |
| when | at the moment of rejecting | before, as a separate recorded act |
| what it is | the guard's own input, minted by the party the guard judges | a professional judgement about the work |
| what rejection does | creates its evidence | **finds** evidence that already stands |

The batch boundary is the whole of it: **an assurance act and a governance act are two acts, minuted separately,
and the second cites the first.** That is INV-5 (exec ≠ assurance) applied to the surface, and it is the same
shape as REG-F-106's ruling — mint the authorization beside the object, let the acting gate find it.

### 3.3 Rejection cites what exists

`rejectPwu` gains an affordance on the Undertaking Workbench, offered **only when a blocking observation for that
PWU already stands**. It mints and approves a `REJECTION` Decision and dispatches `RejectPwu` citing the
observation id. Where abandonment was atomic (S-1a) because a lingering abandon authority is *"a standing
permission to discard someone's work"*, rejection is **deliberately two-step**: the finding is recorded first and
outlives the rejection, because the finding is the record of why.

---

## 4. Why this holds across the three tiers

- **Standalone.** One professional both assesses and rejects — so the separation is **temporal and recorded**,
  exactly as REG-D-041's step-strength ruling concluded for `strength`. They record the finding when they find
  it; the rejection is a later, separate act that cites it. The policy's `forbiddenOpenSeverities` is what stops
  them quietly signing off instead, and they cannot switch it off at the moment of signing because it lives on
  the policy, not in the request.
- **SaaS.** The finding is the tenant's audit record of *why* work was rejected, keyed to an assessment, a
  policy, and a subject version. A rejection with no standing observation would be unexplainable months later.
- **Enterprise — the tier the two-step is for.** The reviewer who records the finding is **not** the governance
  role who rejects, and neither is the producer. `independenceRequirement` on the policy is the field that
  expresses this, and it is already enforced (`assurance-independence.test.ts`). The demo's policy declares
  `NONE` — honest for a single-operator demo, and **disclosed rather than quietly relied on**.

---

## 5. Deliberately not built

- **Waiving a blocking finding.** §10.3 says *"Resolve or waive the finding"*; `RequestWaiver`/`GrantWaiver`
  exist and the floor panel drives them. Wiring waiver-of-finding into this surface is a separate act with its
  own authority requirements (DOC-004 §12.2 `WaiverDetail`), and folding it in here would blur the one
  distinction this design is about.
- **Resolving a finding** (observation → CLOSED) and the re-assessment that follows. Rejection is reachable
  without it; a PWU whose finding is resolved is a different increment.
- **Independence beyond `NONE`.** Requiring a distinct evaluator needs a second identity in the demo, which the
  standalone host does not have. Stated, not faked.
- **Making `dispositionRules` mandatory on `CreateAssurancePolicy`.** It is `.optional()` in a ratified command
  payload; narrowing that is a contract act, and REG-D-041's grant does not extend to it. Recorded as owed —
  **every policy authored without dispositionRules has an inert Gate C**, and the demo policy was one.

---

## 6. Acceptance — behavioural, and the reds are named in advance

1. **The finding forecloses the sign-off.** Record BLOCKING, then attempt SATISFIED ⇒ **REFUSED** by Gate C with
   §10.3's sentence. *This test fails today* — the demo policy declares no `dispositionRules`.
2. **Rejection is refused while no finding stands**, and accepted once one does — the same PWU, the same actor,
   the same decision, differing only in whether a blocking observation exists.
3. **CONTROL — the sign-off path still works** on a PWU with no finding. Without it, every refusal above is
   equally consistent with an assurance surface that has stopped working.
4. **CONTROL — an observation on a DIFFERENT PWU does not license this rejection** (`hasBlockingObservationFor`
   checks `subjectObjectIds`), because a gate that pooled findings would reject work nobody faulted.
