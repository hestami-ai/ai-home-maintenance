# Architecture Phase Redesign — Verification Prompt (v3)

Use this prompt to verify that the implementation matches the design intent. The verifier should read the specified files and check each criterion. Report PASS/FAIL for each check with a brief explanation.

**Version history:**
- v1: Initial verification prompt (65 checks). Codex verified: 59 PASS / 3 FAIL / 3 PARTIAL.
- v2: Updated after fixes addressing all 3 FAILs and 3 PARTIALs. Checks 6b, 6d, 7b, 7d, 7e updated. New section 14 added for fix-specific regression checks. Total: 75 checks.
- v3: Added deeper-analysis checks for shortcut risk, artifact fidelity, human judgment support, prompt strength, and final merit assessment. Existing structural and regression checks preserved. Total: 90 checks.

---

## Context

The ARCHITECTURE phase was redesigned to produce structured engineering documents instead of shallow catalogs. The single DESIGNING sub-state was split into four focused sub-states (MODELING, DESIGNING, SEQUENCING, VALIDATING), each producing a specific artifact via a dedicated CLI tool invocation. The card rendering was enriched to show full field-level detail. Anti-hallucination guardrails and traceability checks were added.

**Key design principles:**
1. Each sub-state gets the full context budget dedicated to one document type
2. Previous artifacts are injected as input context for the next stage
3. Components emerge from workflow flow analysis, not architectural templates
4. No infrastructure components unless requirements explicitly demand them
5. The "Decompose Deeper" action uses agent-backed re-design, not mechanical splits
6. **No generic Data/Logic/API layering** — `splitByConcern()` has been entirely removed from the codebase
7. **Progressive card enrichment** — the architecture design card gains sections as sub-states complete (Domain Model from MODELING, Implementation Roadmap from SEQUENCING)

---

## Checks

### 1. Sub-State Machine (6 states)

**File:** `src/lib/types/architecture.ts`
**File:** `src/lib/workflow/architecturePhase.ts`

- [ ] **1a.** `ArchitectureSubState` enum has exactly 6 values: `DECOMPOSING`, `MODELING`, `DESIGNING`, `SEQUENCING`, `VALIDATING`, `PRESENTING` — in that order.
- [ ] **1b.** The main dispatch switch in `executeArchitecturePhase()` has a case for each of the 6 sub-states, routing to: `executeDecomposing`, `executeModeling`, `executeDesigning`, `executeSequencing`, `executeValidating`, `executePresenting`.
- [ ] **1c.** `executeDecomposing()` transitions to `MODELING` (not DESIGNING) after success.
- [ ] **1d.** `executeModeling()` transitions to `DESIGNING` after success.
- [ ] **1e.** `executeDesigning()` transitions to `SEQUENCING` (not VALIDATING) after success.
- [ ] **1f.** `executeSequencing()` transitions to `VALIDATING` after success.

### 2. Type Enrichment

**File:** `src/lib/types/architecture.ts`

- [ ] **2a.** `ComponentSpec` has a `rationale: string` field with JSDoc explaining it contains why the component exists and which requirements it serves.
- [ ] **2b.** `ComponentSpec` has an `interaction_patterns: string[]` field with JSDoc explaining it describes how the component communicates with dependencies.
- [ ] **2c.** `DataModelSpec` has an `invariants: string[]` field with JSDoc about business rules that must always hold.
- [ ] **2d.** All three new fields are non-optional (not `?`).

### 3. MODELING Sub-State

**File:** `src/lib/roles/architectureExpert.ts`
**File:** `src/lib/context/builders/architecture.ts`
**File:** `src/lib/workflow/architecturePhase.ts`

- [ ] **3a.** `MODELING_SYSTEM_PROMPT` exists and describes a domain modeling task (not component design).
- [ ] **3b.** The prompt instructs the agent to: (1) examine capabilities and workflows to identify entities, (2) read ground-truth specs if available, (3) define field-level detail, (4) map relationships, (5) define invariants.
- [ ] **3c.** The prompt includes an anti-hallucination guardrail: every entity must trace to at least one workflow.
- [ ] **3d.** `buildModelingContext()` exists and injects capabilities + workflows with step-level detail (inputs, outputs per step).
- [ ] **3e.** `invokeArchitectureModeling()` exists and follows the pattern: resolve provider -> build context -> build stdin -> invoke CLI -> parse response.
- [ ] **3f.** `parseModelingResponse()` exists and normalizes `data_models` with: `model_id`, `entity_name`, `description`, `fields[]` (name, type, required, description), `relationships[]`, `constraints[]`, `invariants[]`, `source_requirements[]`.
- [ ] **3g.** `executeModeling()` emits workflow command blocks (start/output/complete), updates the architecture document with `data_models`, writes a `architecture_modeling` dialogue event, and transitions to DESIGNING.

