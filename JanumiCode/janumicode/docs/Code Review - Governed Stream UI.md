# Code Review Reference — Governed Stream UI + Agent Prompts

## File Inventory

### Extension Host (Rendering & State)

| File | Lines | Responsibility |
|------|-------|---------------|
| `GovernedStreamPanel.ts` | 3,426 | Main WebviewView provider; message routing, workflow execution, DB integration, event subscription, webview HTML generation |
| `dataAggregator.ts` | 1,869 | Aggregates DB queries into `GovernedStreamState`; builds stream items from events/claims/gates; health metrics |
| `textCommands.ts` | 1,074 | Tier 1 instant aliases + Tier 2 LLM intent classification; retry/approve/navigate/adopt |
| `html/components.ts` | 5,273 | 30+ card renderers; main `renderStream()` dispatch (28-case switch at line ~4700) |
| `html/styles.ts` | 6,442 | All CSS in template literal |

### Webview Client (Compiled TS → IIFE)

| File | Lines | Responsibility |
|------|-------|---------------|
| `main.ts` | 864 | Entry point; message listener (40+ types); click delegation (50+ data-actions) |
| `mmp.ts` | 564 | Mirror/Menu/Pre-Mortem interactions; scoped DOM queries per card |
| `messageHandlers.ts` | 477 | Incoming message processing; DOM updates |
| `commandBlocks.ts` | 398 | CLI command block rendering + toggle/expand |
| `composer.ts` | 332 | Input area; file attachment; @mention completion |
| `types.ts` | 266 | Message protocol interfaces |
| `findWidget.ts` | 237 | Find-in-page |
| `utils.ts` | 210 | HTML escaping, markdown, scroll utilities |
| `clarification.ts` | 174 | Ask More threads |
| `state.ts` | 138 | Centralized mutable state; MMP persistence |
| `intake.ts` | 125 | INTAKE phase button handlers |
| `gates.ts` | 153 | Gate decision handlers |

**Total: ~22,200 LOC across 20 files**

## Data Flow

```
SQLite DB → dataAggregator.aggregateStreamState() → GovernedStreamState
  → GovernedStreamPanel._update() → _getHtmlForWebview()
    → components.renderStream() (switch on StreamItem.type → 28 renderers)
      → Full HTML document with embedded webview JS
        → VS Code Webview DOM (client JS handles interactions)
```

## 28 StreamItem Types

| Type | Renderer | Resizable | Interactive |
|------|----------|-----------|-------------|
| `human_message` | inline | no | no |
| `milestone` | `renderMilestoneDivider` | no | no |
| `turn` | `renderRichCard` | yes | no |
| `gate` | `renderHumanGateCard` | no | yes (approve/reject) |
| `verification_gate` | `renderVerificationGateCard` | no | yes (rationale) |
| `review_gate` | `renderReviewGateCard` | yes | yes (complex) |
| `dialogue_start` | `renderDialogueStartMarker` | no | yes (switch/resume) |
| `dialogue_end` | `renderDialogueEndMarker` | no | no |
| `command_block` | `renderCommandBlock` | yes | yes (toggle/expand) |
| `intake_turn` | `renderIntakeTurnCard` | yes | yes (questions) |
| `intake_plan_preview` | `renderIntakePlanPreview` | no | yes (toggle) |
| `intake_approval_gate` | `renderIntakeApprovalGate` | no | yes (approve) |
| `intake_mode_selector` | `renderIntakeModeSelector` | no | yes (mode pick) |
| `intake_checkpoint` | `renderIntakeCheckpoint` | no | no |
| `intake_domain_transition` | `renderDomainTransitionCard` | no | no |
| `intake_gathering_complete` | `renderGatheringCompleteBanner` | no | no |
| `intake_analysis` | `renderIntakeAnalysisCard` | yes | no |
| `intake_product_discovery` | `renderIntakeProductDiscoveryCard` | no | yes (MMP+edit) |
| `intake_proposal` | `renderIntakeProposalCard` | no | no |
| `intake_proposer_domains` | `renderProposerDomainsCard` | yes | yes (inline MMP) |
| `intake_proposer_journeys` | `renderProposerJourneysCard` | yes | yes (inline MMP) |
| `intake_proposer_entities` | `renderProposerEntitiesCard` | yes | yes (inline MMP) |
| `intake_proposer_integrations` | `renderProposerIntegrationsCard` | yes | yes (inline MMP) |
| `qa_exchange` | `renderQaExchangeCard` | no | no |
| `reasoning_review` | `renderReasoningReviewCard` | no | yes (ack/rerun) |
| `architecture_capabilities` | `renderArchitectureCapabilitiesCard` | yes | no |
| `architecture_design` | `renderArchitectureDesignCard` | yes | no |
| `architecture_validation` | `renderArchitectureValidationCard` | no | no |
| `architecture_gate` | `renderArchitectureGateCard` | no | yes (approve/revise) |

