# Assessment: domain_interpreter / product_description_synthesis (Phase 1.11)

**Sample:** `track_c_samples/07_domain_interpreter__product_description_synthesis.md`
**Reviewed agent:** `domain_interpreter` running `qwen3.5:9b` (2.6 KB JSON response, 18 KB thinking chain — the smallest output of the corpus so far)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

This is the corpus's first **synthesis pass**, and it inverts the size-to-stakes ratio of the prior six samples. Where the bloom outputs (samples 05, 06) were 30+ KB of breadth-first proposals each carrying narrow weight downstream, this output is 2.6 KB of compressed narrative whose four fields (`productVision`, `productDescription`, `summary`, `openLoops`) feed every Phase 2–9 consumer that ever asks "what is this product?". Compression is the *point* of the artefact, not a side-effect.

The reviewer fired `has_concerns: false` with an empty `concerns` array and the assessment "the reasoning is sound, the output is highly structured, and the content accurately synthesizes the provided seed material and bloom summary into the required format." On a synthesis pass that visibly drops persona breadth, collapses the 14-domain map to a 3-pillar slogan, and omits the trust-ledger / audit / retention story that the bloom rounds spent four prune iterations earning, a `0 findings` outcome is the wrong shape of answer. The reviewer is reading the response as if it were a bloom (looking for unsupported claims, fragile coupling, contradictions in reasoning) when it should be reading it as a compression (looking for what was dropped, what was added, and what was silently decided).

The role-specific implication: synthesis-class validators differ qualitatively from bloom-class validators. Bloom validators ask "is each emitted item grounded?" and "does coverage extend everywhere it should?". Synthesis validators ask "did the substrate survive compression?" and "did anything *appear* during compression that wasn't there before?". The defect axis rotates from over-breadth/over-claim toward under-coverage and silent-decision.

### 1a. Defects in the agent's response

#### 1a.1 Persona coverage drops 5 of 9 substrate personas silently

The bloom summary lists nine personas:

> Personas (9): P-HOMEOWNER Homeowner; P-INVESTOR Property Investor; P-PROVIDER Service Provider; P-CAM-MANAGER Community Association Manager; P-BOARD Board Member; P-ADMIN Platform Administrator; P-TENANT Tenant; P-FINANCE-OFFICER Financial Officer; P-AUDITOR Third Party Auditor

The narrative emits only four:

> "connecting property owners, investors, contractors, and community boards"
> "Users ranging from homeowners to financial officers"

P-HOMEOWNER, P-INVESTOR, P-PROVIDER, and P-BOARD survive. P-CAM-MANAGER survives implicitly under "community associations". **P-TENANT, P-AUDITOR, P-ADMIN, P-FINANCE-OFFICER are absent or only used as a vague range endpoint** ("homeowners to financial officers" treats P-FINANCE-OFFICER as a scale-marker rather than a named user). This matters because:

- P-TENANT is the persona behind `UJ-REPORT-TENANT-ISSUE` — a journey the bloom round explicitly accepted. Tenant-vs-homeowner is a load-bearing distinction in the product (the routing to landlord-not-vendor differs).
- P-AUDITOR is the persona behind `UJ-EXPORT-AUDIT-REPORT` and is the primary user of the trust-ledger surface. Dropping the auditor narrative-side erases the product's audit-first selling point.
- P-FINANCE-OFFICER and P-BOARD differentiate the CAM pillar's user surface from the simpler "HOA management" framing.

The agent's thinking chain enumerates the personas faithfully ("9 specific roles (Homeowner, Investor, Provider, CAM Manager, Board, Admin, Tenant, Finance, Auditor)") then drafts the description and never references the enumeration during compression. The dropouts are not deliberate; they are inattentive. **MEDIUM severity** as a coverage defect; **HIGH severity** if any downstream Phase 2–9 consumer treats the productDescription as the canonical persona surface.

#### 1a.2 Domain map compresses 14 domains into 3 pillars and silently elides the trust-ledger / audit / retention story

The bloom summary lists fourteen domains:

> Business Domains (14): DOM-PROPERTY; DOM-MAINTENANCE; DOM-VENDOR; DOM-FINANCE; DOM-GOVERNANCE; DOM-JOB; DOM-BID; DOM-COMPLIANCE; DOM-LEDGER Trust Ledger & Audit Trails; DOM-COMM; DOM-IDENTITY; DOM-AI-ENG; DOM-COMMUNITIES; DOM-AUDIT Internal Oversight & Administration

The productDescription:

> "Hestami AI stands as an AI-native operating system that integrates Home Real Property Assistant, Service Provider Field Services Management, and Community Association Management pillars into a unified ecosystem. The platform enables property owners, investors, and contractors to exchange digital assets securely while managing maintenance workflows, financial ledgers, and governance compliance autonomously."

Three pillars survive (matching the seed). Inside the pillars, "maintenance workflows" gestures at DOM-MAINTENANCE; "financial ledgers" gestures at DOM-FINANCE; "governance compliance" gestures at DOM-GOVERNANCE + DOM-COMPLIANCE. **Absent or invisible:** DOM-VENDOR (vendor discovery & vetting — a major user surface), DOM-BID (bid management — distinct from maintenance), DOM-LEDGER (the *trust ledger* — explicitly named as a separate domain from DOM-FINANCE precisely because it is the audit-and-immutability layer), DOM-AUDIT (internal oversight), DOM-IDENTITY (security & identity), DOM-COMM (communication channels), DOM-AI-ENG (the AI engine itself, treated as a distinct domain), DOM-COMMUNITIES (external sync), DOM-JOB (field operations — overlaps with the FSM pillar but has distinct workflows).

