# JanumiCode Master Product Specification

**Version 2.2 — Implementation-Ready**

*Changes from v2.1: Execution Trace Capture for Reasoning Review (§6, §8.1, §8.5, §10); Verification Ensemble for Phase Gates and implementation_divergence checks (§8.1, §10); completion_criteria field on Implementation Tasks (§8.7, §15); Invariant Library with pre-LLM deterministic filters (§7.1, §8.9, §12); one Agent Invocation per distinct artifact type per Sub-Phase formalized (§9); MDAP scope clarification in Three-Layer Correctness Model (§1.6); quarantined flag for failed high-severity Reasoning Review outputs (§7.6, §11); Decision Sequencing Protocol and Verification Ensemble configuration additions (§10).*

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

All [JC:Prompt Templates], schema fields, agent instructions, and UI labels must use these terms exclusively.

### Layer 0 — Meta / System Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Governed Stream** | The single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. The system of record for everything — lossless. | "Artifact Store", "chat history", "log", "database" |
| **Governed Stream Record** | A single entry in the Governed Stream | "message", "event", "entry" |
| **Workflow Run** | A single end-to-end JanumiCode execution for a specific [JC:Intent Statement] | "session", "project run", "pipeline run" |
| **Artifact** | A Governed Stream Record whose `record_type` designates it as a schema-validated JSON document produced as a required phase output | "output", "result", "document", "response" |
| **Workspace** | The VS Code workspace within which JanumiCode operates | "project", "repo", "codebase" |
| **janumicode_version_sha** | The git commit SHA of the JanumiCode repository pinned at Workflow Run initiation | "version", "build number" |
| **Context Payload — Stdin** | The directive channel of an Agent Invocation — governing constraints, required output specification, and summary context injected via stdin to a CLI-backed agent | "context", "prompt" (unqualified) |
| **Context Payload — Detail File** | The reference channel of an Agent Invocation — a generated filesystem file containing full evidentiary detail the CLI-backed agent may consult | "context file", "detail document" |
| **Detail File Path** | The deterministic filesystem path: `.janumicode/context/{sub_phase_id}_{invocation_id}.md` | "context path", "file location" |
| **Execution Trace** | The complete ordered set of Governed Stream Records produced during a single Agent Invocation — including reasoning steps, self-corrections, tool call invocations, and the final output. Tool results are captured in the Governed Stream but excluded from the Reasoning Review context by design. | "agent log", "run trace", "agent history" |
| **Trace Selection** | The structured subset of the Execution Trace provided to the Reasoning Review — always includes all self-corrections and tool call invocations; selects reasoning steps by rule; excludes tool results | "trace subset", "context selection" |

### Layer 1 — Human Intent Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Raw Intent** | The initial, underspecified human input that initiates a Workflow Run | "prompt", "request", "input", "query" |
| **Intent Domain** | The subject matter area(s) the Raw Intent addresses at a conceptual level | "domain" (unqualified), "subject", "topic" |
| **Intent Statement** | The locked, agent-elaborated, human-approved specification of what the human means | "finalized prompt", "confirmed intent" |
| **Assumption** | An inference made by an agent about something not explicitly stated; must always be surfaced and approved | "implication", "inference", "default" |
| **Constraint** | A condition the solution must satisfy | "requirement" (at this layer), "limitation" |
| **Open Question** | An ambiguity that cannot be resolved without human judgment | "unclear point", "unknown", "TBD" |
| **System-Proposed Content** | Content generated by an agent to fill a structurally required field left absent from the Raw Intent — Authority Level 1 until explicitly approved; carries `derived_from_system_proposal: true` | "hallucinated content", "invented content" |
| **Compliance Context** | A structured artifact identifying domain-specific compliance regimes applicable to the product being built | "compliance requirements", "regulatory context" |
| **Scope Classification** | The Orchestrator's assessment of a Raw Intent's breadth and depth | "scope", "project size" |

### Layer 2 — Business / Organization Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 3 — Product / Requirements Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 4 — Systems Engineering Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 5 — Architecture Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 6 — Technical Design Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 7 — Implementation Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Implementation Plan** | An ordered sequence of Implementation Tasks derived from Technical Specifications | "sprint plan", "task list", "backlog" |
| **Implementation Task** | A single, atomic unit of work for an Executor Agent — scoped to one Component and one Component Responsibility, with explicit `completion_criteria` | "ticket", "task", "story" (at this layer) |
| **Completion Criteria** | A set of specific, mechanically verifiable conditions that constitute an Implementation Task's completion — checked by the Reasoning Review independently of the agent's self-assessment | "done criteria", "acceptance criteria" (use Acceptance Criterion for requirements-level) |
| **Refactoring Task** | A specialized Implementation Task that modifies Implementation Artifacts from a prior Workflow Run. Carries idempotency fields. | "fix task", "update task", "migration" |
| **Executor Agent** | The Agent Role responsible for code generation and file system changes | "coder", "developer agent", "code agent" |
| **Implementation Artifact** | Any file produced or modified by an Executor Agent | "code", "file", "output" (at implementation layer) |

