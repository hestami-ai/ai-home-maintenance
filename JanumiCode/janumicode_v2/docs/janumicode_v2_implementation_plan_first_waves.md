# JanumiCode v2 Implementation Roadmap

## Context

JanumiCode v2 is a ground-up rewrite of the v1 VS Code extension. The full specification is at `JanumiCode/janumicode_v2/docs/janumicode_spec_v2.3.md` (3500 lines, 17 sections). The spec defines 11 phases (0, 0.5, 1-10), 13 agent roles, ~60 record types, ~50 JSON schemas, and the full Orchestrator architecture.

**The full specification IS the MVP** — but it must be implemented in waves where each wave produces a testable increment. The waves are sequenced by dependency analysis: cross-cutting infrastructure first, then phases in order.

**Key constraints:**
- VS Code extension in TypeScript, pnpm, esbuild multi-entry build
- SQLite via sidecar process (better-sqlite3, SharedArrayBuffer+Atomics RPC)
- CLI-backed agents (Claude Code CLI, Gemini CLI, Codex CLI) invoked as child processes
- Ollama (localhost:11434) for testing with gemma4:26b, qwen models
- Embedding: Ollama local models initially, Voyage AI later
- Testing priority: prompt templates > deterministic components > integration
- Hardcoded defaults in config, overrides from janumicode.config.json
- No lemmafit (incompatible with VS Code extension project structure today)

**v1 lessons carried forward (approaches, not code):**
- Sidecar database architecture works — port the pattern
- esbuild multi-entry build pipeline — port the pattern
- Multi-CLI provider router — port the pattern
- Webview card sync bugs — v2 uses Svelte (compiled, not SvelteKit) with JSON records as source of truth + virtual scrolling for pagination
- Prompt templates were the #1 bug source — Ollama probe harness from Wave 2 onward

---

## Dependency Graph (drives wave sequencing)

**Foundation (everything depends on these):**
GovernedStreamWriter, SQLite schema, Sidecar, StateMachine, SchemaValidator, ConfigManager

**Cross-cutting (most phases depend on these):**
ContextBuilder, AgentInvoker/CLIInvoker, OutputParser, InvariantChecker, TemplateLoader,
ReasoningReview, IngestionPipelineRunner, NarrativeMemoryGenerator, PhaseGateEvaluator,
BloomPruneCoordinator, LoopDetectionMonitor

**Implication:** Even Phase 0 end-to-end requires GovernedStreamWriter, StateMachine, SchemaValidator,
ConfigManager, ContextBuilder, AgentInvoker, OutputParser, InvariantChecker, ReasoningReview,
IngestionPipelineRunner (stages I-II), PhaseGateEvaluator, and a webview rendering Mirror/Menu cards.

---

## Wave 1 — Foundation: Project Scaffold, Database, State Machine

**Goal:** Establish v2 project structure, build pipeline, SQLite schema, sidecar process, and bare state machine. Create a Workflow Run, write records, query them.

**Components:**

| File | Purpose |
|------|---------|
| `package.json` | VS Code extension manifest, sidebar view, pnpm scripts |
| `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs` | Build/test/lint config |
| `esbuild.js` | Multi-entry build: extension + sidecar + webview (port v1 pattern; webview uses esbuild-svelte plugin) |
| `src/extension.ts` | Activation, sidebar provider registration, sidecar spawn |
| `src/sidecar/dbServer.ts` | NDJSON-over-stdio RPC server wrapping better-sqlite3 |
| `src/lib/database/rpcClient.ts` | SharedArrayBuffer+Atomics synchronous RPC client |
| `src/lib/database/rpcWorker.ts` | Worker thread bridge |
| `src/lib/database/schema.ts` | Full DDL from spec §11 (all tables, indices, FTS5) |
| `src/lib/database/migrations.ts` | Migration framework |
| `src/lib/orchestrator/stateMachine.ts` | Phase/sub-phase state, transition validation (incl. "0.5") |
| `src/lib/orchestrator/governedStreamWriter.ts` | Record writes with authority level, quarantine, system-proposal flags |
| `src/lib/config/configManager.ts` | Load config with hardcoded defaults |
| `src/lib/config/defaults.ts` | All default values from spec §10 |
| `src/lib/types/` | TypeScript interfaces for all record types and universal fields |
| `src/webview/shell.ts` | Minimal webview HTML shell |
| `.janumicode/schemas/` | Directory structure (stub files) |

