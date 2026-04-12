# JanumiCode Master Product Specification

**Version 2.1 — Implementation-Ready**

*Changes from v2.0: Three-Layer Correctness Model (§1.6); Intent Quality Check sub-phase (§4); Scope Bounding with dependency closure (§4); Phase 2 attestation step (§4); Phase 0.5 Cross-Run Impact Analysis (§4); Context Assembly two-channel model (§7); Decision Sequencing Protocol (§7); Failure Mode Taxonomy (§8); extended Reasoning Review flaw taxonomy (§8.1); Consistency Checker attestation input (§8.2); Implementation Planner complexity flagging (§8.7); refactoring task type (§8.7, §15); cross_run_modification record type (§6); cascade threshold configuration (§10); domain compliance configuration (§10).*

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

These are Constitutional invariants — Authority Level 7. No agent, Orchestrator decision, or human approval within a Workflow Run can supersede them. Only a change to the JanumiCode specification itself modifies them.

- **100% correctness and completeness — always.** All three layers of correctness (Section 1.6) are required. Never optimize for speed at the expense of any layer.
- **Every phase is mandatory and executed in order.** The [JC:Orchestrator] cannot skip phases.
- **Every [JC:Phase Gate] requires human approval.** No automated gate passage.
- **Every human interaction is recorded in the [JC:Governed Stream] in full detail.**
- **Agents never exercise judgment.** Judgment is always escalated to the human.
- **The [JC:Governed Stream] is single-threaded.** No parallel [JC:Workflow Runs] in a [JC:Workspace].
- **All [JC:Artifacts] are owned by JanumiCode** and stored in the [JC:Governed Stream] database.
- **Prompt Templates use namespace prefixing ([JC:] and [P:]) and separate context scopes at all times.**
- **No governing constraint may be truncated silently.** Governing constraints (Authority Level 6+) are always delivered in full via the stdin directive channel. See Section 7.2.

### 1.6 Three-Layer Correctness Model

JanumiCode's goal of "100% correctness and completeness" requires all three layers simultaneously. A system that achieves Execution Correctness but fails Intent Fidelity or Domain Correctness is not correct by JanumiCode's definition.

| Correctness Layer | Definition | Primary Validation Mechanism |
|---|---|---|
| **Intent Fidelity** | The system delivers what the human actually meant, not just what they literally said | Phase 1 Intent Quality Check; bloom-and-prune; human Phase Gate approvals; Phase 2 attestation step |
| **Domain Correctness** | The system's behavior conforms to real-world rules, regulations, and standards applicable to its domain | Domain Compliance Reasoning Review; `compliance_context` artifact; Specialist Agent registry |
| **Execution Correctness** | The implemented code behaves as specified by the governing artifacts | Phase 9 test execution; Phase 8 evaluation; `implementation_divergence` Reasoning Flaw type |

**The honest limitation:** Intent Fidelity and Domain Correctness cannot be fully automated. The human is the necessary external ground truth at Phase Gate approvals. The Phase 2 attestation step (Section 4, Phase 2) makes this role explicit and recorded.

---

## 2. Canonical Vocabulary

All [JC:Prompt Templates], schema fields, agent instructions, and UI labels must use these terms exclusively. Prohibited aliases must never appear in any system artifact.

### Layer 0 — Meta / System Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Governed Stream** | The single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. The system of record for everything. | "Artifact Store", "chat history", "log", "database" |
| **Governed Stream Record** | A single entry in the Governed Stream — may be a human input, agent output, artifact, tool call, tool result, decision, memory, or relationship edge | "message", "event", "entry" |
| **Workflow Run** | A single end-to-end JanumiCode execution for a specific [JC:Intent Statement], from initiation through final approval | "session", "project run", "pipeline run" |
| **Artifact** | A Governed Stream Record whose `record_type` designates it as a schema-validated JSON document produced as a required output of a phase or sub-phase | "output", "result", "document", "response" |
| **Workspace** | The VS Code workspace within which JanumiCode operates; the scope boundary for a brownfield project's existing artifacts | "project", "repo", "codebase" |
| **janumicode_version_sha** | The git commit SHA of the JanumiCode repository pinned at Workflow Run initiation; recorded on every Governed Stream Record | "version", "build number" |
| **Context Payload — Stdin** | The directive channel of an Agent Invocation — governing constraints, required output specification, and summary context injected via stdin to a CLI-backed agent | "context", "prompt" (unqualified) |
| **Context Payload — Detail File** | The reference channel of an Agent Invocation — a generated filesystem file containing full evidentiary detail the CLI-backed agent may consult during its work | "context file", "detail document" |
| **Detail File Path** | The deterministic filesystem path at which the Context Payload Detail File is placed before an Agent Invocation — format: `.janumicode/context/{sub_phase_id}_{invocation_id}.md` | "context path", "file location" |

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
| **Implementation Task** | A single, atomic unit of work for an Executor Agent — scoped to one Component and one Component Responsibility | "ticket", "task", "story" (at this layer) |
| **Refactoring Task** | A specialized Implementation Task that modifies Implementation Artifacts produced by a prior Workflow Run to conform to a changed Interface Contract or API Definition. Carries idempotency fields. | "fix task", "update task", "migration" |
| **Executor Agent** | The Agent Role responsible for code generation and file system changes, backed by a CLI tool | "coder", "developer agent", "code agent" |
| **Implementation Artifact** | Any file produced or modified by an Executor Agent — source code, configuration files, migration scripts | "code", "file", "output" (at implementation layer) |

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
| **Reasoning Review** | A focused LLM API call that inspects an agent's output for reasoning flaws against the complete flaw taxonomy | "QA check", "review step", "LLM review" |
| **Domain Compliance Reasoning Review** | An additional Reasoning Review pass that checks an artifact for compliance with the confirmed domain-specific compliance regimes in the `compliance_context` artifact | "compliance check", "regulatory review" |
| **Reasoning Flaw** | A specific, named defect in agent reasoning — see Section 8.1 for the complete taxonomy | "error", "mistake", "hallucination" (too vague) |