### Layer 8 — Testing Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 9 — Evaluation Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Evaluation Plan** | An artifact specifying quality attribute assessment beyond functional testing | "eval plan", "assessment plan" |
| **Functional Evaluation** | Assessment of Functional Requirements not covered by the Test Plan | "functional testing" (at eval layer) |
| **Quality Evaluation** | Assessment of non-functional properties | "NFR testing", "quality assessment" |
| **Reasoning Review** | A focused LLM API call that inspects an agent's Execution Trace — reasoning steps, self-corrections, tool call invocations, and final output — against the complete flaw taxonomy. Tool results are excluded by design due to context window constraints; this is a known accepted tradeoff. | "QA check", "review step", "LLM review" |
| **Domain Compliance Reasoning Review** | An additional Reasoning Review pass checking an artifact against confirmed compliance regimes | "compliance check", "regulatory review" |
| **Verification Ensemble** | Two Reasoning Review calls on the same output using different model providers — triggered at Phase Gate evaluations and `implementation_divergence` checks. Disagreement between providers escalates to human. | "voting", "ensemble review" |
| **Reasoning Flaw** | A specific, named defect in agent reasoning — see Section 8.1 for complete taxonomy | "error", "mistake", "hallucination" (too vague) |
| **Invariant Check** | A deterministic, non-LLM validation of an artifact against its Invariant Library rules — runs before Reasoning Review | "schema check", "rule check" |
| **Invariant Violation** | A deterministic finding that an artifact fails a rule in its Invariant Library | "schema error", "rule failure" |

### Layer 10 — Agent and Orchestration Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Agent Role** | A named, specification-defined function in JanumiCode | "agent", "bot", "assistant" (unqualified) |
| **Backing Tool** | The CLI or API used to execute an Agent Role | "LLM", "model", "provider" (at role level) |
| **Agent Invocation** | A single call to an Agent Role's Backing Tool, producing an Execution Trace captured in the Governed Stream | "agent call", "LLM call", "tool call" |
| **Prompt Template** | A versioned, parameterized instruction set for the stdin directive | "system prompt", "prompt", "instruction" |
| **Orchestrator** | The TypeScript OrchestratorEngine class | "coordinator", "manager", "controller" |
| **Phase** | A mandatory, named stage of a Workflow Run | "step", "stage", "workflow stage" |
| **Sub-Phase** | A named, ordered step within a Phase. Each Sub-Phase producing a distinct artifact type is a separate Agent Invocation with its own Execution Trace and Reasoning Review. | "step", "task" (at orchestration layer) |
| **Phase Gate** | The validation checkpoint at the end of a Phase | "checkpoint", "gate", "review point" |
| **Phase Gate Criterion** | A single verifiable condition for Phase Gate passage | "gate condition", "completion criterion" |
| **Bloom Phase** | Sub-Phase expanding underspecified input into a candidate space | "expansion", "elaboration" |
| **Prune Phase** | Sub-Phase where human narrows the candidate space | "refinement", "narrowing", "clarification" |
| **Mirror** | An annotated Artifact reflecting agent understanding with Assumptions flagged | "reflection", "summary", "restatement" |
| **Menu** | Structured human-selectable options — format chosen per question type | "options", "choices", "questions" |
| **Decision Bundle** | A Menu containing multiple independent low-consequence decisions with system-recommended defaults | "batch decision", "grouped options" |
| **Decision Trace** | Governed Stream Record of a human's Menu selection with context and timestamp | "decision log", "choice record" |
| **Narrative Memory** | Generated structured summary of a completed Phase with inline source citations | "memory", "summary", "context note" |
| **Context Packet** | Structured output of the Deep Memory Research Agent | "context", "memory output", "retrieval result" |
| **Retrieval Brief** | Minimal structured input to the Deep Memory Research Agent | "search query", "retrieval request" |
| **Client Liaison Agent** | Agent Role receiving human Open Queries | "chatbot", "assistant", "Q&A agent" |
| **Open Query** | Human-initiated unstructured input outside a structured Menu or Mirror | "question", "chat message", "freeform input" |
| **Unsticking Agent** | Agent Role investigating stuck situations through Socratic elicitation, detective reasoning, and specialist recruitment. Has access to the full Execution Trace including tool results — uniquely positioned to diagnose Tool Result Misinterpretation. | "lateral thinking agent", "helper agent" |
| **Loop Detection Monitor** | Deterministic process evaluating retry count and Reasoning Flaw trends | "loop checker", "retry monitor" |
| **Loop Status** | CONVERGING, STALLED, DIVERGING, or SCOPE_BLIND | "loop state", "retry status" |

### Layer 11 — Memory Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 12 — Brownfield / History Terms

