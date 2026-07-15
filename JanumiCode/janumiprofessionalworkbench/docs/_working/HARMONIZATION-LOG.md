# Harmonization log — Coding Agent Guide ↔ codebase/tests

**Mandate (sponsor, 2026-07-15):** harmonize the coding-agent guidance with the source code and tests.
Resolution may be *"update the guide"*, *"update the code/tests"*, or *both*. Make smart tradeoffs; keep a
running report of issues encountered, the tradeoff taken, and the implemented solution.

**Governing spirit:** this is an agent system building an agent system. Observability assumptions that hold
for deterministic code do not hold here. The governed professional stream — detailed recording of the inputs
and outputs of *both* deterministic and model/agent calls — is what makes it possible to reason about correct
and incorrect behavior from units to live end-to-end runs. Recording is load-bearing, not decoration.

---

## PART 0 — Corrections to my own prior record (read this first)

Four things I told the sponsor in this effort were **wrong**. They are corrected here, and the artifacts that
carry them are corrected in place. Each was a case of reasoning from a document I had not read.

### C1 — The Coding Agent Guide is **not** RPH-DOC-000. It is *proposed*.

I called this guide "RPH-DOC-000, the ratified rank-1 authority" throughout, and recorded that in project
memory. Both wrong.

- §17's own source map (L2538) binds **RPH-DOC-000** to a *different file*:
  `Recursive Professional Harness/Janumi Product Architecture and Canonical Vocabulary Charter - Governing Product Ontology, Subsystem Boundaries, and Naming Authority.md` — verified present on disk.
- §16 item 1 (L2498), verbatim: *"This guide is itself proposed."* Its safe default: *"Treat `RPH-DOC-000`–`010`,
  generated contracts, and accepted repository ADRs as authority. Draft language is rationale/candidate design;
  **repeating it here does not ratify it**."*

**Consequence.** Commit `991c510` ("RPH-DOC-000: ratify handoff recording…") did not amend RPH-DOC-000 and
ratified nothing. It edited a proposed distillation. The edits may still be *good* — but they carry the
authority of a draft, and any conclusion of the form "the guide forbids X, therefore block" rested on
borrowed authority.

**Consequence for method.** §17 L2551 states the actual protocol: *"When a coding task needs exact fields or
behavior, follow the link for the governing layer, then inspect the generated implementation and tests. If the
source and executable artifact disagree, report the drift; do not silently choose one or **update only prose**."*
Harmonization is therefore **three-way** — governing source ↔ guide ↔ code — never two-way. "Update only
prose" is named by the guide as a failure mode. It is the failure mode I had adopted.

### C2 — Item-23 "blocker 1" (*"the field set exists in no ratified source"*) is **FALSE**.

I searched RPH-DOC-007 for the Execution Attempt, found five id references and no interface, and concluded no
ratified source defined it. **I never opened RPH-DOC-009**, the §0.1 rank-9 storage-and-operation authority.
It defines the table outright at DOC-009 §10.4:

```sql
create table execution_attempts (
    id text primary key,
    execution_step_id text not null references execution_steps(id),
    attempt_number integer not null,
    state text not null,
    started_at timestamptz, completed_at timestamptz,
    runtime_binding_id text not null,
    idempotency_key text not null,
    external_operation_id text, reconciliation_state text,
    result jsonb, error jsonb, provenance jsonb not null,
    constraint uq_execution_attempt unique (execution_step_id, attempt_number),
    constraint uq_execution_idempotency unique (idempotency_key)
);
```

DOC-009 also carries `producing_execution_attempt_id`, `security_classification`, and `retention_class` on the
artifacts table (DOC-009 L1503-1510) — which is *exactly* §9.7's *"retained as a typed Artifact of its producing
Attempt … under retention, security, and access policy."* The contract I reported as absent has been ratified
the whole time. `ProvenanceRecord.producingExecutionAttemptId` (`envelopes.ts:39`) already generates from it.

### C3 — "The de minimis floor's independence requirement is NOT REPRESENTABLE" is **FALSE**.