### Layer 10 — Agent and Orchestration Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Agent Role** | A named, specification-defined function in JanumiCode with defined inputs, outputs, responsibilities, and Backing Tool | "agent", "bot", "assistant" (unqualified) |
| **Backing Tool** | The CLI or API used to execute an Agent Role | "LLM", "model", "provider" (at role level) |
| **Agent Invocation** | A single call to an Agent Role's Backing Tool with a fully constructed Context Payload (stdin + detail file for CLI agents) | "agent call", "LLM call", "tool call" |
| **Prompt Template** | A versioned, parameterized instruction set used to construct the stdin directive for an Agent Invocation | "system prompt", "prompt", "instruction" |
| **Orchestrator** | The TypeScript OrchestratorEngine class responsible for sequencing phases, constructing Context Payloads, routing between Agent Roles, and managing Phase Gate evaluation | "coordinator", "manager", "controller" |
| **Phase** | A mandatory, named stage of a Workflow Run with defined entry criteria, required Agent Invocations, required output Artifacts, and a Phase Gate | "step", "stage", "workflow stage" |
| **Sub-Phase** | A named, ordered step within a Phase with its own required Agent Invocations and output Artifacts | "step", "task" (at orchestration layer) |
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
| **Unsticking Agent** | The Agent Role that investigates and resolves stuck agent situations through Socratic elicitation, detective reasoning, and specialist recruitment | "lateral thinking agent", "helper agent" |
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
| **Implementability Violation** | A Reasoning Flaw type — a Component Responsibility is scoped too broadly to be implemented in a single Executor Agent session | "oversized task", "decomposition failure" |
| **Implementation Divergence** | A Reasoning Flaw type — an Implementation Artifact contradicts or partially contradicts the governing Architectural Decision it derives from | "spec drift", "implementation mismatch" |
| **Cascade Threshold** | The configurable maximum number of Refactoring Tasks or affected files that a single interface change may produce before the Orchestrator presents a hard stop | "refactor limit", "cascade limit" |
| **Dependency Closure Rollback** | A rollback that invalidates not just the target artifact but all artifacts reachable from it via `derives_from` Memory Edges | "full rollback", "cascading rollback" |

---

## 3. Agent Roster

| Agent Role | Nature | Default Backing Tool | Primary Responsibilities |
|---|---|---|---|
| Domain Interpreter | CLI-backed Agent | Configurable | Intent Domain bloom; Assumption surfacing; Intent Statement synthesis; brownfield contradiction annotation |
| Requirements Agent | CLI-backed Agent | Configurable | Functional Requirements and Non-Functional Requirements derivation |
| Systems Agent | CLI-backed Agent | Configurable | System Boundary definition; System Requirements; Interface Contracts |
| Architecture Agent | CLI-backed Agent | Configurable | Software Domain identification; Component decomposition; ADR generation |
| Technical Spec Agent | CLI-backed Agent | Configurable | Data Models; API Definitions; Error Handling Strategies; Configuration Parameters |
| Implementation Planner | CLI-backed Agent | Configurable | Implementation Task decomposition; dependency ordering; complexity flagging; parallelism field estimation |
| Executor Agent | CLI-backed Agent | Claude Code CLI | Code generation; file system changes; test code implementation; CI tool invocation |
| Test Design Agent | CLI-backed Agent | Configurable | Test Case specification (not code); Test Suite organization |
| Eval Design Agent | CLI-backed Agent | Configurable | Functional, Quality, and Reasoning Evaluation Plan design |
| Eval Execution Agent | CLI-backed Agent | Configurable | Evaluation tooling invocation; results capture |
| Consistency Checker | CLI-backed Agent | Configurable | Cross-artifact traceability; semantic consistency; internal consistency; historical consistency |
| Deep Memory Research | CLI-backed Agent | Configurable | Multi-stage context reconstruction; Context Packet generation; gap characterization |
| Unsticking Agent | LLM API calls | Google Gemini thinking model | Socratic elicitation; detective reasoning; specialist recruitment |
| Client Liaison Agent | LLM API calls | Google Gemini thinking model | Open Query classification; retrieval coordination; response synthesis |
| Orchestrator | LLM API calls + deterministic | Configurable reasoning model | Phase sequencing; Context Payload construction; Phase Gate evaluation; bloom-and-prune for escalations |
| Loop Detection Monitor | Deterministic — no LLM | N/A — TypeScript process | Retry counting; flaw trend classification; Loop Status assessment |
| Reasoning Review | LLM API call | Google Gemini thinking model | Single-call reasoning flaw inspection against complete flaw taxonomy |
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
- `workspace_classification` schema-valid; `janumicode_version_sha` recorded
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

#### Sub-Phase 0.5.1 — Impact Enumeration

- **[JC:Agent Role]:** Consistency Checker Agent
- **Context Payload includes:** Prior Workflow Run's Implementation Artifacts; the changed interface definition; the `prior_decision_summary`
- **Action:** Identifies all Implementation Artifacts from prior runs that implement the interface being changed. Enumerates affected file paths, estimated change scope, and dependency chain.
- **Output Artifact:** `cross_run_impact_report: {changed_interface_id, affected_artifact_ids, affected_file_paths, estimated_refactoring_task_count, estimated_file_count, dependency_chain, modification_type: additive | breaking | non_breaking}`

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

**Purpose:** Transform the Raw Intent into a locked, unambiguous Intent Statement through Intent Quality Check, Scope Bounding, maximal Bloom, and structured Prune.

**Entry Criterion:** Phase 0 Phase Gate passed.

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

#### Sub-Phase 1.1 — Raw Intent Reception

- **[JC:Agent Role]:** Orchestrator
- **Action:** Logs Raw Intent as Governed Stream Record. Triggers Sub-Phase 1.1b.

#### Sub-Phase 1.1b — Scope Bounding and Compliance Context

- **[JC:Agent Role]:** Orchestrator (LLM API call) + Domain Interpreter Agent
- **Action — Step 1, Scope Classification:** Classifies the Raw Intent's breadth (single feature / single product / multi-product ecosystem) and depth (proof of concept / MVP / production-grade). Identifies cross-scope dependencies if breadth is multi-product.
- **Action — Step 2, Dependency Closure Analysis:** If breadth is multi-product and the human may choose to scope to a subset, the Domain Interpreter identifies concepts and data from out-of-scope pillars that the scoped pillar depends on. These dependencies must be explicitly resolved in the scoping decision.
- **Action — Step 3, Compliance Context Identification:** Identifies domain-specific compliance regimes that apply to the product being built (accounting standards, legal regulations, industry standards, accessibility requirements, data privacy laws). Presents identified regimes for human confirmation.
- **Output Artifact:** `scope_classification`, `compliance_context: {regimes: [{name, description, applicable_phases, relevant_artifacts}]}`

