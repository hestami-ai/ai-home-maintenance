# JPWB §5 Reconciliation Ratify Sheet (M0)

> The specs (RPH-DOC-001..009) evolved by exploration and carry internal vocabulary drift. This sheet is the
> **authoritative resolution** of that drift, grounded in a verbatim extraction of DOC-002/004/006/007 and
> reconciled by the docs' own **authority precedence**: *domain invariants > reference-fixture convenience ·
> assurance/authority (DOC-004) > legacy phase behavior · latest serialized contract (DOC-007) governs
> envelopes/ids/errors/TraceRelation · canonical semantics > DB/UI convenience.*
>
> **Machine source of truth:** `packages/rph-contracts/vocab/canonical-vocabulary.json` (84 enums, 22 id
> prefixes, 16 error codes, 22 envelopes, the DSL). Enums are generated from it into `src/enums.ts`; a
> fidelity test binds the two. **Status: RATIFIED (by the build agent, best judgment) 2026-07-10.** Items in
> §C are flagged in `docs/_working/OPEN-QUESTIONS.md` for sponsor confirmation but did not block the build.

## A. Cross-document conflict resolutions (14)

| # | Topic | Resolution | Authority |
|---|-------|-----------|-----------|
| 1 | **IndependenceRequirement** (5 vs 8) | Adopt DOC-004 §8.1 **8-value** superset (+ DIFFERENT_CONTEXT_INSTANCE, DIFFERENT_PROVIDER, ORGANIZATIONALLY_INDEPENDENT). | DOC-004 governs assurance enums |
| 2 | **ControlAction** (18 vs 10 vs 23) | Canonical = DOC-004 §11 **23-value** superset. Normalize on ingest: §18 `RESHAPE→RESHAPE_PWU`, `REPLAN→REPLAN_EXECUTION`; §37 `WAIVE→REQUEST_WAIVER`. DecisionType RESHAPE/REPLAN are a **separate** enum, kept verbatim. | DOC-004 governs ControlAction |
| 3 | **Assurance state vs disposition conflation** | Three distinct axes: **AssuranceAssessmentState** (DOC-004 §30, 15 incl. WAIVER_EXPIRED); **AssuranceDisposition** meanings (DOC-004 §10.1, 6 incl. WAIVED, waiver-flow only); **AssuranceDispositionRecommendation** (5, WAIVED excluded) for validator/rule/completed-event. | DOC-004 governs assessment semantics |
| 4 | **assessmentState WAIVER_EXPIRED** (14 vs 15) | Include WAIVER_EXPIRED (15-value set). | DOC-004 §30 |
| 5 | **TraceRelation** (17 vs fixture 12) | Adopt DOC-007 §24 **17-value** set. Fixture edge labels (DEFINES, REALIZED_BY, …) are display-only. | DOC-007 latest contract; fixture lowest |
| 6 | **CriterionResult casing** | UPPERCASE_SNAKE_CASE serialized form (MET, PARTIALLY_MET, NOT_MET, NOT_APPLICABLE, UNABLE_TO_DETERMINE). | DOC-007 §4.5 mandates UPPER_SNAKE |
| 7 | **ObjectEnvelope shape** | Adopt DOC-007 §7; **drop `authorityId`**; add required `schemaVersion`. Version quartet = contractVersion / schemaVersion / semanticVersion / revision. | DOC-007 latest contract |
| 8 | **AssurancePolicyDefinition shape** | Envelope follows DOC-007 §17; **retain `riskProfiles` as optional** (its omission from the serialized contract looks unintended). *(open item C-5)* | DOC-007 envelope + DOC-004 semantics |
| 9 | **Aggregate assurance disposition** (9 vs 6) | Keep **two distinct enums**: `AssuranceViewAggregateDisposition` (read-model, DOC-007 §26.2, 9) vs `AggregateAssuranceDisposition` (composition rule, DOC-004 §28.2, 6). *(open item C-7)* | Different fields, both authoritative |
| 10 | **Compatibility milestone labels** (11 vs 7 vs 8) | Adopt DOC-007 §26.3 **11-value** superset. Both DOC-006 lists are display-only; phase labels are never authoritative state. | DOC-007 latest projection; fixture lowest |
| 11 | **DomainCommand/Event/Actor shape** | Adopt DOC-007 §8/§9/§6 (adds commandSchemaVersion, targetAggregateType, idempotencyKey; eventSchemaVersion; providerId). | DOC-007 latest contract |
| 12 | **ID prefix format + coverage** | Canonical registry = DOC-007 §5.1 tokens (`<prefix>_<ULID>`, no trailing underscore). `obl/art/dcp/rcp` ratified from the fixture for the 4 uncovered union types. Extra fixture prefixes (evreq/ver/amb/human/agent/exec) excluded. *(open item C-8)* | DOC-007 ids; fixture lowest |
| 13 | **ProfessionalWorkObjectType coverage** (17 vs fixture 10) | Adopt DOC-002 §4 **17-value** set. | Domain model over fixture |
| 14 | **FailureSeverity vs AssuranceSeverity** (4 vs 5) | Keep **two separate enums** (FailureSeverity 4; AssuranceSeverity 5 incl. INFORMATIONAL). Do not merge. | Distinct fields |