*(Identical to v2.1 — omitted for brevity)*

### Layer 13 — Failure and Recovery Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Convergence Loop** | Agent retries same approach repeatedly without progress | "retry loop", "stuck loop" |
| **Divergence Loop** | Each retry creates new problems — flaw count increasing | "amplification loop", "worsening loop" |
| **Scope Blindness** | Agent has access to needed information but does not consult it | "information blindness", "context gap" |
| **Silent Corruption** | Agent produces syntactically valid output that is semantically wrong without triggering a retry | "silent error", "invisible bug" |
| **Tool Result Misinterpretation** | Agent correctly invokes a tool but draws an incorrect conclusion from its output. Not detectable by Reasoning Review (tool results excluded from trace selection). Primary detection: test execution failure, Invariant violations. Primary diagnosis: Unsticking Agent with full Governed Stream access including tool results. | "misread output", "tool error" |
| **Implementability Violation** | Reasoning Flaw — Component Responsibility too broad for single Executor Agent session | "oversized task", "decomposition failure" |
| **Implementation Divergence** | Reasoning Flaw — Implementation Artifact contradicts governing Architectural Decision | "spec drift", "implementation mismatch" |
| **Cascade Threshold** | Configurable maximum Refactoring Tasks or files a single interface change may produce before hard stop | "refactor limit", "cascade limit" |
| **Dependency Closure Rollback** | Rollback that invalidates the target artifact and all artifacts reachable via `derives_from` Memory Edges | "full rollback", "cascading rollback" |
| **Quarantined Record** | A Governed Stream Record associated with a Reasoning Review finding of `severity: high` — excluded from retry Context Payloads; available in the Governed Stream for audit | "failed output", "dirty output" |
| **Invariant Library** | The collection of deterministic, non-LLM-checkable rules per artifact type — checked before Reasoning Review runs | "rule library", "constraint library" |

---

## 3. Agent Roster

| Agent Role | Nature | Default Backing Tool | Primary Responsibilities |
|---|---|---|---|
| Domain Interpreter | CLI-backed Agent | Configurable | Intent Domain bloom; Assumption surfacing; Intent Statement synthesis; brownfield contradiction annotation |
| Requirements Agent | CLI-backed Agent | Configurable | Functional and Non-Functional Requirements derivation |
| Systems Agent | CLI-backed Agent | Configurable | System Boundary; System Requirements; Interface Contracts |
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

*(Identical to v2.1)*

### 3.2 Semantic Supersession and Prior Decision Override

*(Identical to v2.1)*

---

## 4. Phase and Sub-Phase Contracts

All phases are mandatory. Execution is strictly sequential. Phases may only be revisited through explicit rollback. At every Phase boundary: Vocabulary Collision Check re-run; Context Packets pre-populated; Narrative Memory and Decision Trace generated synchronously at Phase Gate acceptance.

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

*(Identical to v2.1. Sub-Phases 0.1–0.4 unchanged.)*

**Phase Gate Criteria:**
- `workspace_classification` schema-valid; Invariant Check passed; `janumicode_version_sha` recorded
- All Ingestion Conflicts have human-approved resolution *(brownfield only)*
- `prior_decision_summary` produced and human-reviewed *(brownfield only)*
- `collision_risk_report` produced and aliases confirmed
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 0.5 — Cross-Run Impact Analysis *(conditional)*

*(Identical to v2.1. Triggers when Prior Decision Override references a Phase-Gate-Certified Interface Contract, API Definition, or Data Model.)*

---

### Phase 1 — Intent Capture and Convergence

*(Identical to v2.1. Sub-Phases 1.0, 1.1, 1.1b, 1.2, 1.3, 1.4, 1.5 unchanged. Each sub-phase producing a distinct artifact is a separate Agent Invocation with Execution Trace capture and Invariant Check before Reasoning Review.)*

**Phase Gate Criteria:**
- `intent_statement` schema-valid; Invariant Check passed
- `intent_quality_report` shows no unresolved contradictions
- All System-Proposed Content items have explicit human approval or are marked excluded
- No `derived_from_system_proposal: true` artifacts in governing position without explicit approval
- Reasoning Review: zero high-severity flaws or all resolved; no quarantined records in governing position
- All `prior_decision_override` Decision Traces recorded with rationale
- Human explicitly approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 2 — Requirements Definition

*(Identical to v2.1. Sub-Phases 2.1–2.5 unchanged. Each sub-phase producing a distinct artifact is a separate Agent Invocation. Invariant Checks run before Reasoning Review on `functional_requirements` and `non_functional_requirements`.)*

**Phase Gate Criteria:**
- All artifacts schema-valid; Invariant Checks passed
- `consistency_report` shows zero critical failures
- All User Stories have at least one Acceptance Criterion with a measurable condition *(Invariant)*
- `domain_attestation_confirmed: true` recorded
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 3 — System Specification

