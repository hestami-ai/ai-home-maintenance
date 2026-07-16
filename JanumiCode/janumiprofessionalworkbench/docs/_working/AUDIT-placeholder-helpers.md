# Audit — 9 of 34 "unspecified" helper types are ratified, field-complete, and typed `any object` in code

**Produced 2026-07-16. Read-only audit; no code changed by it. This is a FINDING.**

Triggered by Increment 10a: the `ARTIFACT` object carried the vocab note *"UNSPECIFIED in BOTH DOC-002 and
DOC-007 … Fields to-be-designed; **do not fabricate**. OPEN ITEM"* — while **DOC-009 §18.1** defined it
completely. Since that same reflex had already produced one false blocker of mine (§16 item 23: I searched
DOC-007, never opened DOC-009, which defines `execution_attempts` in full), the question was: **is ARTIFACT the
last one, or the first one found?**

## Method

All **34** helper sub-types emitted by codegen as `z.record(z.string(), z.unknown())` — "any object" — were
audited against the **full 14-file ratified corpus**, not the DOC-002+DOC-007 pair. One agent per type searched
for a real definition (a TS `interface`/`type` with fields, a `create table` whose columns *are* the fields, or
prose enumerating them). A mere mention, a field whose *type* is the helper, or a schema filename in an index
were all explicitly disqualified.

Every **positive** was then attacked by 2 independent adversarial verifiers instructed to refute it — because
the expensive error here is a **false positive**: it would let me author a schema and cite a section that
doesn't say what I claim, in a system built for high-consequence work. A claim survived only on a unanimous
verdict. **9 survived; 25 were confirmed genuinely undefined.**

All 9 were then **re-verified by hand** against the source documents (`grep -n "^interface"`), because an
adversarial panel is still a panel of the same kind of thing I am.

## Result — 9 ratified, field-complete, typed `any object`

| Helper | Ratified in | § | Fields | What it governs |
|---|---|---|---:|---|
| **AssessmentCriterion** | DOC-004 | §7 (L371) | 8 | **What an assurance policy's criteria ARE** |
| **FindingDefinition** | DOC-004 | §9.1 (L474) | 6 | What a finding is + its default severity |
| **DispositionRule** | DOC-004 | §10.2 (L547) | 5 | What makes an assessment SATISFIED vs REJECTED |
| **WaiverRule** | DOC-004 | §12.1 (L626) | 8 | **Whether a policy may be waived at all, and by whose authority** |
| **EscalationRule** | DOC-004 | §13 (L668) | 4 | When and to whom assurance escalates |
| **EvidenceRequirement** | DOC-004 | §6.1 (L317) | 9 | What evidence a policy requires, and its cardinality |
| **ApplicabilityRule** | DOC-004 | §5.1 (L267) | 9 | When a policy applies |
| **ApplicabilityExpression** | **DOC-007** | §18 (L1299) | 8-arm union | The declarative applicability predicate |
| **ValidatorResult** | **DOC-007** | §20 (L1477) | 16 | **The assurance verdict itself** |

Genuinely undefined (25), confirmed — the restraint on these was **correct**: `ArtifactReference`,
`ArtifactRequirement`, `CapabilityGrant`, `CapabilityRequest`, `ClaimAssessmentResult`, `ClaimTemplate`,
`Condition`, `ConfidenceAssessment`, `ControlActionRecommendation`, `DesiredOutcome`, `EscalationPolicy`,
**`ExecutionProvenance`**, `ExecutionTransition`, `InputBinding`, `ModelSelectionPolicy`, `OutputBinding`,
`OutputDefinition`, `ProposedAssuranceObservation`, `RejectedEvidenceReference`, `RemediationRule`,
`RetryPolicy`, `SandboxPolicy`, `SuccessCondition`, `TacticalChangePolicy`, `TerminationPolicy`.

> **`ExecutionProvenance` is genuinely undefined** — 3 occurrences in the corpus, all *usages*. This
> **validates** the restraint already recorded in `floor-gate.ts` and §16 item 23: `executionProvenance` is
> `z.unknown()` and cannot be read "without inventing a shape." That disclosure stands, now on evidence rather
> than on assumption.