### 4. Redesigned DESIGNING Sub-State

**File:** `src/lib/roles/architectureExpert.ts`
**File:** `src/lib/context/builders/architecture.ts`

- [ ] **4a.** `DESIGNING_SYSTEM_PROMPT` describes flow-first design — tracing data flow through workflows to derive components.
- [ ] **4b.** The prompt requires `rationale` on each component (referencing REQ-ids or WF-ids).
- [ ] **4c.** The prompt requires `interaction_patterns` describing HOW each component communicates with dependencies.
- [ ] **4d.** The prompt includes an anti-hallucination guardrail: "Do NOT create components for infrastructure patterns (idempotency registries, workflow orchestrators, message queues, caching layers) unless specific requirements demand them."
- [ ] **4e.** The DESIGNING prompt's JSON schema requests ONLY `components` and `interfaces` — NOT `data_models` or `implementation_sequence` (those come from MODELING and SEQUENCING respectively).
- [ ] **4f.** `buildDesigningContext()` injects the domain model from MODELING as a distinct section labeled "Domain Model (from MODELING stage)" with full field and relationship detail.
- [ ] **4g.** `buildDesigningContext()` includes decomposition configuration parameters (max_depth, max_breadth, responsibility_threshold, context_token_limit).
- [ ] **4h.** `parseDesignResponse()` does NOT parse `data_models` or `implementation_sequence` from the response.

### 5. SEQUENCING Sub-State

**File:** `src/lib/roles/architectureExpert.ts`
**File:** `src/lib/context/builders/architecture.ts`
**File:** `src/lib/workflow/architecturePhase.ts`

- [ ] **5a.** `SEQUENCING_SYSTEM_PROMPT` exists and describes an implementation roadmap task.
- [ ] **5b.** The prompt instructs phased grouping (foundation first, then dependents).
- [ ] **5c.** The prompt requires concrete verification methods ("Run unit tests for X", not "Test it").
- [ ] **5d.** `buildSequencingContext()` exists and injects: capabilities, components with dependencies, domain model summary, interfaces.
- [ ] **5e.** `invokeArchitectureSequencing()` exists and follows the standard invocation pattern.
- [ ] **5f.** `parseSequencingResponse()` normalizes `implementation_sequence` with: `step_id`, `label`, `description`, `components_involved[]`, `dependencies[]`, `estimated_complexity`, `verification_method`, `sort_order`.
- [ ] **5g.** `executeSequencing()` emits command blocks, updates the document, writes an `architecture_sequencing` event, and transitions to VALIDATING.

### 6. Decompose Deeper — Agent-Backed (No Mechanical Splitting)

**File:** `src/lib/workflow/architectureRecursion.ts`
**File:** `src/lib/workflow/architecturePhase.ts`

- [ ] **6a.** In `applyRecursiveDecomposition()`, when `forcedDecompose` is true but `decomposeComponent()` returns 0 or 1 sub-components, the code does NOT fall back to any generic splitting function. A comment says "Even when forced, we do NOT fall back to generic Data/Logic/API layering."
- [ ] **6b.** `splitByConcern()` does NOT exist anywhere in `architectureRecursion.ts`. Searching for the string `splitByConcern` in the entire file must return zero matches. The only splitting function is `splitByWorkflow()`.
- [ ] **6c.** In `architecturePhase.ts`, when `decomposeDeeper` is true, `executeDesigning()` re-invokes the CLI tool (calls `invokeArchitectureDesign()`) with existing components in context — it does NOT skip the LLM call or only run heuristic recursion.
- [ ] **6d.** The deeper decomposition feedback text (the `deeperFeedback` string array) includes ALL FIVE of these analysis dimensions:
  1. "Workflow analysis" — splitting by workflow boundaries
  2. "Data flow patterns" — separate data entity code paths
  3. "Domain model alignment" — entity-oriented boundaries from the Domain Model
  4. "Workspace codebase" — examining existing source files and directory structure
  5. "Implementation concerns" — natural file/module boundaries