## B. Ratified registries (implemented)

- **Id prefix registry (22)** → `src/ids.ts#ID_PREFIXES`, fidelity-tested vs the vocabulary. Covers the 17
  PWObject types + sub-objects (EXECUTION_STEP `step`, EXECUTION_ATTEMPT `attempt`, TRACE_LINK `trace`,
  COMMAND `cmd`, EVENT `evt`).
- **Error codes (15) + category mapping** → `src/errors.ts`. The 15 `RPH_*` codes (DOC-007 §25.1) are the
  RphError codes; **`VALIDATOR_FAILED` is NOT an error code** — it is an AssuranceAssessmentState (validator
  output ruled inadmissible), per DOC-004. The code→category map is best-judgment (C-6, see §C).
- **Content hash** = `sha256:<hex>` over deterministic canonical JSON → `src/hash.ts` (MUST for baseline
  items + admitted evidence).
- **Schema id scheme** = `urn:janumi:rph:schema:<category>:<name>:<version>` → `src/validate.ts`.
- **72 closed enums** (84 − 12 `Finding.*`, which are Product Realization PWA policy DATA for M8) → generated `src/enums.ts`.

## C. Best-judgment decisions on the 11 sponsor-open items

Resolved to keep the build moving; all logged in `docs/_working/OPEN-QUESTIONS.md` for confirmation.

| # | Item | Decision (best judgment) |
|---|------|--------------------------|
| C-1 | **pwuKind** closed set | Model as a validated **string**, not a global enum — the Product Realization PWA ontology (M8) defines PWU kinds as versioned data. |
| C-2 | **artifactType** closed set | Same — validated **string**, ontology-defined (M8). |
| C-3 | RecompositionContract conflictType/action | **Free-form strings** (domain-instance data, not a system enum) unless sponsor defines a registry (M9). |
| C-4 | ControlAction legacy `WAIVE` | Normalize `WAIVE → REQUEST_WAIVER`; do not persist WAIVE as a distinct action. |
| C-5 | AssurancePolicyDefinition.`riskProfiles` | **Retain as optional** (needed for risk-proportional gating, M7/M8). Confirm the serialized-contract omission was unintended. |
| C-6 | **RphError code→category mapping** | **Authored** (see `src/errors.ts#ERROR_CODE_CATEGORY`). *This is the one decision most worth a sponsor sanity-check.* |
| C-7 | Aggregate disposition reconciliation | Kept as two enums (read-model vs composition). Confirm whether they should converge. |
| C-8 | Id prefixes obl/art/dcp/rcp | **Ratified** as canonical. Confirm tokens. |
| C-9 | PolicyExpression grammar | **Unify** with the DOC-007 §18 ApplicabilityExpression op set (one DSL) — built in M7. |
| C-10 | Intent duplicate status fields | `intentStatus` is the canonical typed field; `lifecycleStatus` is the generic ObjectEnvelope mirror. |
| C-11 | DOC-006 §30.3 recommended vocab | Noise — a fixture display artifact; superseded by the DOC-004 disposition sets. No schema enum. |
