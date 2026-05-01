# Assessment: domain_interpreter / compliance_retention_discovery (Phase 1.3.3)

**Sample:** `track_c_samples/04_domain_interpreter__compliance_retention_discovery.md`
**Reviewed agent:** `domain_interpreter` running `qwen3.5:9b` (3 KB JSON output, 31 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

The agent emitted a 3 KB `compliance_retention_discovery` document containing seven `complianceExtractedItems[]` — six tagged `CONSTRAINT`, one tagged `REQUIREMENT`. All seven trace to two source regions: CDM Domain 12 ("Compliance") bullet list, CDM Domain 2 ("Accounting") "Auditable, compliant GL structure", and the Infrastructure section's "eternal perspective" / "must remain persistent and isolated" sentence. The reviewer returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The agent's reasoning is highly accurate, methodical, and demonstrates excellent adherence to the complex constraints of the prompt. ... No substantive reasoning risks were found."
}
```

Schema/gate consistency is intact (`has_concerns=false` ↔ `concerns=[]`). The substantive failures are different from sample 03 in shape but identical in *kind*: the agent shows good restraint on the most obvious hallucination axis (refused to invent "GDPR", "HIPAA", or "7 years"), then *over-extracts* CDM domain headers as binding compliance CONSTRAINTs, *under-extracts* high-salience HOA / payment / e-signature / IRS-1099 signals that the source genuinely contains, and inflates an architectural-durability sentence ("must remain persistent and isolated") into a legal retention obligation. The reviewer caught none of this and additionally missed an outright JSON-validity defect (unescaped internal double quotes in the `excerpt` field of the seventh item).

The sample is the second sibling of sample 03's domain_interpreter discovery family. Sample 03 introduced `scope_boundary_adherence_discovery` as a parameterized cross-discovery validator. The compliance pass exposes the *opposite* direction of layer drift: where 1.0b (product) drifted *outward* into 1.0c/1.0d/1.0e turf, 1.0d (compliance) here drifts *inward* — pulling architectural posture and CDM domain labels into the compliance bucket. This confirms the parameterization design but adds a refinement: the per-pass layer-assignment table needs an explicit "items naturally belonging to *this* pass" positive list, not just "items belonging to siblings", because the failure mode in this sample is mostly over-claiming territory that is technically a sibling's.

### 1.1 Bare CDM domain bullets extracted as binding compliance CONSTRAINTs

The CDM Domain 12 source is a domain header followed by an enumeration of the *capability areas* this domain owns:

> "### **DOMAIN 12 — Compliance**
> * Statutory deadlines
> * Notice requirements
> * Voting rules
> * Financial audit requirements
> * Resale packet guidelines
> Through the rules engine and AI-parsed statutory logic."

These are the *labels of sub-areas* the Compliance domain handles — not stated obligations. The source never says "the system MUST comply with statutory deadlines"; it says "Compliance is a domain, and within that domain we will handle statutory-deadline tracking, notice requirements, voting rules, financial-audit requirements, and resale-packet guidelines." The agent's own thinking wavers on this:

> "These are listed under 'Core Business Domains' for the CAM Pillar, but then Domain 12 is in the Hestami CDM section. The prompt asks to capture 'stated compliance regimes, legal retention obligations, and audit requirements'. The text lists 'Financial audit requirements' as a bullet point under Domain 12 Compliance."
> ...
> "Are these specific enough? 'Financial audit requirements' implies an obligation to meet financial audit requirements."

— and then commits five `type: "CONSTRAINT"` items: `COMP-AUDIT-REQ`, `COMP-STATUTE-DEADLINE`, `COMP-NOTICE`, `COMP-VOTE`, `COMP-RESALE-GUIDELINE`. The prompt's own definition of `CONSTRAINT` is "mandatory compliance obligations the product MUST satisfy" — but the source spans these `excerpt` fields point to are bare two-word capability labels (`"Statutory deadlines"`, `"Notice requirements"`, `"Voting rules"`). A bare label is not a stated obligation. The proper extraction shape for CDM Domain 12 is *one* item — "the product owns a Compliance domain that will handle statutory deadlines, notice requirements, voting rules, financial-audit requirements, and resale-packet guidelines" — typed `DECISION` (a scope commitment to *have* a Compliance domain) with the five sub-areas surfaced as `OPEN_QUESTION` items asking which jurisdictions / which statutes / which retention periods apply. Or, equivalently, the five could remain as `CONSTRAINT` items provided each one is *paired* with an `OPEN_QUESTION` recording that the source names the obligation category but not its content.

This is the discovery-pass analogue of sample 03's "stretching weak signals into firm assertions" defect, applied to compliance: a domain *header* is treated as a domain *obligation*.

### 1.2 Architectural durability inflated into a retention CONSTRAINT

`COMP-PERSISTENT-RETENTION` reads:

> "type": "CONSTRAINT",
> "text": "property data and governance history must remain persistent and isolated",
> "section_heading": "#### Core Technological Infrastructure and Stack"

The source span is the Infrastructure section's framing sentence:

> "The Hestami AI OS is built on a modern, scalable, and highly secure technical stack designed for long-lived durability. The system's foundational layers are engineered to handle the 'eternal perspective' of real estate, recognizing that while owners and managers may change over decades, the property data and governance history must remain persistent and isolated."

This is a statement of architectural posture — a 1.0c (technical) item about durability and tenant isolation. It is not a *legal retention obligation*. There is no jurisdictional anchor, no time period, no regulatory instrument named, and the surrounding paragraph is plainly about the technical stack ("Cloudflare CDN", "Ubuntu Linux VM", "PostgreSQL with RLS"). The agent has performed the inverse of sample 03's drift: where 1.0b paraphrased technical commitments into product-layer language, 1.0d here paraphrases an architectural-durability commitment into a compliance retention CONSTRAINT. The proper handling is either to leave the item to 1.0c (the natural extraction is "multi-tenant data isolation enforced via RLS, durability commitment for property + governance history") or to surface it here as an `OPEN_QUESTION`: *"Is the 'eternal perspective' durability commitment driven by a specific retention regime (HOA records retention, IRS retention, state document-preservation law) or only by product policy?"*

### 1.3 High-salience compliance signals missed entirely

The source contains several signals that *should* have been extracted by a compliance pass — either as `OPEN_QUESTION` items (for which regime applies) or as `CONSTRAINT` items where the source itself is sufficiently explicit:

- **HOA / CAM jurisdictional regimes.** "HOA (Homeowners Association)", "Resale packet guidelines", "Reserve Studies", "Voting rules", "Hearings", "Notice Sequence", "ARC (Architectural Requests)", "Bylaws", "CC&Rs". HOA operations are governed by *state-specific* statutes (e.g., Virginia POA Act / Condo Act, Florida Chapter 718/720, California Davis-Stirling Act, Texas Property Code Chapter 209). Resale packets in particular are *explicitly* state-regulated — the term "Resale packet guidelines" itself is a regulatory term of art. The agent's `COMP-RESALE-GUIDELINE` item paraphrases the bullet without surfacing the open question "*which state's HOA disclosure regime applies?*" or "*is this a multi-jurisdiction product?*".
- **PCI-DSS / payment-card scope.** "Payment capture (Stripe/Square)", "Payment acceptance (card, ACH)", "AP Invoices", "Payments", "Customers ... pay bills online or approve financing". When a product accepts cards, PCI-DSS scope is implicit; the source is silent on whether the platform processes card data directly or relies on Stripe/Square's hosted fields. This is a textbook `OPEN_QUESTION` for a compliance pass.
- **IRS information-reporting.** "Vendor W-9 / 1099 data" is named explicitly under Domain 2 Accounting. 1099 reporting is an IRS obligation with retention rules; the agent did not extract this even though "W-9 / 1099" is one of the most legally specific phrases in the entire source.
- **E-signature regimes.** "Customer signatures" (ServiceTitan domain section) and "Notarized notice delivery" implications via "Notice Sequence" → ESIGN / UETA / state notarization rules. Not extracted.
- **Audit-log / immutability for governance.** "Voting", "Resolutions", "Minutes", "Hearings", "Fines → GL", "Decision, Rationale & Trust Ledger" — these collectively imply an immutable / append-only audit trail obligation under most HOA statutes. The prompt's own "What to capture" list calls out *"immutable audit log"* as a canonical example of an auditability requirement. The agent extracted "Auditable, compliant GL structure" (good) and "Financial audit requirements" (weakly, see §1.1) but did not surface the governance-side audit-trail signal at all.
- **Multi-tenant data isolation as a security/compliance posture.** RLS-based tenant isolation is technical (1.0c), but it is also the kind of statement that, in regulated SaaS contexts, gets cross-cited in SOC 2 / ISO 27001 control mappings. A compliance pass should at minimum surface "*does multi-tenant isolation imply a SOC 2 or comparable certification commitment?*" as an open question. Not extracted.
- **Cross-border data residency.** Cloudflare is global; PostgreSQL location is unspecified. The prompt's "What to capture" list calls out *"data must stay in the US"* as a canonical jurisdictional constraint. The source is silent — which is itself an `OPEN_QUESTION`-shaped gap. Not extracted.

The agent's `complianceExtractedItems[]` should have contained roughly twice as many entries, with a healthy `OPEN_QUESTION` ratio. Instead it contains seven entries, all `CONSTRAINT` or `REQUIREMENT`, zero `OPEN_QUESTION`, zero `DECISION`. The prompt's own guidance — *"Most captures will be `CONSTRAINT` or `DECISION`"* — was followed only on the `CONSTRAINT` side; the `DECISION` side (pre-made framework commitments) and `OPEN_QUESTION` side (compliance questions the source leaves open) are entirely empty.

### 1.4 The seventh item is invalid JSON

The `COMP-PERSISTENT-RETENTION` excerpt is, verbatim:

```
"excerpt": "the system's foundational layers are engineered to handle the "eternal perspective" of real estate, recognizing that while owners and managers may change over decades, the property data and governance history must remain persistent and isolated."
```

The internal double-quote pair around `"eternal perspective"` is unescaped. This is a parse error: any strict JSON parser will reject the response. The prompt's contract was explicit on this, twice:

> "**Straight ASCII double quotes only.**"
> "No unescaped internal quotes — use single quotes for embedded phrases."

The agent's thinking wrestled with the apparent contradiction:

> "Standard JSON requires double quotes for keys and string values. ... 'No unescaped internal quotes — use single quotes for embedded phrases.' ... Standard JSON only allows double quotes for structure. Single quotes are invalid in standard JSON. The prompt says 'Straight ASCII double quotes only.' But then 'No unescaped internal quotes — use single quotes for embedded phrases.' This is contradictory ..."
> "I will use single quotes `'` for any quotes inside the text string."

