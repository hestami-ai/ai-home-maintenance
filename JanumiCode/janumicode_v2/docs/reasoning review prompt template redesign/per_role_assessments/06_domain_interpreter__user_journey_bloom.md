# Assessment: domain_interpreter / user_journey_bloom (Phase 1.6)

**Sample:** `track_c_samples/06_domain_interpreter__user_journey_bloom.md`
**Reviewed agent:** `domain_interpreter` running `qwen3.5:9b` (34 KB JSON, 33 KB thinking chain — the largest output in the corpus)
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

This is the second bloom in the corpus, and the size jump (34 KB response, 33 KB thinking) shifts the angle: where sample 05 fabricated provenance to over-claim `user-specified`, sample 06 swings the opposite way and *under-attributes* — the agent zeros out every `compliance_regimes` array across 25 journeys, defensively walking away from the strongest source-attestation signal in the prompt rather than risk a citation. The same `source` field is now the failure mode in mirror-image: every journey is tagged `ai-proposed`, including four journeys whose IDs were pre-printed verbatim by the upstream phasing strategy.

The reviewer fired `has_concerns: true` with a single LOW-severity finding about `VV-SECURITY-ORIGIN-PROXY` redundancy. The finding is real but explicitly self-defangs ("technically correct… no change needed for correctness"), and it sits at the periphery of a defect surface that contains at least one HIGH-severity systemic problem (compliance-surface evacuation), two MEDIUM-severity contract violations (workflow/journey contamination, journey-ID mutation), and a long tail of acceptance-criteria, automatable-flag, and phasing inconsistencies. The reviewer's single finding is closer to noise than to triage.

The role-specific implication: the bloom validator family established in sample 05 carries over largely intact, but user-journey blooms expose a journey-shape axis that the business-domains bloom did not stress — workflow/journey separation, step completeness, persona-journey coupling, and acceptance-criteria measurability. These are not adequately covered by sample 05's bloom-generic validators and require journey-specific additions.

### 1a. Defects in the agent's response

#### 1a.1 Compliance-surface evacuation: every `compliance_regimes` array is empty across all 25 journeys

The prompt's "Critical Rules" section is unambiguous: "**Cover user-facing compliance and retention surfaces.** Every compliance regime that implies a user-facing action must surface as a journey." The accepted compliance regimes are listed by name as plain-text bullets:

> - Auditable, compliant GL structure
> - Statutory deadlines
> - Notice requirements
> - Voting rules
> - Resale packet guidelines
> - Financial audit requirements
> - property data and governance history must remain persistent and isolated

Several of the agent's own journeys directly enact these regimes:

- `UJ-CAST-VOTE` ("Vote on Budget Resolution") obviously surfaces **Voting rules**.
- `UJ-REVIEW-STATUTORY-DEADLINES` (the title literally names the regime) surfaces **Statutory deadlines** and **Notice requirements**.
- `UJ-SCHEDULE-ANNUAL-MEETING` ("Notification sent 30 days prior to meeting") surfaces **Notice requirements** and **Voting rules**.
- `UJ-REVIEW-STATEMENT` and `UJ-INITIATE-RESERVE-TX` surface **Auditable, compliant GL structure** and **Financial audit requirements**.
- `UJ-ACCESS-LOGS` and `UJ-EXPORT-AUDIT-REPORT` surface **Financial audit requirements**.

Yet every one of these journeys emits `"compliance_regimes": []`. The agent's thinking chain documents the exact decision path:

> "*Decision*: I will prioritize the instruction 'If a concept isn't in the accepted list, don't cite it.' I will populate `surfaces` only where explicit IDs exist in the input. Since explicit `COMP-*` IDs are not in the 'Accepted Compliance Regimes' list (only text), I will leave `surfaces.compliance_regimes` empty."

This is a textbook case of mis-applied referential-integrity discipline. The "Reference-ID Discipline" block governs IDs that the upstream pass *assigns*; for a regime list that arrives as plain-text bullets, the correct response is either (a) cite the bullet text verbatim as a string, or (b) flag the schema/source mismatch in a rationale and surface the regime conceptually. The agent chose neither; it chose silence, then asserted internally that silence satisfied the contract.

Downstream consequence: the 1.3c coverage verifier checks `surfaces` arrays for compliance coverage. Every journey reports zero compliance coverage. The verifier will report "no compliance regime is covered by any journey" and the next pass will either re-bloom against a phantom gap or accept a false negative. **HIGH severity** — this is the largest defect in the response and the bloom-mandate equivalent of sample 05's source-tag fabrication, in inverted form.

#### 1a.2 Journey-ID mutation against pre-named upstream journeys

The phasing strategy block explicitly names four canonical journey IDs:

> Phase 1: ... (journeys: UJ-SETUP-PROPERTY, UJ-SUBMIT-REQUEST)
> Phase 2: ... (journeys: UJ-EXECUTE-JOB)
> Phase 3: ... (journeys: UJ-GOVERNANCE-COMPLIANCE)

The agent's response renames or drops every one of them:

| Phasing-strategy journey | Agent's emission |
|---|---|
| `UJ-SETUP-PROPERTY` | `UJ-ONBOARD-PROPERTY` (renamed) |
| `UJ-SUBMIT-REQUEST` | `UJ-SUBMIT-MAINTENANCE-REQUEST` (renamed/expanded) |
| `UJ-EXECUTE-JOB` | split into `UJ-START-JOB-LOGGING` + `UJ-SUBMIT-JOB-TIME-COST` (decomposed without preserving the parent ID) |
| `UJ-GOVERNANCE-COMPLIANCE` | not present in any form |

The "Reference-ID Discipline" block's instruction — "Use the EXACT ids printed below, verbatim. ... DO NOT re-slug or rename ids" — applies to upstream ids; the phasing strategy *is* an upstream pass that has named these journeys. The agent's thinking never wrestles with this point at all; the renames happen silently during draft enumeration. This is the journey-axis analogue of sample 05's `P-CAM_MANAGER` → `P-CAM-MANAGER` mutation, but worse: where the persona mutation was a cosmetic underscore-to-hyphen drift, the journey mutations are full lexical renames and one outright drop. **MEDIUM severity** for the renames; the missing `UJ-GOVERNANCE-COMPLIANCE` is independently **MEDIUM** because the Phase 3 governance pillar's canonical journey is absent.

#### 1a.3 Workflow / journey contamination — system-facing flows masquerading as user journeys

The prompt's first paragraph draws the line explicitly: "1.3a proposes user journeys only; 1.3b proposes system workflows after the human accepts these journeys." A user journey is "an end-to-end flow from a persona's perspective". Three of the 25 outputs are not user journeys; they are system workflows with a thin persona-glance step pasted on:

- **`UJ-MONITOR-PLATFORM-HEALTH`** (P-ADMIN). Step 1 is `System` pushing metrics; step 2 is the admin "acknowledging anomalies and triggering remediation". The actual flow shape is a monitoring workflow that emits dashboard data and accepts a triage interaction. There is no end-to-end user goal; the admin is operating the platform, not using it.
- **`UJ-MANAGE-USER-ACCESS`** (P-ADMIN). Step 1 is "Create new user or modify roles", step 2 is `System` updating ACLs. This is admin tooling for tenant administration. It is a workflow with a UI surface, not a journey from a persona's perspective.
- **`UJ-SYNC-COMMUNITY`** (P-CAM-MANAGER). Step 1: "Trigger data sync with external HOA"; step 2: `System` "Merge external data with local ledger". This is a data-pipeline workflow with a "click sync" trigger.

These three should appear in 1.3b's workflow bloom output, not here. They consume coverage budget that should attach to actual journeys (e.g. P-ADMIN executing a service call human-in-the-loop is a journey; monitoring platform health is not). The agent's thinking chain even debates the P-ADMIN case ("P-ADMIN executes service calls? The strategy says Phase 2 focuses on Provider Field Services. P-ADMIN monitors platform health.") and converges on the workflow framing without revisiting whether that framing belongs in 1.3a. **MEDIUM severity** — three of 25 outputs are out-of-jurisdiction.

#### 1a.4 Cross-journey near-duplication

Three duplicate or near-duplicate pairs:

- **`UJ-BROWSE-CONTRACTORS`** (steps: review vetted providers, fetch and compare bids) vs. **`UJ-BROWSE-VENDORS-AI`** (steps: AI analyzes preferences, homeowner filters). Both are P-HOMEOWNER browsing vendors; the only material difference is the AI-curation framing in the second. These should be a single journey with an AI-recommendation sub-flow, or one should be tagged `umbrella: true`.
- **`UJ-APPROVE-VENDOR`** (P-CAM-MANAGER, "Approve Vendor Vetting") vs. **`UJ-REVIEW-VENDOR-REQ`** (P-CAM-MANAGER, "Review Vetting Request"). Both review vendor compliance docs and update vendor status. The titles paraphrase each other. The agent's thinking chain enumerated both names then committed both without revisiting the redundancy.
- **`UJ-REPORT-TENANT-ISSUE`** (P-TENANT, 2 steps: submit photo+description → System routes to property owner) vs. **`UJ-SUBMIT-MAINTENANCE-REQUEST`** (P-HOMEOWNER, 3 steps: describe issue → System AI-matches providers → System sends notifications). Different personas, but the journey shape is the same. The persona difference is real (tenant ≠ homeowner) so this is the most defensible of the three; it is mostly a sign that the agent did not articulate what is *distinctive* about the tenant flow (e.g. the routing-to-landlord-not-to-vendor difference is named in step 2 but is not in the scenario or AC).

**LOW–MEDIUM severity**, depending on whether the pruning step downstream is expected to merge near-duplicates.

#### 1a.5 Acceptance criteria are largely not measurable

The contract field comment says "Measurable success condition". A scan of the 25 journeys' AC arrays:

- **Performance-only ACs** (don't test journey behaviour): "Bid comparison table loaded within 3 seconds" (`UJ-BROWSE-CONTRACTORS`), "Job status updated to 'Scheduled' within 10 seconds" (`UJ-APPROVE-BID`), "Status update visible within 30 seconds of field action" (`UJ-VIEW-REPAIR-STATUS`), "Access change effective within 1 second" (`UJ-MANAGE-USER-ACCESS`), "Vote recorded within 5 seconds of submission" (`UJ-CAST-VOTE`).
- **Vacuous / unfalsifiable ACs**: "Recommendations relevant to user context" (`UJ-BROWSE-VENDORS-AI`), "Sync completes without data loss" (`UJ-SYNC-COMMUNITY`), "Data integrity verified against source files" (`UJ-REVIEW-STATEMENT`), "Logs displayed in real-time without delay" (`UJ-ACCESS-LOGS`), "Emergency queue prioritization verified" (`UJ-REQUEST-URGENT-SERVICE`), "Recommendations relevant to user context" (`UJ-BROWSE-VENDORS-AI`).
- **Behaviour-grounded ACs (the minority)**: "Geolocation verified within 5 meters" + "Timer accuracy within 1 second" (`UJ-START-JOB-LOGGING`) is genuinely behaviour-shaped; "Notification sent 30 days prior to meeting" (`UJ-SCHEDULE-ANNUAL-MEETING`) is concrete; "Verification complete within 4 hours of submission" (`UJ-REGISTRATION-PROFILE`) names a measurable threshold against a specific outcome.

Across the 25 journeys, roughly 5 have ACs that would survive a falsifiability check; the remaining 20 are either pure latency assertions or rephrased outcome restatements. **MEDIUM severity** — ACs are the load-bearing artefact for 1.3c coverage verification; if every AC is latency-or-vacuous, the verifier has nothing to verify.

#### 1a.6 `automatable` flag misapplied at journey-step joints

The prompt is unusually specific: "`automatable: true` when the step is performed by the system (non-persona actor) **OR when the step implies significant system-side work that a workflow must handle (even if a persona triggers it)**. Otherwise `automatable: false`. The 1.3b workflow bloom reads `automatable: true` steps as seeds."

The second clause — persona-triggered-but-system-heavy → `automatable: true` — is consistently violated. Examples:

- `UJ-APPROVE-BID` step 3: P-PROVIDER "Acknowledge job assignment" — `automatable: false`. But provider acknowledgement triggers system-side scheduling, notification cascade, and ledger commit. Should be `true`.
- `UJ-REGISTRATION-PROFILE` step 1: P-PROVIDER uploads docs — `automatable: false`. The upload triggers credential verification, file persistence, indexing, antivirus scan. Significant system work; should be `true`.
- `UJ-CAST-VOTE` step 1: P-BOARD "Review proposal and cast vote" — `automatable: false`. The cast triggers vote tallying, percentage calculation, audit log entry. Step 2 (System) handles the tally explicitly, but step 1 also has system-side weight (vote validation, eligibility check, idempotency).

Across the 25 journeys, every persona-actor step is tagged `automatable: false` mechanically. The agent never engages with the second clause of the rule. **MEDIUM severity** — this is a downstream-handoff defect; the 1.3b workflow bloom will under-seed because half its seeds are mistagged as non-automatable.

#### 1a.7 Phasing inconsistencies

The phasing strategy block is binding for `implementationPhase` tagging:

- Phase 1: Hestami Home (Homeowner experience).
- Phase 2: Provider Field Services.
- Phase 3: HOA / CAM.

Three drifts in the response:

- `UJ-REGISTRATION-PROFILE` (P-PROVIDER, vendor vetting) is tagged **Phase 1**. Provider lifecycle is Phase 2 by the strategy. The agent's thinking chain debated this and chose Phase 1 because vendor *discovery* is needed in Phase 1 for homeowners to find providers — but the strategy text says "Provider Field Services Management" is Phase 2; provider onboarding is part of that lifecycle. Defensible argument, no rationale recorded.
- `UJ-APPROVE-VENDOR` (P-CAM-MANAGER) is **Phase 1** despite CAM being Phase 3.
- `UJ-REVIEW-VENDOR-REQ` (P-CAM-MANAGER) is **Phase 1** for the same reason.

The agent's "Tag by the domain's phase" rule (paraphrasing the prompt) was applied inconsistently — DOM-VENDOR has no canonical phase tag; the phase was derived from "vendor discovery happens early" intuition. The strategy explicitly prefers persona-axis tagging in those cases. **LOW–MEDIUM severity**.

#### 1a.8 `umbrella: false` mechanically applied across all 25 journeys

The contract permits `umbrella: true` for journeys "that span multiple distinct sub-flows that each deserve their own title and acceptance criteria". At least three journeys are umbrella-shaped:

- `UJ-MONITOR-PLATFORM-HEALTH` covers detection, triage, and remediation as one flow.
- `UJ-CAST-VOTE` is mode-overloaded (board votes, AGM votes, member votes) — acceptable as separate journeys, but the title and scenario do not specify which.
- `UJ-EXPORT-PORTFOLIO-DATA` covers selection + aggregation + signed delivery.

The agent emits `umbrella: false` on every journey without a thinking-chain consideration of any candidate. **LOW severity** — the field exists for a decomposition affordance that the agent never used; the downstream 1.3a decomposition step now has nothing to decompose.

#### 1a.9 `unreached_personas` and `unreached_domains` empty by force, not by honest accounting

P-ADMIN's only journeys are the workflow-contaminated ones flagged in §1a.3. Strip those, and P-ADMIN has no plausible *user* journey — the admin's role is to operate the platform, not be a user of it. The bloom mandate handles this case explicitly: "If a persona has no plausible journey, state that explicitly in the `unreached_personas` field rather than silently omitting them." The honest disposition is `unreached_personas: [{ personaId: "P-ADMIN", reason: "Internal operator; covered by system workflows in 1.3b, not user journeys." }]`.

The agent forces inclusion to satisfy "Cover EVERY accepted persona" literally, which produces three workflow contaminants (§1a.3). The prompt offers an explicit escape valve and the agent never uses it. **LOW severity** as a contract field, but causally upstream of §1a.3.

#### 1a.10 `VV-SECURITY-ORIGIN-PROXY` cited as a category-mismatched surface

The prompt instruction: "Note V&V requirements **that imply user-facing feedback** (confirmation screens for consequential actions, audit receipts)." `VV-SECURITY-ORIGIN-PROXY` is a CDN-routing constraint — it implies no user-facing feedback. Citing it as a `surface` for `UJ-CAST-VOTE` or `UJ-REVIEW-STATEMENT` is a category error: the validator looking for user-facing-feedback V&V coverage will see the citation, mark coverage achieved, and move on, when in fact no user-feedback V&V exists for this product (because the input had only one V&V item and that item was infrastructure).

The honest response is to leave `vv_requirements: []` across all journeys *and* record a coverage gap (no user-feedback V&V was specified upstream). Citing the wrong-kind requirement is worse than empty. **MEDIUM severity** — this is the deeper version of the gemma reviewer's single finding, which caught the redundancy but not the category mismatch.

#### 1a.11 Speculative journeys committed without speculative-axis flagging

`UJ-BROWSE-VENDORS-AI` ("AI Vendor Recommendations") explicitly depends on AI matching infrastructure that may or may not be in scope for Phase 1 (DOM-AI-ENG's domain description says "Phase 2 provider management" / "predictive maintenance"). The journey is committed at Phase 1 with `priority: "medium"` and no rationale flag indicating it is speculative on the AI-availability axis. The user accepting this card has no signal to ask "is this dependent on infrastructure we haven't committed to?" Sample 05 §1a.10 flagged the same speculative-axis-blindness pattern; it recurs here. **LOW severity**.

#### 1a.12 Comparison-appendix absorption — *not present*

Sample 03 had a "ServiceTitan / Vantaca comparison-appendix absorption" pattern where the agent imported competitor framing into the response. This sample's source contains no such appendix and the response contains no comparison-style framing. Negative result; recording the check as performed.

### 1b. Analysis of the reviewer's 1 finding

> "Severity: LOW. Summary: Minor redundancy in V&V requirement application. Detail: The V&V requirement `VV-SECURITY-ORIGIN-PROXY` is applied to almost every user-facing journey. While technically correct as it covers all public client traffic, listing it repeatedly for every journey can clutter the output and suggests the agent didn't consider grouping or abstracting this universal requirement. However, since the verifier checks for citation, repeating it is the safest way to ensure coverage."

**Substantive accuracy: partial hit, severely mis-targeted.** It is true that `VV-SECURITY-ORIGIN-PROXY` appears in 22 of 25 journeys' `vv_requirements`. The reviewer correctly notices the repetition. But the reviewer's framing — "redundancy", "clutter", "consider grouping" — treats the defect as an aesthetic concern about output ergonomics. The actual defect is a category mismatch (§1a.10): the V&V cited is not the *kind* of V&V the prompt instructed the agent to surface. A reviewer that read the "Note V&V requirements that imply user-facing feedback" instruction would have caught this; the gemma reviewer either did not read it or did not connect it to the surface citation.

**Self-defang.** The finding's `recommendation` says "No change needed for correctness". A finding whose recommendation is "do not change anything" is the same self-cancelling structure flagged in sample 05's finding 3. It is at most an observation, not a defect; emitting it as a populated `concerns[]` entry inflates the gate signal without payload.

**Severity: under-calibrated.** Even on the reviewer's own (wrong) framing of "redundancy", this affects 22 of 25 journeys — that is systemic, not "minor". On the correct framing (category mismatch), it is at least MEDIUM. The reviewer chose LOW.

**Anchored: weakly.** The finding names the requirement ID and gestures at "almost every user-facing journey" but does not enumerate. It does not quote the prompt instruction it could have anchored to.

**Calibration: poor on three axes** — wrong jurisdiction (aesthetic vs. category), wrong severity (LOW vs. MEDIUM), wrong recommendation (none-needed vs. retag-or-empty).

### 1c. What the reviewer missed

Categorised by severity and anchored to §1a items:

**HIGH severity — missed:**

- §1a.1 **Compliance-surface evacuation**. Every `compliance_regimes` array empty across 25 journeys; six of the seven listed regimes have direct journey enactments that go un-attributed. This is the single largest defect in the response and the reviewer is silent on it.

**MEDIUM severity — missed:**

- §1a.2 **Journey-ID mutation.** Four phasing-strategy-named journey IDs renamed or dropped (`UJ-SETUP-PROPERTY`, `UJ-SUBMIT-REQUEST`, `UJ-EXECUTE-JOB`, `UJ-GOVERNANCE-COMPLIANCE`).
- §1a.3 **Workflow / journey contamination.** Three system-facing workflows in the `userJourneys` array.
- §1a.5 **AC measurability.** ~20 of 25 ACs are latency-only or vacuous.
- §1a.6 **`automatable` flag misapplied.** Persona-actor steps with significant system work mechanically tagged `false`; downstream 1.3b workflow bloom will under-seed.
- §1a.10 **V&V category mismatch.** The deeper version of the reviewer's only finding.

**LOW–MEDIUM severity — missed:**

- §1a.4 Cross-journey near-duplication (three pairs).
- §1a.7 Phasing inconsistency.
- §1a.9 `unreached_personas` not used honestly (P-ADMIN should be there).

**LOW severity — missed:**

- §1a.8 `umbrella` field never used.
- §1a.11 Speculative journeys not flagged.

The pattern from sample 05 holds: the reviewer's findings sit in a presentation/aesthetic register; the response's substantive defects sit in a contract-attribution and identity register. The two registers do not overlap. Sample 06 is a stronger statement of this gap because the response is twice the size and the gap is correspondingly wider — one finding, no HIGH-severity catches, no MEDIUM-severity catches, peripheral framing of the LOW finding.

---

## 2. Diagnosis

The role-specific failure modes for a user-journey bloom pass:

1. **Surface-attribution evacuation under text-vs-ID strictness.** When upstream lists arrive as plain text (no `COMP-*` IDs), the agent defaults to empty `surfaces` arrays rather than verbatim string citation or rationale-level attribution. The bloom mandate explicitly requires that "every compliance regime that implies a user-facing action must surface as a journey"; an empty surfaces array on a journey that obviously enacts a regime is a coverage lie. The fix is a validator that pairs every journey's title/scenario against the listed regime/retention bullets and flags missing attributions.

2. **Journey-ID mutation against pre-named upstream journeys.** The phasing strategy can name canonical journey IDs (here, four). Renames break cross-document references just as persona-ID mutation did in sample 05. The fix is a deterministic pre-pass that compares phasing-strategy-listed journey IDs to output journey IDs and flags any non-additive change.

3. **Workflow / journey jurisdiction confusion.** The 1.3a → 1.3b split means user journeys are persona-led end-to-end flows; system-facing workflows belong in 1.3b. Internal operator personas (P-ADMIN here) are the most common contamination vector — when forced to satisfy "cover every persona" the agent emits workflows under journey framing rather than using `unreached_personas`. The fix is a validator that checks each journey's step structure and persona-perspective coherence.

4. **`automatable` flag mechanically applied.** The contract has an explicit two-clause rule (system-actor OR persona-trigger-with-system-weight); the agent applies clause one only. The 1.3b workflow bloom reads `automatable: true` as its seed list, so under-tagging here propagates to under-seeding there. The fix is an LLM check that re-reads each persona-actor step and asks "does this step imply significant system-side work?".

5. **Acceptance-criteria measurability collapse.** ACs collapse to performance assertions ("loaded within X seconds") or vacuous restatements ("recommendations relevant to user context") because the agent treats the AC slot as a one-line ritual rather than a falsifiability gate. The fix is an AC-shape validator that requires (a) a measurable predicate, (b) a connection to journey behaviour beyond latency, (c) at least one behavioural AC per journey.

6. **Cross-journey near-duplication without `umbrella` decomposition.** The bloom mandate forbids self-pruning, but it does *not* forbid recognising that two candidate journeys are the same flow — the contract supports that recognition via `umbrella: true` and via the human pruning step. When the agent emits both `UJ-BROWSE-CONTRACTORS` and `UJ-BROWSE-VENDORS-AI` without flagging either as umbrella or noting the relationship in the second's scenario, the user pruning the cards has no signal that they are alternatives.

7. **Phasing-axis inconsistency.** When the phasing strategy maps phases to personas (Phase 2 = Provider) but the agent has multiple plausible mapping rules ("tag by persona", "tag by domain primary phase", "tag by readiness"), inconsistent application produces journeys whose phase tag conflicts with the strategy. The fix is a deterministic check: persona → strategy phase, domain primary persona → strategy phase, journey emitted phase — flag any disagreement.

8. **`unreached_personas` and `unreached_domains` as honest accounting fields.** These exist precisely so the agent can register "no plausible journey" without violating coverage. Forcing inclusion produces workflow contamination (P-ADMIN here). The fix is a validator that cross-checks: any persona whose only journeys are system-facing workflows should appear in `unreached_personas`.

9. **V&V category alignment.** "User-facing feedback" V&V is a different class from "infrastructure" V&V. Citing the wrong class as a journey surface produces false coverage. The fix is an LLM check that classifies each cited V&V item by category and verifies match to journey-surface intent.

10. **Speculative-axis flagging absent.** Same as sample 05 §1a.10. AI-dependent journeys (here `UJ-BROWSE-VENDORS-AI`) committed at concrete priority/phase without flagging the dependency.

---

## 3. Recommended validator pipeline for this role

Eleven validators. Three deterministic, eight LLM-based. Six are reuses or parameter-variations of the bloom-family validators introduced in sample 05; five are journey-specific.

| # | Validator | Type | Status vs. sample 05 |
|---|-----------|------|----------------------|
| 1 | `contract_schema_bloom` | deterministic | parameter-variation (journey schema instead of domain/persona schema) |
| 2 | `persona_id_continuity` | deterministic | exact reuse (now applied to `personaId`, `additionalPersonas`, `step.actor`) |
| 3 | `journey_id_continuity` | deterministic | **NEW — journey-specific** (phasing-strategy-named journey IDs) |
| 4 | `source_attribution_grounding` | LLM | parameter-variation (journey `source` field + surfaces arrays) |
| 5 | `surface_attribution_completeness` | LLM | **NEW — journey-specific** (compliance/retention/V&V/integration coverage by journey shape) |
| 6 | `persona_journey_coupling` | LLM | **NEW — journey-specific** (persona ↔ journey graph; honest `unreached_personas`) |
| 7 | `domain_journey_coupling` | LLM | **NEW — journey-specific** (domain ↔ journey graph; honest `unreached_domains`) |
| 8 | `workflow_journey_separation` | LLM | **NEW — journey-specific** (1.3a vs 1.3b jurisdiction) |
| 9 | `step_completeness_and_automatable` | LLM | **NEW — journey-specific** (step structure + automatable rule) |
| 10 | `acceptance_criteria_measurability` | LLM | **NEW — journey-specific** (falsifiability, behavioural grounding) |
| 11 | `phase_journey_alignment` | LLM-or-deterministic | parameter-variation of sample 05's `pillar_domain_alignment` |
| 12 | `bloom_completeness_vs_thinking` | LLM | exact reuse (sample 05 §4.6) |
| 13 | `open_question_vs_decided` | LLM | exact reuse |
| 14 | `reasoning_to_response_faithfulness` | LLM | exact reuse |

**Bloom-family generalisation finding.** Sample 05's bloom validators are *necessary but not sufficient* for the journey-bloom case. Specifically:

- `source_attribution_grounding` generalises with parameter variation: the grounding question is the same ("does the source field accurately reflect the relationship to the source?"), but the journey case has a *second* source-attribution surface — the `surfaces` arrays — that the domain bloom did not have. This sample's largest defect (§1a.1) lives entirely in the surfaces axis, not the source field axis. The validator must be parameterised to scan both.
- `pillar_domain_alignment` generalises to `phase_journey_alignment` with renaming: the question shifts from "are source-named pillars represented?" to "are phasing-strategy-named journeys represented and are tag assignments consistent with the phasing strategy?".
- `domain_persona_coherence` does *not* generalise cleanly. It splits into two journey-specific validators (`persona_journey_coupling`, `domain_journey_coupling`) because the journey case introduces a third axis (the journey itself) and the coherence question becomes a tripartite graph check.
- `entity_workflow_shape` does not apply — journeys do not have entityPreview/workflowPreview arrays.
- `bloom_completeness_vs_thinking` and `reasoning_to_response_faithfulness` carry over unchanged.

**The journey-specific additions** (`workflow_journey_separation`, `step_completeness_and_automatable`, `acceptance_criteria_measurability`, `surface_attribution_completeness`, `journey_id_continuity`) are not derivable from any sample 05 validator; they encode contract structure that is unique to the journey output shape (multi-step actors, automatable rule, surfaces arrays, phasing-strategy-named IDs).

**Validators that explicitly do NOT apply:**

- `scope_boundary_adherence_*` (sample 03) — the bloom is intended to expand, confirmed negative result for the second time.
- `entity_workflow_shape` (sample 05) — no entityPreview/workflowPreview in this contract.
- `regime_citation_validity` (sample 04) — *almost*, but not quite: this validator checked compliance regime IDs against an ID registry; here the regimes arrive as plain text and the relevant check is whether journey *surfaces* attribute to them, not whether IDs are valid. Captured by `surface_attribution_completeness` instead.

---

## 4. Validator prompt templates

### 4.1 `contract_schema_bloom` (deterministic, journey parameterisation)

Pseudocode:

```ts
function validateJourneyBloomContract(r: JourneyBloomResponse): Finding[] {
  // 1. JSON parseable, no markdown fences, no trailing prose.
  // 2. Top-level: { kind: "user_journey_bloom", userJourneys: [...],
  //                unreached_personas: [...], unreached_domains: [...] }.
  // 3. userJourneys length ∈ [1, 40] (warn at <8 or >25 per prompt's "expected coverage").
  // 4. Each journey:
  //    { id, personaId, additionalPersonas, title, scenario, businessDomainIds,
  //      steps, acceptanceCriteria, implementationPhase, priority, umbrella,
  //      source, surfaces }.
  // 5. id matches /^UJ-[A-Z0-9_-]+$/ ; ids unique.
  // 6. personaId references a known persona id; additionalPersonas all do too.
  // 7. businessDomainIds non-empty, all reference known domain ids.
  // 8. steps non-empty; each { stepNumber, actor, action, expectedOutcome, automatable }.
  //    actor is P-* OR "System" OR INT-*. stepNumber strictly ascending from 1.
  // 9. acceptanceCriteria non-empty.
  // 10. implementationPhase ∈ {"Phase 1", "Phase 2", "Phase 3"}.
  // 11. priority ∈ {critical, high, medium, low}.
  // 12. umbrella is boolean.
  // 13. source ∈ {document-specified, domain-standard, ai-proposed}.
  // 14. surfaces has all four keys (compliance_regimes, retention_rules, vv_requirements, integrations).
  // 15. No JSON quoting violations (the prompt's strict-quoting rule).
}
```

### 4.2 `persona_id_continuity` (exact reuse from sample 05)

Reused unchanged from sample 05 §4.2. For journeys the cross-reference set widens: `personaId`, `additionalPersonas[]`, and `step.actor` for any actor matching `P-*`. Dangling references in any of these three locations are MEDIUM findings.

### 4.3 `journey_id_continuity` (deterministic, NEW)

```ts
function validateJourneyIdContinuity(input: PhasingStrategy, output: JourneyBloom): Finding[] {
  // Parse phasing strategy text for journey-id citations: matches /UJ-[A-Z0-9_-]+/g.
  // For each cited input id:
  //   - exact match in output.userJourneys[].id → OK.
  //   - normalize match (case/dash/underscore equivalence) → MEDIUM (id_drift_normalized).
  //   - no match anywhere → HIGH (input_journey_dropped).
  //   - id appears renamed (semantic-similar journey present with different id) →
  //     MEDIUM (input_journey_renamed) ; this is a heuristic check —
  //     LLM fallback may be invoked to confirm semantic match.
  // Catches §1a.2.
}
```

### 4.4 `source_attribution_grounding` (LLM, parameter-variation from sample 05 §4.3)

Mission and decision standard carry over. Two journey-specific augmentations:

```text
[ADDITIONAL IN-SCOPE — JOURNEYS]
Beyond the journey's own `source` field, scan each journey's `surfaces`
arrays:
- surfaces.compliance_regimes against the Accepted Compliance Regimes list.
- surfaces.retention_rules against the Accepted Retention Rules list.
- surfaces.vv_requirements against the Accepted V&V Requirements list.
- surfaces.integrations against the Accepted Integrations list.

[ADDITIONAL DECISION STANDARD]
- A journey whose title, scenario, or steps directly enact a listed
  regime/retention/V&V/integration item but whose corresponding surfaces
  array does not cite that item is an under_attribution defect.
- Plain-text upstream items (no formal ID) MAY be cited verbatim as strings
  OR mentioned in the journey's rationale — both are acceptable. An empty
  surfaces array on a journey that obviously enacts an item is NOT
  acceptable, even when the upstream item lacks a formal ID.

[ADDITIONAL FINDING TYPES]
- under_attribution_compliance — journey enacts a listed regime; surfaces.compliance_regimes is empty.
- under_attribution_retention  — same pattern, retention rules.
- vv_category_mismatch         — vv_requirements cites an item whose category
                                 (infrastructure / feedback / latency / accessibility)
                                 does not match the journey's surface intent.
- over_attribution             — surfaces cites an item the journey does not actually enact.
```

This catches §1a.1 and §1a.10. Severity: HIGH for systemic under-attribution (>50% of applicable journeys missing the citation); MEDIUM for category mismatch on a single requirement applied broadly; LOW for individual misattributions.

### 4.5 `surface_attribution_completeness` (LLM, NEW)

```text
[MISSION]
Verify journey-by-journey that every upstream item which the prompt
*requires* to surface as a journey is in fact surfaced — both at the
journey-existence level and at the surfaces-array attribution level.

[IN-SCOPE]
- Accepted Compliance Regimes, Retention Rules, V&V Requirements,
  Integrations from the prompt.
- userJourneys[] including each journey's title, scenario, steps,
  acceptanceCriteria, and surfaces arrays.

[DECISION STANDARD]
For each compliance regime that implies a user-facing action (the prompt
gives examples: data export rights, deletion rights, consent management,
voting rules, statutory notices):
  - At least one journey must enact it (existence check).
  - That journey's surfaces.compliance_regimes must cite it (attribution check).
  - If neither: HIGH severity uncovered_user_facing_compliance.
  - If existence yes, attribution no: MEDIUM under_attribution.

For each retention rule that affects a user-visible artefact (archive
warnings, re-consent prompts, scheduled purges):
  - Same two-step check (existence, attribution).

For each V&V requirement classified as user-feedback (confirmation
screens, audit receipts, accessibility — NOT infrastructure or latency):
  - Same two-step check.

For each integration that is user-facing (OAuth, marketplace, SSO):
  - Same two-step check.

[FINDING TYPES]
- uncovered_user_facing_compliance / retention / vv / integration
- under_attribution_compliance / retention / vv / integration
- vv_category_mismatch (cited item is wrong category for the journey)

[INPUTS, OUTPUT CONTRACT — same shape as §4.4]
```

This catches §1a.1 most directly and reinforces §1a.10. The validator is the journey-bloom analogue of sample 04's compliance-coverage validators but operates at the *journey-surface* granularity rather than at the policy-document granularity.

### 4.6 `persona_journey_coupling` (LLM, NEW)

```text
[MISSION]
Verify the bidirectional persona ↔ journey graph: every accepted persona
either owns a journey or is honestly listed in unreached_personas; every
journey's persona references resolve to accepted personas.

[IN-SCOPE]
- Accepted Personas list from the prompt.
- userJourneys[].personaId, .additionalPersonas, .steps[].actor (when P-*).
- unreached_personas[].

[DECISION STANDARD]
For each accepted persona id:
  - If it appears as personaId on ≥1 journey AND that journey is a true
    user journey (not a workflow — see §4.8 workflow_journey_separation):
    OK, persona covered.
  - If it appears as personaId only on workflow-shaped flows (per
    workflow_journey_separation): MEDIUM forced_inclusion_via_workflow
    (the persona has been forced into coverage by labelling a workflow as
    a journey; the honest disposition is unreached_personas).
  - If it does not appear AND is in unreached_personas with a rationale:
    OK, honestly unreached.
  - If it does not appear AND is not in unreached_personas: HIGH
    silent_persona_omission.

For each persona id referenced in personaId, additionalPersonas, or
step.actor:
  - Must be in the accepted personas list.
  - Otherwise MEDIUM dangling_persona_reference.

[INPUTS, OUTPUT CONTRACT — same shape as §4.4]
```

Catches §1a.9 (P-ADMIN forced inclusion via workflow contamination).

### 4.7 `domain_journey_coupling` (LLM, NEW)

Mirror structure to `persona_journey_coupling` with `businessDomainIds` and `unreached_domains` replacing the persona references. Findings: `silent_domain_omission`, `dangling_domain_reference`, `gratuitous_domain_inclusion` (a domain cited in `businessDomainIds` whose journey does not actually touch the domain — e.g. `UJ-APPROVE-VENDOR` citing DOM-COMMUNITIES gratuitously). Severity LOW for gratuitous inclusion; HIGH for silent omission.

### 4.8 `workflow_journey_separation` (LLM, NEW)

```text
[MISSION]
Confirm each entry in userJourneys[] is a USER JOURNEY (an end-to-end
flow from a persona's perspective) and not a SYSTEM WORKFLOW (a process
the platform runs that happens to have a UI surface). 1.3b is the
workflow bloom; 1.3a's userJourneys[] must contain only journeys.

[DECISION STANDARD]
A journey is workflow-shaped (defect) when ANY of these hold:
  (a) The persona's role in the flow is operator/admin rather than user
      (the persona is operating the system, not pursuing a goal through
      the system).
  (b) The end-to-end flow could complete without the persona's
      involvement — the persona's step is a glance or trigger, not a
      goal-bearing action.
  (c) The flow's "outcome" is a system state change (data synced,
      metrics displayed, ACL updated) rather than a user-meaningful
      result (request submitted, vote cast, payment received).
  (d) The steps are predominantly System actor with persona steps
      sandwiched in (e.g. System → P-X → System where the persona step
      is acknowledgement-shaped).

[FINDING TYPES]
- workflow_masquerading_as_journey — emit when ≥2 of (a)–(d) hold.
- ambiguous_journey — emit when exactly one of (a)–(d) holds; LOW severity.

[SEVERITY GUIDE]
- MEDIUM: a clear workflow miscategorised (e.g. UJ-MONITOR-PLATFORM-HEALTH).
- LOW: an ambiguous case where the persona's role is partly operator,
  partly user.

[INPUTS, OUTPUT CONTRACT — same shape as §4.4]
```

Catches §1a.3.

### 4.9 `step_completeness_and_automatable` (LLM, NEW)

```text
[MISSION]
Verify each journey's steps satisfy the contract step structure AND that
the automatable flag is applied per the contract's two-clause rule.

[STEP STRUCTURE CHECKS — deterministic where possible]
- stepNumber strictly ascending from 1, no gaps.
- actor is P-* OR "System" OR INT-*.
- action and expectedOutcome are non-empty, non-vacuous strings.
- automatable is boolean.
- Each journey has ≥2 steps OR a clearly atomic single-step journey.

[AUTOMATABLE RULE — LLM check]
For each step where actor is a persona (P-*) AND automatable is false:
  - Read the action and expectedOutcome.
  - Ask: does completing this step imply significant system-side work
    (validation, persistence, notification, calculation, indexing,
    routing, scheduling, ledger entry, ACL update, audit log)?
  - If YES: the step should be automatable: true (per contract clause 2).
    Emit automatable_under_tagged at MEDIUM.
  - If NO (the step is a pure persona action with no system follow-on):
    OK.

For each step where actor is "System" AND automatable is false:
  - This contradicts contract clause 1. Emit automatable_contradiction at HIGH.

[INPUTS, OUTPUT CONTRACT — same shape as §4.4]
```

Catches §1a.6.

### 4.10 `acceptance_criteria_measurability` (LLM, NEW)

```text
[MISSION]
Verify each journey's acceptanceCriteria are measurable success
conditions — falsifiable predicates that bind the journey's behaviour.

[DECISION STANDARD]
For each AC string:
  - Is the predicate testable? (a measurable threshold, a binary outcome,
    or a structural property)
  - Does it bind to a journey-specific behaviour, not just generic
    performance? (Pure latency ACs — "loaded within X seconds" — are
    necessary but not sufficient; a journey of N steps needs at least
    one behavioural AC.)
  - Is it falsifiable in principle? (vacuous predicates like
    "recommendations relevant to user context" or "sync completes
    without data loss" are not falsifiable without a definition of
    "relevant" or "data loss".)

[FINDING TYPES]
- vacuous_ac (LOW per AC; MEDIUM if all journey's ACs vacuous)
- latency_only_ac (LOW per journey, MEDIUM if pattern across ≥50% of journeys)
- missing_behavioural_ac (MEDIUM per journey)

[INPUTS, OUTPUT CONTRACT — same shape as §4.4]
```

Catches §1a.5.

### 4.11 `phase_journey_alignment` (LLM-or-deterministic, parameter-variation of sample 05 §4.4)

Sample 05's `pillar_domain_alignment` checks source-named organising concepts. Here the organising concept is the phasing strategy, which is more structured: it explicitly names canonical journey IDs and binds personas to phases. The validator becomes more deterministic:

```ts
function validatePhaseJourneyAlignment(input, output): Finding[] {
  // 1. For each phasing-strategy-named journey id, verify presence
  //    (defers to journey_id_continuity §4.3).
  // 2. For each output journey, derive expected phase from:
  //    (a) personaId → phasing strategy persona-phase mapping
  //    (b) primary businessDomainId → phasing strategy domain-phase mapping
  // 3. Compare to journey.implementationPhase. Flag disagreements as
  //    MEDIUM phase_tag_disagreement when (a) and (b) agree but the tag
  //    differs; LOW phase_tag_underdetermined when (a) and (b) disagree
  //    and the tag matches one of them.
}
```

Catches §1a.7.

### 4.12 `bloom_completeness_vs_thinking` — exact reuse from sample 05 §4.6

Forbidden-rejection patterns transfer unchanged: "low priority", "future scope", "too niche", "covered by [X]" without the coverage shown. Journey-specific addition to the permitted-rejection list: "this is a workflow not a journey" (recognising 1.3a/1.3b separation is a permitted reason to drop a candidate).

### 4.13 `open_question_vs_decided` — exact reuse from sample 03/04/05

Triggers for journeys: an `ai-proposed` journey with infrastructure dependencies (AI matching, third-party integration not yet scoped) that is committed at concrete priority/phase without a speculative-axis flag. Catches §1a.11.

### 4.14 `reasoning_to_response_faithfulness` — exact reuse

Journey-specific markers:

- "I will leave compliance_regimes empty" / "I will not invent COMP-* IDs" — rule-commitment statements that the agent respects in the response but that contradict the surface-coverage mandate. Same `faithful_to_wrong_rule` pattern as sample 05's persona-ID-mutation case.
- "I'll cite VV-SECURITY-ORIGIN-PROXY everywhere" — over-application that the response confirms.
- "I'll force P-ADMIN inclusion to satisfy coverage" — coverage-formality vs honest-accounting tension; the response's lack of `unreached_personas` confirms the choice.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_bloom` | yes (deterministic) | `agent_role == "domain_interpreter" && sub_phase == "user_journey_bloom"` |
| `persona_id_continuity` | yes (deterministic) | same; only if input has accepted personas |
| `journey_id_continuity` | yes (deterministic) | same; only if phasing strategy names canonical journey ids |
| `source_attribution_grounding` | yes (LLM) | same; skip if contract failed |
| `surface_attribution_completeness` | yes (LLM) | same; skip if contract failed |
| `persona_journey_coupling` | yes (LLM) | same |
| `domain_journey_coupling` | yes (LLM) | same |
| `workflow_journey_separation` | yes (LLM) | same |
| `step_completeness_and_automatable` | yes (LLM, deterministic prefilter) | same |
| `acceptance_criteria_measurability` | yes (LLM) | same |
| `phase_journey_alignment` | conditional (deterministic) | phasing strategy is present |
| `bloom_completeness_vs_thinking` | conditional (LLM) | `agent_thinking_chain.length > 0` |
| `open_question_vs_decided` | yes (LLM) | same |
| `reasoning_to_response_faithfulness` | conditional (LLM) | `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_bloom                      (deterministic, gate)
2. persona_id_continuity                      (deterministic)
3. journey_id_continuity                      (deterministic)
4. step_completeness_and_automatable          (deterministic prefilter, LLM follow-up)
5. workflow_journey_separation                (LLM — early, because downstream
                                                validators' findings change
                                                category if a journey is reclassified
                                                as a workflow)
6. source_attribution_grounding               (LLM)
7. surface_attribution_completeness           (LLM — primary semantic check;
                                                largest defect class lives here)
8. persona_journey_coupling                   (LLM)
9. domain_journey_coupling                    (LLM)
10. phase_journey_alignment                   (deterministic / LLM fallback)
11. acceptance_criteria_measurability         (LLM)
12. open_question_vs_decided                  (LLM)
13. bloom_completeness_vs_thinking            (LLM, conditional)
14. reasoning_to_response_faithfulness        (LLM, conditional)
15. final_synthesis                           (LLM, unchanged)
```

`surface_attribution_completeness` runs before the coupling validators because the surfaces axis is where the largest defect class lives (§1a.1 alone outweighs every other defect category in this sample). `workflow_journey_separation` runs early so subsequent coupling validators can treat workflow-flagged entries differently.

### 5.2 Deterministic vs LLM split

- **Deterministic:** `contract_schema_bloom`, `persona_id_continuity`, `journey_id_continuity`, `phase_journey_alignment` (mostly), and the prefilter portion of `step_completeness_and_automatable`. These are pure structural / lookup checks.
- **LLM:** `source_attribution_grounding`, `surface_attribution_completeness`, `persona_journey_coupling`, `domain_journey_coupling`, `workflow_journey_separation`, `acceptance_criteria_measurability`, the automatable-rule portion of `step_completeness_and_automatable`, `bloom_completeness_vs_thinking`, `open_question_vs_decided`, `reasoning_to_response_faithfulness`.

### 5.3 Integration with samples 01–05

- `contract_schema_*` registry continues; this is the fifth role-keyed entry. Journey schema is unique enough that no logic shares across roles, but the dispatch shape is identical.
- `persona_id_continuity` is now confirmed cross-role (samples 05, 06).
- `source_attribution_grounding` is now confirmed cross-role with parameter variation (samples 05, 06). The journey-bloom case demonstrates that the validator must scan *secondary* attribution surfaces (the surfaces arrays here), not just the primary `source` field.
- `bloom_completeness_vs_thinking` and `reasoning_to_response_faithfulness` carry over unchanged from sample 05; both are now strong cross-role validators within the bloom family.
- `pillar_domain_alignment` parameter-varies into `phase_journey_alignment` cleanly.
- `domain_persona_coherence` (sample 05) splits into `persona_journey_coupling` + `domain_journey_coupling` — confirming the intuition in sample 05 §5.5 that the validator stays role-specific and the journey-bloom instantiation needs a tripartite-graph rewrite.
- `entity_workflow_shape` (sample 05) does not apply — confirmed negative result.
- `scope_boundary_adherence_*` (samples 03, 04) does not apply — second negative result for the bloom family. The pattern is now firm: the family applies to extraction passes (which have layer assignments) but never to synthesis passes.

### 5.4 Cross-validator deduplication

Five overlap pairs to manage in `final_synthesis`:

- `surface_attribution_completeness` (under_attribution_compliance) and `source_attribution_grounding` (under_attribution variant). Treat the surfaces validator as primary because it operates with category-level granularity (which regime, which retention rule); attribution-grounding observations on the surfaces axis are subsumed.
- `workflow_journey_separation` (workflow_masquerading_as_journey) and `persona_journey_coupling` (forced_inclusion_via_workflow). These are causally linked: the latter exists because the former emitted a finding. Dedup by treating `workflow_journey_separation` as primary; `persona_journey_coupling` cites the workflow finding by reference.
- `journey_id_continuity` (input_journey_renamed) and `bloom_completeness_vs_thinking` (self_pruning if the rename was framed as "decomposition for clarity"). Independent — completeness audits the candidates dropped; continuity audits the IDs renamed.
- `step_completeness_and_automatable` (automatable_under_tagged) and `acceptance_criteria_measurability` (missing_behavioural_ac). Sometimes correlated — when ACs are latency-only, the steps are often persona-trigger-only — but track separately.
- `phase_journey_alignment` (phase_tag_disagreement) and `journey_id_continuity` (input_journey_dropped) when a missing canonical journey would have anchored phase tags. Treat continuity as primary.

### 5.5 Cross-role validator promotion hypotheses

- `surface_attribution_completeness`: stays journey-bloom-specific in this exact form. The general pattern — "verify both existence and citation of upstream items" — generalises to any pass with a coverage mandate plus an attribution surface (Phase 2 architecture / requirements coverage, Phase 4 component / NFR coverage). Defer until those samples are seen.
- `workflow_journey_separation`: stays journey-bloom-specific. The general pattern — "verify each output is in the right jurisdiction" — could generalise to any pass with a sibling-pass split (1.0a/1.0b, 1.3a/1.3b, 1.5a/1.5b), but the specific decision standard depends on the contract.
- `step_completeness_and_automatable`: stays journey-bloom-specific. The automatable rule is unique to this contract.
- `acceptance_criteria_measurability`: potentially generalises to any pass that emits acceptance criteria (Phase 2 requirements pass, Phase 4 component-AC pass). Defer.
- `persona_journey_coupling` / `domain_journey_coupling`: stay role-specific to the journey-bloom; the tripartite-graph shape is unique here. The bipartite version (`domain_persona_coherence`) remains in the bloom-family general-purpose set.

---

## 6. Notes and open questions

1. **The reviewer's single finding is informative beyond its content.** Sample 04 produced zero findings on a defective response; sample 05 produced three findings, one solid, one partial, one self-cancelling; sample 06 produces one finding that is itself self-defanging. The trend across the four reviewed samples (04, 05, 06, plus 02's silence) is that the gemma reviewer's *gate* is becoming more reliable (firing when defects exist) but the *content* of its findings is not improving. This is consistent with the original ChatGPT 5.5 redesign hypothesis: the failure is in the prompt's lack of positive checks, not in the gate logic.

2. **Compliance-surface evacuation is the bloom-family's mirror-defect to source-tag fabrication.** Sample 05's agent over-claimed `user-specified` because the source field was a free-form choice. Sample 06's agent under-attributed to empty arrays because the surfaces field has formal-ID validation. The same prompt instruction ("if a concept isn't in the accepted list, don't cite it") was the trigger for both behaviours. The instruction is strict-correct for fabricated-ID cases but over-strict for plain-text upstream items. Recommend the prompt clarify: plain-text upstream items may be cited verbatim as strings, and an empty surfaces array on a journey that obviously enacts a listed item is a coverage failure, not a referential-integrity success.

3. **Sample 06 is a regression-test fixture for surface-attribution evacuation.** All 25 journeys' `compliance_regimes` arrays are empty against a list of seven plain-text regimes that have at least four direct journey enactments. A future agent change that surfaces ≥4 of the regimes is measurable improvement. Recommend adding to the validator-development test suite with an expected `surface_attribution_completeness` finding count of ≥4 HIGH/MEDIUM `under_attribution_compliance` findings.

4. **Journey-ID mutation is a deterministic-recovery defect with auto-recovery potential.** The renames here (`UJ-SETUP-PROPERTY` → `UJ-ONBOARD-PROPERTY`) are semantic-similar but lexically divergent — auto-recovery requires a semantic-similarity check that a deterministic normaliser cannot perform alone. Recommend `journey_id_continuity` HIGH findings for outright drops trigger human review; MEDIUM findings for renames trigger an LLM-assisted normalisation pass that proposes the canonical-id-and-content match for human confirmation.

5. **The `automatable` flag is the most important downstream-handoff signal in the journey-bloom contract.** 1.3b reads `automatable: true` steps as workflow seeds. Under-tagging here propagates to under-seeding there; the agent's mechanical "persona action → false" rule will systematically starve 1.3b of workflow proposals on every product where the bulk of journey steps are persona-triggered-but-system-heavy. Recommend `step_completeness_and_automatable` findings flow into 1.3b's input as advisory hints ("the journey-bloom's automatable tagging may be conservative; consider seeding workflows from these N additional steps") rather than blocking 1.3a acceptance.

6. **Comparison-appendix absorption did not recur.** Sample 03's pattern (importing competitor framing into the response) is absent here. The user-journey bloom appears insulated from this defect class because the source contains no competitor appendix. Negative result; the validator family that catches comparison-absorption stays in the discovery-pass jurisdiction.

7. **Sample 06 confirms two cross-sample patterns.**
   - The `scope_boundary_adherence_*` family is excluded from synthesis passes (negative for samples 05 and 06 — firm).
   - `source_attribution_grounding` is the bloom-family's primary defect catcher, with parameter variation per role. It would have caught the largest defect on both sample 05 and sample 06; the gemma reviewer caught neither.

8. **Reviewer finding count is uncorrelated with reviewer accuracy.** Sample 04: zero findings on a defective response. Sample 05: three findings, one solid. Sample 06: one finding, self-defanging. The reviewer's defect-detection rate against the §1a actual-defect lists is roughly 0/8, 1/10, and 0/12 across the three reviewed samples. The gate is becoming more reliable; the content is not. Recommend a post-redesign benchmark target of ≥50% recall against curated defect lists per sample.

9. **Surface-attribution is the journey-bloom's load-bearing concept.** Of the journey contract's twelve top-level fields, `surfaces` is the one whose correctness propagates furthest downstream — 1.3c's coverage verifier, 1.6's compliance ingestion, Phase 4's NFR linkage. Any reviewer prompt redesign for this role must positively instruct "for each journey, scan title/scenario/steps for enactments of the upstream compliance/retention/V&V/integration items; verify each enactment is reflected in the surfaces array".

10. **Bloom-family generalisation finding (final).** Sample 05's bloom-validator set is roughly 60% sufficient for the journey-bloom case: `source_attribution_grounding`, `bloom_completeness_vs_thinking`, `reasoning_to_response_faithfulness`, `open_question_vs_decided`, and `persona_id_continuity` carry over unchanged or with parameter variation. The remaining 40% requires journey-specific additions: `journey_id_continuity`, `surface_attribution_completeness`, `workflow_journey_separation`, `step_completeness_and_automatable`, `acceptance_criteria_measurability`, plus the split of `domain_persona_coherence` into `persona_journey_coupling` + `domain_journey_coupling`. The bloom-family generic set does not collapse into a single shared validator pipeline; each bloom contract's structure dictates a distinct mix. The cross-bloom commonality lives in the *defect categories* (provenance attribution, completeness vs thinking, faithfulness) more than in the *validators* themselves.