*(Identical to v2.1. Each sub-phase producing a distinct artifact — `system_boundary`, `system_requirements`, `interface_contracts` — is a separate Agent Invocation with Execution Trace capture and Invariant Check.)*

**Phase Gate Criteria:**
- Every Functional Requirement maps to at least one System Requirement *(Invariant)*
- Every External System has at least one Interface Contract *(Invariant)*
- Every Interface Contract specifies at least one error response *(Invariant)*
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 4 — Architecture Definition

*(Identical to v2.1. `component_model` Invariant Check includes: no Component Responsibility statement contains conjunctions connecting distinct concerns. `implementability_violation` Reasoning Flaw type checked in Reasoning Review of `component_model`.)*

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

*(Identical to v2.1. Sub-Phases 5.1–5.4 are separate Agent Invocations — `data_models`, `api_definitions`, `error_handling_strategies`, `configuration_parameters` are each produced by a distinct invocation. Invariant Checks per artifact type.)*

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

*(Identical to v2.1. Implementation Tasks now carry `completion_criteria` field — see Section 8.7. Complexity flagging and Refactoring Tasks from Phase 0.5 unchanged.)*

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

*(Identical to v2.1. Invariant Check on `test_plan`: every Test Case has at least one `precondition` specified.)*

**Phase Gate Criteria:**
- Every Acceptance Criterion covered by at least one Test Case *(Invariant)*
- Every Test Case has at least one `precondition` specified *(Invariant)*
- `test_coverage_report` shows zero unresolved gaps
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 8 — Evaluation Planning

*(Identical to v2.1. `compliance_context` injected into Eval Design Agent. Domain Compliance Reasoning Review applied.)*

**Phase Gate Criteria:**
- Every Non-Functional Requirement has at least one Quality Evaluation criterion with specified tooling *(Invariant)*
- Every Functional Requirement has at least one Functional Evaluation criterion *(Invariant)*
- No evaluation criterion duplicates a Test Case from Phase 7
- Compliance-related NFRs have evaluation criteria
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

*(Identical to v2.1. Failed test routing unchanged.)*

#### Sub-Phase 9.3 — Evaluation Execution

*(Identical to v2.1.)*

#### Sub-Phase 9.4 — Failure Handling

*(Identical to v2.1. Tool Result Misinterpretation suspected: escalate to Unsticking Agent with full Governed Stream access including tool results.)*

#### Sub-Phase 9.5 — Completion Approval

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

*(Identical to v2.1. Verification Ensemble applied at Phase Gate evaluation — the highest-stakes gate in the pipeline.)*

**Phase Gate Criteria:**
- `pre_commit_consistency_report` shows zero unresolved issues; Verification Ensemble agreement
- All `cross_run_modification` records produced for Refactoring Tasks
- `commit_record` valid (SHA confirmed)
- Workflow Run status set to `completed`
- Human approved
- Final Narrative Memory and Decision Trace generated and stored

---

## 5. Governed Stream

The Governed Stream is the single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. It is lossless — all execution trace content is captured in full regardless of what subset any downstream role uses. The Governed Stream is the system of record for everything.

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
| `produced_by_record_id` | UUID | Pointer to the Agent Invocation record |
| `produced_at` | ISO 8601 | Timestamp of production |
| `effective_at` | ISO 8601 | When the underlying event occurred |
| `janumicode_version_sha` | string | JanumiCode git SHA pinned at Workflow Run initiation |
| `authority_level` | integer | 1–7 per taxonomy in Section 3.1 |
| `derived_from_system_proposal` | boolean | True if this record or any ancestor is unapproved System-Proposed Content |
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

*(Identical to v2.1)*

### 5.3 Dependency Closure Rollback

*(Identical to v2.1)*
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

*(Identical to v2.1)*

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

**Channel 1 — Context Payload Stdin (directive channel):**

1. **Governing Constraints (never omitted):** Constitutional Invariants; active constraints from Context Packet at Authority Level 6+; `derived_from_system_proposal` warnings for provisional content; any Invariant Violation findings from prior retry
2. **Required Output Specification:** Sub-Phase required output from Prompt Template header
3. **Summary Context:** Deep Memory Research Context Packet summary fields; prior Phase Narrative Memory summary; `compliance_context` summary
4. **Detail File Reference:** Path, contents description, consultation conditions

**Channel 2 — Context Payload Detail File (reference channel):**

Full Context Packet; full Narrative Memories from all prior phases; full Decision Traces; full Technical Specifications; full `compliance_context` detail; full Unsticking resolution records; full prior Phase Gate-approved artifacts.

**Hard guarantee:** No governing constraint (Authority Level 6+) may be truncated silently. If governing constraints alone approach the configured `stdin_max_tokens` limit, the Orchestrator presents a hard stop escalation before invoking the agent.

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
| `agent_reasoning_step` — all other steps | **Sampled** if within `trace_max_tokens` | **Omitted** |
| Final output artifact | **Included** | **Included** |
| Total cap | `reasoning_review.trace_max_tokens` | `reasoning_review.trace_max_tokens` |