**Testable:**
- `pnpm build` produces dist/ with extension.js, sidecar/dbServer.js, webview/main.js
- Unit: StateMachine transitions (valid sequences, invalid rejection, "0.5" handling)
- Unit: GovernedStreamWriter universal fields, authority level assignment
- Unit: Schema DDL executes, all tables/indices created
- Unit: RPC client/sidecar roundtrip
- Manual: activate extension, sidebar shows, sidecar starts, DB created

**Decisions:**
- Defer sqlite-vec to Wave 7 (FTS5 only initially); stub `governed_stream_vec` behind feature flag
- Deploy full DDL immediately — tables are cheap, prevents migration churn
- Use pnpm (consistent with v1)

---

## Wave 2 — Validation Stack: Schemas, Invariants, Prompt Test Harness

**Goal:** Build deterministic validation (JSON schema validation, invariant checks) and establish Ollama-backed prompt template testing infrastructure.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/orchestrator/schemaValidator.ts` | Validates artifacts against `.janumicode/schemas/` using ajv |
| `src/lib/orchestrator/invariantChecker.ts` | Discovers+runs invariant files (field_presence, forbidden_pattern, cross_field, count_minimum) |
| `src/lib/orchestrator/templateLoader.ts` | Loads prompt template .md files, parses YAML frontmatter, validates required variables |
| `.janumicode/schemas/artifacts/` | Phase 0+1 schemas (workspace_classification, intent_*, scope_*, compliance_*) |
| `.janumicode/schemas/invariants/` | First batch: functional_requirements, component_model invariant files |
| `.janumicode/prompts/cross_cutting/` | reasoning_review, vocabulary_collision_check, intent_quality_check templates |
| `.janumicode/prompts/phases/phase_00_*/` | Phase 0 prompt templates |
| `.janumicode/prompts/phases/phase_01_*/` | Phase 1 prompt templates (all sub-phases) |
| `src/test/helpers/ollamaClient.ts` | Port from v1 with model sampling profiles |
| `src/test/helpers/ollamaJudge.ts` | Port from v1: Ollama-backed structural+semantic judge |
| `src/test/prompt-probes/` | Prompt regression tests per template |

**Testable:**
- Unit: SchemaValidator accepts/rejects artifacts
- Unit: InvariantChecker all check types, produces invariant_check_record
- Unit: TemplateLoader frontmatter parsing, missing variable detection
- Prompt probes (Ollama): Phase 0+1 templates produce valid JSON matching schemas
- Establishes prompt testing from this wave onward — every new template gets probes

**Decisions:**
- Use ajv v8 with JSON Schema 2020-12
- Ollama probe tests tagged `@ollama`, skipped in CI if unavailable
- Write Phase 0/1/2 schemas this wave; remaining phases in later waves

---

## Wave 3 — Agent Invocation: Context Assembly, CLI Invoker, Output Parser, LLM Caller

**Goal:** Build two-channel context assembly, CLI agent invocation protocol, output parser, and LLM API caller. Invoke a single CLI agent and capture its execution trace.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/orchestrator/contextBuilder.ts` | Stdin directive + detail file construction; token counting per provider; overflow detection |
| `src/lib/orchestrator/agentInvoker.ts` | Routes to CLIInvoker or LLMCaller |
| `src/lib/cli/cliInvoker.ts` | Spawn child process, pipe stdin, stream stdout, handle lifecycle |
| `src/lib/cli/outputParser.ts` | Configurable per backing tool; maps stdout to record types; self-correction detection |
| `src/lib/cli/providers/claudeCode.ts` | Claude Code CLI command construction, stream-json parsing |
| `src/lib/cli/providers/geminiCli.ts` | Gemini CLI command construction |
| `src/lib/cli/providers/codexCli.ts` | Codex CLI command construction |
| `src/lib/llm/llmCaller.ts` | Stateless LLM API calls; retry/backoff per §7.12; fallback models |
| `src/lib/llm/providers/` | Anthropic, Google, Ollama adapters |
| `src/lib/orchestrator/ingestionPipelineRunner.ts` | Stages I+II (deterministic); Stages III-V stubbed |
| `src/lib/orchestrator/loopDetectionMonitor.ts` | Retry counting, trend analysis, SCOPE_BLIND detection |