This was my headline finding to the sponsor. It rested on *"`Identity` has **no `role` field at all**."*
That is true of `rph-assurance`'s hand-rolled `Identity` and **false of the ratified contract**.

- `ActorReference` (`envelopes.ts:22-31`) — the DOC-007 shape — has `roleId`, `modelId`, `providerId`,
  **and** `executionInstanceId`: all four of §8.4 L851's axes.
- `RuntimeBinding` (`objects.ts:498-510`, from DOC-009 §10.5) has `roleId`, `modelSelectionPolicy`,
  `contextAssemblyPolicyId`, **and** `observabilityPolicyId`.
- `rph-assurance`'s `Identity` (`assurance-rules.ts:127`) has `invocationId`, `contextInstanceId`, `modelId`,
  `providerId` — **three of the four axes**. Only `roleId` is missing.

The floor is representable. The defects are narrower and fixable: `IndependenceRequirement` is a **single-valued
enum** (`assurance-rules.ts:117-125`) where §8.4 L851 requires a **conjunction**, and `Identity` is a lossy
parallel re-invention of the ratified `ActorReference`. That is an enum→set change plus one field — not the
epic I described, and **not grounds to invoke §8.4 L869**.

### C5 — I manufactured the blocker I reported. **(the root cause of "talking in circles")**

The §9.7 sentence I invoked to justify blocking the capability is a sentence **I wrote**, in `991c510`,
eleven hours earlier. `git show 991c510` confirms it as an addition:

> *"Each bounded try of a model/agent invocation—including every retry, reformat, and repair request—**is its
> own Execution Attempt** and its own record."*
> …
> *"Where … accepted contracts cannot represent these records losslessly, **block the capability and resolve
> Section 16 item 23**."*

Both clauses are mine. The sequence was:

1. I amended a *proposed* guide with a rule that over-reaches past the ratified meaning authority.
2. I found the code could not satisfy the rule.
3. I reported to the sponsor that **the contracts** were inadequate and the capability must **block**,
   citing my own sentence as the authority.

**The over-reach, precisely.** DOC-002 §3.3 scopes the Execution Attempt to the **Execution Aggregate**:
*"Owns: Execution Plan; Execution Step; Execution Attempt; …  Aggregate root: Execution Plan."* My sentence
declares *every* model/agent invocation to be an Execution Attempt — including PWA authoring, which has no
Execution Plan and, being design-time rather than the execution of PWU work, should not be given one merely to
satisfy a sentence in a draft. That over-reach **is** item-23 "blocker 4". I authored it, then discovered it,
then escalated it.

**What survives.** The *recording obligation* in that sentence is correct and worth keeping — it is the
substance the sponsor asked for. The *aggregate identity claim* is the defect. The two must be separated:
recording is universal; "is an Execution Attempt" is execution-plane, per DOC-002 §3.3.

**The lesson, generalized.** Amending a distillation is nearly free and feels like progress; it also silently
manufactures obligations that no ratified source imposes, which later present as discoveries about the code.
Any guide amendment must be checked against the governing layer **first** (§17 L2551), and an amendment that
creates an obligation the corpus does not impose is a defect in the amendment — not a finding about the code.

### C4 — §16 is a construction spec, not a wall.

I read the register as a set of prohibitions. Its **"Safe default" column is largely a set of recipes**:

- **item 23**: *"Evolve policy registry, schemas, persistence, projections, fixtures, and conformance tests
  **together** before claiming support."*
- **item 21** (governed stream): *"**Implement** one logical causally linked history across current typed
  objects, Events, audit, Artifacts, and Evidence, and query it through rebuildable projections."* It forbids
  only three named things: a universal stream record, competing Event authority, and a raw-CoT store.
- **item 8** (identifiers): *"**Extend** the registry/schema/tests before adding an object prefix."*

Item 23 never forbade building the Attempt record. It forbade building it piecemeal and claiming support that
had not been earned. `DECISION-item23-attempt-record.md` read a construction spec as a prohibition and is
superseded by this log.

---

## PART 1 — Confirmed defects (first-hand, orchestrator-verified)

Each was read directly in the file, not relayed. Section numbers are from the grepped header map, never
inferred from line numbers.