The Trace Selection is recorded in the `reasoning_review_record` as `trace_selection_record_ids` — the exact set of records used — enabling audit of what the Reasoning Review saw.

### 7.4 Focused LLM API Calls

| Orchestrator LLM Call | Input | Output |
|---|---|---|
| Phase Gate Evaluation | Relevant artifacts + Phase Gate Criteria + Context Packet + Verification Ensemble results | Structured pass/fail per criterion with reasoning |
| Context Payload Adequacy Check | Sub-Phase requirements + candidate stdin | List of missing required variables |
| Rollback Recommendation | Failure context + phase history + dependency closure | Recommended rollback target — presented as bloom-and-prune Menu |
| Vocabulary Collision Check | Canonical Vocabulary + current Product Scope artifacts | `collision_risk_report` |
| Unsticking Escalation Bloom | Full unsticking session transcript | Bloom of resolution options — presented as Menu |
| Schema Compatibility Check | `schema_registry.json` + artifact `schema_version` fields | List of schema gaps |
| Failed Test Fault Analysis | Failing test case specification + implementation evidence | Routing recommendation |
| Scope Classification | Raw Intent text | `scope_classification` |
| Intent Quality Assessment | Raw Intent text | `intent_quality_report` |

### 7.5 Decision Sequencing Protocol

*(Identical to v2.1)*

### 7.6 Bloom-and-Prune for Orchestrator Decisions

*(Identical to v2.1)*

### 7.7 OrchestratorEngine Components

| Component | Responsibility |
|---|---|
| `StateMachine` | Reads and writes current phase and sub-phase state |
| `ContextBuilder` | Constructs two-channel Context Payloads; constructs Trace Selections from `trace_record_ids` |
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

---

## 8. Cross-Cutting Role Specifications

### 8.1 Reasoning Review

**Nature:** Single stateless LLM API call. Google Gemini thinking model (primary). Verification Ensemble adds a secondary provider at configured triggers.

**What it reviews:** The agent's Execution Trace — specifically the Trace Selection constructed by `ContextBuilder` — plus the final output artifact. The Trace Selection always includes all self-corrections, all tool call invocations (name + parameters only), and selected reasoning steps per the rules in Section 7.3. Tool results are excluded from the Trace Selection by design due to context window constraints; this is a known and accepted tradeoff documented in the Failure Mode Taxonomy (Section 8.5).

**Receives (narrow context — not two-channel):**
- The Trace Selection (reasoning steps, self-corrections, tool call invocations — no tool results)
- The final output artifact
- The Sub-Phase's required output specification
- The Phase Gate Criteria for the current Phase
- The most relevant prior Phase-Gate-Certified artifacts (targeted Governed Stream query)
- The `compliance_context` artifact (when Domain Compliance Reasoning Review also triggered)
- The governing ADR(s) for `implementation_divergence` checks in Phase 9
- The `completion_criteria` from the Implementation Task (for Phase 9 `completeness_shortcut` checks)
- Any Invariant Violation findings (to avoid redundant LLM checking of already-caught issues)

**Mandatory prompt instruction (grounding, not coherence):**

```
TRACE REVIEW INSTRUCTION:
You are reviewing the agent's complete execution process, not just its final output.
The trace contains the agent's reasoning steps, self-corrections, and tool calls made.
For each claim in the agent's reasoning:
  - Identify its source in the provided Context Payload and governing artifacts
  - If a claim has no source in the provided context, classify as: unsupported_assumption
  - If a tool call was made to verify something, confirm the agent's stated conclusion
    is consistent with what the tool call parameters suggest
  - If an agent_self_correction occurred, verify the correction was sound
  - A coherent-sounding narrative does NOT indicate correct reasoning.
    Ground every step in evidence from the provided context.
NOTE: Tool results (what tools returned) are not included in this trace.
If you suspect a tool was misused or misinterpreted, flag as: tool_result_misinterpretation_suspected
and the Unsticking Agent will investigate using the full Governed Stream.
```

**Complete Flaw Taxonomy:**