**Testable:**
- Unit: ContextBuilder stdin ordering, token counting, overflow detection, detail file format
- Unit: CLIInvoker spawn/timeout/idle handling
- Unit: OutputParser event classification, self-correction detection
- Unit: LLMCaller retry logic (mock 429, 503, 401), fallback switching
- Unit: IngestionPipeline Stage I authority assignment, Stage II edge assertion
- Unit: LoopDetectionMonitor trend classification
- Integration: invoke Ollama via CLIInvoker, capture trace in Governed Stream
- Manual: trigger single agent invocation from command palette

---

## Wave 4 — Review Pipeline: Reasoning Review, Verification Ensemble, Phase Gate

**Goal:** Build LLM-powered review components and Phase Gate evaluation. Complete a full sub-phase cycle: invoke agent → invariant check → reasoning review → phase gate.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/review/reasoningReview.ts` | Trace Selection construction, flaw taxonomy (13 types), quarantine protocol |
| `src/lib/review/verificationEnsemble.ts` | Primary+secondary provider; agreement classification; secondary failure handling |
| `src/lib/review/domainComplianceReview.ts` | Separate provider; compliance_context checking |
| `src/lib/memory/narrativeMemoryGenerator.ts` | Phase summary with anti-failure-mode instructions; embedding stub |
| `src/lib/memory/decisionTraceGenerator.ts` | Aggregates decision_traces into decision_trace_summary |
| `src/lib/orchestrator/phaseGateEvaluator.ts` | Short-circuit evaluation order (schema → invariant → review → consistency → attestation → ensemble → human) |
| `src/lib/orchestrator/ingestionPipelineRunner.ts` | Complete Stages III-V (relationship extraction, supersession, open question resolution) |
| `.janumicode/prompts/cross_cutting/` | reasoning_review_with_trace, narrative_memory, domain_compliance_review, verification_ensemble_secondary, ingestion_pipeline_stage3 templates |

**Testable:**
- Unit: Trace Selection (self-corrections always included, tool results excluded, uniform stride sampling)
- Unit: Verification Ensemble agreement types (full, severity_disagreement, overall_disagreement)
- Unit: PhaseGateEvaluator short-circuit (schema failure skips everything downstream)
- Prompt probes: Reasoning Review template produces valid reasoning_review_record
- Integration: full sub-phase cycle on Ollama — invoke, invariant check, review, quarantine+retry
- Manual: complete a sub-phase, see review results in database

---

## Wave 5 — First Workflow: Webview, Mirror/Menu, Phase 0 + Phase 1 E2E

**Goal:** Build webview card UI, Mirror/Menu interaction, BloomPruneCoordinator, MirrorGenerator, and OrchestratorEngine. Wire everything for Phase 0 + Phase 1 end-to-end.

**Webview rendering approach:** Svelte (NOT SvelteKit) compiled at build time via `esbuild-svelte` plugin. Extension host sends JSON records via postMessage; Svelte components render cards with compile-time reactivity (surgical DOM updates, no full re-render). Virtual scrolling for pagination — only render cards in/near the viewport. On restore, extension host sends record count + initial window; webview requests more on scroll. This approach:
- Solves the v1 card sync bugs (disappearing cards, wrong sequence, state not updating) by making the record array the single source of truth
- Handles large Governed Streams via virtual scrolling (not SvelteKit SSR)
- Compiles to a self-contained IIFE bundle compatible with VS Code webviews
- No React (difficult with AI coding agents per user experience)

**Components:**

| File | Purpose |
|------|---------|
| `src/webview/App.svelte` | Root Svelte component; postMessage handler; virtual scroll container |
| `src/webview/main.ts` | Webview entry; mounts App.svelte |
| `src/webview/stores/records.ts` | Svelte writable store for Governed Stream records (single source of truth) |
| `src/webview/components/Card.svelte` | Card type dispatcher per record_type category |
| `src/webview/components/MirrorCard.svelte` | Mirror fields, System-Proposed Content, conflict highlighting |
| `src/webview/components/MenuCard.svelte` | Button options, multi-select, free-text, Decision Bundle |
| `src/webview/components/PhaseGateCard.svelte` | Phase Gate approval with enable conditions |
| `src/webview/components/VirtualScroll.svelte` | Virtual scrolling — renders only visible cards + buffer |
| `src/webview/scroll.ts` | Auto-scroll, "Jump to latest", phase navigation sidebar |
| `src/webview/find.ts` | Find-in-page widget |
| `src/webview/accessibility.ts` | ARIA labels, keyboard nav, semantic HTML |
| `src/lib/orchestrator/bloomPruneCoordinator.ts` | Decision Sequencing Protocol (priority 1-4); Decision Bundle rules |
| `src/lib/orchestrator/mirrorGenerator.ts` | Deterministic template expansion; annotation rules |
| `src/lib/orchestrator/orchestratorEngine.ts` | Wires all 12 components; Phase 0+1 handler registry |
| `src/lib/events/eventBus.ts` | Webview real-time update events |
| `.janumicode/prompts/phases/phase_01_intent_capture/` | All Phase 1 sub-phase templates |

**Testable:**
- Unit: MirrorGenerator annotations (System-Proposed Content, conflicts, assumptions)
- Unit: BloomPruneCoordinator priority ordering, Decision Bundle exclusion rules
- Unit: Card renderer HTML output per card category
- Integration: Phase 0 greenfield E2E — workspace classification, collision check, Phase Gate
- Integration: Phase 1 greenfield E2E — intent quality check, scope bounding, bloom, mirror/menu, synthesis, Phase Gate
- **MILESTONE: First user-facing demo** — human types Raw Intent, sees bloom in sidebar, prunes via Mirror/Menu, approves Phase Gate

**Key discipline from v1 lessons:** The Svelte record store is the single source of truth in the webview. On restore, extension host sends the full record snapshot from the database — Svelte reactively renders. Delta updates (add/update record) patch the store; Svelte surgically updates only affected DOM nodes. Virtual scrolling ensures the DOM stays small regardless of Governed Stream size. This architecture prevents all three v1 card bug categories: disappearing cards (records are never dropped from the store), wrong sequence (records carry sequence_position, sorted on insert), state not updating (delta messages trigger Svelte reactivity).

---

## Wave 6 — Planning I: Phases 2-5, Consistency Checker

**Goal:** Implement Phases 2-5 (Requirements → Technical Specification) and the Consistency Checker Agent. Raw Intent → complete Technical Specifications.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/orchestrator/phases/phase2.ts` | FR/NFR bloom, domain attestation, consistency check |
| `src/lib/orchestrator/phases/phase3.ts` | System boundary, system requirements, interface contracts |
| `src/lib/orchestrator/phases/phase4.ts` | Software domains, component decomposition, ADRs, implementability review |
| `src/lib/orchestrator/phases/phase5.ts` | Data models, API definitions, error handling, config parameters |
| `src/lib/agents/consistencyChecker.ts` | Three check types: mechanical traceability, semantic consistency, internal consistency |
| `.janumicode/schemas/artifacts/` | Phase 2-5 schemas (~15 schemas) |
| `.janumicode/schemas/invariants/` | interface_contracts, api_definitions, system_requirements, architectural_decisions, data_models |
| `.janumicode/prompts/phases/phase_02_*/ through phase_05_*/` | ~20 sub-phase prompt templates |