**Scope Menu (if multi-product detected):**
> "Your intent describes a multi-product ecosystem. Options: (A) Scope this run to [Pillar N] — note: the following concepts from other pillars must be stubbed or declared as External Systems: [dependency closure list], (B) Scope this run to a cross-cutting shared foundation used by all pillars, (C) Proceed with full ecosystem scope and allow the bloom to surface natural decomposition."

**Compliance Menu:**
> "The following compliance regimes appear applicable. Confirm, add, or remove: [list with checkboxes]."

#### Sub-Phase 1.2 — Intent Domain Bloom

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Context Payload stdin:** Active constraints (Authority Level 6+), `scope_classification`, `compliance_context` summary, `collision_risk_report` aliases, `prior_decision_summary` summary (brownfield)
- **Context Payload detail file:** Full Context Packet from Deep Memory Research (brownfield, `all_runs` scope); full `prior_decision_summary`
- **Action:** Applies collision aliases before any generation. Expands Raw Intent into full candidate space. In brownfield runs, checks each candidate against Context Packet `active_constraints` and annotates conflicts inline. System-Proposed Content (from Sub-Phase 1.0 Option B) is included in the bloom but flagged at Authority Level 1.
- **Output Artifact:** `intent_bloom`

#### Sub-Phase 1.3 — Intent Mirror and Menu

- **Interaction:** Annotated Mirror of `intent_bloom`. Mixed-format Menus following the Decision Sequencing Protocol (Section 7.4). System-Proposed Content items require individual explicit approval before they can be used as governing content. Prior decision conflicts highlighted. All Decision Traces recorded.

#### Sub-Phase 1.4 — Intent Statement Synthesis

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Synthesizes all prune decisions into complete Intent Statement. Reasoning Review applied. Domain Compliance Reasoning Review applied if `compliance_context` is populated.
- **Output Artifact:** `intent_statement: {product_concept, confirmed_assumptions, confirmed_constraints, out_of_scope, scope_classification_ref, compliance_context_ref, prior_decision_overrides, system_proposed_content_items: [{field, content, approved: bool}]}`

#### Sub-Phase 1.5 — Intent Statement Approval

- **Interaction:** Full Mirror of `intent_statement`. Human approves, rejects, or edits. If rejected: return to 1.2 with rejection context injected.

**Phase Gate Criteria:**
- `intent_statement` schema-valid
- `intent_quality_report` shows no unresolved contradictions
- All System-Proposed Content items have explicit human approval (Level 5) or are marked as excluded
- No `derived_from_system_proposal: true` artifacts in governing position without explicit approval
- Reasoning Review: zero high-severity flaws or all resolved
- All `prior_decision_override` Decision Traces recorded with rationale
- Human explicitly approved
- Narrative Memory and Decision Trace generated and stored

*If Prior Decision Overrides reference Phase-Gate-Certified Interface Contracts, API Definitions, or Data Models: Phase 0.5 executes before Phase 2.*

---

### Phase 2 — Requirements Definition

**Purpose:** Derive complete, traceable Functional Requirements and Non-Functional Requirements from the Intent Statement.

**Entry Criterion:** Phase 1 Phase Gate passed (and Phase 0.5 if triggered). `intent_statement`, `compliance_context` available. Vocabulary Collision Check re-run.

#### Sub-Phase 2.1 — Functional Requirements Bloom

- **[JC:Agent Role]:** Requirements Agent
- **Context Payload stdin:** Active constraints; `compliance_context` summary; `intent_statement` summary
- **Context Payload detail file:** Full `intent_statement`; full `compliance_context`; full Context Packet
- **Output Artifact:** `functional_requirements`

#### Sub-Phase 2.2 — Non-Functional Requirements Bloom

- **[JC:Agent Role]:** Requirements Agent
- **Output Artifact:** `non_functional_requirements`

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
- All artifacts schema-valid
- `consistency_report` shows zero critical failures
- All User Stories have at least one Acceptance Criterion
- `domain_attestation_confirmed: true` recorded in Phase Gate Decision Trace
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 3 — System Specification

**Purpose:** Allocate requirements to a defined System Boundary. Specify all External Systems and Interface Contracts. Produce System Requirements.

**Entry Criterion:** Phase 2 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Systems Agent (`all_runs` scope).

#### Sub-Phases 3.1–3.5

*(Structure identical to v2.0. Context Payloads now follow two-channel model — stdin carries governing constraints and summaries; detail file carries full artifacts.)*

- **3.1:** System Boundary Definition → `system_boundary`
- **3.2:** System Requirements Derivation → `system_requirements`
- **3.3:** Interface Contract Specification → `interface_contracts`
- **3.4:** Mirror and Menu (Reasoning Review + Domain Compliance Reasoning Review)
- **3.5:** Consistency Check and Approval

**Phase Gate Criteria:**
- Every Functional Requirement maps to at least one System Requirement
- Every External System has at least one Interface Contract
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 4 — Architecture Definition

**Purpose:** Decompose the system into Components with defined responsibilities, Dependencies, and Architectural Decisions. All Component Responsibilities must pass implementability check.

**Entry Criterion:** Phase 3 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Architecture Agent (`all_runs` scope).

#### Sub-Phases 4.1–4.4

*(Structure identical to v2.0 with two-channel Context Payload.)*

- **4.1:** Software Domain Identification → `software_domains`
- **4.2:** Component Decomposition → `component_model`
- **4.3:** Architectural Decision Capture → `architectural_decisions`
- **4.4:** Architecture Mirror and Menu — Reasoning Review includes `implementability_violation` flaw type check on `component_model`

#### Sub-Phase 4.5 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent

**Implementability Review in Phase 4.4:** The Reasoning Review of the `component_model` artifact includes a specific check for `implementability_violation` — any Component Responsibility that is scoped too broadly to be implemented in a single Executor Agent session. If flagged, the Mirror presents the flagged responsibilities with a Menu: "(A) Return to Phase 4.2 to decompose this Component further, (B) Accept as-is and rely on the Implementation Planner to manage complexity."

**Phase Gate Criteria:**
- Every System Requirement allocated to at least one Component
- No circular Dependencies without explicit ADR justification
- Every ADR has a human-confirmed decision
- No `implementability_violation` flaws unresolved
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 5 — Technical Specification

*(Structure identical to v2.0 with two-channel Context Payload. Context Packet pre-populated for Technical Spec Agent, `all_runs` scope. Domain Compliance Reasoning Review applied where compliance_context is relevant.)*