| Flaw Type | Definition | Detectable in Trace? | Severity Guidance |
|---|---|---|---|
| `unsupported_assumption` | Agent asserts something as true with no basis in Context Payload | **Directly visible** in reasoning steps | High if drives key output field |
| `invalid_inference` | Conclusion does not follow from stated premises | **Directly visible** in reasoning chain | High always |
| `circular_logic` | Conclusion used as premise in its own justification | **Directly visible** — earlier claim reappears | High always |
| `scope_violation` | Agent addresses concerns belonging to a different Phase | **Directly visible** — tool calls to out-of-scope resources visible in invocations | High if causes incorrect artifact content |
| `premature_convergence` | Agent collapses options that should remain open | **Directly visible** — agent stops generating alternatives | High always |
| `false_equivalence` | Agent treats two meaningfully different things as interchangeable | **Directly visible** in reasoning | High if affects traceability |
| `authority_confusion` | Agent cites a low-authority record as governing | **Directly visible** — agent references specific records in reasoning | High if drives key decision |
| `completeness_shortcut` | Agent claims task complete when only part is done — checked against `completion_criteria` | **Directly visible** — skipped steps visible in trace | High always |
| `contradiction_with_prior_approved` | Output conflicts with a Phase-Gate-Certified artifact | **Partially visible** — agent's acknowledgment of prior artifact visible; interpretation correctness requires output comparison | High always |
| `unacknowledged_uncertainty` | Agent expresses false confidence where genuine ambiguity exists | **Directly visible** — agent expresses doubt in reasoning but not in output | Low — surfaced as warning |
| `implementability_violation` | Component Responsibility too broad for single Executor Agent session | **Directly visible** — scope of stated approach reveals task size | High — checked in Phase 4 |
| `implementation_divergence` | Implementation Artifact contradicts governing ADR — Verification Ensemble triggered | **Partially visible** — whether agent consulted ADR visible; code-level match requires output comparison | High — Verification Ensemble triggered |
| `tool_result_misinterpretation_suspected` | Agent's stated conclusion from a tool call appears inconsistent with what the tool parameters suggest, but cannot be confirmed without tool results | **Partially visible** — inconsistency between tool call and stated conclusion visible | Escalates to Unsticking Agent investigation |

**Verification Ensemble:**

Triggered at: Phase Gate evaluations; `implementation_divergence_check` in Phase 9.

The secondary model provider (Anthropic Claude Sonnet) receives the identical Trace Selection and input as the primary. If both providers agree (`overall_pass` identical), the result is accepted. If they disagree, a `verification_ensemble_disagreement` Governed Stream Record is produced and the disagreement is escalated to the human with both findings presented.

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

---

### 8.2 Consistency Checker Agent

*(Identical to v2.1. Now also receives `domain_attestation_confirmed` status from prior Phase Gate for Phase 10 pre-commit check.)*

---

### 8.3 Narrative Memory Generation

*(Identical to v2.1. Anti-failure-mode prompt instructions unchanged.)*

---

### 8.4 Deep Memory Research Agent

*(Identical to v2.1. Seven-stage process, scope tiers, materiality scoring, Context Packet schema, incomplete Context Packet protocol unchanged.)*

**Division of labor with Reasoning Review:** The Deep Memory Research Agent retrieves historical context. The Reasoning Review evaluates whether the agent used that context correctly. The Unsticking Agent investigates failure modes that the Reasoning Review cannot detect (Tool Result Misinterpretation) using full Governed Stream access including tool results.

---

### 8.5 Failure Mode Taxonomy and Recovery Protocol

Six named failure types. Each has a primary detection mechanism and recovery path.

| Failure Type | Definition | Primary Detection | Recovery |
|---|---|---|---|
| **Convergence Loop** | Agent retries same approach without progress | Loop Detection Monitor: STALLED; identical tool call sequence within one invocation | Unsticking Agent — Socratic mode |
| **Divergence Loop** | Each retry creates new problems | Loop Detection Monitor: DIVERGING | Unsticking Agent — Detective mode |
| **Scope Blindness** | Agent has access to needed information but does not consult it | Loop Detection Monitor: SCOPE_BLIND; tool call sequence shows available tools not called | Unsticking Agent — Environmental Detective mode |
| **Silent Corruption** | Agent produces syntactically valid output that is semantically wrong without triggering a retry | Phase 9.2 test failure; `implementation_divergence` Reasoning Flaw; Invariant violation; Phase 10.1 Consistency Check | Phase 9.4 failure handling: Orchestrator determines fault via focused Reasoning Review |
| **Tool Result Misinterpretation** | Agent correctly invokes a tool but draws an incorrect conclusion from its output. **Not detectable by Reasoning Review** — tool results excluded from Trace Selection by design. | `tool_result_misinterpretation_suspected` Reasoning Flaw flag; subsequent test failures; Invariant violations | Unsticking Agent with full Governed Stream access including tool results. The Unsticking Agent examines the tool results directly to diagnose the misinterpretation. |
| **Spec Drift Through Approval** | System-Proposed Content (Authority Level 1) approved by human and treated as correct | `derived_from_system_proposal` flag on downstream artifacts; Phase 2 domain attestation | Phase 2 attestation step; `system_proposed_content_items` tracking in Intent Statement |

**The honest boundary:** If the Intent Statement was wrong (Intent Fidelity failure) and tests were generated from wrong requirements, the system will pass all automated checks yet be functionally incorrect. This is "Consistency Without Truth" — the primary defense is the human as external ground truth at the Phase 2 domain attestation step. No automated system can fully close this gap when the correctness criterion is defined by human domain expertise.