**Testable:**
- Prompt probes: all Phase 2-5 templates produce valid JSON
- Unit: Phase 2 domain attestation recording
- Unit: Phase 4 implementability review routing
- Unit: Consistency Checker traceability assertions
- Integration: Phase 0 through Phase 5 on Ollama
- **MILESTONE: Raw Intent → complete Technical Specifications**

---

## Wave 7 — Planning II: Phases 6-8, Deep Memory Research, Phase 0.5, Embeddings

**Goal:** Implement remaining planning phases, Deep Memory Research Agent (7-stage), Phase 0.5 (Cross-Run Impact Analysis), and embedding infrastructure.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/orchestrator/phases/phase6.ts` | Implementation task decomposition, complexity flagging |
| `src/lib/orchestrator/phases/phase7.ts` | Test case generation, coverage analysis |
| `src/lib/orchestrator/phases/phase8.ts` | Evaluation plan design (functional, quality, reasoning) |
| `src/lib/orchestrator/phases/phase05.ts` | Cross-run impact analysis, cascade threshold, refactoring decision |
| `src/lib/agents/deepMemoryResearch.ts` | 7-stage context reconstruction; context packet output |
| `src/lib/orchestrator/dependencyClosureResolver.ts` | Recursive derives_from traversal, cycle detection, cross-run boundary |
| `src/lib/orchestrator/cascadeThresholdChecker.ts` | Refactoring cascade limit checks |
| `src/lib/embedding/ollamaEmbedding.ts` | Ollama local embedding (default: qwen3-embedding:8b; alternative: embeddinggemma:300m) |
| `.janumicode/prompts/cross_cutting/deep_memory_*.system.md` | Deep Memory Research prompt templates |
| `.janumicode/prompts/phases/phase_06_*/ through phase_08_*/` | Planning phase prompt templates |

**Testable:**
- Unit: DependencyClosureResolver cycle detection, cross-run boundary, closure size limit
- Unit: Deep Memory Research materiality scoring
- Prompt probes: Phase 6-8 and Deep Memory Research templates
- Integration: Phase 0 through Phase 8 on Ollama
- Integration: brownfield with Phase 0.5 triggered
- **MILESTONE: Raw Intent → complete execution-ready plan**

---

## Wave 8 — Execution: Phases 9-10, Unsticking Agent, Client Liaison, Full Pipeline

**Goal:** Implement execution phases, Unsticking Agent, Client Liaison Agent. Full spec implemented.

**Components:**

| File | Purpose |
|------|---------|
| `src/lib/orchestrator/phases/phase9.ts` | Task execution, test execution ordering/failure strategy, eval execution |
| `src/lib/orchestrator/phases/phase10.ts` | Pre-commit consistency, commit prep, workflow closure |
| `src/lib/agents/executorAgent.ts` | Execution trace capture, file system write tracking, refactoring idempotency |
| `src/lib/agents/unstickingAgent.ts` | Socratic + detective modes, specialist recruitment, tool result review |
| `src/lib/agents/clientLiaisonAgent.ts` | Query type taxonomy, availability rules, provenance statements |
| `src/lib/agents/evalExecutionAgent.ts` | Evaluation tooling invocation |
| `src/webview/renderer/streaming.ts` | Real-time Phase 9 cards (reasoning, tool calls, self-corrections) |
| `src/webview/renderer/unsticking.ts` | Unsticking thread layout |
| `src/webview/clientLiaison.ts` | Open Query input, response with provenance |
| `src/lib/versioning/` | Schema compatibility check, version upgrade card |
| `.janumicode/prompts/phases/phase_09_*/ and phase_10_*/` | Execution phase prompt templates |
| `.janumicode/prompts/cross_cutting/unsticking_*.system.md` | Unsticking prompt templates |
| `.janumicode/prompts/cross_cutting/client_liaison_*.system.md` | Client Liaison templates |

**Testable:**
- Unit: Phase 9 test execution ordering, failure skip rules
- Unit: Refactoring idempotency protocol
- Unit: Unsticking dialogue loop detection
- Unit: Client Liaison query routing, availability rules
- Integration: **full Phase 0 through Phase 10 on Ollama**
- Integration: stuck agent → Unsticking Agent triggered
- Integration: Client Liaison Open Query during Phase 9
- **MILESTONE: Complete end-to-end Workflow Run — intent to committed code**

---

## Testing Strategy (cross-wave)

| Category | Approach | Coverage Target |
|----------|----------|----------------|
| **Deterministic components** | Unit tests from wave of introduction | 100% branch coverage |
| **Prompt templates** | Ollama probe tests from Wave 2 | Every template has at least one probe |
| **Integration** | Each wave adds E2E tests using Ollama | Full phase flow per wave |
| **Database** | No mocking — real sidecar/SQLite (tempDatabase pattern from v1) | All tests use real DB |
| **Webview** | Message protocol tests (postMessage/onDidReceiveMessage) | Card rendering + interaction |

---

## Summary

| Wave | Name | Key Milestone | Approx. New Files |
|------|------|---------------|-------------------|
| 1 | Foundation | Project builds, DB runs, state machine works | ~15 |
| 2 | Validation Stack | Schemas validate, invariants check, prompt probes run | ~20 + ~30 schemas |
| 3 | Agent Invocation | CLI agents invoked, traces captured | ~12 |
| 4 | Review Pipeline | Full sub-phase cycle with Reasoning Review | ~10 |
| 5 | First Workflow | **Phase 0+1 E2E in VS Code** | ~20 |
| 6 | Planning I | **Raw Intent → Tech Specs** (Phases 2-5) | ~15 + ~30 schemas |
| 7 | Planning II | **Raw Intent → Execution Plan** (Phases 6-8) | ~12 + ~20 schemas |
| 8 | Execution | **Full pipeline — intent to committed code** | ~15 + remaining |