**Phase Gate Criteria:**
- Every Component has a complete Technical Specification
- All API Definitions consistent with Interface Contracts from Phase 3
- All Data Models consistent with Component Responsibilities from Phase 4
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
- **Decomposition Rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct steps, each step is its own task with explicit `dependency_task_ids`.
- **Complexity Flagging:** Any task rated `estimated_complexity: high` must include a `complexity_flag` field with explanation. The Orchestrator surfaces all complexity-flagged tasks in the Phase 6 Mirror with a Menu per flagged task: "(A) Return to Phase 4 to refine this Component's decomposition via Dependency Closure Rollback, (B) Accept as-is — Executor Agent will handle complexity, (C) Manually split this task here."
- **Refactoring Tasks:** If `refactoring_scope` artifact exists, Refactoring Tasks from Phase 0.5 are added to the Implementation Plan. See Section 8.7 for Refactoring Task schema including idempotency fields.
- **Output Artifact:** `implementation_plan`

#### Sub-Phases 6.2–6.3

- **6.2:** Mirror and Menu with Reasoning Review
- **6.3:** Human approval

**Phase Gate Criteria:**
- Every Technical Specification covered by at least one Implementation Task
- All Refactoring Tasks from `refactoring_scope` included if Phase 0.5 was triggered
- No circular task Dependencies
- All complexity-flagged tasks have human resolution recorded
- All tasks have assigned Backing Tool
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 7 — Test Planning

*(Structure identical to v2.0. Test Cases are specifications — not code. Executor Agent implements them in Phase 9. Functional behavior only — NFR coverage is Phase 8.)*

**Phase Gate Criteria:**
- Every Acceptance Criterion covered by at least one Test Case
- `test_coverage_report` shows zero unresolved gaps
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 8 — Evaluation Planning

