# JanumiCode Master Product Specification

**Version 2.5 — Implementation-Ready, Consolidated**

*This document is a complete, self-contained consolidation of versions 2.0 through 2.5. All "Identical to v2.x" references have been resolved inline. No external spec documents are required to implement JanumiCode from this specification.*

*Changes from v2.4 (Wave 7 + Wave 8):*
- *__Phase 1.3 split (Wave 7)__ — `Sub-Phase 1.3` (combined User Journeys + System Workflows bloom) is replaced by three sequential sub-phases: __1.3a__ User Journey Bloom (journeys + automatable-step flags), __1.3b__ System Workflow Bloom (workflows that back automatable steps + own-triggered workflows), __1.3c__ Coverage Verifier (deterministic; emits `coverage_gap` records for journey/workflow/compliance/integration/V&V/persona/domain coverage shortfalls; severity `blocking` halts the phase and severity `advisory` proceeds — see §4).*
- *__Phase 1.8 widened release manifest (Wave 7)__ — `release_plan` schema bumps to `2.0` with a per-Release `contains` block covering journeys + workflows + entities + compliance + integrations + vocabulary, plus a `cross_cutting` block for items that span all releases. Deterministic `buildReleaseManifest` post-validation rejects duplicates and missing accepted items; LLM proposer runs a narrowed prompt focused on grouping, not exact mapping (§4).*
- *__Phase 2 three-pass restructure (Wave 8)__ — Phase 2.1 (Functional Requirements) and Phase 2.2 (Non-Functional Requirements) bloom each split into three internal passes:*
  - *__Pass 1 (Skeleton)__ — narrow output: `id / role / action / outcome / priority / traces_to` (FR) or `id / category / description / priority / traces_to / seed_threshold` (NFR), plus `unreached_journeys[]` (FR) or `unreached_seeds[]` (NFR) declarations. MUST-coverage contract: every accepted journey (FR) / V&V requirement + compliance item (NFR) traces to ≥1 requirement OR is explicitly declared as unreached/absorbed.*
  - *__Pass 2 (Enrichment)__ — per-requirement LLM call. FR enrichment expands the seed AC into 3–7 measurable acceptance criteria; NFR enrichment expands `seed_threshold` into the full `threshold` + `measurement_method` strings. Echo-unchanged contract for skeleton fields. Semantic-aware retry: if the parsed result lacks required fields, the call retries up to 3 times before falling back to skeleton.*
  - *__Pass 3 (Verifier)__ — deterministic `verifyFrCoverage` (sub-phase 2.1c) / `verifyNfrCoverage` (sub-phase 2.2c) emit `coverage_gap` records for journey/seed coverage shortfalls, dangling `traces_to` references, FR-id leakage in NFR `traces_to`, missing measurable conditions, missing thresholds/measurement methods, and id-uniqueness violations. Blocking severity halts Phase 2; advisory severity logs and proceeds (§4, §6).*