— and then proceeded to violate that resolution in the very last item of the response by transcribing the source's smart-quote-equivalent pair as straight `"`. The agent's reasoning correctly identified the rule, committed to it, and then dropped it during transcription. This is a `reasoning_to_response_faithfulness` defect at the schema-validity layer, not a content layer.

The current reviewer (gemma4) did not catch this even though it is *structurally* the easiest defect to detect.

### 1.5 Type misclassification: REQUIREMENT vs CONSTRAINT

`COMP-GL-AUDIT` ("Auditable, compliant GL structure.") is typed `REQUIREMENT` while the five Domain 12 bullets are typed `CONSTRAINT`. The agent's own thinking acknowledges the inconsistency:

> "'Auditable, compliant GL structure' -> The product must implement this. `REQUIREMENT` or `CONSTRAINT`. Given it's a domain requirement, `REQUIREMENT` fits well. But if it's a constraint from law ('compliant GL structure'), `CONSTRAINT` is better. ... Since the text just lists it under 'Requirements', `REQUIREMENT` is safer. ... Actually, looking at the example in the prompt: ... So if the text says 'Financial audit requirements', it's likely a `CONSTRAINT`. 'Auditable, compliant GL structure' -> `CONSTRAINT`."

— and then commits the item as `REQUIREMENT` anyway. The prompt's typing rules ("CONSTRAINT — mandatory compliance obligations" vs "REQUIREMENT — derived compliance work items the product must implement") draw the line at *source-stated obligation* vs *derived implementation work*. Both Domain 2's "Auditable, compliant GL structure" and Domain 12's "Financial audit requirements" are at the same level of abstraction (sub-bullets of CDM domain definitions); typing them differently is incoherent. Either both are `CONSTRAINT` (preferred — they read as obligation language) or both are `DECISION` (the source has decided to operate an auditable GL).

### 1.6 `section_heading` includes raw markdown syntax

The `section_heading` field on every Domain 12 item reads `"### **DOMAIN 12 — Compliance**"` — the raw markdown header *with* the `###` and `**` emphasis markers. The contract example uses `"Community Association Management Requirements"` — heading text only. Including the markdown syntax means downstream consumers (Phase 1.1b scope/compliance context, Phase 5 retention wiring, Phase 7 test planning) must strip markdown before matching against the source. Minor in isolation; symptomatic of the agent treating the source's surface text as the canonical heading.

### 1.7 ServiceTitan / Vantaca appendix handling — borderline correct

Unlike sample 03 (which absorbed competitor-appendix content as native journeys), the agent here *considered* extracting "Compliance monitoring rules", "Safety training records", and "Compliance audits" from the ServiceTitan appendix and ultimately *excluded* them. The thinking is muddled:

> "I should focus on Hestami specific statements. The Domain 12 in Hestami CDM is Hestami's own domain. ... I will *not* include the ServiceTitan specific items unless explicitly stated as 'Hestami will use...'."

