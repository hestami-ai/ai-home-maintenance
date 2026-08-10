# ROADMAP — the blocking finding, and the rejection that may cite it

Implements `DESIGN-blocking-finding-capability.md` (S-1b). Four increments, each **red test first → change →
mutant with a predicted red → gate → register → commit**, register written before the gate.

---

## B-1 — the demo policy declares what it will not permit (Gate C stops being inert)

**Red first.** `apps/rph-demo/src/lib/server/assurance/*.test.ts` (or a new
`blocking-finding-forecloses-signoff.test.ts` beside the existing route tests): drive the policy the route
authors, record a BLOCKING observation on an ASSESSING assessment, attempt `CompleteAssuranceAssessment` with a
SATISFIED recommendation ⇒ expect **REFUSED**, message containing `§10.3`. **This fails today**, because
`dispositionRules` is absent and Gate C returns `null` before it looks at anything.

**Change.** The `CreateAssurancePolicy` payload in `undertakings/[id]/+page.server.ts` gains:

```
dispositionRules: [
  { disposition: 'SATISFIED', condition: {}, forbiddenOpenSeverities: ['BLOCKING', 'CRITICAL'] }
]
```

**⚠ The demo policy is created once and cached** (`getObject(engine, DEMO_POLICY_ID) ? [] : [...]`), so an
existing durable store keeps the old policy. Test mode resets per spec, so E2E is unaffected; for a durable host
this is a policy **version** question, and the honest answer is to say so rather than silently edit a live
policy — the route already versions it `1.0.0`. Disclose in the code comment; do not auto-migrate.

**Mutant.** `B1-the-signoff-forecloses-nothing`: delete `forbiddenOpenSeverities` from the rule. Predicted red:
the new foreclosure test alone.

**Gate:** `bunx vitest run apps/rph-demo` + `cd apps/rph-demo && bun run check`.

---

## B-2 — the assurance affordance gains an adverse arm

**Change.** New action `recordBlockingFinding` in `undertakings/[id]/+page.server.ts`, beside `recordAssurance`
and sharing its policy/assessment setup (extract the shared prelude rather than copy it — two assurance paths
that disagree about the policy is the defect this repo has recorded four times for `AssessmentCriterion`):

1. `driveAssessmentToAssessing` — the same ratified §30 helper, unchanged;
2. `RecordAssuranceObservation` — `{ assessmentId, observationType: 'FINDING', findingCode: 'DEMO_UNFIT',
   severity: 'BLOCKING', statement: <operator's words>, evidenceIds: [] }`;
3. `CompleteAssuranceAssessment` with a **`REJECTED`** disposition recommendation.

The operator supplies the **statement**; they do not choose the disposition. Verify `observationType` against
`ObservationTypeSchema` before writing — do not assume `'FINDING'`.

**Surface.** `+page.svelte`: a second button beside "Record assurance", with a required statement field. The two
acts read as siblings because they are.

**Tests.** Route-level: the finding is stored with severity BLOCKING and `subjectObjectIds` containing the PWU;
and the sign-off attempted *afterwards* is refused (B-1's gate, now reachable from the surface).

**Mutant.** `B2-the-finding-is-recorded-as-advisory`: `severity: 'BLOCKING'` ⇒ `'ADVISORY'`. Predicted red: the
rejection test in B-3 (an ADVISORY finding does not satisfy `hasBlockingObservationFor`) — so declare this mutant
**in B-3**, once its victim exists, rather than pointing it at a test that does not yet assert the consequence.

---

## B-3 — rejection cites what already stands

**Red first.** E2E `pwu-rejection.e2e.ts`: on a PWU with **no** finding, the reject affordance is **not offered**,
and forcing `RejectPwu` through `/test-api/dispatch` is **REFUSED** naming `hasBlockingObservationFor`'s reason.
Then record the finding and reject ⇒ ACCEPTED.

**Change.** `rejectPwu` action: mint + approve a `REJECTION` Decision (subject-bound, versions stated from the
store — REG-F-106's ruling) and dispatch `RejectPwu` with the standing observation id. **Two acts, not one
batch** — the finding was recorded earlier and outlives the rejection, which is the whole of DESIGN §3.2.

Offer the affordance only when a blocking observation for that PWU exists; the `load` already lists observations
(`listObservations`), so this is a derived affordance, not a new query.

**Controls.**
- The sign-off path still works on a PWU with no finding — without it every refusal is consistent with a broken
  assurance surface.
- A blocking observation on a **different** PWU does not license this rejection.

**Mutants.** `B2-the-finding-is-recorded-as-advisory` (declared here) and
`B3-rejection-stops-checking-the-subject` (drop the `subjectObjectIds` filter in the affordance's predicate).

**Gate:** full — including `bunx playwright test`.

---

## B-4 — register, and the full gate

1. **REG-F-104 amended in place** (strike, don't delete): S-1b is discharged, and the reason it was deferred was
   right.
2. **New REG-F** for the Gate C inertia — *`dispositionRules` is optional, so a policy authored without it has a
   §10.3 foreclosure that cannot fire*, with the general form: **an optional policy field that defaults to "no
   constraint" is a gate switched off by omission.** Recorded as owed to governance: should
   `CreateAssurancePolicy` require it?
3. **New REG-F** for what B-2/B-3 shipped, including the manufactured-vs-found table from DESIGN §3.2.

**Full gate:** `check-types` (3 legs) · `lint` · `boundary` · `build` · `bunx vitest run` · `test:dist` ·
`apps/rph-demo bun run check` · `bunx playwright test` · `bun run mutants`. `CSAA staged: 0` on every commit.

---

## Sequencing, and why B-1 cannot be skipped

B-1 first because **adding an adverse arm to a surface whose policy cannot foreclose a positive disposition would
ship the ability to record a finding and then ignore it** — a worse state than having no adverse arm at all, and
one that would look like progress. B-2 before B-3 because rejection must FIND a finding, not make one; building
them together is precisely the shortcut REG-F-104 refused.

## Not in scope (DESIGN §5)

Waiving a finding; resolving a finding and re-assessing; independence beyond `NONE`; making `dispositionRules`
mandatory in the ratified command payload.