## The mechanism — THREE distinct failures, one output

The interesting result is that these did **not** all come from the same mistake.

**1. A document nobody opened** (ARTIFACT, and my item-23 blocker). DOC-002 is "meaning" and DOC-007 is "wire",
so they *feel* like the whole contract. DOC-009 is filed as "Persistence, Migration, Dual-Run, and Cutover" — it
reads like an implementation detail. It is in fact the most field-complete document in the corpus.

**2. A harvest pass that only looked for enums** (the 7 DOC-004 helpers). This one is worse, because the
citation *looks* diligent. The vocab's own note for `AssessmentCriterion`:

> `"NOT field-defined; DOC-004 §7 supplies criterionType/evaluationMethod/severityIfNotMet enums. Source TBD."`

**DOC-004 §7 *is* `interface AssessmentCriterion { … }`.** Those three enums are *members of the interface it
says isn't field-defined.* The author opened the exact section, reached inside the interface body, extracted its
enums, and recorded its fields as nonexistent. Same for `FindingDefinition` (§9.1), which the note cites while
calling it "NOT field-defined. Source TBD."

The lesson generalizes past this repo: **a pass that extracts one kind of thing will report the absence of every
other kind.** The enum harvest was not wrong; its *negative space* was recorded as a finding about the corpus
when it was only a fact about the pass.

**3. A deliberate deferral that outlived its milestone** (`ApplicabilityExpression`, `ValidatorResult`). These
two are field-defined **in the vocab** *and* in DOC-007. They are placeholders anyway, because
`gen-objects.ts` hardcodes:

```ts
// Complex helpers whose faithful shape belongs to a later milestone — placeholder for M1 even if >=2 fields.
const FORCE_PLACEHOLDER = new Set(['ApplicabilityExpression', 'ValidatorResult']);
```

An **M1** decision. The repo is past **M14 + charter remediation**. The generator's header comment —
"Helpers the specs REFERENCE-BUT-NEVER-DEFINE are emitted as permissive structured placeholders … tightened in
the milestone that defines them (M7/M9/M11)" — is now false on both halves: the specs *do* define these, and the
milestones that were going to tighten them have passed.

## Why this matters — it is the MECHANISM of the hollow governed layer

This is not a typing nicety. `AssurancePolicy` composes these helpers:

```ts
criteria: z.array(AssessmentCriterionSchema)   // = z.array(z.record(z.string(), z.unknown()))
findingDefinitions, waiverRules, dispositionRules, escalationRules, requiredEvidence, applicability  // all the same
```

**Every field that makes an assurance policy mean anything is `any object`.** So the runtime cannot read a
policy even in principle — which is exactly the already-recorded finding that JPWB's governed objects are *a
projection of code, not its source* (seeded policies are never read; `floor.ts` hardcodes the plan). The cause
was never laziness in the handlers. **The types said nothing, so nothing could be read.**

### The proof: the code invented a criterion shape that contradicts the ratified one

DOC-004 §7 (ratified):
```ts
interface AssessmentCriterion {
  id; name; description;
  criterionType: 'BOOLEAN'|'ENUMERATED'|'QUALITATIVE'|'QUANTITATIVE'|'COMPOSITE';
  evaluationMethod: 'DETERMINISTIC'|'MODEL_JUDGMENT'|'HUMAN_JUDGMENT'|'HYBRID';
  requiredEvidenceIds: string[];
  severityIfNotMet: 'INFORMATIONAL'|'ADVISORY'|'MATERIAL'|'BLOCKING'|'CRITICAL';
  mayBeNotApplicable: boolean;
}
```

`packages/rph-assurance/src/floor-policies.ts` (shipped):
```ts
{ id: 'IP-02-version', statement: 'The subject carries a semantic version.', mandatory: true }
```

**No overlap beyond `id`.** No `statement` and no `mandatory` exist in the ratified type. And
`severityIfNotMet` — a **five-level** severity — was collapsed into `mandatory: boolean`, which is the same
disease §16 item 12 names for waivers ("Never implement waiver as a Boolean"). Nothing caught it, because
`z.record(z.string(), z.unknown())` accepts anything at all.