| # | Defect | Guide authority | Code | Verdict |
|---|---|---|---|---|
| F1 | The identity/provenance floor step asserts five literals instead of checking anything: `hasStableId: true, hasSemanticVersion: true, hasProvenance: true, hasProducer: true, traceComplete: true` | §8.4 L840 step 2 requires *"identity, semantic-version, provenance, authority, input/context/output, and trace completeness **checks**"* | `apps/rph-demo/src/lib/server/floor.ts:113-119` | CODE_IS_WRONG |
| F2 | The floor read-back path hardcodes `independenceOk: true`, so every reader sees independence certified regardless of what was recorded | §8.4 L851 *"whose actual identities and lineage are **recorded**"*; §8.4 L854 *"an … independence-invalid required review cannot satisfy assurance"* | `apps/rph-demo/src/lib/server/floor.ts:237` | CODE_IS_WRONG |
| F3 | The execution-plane floor gate hardcodes `{ aiProduced: false }`; combined with `if (!opts.aiProduced && latest.size === 0) return null`, a step with no recorded floor passes silently | §8.4 L844 *"the producer cannot exempt its own output, and **ambiguity resolves to material**"*; L856 *"gaps are never silent"* | `packages/rph-application/src/handlers/execution.ts:225` + `floor-gate.ts:92` | CODE_IS_WRONG |
| F4 | **The priority defect.** `ConversationEntry` = `{role, kind, text, success?}` is the entire durable record of an agent turn. No timestamp, no producer, no model, no materialized input, no repair outcome. The model that authored a PWA is **recorded nowhere** — `pi-agent.ts:112` resolves it, the floor binds it in memory, it evaporates | §9.7 L1340 *"Record the materialized input presented to the model, the returned answer output before schema coercion or repair, the resolved provider/model/version actually invoked, any declared truncation or omission, and the parse/validation/repair outcome"*; §5.6 L446-452 | `packages/rph-contracts/src/objects.ts:166-171` | CODE_IS_WRONG |
| F5 | `IndependenceRequirement` is single-valued; `checkIndependence` tests one axis at a time | §8.4 L851 requires *"at least a distinct evaluator invocation, role, and review context"* — conjunctive; §16 item 23 names *"conjunctive independence"* | `packages/rph-assurance/src/assurance-rules.ts:117-125` | CODE_IS_WRONG |
| F6 | `Identity` is a lossy parallel re-invention of the ratified `ActorReference`; drops `roleId` | §0.2 *"Ratified machine definition encodes that meaning / Generated contracts define executable shapes"* | `packages/rph-assurance/src/assurance-rules.ts:127-135` vs `envelopes.ts:22-31` | CODE_IS_WRONG |
| F7 | `RuntimeBinding` is generated, handled, and used on the execution plane — carrying `roleId`, `contextAssemblyPolicyId`, `observabilityPolicyId` — and the assurance floor consumes **none** of it | §8.4 L848 *"bind the exact subject/output, input and context versions, producing Attempt/invocation, policy/criterion versions"* | `objects.ts:498-510`; `rph-application/src/handlers/runtime-binding.ts` | CODE_IS_WRONG |

### The pattern under F1–F7

Every one is the same failure, and it is worth naming because it predicts where the rest will be: **the code
built a parallel, weaker shape beside a ratified one that already existed.** `Identity` beside `ActorReference`.
`ConversationEntry` beside `execution_attempts`. Floor constants beside `RuntimeBinding`'s real policy ids.
The governed layer ends up a *projection of code* rather than code being an instance of the contract — which is
the finding already recorded in project memory as `project_jpwb_hollow_governed_layer`, now with a mechanism.

The guide is not the thing out of step here. **The contract corpus is further ahead than the code**, and the
guide — a distillation of that corpus — has been read as if it were the ceiling rather than the summary.

---

## PART 2 — THE THESIS: there is one defect, and it has 75 symptoms

A 117-agent sweep raised 107 tensions across 10 dimensions and adversarially refuted each one. **75 survived**
(full table: `HARMONIZATION-FINDINGS.md`). The verdict distribution settles the framing question the sponsor
posed:

| Verdict | Count |
|---|---:|
| **CODE_IS_WRONG** | **64** |
| GUIDE_IS_WRONG | 2 |
| BOTH | 2 |
| UNCLEAR | 7 |

Severity: 11 CRITICAL, 25 BLOCKING, 37 MATERIAL. **This was not a two-sided reconciliation.** The guide is
very nearly right; the corpus beneath it is righter still; the code is what drifted.

### The single sentence

> **JPWB is a correct, thoroughly-tested professional kernel with an application layer that was never wired
> to it. The test suite is green because it tests the kernel. Production does not call the kernel.**

### The measurement

A census of every exported function in `rph-domain` and `rph-assurance`, asking only *"does any non-test,
non-dist code outside the defining file call this?"* (`dead-kernel-census.txt`):

- **LIVE (called by production): 19**
- **DEAD (tests only): 55**

**Seventy-four percent of the professional kernel is dead in production.** On that list:
`validateDecomposition`, `evaluateRecomposition`, `validateObligationConservation`,
`validateConstraintPropagation`, `assertTransition`, `evidenceAdmissibility`, `evaluateApplicability`,
`waiverCovers`, `waiverStillDischarges`, `retryDecision`, `assessModelOutput`, `canStartStep`,
`bindingPermitsExecution`, `capabilityAuthorized`, `classifyInterruptedAttempt`, `assessAcceptance`,
`assessFalsification`, `canSupersedeBaseline`, `impactedObjects` — and
**`executionAloneSatisfiesAssurance`**, which is **INV-5**, the invariant the product exists to guarantee.
Tested. Green. Never called.

### Why this explains everything at once

The recurring shape across all 75 findings is *"this control is structurally incapable of failing"*:

- the execution-plane floor gate can never block (`aiProduced: false` + early return);
- `evidenceExists`, `schemaValid`, `hasProvenance`, `traceComplete` are literal `true`;
- an Assessment can never reach `VALIDATOR_FAILED` or `INDEPENDENCE_VIOLATION`;
- the one-active-plan guard reads a field no handler writes, so it is always false;
- `PromoteBaseline`'s drift check passes `reviewedItems` the same array as `candidateItems`;
- `ValidatePwa` performs no validation; `ValidateDecomposition` carries the caller's own claimed disposition;
- the mutation gate asserts only that a static JSON array is non-empty;
- properties P9–P12 are defined out of the gate's universe, so it passes green.

Every one is the same thing: **the real check exists, in the kernel, tested — and a weaker literal was
written beside it at the call site.** The green suite is not evidence of conformance; it is evidence that the
kernel is good. Conformance was never measured, because nothing tests the *wiring*.

### The codebase says so itself

`packages/rph-application/src/handlers/decomposition.ts:1-5`, verbatim:

> *"ValidateDecomposition carries the validator's disposition (VALID | CONDITIONALLY_VALID | INVALID) to the
> matching terminal state; the deeper obligation-conservation / constraint-propagation checks (P2/P3) live in
> `@janumipwb/rph-domain` and **are a further wiring increment**."*

This is not a hidden defect. It is a documented, acknowledged, never-scheduled TODO — repeated, in effect,
55 times. Note also that `rph-application` defines a `validateDecomposition` **CommandHandler whose name
collides with the dead `rph-domain` guard of the same name**, and the registry wires the handler. The two
layers use one vocabulary for two different things, which is precisely how this stayed invisible.

### Why we kept "talking in circles"

Each session picked up a *symptom* — the floor's constants, the CoT scrape, the placeholder judge model, the
unrecorded producer — treated it as a local defect, fixed or escalated it, and moved on. The symptoms are
inexhaustible because the generator is still running. **This entry is the generator.** Nothing here is
resolved one call site at a time.

### The tradeoff this forces (taken, not asked)

Reading the guide as the ceiling produced "block the capability" over and over. The guide is a *distillation*;
the kernel already implements it; the corpus already contracts it. So:

- **Rejected:** amend the guide to match the code. That is "update only prose", which §17 L2551 names as a
  failure mode, and it would ratify the hollowness.
