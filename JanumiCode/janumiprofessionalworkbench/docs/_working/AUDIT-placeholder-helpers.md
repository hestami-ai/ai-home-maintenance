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

> ### ⚠️ CORRECTION 2026-07-16 — "clean" in the table above means the WRONG thing, and it misled my own sequencing
>
> That column counts **fields whose TYPE resolves** (no undefined dependent helper). It does **not** mean *the
> content exists to fill them*. Those are different questions and I conflated them — then sequenced off the
> conflation.
>
> | helper | types resolve | **content exists** |
> |---|---:|---|
> | `AssessmentCriterion` | 8/8 | **5 of 8** — `name`, `criterionType`, `evaluationMethod` had no source. I authored `name` and got caught claiming otherwise (Increment 11a). |
> | `FindingDefinition` | 6/6 | **3 of 6** — `code`, `description`(←`statement`), `defaultSeverity`(←`severity`) exist. **`name`, `affectedClaimTypes`, `defaultControlActions` have no source at all.** |
>
> DOC-004 ratifies `FindingDefinition`'s **shape** (§9.1) and each policy's **finding CODES** (§15.7, §16.5, …)
> — but the per-code *name*, *affected claim types* and *default control actions* **are ratified nowhere**.
> Transcribing the shape therefore forces authoring **33 values across the 11 existing findings**, 22 of them
> *semantics* rather than labels. `affectedClaimTypes: []` would assert "this finding affects no claims" —
> false. Filling it from the policy's own `evaluatedClaimTypes` is an **inference**, not a transcription.
>
> **That is a materially different proposition from `AssessmentCriterion`, and the table above hides it.** The
> "recommended sequencing" below is corrected accordingly: `FindingDefinition` is *not* the cheap second step.

### MEASURED 2026-07-16 — the seeded policy library is 11% of DOC-004's ratified findings

Counting every `` * `CODE` `` under each policy's Findings section:

| | |
|---|---:|
| ratified finding codes in DOC-004 (§15.7 … §26.5, 12 policies) | **100** |
| present in the seed | **11** |
| **absent** | **89** |

Every one of the seed's 11 **is** ratified (no invented codes), and the floor's own 2 (`SCHEMA_INVALID`,
`INVARIANT_VIOLATION`) are guide-only — consistent, since the de minimis floor is not in DOC-004's catalog at
all. Per policy: POL-INTENT-FIDELITY 2 of 7, POL-DECOMPOSITION-COVERAGE 2 of 10, POL-ARCHITECTURE-COVERAGE 2 of
12; POL-REQUIREMENT-COVERAGE, POL-CONSTRAINT-PROPAGATION, POL-HISTORICAL-CONSISTENCY, POL-TEST-ADEQUACY,
POL-FITNESS-FOR-PURPOSE and POL-BASELINE-PROMOTION ship **zero** of theirs.

**This is not necessarily a defect** — the seed is a demonstration fixture and may be a deliberate subset. It
*is* a fact worth knowing before anyone treats the seeded library as the catalog: the ratified codes are pure
transcription (89 of them), but each needs the three unratified fields above to become a `FindingDefinition`.
**Whether to populate the catalog is a sponsor decision, not a schema one.**

**Blast radius, stated up front, because it is the reason this is not being done inside this audit:** tightening
`AssessmentCriterion` breaks every `{id, statement, mandatory}` literal — the 3 floor policies, the 6 seed
policies, the mock Reasoning-Review Validator, and the PWA Designer's policy-manager authoring surface. That is
a **correct** break (they encode a shape no document ratifies), but it is a migration with a real decision in
it: `statement` → `description`, `mandatory: true` → `severityIfNotMet: 'BLOCKING'`, and four fields that have
no current value at all. Doing that as a silent tail-end sweep is how you ship confidently-wrong architecture.

## ✅ STEP 1 DONE — `9035a37` (Increment 11). And it found a bigger defect on the way.

`AssessmentCriterion` is transcribed from DOC-004 §7 and **enforced**; all writers migrated. Full CI gate green
incl. Playwright. Details in `HARMONIZATION-LOG.md` → Increment 11. Two things worth carrying forward:

**1. The invented shape had FOUR restatements, not three.** The fourth is `broker.ts` — **the agent-facing
authoring path**, so an agent's authored policy became `{id, statement, mandatory}` too. All four are now
aliases of the generated type, so the next divergence fails the build.

**2. THE WIRE CONTRACT WAS BLIND — and this dwarfs the criterion fix.** Tightening the payload *silently did
nothing*. `gen-messages.ts` built its schema sets with `/export const (\w+)Schema =/` (capturing the name
**before** `Schema`) and then looked up `` `${t}Schema` ``:

```
OBJ.has('ActorReference')        -> true
OBJ.has('ActorReferenceSchema')  -> false   <- what the code actually asked
```

Both the object and envelope branches were **dead**. Every object-typed payload field fell silently to
`z.unknown()`. Proof it was never reachable: the generated `messages.ts` imported **only** from `./enums.js` —
never once from `./objects.js` or `./envelopes.js`, across 70 commands and 122 events. Fixed: `z.unknown()`
**67 → 1**, newly enforcing **47** real-`strictObject` refs (incl. **`ActorReference` ×10** — the actor on a
command was accepted unvalidated); 51 refs still resolve to placeholder `z.record` and remain permissive.