- [ ] **6e.** `decomposeComponent()` in `architectureRecursion.ts` has exactly ONE decomposition strategy: `splitByWorkflow()`. If a component's `workflows_served.length` does not exceed the `responsibility_threshold`, the function returns `[]` (empty array, no split). There is no context-fit-based splitting fallback.
- [ ] **6f.** No comment in `architecturePhase.ts` references "split-by-concern", "3x growth", or "Data/Logic/Interface layers". Any comment about decomposition scaling should reference "agent-backed deeper analysis" instead.

### 7. StreamItem Enrichment & Cross-Stage Data Wiring

**File:** `src/lib/ui/governedStream/dataAggregator.ts`

- [ ] **7a.** The `architecture_design` StreamItem type carries enriched component data: `rationale`, `workflowsServed`, `dependencies`, `interactionPatterns`, `technologyNotes`, `fileScope` — all present alongside existing `id`, `label`, `responsibility`, `parentId`.
- [ ] **7b.** The `architecture_design` event in `architecturePhase.ts` includes `data_models` in its `content` field: `JSON.stringify({ components: ..., interfaces: ..., data_models: doc.data_models })`. When the aggregator processes this event, it extracts `data_models` from the content and maps them into the StreamItem with FULL field arrays: `fields: Array<{ name, type, required }>`, `relationships: Array<{ targetModel, type, description }>`, `invariants: string[]`.
- [ ] **7c.** The `architecture_design` StreamItem carries enriched interfaces: `description`, `contract`, `providerComponent`, `consumerComponents[]`, `sourceWorkflows[]`.
- [ ] **7d.** When the aggregator processes an `architecture_sequencing` event, it reads the **full architecture document from the database** via `getArchitectureDocumentForDialogue(dialogueId)` and emits an `architecture_design` StreamItem containing ALL four sections: components, dataModels, interfaces, AND implementationSequence — all populated from the database document (not from the event content alone).
- [ ] **7e.** The aggregator imports `getArchitectureDocumentForDialogue` from `../../database/architectureStore`. The event routing handles three distinct event types: `architecture_design` (emits card from event content with empty `implementationSequence`), `architecture_sequencing` (emits full card from database document), and `architecture_modeling` (visible only through command blocks — no card emission).
- [ ] **7f.** The `architecture_design` card emitted from the `architecture_design` event handler has `implementationSequence: []` (empty array), because SEQUENCING has not yet run at that point. The full implementation sequence only appears in the card emitted after the `architecture_sequencing` event.

### 8. Card Rendering — 4-Section Layout

**File:** `src/lib/ui/governedStream/html/components.ts`

- [ ] **8a.** `renderArchitectureDesignCard()` signature accepts 5 parameters: `components` (enriched), `dataModels` (enriched), `interfaces` (enriched), `implementationSequence`, `timestamp`.
- [ ] **8b.** Section 1 (Components) renders each component as a card with: ID, label, responsibility paragraph, rationale (italic), workflow badges (blue), dependency badges (orange), technology notes, file scope, interaction patterns. Sub-components are rendered recursively inside collapsible `<details>`.
- [ ] **8c.** Section 2 (Domain Model) renders each entity as a card with: ID, entity name, description, a field table (name, type, required/optional), relationship arrows (-> target (type) description), invariant list.
- [ ] **8d.** Section 3 (Interfaces) renders each interface as a card with: ID, label, type badge (purple), description, contract in a `<pre>` block, provider/consumer info, workflow badges.
- [ ] **8e.** Section 4 (Implementation Roadmap) renders each step with: ID, label, complexity badge (color-coded: HIGH=red, MEDIUM=yellow, LOW=green), description, components involved, dependency links, verification method.
- [ ] **8f.** Components section is `<details open>` (expanded by default). Domain Model, Interfaces, and Roadmap sections are `<details>` (collapsed by default).
- [ ] **8g.** The call site in the main render switch passes `item.implementationSequence` as the 4th argument.

### 9. CSS for Enriched Cards

**File:** `src/lib/ui/governedStream/html/styles.ts`

- [ ] **9a.** CSS classes exist for component cards: `.arch-component-card`, `.arch-child-card`, `.arch-comp-header`, `.arch-comp-body`, `.arch-comp-responsibility`, `.arch-comp-rationale`.
- [ ] **9b.** CSS classes exist for badges: `.arch-badge`, `.arch-badge-workflow` (blue tint), `.arch-badge-dep` (orange tint), `.arch-badge-type` (purple tint).
- [ ] **9c.** CSS classes exist for domain model cards: `.arch-model-card`, `.arch-fields-table`, `.arch-required`, `.arch-optional`, `.arch-relationship`, `.arch-invariants`.
- [ ] **9d.** CSS classes exist for interface cards: `.arch-interface-card`, `.arch-contract`, `.arch-contract pre`.
- [ ] **9e.** CSS classes exist for roadmap steps: `.arch-roadmap-step`, `.arch-step-header`, `.arch-complexity-high` (red), `.arch-complexity-medium` (yellow), `.arch-complexity-low` (green).