**Tool Result Misinterpretation — Unsticking Agent investigation protocol:**

When `tool_result_misinterpretation_suspected` is flagged by the Reasoning Review, or when a stuck situation appears after an agent reported successful tool use:

1. Unsticking Agent retrieves the `tool_result` records from the Governed Stream for the relevant Agent Invocation using `agent_invocation.trace_record_ids`
2. Unsticking Agent compares the actual tool results against the agent's stated conclusions in its `agent_reasoning_step` records
3. If misinterpretation is confirmed, the Unsticking Agent generates a `unsticking_tool_result_review` record documenting the specific discrepancy
4. The stuck agent is provided with the correct interpretation of the tool result via the Unsticking Agent's next Socratic turn, injected into its Context Payload

---

### 8.6 Unsticking Agent

*(Identical to v2.1 with the addition of Tool Result Misinterpretation investigation protocol in Section 8.5. The Unsticking Agent's full Governed Stream access — including `tool_result` records — is its primary advantage over the Reasoning Review for diagnosing this failure mode.)*

---

### 8.7 Test Design Agent and Implementation Planner Agent

#### Test Design Agent

*(Identical to v2.1. Each Sub-Phase producing a distinct artifact is a separate Agent Invocation with Execution Trace capture.)*

#### Implementation Planner Agent

**Decomposition rule:** One Implementation Task = one Component + one Component Responsibility.

**Standard Implementation Task schema — updated with `completion_criteria`:**

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

**`completion_criteria` field:** Each criterion defines a specific, verifiable condition that constitutes task completion — independent of the agent's self-assessment. The `InvariantChecker` evaluates `schema_check` and `invariant` criteria deterministically before Reasoning Review. The Reasoning Review checks `output_comparison` criteria against the trace. `test_execution` criteria are verified during Phase 9.2.

Example criteria for an authentication service implementation task:

```json
"completion_criteria": [
  {
    "criterion_id": "cc_001",
    "description": "Function signature matches api_definitions endpoint exactly",
    "verification_method": "output_comparison",
    "artifact_ref": "api_definitions.auth_service.login_endpoint"
  },
  {
    "criterion_id": "cc_002",
    "description": "All error codes in error_handling_strategies are handled",
    "verification_method": "invariant",
    "artifact_ref": "error_handling_strategies.auth_service"
  },
  {
    "criterion_id": "cc_003",
    "description": "No external dependencies introduced beyond Technical Specification",
    "verification_method": "output_comparison",
    "artifact_ref": "technical_spec.auth_service.allowed_dependencies"
  }
]
```

**Refactoring Task schema:** *(Identical to v2.1 — `expected_pre_state_hash`, `verification_step`, `modification_type` unchanged.)*

---

### 8.8 Eval Design Agent and Eval Execution Agent

*(Identical to v2.1. `compliance_context` required input.)*

---

### 8.9 Invariant Library

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
  "checks_run": 8,
  "checks_passed": 7,
  "violations": [
    {
      "invariant_id": "...",
      "severity": "blocking",
      "message": "Component Responsibility 'auth_service.resp_001' contains 'and' — split into separate responsibilities",
      "location": "components[2].responsibilities[0].statement"
    }
  ],
  "overall_pass": false
}
```

**On violation:** `InvariantChecker` returns the violation to the Orchestrator. The Orchestrator records an `invariant_violation_record`, marks the agent output as `quarantined: true`, injects the violation message into the retrying agent's stdin directive under `[JC:INVARIANT VIOLATION]`, and triggers retry without an LLM Reasoning Review call. The retry receives the specific violated invariant and its location — not a vague "try again" signal.

**Invariant Library extension:** New invariants are added by creating new `.invariants.json` files in `.janumicode/schemas/invariants/`. The `InvariantChecker` discovers all files in that directory at startup. Adding a new invariant does not require code changes — only a new JSON file versioned with the JanumiCode repository.

---

### 8.10 Client Liaison Agent

*(Identical to v2.1.)*

---

### 8.11 Ingestion Pipeline

*(Identical to v2.1. Five stages unchanged. `derived_from_system_proposal` flag propagation unchanged.)*

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
      "model": "gemini-2.0-flash-thinking"
    },
    "client_liaison":              {
      "backing_tool": "direct_llm_api",
      "provider": "google",
      "model": "gemini-2.0-flash-thinking"
    },
    "orchestrator":                { "reasoning_llm_provider": "...", "reasoning_model": "..." }
  },

  "llm_routing": {
    "reasoning_review": {
      "primary":                   { "provider": "google", "model": "gemini-2.0-flash-thinking" },
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
    "bloom_confidence_threshold":       0.85,
    "require_human_approval_all_phase_gates": true
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

### 10.2 `janumicode.specialists.json`

*(Identical to v2.1.)*

---

## 11. Governed Stream Database Schema

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
  id                            TEXT PRIMARY KEY,
  workspace_id                  TEXT NOT NULL,
  janumicode_version_sha        TEXT NOT NULL,
  initiated_at                  TEXT NOT NULL,
  completed_at                  TEXT,
  status                        TEXT NOT NULL,
  current_phase_id              TEXT,
  current_sub_phase_id          TEXT,
  raw_intent_record_id          TEXT,
  scope_classification_ref      TEXT,
  compliance_context_ref        TEXT,
  cross_run_impact_triggered    INTEGER DEFAULT 0
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
  workflow_run_id               TEXT,
  notes                         TEXT,
  FOREIGN KEY (source_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (target_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX memory_edge_source   ON memory_edge(source_record_id);
CREATE INDEX memory_edge_target   ON memory_edge(target_record_id);
CREATE INDEX memory_edge_type     ON memory_edge(edge_type);

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
```