## 50+ Click Actions (data-action values)

**Core:** `copy-session`, `scroll-to-status`, `toggle-settings`, `toggle-find`, `set-key`, `clear-key`, `clear-database`, `export-stream`, `generate-document`

**Gates:** `gate-decision`, `verification-gate-decision`, `review-gate-decision`

**INTAKE:** `intake-submit-responses`, `intake-select-mode`, `intake-ask-domain`, `intake-finalize-plan`, `intake-approve-plan`, `intake-continue-discussing`, `intake-skip-gathering`, `intake-switch-to-walkthrough`, `intake-switch-to-conversational`

**MMP:** `mirror-accept`, `mirror-reject`, `mirror-defer`, `mirror-edit`, `mirror-rationale`, `menu-select`, `premortem-accept`, `premortem-reject`, `mmp-submit`

**Architecture:** `architecture-approve`, `architecture-revise`, `architecture-skip`, `architecture-decompose-deeper`

**Commands:** `toggle-command`, `toggle-stdin`, `show-more-cmd`, `retry-phase`, `execute-command-option`

**Review:** `review-acknowledge`, `review-rerun`, `review-guidance`, `review-guidance-submit`

**Speech:** `toggle-speech`

**Misc:** `toggle-card`, `toggle-askmore`, `clarification-send`, `resume-dialogue`, `switch-dialogue`, `scroll-to-dialogue`, `toggle-switcher`, `remove-attachment`

## Complexity Hotspots

| Location | Lines | Issue |
|----------|-------|-------|
| `GovernedStreamPanel.ts` | 3,426 | Monolithic; all state + handlers + event subs in one class |
| `components.ts` | 5,273 | All HTML generation in one file; 28-case switch |
| `styles.ts` | 6,442 | All CSS in one template literal |
| `renderReviewGateCard()` | 383 | Most complex renderer; 3-level grouping + adjudication |
| `_handleSubmitInput()` | ~240 | 3-tier command processing + LLM + workflow |
| `renderCommandBlock()` | ~201 | Tool pairing + line folding + stdin toggle |
| `renderStream()` dispatch | ~245 | 28 cases + pre-scans + architecture grouping |
| `wrapResizable()` | — | Regex-based inline style injection; fragile |

## State Locations

| State | Location | Persistence |
|-------|----------|-------------|
| Active dialogue ID | `GovernedStreamPanel._activeDialogueId` | In-memory (extension host) |
| Processing flag | `GovernedStreamPanel._isProcessing` | In-memory |
| MMP decisions | `state.mmpMirrorDecisions` etc. (webview) | Webview state API + SQLite |
| Gate rationales | `state.gateRationales` (webview) | In-memory (lost on re-render) |
| Clarification threads | `state.clarificationConversations` (webview) | Restored via postMessage |
| Workflow phase | `workflow_states` table | SQLite |
| Stream content | `dialogue_events` table | SQLite |
| Command outputs | `workflow_commands` + `workflow_command_outputs` | SQLite |

## Server-Rendered ↔ Client-Side Sync Risks

1. **MMP card IDs**: Server generates `data-mmp-card-id`; client queries via `scopedQuery(cardId, ...)` — DOM structure changes break queries
2. **Claim badges**: Server renders `.verdict-badge`; client updates in-place via `handleClaimUpdated()` — selector changes break updates
3. **Gate buttons**: Server renders; client disables on decision — button selector changes break state
4. **Resizable injection**: `wrapResizable()` uses regex to inject inline styles on first HTML element — breaks if HTML structure changes
5. **Processing indicator**: Two separate indicators (server-rendered `.processing-cancel-bar` + dynamic `#processing-indicator`) — must both be cleaned up on `setProcessing(false)`

---

# Agent & LLM Prompts Inventory

## Complete Prompt Map (27 prompts across 12 files)

### CLI-Backed Role Agents (via invokeRoleStreaming)