- **Rejected:** treat each finding as its own fix. 75 local fixes against a running generator.
- **Taken:** **a wiring program.** Route the application layer through the kernel that already exists, and add
  the one class of test nobody wrote — a test that the *call site* enforces, not that the kernel is correct.
  The guide changes only where it over-reaches past the ratified corpus (so far: C5, and finding #72).

This is *cheaper* than it looks, because the hard part — the professional logic — is written, tested, and
correct. What is missing is almost entirely call-site plumbing plus the tests that would have caught its
absence.

### Scope decision (taken, not asked)

`apps/rph-demo` is treated as **in scope**. It is the only place a real agent runs, and its own comments
assert §9.7/§8.12 conformance (`transcript.ts:1`, `pi-agent.ts:110`). Either it is held to that claim or the
claim is deleted; "it's just a demo" is not available to code that certifies itself.

---

## PART 3 — Increment plan

Ordered by *"what is currently lying"*, not by ease. Each lands with the full gate green and a mutation proof
(reintroduce the defect → the new test goes red). No increment claims support it has not earned (§16 item 23:
*"Evolve policy registry, schemas, persistence, projections, fixtures, and conformance tests together before
claiming support"*).

| # | Increment | Kills |
|---|---|---|
| 1 | **Wiring conformance tests** — the missing test class, written FIRST: for each mandatory control, assert the *call site* rejects a violating input. These must go red against today's code. | the generator itself |
| 2 | **The floor stops asserting** — replace the literal `true`s with the dead kernel (`evidenceAdmissibility`, real identity/provenance/trace facts); `aiProduced` resolved from the actual actor, ambiguity → material (§8.4 L844) | F1, F3, 18, 47, 48, 67, 8 |
| 3 | **Independence becomes conjunctive** — `IndependenceRequirement` enum → set; `roleId` onto `Identity`; persist evaluator + producer identity; delete the hardcoded `independenceOk: true` read-back | F2, F5, F6, 19, 20, 21, 45 |
| 4 | **The governed stream records the exchange** — the sponsor's priority. Producer/model/time/materialized-input/repair-outcome onto the authoring record; correlationId that actually correlates; no swallowed catches | F4, 1, 12, 13, 15, 16, 38, 39, 42, 43, 44 |
| 5 | **Waivers stop being Booleans** — route through the dead `waiverCovers`/`waiverStillDischarges` (criterion + object + version scoped); §16 item 12 forbids the Boolean outright | 3 |
| 6 | **Publication proves something** — `ValidatePwa` runs real checks; semanticVersion bumps on edit so the floor's version binding stops being inert | 35, 36, 62, 64 |
| 7 | **Command pipeline** — `expectedRevision` honored; Event payloads validated against the generated EVENTS registry; stop copying Command payloads into permanent Events | 4, 5, 6, 23, 52 |
| 8 | **Guide corrections** — C5's §9.7 over-reach; #72 (Shape Engineering ratified-vs-candidate); #75 (`UNDER REVIEW` enum) | the 2 GUIDE_IS_WRONG |

**Deliberately deferred, disclosed:** authentication/authorization (findings 9, 10, 11, 25, 50, 70). No
endpoint authenticates and the server fabricates a HUMAN principal. This is real and CRITICAL, but it is a
platform-security workstream, not a harmonization of guidance against code, and JPWB is development-stage
with no production data. It must not ship to any multi-tenant edition unresolved.

---

## PART 4 — Open questions genuinely for the sponsor

*(kept deliberately short — under the 2026-07-15 mandate, a tension is work, not a question, unless it
requires knowing something only the sponsor knows)*

1. **Does the authoring plane get an Execution Plan?** DOC-002 §3.3 roots the Execution Attempt in the
   Execution Aggregate. PWA authoring is design-time and has no Plan. Either authoring model calls are
   recorded as something *other than* an Attempt (my C5 correction assumes this), or authoring acquires a
   Plan. I am proceeding on the former — it follows DOC-002 — but it is a genuine ontology choice and I want
   it seen rather than buried in an increment.