— but the conclusion is defensible. The corollary, however, is that the agent should have surfaced *one* `DECISION` item recording the scope-shape commitment ("Phase 2 will mirror ServiceTitan's contractor licensing / safety / compliance scope; Phase 3 will mirror Vantaca's HOA compliance scope") plus `OPEN_QUESTION` items asking which specific compliance obligations are inherited. That is the same surfacing rule that sample 03 violated. The agent's restraint here is good; the *positive* counterpart of the rule (surface the comparison as a tentative decision + open question) was not executed.

### 1.8 Empty `OPEN_QUESTION` and `DECISION` arrays despite an obviously underspecified source

The source is *silent* on every regime-level question that matters for a real-property / HOA / payments product: PCI scope, IRS-1099 retention, HOA state law, e-signature regime, residency, SOC 2 posture, immutable audit-log obligation. An honest compliance pass on this source should produce mostly `OPEN_QUESTION` items and a handful of `DECISION`s (committing to *have* a Compliance domain, *have* an auditable GL, *target* a ServiceTitan-comparable contractor compliance scope). The agent produced zero of each. This is a structural defect: the agent treated the prompt's "transcribe what the source states, not interpret legal obligations" rule as *only* a license to transcribe, not also a license to record "the source does not state X" as an open question. The prompt's `type: "OPEN_QUESTION"` ("compliance questions the source leaves open") is the explicit channel for this and was unused.

### 1.9 The current reviewer's behaviour

- **Caught:** nothing of substance.
- **Missed:** §1.1 (CDM domain bullets stretched into CONSTRAINTs), §1.2 (architectural durability inflated into retention), §1.3 (HOA / PCI / 1099 / e-signature / audit-trail / residency signals missed), §1.4 (unescaped internal double quotes — invalid JSON), §1.5 (REQUIREMENT/CONSTRAINT type incoherence), §1.7 (positive counterpart of competitor-handling rule not executed), §1.8 (zero `OPEN_QUESTION` / `DECISION` items on a manifestly under-specified compliance source).
- **Hallucinated:** the reviewer's overall_assessment claims "excellent adherence to the complex constraints of the prompt" — including the JSON output contract that the response materially violates. The reviewer matched on the *absence* of obvious hallucinations (no GDPR / no "7 years") rather than on whether the actual extraction was sound.
- **Schema consistency:** intact at the reviewer-output level.
- **Severity calibration:** untestable.
- **Layer-scope semantics:** not understood — the reviewer did not detect that an Infrastructure-section sentence about durability was relabelled as a compliance retention CONSTRAINT.

---

## 2. Diagnosis

The role-specific failure modes for a compliance-and-retention discovery pass:

1. **Domain-header inflation.** A bare CDM bullet ("Statutory deadlines") is committed as a CONSTRAINT with the bullet text as both `text` and `excerpt`. The source span supports the *existence of an area of obligation*, not the *content of an obligation*. Detection requires recognising that capability labels are not obligation statements.

2. **Architectural-posture inflation.** Sentences about durability, persistence, isolation, or security ("must remain persistent and isolated") are paraphrased as retention or audit CONSTRAINTs even when the source has no jurisdictional, statutory, or temporal anchor. This is the inverse direction of sample 03's drift: 1.0d pulls 1.0c content inward instead of pushing 1.0d content outward.