| # | Prompt | File:Line | Role | Output | Tokens |
|---|--------|-----------|------|--------|--------|
| 1 | `EXECUTOR_SYSTEM_PROMPT` | roles/executor.ts:89 | Executor | JSON (proposal, assumptions, artifacts) | ~2,100 |
| 2 | `EXECUTOR_UNIT_SYSTEM_PROMPT` | roles/executor.ts:676 | Executor (unit) | Free text (file mods) | ~450 |
| 3 | `TECHNICAL_EXPERT_SYSTEM_PROMPT` | roles/technicalExpert.ts:57 | Technical Expert | JSON (answer, evidence, confidence) | ~1,250 |
| 4 | `VERIFIER_SYSTEM_PROMPT` | roles/verifier.ts:89 | Verifier | JSON (verdict, rationale, evidence) | ~2,850 |
| 5 | `HISTORIAN_INTERPRETER_SYSTEM_PROMPT` | roles/historianInterpreter.ts:124 | Historian | JSON (findings, contradictions) | ~2,100 |
| 6 | `HISTORIAN_ADJUDICATION_SYSTEM_PROMPT` | roles/historianInterpreter.ts:237 | Historian (adjudication) | JSON (claim_adjudications) | ~2,700 |
| 7 | `DECOMPOSING_SYSTEM_PROMPT` | roles/architectureExpert.ts:46 | Architecture Expert | JSON (capabilities, workflows) | ~2,000 |
| 8 | `MODELING_SYSTEM_PROMPT` | roles/architectureExpert.ts:128 | Architecture Expert | JSON (data_models) | ~1,200 |
| 9 | `DESIGNING_SYSTEM_PROMPT` | roles/architectureExpert.ts:179 | Architecture Expert | JSON (components, interfaces) | ~2,500 |
| 10 | `SEQUENCING_SYSTEM_PROMPT` | roles/architectureExpert.ts:277 | Architecture Expert | JSON (implementation_sequence) | ~2,000 |
| 11 | `GOAL_ALIGNMENT_SYSTEM_PROMPT` | roles/architectureValidator.ts:34 | Historian (alignment) | JSON (score, findings) | ~300 |
| 12 | `DECOMPOSITION_SYSTEM_PROMPT` | workflow/taskDecomposer.ts:30 | Task Decomposer | JSON (units, edges) | ~2,200 |
| 13 | `REPAIR_SYSTEM_PROMPT` | workflow/repairEngine.ts:203 | Repair Agent | Free text (file mods) | ~250 |

### INTAKE Phase Prompts (CLI-Backed)

| # | Prompt | File:Line | Sub-phase | Output | Tokens |
|---|--------|-----------|-----------|--------|--------|
| 14 | `INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT` | roles/technicalExpertIntake.ts:73 | DISCUSSING/CLARIFYING | JSON (conversationalResponse, updatedPlan, mmp) | ~3,000 |
| 15 | `INTAKE_SYNTHESIS_SYSTEM_PROMPT` | roles/technicalExpertIntake.ts:213 | SYNTHESIZING | JSON (finalized plan) | ~2,000 |
| 16 | `INTAKE_GATHERING_SYSTEM_PROMPT` | roles/technicalExpertIntake.ts:472 | GATHERING (interviewer) | JSON (conversationalResponse, domainNotes) | ~1,500 |
| 17 | `INTAKE_ANALYZING_SYSTEM_PROMPT` | roles/technicalExpertIntake.ts:711 | ANALYZING (silent) | JSON (analysisSummary, initialPlan, codebaseFindings) | ~2,500 |
| 18 | `DOMAIN_PROPOSER_PROMPT` | roles/technicalExpertIntake.ts:1807 | PROPOSING_DOMAINS | JSON (domains, personas) | ~1,200 |
| 19 | `JOURNEY_WORKFLOW_PROPOSER_PROMPT` | roles/technicalExpertIntake.ts:1928 | PROPOSING_JOURNEYS | JSON (userJourneys, workflows) | ~1,800 |
| 20 | `ENTITY_PROPOSER_PROMPT` | roles/technicalExpertIntake.ts:2065 | PROPOSING_ENTITIES | JSON (entities) | ~1,000 |
| 21 | `INTEGRATION_PROPOSER_PROMPT` | roles/technicalExpertIntake.ts:2167 | PROPOSING_INTEGRATIONS | JSON (integrations, qualityAttributes) | ~1,200 |

### Direct LLM API Calls (lightweight/fast models)

| # | Prompt | File:Line | Role | Provider | Tokens |
|---|--------|-----------|------|----------|--------|
| 22 | `CURATOR_SYSTEM_PROMPT` | curation/narrativeCurator.ts:37 | Narrative Curator | Gemini Flash Lite | ~450 |
| 23 | `EVALUATOR_SYSTEM_PROMPT` | workflow/responseEvaluator.ts:92 | Response Evaluator | Gemini Flash Lite | ~1,250 |
| 24 | `CLASSIFIER_SYSTEM_PROMPT` | workflow/intakeClassifier.ts:30 | Intake Classifier | Gemini Flash Lite | ~1,000 |
| 25 | `FAILURE_EVALUATOR_SYSTEM_PROMPT` | workflow/failureEvaluator.ts:41 | Failure Analyst | Fast model | ~500 |
| 26 | `REVIEWER_SYSTEM_PROMPT` | review/reasoningReviewer.ts:23 | Reasoning Reviewer | Gemini Pro | ~800 |
| 27 | `CONTEXT_ENGINEER_SYSTEM_PROMPT` | context/contextEngineer.ts:40 | Context Engineer | Tech Expert CLI | ~1,500 |

