# Phase 1 Product-Lens Intake — Plan

**Status:** Proposal, awaiting approval.
**Authors:** mchendricks1 + Claude (Opus 4.7).
**Date:** 2026-04-18.
**Depends on:** `intent-lens-aware-phase-1-dmr-pipeline-card` (shipped).
**Updates:** `docs/janumicode_spec_v2.3.md`, `src/test/harness/phaseContracts.ts`.

---

## 1. Why

The VS Code extension's Phase 1 output for real product intents (tested against the Hestami spec) is structurally thin: one `intent_statement` with a sparse `product_concept` object and a handful of assumptions. The v1 system, given the *same* intent, produced a 71 KB handoff document with 6 personas, 9 user journeys, 13 business domains, 45 entities, 6 workflows, 14 integrations, 14 quality attributes, and a 3-phase phasing strategy — each section generated in its own LLM-backed proposer round with a human prune gate between rounds.

The shape of v1's output is the thing Phase 2+ needs. The single-round bloom-then-synthesize flow in v2 cannot produce it.

This plan replaces v2's Phase 1.2–1.6 flow under the **product** lens with a v1-style four-round bloom-and-prune proposer loop, emits a v1-shaped product description handoff document, and upgrades the virtuous-cycle test harness to grade against it.

## 2. What stays and what changes

**Stays:**
- Phase 1.0 Intent Quality Check.
- Phase 1.0a Intent Lens Classification (its output is what routes us into this flow).
- Phase 1.1b Scope Bounding + compliance context.
- v2's governed-stream architecture, record types, decision_bundle surface, DMR pipeline.
- Non-product lenses (feature, bug, infra, legal) continue using the current 1.2–1.6 collapsed flow.

**Changes (product lens only):**
- Sub-phases 1.2–1.6 are replaced by sub-phases 1.0b + 1.2 + 1.3 + 1.4 + 1.5 + 1.6 + 1.7 (seven sub-phases: silent discovery + four bloom/prune rounds + synthesis + approval).
- New record type `product_description_handoff` carrying the v1 `finalizedPlan` shape.
- Sub-phase 1.6 Synthesis *also* derives and emits a compatibility `intent_statement` record so Phases 2–9 keep reading their existing interface.
- Free-text feedback on any prune gate re-runs the current proposer with feedback injected (v1 parity).
- Harness contracts become lens-aware. Phase 1 contract for `lens=product` asserts the new sub-phase list and new artifact kinds.
- v2.3 spec's Phase 1 section is updated to describe the lens-conditional sub-phase topology.

## 3. Sub-phase layout (product lens)

| Sub-phase | Purpose | LLM? | User gate |
|---|---|---|---|
| 1.0 | Intent Quality Check | yes (Orchestrator) | findings review only if non-pass |
| 1.0a | Intent Lens Classification | yes (Orchestrator) | none (silent) |
| **1.0b** | **Product Intent Discovery** — narrow product-slice: vision, description, seed personas, seed journeys, phasing, product-level requirements/decisions/constraints/open-questions | yes (Domain Interpreter) | none (silent) |
| **1.0c** | **Technical Constraints Discovery** — stated-not-invented technical stack / infrastructure / security / deployment decisions | yes (Domain Interpreter) | none (silent) |
| **1.0d** | **Compliance & Retention Discovery** — regulatory regimes, legal retention obligations, audit requirements | yes (Domain Interpreter) | none (silent) |
| **1.0e** | **V&V Requirements Discovery** — measurable targets with threshold + measurement | yes (Domain Interpreter) | none (silent) |
| **1.0f** | **Canonical Vocabulary Discovery** — domain-specific terms + definitions | yes (Domain Interpreter) | none (silent) |
| **1.0g** | **Intent Discovery Synthesis** — deterministic composer that merges 1.0b–1.0f outputs into the `IntentDiscoveryBundle` consumed by downstream sub-phases | **no (deterministic)** | none |
| 1.1b | Scope Bounding + Compliance | deterministic | none |
| **1.2** | **Business Domains + Personas Bloom** | yes (Domain Interpreter) | decision_bundle (MMP prune) |
| **1.3** | **User Journeys + Workflows Bloom** | yes (Domain Interpreter) | decision_bundle (MMP prune) |
| **1.4** | **Business Entities Bloom** | yes (Domain Interpreter) | decision_bundle (MMP prune) |
| **1.5** | **Integrations + Quality Attributes Bloom** | yes (Domain Interpreter) | decision_bundle (MMP prune) |
| **1.6** | **Product Description Synthesis** → emits `product_description_handoff` + derived `intent_statement` | yes (Domain Interpreter) | none (silent) |
| **1.7** | **Handoff Approval** (mirror of the full handoff doc) | no | mirror_presented (full doc review) |

