# Assessment: orchestrator / release_plan (Phase 1.13)

**Sample:** `track_c_samples/08_orchestrator__release_plan.md`
**Reviewed agent:** `orchestrator` (release_planner role) running `qwen3.5:9b` (3.3 KB JSON response, ~37 KB thinking chain — by far the highest thinking-to-response ratio in the corpus, ~11×)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

This is the **second synthesis pass** in the corpus, the structural sibling of sample 07 (product_description_synthesis). Where 07 compressed 9 personas / 14 domains / 19 integrations into a 4-field narrative, sample 08 compresses 27 accepted journeys plus a 3-phase strategy hint plus 14 domains plus an implicit dependency graph into a structural plan: 4 releases, 27 journey-to-release assignments, 4 names, 4 descriptions, 4 rationales. The compression rate is comparable; the failure surface is qualitatively different.

The sibling angle matters. Sample 07 introduced five generalisable synthesis-class validators (`synthesis_coverage_audit`, `synthesis_fabrication_check`, `handoff_field_completeness`, `compression_fidelity_audit`, `phasing_dependency_consistency`). Sample 07's `phasing_dependency_consistency` was vacuous because the product_description contract has no phasing field. **Sample 08 is the first place that validator becomes load-bearing.** The other four should carry forward with variation in unit-of-analysis but not in defect class.

The reviewer fired `has_concerns: false` again, with the assessment: *"The plan is logically sound, adheres strictly to all constraints (especially full coverage of all 27 journeys), and successfully structures the complex product vision into four distinct, dependency-respecting, and value-increasing releases."* On a plan that places **vendor browsing in REL-1 before any provider has registered (REL-2)**, places **job execution in REL-2 before vendor vetting (REL-3)**, places **financial reserve transfers in REL-3 before audit trails exist (REL-4)**, and **demotes [Phase 1]-tagged investor journeys to REL-4** without rationale, "dependency-respecting" is empirically false on at least three independent axes. This is the same false-negative gate outcome as sample 07, and the same root cause: the reviewer is reading bloom-class defect categories against a synthesis-class artefact, and the synthesis-class defects are subtractive (omission, silent-decision, dependency-back-edge) rather than additive (over-claim, fabrication-of-fact).

The role-specific implication: the synthesis-family validators carry forward, but the unit-of-analysis rotates from *narrative claims* (sample 07) to *structural placements* (sample 08). Coverage flips from "did all personas get named?" to "did all journeys land in exactly one release?" — and is partially deterministic. Fabrication flips from "did new metaphors appear?" to "do release rationales make claims (e.g., 'without requiring association governance') that contradict the placement they justify?". And the previously-vacuous `phasing_dependency_consistency` becomes the dominant validator: it now must traverse a 27-node DAG implied by the journey set's dependencies and verify the wave assignment respects the partial order.

### 1a. Defects in the agent's response

#### 1a.1 Wave-dependency violation: REL-1 vendor browsing depends on REL-2 provider registration

The agent assigns `UJ-BROWSE-VENDORS-AI` ("Homeowner browses AI-curated vendor list for specific trade") to REL-1 and `UJ-REGISTRATION-PROFILE` ("Contractor registers to receive work orders and get paid") to REL-2. Browsing a vendor list requires vendors to exist; registration is the journey that brings vendors into existence.

The thinking chain explicitly notices and *waves away* the violation:

> "REL-1: Homeowner Core (Onboard, Request, Report, View, Urgent). … *Dependency:* Needs vendors to browse? I will assume pre-seeded for MVP."

This is a **silent dependency assumption** that the rationale does not preserve. The REL-1 rationale reads:

> "This release delivers the minimum viable homeowner experience. It focuses on the core property registry and maintenance request lifecycles without dependency on provider vetting or complex governance."

The "without dependency on provider vetting" claim is materially false: AI-curated vendor recommendations require both *registered* vendors and an *AI-curation* (DOM-AI-ENG / INT-AI-LLM) substrate, neither of which REL-1 establishes. The compromise the agent reached internally ("pre-seeded for MVP") is a synthesis-time decision that introduces a hidden integration dependency (manually-seeded vendor records) the orchestrator's downstream deterministic mapping cannot infer.

The corollary defect is that `UJ-BROWSE-CONTRACTORS` (a near-synonym of `UJ-BROWSE-VENDORS-AI`) is placed in REL-2. The agent splits two browsing journeys across two releases on the same substrate, with the AI-curated variant going earlier than the catalog-style variant — the inverse of typical dependency order (AI-curation usually depends on a populated catalog, not vice versa).

**HIGH severity.** This is a phase-order / dependency-violation finding on the validator that was vacuous in sample 07.

#### 1a.2 Wave-dependency violation: REL-2 job execution before REL-3 vendor vetting

`UJ-START-JOB-LOGGING` ("Technician arrives on site and starts job execution") and `UJ-SUBMIT-JOB-TIME-COST` ("Provider logs materials, labor time, and parts used") are both REL-2. `UJ-APPROVE-VENDOR` ("CAM Manager reviews and approves a new vendor for the community") and `UJ-REVIEW-VENDOR-REQ` ("CAM Manager evaluates a vendor against community standards") are REL-3.

Vetting precedes execution in any compliance-respecting release of a regulated marketplace. The substrate makes this explicit: `DOM-COMPLIANCE` is described as "Ensures adherence to statutory notice requirements, **licensing, insurance**, and building codes" and `DOM-VENDOR` as "Discovers, verifies, and matches service providers (contractors) … **Handles licensing and insurance checks**". Both load-bearing for the legality of paid service execution.

The thinking chain catches the issue in two places and chooses to set it aside:

> "*Conflict:* If Provider Onboarding is REL-2, Homeowner Browsing in REL-1 implies vendors exist."
> "*Correction:* UJ-APPROVE-VENDOR is for the Community Association. It's not for the single homeowner repair."

The "Correction" is a half-truth: `UJ-APPROVE-VENDOR` is *also* the only vetting step in the journey set. The agent splits CAM-only vetting from general vetting on a distinction the substrate does not draw — there is no separate "non-HOA vendor approval" journey. Treating REL-2 as governance-free is a placement that lets jobs execute without any vetting having occurred.

**HIGH severity.** Phase-order violation; also a `compliance_sequencing` finding.

#### 1a.3 Wave-dependency violation: REL-3 reserve transfers and finance before REL-4 audit trail

`UJ-INITIATE-RESERVE-TX` ("Finance Officer approves and executes reserve fund allocation"), `UJ-REVIEW-STATEMENT`, `UJ-CAST-VOTE`, and `UJ-SCHEDULE-ANNUAL-MEETING` are all REL-3 — all governed financial / governance actions. `UJ-ACCESS-LOGS` ("Auditor reviews immutable logs for compliance verification") and `UJ-EXPORT-AUDIT-REPORT` are REL-4.