### 11.1 Key Design Decisions

**`quarantined` column:** Set by `GovernedStreamWriter` when Reasoning Review finds `severity: high`. Quarantined records are excluded from retry Context Payloads by `ContextBuilder`. Available in full to the Unsticking Agent and for audit. Never deleted.

**`sanitized` and `sanitized_fields` columns:** Applied to `tool_result` records when `governed_stream.sanitize_tool_results: true` and content matches `sensitive_content_patterns`. Sanitization is pre-storage — the sanitized version is what all downstream roles see. `sanitized: true` flags the record so audit trails remain complete.

**`agent_invocation_trace` table:** The execution trace index. Links each `agent_invocation` record to all its trace records (`agent_reasoning_step`, `agent_self_correction`, `tool_call`, `tool_result`) with sequence position. The `ContextBuilder` queries this table with a filter on `trace_record_type` to construct Trace Selections efficiently — e.g., `WHERE invocation_record_id = ? AND trace_record_type IN ('agent_self_correction', 'tool_call', 'agent_reasoning_step')`. Tool results are retrieved separately only by the Unsticking Agent.

**`verification_ensemble_used` on `phase_gates`:** Records whether the Verification Ensemble was triggered for this Phase Gate evaluation. Used for audit and for identifying Phase Gates where provider disagreement was resolved by human.

**`tool_call_loop_detected` on `sub_phase_execution_log`:** Set by the Loop Detection Monitor when identical tool call sequences or tool call thrashing is detected within a single invocation — deterministic, no LLM call required.

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

*(Identical to v2.1 with one addition.)*

**Invariant Library versioning:** Invariant files are versioned with the JanumiCode repository via `janumicode_version_sha`. The Schema Compatibility Check at version upgrades includes invariant file changes — a new blocking invariant introduced in a new version may cause previously accepted artifacts to fail on re-check. This is intentional and documented: new invariants represent tightened correctness guarantees. The Version Upgrade Card presented to the human includes a summary of new invariants added since the prior version.

---

## 14. Deferred Items

| Item | Deferred To | Notes |
|---|---|---|
| Governed Stream UI card taxonomy | Bloom-and-prune design session | Card types, states, grouping, prominence hierarchy |
| CI/CD integration | Post-MVP | Phase 10 closes with `commit_record`. CI/CD trigger deferred. |
| Parallel Implementation Task execution | Medium/Enterprise phase | Static Conflict Analyzer and Merge Orchestrator required |
| Multi-workspace / large team coordination | Enterprise phase | |
| External tool export | Large team / Enterprise phase | |
| Enterprise integrations (Slack, email) | Enterprise phase | Supported by `all_runs_plus_external` scope tier |
| Mid-size engineering org features | Phase 2 product | |
| Domain-specific workflow profiles | Post-MVP | Mobile, embedded, SaaS, AI/ML optimized vocabulary and phase nuances |
| UI/UX specification phase | Post-MVP | Optional Phase 2.5 for consumer-facing interfaces |
| Kùzu graph database migration | If SQLite edge tables insufficient | |
| Learned reranker for materiality scoring | Post-MVP | |
| Learned invariant detection | Post-MVP | ML-based detection of invariant patterns from Governed Stream history — would generate new invariant candidates for human review |
| Tool result inclusion in Reasoning Review | If context windows grow sufficiently | Currently excluded by design due to context window constraints. If models with large enough windows become available, `tool_results_excluded` can be set to `false` in config with no other changes required. |

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

### 15.3 Implementation Task with completion_criteria

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

### 15.4 Verification Ensemble Record

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
  "disagreement_action": "escalate_to_human",
  "escalation_record_id": "...",
  "produced_at": "..."
}
```

### 15.5 Unsticking Tool Result Review

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

---

*JanumiCode Master Product Specification — Version 2.2*
*All sections subject to revision through bloom-and-prune with human approval.*
*Deferred items catalogued in Section 14.*
*Changelog from v2.1 documented in header.*