The 14→3 compression is the prompt-mandated shape. The defect is not the compression itself; it is that the four-round prune that produced the 14 domains explicitly preserved DOM-LEDGER, DOM-AUDIT, and DOM-COMPLIANCE as *distinct from* DOM-FINANCE and DOM-GOVERNANCE. The bloom rounds earned that distinction. The narrative collapses it back to the seed-level "compliance and financials" framing. **MEDIUM severity** for losing the load-bearing nuance; the trust-ledger story is one of the product's two structural differentiators (the other being the AI matching engine).

#### 1a.3 Quality attributes (20) and integrations (19) are entirely absent from the narrative

The bloom summary cites "Quality Attributes: 20" and "Integrations (19): INT-IDP-AUTH; INT-WAF-CDN; INT-KMS-KEYS; INT-STORAGE-IMG; INT-ADDR-GEO; INT-EMAIL-SMS; INT-PAYMENT-GW; INT-BANK-SYNC; INT-VENDOR-REG; INT-DOC-SIGN; INT-AI-LLM; INT-MONITOR-OPS; INT-LOG-SINK; INT-VOTE-SECURE; INT-BILLING-API; INT-LEGAL-DOC; INT-VOICE-LOG; INT-COMMUNITY-CONTEXT; INT-BACKUP-S3".

Several of these are user-facing and product-shape-bearing: INT-DOC-SIGN (e-signature), INT-PAYMENT-GW (payment gateway), INT-VOICE-LOG (voice transcription — a user-experience differentiator), INT-VOTE-SECURE (voting platform — the entire Phase 3 governance pillar runs on this), INT-AI-LLM (the LLM engine itself).

The narrative mentions none of them. The summary's "AI-driven intelligence" is the only allusion to INT-AI-LLM / DOM-AI-ENG. Voice, e-signature, and secure voting — three concrete user surfaces the bloom committed to — are silently absent from the strangers-could-understand-this paragraph that downstream consumers will treat as canonical.

**LOW–MEDIUM severity.** The narrative-form constraint legitimately excludes integration enumeration; the defect is the absence of *any* gesture toward the platform's integration breadth. A single sentence ("integrates with payment, e-signature, voting, and voice-capture services to round out the workflows") would carry that nuance forward.

#### 1a.4 The vision narrows scope from "matches owners with providers and community associations" to "ecosystem of all three"

Seed vision:

> "the AI-native operating system that seamlessly matches property owners with service providers and community associations"

Refined vision:

> "the definitive AI-native operating system that unifies property owners, service providers, and community associations into a single frictionless ecosystem driven by digital asset exchange and autonomous governance workflows"

The semantic shift is subtle but real. "Matches owners with providers and community associations" is a *brokerage* framing (the platform's job is to connect parties). "Unifies … into a single frictionless ecosystem" is an *integration* framing (the platform's job is to be a unified surface). The two framings are not the same product:

- Brokerage implies the parties exist outside the platform and the platform's value is matching.
- Integration implies the parties live inside the platform and the platform's value is the unified surface.

Hestami AI is closer to integration than pure brokerage, so the shift is not strictly wrong, but it is a *decision* the synthesis made silently. The seed vision's brokerage framing is the substrate; the response's integration framing is a refinement that ought to be flagged. The thinking chain does not record the choice; it just emits the refined sentence.

**LOW severity** as fabrication; **MEDIUM severity** as a silent product-shape decision embedded in the canonical artefact.

Additional small-amplitude reframings in the same field:

- "definitive" amplifies the seed's neutral framing.
- "autonomous governance workflows" narrows the seed's "autonomous workflows" to a specific subset; the bloom's WF-* list contains 15 workflows of which only WF-GOVERNANCE-EXECUTION is governance-shaped. Calling the autonomy "governance" is an inversion (governance is a small subset of the autonomy story, not its centerpiece).

#### 1a.5 The summary fabricates a phrase ("digital nervous system") not present in the substrate

> "The Hestami AI Real Property OS serves as a unified digital nervous system…"

"Digital nervous system" appears nowhere in the seed vision, seed description, seed summary, or bloom summary. It is a synthesis-time invention. The metaphor is not harmful — it is consistent with the platform's product shape — but a synthesis pass should not introduce new framings without substrate support. A reviewer looking for fabrication-during-compression would catch this; the current reviewer does not.

**LOW severity.** Listed for the record because synthesis-class fabrications tend to come in this register: small metaphor amplifications that look stylistically improved but are substrate-unsupported.

#### 1a.6 OpenLoops priorities are assigned without rationale and one category is forced

The four open questions in the seed:

> Q-1: monetization strategy per pillar
> Q-2: AI autonomy vs human oversight on violations / financial assessments
> Q-3: private vs public listings for vendor matching
> Q-4: service-call lifecycle scope (residential vs commercial within HOA)

Response openLoops:

| Q | category | priority | comment |
|---|----------|----------|---------|
| Q-1 | deferred_decision | medium | OK. |
| Q-2 | unresolved_risk | high | OK. AI autonomy on financial assessments is a genuine risk class. |
| Q-3 | missing_info | medium | Debatable — Q-3 reads more like a `scope` decision than missing information, but `scope` is not in the contract enum (`deferred_decision\|missing_info\|unresolved_risk\|followup`). The agent picked the closest available fit. |
| Q-4 | deferred_decision | medium | The question is literally about scope; the enum forces a `deferred_decision` framing. |

Two issues:

1. **Priorities are introduced from nowhere.** The substrate does not rank the open questions. The agent assigns Q-1=medium, Q-2=high, Q-3=medium, Q-4=medium without recording why. The Q-2=high choice is defensible (regulatory risk on AI autonomy is a real high-impact concern); the others are arbitrary. A synthesis pass that introduces a priority ordering on substrate-unranked items is silently *deciding* something the substrate didn't decide. The fix is either to default all to `medium`, or to record the priority rationale.
2. **The enum forces a category fit on Q-3 and Q-4.** Both are scope-class questions; the enum offers no `scope` value. The right disposition is to flag the enum gap (e.g. emit a `followup` with description "the contract enum lacks a `scope` value; Q-3 and Q-4 are forced into `deferred_decision`/`missing_info` as nearest fits"). The agent does not flag.