The substrate name `DOM-LEDGER` is "Trust Ledger & Audit Trails — Records decisions and rationales for the 'trust ledger'. **Ensures data integrity and auditability**." The product description (sample 07's output) cites "manage … **financial ledgers, and governance compliance autonomously**" as a defining capability. Releasing reserve-fund transfers before the audit trail capability ships is the precise inversion of the trust-ledger product story: the regulated-money operations exist for a release without the immutable-log surface that justifies trusting them.

The thinking chain considered moving Audit forward:

> "Audit usually comes after Finance. Okay, I'll split Audit into Rel 4 (Audit Report) and Rel 3 (Statement)."

then reverted to placing both audit journeys in REL-4. The split-then-revert is undocumented in the rationale. REL-4's rationale says only:

> "It handles audit trails, access control, and investor portfolio management which build upon the core property and association functionality established in prior releases."

— which inverts cause and effect: audit-trail surfaces should *underlie* governed transactions, not "build upon" them.

**HIGH severity.** Compliance sequencing + dependency-back-edge.

#### 1a.4 Phase-tag override of [Phase 1] investor journeys into REL-4 without rationale

The input lists every accepted journey with a `[Phase N]` tag derived from the upstream Phase 1.0b phasing strategy:

- `UJ-CONNECT-PORTFOLIO [Phase 1]`
- `UJ-EXPORT-PORTFOLIO-DATA [Phase 1]`
- `UJ-APPROVE-VENDOR [Phase 1]`
- `UJ-REVIEW-VENDOR-REQ [Phase 1]`
- `UJ-REGISTRATION-PROFILE [Phase 1]`

The agent places all five in REL-3 or REL-4. The phasing hint is explicitly "treat as hint", so deviation is permitted — but the rationales for REL-3 and REL-4 do not acknowledge the deviation. The thinking chain shows the demotion was deliberate but unjustified:

> "Investor (P-INVESTOR) … Where does Investor fit? … I'll put them in REL-4 to separate from core Homeowner flow, keeping REL-1 focused."

"Keeping REL-1 focused" is a synthesis-time decision that the substrate does not authorise. The Phasing Strategy hint explicitly assigns the Investor surface to Phase 1 ("homeowner experience, property digitization, and service matching") and the Investor pillar is part of the Home Real Property Assistant pillar (DOM-PROPERTY: "long-term asset persistence … residential portfolios"). Demoting Investor to REL-4 strands the entire investor persona for three full release cycles, which is the *opposite* of the substrate's intent.

The same pattern affects `UJ-REGISTRATION-PROFILE [Phase 1]` (placed in REL-2) and `UJ-APPROVE-VENDOR [Phase 1]` (placed in REL-3). The cumulative effect is that **5 of the 14 [Phase 1]-tagged journeys are demoted past REL-1**, with no recorded rationale that compares the agent's plan against the hint.

**MEDIUM severity** as a phase-tag-vs-placement consistency finding; **HIGH severity** as a meta-finding on synthesis discipline (the substrate carried a partial order; the agent overrode it without recording the override).

#### 1a.5 Pillar imbalance: Home Real Property Assistant pillar's investor surface waits 3 releases

Hestami has three pillars (per the sample 07 product description that feeds this synthesis): Home Real Property Assistant, Service Provider Field Services Management, Community Association Management.

Persona-by-release decomposition:

| Release | Pillar 1 (Home) | Pillar 2 (FSM) | Pillar 3 (CAM) | Cross/Other |
|---------|----------------|----------------|----------------|-------------|
| REL-1 | P-HOMEOWNER, P-TENANT (5 journeys + AI-browse) | — | — | — |
| REL-2 | P-HOMEOWNER (browse, approve-bid) | P-PROVIDER (4 journeys) | — | — |
| REL-3 | — | — | P-CAM-MANAGER, P-BOARD, P-FINANCE-OFFICER (9 journeys) | — |
| REL-4 | **P-INVESTOR (2 journeys)** | — | — | P-AUDITOR, P-ADMIN (4 journeys) |

Two pillar-balance defects:

1. **Pillar 1 (Home) is not "complete" until REL-4**, because Investor is part of Pillar 1 and ships last. The release names ("Property Onboarding & Maintenance Reporting" → "Provider Marketplace …" → "Association Governance …" → "Platform Administration & Portfolio Scale") suggest a pillar-by-release mental model, but the actual journey distribution strands a Pillar-1 sub-persona at the end.
2. **Pillar 3 (CAM) ships entirely in REL-3** in a single 9-journey wave, the largest wave in the plan. The substrate's three-pillar story implies sequenced pillar delivery; the agent's plan front-loads pillars 1+2 and back-loads pillar 3 as a monolith, which is a risk-concentration pattern (see §1a.7).

**MEDIUM severity** for the pillar-strand defect on Investor; **MEDIUM severity** for the pillar-monolith defect on CAM.

#### 1a.6 MVP credibility: REL-1 is a dead-letter office

The REL-1 description claims:

> "New homeowners digitize their property records, tenants report issues, and all users can view repair status or request urgent services immediately."

REL-1 contains:
- `UJ-ONBOARD-PROPERTY` (homeowner digitization)
- `UJ-SUBMIT-MAINTENANCE-REQUEST` (homeowner submits a request)
- `UJ-REPORT-TENANT-ISSUE` (tenant reports a problem)
- `UJ-VIEW-REPAIR-STATUS` (tenant tracks status)
- `UJ-REQUEST-URGENT-SERVICE` (tenant flags emergency)
- `UJ-BROWSE-VENDORS-AI` (AI-curated vendor list)

REL-1 does **not** contain:
- Any provider registration (REL-2).
- Any bid invitation, bid receipt, or bid approval (REL-2: `UJ-REQUEST-JOB-INVITE`, `UJ-APPROVE-BID`).
- Any job execution (REL-2: `UJ-START-JOB-LOGGING`, `UJ-SUBMIT-JOB-TIME-COST`).

A homeowner who installs the REL-1 product can submit a maintenance request, view its status (always: "no provider available"), and request urgent service that no one can respond to. The "view repair status" journey is referencing repairs that cannot complete until REL-2. The "request urgent services immediately" claim in the description is empirically inverted by the plan: urgent services are the journey *least* compatible with a wave that has no provider supply.

This is the *MVP credibility* failure mode the rubric anticipated. The rationale's claim of "minimum viable homeowner experience" is not viable because the experience terminates at request-submission. A credible MVP would either: (a) include provider registration in REL-1; (b) restrict REL-1 to journeys that genuinely close without supply (property digitization, document storage, history capture — a "registry-only" MVP); or (c) explicitly call out that REL-1 ships with manually-seeded providers and a back-office dispatch process.

**HIGH severity** as MVP-credibility; **MEDIUM severity** as fabrication (the description claims user value the placement does not deliver).

#### 1a.7 Risk concentration: REL-3 is 9 journeys spanning four personas and three regulatory domains

REL-3 is the largest wave (9 journeys). Its journey set spans:

- CAM operations: `UJ-APPROVE-VENDOR`, `UJ-REVIEW-VENDOR-REQ`, `UJ-REVIEW-STATUTORY-DEADLINES`, `UJ-SCHEDULE-ANNUAL-MEETING`, `UJ-SYNC-COMMUNITY` (5)
- Board governance: `UJ-ACCESS-GOVERNANCE-DOC`, `UJ-CAST-VOTE` (2)
- Finance operations: `UJ-REVIEW-STATEMENT`, `UJ-INITIATE-RESERVE-TX` (2)

Three regulatory domains intersect (DOM-GOVERNANCE, DOM-FINANCE, DOM-COMPLIANCE) plus an external-systems integration (`UJ-SYNC-COMMUNITY`). Four personas land in this wave (P-CAM-MANAGER, P-BOARD, P-FINANCE-OFFICER, plus indirectly P-AUDITOR for the audit trails that *should* be available but aren't yet). REL-1 / REL-2 / REL-4 each carry 6 journeys with at most two personas; REL-3 is an outlier on every concentration metric (journey count, persona count, regulatory-domain count).

This is the *risk concentration* failure mode the rubric anticipated. The thinking chain notices the imbalance ("Rel 3 is heavy. Rel 4 is light (2 items). … I should check if I can move Admin items to Rel 3 or split.") and then declines to rebalance.

**MEDIUM severity.** Risk concentration is a planning quality finding rather than a correctness finding, but the cumulative governance/finance/compliance exposure of a single wave is the load-bearing release in the plan.

#### 1a.8 Open questions silently decided into wave commitments

Sample 07's openLoops carried four open questions. Two of them are silently resolved by the release plan:

- **Q-3 (private vs public listings for vendor matching)**: `UJ-BROWSE-VENDORS-AI` in REL-1 commits to a public-listing browse model. The release plan should either preserve the open question (place the journey in a "Future / Post-Launch" release pending resolution) or explicitly record the resolution in the rationale.
- **Q-4 (service-call lifecycle scope: residential vs commercial within HOA)**: REL-2 (provider job execution) and REL-3 (CAM vendor approval) collectively commit to a unified residential-and-commercial pipeline (no separate journeys for the commercial case). The substrate left this open; the placement closes it.

**MEDIUM severity.** This is the synthesis-class defect of "open question silently resolved by composing the structural prose" in its release-plan variant.

#### 1a.9 Rationale fabrication: "without requiring association governance" contradicts placement

REL-2 rationale:

> "It connects providers to requests, allowing the maintenance workflow to execute and close without requiring association governance."

This is a fabricated decoupling. The accepted-journeys list contains only one vendor-approval pathway (`UJ-APPROVE-VENDOR`, P-CAM-MANAGER, REL-3). The substrate does not provide a second pathway for non-CAM vendor approval. REL-2's claim that maintenance "executes and closes without requiring association governance" is true *only if* the synthesis silently introduced a parallel non-CAM vetting flow — which the agent did not produce and the orchestrator's deterministic mapping cannot derive.

The rationale is composing prose that justifies the placement by asserting a decoupling the substrate does not authorise. This is the **synthesis-time fabrication** defect from sample 07 (§1a.4–1a.5), expressed in release-rationale form rather than productDescription form.

**MEDIUM severity** as fabrication; **LOW severity** as standalone rationale defect.

#### 1a.10 Schema and coverage discipline — passes

Positive results, recorded for the validator-development baseline:

- All 27 accepted journey IDs appear; none duplicated; none invented; none re-slugged. (`UJ-ONBOARD-PROPERTY` matches the input exactly; `UJ-SETUP-PROPERTY` from the phasing hint is correctly *not* used.)
- Ordinals are contiguous from 1 to 4. Release IDs use the `REL-<ordinal>` short form.
- All four required per-release fields are populated with non-trivial content (no placeholders).
- JSON validity holds; no markdown fences; no trailing prose.
- Sum check: 6 + 6 + 9 + 6 = 27. Matches input.
- Each journey appears in exactly one release (no double-assignments).

The thinking chain spends substantial tokens (~10–15%) on coverage self-checks (the explicit per-journey enumeration in §"Final Review") which is on-balance well-allocated for a coverage-critical artefact. Contrast sample 07's thinking-chain attention allocation, which spent ~30% on JSON validity and ~10% on coverage; sample 08 inverts this, which is the right ratio for this artefact class.

#### 1a.11 Reasoning-to-response faithfulness — passes with one exception

The thinking chain's final journey-by-journey enumeration (§"Final Review") matches the response's `contains_journeys` arrays one-for-one. Faithful in the structural sense.

The one exception: the thinking chain *names* the dependency assumption ("Needs vendors to browse? I will assume pre-seeded for MVP.") and the response *omits* it from the rationale. This is a *faithfulness defect on assumption-disclosure*: the reasoning identifies a load-bearing assumption that the response does not surface to the downstream consumer. Severity: **MEDIUM** — the orchestrator's deterministic downstream mapping cannot recover an assumption it never receives.

### 1b. Reviewer's findings (0 in this sample)

The reviewer returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The plan is logically sound, adheres strictly to all constraints (especially full coverage of all 27 journeys), and successfully structures the complex product vision into four distinct, dependency-respecting, and value-increasing releases. The separation of Homeowner (REL-1), Provider (REL-2), Governance (REL-3), and Admin/Scale (REL-4) is highly effective."
}
```

Three observations:

1. **Schema-consistency holds** (`has_concerns=false` ↔ empty `concerns[]`). Same pattern as sample 07.
2. **The overall assessment is empirically wrong on its strongest claim.** "Dependency-respecting" is contradicted by §1a.1 (REL-1 browse before REL-2 register), §1a.2 (REL-2 execute before REL-3 vet), §1a.3 (REL-3 reserve-transfer before REL-4 audit trail). The reviewer either did not traverse the dependency graph implied by the substrate or did not understand the dependency claim was load-bearing.
3. **Severity calibration is moot at zero findings** (same as sample 07). The structural calibration — three independent HIGH-severity dependency violations and the reviewer found zero — is the worst-case false-negative gate outcome on the sample's most consequential validator dimension.

### 1c. What the reviewer missed

Mapped to §1a:

**HIGH severity — missed:**
- §1a.1 Wave-dependency violation: REL-1 browse before REL-2 register.
- §1a.2 Wave-dependency violation: REL-2 execute before REL-3 vet.
- §1a.3 Wave-dependency violation: REL-3 reserve-transfer before REL-4 audit trail.
- §1a.6 MVP credibility: REL-1 dead-letter (no supply).

**MEDIUM severity — missed:**
- §1a.4 Phase-tag override of [Phase 1] journeys into REL-3/REL-4 without recorded rationale.
- §1a.5 Pillar imbalance (Investor-stranded; CAM-monolith).
- §1a.7 Risk concentration in REL-3.
- §1a.8 Open questions silently decided.
- §1a.9 Rationale fabrication ("without requiring association governance").
- §1a.11 Faithfulness gap: pre-seeded-vendors assumption not disclosed.

The pattern matches sample 07: the reviewer's prompt asks for *additive* defect categories (assumptions stated as facts, fragile coupling, contradictions) and the synthesis defects are *subtractive* (omitted rationale, silent decision, dropped phase-tag). The release-plan variant adds a **structural** axis (DAG-back-edges, persona-pillar imbalance, MVP credibility) that the current reviewer prompt has no language for.

---

## 2. Diagnosis

The role-specific failure modes for a release-plan synthesis pass:

1. **Wave-dependency back-edges.** The synthesis decides a partial order over journeys; the substrate carries an implicit dependency DAG (browse→registered, execute→vetted, transact→audited). Back-edges (a journey in REL-K depending on a journey in REL-K+M) are the dominant correctness defect class. This is the load-bearing variant of `phasing_dependency_consistency` from sample 07.

2. **Pillar / persona stranding.** A persona or pillar that is part of the substrate's headline product story but waits N releases for first appearance. Strands the user surface.

3. **Risk concentration.** A wave that absorbs a disproportionate share of regulatory exposure, persona count, or journey count. Not strictly incorrect but a planning-quality defect that the reviewer should surface.

4. **MVP credibility.** REL-1 (the wave the substrate's "minimum viable" framing applies to) must be self-contained for the personas it ships. A wave that includes a journey requiring a downstream wave is structurally impossible for users to use. The "supply / demand" check is the load-bearing form here: a wave with demand-side journeys (request, browse, approve) but no supply-side journeys (register, fulfil) cannot deliver the user value its description claims.

5. **Phase-tag override discipline.** When the substrate carries phase tags (the agent receives `[Phase 1]/[Phase 2]/[Phase 3]` per journey, treated as hint), deviations from the hint are permitted but should be recorded. Silent overrides produce a plan that diverges from the upstream phasing strategy without trace.

6. **Open-question commitment.** The release plan is a commitment surface. Open questions in the substrate become silently committed when journey placement requires picking one branch (public vs private listings, residential vs commercial scope).

7. **Rationale fabrication.** Per-release rationales compose prose to justify the placement. The prose can fabricate decouplings, dependencies, or product-shape claims that the placement does not actually deliver. Synthesis-time fabrication in its release-rationale form.

8. **Coverage and uniqueness.** Deterministically checkable: every accepted journey appears in exactly one release; release IDs are contiguous; journey IDs are exact substrate copies.

9. **Compliance sequencing.** A specialisation of (1): regulated capabilities (paid execution, fund movement, voting) must be preceded by their compliance prerequisites (vetting, audit trail, identity proofing). This is a substrate-anchored variant of dependency-consistency where the dependencies come from `DOM-COMPLIANCE`, `DOM-LEDGER`, `DOM-IDENTITY` rather than from journey-to-journey ordering.

10. **Schema and faithfulness.** Carries forward unchanged from prior synthesis-class.

The synthesis-class symmetry with sample 07 holds: defects are subtractive (silent override, undisclosed assumption, dropped tag) rather than additive. The release-plan-specific axis is **structural correctness** (DAG topology, pillar balance, MVP supply/demand) which sample 07 did not exercise.

---

## 3. Recommended validator pipeline for this role

Nine validators. Three deterministic, six LLM-based. Five reuses or parameter-variations from sample 07's synthesis-class core; four release-plan-specific.

| # | Validator | Type | Status |
|---|-----------|------|--------|
| 1 | `contract_schema_release_plan` | deterministic | parameter-variation of `contract_schema_synthesis` (07 §4.1) |
| 2 | `release_plan_coverage_audit` | deterministic + LLM | parameter-variation of `synthesis_coverage_audit` (07 §4.3) — substrate set is `accepted_journeys`; coverage is checkable deterministically |
| 3 | `handoff_field_completeness` | deterministic + LLM | exact reuse of 07 §4.2; unit varies (per-release fields) |
| 4 | `synthesis_fabrication_check` | LLM | exact reuse of 07 §4.4; unit varies (release rationales rather than productDescription noun phrases) |
| 5 | `compression_fidelity_audit` | LLM | parameter-variation of 07 §4.5; load-bearing concept set = phase-tag preservation, pillar balance, persona spread |
| 6 | `wave_dependency_topology` | LLM-or-deterministic | **NEW — release-plan-specific** (DAG correctness; the load-bearing variant of sample 07's vacuous `phasing_dependency_consistency`) |
| 7 | `pillar_balance_audit` | LLM | **NEW — release-plan-specific** |
| 8 | `mvp_credibility_check` | LLM | **NEW — release-plan-specific** |
| 9 | `compliance_sequencing_audit` | LLM | **NEW — release-plan-specific** (compliance-anchored specialisation of `wave_dependency_topology`) |
| 10 | `open_question_resolution_discipline` | LLM | exact reuse from 07 §4.7 |
| 11 | `reasoning_to_response_faithfulness` | LLM | exact reuse |

**Synthesis-family generalisation finding.** All five sample-07 synthesis-class validators carry forward to release_plan, with two unchanged and three parameter-varying:

- **Carry forward unchanged:** `synthesis_fabrication_check` (rationale prose is structurally identical to productDescription prose for fabrication-detection purposes), `handoff_field_completeness` (the per-release `name`/`description`/`rationale` fields play the same role as the four narrative fields in sample 07).
- **Carry forward with parameter-variation:** `synthesis_coverage_audit` (substrate set rotates from "personas, domains, integrations" to "accepted_journeys"; the coverage check becomes partially deterministic — set membership of journey IDs — with LLM follow-up only on whether journey *narratives* are honoured by their assigned release's description), `compression_fidelity_audit` (the load-bearing-concept set rotates from "trust ledger, AI engine, three pillars" to "phase-tag distribution, pillar spread, persona representation"), `phasing_dependency_consistency` (was vacuous in 07; here it generalises into `wave_dependency_topology` with strict DAG semantics).

- **Carry forward and split:** `phasing_dependency_consistency` cleanly splits into two release-plan-specific validators: `wave_dependency_topology` (general DAG check) and `compliance_sequencing_audit` (compliance-anchored variant). Both are heirs of the sample-07 vacuous validator and inherit its decision rule with substrate-specific dependency edges.

Net: **5 of 5 synthesis-class validators carry forward**; two unchanged, two parameter-varying, one split-into-two. The synthesis family generalises cleanly. No validator from sample 07 fails to apply or needs replacement.

**Release-plan-specific additions:**
- `wave_dependency_topology` — DAG correctness on placement.
- `pillar_balance_audit` — pillar/persona stranding.
- `mvp_credibility_check` — REL-1 supply/demand closure.
- `compliance_sequencing_audit` — regulated-capability precedence.

These four are candidates for cross-role generalisation to any future synthesis pass that produces a sequenced commitment surface (architecture release plan, NFR phasing, deployment plan).

**Validators that explicitly do NOT add new mass beyond reuse:**
- `contract_schema_release_plan` is a parameter-variation, not a new validator design effort.
- `handoff_field_completeness` and `synthesis_fabrication_check` carry forward unchanged.
- Bloom-class validators continue not to apply.

---

## 4. Validator prompt templates

### 4.1 `contract_schema_release_plan` (deterministic, parameter-variation of 07 §4.1)

```ts
function validateReleasePlanContract(r: ReleasePlanResponse): Finding[] {
  // 1. JSON parseable; no markdown fences; no trailing prose.
  // 2. Top-level keys: { kind: "release_plan", schemaVersion: "2.0", releases: [] }.
  // 3. releases.length ∈ [1, 5].
  // 4. Each release has { release_id, ordinal, name, description, rationale, contains_journeys }.
  //    - release_id matches /^REL-\d+$/ and equals "REL-" + ordinal.
  //    - ordinal is integer; the set of ordinals is exactly {1, 2, ..., releases.length}
  //      (contiguous, no gaps, no duplicates).
  //    - name non-empty string.
  //    - description non-empty string; sentence count ∈ [1, 3].
  //    - rationale non-empty string.
  //    - contains_journeys is non-empty array of strings.
  // 5. Across all releases, every contains_journeys entry matches the regex /^UJ-[A-Z0-9-]+$/.
  // 6. No journey ID appears in more than one release.
  // 7. Set of all journey IDs == set of accepted_journeys input IDs (full coverage).
  // 8. No unescaped double quotes inside string values; ASCII quotes only.
}
```

Findings: `wrong_field_count`, `ordinal_gap_or_duplicate`, `release_id_mismatch`, `journey_duplicated_across_releases`, `journey_missing_from_plan` (HIGH), `journey_not_in_accepted_set` (HIGH — fabrication of journey IDs), `description_sentence_out_of_range`. The full-coverage check (rule 7) catches the dominant deterministic-defect class for this artefact.

The current sample passes all rules.

### 4.2 `release_plan_coverage_audit` (deterministic + LLM, parameter-variation of 07 §4.3)

The deterministic prefilter is `contract_schema_release_plan` rule 7 (set equality). The LLM follow-up:

```text
[MISSION]
For each accepted journey, verify the release it is assigned to has a
description and rationale that *honour* the journey — i.e. a downstream
consumer reading the release narrative would expect this journey to be
in this release.

[IN-SCOPE]
- The 27 accepted_journeys (or N for this plan).
- Each release's name + description + rationale.
- Each journey's substrate metadata (persona, phase-tag, brief).

[DECISION STANDARD]
For each journey:
  - HONOURED: the release's narrative names the journey, the journey's
    persona, or the journey's user value explicitly.
  - IMPLICIT: the journey is consistent with the release's narrative
    (e.g. "Provider Marketplace" implies all P-PROVIDER journeys).
  - DISSONANT: the journey is in this release but the release's
    narrative does not gesture at it OR contradicts it (e.g. the
    rationale says "without requiring association governance" but the
    release contains no CAM journeys, while a different release
    contains the only vendor-vetting journey on which this release's
    P-PROVIDER journeys depend).

[FINDING TYPES]
- journey_dissonant_with_release_narrative (MEDIUM per journey)
- release_narrative_omits_load_bearing_journey (LOW per journey)
```

Catches §1a.6 (REL-1 description claims user value its journeys cannot deliver) and §1a.9 (REL-2 rationale contradicts placement).

### 4.3 `handoff_field_completeness` (deterministic + LLM, exact reuse of 07 §4.2)

Reused. The "field's stated purpose" rules become:

- `name`: short identifying phrase.
- `description`: 1–3 sentences describing what the user can *do* after this release that they could not before.
- `rationale`: explains *why this ordinal* (dependencies + value-ordering).
- `contains_journeys`: non-empty subset of accepted journeys.

The current sample passes deterministic prefilter and field-purpose-met checks for all four releases.

### 4.4 `synthesis_fabrication_check` (LLM, exact reuse of 07 §4.4)

Reused. Unit-of-analysis rotates from productDescription noun phrases to release rationales and descriptions. Catches §1a.9 ("without requiring association governance" — a fabricated decoupling), and §1a.6's description fabrication ("request urgent services immediately" — a fabricated user-value claim that the placement does not deliver).

### 4.5 `compression_fidelity_audit` (LLM, parameter-variation of 07 §4.5)

```text
[MISSION]
Identify load-bearing structural concepts from the substrate that the
release-plan synthesis preserved, partially preserved, or lost.

[IN-SCOPE]
- The substrate's phase-tag distribution (each journey carries
  [Phase 1|2|3]).
