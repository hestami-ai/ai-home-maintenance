# Assessment: domain_interpreter / business_domains_bloom (Phase 1.5)

**Sample:** `track_c_samples/05_domain_interpreter__business_domains_bloom.md`
**Reviewed agent:** `domain_interpreter` running `qwen3.5:9b` (14 KB JSON, 14 KB thinking chain)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

This is the first sample in the series where the gemma reviewer fired `has_concerns: true` and produced a populated `concerns` array. Schema/gate consistency is intact (`hasConcerns=true ↔ concerns.length=3`), which is a structural improvement over the contradictory-gate pattern flagged in the original ChatGPT 5.5 redesign note. The substantive question shifts: did the reviewer catch the *right* defects, calibrate them correctly, and avoid hallucinating issues the response does not contain? On all three axes the answer is "partially". The reviewer landed one solid hit (DOM-LEDGER / DOM-AUDIT redundancy), one defensible-but-stylistic observation (DOM-GOVERNANCE / DOM-COMPLIANCE overlap), and one near-miss (DOM-PROPERTY / DOM-COMMUNITIES — the finding's own *recommendation* concedes the split is fine), while overlooking a much larger class of substantive defects: source-tag fabrication on the majority of domains, persona-ID mutation that breaks the workflow's identity contract, three-pillar organizing concept entirely absent from the output, two fabricated personas (`P-FINANCE-OFFICER`, `P-AUDITOR`) with no journey or stakeholder anchor, and pain-point inflation on multiple "user-specified" personas that the source did not state.

The angle shift relative to samples 01–04 is therefore from "the reviewer was silent on defects it should have caught" to "the reviewer spoke, but spoke about architecture-style preferences while the load-bearing failures sit in source-attribution, identity hygiene, and missing organizing concepts." The role-specific design implication is that bloom passes need validators tuned to *coverage discipline* and *source-attribution honesty*, not to architectural-cleanliness intuitions — which is the dimension the gemma reviewer over-indexed on.

### 1a. Defects in the agent's response

#### 1a.1 Source-tag fabrication: majority of `source: "user-specified"` claims are false

The contract defines three source values: `user-specified` ("stated in the raw intent or inlined docs"), `ai-proposed` (inference), `domain-standard` (industry-conventional). Of the 14 domains, the agent labels **eleven as `user-specified`**, two as `domain-standard` (DOM-COMM, DOM-IDENTITY), one as `ai-proposed` (DOM-AI-ENG), and one as `ai-proposed` (DOM-AUDIT). The PRODUCT SCOPE block contains no enumerated domain list — only a vision sentence, a description naming three pillars, six personas, four journeys, three phases, and seven requirements. None of those source spans names a "Bid Management" domain, a "Trust Ledger" domain, an "External Community Context" domain, a "Field Operations" domain, a "Regulatory & Safety Compliance" domain, a "Provider Discovery & Vetting" domain, or a "Property Registry & Asset Digitization" domain. The source attests *capabilities* and *requirements* that imply such domains; the *domains themselves are inferences* and should be tagged `ai-proposed` (or `domain-standard` for the most conventional ones like DOM-IDENTITY, DOM-FINANCE).

The agent's own thinking explicitly identifies several of these as inferences ("**Implicit Domains (Standard for this industry but need to be explicit)**: Financial Management … Legal/Compliance … Asset Management … Communication/Engagement … Security/Identity … Analytics/Intelligence … Vendor Management … Document Management …") then assigns `user-specified` in the response anyway. The closest the source comes to a domain enumeration is the three-pillar description; none of the agent's domain names matches a pillar verbatim.

The minimum-correct labeling for this source would be:

| Domain | Defensible source tag |
|---|---|
| DOM-PROPERTY | `ai-proposed` (requirement R1 attests "digitize and store comprehensive property history" — implies but does not name a Property domain) |
| DOM-MAINTENANCE | `ai-proposed` (UJ-SUBMIT-REQUEST attests the journey, not a domain label) |
| DOM-VENDOR | `ai-proposed` |
| DOM-FINANCE | `ai-proposed` (requirement R4 "AP/AR workflows with financial accounts for associations") |
| DOM-GOVERNANCE | `ai-proposed` (UJ-GOVERNANCE-COMPLIANCE attests the journey) |
| DOM-JOB | `ai-proposed` (Phase 2 narrative "contractor operational model and job lifecycle") |
| DOM-BID | `ai-proposed` (requirement R5 "view, compare, and approve service bids") |
| DOM-COMPLIANCE | `domain-standard` |
| DOM-LEDGER | `ai-proposed` (requirement R7 "record decisions and rationales for trust ledger") |
| DOM-COMM | `domain-standard` |
| DOM-IDENTITY | `domain-standard` |
| DOM-AI-ENG | `ai-proposed` |
| DOM-COMMUNITIES | `ai-proposed` (requirement R6 "manage external HOA context") |
| DOM-AUDIT | `ai-proposed` |

The agent's labeling collapses this distinction by tagging eleven as `user-specified`. Downstream, the user's Accept/Reject card cannot distinguish "the user already said this" from "the AI inferred this" — defeating the entire purpose of the source field. This is a **HIGH** severity defect: the contract field exists specifically to support pruning, and a fabricated `user-specified` flag makes the AI's inference indistinguishable from the user's stated intent.

#### 1a.2 Persona-ID mutation breaks identity hygiene

The input PRODUCT SCOPE block lists `P-CAM_MANAGER` (underscore). The output emits `P-CAM-MANAGER` (hyphen). The prompt's own regex `^P-[A-Z0-9_-]+$` permits both — but the agent's task description does *not* license modifying IDs of personas tagged `confirm + expand`. The prompt says: "the 1.0b output is a seed. Confirm all are complete (goals + painPoints), add any missing personas, and include ALL in your output." That is a confirm-and-extend operation, not a rename operation. Mutating an existing ID silently breaks every downstream reference (journeys list `P-CAM_MANAGER` as the stakeholder for `UJ-GOVERNANCE-COMPLIANCE`; if Phase 1.6 reads the bloom output, it now sees a persona that does not match that reference).

The agent's thinking chain wrestles with this for nearly forty lines and explicitly notes the conflict:

> "Wait, the input *Discovered Personas* section explicitly lists `P-CAM_MANAGER`. If I change it, is it `user-specified` or `ai-proposed`? … However, the instruction says: 'Every persona ID MUST be a semantic slug…' I will use `P-CAM-MANAGER` to align with the example style…"

— and then commits the mutation. The instruction example list (`P-HOMEOWNER`, `P-SERVICE-PROVIDER`, `P-HOA-MANAGER`, `P-UNDERWRITER`) is illustrative, not normative; the regex is normative and admits the existing slug. The agent's reasoning prioritises stylistic alignment with examples over identity preservation of an input the prompt explicitly tells it to *confirm*. **MEDIUM** severity — the mutation is recoverable by a simple normalize step but silently invalidates cross-document references until that step exists.

#### 1a.3 Three-pillar organizing concept entirely absent from the output

The product description names "**three distinct but integrated pillars**: a Home Real Property Assistant … a Service Provider Field Services Management tool … and a Community Association Management (CAM) system." The phasing strategy maps each phase to a pillar. The agent's thinking explicitly enumerates the pillars ("Pillars: 1. Home Real Property Assistant … 2. Service Provider Field Services Management … 3. Community Association Management"). The response, however, does not represent the pillar concept anywhere — no `pillar` field on domains, no super-domain grouping, no rationale text linking each domain to its parent pillar, no separate "pillars" array. The pillar concept is the most prominent organizing structure in the source and the agent's output collapses it.

This is the bloom-pass version of "pillar-vs-domain confusion" the task framing called out. The defensible handling shapes are:

1. **Pillar as super-domain.** Add three `DOM-PILLAR-*` domains with the others as sub-domains (or with a `parentPillar` field).
2. **Pillar as orthogonal axis.** Add a `pillars` array alongside `domains` and `personas`, and tag each domain with `pillarMembership: ["PILLAR-HOME"|"PILLAR-PROVIDER"|"PILLAR-CAM"|"cross-cutting"]`.
3. **Pillar as rationale-only annotation.** Mention the pillar in each domain's `rationale`.

The agent does (3) inconsistently — DOM-JOB's rationale says "Enables the supply side of the ecosystem (Phase 2)", DOM-GOVERNANCE's says "Phase 3 CAM system" — but most domain rationales never mention a pillar. The contract does not require a pillar field, so this is not a contract violation, but the bloom mandate ("propose ALL business domains and personas this product should encompass") on a source that explicitly structures its scope around three pillars cannot honestly be discharged without representing those pillars somewhere. **MEDIUM** severity.

#### 1a.4 Fabricated personas without journey or stakeholder anchor

`P-FINANCE-OFFICER` ("Role responsible for oversight of HOA finances, audits, and reserve studies within CAM") and `P-AUDITOR` ("External auditors reviewing financial data and compliance logs for the trust ledger") are tagged `ai-proposed`, which is honest about provenance — but neither is anchored to a journey, a stakeholder relationship, or a source span. The source's persona slate already covers HOA finance via `P-CAM_MANAGER` ("day-to-day operations, compliance, and financials") and `P-BOARD` ("decisions on budgets, rules, and finances"). Adding `P-FINANCE-OFFICER` without explaining what the HOA org-chart distinction is, or what journey-step the new persona owns that the existing two do not, produces a persona with no decision rights and no workflow anchor.

`P-AUDITOR` is more defensible (the requirement "record decisions and rationales for trust ledger purposes" implies an audit consumer) but the agent never connects the dots: no rationale field on personas, no linkage to DOM-LEDGER, no journey step that would invoke an external auditor. The contract permits AI-proposed personas; the bloom mandate ("err on the side of over-proposing") permits expansive proposals. But "expansive" is not "unanchored" — the user prunes by reading goals/pain points and judging whether the persona's relationship to the product is real. A persona with no journey-stakeholder relationship gives the user nothing to prune against. **LOW–MEDIUM** severity for `P-AUDITOR`, **MEDIUM** for `P-FINANCE-OFFICER` (subsumed by existing personas).

`P-TENANT` is the strongest of the three additions — it is anchored to a real distinction (renters vs owners) that `P-INVESTOR`'s pain point ("repetitive tenant communication") implicitly attests. This addition is defensible.

#### 1a.5 Pain-point inflation on `user-specified` personas

The prompt's confirm-and-extend instruction means existing personas' goals and pain points should be preserved; missing items added; nothing fabricated. The output adds new pain points to three input-specified personas without source support:

- `P-BOARD` adds "Hard to attend meetings and vote efficiently" (not in source).
- `P-ADMIN` adds "Difficulty tracking admin workload" and "Lack of tools for oversight" (not in source).
- `P-CAM-MANAGER` adds "Difficulty managing compliance notices" (not in source — the source said "Fragmented systems for financial and governance tasks").
- `P-HOMEOWNER` rewrites "Manage multiple properties efficiently" → goal disappears entirely; "Track maintenance and service calls" → "Track maintenance history of property" (paraphrase, semantic drift).

These are bloom-pass equivalents of sample 04's "extending the source by paraphrase" defect. The pain points are plausible — they read like real homeowner / board / admin pain — but the agent introduces them as if they were source-attested by emitting them under `source: "user-specified"`. **MEDIUM** severity. (Note the goal-erasure on P-HOMEOWNER, which strips a *real* source-attested goal — "Manage multiple properties efficiently" — while adding inferred ones. This is silent information loss.)

#### 1a.6 DOM-AUDIT description duplicates `P-ADMIN` description

DOM-AUDIT.description: "Tools for P-ADMIN to execute service calls human-in-the-loop and monitor platform health." That is verbatim the goal slate of `P-ADMIN`, transposed into a domain. A domain is not a persona's tool list; it is a coherent area of business capability. DOM-AUDIT as written is not a business domain — it is "things the platform admin uses". The reviewer caught this (finding 2) but mis-described it as a redundancy with DOM-LEDGER; the deeper defect is that DOM-AUDIT is not a domain at all in the bloom-mandate sense. **MEDIUM** severity.

#### 1a.7 DOM-AI-ENG entityPreview includes a workflow

`DOM-AI-ENG.entityPreview = ["Matching Score", "Prediction Model", "Workflow Bot", "Recommendation Engine"]`. "Workflow Bot" and "Recommendation Engine" are not entities — they are systems / actors. `entityPreview` should list nouns the system stores or tracks (records, scores, models — entities). This is a **LOW** severity contract-shape slip, but it is symptomatic of the agent treating `entityPreview` and `workflowPreview` interchangeably.

#### 1a.8 Persona count drift in thinking vs response

The thinking chain enumerates eight or nine personas at multiple points and converges on nine; the response emits nine. No defect — but the thinking chain shows the agent considering and rejecting `P-LIEN-HOLDER`, `P-CONDO-UNIT-OVERSEER`, `P-CONTRACTOR-COORDINATOR`, `P-LANDLORD`, `P-AI-AGENT`, `P-CUSTOMER-SUPPORT`, `P-SMALL-BUSINESS`, `P-UTILITY-PARTNER`, `P-INSURANCE`. None of those rejection rationales surfaces in the response, even though the bloom mandate ("**err on the side of over-proposing — the user is the pruner**") would seem to argue *for* including most of them. This is the inverse of the over-proposing rule: the agent self-pruned in the thinking chain on grounds that the bloom mandate explicitly forbids ("Do NOT exclude domains because they seem low priority"). The same rule applies to personas. **LOW–MEDIUM** severity — bloom-vs-extraction discipline failure on the persona axis.

#### 1a.9 Pillar-rationale leakage across phases

DOM-FINANCE rationale says "Required for Phase 3 CAM system and investor goals (ROI)". DOM-GOVERNANCE rationale says "Directly maps to UJ-GOVERNANCE-COMPLIANCE and P-BOARD/P-CAM_MANAGER goals" (note: refers to `P-CAM_MANAGER` here while emitting `P-CAM-MANAGER` in the personas array — internal inconsistency between the two persona-ID forms). DOM-JOB rationale says "Phase 2 provider management". The phase tagging is informal, embedded in prose, and inconsistent — DOM-PROPERTY's rationale never mentions Phase 1 even though it is the canonical Phase 1 domain. **LOW** severity.

#### 1a.10 Open question surfacing absent

The bloom mandate is a proposal pass, not a discovery pass, so there is no `openQuestions` array in the contract. But the agent's thinking surfaces multiple questions that affect the proposal ("Add `P-LENDING`? The vision mentions 'Trust Ledger'. Maybe a lending partner view? Maybe too far Phase 3.") and resolves them privately. The bloom-pass equivalent of an open question is a domain or persona proposed *with a rationale that flags it as speculative* so the user can prune it confidently. None of the agent's thirteen `ai-proposed` items (the two genuinely AI-proposed, plus the eleven mislabelled `user-specified`) flag the speculative axis. **LOW** severity — a contract-shape gap rather than a defect against the current contract.

### 1b. Analysis of the reviewer's 3 findings

#### Finding 1 — "Over-separation of Governance and Compliance domains" (MEDIUM)

> "DOM-GOVERNANCE and DOM-COMPLIANCE cover highly overlapping functions, particularly in the CAM context (e.g., a 'Violation Notice' is both a governance action and a compliance failure). … Merge these two domains into a single, comprehensive 'DOM-GOVERNANCE-COMPLIANCE' domain."

**Substantive accuracy: partial hit.** It is true that DOM-GOVERNANCE.entityPreview includes "Violation Notice" and DOM-COMPLIANCE.entityPreview includes "Notice of Violation" — two near-identical entity names across two domains. The agent itself partially admits the overlap by *naming* DOM-GOVERNANCE "Community Governance & **Compliance**" while emitting a separate DOM-COMPLIANCE. So there is a real coordination problem in the response.

**However, the recommendation is wrong on the bloom mandate.** The prompt is explicit: "PROPOSE EXPANSIVELY. The user will Accept/Reject each domain individually. Do NOT exclude domains because they seem low priority or future scope — the user decides, not you." Recommending a *merge* is precisely the kind of pre-pruning the bloom-pass mandate prohibits. A reviewer that understood the role's mandate would have said: "the two domains overlap on Violation Notice / Notice of Violation; surface this as a coordination note in the rationales so the user can decide whether to merge during pruning." The reviewer instead treats this as an architectural-cleanliness concern from a downstream-design perspective, which is the wrong jurisdiction for a bloom pass.

**Severity: over-calibrated.** MEDIUM is too high for a bloom-pass overlap that the user's pruning step is *designed to handle*. LOW with a "coordinate-not-merge" recommendation would be calibrated.

**Anchored to evidence: yes** (cites the two domain IDs and the violation-notice entity overlap implicitly).

#### Finding 2 — "Redundancy and scope creep in administrative domains" (MEDIUM)

> "The agent created DOM-LEDGER (Trust Ledger/Audit Trails) and DOM-AUDIT (Internal Oversight/Administration). … This separation overcomplicates the architecture by treating internal operational monitoring as a core business domain."

**Substantive accuracy: solid hit, partly for the wrong reason.** DOM-AUDIT is genuinely problematic — but as established in §1a.6, the deeper defect is that DOM-AUDIT.description ("Tools for P-ADMIN to execute service calls human-in-the-loop and monitor platform health") is a *persona's tool list*, not a business domain. The reviewer correctly identifies that DOM-AUDIT does not stand on its own as a business domain, then explains the symptom (scope creep) rather than the cause (admin-tool-list-as-domain). The recommendation ("Merge … into DOM-LEDGER" or "rename to DOM-ADMINISTRATION") is again merge-flavoured, but the pruning-against-the-bloom-mandate critique is weaker here because DOM-AUDIT is closer to "not a real proposal" than to "two proposals the user could legitimately accept independently."

**Severity: correctly calibrated** at MEDIUM. The audit/ledger split is structurally weak in a way that pruning alone cannot easily fix — the user reading the cards has no signal to choose between "audit-trail-as-domain" and "admin-tools-as-domain" because the descriptions overlap.

**Anchored to evidence: yes** (cites the two domain IDs and lists DOM-AUDIT's entityPreview content explicitly).

#### Finding 3 — "Potential for unnecessary domain fragmentation" (LOW)

> "DOM-PROPERTY and DOM-COMMUNITIES … creates a fragile coupling point. … Keep the domains separate but refine the rationale to emphasize that DOM-COMMUNITIES is purely an integration/context layer that *feeds* data into DOM-PROPERTY and DOM-GOVERNANCE."

**Substantive accuracy: noise.** The recommendation contradicts the finding's own thesis: the "concern" is that the two domains are fragmented, but the recommendation is "keep the domains separate". That is a non-finding; it is an observation that the rationale could be clearer about an integration relationship. The DOM-COMMUNITIES domain directly traces to requirement R6 ("manage external HOA context (even when the HOA is not a direct platform participant)"), which is a *substantively distinct* concern from DOM-PROPERTY (owner-side asset registry). Conflating them would damage the bloom output, not improve it.

**Severity: correctly calibrated** at LOW (it is a rationale-clarity nudge, not a defect).

**Anchored to evidence: weakly** — the finding does not quote the rationales it recommends refining, only names the two domain IDs.

**Self-cancelling structure:** the finding's `summary` says "fragmentation"; the `recommendation` says "keep the domains separate." This is the analogue of the `hasConcerns: false ↔ concerns: [...]` contradiction the original redesign note flagged — at the *individual-finding* level rather than the response level. A finding whose recommendation is "do not change the structure" should not be a finding at all; it is at most a comment on rationale wording.

#### Reviewer findings — summary

| # | Hit / partial / noise | Severity calibration | Evidence anchor |
|---|---|---|---|
| 1 | Partial hit (overlap real; merge recommendation violates bloom mandate) | Over-calibrated (MEDIUM → LOW) | Adequate |
| 2 | Solid hit (right defect, partly wrong cause) | Correct (MEDIUM) | Adequate |
| 3 | Noise (self-cancelling) | Correct (LOW) | Weak |

Net: **one solid hit, one partial hit, one noise finding.** The reviewer is operating at a "downstream-architecture cleanliness" jurisdiction rather than the bloom-pass mandate jurisdiction.

### 1c. What the reviewer missed

Categorised by severity, anchored to §1a items:

**HIGH severity — missed:**

- §1a.1 **Source-tag fabrication.** Eleven of fourteen domains are tagged `user-specified` against a source that enumerates no domains. This is the highest-impact defect in the response because it pollutes the user's pruning signal. A reviewer prompt that includes any positive instruction to compare claimed-source-tag against actual source content would catch it.

**MEDIUM severity — missed:**

- §1a.2 **Persona ID mutation** (`P-CAM_MANAGER` → `P-CAM-MANAGER`).
- §1a.3 **Three-pillar concept absent.** The single most prominent organizing structure in the source goes unrepresented.
- §1a.4 **Fabricated `P-FINANCE-OFFICER`** without journey or stakeholder anchor (P-AUDITOR is more defensible).
- §1a.5 **Pain-point inflation** on `P-BOARD`, `P-ADMIN`, `P-CAM-MANAGER` and goal-loss on `P-HOMEOWNER`.
- §1a.6 **DOM-AUDIT is a persona's tool list, not a business domain** (the reviewer caught a symptom, not the cause).
- §1a.8 **Persona self-pruning against the bloom mandate.**

**LOW severity — missed:**

- §1a.7 entityPreview / workflowPreview confusion (Workflow Bot, Recommendation Engine in entityPreview).
- §1a.9 Phase-rationale leakage and inconsistency.
- §1a.10 Speculative-axis flagging absent on AI-proposed items.
- Internal inconsistency: DOM-GOVERNANCE.rationale references `P-CAM_MANAGER` while the personas array lists `P-CAM-MANAGER`.

The reviewer's three findings sit entirely in an "architectural-cleanliness" register; the response's *substantive* defects sit in a "source-attribution and identity hygiene" register. The two registers do not overlap. This is the most informative single observation about the gemma reviewer's behaviour across samples 01–05: when it speaks, it speaks about taste; when it should be speaking about evidence, it is silent. Sample 04 showed silence as the failure mode; sample 05 shows that even when the gate fires, the findings are off-axis.

---

## 2. Diagnosis

The role-specific failure modes for a business-domains-and-personas bloom pass:

1. **Source-tag fabrication.** The contract has a three-valued `source` field whose entire purpose is to support user pruning by separating "you said this" from "we inferred this". The agent collapses the distinction by over-claiming `user-specified`. The fix is a validator that, for every item tagged `user-specified`, requires a source-span anchor at the claim level — the *domain name* or *capability* must appear in the source, not just be implied by it.

2. **Persona-ID identity drift.** Personas inherited from upstream passes are ID-stable references; mutating their IDs silently breaks cross-document graphs. The fix is a deterministic pre-pass that compares input persona IDs to output persona IDs and flags any non-additive change.

3. **Pillar / domain organizational confusion.** When the source explicitly names super-domains ("three pillars"), a bloom that emits a flat domain list without representing the super-structure has discharged half the mandate. The fix is a validator that detects source-named organizing concepts (pillars, modules, tiers, suites) and checks the response represents them in some form (super-domain, axis-tag, rationale-annotation).

4. **Persona-without-anchor fabrication.** The bloom mandate licenses expansive proposal but not unanchored proposal. AI-proposed personas need at least one of: a journey-step they own, a domain they are a stakeholder in, a source span that hints at their existence. Personas with none of these are noise the user cannot prune intelligently.

5. **Pain-point and goal inflation under `user-specified`.** When the agent extends an inherited persona's pain points or goals, those new items must be flagged separately from the source-attested ones, or they smuggle inference into the user's pruning surface.

6. **Bloom-vs-extraction discipline.** The bloom mandate ("err on the side of over-proposing") is in tension with the agent's natural tendency to self-prune. The thinking chain shows nine persona candidates considered and seven rejected on grounds the bloom mandate explicitly forbids. The fix is a validator that compares thinking-chain candidates to response items and flags candidates dropped on grounds of "low priority", "future scope", or "too niche".

7. **Cross-domain entity collisions.** When two domains list the same or near-same entity (`Violation Notice` / `Notice of Violation`), the response should record the coordination note explicitly. The fix is a deterministic entity-overlap detector with a coordination-note completeness check.

8. **Domain-as-persona-tool-list anti-pattern.** DOM-AUDIT shows the failure mode where a domain's description reduces to a persona's UI surface ("Tools for P-ADMIN…"). The fix is a validator that checks each domain's description for persona-anchored framing and downgrades the domain to "not a domain" when the description does not stand independently of any single persona.

9. **Source field over-loading on inferences.** The Hestami source has explicit signals that an honest `ai-proposed` tag would attach to (DOM-VENDOR, DOM-BID, DOM-LEDGER, DOM-COMMUNITIES, DOM-AI-ENG). The agent's tag-collapse is not a single-item slip; it is a systemic pattern. The validator must scan all items, not sample.

10. **`entityPreview` / `workflowPreview` shape drift.** Entities are nouns the system stores; workflows are verbs the system runs. Treating "Workflow Bot" or "Recommendation Engine" as entities is a contract-shape slip that downstream phases (Phase 1.1 entity model, Phase 2 workflow scaffolding) will trip on.

---

## 3. Recommended validator pipeline for this role

Eight validators. Two deterministic, six LLM-based. Three are reuses (parameter-variation) of validators introduced in samples 01–04; five are role-specific to the bloom pass.

| # | Validator | Type | Status vs. samples 01–04 |
|---|-----------|------|--------------------------|
| 1 | `contract_schema_bloom` | deterministic | parameter-variation of `contract_schema_*` family |
| 2 | `persona_id_continuity` | deterministic | **NEW — role-specific** (input-vs-output ID-set diff) |
| 3 | `source_attribution_grounding` | LLM | **NEW — role-specific** (verifies `source` field tag against source span) |
| 4 | `pillar_domain_alignment` | LLM | **NEW — role-specific** (super-domain / organizing-concept coverage) |
| 5 | `domain_persona_coherence` | LLM | **NEW — role-specific** (every persona has a domain-stakeholder anchor; every domain has at least one persona) |
| 6 | `bloom_completeness_vs_thinking` | LLM | **NEW — role-specific** (thinking-chain candidates dropped against bloom mandate) |
| 7 | `entity_workflow_shape` | deterministic-or-LLM | **NEW — role-specific** (entity-vs-workflow noun/verb classification) |
| 8 | `open_question_vs_decided` | LLM | exact reuse from sample 03/04 (parameterised for personas/domains: surfaced inferences should be flagged speculative, not committed) |
| 9 | `reasoning_to_response_faithfulness` | LLM | exact reuse, cross-role |

`final_synthesis` from `redesign recommendations - 1.md` §7 applies unchanged.

**Validators that explicitly DO NOT apply to this role:**

- `regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness` (sample 04) — compliance is downstream of the bloom.
- `scope_boundary_adherence_*` (sample 03) — the bloom is *intended* to expand into adjacent territory; sibling-pass drift is the desired behaviour, not a defect.
- `tier_decomposition`, `measurement_adequacy` — not a decomposition pass.

### 3.1 Role-specific positioning

The bloom pass occupies an unusual position in the validator design space because its mandate *inverts* the mandate of the discovery passes that came before it. Discovery passes are extraction-only ("transcribe what the source states"); the bloom is synthesis ("propose ALL business domains and personas this product should encompass"). Validators that protect against synthesis (sample 03's `scope_boundary_adherence_discovery`, sample 04's `compliance_signal_completeness`) do not transfer. The bloom's failure modes are different: under-proposal, mis-attribution of synthesis as extraction, and incoherence between proposals.

The most consequential design implication is that `source_attribution_grounding` (§4.3 below) is the bloom's analogue of the discovery passes' grounding validators — but inverted. Discovery grounding asks "is every claim supported by the source?"; bloom grounding asks "is every claim *correctly tagged* by its relationship to the source?" The agent is licensed to invent; it is not licensed to mislabel inventions as extractions.

---

## 4. Validator prompt templates

### 4.1 `contract_schema_bloom` (deterministic)

Pseudocode:

```ts
function validateBloomContract(r: BloomResponse): Finding[] {
  // 1. JSON parseable, no markdown fences, no trailing prose.
  // 2. Top-level: { kind: "business_domains_bloom", domains: [...], personas: [...] }.
  // 3. domains length ∈ [1, 30] (warn at <6 or >20 per prompt's "expected coverage").
  // 4. personas length ∈ [1, 20] (warn at <3 or >10).
  // 5. Each domain: { id, name, description, rationale,
  //                   entityPreview: string[], workflowPreview: string[], source }.
  // 6. domain.id matches /^DOM-[A-Z0-9-]+$/ (NOT underscore; bloom uses hyphen).
  // 7. domain.source ∈ {user-specified, ai-proposed, domain-standard}.
  // 8. domain ids unique.
  // 9. Each persona: { id, name, description, goals: string[],
  //                    painPoints: string[], source }.
  // 10. persona.id matches /^P-[A-Z0-9_-]+$/.
  // 11. persona.source ∈ {document-specified, ai-proposed, domain-standard}.
  //     (note: bloom contract uses "document-specified" not "user-specified" for personas — flag if mismatched.)
  // 12. persona ids unique.
  // 13. entityPreview / workflowPreview non-empty (contract example shows ≥2 each).
  // 14. No item with empty rationale or empty description.
}
```

Severity: HIGH for parse / branch / enum failures; MEDIUM for count out-of-band; LOW for empty-string slips.

### 4.2 `persona_id_continuity` (deterministic)

```ts
function validatePersonaIdContinuity(input: SeedPersonas, output: BloomPersonas): Finding[] {
  // 1. For every id in input.personaIds:
  //    - exact match in output.personaIds → OK (continuity preserved)
  //    - no exact match, but a normalize(id) match exists → MEDIUM (id_drift_normalized)
  //      (e.g., P-CAM_MANAGER → P-CAM-MANAGER)
  //    - no match at all → HIGH (input_persona_dropped)
  //      (the bloom mandate says "include ALL in your output")
  // 2. For every id in output.personaIds not in input.personaIds:
  //    - persona.source == "ai-proposed" → OK
  //    - persona.source == "document-specified" → HIGH (fabricated_source_tag)
  // 3. Cross-reference check: if any domain.rationale or domain.entityPreview
  //    references a persona id (e.g. "P-CAM_MANAGER" or "P-CAM-MANAGER"),
  //    that id must appear in personas[]. Flag dangling refs as MEDIUM.
}
```

This validator catches §1a.2 deterministically, plus §1a.9's internal-inconsistency case (`P-CAM_MANAGER` in DOM-GOVERNANCE.rationale vs `P-CAM-MANAGER` in personas).

### 4.3 `source_attribution_grounding` (LLM, NEW)

```text
[MISSION]
Confirm that every domain and persona in the bloom output is tagged with a
`source` value that accurately reflects its relationship to the source
context. The bloom is a synthesis pass — the agent is licensed to propose
items the source does not name. The agent is NOT licensed to mislabel a
proposed item as `user-specified` (for domains) or `document-specified`
(for personas).

[IN-SCOPE]
- domains[].id, .name, .description, .source against the SOURCE CONTEXT block.
- personas[].id, .name, .description, .goals, .painPoints, .source against the
  PRODUCT SCOPE block (specifically the Discovered Personas section).

[DECISION STANDARD]
For each domain item:
  - If source == "user-specified": the SOURCE CONTEXT must contain a span
    that names this domain or its primary capability area in language the
    agent paraphrases minimally. A capability *implication* (e.g.,
    requirement "view, compare, and approve service bids" implying a
    Bid Management domain) is NOT sufficient evidence for "user-specified" —
    it is `ai-proposed`.
  - If source == "ai-proposed": the agent claims inference. No source
    anchor required, but the rationale must explain the inference path.
  - If source == "domain-standard": the domain is industry-conventional.
    Verify the domain is genuinely industry-standard (DOM-IDENTITY,
    DOM-COMM, DOM-FINANCE, DOM-COMPLIANCE qualify; DOM-AI-ENG does not —
    AI-orchestration is not yet conventional).

For each persona item:
  - If source == "document-specified": the persona id, name, goals, and
    pain points must each trace verbatim or near-verbatim to the
    Discovered Personas seed list. Adding new pain points or goals
    under "document-specified" is a fabricated_attribute defect.
  - If source == "ai-proposed": the persona must be anchored to a journey,
    a domain stakeholder relationship, or a source span. A persona with
    none of these is an unanchored_persona defect.

[SEVERITY GUIDE]
- HIGH: a domain tagged `user-specified` whose name and primary capability
  do not appear in the source.
- HIGH: a persona tagged `document-specified` with goals or pain points
  added beyond the seed list.
- MEDIUM: a domain tagged `user-specified` whose capability is implied but
  not named (should be `ai-proposed`).
- MEDIUM: a persona tagged `ai-proposed` with no journey / domain /
  source-span anchor.
- LOW: a `domain-standard` tag on a domain that is conventional but
  arguably industry-specific (borderline).

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "source_attribution_grounding",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "fabricated_user_specified" | "implied_not_named"
            | "fabricated_document_specified" | "unanchored_persona"
            | "borderline_domain_standard",
      "itemKind": "domain" | "persona",
      "itemId": "DOM-X | P-X",
      "claimedSource": "user-specified | document-specified | ai-proposed | domain-standard",
      "sourceEvidence": [
        {"sourceSpan": "verbatim source span or 'none found'",
         "relationship": "names | implies | absent"}
      ],
      "detail": "Why the source tag does not match the evidence",
      "recommendation": "Retag as ai-proposed | add anchor in rationale | remove from output."
    }
  ],
  "overallAssessment": "..."
}
```

This is the validator that catches §1a.1 (the largest defect). It is also the validator the gemma reviewer's prompt template is *least* equipped to produce — the current prompt's "Look for: assumptions stated as facts without validation" gestures at this dimension but provides no positive instruction to compare a `source` field against a source span.

### 4.4 `pillar_domain_alignment` (LLM, NEW)

```text
[MISSION]
Confirm that source-named organizing concepts (pillars, modules, suites,
tiers) are represented in the bloom output. The bloom mandate is
comprehensive coverage; if the source organizes its scope around a
super-structure, the output must surface that super-structure somewhere.

[IN-SCOPE]
- The Product Description and Phasing Strategy sections of the SOURCE
  CONTEXT, scanned for organizing-concept tokens: "pillar", "module",
  "suite", "tier", "phase", "track", "workstream", "sub-product".
- The bloom output: domains[], personas[], and every rationale field.

[DECISION STANDARD]
A finding is valid when:
- The source explicitly names ≥2 organizing-concept members
  (e.g., "three pillars: Home Real Property Assistant, Service Provider
  Field Services Management, Community Association Management").
- AND the bloom output does not represent the organizing concept in any
  of these forms:
    (a) super-domain entries (e.g., DOM-PILLAR-HOME, DOM-PILLAR-PROVIDER, DOM-PILLAR-CAM)
    (b) a parent / membership field on each domain
    (c) a separate top-level array (pillars[], modules[])
    (d) consistent rationale-annotation across all domains identifying the
        pillar each domain belongs to (consistent = ≥80% of domains
        rationales mention a pillar by name)

[SEVERITY GUIDE]
- HIGH: source names ≥3 organizing concepts and the bloom output
  represents none of them.
- MEDIUM: source names organizing concepts and the bloom output represents
  them inconsistently (some rationales mention; most do not).
- LOW: source uses organizing-concept language casually (e.g., a single
  reference to "modules" with no enumeration).

[INPUTS, OUTPUT CONTRACT — same shape as §4.3]
```

Catches §1a.3.

### 4.5 `domain_persona_coherence` (LLM, NEW)

```text
[MISSION]
Confirm bidirectional coverage between domains and personas: every
persona is a stakeholder in at least one domain (visible via rationale,
description, or workflowPreview reference); every domain has at least one
persona who is a primary actor or beneficiary.

[IN-SCOPE]
- domains[].rationale, .description, .workflowPreview (textual references
  to persona ids or names).
- personas[].description, .goals, .painPoints (textual references to
  domain ids or names).
- The Discovered User Journeys section of the SOURCE CONTEXT (each
  journey lists its primary persona).

[DECISION STANDARD]
For each persona:
  - Find any domain whose rationale, description, or workflowPreview
    references the persona id, name, or role-keyword.
  - If no domain references the persona, this is an
    orphan_persona finding.
  - The Discovered User Journeys provide ground-truth persona-stakeholder
    relationships (UJ-SETUP-PROPERTY → P-HOMEOWNER, etc.); a persona who
    is the lead of a journey must appear in at least one domain's
    workflowPreview or rationale.

For each domain:
  - Find any persona whose description, goals, or pain points reference
    the domain's primary capability.
  - If no persona references the domain, this is an
    actorless_domain finding.

[SEVERITY GUIDE]
- HIGH: a `document-specified` persona has zero domain references
  (means the seed persona has been imported without integration).
- MEDIUM: an `ai-proposed` persona has zero domain references AND zero
  source-span anchor (combined with §4.3's unanchored_persona finding,
  this is the strongest signal that the persona is noise).
- MEDIUM: a domain has zero persona references (the bloom synthesised an
  area with no stakeholder).
- LOW: a domain references personas only in entityPreview (entities are
  not actors).

[INPUTS, OUTPUT CONTRACT — same shape as §4.3]
```

Catches §1a.4 (the unanchored P-FINANCE-OFFICER and P-AUDITOR personas) and §1a.6 (DOM-AUDIT references only P-ADMIN, with description that *is* P-ADMIN's tool list — actorless if P-ADMIN is not actually a domain stakeholder).

### 4.6 `bloom_completeness_vs_thinking` (LLM, NEW)

```text
[MISSION]
Confirm that domains and personas the agent considered in its thinking
chain were either committed to the response or rejected on grounds the
bloom mandate permits. The bloom mandate explicitly forbids self-pruning
on the grounds of low priority or future scope.

[IN-SCOPE]
- AGENT_REASONING: scan for candidate proposals ("Add P-X?", "DOM-Y?",
  "Maybe", "Should I include").
- AGENT_RESPONSE: domains[] and personas[].

[DECISION STANDARD]
For each candidate identified in the reasoning:
  - If the candidate appears in the response: OK.
  - If the candidate is rejected with a rationale matching one of the
    permitted-rejection patterns: OK. Permitted patterns include:
      - "duplicates an existing item" (with the existing item named)
      - "not implied by the source in any way"
      - "would conflict with [specific contract rule]"
  - If the candidate is rejected with a rationale matching a
    forbidden-rejection pattern, this is a self_pruning finding.
    Forbidden patterns include:
      - "low priority"
      - "future scope" / "Phase X+1" / "too far Phase Y"
      - "too niche"
      - "covered by [persona/domain]" without showing the coverage
      - "let's keep it tighter"
      - "let's stick to the core"

[SEVERITY GUIDE]
- MEDIUM: ≥3 candidates rejected on forbidden patterns.
- LOW: 1–2 candidates rejected on forbidden patterns.

[INPUTS, OUTPUT CONTRACT — same shape as §4.3]
```

Catches §1a.8. This validator's outputs are most useful as guidance for tuning the agent's prompt, not as gating signals — hence the LOW–MEDIUM ceiling.

### 4.7 `entity_workflow_shape` (deterministic-or-LLM)

```ts
function validateEntityWorkflowShape(r: BloomResponse): Finding[] {
  // For each domain:
  // 1. entityPreview items should be noun phrases naming things the
  //    system stores or tracks (records, documents, accounts, profiles).
  //    Anti-patterns: items ending in "-er", "-or", "Engine", "Bot",
  //    "Service", "System", "Workflow" (these are usually actors or
  //    workflows, not entities).
  // 2. workflowPreview items should be verb-phrases (imperative or
  //    gerund) naming actions the system runs.
  //    Anti-patterns: items that are noun phrases without verbs.
  // 3. Cross-check: an entityPreview item should not duplicate any
  //    workflowPreview item in the same domain.
}
```

The check is mostly deterministic via suffix / first-word part-of-speech heuristics; an LLM fallback can be invoked for items that fail the heuristic but might be legitimate noun-phrases the heuristic doesn't recognise. Catches §1a.7 ("Workflow Bot", "Recommendation Engine" in DOM-AI-ENG.entityPreview).

### 4.8 `open_question_vs_decided` — exact reuse

Sample 03 §4.6's structure carries unchanged. For the bloom pass the configuration narrows in two ways:

- The trigger condition shifts from "thresholds and decisions in discovery output" to "AI-proposed items committed without speculative-axis flags". An `ai-proposed` domain or persona whose rationale presents the proposal as if it were a decided product feature — rather than a candidate the user should consider — fires the validator.
- The cross-array semantic-similarity check operates over `domains[]` and `personas[]` partitioned by `source` tag.

### 4.9 `reasoning_to_response_faithfulness` — exact reuse

Cross-role validator from sample 01 §4.6 / sample 04 §4.10. Role-specific markers for the bloom:

- "I will use `P-CAM-MANAGER` for consistency" / "I will fix `P-CAM_MANAGER`" — rule-commitment statements that are made *and respected* in the response, but where the rule itself contradicts the persona-continuity contract (the agent obeys its self-set rule and breaks the upstream contract). Faithfulness validators must distinguish "agent committed to a rule and respected it" from "agent committed to the *correct* rule" — the validator should flag this as `faithful_to_wrong_rule`.
- "Let's stick to the core" / "Let's keep it tighter" — bloom-mandate-violation markers (overlaps with `bloom_completeness_vs_thinking`).
- Persona-count adjudication ("Wait, check counts: 6-20 domains, 3-10 personas") that drives self-pruning to fit the lower bound rather than the upper bound — the bloom mandate explicitly prefers over-proposing, so converging on 9 personas when the thinking surfaced 12+ candidates indicates lower-bound bias.

Severity unchanged from prior samples.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_bloom` | yes (deterministic) | `agent_role == "domain_interpreter" && sub_phase == "business_domains_bloom"` |
| `persona_id_continuity` | yes (deterministic) | same; only if input has `discoveredPersonas` |
| `source_attribution_grounding` | yes (LLM) | same; skip if contract failed |
| `pillar_domain_alignment` | conditional (LLM) | source contains organizing-concept tokens (pillar/module/suite); else skip |
| `domain_persona_coherence` | yes (LLM) | same; skip if contract failed |
| `bloom_completeness_vs_thinking` | conditional (LLM) | `agent_thinking_chain.length > 0` |
| `entity_workflow_shape` | yes (deterministic) | same |
| `open_question_vs_decided` | yes (LLM) | same; skip if contract failed |
| `reasoning_to_response_faithfulness` | conditional (LLM) | `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_bloom                     (deterministic, gate)
2. persona_id_continuity                     (deterministic)
3. entity_workflow_shape                     (deterministic / LLM fallback)
4. source_attribution_grounding              (LLM — primary semantic check)
5. domain_persona_coherence                  (LLM)
6. pillar_domain_alignment                   (LLM, conditional)
7. open_question_vs_decided                  (LLM)
8. bloom_completeness_vs_thinking            (LLM, conditional)
9. reasoning_to_response_faithfulness        (LLM, conditional)
10. final_synthesis                          (LLM, unchanged)
```

`source_attribution_grounding` runs early because the largest defect class on this sample (§1a.1) is in its jurisdiction; a HIGH finding there is the strongest single signal for synthesis. `domain_persona_coherence` runs after attribution because its judgements depend on knowing which personas/domains are licensed inferences vs unanchored fabrications. `pillar_domain_alignment` is conditional on the source containing organizing-concept tokens — sample 05's source qualifies; many sources will not.

### 5.2 Deterministic vs LLM split

- **Deterministic:** `contract_schema_bloom`, `persona_id_continuity`, `entity_workflow_shape`. The first two are pure structural checks; the third uses simple part-of-speech heuristics with an LLM fallback for ambiguous items.
- **LLM:** `source_attribution_grounding`, `pillar_domain_alignment`, `domain_persona_coherence`, `open_question_vs_decided`, `bloom_completeness_vs_thinking`, `reasoning_to_response_faithfulness`. Each of these requires semantic comparison between source spans and response items that cannot be reduced to regex.

### 5.3 Integration with samples 01–04

- `contract_schema_*` registry pattern reinforced; this is the fourth role-keyed entry. The contract shape diverges enough from the discovery passes that no logic is shared, but the dispatch / output shape is identical.
- `open_question_vs_decided` and `reasoning_to_response_faithfulness` are now confirmed cross-role validators (samples 01, 03, 04, 05 all reuse). Their parameterisation across roles is mechanical: the threshold-detection regexes change, the output schema does not.
- `scope_boundary_adherence_*` does NOT generalise to the bloom. The bloom is *intended* to expand into adjacent territory; sibling-pass drift is the desired behaviour. This is the first sample in the series where the family is excluded by design.
- `regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness` do not apply (compliance is downstream of the bloom).

### 5.4 Cross-validator deduplication

Three overlap pairs to manage in `final_synthesis`:

- `source_attribution_grounding` (fabricated_document_specified for added pain points) and `persona_id_continuity` (input_persona_dropped if the persona was effectively replaced). Treat attribution as primary when the persona id is preserved but attributes mutated; treat continuity as primary when the id changed.
- `source_attribution_grounding` (unanchored_persona) and `domain_persona_coherence` (orphan_persona). The two validators view the same defect from different angles (no source anchor vs no domain stakeholder). Treat coherence as primary because the recommendation is more actionable ("attach the persona to a domain rationale" rather than "remove or retag").
- `bloom_completeness_vs_thinking` (self_pruning) and `reasoning_to_response_faithfulness` (faithful_to_wrong_rule). Independent: completeness audits the candidates dropped; faithfulness audits the rules applied.

### 5.5 Cross-role validator promotion hypotheses

- `source_attribution_grounding`: stays role-specific. The bloom is the only pass with a three-valued source field at this granularity. (1.0d had a similar but smaller-scale tagging dimension; the validator family could potentially extend there, but the failure mode in 1.0d was not source-tag fabrication.)
- `pillar_domain_alignment`: potentially generalisable to any pass that operates on a source with explicit organizing concepts (Phase 2 architecture, Phase 4 component-decomposition). Defer the generalisation until those samples are seen.
- `domain_persona_coherence`: stays role-specific to the bloom and any downstream passes that maintain the domain ↔ persona graph (Phase 1.6 entity model, Phase 2 architecture).
- `bloom_completeness_vs_thinking`: stays role-specific. The "permitted rejection patterns" list is bloom-specific; in extraction passes, self-pruning is correct behaviour.
- `entity_workflow_shape`: extends to any pass that emits typed lists of nouns and verbs (Phase 1.6 entity model, Phase 2 workflow scaffolding).

---

## 6. Notes and open questions

1. **The reviewer's findings sit in the wrong jurisdiction.** All three findings are about architectural cleanliness ("merge these", "redundant", "fragmentation"); none is about source-attribution honesty, identity hygiene, or organizing-concept coverage — which is where the largest defects live. This is informative beyond this sample: a reviewer prompt that lists "look for over-confidence, contradictions, fragile coupling" generalises to "find any architectural-cleanliness concern" because architectural cleanliness is the most easily-pattern-matched defect class. A redesigned reviewer prompt for this role must positively instruct the model to *check the source field against source spans* and *check input-persona-ids against output-persona-ids* — these are not natural attention targets for a generalist reviewer.

2. **The "merge these domains" recommendation is anti-bloom.** Two of the three reviewer findings recommend merging proposals. The bloom mandate explicitly forbids the *agent* from pre-pruning; by symmetry, the *reviewer* should not be recommending merges either — that is the user's job. A reviewer that recommends merges has misunderstood the role. Recommend that the reviewer prompt include a positive statement: "This is a proposal pass. The user prunes. Findings should target *what the user cannot prune well* (mislabelled provenance, broken cross-references, missing organizing concepts) rather than *what the user might want to merge* (overlapping domains, redundant proposals)."

3. **Sample 05 is a useful regression-test fixture for source-tag fabrication.** Eleven of fourteen domains are mistagged. A future agent change that reduces the count to, say, four mistagged is measurable improvement; reducing to zero is the target. Recommend adding this sample to the validator-development test suite with an expected `source_attribution_grounding` finding count of ≥10 HIGH/MEDIUM findings on the current agent output.

4. **Persona-ID mutation is a deterministic-recovery defect.** The fix is a simple normalize step in the workflow (after the bloom emits its output, run a pass that maps any mutated persona ID back to its input form). This does not require the agent to behave differently; it requires the harness to defend against agent ID-drift. Recommend the `persona_id_continuity` validator's HIGH findings be auto-recoverable by the harness when the mutation is purely cosmetic (underscore↔hyphen with the same slug stem). Hard ID renames (e.g., `P-BOARD` → `P-BOARD-MEMBER`) require human review.

5. **Pillar representation is the missing first-class concept.** The Hestami source's three-pillar structure is the strongest source signal in the entire prompt — it appears in the vision, the description, *and* the phasing strategy — and the agent treats it as decorative rationale text. Recommend the bloom's contract be extended in a future revision to include an optional `pillars[]` or `parentPillar` field on domains; until then, `pillar_domain_alignment` is the only check that the source-named super-structure is represented at all.

6. **Source field on personas uses `document-specified`, not `user-specified`.** The contract example specifies `document-specified|ai-proposed|domain-standard` for personas (note the field is *different* from domains' `user-specified|ai-proposed|domain-standard`). The agent emits `user-specified` for all input-attributable personas, which is a contract-shape violation (`contract_schema_bloom` step 11). The reviewer did not catch this. Symptomatic of the gemma reviewer not parsing the contract example block at all.

7. **Cross-pass coordination with Phase 1.6 (entity model) is not validated here.** The bloom's `entityPreview` and `workflowPreview` arrays are the primary input to Phase 1.6's entity decomposition. A bloom that fabricates entity names (`Workflow Bot`) or duplicates entities across domains (`Violation Notice` / `Notice of Violation`) propagates noise into 1.6. None of the validators in this pipeline enforce coherence with 1.6 because 1.6 has not been sampled yet. Defer.

8. **The `bloom_completeness_vs_thinking` validator is a positive-rewarder.** Like sample 04's `retention_threshold_grounding`, this validator is most useful when it returns `passed: true` — a thinking chain that surfaced 12 persona candidates and committed all 12 is a stronger signal of bloom-mandate adherence than one that surfaced 5 and committed all 5. Recommend the synthesis layer treat `passed: true` from this validator with high candidate count as a positive quality signal, not just absence of defect.

9. **The reviewer's contradictory `recommendation` in finding 3 is the same structural family as the original `hasConcerns:false ↔ concerns.length>0` defect.** A finding whose recommendation contradicts its summary is a self-cancelling finding. Recommend `final_synthesis` cross-check each finding's `summary` against its `recommendation` and flag self-cancelling pairs as inconsistency findings on the validator itself. This generalises the "Boolean gate consistency" check from `redesign recommendations - 1.md` §1 to "intra-finding consistency".

10. **Sample 05 closes the question of whether the `scope_boundary_adherence_*` family applies to bloom passes.** It does not: the bloom is intentionally trans-sibling. This is the first negative-result on the family's generalisation question; samples 03 and 04 both confirmed its applicability. The combined picture is that the family applies to *extraction* passes (which have a layer assignment) but not to *synthesis* passes (which are licensed to expand). Future samples in the synthesis family (architecture-bloom, component-bloom) likely have analogous exemptions.