**LOW severity** for the priority assignment; **LOW severity** for the enum-fit issue (the contract is the upstream defect).

#### 1a.7 The phasing reference in the summary is consistent with substrate but loses pillar-name fidelity

> "The platform prioritizes a phased rollout starting with residential home assistance before extending capabilities to field service operations and finally full-scale association management."

The seed and bloom both treat the order as Home Assistant → Service Provider FSM → CAM. The summary's order is correct. The pillar names drift slightly: "residential home assistance" (vs "Home Real Property Assistant"), "field service operations" (vs "Service Provider Field Services Management"), "full-scale association management" (vs "Community Association Management"). The drift is minor but it means the summary's pillar names do not match the productDescription's pillar names, which do not match the seed's pillar names — three slightly-different namings in a 2.6 KB artefact.

**LOW severity** as nomenclature drift; **MEDIUM severity** if a downstream consumer pattern-matches on pillar names across the three fields and finds three variants.

#### 1a.8 No "umbrella" / "this was deliberately compressed" disclosure

Synthesis is compression. The 9 personas → 4 named, the 14 domains → 3 pillars, the 19 integrations → ø, the 20 quality attributes → ø, the 27 journeys → vague workflow gestures — all of these are compression decisions, and not all of them are recoverable from the response alone. A downstream consumer reading the productDescription has no signal that:

- five personas were dropped from the narrative;
- three audit/ledger/identity domains were collapsed into "governance compliance";
- twenty quality attributes are not mentioned.

The contract does not provide a `compressionNotes` or `omittedFromNarrative` field, so the agent has nowhere to record this. The defect is therefore *contract-level*, not agent-level: the synthesis contract should expose a "deliberately omitted" field for downstream auditability. The agent's only available compensating action would be to surface omissions as `openLoops` items (e.g. `{ category: "followup", description: "Tenant and auditor personas are not represented in the narrative; confirm with reviewer.", priority: "low" }`). The agent does not.

**LOW severity** as agent-level defect; **MEDIUM severity** as contract-level defect.

#### 1a.9 Open-question resolution discipline — passes

Positive result. The four open questions are all carried forward as openLoops, none silently resolved. The agent's thinking chain documents the reasoning ("All four seem unresolved based on the prompt's instruction to synthesize unresolved items"). This is the discipline the synthesis-class needs and it holds here. Recording for the validator-design baseline.

#### 1a.10 Schema completeness — passes

Positive result. All four required fields are populated with non-trivial content (no placeholders, no empty strings). Sentence counts within stated ranges (vision 1, description 3, summary 5, openLoops 4 items). JSON validity holds. The agent's thinking chain spends ~30% of its tokens on JSON-validity self-checks, which is over-allocated but harmless. Recording for the validator-design baseline.

#### 1a.11 Phasing dependency consistency — passes (vacuously)

The contract offers no phasing field for the synthesis to populate; the phasingStrategy is carried forward verbatim by the deterministic caller. The summary's phase-order mention (Home → FSM → CAM) is consistent with the seed and bloom and therefore vacuously consistent with the substrate. Recording the negative result for the validator-design baseline. (Subsequent synthesis-shaped samples — release_plan synthesis is sample 08 — will exercise this validator non-vacuously.)

### 1b. Reviewer's findings (0 in this sample)

