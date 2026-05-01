# Assessment: domain_interpreter / product_intent_discovery (Phase 1.3.1)

**Sample:** `track_c_samples/03_domain_interpreter__product_intent_discovery.md`
**Reviewed agent:** `domain_interpreter` running `qwen3.5:9b` (15 KB JSON output, 12 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

The agent emitted a 15 KB `intent_discovery` JSON object covering vision, description, six personas, four user journeys, three-phase phasing strategy, six success metrics, four UX requirements, seven `requirements`, six `decisions`, four `constraints`, and four `openQuestions`. The reviewer returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The agent's reasoning is exceptionally thorough ... adhered strictly to the negative constraints, filtering out technical stack details (e.g., SvelteKit, Bun) and focusing only on business-level requirements ..."
}
```

The schema/gate consistency is intact (`has_concerns=false` ↔ `concerns=[]`). The substantive failure is that the reviewer endorses the output as scope-clean and traceable when the agent has, by quoted evidence in the response itself, (a) hallucinated two of four user journeys from a competitor reference appendix, (b) drifted across the 1.0c/1.0d boundaries that the prompt dedicates to sibling passes, (c) embedded an open question of its own as a settled decision, and (d) inverted persona-source labels — coding explicitly named personas as `ai-proposed` while accepting the rest as `domain-standard`.

The failure mode here is structurally different from samples 01–02. IQC's risk was *enumerate-then-drop*; lens classification's risk was *confidence calibration vs. competitor adjudication*. Discovery's risk class is **scope-boundary discipline plus extraction traceability** — and neither has a code-level analogue (unlike calibration-rule code in sample 02). The agent is processing a multi-section document with five sibling passes carving up the territory; the reviewer must police those carve-outs, and the current single-pass reviewer does not.

### 1.1 Two of four user journeys are absorbed wholesale from competitor reference appendices

The source's Pillar 2 section is explicit:

> "### Hestami Service Provider Field Services Management User Journeys
> Based on business domains and user personas typical for field service management software"

There are **no Pillar 2 journeys listed in the source.** The header is followed by a bare descriptive sentence and nothing else. The Pillar 3 section is identical:

> "### Hestami Community Association Management User Journeys
> Based on business domains and user personas typical for community association management software"

The agent nonetheless emits `UJ-EXECUTE-JOB` ("Field Job Execution & Management" — Dispatch → mobile workflow → invoice generation) tagged `source: "domain-standard"`, and `UJ-GOVERNANCE-COMPLIANCE` ("Community Governance & Violation Handling" — violation review → fines/GL → board financial reports) tagged `source: "domain-standard"`. These steps trace not to Pillar 2/3 native journeys (there are none) but to the **ServiceTitan and Vantaca appendices**, which the prompt instructs the agent to handle differently:

> "When source docs reference external companies as product-shape comparisons (e.g., 'like ServiceTitan'), surface what that example implies about product scope / user segment as an open question or a tentative decision."

The agent's own thinking acknowledges the rule:

> "'ServiceTitan' reference. It's a comparison. … The 'Decision' might be 'Target ServiceTitan-style architecture for FSM Pillar'. The 'Open Question' might be 'What specific ServiceTitan features to mirror vs innovate?'."

— and then proceeds to inline ServiceTitan's "Scheduling and Dispatching", "Mobile App for Technicians", and "Invoicing and Payments" features as a journey labelled `domain-standard` rather than as the open question or scope decision the prompt requested. `domain-standard` semantically claims "this is a journey every domain in this category has" — but the Hestami spec contains zero domain-native journeys for this pillar, so the source-label is doing work the source does not support.

This is the most consequential defect in the sample. Phase 1.3 (the proposer) refines the journeys this discovery pass seeds; if two of the four seeds are competitor content miscategorised as domain-standard, the proposer is anchored on assumptions the user never made and may be unable to recover the framing without re-reading the source.

### 1.2 Three explicitly listed Pillar 1 journeys are collapsed into two

The source explicitly lists three Pillar 1 journeys:

> "#### New property - add / update; address (location); upload media such as photos and videos
> #### Create service call - homeonwers create a service call case
> #### AI Agent or Hestami Staff facilitate service provider discovery and matching through internet searches"

The agent maps the first to `UJ-SETUP-PROPERTY` and the second to `UJ-SUBMIT-REQUEST`, then folds the third into `UJ-SUBMIT-REQUEST` step 2 ("System (AI)") and effectively drops the human-Hestami-staff actor that the source explicitly names ("AI Agent **or** Hestami Staff"). The collapsed third journey is the one the agent flagged as a distinct persona (`P-ADMIN`) — and `P-ADMIN` ends up with goals and pain points but no journey of its own. The "Human Hestami Staff Service Call Execution" domain (Pillar 1 business domain #6) is also lost in this collapse.

The result: the only `source: "document-specified"` journey in the output is `UJ-SUBMIT-REQUEST`, while three of four journeys carry `ai-proposed` or `domain-standard` provenance. That inverts the spec's actual evidence load.

### 1.3 Drift into 1.0c (technical) and 1.0d (compliance) territory

The system prompt is explicit:

> "Sibling 1.0c Technical Constraints Discovery captures stated technical stack, infrastructure, security models, deployment constraints. Leave those to 1.0c."
> "Sibling 1.0d Compliance & Retention Discovery captures regulatory regimes, legal retention, audit obligations. Leave those to 1.0d."

The agent crosses both boundaries:

**1.0c drift (technical / infrastructure / security):**

- `uxRequirements[1]`: "Task-centric, **offline-first** mobile experience for technicians and owners" — "offline-first" is sourced verbatim from the tech-stack table row "Mobile: Native iOS and Android — focusing on task-centric workflows and offline-first capabilities." The agent's thinking even flags this borderline: "offline-first (implied for mobile field) … Actually, the prompt says ... 'security models, deployment constraints' ... Leave those to 1.0c." It includes the item anyway.
- `constraints.CON-4`: "The system must support offline-first mobile capabilities for field workers." — same source span, restated as a constraint. Now drifts twice into 1.0c on the same content.
- `requirements.REQ-2`: "The platform must support multi-tenant isolation to ensure data integrity across different organizations." — sourced from the tech-stack row "PostgreSQL ... utilizing Row-Level Security (RLS) to enforce strict multi-tenant isolation at the database level." The agent's thinking adjudicates this ("Row-Level Security is technical -> Skip ... Multi-tenant isolation is required") and chooses to keep the abstract form. Multi-tenant isolation as a security/architecture commitment is exactly the kind of statement the prompt routes to 1.0c.

**1.0d drift (compliance / retention / audit):**

- `requirements.REQ-3`: "Workflows must be auditable and compliant with statutory notice requirements and deadlines." — sourced from CDM Domain 12 Compliance ("Statutory deadlines / Notice requirements / Voting rules / Financial audit requirements"). This is verbatim 1.0d turf.
- `constraints.CON-3`: "The system must handle compliance regarding voting rules and financial audits." — same Domain 12 source, same drift.
- `successMetrics`: "Auditability of financial records (GL integration)" — compliance/audit framing.

**1.0e drift (V&V):**

- `successMetrics` listing "Reduction in time-to-match", "Percentage of verified/licensed providers successfully matched", "Completion rate of automated workflows", "Revenue generation per trade job executed", "User engagement rate on Owner Portals" — these are *measurable* quantities that 1.0e is dedicated to capturing with threshold + measurement-method pairs. The product layer's success-metrics field should record outcome categories tied to user value; the agent has produced what reads like draft V&V metrics without thresholds, which both pollutes the 1.0e pass and creates ungrounded measurement commitments here.

The reviewer's `overallAssessment` claims the agent "adhered strictly to the negative constraints, filtering out technical stack details (e.g., SvelteKit, Bun)". That is technically true at the *literal* level (no "SvelteKit" appears in the output) and entirely false at the *substantive* level: the technical capabilities those entries describe (RLS-based multi-tenancy, offline-first mobile, statutory compliance audit logic) were preserved by paraphrase. The reviewer matched on token absence rather than on layer assignment.

### 1.4 Embedded thresholds and metrics without source grounding

The source states success criteria once, very minimally:

> "## Success Factors
> In principle, the only success factor will be the complete and correct implementation of each of the pillars into a holistic integrated platform."

The agent emits six `successMetrics` entries, none of which trace to that span. "Reduction in time-to-match", "Percentage of verified/licensed providers successfully matched", "Revenue generation per trade job executed", "User engagement rate on Owner Portals" are all AI-proposed without a `source` field on this array (the contract does not require one for `successMetrics`, but the prompt's grounding rule still applies: "Leave empty arrays rather than guessing"). They also functionally re-introduce thresholds (percentage, completion rate, revenue per job) that 1.0e's pass should own. This mirrors the FR/NFR finding in the reference doc — "introduced new thresholds without grounding" — applied to discovery rather than decomposition.

### 1.5 An open question is committed as a decision

`openQuestions.Q-2`:

> "How should the system balance AI autonomy with human oversight when a homeowner faces a violation or financial assessment?"

`decisions.DEC-4`:

> "AI is an integrated layer for automation but human oversight remains for critical decisions (violations, finance)."

These are the same question and its presumed answer, both emitted in the same response. The agent's thinking explicitly raises this as an unresolved question ("How deep is the AI autonomy vs. Human-in-the-loop?") then commits a specific resolution as a binding product decision. The prompt is explicit:

> "If the input is vague on any product artifact, note it as an open question — do NOT invent business decisions. Leave empty arrays rather than guessing."

`DEC-4` is exactly an invented business decision. The reviewer did not flag the duplication or the contradiction.

A second, weaker instance: `decisions.DEC-5` says "External integrations (like Nextdoor) are considered future state but not in-scope for **initial MVP**." The source says "out-of-scope at this time" — it does not introduce "MVP" framing. The agent imports a release-shape concept the source did not commit to. (Per project memory `project_plan_synthesis_design.md`, MVP framing is also explicitly something the project is moving away from — though the agent under review is not expected to know that.)

### 1.6 Persona-source labels are inverted

The source names personas explicitly:

> "## Personas
> ### Homeowners / Residents
> ### Service Providers
> ### Community Association Managers
> #### Board Members
> #### Community Association Management Companies
> ### Hestami Staff / Admins"

— and additionally:

> "Target Customer: Individual homeowners / Small landlords / Property investors managing one or more residences"

Yet the agent's `source` labels are:

| Persona | Agent label | Source actually says |
|---------|-------------|----------------------|
| P-HOMEOWNER | `ai-proposed` | "### Homeowners / Residents", "Individual homeowners" — explicitly named |
| P-INVESTOR | `domain-standard` | "Small landlords / Property investors" — explicitly named |
| P-PROVIDER | `domain-standard` | "### Service Providers" — explicitly named |
| P-CAM_MANAGER | `domain-standard` | "### Community Association Managers" — explicitly named |
| P-BOARD | `ai-proposed` | "#### Board Members" — explicitly named |
| P-ADMIN | `ai-proposed` | "### Hestami Staff / Admins" — explicitly named |

Every persona is in fact `document-specified`. The agent's labels invert that, which has a downstream effect: a proposer (1.3) consuming this output would treat the homeowner persona as an AI-invented assumption requiring user confirmation, while accepting the small landlord persona as a domain-norm. That is the wrong gating signal.

### 1.7 Persona-journey coupling is incomplete

`P-INVESTOR`, `P-BOARD`, and `P-ADMIN` each have goals and pain points but no journey references them. `UJ-EXECUTE-JOB` step 2 lists actor `Technician`, which is not in the personas array (and "Service Providers" was modelled at the business-owner granularity, not the worker granularity). `UJ-GOVERNANCE-COMPLIANCE` references "User" with no persona disambiguation across CAM Manager / Board / Owner. The prompt requires:

> "For each: Who is the actor at each step? (persona name or 'System' for automated steps)"

Coupling actors to undefined or ambiguous persona references introduces silent decoupling between the persona array and the journey array — a class of defect the proposer cannot recover without re-reading the source.

### 1.8 Missing high-salience extractions

Items present in the source and not extracted (or extracted only obliquely):

- **3D Gaussian Splats**: explicitly named in the Mission Statement as a core technique. The agent's `UJ-SETUP-PROPERTY` step 3 says "Generate floorplans or index inventory (3D/Splats)" — a paraphrased mention buried in a step, not surfaced as a product capability or scope decision.
- **Automated floorplans generation**, **appliance and equipment inventory**: explicit Mission-Statement value drivers, not present in `requirements` or `decisions`.
- **Government-services integration** ("permits review and applications", "service provider licensing"): explicit Mission-Statement scope items, not present anywhere in the output. This is *especially* notable because it is a positive product-scope decision that the prompt's rules do support extracting.
- **The nine Pillar 1 business domains** (Property & Ownership Modeling, Property Portfolio Management, Owner Intent & Request Intake, Service Call Case Lifecycle, Property Document Management, Human Hestami Staff Service Call Execution, External HOA Context Tracking, External Vendor Coordination, Decision/Rationale & Trust Ledger): only "External HOA Context Tracking" (REQ-6) and "Decision/Rationale Trust Ledger" (REQ-7) survive. The other seven are dropped despite being the most concrete product-layer scope statement in the source.
- **Truncated vision sentence and empty Mission section**: surfaced as concerns by IQC upstream; not echoed here as `openQuestions` even though the *product layer's* vision is materially incomplete.

### 1.9 `analysisSummary` truncates nuance

The summary reduces a 7 KB source spanning three pillars + two competitor appendices + a CDM with twelve domains + a phasing strategy into one 600-character paragraph that is descriptively accurate but loses:

- the truncated vision and empty mission (a coherence concern from IQC that the product pass should mirror as `openQuestions`),
- the ServiceTitan/Vantaca dependency (Phase 2 and Phase 3 are *defined by reference* to those competitors — a major scope-shape commitment),
- the "eternal perspective" framing for data persistence,
- the AI-driven extraction/classification/summarization commitment from Domain 10.

### 1.10 The current reviewer's behaviour

- **Caught:** nothing of substance.
- **Missed:** §1.1 (hallucinated journeys from competitor appendix), §1.2 (collapsed Pillar 1 journeys), §1.3 (cross-layer drift into 1.0c/1.0d/1.0e on at least five output items), §1.4 (ungrounded success metrics), §1.5 (open-question-as-decision), §1.6 (persona-source label inversion), §1.7 (persona-journey decoupling), §1.8 (high-salience missing extractions), §1.9 (summary truncation).
- **Hallucinated:** the *reviewer's* assessment claims "filtering out technical stack details (e.g., SvelteKit, Bun)" as evidence of strict scope discipline. The agent did filter out tokens like SvelteKit, but the reviewer's framing implies layer discipline was achieved — it was not. The reviewer's framing is a positive-fact assertion that the actual output contradicts.
- **Schema consistency:** `has_concerns=false` ↔ `concerns=[]` — intact.
- **Severity calibration:** untestable (no findings).

The current reasoning_review prompt's defect catalogue (assumptions stated as facts, contradictions, over-confidence, edge cases, fragile coupling, semantic drift) does cover most of these defects in principle. The reviewer simply did not execute against any of them.

---

## 2. Diagnosis

The role-specific failure modes for a discovery pass are:

1. **Cross-layer drift.** Each discovery pass has a strict layer assignment (product / technical / compliance / V&V / vocabulary). Items that belong to a sibling pass are paraphrased into this pass's output and consume slots that should hold native product extractions. Detection requires reading the prompt's sibling carve-out clauses as enforceable rules, not advice.

2. **Competitor-appendix absorption.** When the source defines pillars by reference to external companies ("Phase 2 — see ServiceTitan appendix"), the agent under-applies the prompt's "surface as open question or tentative decision" rule and over-applies a "treat appendix as domain-norm" pattern. This is the discovery-pass analogue of the lens classifier's "weak signals as decisive" defect — both involve treating cosmetically credible evidence (a section header, an appendix) as authoritative.

3. **Extraction provenance inversion.** `source` labels are inferred from semantic familiarity rather than from where the item literally appears in the source. Personas and journeys that the source spells out get tagged `ai-proposed` or `domain-standard`, which inverts the downstream gating signal.

4. **Open-question / decided contradiction.** An item is surfaced both as `openQuestions` and as `decisions` (or `requirements`). The agent's thinking explicitly recognises the question as unresolved and then commits a resolution as if it were a settled product decision.

5. **Threshold/metric introduction.** `successMetrics`, acceptance criteria inside journeys, and constraint phrasing introduce numeric or quasi-numeric commitments (percentages, completion rates, time windows, revenue per job) without source grounding. This mirrors the FR/NFR-pass finding from the reference doc and 1.0e is the pass that should own the threshold-bearing items.

6. **Persona-journey decoupling.** Personas are listed without coverage by any journey, and journey actors reference roles not in the persona list. The persona array and journey array diverge silently.

7. **Completeness gaps on positive scope items.** High-salience source items (Gaussian Splats, government-services integration, nine business domains) are dropped or buried in step descriptions instead of surfaced as `requirements` or `decisions`.

8. **`analysisSummary` lossy compression.** The summary loses material nuance from the source — most notably IQC-flagged source defects (truncated vision, empty mission) that the product pass should mirror into `openQuestions`.

The output shape is large (eleven top-level fields, three of which are arrays of typed objects with up to seven sub-fields). That makes a single-pass reviewer infeasible at gemma4-class scale: the per-token attention budget is consumed before the reviewer reaches the journeys array.

---

## 3. Recommended validator pipeline for this role

Eight validators. Two deterministic, six LLM-based. Three are reuses (cross-role); five are role-specific.

| # | Validator | Type | Status |
|---|-----------|------|--------|
| 1 | `contract_schema_discovery` | deterministic | adapted from cross-role contract pattern |
| 2 | `extraction_id_traceability` | deterministic | new (role-specific; checks ID/source-field hygiene) |
| 3 | `grounding_discovery` | LLM | adapted from cross-role grounding validator |
| 4 | `scope_boundary_adherence_discovery` | LLM | new (role-specific, layer-assignment policing) |
| 5 | `external_reference_handling` | LLM | new (role-specific, ServiceTitan/Vantaca-style appendix handling) |
| 6 | `open_question_vs_decided` | LLM | new (role-specific, also catches embedded thresholds) |
| 7 | `persona_journey_coherence` | LLM | new (role-specific) |
| 8 | `reasoning_to_response_faithfulness` | LLM | reuse from sample 01 |

`final_synthesis` from the reference doc applies unchanged.

**Cross-role validators promoted to "applies to all roles" by this sample:**

- `contract_schema_*` (already established in samples 01, 02).
- `grounding` (already established; this sample reinforces — quoted-evidence discipline applies whether the output is one rationale string or an eleven-field document).
- `reasoning_to_response_faithfulness` (cross-role from sample 01; this sample provides another instance — the agent's thinking adjudicates ServiceTitan-as-comparison and then absorbs ServiceTitan-as-domain-norm; the reasoning chain is at war with the response).

**Validators that explicitly DO NOT apply to this role:**

- `tier_decomposition` — discovery is not a decomposition pass.
- `measurement_adequacy` — discovery does not produce measurable conditions of its own; if any appear, they are 1.0e drift and are caught by `scope_boundary_adherence_discovery` rather than measured.
- `calibration_rule_consistency_lens` and `intent_vs_artifact_scope_audit` (sample 02) — discovery does not emit a confidence value, and the meta-recursive intent has already been resolved upstream by IQC and lens classification.
- `coherence_evidence_audit` (sample 01) — coherence is IQC's job; this pass only mirrors IQC-flagged source defects into `openQuestions`, which is covered by `grounding_discovery` + `open_question_vs_decided`.

### 3.1 Purpose of each validator

1. **`contract_schema_discovery` (deterministic).** JSON shape; required fields present; every entry in `personas`, `userJourneys`, `requirements`, `decisions`, `constraints`, `openQuestions` has the contract's required keys; `id` uniqueness inside each array; `personaId` references in `userJourneys` resolve to a `personas[].id`; `journeyIds` in `phasingStrategy` resolve to `userJourneys[].id`; `source` enum membership where the contract specifies one (`document-specified|domain-standard|ai-proposed`); no markdown fences; no trailing prose. Cheap, decisive, model-independent.

2. **`extraction_id_traceability` (deterministic).** ID-hygiene-only validator distinct from contract: every `requirements`/`decisions`/`constraints`/`openQuestions` `id` follows the documented prefix convention (`REQ-`, `DEC-`, `CON-`, `Q-`) and is unique within its array; every `userJourneys[].id` follows `UJ-` and is unique; every `phasingStrategy[].journeyIds[]` references an existing journey; no duplicate IDs across sibling arrays where collisions would confuse the proposer. Catches the structural shape of "decoupling" defects without judging semantics.

3. **`grounding_discovery` (LLM).** The cross-role grounding pattern, adapted to a multi-array document. For every persona, journey, requirement, decision, constraint, success metric, UX requirement, and persona/journey `source` label, ask: is this entailed by, contradicted by, or absent from the source? Catches §1.1 (journeys not in source), §1.4 (success metrics ungrounded), §1.6 (`source` labels mis-asserting provenance), §1.8 (claimed-but-absent extractions on the inverse direction).

4. **`scope_boundary_adherence_discovery` (LLM, role-specific).** The role-defining validator. For every extracted item, judge whether it belongs to the **product** layer or to one of the four sibling passes (1.0c technical, 1.0d compliance, 1.0e V&V, 1.0f vocabulary). Catches §1.3 (offline-first/RLS/multi-tenancy → 1.0c; statutory compliance → 1.0d; threshold-bearing metrics → 1.0e). Note that this validator must be paired with the discovery prompt's *current carve-out clauses* — if the agent's prompt is later revised, this validator's rules must be updated in lockstep.

5. **`external_reference_handling` (LLM, role-specific).** Detects when source defines product scope by reference to an external company (ServiceTitan, Vantaca, Nextdoor, "like X") and verifies that the agent surfaces the reference as a `decisions` entry (tentative scope-shape commitment) AND/OR an `openQuestions` entry (which features to mirror), rather than absorbing the appendix's content directly into journeys/requirements. Catches §1.1's most damaging form.

6. **`open_question_vs_decided` (LLM, role-specific).** Two-part check: (a) every `openQuestions[]` text must not also appear (semantically, not just verbatim) in `decisions` or `requirements`; (b) every `decisions`/`requirements`/`constraints` entry that introduces a numeric or quasi-numeric threshold (percentage, time window, frequency, monetary amount, completion rate) must trace to a source span or otherwise be flagged as an open question. Catches §1.5 and the threshold-introduction subset of §1.4.

7. **`persona_journey_coherence` (LLM, role-specific).** Checks: (a) every persona has at least one journey reference (or, if not, an explicit acknowledgment in `analysisSummary` or `openQuestions`); (b) every journey-step actor resolves to a persona or to "System"; (c) source-named personas are tagged `document-specified` and source-implied personas are tagged `ai-proposed` or `domain-standard` consistently with the grounding validator's findings on the same items. Catches §1.6 and §1.7 with role-specific framing.

8. **`reasoning_to_response_faithfulness` (LLM, cross-role).** Direct reuse. For this role, the markers to inspect are documented adjudications in the thinking chain that are then suppressed in the final output. In this sample: the ServiceTitan adjudication ("It's a comparison. … The 'Decision' might be 'Target ServiceTitan-style architecture'") that is replaced in the output by full-fat ServiceTitan absorption; the AI-autonomy-vs-human-oversight adjudication committed as both `Q-2` and `DEC-4`; the offline-first adjudication ("Leave those to 1.0c") committed as both `uxRequirements[1]` and `CON-4`.

---

## 4. Validator prompt templates

All templates use the positive-mission + scoped-boundary + decision-standard + JSON output contract pattern.

### 4.1 `contract_schema_discovery` (deterministic — code, no LLM)

Pseudocode:

```ts
function validateDiscoveryContract(r: DiscoveryResponse): Finding[] {
  // 1. JSON parseable, no fences/prose.
  // 2. Top-level keys: kind, analysisSummary, productVision, productDescription,
  //    personas, userJourneys, phasingStrategy, successMetrics, uxRequirements,
  //    requirements, decisions, constraints, openQuestions.
  // 3. kind === "intent_discovery".
  // 4. Each persona has { id, name, description, goals[], painPoints[], source }.
  // 5. Each journey has { id, personaId, title, scenario, steps[], acceptanceCriteria[],
  //    implementationPhase, priority, source }; each step has { stepNumber, actor,
  //    action, expectedOutcome }.
  // 6. requirements/decisions/constraints/openQuestions entries are objects
  //    with { id, type, text } — NOT plain strings.
  // 7. Every personaId in userJourneys resolves to a persona id.
  // 8. Every journeyIds[] entry in phasingStrategy resolves to a journey id.
  // 9. source enum in {"document-specified","domain-standard","ai-proposed"}.
  // 10. type enum matches array (REQUIREMENT/DECISION/CONSTRAINT/OPEN_QUESTION).
  // 11. id prefix convention (P-, UJ-, REQ-, DEC-, CON-, Q-).
  // 12. No duplicate ids inside an array.
  // 13. No markdown fences; no trailing prose.
}
```

Output JSON:

```json
{
  "validator": "contract_schema_discovery",
  "passed": true,
  "findings": [],
  "overallAssessment": "Output conforms to the discovery contract."
}
```

If defects:

```json
{
  "validator": "contract_schema_discovery",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "invalid_json" | "missing_required_field" | "wrong_enum"
            | "broken_reference" | "duplicate_id" | "id_prefix_violation"
            | "string_instead_of_object" | "format_violation",
      "location": "field path",
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.2 `extraction_id_traceability` (deterministic — code, no LLM)

Same finding shape as §4.1 with `validator: "extraction_id_traceability"`. Distinct from `contract_schema_discovery` in two ways:

- It runs *after* contract validation and assumes structural validity.
- It cross-checks IDs against `phasingStrategy.journeyIds[]` and `userJourneys[].personaId` rather than just shape. The benefit of separating it is operational: contract failures usually signal "model output is malformed and must be regenerated"; ID-traceability failures signal "model output is structurally valid but internally inconsistent" — different remediation paths.

### 4.3 `grounding_discovery` (LLM)

```text
[MISSION]
Confirm that every persona, journey, requirement, decision, constraint,
success metric, UX requirement, and source-provenance label in the
discovery output is supported by the raw intent and any inlined
documents.

[IN-SCOPE]
- personas[]: persona names, descriptions, goals, painPoints, and source label.
- userJourneys[]: title, scenario, every step's action/expectedOutcome,
  acceptanceCriteria, implementationPhase, source label.
- phasingStrategy[]: description and rationale per phase.
- successMetrics[]: each metric statement.
- uxRequirements[]: each statement.
- requirements/decisions/constraints/openQuestions[]: text of each entry.
- analysisSummary, productVision, productDescription: any factual claim.

[OUT OF SCOPE]
- Whether the item belongs to this layer vs. a sibling pass (covered by
  scope_boundary_adherence_discovery).
- Whether the persona-journey graph is internally coherent (covered by
  persona_journey_coherence).
- Style preferences in phrasing.

[GROUNDING CLASSIFICATION]
- SUPPORTED: directly entailed by a span in the raw intent or inlined documents.
- PARTIALLY_SUPPORTED: some part is supported, but the generated item adds
  unsupported specificity (extra goals, extra pain points, named numeric
  thresholds, etc.).
- UNSUPPORTED: not present in and not derivable from the source.
- CONTRADICTED: conflicts with an explicit source span.

[CRITICAL CASES]
- A `source: "document-specified"` label on an item that the source does
  not explicitly state is a grounding defect on the label itself.
- A `source: "ai-proposed"` or `"domain-standard"` label on an item that
  IS explicitly stated in the source is a grounding defect inverting
  provenance — flag with severity MEDIUM minimum (downstream gates rely
  on this label to decide whether the item needs user confirmation).
- A success metric, acceptance criterion, or constraint that introduces
  a numeric threshold (percentage, time window, frequency, monetary
  amount) without source grounding is UNSUPPORTED.
- A persona, journey, or requirement absorbed from an external-comparison
  appendix (ServiceTitan, Vantaca, Nextdoor, etc.) without source-native
  evidence is UNSUPPORTED at the persona/journey level even when the
  appendix supports the content — the appendix supports the *comparison*,
  not the *commitment*.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent (raw + attached files): {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "grounding_discovery",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "unsupported_item" | "contradicted_item" | "partially_supported_item"
            | "inverted_source_label" | "appendix_absorbed_as_native"
            | "embedded_threshold_unsupported",
      "fieldPath": "userJourneys[2].steps[1].action",
      "claim": "exact item text or quoted span",
      "groundingStatus": "SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED|CONTRADICTED",
      "sourceEvidence": [
        {"sourceSpan": "...", "relationship": "supports|contradicts|does_not_support|partial"}
      ],
      "detail": "...",
      "recommendation": "Remove, weaken, relabel source field, or move to openQuestions."
    }
  ],
  "overallAssessment": "..."
}
```

**Severity rule:** HIGH for contradicted items and for journeys/personas absorbed from competitor appendices; MEDIUM for inverted source labels and embedded thresholds; LOW for partial-support items where the unsupported part is incidental detail.

### 4.4 `scope_boundary_adherence_discovery` (LLM, role-specific)

```text
[MISSION]
Confirm that every extracted item belongs to the PRODUCT layer assigned
to this discovery pass, and not to one of the four sibling passes.

[LAYER ASSIGNMENT — verbatim from the agent's system prompt]
- Sibling 1.0c Technical Constraints Discovery: stated technical stack,
  infrastructure, security models, deployment constraints.
- Sibling 1.0d Compliance & Retention Discovery: regulatory regimes,
  legal retention, audit obligations.
- Sibling 1.0e V&V Requirements Discovery: measurable performance /
  availability / reliability targets with threshold + measurement.
- Sibling 1.0f Canonical Vocabulary Discovery: domain-specific terms +
  definitions.

The current pass owns: vision, personas, journeys, phasing, success
metrics tied to user value (not threshold-bearing), UX principles, and
business-level requirements / decisions / constraints / open questions.

[IN-SCOPE]
- Every item in personas, userJourneys, phasingStrategy, successMetrics,
  uxRequirements, requirements, decisions, constraints.

[OUT OF SCOPE]
- Whether the item is grounded in the source (covered by grounding_discovery).
- Whether the item's `source` label is correct (covered by grounding_discovery).
- Style preferences.

[DECISION STANDARD]
A finding is valid when an extracted item, taken on its own terms, would
be the natural extraction of a sibling pass. Examples:

- "offline-first mobile capability" → 1.0c (deployment / runtime constraint).
- "multi-tenant isolation via row-level security" → 1.0c (security model).
- "compliance with statutory notice deadlines" → 1.0d (regulatory regime).
- "auditability of financial records" → 1.0d (audit obligation).
- "<= 5 business days response time" → 1.0e (threshold + measurement).
- ">= 95% match rate" → 1.0e (threshold + measurement).
- a definition of a domain-specific term ("Action Item means …") → 1.0f.

A paraphrase that strips the technical implementation but preserves the
technical commitment is still a 1.0c item (e.g., paraphrasing "PostgreSQL
RLS multi-tenancy" as "multi-tenant isolation must be enforced" does not
relocate the item to the product layer — the commitment itself is
architectural).

[SEVERITY GUIDE]
- HIGH: a 1.0e threshold-bearing item is committed in this pass without
  a threshold-and-measurement pair, polluting both layers.
- HIGH: a 1.0d compliance regime is restated as a product requirement
  with no compliance-pass cross-reference.
- MEDIUM: a 1.0c technical capability is paraphrased as a product
  requirement, UX requirement, or constraint.
- MEDIUM: a 1.0f vocabulary definition appears in `decisions`.
- LOW: a borderline case where the item is ambiguously product-vs-sibling
  and would not block downstream proposers.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "scope_boundary_adherence_discovery",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "drift_to_1_0c_technical" | "drift_to_1_0d_compliance"
            | "drift_to_1_0e_vv" | "drift_to_1_0f_vocabulary"
            | "borderline_ambiguous",
      "fieldPath": "constraints[3]",
      "itemText": "exact item text",
      "siblingPass": "1.0c | 1.0d | 1.0e | 1.0f",
      "siblingPassEvidence": "why this item is naturally that sibling's extraction",
      "detail": "...",
      "recommendation": "Remove from this pass; sibling pass will capture."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.5 `external_reference_handling` (LLM, role-specific)

```text
[MISSION]
Confirm that when the source defines product scope by reference to an
external company or product (e.g., 'like ServiceTitan', 'see Vantaca
appendix', 'similar to Nextdoor'), the agent surfaces the reference
according to the prompt's rule:

  "When source docs reference external companies as product-shape
  comparisons, surface what that example implies about product scope /
  user segment as an open question or a tentative decision."

[IN-SCOPE]
- Detect every external-product reference in the source.
- For each reference, check whether the discovery output:
  - Names the reference in `decisions` (as a tentative scope-shape
    commitment — e.g., "Phase 2 will mirror ServiceTitan-style FSM scope"),
    AND/OR
  - Names the reference in `openQuestions` (which specific features /
    user segments to inherit vs. innovate),
  - AND avoids absorbing the reference's content directly into
    `personas`, `userJourneys`, `requirements`, `constraints`, or
    `successMetrics` as if it were native source material.

[OUT OF SCOPE]
- Whether other (non-comparison) extractions are correct.
- Layer-scope drift (covered by scope_boundary_adherence_discovery).

[DECISION STANDARD]
A finding is valid when:
- A source-named external comparison is absent from both `decisions`
  and `openQuestions` AND content from that comparison's appendix is
  present in `personas`/`userJourneys`/`requirements`/`successMetrics`
  with `source: "domain-standard"` or `"ai-proposed"`.
- A journey or persona traces back (by quoted feature, persona name,
  or workflow shape) to the external comparison's appendix rather
  than to the host product's own pillar specification.

[SEVERITY GUIDE]
- HIGH: an external comparison is absorbed wholesale as a journey or
  persona without acknowledgement.
- MEDIUM: an external comparison is absorbed for individual requirement
  or constraint items but the reference is at least mentioned elsewhere.
- LOW: the reference is acknowledged but the wording does not flag the
  inheritance clearly.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "external_reference_handling",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "appendix_absorbed_as_native_journey"
            | "appendix_absorbed_as_native_persona"
            | "appendix_absorbed_as_native_requirement"
            | "comparison_not_surfaced",
      "externalReference": "ServiceTitan",
      "absorbedFieldPath": "userJourneys[2]",
      "tracingEvidence": "exact appendix span the absorbed item paraphrases",
      "detail": "...",
      "recommendation": "Move to decisions as tentative scope, surface specific
                        feature inheritance as openQuestions, drop appendix
                        content from native arrays."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.6 `open_question_vs_decided` (LLM, role-specific)

```text
[MISSION]
Confirm that the discovery output does not commit a resolution to a
question it simultaneously surfaces as open, and that no requirement,
decision, constraint, or success metric introduces a numeric or
quasi-numeric threshold that the source does not support.

[IN-SCOPE]
- Pairwise semantic comparison between every `openQuestions[]` entry
  and every entry in `decisions`, `requirements`, `constraints`,
  `acceptanceCriteria`, `successMetrics`. Identify any pair where
  the open question is, in effect, answered by the decided item.
- Detection of threshold-bearing language in any non-openQuestions
  array: percentages, time windows, frequencies, monetary amounts,
  completion rates, ratios.

[OUT OF SCOPE]
- Layer-scope drift (covered by scope_boundary_adherence_discovery).
- Whether a threshold is the right value (covered by grounding_discovery
  for source support, and by 1.0e for measurement adequacy).

[DECISION STANDARD]
A finding is valid when:
- An openQuestion's text and a decision/requirement/constraint's text,
  read as natural language, address the same product-decision space and
  the decision/requirement asserts a specific resolution.
- A threshold appears in a non-openQuestions array and is not directly
  attested in the source AND is not paired with an openQuestion that
  flags the threshold as tentative.

[SEVERITY GUIDE]
- HIGH: an openQuestion is answered by a decision in the same response.
- HIGH: a threshold is committed in `requirements` or `constraints`
  without source grounding.
- MEDIUM: a threshold is committed in `successMetrics` without source
  grounding (lower because successMetrics are softer commitments than
  requirements).
- MEDIUM: a decision introduces release-shape vocabulary ("MVP",
  "v1.0", "general availability") that the source does not commit to.
- LOW: an openQuestion's framing is partially addressed by a decision
  but the decision does not fully resolve the question.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "open_question_vs_decided",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "open_question_answered_by_decision"
            | "embedded_threshold_unsupported"
            | "release_shape_vocabulary_introduced",
      "openQuestionId": "Q-2",
      "decidedItemPath": "decisions[3]",
      "openQuestionText": "...",
      "decidedItemText": "...",
      "detail": "...",
      "recommendation": "Remove the decision (it's a guess), or remove the
                        open question (it's already decided), or split the
                        question into the resolved part and the remaining
                        unresolved part."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.7 `persona_journey_coherence` (LLM, role-specific)

```text
[MISSION]
Confirm that the persona array and the user-journey array form a
coherent graph: every persona is exercised by at least one journey
(or its absence is acknowledged), every journey-step actor resolves
to a persona or to "System", and the persona/journey `source` labels
are mutually consistent.

[IN-SCOPE]
- For each persona, check whether at least one journey references it
  via personaId, OR whether the analysisSummary or openQuestions array
  acknowledges the unexercised persona.
- For each journey step, check that `actor` is either a defined persona
  name (or persona id), or the literal string "System".
- For each persona, check that its `source` label is consistent with
  whether the source explicitly names the persona (document-specified)
  or implies the persona by domain norm (domain-standard) or the agent
  proposed the persona without explicit or domain-norm support
  (ai-proposed).
- For each journey, check the same for its `source` label.

[OUT OF SCOPE]
- Whether the persona itself is justified by the source (covered by
  grounding_discovery).
- Whether the journey's content is grounded (covered by grounding_discovery).

[DECISION STANDARD]
A finding is valid when:
- A persona has no journey reference and no acknowledgement.
- A journey-step actor is neither a defined persona, persona id, nor
  the literal "System".
- A persona/journey `source` label disagrees with what
  grounding_discovery would conclude for the same item (this validator
  may consume grounding findings if available; otherwise it makes its
  own judgement).

[SEVERITY GUIDE]
- MEDIUM: persona declared but unused by any journey, no
  acknowledgement.
- MEDIUM: journey-step actor refers to a role not in personas (e.g.,
  "Technician" when only "Service Provider" is a persona).
- MEDIUM: source label inverted (document-specified item tagged
  ai-proposed or vice versa).
- LOW: persona used but with mismatched granularity (e.g., a persona
  modelled at the business-owner level, but a journey actor is the
  worker level).

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}
Optional upstream findings: {{UPSTREAM_FINDINGS}}

[OUTPUT CONTRACT]
{
  "validator": "persona_journey_coherence",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "unused_persona" | "undefined_actor" | "source_label_inverted"
            | "actor_persona_granularity_mismatch",
      "personaId": "P-INVESTOR",
      "journeyId": "UJ-EXECUTE-JOB",
      "stepNumber": 2,
      "detail": "...",
      "recommendation": "Add a journey for this persona, define the missing
                        actor as a persona, or relabel source field."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.8 `reasoning_to_response_faithfulness` (LLM, cross-role reuse)

Reuse from `01_orchestrator__intent_quality_check.md` §4.6 with the role-specific markers:

- **Markers in the thinking chain to look for:**
  - "It's a comparison. The 'Decision' might be …" / "The 'Open Question' might be …" — adjudication of how to handle an external reference.
  - "Skip" / "skipping" / "Leave those to 1.0c" / "Leave those to 1.0d" — explicit recognition of a sibling-pass boundary.
  - "Open Question" / "How deep is …" / "How will …" — explicit identification of an unresolved question.
  - "Wait, …" / "Actually, …" / "Hmm, …" pivots that change the disposition of an item.

- **Severity rule (role-specific override):**
  - HIGH: thinking explicitly assigns an item to a sibling pass and the response includes that item anyway.
  - HIGH: thinking surfaces an item as an open question and the response commits a resolution.
  - HIGH: thinking explicitly classifies an external reference as a comparison and the response absorbs the reference as a domain-standard journey or persona.
  - MEDIUM: thinking adjudicates a borderline item and the rationale or analysisSummary does not record the adjudication.
  - LOW: stylistic deliberation that does not affect any output array.

Output JSON shape unchanged from sample 01 §4.6, with `responseLocation` typically pointing into a specific extraction-array index.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_discovery` | yes (deterministic) | `agent_role == "domain_interpreter" && sub_phase == "product_intent_discovery"` |
| `extraction_id_traceability` | yes (deterministic) | same; only if `contract_schema_discovery` passed |
| `grounding_discovery` | yes (LLM) | same; skip if `contract_schema_discovery` failed |
| `scope_boundary_adherence_discovery` | yes (LLM) | same; skip if `contract_schema_discovery` failed |
| `external_reference_handling` | conditional (LLM) | fires when source contains explicit external-product references (regex on company-name list ∪ "like X" / "see Y appendix" / "similar to Z" patterns) |
| `open_question_vs_decided` | yes (LLM) | same; skip if `contract_schema_discovery` failed |
| `persona_journey_coherence` | yes (LLM) | same; skip if `contract_schema_discovery` failed |
| `reasoning_to_response_faithfulness` | conditional (LLM) | fires only when `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_discovery              (deterministic, gate)
2. extraction_id_traceability             (deterministic)
3. grounding_discovery                    (LLM)
4. scope_boundary_adherence_discovery     (LLM)
5. external_reference_handling            (LLM, conditional)
6. open_question_vs_decided               (LLM)
7. persona_journey_coherence              (LLM)
8. reasoning_to_response_faithfulness     (LLM, conditional)
9. final_synthesis                        (LLM, unchanged from reference)
```

The order is consequential. `grounding_discovery` runs before `scope_boundary_adherence_discovery` because the latter assumes the items it judges are at least source-attested somewhere — an item that is both ungrounded *and* in the wrong layer should be reported once (as ungrounded) rather than twice. Similarly, `open_question_vs_decided` and `persona_journey_coherence` may consume grounding findings.

### 5.2 Deterministic vs LLM split

- **Deterministic (no LLM):** `contract_schema_discovery`, `extraction_id_traceability`. These reduce to pure functions over the response. Schema and ID-graph correctness is mechanical; do not spend tokens on it.
- **LLM:** the remaining six. They require source comprehension, layer judgement, semantic similarity (open-question-vs-decision), or reasoning-chain reading.

There is no calibration-rule deterministic validator analogous to sample 02's `calibration_rule_consistency_lens` — discovery has no equivalent of the calibration table. The closest deterministic analogue is `extraction_id_traceability`, which polices the *graph* of identifiers but cannot police the *content* of extractions.

### 5.3 Integration with the cross-role validators

- `contract_schema` (reference §1) → role-keyed contract registry; `contract_schema_discovery` is the discovery-pass entry.
- `grounding` (reference §2) → `grounding_discovery`. The cross-role pattern holds; this role's specialisation is its multi-array shape and `source`-label semantics.
- `measurement_adequacy`, `tier_decomposition`, `assumption_citation` (reference §3–§5) → do not dispatch.
- `reasoning_quality` (reference §6) → fully covered for this role by `scope_boundary_adherence_discovery` + `open_question_vs_decided` + `reasoning_to_response_faithfulness` together. Recommend not dispatching the generic `reasoning_quality` validator on this role; it would duplicate the more specific checks.
- `final_synthesis` (reference §7) applies unchanged.

### 5.4 Cross-validator deduplication

Three pairs of validators can fire on the same item:

- `grounding_discovery` (UNSUPPORTED) and `scope_boundary_adherence_discovery` (drift_to_1_0X) on a sibling-layer item that is also ungrounded (e.g., a 1.0e threshold metric that is also not in source). `final_synthesis` should treat the boundary finding as the actionable one (it tells the operator which sibling pass should pick the item up); the grounding finding becomes corroborating evidence rather than a separate issue.
- `grounding_discovery` (inverted_source_label) and `persona_journey_coherence` (source_label_inverted) on the same persona/journey. Treat as a single finding.
- `open_question_vs_decided` (open_question_answered_by_decision) and `reasoning_to_response_faithfulness` (open-question-as-decision) on the same item — the former is content-level, the latter is reasoning-trace-level. They are independent findings: the former is actionable on the response; the latter signals a systemic agent behaviour worth surfacing to prompt-author feedback.

### 5.5 Hypotheses about cross-role validator promotion

This sample reinforces the following from prior assessments:

- `contract_schema_*` is universal and should be a registry pattern; sample 03 simply adds another entry.
- `grounding_discovery` is the third instance of grounding (after IQC's `coherence_evidence_audit`-adjacent grounding and the lens classifier's `rationale_grounding_lens`). The cross-role generic `grounding` validator from `redesign recommendations - 1.md` §2 applies; only the claim-list narrowing differs.
- `reasoning_to_response_faithfulness` from sample 01 reapplies cleanly here. Its abstraction now spans IQC, lens classification, and discovery — promote to "applies to all roles" with role-specific marker lists.

This sample introduces a new candidate cross-role validator: `scope_boundary_adherence_*`. Phase 1.0c, 1.0d, 1.0e, 1.0f will each have a symmetrical version (each pass's "do not stray into the other four"). Recommend designing it once with the layer-assignment table as a parameter, rather than five times. Promote to cross-role under the `scope_boundary_adherence_discovery_pass` family name.

---

## 6. Notes and open questions

1. **The five-pass carve-out is brittle without enforcement.** The agent's prompt instructs five sibling passes to stay in their lanes; the only enforcement is the prompt text. This sample shows the agent crossing all four boundaries (1.0c, 1.0d, 1.0e, and arguably 1.0f via its persona descriptions). Without `scope_boundary_adherence_discovery` (or its sibling equivalents) wired into the workflow, the carve-out is policy without a check. Recommend the validator be deployed before further tuning of the discovery prompt — adding more "do not" clauses to the prompt is unlikely to succeed (cf. the negation-prompt evidence cited in `redesign recommendations - 1.md`).

2. **`scope_boundary_adherence_discovery` is prompt-coupled.** The validator's layer-assignment table is a copy of the agent prompt's sibling carve-out clauses. If the discovery prompt is revised (e.g., to broaden 1.0d to include data-retention-as-business-policy), the validator's rules must be revised in lockstep. Recommend the validator's prompt be assembled at runtime from a single source-of-truth carve-out registry, not duplicated by hand.

3. **Persona-source labels carry downstream gating weight.** `document-specified` vs `ai-proposed` in the proposer (1.3) determines whether the proposer treats the item as confirmed or as an assumption needing user confirmation. This sample's full inversion of those labels would, if uncorrected, cause the proposer to seek user confirmation on personas the user already named and to rubber-stamp personas the agent invented. The label inversion is therefore HIGH severity in operational terms even though the persona content itself is mostly defensible.

4. **External-reference absorption is a structural failure mode of large-spec discovery.** Specs that define product scope by reference to an external company are common in real-world product briefs ("we're building the Stripe of X", "see ServiceTitan for the FSM model"). The agent's failure here is not unique to this sample. Recommend `external_reference_handling` be deployed alongside the discovery pass on every workflow, not as a conditional. Conditional dispatch only buys token savings; the cost of a missed absorption is high.

5. **Reviewer-model sizing.** As with samples 01 and 02, gemma4:e4b is demonstrably under-sensitive for this role. Discovery is the most token-heavy sample so far (15 KB response, 12 KB thinking, 33 KB prompt) and the single-pass reviewer is being asked to evaluate scope discipline, grounding, persona-journey coupling, open-question contradiction, and reasoning faithfulness in one pass. Decomposition is essential; smaller models per validator will perform better than one larger model across all dimensions. The deterministic validators (1, 2) are size-independent.

6. **The `analysisSummary` field is currently a free-text catch-all.** None of the validators directly evaluate `analysisSummary` as a content artefact — `grounding_discovery` covers any factual claim inside it, but the *omissions* identified in §1.9 (truncated vision, ServiceTitan/Vantaca dependency, "eternal perspective" framing) are not caught by any validator. A stronger version would compare the summary against IQC's coherence findings on the same source and require any source-defect IQC flagged to be either resolved or mirrored as openQuestions. Deferred — the cross-pass coordination is design work outside this sample.

7. **Threshold detection in `open_question_vs_decided`.** The threshold-detection regex in this validator should at minimum catch percentages, time windows ("within X days", "every X hours"), frequencies, monetary amounts, and completion rates. The success-metrics array in this sample contains threshold *categories* without numeric values ("Reduction in time-to-match", "Completion rate of automated workflows") — these are softer than explicit numbers but still pre-stage the 1.0e pass with content it should own. Recommend a softer "threshold-shape language" detector in addition to the strict numeric regex. Open implementation question: should "Reduction in X" without a numeric target count as a threshold, or as a value-direction commitment? Defer to the 1.0e pass author's preference.

8. **The discovery output is treated as a seed by Phase 1.3.** The proposer refines the journeys this pass produces. If the seed contains hallucinated journeys (§1.1) or inverted source labels (§1.6), the proposer's gating signals are corrupted from step zero. The validator pipeline above is therefore not just a quality check; it is a precondition for safe handoff. Recommend the workflow gate the 1.3 proposer on `final_synthesis.decision in {"ACCEPT", "ACCEPT_WITH_NOTES"}` for this discovery pass, not merely log the findings.