Sub-phase IDs for non-product lenses remain `1.0 → 1.0a → 1.1b → 1.2 → 1.3 → 1.4 → 1.5 → 1.6` (collapsed flow).

## 4. User-facing narrative — Hestami happy path

Assume the user runs: *"Review `specs\hestami-ai-real-property-os(2)\Hestami AI Real Property OS and Platform Product Description.md` and prepare for implementation."* Phase 0 ingested the referenced file. The user accepts every Mirror and Menu without edits.

### 1.0 — Intent Quality Check
A card appears: **"Intent Quality Check — pass."** Completeness findings show `what_is_being_built`, `who_it_serves`, `what_problem_it_solves` all present (evidence quoted from the ingested spec). No consistency or coherence flags. User clicks Continue.

### 1.0a — Intent Lens Classification
A card appears: **"Classified as **product** (confidence 0.94)."** Rationale cites the spec's "build" + three-pillar + persona language. `workflow_runs.intent_lens = 'product'` is written. User clicks Continue.

### 1.0b — Intent Discovery (silent)
No user interaction — the Governed Stream shows a running ticker as the Domain Interpreter reads the raw intent + inlined spec and emits a single `artifact_produced[kind='intent_discovery']` record containing vision ("integrated, holistic, end-to-end home services OS"), productDescription (the three-pillar summary), seed personas (homeowner, service provider, CAM, etc.), seed journeys, a 3-phase phasingStrategy, plus requirements/decisions/constraints/openQuestions. Takes ~30 s on real LLM.

### 1.1b — Scope Bounding (deterministic)
Two records emit: `scope_classification` (`breadth: single_product, depth: production_grade`) and `compliance_context` (regimes: empty in this case). No user interaction.

### 1.2 — Business Domains + Personas Bloom (Proposer Round 1)
Domain Interpreter runs DMR → bloom. A decision_bundle card appears titled **"Review Business Domains and Personas."**

- **Mirror section** — interpretation assumptions the proposer made (persona boundaries, multi-tenancy framing, pillar decomposition), rendered with category chips (`persona`, `scope`, `anti_goal`).
- **Menu section — Domains (multi-select, pre-checked):** ~13 proposed domains: Property & Asset Management, Service & Work Order Management, Field Service Operations, Identity & Access, Documents, Billing & Accounting, Compliance & Governance, Notifications, Analytics & AI, Scheduling, Inventory, Routing, Integrations.
- **Menu section — Personas (multi-select, pre-checked):** 6 personas: Homeowner/Resident, Service Provider Admin, Technician, Community Association Manager, HOA Board Member, Platform Operator.

User clicks **Submit decisions** (everything kept). An `artifact_produced[kind='business_domains_bloom']` record is stamped with the accepted domains + personas. If the user had typed free text instead of submitting MMP decisions, the proposer would re-run with that feedback — mirroring v1's feedback-loop behavior.

### 1.3 — User Journeys + Workflows Bloom (Proposer Round 2)
Proposer takes accepted domains + personas, produces journeys + system workflows. Card: **"Review User Journeys and System Workflows."**