- The substrate's persona distribution (the personas implicit in the
  accepted_journeys set).
- The substrate's three-pillar product framing (from upstream
  productDescription).
- The substrate's phasing strategy hint (the Phase 1.0b proposal).
- The release plan's wave structure.

[DECISION STANDARD]
For each load-bearing structural concept:
  - PRESERVED: the wave structure honours the concept (e.g. all
    [Phase 1] journeys land in REL-1; all 3 pillars represented in
    the first 2 waves; etc.)
  - PARTIALLY_PRESERVED: the wave structure partially honours the
    concept (e.g. 9 of 14 [Phase 1] journeys in REL-1; 2 of 3 pillars
    in early waves).
  - LOST: the wave structure inverts or ignores the concept.

[FINDING TYPES]
- phase_tag_override_unrecorded (MEDIUM per journey demoted past the
  release matching its phase tag, when the rationale does not record
  the deviation)
- pillar_strand (MEDIUM per pillar whose full surface ships only in
  the final wave)
- persona_strand (MEDIUM per persona that appears only in the final
  wave when the substrate's product framing names it as load-bearing)
```

Catches §1a.4 (5 [Phase 1] journeys demoted unrecorded) and §1a.5 (Investor pillar-strand).

### 4.6 `wave_dependency_topology` (LLM-or-deterministic, NEW)

```text
[MISSION]
Verify the release plan's wave assignment respects the dependency DAG
implied by the accepted journey set, the substrate's domain map, and
the substrate's named integrations.

[IN-SCOPE]
- The wave assignment (journey → release).
- The substrate-implied dependency edges, including:
  - Demand journeys depend on supply journeys (browse-vendors depends on
    vendor-registration; approve-bid depends on request-job-invite).
  - Status / view journeys depend on the journeys that produce the status
    (view-repair-status depends on job execution).
  - Approval / vetting journeys are precedents, not consequences, of the
    journeys whose subjects they vet (provider-execute depends on
    vendor-approve).
  - Audit / log journeys precede the journeys whose actions must be
    auditable (initiate-reserve-tx depends on access-logs being available).

[DECISION STANDARD]
For each substrate-implied edge u → v (v depends on u):
  - SATISFIED: release(u) ≤ release(v).
  - VIOLATED: release(u) > release(v) — a back-edge in the wave DAG.
  - VIOLATED_WITH_DISCLOSED_ASSUMPTION: a back-edge exists but the
    release rationale records the assumption that bridges it (e.g.
    "REL-1 ships with manually-seeded vendor records pending REL-2").
    Lower severity.

[EDGE EXTRACTION GUIDANCE]
Read each accepted_journey's brief for verbs that imply a precondition.
Cross-reference DOM-* descriptions for domain-level precedence
(DOM-COMPLIANCE, DOM-IDENTITY, DOM-LEDGER are typical precedents).
The substrate's phasing strategy hint is itself a partial order; treat
its [Phase N] tags as soft edges.

[FINDING TYPES]
- wave_dependency_back_edge (HIGH per back-edge; MEDIUM if disclosed
  in rationale)
- supply_demand_imbalance (HIGH — a wave contains demand-side
  journeys for which no in-wave or earlier-wave supply exists)
- view_without_subject (MEDIUM — a status/view journey ships before
  the journeys that produce the status)
```

Catches §1a.1 (REL-1 browse before REL-2 register), §1a.2 (REL-2 execute before REL-3 vet), and structurally enables §1a.6.

### 4.7 `pillar_balance_audit` (LLM, NEW)

```text
[MISSION]
Verify each pillar named in the substrate's product framing has user
surface in at least one of the first ⌈N/2⌉ releases, and no pillar is
stranded to the final wave.

[IN-SCOPE]
- The pillar list from the upstream productDescription (typically 2–4
  pillars).
- The persona-to-pillar mapping derivable from the substrate.
- The release-by-persona distribution.

[DECISION STANDARD]
For each pillar:
  - HEALTHY: the pillar has at least one journey in the first ⌈N/2⌉
    releases AND its full persona surface is delivered by release N-1.
  - STRANDED: the pillar's primary personas appear only in the final
    release.
  - MONOLITHIC: the pillar's full surface ships in a single release
    that absorbs >40% of all journeys (risk-concentration warning).

[FINDING TYPES]
- pillar_strand (MEDIUM — a pillar's user surface waits for the final
  wave)
- pillar_monolith (MEDIUM — a single release absorbs an entire pillar
  with >40% of total journeys)
- persona_strand (MEDIUM per persona delayed past the substrate's
  expected first appearance)
```

Catches §1a.5 (Investor strand into REL-4; CAM monolith in REL-3) and §1a.7 (REL-3 risk concentration).

### 4.8 `mvp_credibility_check` (LLM, NEW)

```text
[MISSION]
Verify REL-1 (the substrate's "minimum viable" wave) is self-contained:
every demand-side journey in REL-1 has a corresponding supply-side
journey also in REL-1 OR an explicit out-of-band fulfilment mechanism
recorded in the rationale.

[IN-SCOPE]
- REL-1's journey set.
- Each REL-1 journey's role in the supply/demand bipartite structure
  derivable from the substrate.

[DECISION STANDARD]
For each REL-1 journey:
  - SELF_CONTAINED: completes within REL-1's journey set.
  - REQUIRES_EXTERNAL_SUPPLY: a downstream wave's journey is required
    for this journey to deliver value (e.g. submit-request requires
    job-execute; browse-vendors requires vendor-register).
  - DEAD_LETTER: the journey terminates without value (status views
    that have no status to view; requests that no party can act on).

[FINDING TYPES]
- mvp_dead_letter (HIGH per journey — REL-1 contains demand without
  supply, making the wave structurally non-viable)
- mvp_undisclosed_external_dependency (MEDIUM — REL-1 contains a
  journey whose value depends on an out-of-band mechanism not recorded
  in the rationale)
- mvp_description_overclaims (MEDIUM — REL-1's description claims
  user value that REL-1's journeys cannot deliver)

[POSITIVE BASELINE]
Most REL-1 journeys may be SELF_CONTAINED (e.g. property
digitization, document storage, history capture — registry-only
flows). The check fires when REL-1 mixes registry flows with
marketplace flows and the marketplace half lacks supply.
```

Catches §1a.6 directly. The single most consequential release-plan-specific validator.

### 4.9 `compliance_sequencing_audit` (LLM, NEW; specialisation of 4.6)

```text
[MISSION]
Verify regulated-capability journeys (paid execution, fund movement,
voting, identity-bearing actions) are preceded in wave order by their
compliance prerequisites (vetting, audit trail, identity proofing,
access control).

[IN-SCOPE]
- Journeys whose substrate brief implicates DOM-COMPLIANCE,
  DOM-LEDGER, DOM-IDENTITY, DOM-AUDIT, or DOM-FINANCE.
- The wave assignment.
- The compliance-prerequisite edges (vetting → execution; audit-trail →
  fund movement; identity → access-restricted action).

[DECISION STANDARD]
For each (regulated journey, compliance prerequisite) pair:
  - PROPERLY_SEQUENCED: prerequisite ships in an earlier-or-same wave.
  - VIOLATED: regulated journey ships before its prerequisite.
  - VIOLATED_WITH_OUT_OF_BAND_NOTE: rationale records that the
    prerequisite is handled by manual / external process pending the
    later wave (lower severity).

[FINDING TYPES]
- compliance_prerequisite_back_edge (HIGH — paid execution before
  vetting; fund movement before audit trail)
- audit_trail_unavailable_for_governed_action (HIGH — REL-K contains
  governed actions whose logs/audit-export ship in REL-K+M)
- identity_gating_unavailable (HIGH — REL-K contains access-restricted
  actions whose identity-management surface ships in REL-K+M)
```

Catches §1a.2 (job execution before vendor vetting) and §1a.3 (reserve transfers before audit trail).

This validator is structurally a specialisation of `wave_dependency_topology` (§4.6) anchored to compliance domains rather than journey-graph edges. The dedup rule: when both validators flag the same back-edge, prefer `compliance_sequencing_audit` because its severity ladder is calibrated to regulatory exposure.

### 4.10 `open_question_resolution_discipline` (LLM, exact reuse of 07 §4.7)

Reused. Decision rule: an open question from the substrate (typically forwarded via the upstream productDescription's `openLoops`) is *silently resolved* if the wave plan's placement requires picking one branch.

Catches §1a.8 (Q-3 and Q-4 silently committed by the wave structure).

### 4.11 `reasoning_to_response_faithfulness` (exact reuse)

Reused. Synthesis-specific marker for this sample: the thinking chain explicitly identifies the "needs vendors to browse? I will assume pre-seeded for MVP" assumption and the response's REL-1 rationale omits it. This is **assumption-disclosure faithfulness** — the reasoning identified a load-bearing assumption that the response does not surface. Severity: MEDIUM.

The thinking chain also contains the recurring pattern "Wait, …" / "Correction:" / "Adjustment:" — the agent visibly oscillates on placements and frequently reverts to the original. The validator can flag *high-oscillation regions* as zones of elevated risk: in this sample, the Investor placement oscillates between REL-1, REL-3, and REL-4 across ~6 thinking-chain mentions before settling on REL-4 with the rationale "keeping REL-1 focused" — a synthesis-time decision that overrode the substrate's [Phase 1] tag. Pattern: high-oscillation thinking + final-pick-without-substrate-anchor = high risk of `compression_fidelity_audit` finding.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_release_plan` | yes (det) | `agent_role == "orchestrator" && sub_phase == "release_plan"` |
| `release_plan_coverage_audit` | yes (det+LLM) | same; LLM portion only after deterministic full-coverage passes |
| `handoff_field_completeness` | yes | same |
| `synthesis_fabrication_check` | yes (LLM) | same |
| `compression_fidelity_audit` | yes (LLM) | same; load-bearing concept set extracted from upstream phasing-hint + product description |
| `wave_dependency_topology` | yes (LLM) | same; primary correctness check |
| `pillar_balance_audit` | yes (LLM) | same; pillar list extracted from upstream productDescription |
| `mvp_credibility_check` | yes (LLM) | same; only when `releases.length >= 2` (REL-1 must have a downstream) |
| `compliance_sequencing_audit` | conditional (LLM) | substrate has any regulated-domain journey (DOM-COMPLIANCE / DOM-LEDGER / DOM-IDENTITY / DOM-FINANCE) |
| `open_question_resolution_discipline` | conditional (LLM) | upstream productDescription carries openLoops items |
| `reasoning_to_response_faithfulness` | conditional (LLM) | `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_release_plan          (det, gate; full-coverage / uniqueness / contiguity)
2. release_plan_coverage_audit           (det prefilter, LLM follow-up on dissonance)
3. handoff_field_completeness            (det prefilter, LLM purpose-met)
4. wave_dependency_topology              (LLM — primary structural correctness)
5. compliance_sequencing_audit           (LLM — compliance-anchored back-edges; runs after 4 to dedup)
6. mvp_credibility_check                 (LLM — REL-1 supply/demand)
7. pillar_balance_audit                  (LLM — pillar/persona stranding)
8. compression_fidelity_audit            (LLM — phase-tag overrides, structural-concept fidelity)
9. synthesis_fabrication_check           (LLM — rationale prose vs placement)
10. open_question_resolution_discipline  (LLM, conditional)
11. reasoning_to_response_faithfulness   (LLM, conditional)
12. final_synthesis                      (LLM, unchanged)
```

`wave_dependency_topology` runs before `compliance_sequencing_audit` so that the latter can reference back-edges already identified, dedup'ing on the same span with severity-promotion (compliance back-edges are HIGH; general back-edges may be MEDIUM if the rationale discloses the assumption).

### 5.2 Deterministic vs LLM split

- **Deterministic:** `contract_schema_release_plan` (full); the prefilter portions of `release_plan_coverage_audit` (set equality on journey IDs) and `handoff_field_completeness` (field-presence and length checks).
- **LLM:** all five synthesis-class validators in their semantic portions, plus the four release-plan-specific validators in full, plus `open_question_resolution_discipline` and `reasoning_to_response_faithfulness`.

Coverage and uniqueness — the dominant deterministic-defect classes for this artefact — are fully deterministically checkable (rules 6 and 7 of the schema validator). The current sample passes them all. The remaining defect classes (dependency-back-edges, MVP credibility, pillar balance, phase-tag override, fabrication) all require semantic understanding and are LLM-only.

### 5.3 Integration with sample 07

Five-of-five carry-forward, by category:

| Sample 07 validator | Sample 08 disposition |
|--------------------|----------------------|
| `synthesis_coverage_audit` | parameter-variation → `release_plan_coverage_audit`; deterministic prefilter is stronger here |
| `synthesis_fabrication_check` | exact reuse; unit rotates to release rationales |
| `handoff_field_completeness` | exact reuse; unit rotates to per-release fields |
| `compression_fidelity_audit` | parameter-variation; load-bearing concepts are structural (phase-tag, pillar, persona) rather than narrative |
| `phasing_dependency_consistency` | split into `wave_dependency_topology` + `compliance_sequencing_audit`; was vacuous in 07, dominant here |

Cross-role validators that continue to apply:

- `open_question_resolution_discipline` (cross-role from 03/04/05/06/07).
- `reasoning_to_response_faithfulness` (cross-role from 01–07).

Bloom-class validators continue not to apply (third negative confirmation across 07 and 08).

### 5.4 Cross-validator deduplication

Three overlap pairs:

- `wave_dependency_topology` and `compliance_sequencing_audit` — both can flag the same back-edge. Compliance variant is primary on regulated edges (HIGH); general variant is primary on non-regulated edges (MEDIUM).
- `mvp_credibility_check` and `wave_dependency_topology` — REL-1 dead-letter findings will overlap with REL-1-out-back-edges. Treat MVP variant as primary because it carries the user-experience framing.
- `compression_fidelity_audit` and `release_plan_coverage_audit` — when a journey is placed in a release that omits it from the rationale (coverage_audit) AND the placement violates the phase-tag (fidelity_audit), both fire. Coverage primary on per-journey defects; fidelity primary on aggregate / structural defects.

### 5.5 Cross-role validator promotion hypotheses

After two synthesis samples, the synthesis-class core (`synthesis_coverage_audit`, `synthesis_fabrication_check`, `handoff_field_completeness`, `compression_fidelity_audit`, plus the split heir of `phasing_dependency_consistency`) is robust enough to **promote to a cross-role synthesis-family pipeline**. Future synthesis samples (any handoff-shaped output) should pull from this family by default.

The four release-plan-specific additions (`wave_dependency_topology`, `pillar_balance_audit`, `mvp_credibility_check`, `compliance_sequencing_audit`) are candidates for further generalisation to **any sequenced commitment surface** — architecture release plans, NFR phasing roadmaps, deployment plans. Defer until a non-release synthesis with sequencing structure surfaces in the corpus.

---

## 6. Notes and open questions

1. **Synthesis-family generalisation: 5/5 carry forward.** The sample-07 hypothesis that the five synthesis-class validators form a stable family is confirmed by sample 08. Two reuse unchanged (`synthesis_fabrication_check`, `handoff_field_completeness`); two parameter-vary cleanly (`synthesis_coverage_audit`, `compression_fidelity_audit`); one was vacuous in 07 and becomes the dominant correctness validator in 08 (`phasing_dependency_consistency` → `wave_dependency_topology`). No member of the family fails to apply; no member needs replacement. The family promotes to cross-role synthesis-family status.

2. **`phasing_dependency_consistency` was load-bearing despite the vacuous 07 result.** The sample-07 assessment correctly anticipated this. Designing validators against vacuous samples is risky, and the sample-08 exercise of the validator surfaces a refinement: the original prompt was framed for narrative phasing claims; the load-bearing variant requires DAG semantics over a structural placement. The split into `wave_dependency_topology` + `compliance_sequencing_audit` is the practical resolution.

3. **The reviewer's `0 findings` outcome on a structurally-defective release plan is a stronger argument for decomposed validation than sample 07.** Sample 07 had subtractive defects distributed across multiple substrate sets. Sample 08 has *additive structural defects* (back-edges, mismatches) plus subtractive defects (silent overrides, undisclosed assumptions) — both classes missed by the same single-pass reviewer. The decomposed harness gives each validator a focused traversal target; for `wave_dependency_topology` specifically, the traversal is over a 27-node DAG that no single-pass reviewer at the current model scale can hold in working memory.

4. **Thinking-chain attention allocation has improved relative to sample 07.** Sample 07 spent ~30% of thinking on JSON-validity self-checks and ~10% on coverage. Sample 08 spends ~10–15% on coverage self-checks (the explicit per-journey enumeration in the "Final Review" section), ~5% on JSON validity, and ~70% on placement reasoning. The placement reasoning is high-oscillation but ultimately coverage-faithful. The defects are not in the coverage check (which the agent self-audits well) but in the *dependency check* (which the agent half-performs and waves away). A `reasoning_attention_allocation_audit` validator would now have two corpus samples to calibrate against.

5. **High-oscillation thinking as a risk signal.** The Investor placement oscillates ~6 times in the thinking chain before settling on REL-4. Each oscillation surfaces a substrate consideration ([Phase 1] tag, P-INVESTOR distinctness, "keep REL-1 focused"); the final pick selects the consideration least anchored to substrate. Pattern observation: high-oscillation regions in the thinking chain that resolve to a substrate-unanchored final pick are a leading indicator of `compression_fidelity_audit` findings. Worth a future validator-design experiment.

6. **The "treat as hint" framing on the phasing strategy is a contract-level risk.** When the substrate carries a partial-order hint and explicitly authorises deviation, the agent has license to override silently. The orchestrator's downstream deterministic mapping then computes workflow/entity/compliance placements from the agent's wave assignment, so a silent override propagates without trace. The contract should require the agent to either honour the hint or record the override in the rationale; the validator can enforce this (`compression_fidelity_audit` — `phase_tag_override_unrecorded`). Recommend adding the contract-level tightening; the validator alone is insufficient because the agent's prose can satisfy "rationale present" without honestly recording the override.

7. **The MVP-credibility defect is the single most consequential release-plan defect.** A non-viable REL-1 invalidates the entire user-value-story framing of the artefact: every downstream consumer reading "this is what users can do after REL-1" gets a misleading picture. Of all the §1a defects, §1a.6 (REL-1 dead-letter) is the one a downstream product roadmap discussion is most likely to catch and the one most embarrassing to ship. `mvp_credibility_check` should be the highest-priority addition.

8. **Sample 08 is the regression-test fixture for `wave_dependency_topology`, `compliance_sequencing_audit`, `mvp_credibility_check`, and `pillar_balance_audit`.** Each validator should fire at least one finding on this sample at the severities listed in §1a. A future agent change that ships REL-1 with provider registration (resolving §1a.1, §1a.6) is a measurable improvement; one that also moves audit-trail to REL-3 or earlier (resolving §1a.3) is the minimum viable correctness fix.

9. **Deferred for future samples.**
   - Whether `wave_dependency_topology` and `compliance_sequencing_audit` should remain split or recombine after a third synthesis-with-sequencing sample is observed.
   - Whether `pillar_balance_audit` generalises to non-pillar product structures (e.g. capability-tiered or persona-tiered products without a pillar metaphor).
   - Whether `mvp_credibility_check` extends naturally to "MVP-of-pillar" credibility (each pillar's first-wave sub-plan should be self-contained for that pillar).
   - Whether `reasoning_attention_allocation_audit` (deferred from sample 07) is ready to design after two synthesis samples show divergent attention patterns. Two samples is borderline; defer to sample 09+.
   - Whether the contract-level recommendation in §6.6 (require explicit phase-tag-override recording) belongs in the validator pipeline or upstream in the prompt template. Likely upstream; track as a prompt-template recommendation to the redesign.

10. **Cross-role family confirmation.** The cross-role trio (`grounding_*`, `open_question_*`, `reasoning_to_response_faithfulness`) continues to apply across all eight reviewed roles. The synthesis-class family (5 validators) is now a second cross-role family, applicable to any handoff-shaped output. The bloom-class family (11 validators) remains a third, applicable only to bloom-shaped outputs. Three families, clean disjointness on role-specific members, three shared cross-role validators across all families.