### 10. Traceability Validation

**File:** `src/lib/workflow/architecturePhase.ts` — `runStructuralValidation()`

- [ ] **10a.** Check #8 exists: Requirement traceability — every capability with workflows should have at least one component implementing those workflows. Produces finding: `"Traceability gap: capability ... has workflows but no components implement them"`.
- [ ] **10b.** Check #9 exists: Domain model coverage — component dependencies starting with `DM-` should exist in the domain model. Produces finding: `"Component ... references data model ... not found in domain model"`.
- [ ] **10c.** Check #10 exists: Interface completeness — every component-to-component dependency should have a corresponding interface connecting them. Produces finding: `"Missing interface: ... depends on ... but no interface connects them"`.
- [ ] **10d.** The original 7 checks (orphan components, circular deps, interface refs, model refs, workflow refs, no-requirement capabilities, workflow completeness) are still present.

### 11. Executor Context Enrichment

**File:** `src/lib/context/builders/executor.ts` — `formatArchitectureForExecutor()`

- [ ] **11a.** Components section uses `###` headings per component and includes: responsibility (full paragraph), rationale, workflows, dependencies, interaction patterns, technology, file scope.
- [ ] **11b.** Domain Model section uses `###` headings per entity and includes: description, full field list (`- name: type (required) — description`), relationships (`-> target (type) — description`), invariants.
- [ ] **11c.** Interfaces section uses `###` headings per interface and includes: description, contract in a fenced code block, provider, consumers, workflows.
- [ ] **11d.** Implementation section still exists with step numbering, complexity, components, dependencies, verification.

### 12. Database Migration

**File:** `src/lib/database/schema.ts`

- [ ] **12a.** The `arch_components` CREATE TABLE includes `rationale TEXT` and `interaction_patterns TEXT` columns.
- [ ] **12b.** A migration (V4 or similar) exists that adds these columns to existing databases via `ALTER TABLE arch_components ADD COLUMN`.

### 13. Build

- [ ] **13a.** `node esbuild.js` produces both `dist/extension.js` and `dist/webview/governedStream.js` without errors.
- [ ] **13b.** `npx tsc --noEmit` produces no errors in source files (TS6059 rootDir warnings for ground-truth-specs are pre-existing and acceptable). Filter with: `npx tsc --noEmit 2>&1 | grep -v TS6059 | grep -v "Found .* error"` — should produce no output beyond blank lines.

### 14. Post-Verification Fix Regression Checks

These checks specifically verify the fixes applied after the initial v1 verification round (59 PASS / 3 FAIL / 3 PARTIAL). Each check addresses a specific finding from the Codex verification report.

**File:** `src/lib/workflow/architecturePhase.ts`
**File:** `src/lib/ui/governedStream/dataAggregator.ts`
**File:** `src/lib/workflow/architectureRecursion.ts`

#### 14A. Fix 1 — Domain Model data flows to the design card

**Problem addressed:** The `architecture_design` event only carried `{ components, interfaces }`, so the card's Domain Model section was always empty.

- [ ] **14a.** In `architecturePhase.ts`, the `writeDialogueEvent()` call for `architecture_design` (in `executeDesigning()`) includes `data_models: doc.data_models` in its `JSON.stringify()` content — alongside `components` and `interfaces`.
- [ ] **14b.** In `dataAggregator.ts`, the handler for `architecture_design` events extracts `content.data_models` (not `content.dataModels`) and maps each model to `{ id: m.model_id, entity: m.entity_name, description: m.description, fields: m.fields.map(...), relationships: m.relationships.map(...), invariants: m.invariants || [] }`.
- [ ] **14c.** In `dataAggregator.ts`, the handler for `architecture_sequencing` events calls `getArchitectureDocumentForDialogue(dialogueId)` and checks `.success` before emitting a card. If the document lookup fails, it should handle the error gracefully (no crash, emit what it can or skip).

#### 14B. Fix 2 — splitByConcern fully removed