*(Structure identical to v2.0. Eval Design Agent receives `test_plan` as read-only input. `compliance_context` injected into Eval Design Agent's context to ensure compliance-related NFRs have evaluation criteria. Domain Compliance Reasoning Review applied to evaluation plans.)*

**Phase Gate Criteria:**
- Every Non-Functional Requirement has at least one Quality Evaluation criterion with specified tooling
- Every Functional Requirement has at least one Functional Evaluation criterion
- No evaluation criterion duplicates a Test Case from Phase 7
- Compliance-related NFRs from `compliance_context` have evaluation criteria
- Reasoning Review and Domain Compliance Reasoning Review clean
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 9 — Execution

**Purpose:** Execute the Implementation Plan and Test Plan. Capture all results.

**Entry Criterion:** Phases 6, 7, and 8 all Phase Gate passed.

#### Sub-Phase 9.1 — Implementation Task Execution

- **[JC:Agent Role]:** Executor Agent (per task, per assigned Backing Tool)
- **Action:** Implements Test Cases as runnable code from Test Case specifications before application code where possible. Executes each Implementation Task in dependency order. Reasoning Review applied after each task completion — includes `implementation_divergence` flaw type check against the governing ADR for each task. Loop Detection Monitor active throughout.
- **Refactoring Task execution:** When executing a Refactoring Task, the Executor Agent checks `expected_pre_state_hash` against actual file content before modifying. See Section 8.7 for idempotency protocol.
- **Output:** Implementation Artifacts

#### Sub-Phase 9.2 — Test Execution

*(Structure identical to v2.0. Failed test routing: Orchestrator invokes focused Reasoning Review to determine fault — Test Design Agent or Executor Agent or escalate to human.)*

#### Sub-Phase 9.3 — Evaluation Execution

*(Structure identical to v2.0.)*

#### Sub-Phase 9.4 — Failure Handling

*(Structure identical to v2.0.)*

#### Sub-Phase 9.5 — Completion Approval

**Phase Gate Criteria:**
- All Implementation Tasks executed with Reasoning Review clean (including `implementation_divergence` checks)
- All Refactoring Tasks completed with idempotency verification
- All Test Cases pass or failures explicitly accepted by human
- All Evaluation criteria pass or exceptions documented
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 10 — Commit and Deployment Initiation

*(Structure identical to v2.0. Context Packet pre-populated for Consistency Checker, `all_runs` scope. Cross-run modifications documented via `cross_run_modification` records.)*

**Phase Gate Criteria:**
- `pre_commit_consistency_report` shows zero unresolved issues
- All `cross_run_modification` records produced for any Refactoring Tasks executed in Phase 9
- `commit_record` valid (SHA confirmed)
- Workflow Run status set to `completed`
- Human approved
- Final Narrative Memory and Decision Trace generated and stored

---

## 5. Governed Stream

The Governed Stream is the single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. There is no separate "Artifact Store." Artifacts are Governed Stream Records whose `record_type` designates them as schema-validated phase outputs. The Governed Stream is the system of record for everything.

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
| `effective_at` | ISO 8601 | When the underlying event occurred |
| `janumicode_version_sha` | string | JanumiCode git SHA pinned at Workflow Run initiation |
| `authority_level` | integer | 1–7 per taxonomy in Section 3.1 — assigned at write time |
| `derived_from_system_proposal` | boolean | True if this record or any ancestor is System-Proposed Content not yet explicitly approved |
| `is_current_version` | boolean | False if superseded by rollback within a run |
| `superseded_by_id` | UUID / null | Rollback supersession pointer |
| `superseded_at` | ISO 8601 / null | When this record was semantically superseded |
| `superseded_by_record_id` | UUID / null | Semantic supersession pointer |
| `source_workflow_run_id` | UUID | The Workflow Run that originally produced this record |
| `derived_from_record_ids` | UUID[] | Records from which this record was derived |
| `content` | JSON object | Type-specific payload, validated against `schema_version` |

### 5.2 Rollback vs. Semantic Supersession

| | Rollback Supersession | Semantic Supersession |
|---|---|---|
| **Trigger** | Human authorizes rollback to prior phase | Human explicitly overrides a prior governing decision |
| **Field** | `superseded_by_id` | `superseded_by_record_id` |
| **Scope** | Within a Workflow Run | Across Workflow Runs |
| **Record fate** | `is_current_version: false` | Record remains current; `superseded_at` populated |
| **Governing mechanism** | Newer record in same run is canonical | `supersedes` Memory Edge created |
| **Human involvement** | Rollback authorization recorded | `prior_decision_override` Decision Trace recorded |

### 5.3 Dependency Closure Rollback

When the Orchestrator performs a rollback targeting artifact X, it must traverse the `memory_edge` table for all `derives_from` edges originating from X recursively and include all reachable artifacts in the invalidation set. The human is shown the complete invalidation set before confirming.

**Menu presented:**
> "Rolling back [artifact X] will also invalidate the following derived artifacts: [complete list with authority levels]. Confirm full dependency closure rollback?"

Partial rollbacks — invalidating only a named artifact without its dependency closure — are not permitted. Every rollback operates on the full closure.
---

## 6. Governed Stream Record Taxonomy

Every entry in the Governed Stream has a canonical `record_type`. Maximum granularity — one record per discrete event.

### 6.1 Phase and Agent Records

| Record Type | Description |
|---|---|
| `raw_intent_received` | The human's Raw Intent as received, verbatim |
| `agent_invocation` | A single call to a CLI-backed Agent Role — includes stdin hash, detail file path, Prompt Template reference, backing tool |
| `agent_output` | The complete output of an Agent Invocation |
| `tool_call` | A tool call made by a CLI-backed agent |
| `tool_result` | The result of a tool call |
| `artifact_produced` | Pointer to a schema-validated Artifact |
| `reasoning_review_record` | Reasoning Review LLM API call — inputs, output, flaw findings |
| `domain_compliance_review_record` | Domain Compliance Reasoning Review — inputs, compliance regime checked, findings |
| `detail_file_generated` | Record that a Context Payload Detail File was generated — includes path, contents description, invocation_id |

### 6.2 Human Interaction Records

| Record Type | Description |
|---|---|
| `mirror_presented` | The Mirror artifact as presented to the human |
| `menu_presented` | The Menu options as presented to the human |
| `decision_bundle_presented` | A Decision Bundle — multiple independent low-consequence decisions with system-recommended defaults |
| `decision_trace` | A human's selection. `decision_type` field specifies: `menu_selection`, `mirror_approval`, `mirror_rejection`, `mirror_edit`, `phase_gate_approval`, `rollback_authorization`, `unsticking_escalation_resolution`, `prior_decision_override`, `system_proposal_approval`, `system_proposal_rejection`, `domain_attestation` |
| `mirror_approved` | Human approval of a Mirror |
| `mirror_rejected` | Human rejection of a Mirror with rejection reason |
| `mirror_edited` | Human edit of a Mirror — includes original and edited content |
| `phase_gate_evaluation` | The Phase Gate evaluation result — pass/fail per criterion with reasoning |
| `phase_gate_approved` | Human approval of a Phase Gate — includes `domain_attestation_confirmed` field where applicable |
| `phase_gate_rejected` | Human rejection of a Phase Gate with reason |
| `rollback_authorized` | Human authorization of a rollback — includes target Phase/Sub-Phase and full dependency closure list |
| `complexity_flag_resolution` | Human resolution of a complexity-flagged Implementation Task — includes chosen option |
| `cascade_threshold_decision` | Human decision when refactoring cascade threshold is exceeded |
| `technical_debt_record` | Documented known technical debt accepted by human when choosing divergence in Phase 0.5 |

### 6.3 Memory Records

| Record Type | Description |
|---|---|
| `narrative_memory` | Compressed structured summary of a completed Phase with inline citations |
| `decision_trace_summary` | Structured record of all human decisions in a completed Phase |
| `retrieval_brief_record` | Structured brief sent to Deep Memory Research Agent |
| `context_packet` | Structured output of a Deep Memory Research Agent invocation |
| `memory_edge_proposed` | A relationship edge proposed by an agent during Ingestion Pipeline Stage III |
| `memory_edge_confirmed` | A relationship edge confirmed by human or elevated to human-confirmed status |
| `intent_quality_report` | Output of Sub-Phase 1.0 Intent Quality Check |
| `cross_run_impact_report` | Output of Phase 0.5.1 Impact Enumeration |
| `cross_run_modification` | Documents that the current Workflow Run modified an Implementation Artifact from a prior Workflow Run — fields: `current_workflow_run_id`, `prior_workflow_run_id`, `modified_artifact_id`, `modification_type: additive|breaking|non_breaking`, `rationale_record_id` |

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
| `loop_detection_record` | Loop Detection Monitor assessment — retry count, flaw trend, Loop Status |
| `unsticking_session_open` | Trigger record for an Unsticking Agent session |
| `unsticking_hypothesis` | A hypothesis formed by the Unsticking Agent |
| `unsticking_socratic_turn` | A single question-and-response turn in Socratic elicitation |
| `unsticking_specialist_task` | A focused diagnostic task sent to a Specialist Agent |
| `unsticking_specialist_response` | A Specialist Agent's diagnostic output |
| `unsticking_resolution` | The resolution that unblocked the stuck agent — indexed for future problem class retrieval |
| `unsticking_escalation` | Human escalation card when Unsticking Agent cannot resolve |

### 6.6 System Records

| Record Type | Description |
|---|---|
| `schema_gap_record` | A schema field mismatch found during Schema Compatibility Check on version upgrade |
| `version_upgrade_card` | Human-facing Version Upgrade Card at Phase Gate on JanumiCode upgrade |
| `ingestion_pipeline_record` | Output of each Ingestion Pipeline stage for a new record |

---

## 7. Orchestrator Specification

The Orchestrator is not a CLI-backed agent. It is a TypeScript class — `OrchestratorEngine` — whose state lives in the Governed Stream database and whose reasoning is provided by focused, stateless LLM API calls.

### 7.1 Deterministic Operations (No LLM Call)

- Reading and writing current phase and sub-phase state
- Checking retry counter and Loop Detection Monitor status
- Verifying Artifact schema validity against JSON Schema library
- Routing to the correct Prompt Template
- Constructing Context Payloads (stdin + detail file) via `ContextBuilder`
- Recording Governed Stream Records via `GovernedStreamWriter`
- Triggering Narrative Memory and Decision Trace generation at Phase Gates
- Enforcing the Unsticking Action Boundary
- Assigning Authority Levels at record write time
- Running Ingestion Pipeline Stages I and II
- Checking cascade thresholds against `cross_run_impact_report`
- Performing Dependency Closure Rollback traversal via `memory_edge` table

### 7.2 Two-Channel Context Assembly

CLI-backed agents receive context through two channels. LLM API call roles (Reasoning Review, Narrative Memory Generator, Orchestrator reasoning calls, Client Liaison Agent, Unsticking Agent) receive narrow purpose-built context and are not subject to the two-channel model.

**Channel 1 — Context Payload Stdin (directive channel):**

The `ContextBuilder` constructs the stdin directive with the following content in strict order:

1. **Governing Constraints (never omitted):** Constitutional Invariants relevant to this Sub-Phase; active constraints from the Context Packet at Authority Level 6+; `derived_from_system_proposal` warnings for any provisional content in scope
2. **Required Output Specification:** The Sub-Phase's required output from the Prompt Template header
3. **Summary Context:** Structured summary fields from the Deep Memory Research Context Packet (`decision_context_summary`, `active_constraints`, `supersession_chains`, `contradictions`, `open_questions`); Narrative Memory from the immediately prior Phase (summary only); `compliance_context` summary
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

### 7.3 Focused LLM API Calls

| Orchestrator LLM Call | Input | Output |
|---|---|---|
| Phase Gate Evaluation | Relevant artifacts + Phase Gate Criteria + Context Packet | Structured pass/fail per criterion with reasoning |
| Context Payload Adequacy Check | Sub-Phase requirements + candidate stdin content | List of missing required variables |
| Rollback Recommendation | Failure context + phase history + dependency closure | Recommended rollback target — presented as bloom-and-prune Menu |
| Vocabulary Collision Check | Canonical Vocabulary + current Product Scope artifacts | `collision_risk_report` |
| Unsticking Escalation Bloom | Full unsticking session transcript | Bloom of resolution options — presented as Menu |
| Schema Compatibility Check | `schema_registry.json` + artifact `schema_version` fields | List of schema gaps per artifact type |
| Failed Test Fault Analysis | Failing test case specification + implementation evidence | Routing recommendation |
| Scope Classification | Raw Intent text | `scope_classification` — breadth and depth |
| Intent Quality Assessment | Raw Intent text | `intent_quality_report` |
| Cascade Impact Assessment | `cross_run_impact_report` + cascade thresholds | Cascade threshold check result |

### 7.4 Decision Sequencing Protocol

The `BloomPruneCoordinator` sequences all Menu interactions within a Phase using the following priority ordering. Higher-priority decisions are presented first because they eliminate or constrain branches of subsequent decisions.

**Priority 1 — Scope and boundary decisions:**
Decisions that eliminate entire branches of the candidate space (scope bounding, pillar selection, in-scope vs. out-of-scope determinations). Always presented individually — never bundled.

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

### 7.5 Bloom-and-Prune for Orchestrator Decisions

When the Orchestrator faces a non-deterministic decision with significant consequences — rollback target selection, unsticking escalation resolution, schema gap resolution, version upgrade decisions, cascade threshold breach, incomplete Context Packet with high-materiality gap — it applies bloom-and-prune. All Orchestrator bloom outputs, mirrors, and menus are Governed Stream Records.

### 7.6 OrchestratorEngine Components

| Component | Responsibility |
|---|---|
| `StateMachine` | Reads and writes current phase and sub-phase state |
| `ContextBuilder` | Constructs two-channel Context Payloads — stdin directive and detail file |
| `TemplateLoader` | Loads Prompt Templates; validates required variables; hard-stops on missing variables |
| `AgentInvoker` | Invokes CLI-backed agents with stdin + detail file path; invokes LLM API call roles with narrow context |
| `LLMCaller` | Makes focused, stateless LLM API calls for Orchestrator reasoning |
| `SchemaValidator` | Validates artifacts against JSON Schema library |
| `LoopDetectionMonitor` | Deterministic retry counter and flaw trend analysis |
| `PhaseGateEvaluator` | Orchestrates full Phase Gate check sequence |
| `BloomPruneCoordinator` | Manages Orchestrator-level bloom-and-prune; enforces Decision Sequencing Protocol |
| `GovernedStreamWriter` | Records all actions; assigns Authority Levels; sets `derived_from_system_proposal` flag; triggers Ingestion Pipeline |
| `IngestionPipelineRunner` | Executes all five Ingestion Pipeline stages per new record |
| `DependencyClosureResolver` | Traverses `memory_edge` table to compute full dependency closure for rollbacks |
| `CascadeThresholdChecker` | Compares `cross_run_impact_report` metrics against configured thresholds |

---

## 8. Cross-Cutting Role Specifications

### 8.1 Reasoning Review

**Nature:** Single stateless LLM API call. Google Gemini thinking model.

**Trigger:** Every Sub-Phase producing an artifact that feeds a Phase Gate or another agent's Context Payload.

**Receives (narrow context — not two-channel):**
- The agent's complete output
- The Sub-Phase's required output specification
- The Phase Gate Criteria for the current Phase
- The most relevant prior Phase-Gate-Certified artifacts (targeted query)
- The `compliance_context` artifact (when Domain Compliance Reasoning Review is also triggered)
- The governing ADR(s) for the artifact being reviewed (for `implementation_divergence` checks in Phase 9)

**Complete Flaw Taxonomy:**

| Flaw Type | Definition | Severity Guidance |
|---|---|---|
| `unsupported_assumption` | Agent asserts something as true with no basis in the Context Payload | High if drives a key output field |
| `invalid_inference` | Conclusion does not follow from stated premises | High always |
| `circular_logic` | Conclusion used as a premise in its own justification | High always |
| `scope_violation` | Agent addresses concerns belonging to a different Phase | High if causes incorrect artifact content |
| `premature_convergence` | Agent collapses options that should remain open for human selection | High always — violates bloom-and-prune principle |
| `false_equivalence` | Agent treats two meaningfully different things as interchangeable | High if affects traceability |
| `authority_confusion` | Agent cites a low-authority record as if it were a governing decision | High if drives a key decision |
| `completeness_shortcut` | Agent claims a task complete when only part of it is done | High always |
| `contradiction_with_prior_approved` | Agent's output conflicts with a Phase-Gate-Certified artifact | High always |
| `unacknowledged_uncertainty` | Agent expresses false confidence where genuine ambiguity exists | Low — surfaced as warning |
| `implementability_violation` | A Component Responsibility is scoped too broadly to be implemented in a single Executor Agent session | High — checked in Phase 4 `component_model` review |
| `implementation_divergence` | An Implementation Artifact contradicts or partially contradicts the governing ADR it derives from | High — checked in Phase 9 per-task reviews |

**Output schema:**

```json
{
  "artifact_type": "reasoning_review_record",
  "overall_pass": true,
  "flaws": [
    {
      "flaw_type": "...",
      "severity": "high | low",
      "description": "...",
      "evidence": "specific passage from agent output",
      "recommended_action": "retry | escalate | accept_with_caveat"
    }
  ],
  "reviewed_output_record_id": "...",
  "sub_phase_id": "...",
  "produced_at": "..."
}
```

**Human override:** Permitted for `severity: low` only. Creates a `mirror_approved` record with flaw ID and rationale. `severity: high` must be resolved before Phase Gate passes.

**Domain Compliance Reasoning Review:** When `compliance_context` is populated and the artifact touches a compliance-relevant domain, an additional Reasoning Review pass is triggered as a separate LLM API call. It uses a different model provider from the primary Reasoning Review (configured in `janumicode.config.json` under `llm_routing.domain_compliance_review`) to reduce correlated reasoning errors. Output: `domain_compliance_review_record` Governed Stream Record.

---

### 8.2 Consistency Checker Agent

**Nature:** CLI-backed Agent.

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

**Resolution rule:** `critical` findings block the Phase Gate. `warning` findings are surfaced to human — human decides per warning.

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

**Job:** Reconstruct the complete governing state of all available and relevant sources. Depth is always complete — there is no fast mode. When completeness cannot be achieved, characterize the gap explicitly.

**Produces two outputs:**

**Context Packet summary fields** — for injection into agent stdin directives: `decision_context_summary`, `active_constraints`, `supersession_chains`, `contradictions`, `open_questions`, `completeness_status`.

**Context Packet detail file** — full JSON at the deterministic path — all `material_findings` with evidence, `recommended_drilldowns`, `coverage_assessment`, `implicit_decisions`, `unavailable_sources`.

*(Full seven-stage process, scope tiers, materiality scoring, failure mode handling, incomplete Context Packet protocol — identical to v2.0 Section 8.4.)*

---

### 8.5 Failure Mode Taxonomy and Recovery Protocol

Four named failure types. Each has a primary detection mechanism and recovery path.

| Failure Type | Definition | Primary Detection | Recovery |
|---|---|---|---|
| **Convergence Loop** | Agent retries same approach repeatedly without progress | Loop Detection Monitor: STALLED | Unsticking Agent — Socratic mode |
| **Divergence Loop** | Each retry creates new problems — flaw count increasing | Loop Detection Monitor: DIVERGING | Unsticking Agent — Detective mode |
| **Scope Blindness** | Agent has access to needed information but does not consult it | Loop Detection Monitor: SCOPE_BLIND | Unsticking Agent — Environmental Detective mode |
| **Silent Corruption** | Agent produces syntactically valid output that is semantically wrong without triggering a retry | Phase 9.2 test failure; `implementation_divergence` Reasoning Flaw; Phase 10.1 Consistency Check | Phase 9.4 failure handling: Orchestrator determines fault via focused Reasoning Review |

**Silent Corruption** is the hardest failure mode to catch because it does not trigger retry behavior. Primary defenses:
1. `implementation_divergence` Reasoning Flaw type checked per-task in Phase 9.1
2. Test execution in Phase 9.2 — if tests pass but implementation is semantically wrong, this is an Intent Fidelity failure traced back to Phase 2 domain attestation
3. Pre-commit Consistency Check in Phase 10.1

**The honest boundary:** If the Intent Statement was wrong (Intent Fidelity failure) and tests were generated from wrong requirements, the system will pass all checks yet be functionally incorrect. This is the "Consistency Without Truth" failure mode. The primary defense is the human as external ground truth at the Phase 2 domain attestation step. No automated system can fully close this gap — only human domain expertise at the right point can.

---

### 8.6 Unsticking Agent

*(Specification identical to v2.0 Section 8.5. Two-channel context model does not apply — Unsticking Agent uses LLM API calls with narrow, purpose-built context.)*

---

### 8.7 Test Design Agent and Implementation Planner Agent

#### Test Design Agent

**Nature:** CLI-backed Agent. Two-channel context model applies. Produces Test Case specifications — not code.

**Test Case schema:**

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

**Failed test routing (Phase 9.2):** Orchestrator invokes focused Reasoning Review. Flaw in specification → re-invoke Test Design Agent for that Test Case. Flaw in implementation → re-invoke Executor Agent for relevant task. Ambiguous → escalate to human.

#### Implementation Planner Agent

**Nature:** CLI-backed Agent. Two-channel context model applies.

**Decomposition rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct steps, each step is its own task with explicit `dependency_task_ids`.

**Complexity flagging:** Any task rated `estimated_complexity: high` must include `complexity_flag` with explanation. Surfaced in Phase 6 Mirror with per-task Menu.

**Standard Implementation Task schema:**

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

### 8.8 Eval Design Agent and Eval Execution Agent

*(Specifications identical to v2.0 Sections 8.8. `compliance_context` is added as a required input to the Eval Design Agent — compliance-related NFRs must have evaluation criteria. Domain Compliance Reasoning Review applied to evaluation plans.)*

---

### 8.9 Client Liaison Agent

*(Specification identical to v2.0 Section 8.8. Two-channel context model does not apply — Client Liaison uses LLM API calls with narrow context.)*

---

### 8.10 Ingestion Pipeline

*(Five-stage specification identical to v2.0 Section 8.9. The `derived_from_system_proposal` flag is propagated by the `GovernedStreamWriter` through Ingestion Pipeline Stage II when a new record derives from any record with Authority Level 1 that has not yet been explicitly approved.)*

---

## 9. Prompt Template Library

### 9.1 Template Structure

Machine-readable YAML header per template. Hard stop if any required variable is absent from stdin.

```markdown
---
[JC:PROMPT TEMPLATE]
agent_role: domain_interpreter
sub_phase: 01_2_intent_domain_bloom
schema_version: 1.0
required_variables:
  - active_constraints
  - scope_classification
  - compliance_context_summary
  - collision_risk_report
  - prior_decision_summary_summary
  - deep_memory_context_summary
  - detail_file_path
  - raw_intent
  - janumicode_version_sha
---

[JC:SYSTEM SCOPE]
You are the [JC:Domain Interpreter Agent] executing [JC:Sub-Phase] 1.2 — Intent Domain Bloom.

GOVERNING CONSTRAINTS (apply without exception):
{{active_constraints}}

REQUIRED OUTPUT: {{required_output_specification}}

CONTEXT SUMMARY:
Scope: {{scope_classification}}
Compliance regimes: {{compliance_context_summary}}
Prior decisions: {{prior_decision_summary_summary}}
Memory research: {{deep_memory_context_summary}}

DETAIL FILE:
Complete supporting context available at: {{detail_file_path}}
Consult for: full prior decision rationale, historical artifacts, compliance specifics.
Read sections relevant to your current reasoning step — not the entire file upfront.

[PRODUCT SCOPE]
Alias table: {{collision_risk_report_aliases}}
Current task — [JC:Raw Intent]: {{raw_intent}}
```

### 9.2 Always-Prefixed JanumiCode Terms

`[JC:Phase]`, `[JC:Sub-Phase]`, `[JC:Agent Role]`, `[JC:Artifact]`, `[JC:Workflow Run]`, `[JC:Governed Stream]`, `[JC:Orchestrator]`, `[JC:Phase Gate]`, `[JC:Prompt Template]`, `[JC:Context Payload]`, `[JC:Reasoning Review]`, `[JC:Domain Compliance Reasoning Review]`, `[JC:Unsticking Agent]`, `[JC:Loop Detection Monitor]`, `[JC:Mirror]`, `[JC:Menu]`, `[JC:Decision Bundle]`, `[JC:Bloom]`, `[JC:Prune]`, `[JC:Context Packet]`, `[JC:Retrieval Brief]`, `[JC:Authority Level]`, `[JC:Memory Edge]`, `[JC:System-Proposed Content]`, `[JC:Refactoring Task]`

### 9.3 Directory Structure

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
      /sub_phase_02_5_attestation/
    /phase_03_system_specification/
    /phase_04_architecture/
    /phase_05_technical_specification/
    /phase_06_implementation_planning/
    /phase_07_test_planning/
    /phase_08_evaluation_planning/
    /phase_09_execution/
    /phase_10_commit/
  /cross_cutting
    reasoning_review.system.md
    domain_compliance_review.system.md
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
  "schema_version": "1.1",
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
    "reasoning_review":            { "provider": "google", "model": "gemini-2.0-flash-thinking" },
    "domain_compliance_review":    { "provider": "anthropic", "model": "claude-sonnet-4-20250514",
                                     "note": "Use different provider from reasoning_review to reduce correlated errors" },
    "narrative_memory":            { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "decision_trace":              { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "vocabulary_collision_check":  { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "intent_quality_check":        { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "scope_classification":        { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "ingestion_pipeline_stage3":   { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "loop_detection_monitor":      { "implementation": "deterministic" }
  },

  "governed_stream": {
    "sqlite_path": ".janumicode/governed_stream.db",
    "vector_extension": "sqlite-vec",
    "embedding_model": { "provider": "...", "model": "..." }
  },

  "context_assembly": {
    "cli_agents": {
      "stdin_max_tokens": 8000,
      "detail_file_path_template": ".janumicode/context/{sub_phase_id}_{invocation_id}.md",
      "detail_file_cleanup": "archive_after_phase_gate",
      "governing_constraints_always_in_stdin": true,
      "hard_stop_on_governing_constraint_overflow": true
    }
  },

  "schema_library_path":          ".janumicode/schemas",
  "prompt_template_library_path": ".janumicode/prompts",
  "specialists_config_path":      "janumicode.specialists.json",

  "workflow": {
    "max_retry_attempts_per_subphase": 3,
    "loop_detection_threshold": 3,
    "bloom_confidence_threshold": 0.85,
    "require_human_approval_all_phase_gates": true
  },

  "deep_memory_research": {
    "materiality_weights": {
      "semantic_similarity": 0.20,
      "constraint_relevance": 0.25,
      "authority_level": 0.20,
      "temporal_recency": 0.15,
      "causal_relevance": 0.10,
      "contradiction_signal": 0.10
    }
  },

  "cross_run_refactoring": {
    "cascade_threshold_task_count": 10,
    "cascade_threshold_file_count": 20
  },

  "evaluation_tools": {
    "linter": "eslint",
    "type_checker": "tsc",
    "security_scanner": "npm_audit",
    "performance": "k6",
    "accessibility": "lighthouse"
  },

  "git": {
    "remote": "origin",
    "commit_branch": "main"
  }
}
```

### 10.2 `janumicode.specialists.json`

*(Schema identical to v2.0 Section 10.2.)*

---

## 11. Governed Stream Database Schema

```sql
-- Universal record store
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
  unsticking_session_id         TEXT
);

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
```

### 11.1 Key Design Decisions

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
    domain_compliance_review_record.schema.json
    loop_detection_record.schema.json
    unsticking_resolution.schema.json
    unsticking_escalation.schema.json
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
  /configuration
    janumicode.config.schema.json
    janumicode.specialists.schema.json
  /meta
    schema_registry.json
```

---

## 13. Version Management and Upgrade Protocol

*(Identical to v2.0 Section 13. Sub-Phase idempotency, upgrade detection, schema compatibility check, rollback within a run, and upgrade friction acknowledgment are unchanged.)*

**Addition:** Refactoring Tasks are explicitly idempotent by design — the `expected_pre_state_hash` and `verification_step` fields provide the idempotency guarantee. If JanumiCode is upgraded between the start and completion of a Phase 0.5 refactoring scope, the Refactoring Tasks retain their pre-computed hashes from the prior version. The Schema Compatibility Check at the next Phase Gate includes Refactoring Task schema fields in its comparison.

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

---

## 15. Appendix — Key Record Schemas

### 15.1 Decision Trace Summary

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

### 15.2 Refactoring Task Schema

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

### 15.3 Cross-Run Modification Record

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

### 15.4 Intent Quality Report

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

### 15.5 Reasoning Review Record (updated flaw types)

```json
{
  "record_type": "reasoning_review_record",
  "schema_version": "1.1",
  "overall_pass": true,
  "flaws": [
    {
      "flaw_type": "unsupported_assumption | invalid_inference | circular_logic | scope_violation | premature_convergence | false_equivalence | authority_confusion | completeness_shortcut | contradiction_with_prior_approved | unacknowledged_uncertainty | implementability_violation | implementation_divergence",
      "severity": "high | low",
      "description": "...",
      "evidence": "specific passage from agent output",
      "governing_adr_id": "... (implementation_divergence only)",
      "recommended_action": "retry | escalate | accept_with_caveat | return_to_phase4"
    }
  ],
  "reviewed_output_record_id": "...",
  "sub_phase_id": "...",
  "produced_at": "..."
}
```

---

*JanumiCode Master Product Specification — Version 2.1*
*All sections subject to revision through bloom-and-prune with human approval.*
*Deferred items catalogued in Section 14.*
*Changelog from v2.0 documented in header.*