The reviewer returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The agent successfully adhered to all strict formatting constraints (JSON structure, no markdown, no prose, no trailing commas) while refining the narrative content. The reasoning is sound, the output is highly structured, and the content accurately synthesizes the provided seed material and bloom summary into the required format."
}
```

Three observations:

1. **Schema-consistency holds** (`has_concerns=false` and empty `concerns[]` agree). That is a step up from sample 04's `has_concerns=false`-with-non-empty-array structural inconsistency.
2. **The overall assessment is empirically wrong on its strongest claim.** "Accurately synthesizes the provided seed material and bloom summary" is contradicted by §1a.1 (5 of 9 personas missing), §1a.2 (3 distinct ledger/audit/compliance domains collapsed), §1a.3 (integrations and quality attributes entirely absent). The reviewer either did not traverse the bloom summary against the response or did not understand "accurate synthesis" includes coverage of substrate.
3. **Severity calibration is moot at zero findings.** With nothing to calibrate, the reviewer's calibration profile cannot be assessed from this sample alone. But the *structural* calibration — that synthesis defects exist and the reviewer found none — is the worst-case calibration outcome (false negative gate).

### 1c. What the reviewer missed

Mapped to §1a:

**MEDIUM severity — missed:**

- §1a.1 **Persona coverage drop** (5 of 9 substrate personas absent or vague-endpoint).
- §1a.2 **Domain compression dropping the trust-ledger / audit / compliance distinction.**
- §1a.4 **Vision reframing from brokerage to integration.**

**LOW–MEDIUM severity — missed:**

- §1a.3 **Integrations and quality attributes absent from narrative.**
- §1a.7 **Pillar-name drift across the three fields.**

**LOW severity — missed:**

- §1a.5 **"Digital nervous system" fabrication.**
- §1a.6 **OpenLoops priorities introduced without rationale.**
- §1a.8 **No omission/compression disclosure.**

The pattern matches the bloom-class samples: the reviewer's prompt asks for *bloom-class* defects (assumptions stated as fact, fragile coupling, contradictions, edge cases) and the synthesis defects sit in a different register (coverage, fabrication during compression, silent priority assignment, contract-shape gaps). The reviewer did not understand it was reading a synthesis. The current reviewer prompt has no synthesis-aware checks at all.

---

## 2. Diagnosis

The role-specific failure modes for a synthesis pass — distinct from the bloom-class failure modes catalogued in samples 05/06:

1. **Coverage attrition during compression.** Multi-item substrate (9 personas, 14 domains, 19 integrations, 20 quality attributes) compresses to a paragraph; whichever items the agent does not name are silently dropped. The fix is a coverage audit that pairs each substrate set against the narrative and reports which items survived as named, survived as implicit (subsumed under a category), or did not survive.

2. **Fabrication during compression.** Synthesis-time inventions — new metaphors ("digital nervous system"), new framings ("frictionless ecosystem"), amplifying adjectives ("definitive") — appear because the agent is composing prose, not enumerating facts. The fix is a fabrication audit that scans the response for noun phrases not anchored to the substrate.

3. **Silent reframing.** The synthesis can shift the seed's framing (brokerage → integration, autonomy → governance-autonomy) by word choice during composition. The fix is a reframing audit that asks: for each of the seed's 3–5 load-bearing concepts, does the response preserve the framing or substitute a near-synonym whose product-shape implications differ?

4. **Silent priority/rank assignment.** The substrate may not rank items; the synthesis may introduce ranking (priorities on openLoops, "most important pillar", emphasis ordering) without recording the choice. The fix is a priority-introduction audit that flags any rank/priority/ordering field whose values are not derivable from substrate.

5. **Open-question handling.** The synthesis may silently resolve open questions by composing prose that picks one branch, or may forget to carry forward an open question that the substrate left unresolved. The current sample passes both checks, but the validator must exist for the class.

6. **Contract-shape gaps.** When the substrate carries nuance that the contract has no field for (omitted personas, compression notes, scope-class open questions), the agent has nowhere honest to record it and the nuance is silently lost. This is a *contract-design* defect that the reviewer can surface as a meta-finding.

7. **Schema-completeness ritual.** Synthesis contracts often have small field counts and tight word-count ranges, which the agent can satisfy mechanically (the thinking chain in this sample spends extensive tokens on sentence counting). Schema satisfaction is necessary but not sufficient; the reviewer must distinguish "fields populated" from "fields populated meaningfully".

8. **Phasing/release-plan dependency soundness.** Vacuous in this sample (no phasing field); load-bearing in sample 08 (release_plan synthesis). The validator must be defined for the class.

Note the inversion against bloom-class: bloom failure modes are *additive* (over-claim, fabrication of provenance, gratuitous breadth); synthesis failure modes are *subtractive* (under-coverage, silent omission, compression-time fabrication). The two validator families are siblings, not parameter-variations of each other.

---

## 3. Recommended validator pipeline for this role

Eight validators. Two deterministic, six LLM-based. Three are reuses or parameter-variations of validators introduced in samples 03–06; five are synthesis-specific.

| # | Validator | Type | Status |
|---|-----------|------|--------|
| 1 | `contract_schema_synthesis` | deterministic | parameter-variation of the cross-role `contract_schema_*` family |
| 2 | `handoff_field_completeness` | deterministic + LLM | **NEW — synthesis-specific** (meaningful population vs placeholder) |
| 3 | `synthesis_coverage_audit` | LLM | **NEW — synthesis-specific** (substrate→narrative coverage matrix) |
| 4 | `synthesis_fabrication_check` | LLM | **NEW — synthesis-specific** (every narrative claim traces to substrate) |
| 5 | `compression_fidelity_audit` | LLM | **NEW — synthesis-specific** (load-bearing nuance preserved) |
| 6 | `phasing_dependency_consistency` | LLM-or-deterministic | **NEW — synthesis-specific** (vacuous here, load-bearing in 08) |
| 7 | `open_question_resolution_discipline` | LLM | parameter-variation of the cross-role `open_question_vs_decided` |
| 8 | `reasoning_to_response_faithfulness` | LLM | exact reuse |
| 9 | `grounding_synthesis` | LLM | parameter-variation of `source_attribution_grounding` (samples 05/06) |

**Synthesis-class generalisation finding.** The bloom-family validator set does *not* parameter-vary cleanly into a synthesis-family set. Specifically:

- `source_attribution_grounding` (sample 05) parameter-varies into `grounding_synthesis` with a rotation: bloom asks "does the source field accurately attribute each emitted item?"; synthesis asks "does each narrative claim trace to a substrate item?". Both are grounding checks, but the unit-of-analysis differs (item-level vs claim-level).
- `bloom_completeness_vs_thinking` does *not* generalise. Synthesis is intentional compression; the question "what was rejected" does not apply.
- `surface_attribution_completeness` (sample 06) does not generalise. Synthesis has no surfaces axis.
- `persona_journey_coupling` etc. do not apply.
- `open_question_vs_decided` (cross-role from 03/04/05/06) carries over as `open_question_resolution_discipline` with the same decision rule: open questions in substrate must remain open in the synthesis unless the substrate itself records a resolution.
- `reasoning_to_response_faithfulness` carries over unchanged.

**The synthesis-specific additions** (`synthesis_coverage_audit`, `synthesis_fabrication_check`, `compression_fidelity_audit`, `phasing_dependency_consistency`, `handoff_field_completeness`) form the synthesis-class core. Future synthesis samples (08 release_plan, and any other handoff-shaped output) will reuse these five and add small parameter variations rather than re-deriving the family.

**Validators that explicitly do NOT apply:**

- `contract_schema_bloom` (sample 05/06) — replaced by `contract_schema_synthesis` because the schema is fundamentally different.
- `surface_attribution_completeness` (sample 06) — synthesis has no surfaces axis.
- `bloom_completeness_vs_thinking` (sample 05) — synthesis is intentional compression.
- `scope_boundary_adherence_*` (sample 03) — synthesis is a downstream consolidation, not a discovery pass with layer assignment. Third negative for the family.
- `persona_journey_coupling` / `domain_journey_coupling` (sample 06) — no journey-graph in this contract.

---

## 4. Validator prompt templates

### 4.1 `contract_schema_synthesis` (deterministic, NEW)

```ts
function validateProductDescriptionSynthesisContract(r: ProductDescriptionResponse): Finding[] {
  // 1. JSON parseable; no markdown fences; no trailing prose.
  // 2. Top-level keys exactly: { productVision, productDescription, summary, openLoops }.
  //    Reject any other keys (the contract forbids personas, userJourneys, etc.).
  // 3. productVision: string; sentence count ∈ [1, 2].
  // 4. productDescription: string; non-empty paragraph; sentence count ∈ [2, 6] (heuristic).
  // 5. summary: string; sentence count ∈ [4, 8] strictly.
  // 6. openLoops: array; each item { category, description, priority }.
  //    category ∈ {deferred_decision, missing_info, unresolved_risk, followup}.
  //    priority ∈ {high, medium, low}.
  //    description non-empty.
  // 7. No unescaped double quotes inside string values (the prompt's strict-quote rule).
  // 8. No straight smart-quote characters (curly quotes).
}
```

Catches contract-shape defects deterministically. Findings: `wrong_field_count`, `forbidden_field_present`, `sentence_count_out_of_range`, `enum_violation`, `missing_field`, `quote_escaping_violation`.

### 4.2 `handoff_field_completeness` (deterministic + LLM, NEW)

```text
[MISSION]
Verify each required handoff field is populated *meaningfully* — not with
placeholder text, restatement of the prompt, or trivially-short content.