**Problem addressed:** `splitByConcern()` (generic Data/Logic/API layering) was still called from the normal decomposition path, contradicting the redesign philosophy of agent-backed reasoning.

- [ ] **14d.** Run: `grep -rn "splitByConcern" src/` — must return ZERO matches across the entire `src/` directory. The function and all references to it have been completely removed.
- [ ] **14e.** In `architectureRecursion.ts`, `decomposeComponent()` body contains NO `if (!estimateContextFit(...))` branch. The only conditional is: `if (component.workflows_served.length > config.responsibility_threshold)` -> `splitByWorkflow()`, otherwise return `[]`.
- [ ] **14f.** In `architectureRecursion.ts`, the file does NOT contain a function that generates sub-components with IDs ending in `-DATA`, `-LOGIC`, or `-API` (which were the hallmark of `splitByConcern()`'s generic layering).

#### 14C. Fix 3 — Deeper decomposition prompt enriched

**Problem addressed:** The deeper decomposition feedback text only mentioned workflow analysis and data flow — not the domain model or workspace codebase.

- [ ] **14g.** In `architecturePhase.ts`, the `deeperFeedback` string array contains the text `"Domain model alignment"` (verbatim or close) AND a follow-up line referencing `data_models` or entity relationships.
- [ ] **14h.** In `architecturePhase.ts`, the `deeperFeedback` string array contains the text `"Workspace codebase"` (verbatim or close) AND a follow-up line referencing `src/`, `ground-truth-specs/`, or `project configs`.
- [ ] **14i.** The `deeperFeedback` array has exactly 5 numbered analysis dimensions (not 3), and they are numbered 1 through 5 in the text.

#### 14D. Fix 4 — Build toolchain

**Problem addressed:** esbuild host version 0.27.2 vs binary version 0.27.3 mismatch.

- [ ] **14j.** `node esbuild.js` runs without any version mismatch error. (This is a superset of check 13a but specifically targets the version-mismatch class of error.)

### 15. Deeper Analysis — Quality, Fidelity, and Philosophy

These checks go beyond structural conformance. They are intended to catch implementations that technically satisfy the checklist while still missing the real design intent. The verifier should read code paths carefully and explicitly call out shortcuts, lossy transformations, weak prompts, and failures to support human judgment.

**File:** `src/lib/workflow/architecturePhase.ts`
**File:** `src/lib/workflow/architectureRecursion.ts`
**File:** `src/lib/roles/architectureExpert.ts`
**File:** `src/lib/context/builders/architecture.ts`
**File:** `src/lib/context/builders/executor.ts`
**File:** `src/lib/ui/governedStream/dataAggregator.ts`
**File:** `src/lib/ui/governedStream/html/components.ts`

#### 15A. Shortcut Audit

- [ ] **15a.** No reasoning-heavy stage relies primarily on brittle heuristics when the design intent expects agent reasoning. If heuristics remain, the verifier must identify them explicitly and judge whether they are acceptable guardrails or design-degrading shortcuts.
- [ ] **15b.** There are no silent quality-degrading fallbacks in critical architecture paths. If the system falls back, it should either preserve fidelity or make the degradation explicit in logs, events, or human-facing artifacts.
- [ ] **15c.** Recursive decomposition logic is workflow-grounded rather than template-grounded. The verifier should explicitly check whether any remaining splitting logic would create generic architecture shapes instead of meaningful implementation boundaries.

#### 15B. Artifact Fidelity Across Stages

- [ ] **15d.** No important architecture artifact loses crucial semantic detail when passed between stages. The verifier should specifically examine whether fields, relationships, invariants, rationale, contracts, and verification methods are preserved rather than collapsed into shallow summaries.
- [ ] **15e.** Prompt -> parser -> storage -> rendering symmetry holds for major artifact fields. If a prompt requests a rich field, the verifier should confirm that it is parsed, stored or propagated, and surfaced downstream where relevant.
- [ ] **15f.** Executor-facing architecture context preserves meaningful richness from the approved architecture document instead of reducing it to a shallow recap.

#### 15C. Human Judgment Support

- [ ] **15g.** The human-facing review artifact exposes enough information to support judgment rather than forcing the human to reconstruct hidden context from logs or command blocks.
- [ ] **15h.** Architecture cards surface the rationale, traceability-relevant details, and implementation consequences that a human would need to say "yes", "no", or "decompose deeper" with confidence.
- [ ] **15i.** Important architecture information is not stranded only in command output or intermediate events when it should appear in the reviewed artifact.

#### 15D. Prompt Strength for Workspace-Aware CLI Agents

- [ ] **15j.** Prompts for MODELING, DESIGNING, and SEQUENCING are strong enough to exploit Codex/Claude-class workspace-aware agents, rather than treating them like plain text completion engines. The verifier should consider whether the prompts direct inspection of files, specs, architecture artifacts, and local evidence where appropriate.
- [ ] **15k.** Prompts include meaningful anti-hallucination and anti-template guidance, not just schema instructions.
- [ ] **15l.** Prompt instructions are specific enough that a capable agent could produce implementation-useful artifacts, not merely formally valid JSON.

#### 15E. Final Merit Assessment

- [ ] **15m.** The verifier provides an explicit judgment of whether the implementation genuinely improves the human-judgment / LLM-articulation split described in the context section.
- [ ] **15n.** The verifier identifies the top 3 remaining risks:
  1. highest philosophical/design risk
  2. highest implementation-quality risk
  3. highest operational/tooling risk
- [ ] **15o.** The verifier assigns an overall merit rating for the implementation: `Strong`, `Mixed`, or `Weak`, with a short justification grounded in observed code and behavior.

---

## How to Run This Verification

```bash
cd JanumiCode/janumicode

# Build check
node esbuild.js
npx tsc --noEmit 2>&1 | grep -v TS6059

# Regression: splitByConcern must be fully gone
grep -rn "splitByConcern" src/
# Expected: no output (zero matches)

# Regression: no Data/Logic/API layer generation
grep -rn "\-DATA\|\-LOGIC\|\-API" src/lib/workflow/architectureRecursion.ts
# Expected: no output (zero matches for sub-component ID patterns)

# Then read each file listed above and check each criterion
```

For each check, report:
- **PASS** — criterion met
- **FAIL** — criterion not met, with explanation of what's wrong
- **PARTIAL** — criterion partially met, with explanation of what's missing

Summarize total PASS/FAIL/PARTIAL counts at the end.

For section 15 specifically:
- Do not answer mechanically.
- Prefer identifying the strongest evidence-bearing examples of quality or weakness.
- If a shortcut exists but is an acceptable pragmatic tradeoff, say so explicitly.
- If the implementation technically passes the structural checks but still undermines the philosophy, mark the deeper-analysis checks accordingly.

---

## Appendix: Changes from v1 to v2

| v1 Check | v1 Result | Issue | v2 Change |
|-----------|-----------|-------|-----------|
| 6b | PASS (but wrong criterion) | Checked that `splitByConcern` existed and was not called from forced path. It should not exist at all. | **Rewritten**: Now checks that `splitByConcern` does NOT exist anywhere in the file. |
| 6d | PARTIAL | Feedback text didn't mention domain model or workspace codebase. | **Rewritten**: Now checks for all 5 analysis dimensions explicitly. |
| 7b | FAIL | `architecture_design` event didn't include `data_models` in content. | **Rewritten**: Now checks that event content includes `data_models: doc.data_models` AND that aggregator extracts it. |
| 7d | FAIL | `architecture_design` event didn't include `implementation_sequence`. | **Rewritten**: Now checks that `architecture_sequencing` handler reads full doc from DB and emits a complete card. |
| 7e | PARTIAL | Aggregator didn't emit updated card from modeling/sequencing events. | **Rewritten**: Now checks the three-way routing (design -> card from content, sequencing -> card from DB, modeling -> command blocks only). |
| 13a | FAIL | esbuild version mismatch. | **Unchanged** (build should now pass). Added 14j for specific version-mismatch regression. |
| 13b | PARTIAL | Trailing diagnostic lines after filtering. | **Updated** grep filter to also exclude "Found N error" lines. |
| — | — | New checks needed for fix verification. | **Added section 14** with 10 regression-specific checks (14a-14j). |

## Appendix: Changes from v2 to v3

| v2 Area | Limitation | v3 Change |
|-----------|-----------|-------------|
| Structural checklist | Strong on presence/shape, weaker on implementation quality and philosophy alignment | **Added section 15** for deeper analysis of shortcuts, fidelity, human judgment support, prompt strength, and overall merit |
| PASS/FAIL reporting | Could reward technically compliant but philosophically weak implementations | **Added final merit checks** requiring explicit judgment on whether the human/LLM split is actually improved |
| Regression focus | Good at verifying known fixes, weaker at spotting new low-sophistication substitutions | **Added shortcut audit** to identify brittle heuristics, silent fallbacks, and generic replacements |