- *__Self-heal filter (Wave 8)__ — invalid `traces_to` ids drop silently with a single aggregated WARN log (`{count, sample[]}`) so LLM drift is observable without flooding the stream. Unknown id prefixes and dangling references caught by the verifier as blocking gaps.*
- *__Classify-first decomposition (Wave 8)__ — Phase 2.1a / 2.2a decomposer prompts (`schema_version: 2.0`) elevate the atomic-leaf decision to a first-class top-level branch. Output begins with `parent_branch_classification: "atomic_leaf" | "decomposable" | "invalid_parent"`; only the rules of the chosen branch then apply. Reduces small-model attention overload and surfaces the leaf escape hatch consistently. Output schema is backward-compatible — adds one top-level field; `parent_tier_assessment`, `children[]`, and `surfaced_assumptions[]` unchanged (§4).*
- *__Hard-fail on non-product lens (Wave 8)__ — Phase 1 hard-fails with a structured error when `intent_lens_classification.lens !== 'product'`. The legacy lens-neutral fallback flow (`Sub-Phase 1.2 Intent Domain Bloom` via the `intent_domain_bloom.system.md` template, `Sub-Phase 1.4 Intent Statement Synthesis` via `intent_statement_synthesis.system.md`) is retired — only the product-lens pipeline (`executeProductLens`) is reachable. Phase 2 hard-fails when `product_description_handoff` is missing; the legacy `runFunctionalRequirementsBloom` / `runNonFunctionalRequirementsBloom` methods and their non-product templates (`functional_requirements_bloom.system.md`, `nonfunctional_requirements_bloom.system.md`) are removed. Operators with a non-product intent receive a clear "lens not yet supported" error rather than silently degraded output (§4, §10).*
- *__Runaway-thinking retry classification (Wave 8)__ — In-stream invocation-log-size aborts (the cap that fires when a single attempt's log file exceeds 1.5 MB — typically a thinking spiral) are now classified as a new retryable `LLMErrorType: 'runaway_thinking'` rather than the non-retryable `'context_exceeded'`. Each retry starts with a fresh per-attempt log baseline so sampling variance can rescue the spiral. `getBackoffDelay('runaway_thinking') = 2000` ms. True HTTP-400 `context_exceeded` from a server rejection remains non-retryable (§7, §8.5).*
- *__Coverage gap record family expansion__ — `coverage_gap.sub_phase_id` widens to `'1.3c' | '1.8' | '2.1c' | '2.2c'` (§6, §15).*
- *__Decomposition Viewer (VS Code custom editor)__ — readonly custom editor (`janumicode.decompViewer`, viewType `*.janumicode-decomp`) renders the Multi-Level Accordion visualization (per `docs/requirements viewer/decomp-viewer-visualization.md`). Polls the governed-stream DB at `pollIntervalMs` (default 3000) and pushes a snapshot to a Svelte 5 webview when the SHA-256 revision hash over load-bearing fields changes. Surfaces FR/NFR roots, decomposition trees with status/tier badges, surfaced assumptions, release rail, summary strip, and detail drawer. Status-bar button + command palette entry for discoverability (`janumicode.openDecompViewer`). Read-only access uses `better-sqlite3` `{ readonly: true, fileMustExist: true }` so it can attach to a calibration DB while the writer is live (§17).*
- *__Visual design system migration__ — UI tokens migrated to the `--jc-*` design-token system per `docs/visual design/DESIGN.md` (Logical Architect): surface hierarchy via tonal background steps, "No-Line" rule (no internal borders — separation through tonal step), 3 px primary-tinted left-edge status bar for selection, Editorial Contrast typography (Space Grotesk display, Inter body, Source Code Pro mono), max 6 px radius (§17).*
- *__Phase 1 lens dispatch records__ — `intent_lens_classification.fallback_lens` is still emitted by the classifier for audit, but the orchestrator no longer consults it; classification is the single dispatch signal (§4 Phase 1.0a, §15).*

*Changes from v2.3: Wave 6 recursive requirements decomposition (§4 Phase 2.1a / 2.2a) — tier-based saturation loop with assumption-saturation termination, depth/fanout/per-root budget caps, mirror gate at depth 2, Step 4b tier-downgrade detection, Step 4c AC-shape audit; UUID-based logical identity for decomposition nodes (`node_id` is a minted UUID; `display_key` holds the human label with sibling-collision suffix) with exactly-one-current-version supersession invariant (§5, §15); Phase 1.0 extraction decomposition into five focused passes plus composer (Sub-Phases 1.0b–1.0g — §4); Phase 1.8 Release Plan Approval (§4) producing a `release_plan` artifact with a human gate, and the release_id / release_ordinal propagation contract through every downstream decomposition tree (§4, §7, §15); new record types — requirement_decomposition_node, requirement_decomposition_pipeline, assumption_set_snapshot, release_plan, intent_lens_classification, tier_c_ac_shape_audit (§6, §15); canonical vocabulary expanded (§2) — Release, Release Plan, Decomposition Node, Logical Node Identity, Assumption Saturation, Tier (A/B/C/D); stall detection replaced the retired n-gram LoopDetector and tiny-chunk flailing heuristics with an invocation-log-file-size cap (1.5 MB/attempt, retryable) complemented by records-idle session abort (§8.5); per-root LLM call budget + per-kind telemetry columns on workflow_runs (§10, §11); Phase 1.7 renamed to Handoff Approval; Phase 1.6 renamed to Product Description Synthesis; new workflow_runs columns — intent_lens, decomposition telemetry quartet, active_release_plan_record_id (§11); configuration additions — decomposition block, invocation-log-size env override, gemma-family sampling profile auto-detection in the ollama provider, per-workspace `config.json` deep-merge override pattern (§10); VS Code card additions — DecompositionNodeCard, DecompositionPipelineCard, deferred ReleasePlanCard (§17); test-and-evaluation/ path convention for generated artifacts.*

*Changes from v2.2: All previously deferred "Identical to v2.x" sections resolved inline from v2.0/v2.1 source material; Eval Design and Execution Agent cross-cutting specification inlined (§8.9); all record schemas consolidated in Appendix (§15); Version Management expanded with sub-sections (§13); Section 8 Cross-Cutting Role Specifications expanded to 14 subsections with full Ingestion Pipeline (§8.12), Mirror Generator (§8.13), Memory Edge Lifecycle (§8.14); CLI Agent Invocation Protocol (§16); VS Code Extension UI Contract (§17); Phase 0.5 state machine representation (§4); modification_type determination rules (§4); System-Proposed Content encoding in Phase 1 (§4); Phase 2 warning acknowledgment protocol (§4); Phase 9 test execution ordering (§4); Phase 10 file system mapping and rollback reversion (§4); Dependency Closure edge cases — cycle detection, cross-run boundary, Phase Gate invalidation, closure size limit (§5.3); source_workflow_run_id clarification (§5.4); new system record types (§6.6); token counting implementation, detail file format, uniform stride sampling (§7.2–7.3); Tool Availability Registry and SCOPE_BLIND detection (§7.9); DIVERGING trend definition (§7.10); Phase Gate evaluation order with short-circuit (§7.11); LLM API failure recovery protocol with fallback models (§7.12); Verification Ensemble severity disagreement handling (§8.1); Ingestion Pipeline Failure added to failure taxonomy (§8.5); SQLite WAL concurrency model (§11); file_system_writes and llm_api_calls tables (§11); effective_at assignment rules (§13.3); new deferred items (§14); new appendix schemas (§15.10–15.12); config schema updates — bloom_confidence_threshold removed, tool_availability, rollback_closure_max_artifacts, detail_file_max_bytes, fallback models, cli_invocation added (§10).*

*Cumulative changes from v2.1 (carried from v2.2): Execution Trace Capture for Reasoning Review (§6, §8.1, §8.5, §10); Verification Ensemble for Phase Gates and implementation_divergence checks (§8.1, §10); completion_criteria field on Implementation Tasks (§8.7, §15); Invariant Library with pre-LLM deterministic filters (§7.1, §8.9, §12); one Agent Invocation per distinct artifact type per Sub-Phase formalized (§9); MDAP scope clarification in Three-Layer Correctness Model (§1.6); quarantined flag for failed high-severity Reasoning Review outputs (§7.6, §11); Decision Sequencing Protocol and Verification Ensemble configuration additions (§10).*

*Cumulative changes from v2.0 (carried from v2.1): Three-Layer Correctness Model (§1.6); Intent Quality Check sub-phase (§4); Scope Bounding with dependency closure (§4); Phase 2 attestation step (§4); Phase 0.5 Cross-Run Impact Analysis (§4); Context Assembly two-channel model (§7); Decision Sequencing Protocol (§7); Failure Mode Taxonomy (§8); extended Reasoning Review flaw taxonomy (§8.1); Consistency Checker attestation input (§8.2); Implementation Planner complexity flagging (§8.7); refactoring task type (§8.7, §15); cross_run_modification record type (§6); cascade threshold configuration (§10); domain compliance configuration (§10).*

---

## Table of Contents

1. [Product Definition and Core Principles](#1-product-definition-and-core-principles)
2. [Canonical Vocabulary](#2-canonical-vocabulary)
3. [Agent Roster](#3-agent-roster)
4. [Phase and Sub-Phase Contracts](#4-phase-and-sub-phase-contracts)
5. [Governed Stream](#5-governed-stream)
6. [Governed Stream Record Taxonomy](#6-governed-stream-record-taxonomy)
7. [Orchestrator Specification](#7-orchestrator-specification)
8. [Cross-Cutting Role Specifications](#8-cross-cutting-role-specifications)
9. [Prompt Template Library](#9-prompt-template-library)
10. [Configuration Schemas](#10-configuration-schemas)
11. [Governed Stream Database Schema](#11-governed-stream-database-schema)
12. [JSON Schema Library Structure](#12-json-schema-library-structure)
13. [Version Management and Upgrade Protocol](#13-version-management-and-upgrade-protocol)
14. [Deferred Items](#14-deferred-items)
15. [Appendix — Key Record Schemas](#15-appendix--key-record-schemas)
16. [CLI Agent Invocation Protocol](#16-cli-agent-invocation-protocol)
17. [VS Code Extension UI Contract](#17-vs-code-extension-ui-contract)

---

## 1. Product Definition and Core Principles

### 1.1 What JanumiCode Is

JanumiCode is a Visual Studio Code extension that provides AI agent-led software development capability. It transforms an underspecified human intent into a complete, traceable, executable implementation — including requirements, architecture, technical specifications, code, tests, and evaluations — through a structured multi-agent workflow governed by mandatory phases, human approval gates, and a lossless interaction history.

### 1.2 Core Thesis

A human provides an underspecified intent. JanumiCode's job is to faithfully amplify that intent into a complete, traceable, executable specification without substituting agent judgment for human judgment, while minimizing the human's burden of articulation.

### 1.3 The Human-Agent Dynamic

| Human Capability | Agent Capability |
|---|---|
| Extraordinary at judgment — choosing between options, saying yes or no, recognizing when something is wrong | Exceptional at generating, documenting, transferring context, following precise instructions |
| Poor at articulating context, writing precise instructions, transferring tacit knowledge | Poor at judgment — cannot reliably decide between alternatives without human validation |

JanumiCode resolves this tension through the **[JC:Bloom-and-Prune]** methodology: agents expand underspecified input into a fully articulated candidate space ([JC:Bloom]); the human narrows focus through structured [JC:Mirror]-and-[JC:Menu] interactions ([JC:Prune]). Judgment remains with the human. Generation remains with the agents.

### 1.4 Greenfield and Brownfield Unification

Greenfield applications are treated as extreme cases of brownfield applications: a greenfield [JC:Workspace] has an empty [JC:Governed Stream] and no [JC:Existing Artifacts]. The identical pipeline handles both. Every greenfield [JC:Workflow Run] progressively becomes brownfield as [JC:Artifacts] accumulate. All outputs are designed as future retrieval context from inception.

### 1.5 Design Invariants

These are Constitutional invariants — Authority Level 7. No agent, Orchestrator decision, or human approval within a Workflow Run can supersede them.

- **100% correctness and completeness — always.** All three layers of correctness (Section 1.6) are required.
- **Every phase is mandatory and executed in order.** The [JC:Orchestrator] cannot skip phases.
- **Every [JC:Phase Gate] requires human approval.** No automated gate passage.
- **Every human interaction is recorded in the [JC:Governed Stream] in full detail.**
- **Agents never exercise judgment.** Judgment is always escalated to the human.
- **The [JC:Governed Stream] is single-threaded.** No parallel [JC:Workflow Runs] in a [JC:Workspace].
- **All [JC:Artifacts] are owned by JanumiCode** and stored in the [JC:Governed Stream] database.
- **Prompt Templates use namespace prefixing ([JC:] and [P:]) and separate context scopes at all times.**
- **No governing constraint may be truncated silently.** Governing constraints (Authority Level 6+) are always delivered in full via the stdin directive channel.
- **The Governed Stream is lossless.** All execution trace content — reasoning steps, self-corrections, tool call invocations, tool results — is captured in full regardless of what subset is used for any given downstream purpose.

### 1.6 Three-Layer Correctness Model

JanumiCode's goal of "100% correctness and completeness" requires all three layers simultaneously. A system that achieves Execution Correctness but fails Intent Fidelity or Domain Correctness is not correct by JanumiCode's definition.

| Correctness Layer | Definition | Primary Validation Mechanism |
|---|---|---|
| **Intent Fidelity** | The system delivers what the human actually meant, not just what they literally said | Phase 1 Intent Quality Check; bloom-and-prune; human Phase Gate approvals; Phase 2 attestation step |
| **Domain Correctness** | The system's behavior conforms to real-world rules, regulations, and standards applicable to its domain | Domain Compliance Reasoning Review; `compliance_context` artifact; Specialist Agent registry; Phase 2 human domain attestation |
| **Execution Correctness** | The implemented code behaves as specified by the governing artifacts | Phase 9 test execution; Phase 8 evaluation; `implementation_divergence` Reasoning Flaw; Execution Trace Reasoning Review |

**The honest limitation:** Intent Fidelity and Domain Correctness cannot be fully automated. The human is the necessary external ground truth at Phase Gate approvals. The Phase 2 attestation step makes this role explicit and recorded.

**Relationship to MDAP:** The "Solving a Million-Step LLM Task with Zero Errors" paper (Meyerson et al., 2025) achieves zero-error guarantees in closed domains with mathematically verifiable ground truth (e.g., Towers of Hanoi). JanumiCode operates in open domains where Domain Correctness and Intent Fidelity require human judgment as the external ground truth. This is a characteristic of the problem domain — software development in arbitrary business contexts — not a deficiency in the architecture. JanumiCode adopts MDAP-aligned principles where they apply: extreme decomposition into phases and sub-phases, per-step verification via Reasoning Review of full execution traces, error containment via Dependency Closure Rollback and quarantine of failed outputs, and continuous validation via the Invariant Library. Where MDAP's statistical redundancy model does not directly apply (open-domain correctness), human judgment at Phase Gates is the appropriate mechanism.

---

## 2. Canonical Vocabulary

All [JC:Prompt Templates], schema fields, agent instructions, and UI labels must use these terms exclusively. Prohibited aliases must never appear in any system artifact.

### Layer 0 — Meta / System Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Governed Stream** | The single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. The system of record for everything — lossless. | "Artifact Store", "chat history", "log", "database" |
| **Governed Stream Record** | A single entry in the Governed Stream — may be a human input, agent output, artifact, tool call, tool result, decision, memory, or relationship edge | "message", "event", "entry" |
| **Workflow Run** | A single end-to-end JanumiCode execution for a specific [JC:Intent Statement], from initiation through final approval | "session", "project run", "pipeline run" |
| **Artifact** | A Governed Stream Record whose `record_type` designates it as a schema-validated JSON document produced as a required phase output | "output", "result", "document", "response" |
| **Workspace** | The VS Code workspace within which JanumiCode operates; the scope boundary for a brownfield project's existing artifacts | "project", "repo", "codebase" |
| **janumicode_version_sha** | The git commit SHA of the JanumiCode repository pinned at Workflow Run initiation; recorded on every Governed Stream Record | "version", "build number" |
| **Context Payload — Stdin** | The directive channel of an Agent Invocation — governing constraints, required output specification, and summary context injected via stdin to a CLI-backed agent | "context", "prompt" (unqualified) |
| **Context Payload — Detail File** | The reference channel of an Agent Invocation — a generated filesystem file containing full evidentiary detail the CLI-backed agent may consult during its work | "context file", "detail document" |
| **Detail File Path** | The deterministic filesystem path at which the Context Payload Detail File is placed: `.janumicode/context/{sub_phase_id}_{invocation_id}.md` | "context path", "file location" |
| **Execution Trace** | The complete ordered set of Governed Stream Records produced during a single Agent Invocation — including reasoning steps, self-corrections, tool call invocations, and the final output. Tool results are captured in the Governed Stream but excluded from the Reasoning Review context by design. | "agent log", "run trace", "agent history" |
| **Trace Selection** | The structured subset of the Execution Trace provided to the Reasoning Review — always includes all self-corrections and tool call invocations; selects reasoning steps by rule; excludes tool results | "trace subset", "context selection" |

### Layer 1 — Human Intent Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Raw Intent** | The initial, underspecified human input that initiates a Workflow Run | "prompt", "request", "input", "query" |
| **Intent Domain** | The subject matter area(s) the Raw Intent addresses at a conceptual level without implementation assumptions | "domain" (unqualified), "subject", "topic" |
| **Intent Statement** | The locked, agent-elaborated, human-approved specification of what the human means — produced at the end of Phase 1 | "finalized prompt", "confirmed intent" |
| **Assumption** | An inference made by an agent about something not explicitly stated; must always be surfaced and approved | "implication", "inference", "default" |
| **Constraint** | A condition the solution must satisfy — technical, business, regulatory, or preferential | "requirement" (at this layer), "limitation" |
| **Open Question** | An ambiguity identified by an agent that cannot be resolved without human judgment | "unclear point", "unknown", "TBD" |
| **System-Proposed Content** | Content generated by an agent to fill a structurally required field that the human left absent from the Raw Intent — Authority Level 1 until explicitly approved; carries `derived_from_system_proposal: true` marker | "hallucinated content", "invented content", "agent-generated vision" |
| **Compliance Context** | A structured artifact produced in Sub-Phase 1.1b identifying the domain-specific compliance regimes (legal, regulatory, accounting, industry standards) that apply to the product being built | "compliance requirements", "regulatory context" |
| **Scope Classification** | The Orchestrator's assessment of a Raw Intent's breadth (single feature / single product / multi-product ecosystem) and depth (proof of concept / MVP / production-grade) — produced in Sub-Phase 1.1b | "scope", "project size" |

### Layer 2 — Business / Organization Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Organization** | The company, team, or individual that owns the Workspace | "company", "business", "client" |
| **Industry Vertical** | The market sector the Organization operates in (e.g., logistics, healthcare, fintech) | "business domain" (prohibited — ambiguous) |
| **Business Capability** | What the Organization does — a named, stable ability to operate in its Industry Vertical | "business domain" (prohibited), "business function" |
| **Organizational Unit** | How the Organization is structured — a named division, department, or team | "business domain" (prohibited), "department", "division" |
| **Business Process** | A sequence of activities performed by an Organizational Unit to fulfill a Business Capability | "workflow" (at business layer), "procedure" |
| **End User** | The human who will ultimately use the software being built | "user", "customer", "consumer" |
| **Operator** | A human who administers or configures the software being built | "admin", "manager" |

### Layer 3 — Product / Requirements Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Product Concept** | A named, scoped description of the software to be built — what it is, who it serves, what problem it solves | "product", "app", "solution" (unqualified) |
| **Functional Requirement** | A statement of behavior the system must exhibit — what it must do | "feature", "capability" (at this layer) |
| **Non-Functional Requirement** | A constraint on how the system must behave — performance, security, reliability, scalability, accessibility | "NFR", "quality attribute" |
| **User Story** | A Functional Requirement expressed as: As a [role], I want [action] so that [outcome] | "feature request", "ticket" |
| **Acceptance Criterion** | A verifiable condition that must be true for a User Story to be considered complete | "done criteria", "success condition" |
| **Use Case** | A named interaction sequence between an actor and the system that achieves a goal | "scenario", "flow", "journey" |
| **Priority Level** | The relative importance of a Functional Requirement: Critical / High / Medium / Low | "MoSCoW", "importance", "ranking" |

### Layer 3a — Release Planning and Decomposition Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Release** | An ordered unit of shippable scope — what goes live together as a coherent user-value deliverable. Has a 1-based ordinal and a stable `release_id` (UUID). Earlier-ordinal Releases must not depend on later-ordinal Releases (forward-only dependency). | "pillar" (product-specific), "milestone" (vague), "Release Train" / "PI" (framework-coupled) |
| **Release Plan** | The ordered list of Releases proposed in Phase 1.8 and human-approved via MMP gate. Persisted as a `release_plan` Governed Stream Record with `approved: true`; the active plan is pinned on the Workflow Run via `active_release_plan_record_id`. Drives release_id / release_ordinal propagation through Phase 2+. | "roadmap" (too broad), "delivery plan" |
| **Backlog** | The bucket for work not assigned to any current Release (`release_id: null`). Decomposition nodes whose root doesn't trace to any Release's `traces_to_journeys` land here. Downstream phases render the Backlog last and surface it for re-planning. | "unreleased", "out of scope" |
| **Decomposition Node** | A single entry in a Phase 2.1a (FR) or Phase 2.2a (NFR) recursive decomposition tree — a User Story plus tier, status, release assignment, and parent/root linkage. Logical identity is a UUID; presentation uses `display_key`. | "requirement node" (ambiguous), "tree node" |
| **Logical Node Identity** | The UUID stored in `content.node_id` on every `requirement_decomposition_node` record. Stable across revisions (downgrade / pruned / deferred / atomic). Never confused with the governed_stream row `id` (per-revision) or with `display_key` (presentational). | "node id" (ambiguous — could mean row id), "tree id" |
| **Display Key** | The human-readable label for a Decomposition Node, stored in `content.display_key`. Derived from the LLM's emitted `user_story.id` with a `#<4-hex>` sibling-collision suffix when required. Used in all logs, markdown exports, webview cards, and prompt interpolations. Never used for joins or supersession. | "node name" (ambiguous), "slug" |
| **Tier** | The semantic classification assigned to a depth ≥ 1 Decomposition Node: **A** (functional sub-area, requires further decomposition), **B** (scope commitment, human-gated at depth 2), **C** (pending atomic — one more decomposition pass), **D** (atomic leaf — terminal). Drives orchestrator routing in the saturation loop. | "level" (ambiguous), "kind" |
| **Assumption Saturation** | The primary termination criterion for the Wave 6 recursive decomposition loop: a pass whose `semantic_delta` (newly-surfaced non-duplicate assumptions) is zero AND whose work queue is empty. Safe-rail caps (depth, budget, fanout) can also terminate, but saturation is the desired exit path. | "convergence", "steady state" |
| **Semantic Delta** | Count of assumptions newly surfaced during a saturation-loop pass, excluding those the embedding dedup flagged as duplicates of prior assumptions. Distinct from `delta_from_previous_pass` (raw row count) — only semantic_delta gates termination. | "new assumption count" (ambiguous) |
| **Tier-B Scope Commitment** | A Decomposition Node classified Tier B — represents a bounded scope commitment that materially affects what the product does. Human accepts or rejects at the depth-2 mirror gate before the loop proceeds. Tier-B rejection writes a pruned supersession; acceptance queues the node for further decomposition under the Tier-B hint. | "scope choice", "feature toggle" |
| **Tier-Downgrade (Step 4b)** | The orchestrator's response when a previously-accepted Tier-B Decomposition Node is decomposed and produces further Tier-B children (mis-labeled at original gate). Writes a `status: 'downgraded'` supersession and prepends a "scope expansion" note to the follow-up gate. | "re-gate", "mislabel fix" |
| **AC-Shape Audit (Step 4c)** | A Reasoning Review pass auditing whether a post-gate Tier-B parent's Tier-C/D children carry verification-shaped ACs (measurable) or policy-shaped ACs (hidden scope decisions). Advisory only — writes a `tier_c_ac_shape_audit` reasoning_review_record; no automatic tree changes. | "AC review" |

### Layer 4 — Systems Engineering Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **System Boundary** | The line separating what will be built from what will be integrated with or depended upon | "scope", "boundary" (unqualified) |
| **System Requirement** | A formal, numbered statement derived from Functional and Non-Functional Requirements, allocated to the System Boundary | "requirement" (unqualified at this layer) |
| **External System** | Any system outside the System Boundary that the product must interact with | "third party", "integration", "dependency" |
| **Interface Contract** | A formal specification of how the product communicates with an External System or between internal Components | "API spec", "interface", "contract" |
| **System Context Diagram** | An artifact showing the product, its End Users and Operators, and all External Systems with Interface Contracts labeled | "context diagram", "C1 diagram" |

### Layer 5 — Architecture Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Software Domain** | A cohesive grouping of related business logic within the System Boundary, defined by shared Ubiquitous Language and bounded context | "domain" (unqualified — prohibited), "module", "service area" |
| **Ubiquitous Language** | The shared, unambiguous vocabulary used within a specific Software Domain | "domain language", "glossary" (at domain level) |
| **Component** | A named, deployable or logically separable unit with defined responsibilities and Interface Contracts | "service", "module", "package" (use Component + descriptor) |
| **Component Responsibility** | A statement of what a Component is solely accountable for — must be scoped to a single implementable concern | "ownership", "concern", "purpose" |
| **Architectural Decision** | A documented choice between alternatives at the architecture level with rationale, consequences, and tradeoffs | "ADR", "design decision", "tech choice" |
| **Architectural Decision Record (ADR)** | The structured Artifact capturing an Architectural Decision | (ADR acceptable shorthand after first use) |
| **Dependency** | A directed relationship where one Component requires another Component or External System to function | "coupling", "relationship", "link" |

### Layer 6 — Technical Design Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Technical Specification** | An artifact describing the internal design of a Component — data models, algorithms, API definitions, error handling | "tech spec", "design doc", "TDD" |
| **Data Model** | A formal description of data structures a Component owns — fields, types, constraints, relationships | "schema", "entity model", "database design" |
| **API Definition** | A formal specification of a Component's externally callable Interface Contract | "API spec", "endpoint definition" |
| **Error Handling Strategy** | A specification of how a Component detects, responds to, and surfaces errors | "error handling", "exception strategy" |
| **Configuration Parameter** | A named, typed value that controls Component behavior and is set at deployment time | "config", "setting", "env var" |

### Layer 7 — Implementation Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Implementation Plan** | An ordered sequence of Implementation Tasks derived from Technical Specifications | "sprint plan", "task list", "backlog" |
| **Implementation Task** | A single, atomic unit of work for an Executor Agent — scoped to one Component and one Component Responsibility, with explicit `completion_criteria` | "ticket", "task", "story" (at this layer) |
| **Completion Criteria** | A set of specific, mechanically verifiable conditions that constitute an Implementation Task's completion — checked by the Reasoning Review independently of the agent's self-assessment | "done criteria", "acceptance criteria" (use Acceptance Criterion for requirements-level) |
| **Refactoring Task** | A specialized Implementation Task that modifies Implementation Artifacts produced by a prior Workflow Run to conform to a changed Interface Contract or API Definition. Carries idempotency fields. | "fix task", "update task", "migration" |
| **Executor Agent** | The Agent Role responsible for code generation and file system changes, backed by a CLI tool | "coder", "developer agent", "code agent" |
| **Implementation Artifact** | Any file produced or modified by an Executor Agent — source code, configuration files, migration scripts | "code", "file", "output" (at implementation layer) |
| **File System Write Record** | A Governed Stream Record produced by the Executor Agent after each file creation, modification, or deletion — provides the mapping from Workflow Run to file system state | "file log", "write log" |
| **Refactoring Hash Recompute** | A Governed Stream Record produced when a Refactoring Task's `expected_pre_state_hash` no longer matches the current file state due to prior task modifications | "hash update", "stale hash" |

### Layer 8 — Testing Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Test Plan** | An artifact specifying the complete set of Test Cases — scope, types, coverage targets | "QA plan", "test strategy" |
| **Test Case** | A structured specification (not code) of a single verifiable scenario with preconditions, inputs, steps, and expected outcomes, traced to Acceptance Criteria | "test", "spec" (at test layer) |
| **Test Suite** | A named collection of Test Cases covering a Component or Functional Requirement | "test file", "spec file" |
| **Unit Test** | A Test Case verifying a single function or method in isolation | (standard term — acceptable) |
| **Integration Test** | A Test Case verifying two or more Components interacting via their Interface Contracts | (standard term — acceptable) |
| **End-to-End Test** | A Test Case verifying a complete Use Case from actor action through all Components to outcome | "E2E test" (acceptable shorthand) |
| **Test Result** | The recorded outcome of executing a Test Case — pass, fail, error, or skip — with timestamp and execution context | "test output", "result" |

### Layer 9 — Evaluation Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Evaluation Plan** | An artifact specifying how quality attributes per Non-Functional Requirements will be assessed beyond functional testing | "eval plan", "assessment plan" |
| **Functional Evaluation** | Assessment of Functional Requirements not already covered by the Test Plan | "functional testing" (at eval layer) |
| **Quality Evaluation** | Assessment of non-functional properties: performance, security, maintainability, accessibility | "NFR testing", "quality assessment" |
| **Reasoning Review** | A focused LLM API call that inspects an agent's Execution Trace — reasoning steps, self-corrections, tool call invocations, and final output — against the complete flaw taxonomy. Tool results are excluded by design due to context window constraints; this is a known accepted tradeoff. | "QA check", "review step", "LLM review" |
| **Domain Compliance Reasoning Review** | An additional Reasoning Review pass that checks an artifact for compliance with the confirmed domain-specific compliance regimes in the `compliance_context` artifact | "compliance check", "regulatory review" |
| **Verification Ensemble** | Two Reasoning Review calls on the same output using different model providers — triggered at Phase Gate evaluations and `implementation_divergence` checks. Disagreement between providers escalates to human. | "voting", "ensemble review" |
| **Reasoning Flaw** | A specific, named defect in agent reasoning — see Section 8.1 for the complete taxonomy | "error", "mistake", "hallucination" (too vague) |
| **Invariant Check** | A deterministic, non-LLM validation of an artifact against its Invariant Library rules — runs before Reasoning Review | "schema check", "rule check" |
| **Invariant Violation** | A deterministic finding that an artifact fails a rule in its Invariant Library | "schema error", "rule failure" |

### Layer 10 — Agent and Orchestration Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Agent Role** | A named, specification-defined function in JanumiCode with defined inputs, outputs, responsibilities, and Backing Tool | "agent", "bot", "assistant" (unqualified) |
| **Backing Tool** | The CLI or API used to execute an Agent Role | "LLM", "model", "provider" (at role level) |
| **Agent Invocation** | A single call to an Agent Role's Backing Tool with a fully constructed Context Payload (stdin + detail file for CLI agents), producing an Execution Trace captured in the Governed Stream | "agent call", "LLM call", "tool call" |
| **Prompt Template** | A versioned, parameterized instruction set used to construct the stdin directive for an Agent Invocation | "system prompt", "prompt", "instruction" |
| **Orchestrator** | The TypeScript OrchestratorEngine class responsible for sequencing phases, constructing Context Payloads, routing between Agent Roles, and managing Phase Gate evaluation | "coordinator", "manager", "controller" |
| **Phase** | A mandatory, named stage of a Workflow Run with defined entry criteria, required Agent Invocations, required output Artifacts, and a Phase Gate | "step", "stage", "workflow stage" |
| **Sub-Phase** | A named, ordered step within a Phase with its own required Agent Invocations and output Artifacts. Each Sub-Phase producing a distinct artifact type is a separate Agent Invocation with its own Execution Trace and Reasoning Review. | "step", "task" (at orchestration layer) |
| **Phase Gate** | The validation checkpoint at the end of a Phase — all criteria must pass before the next Phase begins | "checkpoint", "gate", "review point" |
| **Phase Gate Criterion** | A single verifiable condition that must be true for a Phase Gate to pass | "gate condition", "completion criterion" |
| **Bloom Phase** | The Sub-Phase in which agents expand an underspecified input into a fully articulated candidate space | "expansion", "elaboration" |
| **Prune Phase** | The Sub-Phase in which the human narrows the candidate space through Mirror-and-Menu interactions | "refinement", "narrowing", "clarification" |
| **Mirror** | An annotated Artifact reflecting the agent's current understanding with all Assumptions flagged inline for human review | "reflection", "summary", "restatement" |
| **Menu** | A structured set of human-selectable options presented during a Prune Phase — format chosen by the system per question type | "options", "choices", "questions" |
| **Decision Bundle** | A Menu containing multiple independent, low-consequence decisions presented together, each with a system-recommended default and justification | "batch decision", "grouped options" |
| **Decision Trace** | A structured Governed Stream Record capturing a human's selection from a Menu or Decision Bundle, context presented, and timestamp | "decision log", "choice record" |
| **Narrative Memory** | A generated structured summary of a completed Phase, with inline source citations, used as compressed historical context in future Agent Invocations | "memory", "summary", "context note" |
| **Context Packet** | The structured output artifact produced by the Deep Memory Research Agent | "context", "memory output", "retrieval result" |
| **Retrieval Brief** | The minimal structured input a hiring entity passes to the Deep Memory Research Agent | "search query", "retrieval request" |
| **Client Liaison Agent** | The Agent Role that receives human Open Queries, classifies them, retrieves relevant history, synthesizes responses, and escalates workflow implications | "chatbot", "assistant", "Q&A agent" |
| **Open Query** | A human-initiated, unstructured natural language input that arrives outside a structured Menu or Mirror interaction | "question", "chat message", "freeform input" |
| **Unsticking Agent** | The Agent Role that investigates and resolves stuck agent situations through Socratic elicitation, detective reasoning, and specialist recruitment. Has access to the full Execution Trace including tool results — uniquely positioned to diagnose Tool Result Misinterpretation. | "lateral thinking agent", "helper agent" |
| **Loop Detection Monitor** | A deterministic process that evaluates retry count and Reasoning Flaw trends to classify Loop Status | "loop checker", "retry monitor" |
| **Loop Status** | CONVERGING, STALLED, DIVERGING, or SCOPE_BLIND | "loop state", "retry status" |

### Layer 11 — Memory Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Authority Level** | A numeric (1–7) classification of a Governed Stream Record expressing governing weight | "importance", "weight", "trust level" |
| **Semantic Supersession** | A later record overrides an earlier record's governing position without triggering an artifact rollback | "overriding", "replacing" (unqualified) |
| **Memory Edge** | A typed, directed relationship between two Governed Stream Records | "link", "relationship", "connection" (unqualified) |
| **Materiality Score** | The weighted composite score used by the Deep Memory Research Agent | "relevance score", "similarity score" |
| **Constitutional Invariant** | A Design Invariant from Section 1.5 carrying Authority Level 7 | "hardcoded rule", "system constraint" |
| **Ingestion Pipeline** | The synchronous normalization process every new Governed Stream Record passes through | "indexing", "processing", "storage" |

### Layer 12 — Brownfield / History Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Existing Artifact** | Any artifact present in the Workspace before a Workflow Run begins | "legacy code", "existing code", "prior work" |
| **Artifact Ingestion** | The process of normalizing Existing Artifacts into JanumiCode's record schema | "import", "onboarding", "scanning" |
| **Ingestion Gap** | An undocumented decision, missing requirement, or untested behavior identified during Artifact Ingestion | "gap", "missing piece" |
| **Ingestion Conflict** | A contradiction between two or more Existing Artifacts | "conflict", "inconsistency", "mismatch" |
| **Prior Decision Summary** | A structured artifact listing Architectural Decisions and confirmed Assumptions from prior Workflow Runs | "prior context", "historical constraints" |
| **Prior Decision Override** | A Decision Trace formally recording a human's choice to contradict a prior Phase-Gate-Certified decision, triggering Semantic Supersession | "override", "reversal" |
| **Cross-Run Modification** | A Governed Stream Record documenting that the current Workflow Run modified an Implementation Artifact produced by a prior Workflow Run | "cross-run change", "refactor record" |

### Layer 13 — Failure and Recovery Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Convergence Loop** | A failure mode where an agent retries the same approach repeatedly without progress | "retry loop", "stuck loop" |
| **Divergence Loop** | A failure mode where each retry creates new problems — flaw count increasing across retries | "amplification loop", "worsening loop" |
| **Scope Blindness** | A failure mode where an agent has access to needed information but does not consult it | "information blindness", "context gap" |
| **Silent Corruption** | A failure mode where an agent produces syntactically valid output that is semantically wrong without triggering a retry | "silent error", "invisible bug" |
| **Tool Result Misinterpretation** | A failure mode where an agent correctly invokes a tool but draws an incorrect conclusion from its output. Not detectable by Reasoning Review (tool results excluded from trace selection). Primary detection: test execution failure, Invariant violations. Primary diagnosis: Unsticking Agent with full Governed Stream access including tool results. | "misread output", "tool error" |
| **Implementability Violation** | A Reasoning Flaw type — a Component Responsibility is scoped too broadly to be implemented in a single Executor Agent session | "oversized task", "decomposition failure" |
| **Implementation Divergence** | A Reasoning Flaw type — an Implementation Artifact contradicts or partially contradicts the governing Architectural Decision it derives from | "spec drift", "implementation mismatch" |
| **Cascade Threshold** | The configurable maximum number of Refactoring Tasks or affected files that a single interface change may produce before the Orchestrator presents a hard stop | "refactor limit", "cascade limit" |
| **Dependency Closure Rollback** | A rollback that invalidates not just the target artifact but all artifacts reachable from it via `derives_from` Memory Edges | "full rollback", "cascading rollback" |
| **Quarantined Record** | A Governed Stream Record associated with a Reasoning Review finding of `severity: high` — excluded from retry Context Payloads; available in the Governed Stream for audit | "failed output", "dirty output" |
| **Invariant Library** | The collection of deterministic, non-LLM-checkable rules per artifact type — checked before Reasoning Review runs | "rule library", "constraint library" |
| **Tool Availability Registry** | A per-agent-role configuration listing the tools available to that agent during a given invocation — used by the Loop Detection Monitor to detect SCOPE_BLIND status | "tool list", "available tools" |
| **Output Parser** | The component that maps a CLI tool's raw stdout stream to JanumiCode Governed Stream Record types. Configured per backing tool. | "stream parser", "log parser" |

---

## 3. Agent Roster

| Agent Role | Nature | Default Backing Tool | Primary Responsibilities |
|---|---|---|---|
| Domain Interpreter | CLI-backed Agent | Configurable | Intent Domain bloom; Assumption surfacing; Intent Statement synthesis; brownfield contradiction annotation |
| Requirements Agent | CLI-backed Agent | Configurable | Functional and Non-Functional Requirements derivation |
| Systems Agent | CLI-backed Agent | Configurable | System Boundary definition; System Requirements; Interface Contracts |
| Architecture Agent | CLI-backed Agent | Configurable | Software Domain identification; Component decomposition; ADR generation |
| Technical Spec Agent | CLI-backed Agent | Configurable | Data Models; API Definitions; Error Handling Strategies; Configuration Parameters |
| Implementation Planner | CLI-backed Agent | Configurable | Implementation Task decomposition with completion_criteria; complexity flagging; parallelism field estimation |
| Executor Agent | CLI-backed Agent | Claude Code CLI | Code generation; file system changes; test code implementation. Full Execution Trace captured in Governed Stream. |
| Test Design Agent | CLI-backed Agent | Configurable | Test Case specification (not code); Test Suite organization |
| Eval Design Agent | CLI-backed Agent | Configurable | Functional, Quality, and Reasoning Evaluation Plan design |
| Eval Execution Agent | CLI-backed Agent | Configurable | Evaluation tooling invocation; results capture |
| Consistency Checker | CLI-backed Agent | Configurable | Cross-artifact traceability; semantic consistency; internal consistency; historical consistency |
| Deep Memory Research | CLI-backed Agent | Configurable | Multi-stage context reconstruction; Context Packet generation; gap characterization |
| Unsticking Agent | LLM API calls | Google Gemini thinking model | Socratic elicitation; detective reasoning; specialist recruitment. Uniquely has access to full Governed Stream including tool results — primary diagnostic resource for Tool Result Misinterpretation. |
| Client Liaison Agent | LLM API calls | Google Gemini thinking model | Open Query classification; retrieval coordination; response synthesis |
| Orchestrator | LLM API calls + deterministic | Configurable reasoning model | Phase sequencing; Context Payload construction; Phase Gate evaluation; bloom-and-prune for escalations |
| Loop Detection Monitor | Deterministic — no LLM | N/A — TypeScript process | Retry counting; flaw trend analysis; tool call sequence analysis; Loop Status assessment |
| Reasoning Review | LLM API call | Google Gemini thinking model | Inspection of Execution Trace (reasoning steps, self-corrections, tool call invocations, final output) against complete flaw taxonomy. Tool results excluded by design. |
| Narrative Memory Generator | LLM API call | Anthropic Claude Sonnet | Phase summary with inline citations; anti-failure-mode discipline |

### 3.1 Authority Level Taxonomy

Every Governed Stream Record is assigned an Authority Level at write time by the `GovernedStreamWriter`. Assignment is deterministic — no LLM call required.

| Level | Name | Definition | Assignment Rule |
|---|---|---|---|
| 1 | Exploratory | Agent-generated candidate space before any human interaction; also System-Proposed Content filling absent intent fields | Bloom Sub-Phase output before Mirror interaction; or content flagged `derived_from_system_proposal: true` |
| 2 | Agent-Asserted | Agent output not yet seen or validated by any human | Any artifact produced by an agent not yet presented to the human |
| 3 | Human-Acknowledged | Human saw and did not reject — proceeded without editing | Human continued past a Mirror without editing or explicitly approving |
| 4 | Human-Edited | Human actively modified agent-produced Mirror content | Record type is `mirror_edited` |
| 5 | Human-Approved | Explicit human approval via Menu selection, Mirror approval, or Phase Gate approval | Record types: `decision_trace`, `mirror_approved`, `phase_gate_approved` |
| 6 | Phase-Gate-Certified | Subject of a Phase Gate — approved as complete, consistent, ready-to-proceed output | Any artifact whose ID appears in a `phase_gate_approved` record |
| 7 | Constitutional | Design Invariants from Section 1.5 | Hardcoded; not derived from any run |

**Conflict resolution rule (deterministic):**

```
If authority levels differ:
    Higher authority level governs.
    Lower authority record → supersession_chains or contradictions
    with governing_status: superseded.

If authority levels are equal:
    Temporal recency governs — later record governs.
    Both records → contradictions with resolution_status: resolved_by_recency.

If authority levels are equal AND temporal ordering is ambiguous:
    Both records → contradictions with resolution_status: unresolved.
    Human adjudication required before proceeding.
```

**System-Proposed Content propagation rule:** Any artifact derived from a Governed Stream Record with Authority Level 1 that has not been explicitly approved to Level 5 carries `derived_from_system_proposal: true` in its metadata. This marker propagates through all downstream derivations until the root Level 1 record is explicitly approved. Downstream agents receiving artifacts with this marker are instructed in their stdin directive to treat the relevant content as provisional and subject to human confirmation.

### 3.2 Semantic Supersession and Prior Decision Override

Semantic Supersession is not a rollback. It is the formal mechanism by which a human knowingly establishes a new governing position that contradicts a prior Phase-Gate-Certified decision.

**Trigger:** Human selects a bloom candidate in Phase 1 that conflicts with a prior Phase-Gate-Certified decision from a prior Workflow Run.

**Mechanism:**
1. Domain Interpreter annotates the conflicting candidate inline in the Mirror with `[CONFLICTS WITH PRIOR DECISION — human resolution required]`, citing the prior decision's record ID and Authority Level
2. Human selects the conflicting candidate — recorded as `decision_trace` of type `prior_decision_override`
3. `GovernedStreamWriter` creates a `supersedes` Memory Edge from the new artifact to the prior decision record, with Authority Level 5

**Result:** The prior decision record gets `superseded_at` and `superseded_by_record_id` populated. It remains in the Governed Stream as history. The new artifact is the governing position.

---

## 4. Phase and Sub-Phase Contracts

All phases are mandatory. Execution is strictly sequential. The Orchestrator cannot skip phases. Phases may only be revisited through an explicit rollback authorized by the human.

At every Phase boundary the Orchestrator: runs a Vocabulary Collision Check; pre-populates Context Packets for agents requiring historical context; and generates Narrative Memory and Decision Trace synchronously at Phase Gate acceptance before the next Phase begins.

**Sub-Phase Agent Invocation Rule:** Each Sub-Phase producing a distinct artifact type is a separate Agent Invocation with its own Context Payload construction, Execution Trace capture, Invariant Check, Reasoning Review, and Governed Stream recording. Sub-Phases that produce genuinely co-dependent artifacts may share an invocation only when the artifacts cannot be produced in sequence without circular dependency — this exception must be documented in the Prompt Template header with rationale.

| Phase | Name |
|---|---|
| 0 | Workspace Initialization |
| 0.5 | Cross-Run Impact Analysis *(conditional)* |
| 1 | Intent Capture and Convergence |
| 2 | Requirements Definition |
| 3 | System Specification |
| 4 | Architecture Definition |
| 5 | Technical Specification |
| 6 | Implementation Planning |
| 7 | Test Planning |
| 8 | Evaluation Planning |
| 9 | Execution |
| 10 | Commit and Deployment Initiation |

---

### Phase 0 — Workspace Initialization

**Purpose:** Establish the baseline context for the Workflow Run. Pin `janumicode_version_sha`. Run Vocabulary Collision Check.

**Entry Criterion:** A new Workflow Run is initiated by the human.

#### Sub-Phase 0.1 — Workspace Classification

- **[JC:Agent Role]:** Orchestrator
- **Action:** Determines whether Workspace is greenfield or brownfield. Pins `janumicode_version_sha`.
- **Output Artifact:** `workspace_classification`

#### Sub-Phase 0.2 — Artifact Ingestion *(brownfield only)*

- **[JC:Agent Role]:** Deep Memory Research Agent
- **Action:** Normalizes Existing Artifacts. Identifies Ingestion Gaps and Conflicts.
- **Output Artifact:** `ingested_artifact_index`, `ingestion_gap_list`, `ingestion_conflict_list`

#### Sub-Phase 0.2b — Brownfield Continuity Check *(brownfield only)*

- **[JC:Agent Role]:** Deep Memory Research Agent
- **Action:** Retrieves complete Decision History. Produces Prior Decision Summary.
- **Output Artifact:** `prior_decision_summary`

#### Sub-Phase 0.3 — Ingestion Review *(brownfield only)*

- **Interaction:** Mirror presenting gap and conflict lists. Menu for human to prioritize and resolve.
- **Output:** Approved `baseline_artifact_set`

#### Sub-Phase 0.4 — Vocabulary Collision Check

- **[JC:Agent Role]:** Orchestrator (LLM API call)
- **Output Artifact:** `collision_risk_report`

**Phase Gate Criteria:**
- `workspace_classification` schema-valid; Invariant Check passed; `janumicode_version_sha` recorded
- All Ingestion Conflicts have human-approved resolution *(brownfield only)*
- `prior_decision_summary` produced and human-reviewed *(brownfield only)*
- `collision_risk_report` produced and aliases confirmed
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 0.5 — Cross-Run Impact Analysis *(conditional)*

**Purpose:** Analyze and bound the implementation consequences of a Prior Decision Override that changes an Interface Contract, API Definition, or Data Model established in a prior Workflow Run. Prevent uncontrolled refactor cascades.

**Entry Criterion:** Phase 0 Phase Gate passed AND a `prior_decision_override` Decision Trace from Phase 1 references a Phase-Gate-Certified Interface Contract, API Definition, or Data Model from a prior Workflow Run.

**Note:** Phase 0.5 executes after Phase 1 (where the Prior Decision Override is confirmed) and before Phase 2. Its position in the phase list reflects its logical dependency, not its temporal sequence.

**State Machine Representation:** The `workflow_runs.current_phase_id` uses the value `"0.5"` during Phase 0.5. The `StateMachine` treats `"0.5"` as a valid phase ID with transitions:

- Reachable only from `"1"` when a `prior_decision_override` Decision Trace references a Phase-Gate-Certified Interface Contract, API Definition, or Data Model
- Transitions to `"2"` on Phase 0.5 Phase Gate passage
- Transitions to `"1"` if the human selects "Revise the override" in Sub-Phase 0.5.2

The UI displays Phase 0.5 as "Cross-Run Impact Analysis" without a number prefix.

#### Sub-Phase 0.5.1 — Impact Enumeration

- **[JC:Agent Role]:** Consistency Checker Agent
- **Context Payload includes:** Prior Workflow Run's Implementation Artifacts; the changed interface definition; the `prior_decision_summary`
- **Action:** Identifies all Implementation Artifacts from prior runs that implement the interface being changed. Enumerates affected file paths, estimated change scope, and dependency chain.
- **Output Artifact:** `cross_run_impact_report: {changed_interface_id, affected_artifact_ids, affected_file_paths, estimated_refactoring_task_count, estimated_file_count, dependency_chain, modification_type: additive | breaking | non_breaking}`

**`modification_type` determination:** `modification_type` is determined rule-based by the Consistency Checker Agent using a deterministic diff of the old and new interface definitions:

| Condition | modification_type |
|---|---|
| Change adds new fields/endpoints without removing or altering existing ones | `additive` |
| Change removes, renames, or changes the type of any existing field/endpoint | `breaking` |
| Change affects only implementation details (error messages, documentation, default values) with no structural change | `non_breaking` |

When the diff is ambiguous (a field is both added and a structurally similar field removed), the default is `breaking` (conservative).

**Cascade Threshold Check (deterministic):** The Orchestrator compares `estimated_refactoring_task_count` and `estimated_file_count` against the configured cascade thresholds in `janumicode.config.json`. If either threshold is exceeded, a hard stop menu is presented before Sub-Phase 0.5.2 proceeds:

> "The proposed interface change would require modifying [N] tasks across [M] files — exceeding the cascade threshold. Options: (A) Proceed — accept the full refactoring scope, (B) Redesign the interface change to reduce cascade impact — return to Phase 0.5.1 with constraint to reduce scope, (C) Abandon this interface change and pursue an additive approach that does not break existing contracts."

#### Sub-Phase 0.5.2 — Refactoring Decision

- **Interaction:** Mirror presents `cross_run_impact_report`. Human selects:
  - **(A) Proceed:** A Refactoring Task will be added to Phase 6 to update affected prior-run artifacts. Refactoring Tasks carry idempotency fields — see Section 8.7.
  - **(B) Revise the override:** Return to Phase 1 to reconsider the interface change.
  - **(C) Accept divergence:** Document as known technical debt. The two runs will have temporarily incompatible implementations. A `technical_debt_record` Governed Stream Record is created.
- **Output:** Decision recorded as `decision_trace`; if (A), `refactoring_scope` artifact produced listing all Refactoring Tasks to be added in Phase 6

**Phase Gate Criteria:**
- `cross_run_impact_report` schema-valid
- Cascade threshold check completed — either within threshold or human approved override
- Human has selected a resolution path
- Narrative Memory and Decision Trace generated and stored

---

### Phase 1 — Intent Capture and Convergence

**Purpose:** Transform the Raw Intent into a locked, unambiguous Intent Statement (and, under the product lens, a full Product Description Handoff) through Intent Quality Check, Lens Classification, Scope Bounding, maximal Bloom, and structured Prune.

**Entry Criterion:** Phase 0 Phase Gate passed.

**Lens-Conditional Sub-Phase Topology:** Sub-Phases 1.0 (Intent Quality Check) and 1.0a (Intent Lens Classification) are common to every run. After 1.0a classifies the intent into one of six lenses (`product`, `feature`, `bug`, `infra`, `legal`, `unclassified`), the downstream Phase 1 sub-phase topology is resolved against that lens:

| Lens | Downstream flow |
|---|---|
| `product` | Product-lens flow: 1.0b silent discovery → 1.1b scope → four proposer/prune rounds (1.2 domains+personas, 1.3 journeys+workflows, 1.4 entities, 1.5 integrations+QAs) → 1.6 handoff synthesis → 1.7 handoff approval. Emits both `product_description_handoff` AND a derived `intent_statement`. |
| `feature` / `bug` / `infra` / `legal` / `unclassified` | Default collapsed flow: 1.1b scope → 1.2 bloom → 1.3 candidate review → 1.4 assumption adjudication → 1.5 intent-statement synthesis → 1.6 intent-statement approval. |

Every lens-conditional variant carries the same Phase 1 semantics — a locked intent usable by Phase 2 — but the topology is tuned to the shape of the intent. Non-product lenses may receive dedicated bespoke flows in future revisions; until then they follow the default collapsed flow.

#### Sub-Phase 1.0 — Intent Quality Check

- **[JC:Agent Role]:** Orchestrator (LLM API call)
- **Action:** Assesses the Raw Intent across three dimensions before bloom begins:
  - **Completeness:** Are structurally required fields present? Required fields: what is being built, who it serves, what problem it solves.
  - **Consistency:** Are any stated elements internally contradictory?
  - **Coherence:** Does the overall intent form a plausible product?
- **Output Artifact:** `intent_quality_report: {completeness_findings: [{field, status: present|absent, severity}], consistency_findings: [{elements_in_conflict, explanation}], coherence_findings: [{concern, explanation}]}`

**If absent fields detected:** Mirror presents exactly what is missing and why it cannot be inferred. Menu:
- **(A) Provide the missing information now** — human fills the gap; bloom proceeds
- **(B) Allow system to propose candidates for this field** — the system blooms candidates for the absent field, marked as System-Proposed Content at Authority Level 1 with `derived_from_system_proposal: true`. Human must explicitly approve each proposed item to elevate to Level 5 before it can govern downstream artifacts.

**If contradictory intent detected:** The contradiction must be resolved before bloom proceeds. Mirror presents the contradiction with the specific conflicting elements identified. Menu presents resolution options. Proceeding with unresolved contradictions is blocked.

#### Sub-Phase 1.0a — Intent Lens Classification

- **[JC:Agent Role]:** Orchestrator (LLM API call)
- **Action:** Classifies the Raw Intent into one of six lenses — `product`, `feature`, `bug`, `infra`, `legal`, `unclassified` — to resolve which downstream Phase 1 topology applies. The classifier reads the Raw Intent plus any files ingested in Phase 0 (inlined inline), emits a lens + confidence score + rationale grounded in quoted evidence, and persists the chosen lens on the Workflow Run.
- **Hard-Fail Dispatch (Wave 8):** Only the `product` lens has a complete specialized pipeline. Any other classified lens (`feature`, `bug`, `infra`, `legal`, `unclassified`) causes Phase 1 to return a structured error and halt — the legacy lens-neutral fallback flow has been retired. The previously-emitted `fallback_lens` field remains on the artifact for audit but is **not** consulted by the dispatch logic. Operators receive a clear "lens not yet supported" error rather than silently degraded output.
- **Output Artifact:** `intent_lens_classification: {lens, confidence, rationale, fallback_lens}`
- **State Effect:** Writes `workflow_runs.intent_lens` so every downstream sub-phase resolves lens-aware templates and contracts without re-reading the raw intent.

#### Sub-Phase 1.1 — Raw Intent Reception

- **[JC:Agent Role]:** Orchestrator
- **Action:** Logs Raw Intent as Governed Stream Record. Triggers Sub-Phase 1.1b.

---

#### Default-Flow Sub-Phases — RETIRED (Wave 8)

The default-flow sub-phases (`Sub-Phase 1.2 Intent Domain Bloom`, `Sub-Phase 1.4 Intent Statement Synthesis`, etc.) and their lens-neutral templates (`intent_domain_bloom.system.md`, `intent_statement_synthesis.system.md`) are **retired**. Phase 1 hard-fails at lens dispatch (1.0a) when the classified lens is not `product`. The product-lens flow below is the only reachable path. The retired sub-phases are documented in the version history; the product-lens flow is now the single Phase 1 specification.

#### Sub-Phase 1.1b — Scope Bounding and Compliance Context

- **[JC:Agent Role]:** Orchestrator (LLM API call) + Domain Interpreter Agent
- **Action — Step 1, Scope Classification:** Classifies the Raw Intent's breadth (single feature / single product / multi-product ecosystem) and depth (proof of concept / MVP / production-grade). Identifies cross-scope dependencies if breadth is multi-product.
- **Action — Step 2, Dependency Closure Analysis:** If breadth is multi-product and the human may choose to scope to a subset, the Domain Interpreter identifies concepts and data from out-of-scope product areas that the scoped product area depends on. These dependencies must be explicitly resolved in the scoping decision.
- **Action — Step 3, Compliance Context Identification:** Identifies domain-specific compliance regimes that apply to the product being built (accounting standards, legal regulations, industry standards, accessibility requirements, data privacy laws). Presents identified regimes for human confirmation.
- **Output Artifact:** `scope_classification`, `compliance_context: {regimes: [{name, description, applicable_phases, relevant_artifacts}]}`

**Scope Menu (if multi-product detected):**
> "Your intent describes a multi-product ecosystem. Options: (A) Scope this run to [Product Area N] — note: the following concepts from other product areas must be stubbed or declared as External Systems: [dependency closure list], (B) Scope this run to a cross-cutting shared foundation used by all product areas, (C) Proceed with full ecosystem scope and allow the bloom to surface natural decomposition."

**Compliance Menu:**
> "The following compliance regimes appear applicable. Confirm, add, or remove: [list with checkboxes]."

#### Sub-Phase 1.2 — Intent Domain Bloom

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Context Payload stdin:** Active constraints (Authority Level 6+), `scope_classification`, `compliance_context` summary, `collision_risk_report` aliases, `prior_decision_summary` summary (brownfield)
- **Context Payload detail file:** Full Context Packet from Deep Memory Research (brownfield, `all_runs` scope); full `prior_decision_summary`
- **Action:** Applies collision aliases before any generation. Expands Raw Intent into a set of plausible candidate interpretations of what is being proposed. Each `candidate_product_concept` is a candidate direction for the run, not yet governing intent. In brownfield runs, checks each candidate against Context Packet `active_constraints` and annotates conflicts inline. System-Proposed Content (from Sub-Phase 1.0 Option B) is included in the bloom but flagged at Authority Level 1.
- **Output Artifact:** `intent_bloom`

**System-Proposed Content Encoding:** System-Proposed Content items are encoded as a dedicated `system_proposed_content` array within `intent_bloom`, separate from `candidate_product_concepts`. Each item has its own `approval_status: pending | approved | rejected` field. This prevents System-Proposed Content from being mixed silently into human-derived content.

When a System-Proposed Content item is approved, `GovernedStreamWriter` elevates its `authority_level` from 1 to 5 and traverses `record_references` forward from the item to clear `derived_from_system_proposal: true` from all downstream artifacts that inherited it due to this item.

#### Sub-Phase 1.3 — Intent Candidate Review and Menu

- **Interaction:** Annotated Mirror of `intent_bloom` centered on candidate interpretations first. The human reviews, keeps, rejects, edits, or defers candidate directions before downstream synthesis. Assumptions, constraints, and open questions inside a candidate are supporting rationale at this stage unless explicitly elevated into a later assumption-focused surface. Mixed-format Menus follow the Decision Sequencing Protocol (Section 7.5) to prune candidate space. System-Proposed Content items require individual explicit approval before they can be used as governing content. Prior decision conflicts are highlighted. All Decision Traces are recorded.

#### Sub-Phase 1.4 — Assumption Surfacing and Adjudication

- **[JC:Agent Role]:** Orchestrator + Domain Interpreter Agent
- **Action:** Extracts the assumption set implied by the kept candidate interpretations, normalizes and deduplicates those assumptions into first-class review objects, and presents them for explicit human adjudication. Only accepted or edited assumptions may become governing inputs to downstream synthesis. Rejected assumptions are excluded. Deferred assumptions remain unresolved and block progression unless explicitly handled by policy.
- **Output Artifact:** `surfaced_assumptions`, `adjudicated_assumptions`

#### Sub-Phase 1.5 — Intent Statement Synthesis

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Synthesizes all prune decisions into complete Intent Statement using only the kept candidate interpretations and the adjudicated assumption set. Reasoning Review applied. Domain Compliance Reasoning Review applied if `compliance_context` is populated.
- **Output Artifact:** `intent_statement: {product_concept, confirmed_assumptions: [{assumption_id, assumption, confirmed_by_record_id}], confirmed_constraints, out_of_scope, scope_classification_ref, compliance_context_ref, prior_decision_overrides, system_proposed_content_items: [{field, content, approved: bool}]}`

#### Sub-Phase 1.6 — Intent Statement Approval

- **Interaction:** Full Mirror of `intent_statement`. Human approves, rejects, or edits. If rejected: return to 1.2 with rejection context injected.

---

#### Product-Lens Sub-Phases (lens = product)

The sub-phases below replace the default 1.1b–1.6 flow when Lens Classification selects `product`, extending through 1.7 Handoff Approval and 1.8 Release Plan Approval before the Phase Gate evaluates. They implement a **v1-style four-round proposer/prune loop** so the intent capture output matches what Phase 2+ consumers need for a full product: personas, user journeys, business domains, entities, workflows, integrations, quality attributes, and an ordered release plan — not just a thin product concept.

Every proposer round emits its own bloom artifact and presents a dedicated `decision_bundle_presented` prune gate. The prune gate accepts three resolutions:

- **Accept-all / menu prune** — human keeps a subset of proposed items; loop proceeds to the next round.
- **Free-text feedback** — human types textual guidance instead of using the Menu. The current round's proposer re-runs with `{{human_feedback}}` injected; a new bloom artifact is written; the prune gate is re-presented. Capped at 3 feedback iterations per round to prevent livelock; exhaustion halts with `requires_input`.
- **Mirror rejection** — human rejects the round's framing (lens assumption, scope framing). Halts with `requires_input`; the re-bloom loop cannot recover a framing error by definition.

#### Intent Discovery Decomposition (Sub-Phases 1.0b – 1.0g) *(product lens)*

Under the product lens, Phase 1 source-document extraction is **decomposed** into five focused passes plus a deterministic composer. Rationale: a single monolithic "capture everything" pass is vulnerable to probabilistic drift at scale — empirically a capable frontier LLM will nail one category and silently drop another when the source doc is long. Decomposing bounds drift per category and lets the harness grade each extraction independently.

The system invariant holds: **only Phase 0 (ingestion) and Phase 1.0* extraction passes read source documents directly.** All downstream phases read the governed stream. The Deep Memory Research Agent is the sanctioned on-demand retrieval channel for long-tail context.

Each extraction pass captures items with a **`source_ref`** containing `document_path`, optional `section_heading`, and a verbatim `excerpt`. This traceability spine lets Phase 8 Evaluation walk `source_ref → extracted_item → requirement → component → test_result` chains mechanically and detect drift per segment.

#### Sub-Phase 1.0b — Product Intent Discovery *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Silent homework pass. Extracts the **product slice**: vision, description, seed personas, seed user journeys, phasing strategy, success metrics, UX requirements, and product-level requirements / decisions / constraints / open questions. **Does not capture** technical stack, compliance regimes, V&V targets, or vocabulary — those are sibling passes' responsibility.
- **Output Artifact:** `artifact_produced[kind=intent_discovery]`

#### Sub-Phase 1.0c — Technical Constraints Discovery *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Transcribes stated-not-invented technical decisions from the source documents — chosen stack, mandatory infrastructure, security models, deployment constraints, integration protocols. Explicitly transcription, not design; Phase 4 (Architecture) and Phase 5 (Technical Specification) consume these as pre-approved authoritative constraints.
- **Output Artifact:** `artifact_produced[kind=technical_constraints_discovery]` carrying `technicalConstraints[]`.

#### Sub-Phase 1.0d — Compliance & Retention Discovery *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Captures regulatory regimes (HIPAA, SOC2, GDPR, WCAG, etc.), legal retention obligations, audit requirements, and jurisdictional constraints stated in source documents. Downstream consumers: Phase 1.1b (scope/compliance context augmentation), Phase 5 (data model retention wiring), Phase 7 (test planning), Phase 8 (evaluation design).
- **Output Artifact:** `artifact_produced[kind=compliance_retention_discovery]` carrying `complianceExtractedItems[]`.

#### Sub-Phase 1.0e — V&V Requirements Discovery *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Captures Verification & Validation requirements with measurable threshold + measurement method — distinct from free-prose `qualityAttributes[]` in that each V&V item is structured `{ target, measurement, threshold }` for direct consumption by Phase 7 Test Planning and Phase 8 Evaluation Design.
- **Output Artifact:** `artifact_produced[kind=vv_requirements_discovery]` carrying `vvRequirements[]`.

#### Sub-Phase 1.0f — Canonical Vocabulary Discovery *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Captures domain-specific terms + definitions from source documents. Consumed by Phase 0.4 Vocabulary Collision Check and by Phase 4 Architecture naming to keep component names aligned with stakeholder mental model.
- **Output Artifact:** `artifact_produced[kind=canonical_vocabulary_discovery]` carrying `canonicalVocabulary[]`.

#### Sub-Phase 1.0g — Intent Discovery Synthesis *(product lens)*

- **[JC:Agent Role]:** Orchestrator (deterministic)
- **Action:** No LLM call — merges the five extraction outputs into a single `IntentDiscoveryBundle` that the remaining Phase 1 sub-phases (1.1b scope + 1.2–1.5 blooms + 1.6 handoff synthesis) consume. Writes an `intent_discovery_bundle` record that points at each extraction artifact via `derived_from_record_ids` and captures per-category counts as a summary.
- **Output Artifact:** `artifact_produced[kind=intent_discovery_bundle]`

#### Sub-Phase 1.1b — Scope Bounding and Compliance Context *(reused from default flow)*

Identical to Sub-Phase 1.1b above. Emitted under both lens topologies.

#### Sub-Phase 1.2 — Business Domains and Personas Bloom *(product lens, Round 1)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Proposer Round 1. Expands the validated product intent into the complete set of business domains and personas the product could encompass. Intentionally over-proposes — the human prunes. Each domain carries a short `entityPreview` and `workflowPreview` to surface what downstream rounds will expand on.
- **Output Artifact:** `artifact_produced[kind=business_domains_bloom]` followed by `decision_bundle_presented` prune gate.

#### Sub-Phase 1.3a — User Journey Bloom *(product lens, Wave 7)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Proposer Round 2a. Takes the accepted domains + personas from Round 1 and proposes user journeys with steps, actors, acceptance criteria, `implementationPhase` tag, and `automatable: boolean` per step (Wave 7 — flags the steps Sub-Phase 1.3b will be expected to back). Coverage targets are: every accepted persona initiates ≥1 journey, every accepted domain hosts ≥1 journey. Journeys that legitimately don't apply MUST be declared in `unreachedPersonas[]` / `unreachedDomains[]` with a reason — silent omission is caught by the 1.3c verifier as `persona_coverage` / `domain_journey_coverage` advisory gaps.
- **Output Artifact:** `artifact_produced[kind=user_journey_bloom]` followed by `decision_bundle_presented` prune gate.

#### Sub-Phase 1.3b — System Workflow Bloom *(product lens, Wave 7)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Entry Criterion:** 1.3a accepted (`accepted_journeys` + accepted personas + accepted domains available).
- **Action:** Proposer Round 2b. Proposes system workflows that **back** automatable journey steps (one workflow per step flagged `automatable: true` in 1.3a, with a `triggers[]` entry of kind `journey_step` pointing at `(journey_id, step_number)`), plus own-triggered workflows seeded by `compliance_extracted_items` (kind `compliance` triggers), `integrations` (kind `integration` triggers), `schedule` triggers (cadence-based: nightly retention sweeps, weekly billing batches), or `event` triggers. Each workflow declares `surfaces: { compliance_regimes[], retention_rules[], vv_requirements[], integrations[] }` so 1.3c can deterministically verify coverage.
- **Output Artifact:** `artifact_produced[kind=system_workflow_bloom]` followed by `decision_bundle_presented` prune gate.

#### Sub-Phase 1.3c — Coverage Verifier *(product lens, Wave 7, deterministic)*

- **[JC:Agent Role]:** Orchestrator (deterministic — pure function, no LLM call).
- **Entry Criterion:** Both 1.3a and 1.3b accepted.
- **Action:** Runs `verifyCoverage` in [src/lib/orchestrator/phases/phase1/verifyCoverage.ts](src/lib/orchestrator/phases/phase1/verifyCoverage.ts) — exhaustive structural checks across both bloom outputs. One `coverage_gap` record is emitted per failed predicate. Severity-tagged: `blocking` halts the phase (`return success: false` with the gap-rec ids); `advisory` logs and proceeds.
- **Predicates checked:**
  - **`persona_coverage`** (advisory) — every accepted persona initiates ≥1 journey or appears in `bloomExplicitlyUnreachedPersonas[]`.
  - **`domain_journey_coverage`** / **`domain_workflow_coverage`** (advisory) — every accepted domain hosts ≥1 journey AND ≥1 workflow, or appears in `bloomExplicitlyUnreachedDomains[]`.
  - **`automatable_step_backing`** (advisory) — every journey step explicitly flagged `automatable: true` is claimed by ≥1 workflow with a `journey_step` trigger pointing at it. Workflow-backed-but-not-flagged is treated as implicit promotion (not a gap).
  - **`compliance_coverage`** / **`retention_coverage`** / **`integration_coverage`** / **`vv_coverage`** (advisory) — every accepted compliance item, retention rule, integration, V&V requirement is surfaced by ≥1 journey or workflow via `surfaces.*[]` arrays or workflow `triggers`.
  - **`referential_integrity_*`** (blocking) — `journey.personaId`, `journey.businessDomainIds[]`, journey-step `actor`, workflow `businessDomainId`, workflow `triggers[]`, workflow-step `actor`, `workflow.backs_journeys[]`, and every id in `surfaces.*[]` arrays must resolve to accepted upstream items. A single gap record per category aggregates all offenders to keep blast radius small.
- **Output Artifacts:** `coverage_gap` records (zero or more) with `sub_phase_id: '1.3c'`. Empty array means all checks passed.

#### Combined Sub-Phase 1.3 (legacy reference) — RETIRED

The combined `Sub-Phase 1.3 — User Journeys and System Workflows Bloom` from the v2.4 spec is replaced by the three-step 1.3a/1.3b/1.3c sequence above. The combined `journeys_workflows_bloom` artifact kind is no longer produced.

#### Sub-Phase 1.4 — Business Entities Bloom *(product lens, Round 3)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Proposer Round 3. Takes the accepted domains and workflows from prior rounds and proposes the full entity catalog needed to implement them — core entities, junction entities, audit/history entities, configuration entities — each linked to its owning business domain.
- **Output Artifact:** `artifact_produced[kind=entities_bloom]` followed by `decision_bundle_presented` prune gate.

#### Sub-Phase 1.5 — Integrations and Quality Attributes Bloom *(product lens, Round 4)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Proposer Round 4. Takes everything accepted from prior rounds and proposes external-system integrations (with category, suggested providers, ownership model) plus cross-cutting quality attributes (NFRs — multi-tenancy, RBAC, encryption, accessibility, performance SLOs, compliance, observability).
- **Output Artifact:** `artifact_produced[kind=integrations_qa_bloom]` followed by `decision_bundle_presented` prune gate.

#### Sub-Phase 1.6 — Product Description Synthesis *(product lens)*

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Silent consolidation. Carries forward every accepted item from Rounds 1–4 verbatim (no summarization, no MVP pruning — the human prunes during review, not during synthesis) and refines the narrative fields (vision, description, summary) against the settled product shape. Resolves open questions that were answered during the bloom rounds and flags the remainder as open loops. Also derives a compatibility `intent_statement` projection so Phases 2–9 can continue reading their existing interface unchanged.
- **Output Artifacts:**
  - `product_description_handoff`: full v1-shaped finalized plan — productVision, productDescription, summary, personas, userJourneys, phasingStrategy, successMetrics, businessDomainProposals, entityProposals, workflowProposals, integrationProposals, qualityAttributes, uxRequirements, requirements, decisions, constraints, openQuestions, humanDecisions, openLoops.
  - `artifact_produced[kind=intent_statement]`: derived compatibility record with `product_concept` (name, description, who_it_serves, problem_it_solves) + `confirmed_assumptions` + `confirmed_constraints` + `out_of_scope`.

#### Sub-Phase 1.7 — Handoff Approval *(product lens)*

- **Interaction:** Full Mirror of the `product_description_handoff` with section-level summaries (personas count, journeys count, domains count, entities count, etc.). Human approves, rejects, or edits sections. On approval → Sub-Phase 1.8. On rejection → `requires_input`; the re-bloom loop does not apply at approval.

#### Sub-Phase 1.8 — Release Plan Approval *(product lens)*

- **[JC:Agent Role]:** Orchestrator (LLM proposer + human gate).
- **Entry Criterion:** 1.7 Handoff Approval passed — approved `product_description_handoff` available.
- **Action:** LLM proposer reads the handoff's `productVision`, `productDescription`, `phasingStrategy`, `userJourneys`, and `businessDomainProposals`, and proposes an ordered list of Releases (2–5 by default) that partition the accepted journeys. Every accepted journey must be assigned to exactly one Release; a fallback "Future / Post-Launch" Release is added when some journeys cannot fit the shippable ordinals. The proposer treats the 1.0b `phasingStrategy` as a strong hint but owns the final shape (merges, splits, rename). `release_id` values emitted by the LLM (e.g. `REL-1`) are canonical short forms for reasoning only; the orchestrator mints a fresh UUID per Release at write time — the UUID is the persisted `release_id`.
- **Widened Manifest (Wave 7, schemaVersion `2.0`):** The release plan's `releases[].contains` block carries six arrays — `journeys[]`, `workflows[]`, `entities[]`, `compliance[]`, `integrations[]`, `vocabulary[]` — plus a top-level `cross_cutting: { workflows[], compliance[], integrations[], vocabulary[] }` block for items that span every release. Phase 2 root-decomposition's `assignReleaseToRoot` matches an FR/NFR root's `traces_to[]` against any of the six per-release arrays (lowest-ordinal release wins on tie); items in `cross_cutting` do NOT anchor a root to a release (they are available everywhere — no release-ordering signal — so `traces_to` consisting only of cross-cutting items resolves to Backlog). The deterministic `buildReleaseManifest` post-validation (run after the LLM proposer) catches duplicate assignments and accepted-but-unassigned items; failures are emitted as `coverage_gap` records with `sub_phase_id: '1.8'`.
- **Interaction:** MMP `decision_bundle_presented` with one mirror item per proposed Release (label: `Release N: <name>`, description: Release description, tradeoffs: rationale). Gate supports three resolutions:
  - **Accept-all / subset** — human keeps a subset of proposed Releases (MVP: partial acceptance is tolerated; orphaned subsets are renumbered 1..N at approval time. Full split/merge/move-journey operations are deferred to a v2 `ReleasePlanCard` surface).
  - **Free-text feedback** — proposer re-runs with `{{human_feedback}}` injected; new `release_plan` artifact written with `approved: false`; gate re-presented. Capped at 3 iterations.
  - **Mirror rejection** — halts with `requires_input`.
- **Output Artifacts:**
  - Each proposer iteration: `artifact_produced[kind=release_plan]` with `approved: false` + an accompanying `decision_bundle_presented`.
  - On final approval: a new `artifact_produced[kind=release_plan]` with `approved: true` — the governing Release Plan. Its row id is persisted on the Workflow Run via `workflow_runs.active_release_plan_record_id`.
- **Downstream Contract (Release Propagation):** Phase 2 root-decomposition writes resolve each root's `release_id` + `release_ordinal` by matching the root's `user_story.traces_to` against each Release's `traces_to_journeys` (lowest-ordinal release wins on tie; no match → Backlog). Every descendant inherits the parent's `release_id` verbatim. Supersession revisions (downgrade / pruned / deferred / atomic) PRESERVE the `release_id` — tree-structure changes do not silently move work across Releases. See `docs/release_prioritization_design.md` for the full design.

**Phase Gate Criteria:**

Common across all lenses:
- `intent_quality_report` has `overall_status: pass` (no blocking contradictions remain)
- `intent_lens_classification` recorded with a lens value (may be `unclassified` if confidence is low)
- All System-Proposed Content items have explicit human approval (Level 5) or are marked as excluded
- No `derived_from_system_proposal: true` artifacts in governing position without explicit approval
- Reasoning Review: zero high-severity flaws or all resolved; no quarantined records in governing position
- All `prior_decision_override` Decision Traces recorded with rationale
- Human explicitly approved the final approval surface (1.6 under default flow, 1.7 under product-lens flow; under the product lens the 1.8 Release Plan Approval also completes before the Phase Gate evaluates)
- Narrative Memory and Decision Trace generated and stored

Lens-conditional:
- **Default flow:** `intent_statement` schema-valid; Invariant Check passed.
- **Product-lens flow:** `product_description_handoff` schema-valid; shape/coverage invariants passed (personas, journeys, domains, entities, workflows, integrations, quality attributes all within expected ranges; all foreign-key-like references — `entity.businessDomainId`, `phasingStrategy.journeyIds` — resolve to real items in the same handoff). Derived `intent_statement` also emitted for Phase 2–9 compatibility. An approved `release_plan` (`approved: true`) exists and `workflow_runs.active_release_plan_record_id` points to it; every accepted journey appears in exactly one Release's `traces_to_journeys` or is captured in a Backlog bucket.

*If Prior Decision Overrides reference Phase-Gate-Certified Interface Contracts, API Definitions, or Data Models: Phase 0.5 executes before Phase 2.*

---

### Phase 2 — Requirements Definition

**Purpose:** Derive complete, traceable Functional Requirements and Non-Functional Requirements from the Intent Statement (and, under the product lens, the full Product Description Handoff).

**Entry Criterion:** Phase 1 Phase Gate passed (and Phase 0.5 if triggered). `intent_statement`, `compliance_context` available. Under product lens, `product_description_handoff` is also available and consumed directly. Vocabulary Collision Check re-run.

**Lens-Conditional Input Consumption (wave 5):** Phase 2 detects the presence of a `product_description_handoff` record in the governed stream. When present (product-lens runs), the FR and NFR bloom templates resolve to lens-tagged `lens: product` variants that consume the handoff's rich sections (journeys, entities, workflows, V&V requirements, compliance extracted items, technical constraints as context, canonical vocabulary). When absent (default lens), Phase 2 continues to read only `intent_statement` using the existing templates. The invariant that downstream phases do NOT scan source documents directly is preserved — Phase 2 always reads the governed stream.

**Traceability Spine (wave 5):** Under the product lens every `UserStory` and every `NonFunctionalRequirement` MUST carry a `traces_to: string[]` array referencing handoff item ids:
- `UJ-*` (user journeys), `ENT-*` (entities), `WF-*` (workflows), `COMP-*` (compliance items), `VOC-*` (canonical vocabulary), `Q-*` (open questions) for FRs.
- `VV-*` (V&V requirements), `QA-#` (indexed qualityAttribute), `TECH-*` (technical constraints), `COMP-*`, `UJ-*` for NFRs.

This completes the traceability chain `source_ref (1.0*) → handoff_item (1.6) → requirement (2.1/2.2) → [future: component (4) → test_result (9)]` that Phase 8 Evaluation walks for drift detection. The harness invariant `validateRequirementsProductTraceability` rejects FRs/NFRs with empty or unknown `traces_to`; `validateJourneyCoverageByFRs` warns when an accepted journey has no FR tracing to it.

#### Sub-Phase 2.1 — Functional Requirements Bloom *(Wave 8 — three-pass)*

Phase 2.1 under Wave 8 is split into three internal passes (skeleton → enrichment → verifier) to fit small-model attention budgets while preserving correctness. The driver lives at [src/lib/orchestrator/phases/phase2/frBloomThreePass.ts](src/lib/orchestrator/phases/phase2/frBloomThreePass.ts).

**Sub-Phase 2.1 — Pass 1 (Skeleton Bloom)**
- **[JC:Agent Role]:** Requirements Agent
- **Context Payload stdin:** Active constraints; `product_vision`; `intent_statement_summary`; accepted `userJourneys` (with steps + acceptance criteria); accepted `entityProposals`; accepted `workflowProposals`; `complianceExtractedItems`; `canonicalVocabulary`; `openQuestions`; `detail_file_path`.
- **Action:** Narrow output contract — produce `user_stories[]` where each entry carries `{id, role, action, outcome, priority, traces_to[]}` plus exactly ONE seed `acceptance_criterion` (the most essential measurable condition; Pass 2 expands the rest). MUST-coverage contract: every accepted user journey traces to ≥1 FR OR appears in `unreached_journeys[]` with a reason. Non-transactional journeys (governance, review, audit, read-only, lifecycle) are FIRST-CLASS — the prompt explicitly counteracts the small-model bias toward `create/submit/update` actions.
- **Output (returned in-memory; not yet persisted as `functional_requirements` artifact):** `{user_stories[], unreached_journeys[]}`.

**Sub-Phase 2.1 — Self-Heal Filter (deterministic, Wave 8)**
- **Action:** Drops any `traces_to` id that doesn't resolve to an accepted upstream artifact (UJ/ENT/WF/COMP/VOC/OPEN/Q). Single aggregated WARN log (`{count, sample[]}`) so drift is observable without flooding. Unknown id prefixes and dangling refs propagate to the Pass-3 verifier as blocking gaps.

**Sub-Phase 2.1b — Pass 2 (AC Enrichment)**
- **[JC:Agent Role]:** Requirements Agent (per-FR sequential calls).
- **Action:** For each skeleton produced by Pass 1, render the `02_1b_functional_requirements_ac_enrichment` template with the FR skeleton + the upstream context it traces to (resolved journeys with their steps + their own acceptance criteria, traced entities, traced workflows, traced compliance items, canonical vocabulary). The model echoes all skeleton fields unchanged and produces 3–7 measurable acceptance criteria per FR. Echo-unchanged contract is enforced by the prompt; AC discipline forbids invented thresholds not grounded in upstream artifacts.
- **Semantic-Aware Retry (Wave 8):** If the parsed result returns the bare skeleton (parser fallback when the LLM output lacks `acceptance_criteria` expansion), the call retries up to 3 times. Sampling variance typically rescues content-quality failures distinct from transport-level failures. After 3 attempts, the FR is kept as skeleton (single seed AC) and the Pass-3 verifier will surface it as a `traces_to_non_empty` advisory or `ac_presence` blocking gap depending on what content remained.
- **Output (returned in-memory):** Enriched `user_stories[]` with full `acceptance_criteria[]` per FR.

**Sub-Phase 2.1c — Pass 3 (Coverage Verifier, deterministic)**
- **[JC:Agent Role]:** Orchestrator (deterministic — pure function, no LLM call).
- **Action:** Runs `verifyFrCoverage` in [src/lib/orchestrator/phases/phase2/verifyFrCoverage.ts](src/lib/orchestrator/phases/phase2/verifyFrCoverage.ts). Emits `coverage_gap` records with `sub_phase_id: '2.1c'`. Blocking severity halts Phase 2 with a structured error citing the gap-record ids; advisory severity logs and proceeds.
- **Predicates checked:**
  - **`fr_id_uniqueness`** (blocking) — FR ids unique within `user_stories[]`.
  - **`ac_presence`** (blocking) — every FR carries ≥1 AC with non-empty `measurable_condition`.
  - **`journey_fr_coverage`** (blocking) — every accepted journey is traced by ≥1 FR or appears in `unreached_journeys[]`.
  - **`unreached_journeys_integrity`** (blocking) — `unreached_journeys[]` entries reference accepted journeys with non-empty reasons.
  - **`traces_to_unknown_prefix`** / **`traces_to_dangling`** (blocking) — every `traces_to` id uses a known prefix and resolves to an accepted upstream artifact.
  - **`traces_to_non_empty`** (advisory) — every FR carries ≥1 `traces_to` reference.

**Output Artifact (after Pass 3 passes):** `artifact_produced[kind=functional_requirements]` — `user_stories[]` with `traces_to[]` and full `acceptance_criteria[]`. Depth-0 `requirement_decomposition_node` records are then written for each root FR, seeding Sub-Phase 2.1a.

#### Sub-Phase 2.1a — Recursive Functional Requirements Decomposition *(product lens, Wave 6)*

- **[JC:Agent Role]:** Requirements Agent
- **Entry Criterion:** `functional_requirements` bloom output available; depth-0 `requirement_decomposition_node` records written for each root FR User Story (each carries the root's `release_id` + `release_ordinal` resolved via `traces_to` → journey → Release; unmatched roots land in Backlog).
- **Goal:** Decompose each root FR into a tree of atomic, testable leaves via a saturation loop, surfacing scope commitments to the human at depth 2 and freezing branches that hit atomic-leaf criteria.

**Classify-First Branching (Wave 8, schema `2.0`):** Before producing children, the decomposer prompt asks for `parent_branch_classification: "atomic_leaf" | "decomposable" | "invalid_parent"`. Only the rules of the chosen branch then apply. This elevates the atomic-leaf decision from a buried rule to a first-class branch — small models more reliably terminate branches that don't need further decomposition, reducing fanout noise and saturation runtime. The output schema is backward-compatible: the new `parent_branch_classification` field is added at the top level alongside `parent_tier_assessment`, `children[]`, and `surfaced_assumptions[]`. Same restructure applies to Sub-Phase 2.2a.

**Tier model (A / B / C / D)** — the decomposer assigns one tier per emitted child:

| Tier | Meaning | Orchestrator routing |
|---|---|---|
| **A** | Functional sub-area — more decomposition required | Queued for next-pass decomposition (hint = A). |
| **B** | Scope commitment — materially bounded scope that the human must endorse | Accumulated in the depth-2 pending-gate batch per parent; presented as a `decision_bundle_presented` mirror; accept → re-queue with hint = B; reject → `writePrunedSupersession` emits `status: 'pruned'`. |
| **C** | Implementation-level commitment, pending one more pass to become atomic | Queued for decomposition (hint = C). |
| **D** | Atomic leaf | Written with `status: 'atomic'` immediately; never re-queued. |

**Safety rails (config.decomposition):**
- `depth_cap` (default 10) — hard ceiling on tree depth. On trip: `writeDeferredSupersession` with `pruning_reason: 'depth_cap_reached'`.
- `budget_cap` (default 500) — **per-root** limit on LLM decomposer calls. Counters are in-memory-only within a saturation-loop invocation and do NOT persist across resume sessions (resumes get a fresh per-root budget). On trip: remaining queue entries for that root become `status: 'deferred'` with `pruning_reason: 'budget_cap_reached'`.
- `fanout_cap` (default 8) — max children emitted per parent per pass. Excess children dropped with a warning log.

**Termination:** Assumption saturation — a pass where `semantic_delta === 0 && queue.length === 0` exits cleanly with pipeline `termination_reason: 'fixed_point'`. Cap trips write `termination_reason: 'budget_cap'` or `'depth_cap'`. Healthy runs should reach fixed-point naturally; cap trips are signals to investigate decomposer bloat or raise the cap per-workspace via `config.json`.

**Assumption dedup (flag-but-don't-merge):** Each pass's newly-surfaced assumptions are batch-embedded (ollama `qwen3-embedding:8b` by default) and scored against prior-pass embeddings. Cosine similarity ≥ 0.92 flags the new assumption with `duplicate_of` + `duplicate_similarity`; it's NEVER deleted — the flag lets `semantic_delta` exclude duplicates from the saturation gate while preserving the audit trail. Embedding failures degrade cleanly (dedup skipped for that pass; raw `delta_from_previous_pass` is the fallback signal).

**Scoped assumption injection:** Each decomposer call sees only assumptions surfaced at the current node's ancestor chain (plus global / seed assumptions with no `surfaced_at_node`). Sibling-branch assumptions are excluded to bound prompt size and reduce cross-branch contamination that drives duplicate growth.

**Step 4b — Tier-Downgrade Detection:** When an accepted Tier-B parent is decomposed and produces further Tier-B children (either explicit `parent_tier_assessment.agrees_with_hint: false` from the decomposer, or implicit when this pass's `pendingGateByParent` for the parent is non-empty), the orchestrator writes a `status: 'downgraded'` supersession for the parent and prepends a "scope expansion" context note to the follow-up gate so the human can tell it apart from the original gate.

**Step 4c — AC-Shape Audit:** For clean post-gate decompositions (Tier-B parent produced only Tier-C/D children, no 4b signal), an optional `reasoning_review_on_tier_c` Reasoning Review call audits whether the children's ACs are verification-shaped or policy-shaped. Policy-shaped ACs indicate residual scope commitments hiding as implementation. Advisory only — writes a `reasoning_review_record[kind=tier_c_ac_shape_audit]`; no automatic tree changes. Off by default (one LLM API call per post-gate pass).

**Release propagation:** Every child write inherits `release_id` + `release_ordinal` from its parent's `QueueEntry`. Supersession records (pruned / deferred / downgraded) preserve the release assignment from the prior revision (design doc Q2: preserve). Subtree-level release reassignment is a v2 feature exposed through a `ReleasePlanCard` surface; v1 enforces at-write-time inheritance only.

**Output Artifacts (per pass):**
- `requirement_decomposition_node` records for each child emitted (initial status = `pending` for A/B/C, `atomic` for D).
- `requirement_decomposition_pipeline` container record — one per root_kind per run; updated incrementally through the saturation loop via `supersedByRollback` so the latest version always reflects current pass state.
- `assumption_set_snapshot` — one per pass carrying full cumulative `assumptions[]`, `delta_from_previous_pass`, and `semantic_delta`.
- `decision_bundle_presented` — one per parent that accumulated Tier-B children this pass (the depth-2 scope-commitment mirror gate).
- `reasoning_review_record[kind=tier_c_ac_shape_audit]` — optional, when Step 4c fires.
- Per-kind telemetry on `workflow_runs`: `decomposition_fr_calls_used`, `decomposition_nfr_calls_used` (aggregate of per-root counters at loop end), `decomposition_budget_calls_used` (sum), `decomposition_max_depth_reached` (max across both kinds).

#### Sub-Phase 2.2 — Non-Functional Requirements Bloom *(Wave 8 — three-pass)*

Phase 2.2 mirrors the Wave 8 three-pass restructure of Phase 2.1: skeleton → threshold/measurement enrichment → verifier. The driver lives at [src/lib/orchestrator/phases/phase2/nfrBloomThreePass.ts](src/lib/orchestrator/phases/phase2/nfrBloomThreePass.ts).

**Sub-Phase 2.2 — Pass 1 (Skeleton Bloom)**
- **[JC:Agent Role]:** Requirements Agent
- **Context Payload stdin:** Active constraints; `intent_statement_summary`; `functional_requirements_summary`; `qualityAttributes[]` (free-prose NFR seeds); `vvRequirements[]` (structured target + measurement + threshold — primary seed); `technicalConstraints[]` (CONTEXT only — do not re-propose as requirements); `complianceExtractedItems[]`; `detail_file_path`.
- **Action:** Narrow output contract — produce `requirements[]` where each entry carries `{id, category, description, priority, traces_to[], applies_to_requirements[], seed_threshold}`. MUST-coverage contract: every V&V requirement and every material compliance item is the seed of ≥1 NFR OR appears in `unreached_seeds[]` with `absorbed_into` pointing at an NFR id that genuinely covers it. Categories are honoured equitably — small models bias toward `performance`/`security`; the prompt explicitly counteracts and demands category breadth where the upstream artifacts demand it (auditability, observability, durability, accessibility, maintainability). FR-id leakage in `traces_to` (using `US-*` instead of handoff ids) is forbidden — FR linkage belongs in `applies_to_requirements`.
- **Output (returned in-memory):** `{nfrs[], unreached_seeds[]}`.

**Sub-Phase 2.2 — Self-Heal Filter (deterministic, Wave 8)**
- **Action:** Drops any invalid `traces_to` ref (unknown prefix, dangling reference, or `US-*` FR-id leakage) and any `applies_to_requirements` ref that doesn't resolve to an accepted FR id. Single aggregated WARN log.

**Sub-Phase 2.2b — Pass 2 (Threshold Enrichment)**
- **[JC:Agent Role]:** Requirements Agent (per-NFR sequential calls).
- **Action:** For each skeleton produced by Pass 1, render the `02_2b_nonfunctional_requirements_threshold_enrichment` template with the NFR skeleton + the upstream context it traces to (resolved V&V requirements, traced quality attributes by index, traced technical constraints, traced compliance items). The model echoes all skeleton fields unchanged and produces a final `threshold` (the boundary between satisfied and violated, in observable / numerical / categorical terms) plus a `measurement_method` (the instrument / cadence / artifact that produces the signal). The prompt explicitly forbids inventing numeric thresholds that aren't grounded in the traced V&V requirements; categorical thresholds (`"100% of X"`, `"zero Y"`) are preferred over fabricated latency budgets when no upstream number exists.
- **Semantic-Aware Retry (Wave 8):** If the parsed result is missing `threshold` or `measurement_method` (parser fallback), the call retries up to 3 times. After 3 attempts the NFR is kept as skeleton (empty threshold + measurement_method) and the Pass-3 verifier surfaces it as a blocking `nfr_threshold_presence` gap, flagging the affected NFR for human review.
- **Output (returned in-memory):** Enriched `nfrs[]` with full `threshold` + `measurement_method` per NFR.

**Sub-Phase 2.2c — Pass 3 (Coverage Verifier, deterministic)**
- **[JC:Agent Role]:** Orchestrator (deterministic — pure function, no LLM call).
- **Action:** Runs `verifyNfrCoverage` in [src/lib/orchestrator/phases/phase2/verifyNfrCoverage.ts](src/lib/orchestrator/phases/phase2/verifyNfrCoverage.ts). Emits `coverage_gap` records with `sub_phase_id: '2.2c'`. Blocking severity halts Phase 2; advisory logs and proceeds.
- **Predicates checked:**
  - **`nfr_id_uniqueness`** (blocking) — NFR ids unique.
  - **`nfr_threshold_presence`** (blocking) — every NFR has non-empty `threshold` AND `measurement_method`.
  - **`vv_nfr_coverage`** (blocking) — every accepted V&V requirement traced by ≥1 NFR or absorbed via `unreached_seeds[]`.
  - **`compliance_nfr_coverage`** (blocking) — every accepted compliance item traced by ≥1 NFR or absorbed.
  - **`unreached_seeds_integrity`** (blocking) — `unreached_seeds[]` entries reference accepted seeds and absorbing NFR ids that exist.
  - **`nfr_traces_to_unknown_prefix`** / **`nfr_traces_to_dangling`** / **`nfr_traces_to_fr_leakage`** (blocking) — referential integrity of `traces_to[]`; `US-*` FR-ids in `traces_to` are flagged as leakage (belong in `applies_to_requirements`).
  - **`nfr_applies_to_requirements_dangling`** (blocking) — `applies_to_requirements[]` entries reference accepted FR ids.
  - **`nfr_traces_to_non_empty`** (advisory) — every NFR carries ≥1 `traces_to` reference.

**Output Artifact (after Pass 3 passes):** `artifact_produced[kind=non_functional_requirements]` — `requirements[]` with full `threshold`, `measurement_method`, `traces_to[]`, `applies_to_requirements[]`. Depth-0 NFR `requirement_decomposition_node` records are then written, seeding Sub-Phase 2.2a.

#### Sub-Phase 2.2a — Recursive Non-Functional Requirements Decomposition *(product lens, Wave 6)*

Structurally identical to Sub-Phase 2.1a: the same saturation loop, tier model, safety rails, assumption dedup, Step 4b / 4c, and release propagation — parameterized with `config.rootKind = 'nfr'`, `sub_phase_id = '2.2a'`, `templateSubPhase = '02_2a_non_functional_requirements_decomposition'`, and `gateSurfacePrefix = 'nfr-decomp-gate-'`. NFR decomposition nodes carry `root_kind: 'nfr'` for downstream projection (`getFrozenFrLeaves` vs. future `getFrozenNfrLeaves`).

#### Sub-Phase 2.3 — Requirements Mirror and Menu

- **Interaction:** Annotated Mirror. Menus follow Decision Sequencing Protocol. Reasoning Review applied. Domain Compliance Reasoning Review applied for compliance-relevant requirements.

#### Sub-Phase 2.4 — Requirements Consistency Check

- **[JC:Agent Role]:** Consistency Checker Agent
- **Context Payload includes:** Context Packet (pre-populated, `all_runs` scope); `compliance_context`
- **Output Artifact:** `consistency_report`

#### Sub-Phase 2.5 — Requirements Approval with Domain Attestation

- **Interaction:** Mirror of consistency report followed by mandatory attestation step.

**Attestation text presented to human:**
> "By approving this gate, you are confirming that the Functional Requirements and Non-Functional Requirements are not only logically consistent but domain-correct for the following confirmed compliance regimes: [list from compliance_context]. If you have domain expertise concerns about any requirement, this is the point to raise them. Proceeding commits these requirements as the ground truth for all downstream testing and evaluation."

The human's approval is recorded as a `decision_trace` of type `phase_gate_approval` with an additional field: `domain_attestation_confirmed: true`.

**Phase Gate Criteria:**
- All artifacts schema-valid; Invariant Checks passed
- `consistency_report` shows zero critical failures
- All User Stories have at least one Acceptance Criterion with a measurable condition *(Invariant)*
- `domain_attestation_confirmed: true` recorded in Phase Gate Decision Trace
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 3 — System Specification

**Purpose:** Allocate requirements to a defined System Boundary. Specify all External Systems and Interface Contracts. Produce System Requirements.

**Entry Criterion:** Phase 2 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Systems Agent (`all_runs` scope).

#### Sub-Phase 3.1 — System Boundary Definition

- **[JC:Agent Role]:** Systems Agent
- **Context Payload stdin:** Active constraints; `intent_statement` summary; `functional_requirements` summary; `non_functional_requirements` summary
- **Context Payload detail file:** Full Context Packet; full `functional_requirements`; full `non_functional_requirements`
- **Output Artifact:** `system_boundary: {in_scope, out_of_scope, external_systems: [{id, name, purpose, interface_type}]}`

#### Sub-Phase 3.2 — System Requirements Derivation

- **[JC:Agent Role]:** Systems Agent
- **Output Artifact:** `system_requirements: {items: [{id, statement, source_requirement_ids, allocation, priority}]}`

#### Sub-Phase 3.3 — Interface Contract Specification

- **[JC:Agent Role]:** Systems Agent
- **Output Artifact:** `interface_contracts: {contracts: [{id, systems_involved, protocol, data_format, auth_mechanism, error_handling_strategy}]}`

#### Sub-Phase 3.4 — System Specification Mirror and Menu

- **Interaction:** Annotated Mirror. Menus resolve boundary decisions and External System choices. Reasoning Review applied. Domain Compliance Reasoning Review applied.

#### Sub-Phase 3.5 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)
- **Interaction:** Human approves or triggers re-bloom of flagged items.

**Phase Gate Criteria:**
- Every Functional Requirement maps to at least one System Requirement *(Invariant)*
- Every External System has at least one Interface Contract *(Invariant)*
- Every Interface Contract specifies at least one error response *(Invariant)*
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 4 — Architecture Definition

**Purpose:** Decompose the system into Components with defined responsibilities, Dependencies, and Architectural Decisions. All Component Responsibilities must pass implementability check.

**Entry Criterion:** Phase 3 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Architecture Agent (`all_runs` scope).

#### Sub-Phase 4.1 — Software Domain Identification

- **[JC:Agent Role]:** Architecture Agent
- **Context Payload stdin:** Active constraints; `system_boundary` summary; `system_requirements` summary
- **Context Payload detail file:** Full Context Packet; full `system_requirements`; full `interface_contracts`
- **Output Artifact:** `software_domains: {domains: [{id, name, ubiquitous_language: [{term, definition}], system_requirement_ids}]}`

#### Sub-Phase 4.2 — Component Decomposition

- **[JC:Agent Role]:** Architecture Agent
- **Output Artifact:** `component_model: {components: [{id, name, domain_id, responsibilities: [{id, statement}], dependencies: [{target_component_id, dependency_type}]}]}`

#### Sub-Phase 4.3 — Architectural Decision Capture

- **[JC:Agent Role]:** Architecture Agent
- **Output Artifact:** `architectural_decisions: {adrs: [{id, title, status, context, decision, alternatives, rationale, consequences}]}`

#### Sub-Phase 4.4 — Architecture Mirror and Menu

- **Interaction:** Annotated Mirror with ADRs inline. Menus resolve key architectural choices. Reasoning Review applied — especially for Dependency cycles and responsibility overlaps. `component_model` Invariant Check includes: no Component Responsibility statement contains conjunctions connecting distinct concerns.

**Implementability Review:** The Reasoning Review of the `component_model` artifact includes a specific check for `implementability_violation` — any Component Responsibility that is scoped too broadly to be implemented in a single Executor Agent session. If flagged, the Mirror presents the flagged responsibilities with a Menu: "(A) Return to Phase 4.2 to decompose this Component further, (B) Accept as-is and rely on the Implementation Planner to manage complexity."

#### Sub-Phase 4.5 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)

**Phase Gate Criteria:**
- Every System Requirement allocated to at least one Component *(Invariant)*
- No circular Dependencies without explicit ADR justification *(Invariant)*
- Every ADR has a human-confirmed decision
- No `implementability_violation` flaws unresolved
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 5 — Technical Specification

**Purpose:** Produce implementable Technical Specifications for each Component.

**Entry Criterion:** Phase 4 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Technical Spec Agent (`all_runs` scope).

#### Sub-Phase 5.1 — Data Model Specification

- **[JC:Agent Role]:** Technical Spec Agent
- **Context Payload stdin:** Active constraints; `component_model` summary; relevant `software_domains` summary
- **Context Payload detail file:** Full Context Packet; full `component_model`; full `architectural_decisions`
- **Output Artifact:** `data_models: {models: [{component_id, entities: [{name, fields: [{name, type, constraints}], relationships}]}]}`

#### Sub-Phase 5.2 — API Definition

- **[JC:Agent Role]:** Technical Spec Agent
- **Output Artifact:** `api_definitions: {definitions: [{component_id, endpoints: [{path, method, inputs, outputs, error_codes}]}]}`

#### Sub-Phase 5.3 — Error Handling Strategy Specification

- **[JC:Agent Role]:** Technical Spec Agent
- **Output Artifact:** `error_handling_strategies: {strategies: [{component_id, error_types, detection, response, surfacing}]}`

#### Sub-Phase 5.4 — Configuration Parameter Specification

- **[JC:Agent Role]:** Technical Spec Agent
- **Output Artifact:** `configuration_parameters: {params: [{component_id, name, type, default, required, description}]}`

#### Sub-Phase 5.5 — Technical Specification Mirror and Menu

- **Interaction:** Annotated Mirror. Menus resolve technology choices, library selections, patterns. Reasoning Review applied. Domain Compliance Reasoning Review applied where `compliance_context` is relevant.

#### Sub-Phase 5.6 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)

**Phase Gate Criteria:**
- Every Component has a complete Technical Specification *(Invariant: all four artifact types present)*
- All API Definitions consistent with Interface Contracts from Phase 3
- All Data Models consistent with Component Responsibilities from Phase 4
- Every endpoint has an explicit authentication requirement *(Invariant on `api_definitions`)*
- Reasoning Review and Domain Compliance Reasoning Review clean
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 6 — Implementation Planning

**Purpose:** Decompose Technical Specifications into an ordered, atomic Implementation Plan. Add Refactoring Tasks from Phase 0.5 if applicable. Bound task complexity.

**Entry Criterion:** Phase 5 Phase Gate passed. `refactoring_scope` artifact available if Phase 0.5 was triggered.

#### Sub-Phase 6.1 — Implementation Task Decomposition

- **[JC:Agent Role]:** Implementation Planner Agent
- **Decomposition Rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct implementation steps, each step is its own task with explicit `dependency_task_ids` linking them.
- **Complexity Flagging:** Any task rated `estimated_complexity: high` must include a `complexity_flag` field with explanation. The Orchestrator surfaces all complexity-flagged tasks in the Phase 6 Mirror with a Menu per flagged task: "(A) Return to Phase 4 to refine this Component's decomposition via Dependency Closure Rollback, (B) Accept as-is — Executor Agent will handle complexity, (C) Manually split this task here."
- **Refactoring Tasks:** If `refactoring_scope` artifact exists, Refactoring Tasks from Phase 0.5 are added to the Implementation Plan. See Section 8.7 for Refactoring Task schema including idempotency fields.
- **Output Artifact:** `implementation_plan`

#### Sub-Phase 6.2 — Implementation Plan Mirror and Menu

- **Interaction:** Mirror of sequenced task graph. Menus resolve sequencing conflicts and complexity concerns. Reasoning Review applied.

#### Sub-Phase 6.3 — Approval

- **Interaction:** Human approves `implementation_plan`.

**Phase Gate Criteria:**
- Every Technical Specification covered by at least one Implementation Task *(Invariant)*
- Every Implementation Task has a non-empty `completion_criteria` *(Invariant)*
- All Refactoring Tasks from `refactoring_scope` included if Phase 0.5 was triggered
- No circular task Dependencies *(Invariant)*
- All complexity-flagged tasks have human resolution recorded
- All tasks have assigned Backing Tool
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 7 — Test Planning

**Purpose:** Produce a complete Test Plan with Test Case specifications traced to every Acceptance Criterion. Test Cases are specifications — not code. Executor Agent implements them as code during Phase 9.

**Entry Criterion:** Phase 6 Phase Gate passed.

#### Sub-Phase 7.1 — Test Case Generation

- **[JC:Agent Role]:** Test Design Agent
- **Context Payload stdin:** Active constraints; `functional_requirements` summary; `implementation_plan` summary
- **Context Payload detail file:** Full Context Packet; full `functional_requirements`; full `non_functional_requirements`; full `component_model`
- **Action:** Generates structured Test Case specifications for every Acceptance Criterion. Categorizes as Unit, Integration, or End-to-End. Assigns to Test Suites per Component. Covers functional behavior only — NFR coverage is Phase 8's responsibility.
- **Output Artifact:** `test_plan` — see Section 8.7 for full Test Case schema

#### Sub-Phase 7.2 — Test Coverage Analysis

- **[JC:Agent Role]:** Consistency Checker Agent
- **Action:** Verifies every Acceptance Criterion has at least one Test Case. Identifies coverage gaps.
- **Output Artifact:** `test_coverage_report: {gaps: [{acceptance_criterion_id, reason}], coverage_percentage}`

#### Sub-Phase 7.3 — Test Plan Mirror and Menu

- **Interaction:** Annotated Mirror. Reasoning Review applied.

#### Sub-Phase 7.4 — Approval

- **Interaction:** Human approves `test_plan`.

**Phase Gate Criteria:**
- Every Acceptance Criterion covered by at least one Test Case *(Invariant)*
- Every Test Case has at least one `precondition` specified *(Invariant)*
- `test_coverage_report` shows zero unresolved gaps
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 8 — Evaluation Planning

**Purpose:** Define how quality attributes per Non-Functional Requirements will be assessed, using tooling that the Test Plan does not cover.

**Entry Criterion:** Phase 7 Phase Gate passed. Eval Design Agent receives `test_plan` as read-only input to ensure no duplication. `compliance_context` injected into Eval Design Agent's context to ensure compliance-related NFRs have evaluation criteria.

#### Sub-Phase 8.1 — Functional Evaluation Design

- **[JC:Agent Role]:** Eval Design Agent
- **Action:** Designs Functional Evaluation criteria for Functional Requirements not already covered by the Test Plan.
- **Output Artifact:** `functional_evaluation_plan: {criteria: [{functional_requirement_id, evaluation_method, success_condition}]}`

#### Sub-Phase 8.2 — Quality Evaluation Design

- **[JC:Agent Role]:** Eval Design Agent
- **Action:** Designs Quality Evaluation criteria mapped to Non-Functional Requirements. Specifies tooling per criterion using tool inventory from `janumicode.config.json` supplemented by reasoning from Technical Specification stack. Includes `fallback_if_tool_unavailable` per criterion.
- **Output Artifact:** `quality_evaluation_plan: {criteria: [{nfr_id, category, evaluation_tool, threshold, measurement_method, fallback_if_tool_unavailable}]}`

#### Sub-Phase 8.3 — Reasoning Evaluation Design *(AI subsystems only)*

- **[JC:Agent Role]:** Eval Design Agent
- **Action:** Designs red-team scenarios and meta-eval checks for any AI components in the product being built.
- **Output Artifact:** `reasoning_evaluation_plan: {scenarios: [{id, description, pass_criteria}]}`

#### Sub-Phase 8.4 — Evaluation Plan Mirror and Menu

- **Interaction:** Annotated Mirror. Reasoning Review applied. Domain Compliance Reasoning Review applied. Meta-eval check that evaluation criteria map to stated requirements.

#### Sub-Phase 8.5 — Approval

- **Interaction:** Human approves evaluation plans.

**Phase Gate Criteria:**
- Every Non-Functional Requirement has at least one Quality Evaluation criterion with specified tooling *(Invariant)*
- Every Functional Requirement has at least one Functional Evaluation criterion *(Invariant)*
- No evaluation criterion duplicates a Test Case from Phase 7
- Compliance-related NFRs from `compliance_context` have evaluation criteria
- Reasoning Review and Domain Compliance Reasoning Review clean
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 9 — Execution

**Purpose:** Execute the Implementation Plan and Test Plan. Capture full Execution Traces for all Agent Invocations. Reasoning Review operates on Execution Traces.

**Entry Criterion:** Phases 6, 7, and 8 all Phase Gate passed.

#### Sub-Phase 9.1 — Implementation Task Execution

- **[JC:Agent Role]:** Executor Agent (per task, per assigned Backing Tool)
- **Execution Trace capture:** The Governed Stream captures the complete Execution Trace for each Executor Agent invocation — all reasoning steps, all self-corrections, all tool call invocations (tool name + parameters), all tool results (stored in Governed Stream; excluded from Reasoning Review trace selection), and the final output.
- **Action:** Implements Test Cases as runnable code from Test Case specifications before application code where possible. Executes Implementation Tasks in dependency order.
- **Invariant Check:** Before Reasoning Review — checks `completion_criteria` mechanically against the produced output.
- **Reasoning Review (Execution Trace):** Applied after each task completion. Receives Trace Selection (see Section 8.1). Checks `implementation_divergence` against governing ADR. Checks all flaw types including `completeness_shortcut` against `completion_criteria`.
- **Verification Ensemble:** Applied for `implementation_divergence_check` trigger — primary and secondary model providers both review; disagreement escalates to human.
- **Quarantine:** If Reasoning Review returns `severity: high` flaw, the task output receives `quarantined: true` flag in the Governed Stream. The retry Context Payload receives flaw findings only — not the quarantined output.
- **Loop Detection Monitor:** Active throughout. Enhanced with tool call sequence analysis — identical tool invocations (same tool + parameters) within one invocation → CONVERGING; alternating between same two tools ≥3 times → STALLED.
- **Refactoring Task execution:** Checks `expected_pre_state_hash` before modifying. Idempotency protocol per Section 8.7.
- **Output:** Implementation Artifacts; full Execution Traces in Governed Stream

#### Sub-Phase 9.2 — Test Execution

- **[JC:Agent Role]:** Executor Agent (test runner configuration)
- **Action:** Executes all Test Suites. Captures Test Results.
- **Failed test routing:** Orchestrator invokes focused Reasoning Review on the failing test against implementation evidence. If flaw is in Test Case specification: re-invoke Test Design Agent for that Test Case only. If flaw is in implementation: re-invoke Executor Agent for the relevant Implementation Task. If ambiguous: escalate to human.
- **Output Artifact:** `test_results: {suite_results: [{suite_id, test_results: [{test_case_id, status, output, timestamp}]}]}`

**Test Execution Ordering and Failure Strategy:**

**Execution order:** Unit Tests → Integration Tests → End-to-End Tests. Within each type, Test Suites execute in Component dependency order.

**Failure strategy:**
- Unit Test failure: run remaining Unit Tests for the same Component; skip Integration Tests for that Component; continue Integration Tests for other Components
- Integration Test failure: run remaining Integration Tests for other Component pairs; skip End-to-End Tests that depend on the failing pair
- End-to-End Test failure: continue remaining End-to-End Tests
- All failures reported together in Sub-Phase 9.4

**Test runner command:** Specified in the `test_plan` artifact at Test Suite level:

```json
{
  "suite_id": "...",
  "component_id": "...",
  "test_type": "unit",
  "runner_command": "npx jest --testPathPattern=src/auth",
  "test_cases": [...]
}
```

#### Sub-Phase 9.3 — Evaluation Execution

- **[JC:Agent Role]:** Eval Execution Agent
- **Action:** Runs all tooling specified in Evaluation Plans. Maps outputs to criteria. Captures results. See Section 18 for Eval Execution Agent cross-cutting specification.
- **Output Artifact:** `evaluation_results: {functional: [...], quality: [...], reasoning: [...]}`

#### Sub-Phase 9.4 — Failure Handling

- **Interaction:** On any Test Result failure or Evaluation failure: escalate to human with specific failure context, evidence, and options — retry targeted re-execution, rollback to prior Phase, or accept with documented exception.
- **Tool Result Misinterpretation suspected:** If a test failure cannot be attributed to a Reasoning Flaw in the Execution Trace, escalate to Unsticking Agent with full Governed Stream access including tool results. The Unsticking Agent may diagnose Tool Result Misinterpretation and recommend targeted re-execution with explicit correction context.

#### Sub-Phase 9.5 — Completion Approval

- **Interaction:** Full Mirror of `test_results` and `evaluation_results`. Human approves Workflow Run as complete.

**Phase Gate Criteria:**
- All Implementation Tasks executed; Invariant Checks and Reasoning Reviews clean (including `implementation_divergence`)
- No quarantined records in governing position without human override
- All Refactoring Tasks completed with idempotency verification
- All Test Cases pass or failures explicitly accepted
- All Evaluation criteria pass or exceptions documented
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 10 — Commit and Deployment Initiation

**Purpose:** Finalize all Implementation Artifacts, commit to source repository, and close the Workflow Run.

**Entry Criterion:** Phase 9 Phase Gate passed. Orchestrator pre-populates Context Packet for Consistency Checker (`all_runs` scope).

#### Sub-Phase 10.1 — Pre-Commit Consistency Check

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)
- **Action:** Final cross-artifact consistency check across all Phase artifacts in the current Workflow Run. Verifies Implementation Artifacts are traceable to every Acceptance Criterion and that no Architectural Decision has been violated. Verifies consistency with `prior_decision_summary` from Phase 0 (excluding items explicitly superseded by `prior_decision_override` Decision Traces).
- **Output Artifact:** `pre_commit_consistency_report`
- **Scope note:** Cross-run consistency is current-run-only at this stage because it was continuously enforced throughout upstream phases via Context Packets. The `prior_decision_summary` is the contract representing everything from prior runs that this run agreed to respect.

#### Sub-Phase 10.2 — Commit Preparation

- **[JC:Agent Role]:** Executor Agent (git tooling)
- **Action:** Stages all Implementation Artifacts. Generates commit message from Intent Statement and Decision Trace summary. Commits to configured branch.
- **Output Artifact:** `commit_record: {commit_sha, branch, commit_message, artifact_ids_committed}`

#### Sub-Phase 10.3 — Workflow Run Closure

- **[JC:Agent Role]:** Orchestrator
- **Action:** Marks Workflow Run as complete. Generates final Workflow Run Summary. Updates Decision History. Makes all artifacts available for future brownfield Workflow Runs.
- **Output Artifact:** `workflow_run_summary: {run_id, intent_statement_summary, key_decisions, artifacts_produced, janumicode_version_sha, completion_timestamp}`

**Phase Gate Criteria:**
- `pre_commit_consistency_report` shows zero unresolved issues; Verification Ensemble agreement
- All `cross_run_modification` records produced for Refactoring Tasks
- `commit_record` valid (SHA confirmed)
- Workflow Run status set to `completed`
- Human approved
- Final Narrative Memory and Decision Trace generated and stored

**File System Mapping:** The Executor Agent produces a `file_system_write_record` Governed Stream Record after each file write:

```json
{
  "record_type": "file_system_write_record",
  "schema_version": "1.0",
  "agent_invocation_id": "...",
  "implementation_task_id": "...",
  "workflow_run_id": "...",
  "operation": "create | modify | delete",
  "file_path": "src/auth/handler.ts",
  "file_sha256_before": "null if create",
  "file_sha256_after": "sha256 of written content",
  "produced_at": "..."
}
```

**Rollback Reversion:** On Dependency Closure Rollback of Phase 9 artifacts, the Orchestrator:

1. Queries `file_system_write_record` for all writes in the invalidated invocations
2. Presents the file list in the rollback confirmation: "Rolling back will also revert the following file system changes: [list]"
3. On confirmation, the Executor Agent restores each file to `file_sha256_before` state via `git checkout HEAD -- <path>` (pre-existing files) or deletes (newly created files)
4. Produces a `file_system_revert_record` per file reverted

Files modified outside `write_directory_paths` (unexpected writes) are flagged by the `InvariantChecker` post-task and presented as a warning in the Phase Gate Mirror.

---

## 5. Governed Stream

The Governed Stream is the single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. There is no separate "Artifact Store." Artifacts are Governed Stream Records whose `record_type` designates them as schema-validated phase outputs. The Governed Stream is the system of record for everything — lossless.

### 5.1 Record Structure

Every Governed Stream Record carries these universal fields:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `record_type` | string | Canonical record type identifier |
| `schema_version` | string | Version of JSON Schema this record was validated against |
| `workflow_run_id` | UUID | The Workflow Run that produced this record |
| `phase_id` | string | The Phase in which this record was produced |
| `sub_phase_id` | string | The Sub-Phase in which this record was produced |
| `produced_by_agent_role` | string | The Agent Role that produced this record |
| `produced_by_record_id` | UUID | Pointer to the Agent Invocation record that produced this record |
| `produced_at` | ISO 8601 | Timestamp of production |
| `effective_at` | ISO 8601 | When the underlying event occurred (may differ from `produced_at`) |
| `janumicode_version_sha` | string | JanumiCode git SHA pinned at Workflow Run initiation |
| `authority_level` | integer | 1–7 per taxonomy in Section 3.1 — assigned at write time |
| `derived_from_system_proposal` | boolean | True if this record or any ancestor is System-Proposed Content not yet explicitly approved |
| `is_current_version` | boolean | False if superseded by rollback within a run |
| `superseded_by_id` | UUID / null | Rollback supersession pointer |
| `superseded_at` | ISO 8601 / null | When this record was semantically superseded |
| `superseded_by_record_id` | UUID / null | Semantic supersession pointer |
| `source_workflow_run_id` | UUID | The Workflow Run that originally produced this record |
| `derived_from_record_ids` | UUID[] | Records from which this record was derived |
| `quarantined` | boolean | True if associated Reasoning Review found `severity: high` flaw — excluded from retry Context Payloads; available in Governed Stream for audit and Unsticking Agent |
| `sanitized` | boolean | True if tool result content was sanitized before storage |
| `sanitized_fields` | string[] | List of fields that were sanitized |
| `content` | JSON object | Type-specific payload, validated against `schema_version` |

### 5.2 Rollback vs. Semantic Supersession

These are distinct mechanisms that must not be conflated:

| | Rollback Supersession | Semantic Supersession |
|---|---|---|
| **Trigger** | Human authorizes rollback to prior phase | Human explicitly overrides a prior governing decision |
| **Field** | `superseded_by_id` | `superseded_by_record_id` |
| **Scope** | Within a Workflow Run | Across Workflow Runs |
| **Record fate** | `is_current_version: false` | Record remains current; `superseded_at` populated |
| **Governing mechanism** | Newer record in same run is canonical | `supersedes` Memory Edge created |
| **Human involvement** | Rollback authorization recorded | `prior_decision_override` Decision Trace recorded |

#### 5.2.1 Decomposition Node Supersession Invariant *(Wave 6)*

In addition to rollback and semantic supersession, Wave 6 introduces a third, record-type-specific supersession mechanism for `requirement_decomposition_node` records: **logical-identity supersession**.

The motivation is that a single logical Decomposition Node can be revised several times during a saturation run without constituting a phase rollback — e.g. a `pending` node written at pass 2 gets flipped to `downgraded` by Step 4b at pass 3, and possibly to `deferred` by a cap trip later. Each revision writes a NEW governed_stream row to preserve the audit trail, but exactly one row per Logical Node Identity must be `is_current_version: 1` at any time — otherwise downstream consumers (tree walks, gold extractors, markdown exporter) see phantom duplicate nodes.

The invariant is enforced by `supersedeDecompositionNodeByLogicalId(workflow_run_id, logical_node_id, superseding_record_id)` on the governed-stream writer, which runs:

```sql
UPDATE governed_stream
   SET is_current_version = 0, superseded_by_id = ?, superseded_at = ?
 WHERE workflow_run_id = ?
   AND record_type = 'requirement_decomposition_node'
   AND is_current_version = 1
   AND id != ?
   AND json_extract(content, '$.node_id') = ?
```

Every supersession write site in Phase 2.1a / 2.2a calls this helper immediately after writing the new revision:

- `writePrunedSupersession` (human rejected a Tier-B child at the depth-2 gate)
- `writeDeferredSupersession` (depth cap / budget cap / decomposition failure — any cap trip path)
- Step 4b tier-downgrade re-emit (`status: 'downgraded'`)

Initial writes of brand-new logical nodes are no-ops: the query matches zero rows because no prior revision exists for the freshly-minted UUID. The supersession is keyed on `content.node_id` — the Logical Node Identity — not on the governed_stream row id, which is per-revision.

**Invariant (enforced):** For every `(workflow_run_id, content.node_id)` pair in the `requirement_decomposition_node` space, exactly one row has `is_current_version = 1` at any time. Downstream consumers that filter `is_current_version = 1` see exactly one row per logical node.

### 5.3 Dependency Closure Rollback

When the Orchestrator performs a rollback targeting artifact X, it must traverse the `memory_edge` table for all `derives_from` edges originating from X recursively and include all reachable artifacts in the invalidation set. The human is shown the complete invalidation set before confirming.

**Menu presented:**
> "Rolling back [artifact X] will also invalidate the following derived artifacts: [complete list with authority levels]. Confirm full dependency closure rollback?"

Partial rollbacks — invalidating only a named artifact without its dependency closure — are not permitted. Every rollback operates on the full closure.

**Cycle detection:** Before traversing the `memory_edge` table, the `DependencyClosureResolver` runs a cycle detection pass using depth-first search with a visited set. If a cycle is detected in `derives_from` edges (artifact A derives from artifact B which derives from artifact A), the cycle is broken at the edge with the lowest `authority_level`. A `cycle_detected_record` Governed Stream Record is produced identifying the cycle, and the Orchestrator presents it to the human before proceeding with the rollback.

**Cross-run boundary:** Dependency closure does not cross Workflow Run boundaries. The `DependencyClosureResolver` stops traversal at any artifact whose `source_workflow_run_id` differs from the current run's `workflow_run_id`. Prior-run artifacts are never invalidated by rollback — only the `prior_decision_summary` reference to them is affected. If a prior-run artifact is in the closure path, it is listed in the rollback confirmation as "referenced but not invalidated (prior run)."

**Phase Gate invalidation:** When the closure includes artifacts that a Phase Gate certified, the `phase_gates` table entry for that gate is updated: `human_approved` remains `1` (the approval happened and is recorded), but a new field `invalidated_by_rollback_at` is set to the rollback timestamp. The gate is not deleted — it is a historical record. The Orchestrator presents the affected Phase Gates in the rollback confirmation.

**Closure size limit:** Add to `janumicode.config.json` under `workflow`:

```json
"rollback_closure_max_artifacts": 50
```

If the computed closure exceeds this limit, the Orchestrator presents a hard stop: "This rollback would invalidate [N] artifacts — exceeding the configured limit of [max]. Options: (A) Proceed anyway, (B) Cancel rollback, (C) Increase the limit in settings."

### 5.4 source_workflow_run_id vs workflow_run_id

These fields differ when:

- A Refactoring Task in the current run modifies an artifact produced by a prior run: `workflow_run_id` = current run; `source_workflow_run_id` = prior run
- A brownfield `baseline_artifact_set` incorporates ingested prior-run artifacts: `workflow_run_id` = current run; `source_workflow_run_id` = the run that originally produced the artifact

In all other cases they are identical.

---

## 6. Governed Stream Record Taxonomy

Every entry has a canonical `record_type`. Maximum granularity — one record per discrete event. The Governed Stream is lossless — all Agent Invocation content is captured regardless of what any downstream role selects.

### 6.1 Phase and Agent Records

| Record Type | Description |
|---|---|
| `raw_intent_received` | The human's Raw Intent as received, verbatim |
| `agent_invocation` | A single call to a CLI-backed Agent Role. Fields include: `trace_record_ids` — ordered array of all `agent_reasoning_step`, `agent_self_correction`, `tool_call`, and `tool_result` record IDs produced during this invocation |
| `agent_output` | The complete final output of an Agent Invocation |
| `agent_reasoning_step` | A discrete reasoning step in the agent's chain-of-thought, captured as the agent produces it. Included in Trace Selection for Reasoning Review per selection rules. |
| `agent_self_correction` | A point where the agent explicitly reversed or modified a prior reasoning step or action. Always included in Trace Selection — highest-risk reasoning moments. |
| `tool_call` | A tool call made by a CLI-backed agent — captures tool name and parameters (the invocation). Always included in Trace Selection. |
| `tool_result` | The result returned by a tool call — captures full content. Stored in Governed Stream for losslessness, audit, and Unsticking Agent access. **Excluded from Reasoning Review Trace Selection by design** due to context window constraints. Available in full to the Unsticking Agent. |
| `artifact_produced` | Pointer to a schema-validated Artifact |
| `invariant_check_record` | Result of Invariant Library checks on an artifact — lists each invariant, pass/fail, and specific violation details. Runs before Reasoning Review. |
| `invariant_violation_record` | A specific invariant that failed — causes agent retry with violation injected into stdin; no LLM call required |
| `reasoning_review_record` | Reasoning Review LLM API call — Trace Selection used, flaw findings, overall pass |
| `reasoning_review_ensemble_record` | Verification Ensemble result — primary and secondary findings, agreement/disagreement, action taken |
| `domain_compliance_review_record` | Domain Compliance Reasoning Review — compliance regime checked, findings |
| `detail_file_generated` | Record that a Context Payload Detail File was generated — includes path, contents description, invocation_id |

### 6.2 Human Interaction Records

| Record Type | Description |
|---|---|
| `mirror_presented` | The Mirror artifact as presented to the human |
| `menu_presented` | The Menu options as presented to the human |
| `decision_bundle_presented` | A Decision Bundle — multiple independent decisions with system-recommended defaults |
| `decision_trace` | A human's selection. `decision_type` field: `menu_selection`, `mirror_approval`, `mirror_rejection`, `mirror_edit`, `phase_gate_approval`, `rollback_authorization`, `unsticking_escalation_resolution`, `prior_decision_override`, `system_proposal_approval`, `system_proposal_rejection`, `domain_attestation`, `cascade_threshold_decision`, `complexity_flag_resolution`, `verification_ensemble_override`, `quarantine_override` |
| `mirror_approved` | Human approval of a Mirror |
| `mirror_rejected` | Human rejection of a Mirror |
| `mirror_edited` | Human edit of a Mirror — includes original and edited content |
| `phase_gate_evaluation` | Phase Gate evaluation result — includes whether Verification Ensemble was triggered |
| `phase_gate_approved` | Human approval of a Phase Gate — includes `domain_attestation_confirmed` where applicable |
| `phase_gate_rejected` | Human rejection of a Phase Gate |
| `rollback_authorized` | Human authorization of a rollback — includes full dependency closure list |
| `complexity_flag_resolution` | Human resolution of a complexity-flagged Implementation Task |
| `cascade_threshold_decision` | Human decision when refactoring cascade threshold exceeded |
| `technical_debt_record` | Documented known technical debt accepted by human in Phase 0.5 |
| `verification_ensemble_disagreement` | The Verification Ensemble primary and secondary providers disagreed — presented to human for resolution |
| `quarantine_override` | Human explicitly accepts a quarantined output — includes rationale |

### 6.3 Memory Records

| Record Type | Description |
|---|---|
| `narrative_memory` | Compressed structured Phase summary with inline citations |
| `decision_trace_summary` | All human decisions in a completed Phase |
| `retrieval_brief_record` | Brief sent to Deep Memory Research Agent |
| `context_packet` | Structured output of Deep Memory Research Agent |
| `memory_edge_proposed` | Relationship edge proposed by agent during Ingestion Pipeline Stage III |
| `memory_edge_confirmed` | Relationship edge confirmed by human or elevated |
| `intent_quality_report` | Output of Sub-Phase 1.0 Intent Quality Check |
| `cross_run_impact_report` | Output of Phase 0.5.1 Impact Enumeration |
| `cross_run_modification` | Documents current run modified a prior run's Implementation Artifact |

### 6.4 Client Liaison Records

| Record Type | Description |
|---|---|
| `open_query_received` | A human-initiated Open Query |
| `query_classification_record` | Client Liaison Agent's classification of an Open Query |
| `client_liaison_response` | Client Liaison Agent's synthesized response with Provenance Statements |
| `consistency_challenge_escalation` | Client Liaison Agent escalation of a Type 2 query to the Orchestrator |

### 6.5 Unsticking Records

| Record Type | Description |
|---|---|
| `loop_detection_record` | Loop Detection Monitor assessment — retry count, flaw trend, tool call sequence analysis result, Loop Status |
| `unsticking_session_open` | Trigger record for an Unsticking Agent session — includes whether Tool Result Misinterpretation is suspected |
| `unsticking_hypothesis` | A hypothesis formed by the Unsticking Agent |
| `unsticking_socratic_turn` | A question-and-response turn in Socratic elicitation |
| `unsticking_specialist_task` | Focused diagnostic task sent to Specialist Agent |
| `unsticking_specialist_response` | Specialist Agent's diagnostic output |
| `unsticking_tool_result_review` | Record of Unsticking Agent reviewing tool results from the Governed Stream to diagnose Tool Result Misinterpretation — includes which tool results were examined |
| `unsticking_resolution` | Resolution that unblocked the stuck agent — indexed for future problem class retrieval |
| `unsticking_escalation` | Human escalation card when Unsticking Agent cannot resolve |

### 6.6 System Records

| Record Type | Description |
|---|---|
| `schema_gap_record` | Schema field mismatch found during Schema Compatibility Check on version upgrade |
| `version_upgrade_card` | Human-facing Version Upgrade Card at Phase Gate |
| `ingestion_pipeline_record` | Output of each Ingestion Pipeline stage for a new record |
| `file_system_write_record` | Records a file create/modify/delete by the Executor Agent |
| `file_system_revert_record` | Records a file reversion during rollback |
| `refactoring_hash_recomputed` | Records when a Refactoring Task hash is recomputed due to prior task modification |
| `refactoring_skipped_idempotent` | Records a Refactoring Task skipped because it was already applied |
| `cycle_detected_record` | Records a `derives_from` cycle found during Dependency Closure computation |
| `warning_acknowledged` | Human acknowledgment of a single consistency warning — includes `finding_id` |
| `warning_batch_acknowledged` | Human bulk acknowledgment of all warnings — includes list of `finding_ids` |
| `ingestion_pipeline_failure` | Records a failure in any Ingestion Pipeline stage — includes stage, error, recovery action |
| `llm_api_failure` | Records an LLM API call failure — includes provider, error type, retry attempt number |
| `llm_api_recovery` | Records successful recovery from an LLM API failure |

**`mirror_presented` field addition:** Add `system_proposed_content_count: integer` to the existing `mirror_presented` record type.

### 6.7 Wave 6 Recursive Decomposition Records *(product lens, Phase 1–2)*

| Record Type | Description |
|---|---|
| `intent_lens_classification` | Phase 1.0a output — the lens chosen for this run (`product` / `feature` / `bug` / `infra` / `legal` / `unclassified`) with confidence score, rationale, and `fallback_lens` (used when confidence is too low to trust the primary classification). |
| `requirement_decomposition_node` | A single node in the Phase 2.1a (FR) or 2.2a (NFR) decomposition tree. Logical identity is `content.node_id` (UUID, stable across revisions); presentation uses `content.display_key`. Parent linkage via `content.parent_node_id`. Release assignment via `content.release_id` + `content.release_ordinal` inherited from parent. Status: `pending` \| `decomposed` \| `atomic` \| `pruned` \| `deferred` \| `downgraded`. Tier: `A` \| `B` \| `C` \| `D` (absent on depth-0 roots). Supersession by logical id enforces the exactly-one-current-version invariant (§5.2.1). |
| `requirement_decomposition_pipeline` | Per-kind saturation-loop container (one per root_kind per run). Updated incrementally via `supersedByRollback` as passes complete; the latest version reflects current pipeline state. Content includes `passes[]` (per-pass delta + semantic_delta + node count), `termination_reason` (`fixed_point` \| `budget_cap` \| `depth_cap`), `final_leaf_count`, `final_max_depth`, `total_llm_calls`. |
| `assumption_set_snapshot` | Per-pass record of the cumulative assumption set for a root_kind. Fields: `pass_number`, `root_fr_id` (kind marker — `*` for FR, `*nfr*` for NFR), full `assumptions[]` list, `delta_from_previous_pass` (raw count), `semantic_delta` (count excluding duplicate_of-flagged rows). The saturation-loop termination gate reads `semantic_delta`; `delta_from_previous_pass` is retained for audit. |
| `release_plan` | Phase 1.8 Release Plan artifact. `releases[]` is an ordered list of Release entries. **schemaVersion `2.0` (Wave 7)** widens the per-Release content from `traces_to_journeys[]` to `contains: { journeys[], workflows[], entities[], compliance[], integrations[], vocabulary[] }` plus a top-level `cross_cutting: { workflows[], compliance[], integrations[], vocabulary[] }` block. Only records with `approved: true` drive Phase 2 assignment. The active plan is pinned on the Workflow Run via `workflow_runs.active_release_plan_record_id`. Iterations during the Phase 1.8 feedback loop write additional `approved: false` records for audit. |
| `coverage_gap` | Output of a deterministic coverage verifier. `sub_phase_id ∈ {'1.3c', '1.8', '2.1c', '2.2c'}` identifies which verifier emitted the gap. Carries `check` (machine tag — e.g. `journey_fr_coverage`, `nfr_threshold_presence`, `referential_integrity_*`), `severity ∈ {blocking, advisory}`, `expected[]` / `actual[]` / `missing[]` arrays of artifact ids, optional `extra[]` for double-count checks, optional `details{}`. Blocking gaps halt the parent phase with `success: false`; advisory gaps log and proceed. The orchestrator routes blocking gaps to MMP for human resolution (`accepted_as_scope_cut` / `rebloom_requested`) when an interactive UI is attached. |

### 6.8 Wave 6 Reasoning-Review Sub-Types *(product lens)*

The existing `reasoning_review_record` record type gains two `content.kind` variants emitted during Phase 2.1a / 2.2a:

| `content.kind` | Description |
|---|---|
| `tier_c_ac_shape_audit` | Step 4c structural AC-shape audit for clean post-gate Tier-B decompositions. Content: `parent_node_id` (parent's logical UUID), `parent_display_key`, `pass_number`, `children_reviewed[]` (child user_story ids), `findings[{ child_id, verdict: 'verification'\|'policy'\|'ambiguous', rationale }]`, `summary`, `policy_count`. Advisory only — no automatic tree changes. |

---

## 7. Orchestrator Specification

The Orchestrator is a TypeScript class — `OrchestratorEngine` — whose state lives in the Governed Stream database and whose reasoning is provided by focused, stateless LLM API calls.

### 7.1 Deterministic Operations (No LLM Call)

- Reading and writing current phase and sub-phase state
- Checking retry counter and Loop Detection Monitor status
- **Running Invariant Checks** via `InvariantChecker` before Reasoning Review — no LLM required
- Verifying Artifact schema validity against JSON Schema library
- Routing to the correct Prompt Template
- Constructing two-channel Context Payloads (stdin + detail file) via `ContextBuilder`
- **Constructing Trace Selections** from `agent_invocation.trace_record_ids` per configured selection rules
- Recording Governed Stream Records via `GovernedStreamWriter`
- **Setting `quarantined: true` flag** on records associated with `severity: high` Reasoning Review findings
- **Filtering quarantined records** from retry Context Payloads
- Triggering Narrative Memory and Decision Trace generation at Phase Gates
- Enforcing the Unsticking Action Boundary
- Assigning Authority Levels at record write time
- Running Ingestion Pipeline Stages I and II
- Checking cascade thresholds
- Performing Dependency Closure Rollback traversal
- **Detecting tool call sequence loops** deterministically from `tool_call` records in `trace_record_ids`

### 7.2 Two-Channel Context Assembly

CLI-backed agents receive context through two channels. LLM API call roles (Reasoning Review, Narrative Memory Generator, Orchestrator reasoning calls, Client Liaison Agent, Unsticking Agent) receive narrow purpose-built context and are not subject to the two-channel model.

**Release-Ordered Requirement Projection *(Wave 6, product lens)*:** For Sub-Phases downstream of Phase 2 that consume the FR / NFR trees (Phases 3, 4, 5, 7, 8), `ContextBuilder` sorts the projected work by `content.release_ordinal` ascending (null = Backlog, rendered last), with `root_display_key` + `display_key` as the secondary key for stability. Release ordering is the **primary downstream sort key**; per-story `priority` (critical / high / medium / low) is the secondary sort within a Release. This means a Phase 7 Implementation Plan synthesized from frozen FR leaves inherits the human-approved Release ordering by construction — no extra routing logic required. Downstream consumers access this projection via `buildEffectiveFrView(decompositionNodes, prior)`, which also surfaces per-leaf `release_id` + `release_ordinal` on the `FrozenFrLeaf` shape.

**Channel 1 — Context Payload Stdin (directive channel):**

The `ContextBuilder` constructs the stdin directive with the following content in strict order:

1. **Governing Constraints (never omitted):** Constitutional Invariants relevant to this Sub-Phase; active constraints from the Context Packet at Authority Level 6+; `derived_from_system_proposal` warnings for any provisional content in scope; any Invariant Violation findings from prior retry
2. **Required Output Specification:** The Sub-Phase's required output from the Prompt Template header
3. **Summary Context:** Structured summary fields from the Deep Memory Research Context Packet (`decision_context_summary`, `active_constraints`, `supersession_chains`, `contradictions`, `open_questions`); Narrative Memory from the immediately prior Phase (summary only); `compliance_context` summary; approved `release_plan` Release ordering (ordinals + names + short descriptions) when present — drives release-ordered projection of requirements / components / tasks downstream
4. **Detail File Reference:** Path to the detail file; description of its contents; explicit conditions under which the agent should consult it

The stdin directive is designed to remain within the configured `stdin_max_tokens` limit. Governing Constraints (item 1) are never truncated — if they alone approach the limit, the Orchestrator escalates to human before invoking the agent.

**Channel 2 — Context Payload Detail File (reference channel):**

A generated markdown file placed at `.janumicode/context/{sub_phase_id}_{invocation_id}.md` before agent invocation. Contains:

- Full Context Packet from Deep Memory Research Agent
- Full Narrative Memories from all prior phases
- Full Decision Traces relevant to this Sub-Phase
- Full Technical Specifications for referenced Components
- Full `compliance_context` detail
- Full Unsticking resolution records relevant to this problem class
- Full prior Phase Gate-approved artifacts relevant to this Sub-Phase

The detail file is written by `ContextBuilder` and its generation is recorded as a `detail_file_generated` Governed Stream Record. After Phase Gate acceptance, detail files are moved to `.janumicode/context/archive/` — available for audit and for the Unsticking Agent if needed.

**The stdin directive instructs the agent:**

```
DETAIL FILE:
A file containing the complete supporting context for this task is available at:
{{detail_file_path}}

Consult this file when you need:
- Full prior decision rationale and evidence
- Complete Technical Specifications
- Historical artifact details
- Compliance context specifics

You do not need to read the entire file upfront.
Read sections relevant to your current reasoning step.
```

**Hard guarantee:** No governing constraint (Authority Level 6+) may be truncated silently. If the stdin directive cannot contain all governing constraints within the configured token limit, the Orchestrator presents a hard stop escalation to the human: "The governing constraints for [Sub-Phase] cannot fit within the model's stdin limit. Options: (A) Use a larger-context model for this invocation — update `agent_roster` configuration, (B) Reduce scope — return to Phase 1 to narrow the Intent Statement."

**Token counting implementation:** The `ContextBuilder` uses the tokenizer library corresponding to the target agent's configured provider:

| Provider | Tokenizer |
|---|---|
| Anthropic | `@anthropic-ai/tokenizer` or character-based approximation (4 chars ≈ 1 token) |
| Google | Character-based approximation (4 chars ≈ 1 token) |
| OpenAI | `tiktoken` with the model's encoding |

When an exact tokenizer is unavailable, the approximation is used with a 10% safety margin applied to `stdin_max_tokens`. For example, with `stdin_max_tokens: 8000` and 10% margin, the effective limit is 7200 tokens by approximation.

**Overflow threshold:** The hard stop triggers when governing constraints alone exceed 90% of `stdin_max_tokens`. The 10% buffer is reserved for required output specification and detail file reference. If governing constraints fit within 90% but total stdin content exceeds 100%, non-governing content (summary context) is truncated. The agent is informed of truncation in the stdin directive: `[NOTE: Summary context was truncated due to token limit. Full context is available in the detail file.]`

**Detail file size limit:** Add to `context_assembly.cli_agents`:

```json
"detail_file_max_bytes": 10485760
```

(10MB default). If the assembled detail file content exceeds this limit, content is truncated in reverse priority order: Unsticking resolution records first, then prior-phase Narrative Memories beyond the most recent two, then full Technical Specifications for non-directly-referenced Components. The agent is informed of truncation in the stdin directive.

**Detail File Format:** The detail file is structured markdown with clearly labeled sections in the following order:

```markdown
# JanumiCode Context Detail File
Generated: {ISO 8601}
Sub-Phase: {sub_phase_id}
Invocation: {invocation_id}

## Deep Memory Research — Full Context Packet
{full context_packet JSON, formatted as a fenced code block}

## Narrative Memories — All Prior Phases
### Phase {N}: {phase_name}
{narrative_memory content}
[repeated per phase in chronological order]

## Decision Traces — Relevant to This Sub-Phase
{decision_trace_summary content for phases relevant to this sub-phase}

## Technical Specifications — Referenced Components
### Component: {component_id}
{full technical specification content}
[repeated per referenced component]

## Compliance Context — Full Detail
{full compliance_context JSON}

## Unsticking Resolutions — Relevant Problem Classes
{unsticking_resolution records matching this sub-phase's agent role and problem class}
```

### 7.3 Trace Selection Construction

The `ContextBuilder` constructs the Trace Selection for each Reasoning Review invocation from the `agent_invocation.trace_record_ids` array. Selection is deterministic — no LLM call required.

**Selection rules:**

| Component | Executor Agent (Phase 9) | Planning Agents (Phases 1–8) |
|---|---|---|
| `agent_self_correction` records | **All** — always included | **All** — always included |
| `tool_call` records (invocation only — name + params) | **All** — always included | **All** — always included |
| `tool_result` records | **Excluded** — context window constraint; available in Governed Stream for Unsticking Agent | **Excluded** — same |
| `agent_reasoning_step` — first step | **Included** | **Included** |
| `agent_reasoning_step` — last step | **Included** | **Included** |
| `agent_reasoning_step` — steps preceding tool calls | **Included** | **Included** |
| `agent_reasoning_step` — steps preceding self-corrections | **Included** | **Included** |
| `agent_reasoning_step` — all other steps | **Sampled** via uniform stride (see below) | **Omitted** |
| Final output artifact | **Included** | **Included** |
| Total cap | `reasoning_review.trace_max_tokens` | `reasoning_review.trace_max_tokens` |

**Uniform Stride Sampling (Executor Agent only):** For `agent_reasoning_step` records not explicitly selected (first, last, pre-tool-call, pre-self-correction), a uniform stride sampling algorithm is applied:

1. Collect all unselected `agent_reasoning_step` records in sequence order
2. Compute `remaining_budget = trace_max_tokens - tokens_used_by_selected_records`
3. If all unselected records fit in `remaining_budget`: include all
4. Otherwise: select every Nth record where `N = ceil(count / available_slots)` and `available_slots = remaining_budget / average_reasoning_step_token_count`
5. Always include the record immediately before and after any `agent_self_correction` record, regardless of stride

The `reasoning_review_record` includes a `trace_sampling_applied: true | false` field and `trace_stride_n: integer` when sampling occurred. This documents the known limitation that sampled traces may miss intermediate reasoning flaws.

The Trace Selection is recorded in the `reasoning_review_record` as `trace_selection_record_ids` — the exact set of records used — enabling audit of what the Reasoning Review saw.

### 7.4 Focused LLM API Calls

Each Orchestrator LLM API call is stateless and scoped. Context budgeting is enforced — the Orchestrator queries the Governed Stream for relevant context rather than loading all records.

| Orchestrator LLM Call | Input | Output |
|---|---|---|
| Phase Gate Evaluation | Relevant artifacts + Phase Gate Criteria + Context Packet + Verification Ensemble results | Structured pass/fail per criterion with reasoning |
| Context Payload Adequacy Check | Sub-Phase requirements + candidate stdin content | List of missing required variables |
| Rollback Recommendation | Failure context + phase history + dependency closure | Recommended rollback target — presented as bloom-and-prune Menu |
| Vocabulary Collision Check | Canonical Vocabulary + current Product Scope artifacts | `collision_risk_report` |
| Unsticking Escalation Bloom | Full unsticking session transcript | Bloom of resolution options — presented as Menu |
| Schema Compatibility Check | `schema_registry.json` + artifact `schema_version` fields | List of schema gaps |
| Failed Test Fault Analysis | Failing test case specification + implementation evidence | Routing recommendation |
| Scope Classification | Raw Intent text | `scope_classification` |
| Intent Quality Assessment | Raw Intent text | `intent_quality_report` |
| Cascade Impact Assessment | `cross_run_impact_report` + cascade thresholds | Cascade threshold check result |

### 7.5 Decision Sequencing Protocol

The `BloomPruneCoordinator` sequences all Menu interactions within a Phase using the following priority ordering. Higher-priority decisions are presented first because they eliminate or constrain branches of subsequent decisions.

**Priority 1 — Scope and boundary decisions:**
Decisions that eliminate entire branches of the candidate space (scope bounding, Release Plan approval, in-scope vs. out-of-scope determinations). Always presented individually — never bundled.

**Priority 2 — Compliance and constraint decisions:**
Decisions that constrain the solution space for all downstream artifacts (compliance regime confirmation, Constitutional Invariant acknowledgments, Prior Decision Override confirmations). Always presented individually — never bundled.

**Priority 3 — Architectural choices:**
Decisions about technology selection, pattern selection, and major structural choices. Presented individually when `estimated_complexity: high`; may be bundled when independent and `estimated_complexity: low | medium`.

**Priority 4 — Implementation preferences:**
Decisions about naming, style, minor configuration. May be bundled freely.

**Decision Bundle rules:**
A Decision Bundle presents multiple independent decisions as a single Menu item where each decision has a system-recommended default with justification. The human may accept all defaults with one selection or expand individual decisions for deliberate choice.

A Decision Bundle must never contain:
- Prior Decision Override confirmations
- Compliance regime selections
- System-Proposed Content approval requests
- Any decision with `estimated_complexity: high` downstream consequences
- Scope or boundary decisions

### 7.6 Bloom-and-Prune for Orchestrator Decisions

When the Orchestrator faces a non-deterministic decision with significant consequences — rollback target selection, unsticking escalation resolution, schema gap resolution, version upgrade decisions, cascade threshold breach, incomplete Context Packet with high-materiality gap — it applies bloom-and-prune. All Orchestrator bloom outputs, mirrors, and menus are Governed Stream Records.

### 7.7 Context Window Management

Each Orchestrator LLM API call receives only:
- Artifacts directly relevant to the current decision
- Narrative Memories from completed phases (not raw records)
- The current Prompt Template header
- The specific question being answered

The Governed Stream's full-text search (FTS5) and vector search (sqlite-vec) are what make targeted retrieval tractable. The Deep Memory Research Agent handles cases where relevant context is non-obvious.

### 7.8 OrchestratorEngine Components

| Component | Responsibility |
|---|---|
| `StateMachine` | Reads and writes current phase and sub-phase state |
| `ContextBuilder` | Constructs two-channel Context Payloads — stdin directive and detail file; constructs Trace Selections from `trace_record_ids` |
| `TemplateLoader` | Loads Prompt Templates; validates required variables; hard-stops on missing |
| `AgentInvoker` | Invokes CLI-backed agents with stdin + detail file; invokes LLM API call roles with narrow context |
| `LLMCaller` | Makes focused, stateless LLM API calls |
| `SchemaValidator` | Validates artifacts against JSON Schema library |
| `InvariantChecker` | Runs deterministic Invariant Library checks per artifact type before Reasoning Review |
| `LoopDetectionMonitor` | Retry counter; flaw trend analysis; **tool call sequence analysis** from `trace_record_ids` |
| `PhaseGateEvaluator` | Orchestrates full Phase Gate check sequence including Verification Ensemble |
| `BloomPruneCoordinator` | Manages Orchestrator-level bloom-and-prune; enforces Decision Sequencing Protocol |
| `GovernedStreamWriter` | Records all actions; assigns Authority Levels; sets `quarantined` and `derived_from_system_proposal` flags; triggers Ingestion Pipeline; **records Execution Trace records** per Agent Invocation |
| `IngestionPipelineRunner` | Executes all five Ingestion Pipeline stages per new record |
| `DependencyClosureResolver` | Traverses `memory_edge` table for full dependency closure on rollbacks |
| `CascadeThresholdChecker` | Compares `cross_run_impact_report` metrics against configured thresholds |

### 7.9 Tool Availability Registry

The Tool Availability Registry specifies, per agent role, the tools that the backing CLI tool makes available during a standard invocation. This enables the Loop Detection Monitor to detect SCOPE_BLIND (agent has available tools it is not using).

The registry is specified in `janumicode.config.json` under `tool_availability`:

```json
"tool_availability": {
  "executor_agent": {
    "backing_tool": "claude_code_cli",
    "available_tools": [
      "Read", "Write", "Edit", "Bash", "Search", "WebSearch", "ListFiles"
    ]
  },
  "architecture_agent": {
    "backing_tool": "gemini_cli",
    "available_tools": ["Read", "Search", "WebSearch"]
  }
}
```

**SCOPE_BLIND detection algorithm:** After an invocation fails Reasoning Review, the Loop Detection Monitor:

1. Retrieves the `available_tools` list for the agent role from the Tool Availability Registry
2. Retrieves all `tool_call` records from the current invocation's `trace_record_ids`
3. Computes `tools_called = {tool_call.name for each tool_call}`
4. Computes `tools_not_called = available_tools - tools_called`
5. If `tools_not_called` is non-empty AND the Reasoning Review found `unsupported_assumption` or `completeness_shortcut` flaws: Loop Status = SCOPE_BLIND

SCOPE_BLIND is not triggered on the first attempt. It requires at least one failed Reasoning Review.

### 7.10 DIVERGING Trend Definition

**DIVERGING** requires both:

- Retry count ≥ 2
- The flaw count from the most recent Reasoning Review is **strictly greater than** the flaw count from the immediately prior Reasoning Review

"Flaw count" = number of `severity: high` flaws only. Low-severity flaws are excluded from trend calculation. A single high-severity flaw added between retries is sufficient to classify DIVERGING.

**Zero-tool-call handling:** If an agent produces zero `tool_call` records across two consecutive attempts, and both fail Reasoning Review with `severity: high` flaws, Loop Status = CONVERGING (the approach is identical — zero tool calls both times).

**Loop Detection timing:** The Loop Detection Monitor runs after the Reasoning Review completes for each retry attempt. It cannot run before Reasoning Review because DIVERGING requires flaw counts. On the first attempt (before any retry), the Loop Detection Monitor is not invoked — it is only invoked from the second attempt onward.

### 7.11 Phase Gate Evaluation Order

The Orchestrator evaluates Phase Gate Criteria in the following strict order with **short-circuit evaluation**: if any criterion fails, the remaining criteria are not evaluated, and the failure is presented to the human immediately.

**Evaluation order:**

1. Schema validation (deterministic — `SchemaValidator`)
2. Invariant checks (deterministic — `InvariantChecker`)
3. Reasoning Review results for this phase's artifacts (LLM — already completed during sub-phases; cached result used)
4. Consistency report: zero critical failures (requires Consistency Checker Agent invocation if not already run)
5. Domain attestation confirmed (human input recorded — checked from Decision Trace)
6. Verification Ensemble results for this gate (LLM — invoked at gate time)
7. Human approval

**Short-circuit behavior:** If schema validation fails, Invariant checks, Reasoning Reviews, and Consistency checks do not run. The human sees only the schema failure. This avoids running expensive LLM checks when a basic structural issue exists.

**Verification Ensemble at Phase Gates:** The ensemble reviews the **Phase Gate evaluation LLM call output** (one call per gate) — not each artifact individually. The Phase Gate evaluation call summarizes all artifacts' states; the secondary provider reviews that summary. This means one ensemble invocation per Phase Gate, not N invocations per N artifacts.

### 7.12 LLM API Failure Recovery Protocol

All LLM API calls (Reasoning Review, Narrative Memory, Domain Compliance Review, Orchestrator reasoning calls, Deep Memory Research) are wrapped by a `LLMCaller` that applies the following recovery protocol:

**Transient failures (retry with backoff):**

- HTTP 429 (rate limit): retry after `Retry-After` header value; if no header, exponential backoff starting at 5s, max 3 retries
- HTTP 503 / 504 (service unavailable): exponential backoff starting at 10s, max 3 retries
- Network timeout: retry immediately once, then backoff

**Non-transient failures (no retry — escalate):**

- HTTP 401 / 403 (authentication): record `llm_api_failure` with type `auth_error`; present to human: "API authentication failed for [provider]. Check API key configuration."
- HTTP 400 (bad request / schema error): record `llm_api_failure` with type `schema_error`; this indicates a Prompt Template or Context Payload construction bug; escalate to human with full request details
- HTTP 500 (model error): retry once; if fails again, escalate to human

**Context window exceeded (HTTP 400 with context length message):** Treat as a governing constraint overflow event per the protocol in Section 7.2. Present the hard stop Menu to the human.

**All retry attempts and outcomes** are recorded as `llm_api_failure` and `llm_api_recovery` Governed Stream Records.

**Fallback model:** If configured in `janumicode.config.json` under `llm_routing.{role}.fallback`, the `LLMCaller` switches to the fallback model after exhausting retries on the primary:

```json
"reasoning_review": {
  "primary": { "provider": "google", "model": "gemini-2.5-flash" },
  "fallback": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
  "max_retries": 3
}
```

If no fallback is configured and all retries fail, the Orchestrator presents an escalation to the human: "[Role] LLM call failed after [N] retries. Options: (A) Retry now, (B) Configure a fallback model, (C) Halt this Workflow Run."

---

## 8. Cross-Cutting Role Specifications

### 8.1 Reasoning Review

**Nature:** Single stateless LLM API call. Primary provider: Google Gemini thinking model. Secondary provider (Verification Ensemble): Anthropic Claude Sonnet.

**Trigger:** Every Sub-Phase producing an artifact that feeds a Phase Gate or another agent's Context Payload.

**Receives (narrow context — not two-channel):**
- The Trace Selection constructed from the agent's Execution Trace (per Section 7.3 selection rules)
- The Sub-Phase's required output specification
- The Phase Gate Criteria for the current Phase
- The most relevant prior Phase-Gate-Certified artifacts (targeted query)
- The `compliance_context` artifact (when Domain Compliance Reasoning Review is also triggered)
- The governing ADR(s) for the artifact being reviewed (for `implementation_divergence` checks in Phase 9)
- The `completion_criteria` from the Implementation Task (for `completeness_shortcut` checks in Phase 9)

**Complete Flaw Taxonomy:**

| Flaw Type | Definition | Visibility in Execution Trace | Severity Guidance |
|---|---|---|---|
| `unsupported_assumption` | Agent asserts something as true with no basis in Context Payload | **Directly visible** in reasoning steps | High if drives key output field |
| `invalid_inference` | Conclusion does not follow from stated premises | **Directly visible** in reasoning chain | High always |
| `circular_logic` | Conclusion used as premise in its own justification | **Directly visible** — earlier claim reappears | High always |
| `scope_violation` | Agent addresses concerns belonging to a different Phase | **Directly visible** — tool calls to out-of-scope resources visible | High if causes incorrect artifact content |
| `premature_convergence` | Agent collapses options that should remain open for human selection | **Directly visible** — agent stops generating alternatives | High always — violates bloom-and-prune principle |
| `false_equivalence` | Agent treats two meaningfully different things as interchangeable | **Directly visible** in reasoning | High if affects traceability |
| `authority_confusion` | Agent cites a low-authority record as if it were a governing decision | **Directly visible** — agent references specific records | High if drives key decision |
| `completeness_shortcut` | Agent claims task complete when only part is done — checked against `completion_criteria` | **Directly visible** — skipped steps visible in trace | High always |
| `contradiction_with_prior_approved` | Agent's output conflicts with a Phase-Gate-Certified artifact | **Partially visible** — agent's acknowledgment of prior artifact visible; interpretation correctness requires output comparison | High always |
| `unacknowledged_uncertainty` | Agent expresses false confidence where genuine ambiguity exists | **Directly visible** — agent expresses doubt in reasoning but not in output | Low — surfaced as warning |
| `implementability_violation` | Component Responsibility too broad for single Executor Agent session | **Directly visible** — scope of stated approach reveals task size | High — checked in Phase 4 |
| `implementation_divergence` | Implementation Artifact contradicts governing ADR — Verification Ensemble triggered | **Partially visible** — whether agent consulted ADR visible; code-level match requires output comparison | High — Verification Ensemble triggered |
| `tool_result_misinterpretation_suspected` | Agent's stated conclusion from a tool call appears inconsistent with tool parameters, but cannot be confirmed without tool results | **Partially visible** — inconsistency between tool call and stated conclusion visible | Escalates to Unsticking Agent investigation |

**Verification Ensemble:**

Triggered at: Phase Gate evaluations; `implementation_divergence_check` in Phase 9.

The secondary model provider (Anthropic Claude Sonnet) receives the identical Trace Selection and input as the primary. Agreement requires both:

- `overall_pass` is identical between primary and secondary
- No flaw present in one review has `severity: high` while the equivalent flaw is absent or `severity: low` in the other review

If `overall_pass` agrees but severity disagrees (one found high-severity, the other found only low-severity or nothing), this is classified as **severity disagreement** and escalates to human with both reviews presented. The `reasoning_review_ensemble_record` adds:

```json
"agreement_type": "full | severity_disagreement | overall_disagreement",
"severity_disagreements": [
  {
    "flaw_type": "implementation_divergence",
    "primary_severity": "high",
    "secondary_severity": "low"
  }
]
```

If they disagree on `overall_pass`, a `verification_ensemble_disagreement` Governed Stream Record is produced and the disagreement is escalated to the human with both findings presented.

**Secondary failure handling:** If the secondary provider API call fails, the primary result is accepted and the ensemble disagreement check is skipped. A `llm_api_failure` record is produced noting the ensemble secondary failure. A warning is surfaced in the Phase Gate Mirror: "Verification Ensemble secondary check failed — primary result accepted without confirmation."

**Same-provider detection:** On startup, `OrchestratorEngine` checks whether `reasoning_review.primary` and `reasoning_review.ensemble.secondary` resolve to the same provider and model. If identical, a startup warning is logged: "Verification Ensemble configured with identical providers — no independent signal provided." The system proceeds but the ensemble provides no additional reliability.

**Output schema:**

```json
{
  "artifact_type": "reasoning_review_record",
  "schema_version": "1.2",
  "overall_pass": true,
  "trace_selection_record_ids": ["..."],
  "tool_results_excluded": true,
  "flaws": [
    {
      "flaw_type": "...",
      "severity": "high | low",
      "description": "...",
      "evidence": "specific passage from trace or output",
      "governing_adr_id": "... (implementation_divergence only)",
      "completion_criteria_id": "... (completeness_shortcut only)",
      "recommended_action": "retry | escalate | accept_with_caveat | return_to_phase4 | escalate_to_unsticking"
    }
  ],
  "reviewed_output_record_id": "...",
  "sub_phase_id": "...",
  "produced_at": "..."
}
```

**Quarantine protocol:** When `severity: high` flaw found, the `GovernedStreamWriter` sets `quarantined: true` on the reviewed output record. The retry Context Payload receives the `flaws` array from the Reasoning Review — not the quarantined output. The agent retries from the Sub-Phase entry criteria with flaw findings injected in its stdin directive under `[JC:REASONING REVIEW FINDINGS]`.

**Human override:** Permitted for `severity: low` only. Override creates a `quarantine_override` Governed Stream Record with flaw ID and rationale. `severity: high` must be resolved before Phase Gate passes.

**Async review for independent tasks:** In Phase 9.1, the Reasoning Review for a completed task may run asynchronously while the next independent task (no dependency relationship) begins execution. If the async review returns `severity: high`, the subsequent task is paused if dependent or flagged for rollback if already completed. Dependency is determined by `dependency_task_ids` in the `implementation_plan`.

**Domain Compliance Reasoning Review:** When `compliance_context` is populated and the artifact touches a compliance-relevant domain, an additional Reasoning Review pass is triggered as a separate LLM API call. It uses a different model provider from the primary Reasoning Review (configured in `janumicode.config.json` under `llm_routing.domain_compliance_review`) to reduce correlated reasoning errors. Output: `domain_compliance_review_record` Governed Stream Record.

---

### 8.2 Consistency Checker Agent

**Nature:** CLI-backed Agent. Two-channel context model applies.

**Receives:**
- The artifacts to be checked
- A structured checklist of required traceability assertions from Phase Gate Criteria (constructed by Orchestrator)
- Context Packet from Deep Memory Research Agent (pre-populated by Orchestrator, `all_runs` scope)
- Prior Phase's Narrative Memory
- `compliance_context` artifact (for compliance-relevant consistency checks)
- `domain_attestation_confirmed` status from prior Phase Gate (for Phase 10 pre-commit check)

**Three check types:**

**Mechanical traceability:** Verify each assertion in the checklist. Pass/fail per assertion.

**Semantic consistency:** Free reasoning across all artifacts and the Context Packet. Do they say compatible things? Does any current artifact contradict any historical artifact?

**Internal consistency:** Within each artifact, are there self-contradictions?

**Output schema:**

```json
{
  "artifact_type": "consistency_report",
  "overall_pass": true,
  "traceability_results": [
    {
      "assertion": "...",
      "pass": true,
      "failures": [{"item_id": "...", "explanation": "..."}]
    }
  ],
  "semantic_findings": [
    {
      "severity": "critical | warning",
      "description": "...",
      "artifact_ids_involved": ["..."],
      "governed_stream_record_ids": ["..."],
      "recommended_action": "..."
    }
  ],
  "internal_findings": [...],
  "historical_findings": [...],
  "compliance_findings": [...],
  "blocking_failures": ["finding_ids"],
  "warnings": ["finding_ids"]
}
```

**Resolution rule:** `critical` findings block the Phase Gate. Each `warning` in `consistency_report.warnings` requires individual acknowledgment before the Phase Gate approve button is enabled. Each acknowledged warning produces a `decision_trace` of type `warning_acknowledged` with the finding ID. A bulk "Acknowledge all warnings" option is available; it produces a single `decision_trace` of type `warning_batch_acknowledged` listing all warning IDs.

---

### 8.3 Narrative Memory Generation

**Nature:** Single LLM API call. Anthropic Claude Sonnet. Synchronous — blocks Phase transition.

**Receives (narrow context):**
- Decision Trace for the completed Phase
- All Phase-Gate-approved artifacts from the Phase
- Immediately prior Phase's Narrative Memory
- Structured summaries of any Unsticking sessions

**Authority Level:** 5 — Human-Approved.

**Output schema:**

```json
{
  "artifact_type": "narrative_memory",
  "authority_level": 5,
  "phase_id": "...",
  "phase_name": "...",
  "continuity_summary": "One paragraph connecting this Phase to the prior Phase narrative",
  "sub_phases": [
    {
      "sub_phase_id": "...",
      "sub_phase_name": "...",
      "what_was_done": "...",
      "key_decisions": [
        {"decision": "...", "rationale": "...", "source_record_id": "..."}
      ],
      "assumptions_confirmed": [{"assumption": "...", "source_record_id": "..."}],
      "open_items_deferred": [{"item": "...", "source_record_id": "..."}],
      "system_proposed_items_approved": [{"item": "...", "source_record_id": "..."}]
    }
  ],
  "unsticking_summary": null,
  "governing_constraints_established": [
    {"constraint": "...", "source_record_id": "..."}
  ],
  "compliance_decisions": [
    {"regime": "...", "decision": "...", "source_record_id": "..."}
  ],
  "embedding_vector": [...]
}
```

**Mandatory anti-failure-mode prompt instructions:**
- Do not omit qualifiers or conditional language from the Decision Trace
- Do not compress competing viewpoints into a single narrative voice
- Do not imply a position was stable if it changed during the Phase
- Every substantive claim must cite a `source_record_id`
- Express uncertainty where evidence was partial or contested
- System-Proposed Content items that were approved must be identified as such

---

### 8.4 Deep Memory Research Agent

**Nature:** CLI-backed Agent. Two-channel context model applies.

**Job statement:** When any agent or the human needs to act or decide in a context where prior history is relevant, the Deep Memory Research Agent must reconstruct the complete governing state of all available and relevant sources — what was decided, what assumptions were active, what was later revised, what contradictions exist, and what evidence supports each claim — and must characterize with equal rigor any gaps in that reconstruction, their cause, and their materiality, so that the hiring entity can act or decide in a way that is genuinely complete and trustworthy, or knows exactly why it cannot yet do so.

**Depth:** Always complete. There is no "fast mode." When completeness cannot be achieved, that fact is surfaced in the Context Packet — it is never acceptable to return partial context as if it were complete.

**Produces two outputs:**

**Context Packet summary fields** — for injection into agent stdin directives: `decision_context_summary`, `active_constraints`, `supersession_chains`, `contradictions`, `open_questions`, `completeness_status`.

**Context Packet detail file** — full JSON at the deterministic path — all `material_findings` with evidence, `recommended_drilldowns`, `coverage_assessment`, `implicit_decisions`, `unavailable_sources`.

#### Scope Tiers

| Scope Tier | Sources Included |
|---|---|
| `current_run` | Governed Stream records from the current Workflow Run only |
| `all_runs` | All Governed Stream records across all Workflow Runs in the Workspace |
| `all_runs_plus_external` | All Governed Stream records + configured external sources (git history, Slack, email, etc.) |

#### Retrieval Brief (Input Contract)

```json
{
  "artifact_type": "retrieval_brief",
  "requesting_agent_role": "...",
  "scope_tier": "current_run | all_runs | all_runs_plus_external",
  "query": "Natural language description of what historical context is needed",
  "known_relevant_record_ids": ["..."],
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "..."
}
```

#### Seven-Stage Process

**Stage 1 — Query Decomposition:** Transform the Retrieval Brief query into structured retrieval targets: topic entities, decision types sought, temporal scope, authority levels to prioritize, known conflict zones. The decomposition is recorded as a Governed Stream record — the hiring entity can inspect what the agent understood it was looking for.

**Stage 2 — Broad Candidate Harvest:** Retrieve candidates from all in-scope sources in parallel using all available mechanisms: FTS5 keyword search, vector similarity, Memory Edge graph traversal, temporal adjacency, authority-weighted filtering. Optimize for recall — missing a relevant record is worse than including an irrelevant one.

**Stage 3 — Materiality Scoring:** Score each candidate across seven dimensions:

```
materiality_score =
  (0.20 × semantic_similarity) +
  (0.25 × constraint_relevance) +
  (0.20 × authority_level / 7) +
  (0.15 × temporal_recency) +
  (0.10 × causal_relevance) +
  (0.10 × contradiction_signal)
```

Weights are configurable in `janumicode.config.json` under `deep_memory_research.materiality_weights`.

The materiality test: "If this record were omitted, is there a meaningful risk that the current recommendation would become incomplete, incorrect, or non-compliant?"

**Stage 4 — Relationship Expansion:** For high-materiality candidates, traverse the `memory_edge` table to expand context: preceding discussion, later corrections, superseding decisions, cited requirements, linked risks, implementation artifacts, validation results.

**Stage 5 — Supersession and Contradiction Analysis:** For every material finding, determine governing status using the conflict resolution rule from Section 3.1. Apply deterministically where Memory Edges exist. Invoke focused LLM API call only when a potential contradiction exists but no `contradicts` edge has been asserted.

**Stage 6 — Gap Detection and Source Availability Check:** For each in-scope source tier: was it reachable? Was it fully queried? Are there known gaps? For each unavailable source, assess materiality by checking whether high-authority Memory Edges point to records in that source.

**Stage 7 — Context Packet Synthesis:** Produce the structured Context Packet. Every claim must cite source record IDs. The packet must be as explicit about what it does not know as about what it does know.

#### Context Packet (Output Contract)

```json
{
  "artifact_type": "context_packet",
  "schema_version": "1.0",
  "query_decomposition": {
    "topic_entities": ["..."],
    "decision_types_sought": ["..."],
    "temporal_scope": {"from": "...", "to": "..."},
    "authority_levels_included": ["..."],
    "sources_in_scope": ["..."]
  },
  "completeness_status": "complete | partial_low | partial_medium | incomplete_high",
  "completeness_narrative": "...",
  "unavailable_sources": [
    {
      "source": "git_history",
      "reason": "git service unreachable",
      "materiality": "high | medium | low",
      "materiality_explanation": "...",
      "recommendation": "delay | proceed_with_caveat | proceed"
    }
  ],
  "material_findings": [
    {
      "id": "...",
      "record_type": "...",
      "authority_level": 6,
      "governing_status": "active | superseded | contradicted | unresolved",
      "summary": "...",
      "source_record_ids": ["..."]
    }
  ],
  "active_constraints": [
    {
      "id": "...",
      "statement": "...",
      "authority_level": 6,
      "source_record_ids": ["..."]
    }
  ],
  "supersession_chains": [
    {
      "subject": "...",
      "chain": [
        {"record_id": "...", "position": "superseded", "superseded_at": "..."},
        {"record_id": "...", "position": "current_governing", "effective_from": "..."}
      ]
    }
  ],
  "contradictions": [
    {
      "record_ids": ["...", "..."],
      "explanation": "...",
      "resolution_status": "unresolved | resolved_by_recency | resolved_by_authority",
      "resolved_by_record_id": "..."
    }
  ],
  "open_questions": [
    {
      "question": "...",
      "first_raised": "...",
      "still_unresolved": true,
      "source_record_id": "..."
    }
  ],
  "implicit_decisions": [
    {
      "inferred_decision": "...",
      "basis": "...",
      "confidence": 0.0,
      "source_record_ids": ["..."]
    }
  ],
  "recommended_drilldowns": [
    {"target_record_id": "...", "reason": "..."}
  ],
  "coverage_assessment": {
    "sources_queried": ["..."],
    "sources_unavailable": ["..."],
    "known_gaps": ["..."],
    "confidence": 0.0
  }
}
```

#### Invocation Timing (Orchestrator Pre-Population)

The Orchestrator pre-populates Context Packets for:
- All Phase Gate evaluations (all phases)
- Consistency Checker Agent invocations (all phases)
- Domain Interpreter Agent in brownfield runs (Phase 1)
- Architecture Agent (Phase 4)
- Technical Spec Agent (Phase 5)
- Pre-Commit Consistency Check (Phase 10)

For all other Sub-Phases, agents operate from current-run artifacts unless the Orchestrator determines historical context is needed.

#### Incomplete Context Packet Protocol

| Completeness Status | Auto-proceed? | Human escalation? |
|---|---|---|
| `complete` | Yes | No |
| `partial_low` | Yes — caveat annotation added to Context Payload | No |
| `partial_medium` | Yes — caveat annotation + Governed Stream warning card | Optional — human may intervene |
| `incomplete_high` | No | Yes — explicit proceed / delay / accept-with-rationale Menu |

This routing is deterministic — no LLM call required from the Orchestrator.

#### Failure Mode Handling

| Failure Mode | Prevention Mechanism |
|---|---|
| Supersession blindness | Stage 5 — every material finding has `governing_status` assessed before appearing in packet |
| Authority confusion | `authority_level` field on every record; explicit dimension in materiality scoring |
| Context fragmentation | Stage 4 relationship expansion — agent reconstructs coherent context from fragments |
| Recency bias | Temporal recency is one dimension of seven; high-authority non-superseded records always included |
| Narrative over-synthesis | `contradictions` and `open_questions` fields — agent must surface ambiguity, not resolve it |
| Implicit decision blindness | `implicit_decisions` field — inferred patterns recorded with explicit confidence scores |
| Infrastructure failure | Stage 6 gap detection — characterized in `unavailable_sources` with materiality and recommendation |

**Division of labor with Reasoning Review:** The Deep Memory Research Agent retrieves historical context. The Reasoning Review evaluates whether the agent used that context correctly. The Unsticking Agent investigates failure modes that the Reasoning Review cannot detect (Tool Result Misinterpretation) using full Governed Stream access including tool results.

---

### 8.5 Failure Mode Taxonomy and Recovery Protocol

Seven named failure types. Each has a primary detection mechanism and recovery path.

| Failure Type | Definition | Primary Detection | Recovery |
|---|---|---|---|
| **Convergence Loop** | Agent retries same approach without progress | Loop Detection Monitor: STALLED; identical tool call sequence within one invocation | Unsticking Agent — Socratic mode |
| **Divergence Loop** | Each retry creates new problems | Loop Detection Monitor: DIVERGING | Unsticking Agent — Detective mode |
| **Scope Blindness** | Agent has access to needed information but does not consult it | Loop Detection Monitor: SCOPE_BLIND; tool call sequence shows available tools not called | Unsticking Agent — Environmental Detective mode |
| **Silent Corruption** | Agent produces syntactically valid output that is semantically wrong without triggering a retry | Phase 9.2 test failure; `implementation_divergence` Reasoning Flaw; Invariant violation; Phase 10.1 Consistency Check | Phase 9.4 failure handling: Orchestrator determines fault via focused Reasoning Review |
| **Tool Result Misinterpretation** | Agent correctly invokes a tool but draws an incorrect conclusion from its output. **Not detectable by Reasoning Review** — tool results excluded from Trace Selection by design. | `tool_result_misinterpretation_suspected` Reasoning Flaw flag; subsequent test failures; Invariant violations | Unsticking Agent with full Governed Stream access including tool results |
| **Spec Drift Through Approval** | System-Proposed Content (Authority Level 1) approved by human and treated as correct | `derived_from_system_proposal` flag on downstream artifacts; Phase 2 domain attestation | Phase 2 attestation step; `system_proposed_content_items` tracking in Intent Statement |
| **Ingestion Pipeline Failure** | A new Governed Stream Record fails during any Ingestion Pipeline stage | `ingestion_pipeline_failure` record; Orchestrator pause before next Sub-Phase | Stage I/II: retry synchronously (deterministic — should not fail); Stage III: retry once with backoff; if still fails, record without memory edges and surface warning at next Phase Gate; Stages IV/V: same as III |

**The honest boundary:** If the Intent Statement was wrong (Intent Fidelity failure) and tests were generated from wrong requirements, the system will pass all automated checks yet be functionally incorrect. This is "Consistency Without Truth" — the primary defense is the human as external ground truth at the Phase 2 domain attestation step. No automated system can fully close this gap when the correctness criterion is defined by human domain expertise.

**Tool Result Misinterpretation — Unsticking Agent investigation protocol:**

When `tool_result_misinterpretation_suspected` is flagged by the Reasoning Review, or when a stuck situation appears after an agent reported successful tool use:

1. Unsticking Agent retrieves the `tool_result` records from the Governed Stream for the relevant Agent Invocation using `agent_invocation.trace_record_ids`
2. Unsticking Agent compares the actual tool results against the agent's stated conclusions in its `agent_reasoning_step` records
3. If misinterpretation is confirmed, the Unsticking Agent generates a `unsticking_tool_result_review` record documenting the specific discrepancy
4. The stuck agent is provided with the correct interpretation of the tool result via the Unsticking Agent's next Socratic turn, injected into its Context Payload

**Streaming Stall Detection Protocol:** A thinking-mode LLM can keep emitting tokens without making semantic progress — the stream itself isn't hung, so idle-socket timers don't trip, but the output never converges. Two independent signals catch these in-stream, with Loop Detection Monitor as the cross-invocation signal:

1. **Invocation log size cap (per LLM call, retryable).** The orchestrator's `LLMCaller.call` watches the bytes written to the per-invocation `.log` file (prompt + chunk metadata + streamed text). When `bytesWritten > maxLogFileBytes` for this attempt exceeds the threshold (`JANUMICODE_LLM_MAX_LOG_FILE_BYTES`, default **1,572,864 bytes ≈ 1.5 MB**), the in-flight HTTP stream is aborted. **Wave 8 classification:** the abort is classified as `LLMErrorType: 'runaway_thinking'` (a new retryable type) — distinct from a true HTTP-400 `'context_exceeded'` (server-side rejection, non-retryable). `LLMCaller.isRetryable('runaway_thinking') === true`; `getBackoffDelay('runaway_thinking') === 2000` ms; `LLMCaller` retries up to `maxRetries` (default 3), each retry starting from a fresh `bytesBaseline` so a failed attempt-1 doesn't immediately re-trip attempt-2. Rationale: healthy qwen3.5:9b invocations top out at ~100–200 KB log file; anything past 1.5 MB is practically certain to be runaway thinking. Variance between attempts often allows the next retry to converge — calibration runs commonly observe 1-retry rescues with 0 final failures.

2. **Records-idle session abort (per Workflow Run, non-retryable).** The CLI runner's `waitForQuiescence` watches the `governed_stream` table for new rows. When no new record has landed for `records_idle_stall_ms` (default **900,000 ms = 15 min**), the session AbortController is tripped — propagates into any in-flight LLMCaller, tears down the HTTP stream, and the phase returns `requires_input`. Unlike the log-size cap this is a SESSION-level signal; no retry. Progress is measured by records landing in the stream, so long-running legitimate LLM calls (thinking-mode prose) that ARE making progress but haven't yet finished don't trigger records-idle as long as their emitted decomposition-node / assumption-set records are landing.

3. **Loop Detection Monitor (cross-invocation).** The existing retry-based Loop Detector classifies Loop Status as `STALLED` / `DIVERGING` / `SCOPE_BLIND` using retry-count / flaw-trend / tool-call-sequence heuristics across multiple Agent Invocations. Triggers the Unsticking Agent (Sections 8.5 / 8.6).

Retired from prior Wave iterations:
- **N-gram streaming loop detector** — retired after false-positiving on legitimate Phase 1.3 JSON-bloom output whose schema-repetitive fragments (`",\n  "actors": [\n    "`) read as prose loops. The log-size cap catches the same pathology without the false positive.
- **Tiny-chunk flailing detector** — retired after triggering on qwen3.5:9b's natural JSON-streaming tokenization (3–5 chars/chunk is normal for structured output; the heuristic at `JANUMICODE_LLM_FLAIL_MAX_AVG_CHARS=6` mis-identified this as a spiral).

---

### 8.6 Unsticking Agent

**Nature:** Multi-turn investigative dialogue. LLM API calls using Google Gemini thinking model.

**Trigger:** Loop Detection Monitor classifies Loop Status as STALLED, DIVERGING, or SCOPE_BLIND.

**Two simultaneous investigation modes:**

**Mode 1 — Socratic Elicitation:** Ask the stuck agent what information would help it make progress. Productive when the agent has partial awareness of its own gap.

**Mode 2 — Environmental Detective:** Independent of what the stuck agent says, reason from knowledge of the Workspace, toolchain, problem class, agent history, and the `janumicode.specialists.json` registry. Form hypotheses. Test the most confirmable first.

Both modes run in parallel. Whichever produces a viable path forward first is executed.

**Key principle:** The Unsticking Agent never tells the stuck agent what to do. It asks questions and provides context that help the stuck agent deduce the path forward itself. When a specialist model is better suited to a focused diagnostic task, the Unsticking Agent recruits them through the specialist registry.

**Action Boundary:** Enforced by Orchestrator limiting available tools to in-scope only.

- **In scope:** Read any workspace file; query Governed Stream; start/stop debug sessions associated with workspace; run/stop workspace test cases; invoke configured CLI tools; internet searches via CLI tools; git repository access; invoke Specialist Agent for focused diagnostic task
- **Out of scope:** System-level operations; files outside workspace context; security software; actions affecting other users or systems

**Full Governed Stream access:** The Unsticking Agent's primary advantage over the Reasoning Review for diagnosing Tool Result Misinterpretation is access to `tool_result` records — the complete tool output data that the Reasoning Review's Trace Selection excludes by design.

**Governed Stream recording:** Maximum granularity — every turn is a distinct record: `unsticking_session_open`, `unsticking_hypothesis`, `unsticking_socratic_turn`, `unsticking_specialist_task`, `unsticking_specialist_response`, `unsticking_tool_result_review`, `unsticking_resolution`, `unsticking_escalation`.

**`unsticking_resolution` records** are indexed for vector and FTS retrieval — they constitute a growing problem class library retrievable by future Deep Memory Research Agent invocations.

**Dialogue loop detection:** If three Socratic turns produce no new reasoning from the stuck agent, the dialogue itself is stuck. Escalate to human with full transcript as Escalation Card.

---

### 8.7 Test Design Agent

**Nature:** CLI-backed Agent. Two-channel context model applies. Produces Test Case specifications — not code. Each Sub-Phase producing a distinct artifact type is a separate Agent Invocation with Execution Trace capture.

**Decomposition scope:** Functional test cases only, traced to Acceptance Criteria. NFR coverage is Phase 8's responsibility.

**Test Case specification schema:**

```json
{
  "test_case_id": "...",
  "type": "unit | integration | end_to_end",
  "acceptance_criterion_ids": ["..."],
  "component_ids": ["..."],
  "preconditions": ["..."],
  "inputs": {},
  "execution_steps": ["..."],
  "expected_outcome": "...",
  "edge_cases": ["..."],
  "implementation_notes": "Framework, assertion style, test data — specific enough for Executor Agent to implement without reinterpretation"
}
```

The `implementation_notes` field is the handoff contract to the Executor Agent. It must be specific enough that the Executor Agent knows framework, assertion style, and test data approach without re-interpreting the specification.

**Failed test routing (Phase 9.2):** Orchestrator invokes focused Reasoning Review on the failing test case against implementation evidence. Routing:
- Flaw in Test Case specification → re-invoke Test Design Agent for that Test Case only
- Flaw in implementation → re-invoke Executor Agent for the relevant Implementation Task
- Ambiguous → escalate to human

---

### 8.8 Implementation Planner Agent

**Nature:** CLI-backed Agent. Two-channel context model applies.

**Decomposition rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct implementation steps, each step is its own task with explicit `dependency_task_ids`.

**Complexity flagging:** Any task rated `estimated_complexity: high` must include `complexity_flag` with explanation. Surfaced in Phase 6 Mirror with per-task Menu.

**Standard Implementation Task schema — with `completion_criteria`:**

```json
{
  "id": "...",
  "task_type": "standard",
  "component_id": "...",
  "component_responsibility": "verbatim text from component_model",
  "description": "...",
  "technical_spec_ids": ["..."],
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "estimated_complexity": "low | medium | high",
  "complexity_flag": "explanation if high",
  "completion_criteria": [
    {
      "criterion_id": "...",
      "description": "Specific, mechanically verifiable condition",
      "verification_method": "schema_check | invariant | output_comparison | test_execution",
      "artifact_ref": "the artifact or field being checked"
    }
  ],
  "write_directory_paths": ["src/auth/"],
  "read_directory_paths": ["src/types/"],
  "data_model_entity_refs": ["User", "Session"],
  "configuration_parameter_refs": ["JWT_SECRET"],
  "interface_contract_refs": ["auth_service_api_v1"],
  "derived_from_record_ids": ["tech_spec_auth_001"],
  "path_estimates_are_estimated": true,
  "implementation_notes": "Specific guidance for Executor Agent"
}
```

**`completion_criteria` field:** Each criterion defines a specific, verifiable condition that constitutes task completion — independent of the agent's self-assessment. The `InvariantChecker` evaluates `schema_check` and `invariant` criteria deterministically before Reasoning Review. The Reasoning Review checks `output_comparison` criteria against the trace. `test_execution` criteria are verified during Phase 9.2.

**`component_responsibility` field:** Must carry verbatim text from the `component_model` artifact. This is the traceability link from task to architecture — paraphrasing is not permitted.

**Parallelism fields:** `write_directory_paths`, `read_directory_paths`, `data_model_entity_refs`, `configuration_parameter_refs`, `interface_contract_refs` are populated as directory-level estimates from the Technical Specification, flagged `path_estimates_are_estimated: true`. The Executor Agent refines to exact paths on completion. The Static Conflict Analyzer (future parallelism feature) will use these fields.

**Dependency graph:** Derived by the Orchestrator from `dependency_task_ids` fields at execution time. The Implementation Planner does not produce a separate graph artifact — the `implementation_plan` is the single source of truth.

**Refactoring Task schema:**

```json
{
  "id": "...",
  "task_type": "refactoring",
  "target_artifact_id": "governed_stream_record_id_of_prior_run_artifact",
  "target_workflow_run_id": "prior_workflow_run_id",
  "changed_interface_id": "interface_contract_or_api_definition_record_id",
  "description": "...",
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "expected_pre_state_hash": "sha256 of target file content before modification",
  "verification_step": "specific test or check that confirms refactor was applied correctly",
  "modification_type": "additive | breaking | non_breaking",
  "write_directory_paths": ["..."],
  "derived_from_record_ids": ["cross_run_impact_report_id"],
  "implementation_notes": "..."
}
```

**Refactoring Task idempotency protocol (Phase 9.1):**

On execution, Executor Agent checks `expected_pre_state_hash` against actual file content:
- **Match:** File unmodified — refactor not yet applied. Proceed with modification.
- **No match AND `verification_step` passes:** Refactor already applied successfully. Skip — record as `skipped_idempotent`.
- **No match AND `verification_step` fails:** File in indeterminate state. Immediate escalation to human — do not attempt modification.

After execution, a `cross_run_modification` Governed Stream Record is created for each Refactoring Task completed.

---

### 8.9 Eval Design Agent and Eval Execution Agent

**Eval Design Agent — Nature:** CLI-backed Agent. Two-channel context model applies.

**Receives:** `test_plan` (read-only input to ensure no duplication), `compliance_context` (required — compliance-related NFRs must have evaluation criteria).

**Produces three evaluation plans:**
- `functional_evaluation_plan` — criteria for Functional Requirements not already covered by the Test Plan
- `quality_evaluation_plan` — criteria mapped to Non-Functional Requirements, specifying tooling per criterion using tool inventory from `janumicode.config.json` supplemented by reasoning from Technical Specification stack. Includes `fallback_if_tool_unavailable` per criterion.
- `reasoning_evaluation_plan` — red-team scenarios and meta-eval checks for AI components in the product being built (if applicable)

Domain Compliance Reasoning Review is applied to evaluation plans.

**Eval Execution Agent — Nature:** CLI-backed Agent. Two-channel context model applies.

**Receives:** Evaluation Plans, Implementation Artifacts, and `evaluation_tools` configuration from `janumicode.config.json`.

**Action:** Runs all tooling specified in Evaluation Plans. Maps outputs to criteria. Captures results.

**Output Artifact:** `evaluation_results: {functional: [...], quality: [...], reasoning: [...]}`

---

### 8.10 Invariant Library

**Nature:** Deterministic, non-LLM validation. Runs via `InvariantChecker` before Reasoning Review for every artifact. No LLM call required. Fast and cheap — invariant failures cause immediate retry with the violation injected into stdin, bypassing the Reasoning Review entirely.

**Storage:** `.janumicode/schemas/invariants/{artifact_type}.invariants.json` — versioned with the JSON Schema library.

**Invariant record format:**

```json
{
  "invariant_id": "...",
  "artifact_type": "component_model",
  "description": "Human-readable description of what this invariant checks",
  "check_type": "field_presence | field_pattern | cross_field | count_minimum | forbidden_pattern",
  "specification": {
    "field_path": "components[*].responsibilities[*].statement",
    "pattern": "(?i)\\b(and|or)\\b",
    "forbidden": true,
    "message": "Component Responsibility statement contains a conjunction — split into separate responsibilities"
  },
  "severity": "blocking | warning",
  "phase_applies_to": ["4"],
  "introduced_in_sha": "..."
}
```

**Invariants by artifact type:**

| Artifact Type | Invariant | Check Type | Severity |
|---|---|---|---|
| `component_model` | No Component Responsibility statement contains conjunctions connecting distinct concerns | `forbidden_pattern` on `responsibilities[*].statement` | blocking |
| `component_model` | Every Component has at least one Responsibility | `count_minimum` per component | blocking |
| `functional_requirements` | Every User Story has at least one Acceptance Criterion with a measurable condition | `field_presence` + `field_pattern` | blocking |
| `interface_contracts` | Every Interface Contract specifies at least one error response code | `count_minimum` per contract | blocking |
| `api_definitions` | Every endpoint has an explicit authentication requirement | `field_presence` per endpoint | blocking |
| `implementation_plan` | Every Implementation Task has a non-empty `completion_criteria` | `count_minimum` | blocking |
| `implementation_plan` | No Implementation Task has zero `dependency_task_ids` unless it is the first task in its Component chain | `cross_field` | blocking |
| `test_plan` | Every Test Case has at least one `precondition` specified | `count_minimum` | blocking |
| `test_plan` | Every Acceptance Criterion from `functional_requirements` has at least one associated Test Case | `cross_field` | blocking |
| `quality_evaluation_plan` | Every Non-Functional Requirement has at least one criterion with a specified tool | `field_presence` per NFR | blocking |
| `system_requirements` | Every Functional Requirement has at least one System Requirement allocated | `cross_field` | blocking |
| `architectural_decisions` | Every ADR has status, decision, and rationale fields populated | `field_presence` | blocking |
| `data_models` | No entity has a field without a specified type | `field_presence` per field | blocking |

**Invariant Check output** — `invariant_check_record`:

```json
{
  "record_type": "invariant_check_record",
  "artifact_id": "...",
  "artifact_type": "...",
  "invariant_library_sha": "janumicode_version_sha at time of check",
  "checks_run": 8,
  "checks_passed": 7,
  "violations": [
    {
      "invariant_id": "...",
      "severity": "blocking | warning",
      "message": "...",
      "location": "field path in artifact"
    }
  ],
  "overall_pass": false,
  "produced_at": "..."
}
```

**On violation:** `InvariantChecker` returns the violation to the Orchestrator. The Orchestrator records an `invariant_violation_record`, marks the agent output as `quarantined: true`, injects the violation message into the retrying agent's stdin directive under `[JC:INVARIANT VIOLATION]`, and triggers retry without an LLM Reasoning Review call. The retry receives the specific violated invariant and its location — not a vague "try again" signal.

**Invariant Library extension:** New invariants are added by creating new `.invariants.json` files in `.janumicode/schemas/invariants/`. The `InvariantChecker` discovers all files in that directory at startup. Adding a new invariant does not require code changes — only a new JSON file versioned with the JanumiCode repository.

---

### 8.11 Client Liaison Agent

**Nature:** LLM API calls. Google Gemini thinking model. Always available. Two-channel context model does not apply — uses narrow purpose-built context.

**Query Type Taxonomy:**

| Query Type | Description | Example |
|---|---|---|
| Historical Lookup | Pure retrieval from Governed Stream history | "Did we decide not to use Neo4J?" |
| Consistency Challenge | Retrieval + comparison against current artifacts; may reveal active inconsistency | "I thought we decided X but I see Y being implemented" |
| Forward Implication Query | Traversal of Memory Edge graph to identify downstream impacts | "If we change the AuthService interface, what else is affected?" |
| Rationale Request | Retrieval of Decision Trace, ADR, and surrounding context | "Why are we doing it this way?" |
| Ambient Clarification | Simple artifact lookup and narrative explanation | "What is the AuthService supposed to do?" |

**Availability during Phase 9 execution:**
- Query Types 1, 4, 5 (Historical Lookup, Rationale Request, Ambient Clarification): respond immediately regardless of execution state
- Query Types 2, 3 (Consistency Challenge, Forward Implication Query): queue until current Sub-Phase completes

**When Consistency Challenge reveals active inconsistency:** Records `consistency_challenge_escalation` Governed Stream Record. Surfaces to Orchestrator. Orchestrator manages workflow response through bloom-and-prune escalation. Client Liaison Agent cannot unilaterally trigger rollbacks.

**Response requirements:** Every response includes Provenance Statements citing specific Governed Stream Record IDs. If retrieval finds nothing: says so clearly and offers structured paths forward. Never fabricates history.

---

### 8.12 Ingestion Pipeline

Every new Governed Stream Record passes through the Ingestion Pipeline before becoming available to retrieval. The pipeline is synchronous — it completes before the next Sub-Phase begins. Total cost: one LLM API call per new record (Stage III only).

**Stage I — Type Classification and Authority Assignment (deterministic):**
Assigns `authority_level`, `effective_at`, and initial `superseded_at: null` based on record type and Sub-Phase context per the taxonomy in Section 3.1.

**Stage II — Deterministic Edge Assertion (deterministic):**
Creates system Memory Edges based on record type rules. Examples:
- `phase_gate_approved` → `validates` edges to all referenced artifact IDs
- `mirror_edited` → `corrects` edge to the original mirror record
- `artifact_produced` → `derives_from` edges to its input artifact IDs
- `decision_trace` of type `prior_decision_override` → `supersedes` edge to the superseded record

The `derived_from_system_proposal` flag is propagated by the `GovernedStreamWriter` through Stage II when a new record derives from any record with Authority Level 1 that has not yet been explicitly approved.

**Stage III — Relationship Extraction (single LLM API call):**
Given the new record's content and a summary of related records retrieved via FTS5, identify candidate relationships. Output: proposed `memory_edge` records with `edge_type`, `target_record_id`, `confidence`. Written as `memory_edge_proposed` Governed Stream Records with `authority_level: 2`.

**Stage IV — Supersession Detection (deterministic with LLM escalation):**
Queries `memory_edge` table for existing records on the same subject. If new record's position conflicts with a prior record's position: if deterministic (explicit ADR relationship, same subject), assert `supersedes` edge automatically. If ambiguous, record as `proposed` for human confirmation at next Phase Gate Mirror.

**Stage V — Open Question Resolution Check (deterministic):**
Queries `memory_edge` table for `raises` edges targeting unresolved Open Questions. If new record appears to answer one, proposes `answers` edge with confidence score.

---

### 8.13 Mirror Generator

**Nature:** Deterministic template expansion + formatting. No LLM call required.

The Mirror Generator is a deterministic component of the Orchestrator that constructs Mirror artifacts from structured data. It does not use an LLM — it applies template rules to produce annotated, human-readable representations of agent output.

**Mirror construction rules:**

1. For each field in the artifact being mirrored: render the field label, value, and any annotations (System-Proposed Content flags, conflict annotations, Assumption flags)
2. System-Proposed Content items: render with `[SYSTEM-PROPOSED — requires explicit approval]` prefix and distinct visual styling (yellow background in webview)
3. Prior Decision conflicts: render with `[CONFLICTS WITH PRIOR DECISION — human resolution required]` prefix, citing the prior decision's record ID and Authority Level
4. Assumptions: render with `[ASSUMPTION — surfaced for review]` prefix
5. Invariant Violation context: if a prior retry produced an Invariant Violation, render the violation message at the top of the Mirror under `[PRIOR INVARIANT VIOLATION — resolved in this version]`

**Mirror metadata fields:**

```json
{
  "record_type": "mirror_presented",
  "artifact_id": "...",
  "artifact_type": "...",
  "system_proposed_content_count": 0,
  "prior_decision_conflict_count": 0,
  "assumption_count": 0,
  "rendered_field_count": 12,
  "produced_at": "..."
}
```

The Mirror is a read-only presentation. Human interaction happens through Menu selections, Mirror approval/rejection/edit, and Decision Traces — not through modifying the Mirror directly.

---

### 8.14 Memory Edge Lifecycle

Memory Edges progress through a defined lifecycle:

| Status | Meaning | Transition |
|---|---|---|
| `proposed` | Created by Ingestion Pipeline Stage III (LLM) or Stage IV/V (deterministic) | → `confirmed` by human at Phase Gate; → `rejected` by human |
| `confirmed` | Validated by human or elevated by deterministic rule | → `superseded` when a newer edge contradicts; → `invalidated` on rollback |
| `system_asserted` | Created by Ingestion Pipeline Stage II (deterministic rules) | Same lifecycle as `confirmed` — system assertions have Authority Level 5 |
| `rejected` | Human rejected a proposed edge | Terminal — remains for audit |
| `superseded` | A newer edge on the same subject replaced this edge | Terminal — remains for audit |
| `invalidated` | The source or target record was invalidated by rollback | Terminal — set by `DependencyClosureResolver` |

**Confirmation timing:** Proposed edges from Stage III are not individually confirmed by the human. Instead, at each Phase Gate Mirror, the Orchestrator presents a summary: "N new memory edges were proposed during this phase. [View details]". The human may review and reject specific edges. All non-rejected proposed edges are bulk-confirmed when the Phase Gate passes.

**Edge type vocabulary:**

| Edge Type | Direction | Meaning |
|---|---|---|
| `derives_from` | child → parent | The source record was produced using the target as input |
| `supersedes` | new → old | The source record replaces the target as governing position |
| `contradicts` | A ↔ B | The two records make incompatible claims |
| `validates` | gate → artifact | The Phase Gate certified the artifact |
| `corrects` | edited → original | The source is an edited version of the target |
| `raises` | record → question | The record identified an Open Question |
| `answers` | record → question | The record appears to resolve an Open Question |
| `implements` | artifact → spec | The Implementation Artifact implements the Technical Specification |
| `tests` | test_case → requirement | The Test Case verifies the Acceptance Criterion |

---

## 9. Prompt Template Library

### 9.1 Sub-Phase Invocation Rule

**Formalized:** Each Sub-Phase that produces a distinct artifact type is a separate Agent Invocation with its own:
- Context Payload construction (stdin + detail file)
- Execution Trace capture (`agent_reasoning_step`, `agent_self_correction`, `tool_call`, `tool_result` records)
- Invariant Check (before Reasoning Review)
- Reasoning Review (with Trace Selection)
- Governed Stream recording

**Exception:** Sub-Phases may share an Agent Invocation only when the artifacts produced are genuinely co-dependent and cannot be produced in sequence without circular dependency. This exception must be declared in the Prompt Template header:

```yaml
co_invocation_exception: true
co_invocation_rationale: "Data model and API definition are co-dependent — each requires the other to be fully specified"
co_invocation_artifact_types: ["data_models", "api_definitions"]
```

Exceptions are tracked and reviewed during spec upgrades — they represent technical debt in the decomposition.

### 9.2 Template Structure

```markdown
---
[JC:PROMPT TEMPLATE]
agent_role: executor_agent
sub_phase: 09_1_implementation_task_execution
schema_version: 1.2
co_invocation_exception: false
required_variables:
  - active_constraints
  - implementation_task
  - completion_criteria
  - technical_spec_summary
  - governing_adr_ids
  - compliance_context_summary
  - detail_file_path
  - janumicode_version_sha
reasoning_review_triggers:
  - implementation_divergence_check
  - completeness_shortcut_check
verification_ensemble_triggers:
  - implementation_divergence_check
---

[JC:SYSTEM SCOPE]
You are the [JC:Executor Agent] executing [JC:Implementation Task]: {{implementation_task.id}}

GOVERNING CONSTRAINTS (apply without exception):
{{active_constraints}}

COMPLETION CRITERIA (your output must satisfy all of these):
{{completion_criteria}}

GOVERNING ADRs (your implementation must not contradict these):
{{governing_adr_ids}}

REQUIRED OUTPUT: Implementation Artifacts per Technical Specification

CONTEXT SUMMARY:
Technical scope: {{technical_spec_summary}}
Compliance: {{compliance_context_summary}}

DETAIL FILE:
Complete supporting context at: {{detail_file_path}}
Consult for: full Technical Specifications, API Definitions, Data Models,
             Error Handling Strategies, prior implementation patterns.
Read sections relevant to your current reasoning step — not the entire file upfront.

[PRODUCT SCOPE]
Task: {{implementation_task.description}}
Component: {{implementation_task.component_id}}
Responsibility: {{implementation_task.component_responsibility}}
```

The `[JC:SYSTEM SCOPE]` section contains JanumiCode framework instructions — governing constraints, required output, detail file reference. The `[PRODUCT SCOPE]` section contains the specific task context for the product being built. These two scopes are always separated and prefixed.

### 9.3 Always-Prefixed JanumiCode Terms

`[JC:Phase]`, `[JC:Sub-Phase]`, `[JC:Agent Role]`, `[JC:Artifact]`, `[JC:Workflow Run]`, `[JC:Governed Stream]`, `[JC:Orchestrator]`, `[JC:Phase Gate]`, `[JC:Prompt Template]`, `[JC:Context Payload]`, `[JC:Execution Trace]`, `[JC:Trace Selection]`, `[JC:Reasoning Review]`, `[JC:Domain Compliance Reasoning Review]`, `[JC:Verification Ensemble]`, `[JC:Unsticking Agent]`, `[JC:Loop Detection Monitor]`, `[JC:Mirror]`, `[JC:Menu]`, `[JC:Decision Bundle]`, `[JC:Bloom]`, `[JC:Prune]`, `[JC:Context Packet]`, `[JC:Retrieval Brief]`, `[JC:Authority Level]`, `[JC:Memory Edge]`, `[JC:System-Proposed Content]`, `[JC:Refactoring Task]`, `[JC:Completion Criteria]`, `[JC:Invariant Check]`

### 9.4 Directory Structure

```
/.janumicode/prompts
  /phases
    /phase_00_workspace_init/
    /phase_00_5_cross_run_impact/
    /phase_01_intent_capture/
      /sub_phase_01_0_intent_quality_check/
      /sub_phase_01_1b_scope_bounding/
      /sub_phase_01_2_intent_domain_bloom/
      /sub_phase_01_3_mirror_and_menu/
      /sub_phase_01_4_intent_statement_synthesis/
    /phase_02_requirements/
      /sub_phase_02_1_functional_requirements/
      /sub_phase_02_2_nonfunctional_requirements/
      /sub_phase_02_3_mirror_and_menu/
      /sub_phase_02_4_consistency_check/
      /sub_phase_02_5_attestation/
    /phase_03_system_specification/
      /sub_phase_03_1_system_boundary/
      /sub_phase_03_2_system_requirements/
      /sub_phase_03_3_interface_contracts/
      /sub_phase_03_4_mirror_and_menu/
      /sub_phase_03_5_consistency_check/
    /phase_04_architecture/
      /sub_phase_04_1_software_domains/
      /sub_phase_04_2_component_decomposition/
      /sub_phase_04_3_adr_capture/
      /sub_phase_04_4_mirror_and_menu/
      /sub_phase_04_5_consistency_check/
    /phase_05_technical_specification/
      /sub_phase_05_1_data_models/
      /sub_phase_05_2_api_definitions/
      /sub_phase_05_3_error_handling/
      /sub_phase_05_4_configuration_parameters/
      /sub_phase_05_5_mirror_and_menu/
      /sub_phase_05_6_consistency_check/
    /phase_06_implementation_planning/
    /phase_07_test_planning/
    /phase_08_evaluation_planning/
    /phase_09_execution/
      /sub_phase_09_1_implementation_task/
      /sub_phase_09_2_test_execution/
      /sub_phase_09_3_eval_execution/
    /phase_10_commit/
  /cross_cutting
    reasoning_review.system.md
    reasoning_review_with_trace.system.md
    domain_compliance_review.system.md
    verification_ensemble_secondary.system.md
    narrative_memory.system.md
    decision_trace.system.md
    vocabulary_collision_check.system.md
    intent_quality_check.system.md
    scope_classification.system.md
    ingestion_pipeline_stage3.system.md
    unsticking_session_open.system.md
    unsticking_socratic_turn.system.md
    unsticking_detective_hypothesis.system.md
    unsticking_specialist_task.system.md
    unsticking_tool_result_review.system.md
    client_liaison_query_classification.system.md
    client_liaison_synthesis.system.md
    deep_memory_query_decomposition.system.md
    deep_memory_context_packet_synthesis.system.md
  /orchestrator
    phase_gate_evaluation.system.md
    rollback_recommendation.system.md
    context_payload_adequacy.system.md
    failed_test_fault_analysis.system.md
    cascade_threshold_bloom.system.md
    dependency_closure_confirmation.system.md
```

---

## 10. Configuration Schemas

### 10.1 `janumicode.config.json`

```json
{
  "schema_version": "1.2",
  "workspace_id": "<uuid>",
  "janumicode_version_sha": "<git-sha>",

  "agent_roster": {
    "domain_interpreter":          { "backing_tool": "...", "model_override": "..." },
    "requirements_agent":          { "backing_tool": "...", "model_override": "..." },
    "systems_agent":               { "backing_tool": "...", "model_override": "..." },
    "architecture_agent":          { "backing_tool": "...", "model_override": "..." },
    "technical_spec_agent":        { "backing_tool": "...", "model_override": "..." },
    "implementation_planner":      { "backing_tool": "...", "model_override": "..." },
    "executor_agent":              { "backing_tool": "claude_code_cli" },
    "test_design_agent":           { "backing_tool": "...", "model_override": "..." },
    "eval_design_agent":           { "backing_tool": "...", "model_override": "..." },
    "eval_execution_agent":        { "backing_tool": "...", "model_override": "..." },
    "consistency_checker":         { "backing_tool": "...", "model_override": "..." },
    "deep_memory_research":        { "backing_tool": "...", "model_override": "..." },
    "unsticking_agent":            {
      "backing_tool": "direct_llm_api",
      "provider": "google",
      "model": "gemini-2.5-flash"
    },
    "client_liaison":              {
      "backing_tool": "direct_llm_api",
      "provider": "google",
      "model": "gemini-2.5-flash"
    },
    "orchestrator":                { "reasoning_llm_provider": "...", "reasoning_model": "..." }
  },

  "llm_routing": {
    "reasoning_review": {
      "primary":                   { "provider": "google", "model": "gemini-2.5-flash" },
      "trace_inclusion": {
        "enabled":                          true,
        "self_corrections_always_included": true,
        "tool_calls_invocation_included":   true,
        "tool_results_excluded":            true,
        "tool_results_exclusion_reason":    "context_window_constraint",
        "reasoning_steps_selection":        "first_last_pre_decision_pre_self_correction",
        "executor_agent_all_steps_if_budget": true,
        "trace_max_tokens":                 16000
      },
      "async_review_for_independent_tasks": true,
      "fallback": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
      "max_retries": 3,
      "ensemble": {
        "enabled":              true,
        "triggers":             ["phase_gate_evaluation", "implementation_divergence_check"],
        "secondary":            { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
        "disagreement_action":  "escalate_to_human"
      }
    },
    "domain_compliance_review":    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "note": "Different provider from primary reasoning_review to reduce correlated errors"
    },
    "narrative_memory":            { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "decision_trace":              { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "vocabulary_collision_check":  { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "intent_quality_check":        { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "scope_classification":        { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "ingestion_pipeline_stage3":   { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "loop_detection_monitor":      { "implementation": "deterministic" }
  },

  "governed_stream": {
    "sqlite_path":        ".janumicode/governed_stream.db",
    "vector_extension":   "sqlite-vec",
    "embedding_model":    { "provider": "...", "model": "..." },
    "sensitive_content_patterns": [],
    "sanitize_tool_results": false
  },

  "context_assembly": {
    "cli_agents": {
      "stdin_max_tokens":                       8000,
      "detail_file_path_template":              ".janumicode/context/{sub_phase_id}_{invocation_id}.md",
      "detail_file_cleanup":                    "archive_after_phase_gate",
      "detail_file_max_bytes":                  10485760,
      "governing_constraints_always_in_stdin":  true,
      "hard_stop_on_governing_constraint_overflow": true
    }
  },

  "invariant_library": {
    "path":                       ".janumicode/schemas/invariants",
    "run_before_reasoning_review": true,
    "blocking_violation_action":  "quarantine_and_retry_with_violation"
  },

  "workflow": {
    "max_retry_attempts_per_subphase":  3,
    "loop_detection_threshold":         3,
    "require_human_approval_all_phase_gates": true,
    "rollback_closure_max_artifacts":   50,
    "records_idle_stall_ms":            900000
  },

  "decomposition": {
    "depth_cap":                        10,
    "budget_cap":                       500,
    "fanout_cap":                       8,
    "mirror_gate_depth":                2,
    "reasoning_review_on_tier_c":       false
  },

  "tool_availability": {
    "executor_agent": {
      "backing_tool": "claude_code_cli",
      "available_tools": ["Read", "Write", "Edit", "Bash", "Search", "WebSearch", "ListFiles"]
    }
  },

  "deep_memory_research": {
    "materiality_weights": {
      "semantic_similarity":    0.20,
      "constraint_relevance":   0.25,
      "authority_level":        0.20,
      "temporal_recency":       0.15,
      "causal_relevance":       0.10,
      "contradiction_signal":   0.10
    }
  },

  "cross_run_refactoring": {
    "cascade_threshold_task_count": 10,
    "cascade_threshold_file_count": 20
  },

  "evaluation_tools": {
    "linter":             "eslint",
    "type_checker":       "tsc",
    "security_scanner":   "npm_audit",
    "performance":        "k6",
    "accessibility":      "lighthouse"
  },

  "git": {
    "remote":         "origin",
    "commit_branch":  "main"
  }
}
```

**Config loading order (deep-merge):** `DEFAULT_CONFIG` (compiled into `src/lib/config/defaults.ts`) is loaded first; if `<workspace>/.janumicode/config.json` exists, its values are deep-merged on top of defaults. This lets operators override any leaf without restating the full config. Per-workspace overrides are the standard mechanism for calibration runs (see §10.3 — calibration script override convention).

#### 10.1.1 Environment Variable Overrides

Runtime tunables that should vary per deployment or per calibration session are read from environment variables. These override both `DEFAULT_CONFIG` and `config.json`:

| Env Var | Default | Purpose |
|---|---|---|
| `JANUMICODE_LLM_MAX_LOG_FILE_BYTES` | `1572864` (1.5 MB) | Per-LLM-invocation log-file size cap; retryable abort when exceeded. See §8.5 Streaming Stall Detection Protocol. |
| `JANUMICODE_EMBEDDING_URL` | `http://127.0.0.1:11434` | Ollama base URL for Wave 6 assumption dedup embeddings. |
| `JANUMICODE_EMBEDDING_MODEL` | `qwen3-embedding:8b` | Embedding model id for dedup. |
| `JANUMICODE_EMBEDDING_CONNECT_TIMEOUT_MS` | `2000` | TCP-connect timeout for the embedding client. |
| `JANUMICODE_EMBEDDING_IDLE_TIMEOUT_MS` | `60000` | Idle timeout for the embedding client. |
| `JANUMICODE_ASSUMPTION_DEDUP_DISABLED` | unset | Set to `1` to disable assumption dedup (emergency fallback — saturation will use raw `delta_from_previous_pass` as the termination signal). |

#### 10.1.2 Ollama Provider — Model-Family Sampling Profiles

The Ollama provider (`src/lib/llm/providers/ollama.ts`) applies family-specific sampling defaults based on the model name prefix. This keeps model-specific tuning co-located with the provider rather than scattered across call sites:

| Family | Detection | num_ctx | Sampling params | think |
|---|---|---|---|---|
| **Qwen3** | model name starts with `qwen` | 262144 | `temperature: 1`, `presence_penalty: 1.5`, `top_k: 20`, `top_p: 0.95` | `true` |
| **Gemma 3/4** | model name starts with `gemma` | **131072** (128K ceiling) | `temperature: 1`, `top_k: 64`, `top_p: 0.95` | `true` |
| other | — | 262144 | `temperature: options.temperature ?? 0.7` | `false` |

`options.responseFormat === 'json'` is **skipped** for thinking-family models (Qwen, Gemma) because Ollama merges the thinking + response into a single `thinking` field when `format: 'json'` is set, losing the ability to judge both the reasoning chain and the structured output. Thinking-family prompts must request JSON via prompt instruction and the caller parses response text directly.

#### 10.1.3 Calibration-Run Overrides (Local Development)

The `scripts/wave6-calibration-run.js` driver patches the per-workspace `config.json` with calibration-specific overrides before invoking the CLI:

```jsonc
{
  "decomposition": {
    "reasoning_review_on_tier_c": true   // enable Step 4c audits
    // "budget_cap": 5000              // optional: raise via --budget-cap <N>
  },
  "llm_routing": {
    "reasoning_review": {
      "primary": { "provider": "ollama", "model": "gemma4:e4b" },
      "temperature": 1,
      "trace_max_tokens": 8000
    }
  }
}
```

This routes Step 4c Reasoning Review at local Ollama gemma4:e4b (128K context) for hermetic calibration without consuming external API credits; production runs continue to use Google gemini-2.5-flash as the default.

### 10.2 `janumicode.specialists.json`

```json
{
  "schema_version": "1.0",
  "specialists": [
    {
      "id": "...",
      "name": "...",
      "description": "...",
      "problem_class": ["..."],
      "backing_tool": "...",
      "provider": "...",
      "model": "...",
      "invocation_config": {
        "max_turns": 5,
        "max_tokens_per_turn": 4000
      }
    }
  ]
}
```

### 10.3 Test-and-Evaluation Path Convention

All generated test and evaluation artifacts — harness workspaces, per-run calibration workspaces, prompt-probe outputs, and auxiliary reports — live under a dedicated `test-and-evaluation/` directory at the repository root, gitignored as a unit:

```
janumicode_v2/
├── test-and-evaluation/              # gitignored
│   ├── test-workspace/               # E2E harness workspace (hermetic CI target)
│   ├── calibration-workspaces/       # per-run cal workspaces
│   │   ├── calibration-workspace-cal-9/
│   │   └── calibration-workspace-cal-10/
│   └── prompt-probe-output/          # probe runner emits here
```

Tooling that writes to this tree:
- VS Code E2E harness configs (`.vscode-test.mjs`, `.vscode-test.harness.mjs`) open `test-and-evaluation/test-workspace/` as the dev-host workspace.
- `package.json` `test:harness` script runs the CLI against `test-and-evaluation/test-workspace/`.
- `scripts/wave6-calibration-run.js --tag <tag>` auto-creates `test-and-evaluation/calibration-workspaces/calibration-workspace-<tag>/` when `--workspace` is omitted.
- `src/test/prompt-probes/probeRunner.ts` emits to `test-and-evaluation/prompt-probe-output/`.

Test FIXTURES (captured LLM inputs + gold files for regression comparison) live separately under `src/test/fixtures/` — those are tracked in git and do NOT move under this convention. Test artifacts (generated output, not input) do.

---

## 11. Governed Stream Database Schema

**SQLite Concurrency Model:** JanumiCode uses SQLite in WAL (Write-Ahead Logging) mode with `PRAGMA journal_mode=WAL;` set at database creation. This allows concurrent readers during writes. All writes go through the single `GovernedStreamWriter` class — there is no concurrent write scenario in the extension process. The sidecar process (for native module access) communicates with the extension via JSON-RPC; the extension serializes all write requests.

**Connection pooling:** A single read-write connection is held by `GovernedStreamWriter`. Read-only connections are created as needed by `ContextBuilder`, `DependencyClosureResolver`, and search operations. All connections set `PRAGMA busy_timeout=5000;` to handle brief contention during WAL checkpoints.

```sql
-- Universal record store — the Governed Stream (lossless)
CREATE TABLE governed_stream (
  id                            TEXT PRIMARY KEY,
  record_type                   TEXT NOT NULL,
  schema_version                TEXT NOT NULL,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT,
  sub_phase_id                  TEXT,
  produced_by_agent_role        TEXT,
  produced_by_record_id         TEXT,
  produced_at                   TEXT NOT NULL,
  effective_at                  TEXT,
  janumicode_version_sha        TEXT NOT NULL,
  authority_level               INTEGER NOT NULL DEFAULT 2,
  derived_from_system_proposal  INTEGER DEFAULT 0,
  is_current_version            INTEGER DEFAULT 1,
  superseded_by_id              TEXT,
  superseded_at                 TEXT,
  superseded_by_record_id       TEXT,
  source_workflow_run_id        TEXT NOT NULL,
  derived_from_record_ids       TEXT,
  quarantined                   INTEGER DEFAULT 0,
  sanitized                     INTEGER DEFAULT 0,
  sanitized_fields              TEXT,
  content                       TEXT NOT NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Workflow Run registry
CREATE TABLE workflow_runs (
  id                                TEXT PRIMARY KEY,
  workspace_id                      TEXT NOT NULL,
  janumicode_version_sha            TEXT NOT NULL,
  initiated_at                      TEXT NOT NULL,
  completed_at                      TEXT,
  status                            TEXT NOT NULL,
  current_phase_id                  TEXT,
  current_sub_phase_id              TEXT,
  raw_intent_record_id              TEXT,
  scope_classification_ref          TEXT,
  compliance_context_ref            TEXT,
  cross_run_impact_triggered        INTEGER DEFAULT 0,
  -- Phase 1.0a Intent Lens Classification result.
  -- One of 'product' | 'feature' | 'bug' | 'infra' | 'legal' | 'unclassified'.
  -- Null until 1.0a runs. Drives lens-conditional sub-phase topology.
  intent_lens                       TEXT,
  -- Wave 6 decomposition telemetry. Updated at the end of each
  -- saturation-loop invocation. The _fr / _nfr columns persist
  -- separately so a completed FR loop does NOT clobber NFR's
  -- baseline on resume; the aggregate column is the sum for
  -- display-convenience.
  decomposition_budget_calls_used   INTEGER DEFAULT 0,
  decomposition_fr_calls_used       INTEGER DEFAULT 0,
  decomposition_nfr_calls_used      INTEGER DEFAULT 0,
  decomposition_max_depth_reached   INTEGER DEFAULT 0,
  -- Phase 1.8 active Release Plan — governed_stream row id of the
  -- approved release_plan record for this run. Null until 1.8
  -- completes. Read by Phase 2+ via
  -- stateMachine.getWorkflowRun(runId).active_release_plan_record_id.
  active_release_plan_record_id     TEXT
);

-- Phase Gate completion registry
CREATE TABLE phase_gates (
  id                            TEXT PRIMARY KEY,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT NOT NULL,
  sub_phase_id                  TEXT,
  completed_at                  TEXT NOT NULL,
  human_approved                INTEGER NOT NULL,
  approval_record_id            TEXT NOT NULL,
  domain_attestation_confirmed  INTEGER DEFAULT 0,
  invalidated_by_rollback_at    TEXT,
  verification_ensemble_used    INTEGER DEFAULT 0,
  narrative_memory_id           TEXT,
  decision_trace_id             TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Retry and loop detection
CREATE TABLE sub_phase_execution_log (
  id                            TEXT PRIMARY KEY,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT NOT NULL,
  sub_phase_id                  TEXT NOT NULL,
  attempt_number                INTEGER NOT NULL,
  started_at                    TEXT NOT NULL,
  completed_at                  TEXT,
  status                        TEXT NOT NULL,
  loop_status                   TEXT,
  tool_call_loop_detected       INTEGER DEFAULT 0,
  unsticking_session_id         TEXT
);

-- Agent Invocation trace index
-- Links each invocation to its complete Execution Trace records
CREATE TABLE agent_invocation_trace (
  invocation_record_id          TEXT NOT NULL,
  trace_record_id               TEXT NOT NULL,
  trace_record_type             TEXT NOT NULL,
  sequence_position             INTEGER NOT NULL,
  PRIMARY KEY (invocation_record_id, trace_record_id),
  FOREIGN KEY (invocation_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (trace_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX ait_invocation ON agent_invocation_trace(invocation_record_id);
CREATE INDEX ait_record_type ON agent_invocation_trace(invocation_record_id, trace_record_type);

-- Memory Edge table
CREATE TABLE memory_edge (
  id                            TEXT PRIMARY KEY,
  source_record_id              TEXT NOT NULL,
  target_record_id              TEXT NOT NULL,
  edge_type                     TEXT NOT NULL,
  asserted_by                   TEXT NOT NULL,
  asserted_at                   TEXT NOT NULL,
  authority_level               INTEGER NOT NULL,
  confidence                    REAL,
  status                        TEXT NOT NULL DEFAULT 'proposed',
  workflow_run_id               TEXT,
  notes                         TEXT,
  FOREIGN KEY (source_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (target_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX memory_edge_source   ON memory_edge(source_record_id);
CREATE INDEX memory_edge_target   ON memory_edge(target_record_id);
CREATE INDEX memory_edge_type     ON memory_edge(edge_type);
CREATE INDEX memory_edge_asserted ON memory_edge(asserted_by, authority_level);

-- Detail file registry
CREATE TABLE detail_files (
  id                            TEXT PRIMARY KEY,
  invocation_id                 TEXT NOT NULL,
  sub_phase_id                  TEXT NOT NULL,
  file_path                     TEXT NOT NULL,
  archived_path                 TEXT,
  generated_at                  TEXT NOT NULL,
  archived_at                   TEXT,
  status                        TEXT NOT NULL
);

-- Schema version registry
CREATE TABLE schema_versions (
  artifact_type                 TEXT NOT NULL,
  schema_version                TEXT NOT NULL,
  introduced_in_sha             TEXT NOT NULL,
  is_current                    INTEGER DEFAULT 1,
  breaking_change_from_version  TEXT,
  PRIMARY KEY (artifact_type, schema_version)
);

-- FTS5 full-text search with BM25
CREATE VIRTUAL TABLE governed_stream_fts USING fts5(
  id UNINDEXED,
  record_type,
  content,
  content='governed_stream',
  content_rowid='rowid'
);

-- sqlite-vec vector search
CREATE VIRTUAL TABLE governed_stream_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[1536]
);

-- Traceability reference index
CREATE TABLE record_references (
  source_record_id              TEXT NOT NULL,
  target_record_id              TEXT NOT NULL,
  reference_type                TEXT NOT NULL,
  created_at                    TEXT NOT NULL,
  PRIMARY KEY (source_record_id, target_record_id, reference_type)
);

-- File system write tracking
CREATE TABLE file_system_writes (
  id                            TEXT PRIMARY KEY,
  agent_invocation_id           TEXT NOT NULL,
  implementation_task_id        TEXT,
  workflow_run_id               TEXT NOT NULL,
  operation                     TEXT NOT NULL,
  file_path                     TEXT NOT NULL,
  file_sha256_before            TEXT,
  file_sha256_after             TEXT,
  produced_at                   TEXT NOT NULL,
  reverted_at                   TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX fsw_workflow ON file_system_writes(workflow_run_id);
CREATE INDEX fsw_task ON file_system_writes(implementation_task_id);
CREATE INDEX fsw_path ON file_system_writes(file_path);

-- LLM API call tracking
CREATE TABLE llm_api_calls (
  id                            TEXT PRIMARY KEY,
  role                          TEXT NOT NULL,
  provider                      TEXT NOT NULL,
  model                         TEXT NOT NULL,
  attempt_number                INTEGER NOT NULL DEFAULT 1,
  status                        TEXT NOT NULL,
  error_type                    TEXT,
  error_message                 TEXT,
  started_at                    TEXT NOT NULL,
  completed_at                  TEXT,
  input_tokens                  INTEGER,
  output_tokens                 INTEGER,
  workflow_run_id               TEXT,
  sub_phase_id                  TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX lac_workflow ON llm_api_calls(workflow_run_id);
CREATE INDEX lac_status ON llm_api_calls(status);
```

### 11.1 Key Design Decisions

**`quarantined` column:** Set by `GovernedStreamWriter` when Reasoning Review finds `severity: high`. Quarantined records are excluded from retry Context Payloads by `ContextBuilder`. Available in full to the Unsticking Agent and for audit. Never deleted.

**`sanitized` and `sanitized_fields` columns:** Applied to `tool_result` records when `governed_stream.sanitize_tool_results: true` and content matches `sensitive_content_patterns`. Sanitization is pre-storage — the sanitized version is what all downstream roles see. `sanitized: true` flags the record so audit trails remain complete.

**`agent_invocation_trace` table:** The execution trace index. Links each `agent_invocation` record to all its trace records (`agent_reasoning_step`, `agent_self_correction`, `tool_call`, `tool_result`) with sequence position. The `ContextBuilder` queries this table with a filter on `trace_record_type` to construct Trace Selections efficiently — e.g., `WHERE invocation_record_id = ? AND trace_record_type IN ('agent_self_correction', 'tool_call', 'agent_reasoning_step')`. Tool results are retrieved separately only by the Unsticking Agent.

**`verification_ensemble_used` on `phase_gates`:** Records whether the Verification Ensemble was triggered for this Phase Gate evaluation. Used for audit and for identifying Phase Gates where provider disagreement was resolved by human.

**`tool_call_loop_detected` on `sub_phase_execution_log`:** Set by the Loop Detection Monitor when identical tool call sequences or tool call thrashing is detected within a single invocation — deterministic, no LLM call required.

**`derived_from_system_proposal` column:** Propagated by `GovernedStreamWriter` through Ingestion Pipeline Stage II. Any record derived from a Level 1 record that has not yet been explicitly approved carries this flag. Agents receiving records with this flag are instructed in their stdin directive to treat the content as provisional.

**`domain_attestation_confirmed` on `phase_gates`:** Records that the human explicitly attested to domain correctness of requirements at Phase 2 Phase Gate. Checked by Phase 10 Consistency Checker.

**`cross_run_impact_triggered` on `workflow_runs`:** Records whether Phase 0.5 was triggered for this run. Used by Phase 10 to verify all Refactoring Tasks have `cross_run_modification` records.

**`detail_files` table:** Tracks all generated detail files — their path, archive path, and status. Enables the Unsticking Agent to locate prior context files and enables audit of what context was available during each Agent Invocation.

**Dependency Closure Rollback:** The `DependencyClosureResolver` component queries `memory_edge` recursively for all `derives_from` edges from the target artifact. The complete closure is presented to the human before any rollback executes.

---

## 12. JSON Schema Library Structure

```
/.janumicode/schemas
  /artifacts
    workspace_classification.schema.json
    ingested_artifact_index.schema.json
    ingestion_gap_list.schema.json
    ingestion_conflict_list.schema.json
    prior_decision_summary.schema.json
    collision_risk_report.schema.json
    intent_quality_report.schema.json
    scope_classification.schema.json
    compliance_context.schema.json
    intent_bloom.schema.json
    intent_statement.schema.json
    cross_run_impact_report.schema.json
    refactoring_scope.schema.json
    functional_requirements.schema.json
    non_functional_requirements.schema.json
    consistency_report.schema.json
    system_boundary.schema.json
    system_requirements.schema.json
    interface_contracts.schema.json
    software_domains.schema.json
    component_model.schema.json
    architectural_decisions.schema.json
    data_models.schema.json
    api_definitions.schema.json
    error_handling_strategies.schema.json
    configuration_parameters.schema.json
    implementation_plan.schema.json
    test_plan.schema.json
    test_coverage_report.schema.json
    functional_evaluation_plan.schema.json
    quality_evaluation_plan.schema.json
    reasoning_evaluation_plan.schema.json
    test_results.schema.json
    evaluation_results.schema.json
    pre_commit_consistency_report.schema.json
    commit_record.schema.json
    workflow_run_summary.schema.json
  /memory
    context_packet.schema.json
    retrieval_brief.schema.json
    narrative_memory.schema.json
    decision_trace_summary.schema.json
    reasoning_review_record.schema.json
    reasoning_review_ensemble_record.schema.json
    domain_compliance_review_record.schema.json
    invariant_check_record.schema.json
    invariant_violation_record.schema.json
    loop_detection_record.schema.json
    unsticking_resolution.schema.json
    unsticking_escalation.schema.json
    unsticking_tool_result_review.schema.json
    memory_edge_proposed.schema.json
    memory_edge_confirmed.schema.json
    cross_run_modification.schema.json
    technical_debt_record.schema.json
    detail_file_generated.schema.json
    open_query_received.schema.json
    query_classification_record.schema.json
    client_liaison_response.schema.json
    consistency_challenge_escalation.schema.json
    schema_gap_record.schema.json
    version_upgrade_card.schema.json
    ingestion_pipeline_record.schema.json
    ingestion_pipeline_failure.schema.json
    file_system_write_record.schema.json
    file_system_revert_record.schema.json
    refactoring_hash_recomputed.schema.json
    refactoring_skipped_idempotent.schema.json
    cycle_detected_record.schema.json
    warning_acknowledged.schema.json
    warning_batch_acknowledged.schema.json
    llm_api_failure.schema.json
    llm_api_recovery.schema.json
    complexity_flag_resolution.schema.json
    cascade_threshold_decision.schema.json
    verification_ensemble_disagreement.schema.json
    quarantine_override.schema.json
  /invariants
    component_model.invariants.json
    functional_requirements.invariants.json
    interface_contracts.invariants.json
    api_definitions.invariants.json
    implementation_plan.invariants.json
    test_plan.invariants.json
    quality_evaluation_plan.invariants.json
    system_requirements.invariants.json
    architectural_decisions.invariants.json
    data_models.invariants.json
  /configuration
    janumicode.config.schema.json
    janumicode.specialists.schema.json
  /meta
    schema_registry.json
```

**Invariant Library extension:** New invariants are added by creating or modifying `.invariants.json` files. The `InvariantChecker` discovers all files in `.janumicode/schemas/invariants/` at startup. No code changes required — only JSON files versioned with the JanumiCode repository.

---

## 13. Version Management and Upgrade Protocol

### 13.1 Version Pinning

Every Workflow Run pins `janumicode_version_sha` at initiation. The Run operates under that version's schemas, prompt templates, and invariants for its entire duration. Version changes are checked at Phase Gates via the Schema Compatibility Check.

### 13.2 Sub-Phase Idempotency

Every Sub-Phase must be idempotent — if JanumiCode crashes and restarts, the Orchestrator reads current state from the Governed Stream and resumes from the last completed Sub-Phase. Refactoring Tasks are explicitly idempotent by design — the `expected_pre_state_hash` and `verification_step` fields provide the idempotency guarantee.

### 13.3 effective_at Assignment Rules

The `effective_at` field is assigned by Ingestion Pipeline Stage I. It differs from `produced_at` in the following cases:

| Record Type | `effective_at` value |
|---|---|
| `decision_trace` | Timestamp when the human made the selection (may precede `produced_at` if there was processing delay) |
| `mirror_edited` | Timestamp when the human submitted the edit |
| `phase_gate_approved` | Timestamp when the human clicked approve |
| `rollback_authorized` | Timestamp when the human confirmed rollback |
| `cross_run_modification` | `produced_at` of the original prior-run artifact being modified |
| `ingested_artifact_index` entries | Original creation timestamp of the Existing Artifact (if available from file system metadata) |
| All other record types | Same as `produced_at` |

The distinction matters for the Deep Memory Research Agent's temporal ordering: `effective_at` determines when the underlying event happened; `produced_at` determines when JanumiCode recorded it. Temporal recency scoring (Section 8.4 Stage 3) uses `effective_at`.

### 13.4 Upgrade Detection and Resolution

When JanumiCode is upgraded during an active Workflow Run:

1. At the next Phase Gate, the `SchemaValidator` runs a Schema Compatibility Check comparing current artifact schema versions against the new version's `schema_registry.json`
2. If schema gaps exist, `schema_gap_record` entries are produced
3. A `version_upgrade_card` is presented to the human with: version delta summary, schema gaps, new invariants introduced, breaking changes
4. Human decides: proceed with upgrade, rollback to Phase boundary, or pause and resolve gaps

### 13.5 Invariant Library Versioning

Invariant files are versioned with the JanumiCode repository via `janumicode_version_sha`. The Schema Compatibility Check at version upgrades includes invariant file changes — a new blocking invariant introduced in a new version may cause previously accepted artifacts to fail on re-check. This is intentional and documented: new invariants represent tightened correctness guarantees. The Version Upgrade Card includes a summary of new invariants added since the prior version.

### 13.6 Upgrade Friction Acknowledgment

JanumiCode's version management is designed with a bias toward stability over freshness. A Workflow Run should not encounter unexpected behavior due to a version change. The cost is that Workflow Runs started before an upgrade do not automatically benefit from improvements until they reach a Phase Gate and the human accepts the upgrade.

### 13.7 Rollback Within a Run

The Orchestrator can propose a rollback to a prior Phase boundary. This uses Dependency Closure Rollback (Section 5.3). All records between the current state and the rollback target are marked `is_current_version: false`. The rollback is recorded as a `rollback_authorized` Decision Trace. The human must explicitly approve the full dependency closure.

If JanumiCode is upgraded between the start and completion of a Phase 0.5 refactoring scope, the Refactoring Tasks retain their pre-computed hashes from the prior version. The Schema Compatibility Check at the next Phase Gate includes Refactoring Task schema fields in its comparison.

---

## 14. Deferred Items

| Item | Deferred To | Notes |
|---|---|---|
| Governed Stream UI card taxonomy | Bloom-and-prune design session | Card types, states, grouping rules, prominence hierarchy, and interaction affordances to be specified via bloom-and-prune |
| CI/CD integration | Post-MVP | Phase 10 closes with `commit_record`. CI/CD trigger deferred. |
| Parallel Implementation Task execution | Medium/Enterprise phase | Infrastructure in place via dependency graph and task schema fields. Requires Static Conflict Analyzer and Merge Orchestrator. |
| Static Conflict Analyzer | Medium/Enterprise phase | Option C (hybrid conservative): artifact-reference-based analysis with conservative fallback |
| Merge Orchestrator | Medium/Enterprise phase | Options B + A: Optimistic Locking with Post-Execution Consistency Check as safety net |
| Multi-workspace / large team coordination | Enterprise phase | Advanced coordination across shared code areas |
| External tool export | Large team / Enterprise phase | All records owned by JanumiCode. Export capability deferred. |
| Enterprise integrations (Slack, email) | Enterprise phase | Client Liaison and Deep Memory Research designed to accommodate via `all_runs_plus_external` scope |
| Mid-size engineering org features | Phase 2 product | Standards governance, team role differentiation, approval workflows |
| Domain-specific workflow profiles | Post-MVP | Optimized vocabulary and phase gate nuances for mobile, embedded, SaaS, AI/ML |
| UI/UX specification phase | Post-MVP | For consumer-facing interfaces: optional Phase 2.5 (Interface Design) producing user flow artifacts, wireframe specifications, component library selections. Triggered when Product Concept includes consumer-facing interfaces. Interim: `compliance_context` flag `interface_requirements: consumer_facing` prompts richer Use Cases from Requirements Agent. |
| Kùzu graph database migration | If SQLite edge tables insufficient | Phase 1: SQLite `memory_edge`. Phase 2 if needed: Kùzu |
| Learned reranker for materiality scoring | Post-MVP | Current hand-tuned weights in config. Learned reranker when sufficient history accumulated. |
| Learned invariant detection | Post-MVP | ML-based detection of invariant patterns from Governed Stream history — would generate new invariant candidates for human review |
| Tool result inclusion in Reasoning Review | If context windows grow sufficiently | Currently excluded by design due to context window constraints. If models with large enough windows become available, `tool_results_excluded` can be set to `false` in config with no other changes required. |
| Telemetry and usage analytics | Post-MVP | Opt-in anonymous usage metrics (phase completion times, retry rates, failure mode distribution) for improving default configurations |
| Multi-model A/B testing for Reasoning Review | Post-MVP | Compare Reasoning Review quality across providers automatically; requires consistent evaluation framework |
| Prompt Template versioning UI | Post-MVP | Visual diff and rollback for Prompt Template changes; currently managed via git only |
| Offline mode | Post-MVP | Queue LLM API calls when network is unavailable; resume when connectivity returns. Deterministic operations continue offline. |

---

## 15. Appendix — Key Record Schemas

### 15.1 Reasoning Review Record (v1.2)

```json
{
  "record_type": "reasoning_review_record",
  "schema_version": "1.2",
  "overall_pass": true,
  "trace_selection_record_ids": ["..."],
  "tool_results_excluded": true,
  "trace_sampling_applied": false,
  "trace_stride_n": null,
  "flaws": [
    {
      "flaw_type": "unsupported_assumption | invalid_inference | circular_logic | scope_violation | premature_convergence | false_equivalence | authority_confusion | completeness_shortcut | contradiction_with_prior_approved | unacknowledged_uncertainty | implementability_violation | implementation_divergence | tool_result_misinterpretation_suspected",
      "severity": "high | low",
      "description": "...",
      "evidence": "specific passage from trace or output",
      "governing_adr_id": "... (implementation_divergence only)",
      "completion_criteria_id": "... (completeness_shortcut only)",
      "recommended_action": "retry | escalate | accept_with_caveat | return_to_phase4 | escalate_to_unsticking"
    }
  ],
  "reviewed_output_record_id": "...",
  "sub_phase_id": "...",
  "produced_at": "..."
}
```

### 15.2 Invariant Check Record

```json
{
  "record_type": "invariant_check_record",
  "schema_version": "1.0",
  "artifact_id": "...",
  "artifact_type": "...",
  "invariant_library_sha": "janumicode_version_sha at time of check",
  "checks_run": 8,
  "checks_passed": 7,
  "violations": [
    {
      "invariant_id": "...",
      "severity": "blocking | warning",
      "message": "...",
      "location": "field path in artifact"
    }
  ],
  "overall_pass": false,
  "produced_at": "..."
}
```

### 15.3 Decision Trace Summary

```json
{
  "artifact_type": "decision_trace_summary",
  "schema_version": "1.1",
  "workflow_run_id": "...",
  "phase_id": "...",
  "phase_name": "...",
  "decisions": [
    {
      "decision_id": "...",
      "sub_phase_id": "...",
      "decision_type": "menu_selection | mirror_approval | mirror_rejection | mirror_edit | phase_gate_approval | rollback_authorization | unsticking_escalation_resolution | prior_decision_override | system_proposal_approval | system_proposal_rejection | domain_attestation | cascade_threshold_decision | complexity_flag_resolution",
      "governed_stream_record_id": "...",
      "timestamp": "...",
      "context_presented": "...",
      "options_presented": ["..."],
      "human_selection": "...",
      "human_edit_content": "...",
      "rationale_captured": "...",
      "superseded_record_id": "... (prior_decision_override only)",
      "domain_attestation_confirmed": false,
      "system_proposal_content": "... (system_proposal_approval/rejection only)"
    }
  ],
  "decision_count": 0,
  "rollback_count": 0,
  "prior_decision_override_count": 0,
  "system_proposal_approval_count": 0,
  "unsticking_escalation_count": 0,
  "domain_attestation_confirmed": false
}
```

### 15.4 Implementation Task with completion_criteria

```json
{
  "id": "...",
  "task_type": "standard",
  "component_id": "...",
  "component_responsibility": "verbatim text from component_model",
  "description": "...",
  "technical_spec_ids": ["..."],
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "estimated_complexity": "low | medium | high",
  "complexity_flag": "explanation if high",
  "completion_criteria": [
    {
      "criterion_id": "...",
      "description": "Specific, mechanically verifiable condition",
      "verification_method": "schema_check | invariant | output_comparison | test_execution",
      "artifact_ref": "the artifact or field being checked"
    }
  ],
  "write_directory_paths": ["src/auth/"],
  "read_directory_paths": ["src/types/"],
  "data_model_entity_refs": ["User", "Session"],
  "configuration_parameter_refs": ["JWT_SECRET"],
  "interface_contract_refs": ["auth_service_api_v1"],
  "derived_from_record_ids": ["tech_spec_auth_001"],
  "path_estimates_are_estimated": true,
  "implementation_notes": "..."
}
```

### 15.5 Refactoring Task

```json
{
  "id": "...",
  "task_type": "refactoring",
  "target_artifact_id": "...",
  "target_workflow_run_id": "...",
  "changed_interface_id": "...",
  "description": "...",
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "expected_pre_state_hash": "sha256_of_file_before_modification",
  "verification_step": "specific test or check confirming refactor was applied correctly",
  "modification_type": "additive | breaking | non_breaking",
  "write_directory_paths": ["..."],
  "derived_from_record_ids": ["cross_run_impact_report_id"],
  "implementation_notes": "..."
}
```

### 15.6 Cross-Run Modification Record

```json
{
  "record_type": "cross_run_modification",
  "schema_version": "1.0",
  "current_workflow_run_id": "...",
  "prior_workflow_run_id": "...",
  "modified_artifact_id": "...",
  "modification_type": "additive | breaking | non_breaking",
  "rationale_record_id": "...",
  "refactoring_task_id": "...",
  "verification_passed": true,
  "produced_at": "..."
}
```

### 15.7 Verification Ensemble Record

```json
{
  "record_type": "reasoning_review_ensemble_record",
  "schema_version": "1.0",
  "trigger": "phase_gate_evaluation | implementation_divergence_check",
  "primary_review_record_id": "...",
  "secondary_review_record_id": "...",
  "primary_provider": "google",
  "secondary_provider": "anthropic",
  "primary_overall_pass": true,
  "secondary_overall_pass": false,
  "agreement": false,
  "agreement_type": "full | severity_disagreement | overall_disagreement",
  "severity_disagreements": [
    {
      "flaw_type": "implementation_divergence",
      "primary_severity": "high",
      "secondary_severity": "low"
    }
  ],
  "disagreement_action": "escalate_to_human",
  "escalation_record_id": "...",
  "produced_at": "..."
}
```

### 15.8 Unsticking Tool Result Review

```json
{
  "record_type": "unsticking_tool_result_review",
  "schema_version": "1.0",
  "unsticking_session_id": "...",
  "agent_invocation_id": "...",
  "tool_result_record_ids_examined": ["..."],
  "misinterpretation_confirmed": true,
  "discrepancy": {
    "tool_call_id": "...",
    "agent_stated_conclusion": "The file contained configuration X",
    "actual_tool_result_summary": "The file contained configuration Y",
    "impact": "Agent implemented based on incorrect configuration"
  },
  "correction_injected": "Correct interpretation of tool result injected into next Socratic turn",
  "produced_at": "..."
}
```

### 15.9 Intent Quality Report

```json
{
  "artifact_type": "intent_quality_report",
  "schema_version": "1.0",
  "completeness_findings": [
    {
      "field": "mission",
      "status": "absent",
      "severity": "high",
      "explanation": "No mission statement provided — cannot be inferred from Raw Intent"
    }
  ],
  "consistency_findings": [
    {
      "elements_in_conflict": ["element A", "element B"],
      "explanation": "...",
      "severity": "blocking"
    }
  ],
  "coherence_findings": [
    {
      "concern": "...",
      "explanation": "...",
      "severity": "warning"
    }
  ],
  "overall_status": "pass | requires_input | blocking",
  "system_proposal_offered_for": ["mission", "vision"]
}
```

### 15.10 File System Write Record

```json
{
  "record_type": "file_system_write_record",
  "schema_version": "1.0",
  "agent_invocation_id": "...",
  "implementation_task_id": "...",
  "workflow_run_id": "...",
  "operation": "create | modify | delete",
  "file_path": "src/auth/handler.ts",
  "file_sha256_before": "null if create",
  "file_sha256_after": "sha256 of written content",
  "produced_at": "..."
}
```

### 15.11 LLM API Failure Record

```json
{
  "record_type": "llm_api_failure",
  "schema_version": "1.0",
  "role": "reasoning_review | narrative_memory | domain_compliance_review | orchestrator | deep_memory_research | ingestion_pipeline_stage3",
  "provider": "google | anthropic | openai",
  "model": "...",
  "error_type": "rate_limit | service_unavailable | auth_error | schema_error | model_error | context_exceeded | runaway_thinking | network_timeout",
  "http_status": 429,
  "error_message": "...",
  "retry_attempt": 1,
  "max_retries": 3,
  "fallback_available": true,
  "workflow_run_id": "...",
  "sub_phase_id": "...",
  "produced_at": "..."
}
```

### 15.12 Warning Acknowledged Record

```json
{
  "record_type": "warning_acknowledged",
  "schema_version": "1.0",
  "finding_id": "...",
  "consistency_report_id": "...",
  "phase_id": "...",
  "acknowledged_at": "...",
  "produced_at": "..."
}
```

```json
{
  "record_type": "warning_batch_acknowledged",
  "schema_version": "1.0",
  "finding_ids": ["..."],
  "consistency_report_id": "...",
  "phase_id": "...",
  "acknowledged_at": "...",
  "produced_at": "..."
}
```

### 15.13 Intent Lens Classification *(Phase 1.0a)*

```json
{
  "kind": "intent_lens_classification",
  "lens": "product | feature | bug | infra | legal | unclassified",
  "confidence": 0.92,
  "rationale": "The intent frames a new product...",
  "fallback_lens": "product"
}
```

Written as `artifact_produced` with `sub_phase_id: '1.0a'`. Persisted on the Workflow Run via `workflow_runs.intent_lens = lens`.

### 15.14 Requirement Decomposition Node *(Wave 6)*

```json
{
  "kind": "requirement_decomposition_node",
  "node_id":          "550e8400-e29b-41d4-a716-446655440000",
  "parent_node_id":   "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "display_key":      "FR-ACCT-1.1",
  "root_fr_id":       "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "depth":            2,
  "pass_number":      3,
  "status":           "pending | decomposed | atomic | pruned | deferred | downgraded",
  "tier":             "A | B | C | D",
  "root_kind":        "fr | nfr",
  "user_story": {
    "id":             "FR-ACCT-1.1",
    "role":           "...",
    "action":         "...",
    "outcome":        "...",
    "acceptance_criteria": [
      { "id": "AC-001", "description": "...", "measurable_condition": "..." }
    ],
    "priority":       "critical | high | medium | low",
    "traces_to":      ["UJ-1", "VV-3"]
  },
  "decomposition_rationale":     "Why this child is a cohesive commitment...",
  "surfaced_assumption_ids":     ["A-0124"],
  "atomic_criteria_satisfied":   { "ac_testable": true, "single_operation": true, "regime_cited": true, "assumptions_listed": true },
  "pruning_reason":              "human-rejected | budget_cap_reached | depth_cap_reached | tier_downgrade: ...",
  "release_id":                  "<release UUID or null = backlog>",
  "release_ordinal":             2
}
```

**Identity:** `node_id` is a minted UUID — stable across revisions (pending → downgraded → pruned etc.). The governed_stream row `id` is per-revision; `node_id` is the **logical** identity. Supersession by logical id enforces exactly-one-current-version (§5.2.1).

**Presentation:** `display_key` is the human label — the LLM's `user_story.id` with a `#<4-hex>` sibling-collision suffix applied when multiple siblings under the same parent emit the same label. All user-facing output (logs, markdown export, webview cards, prompt interpolations) uses `display_key`; all tree joins use `node_id` / `parent_node_id`.

**Release propagation:** `release_id` + `release_ordinal` are inherited from the parent at write time. Depth-0 roots resolve via `traces_to` → journey → Release match against the approved Release Plan (lowest-ordinal release wins on tie; no match → Backlog with `release_id: null`). Preserved across supersession revisions.

### 15.15 Requirement Decomposition Pipeline *(Wave 6)*

```json
{
  "kind": "requirement_decomposition_pipeline",
  "pipeline_id":     "decomp-pipe-fr-d3a6c2f5",
  "root_fr_id":      "*",
  "passes": [
    {
      "pass_number":        1,
      "status":             "completed",
      "started_at":         "2026-04-22T16:30:00.000Z",
      "completed_at":       "2026-04-22T16:35:00.000Z",
      "nodes_produced":     58,
      "assumption_delta":   49,
      "termination_reason": "fixed_point"
    }
  ],
  "final_leaf_count":  535,
  "final_max_depth":   4,
  "total_llm_calls":   434
}
```

One per root_kind per run. Updated incrementally via `writer.supersedByRollback` as each pass completes — the latest version is the canonical view. `root_fr_id` is the kind marker: `*` for FR, `*nfr*` for NFR. The final record after the loop terminates carries the aggregate telemetry (`final_leaf_count`, `final_max_depth`, `total_llm_calls`) and the final-pass `termination_reason`.

### 15.16 Assumption Set Snapshot *(Wave 6)*

```json
{
  "kind": "assumption_set_snapshot",
  "pass_number":              3,
  "root_fr_id":               "*",
  "assumptions": [
    {
      "id":                   "A-0124",
      "text":                 "GAAP double-entry applies.",
      "source":               "decomposition | handoff | bloom | human",
      "surfaced_at_node":     "<logical UUID>",
      "surfaced_at_pass":     3,
      "category":             "domain_regime | constraint | compliance | scope | open_question",
      "citations":            ["handoff:requirement:REQ-1.2"],
      "duplicate_of":         "A-0031",
      "duplicate_similarity": 0.94
    }
  ],
  "delta_from_previous_pass": 17,
  "semantic_delta":           12
}
```

One per saturation-loop pass per root_kind. `delta_from_previous_pass` is the raw new-row count; `semantic_delta` subtracts assumptions flagged `duplicate_of` (cosine similarity ≥ 0.92 against prior-pass embeddings). Saturation termination reads `semantic_delta`; `delta_from_previous_pass` is audit.

### 15.17 Release Plan *(Phase 1.8)*

```json
{
  "kind": "release_plan",
  "schemaVersion": "1.0",
  "releases": [
    {
      "release_id":            "<UUID>",
      "ordinal":               1,
      "name":                  "Home Real Property Assistant",
      "description":           "Homeowners can match to verified service providers...",
      "rationale":             "Solves the #1 pain point; required foundation for Release 2.",
      "traces_to_journeys":    ["UJ-1", "UJ-2"],
      "traces_to_domains":     ["DOM-HOME"]
    }
  ],
  "approved":      true,
  "approval_note": "Human validated release order; accepted all three releases."
}
```

Written as `artifact_produced` with `sub_phase_id: '1.8'`. Only records with `approved: true` drive Phase 2 assignment; iterations during the feedback loop write additional `approved: false` records for audit. The active plan is pinned on the Workflow Run via `workflow_runs.active_release_plan_record_id`. `release_id` is a server-minted UUID (the LLM's `REL-N` short form is discarded at write time).

### 15.18 Tier-C AC-Shape Audit *(Wave 6 Step 4c)*

```json
{
  "kind": "tier_c_ac_shape_audit",
  "parent_node_id":     "<parent logical UUID>",
  "parent_display_key": "FR-COMMITMENT",
  "pass_number":        3,
  "children_reviewed":  ["FR-IMPL-1", "FR-IMPL-2"],
  "findings": [
    {
      "child_id":  "FR-IMPL-1",
      "verdict":   "verification | policy | ambiguous",
      "rationale": "AC threshold is testable against system output."
    }
  ],
  "summary":        "1 of 2 children have policy-shaped ACs.",
  "policy_count":   1
}
```

Written as a `reasoning_review_record` (content carries `kind: 'tier_c_ac_shape_audit'`). Advisory only — no automatic tree changes. Consumed by gap-report generators to surface residual Tier-B mislabels that Step 4b could not detect via the tier-distribution signal.

---

## 16. CLI Agent Invocation Protocol

This section specifies how CLI-backed agents are invoked, how their output is parsed, and how self-correction is detected.

### 16.1 Invocation Model

All CLI-backed agents (Executor Agent, Architecture Agent, Test Design Agent, etc.) are invoked through a uniform protocol:

1. The `OrchestratorEngine` constructs the Context Payload (stdin + detail file) per Section 7.2
2. The `CLIInvoker` spawns the backing tool as a child process
3. stdin content is piped to the process
4. stdout is consumed as a stream
5. The `OutputParser` (configured per backing tool) maps stdout events to Governed Stream Records in real time
6. On process exit, the `CLIInvoker` records the final status

**Backing tool command construction:**

| Backing Tool | Command Template |
|---|---|
| `claude_code_cli` | `claude -p "<escaped_prompt>" --output-format stream-json` |
| `gemini_cli` | `gemini --prompt "<escaped_prompt>" --format json` |
| `direct_llm_api` | No CLI — direct API call via `LLMCaller` |

### 16.2 Output Parser Configuration

Each backing tool has a configured `OutputParser` that maps its stdout format to JanumiCode record types:

```json
{
  "backing_tool": "claude_code_cli",
  "output_format": "stream-json",
  "record_mapping": {
    "assistant": "agent_reasoning_step",
    "tool_use": "tool_call",
    "tool_result": "tool_result",
    "result": "artifact_produced"
  },
  "self_correction_detection": {
    "method": "consecutive_tool_use_same_target",
    "description": "Two consecutive tool_use events targeting the same file path with different content indicates self-correction"
  }
}
```

**Self-correction detection rules:**

| Pattern | Classification |
|---|---|
| Agent writes to file A, then writes to file A again before any other file write | `agent_self_correction` — the second write corrects the first |
| Agent runs a test, test fails, agent modifies code | `agent_self_correction` — the modification responds to test failure |
| Agent reads a file, then re-reads the same file within 3 tool calls | Not self-correction — information gathering |
| Agent explicitly states "I need to fix..." or "That was wrong..." in reasoning | `agent_self_correction` — explicit acknowledgment |

### 16.3 Streaming Protocol

The `CLIInvoker` processes stdout as a stream of JSON events (for `stream-json` format tools):

1. Each line of stdout is parsed as a JSON object
2. The `OutputParser` classifies the event using `record_mapping`
3. A Governed Stream Record is created immediately via `GovernedStreamWriter`
4. The record is linked to the current `agent_invocation_trace` with incrementing `sequence_position`
5. The webview receives a real-time update via the event bus

**Backpressure:** If `GovernedStreamWriter` cannot keep up with stdout events (SQLite write contention), events are buffered in memory up to `cli_invocation.buffer_max_events` (default: 1000). If the buffer fills, the CLIInvoker pauses stdin to the child process (if supported) or logs a warning.

### 16.4 Process Lifecycle

| Event | Action |
|---|---|
| Process spawned | Record `agent_invocation_started` with PID, backing tool, stdin hash |
| Process exits with code 0 | Record `agent_invocation_completed`; trigger Invariant Check → Reasoning Review |
| Process exits with non-zero code | Record `agent_invocation_failed`; Orchestrator evaluates: retry (transient) or escalate (persistent) |
| Process exceeds `cli_invocation.timeout_seconds` (default: 600) | Send SIGTERM; wait 10s; SIGKILL if still running; record `agent_invocation_timeout`; escalate to human |
| Process produces no stdout for `cli_invocation.idle_timeout_seconds` (default: 120) | Record `agent_invocation_idle_warning`; continue waiting up to `timeout_seconds` |

### 16.5 Configuration

Add to `janumicode.config.json`:

```json
"cli_invocation": {
  "timeout_seconds": 600,
  "idle_timeout_seconds": 120,
  "buffer_max_events": 1000,
  "output_parsers": {
    "claude_code_cli": {
      "output_format": "stream-json",
      "record_mapping": {
        "assistant": "agent_reasoning_step",
        "tool_use": "tool_call",
        "tool_result": "tool_result",
        "result": "artifact_produced"
      }
    }
  }
}
```

---

## 17. VS Code Extension UI Contract

This section specifies the functional requirements for the VS Code extension's user interface — the primary surface through which the human interacts with JanumiCode.

### 17.1 Webview Architecture

The UI is a single VS Code sidebar webview panel (`GovernedStreamViewProvider`) rendered as a scrollable stream of cards. The webview communicates with the extension host via `postMessage` / `onDidReceiveMessage`.

**Rendering model:** Server-side HTML generation. The extension host constructs full HTML strings from Governed Stream Records and sends them to the webview. The webview's JavaScript handles only: scroll management, expand/collapse interactions, form submissions, and find-in-page.

**No client-side state:** The webview holds no state. On webview restore (e.g., after VS Code restart), the extension host re-renders the full stream from the Governed Stream database.

### 17.2 Card Types

Every Governed Stream Record renders as a card. Card type is determined by `record_type`:

| Card Category | Record Types | Visual Treatment |
|---|---|---|
| **Phase Milestone** | `phase_started`, `phase_gate_approved` | Full-width divider with phase name and number; distinct background color |
| **Agent Output** | `artifact_produced`, `agent_reasoning_step` | Collapsible card with agent role color accent; artifact content in structured format |
| **Human Interaction** | `mirror_presented`, `menu_presented`, `decision_trace` | Interactive card with form elements (buttons, checkboxes, text areas); blue accent |
| **Review Result** | `reasoning_review_record`, `invariant_check_record`, `consistency_report` | Pass/fail badge; collapsible flaw list; red accent for failures |
| **Decomposition Node** | `requirement_decomposition_node` | Tree-indented card; shows `display_key` as primary identifier (with `node_id` UUID in hover tooltip); tier badge (A/B/C/D or Root); status chip (`atomic` / `pending` / `pruned` / `deferred` / `downgraded`); depth badge; expandable AC list; release badge (`Release N` or `Backlog`). Children rendered nested via `getDecompositionChildren(node_id)`. Superseded revisions folded under a "+history" counter. |
| **Decomposition Pipeline** | `requirement_decomposition_pipeline` | One composite card per root_kind — renders all 7 saturation-loop passes as status rows with per-pass `nodes_produced` + `semantic_delta`; expandable to show each root's tree via nested DecompositionNodeCards. Container card suppresses per-node and per-snapshot cards at top level (they render inside this card via `recordsStore.isOwnedByDecompositionPipeline`). |
| **Release Plan** *(deferred to v2)* | `release_plan` | Card listing the approved releases with ordinal, name, description, rationale, traces_to_journeys. v1 uses the generic `artifact_produced` rendering; a dedicated editable card with reorder / rename / merge / split / move-journey operations is a v2 deliverable (see `docs/release_prioritization_design.md`). |
| **System Event** | `llm_api_failure`, `ingestion_pipeline_record`, `file_system_write_record` | Compact card; gray accent; collapsible detail |
| **Unsticking** | `unsticking_session_open`, `unsticking_socratic_turn`, `unsticking_resolution` | Purple accent; conversation thread layout |
| **Warning/Error** | `warning_acknowledged`, `ingestion_pipeline_failure` | Yellow (warning) or red (error) accent bar |

### 17.3 Mirror and Menu Interaction

**Mirror rendering:** The Mirror Generator (Section 8.13) produces structured data. The webview renders each field as a labeled row. System-Proposed Content items have a yellow background and a checkbox for approval.

**Menu rendering:** Each Menu option is a button. Selecting a button submits a `postMessage` to the extension host, which records the `decision_trace`. Multi-select Menus use checkboxes. Free-text input uses a textarea.

**Phase Gate approval:** The approve button is disabled until:
- All `consistency_report.warnings` are individually acknowledged (or bulk-acknowledged)
- All System-Proposed Content items have explicit approval or rejection
- No `severity: high` Reasoning Review flaws are unresolved

**Inline editing:** When the human edits a Mirror, the webview sends the edited content to the extension host. The extension host records a `mirror_edited` Governed Stream Record with `corrects` edge to the original.

### 17.4 Real-Time Updates

During agent execution (Phase 9), the webview receives real-time updates:

- `agent_reasoning_step` records appear as they are produced (streaming)
- `tool_call` records show tool name and parameters
- `tool_result` records show a summary (first 200 chars) with expand option
- `agent_self_correction` records are highlighted with an orange accent

The event bus (`eventBus.ts`) emits `workflow:command` events. The webview's `postMessage` handler appends new cards without re-rendering the full stream.

### 17.5 Scroll and Navigation

- **Auto-scroll:** Enabled by default during active execution. Disabled when user scrolls up manually. Re-enabled when user clicks "Jump to latest" button.
- **Phase navigation:** A floating sidebar shows phase numbers. Clicking a phase number scrolls to that phase's milestone card.
- **Find in page:** Custom find widget (Ctrl+F in webview) with minimum 2-character query, 250ms debounce, max 500 matches.
- **Card collapse state:** Persisted in webview session memory. Not persisted across VS Code restarts.

### 17.6 Accessibility

- All interactive elements have ARIA labels
- Color is never the sole indicator of state — icons and text labels accompany color accents
- Keyboard navigation: Tab through cards; Enter to expand/collapse; Space to select Menu options
- Screen reader: Card content is structured with headings and semantic HTML

### 17.7 Decomposition Viewer *(Wave 8)*

A separate VS Code custom editor — distinct from the sidebar GovernedStreamPanel — provides a high-level, real-time visualization of the requirements-decomposition tree as it is being produced or has been produced for any given Workflow Run.

**Registration:**
- Custom editor view type: `janumicode.decompViewer`.
- Activated via filename pattern `*.janumicode-decomp` (the URI scheme `janumicode-decomp-viewer:` is opened by the `janumicode.openDecompViewer` command).
- Discoverable via two surfaces:
  - **Status-bar button** — `$(list-tree) Decomp` icon, always visible when an extension instance is active.
  - **Command palette** — `JanumiCode: Open Decomposition Viewer`.

**Architecture:**
- `CustomReadonlyEditorProvider` — read-only by design (the viewer is a window into the governed stream, not a mutator).
- Webview bundle compiled separately at `dist/webview/decompViewer.js` (Svelte 5, runes mode).
- DB attachment via `better-sqlite3` opened with `{ readonly: true, fileMustExist: true }` so the viewer can attach to a calibration workspace's live DB without contending with the live writer (SQLite WAL allows concurrent readers).
- Polling cadence configurable via `janumicode.decompViewer.pollIntervalMs` (default `3000`). Each tick computes a SHA-256 revision hash over load-bearing snapshot fields (`nodes` + `assumptions` + `pipeline.passes` + `roots`); the snapshot is pushed to the webview only when the hash changes (no work-thrash on idle DBs).

**Snapshot shape (extension-host → webview message):**
- `totals: { nodes, roots, atomic, pending, pruned, deferred, downgraded, assumptions, duplicate_assumptions }`
- `nodes[]: ViewerDecompositionNode` — one entry per `requirement_decomposition_node` (latest revision), with derived fields `tier`, `tier_hint`, `tier_rationale`, `display_key`, `parent_display_key`, `children_display_keys[]`, `surfaced_assumption_ids[]`, `acceptance_criteria[]`, `traces_to[]`, `release_id`, `release_ordinal`, `pruning_reason`, `downgrade_reason`.
- `roots[]: ViewerRootSummary` — one per FR/NFR root with `display_key`, `root_kind`, `node_count_total`, `release_id` / `release_ordinal`.
- `assumptions[]: ViewerAssumption` — flat list across all snapshots, with `category`, `text`, `citations[]`, `surfaced_at_pass`, `surfaced_at_node`, `duplicate_of`, `duplicate_similarity`.
- `pipelines[]: ViewerPipelineSummary` — one per `requirement_decomposition_pipeline`, with per-pass `pass_number`, `status`, `nodes_produced`, `assumption_delta`, `started_at`, `completed_at`, plus `termination_reason`.
- `releases[]: ViewerRelease` — denormalized release entries from the active `release_plan` (`approved: true`).

**Visualization (Multi-Level Accordion per `docs/requirements viewer/decomp-viewer-visualization.md`):**
- Layout: 240 px **release rail** (left) | 1 fr **tree view** (center) | 400 px **detail drawer** (right). Top **header** with active-tab switch (Tree / Assumptions / Summary). Tab content swaps in the center column.
- **TreeView** renders one card per FR/NFR root with a 3 px primary-tinted left-edge status bar (`--jc-primary` for FR roots, `--jc-tertiary` for NFR roots). Children expand inline by depth via `expandedRoots` / `expandedTierBands` Svelte stores.
- **NodeRow** carries: tier badge (A/B/C/D), display_key (mono), story_action snippet, priority chip, surfaced-assumption count chip, MMP control toolbar (`role="toolbar"` — disabled in v1, reserved for accept/reject/defer/edit).
- **DetailDrawer** (right) shows the selected node's full user_story, acceptance_criteria, traces_to chips, surfaced assumptions, children list, and disabled MMP grid.
- **AssumptionsPanel** (Assumptions tab) — searchable across `id`, `text`, `category`, with filters for category dropdown and `onlyDuplicates` checkbox.
- **SummaryStrip** (Summary tab) — totals grid, by-tier histogram (A/B/C/D + null), by-depth distribution, root-size histogram (sorted), per-pipeline pass trajectory with start/end timestamps.
- **FilterBar** — text search + tier / status / priority / release multi-select chips + clear button. Filters apply across TreeView + AssumptionsPanel.

**Visual-design tokens:** the viewer uses the `--jc-*` design-token system (`docs/visual design/DESIGN.md`): tonal background steps (`--jc-surface`, `--jc-surface-container-low`, `-container`, `-container-high`, `-container-highest`, `-bright`) for hierarchy, "No-Line" rule (separation through tonal step, no internal borders), 3 px primary-tinted left-edge status bar pattern for selection, Editorial Contrast typography (Space Grotesk for headlines and tabular numerics, Inter for body, Source Code Pro for mono), max 6 px radius, `font-variant-numeric: tabular-nums` on counts.

---

*JanumiCode Master Product Specification — Version 2.5 (Consolidated)*
*All sections subject to revision through bloom-and-prune with human approval.*
*Deferred items catalogued in Section 14.*
*Consolidated from v2.0–v2.5 with all "Identical to" references resolved.*