[IN-SCOPE]
- The four required fields: productVision, productDescription, summary, openLoops.
- Each field's content vs the field's stated purpose.

[DECISION STANDARD]
For each field:
  - Is the content present and non-empty? (deterministic prefilter)
  - Does it discharge the field's stated purpose?
    - productVision: a north-star statement about what the product *is for*,
      not what it *does*.
    - productDescription: a self-contained paragraph a stranger could
      understand; names the major pillars.
    - summary: covers vision → users → core pillars → phasing in 4–8
      sentences.
    - openLoops: each item describes a real unresolved decision/risk/info
      gap, not a placeholder or restatement.
  - Is the content distinct from the seed (i.e. did the agent actually
    refine, or did it copy the seed verbatim)?

[FINDING TYPES]
- placeholder_content (LOW per field)
- field_purpose_unmet (MEDIUM per field — vision missing north-star,
  summary missing one of the four required arcs, etc.)
- seed_copied_verbatim (LOW per field)
- openloops_item_trivial (LOW per item)
```

The current sample passes deterministic prefilter but a stricter LLM check might flag the productVision's "definitive AI-native operating system that unifies …" as field-purpose-met (it is a north-star statement) and the summary's coverage of all four arcs (vision → users → pillars → phasing) as met. This validator's primary value is on weaker outputs; the current sample is a positive baseline.

### 4.3 `synthesis_coverage_audit` (LLM, NEW)

```text
[MISSION]
For each multi-item set in the substrate, build a coverage matrix
showing which items survived into the synthesis narrative as named,
which survived as implicit (subsumed under a category), and which did
not survive.

[IN-SCOPE]
- Substrate sets that the prompt expects the synthesis to represent:
    - Personas (the substrate names N personas; the synthesis should
      either name them, name the persona-cluster they belong to, or
      flag them as deliberately omitted).
    - Business domains (similar).
    - Integrations (when user-facing — payment, signature, voting,
      voice — these should be representable).
    - Quality attributes (when load-bearing — at least the top 1–2
      should appear in narrative form).
    - Workflows (when load-bearing).
- The four narrative fields plus openLoops.

[DECISION STANDARD]
For each substrate item:
  - SURVIVED_NAMED: the item or its canonical name appears in the
    narrative.
  - SURVIVED_IMPLICIT: the item is subsumed under a category mentioned
    in the narrative (e.g. P-CAM-MANAGER under "community associations").
  - DROPPED_SILENT: the item does not appear and is not subsumed.

A coverage defect exists when:
  - DROPPED_SILENT count for a substrate set exceeds a threshold
    (suggested: 30% of items, OR any item that the substrate itself
    flagged as load-bearing — e.g. a persona explicitly named in the
    seed vision).
  - A specific high-importance item (auditor, tenant on a
    multi-tenant product, regulatory persona) is DROPPED_SILENT.

[FINDING TYPES]
- substrate_coverage_below_threshold (MEDIUM; HIGH if >50% dropped)
- load_bearing_item_dropped (MEDIUM per item; HIGH if multiple)
- substrate_set_entirely_absent (HIGH per set — e.g. 19 integrations,
  none mentioned)

[INPUTS]
- Substrate sets enumerated from the prompt's bloom summary section.
- The four narrative fields.

[OUTPUT CONTRACT]
For each finding, include a coverage matrix excerpt showing which
items dropped.
```

**This is the validator the current reviewer most needed.** It would have caught §1a.1 (5 of 9 personas dropped), §1a.2 (DOM-LEDGER/AUDIT/COMPLIANCE collapsed), and §1a.3 (integrations entirely absent).

### 4.4 `synthesis_fabrication_check` (LLM, NEW)

```text
[MISSION]
Confirm every noun phrase, named concept, framing metaphor, and claim
in the synthesis narrative traces to a substrate item.

[IN-SCOPE]
- The four narrative fields.
- Specifically the noun phrases, metaphors, and framing claims —
  NOT the connective prose.

