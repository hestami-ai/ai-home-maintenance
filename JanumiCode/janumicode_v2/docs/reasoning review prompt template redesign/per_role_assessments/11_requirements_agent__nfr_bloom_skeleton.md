# Assessment: requirements_agent / nfr_bloom_skeleton (Phase 2.2.1)

**Sample:** `track_c_samples/11_requirements_agent__nfr_bloom_skeleton.md`
**Reviewed agent:** `requirements_agent` running `qwen3.5:9b` (12 KB JSON response, ~19 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`
**Reviewer outcome:** `has_concerns: true`, 1 HIGH / 1 MEDIUM / 1 LOW

---

## 1. What this sample reveals

This is the **first time the corpus exercises the NFR side of the requirements bloom**, and like sample 09 (its FR sibling) it does so on Pass 1 of 3 (Skeleton). The agent receives a richly-structured handoff (27 FRs from Sub-Phase 2.1, 20 quality attributes, 1 explicit V&V requirement, 22 technical constraints, 7 compliance items) and must emit one NFR skeleton per material seed with a single-line `seed_threshold`. Pass 2 will enrich `threshold` and `measurement_method`; Pass 3 is a deterministic verifier.

The relationship to sample 09 (FR skeleton, same agent role, same pass index) governs validator reuse. Sample 09 established a skeleton-pass family: a deterministic prefix (`contract_schema_skeleton`, `story_structural_completeness`, `handoff_coverage_audit`) followed by narrow LLM validators (`source_attribution_grounding`, `story_shape_conformance`, `pass_scope_discipline`) plus the carry-overs from the original ChatGPT 5.5 NFR-saturation assessment. The question this sample tests is whether that family **carries forward to NFRs by parameter variation** or whether NFR shape genuinely needs new validators.

The answer is: **mostly parameter-varied, plus three NFR-specific additions.** NFRs are not user-role narratives; they are quality-attribute-organised threshold + measurement-method commitments. The "role / action / outcome" triple from sample 09 collapses to a `category / description / seed_threshold` triple. The "spine" coverage shifts from UJ-set to V&V ∪ material-COMP. And three NFR-specific failure modes appear that have no FR analog: aspirational language masquerading as a threshold, quality-attribute miscategorisation, and small-model bias toward `performance/security` at the expense of `auditability/observability/maintainability/durability` (which the prompt itself flags as a known bug).

The reviewer fired three findings (HIGH/MEDIUM/LOW). As §1b shows, all three land on real issues but the corpus-typical pattern repeats: the highest-impact defects are missed and the HIGH finding mis-anchors a real gap to the wrong contract clause.

### 1a. Defects in the agent's response

#### 1a.1 Invalid `traces_to[]` entries — FR/AC ids in a field that explicitly bans them (HIGH, recurring)

The prompt is unambiguous:

> "**Do NOT trace to FR ids (`US-*`).** `traces_to[]` points at handoff seeds. If an NFR governs specific FRs, put those FR ids in the separate `applies_to_requirements` field."

The output violates this rule on five NFRs, in two flavours:

- **NFR-003** `traces_to: ["QA-3", "US-005 AC-005"]`
- **NFR-019** `traces_to: ["COMP-DEADLINE-STAT", "US-016 AC-016"]`
- **NFR-024** `traces_to: ["TECH-OTEL-1", "US-024 AC-024"]`
- **NFR-026** `traces_to: ["US-027 AC-005", "TECH-ZOD-1"]`
- **NFR-030** `traces_to: ["US-024 AC-028", "TECH-OTEL-1"]`

These are not just `US-*` ids — they are concatenated `US-NNN AC-NNN` strings, which fail the regex shape *and* the prefix whitelist (`VV | QA | TECH | COMP | UJ`). The self-heal filter described in the prompt would silently drop them with a WARN, leaving five NFRs with weakened or nominally-empty trace spines. The reviewer caught the AC-id pattern in `applies_to_requirements` (where it is structurally permitted but fragile) and missed it in `traces_to[]` (where it is contract-prohibited). Severity is HIGH.

#### 1a.2 QA-18 missing — but the contract framing matters (MEDIUM, not HIGH)

The reviewer flagged QA-18 (Error budget tracking max 4% monthly) as missing and called it a coverage-contract failure. The gap is real — there is no NFR for error budgets — but the *framing* is wrong. The prompt is explicit:

> "Every V&V requirement MUST be the seed of at least one NFR. Every material compliance-extracted item MUST be surfaced by at least one NFR. **In addition, you MAY produce NFRs seeded primarily from `qualityAttributes[]` or from technical constraints.**"

QA-* coverage is `MAY`, not `MUST`. The reviewer escalated MAY to MUST in exactly the same way sample 09's reviewer escalated supplemental-compliance-FR coverage. The defect is genuine — error budget is a substantive missing concern that the platform demands — but the correct severity is MEDIUM (`reliability` / `observability` gap with downstream-cost implications), not HIGH (production-blocker). The HIGH framing only holds if `unreached_seeds[]` should have absorbed it explicitly; the agent set `unreached_seeds: []` while silently dropping QA-18, which is a **secondary** defect (coverage-discipline failure, not coverage-contract failure).

#### 1a.3 Hallucinated FR id (`US-028`) in `applies_to_requirements` (MEDIUM)

NFR-025:

> ```
> "applies_to_requirements": ["US-024", "US-028"]
> ```

The FR set delivered in the handoff runs US-001 → US-027. There is no US-028. This is a clean grounding/fabrication defect — the agent invented an FR that does not exist. The thinking chain (sample 09 noted the same shape: chain plans US-028/029/030 but final drops them) has a parallel here: the agent's planning section shows it carrying mental imprints of FR ids beyond the actual delivered set, and one such phantom leaked into NFR-025.

#### 1a.4 Aspirational `seed_threshold` strings — non-measurable commitments (MEDIUM, recurring)

The prompt requires "the essential measurable commitment" as the seed threshold. Several NFRs deliver aspirational prose instead:

- **NFR-018** seed_threshold: `"Auditable, compliant GL structure required."` — restates COMP-GL-AUDIT verbatim; no measurable predicate.
- **NFR-022** seed_threshold: `"Resale packet guidelines enforced for exports."` — "enforced" is not a threshold.
- **NFR-024** seed_threshold: `"Metric refresh rate ensures operational awareness."` — "ensures awareness" is unmeasurable.
- **NFR-025** seed_threshold: `"Real-time monitoring dashboards available."` — availability of a dashboard, not a threshold.
- **NFR-026** seed_threshold: `"Recommendations relevant to user context."` — direct restatement of US-027's outcome, not a quantitative or boolean predicate.

The contract treats these as *seed* thresholds (not the full Pass-2 wording), but a seed must still name a measurable commitment ("seed" ≠ "aspirational"). Compare with the prompt's exemplar: `"Cross-tenant reads must fail authorization."` — that is a falsifiable boolean. The five above are not.

This is the NFR-skeleton analog of sample 09's "trivially-tautological condition" class, narrowed to the threshold field.

#### 1a.5 Quality-attribute miscategorisation (MEDIUM, recurring)

Several NFRs are placed in categories that don't match their substance:

- **NFR-005** (secret rotation every 90 days) → `maintainability`. This is a security control. Maintainability is for build-time/operability concerns; secret-rotation is a security posture commitment.
- **NFR-027** (15-minute session timeout) → `maintainability`. This is a security control (session management).
- **NFR-029** (data residency restricted to North America) → `availability`. This is `compliance` (data sovereignty) or `security`, not availability.
- **NFR-009** (OWASP scans + input sanitization) → `security`, but conflates QA-13 (weekly OWASP scans) and QA-15 (input sanitization), which are different concerns that should split into two NFRs.

The prompt explicitly warns: "Small models have a well-known bias toward `performance` and `security` NFRs and tend to under-produce `auditability`, `observability`, `maintainability`, `accessibility`, `durability`. This is a BUG, not a feature." The agent over-corrects in two directions: it parks *security* concerns in `maintainability` to inflate that category's count, and it conflates two distinct QA seeds into one NFR to compress the security count. Both moves break taxonomy alignment.

#### 1a.6 Duplicate trace + redundant NFRs (LOW–MEDIUM)

- **NFR-016** `traces_to: ["COMP-PERSISTENT-DATA", "COMP-PERSISTENT-DATA"]` — the duplicate the reviewer caught.
- **NFR-006** and **NFR-010** both cover the origin-IP / Cloudflare constraint. NFR-006 traces `[VV-SECURITY-ORIGIN-PROXY, TECH-CDNF-1, TECH-ORIGIP-1]` with seed_threshold `"0% direct traffic reaching origin IP."` NFR-010 traces `[TECH-ORIGIP-1]` with seed_threshold `"No direct traffic reaching origin IP allowed."` These are the same commitment; one should absorb the other via `unreached_seeds[]`.

The redundancy is not a contract violation per se (both cite valid handoff ids), but it inflates the requirements count and weakens Pass-2 enrichment (Pass 2 will produce two thresholds for the same concern, which Pass 3 will then have to deduplicate).

#### 1a.7 Verbatim exemplar / source leakage in seed thresholds (LOW)

NFR-006's seed_threshold (`"0% direct traffic reaching origin IP."`) is a near-verbatim copy of the V&V threshold field (`"0% direct traffic reaching origin IP; 100% of public traffic routed via Cloudflare CDN."`). NFR-003's seed_threshold (`"Cross-tenant reads must fail authorization."`) is verbatim from the prompt exemplar.

For NFR-006 this is acceptable (the V&V is the seed; copying its threshold is faithful). For NFR-003 it is the same exemplar-leakage pattern flagged in sample 09 §1a.1: the agent uses the prompt's illustration as a substitute for authoring. Both NFRs happen to land on commitments that are well-shaped, so the harm is minimal here, but the *pattern* is a regression risk worth flagging.

#### 1a.8 NFR-026 duplicates a Functional Requirement (LOW–MEDIUM)

The prompt says: "Do NOT duplicate Functional Requirements from Sub-Phase 2.1." NFR-026:

> ```
> "description": "AI-curated recommendations distinguish legacy entries via flags",
> "seed_threshold": "Recommendations relevant to user context.",
> "traces_to": ["US-027 AC-005", "TECH-ZOD-1"]
> ```

This restates US-027 (functional capability) rather than expressing a quality attribute commitment about it. A real NFR derived from US-027 would be something like "Recommendation relevance precision ≥ X%" (performance) or "Recommendation provenance auditable" (auditability). The current shape is a near-copy of the FR, traced (illegally; see §1a.1) to its own AC.

#### 1a.9 Reasoning-vs-output drift on planned mapping (LOW)

The thinking chain plans a specific category-to-source mapping (visible in lines 287–327 of the chain): `NFR-018: Auditability (Ledger Structure) -> COMP-GL-AUDIT`, `NFR-019: Auditability (Financial Audit) -> COMP-AUDIT-REQ`. The final response delivers `NFR-018: compliance / COMP-GL-AUDIT` and `NFR-019: compliance / COMP-DEADLINE-STAT` — both reshuffled. This is not a hard contradiction (the substance is preserved), but the silent reshuffle is the same `reasoning_to_response_faithfulness` signal that sample 09's chain produced.

### 1b. Analysis of the reviewer's 3 findings

#### Finding 1 — HIGH: "Failure to cover all Quality Attributes (QA-18 missing)"

**Verdict: partial hit, mis-severitied, mis-anchored.**

The reviewer correctly notices that QA-18 has no NFR. But the surrounding framing — "QA-1 through QA-20 must be seeded by at least one NFR... violates the core coverage contract... will cause the verifier (Pass 3) to reject" — is wrong on the prompt text. QA-* is `MAY`, not `MUST`. The verifier rejects on V&V and COMP coverage, not QA coverage. The correct framing is either (a) MEDIUM `reliability/observability` gap (error budget is substantively missing, but optional), or (b) MEDIUM `coverage_discipline_failure` (the agent set `unreached_seeds: []` while silently dropping QA-18; if it absorbed the concern it should have said so).

The pattern matches sample 09: a Gemma-class reviewer escalates a permissive prompt clause to a mandatory one, generating a HIGH finding that is louder than the underlying gap warrants. It also blocks the reviewer from engaging the *actually* HIGH defects (§1a.1).

#### Finding 2 — MEDIUM: "Overly granular and fragile linking in `applies_to_requirements`"

**Verdict: hit, severity reasonable, but anchored to the wrong field.**

The observation is correct: `applies_to_requirements: ["US-001 AC-001", ...]` is fragile, since AC ids drift across passes. MEDIUM is appropriate for this field.

What the reviewer **missed** is that the same AC-id pollution appears in `traces_to[]` on five NFRs (§1a.1), where it is not just fragile but contract-prohibited. The reviewer's attention landed on the cosmetic-fragility surface and missed the contract-violation surface. Had the reviewer separated the two fields, this would have been one MEDIUM (applies_to fragility) plus one HIGH (traces_to FR pollution).

#### Finding 3 — LOW: "Redundant tracing in NFR-016"

**Verdict: clean hit, severity correct.**

The duplicate `["COMP-PERSISTENT-DATA", "COMP-PERSISTENT-DATA"]` is a real defect, correctly framed at LOW. This is the kind of finding a deterministic check should be catching pre-LLM, freeing the LLM reviewer to attend to the larger surface.

### 1c. What the reviewer missed

Against a 12 KB output and a tight Pass-1 contract, the reviewer logged three findings totalling roughly the lower third of the defect surface. Specifically missed:

1. **Five `traces_to[]` entries that violate the explicit FR-id ban** (§1a.1) — the most material defect; would be caught by a deterministic regex.
2. **Hallucinated `US-028` in NFR-025** (§1a.3) — straight grounding failure of the kind both the original ChatGPT 5.5 assessment and sample 09 flagged.
3. **Five aspirational, non-measurable seed thresholds** (§1a.4) — the NFR-skeleton analog of measurement-adequacy failure.
4. **Three category miscategorisations + one QA-conflation** (§1a.5) — exactly the small-model bias the prompt itself warns about.
5. **NFR-006 / NFR-010 redundancy** (§1a.6) — identical concern, two NFRs.
6. **NFR-026 duplicating US-027** (§1a.8) — explicit prompt rule violation.
7. **Reasoning-vs-output reshuffle on category assignments** (§1a.9).

The pattern is now consistent across samples 03, 05, 06, 07, 08, 09, and 11: a single Gemma-class reviewer with broad scope produces a small number of findings, anchors at least one to a misread of a permissive clause, catches one cosmetic LOW, and silently misses the higher-impact narrow defects. The remediation is the same: narrow validators with positive-mission framing, deterministic prefix wherever cheap.

---

## 2. Diagnosis

The NFR skeleton pass shares sample 09's spine-vs-fabrication-vs-scope-discipline triad but specialises each axis:

| Failure class | FR skeleton (sample 09) | NFR skeleton (this) |
|---|---|---|
| Coverage spine | UJ-set + `unreached_journeys[]` | V&V ∪ material-COMP + `unreached_seeds[]` (QA-* is MAY) |
| Fabrication | new thresholds in seed ACs; copied exemplar; persona drift | invalid `US-* AC-*` in `traces_to`; phantom FR ids; copied exemplar |
| Scope discipline | over-authoring ACs (Pass-2 work in Pass-1 output) | aspirational "thresholds"; conflating two QA seeds; `unreached_seeds: []` while silently dropping |
| Shape | role/action/outcome triple with persona-id alignment | category/description/seed_threshold triple with quality-attribute alignment |
| Trace integrity | `traces_to[]` substrate coverage | strict prefix whitelist; FR pollution illegal in `traces_to`, fragile in `applies_to_requirements` |

Two failure modes are genuinely NFR-specific:

- **Quality-attribute miscategorisation.** Skeleton FRs do not have a category field; skeleton NFRs do. Mis-bucketing a security control into `maintainability` is unique to this pass.
- **Aspirational threshold language.** FR seeds have `description / measurable_condition` where the *condition* is the testable half. NFR seeds have a single `seed_threshold` that must itself be measurable; "ensures awareness" / "guidelines enforced" / "structure required" all collapse into the same anti-pattern.

Both demand new validators (§3, §4.x). The remaining surface is parameter-varied reuse from sample 09.

---

## 3. Recommended validator pipeline for this role

Pipeline order (deterministic first, then narrow LLM, synthesis last):

```
1.  contract_schema_nfr_skeleton          (deterministic; parameter-varied from sample 09's contract_schema_skeleton)
2.  nfr_structural_completeness           (deterministic; parameter-varied from story_structural_completeness)
3.  handoff_coverage_audit                (deterministic; reused; spine = V&V ∪ material-COMP)
4.  fr_trace_pollution_check              (deterministic; NEW for NFR — no US-*/AC-* in traces_to)
5.  source_attribution_grounding          (LLM; reused, parameter-varied)
6.  nfr_shape_conformance                 (LLM; parameter-varied from story_shape_conformance)
7.  threshold_presence_check              (LLM; NEW for NFR)
8.  quality_attribute_taxonomy_alignment  (LLM; NEW for NFR)
9.  pass_scope_discipline                 (LLM; reused)
10. grounding_validator                   (LLM; reused, narrowed surface)
11. measurement_adequacy_validator        (LLM; reused, scope-narrowed to threshold↔description consistency)
12. assumption_citation_validator         (LLM; reused, collapsed to traceability)
13. reasoning_to_response_faithfulness    (LLM; reused)
14. open_question_vs_decided              (LLM; reused if Q-* refs present)
15. reasoning_quality_validator           (LLM; reused unchanged)
16. final_synthesis                       (LLM; reused unchanged)
```

**FR↔NFR parametrization summary:**

| Sample 09 validator | NFR fate |
|---|---|
| `contract_schema_skeleton` | **parameter-vary** → `contract_schema_nfr_skeleton` (different shape: `requirements[]/unreached_seeds[]`, NFR-NNN ids, allowed-categories enum) |
| `story_structural_completeness` | **parameter-vary** → `nfr_structural_completeness` (description/seed_threshold/category checks instead of role/action/outcome) |
| `handoff_coverage_audit` | **carry as-is** with parameter swap (spine = V&V ∪ material-COMP; UJ-spine retired) |
| `source_attribution_grounding` | **carry as-is** (substrate set differs, mission identical) |
| `story_shape_conformance` | **parameter-vary** → `nfr_shape_conformance` (commitment-as-quality-attribute, threshold-as-measurable) |
| `pass_scope_discipline` | **carry as-is** (no Pass-2 prose, no measurement_method authoring) |
| `measurement_adequacy_validator` | **carry as-is**, narrowed to threshold↔description consistency at this pass |
| `grounding_validator` | **carry as-is**, narrowed to id-validity and unsupported-numerics in seed_threshold |
| `assumption_citation_validator` | **carry as-is**, collapsed to trace-only |
| `reasoning_to_response_faithfulness` | **carry as-is** |
| `open_question_vs_decided` | **carry as-is** |
| `reasoning_quality_validator` | **carry as-is** |
| `final_synthesis` | **carry as-is** |
| `tier_decomposition_validator` | **does not apply** at this pass (no tier field, no decomposition; re-engages at NFR saturation) |

**Genuinely new at NFR skeleton:**
- `fr_trace_pollution_check` (deterministic) — would have caught §1a.1 at near-zero cost.
- `threshold_presence_check` (LLM) — catches §1a.4 aspirational language.
- `quality_attribute_taxonomy_alignment` (LLM) — catches §1a.5 miscategorisation.

---

## 4. Validator prompt templates

All LLM validators inherit the **revised positive-mission shared envelope** documented in `redesign recommendations - 1.md`. Only the role-specific bodies are reproduced below. Validators reused from sample 09 without modification (`handoff_coverage_audit`, `source_attribution_grounding`, `pass_scope_discipline`, `measurement_adequacy_validator`, `grounding_validator`, `assumption_citation_validator`, `reasoning_to_response_faithfulness`, `open_question_vs_decided`, `reasoning_quality_validator`, `final_synthesis`) are not redefined here — see sample 09 §4.

### 4.1 `contract_schema_nfr_skeleton` (deterministic)

```
ASSERT response is valid JSON
ASSERT top-level keys ⊆ {"requirements", "unreached_seeds"} and both present
ASSERT requirements is array, length ≥ 1
ASSERT unreached_seeds is array (possibly empty)
LET allowed_categories = {performance, security, reliability, scalability,
                          accessibility, maintainability, availability,
                          durability, auditability, observability, compliance}
LET allowed_priorities = {critical, high, medium, low}
LET allowed_trace_prefixes = {VV-, QA-, TECH-, COMP-, UJ-}
FOR each NFR n in requirements:
  ASSERT n.id matches /^NFR-\d{3}$/
  ASSERT ids are contiguous from NFR-001
  ASSERT no duplicate n.id
  ASSERT n.category ∈ allowed_categories
  ASSERT n.priority ∈ allowed_priorities
  ASSERT n.description is non-empty string, length ≥ 12
  ASSERT n.seed_threshold is non-empty string
  ASSERT n.traces_to is non-empty array of strings
  FOR each trace_id in n.traces_to:
    ASSERT trace_id matches /^(VV|QA|TECH|COMP|UJ)-/
    ASSERT trace_id appears verbatim in handoff substrate set
  ASSERT n.applies_to_requirements is array (possibly empty)
  FOR each fr_id in n.applies_to_requirements:
    ASSERT fr_id matches /^US-\d{3}$/   # bare FR id, no AC suffix
FOR each entry u in unreached_seeds:
  ASSERT u.seed_id matches /^(VV|COMP)-/ AND appears in handoff
  ASSERT u.absorbed_into matches /^NFR-\d{3}$/ AND resolves to a real NFR id
  ASSERT u.reason is non-empty, length ≥ 20
ASSERT no markdown fences, no prose before "{", no prose after "}"
```

Severity rule: any failure ⇒ HIGH (Pass 3 verifier will reject).

### 4.2 `nfr_structural_completeness` (deterministic)

```
FOR each NFR n:
  ASSERT len(n.description) ≥ 12 and not equal to n.seed_threshold
  ASSERT len(n.seed_threshold) ≤ 200  # one-line seed
  ASSERT n.seed_threshold does not contain newline characters
  ASSERT description vs seed_threshold Levenshtein distance > 30%  # not pure restatement
  ASSERT description does not start with "As a "  # NFR is not a user story
  ASSERT description does not contain US-NNN substring  # not an FR restatement
  IF n.category == "compliance":
    ASSERT n.traces_to contains at least one COMP-* OR VV-* id
  IF n.category == "auditability":
    ASSERT n.traces_to contains at least one COMP-* OR QA-* id
```

Severity rule: description==seed_threshold near-duplicate ⇒ MEDIUM; FR-restatement signature ⇒ HIGH; category-trace mismatch ⇒ LOW.

### 4.3 `fr_trace_pollution_check` (deterministic, NEW)

```
FOR each NFR n:
  FOR each trace_id in n.traces_to:
    ASSERT NOT (trace_id starts with "US-")
    ASSERT NOT (trace_id contains "AC-")
    ASSERT NOT (trace_id contains a space character)  # "US-005 AC-005" pattern
  FOR each fr_id in n.applies_to_requirements:
    ASSERT fr_id matches /^US-\d{3}$/        # no "US-NNN AC-NNN"
    ASSERT NOT (fr_id contains "AC-")
    ASSERT fr_id resolves to a real US-* in the FR handoff (catches US-028 phantom)
```

Severity rule:
- US-* or AC-* in `traces_to[]` ⇒ HIGH (explicit prompt prohibition).
- AC-id concatenation in `applies_to_requirements` ⇒ MEDIUM (fragile coupling).
- Phantom US-* not in FR handoff ⇒ HIGH (fabrication).

### 4.4 `nfr_shape_conformance` (LLM, parameter-varied from sample 09)

```
[MISSION]
Verify that each NFR states a real quality-attribute commitment in the
category / description / seed_threshold triple that the skeleton contract
requires.

[INSPECT]
For each NFR, decide whether:
- category names a quality attribute that genuinely characterizes the
  commitment (security controls go in `security`, not `maintainability`;
  data sovereignty goes in `compliance`, not `availability`)
- description states what the system commits to, in the voice of a
  quality-attribute (not a user-facing capability, not a restatement of an
  FR, not a restatement of the seed_threshold)
- seed_threshold states a single short measurable predicate that anchors
  the description (a falsifiable boolean, a numeric ceiling/floor, or a
  cardinality — not aspirational prose)

A well-shaped NFR reads as "[the system]'s [quality attribute] is bounded
by [seed_threshold predicate]" even when the prompt's literal output schema
uses three separate fields.

[FAILURE PATTERNS]
- description that copies an FR description (e.g., "AI-curated
  recommendations distinguish legacy entries via flags" mirrors US-027)
- description that copies the seed_threshold or vice versa
- seed_threshold that names no measurable predicate ("ensures awareness",
  "guidelines enforced", "structure required", "available")
- description that names a system feature instead of a quality bound
  ("Real-time monitoring dashboards use OTEL and Signoz integration"
  describes implementation, not a quality commitment)
- category that does not match the substance (secret rotation in
  maintainability; data residency in availability)

[BOUNDARY]
Trace integrity, FR pollution, and schema belong to other validators.
Quality-attribute taxonomy mismatches belong here AND to
quality_attribute_taxonomy_alignment; report them in both since they are
the same defect viewed from different angles.

[FINDING SHAPE]
{ severity, type: "fr_restatement|description_threshold_duplicate|
                   aspirational_threshold|implementation_in_description|
                   miscategorisation",
  nfrId, fieldSpan (quoted), recommendation }
```

Severity rule: aspirational threshold ⇒ MEDIUM; FR restatement ⇒ HIGH; miscategorisation ⇒ MEDIUM; description==threshold ⇒ LOW–MEDIUM.

### 4.5 `threshold_presence_check` (LLM, NEW)

```
[MISSION]
Verify that every NFR's seed_threshold names a measurable commitment, not
aspirational or tautological prose.

[INSPECT]
For each NFR.seed_threshold, decide whether the string contains at least
one of:
- a quantitative bound ("under 200ms", "≤ 4%", "every 90 days", "≥ 99.9%")
- a falsifiable boolean predicate ("cross-tenant reads must fail
  authorization", "every vote-record action produces an audit entry")
- a presence/absence predicate against a substrate-named artifact
  ("audit-log entry with action='deadline_check' is written")
- a cardinality ("exactly one", "at most three", "100% of")

A seed_threshold without any of the above is aspirational.

[FAILURE PATTERNS]
- "ensures awareness", "ensures relevance", "ensures correctness"
- "guidelines enforced", "structure required", "audit completed"
- "available", "in place", "supported"
- restating the description as the threshold

[BOUNDARY]
Whether the threshold's number is *grounded* in substrate is
grounding_validator's job. This validator only checks measurability.

[FINDING SHAPE]
{ severity, type: "aspirational|tautological|description_repeat",
  nfrId, thresholdSpan (quoted), recommendation }
```

Severity rule: aspirational ⇒ MEDIUM (every aspirational threshold becomes a Pass-2 burden); tautology ⇒ MEDIUM; description repeat ⇒ LOW.

### 4.6 `quality_attribute_taxonomy_alignment` (LLM, NEW)

```
[MISSION]
Verify that every NFR's category matches the quality attribute its
description and seed_threshold actually express, and that the corpus as a
whole respects the small-model-bias warning the prompt explicitly raises.

[INSPECT — per-NFR]
For each NFR, classify the substance of (description, seed_threshold) into
the most-fitting category from the allowed set:
  performance | security | reliability | scalability | accessibility |
  maintainability | availability | durability | auditability |
  observability | compliance
Compare to n.category. A mismatch is a finding.

[INSPECT — corpus-level]
Count NFRs per category. The prompt warns that small models over-produce
performance/security and under-produce
auditability/observability/maintainability/accessibility/durability.
- If the corpus contains COMP-* items naming audit trails, expect
  ≥ 1 auditability NFR per such item.
- If the handoff contains technical constraints naming OTEL/Signoz/
  observability stacks, expect ≥ 1 observability NFR.
- If quality attributes name backup, RTO, or persistence, expect
  ≥ 1 durability or reliability NFR per concept.

[FAILURE PATTERNS]
- security control parked in maintainability (secret rotation, session
  timeout, RBAC, encryption)
- compliance/sovereignty parked in availability (data residency)
- observability parked in maintainability or vice versa
- two distinct QA seeds conflated into one NFR (e.g., QA-13 weekly OWASP
  scans + QA-15 input sanitization fused as one "security" NFR)
- corpus-level under-population of auditability when COMP-AUDIT-REQ
  and COMP-GL-AUDIT are both present

[BOUNDARY]
Aspirational thresholds belong to threshold_presence_check.
Coverage of V&V/COMP belongs to handoff_coverage_audit.

[FINDING SHAPE]
{ severity, type: "miscategorised|seed_conflation|category_under_population",
  nfrId or "<corpus>", actualCategory, suggestedCategory,
  recommendation }
```

Severity rule: per-NFR miscategorisation ⇒ MEDIUM; seed conflation ⇒ MEDIUM (split into two NFRs); corpus-level under-population when source items demand it ⇒ HIGH.

---

## 5. Conditional dispatch and integration

**Always-run (deterministic, cheap):**
- `contract_schema_nfr_skeleton`
- `nfr_structural_completeness`
- `handoff_coverage_audit`
- `fr_trace_pollution_check`

If any of the four fires HIGH, short-circuit to `final_synthesis`. The Pass-3 verifier is functionally a deterministic coverage check; running this prefix as Pass-1 advisory catches structural failures one pass earlier.

**Always-run (LLM, narrow):**
- `source_attribution_grounding`
- `nfr_shape_conformance`
- `threshold_presence_check`
- `quality_attribute_taxonomy_alignment`
- `pass_scope_discipline`
- `reasoning_to_response_faithfulness`

These six are the narrow LLM validators that the corpus has consistently shown a single broad reviewer cannot cover in one pass at NFR skeleton scope.

**Conditional:**
- `grounding_validator` runs only if any seed_threshold contains numeric tokens, percentages, durations, or HTTP-shaped strings. Cheap regex pre-filter: `/\d+\s*(ms|seconds?|minutes?|hours?|days?|years?|%)/i`, `/HTTP\s+\d{3}/i`, `/\d+(\.\d+)?\s*%/`.
- `measurement_adequacy_validator` runs only if `nfr_shape_conformance` reports a description-vs-threshold inconsistency or `threshold_presence_check` flags an aspirational threshold (the description may itself name the missing measurable).
- `open_question_vs_decided` runs only if any `traces_to[]` references a `Q-*` or `OPEN-*` id (rare at this pass, but some calibration runs surface them).

**Synthesis:**
- `final_synthesis` always last. Decision policy: any HIGH from `contract_schema_nfr_skeleton`, `handoff_coverage_audit` (V&V or material-COMP gap), `fr_trace_pollution_check`, `nfr_shape_conformance` (FR restatement class), or `quality_attribute_taxonomy_alignment` (corpus-level under-population) ⇒ QUARANTINE. MEDIUM-only ⇒ REVISE. Reasoning-faithfulness MEDIUM alone (e.g., silent reshuffle) ⇒ ACCEPT_WITH_NOTES + rerun recommendation.

**Cost note:** the deterministic prefix in this sample would have caught:
- §1a.1 (five FR-pollution traces) via `fr_trace_pollution_check`
- §1a.3 (US-028 phantom) via `fr_trace_pollution_check`
- §1a.6 (NFR-016 duplicate trace) via `nfr_structural_completeness`

That is roughly half the defect taxonomy at near-zero cost, before any LLM runs. The remaining six LLM validators are short-context (a single NFR plus the handoff substrate); each can run on the same Gemma-class model in serial within the current per-phase budget.

---

## 6. Notes and open questions

1. **FR↔NFR parametrization holds, with three additions.** The sample 09 family carries forward to NFR skeleton with two parameter-varied deterministic checks (`contract_schema_nfr_skeleton`, `nfr_structural_completeness`), one parameter-varied LLM (`nfr_shape_conformance`), and three new validators (`fr_trace_pollution_check`, `threshold_presence_check`, `quality_attribute_taxonomy_alignment`). Everything else carries as-is. This is a strong reuse story for Wave-8 implementation: the bulk of the validator codebase is shared between FR and NFR skeleton passes.

2. **`handoff_coverage_audit` spine swap.** The validator's mission is unchanged ("did every spine item get covered or excused?"); only the spine set changes (UJ-set → V&V ∪ material-COMP). The QA-* set is **explicitly not** part of the spine at NFR skeleton, despite the reviewer's framing in this sample. The validator should emit INFO (not a finding) when QA-* items are dropped without `unreached_seeds[]` — the gap is real but the contract is permissive.

3. **`tier_decomposition_validator` deferred.** Like at FR skeleton, no tier field exists at this pass and no decomposition occurs. The validator re-engages at NFR saturation (the original ChatGPT 5.5 assessment's home turf) once the recursive bloom adds the `tier`, `acceptance_criteria[]`, `parent_branch_classification`, and `decomposition_rationale` fields.

4. **Pass-2 (threshold-measurement enrichment) overlap.** Several validators here (`threshold_presence_check`, `measurement_adequacy_validator`, `grounding_validator`) will need parameter-varied siblings at Pass 2 with *expanded* scope. The full count-equality / set-equality / null-handling battery from the original assessment becomes load-bearing at Pass 2 once full `threshold` + `measurement_method` text is authored. The seed-only narrowing in §4.5 is a deliberate scope contraction for Pass 1 only.

5. **Quality-attribute under-population as a HIGH at corpus level.** The prompt itself flags small-model bias as a *known bug*; the validator pipeline must escalate corpus-level under-population to HIGH, not LOW. This sample under-populates `auditability` (only NFR-017 traces QA-4 + COMP-AUDIT-REQ; NFR-018 and NFR-019 are bucketed as `compliance` despite being audit-substantive). The corpus also entirely omits `accessibility`, but the handoff has no accessibility seed, so absence is correct (the validator's source-driven floor avoids false positives).

6. **Exemplar leakage as a deterministic check.** Same recommendation as sample 09: compute Levenshtein similarity between every `seed_threshold` in the response and every threshold-shaped string in the prompt's exemplar block (`"Cross-tenant reads must fail authorization."`, `"Every vote-record action produces an audit entry."`); similarity > 0.9 flags exemplar leakage. NFR-003's seed_threshold is a verbatim exemplar copy; the deterministic check is one regex away.

7. **`unreached_seeds[]` discipline.** The contract makes `unreached_seeds[]` the explicit absorption channel, and silent omission a verifier failure. This sample emits `unreached_seeds: []` while silently dropping QA-18 (permissibly — QA is MAY) but also implicitly absorbing TECH-CDNF-1 / TECH-ORIGIP-1 / VV-SECURITY-ORIGIN-PROXY redundancy across NFR-006 and NFR-010. A `coverage_discipline_audit` validator (LLM) could detect "you have two NFRs covering one concern; one should be in `unreached_seeds[]` with `absorbed_into`." Flagged for follow-up rather than scoped here, since the redundancy is borderline and the deterministic prefix catches the cleaner cases.

8. **Reasoning-vs-response chain at NFR skeleton is shorter than at FR skeleton.** The chain (~19 KB) is dominated by category-mapping enumeration; the silent reshuffle of NFR-018 and NFR-019 between thinking and response is the main `reasoning_to_response_faithfulness` signal. The validator's cost here is lower than at FR skeleton because the chain is more list-shaped and less narrative.