- **Mirror** — assumptions about journey primacy ("homeowner onboarding is Phase-1 critical path"), scope framing.
- **Menu — Journeys:** 9 journeys, each with steps, actors, acceptance criteria, and a `phase` tag (Phase 1, 2, or 3). E.g. UJ-1 *Homeowner Onboards and Sets Up Their Property*; UJ-3 *Service Provider Receives and Responds to Work Order*; UJ-8 *Homeowner Pays Annual Community Assessment*.
- **Menu — Workflows:** 6 system workflows. E.g. WF-1 *Service Provider Recommendation* (AI-driven matching), WF-4 *Automated AR Collections*.

User accepts all. Record: `artifact_produced[kind='journeys_workflows_bloom']`.

### 1.4 — Business Entities Bloom (Proposer Round 3)
Proposer takes accepted domains + workflows, produces the entity catalog. Card: **"Review Business Entities."**

- **Mirror** — data-model assumptions (multi-tenancy boundary at `Tenant`, soft-delete policy, audit table pattern).
- **Menu — Entities:** 45 entities grouped by domain, each with key attributes + relationships. E.g. `User`, `Profile`, `Property`, `Asset`, `ServiceCall`, `Bid`, `WorkOrder`, `Invoice`, `Payment`, `Technician`, `Community`, `Assessment`, `BoardMember`, `ComplianceRule`.

User accepts all. Record: `artifact_produced[kind='entities_bloom']`.

### 1.5 — Integrations + Quality Attributes Bloom (Proposer Round 4)
Proposer takes everything above, produces integrations + NFRs. Card: **"Review Integrations and Quality Attributes."**

- **Mirror** — framing assumptions (delegate payments to Stripe-class gateway; sync bank data via Plaid-class aggregator).
- **Menu — Integrations:** 14 integrations, each categorized (payment, banking, ERP, geocoding, identity, notifications, maps, storage, AI, etc.) with ownershipModel (`delegated` / `synced` / `consumed`).
- **Menu — Quality Attributes:** 14 NFRs — multi-tenant isolation, RBAC, AES-256 encryption, WCAG 2.1 AA, SOC2 readiness, mobile-first UX, etc.

User accepts all. Record: `artifact_produced[kind='integrations_qa_bloom']`.

### 1.6 — Product Description Synthesis (silent)
Domain Interpreter consolidates all four accepted bloom outputs + the 1.0b intent discovery seed + scope/compliance into a single `product_description_handoff` record matching v1's `finalizedPlan` shape (see §5). In parallel, derives a compatibility `intent_statement` record: `product_concept.name = productVision`; `description = productDescription`; `who_it_serves = personas[0].name + role phrase`; `problem_it_solves` synthesized from openQuestions + requirements. No user interaction.

### 1.7 — Handoff Approval
A mirror_presented card renders the full handoff doc as a reviewable document: collapsed sections for vision, personas, journeys, domains, entities, workflows, integrations, quality attributes, phasing. User can expand any section, accept the whole doc, or reject. On accept → `phase_gate_evaluation` emits → Phase 2 begins. On reject → Phase 1 returns `requires_input`.

## 5. Data model — new record types

### 5.1 `product_description_handoff`

New record_type (add to `RecordType` union in `src/lib/types/records.ts`). Content shape mirrors v1's `finalizedPlan` verbatim so the v1 Hestami handoff can be used as a gold reference directly:

```ts
export interface ProductDescriptionHandoffContent {
  kind: 'product_description_handoff';
  schemaVersion: '1.0';
  requestCategory: 'product_or_feature'; // always this value under product lens
  productVision: string;
  productDescription: string;
  summary: string;
  personas: Persona[];               // { id, name, description, goals, painPoints }
  userJourneys: UserJourney[];       // { id, personaId, title, scenario, steps, acceptanceCriteria, implementationPhase, priority, source }
  phasingStrategy: PhasingPhase[];   // { phase, description, journeyIds, rationale }
  successMetrics: string[];
  businessDomainProposals: BusinessDomain[];   // { id, name, description, rationale, entityPreview, workflowPreview, source }
  entityProposals: Entity[];                   // { id, businessDomainId, name, description, keyAttributes, relationships, source }
  workflowProposals: Workflow[];               // { id, businessDomainId, name, description, steps, triggers, actors, source }
  integrationProposals: Integration[];         // { id, name, category, description, standardProviders, ownershipModel, rationale, source }
  qualityAttributes: string[];
  uxRequirements: string[];
  requirements: RequirementEntry[];   // { id, type, text, extractedFromTurnId, timestamp }
  decisions: DecisionEntry[];
  constraints: ConstraintEntry[];
  openQuestions: OpenQuestionEntry[];
  humanDecisions: HumanDecision[];    // captured per-round from decision_bundle_resolved
  openLoops: OpenLoop[];
}
```