### Workflow Utility Prompts

| # | Prompt | File:Line | Purpose | Provider |
|---|--------|-----------|---------|----------|
| 28 | `INTERPRETER_SYSTEM_PROMPT` | governedStream/textCommands.ts:247 | Tier 2 NLP input classification | Evaluator model |
| 29 | `COVERAGE_EXTRACTION_PROMPT` | workflow/domainCoverageTracker.ts:240 | Per-domain evidence extraction | Gemini Flash Lite |
| 30 | Title generation prompt | llm/titleGenerator.ts | Dialogue title from goal | Evaluator model |

## Prompt Quality Patterns

### Anti-Hallucination Directives
- **Executor**: "NEVER use temporal references", "NEVER override verifier verdicts"
- **Technical Expert**: "NEVER authorize execution", "NEVER suggest approaches"
- **Verifier**: "Default to UNKNOWN when evidence insufficient"
- **Historian**: "NEVER modify history", "NEVER override verdicts"
- **Repair Agent**: "Fix ONLY the specific failure — no scope expansion"
- **Proposers**: "Do NOT apply MVP thinking", "Do NOT pre-filter"

### Output Format Consistency
- 25 of 30 prompts request JSON output
- 4 prompts include anti-file-writing directives ("Do NOT write files")
- Proposer prompts recently updated with "Return ONLY the JSON object"
- Some prompts include JSON schema in markdown code fences, others describe fields in prose

### Evidence Requirements
- **Verifier**: 4-tier evidence classification (AUTHORITATIVE → SPECULATIVE)
- **Historian Adjudication**: Every verdict requires explicit citations
- **Technical Expert**: Confidence tied to source quality (HIGH = official docs)
- **Proposers**: Source attribution (document-specified / domain-standard / ai-proposed)

### Fallback Patterns
- **Evaluator**: Falls back to PROCEED on provider failure
- **Classifier**: Heuristic keyword matching when LLM unavailable
- **Coverage**: Keyword extraction fallback
- **Reasoning Reviewer**: Returns null (non-blocking) on any failure

### Identified Inconsistencies
1. Some prompts use markdown code fences for JSON schema, others don't
2. Proposer prompts say "Do NOT use markdown code fences" but include them in their own schema examples
3. Temperature varies: 0.0 (coverage), 0.1 (evaluators/classifier/reviewer), unset (role agents — CLI default)
4. Context Engineer prompt is CLI-backed but uses TECHNICAL_EXPERT provider — could get wrong model
5. Architecture sub-phase prompts reference tool use but don't explicitly constrain it (unlike Executor unit prompt)



## Highest-risk areas for unreliable behavior

### Governed Stream UI review

GovernedStreamPanel.ts (3,426 lines) — The monolith. All message routing, workflow execution, state management, and event subscriptions in one class. _handleSubmitInput() alone is 240 lines with 3-tier command processing.

components.ts (5,273 lines) — All HTML generation. The renderStream() switch has 28 cases with pre-scans and grouping logic. wrapResizable() uses fragile regex injection.

Server ↔ Client sync — Five identified risk areas where server-rendered HTML must match client-side JS selectors. Any mismatch causes silent failures (buttons don't work, state doesn't update).

Dual processing indicators — Server-rendered .processing-cancel-bar and dynamic #processing-indicator must both be cleaned up, but they're managed by different code paths.

State split across 3 locations — Extension host in-memory, webview state API, and SQLite. Re-renders destroy webview DOM state and rely on restore mechanisms (_postPendingMmpDecisions, _postClarificationThreads) that can race.

dataAggregator.ts (1,869 lines) — Builds the stream from 12+ DB tables. Complex event routing with if/else if chains. Legacy event skipping, architecture gate deduplication, and command block aggregation all happen here.


### Agents review
30 prompts across 12 files:

13 CLI-backed role agent prompts (Executor, Technical Expert, Verifier, Historian, Architecture Expert × 4, Task Decomposer, Repair Agent)
8 INTAKE phase prompts (Discussing, Synthesizing, Gathering, Analyzing, + 4 Proposers)
6 direct LLM API calls (Curator, Evaluator, Classifier, Failure Analyst, Reasoning Reviewer, Context Engineer)
3 utility prompts (Interpreter, Coverage Extraction, Title Generator)
Key review areas identified:

Proposer prompts have contradictory instructions (say "no code fences" but include code fences in their schema examples)
Context Engineer uses TECHNICAL_EXPERT provider which may get the wrong model
Temperature settings are inconsistent across prompts
Architecture sub-phase prompts don't constrain tool use the way Executor unit prompt does