3. **Regime hallucination — well-controlled in this sample.** The agent did *not* invent "GDPR", "HIPAA", "SOC 2", or any specific time period (correctly recognising that "7 years" appeared only in the prompt's example, not the source). This failure mode is the textbook risk for compliance passes; this agent's restraint is genuinely good and should be preserved by validators that *check for* but do not *induce* regime claims.

4. **Threshold restraint — also well-controlled.** No "X years", "X days", "X%" appears in the response. Validator design should reward this rather than push the agent toward filling threshold slots speculatively.

5. **Empty `OPEN_QUESTION` channel.** The prompt provides an explicit channel for compliance questions the source leaves open; the agent did not use it. This is the most consequential structural defect for downstream consumers (Phase 5 retention wiring, Phase 7 test planning, Phase 8 evaluation design) because they cannot distinguish "the source is silent on retention" from "no retention obligations exist".

6. **Missed high-salience signals.** HOA / CAM operations imply state-level disclosure regimes; W-9/1099 implies IRS reporting; payment capture implies PCI scope; signatures imply ESIGN/UETA. None surfaced even as open questions. A compliance pass should detect *named obligation hooks* in the source and surface each as either a CONSTRAINT (if the source attests the obligation) or an OPEN_QUESTION (if the source only attests the hook).

7. **Type-coding incoherence.** The CONSTRAINT / DECISION / REQUIREMENT / OPEN_QUESTION mapping is applied case-by-case rather than from a stable rule. Items at the same source-evidence level get different types.

8. **JSON-validity slip on internal quotes.** The agent recognised the rule and violated it once. A schema validator must catch this; the reviewer must not endorse a response that fails JSON parsing.

9. **Positive surfacing of external-product comparisons.** The agent correctly *avoided* absorbing ServiceTitan / Vantaca compliance content as native, but did not execute the positive counterpart (record the scope-shape commitment as a DECISION + open the inheritance questions). Same rule as sample 03; opposite manifestation.

10. **`section_heading` markdown leakage.** Minor; symptomatic of treating source bytes as canonical labels.

---

## 3. Recommended validator pipeline for this role

Eight validators. Two deterministic, six LLM-based. Three are exact reuses from sample 03 (parameterised), three are parameter-variations of sample-03 validators, two are new and role-specific to compliance.

| # | Validator | Type | Status vs. sample 03 |
|---|-----------|------|----------------------|
| 1 | `contract_schema_compliance` | deterministic | parameter-variation of `contract_schema_discovery` (different array shape, COMP- prefix, source_ref shape) |
| 2 | `extraction_id_traceability_compliance` | deterministic | parameter-variation (COMP- prefix, no inter-array reference graph) |
| 3 | `grounding_compliance` | LLM | parameter-variation of `grounding_discovery` (claim-list narrowed to compliance items) |
| 4 | `scope_boundary_adherence_compliance` | LLM | **parameter-variation of sample 03's `scope_boundary_adherence_discovery`** — see §3.2 for the parameterisation evaluation |
| 5 | `regime_citation_validity` | LLM | **NEW — role-specific** |
| 6 | `retention_threshold_grounding` | LLM | **NEW — role-specific** |
| 7 | `compliance_signal_completeness` | LLM | **NEW — role-specific** (positive-completeness: source-named hooks must be surfaced somewhere) |
| 8 | `open_question_vs_decided` | LLM | exact reuse from sample 03 §4.6 (the validator structure carries; threshold detection narrows but the open-question-vs-decided pairing logic is unchanged) |
| 9 | `external_reference_handling` | LLM | exact reuse from sample 03 §4.5 (parameter-free, fires on the same ServiceTitan/Vantaca/Nextdoor patterns) |
| 10 | `reasoning_to_response_faithfulness` | LLM | exact reuse, cross-role |

`final_synthesis` from `redesign recommendations - 1.md` §7 applies unchanged.

**Validators that explicitly DO NOT apply to this role:**

- `persona_journey_coherence` (sample 03) — compliance has no persona/journey graph.
- `tier_decomposition`, `measurement_adequacy` — neither applicable.
- `calibration_rule_consistency_lens`, `intent_vs_artifact_scope_audit` (sample 02) — irrelevant.

### 3.1 Parameterisation evaluation: does sample 03's `scope_boundary_adherence_discovery` work here?

**Verdict: yes with one structural refinement, no semantic redesign.**

Sample 03 defined the validator with a layer-assignment table:

> "Sibling 1.0c: stated technical stack ... Sibling 1.0d: regulatory regimes, legal retention ... Sibling 1.0e: measurable thresholds ... Sibling 1.0f: domain vocabulary."

For sample 04, the same table is reorganised with 1.0d as the *current* pass and 1.0b/c/e/f as siblings. The validator's mission ("confirm every extracted item belongs to the [current] layer and not to a sibling") generalises cleanly. What changes operationally:

- **Drift direction reverses.** In 1.0b the dominant defect is items belonging to siblings being absorbed inward; in 1.0d the dominant defect (per §1.2 of this assessment) is *also* items belonging to siblings being absorbed inward, but from a different sibling (1.0c architectural durability) and via a different mechanism (paraphrase that strips the technical implementation but preserves the architectural commitment, then relabels it as compliance). The validator's `[DECISION STANDARD]` paragraph from sample 03 — *"a paraphrase that strips the technical implementation but preserves the technical commitment is still a 1.0c item"* — already covers this exactly. **No change needed.**

- **Positive list becomes load-bearing.** Sample 03's validator was mostly defined by *what siblings own* (negative). For sample 04 the dominant failure (§1.1, §1.8) is not drift outward but *over-claiming on this layer's own positive list*: extracting CDM domain headers as binding obligations rather than as scope commitments. The parameterised validator therefore needs a small additional clause:

  > "[POSITIVE LIST FOR THIS PASS]
  > A compliance/retention extraction is in-scope when the source span attests one of: (a) a named regime/standard/law, (b) a stated retention period or rule, (c) a stated audit / auditability obligation, (d) a stated jurisdictional constraint, (e) a stated notice/consent obligation, (f) a pre-made compliance-framework commitment (DECISION).
  > A bare domain header or capability label is *not* sufficient evidence for a CONSTRAINT — it may be sufficient evidence for a DECISION (we will operate this domain) and should generate paired OPEN_QUESTIONs for the unspecified content."

  This positive-list clause is missing from sample 03's version because product-intent extraction is naturally positive-list-shaped (you extract what the source positively says about product). Compliance extraction has a stricter evidence threshold — a *label* of an obligation is not the same as a *statement* of an obligation — and the positive list must encode that asymmetry.

- **Sibling-pass examples table parameterises with no change.** Each sibling (1.0b product, 1.0c technical, 1.0e V&V, 1.0f vocabulary) has the same kind of "natural extraction" examples sample 03 listed for 1.0c/d/e/f. The table mechanically rotates one row.

**Recommendation:** maintain a *single* `scope_boundary_adherence_*` validator family with two parameters: `current_pass_id` (selects the positive list) and `sibling_layer_assignment_table` (the negative list, rotated). Implement once; instantiate four times for 1.0b/c/d/e (1.0f vocabulary is shape-different and may need its own).

### 3.2 New role-specific validators

**`regime_citation_validity` (LLM).** Detects:
- Items whose `text` or `id` names a regime/standard/law that is *not* attested in the source (e.g., a `COMP-GDPR-RTBF` slug when the source never says "GDPR").
- Items whose `text` describes an obligation in regime-specific language ("right to erasure", "data subject access request") without a source-attested regime anchor.
- Inverse: source spans naming a regime ("HIPAA", "PCI-DSS", "Davis-Stirling Act") that are *not* extracted, where extraction would have been correct.

This is a stricter, role-narrower version of the cross-role grounding validator. It is separated from `grounding_compliance` because the failure mode (regime hallucination) is the textbook compliance-pass risk and warrants its own findings channel even when the more general `grounding_compliance` would also fire.

**`retention_threshold_grounding` (LLM).** Detects:
- Numeric or quasi-numeric retention periods ("7 years", "perpetuity", "30 days", "indefinitely") in any item's `text` or `excerpt` that do not appear *verbatim* in the cited source span.
- The inverse: source spans that *do* state numeric retention ("retain board minutes for X years") that were not extracted with the numeric value preserved.
- Re-typing of numeric retention into qualitative language ("long-term retention") that drops the source's specificity.

This sample has *no* such items — the agent's restraint is correct. The validator therefore mostly reports `passed: true` here, but its purpose is regression-prevention: a future run on a richer source must not silently invent retention periods. The well-controlled behaviour in this sample is exactly what the validator should reward.

**`compliance_signal_completeness` (LLM).** Detects high-salience compliance hooks in the source that are *not* surfaced anywhere in the response (neither as CONSTRAINT nor as OPEN_QUESTION). Hook list:

| Source pattern | Expected surfacing |
|----------------|--------------------|
| HOA / Homeowners Association / CC&Rs / Bylaws / Resale packet / Reserve Study | OPEN_QUESTION asking which state HOA regime applies |
| W-9 / 1099 / vendor tax data | CONSTRAINT (IRS reporting) or OPEN_QUESTION |
| Payment / Stripe / Square / card / ACH | OPEN_QUESTION on PCI scope |
| Signature / e-signature / signed | OPEN_QUESTION on ESIGN / UETA / state notarization |
| Audit log / immutable / append-only / version history / ledger | CONSTRAINT (auditability) |
| Multi-tenant / RLS / tenant isolation | OPEN_QUESTION on SOC 2 / ISO 27001 cross-cite (or explicit deferral to 1.0c) |
| Data residency / region / "data must stay in" / cross-border | OPEN_QUESTION on residency regime |
| Voting / minutes / resolutions / hearings / fines | CONSTRAINT (governance audit trail) |
| GDPR / HIPAA / CCPA / FERPA / SOX / PCI / SOC2 / NIST / ISO / WCAG / FedRAMP | CONSTRAINT or DECISION (regime is named) |

This is a *positive-completeness* validator: it complains about *absence* rather than incorrect *presence*. Severity is MEDIUM by default, HIGH when the missed hook is named explicitly in the source (e.g., "W-9 / 1099" — explicit IRS hook missed entirely is a HIGH defect).

### 3.3 Reused validators — role-specific configuration

**`open_question_vs_decided` (reuse).** Sample 03 §4.6's structure carries unchanged. For 1.0d the configuration narrows in two ways:

- The threshold-detection regex is broadened to retention-specific shapes ("X years", "X months", "in perpetuity", "indefinitely", "until purged").
- The "release-shape vocabulary" check ("MVP", "v1.0") is dropped; not relevant here.

**`external_reference_handling` (reuse).** Same logic as sample 03 §4.5. Fires on this sample with severity LOW (the agent did not absorb ServiceTitan/Vantaca compliance content; the only finding is "comparison_not_surfaced as DECISION/OPEN_QUESTION").

**`reasoning_to_response_faithfulness` (reuse).** This sample provides the most surgical instance of the failure mode yet seen across samples 01–04: the agent's thinking chain explicitly resolves the embedded-quote rule (`"I will use single quotes for any quotes inside the text string"`) and then transcribes a verbatim source pair as straight `"` in the seventh item. Markers for this role:

- "I will use single quotes" / "I will escape" / "use straight ASCII" pivots that are then violated in the response.
- "Skip" / "not capture" / "exclude this" adjudications that are then committed anyway.
- "Open Question" identifications in the thinking that do not produce a corresponding `OPEN_QUESTION` array entry.
- "Wait, that is in the JSON Output Contract Example, not the source text!" (verbatim from this sample) — followed by *correct* exclusion. The validator should reward this — it is a clear instance of the agent self-correcting against a hallucination risk and the response respecting that correction.

---

## 4. Validator prompt templates

### 4.1 `contract_schema_compliance` (deterministic)

Pseudocode:

```ts
function validateComplianceContract(r: ComplianceResponse): Finding[] {
  // 1. JSON parseable. Specifically: every string value parses
  //    with no unescaped internal double quotes.
  // 2. Top-level: { kind: "compliance_retention_discovery",
  //                  complianceExtractedItems: [...] }.
  // 3. Each item: { id, type, text, timestamp, source_ref }.
  // 4. type ∈ {CONSTRAINT, DECISION, REQUIREMENT, OPEN_QUESTION}.
  // 5. id matches /^COMP-[A-Z0-9_-]+$/.
  // 6. ids unique within the array (with -2/-3 suffix disambiguation honoured).
  // 7. timestamp parses as ISO 8601 UTC.
  // 8. source_ref has { document_path, section_heading, excerpt }.
  // 9. excerpt is a non-empty substring (after markdown-strip) of the
  //    source content at document_path; no paraphrase.
  // 10. section_heading does not include leading "#" or surrounding "**"
  //     emphasis markers (heading text only).
  // 11. No markdown fences; no trailing prose.
}
```

The JSON-parse step catches §1.4 deterministically. The substring step catches paraphrase-as-excerpt defects deterministically.

### 4.2 `extraction_id_traceability_compliance` (deterministic)

Same finding shape as §4.1 with `validator: "extraction_id_traceability_compliance"`. Cheaper than the discovery version because there is only one array; no inter-array reference graph to walk. Checks:

- `COMP-` prefix.
- Within-array uniqueness, with deterministic `-2`/`-3` disambiguation when the slug stem repeats.
- (Optional) reasonable slug semantics — the slug stem should be a recognisable regime / obligation token, not a running number. This is a soft check; emit at LOW severity.

### 4.3 `grounding_compliance` (LLM) — parameter-variation of sample 03 §4.3

Reuse sample 03's `grounding_discovery` template. Diff:

- `[IN-SCOPE]` becomes `complianceExtractedItems[].text`, `.source_ref.excerpt` (vs. the source span at `.source_ref.document_path` / `.section_heading`), and the implicit type-claim of each item.
- `[CRITICAL CASES]` rewritten:

  > "- An item whose `text` paraphrases a source span by *adding* obligation language (e.g., source says 'Statutory deadlines' as a domain bullet; item text says 'The system must comply with statutory deadlines') is PARTIALLY_SUPPORTED at minimum, UNSUPPORTED if the type is CONSTRAINT and the source span does not attest an obligation.
  > - An item whose `text` paraphrases an architectural / durability / isolation / security statement as a retention or audit obligation (without a regulatory anchor in the source) is UNSUPPORTED.
  > - An item naming a regime / standard / law that the source does not name is UNSUPPORTED — see also `regime_citation_validity` for stronger handling of this case.
  > - An item embedding a numeric retention period not present in the cited source span is UNSUPPORTED — see also `retention_threshold_grounding`."

Severity rule unchanged from sample 03: HIGH for contradicted, MEDIUM for partially_supported with material specificity added, LOW for incidental detail.

### 4.4 `scope_boundary_adherence_compliance` (LLM, parameter-variation)

```text
[MISSION]
Confirm that every extracted item belongs to the COMPLIANCE / RETENTION
layer assigned to this discovery pass, and not to one of the four
sibling passes.

[POSITIVE LIST FOR THIS PASS]
A compliance/retention extraction is in-scope when the cited source
span attests one of:
  (a) a named regulatory regime, statute, standard, or framework;
  (b) a stated retention period, rule, or schedule;
  (c) a stated audit, audit-trail, or auditability obligation;
  (d) a stated jurisdictional constraint (residency, sovereignty);
  (e) a stated notice, consent, or disclosure obligation;
  (f) a pre-made compliance-framework commitment (DECISION).

A bare domain label or capability bullet ("Statutory deadlines",
"Notice requirements", "Voting rules") is NOT sufficient evidence
for a CONSTRAINT extraction. Such a span supports at most:
  - a DECISION ("the product will operate a compliance domain that
    handles X"), AND/OR
  - one or more OPEN_QUESTION items recording the unspecified content
    (which jurisdiction's deadlines, which form of notice, etc.).

[LAYER ASSIGNMENT — verbatim from the agent's system prompt]
- Sibling 1.0b Product Intent Discovery: vision, personas, journeys,
  product-scope decisions, business-level requirements.
- Sibling 1.0c Technical Constraints Discovery: stated technical stack,
  infrastructure, security models, deployment constraints, durability
  posture, multi-tenant isolation mechanisms.
- Sibling 1.0e V&V Requirements Discovery: measurable performance /
  availability / reliability targets with threshold + measurement.
- Sibling 1.0f Canonical Vocabulary Discovery: domain-specific terms +
  definitions.

[IN-SCOPE]
- Every item in complianceExtractedItems[].

[OUT OF SCOPE]
- Whether the item is grounded in the source (covered by grounding_compliance).
- Whether the item names a regime correctly (covered by regime_citation_validity).
- Whether a retention threshold has source support (covered by retention_threshold_grounding).
- Whether high-salience source signals were missed (covered by compliance_signal_completeness).

[DECISION STANDARD — example drift cases]
- "property data and governance history must remain persistent and
  isolated" extracted as a retention CONSTRAINT → drift_to_1_0c
  (architectural durability; no regulatory anchor).
- "Auditable, compliant GL structure" extracted as a compliance
  CONSTRAINT → defensible (auditability is on this pass's positive
  list); flag only if the cited source span is in a non-Compliance
  domain section AND no regulatory anchor exists.
- "must respond within 5 business days" → drift_to_1_0e (threshold +
  measurement).
- "RLS-enforced multi-tenant isolation" → drift_to_1_0c (security model).
- "Action Item means a tracked task" → drift_to_1_0f (vocabulary).
- A persona, journey, or success-metric description appearing as a
  complianceExtractedItem → drift_to_1_0b.

A paraphrase that strips the technical implementation but preserves
the technical commitment is still a 1.0c item.

[SEVERITY GUIDE]
- HIGH: an architectural-durability or security-posture sentence
  paraphrased as a retention or audit CONSTRAINT (drift_to_1_0c into
  this pass).
- HIGH: a 1.0e threshold-bearing item committed here without a
  regulatory anchor.
- MEDIUM: a CDM domain header committed as a CONSTRAINT instead of as
  a DECISION + OPEN_QUESTION pair (positive-list violation).
- MEDIUM: a vocabulary definition committed as a DECISION.
- LOW: a borderline auditability item where the source span is
  ambiguous between business-policy and regulatory framing.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "scope_boundary_adherence_compliance",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "drift_to_1_0b_product" | "drift_to_1_0c_technical"
            | "drift_to_1_0e_vv" | "drift_to_1_0f_vocabulary"
            | "positive_list_violation" | "borderline_ambiguous",
      "fieldPath": "complianceExtractedItems[6]",
      "itemId": "COMP-PERSISTENT-RETENTION",
      "itemText": "exact item text",
      "siblingPass": "1.0b | 1.0c | 1.0e | 1.0f | (this pass — positive list)",
      "siblingPassEvidence": "why this item is naturally that sibling's extraction (or, for positive-list violations, why the source span is insufficient evidence for the claimed type)",
      "detail": "...",
      "recommendation": "Remove from this pass; sibling pass will capture; OR retype as DECISION + paired OPEN_QUESTION."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.5 `regime_citation_validity` (LLM, NEW)

```text
[MISSION]
Confirm that every regulatory regime, statute, standard, or framework
named in the response is named in the source, and that source-named
regimes are extracted.

[IN-SCOPE]
- complianceExtractedItems[].id, .text, .source_ref.excerpt: scan for
  named regimes (GDPR, HIPAA, CCPA, FERPA, SOX, SOC2, PCI-DSS, NIST,
  ISO 27001, WCAG, FedRAMP, GAAP, ESIGN, UETA, Davis-Stirling Act,
  Florida Chapter 718/720, Virginia POA Act, Texas Property Code,
  state-specific HOA statutes by name, etc.) AND regime-specific
  language ("right to erasure", "data subject access request",
  "qualifying disclosure", "resale packet", etc.).
- The source content at the cited document_path: scan for the same.

[DECISION STANDARD]
- A finding is valid when the response names a regime that does not
  appear in the source (regime_hallucination).
- A finding is valid when the response uses regime-specific obligation
  language without a source-attested anchor for that regime
  (regime_specific_language_unanchored).
- A finding is valid when the source explicitly names a regime
  (e.g., "HIPAA", "Davis-Stirling") and the response does not extract
  it (named_regime_not_extracted).

[SEVERITY GUIDE]
- HIGH: regime_hallucination (response names a regime not in source).
- HIGH: named_regime_not_extracted (source names a regime; response
  silent).
- MEDIUM: regime_specific_language_unanchored (e.g., "right to be
  forgotten" without a source-attested GDPR anchor).
- LOW: minor terminology inflation that does not assert a regime.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "regime_citation_validity",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "regime_hallucination" | "named_regime_not_extracted"
            | "regime_specific_language_unanchored",
      "regimeName": "GDPR | HIPAA | ... | (source-named string)",
      "fieldPath": "complianceExtractedItems[N].text | (source-only)",
      "claim": "exact span",
      "sourceEvidence": [
        {"sourceSpan": "...", "relationship": "supports|contradicts|absent"}
      ],
      "detail": "...",
      "recommendation": "Remove the regime claim, or extract the source-named regime, or weaken the language."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.6 `retention_threshold_grounding` (LLM, NEW)

```text
[MISSION]
Confirm that every numeric or quasi-numeric retention period in the
response is verbatim attested in the cited source span, and that
source-stated retention periods are extracted with their numeric
value preserved.

[IN-SCOPE]
- complianceExtractedItems[].text and .source_ref.excerpt: scan for
  retention-period language: "X years", "X months", "X days", "in
  perpetuity", "indefinitely", "until purged", "until termination",
  "for the life of the contract".
- Source content at document_path: scan for the same.

[DECISION STANDARD]
- A finding is valid when an item embeds a numeric retention period
  that is NOT present in the cited source span
  (retention_threshold_invented).
- A finding is valid when the source states a numeric retention
  period and the response either omits it (retention_threshold_dropped)
  or paraphrases it qualitatively
  (retention_threshold_qualitatively_diluted, e.g., "X years" → "long-term").

[SEVERITY GUIDE]
- HIGH: retention_threshold_invented (a number appears that the source
  does not state).
- HIGH: retention_threshold_dropped (source states a number; response
  omits the number).
- MEDIUM: retention_threshold_qualitatively_diluted (source states a
  number; response keeps the obligation but loses the number).
- LOW: minor unit / phrasing differences that preserve the value
  (e.g., "365 days" vs "1 year" — flag only if the contract requires
  verbatim quoting).

[INPUTS, OUTPUT CONTRACT — same shape as §4.5]
```

### 4.7 `compliance_signal_completeness` (LLM, NEW)

```text
[MISSION]
Confirm that high-salience compliance hooks named in the source are
surfaced somewhere in the response — either as a CONSTRAINT (when the
source attests the obligation) or as an OPEN_QUESTION (when the
source attests only the hook).

[IN-SCOPE]
The source content at the document_path(s) cited by the discovery
pass. Scan for hooks (case-insensitive, word-boundary):

  Category               | Hook tokens
  ---------------------- | ---------------------------------------------
  HOA / state-HOA-law    | HOA, Homeowners Association, CC&R, Bylaws,
                         | Resale packet, Reserve Study, Davis-Stirling,
                         | POA Act, Chapter 718, Chapter 720
  Tax info-reporting     | W-9, 1099, vendor tax
  Payment / PCI          | Stripe, Square, card, ACH, payment capture,
                         | credit card, tokenization
  E-signature            | signature, e-signature, signed, notarized
  Audit-trail / immutable| audit log, immutable, append-only,
                         | version history, ledger, trust ledger
  Multi-tenant / isolation| RLS, multi-tenant, tenant isolation,
                         | row-level security
  Data residency         | data residency, data must stay, region,
                         | cross-border, sovereignty
  Governance audit-trail | voting, minutes, resolutions, hearings,
                         | fines, board meetings, statutory deadlines
  Named regimes          | GDPR, HIPAA, CCPA, FERPA, SOX, SOC2, PCI-DSS,
                         | NIST, ISO 27001, WCAG, FedRAMP, GAAP, ESIGN, UETA

For each hook found in the source, check whether the response surfaces
it (in any complianceExtractedItem's text or source_ref.excerpt).

[OUT OF SCOPE]
- Whether the response's surfacing is correctly typed (covered by
  scope_boundary_adherence_compliance and grounding_compliance).
- Whether the response invents regimes not in the source (covered by
  regime_citation_validity).

[DECISION STANDARD]
A finding is valid when a source hook is present AND no
complianceExtractedItem references the hook (semantically, not just
verbatim).

[SEVERITY GUIDE]
- HIGH: a named regime hook in the source is entirely missing (e.g.,
  "W-9 / 1099" present in source, no item references IRS or 1099).
- HIGH: a payment / PCI hook present, no item references payment-card
  scope.
- MEDIUM: an HOA jurisdiction hook present, no OPEN_QUESTION on state
  HOA law.
- MEDIUM: an audit-trail / immutability hook present (Hearings,
  Voting, Trust Ledger), no item on auditability beyond the GL.
- LOW: a borderline hook (e.g., generic "signed" without "signature
  block" or e-signature framing) not surfaced.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "compliance_signal_completeness",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "regime_hook_missed" | "obligation_hook_missed"
            | "open_question_hook_missed",
      "category": "HOA | Tax | Payment/PCI | E-signature | Audit-trail | Multi-tenant | Residency | Governance | NamedRegime",
      "sourceHook": "exact source token / span",
      "sourceLocation": "document_path:section",
      "expectedSurfacing": "CONSTRAINT|OPEN_QUESTION|DECISION|either",
      "detail": "...",
      "recommendation": "Add an OPEN_QUESTION asking which jurisdiction/regime applies, or extract as CONSTRAINT if the source is sufficiently explicit."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.8 `open_question_vs_decided` — exact reuse

Sample 03 §4.6 unchanged. Configuration narrowing:

- Threshold-detection regex extended with retention shapes ("in perpetuity", "indefinitely", "X years", "X months", "X days", "until purged").
- "Release-shape vocabulary" clause dropped (irrelevant for compliance).
- Cross-array semantic-similarity check is over `complianceExtractedItems[]` partitioned by `type`, not over `decisions` / `openQuestions` / `requirements` / `constraints` arrays as in sample 03. The pairwise comparison is therefore between every `OPEN_QUESTION`-typed item and every `CONSTRAINT`/`DECISION`/`REQUIREMENT`-typed item.

### 4.9 `external_reference_handling` — exact reuse

Sample 03 §4.5 unchanged. On this sample the validator's expected output is a LOW finding under `comparison_not_surfaced`: the agent correctly avoided absorbing ServiceTitan / Vantaca compliance content but did not record the scope-shape commitment as a `DECISION` or open the inheritance questions.

### 4.10 `reasoning_to_response_faithfulness` — exact reuse

Cross-role validator from sample 01 §4.6. Role-specific markers for compliance:

- "I will use single quotes" / "I will escape" rule-commitment statements that are violated in the response (the §1.4 defect).
- "Skip" / "exclude this item" / "stick to the explicit Hestami requirements" adjudications that drop ServiceTitan/Vantaca compliance content (positive — the response should respect them, and this sample does).
- "Open Question" identifications in the thinking that do not produce a corresponding `OPEN_QUESTION` item (the §1.8 defect, viewed from the reasoning side).
- "Wait, that is in the JSON Output Contract Example, not the source text!" — *positive* marker. The validator should flag responses that fail to self-correct against this kind of prompt-leakage.

Severity unchanged from sample 03 §4.7.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_compliance` | yes (deterministic) | `agent_role == "domain_interpreter" && sub_phase == "compliance_retention_discovery"` |
| `extraction_id_traceability_compliance` | yes (deterministic) | same; only if contract passed |
| `grounding_compliance` | yes (LLM) | same; skip if contract failed |
| `scope_boundary_adherence_compliance` | yes (LLM) | same; skip if contract failed |
| `regime_citation_validity` | yes (LLM) | same; skip if contract failed |
| `retention_threshold_grounding` | yes (LLM) | same; skip if contract failed |
| `compliance_signal_completeness` | yes (LLM) | same; skip if contract failed |
| `open_question_vs_decided` | yes (LLM) | same; skip if contract failed |
| `external_reference_handling` | conditional | fires when source contains explicit external-product references |
| `reasoning_to_response_faithfulness` | conditional | fires only when `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_compliance              (deterministic, gate)
2. extraction_id_traceability_compliance   (deterministic)
3. grounding_compliance                    (LLM)
4. regime_citation_validity                (LLM)
5. retention_threshold_grounding           (LLM)
6. scope_boundary_adherence_compliance     (LLM)
7. compliance_signal_completeness          (LLM)
8. open_question_vs_decided                (LLM)
9. external_reference_handling             (LLM, conditional)
10. reasoning_to_response_faithfulness     (LLM, conditional)
11. final_synthesis                        (LLM, unchanged)
```

`grounding_compliance` runs before `regime_citation_validity` and `retention_threshold_grounding` because the latter two are sharper, narrower variants — if grounding rejects an item wholesale, the regime / threshold checks can still fire on its specific axes but the deduplication step (§5.4) treats the grounding finding as primary. `scope_boundary_adherence_compliance` runs after the grounding triad because its judgements depend on the items being source-attested in *some* form. `compliance_signal_completeness` runs after scope boundary because its expected-surfacing recommendations depend on layer-correctness (a hook absorbed under the wrong type is technically present but operationally missed — the validator treats wrong-typed surfacing as "absent" with severity downgraded).

### 5.2 Deterministic vs LLM split

- **Deterministic:** `contract_schema_compliance` (catches §1.4 — the unescaped-quote JSON failure — without LLM tokens), `extraction_id_traceability_compliance`. Note that the verbatim-excerpt check in §4.1 step 9 is a *substring* match after markdown-strip; if the source content is large, this is still a fast deterministic operation.
- **LLM:** the remaining six. Each addresses a semantic dimension that cannot be reduced to substring or regex.

### 5.3 Integration with the cross-role validators and sample 03's pipeline

- `contract_schema_*` registry pattern reinforced; this is the third role-keyed entry.
- `grounding_*` reinforced; per-pass narrowing is mechanical.
- `scope_boundary_adherence_*` confirmed as a cross-discovery family. Sample 03 introduced it; sample 04 stress-tests the parameterisation. Verdict (§3.1): the family works with one additive clause (`POSITIVE LIST FOR THIS PASS`) that is needed because compliance extraction has a stricter evidence threshold than product extraction. Recommend the validator implementation accept `current_pass_id` + `positive_list` + `sibling_layer_table` as parameters; instantiate four times for 1.0b/c/d/e.
- `external_reference_handling`, `open_question_vs_decided`, `reasoning_to_response_faithfulness` reuse cleanly, no role-specific redesign.
- `regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness` are role-specific to compliance and do not generalise beyond 1.0d (and possibly 1.0e for `*_threshold_grounding` if numeric V&V thresholds need a parallel groundedness check — that is a sample-05 question).

### 5.4 Cross-validator deduplication

Five overlap pairs to manage in `final_synthesis`:

- `grounding_compliance` (UNSUPPORTED) and `scope_boundary_adherence_compliance` (drift) on a sibling-layer item that is also ungrounded. Treat boundary as primary.
- `grounding_compliance` (UNSUPPORTED) and `regime_citation_validity` (regime_hallucination) on the same regime-naming item. Treat regime_citation as primary (more specific channel).
- `grounding_compliance` (UNSUPPORTED, embedded threshold) and `retention_threshold_grounding` (threshold_invented). Treat retention_threshold_grounding as primary.
- `compliance_signal_completeness` (regime_hook_missed) and `regime_citation_validity` (named_regime_not_extracted). The former scans the source for hooks; the latter specifically tracks named regimes. When both fire on the same regime, treat regime_citation as primary; signal_completeness's finding becomes corroboration. The hook list in §4.7 is a superset of named regimes plus obligation hooks, so signal_completeness will still produce its own findings on the obligation-hook subset.
- `open_question_vs_decided` (open_question_answered_by_decision) and `reasoning_to_response_faithfulness` (open-question-as-decision). Independent: response-level vs reasoning-trace-level.

### 5.5 Cross-role validator promotion hypotheses

- `scope_boundary_adherence_*`: promoted to a cross-discovery family with parameterised positive + negative lists. Two of four passes (1.0b, 1.0d) covered; expect 1.0c (technical) and 1.0e (V&V) to instantiate the family with their own parameter rotations. 1.0f (vocabulary) likely needs a different shape.
- `regime_citation_validity`: stays role-specific to 1.0d.
- `retention_threshold_grounding`: stays role-specific to 1.0d, but the *technique* (verbatim numeric grounding against a cited source span) generalises to 1.0e (V&V threshold grounding) and possibly to FR/NFR decomposition (the original "introduced new thresholds without grounding" defect from `redesign recommendations - 1.md`). Recommend factoring the verbatim-numeric-grounding check into a reusable sub-routine; instantiate per-pass with different threshold-shape regexes.
- `compliance_signal_completeness`: stays role-specific. The hook list is compliance-specific.

---

## 6. Notes and open questions

1. **The agent's restraint on regime hallucination is genuinely good and should be measured, not just commented on.** This sample is a useful regression-test fixture: the agent was given a source with zero named regimes and produced zero invented regimes. A future agent change (different model, different prompt, different temperature) that *introduces* a regime claim on this fixture is a clear regression. Recommend adding this sample to the validator-development test suite with an expected-output of "no `regime_citation_validity` HIGH findings". Same for `retention_threshold_grounding` — the sample is a "no thresholds invented" baseline.

2. **The empty `OPEN_QUESTION` channel is the single most actionable defect.** Of all the defects catalogued in §1, the absence of `OPEN_QUESTION` items is the one with the largest downstream impact: Phase 5 retention wiring, Phase 7 test planning, and Phase 8 evaluation design *all* read this pass to decide whether to defer compliance-related work to user clarification. A response with zero open questions tells those phases "compliance is settled" — which is the opposite of true on this source. The `compliance_signal_completeness` validator (§4.7) is therefore the most important new validator to deploy for this role; it specifically rewards open-question surfacing.

3. **The unescaped-quote JSON defect is mechanical but consequential.** The reviewer accepting an unparseable response as "highly accurate, methodical" indicates that the gemma4:e4b reviewer is not parsing the response it reviews. A trivial deterministic JSON-parse step in `contract_schema_compliance` removes this entire failure mode at zero LLM cost. Recommend deploying this validator before any LLM-validator tuning.

4. **CDM-domain-header inflation is a structural risk for any extraction pass that reads a domain model.** The Hestami spec organises content by CDM domains; each domain has bullet sub-areas. The agent's failure mode (treating sub-area labels as obligation statements) will recur on 1.0c (treating "DBOS versioned workflows" as a technical CONSTRAINT when it is a domain-area label), 1.0e (treating "SLA Timers" as a measurable threshold when it is a domain-area label), and 1.0f (treating "ARC Request" as a vocabulary definition when only the term is named, not the definition). Recommend the parameterised `scope_boundary_adherence_*` validator's positive-list clause encode this asymmetry uniformly: a domain header / capability label is evidence for a `DECISION` (the product will operate this domain) plus paired `OPEN_QUESTION`s, *not* evidence for a CONSTRAINT or threshold.

5. **`retention_threshold_grounding` is a pleasant negative-result validator.** On this sample it should emit `passed: true`. Its function is not to find defects in the current sample but to prevent regression. Operationally: treat `passed: true` from this validator as a positive signal in the synthesis layer — "this sample exercised the threshold-restraint behaviour correctly". Most validators only signal absence-of-defect; this one specifically rewards a behaviour the agent is otherwise prone to violate.

6. **Compliance extraction needs a coordination signal with 1.1b (scope/compliance context).** The prompt notes that 1.0d's output flows into Phase 1.1b. None of the validators here check whether the extracted items are *useful* to 1.1b (do they form a coherent compliance posture? do they cover the jurisdictions implied by the product's geographic scope?). That is a downstream-coherence concern, parallel to sample 03 §6.6's note about `analysisSummary` coordination with IQC. Deferred — the cross-pass coordination design is out of scope for the per-role validator pipeline.

7. **The reviewer claimed compliance with the JSON contract while the contract was violated.** This is the third reviewer instance (samples 01, 03, 04) where the gemma4 reviewer's `overall_assessment` makes a *positive factual assertion* about the agent's output that the output contradicts. The pattern is consistent enough to be an emergent failure mode of small-model reviewing, not just under-sensitivity. Recommend `final_synthesis` cross-check the textual `overall_assessment` of any LLM validator against its `findings` list and the deterministic validators' findings — if the assessment claims compliance with a constraint that a deterministic validator rejected, raise an inconsistency finding on the validator itself.

8. **Sample 04 closes the parameterisation question for the `scope_boundary_adherence_*` family.** Two passes (1.0b product, 1.0d compliance) with opposing drift directions and one shared structural defect (CDM-domain-bullet inflation) confirm that a single parameterised validator can serve the family. Samples 05 (1.0e V&V) and 06 (1.0c technical) will further constrain the parameter shape. The current recommendation — `current_pass_id` + `positive_list` + `sibling_layer_table` — is sufficient for both samples seen so far; sample 05 is likely to add a fourth parameter (`measurement_grounding_table`) for the V&V pass's threshold-pair requirement.