Every sub-type has a dedicated TypeScript interface + a JSON schema at `.janumicode/schemas/artifacts/product_description_handoff.schema.json`.

### 5.2 Intermediate bloom record kinds

Each proposer round writes one `artifact_produced` with a distinct `content.kind`:
- `intent_discovery` (1.0b)
- `business_domains_bloom` (1.2)
- `journeys_workflows_bloom` (1.3)
- `entities_bloom` (1.4)
- `integrations_qa_bloom` (1.5)

Each captures its proposer output plus (after the prune gate) the user's accept/reject/edit decisions per item so downstream rounds only see kept items.

### 5.3 `intent_statement` stays as-is
The existing `IntentStatementContent` shape is unchanged. 1.6 synthesis emits a derived `intent_statement` with content projected from the handoff. Phases 2–9 keep reading it with zero changes.

## 6. Prompts — ported from v1

New template files under `.janumicode/prompts/phases/phase_01_intent_capture/`:

| v1 prompt source | v2 template path | lens |
|---|---|---|
| `INTAKE_INTENT_DISCOVERY_SYSTEM_PROMPT` (`janumicode/src/lib/roles/technicalExpertIntake.ts:752-891`) | `sub_phase_01_0b_intent_discovery/intent_discovery.product.system.md` | product |
| `BUSINESS_DOMAIN_PROPOSER_PROMPT` (~line 1850 in v1) | `sub_phase_01_2_business_domains_bloom/business_domains_bloom.product.system.md` | product |
| `JOURNEY_WORKFLOW_PROPOSER_PROMPT` (~line 2035 in v1) | `sub_phase_01_3_journeys_workflows_bloom/journeys_workflows_bloom.product.system.md` | product |
| `ENTITY_PROPOSER_PROMPT` (~line 2201 in v1) | `sub_phase_01_4_entities_bloom/entities_bloom.product.system.md` | product |
| `INTEGRATIONS_QA_PROPOSER_PROMPT` (~line 2300 in v1) | `sub_phase_01_5_integrations_qa_bloom/integrations_qa_bloom.product.system.md` | product |
| `INTAKE_SYNTHESIS_SYSTEM_PROMPT` (`technicalExpertIntake.ts:241-331`) | `sub_phase_01_6_product_description_synthesis/product_description_synthesis.product.system.md` | product |

All templates declare `lens: product` in frontmatter. The lens-aware `TemplateLoader.findTemplate` already supports lens routing; these slot in directly.

Each proposer prompt carries forward its round's accepted items into the next round via `{{accepted_domains}}`, `{{accepted_journeys}}`, etc.

Feedback-loop behavior: if the user submits free text on a prune gate, `Phase1Handler` re-invokes the same proposer with `{{user_feedback}}` filled in, using v1's prompt variant that accepts feedback revisions.

## 7. Orchestration — `Phase1Handler` changes

The current `Phase1Handler.execute` branches on lens at the top:

```ts
const lens = lensClassification.fallback_lens;
if (lens === 'product') {
  return this.executeProductLens(ctx, ...);
}
return this.executeDefaultLens(ctx, ...);  // current flow, unchanged
```

`executeProductLens` runs 1.0b → 1.1b → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 sequentially. Each bloom round follows the same template:

1. `stateMachine.setSubPhase(runId, subPhaseId)`.
2. Run DMR (optional — only 1.2 needs it; 1.3–1.5 inherit context via `derived_from_record_ids`).
3. Render the round's lens-specific template with prior rounds' accepted items.
4. Call Domain Interpreter.
5. Write round's `artifact_produced` with the bloom output.
6. Build a `decision_bundle_presented` from the bloom (Mirror = interpretation assumptions; Menu = proposer items).
7. `pauseForDecision` (auto-approve in tests).
8. If resolution type is free-text feedback, loop back to step 3 with feedback injected; else extract kept items and continue.

Sub-phase 1.6 Synthesis is silent — no decision bundle; writes both the handoff record and the derived intent_statement.

Sub-phase 1.7 Approval emits a mirror_presented with the full handoff doc, then the phase gate.

## 8. Downstream compatibility (Option A)

Phases 2–9 stay untouched in this iteration. They read `intent_statement` from 1.6. The richer `product_description_handoff` sits alongside it for future opt-in consumers.

Flagged for a follow-up: Phase 2 Requirements is the strongest candidate to upgrade to read the handoff directly — it would get the full journey/entity/workflow catalog as requirement seeds and would stop re-inventing them.

## 9. v2.3 spec updates

`docs/janumicode_spec_v2.3.md` §4 Phase 1 currently enumerates sub-phases 1.0 / 1.1b / 1.2 / 1.3 / 1.4 / 1.5 / 1.6 as invariant. Change:

- Introduce the concept of **lens-conditional sub-phase topology** in §4 preamble. Sub-phases before 1.0a are lens-agnostic; sub-phases after 1.0a may vary per lens.
- Add a new subsection §4.product describing the product-lens flow (the table in §3 of this plan).
- Keep the collapsed 1.2–1.6 flow documented as `§4.default` for feature / bug / infra / legal lenses until lens-specific flows ship for those too.

## 10. Virtuous-cycle test harness upgrades

### 10.1 Make `PHASE1_CONTRACT` lens-aware
`src/test/harness/phaseContracts.ts` currently hard-codes a single `PHASE1_CONTRACT`. Refactor:

```ts
export const PHASE1_CONTRACT_DEFAULT: PhaseContract = { /* current contract */ };
export const PHASE1_CONTRACT_PRODUCT: PhaseContract = { /* new product-lens contract */ };
export function getPhaseContract(phaseId: PhaseId, lens?: IntentLens): PhaseContract {
  if (phaseId === '1' && lens === 'product') return PHASE1_CONTRACT_PRODUCT;
  if (phaseId === '1') return PHASE1_CONTRACT_DEFAULT;
  // ... other phases unchanged
}
```

Update `lineageValidator.ts` to fetch the run's `intent_lens` from the workflow run and thread it into `getPhaseContract`.

`PHASE1_CONTRACT_PRODUCT` asserts:
- sub-phase IDs present: `1.0`, `1.0a`, `1.0b`, `1.1b`, `1.2`, `1.3`, `1.4`, `1.5`, `1.6`, `1.7`
- `intent_quality_report` at 1.0
- `artifact_produced[kind='intent_lens_classification']` at 1.0a (fixing the pre-existing stale-contract gap)
- `artifact_produced[kind='intent_discovery']` at 1.0b
- `scope_classification` + `compliance_context` at 1.1b
- `artifact_produced[kind='business_domains_bloom']` + `decision_bundle_presented` at 1.2
- `artifact_produced[kind='journeys_workflows_bloom']` + `decision_bundle_presented` at 1.3
- `artifact_produced[kind='entities_bloom']` + `decision_bundle_presented` at 1.4
- `artifact_produced[kind='integrations_qa_bloom']` + `decision_bundle_presented` at 1.5
- `artifact_produced[kind='product_description_handoff']` + derived `artifact_produced[kind='intent_statement']` at 1.6
- `mirror_presented` + `phase_gate_evaluation` at 1.7

### 10.2 Coverage + shape grading (new oracle layer)
The current validator is pass/fail on artifact presence. For the product handoff, pure presence is not enough — a handoff with `personas: []` would pass presence but be useless. Add a **shape-and-coverage oracle** that, when the lens is `product`, also asserts:

| Field | Assertion |
|---|---|
| `personas` | length ∈ [3, 15], each has `name` + `goals[]` (≥1) + `painPoints[]` (≥1) |
| `userJourneys` | length ∈ [5, 15], each has `steps[]` (≥3) + `acceptanceCriteria[]` (≥1) + `implementationPhase` |
| `businessDomainProposals` | length ∈ [6, 30], each has `entityPreview[]` (≥3) + `workflowPreview[]` (≥1) |
| `entityProposals` | length ∈ [20, 150], each has `keyAttributes[]` (≥2) + `relationships[]` (≥1) + `businessDomainId` refers to a real domain |
| `workflowProposals` | length ∈ [3, 30], each has `steps[]` (≥3) + `triggers[]` (≥1) |
| `integrationProposals` | length ∈ [5, 35], each has `standardProviders[]` (≥1) + `ownershipModel` ∈ {delegated, synced, consumed} |
| `qualityAttributes` | length ∈ [8, 25] |
| `phasingStrategy` | length ∈ [2, 5], `journeyIds[]` all refer to real journeys |

Thresholds reflect the capable-CLI reality — Codex gpt-5.4 reliably produces 2–2.5× more items per section than qwen3.5:9b or the v1 reference (6 personas → 13; 45 entities → 106; etc.). Lower bounds are unchanged: same minimum-quality floor regardless of backing. These are **shape/coverage** gates, not content gates. The grader reports any violation in the harness gap report.

*Note on iteration history: the initial ranges (iter-2) were calibrated against a qwen3.5:9b run and the v1 Hestami handoff. Iter-3c surfaced Codex's over-proposing behaviour; upper bounds were widened to match without relaxing the minimum-content floor. Two gold references are maintained — `product_description_handoff.gold.json` (qwen3.5:9b baseline) and `product_description_handoff.codex.gold.json` (Codex gpt-5.4 richer output).*

*Iter-4 added decomposition: iter-3c's analysis showed that a single monolithic 1.0b pass silently dropped entire categories (tech stack completely absent despite being in the source doc's "Core Technological Infrastructure and Stack" section). Phase 1.0 was split into five focused extraction passes (1.0b product / 1.0c technical / 1.0d compliance / 1.0e V&V / 1.0f vocabulary) plus a deterministic composer (1.0g). Each extraction pass is narrow enough that probabilistic drift is bounded per category. The oracle grades each category independently against its own length range, with `[0, N]` lower bounds that allow legitimate emptiness for simple intents.*

*Iter-4 also introduced the traceability spine — every extracted item in `technicalConstraints[]`, `complianceExtractedItems[]`, `vvRequirements[]`, and `canonicalVocabulary[]` carries a `source_ref` with `document_path` + verbatim `excerpt`, so downstream drift chains (`source_excerpt → extracted_item → requirement → component → test_result`) can be walked mechanically by Phase 8 Evaluation.*

### 10.3 Gold-reference capture
The first passing real-mode run of the Hestami intent under the product lens is captured as a **gold reference** at `src/test/fixtures/hestami-product-description/gold/product_description_handoff.gold.json`. Subsequent runs are diffed against it for structural drift (same field set, same reference integrity — e.g. every `journey.personaId` resolves). Content divergence is expected and not flagged.

A dev-mode CLI command `janumicode harness capture-gold --phase 1 --lens product` refreshes the gold when the prompts/schemas intentionally change.

### 10.4 The virtuous cycle — gap report → AI coding agent → re-run
The harness itself stays single-pass. The "virtuous cycle" is a **closed loop between the harness (which defines the output contract) and an AI coding agent (which edits prompts/schemas/code until the output meets the contract)**. The harness is the oracle; the AI agent is the fixer; the human approves the resulting diffs.

For the loop to work, the **gap report is the load-bearing artifact**. It has to be specific enough that an agent picking it up cold — no prior context from a previous session — can act on it. Required fields per gap:

```jsonc
{
  "gap_id": "stable hash — lets later runs deduplicate",
  "phase_id": "1",
  "sub_phase_id": "1.4",
  "severity": "error | warning",
  "category": "missing_artifact | shape_violation | coverage_violation | invariant_violation | schema_violation",
  "summary": "one-sentence headline — what the gap is",
  "expected": { "record_type": "artifact_produced", "content.kind": "entities_bloom" },  // contract entry that failed
  "observed": { /* actual state — missing, or the problematic artifact content */ },
  "likely_source": {
    // Best-effort pointer to the code/prompt the fixer should look at first.
    // Not authoritative, but saves the agent 80% of the search.
    "templates": [".janumicode/prompts/.../entities_bloom.product.system.md"],
    "handlers":  ["src/lib/orchestrator/phases/phase1.ts:executeProductLens"],
    "schemas":   [".janumicode/schemas/artifacts/product_description_handoff.schema.json"]
  },
  "reproduce": {
    "command": "pnpm test:harness -- --fixture=hestami-product-description --phase=1",
    "run_id": "<uuid>",
    "gold_reference_path": "src/test/fixtures/hestami-product-description/gold/product_description_handoff.gold.json"
  }
}
```

Gap reports are written to `.janumicode/harness-gap.json` (today's path — unchanged) but with this richer structure. Agents (or humans) read them, edit the indicated files, and re-run the harness. Converging on zero gaps is the success state.

### 10.5 Optional follow-up — autonomous repair command
(Speculative, scheduled after everything else lands — not part of the primary virtuous cycle.) A `janumicode harness propose-repair --gap-id X` command could invoke the Orchestrator role on the gap + the indicated template and emit a proposed diff to stdout, which a human (or another agent) can choose to apply. This is a productivity accelerator, not a correctness mechanism — every applied diff still lands via normal commit review. Do not confuse this with the virtuous cycle itself.

## 11. Implementation ordering

Ship in bite-sized waves. Each wave ends with a green regression.

**Wave 1 — Types + record types (no behavior change).**
Add `product_description_handoff` to `RecordType`; add all Content interfaces; add JSON schema; add `'1.0b'`, `'1.7'` to `SUB_PHASE_NAMES['1']` and `SUB_PHASE_ORDER['1']` (product lens variant). No templates, no handler changes. Ship.

**Wave 2 — Prompts + template loader wiring.**
Port all six v1 prompts to lens-tagged templates in the prompts tree. Verify `TemplateLoader.findTemplate('domain_interpreter', '01_2_business_domains_bloom', 'product')` returns the right template. No handler changes yet. Ship.

**Wave 3 — `Phase1Handler.executeProductLens` (happy path only, no feedback loop).**
Implement the full 1.0b → 1.7 pipeline end-to-end. Free-text feedback on bundles falls through to "accept all" for this wave. Mock-mode fixtures added for each bloom round. Harness contract still using the default (collapsed) contract — we intentionally let the harness report a gap here; the gap is the TODO list for Wave 4. Ship.

**Wave 4 — Lens-aware harness contract + shape/coverage oracle.**
Implement Wave 10.1 + 10.2 above. Harness now grades the product-lens run. Expect real quality issues to surface. Capture the first clean real-mode run as the gold reference (Wave 10.3). Ship.

**Wave 5 — Free-text feedback loop on prune gates.**
Implement v1 parity: free-text on a decision_bundle re-runs the proposer with the feedback injected. Add a test for the loop. Ship.

**Wave 6 — v2.3 spec update.**
Update `docs/janumicode_spec_v2.3.md` to describe the lens-conditional sub-phase topology. Ship.

**Wave 7 (optional, speculative) — Autonomous repair command (§10.5).**
Only if Waves 1–6 surface enough gap volume to warrant it. Not required for the virtuous cycle to function — Waves 1–5 are sufficient. Ship only on demand.

## 12. Risks / out of scope

**Risks:**
- Real-mode LLM runs for the full Hestami flow take ~5–10 minutes across 6 LLM calls. Harness runtime budget needs adjusting in CI.
- The v1 Hestami handoff was generated by a specific model (GPT-class, v1 era); reproducing its depth with v2's current provider routing may require model tuning. The shape/coverage ranges (§10.2) exist precisely so the oracle doesn't block on exact-content parity.
- Free-text feedback loop can loop forever if the user keeps rejecting. Add a max-retries gate (e.g. 3 per round) that halts with `requires_input` if exceeded.
- Making the contract lens-aware touches `collectResults.ts`, `lineageValidator.ts`, and any test that imports `PHASE1_CONTRACT` directly. Audit grep before Wave 4.

**Out of scope (follow-ups):**
- Lens-specific flows for feature / bug / infra / legal lenses — they continue on the collapsed flow.
- Phase 2+ upgrading to read `product_description_handoff` directly — flagged for a follow-up once the handoff shape is stable.
- Persisting human free-text feedback as first-class `feedback_received` records in the governed stream (currently lives only on the decision_bundle_resolved record).

## 13. Confirmations needed before Wave 1 starts

This plan assumes the answers given earlier in the conversation:
1. Replace, not append — under product lens. ✅
2. Four user gates, one per proposer round. ✅
3. Keep the free-text feedback re-run loop. ✅
4. New `product_description_handoff` record type. ✅
5. Update the v2.3 spec. ✅
6. Real-mode LLM for harness runs; v1 Hestami handoff as **approximate** gold. ✅
7. Option A downstream compat (emit both handoff + derived intent_statement). ← **confirm.**

Outstanding:
- Is Wave 1 OK to kick off as soon as this plan is approved, or do you want to sequence differently?
- For Wave 4 (harness oracle shape/coverage thresholds), are the ranges in §10.2 acceptable, or do you want to tighten/loosen them?

---

## 14. Wave 5 — Phase 2 product-lens upgrade *(post-implementation notes)*

Wave 5 extends the traceability spine one phase downstream. Summary:

- **`Phase2Handler`** now detects `product_description_handoff` presence in the governed stream. When found, the FR/NFR bloom helpers resolve `lens: product` templates that consume the handoff's rich sections directly rather than re-deriving from `intent_statement`. When absent (default lens), behavior is unchanged — minimal-risk isolation.
- **`traces_to[]`** added to every `UserStory` (FR) and `NonFunctionalRequirement` (NFR). Valid id prefixes: `UJ-*` / `ENT-*` / `WF-*` / `COMP-*` / `VOC-*` / `Q-*` for FRs; `VV-*` / `QA-#` / `TECH-*` / `COMP-*` / `UJ-*` for NFRs.
- **`requirements_agent` role** added to `llm_routing` with its own CLI env-var plumbing (`JANUMICODE_REQUIREMENTS_AGENT_BACKING/PROVIDER/MODEL`). Mirrors the orchestrator + domain_interpreter routing pattern.
- **`PHASE2_CONTRACT_PRODUCT`** + two new multi-failure oracle validators:
  - `validateRequirementsProductTraceability` (error): every FR/NFR has non-empty `traces_to[]` and all ids resolve against the handoff catalog.
  - `validateJourneyCoverageByFRs` (warning): every accepted `userJourney` has ≥1 FR tracing to it.
- **Two gold references captured at Wave 5.10** — `product_requirements.qwen.gold.json` (baseline, qwen3.5:9b) and `product_requirements.codex.gold.json` (rich, Codex gpt-5.4).

Downstream implication: when Phase 3–9 are upgraded in future waves, they'll follow the same pattern — detect handoff presence, resolve lens-tagged templates, carry `traces_to[]` on every derived artifact. Phase 8 Evaluation walks the resulting chain `source_ref → extracted_item → requirement → component → test_result` for mechanical drift detection.

**Deferred** (tracked for follow-up): recursive requirements decomposition within Phase 2 — currently FR and NFR are each single LLM passes. If the product-lens run shows signs of probabilistic drift (missing journey coverage, unclassified NFRs), decompose further (e.g. 2.2a security / 2.2b performance / 2.2c compliance).