[DECISION STANDARD]
For each significant noun phrase or framing in the response:
  - SUPPORTED: the concept appears in the seed vision/description/summary,
    the bloom summary, or is a defensible compression of multiple
    substrate items.
  - PARTIALLY_SUPPORTED: the concept paraphrases or amplifies a
    substrate item without changing its meaning.
  - REFRAMED: the concept changes the framing of a substrate item in a
    way that alters product-shape implications (e.g. "matching" →
    "unification", "autonomous workflows" → "autonomous governance
    workflows").
  - FABRICATED: the concept appears nowhere in the substrate and is
    not a defensible compression.

[FINDING TYPES]
- fabricated_phrase (LOW per phrase; MEDIUM if the phrase is in the
  productVision or productDescription where it carries canonical weight)
- silent_reframing (MEDIUM — the framing shift is a synthesis-time
  decision the agent should have flagged)
- amplifying_adjective (LOW — "definitive", "frictionless",
  "comprehensive" applied without substrate basis)

[POSITIVE BASELINE]
A fully-supported synthesis is the norm, not the exception. Most
narrative content should map cleanly to substrate. Findings should
identify the specific spans that do not.
```

Catches §1a.4 (brokerage → integration), §1a.5 ("digital nervous system"), and the §1a.4 "definitive" / "frictionless" amplifications.

### 4.5 `compression_fidelity_audit` (LLM, NEW)

```text
[MISSION]
Identify load-bearing nuance from the substrate that the synthesis
preserved, partially preserved, or lost.

[IN-SCOPE]
- The 3–6 most load-bearing concepts in the substrate (the seed
  vision and bloom summary together establish these — typically the
  product's distinguishing structure: pillar architecture, distinctive
  domain separations, key user-facing features).
- The four narrative fields.

[DECISION STANDARD]
For each load-bearing concept identified in the substrate:
  - PRESERVED: the synthesis carries the concept forward at appropriate
    granularity.
  - PARTIALLY_PRESERVED: the synthesis gestures at the concept but
    loses a distinction the substrate explicitly drew (e.g. DOM-LEDGER
    and DOM-FINANCE both compress to "financial ledgers").
  - LOST: the synthesis does not carry the concept forward.

[FINDING TYPES]
- distinction_collapsed (MEDIUM — a substrate distinction merged
  into a single phrase in the synthesis)
- nuance_lost (MEDIUM per nuance — the substrate has a load-bearing
  feature the synthesis does not represent)
- pillar_fidelity_drift (LOW — pillar names drift across narrative
  fields)

[ANCHOR]
Use the seed description and bloom summary as the load-bearing-concept
source. The four-round prune that produced the bloom summary
established what was load-bearing; concepts surviving four prunes are
load-bearing by construction.
```

Catches §1a.2 (DOM-LEDGER/AUDIT/COMPLIANCE collapsed) and §1a.7 (pillar-name drift).

### 4.6 `phasing_dependency_consistency` (LLM-or-deterministic, NEW)

```text
[MISSION]
Verify the synthesis's phasing or release-plan structure respects
dependency ordering implied by the substrate.

[IN-SCOPE]
- Any field in the synthesis that describes phasing, release order,
  rollout sequence, or roadmap.
- The substrate's phasing strategy and the dependency edges implicit
  in the substrate (e.g. workflow X depends on integration Y; pillar
  P depends on persona Q being onboarded).

[DECISION STANDARD]
For each phase/order claim in the synthesis:
  - Is the claim consistent with the substrate's phasing strategy?
  - Are the dependency edges respected (a phase that requires a
    prerequisite has the prerequisite earlier or in the same phase)?
  - Are the pillar/feature names in the phasing claim consistent with
    the names used elsewhere in the synthesis?

[FINDING TYPES]
- phase_order_inconsistent_with_substrate (HIGH)
- dependency_violation (HIGH — phase N requires X but X is in phase >N)
- phase_pillar_name_drift (LOW)

[VACUOUS-CASE NOTE]
If the synthesis contract has no phasing field, this validator emits
no findings (positive vacuous result). For sample 07 (product
description synthesis) the validator is vacuous; for sample 08
(release plan synthesis) the validator is load-bearing.
```

Vacuous for the current sample; load-bearing for sample 08 (release_plan).

### 4.7 `open_question_resolution_discipline` (LLM, parameter-variation of cross-role `open_question_vs_decided`)

Reused with synthesis-specific decision rule:

```text
[ADDITIONAL DECISION STANDARD — SYNTHESIS]
For each open question in the substrate:
  - Is it carried forward as an openLoops item (or equivalent)?
  - Does the narrative prose silently resolve it by picking a branch?
    (e.g. the substrate asks "subscription vs transaction-based?";
    the productDescription asserts "subscription-based pricing across
    the three pillars" — that is silent resolution.)
  - For openLoops items the synthesis introduces:
    - Is the priority assigned? If yes, is the priority derivable from
      substrate or synthesis-time invented?
    - Is the category-fit forced by enum gaps? (e.g. a scope question
      forced into deferred_decision because no scope category exists.)

[FINDING TYPES]
- open_question_silently_resolved (HIGH)
- open_question_dropped (MEDIUM)
- priority_assigned_without_substrate_basis (LOW)
- enum_forced_category_fit (LOW — escalate to MEDIUM if downstream
  consumers branch on category)
```

Current sample passes the silent-resolution check (positive baseline) and trips the priority-without-substrate-basis check on Q-2=high (§1a.6).

### 4.8 `reasoning_to_response_faithfulness` — exact reuse

Synthesis-specific markers:

- "All four seem unresolved" (thinking) → all four become openLoops (response). Faithful.
- "Ensure it hits the 4–8 sentence count exactly" (thinking) → 5-sentence summary (response). Faithful but reveals over-allocation of attention to schema satisfaction.
- "I should probably ensure it sounds 'final settled'" (thinking) → "stands as an AI-native operating system" (response). Reveals the rhetorical-tone decision that the response carries forward; the reframing in §1a.4 is faithfully traceable to the thinking chain's "final settled" framing instruction.

The thinking chain in this sample is heavy on JSON-validity and sentence-count self-checks (a structural-satisfaction loop) and light on coverage self-checks (no traversal of the bloom summary's 9-personas-14-domains-19-integrations against the response). This is itself a finding: the agent's internal monitor is mis-allocated. Severity: LOW; record as a pattern observation.

### 4.9 `grounding_synthesis` (LLM, parameter-variation of `source_attribution_grounding`)

Reused with synthesis-specific unit-of-analysis: claims-in-narrative rather than items-in-array. Decision rule, finding types, and severity ladder are inherited from sample 05 §4.3. The validator largely overlaps with `synthesis_fabrication_check` (§4.4); the dedup rule is to treat fabrication as the primary on the claim level and grounding as the primary on the substrate-item-attribution level. In the synthesis-class, the two collapse onto similar findings; in mixed pipelines, the distinction persists.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_synthesis` | yes (deterministic) | `agent_role == "domain_interpreter" && sub_phase ∈ {"product_description_synthesis", "release_plan_synthesis", ...other-synthesis-shaped...}` |
| `handoff_field_completeness` | yes | same; only after contract_schema passes |
| `synthesis_coverage_audit` | yes (LLM) | same; substrate sets enumerated from prompt |
| `synthesis_fabrication_check` | yes (LLM) | same |
| `compression_fidelity_audit` | yes (LLM) | same; load-bearing concept set extracted from prompt |
| `phasing_dependency_consistency` | conditional (LLM-or-det) | synthesis contract has a phasing/order field |
| `open_question_resolution_discipline` | yes (LLM) | substrate has open questions OR synthesis has openLoops/openQuestions field |
| `reasoning_to_response_faithfulness` | conditional (LLM) | `agent_thinking_chain.length > 0` |
| `grounding_synthesis` | yes (LLM) | same; partially overlaps with fabrication_check (dedup in final_synthesis) |

Pipeline order:

```
1. contract_schema_synthesis              (deterministic, gate)
2. handoff_field_completeness             (deterministic prefilter, LLM follow-up)
3. synthesis_coverage_audit               (LLM — primary semantic check)
4. compression_fidelity_audit             (LLM — runs after coverage so it can
                                             differentiate "dropped" from
                                             "preserved-but-collapsed")
5. synthesis_fabrication_check            (LLM)
6. grounding_synthesis                    (LLM — overlaps with 5; dedup downstream)
7. open_question_resolution_discipline    (LLM)
8. phasing_dependency_consistency         (LLM-or-deterministic, conditional)
9. reasoning_to_response_faithfulness     (LLM, conditional)
10. final_synthesis                       (LLM, unchanged)
```

`synthesis_coverage_audit` runs before `compression_fidelity_audit` so that "lost" findings can be distinguished from "preserved-but-distinction-collapsed" findings (the former is a coverage defect; the latter is a fidelity defect — same response span, different finding categories).

### 5.2 Deterministic vs LLM split

- **Deterministic:** `contract_schema_synthesis`, the prefilter portion of `handoff_field_completeness`, and (when phasing is structured) `phasing_dependency_consistency`.
- **LLM:** `synthesis_coverage_audit`, `compression_fidelity_audit`, `synthesis_fabrication_check`, `grounding_synthesis`, `open_question_resolution_discipline`, the field-purpose-met portion of `handoff_field_completeness`, `reasoning_to_response_faithfulness`.

### 5.3 Integration with samples 01–06

- **`contract_schema_*` registry** continues; sixth role-keyed entry (synthesis schema is materially different from the bloom schemas).
- **`open_question_vs_decided`** (cross-role from 03/04/05/06) parameter-varies into `open_question_resolution_discipline` — the cross-role family now spans extraction, bloom, and synthesis.
- **`source_attribution_grounding`** (cross-role from 05/06) parameter-varies into `grounding_synthesis` with a unit-of-analysis rotation. The cross-role family generalises further.
- **`reasoning_to_response_faithfulness`** carries over unchanged. Now applies across extraction, bloom, and synthesis. Strongest cross-role validator in the corpus to date.
- **The bloom-class validator family** (`bloom_completeness_vs_thinking`, `surface_attribution_completeness`, `persona_journey_coupling`, `domain_journey_coupling`, `step_completeness_and_automatable`, `acceptance_criteria_measurability`, `workflow_journey_separation`, `journey_id_continuity`) does **not** apply to synthesis. The bloom and synthesis classes are siblings; their validator pipelines do not share core members beyond the cross-role grounding/faithfulness/open-question trio.
- **`scope_boundary_adherence_*`** (sample 03) does not apply. Third negative for the family — the pattern is now: this family applies to extraction passes only.

### 5.4 Cross-validator deduplication

Three overlap pairs to manage in `final_synthesis`:

- `synthesis_fabrication_check` and `grounding_synthesis` — both inspect narrative claims for substrate support. Treat fabrication as primary on the claim level (reframings, metaphors, amplifying adjectives); treat grounding as primary on the substrate-item-attribution level (which substrate item is each major claim attributed to). Findings can co-emit on the same span; dedup by collapsing to the higher severity.
- `synthesis_coverage_audit` and `compression_fidelity_audit` — coverage flags items dropped; fidelity flags items collapsed-with-loss. The two are complementary, not overlapping. Dedup is unnecessary unless the same span triggers both (rare).
- `handoff_field_completeness` (field_purpose_unmet) and `synthesis_coverage_audit` (substrate_set_entirely_absent) — when the productDescription does not name pillars, both validators may fire. Treat completeness as primary because it is field-scoped.

### 5.5 Cross-role validator promotion hypotheses

- `synthesis_coverage_audit`: strong candidate for cross-role generalisation. Any handoff-shaped synthesis (Phase 2 architecture handoff, Phase 4 NFR handoff, Phase 6 release synthesis) will have substrate-coverage requirements. The validator's parameterisation (which substrate sets, which load-bearing items) varies per role, but the structure transfers.
- `synthesis_fabrication_check`: same story. Cross-role candidate; defer parameterisation until sample 08+ confirms the pattern.
- `compression_fidelity_audit`: cross-role candidate, but the load-bearing-concept extraction step is non-trivial. May require role-specific concept registries.
- `phasing_dependency_consistency`: cross-role candidate for any output with phasing/ordering structure. Defer until sample 08 confirms the schema.
- `handoff_field_completeness`: cross-role candidate parameterised by the contract's required fields and their stated purposes. Strong promotion candidate.

---

## 6. Notes and open questions

1. **Synthesis is the first class where `0 findings` is the worst gate outcome.** In the bloom samples, `0 findings` was wrong but at least informative ("the reviewer is silent on a defective response"). In synthesis, `0 findings` plus a confidently-positive overall_assessment ("accurately synthesizes the provided seed material and bloom summary") is actively misleading — the gate signal says "ship it" while five personas are silently absent from the canonical product narrative. Synthesis-class reviewers must default to higher scepticism, not lower.

2. **The current reviewer prompt has no synthesis awareness.** The prompt's bullet list (assumptions stated as facts, index-based logic, missing edge cases, contradictions, over-confident conclusions, fragile coupling, data transformations that lose information) is bloom-and-extraction-shaped. The closest synthesis-relevant bullet is "data transformations that lose information or change semantics silently" — which is exactly the synthesis defect class — but the bullet is buried in a mixed list and the reviewer apparently does not invoke it. Recommend the synthesis reviewer prompt foreground the lose-information / silently-decide / fabricate-during-compression triad.

3. **Synthesis defects are subtractive; bloom defects are additive.** The asymmetry has implications for prompt design: a bloom reviewer can be told "look for over-claim and fabrication"; a synthesis reviewer must be told "look for what isn't there". The latter is a cognitively harder ask of a small model (you cannot pattern-match against an absence; you must traverse the substrate and check for presence). The fix is to give the synthesis reviewer an explicit substrate enumeration step before the response review step.

4. **The contract is the upstream defect for §1a.6 and §1a.8.** The openLoops enum lacks a `scope` value; the contract has no `omittedFromNarrative` field. Both gaps force the agent to compress information away that downstream consumers need. The reviewer should be empowered to emit *meta-findings* about contract gaps — the validator harness should accept findings whose subject is the prompt/contract, not the agent. Recommend `contract_design_finding` as a finding type in `final_synthesis`.

5. **The thinking chain's attention allocation is itself a finding.** In this sample, ~30% of thinking-chain tokens go to JSON-validity self-checks, ~20% to sentence-count checks, ~10% to category-enum checks, ~30% to drafting and re-drafting prose, ~10% to coverage reasoning. The actual coverage check (does my response mention all 9 personas?) gets one paragraph and zero traversal. A `reasoning_attention_allocation_audit` validator would flag this pattern: when synthesis defects are subtractive and the thinking chain spends <20% of tokens on coverage, the response is at high risk of subtractive defect. Defer to a future sample for full design.

6. **Sample 07 is the regression-test fixture for synthesis-class coverage attrition.** All five missing personas (P-TENANT, P-AUDITOR, P-ADMIN, P-FINANCE-OFFICER, plus arguably P-BOARD though "community boards" gets close) are derivable from the bloom summary as plain text. A future agent change that names ≥7 of the 9 personas in narrative form is measurable improvement. Recommend adding to the validator-development test suite with an expected `synthesis_coverage_audit` finding count of ≥3 MEDIUM `load_bearing_item_dropped` findings on personas alone.

7. **Sample 08 (release_plan synthesis) will exercise `phasing_dependency_consistency` non-vacuously.** This sample's vacuous result on that validator means the validator's positive-mission prompt is untested against load-bearing inputs. Recommend re-evaluating the validator design after sample 08.

8. **Cross-role generalisation candidates (synthesis-class).** Five validators are strong cross-role candidates: `synthesis_coverage_audit`, `synthesis_fabrication_check`, `compression_fidelity_audit`, `handoff_field_completeness`, `phasing_dependency_consistency`. Of these, the first two are most cleanly generalisable; the latter three depend on contract-specific extraction steps. The bloom-class also produced cross-role candidates, but the synthesis-class candidates are more universal because every phase has a handoff, and every handoff is a synthesis.

9. **Bloom-family vs synthesis-family confirmation.** The two families share three cross-role validators (`grounding_*`, `open_question_*`, `reasoning_to_response_faithfulness`) and otherwise have disjoint pipelines. The cross-role trio is now the strongest design pattern in the corpus: every reviewed role has used at least one of them. The role-specific validator counts (bloom: 11; synthesis: 8 here) are converging to a similar size, suggesting the per-role pipeline cost is roughly stable.

10. **The reviewer's `0 findings` outcome on a defective synthesis is the strongest argument in the corpus for decomposed validation.** A single-pass reviewer reading a 2.6 KB compressed narrative against an 8.9 KB prompt has insufficient surface area to traverse the substrate-vs-narrative coverage matrix. The decomposed harness — coverage audit, fabrication check, fidelity audit as separate passes — gives each validator a focused traversal target. The shape of the defect (subtractive, distributed across multiple substrate sets) is exactly the shape that needs decomposition to detect.