**This changes what the other 8 helpers are worth.** Transcribing a helper now actually reaches the wire — it
did not before. Every "the payload validates X" belief in this repo predating `9035a37` should be re-checked.

**A finding surfaced while doing it:** the 6 additive policies exist **twice** — `m8-ontology.json`'s
`seedPolicies` *and* `seed-workbench.ts`'s `ADDITIVE_POLICY_SEEDS`, same ids (`pol_intent_fidelity`),
independently maintained. The "parallel unsynchronized restatement" pattern again; it doubled this migration's
literal count. Not fixed — dedup is its own decision.

## Recommended sequencing

> **RE-ORDERED 2026-07-16.** The original order ranked by "types resolve" and put `FindingDefinition` second as
> "same shape of change, smaller blast radius". **Both halves of that were wrong**: it needs 3 of 6 fields
> authored (22 of the 33 values being semantics, not labels), which makes it the *most* inventive of the three,
> not the cheapest. Rank by **content available**, not by types resolving.

1. **`AssessmentCriterion`** (5 of 8 fields had content) — **DONE**, `9035a37` + `581be51`.
2. **`WaiverRule`** (§12.1) — **now second.** Its instances are `waiverRules: []` everywhere ("the seed fills
   them empty"), so tightening the shape migrates *nothing* — the cheapest of the three by a wide margin. It
   also ratifies `waiverAllowed` + `requiredAuthorityType`: the real home for the floor content-lock that
   `rejectIfFloorLocked` hand-rolls today (recorded as my own invention, with an INV-5 misattribution).
   ⚠️ Shape only. **Retiring the lock needs the store→runtime content path to be real first** — an edited
   criterion that changes the UI card and nothing in the evaluation is "a policy that lies about what it
   checks", which is worse than the lock.
3. **`FindingDefinition`** (§9.1) — **now last of the three, and it is a CONTENT decision, not a schema one.**
   Sponsor call: (a) author `name`/`affectedClaimTypes`/`defaultControlActions` for the existing 11 and disclose
   it, (b) leave it a placeholder until DOC-004 ratifies the per-code fields, or (c) fold it into a catalog pass
   that also transcribes the 89 absent ratified codes.
4. **`ValidatorResult`** — delete it from `FORCE_PLACEHOLDER`; the vocab already carries its fields.
   ⚠️ **A ratified conflict must be resolved first** (§17: surface, don't silently choose): **DOC-007 §20**
   defines 16 fields **including `subjectSemanticVersions`**; **DOC-004 §4.2** defines 15, **omitting it**.
   DOC-007 is the wire authority and its version is the safer one — it binds the verdict to the subject version,
   which is precisely what Increment 10b showed the floor cannot do without. But this is a document conflict,
   and it gets surfaced rather than chosen quietly.
5. **`ApplicabilityExpression`** — likewise `FORCE_PLACEHOLDER`; DOC-007 §18's 8-arm union.
6. The remaining 3 (partial), then the 25 genuinely-undefined stay `any` **and correctly so**.

## MEASURED 2026-07-16 — SEVEN of the policy's ratified rule arrays are UNREACHABLE

Found while transcribing `WaiverRule`: the test could not set `waiverRules` at all —
`Unrecognized key: "waiverRules"`. Checking every command and event payload in the vocab:

| `AssurancePolicyDefinition` field | ratified in | any command/event carries it? |
|---|---|---|
| `waiverRules` | DOC-004 §12.1 | **NO** → hardcoded `[]` |
| `dispositionRules` | DOC-004 §10.2 | **NO** → hardcoded `[]` |
| `escalationRules` | DOC-004 §13 | **NO** → hardcoded `[]` |
| `remediationRules` | DOC-004 §11 | **NO** → hardcoded `[]` |
| `requiredEvidence` | DOC-004 §6.1 | **NO** |
| `optionalEvidence` | DOC-004 §6.1 | **NO** |
| `riskProfiles` | DOC-004 §3.1 | **NO** |

The object schema **requires** them; no command can set them; so `assurance.ts` fills four with a constant.
**This is ARTIFACT's dangling reference again** (Increment 10a): the object demands a field, the wire has
nowhere to put it, and a constant plugs the hole.

**The consequence is the sharpest statement of the hollow governed layer yet.** A policy — seeded or authored,
by a human or an agent — can declare **none** of the rules that make it a policy: not what makes it SATISFIED
vs REJECTED (§10.2), not when it escalates (§13), not what evidence it needs (§6.1), not whether it may be
waived (§12.1). The placeholder types were only half the story: **even fully typed, nothing could set them.**

**`waiverRules` is now reachable** (§12.1 transcribed; the payload field authored under the grant; the handler
persists rather than blanks it) — so a policy can finally declare `waiverAllowed: false`. **The other six
remain unreachable**, deliberately: each needs its helper transcribed first, and `dispositionRules` (§10.2)
and `escalationRules` (§13) both depend on `PolicyExpression`, **which the corpus references and never
defines**.

## The durable correction

The vocab's `openItems` and helper notes are **not trustworthy as-is**: they were written by passes that
searched a subset of the corpus, or looked for a single kind of thing. Each "unspecified / to-be-designed /
Source TBD" is a claim about a *search*, not about the *corpus*. Before any of them is used to justify authoring
a shape — or to justify refusing to — **it must be re-checked against all 14 documents.** The notes for the 9
above are corrected in place; the ~25 confirmed negatives are now evidence-backed rather than assumed.