`WaiverRule` is the sharpest instance. DOC-004 §12.1 ratifies `waiverAllowed: boolean`, `eligibleCriteriaIds`,
`prohibitedFindingSeverities`, `requiredAuthorityType`, `maximumDuration` — i.e. **the ratified way for a policy
to declare it may not be waived, and by whose authority it may.** The de minimis floor's content-lock is
currently a hand-rolled guard (`rejectIfFloorLocked`), previously recorded as *my invention*. It has a ratified
home, and it has had one all along.

## What this does NOT license

The 9 are **not** a clean transcription like ARTIFACT was. Their fields reference further types, and most of
those are genuinely undefined — `PolicyExpression`, `ObjectTypeCondition`, `RiskCondition`,
`SemanticChangeCondition`, `AdmissibilityRule`, `FreshnessRule` are each referenced by DOC-004 and defined
nowhere in it. Only `ControlAction` and `IndependenceRequirement` resolve.

So the honest per-helper picture is a **partial tightening** — type what is ratified, leave the
undefined-typed fields permissive and labeled — which is still strictly better than "the whole object is
`any`", but needs a judgment call per field, not a sweep. Two are clean:

| Helper | Ratified fields with NO undefined dependency |
|---|---:|
| **AssessmentCriterion** | **8 of 8** — every field is a primitive or an enum |
| **FindingDefinition** | **6 of 6** — `ControlAction` + `ClaimType` both resolve |
| WaiverRule | 7 of 8 (`revalidationTrigger` → PolicyExpression) |
| EvidenceRequirement | 7 of 9 |
| DispositionRule | 4 of 5 |
| EscalationRule | 3 of 4 |
| ApplicabilityRule | 4 of 9 |

**`AssessmentCriterion` is the highest-value, lowest-risk fix in the repo right now**: zero undefined
dependencies, and it is the type the entire assurance floor is expressed in.

**Blast radius, stated up front, because it is the reason this is not being done inside this audit:** tightening
`AssessmentCriterion` breaks every `{id, statement, mandatory}` literal — the 3 floor policies, the 6 seed
policies, the mock Reasoning-Review Validator, and the PWA Designer's policy-manager authoring surface. That is
a **correct** break (they encode a shape no document ratifies), but it is a migration with a real decision in
it: `statement` → `description`, `mandatory: true` → `severityIfNotMet: 'BLOCKING'`, and four fields that have
no current value at all. Doing that as a silent tail-end sweep is how you ship confidently-wrong architecture.

## Recommended sequencing

1. **`AssessmentCriterion`** (8/8 clean) — with the floor/seed/validator migration done explicitly, not implied.
2. **`FindingDefinition`** (6/6 clean) — same shape of change, smaller blast radius.
3. **`WaiverRule`** (7/8) — retires the hand-rolled floor content-lock in favour of the ratified `waiverAllowed`.
4. **`ValidatorResult`** — delete it from `FORCE_PLACEHOLDER`; the vocab already carries its fields.
   ⚠️ **A ratified conflict must be resolved first** (§17: surface, don't silently choose): **DOC-007 §20**
   defines 16 fields **including `subjectSemanticVersions`**; **DOC-004 §4.2** defines 15, **omitting it**.
   DOC-007 is the wire authority and its version is the safer one — it binds the verdict to the subject version,
   which is precisely what Increment 10b showed the floor cannot do without. But this is a document conflict,
   and it gets surfaced rather than chosen quietly.
5. **`ApplicabilityExpression`** — likewise `FORCE_PLACEHOLDER`; DOC-007 §18's 8-arm union.
6. The remaining 3 (partial), then the 25 genuinely-undefined stay `any` **and correctly so**.

## The durable correction

The vocab's `openItems` and helper notes are **not trustworthy as-is**: they were written by passes that
searched a subset of the corpus, or looked for a single kind of thing. Each "unspecified / to-be-designed /
Source TBD" is a claim about a *search*, not about the *corpus*. Before any of them is used to justify authoring
a shape — or to justify refusing to — **it must be re-checked against all 14 documents.** The notes for the 9
above are corrected in place; the ~25 confirmed negatives are now evidence-backed rather than assumed.
