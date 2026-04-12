# JanumiCode Master Product Specification

**Version 2.0 — Implementation-Ready**

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

- **100% correctness and completeness — always.** Never optimize for speed at the expense of either.
- **Every phase is mandatory and executed in order.** The [JC:Orchestrator] cannot skip phases.
- **Every [JC:Phase Gate] requires human approval.** No automated gate passage.
- **Every human interaction is recorded in the [JC:Governed Stream] in full detail.**
- **Agents never exercise judgment.** Judgment is always escalated to the human.
- **The [JC:Governed Stream] is single-threaded.** No parallel [JC:Workflow Runs] in a [JC:Workspace].
- **All [JC:Artifacts] are owned by JanumiCode** and stored in the [JC:Governed Stream] database.
- **Prompt Templates use namespace prefixing ([JC:] and [P:]) and separate context scopes at all times.**

---

## 2. Canonical Vocabulary

All [JC:Prompt Templates], schema fields, agent instructions, and UI labels must use these terms exclusively. Prohibited aliases must never appear in any system artifact.

### Layer 0 — Meta / System Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Governed Stream** | The single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode — including structured artifacts, interaction records, memory objects, relationship edges, and operational state. The Governed Stream is the system of record for everything. | "Artifact Store", "chat history", "log", "database", "memory store" |
| **Governed Stream Record** | A single entry in the Governed Stream — may be a human input, agent output, artifact, tool call, tool result, decision, memory, or relationship edge | "message", "event", "entry" |
| **Workflow Run** | A single end-to-end JanumiCode execution for a specific [JC:Intent Statement], from initiation through final approval | "session", "project run", "pipeline run" |
| **Artifact** | A Governed Stream Record whose `record_type` designates it as a schema-validated JSON document produced as a required output of a phase or sub-phase | "output", "result", "document", "response" |
| **Workspace** | The VS Code workspace within which JanumiCode operates; the scope boundary for a brownfield project's existing artifacts | "project", "repo", "codebase" |
| **janumicode_version_sha** | The git commit SHA of the JanumiCode repository pinned at Workflow Run initiation; recorded on every Governed Stream Record | "version", "build number" |

### Layer 1 — Human Intent Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Raw Intent** | The initial, underspecified human input that initiates a Workflow Run | "prompt", "request", "input", "query" |
| **Intent Domain** | The subject matter area(s) the Raw Intent addresses at a conceptual level without implementation assumptions | "domain" (unqualified), "subject", "topic" |
| **Intent Statement** | The locked, agent-elaborated, human-approved specification of what the human means — produced at the end of Phase 1 | "finalized prompt", "confirmed intent" |
| **Assumption** | An inference made by an agent about something not explicitly stated; must always be surfaced and approved | "implication", "inference", "default" |
| **Constraint** | A condition the solution must satisfy — technical, business, regulatory, or preferential | "requirement" (at this layer), "limitation" |
| **Open Question** | An ambiguity identified by an agent that cannot be resolved without human judgment | "unclear point", "unknown", "TBD" |

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
| **Component Responsibility** | A statement of what a Component is solely accountable for | "ownership", "concern", "purpose" |
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
| **Functional Evaluation** | Assessment of whether Implementation Artifacts satisfy Functional Requirements not already covered by the Test Plan | "functional testing" (at eval layer) |
| **Quality Evaluation** | Assessment of non-functional properties: performance, security, maintainability, accessibility | "NFR testing", "quality assessment" |
| **Reasoning Review** | A focused LLM API call (not an agent) that inspects an agent's output for reasoning flaws against the complete flaw taxonomy | "QA check", "review step", "LLM review" |
| **Reasoning Flaw** | A specific, named defect in agent reasoning — see Section 8.1 for the complete taxonomy | "error", "mistake", "hallucination" (too vague) |

### Layer 10 — Agent and Orchestration Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Agent Role** | A named, specification-defined function in JanumiCode with defined inputs, outputs, responsibilities, and Backing Tool | "agent", "bot", "assistant" (unqualified) |
| **Backing Tool** | The CLI or API used to execute an Agent Role (e.g., Claude Code CLI, Gemini CLI, OpenAI Codex CLI) | "LLM", "model", "provider" (at role level) |
| **Agent Invocation** | A single call to an Agent Role's Backing Tool with a fully constructed prompt and Context Payload | "agent call", "LLM call", "tool call" |
| **Prompt Template** | A versioned, parameterized instruction set used to construct the input to an Agent Invocation | "system prompt", "prompt", "instruction" |
| **Context Payload** | The complete set of Artifacts, Governed Stream Records, and memory items injected into an Agent Invocation | "context", "input", "prompt context" |
| **Orchestrator** | The TypeScript OrchestratorEngine class responsible for sequencing phases, constructing Context Payloads, routing between Agent Roles, and managing Phase Gate evaluation | "coordinator", "manager", "controller" |
| **Phase** | A mandatory, named stage of a Workflow Run with defined entry criteria, required Agent Invocations, required output Artifacts, and a Phase Gate | "step", "stage", "workflow stage" |
| **Sub-Phase** | A named, ordered step within a Phase with its own required Agent Invocations and output Artifacts | "step", "task" (at orchestration layer) |
| **Phase Gate** | The validation checkpoint at the end of a Phase — all criteria must pass before the next Phase begins | "checkpoint", "gate", "review point" |
| **Phase Gate Criterion** | A single verifiable condition that must be true for a Phase Gate to pass | "gate condition", "completion criterion" |
| **Bloom Phase** | The Sub-Phase in which agents expand an underspecified input into a fully articulated candidate space | "expansion", "elaboration" |
| **Prune Phase** | The Sub-Phase in which the human narrows the candidate space through Mirror-and-Menu interactions | "refinement", "narrowing", "clarification" |
| **Mirror** | An annotated Artifact reflecting the agent's current understanding with all Assumptions flagged inline for human review | "reflection", "summary", "restatement" |
| **Menu** | A structured set of human-selectable options presented during a Prune Phase — format chosen by the system per question type | "options", "choices", "questions" |
| **Decision Trace** | A structured Governed Stream Record capturing a human's selection from a Menu, context presented, and timestamp | "decision log", "choice record" |
| **Narrative Memory** | A generated structured summary of a completed Phase, with inline source citations, used as compressed historical context in future Agent Invocations | "memory", "summary", "context note" |
| **Deep Memory Research** | An Agent Role invocation that reconstructs complete governing context from all available sources through a multi-stage pipeline | "memory search", "context retrieval", "RAG" |
| **Context Packet** | The structured output artifact produced by the Deep Memory Research Agent — the complete, sourced, gap-characterized reconstruction of governing history relevant to a current question | "context", "memory output", "retrieval result" |
| **Completeness Status** | A field on every Context Packet classifying whether retrieval was `complete`, `partial_low`, `partial_medium`, or `incomplete_high` | "coverage", "confidence" (these are separate fields) |
| **Retrieval Brief** | The minimal structured input a hiring entity passes to the Deep Memory Research Agent — scope tier plus natural language query | "search query", "retrieval request" |
| **Client Liaison Agent** | The Agent Role that receives human Open Queries, classifies them, retrieves relevant history, synthesizes responses, and escalates workflow implications to the Orchestrator | "chatbot", "assistant", "Q&A agent" |
| **Open Query** | A human-initiated, unstructured natural language input that arrives outside a structured Menu or Mirror interaction | "question", "chat message", "freeform input" |
| **Query Type** | One of five categories: Historical Lookup, Consistency Challenge, Forward Implication Query, Rationale Request, Ambient Clarification | (use Query Type + name) |
| **Provenance Statement** | A citation identifying the specific Governed Stream Record(s) supporting each claim in a response or summary | "source", "reference", "citation" |
| **Unsticking Agent** | The Agent Role that investigates and resolves stuck agent situations through Socratic elicitation, detective reasoning, and specialist recruitment | "lateral thinking agent", "helper agent" |
| **Loop Detection Monitor** | A deterministic process (not an LLM call) that evaluates retry count and Reasoning Flaw trends to classify Loop Status | "loop checker", "retry monitor" |
| **Loop Status** | The Loop Detection Monitor's classification: CONVERGING, STALLED, DIVERGING, or SCOPE_BLIND | "loop state", "retry status" |
| **Specialist Agent** | An Agent Role invoked by the Unsticking Agent to diagnose a specific problem class that exceeds the generalist agent's capability | "specialist", "expert model" |
| **Unsticking Action Boundary** | A configuration artifact injected into every Unsticking Agent invocation defining the scope of permitted actions | "scope boundary", "action limits" |

### Layer 11 — Memory Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Authority Level** | A numeric (1–7) classification of a Governed Stream Record expressing how much governing weight it carries in retrieval, conflict resolution, and decision-making | "importance", "weight", "trust level" |
| **Semantic Supersession** | The condition where a later record overrides an earlier record's governing position on a subject, without necessarily triggering an artifact rollback | "overriding", "replacing", "updating" (unqualified) |
| **Memory Edge** | A typed, directed relationship between two Governed Stream Records, stored in the `memory_edge` table | "link", "relationship", "connection" (unqualified) |
| **Edge Type** | The canonical classification of a Memory Edge from the controlled vocabulary — see Section 11 for full list | (use Edge Type + name) |
| **Materiality Score** | The weighted composite score used by the Deep Memory Research Agent to determine whether a candidate record is relevant enough to include in a Context Packet | "relevance score", "similarity score" |
| **Constitutional Invariant** | A Design Invariant from Section 1.5 carrying Authority Level 7 — cannot be superseded by any Workflow Run artifact or decision | "hardcoded rule", "system constraint" |
| **Ingestion Pipeline** | The synchronous normalization process every new Governed Stream Record passes through — assigning authority level, asserting deterministic edges, proposing relationship edges, checking supersession | "indexing", "processing", "storage" |

### Layer 12 — Brownfield / History Terms

| Canonical Term | Definition | Prohibited Aliases |
|---|---|---|
| **Existing Artifact** | Any artifact present in the Workspace before a Workflow Run begins — source code, tests, documentation, configuration | "legacy code", "existing code", "prior work" |
| **Artifact Ingestion** | The process of normalizing Existing Artifacts into JanumiCode's record schema at the start of a brownfield Workflow Run | "import", "onboarding", "scanning" |
| **Ingestion Gap** | An undocumented decision, missing requirement, or untested behavior identified during Artifact Ingestion | "gap", "missing piece", "unknown" |
| **Ingestion Conflict** | A contradiction between two or more Existing Artifacts identified during Artifact Ingestion | "conflict", "inconsistency", "mismatch" |
| **Decision History** | The complete set of Decision Traces from all prior Workflow Runs in a Workspace | "history", "prior decisions", "context" |
| **Prior Decision Summary** | A structured artifact produced in Phase 0 listing Architectural Decisions and confirmed Assumptions from prior Workflow Runs that the current run must respect unless explicitly superseded | "prior context", "historical constraints" |
| **Prior Decision Override** | A Decision Trace of type `prior_decision_override` — the formal record that a human knowingly chose to contradict a prior Phase-Gate-Certified decision, triggering Semantic Supersession | "override", "reversal" |

---

## 3. Agent Roster

Every Agent Role has defined inputs, outputs, responsibilities, and a Backing Tool. CLI-backed Agent Roles have workspace access. LLM API call roles are stateless — all needed context is injected per call. Detailed specifications for cross-cutting roles appear in Section 8.

| Agent Role | Nature | Default Backing Tool | Primary Responsibilities |
|---|---|---|---|
| Domain Interpreter | CLI-backed Agent | Configurable | Intent Domain bloom; Assumption surfacing; Intent Statement synthesis; brownfield contradiction annotation |
| Requirements Agent | CLI-backed Agent | Configurable | Functional Requirements and Non-Functional Requirements derivation |
| Systems Agent | CLI-backed Agent | Configurable | System Boundary definition; System Requirements; Interface Contracts |
| Architecture Agent | CLI-backed Agent | Configurable | Software Domain identification; Component decomposition; ADR generation |
| Technical Spec Agent | CLI-backed Agent | Configurable | Data Models; API Definitions; Error Handling Strategies; Configuration Parameters |
| Implementation Planner | CLI-backed Agent | Configurable | Implementation Task decomposition; dependency ordering; parallelism field estimation |
| Executor Agent | CLI-backed Agent | Claude Code CLI | Code generation; file system changes; test code implementation; CI tool invocation |
| Test Design Agent | CLI-backed Agent | Configurable | Test Case specification (not code); Test Suite organization; failed test triage input |
| Eval Design Agent | CLI-backed Agent | Configurable | Functional, Quality, and Reasoning Evaluation Plan design |
| Eval Execution Agent | CLI-backed Agent | Configurable | Evaluation tooling invocation; results capture and mapping to criteria |
| Consistency Checker | CLI-backed Agent | Configurable | Cross-artifact traceability; semantic consistency; internal consistency validation |
| Deep Memory Research | CLI-backed Agent | Configurable | Multi-stage context reconstruction; Context Packet generation; gap characterization |
| Unsticking Agent | LLM API calls | Google Gemini thinking model | Socratic elicitation; detective reasoning; specialist recruitment; investigation recording |
| Client Liaison Agent | LLM API calls | Google Gemini thinking model | Open Query classification; retrieval coordination; response synthesis; escalation |
| Orchestrator | LLM API calls + deterministic | Configurable reasoning model | Phase sequencing; Context Payload construction; Phase Gate evaluation; bloom-and-prune for escalations |
| Loop Detection Monitor | Deterministic — no LLM | N/A — TypeScript process | Retry counting; flaw trend classification; Loop Status assessment |
| Reasoning Review | LLM API call | Google Gemini thinking model | Single-call reasoning flaw inspection against complete flaw taxonomy |
| Narrative Memory Generator | LLM API call | Anthropic Claude Sonnet | Phase summary with inline citations; anti-failure-mode discipline |

### 3.1 Authority Level Taxonomy

Every Governed Stream Record is assigned an Authority Level at write time by the `GovernedStreamWriter`. Assignment is deterministic — no LLM call required.

| Level | Name | Definition | Assignment Rule |
|---|---|---|---|
| 1 | Exploratory | Agent-generated candidate space before any human interaction | Any record produced in Bloom Sub-Phases before Mirror interaction |
| 2 | Agent-Asserted | Agent output not yet seen or validated by any human | Any artifact produced by an agent not yet presented to the human |
| 3 | Human-Acknowledged | Human saw and did not reject — proceeded without editing | Human continued past a Mirror without editing or explicitly approving |
| 4 | Human-Edited | Human actively modified agent-produced Mirror content | Record type is `mirror_edited`; edited content assigned Level 4 |
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

### 3.2 Semantic Supersession and Prior Decision Override

Semantic Supersession is not a rollback. It is the formal mechanism by which a human knowingly establishes a new governing position that contradicts a prior Phase-Gate-Certified decision.

**Trigger:** Human selects a bloom candidate in Phase 1 that conflicts with a prior Phase-Gate-Certified decision from a prior Workflow Run.

**Mechanism:**
1. Domain Interpreter annotates the conflicting candidate inline in the Mirror with `[CONFLICTS WITH PRIOR DECISION — human resolution required]`, citing the prior decision's record ID and Authority Level
2. Human selects the conflicting candidate — this selection is recorded as a `decision_trace` of type `prior_decision_override`
3. `GovernedStreamWriter` creates a `supersedes` Memory Edge from the new artifact to the prior decision record, with Authority Level 5

**Result:** The prior decision record gets `superseded_at` and `superseded_by_record_id` populated. It remains in the Governed Stream as history. The new artifact is the governing position. Deep Memory Research Agent will report the prior decision in `supersession_chains`, not in `active_constraints`.

---

## 4. Phase and Sub-Phase Contracts

All ten phases are mandatory. Execution is strictly sequential. The Orchestrator cannot skip phases. Phases may only be revisited through an explicit rollback authorized by the human.

At every Phase boundary, the Orchestrator runs a Vocabulary Collision Check and pre-populates Context Packets for agents that require historical context. Narrative Memory and Decision Trace are generated synchronously at every Phase Gate, blocking the Phase transition until complete.

| Phase | Name | Prior Equivalent |
|---|---|---|
| 0 | Workspace Initialization | — (implicit in all prior runs) |
| 1 | Intent Capture and Convergence | Intake |
| 2 | Requirements Definition | Intake (second half) |
| 3 | System Specification | Architecture Decomposition (first half) |
| 4 | Architecture Definition | Architecture Decomposition (second half) |
| 5 | Technical Specification | Propose |
| 6 | Implementation Planning | Propose (second half) + Assumptions Surfacing |
| 7 | Test Planning | Verify |
| 8 | Evaluation Planning | Verify (second half) |
| 9 | Execution | Execute + Validate |
| 10 | Commit and Deployment Initiation | Commit |

---

### Phase 0 — Workspace Initialization

**Purpose:** Establish the baseline context for the Workflow Run — whether greenfield or brownfield. Pin the `janumicode_version_sha`. Run Vocabulary Collision Check.

**Entry Criterion:** A new Workflow Run is initiated by the human.

#### Sub-Phase 0.1 — Workspace Classification

- **[JC:Agent Role]:** Orchestrator
- **Action:** Determines whether Workspace is greenfield (empty Governed Stream, no Existing Artifacts) or brownfield. Pins `janumicode_version_sha`.
- **Output Artifact:** `workspace_classification: {type, existing_artifact_summary, decision_history_summary, janumicode_version_sha}`

#### Sub-Phase 0.2 — Artifact Ingestion *(brownfield only)*

- **[JC:Agent Role]:** Deep Memory Research Agent
- **Action:** Normalizes Existing Artifacts into schema. Identifies Ingestion Gaps and Ingestion Conflicts.
- **Output Artifact:** `ingested_artifact_index`, `ingestion_gap_list`, `ingestion_conflict_list`

#### Sub-Phase 0.2b — Brownfield Continuity Check *(brownfield only)*

- **[JC:Agent Role]:** Deep Memory Research Agent
- **Action:** Retrieves complete Decision History. Produces Prior Decision Summary — the list of Architectural Decisions and confirmed Assumptions from prior runs that the current run must treat as constraints unless explicitly superseded via Prior Decision Override.
- **Output Artifact:** `prior_decision_summary: {decisions: [{id, phase, summary, rationale, governed_stream_record_id, authority_level}]}`

#### Sub-Phase 0.3 — Ingestion Review *(brownfield only)*

- **Interaction:** Mirror presenting `ingestion_gap_list` and `ingestion_conflict_list`. Menu for human to prioritize gaps and resolve conflicts.
- **Output:** Approved `baseline_artifact_set`

#### Sub-Phase 0.4 — Vocabulary Collision Check

- **[JC:Agent Role]:** Orchestrator (LLM API call)
- **Action:** Compares JanumiCode Canonical Vocabulary against intent and any Existing Artifacts. Produces `collision_risk_report` with product-scoped aliases for colliding terms.
- **Output Artifact:** `collision_risk_report: {collisions: [{jc_term, product_term, proposed_alias}]}`

**Phase Gate Criteria:**
- `workspace_classification` is schema-valid and `janumicode_version_sha` is recorded
- All Ingestion Conflicts have a human-approved resolution *(brownfield only)*
- `prior_decision_summary` produced and human-reviewed *(brownfield only)*
- `collision_risk_report` produced and aliases confirmed
- Human has approved `baseline_artifact_set`
- Narrative Memory and Decision Trace generated and stored

---

### Phase 1 — Intent Capture and Convergence

**Purpose:** Transform the Raw Intent into a locked, unambiguous Intent Statement through maximal Bloom and structured Prune.

**Entry Criterion:** Phase 0 Phase Gate passed. `baseline_artifact_set`, `collision_risk_report`, and (brownfield) `prior_decision_summary` available. Orchestrator pre-populates Context Packet for Domain Interpreter Agent (brownfield runs, `all_runs` scope).

#### Sub-Phase 1.1 — Raw Intent Reception

- **[JC:Agent Role]:** Orchestrator
- **Action:** Receives Raw Intent. Logs as Governed Stream Record. Triggers bloom.
- **Output:** `raw_intent_received` Governed Stream Record

#### Sub-Phase 1.2 — Intent Domain Bloom

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Applies `collision_risk_report` aliases before any generation. Expands Raw Intent into full candidate space. Interprets Intent Domain. Surfaces all plausible interpretations. Identifies initial Assumptions and Constraints. Generates candidate Product Concept descriptions. In brownfield runs, checks each candidate against Context Packet `active_constraints` and annotates conflicts inline with `[CONFLICTS WITH PRIOR DECISION — human resolution required]`.
- **Output Artifact:** `intent_bloom: {intent_domain_interpretations, candidate_product_concepts, initial_assumptions, initial_constraints, open_questions, prior_decision_conflicts: [{candidate_id, conflicting_record_id, conflict_description}]}`

#### Sub-Phase 1.3 — Intent Mirror and Menu

- **Interaction:** Annotated Mirror of `intent_bloom` with all Assumptions flagged inline and prior decision conflicts highlighted. Mixed-format Menus resolve Open Questions and select among Product Concept candidates. If human selects a conflicting candidate, selection recorded as `decision_trace` of type `prior_decision_override`. Sub-loop continues until system confidence threshold met OR human explicitly proceeds. All Decision Traces recorded.
- **Output:** Sequence of Decision Trace Governed Stream Records

#### Sub-Phase 1.4 — Intent Statement Synthesis

- **[JC:Agent Role]:** Domain Interpreter Agent
- **Action:** Synthesizes all prune decisions into complete Intent Statement. Reasoning Review applied.
- **Output Artifact:** `intent_statement: {product_concept, confirmed_assumptions, confirmed_constraints, out_of_scope, prior_decision_overrides: [{override_record_id, superseded_record_id}]}`

#### Sub-Phase 1.5 — Intent Statement Approval

- **Interaction:** Full Mirror of `intent_statement`. Human approves, rejects, or edits. If rejected: return to 1.2 with rejection context injected.
- **Output:** Approved `intent_statement`

**Phase Gate Criteria:**
- `intent_statement` is schema-valid
- Reasoning Review finds zero high-severity Reasoning Flaws, or all flagged flaws resolved
- All `prior_decision_override` Decision Traces are recorded with rationale
- Human has explicitly approved `intent_statement`
- Narrative Memory and Decision Trace generated and stored

---

### Phase 2 — Requirements Definition

**Purpose:** Derive complete, traceable Functional Requirements and Non-Functional Requirements from the Intent Statement.

**Entry Criterion:** Phase 1 Phase Gate passed. `intent_statement` available. Vocabulary Collision Check re-run.

#### Sub-Phase 2.1 — Functional Requirements Bloom

- **[JC:Agent Role]:** Requirements Agent
- **Action:** Derives full set of User Stories and Use Cases from `intent_statement`. Assigns Priority Levels. Maps Acceptance Criteria to each User Story.
- **Output Artifact:** `functional_requirements: {user_stories: [{id, role, action, outcome, priority, acceptance_criteria: [{id, statement}]}], use_cases: [{id, actor, goal, steps}]}`

#### Sub-Phase 2.2 — Non-Functional Requirements Bloom

- **[JC:Agent Role]:** Requirements Agent
- **Action:** Derives Non-Functional Requirements from `intent_statement` and `baseline_artifact_set`. Categorizes by type: performance, security, reliability, scalability, maintainability, accessibility.
- **Output Artifact:** `non_functional_requirements: {items: [{id, category, statement, measurable_criterion, priority}]}`

#### Sub-Phase 2.3 — Requirements Mirror and Menu

- **Interaction:** Annotated Mirror of both artifacts. Menus resolve Priority Level conflicts, surface missing Use Cases, confirm Out-of-Scope items. Reasoning Review applied after mirror interaction.

#### Sub-Phase 2.4 — Requirements Consistency Check

- **[JC:Agent Role]:** Consistency Checker Agent
- **Context Payload includes:** Context Packet from Deep Memory Research Agent (Orchestrator pre-populated, `all_runs` scope)
- **Action:** Three check types — mechanical traceability, semantic consistency, internal consistency. See Section 8.2 for full specification.
- **Output Artifact:** `consistency_report`

#### Sub-Phase 2.5 — Requirements Approval

- **Interaction:** Mirror of consistency report. Human approves or triggers targeted re-bloom of flagged items.

**Phase Gate Criteria:**
- All artifacts are schema-valid
- `consistency_report` shows zero critical failures
- All User Stories have at least one Acceptance Criterion
- Human has approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 3 — System Specification

**Purpose:** Allocate requirements to a defined System Boundary. Specify all External Systems and Interface Contracts. Produce System Requirements.

**Entry Criterion:** Phase 2 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Systems Agent (`all_runs` scope).

#### Sub-Phase 3.1 — System Boundary Definition

- **[JC:Agent Role]:** Systems Agent
- **Output Artifact:** `system_boundary: {in_scope, out_of_scope, external_systems: [{id, name, purpose, interface_type}]}`

#### Sub-Phase 3.2 — System Requirements Derivation

- **[JC:Agent Role]:** Systems Agent
- **Output Artifact:** `system_requirements: {items: [{id, statement, source_requirement_ids, allocation, priority}]}`

#### Sub-Phase 3.3 — Interface Contract Specification

- **[JC:Agent Role]:** Systems Agent
- **Output Artifact:** `interface_contracts: {contracts: [{id, systems_involved, protocol, data_format, auth_mechanism, error_handling_strategy}]}`

#### Sub-Phase 3.4 — System Specification Mirror and Menu

- **Interaction:** Annotated Mirror. Menus resolve boundary decisions and External System choices. Reasoning Review applied.

#### Sub-Phase 3.5 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)
- **Interaction:** Human approves or triggers re-bloom of flagged items.

**Phase Gate Criteria:**
- Every Functional Requirement maps to at least one System Requirement
- Every External System has at least one Interface Contract
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 4 — Architecture Definition

**Purpose:** Decompose the system into Components with defined responsibilities, Dependencies, and Architectural Decisions.

**Entry Criterion:** Phase 3 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Architecture Agent (`all_runs` scope).

#### Sub-Phase 4.1 — Software Domain Identification

- **[JC:Agent Role]:** Architecture Agent
- **Output Artifact:** `software_domains: {domains: [{id, name, ubiquitous_language: [{term, definition}], system_requirement_ids}]}`

#### Sub-Phase 4.2 — Component Decomposition

- **[JC:Agent Role]:** Architecture Agent
- **Output Artifact:** `component_model: {components: [{id, name, domain_id, responsibilities: [{id, statement}], dependencies: [{target_component_id, dependency_type}]}]}`

#### Sub-Phase 4.3 — Architectural Decision Capture

- **[JC:Agent Role]:** Architecture Agent
- **Output Artifact:** `architectural_decisions: {adrs: [{id, title, status, context, decision, alternatives, rationale, consequences}]}`

#### Sub-Phase 4.4 — Architecture Mirror and Menu

- **Interaction:** Annotated Mirror with ADRs inline. Menus resolve key architectural choices. Reasoning Review applied — especially for Dependency cycles and responsibility overlaps.

#### Sub-Phase 4.5 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)

**Phase Gate Criteria:**
- Every System Requirement allocated to at least one Component
- No circular Dependencies without explicit ADR justification
- Every ADR has a human-confirmed decision
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 5 — Technical Specification

**Purpose:** Produce implementable Technical Specifications for each Component.

**Entry Criterion:** Phase 4 Phase Gate passed. Vocabulary Collision Check re-run. Orchestrator pre-populates Context Packet for Technical Spec Agent (`all_runs` scope).

#### Sub-Phase 5.1 — Data Model Specification

- **[JC:Agent Role]:** Technical Spec Agent
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

- **Interaction:** Annotated Mirror. Menus resolve technology choices, library selections, patterns. Reasoning Review applied.

#### Sub-Phase 5.6 — Consistency Check and Approval

- **[JC:Agent Role]:** Consistency Checker Agent (Context Packet pre-populated)

**Phase Gate Criteria:**
- Every Component has a complete Technical Specification
- All API Definitions consistent with Interface Contracts from Phase 3
- All Data Models consistent with Component Responsibilities from Phase 4
- Reasoning Review clean
- Zero critical consistency failures
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 6 — Implementation Planning

**Purpose:** Decompose Technical Specifications into an ordered, atomic Implementation Plan.

**Entry Criterion:** Phase 5 Phase Gate passed.

#### Sub-Phase 6.1 — Implementation Task Decomposition

- **[JC:Agent Role]:** Implementation Planner Agent
- **Decomposition Rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct implementation steps, each step is its own task with explicit `dependency_task_ids` linking them.
- **Output Artifact:** `implementation_plan` — see Section 8.7 for full task schema

#### Sub-Phase 6.2 — Implementation Plan Mirror and Menu

- **Interaction:** Mirror of sequenced task graph. Menus resolve sequencing conflicts and complexity concerns. Reasoning Review applied.

#### Sub-Phase 6.3 — Approval

- **Interaction:** Human approves `implementation_plan`.

**Phase Gate Criteria:**
- Every Technical Specification covered by at least one Implementation Task
- No circular task Dependencies
- All tasks have an assigned Backing Tool
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 7 — Test Planning

**Purpose:** Produce a complete Test Plan with Test Case specifications traced to every Acceptance Criterion. Test Cases are specifications — not code. Executor Agent implements them as code during Phase 9.

**Entry Criterion:** Phase 6 Phase Gate passed.

#### Sub-Phase 7.1 — Test Case Generation

- **[JC:Agent Role]:** Test Design Agent
- **Action:** Generates structured Test Case specifications for every Acceptance Criterion. Categorizes as Unit, Integration, or End-to-End. Assigns to Test Suites per Component. Covers functional behavior only — NFR coverage is Phase 8's responsibility.
- **Output Artifact:** `test_plan` — see Section 8.6 for full Test Case schema

#### Sub-Phase 7.2 — Test Coverage Analysis

- **[JC:Agent Role]:** Consistency Checker Agent
- **Action:** Verifies every Acceptance Criterion has at least one Test Case. Identifies coverage gaps.
- **Output Artifact:** `test_coverage_report: {gaps: [{acceptance_criterion_id, reason}], coverage_percentage}`

#### Sub-Phase 7.3 — Test Plan Mirror and Menu

- **Interaction:** Annotated Mirror. Reasoning Review applied.

#### Sub-Phase 7.4 — Approval

- **Interaction:** Human approves `test_plan`.

**Phase Gate Criteria:**
- Every Acceptance Criterion covered by at least one Test Case
- `test_coverage_report` shows zero unresolved gaps
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 8 — Evaluation Planning

**Purpose:** Define how quality attributes per Non-Functional Requirements will be assessed, using tooling that the Test Plan does not cover.

**Entry Criterion:** Phase 7 Phase Gate passed. Eval Design Agent receives `test_plan` as read-only input to ensure no duplication.

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

- **Interaction:** Annotated Mirror. Reasoning Review applied — meta-eval check that evaluation criteria map to stated requirements.

#### Sub-Phase 8.5 — Approval

**Phase Gate Criteria:**
- Every Non-Functional Requirement has at least one Quality Evaluation criterion with specified tooling
- Every Functional Requirement has at least one Functional Evaluation criterion
- No evaluation criterion duplicates a Test Case from Phase 7
- Reasoning Review clean
- Human approved
- Narrative Memory and Decision Trace generated and stored

---

### Phase 9 — Execution

**Purpose:** Execute the Implementation Plan and Test Plan. Capture all results. Invoke Loop Detection Monitor and Unsticking Agent as needed.

**Entry Criterion:** Phases 6, 7, and 8 all Phase Gate passed.

#### Sub-Phase 9.1 — Implementation Task Execution

- **[JC:Agent Role]:** Executor Agent (per task, per assigned Backing Tool)
- **Action:** Executor Agent implements Test Cases as runnable code from Test Case specifications before implementing application code — test-first where the Test Case specification makes this possible. Executes each Implementation Task in dependency order. Produces Implementation Artifacts. All Agent Invocations, tool calls, and outputs captured in Governed Stream. Reasoning Review applied after each task completion. Loop Detection Monitor active throughout.
- **Output:** Implementation Artifacts (source code, configuration files, migration scripts, test code)

#### Sub-Phase 9.2 — Test Execution

- **[JC:Agent Role]:** Executor Agent (test runner configuration)
- **Action:** Executes all Test Suites. Captures Test Results.
- **Failed test routing:** Orchestrator invokes focused Reasoning Review on the failing test against implementation evidence. If flaw is in Test Case specification: re-invoke Test Design Agent for that Test Case only. If flaw is in implementation: re-invoke Executor Agent for the relevant Implementation Task. If ambiguous: escalate to human.
- **Output Artifact:** `test_results: {suite_results: [{suite_id, test_results: [{test_case_id, status, output, timestamp}]}]}`

#### Sub-Phase 9.3 — Evaluation Execution

- **[JC:Agent Role]:** Eval Execution Agent
- **Action:** Runs all tooling specified in Evaluation Plans. Maps outputs to criteria. Captures results.
- **Output Artifact:** `evaluation_results: {functional: [...], quality: [...], reasoning: [...]}`

#### Sub-Phase 9.4 — Failure Handling

- **Interaction:** On any Test Result failure or Evaluation failure: escalate to human with specific failure context, evidence, and options — retry targeted re-execution, rollback to prior Phase, or accept with documented exception.

#### Sub-Phase 9.5 — Completion Approval

- **Interaction:** Full Mirror of `test_results` and `evaluation_results`. Human approves Workflow Run as complete.

**Phase Gate Criteria:**
- All Implementation Tasks executed with Reasoning Review clean
- All Test Cases pass, or failures explicitly accepted by human with documented rationale
- All Evaluation criteria pass, or exceptions documented and human-approved
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
- `pre_commit_consistency_report` shows zero unresolved issues
- `commit_record` is valid (SHA confirmed)
- Workflow Run status set to `completed`
- Human approved
- Final Narrative Memory and Decision Trace generated and stored

---

## 5. Governed Stream

The Governed Stream is the single SQLite database containing every record produced by or exchanged between humans and agents in JanumiCode. There is no separate "Artifact Store" — Artifacts are Governed Stream Records whose `record_type` designates them as schema-validated phase outputs. The Governed Stream is the system of record for everything.

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
| `is_current_version` | boolean | False if superseded by rollback within a run |
| `superseded_by_id` | UUID / null | Points to replacement record if rolled back (rollback supersession) |
| `superseded_at` | ISO 8601 / null | When this record was semantically superseded |
| `superseded_by_record_id` | UUID / null | The record that semantically superseded this one |
| `source_workflow_run_id` | UUID | The Workflow Run that originally produced this record |
| `derived_from_record_ids` | UUID[] | Records from which this record was derived |
| `content` | JSON object | Type-specific payload, validated against `schema_version` |

### 5.2 Rollback vs. Semantic Supersession

These are distinct mechanisms that must not be conflated:

| | Rollback Supersession | Semantic Supersession |
|---|---|---|
| **Trigger** | Human authorizes rollback to prior phase | Human explicitly overrides a prior governing decision |
| **Field** | `superseded_by_id` | `superseded_by_record_id` |
| **Scope** | Within a Workflow Run | Across Workflow Runs |
| **Record fate** | `is_current_version: false` | Record remains current; `superseded_at` populated |
| **Governing mechanism** | The newer record in the same run is canonical | `supersedes` Memory Edge created |
| **Human involvement** | Rollback authorization recorded | `prior_decision_override` Decision Trace recorded |
---

## 6. Governed Stream Record Taxonomy

Every entry in the Governed Stream has a canonical `record_type`. Records are stored at maximum granularity — one record per discrete event. All records carry the universal fields from Section 5.1.

### 6.1 Phase and Agent Records

| Record Type | Description |
|---|---|
| `raw_intent_received` | The human's Raw Intent as received, verbatim |
| `agent_invocation` | A single call to a CLI-backed Agent Role — includes Context Payload hash, Prompt Template reference, backing tool |
| `agent_output` | The complete output of an Agent Invocation |
| `tool_call` | A tool call made by a CLI-backed agent during an Agent Invocation |
| `tool_result` | The result of a tool call |
| `artifact_produced` | Pointer to a schema-validated Artifact stored as a Governed Stream Record |
| `reasoning_review_record` | The Reasoning Review LLM API call — inputs, output, flaw findings |

### 6.2 Human Interaction Records

| Record Type | Description |
|---|---|
| `mirror_presented` | The Mirror artifact as presented to the human |
| `menu_presented` | The Menu options as presented to the human |
| `decision_trace` | A human's selection from a Menu with context, options, selection, and timestamp. `decision_type` field specifies: `menu_selection`, `mirror_approval`, `mirror_rejection`, `mirror_edit`, `phase_gate_approval`, `rollback_authorization`, `unsticking_escalation_resolution`, `prior_decision_override` |
| `mirror_approved` | Human approval of a Mirror |
| `mirror_rejected` | Human rejection of a Mirror with rejection reason |
| `mirror_edited` | Human edit of a Mirror — includes original and edited content |
| `phase_gate_evaluation` | The Phase Gate evaluation result — pass/fail per criterion with reasoning |
| `phase_gate_approved` | Human approval of a Phase Gate |
| `phase_gate_rejected` | Human rejection of a Phase Gate with reason |
| `rollback_authorized` | Human authorization of a rollback — includes target Phase/Sub-Phase |

### 6.3 Memory Records

| Record Type | Description |
|---|---|
| `narrative_memory` | Compressed structured summary of a completed Phase with inline citations — see Section 8.3 |
| `decision_trace_summary` | Structured record of all human decisions in a completed Phase |
| `retrieval_brief_record` | Structured brief sent to Deep Memory Research Agent |
| `context_packet` | Structured output of a Deep Memory Research Agent invocation — see Section 8.4 |
| `memory_edge_proposed` | A relationship edge proposed by an agent during Ingestion Pipeline Stage III |
| `memory_edge_confirmed` | A relationship edge confirmed by human or elevated to human-confirmed status |

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
| `unsticking_socratic_turn` | A single question-and-response turn in a Socratic elicitation dialogue |
| `unsticking_specialist_task` | A focused diagnostic task sent to a Specialist Agent |
| `unsticking_specialist_response` | A Specialist Agent's diagnostic output |
| `unsticking_resolution` | The resolution that unblocked the stuck agent — becomes problem class library entry via vector and FTS indexing |
| `unsticking_escalation` | Human escalation card when Unsticking Agent cannot resolve |

### 6.6 System Records

| Record Type | Description |
|---|---|
| `schema_gap_record` | A schema field mismatch found during Schema Compatibility Check on version upgrade |
| `version_upgrade_card` | Human-facing Version Upgrade Card presented at Phase Gate on JanumiCode upgrade |
| `ingestion_pipeline_record` | Output of each Ingestion Pipeline stage for a new record |

---

## 7. Orchestrator Specification

The Orchestrator is not a CLI-backed agent. It is a TypeScript class — `OrchestratorEngine` — whose state lives in the Governed Stream database and whose reasoning is provided by focused, stateless LLM API calls.

### 7.1 Deterministic Operations (No LLM Call)

- Reading and writing current phase and sub-phase state to/from Governed Stream
- Checking the retry counter and Loop Detection Monitor status
- Verifying Artifact schema validity against the JSON Schema library
- Routing to the correct Prompt Template
- Constructing Context Payloads from targeted Governed Stream queries
- Recording Governed Stream Records via `GovernedStreamWriter`
- Triggering Narrative Memory and Decision Trace generation at Phase Gates
- Enforcing the Unsticking Action Boundary by limiting available tools in Agent Invocations
- Assigning Authority Levels at record write time (deterministic per taxonomy)
- Running Ingestion Pipeline Stages I and II (deterministic)

### 7.2 Focused LLM API Calls

Each Orchestrator LLM API call is stateless and scoped. Context budgeting is enforced — the Orchestrator queries the Governed Stream for relevant context rather than loading all records.

| Orchestrator LLM Call | Input | Output |
|---|---|---|
| Phase Gate Evaluation | Relevant artifacts + Phase Gate Criteria + Context Packet | Structured pass/fail per criterion with reasoning |
| Context Payload Adequacy Check | Sub-Phase requirements + candidate Context Payload | List of missing required variables |
| Rollback Recommendation | Failure context + phase history | Recommended rollback target with rationale — presented as bloom-and-prune Menu |
| Vocabulary Collision Check | Canonical Vocabulary + current Product Scope artifacts | `collision_risk_report` with proposed aliases |
| Unsticking Escalation Bloom | Full unsticking session transcript | Bloom of resolution options — presented as Menu |
| Schema Compatibility Check | `schema_registry.json` + artifact `schema_version` fields | List of schema gaps per artifact type |
| Failed Test Fault Analysis | Failing test case specification + implementation evidence | Routing recommendation: Test Design Agent or Executor Agent or escalate |

### 7.3 Bloom-and-Prune for Orchestrator Decisions

When the Orchestrator faces a decision not covered by deterministic rules whose consequences warrant human judgment, it applies the bloom-and-prune pattern. All Orchestrator bloom outputs, mirrors, and menus are Governed Stream Records with their own card presentations.

Triggers: rollback target selection, unsticking escalation resolution, schema gap resolution, version upgrade decisions, incomplete Context Packet with high-materiality gap.

### 7.4 OrchestratorEngine Components

| Component | Responsibility |
|---|---|
| `StateMachine` | Reads and writes current phase and sub-phase state |
| `ContextBuilder` | Constructs Context Payloads from targeted Governed Stream queries |
| `TemplateLoader` | Loads Prompt Templates; validates required variables; hard-stops on missing required variables |
| `AgentInvoker` | Invokes CLI-backed agents with constructed Context Payloads and enforced Action Boundaries |
| `LLMCaller` | Makes focused, stateless LLM API calls for Orchestrator reasoning |
| `SchemaValidator` | Validates artifacts against JSON Schema library |
| `LoopDetectionMonitor` | Deterministic retry counter and flaw trend analysis |
| `PhaseGateEvaluator` | Orchestrates full Phase Gate check sequence |
| `BloomPruneCoordinator` | Manages Orchestrator-level bloom-and-prune interactions |
| `GovernedStreamWriter` | Records all Orchestrator actions; assigns Authority Levels; triggers Ingestion Pipeline |
| `IngestionPipelineRunner` | Executes all five Ingestion Pipeline stages for each new record |

### 7.5 Context Window Management

Each Orchestrator LLM API call receives only:
- Artifacts directly relevant to the current decision
- Narrative Memories from completed phases (not raw records)
- The current Prompt Template header
- The specific question being answered

The Governed Stream's full-text search (FTS5) and vector search (sqlite-vec) are what make targeted retrieval tractable. The Deep Memory Research Agent handles cases where relevant context is non-obvious.

---

## 8. Cross-Cutting Role Specifications

### 8.1 Reasoning Review

**Nature:** Single stateless LLM API call. Google Gemini thinking model.

**Trigger:** Every Sub-Phase producing an artifact that feeds a Phase Gate or another agent's Context Payload.

**Receives:**
- The agent's complete output
- The Sub-Phase's required output specification (from Prompt Template header)
- The Phase Gate Criteria for the current Phase
- The most relevant prior Phase-Gate-Certified artifacts (targeted Governed Stream query)

**Flaw Taxonomy — complete and operationalized:**

| Flaw Type | Definition | Severity Guidance |
|---|---|---|
| Unsupported assumption | Agent asserts something as true with no basis in the Context Payload | High if the assumption drives a key output field |
| Invalid inference | Conclusion does not follow from stated premises | High always |
| Circular logic | Conclusion used as a premise in its own justification | High always |
| Scope violation | Agent addresses concerns belonging to a different Phase | High if it causes incorrect artifact content |
| Premature convergence | Agent collapses options that should remain open for human selection | High always — violates bloom-and-prune principle |
| False equivalence | Agent treats two meaningfully different things as interchangeable | High if it affects traceability |
| Authority confusion | Agent cites a low-authority record as if it were a governing decision | High if it drives a key decision |
| Completeness shortcut | Agent claims a task complete when only part of it is done | High always |
| Contradiction with prior approved artifact | Agent's output conflicts with a Phase-Gate-Certified artifact | High always |
| Unacknowledged uncertainty | Agent expresses false confidence where genuine ambiguity exists | Low — surfaced to human as warning |

**Output schema:**

```json
{
  "artifact_type": "reasoning_review_record",
  "overall_pass": true,
  "flaws": [
    {
      "flaw_type": "unsupported_assumption",
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

**Human override:** Permitted for `severity: low` findings only at Phase Gate. Override creates a `mirror_approved` record with the flaw ID and human rationale documented. `severity: high` findings must be resolved through retry, Unsticking Agent, or rollback before the Phase Gate can pass.

**Loop Detection Monitor reads:** `overall_pass` for trend tracking. `flaw_type` and `severity` for pattern classification.

**Retry injection:** The full `flaws` array is injected into the retrying agent's Context Payload under a `[JC:REASONING REVIEW FINDINGS]` section.

---

### 8.2 Consistency Checker Agent

**Nature:** CLI-backed Agent.

**Receives:**
- The artifacts to be checked
- A structured checklist of required traceability assertions derived from Phase Gate Criteria (constructed by Orchestrator)
- A Context Packet from Deep Memory Research Agent (pre-populated by Orchestrator, `all_runs` scope, Research mode)
- The prior Phase's Narrative Memory for context continuity

**Three check types:**

**Mechanical traceability:** Verify each assertion in the provided checklist. Pass/fail per assertion. Deterministic where possible, LLM-assisted where relationship requires interpretation.

**Semantic consistency:** Free reasoning across all artifacts and the Context Packet. Do they say compatible things about the same subjects? Does any current artifact contradict any historical artifact in the Context Packet?

**Internal consistency:** Within each artifact, are there self-contradictions? Two Acceptance Criteria that cannot both be satisfied? Two Component Responsibilities that overlap incompatibly?

**Output schema:**

```json
{
  "artifact_type": "consistency_report",
  "overall_pass": true,
  "traceability_results": [
    {
      "assertion": "Every User Story has at least one Acceptance Criterion",
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
  "blocking_failures": ["finding_ids"],
  "warnings": ["finding_ids"]
}
```

**Resolution rule:** Any `critical` finding blocks the Phase Gate. `warning` findings are surfaced to the human in the Phase Gate Mirror — human decides per warning whether to resolve or accept with documented rationale.

---

### 8.3 Narrative Memory Generation

**Nature:** Single LLM API call. Anthropic Claude Sonnet. Synchronous — blocks Phase transition until complete.

**Trigger:** End of Phase Gate acceptance, after human approval.

**Receives:**
- Decision Trace for the completed Phase
- All Phase-Gate-approved artifacts from the Phase
- Immediately prior Phase's Narrative Memory (for continuity)
- Structured summaries of any Unsticking sessions from the Phase

**Authority Level assigned:** 5 — Human-Approved (derives from Phase-Gate-approved content).

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
        {
          "decision": "...",
          "rationale": "...",
          "source_record_id": "governed_stream_record_uuid"
        }
      ],
      "assumptions_confirmed": [
        {"assumption": "...", "source_record_id": "..."}
      ],
      "open_items_deferred": [
        {"item": "...", "source_record_id": "..."}
      ]
    }
  ],
  "unsticking_summary": null,
  "governing_constraints_established": [
    {"constraint": "...", "source_record_id": "..."}
  ],
  "embedding_vector": [...]
}
```

**Mandatory prompt instructions — anti-failure-mode discipline:**
- Do not omit qualifiers or conditional language present in the source Decision Trace
- Do not compress competing viewpoints into a single narrative voice — represent disagreement where it existed
- Do not imply a position was stable if it changed during the Phase
- Every substantive claim must cite a `source_record_id`
- Express uncertainty where the underlying evidence was partial or contested

---

### 8.4 Deep Memory Research Agent

**Nature:** CLI-backed Agent backed by configurable Backing Tool.

**Job statement:** When any agent or the human needs to act or decide in a context where prior history is relevant, the Deep Memory Research Agent must reconstruct the complete governing state of all available and relevant sources — what was decided, what assumptions were active, what was later revised, what contradictions exist, and what evidence supports each claim — and must characterize with equal rigor any gaps in that reconstruction, their cause, and their materiality, so that the hiring entity can act or decide in a way that is genuinely complete and trustworthy, or knows exactly why it cannot yet do so.

**Depth:** Always complete. There is no "fast mode." When completeness cannot be achieved, that fact is surfaced in the Context Packet — it is never acceptable to return partial context as if it were complete.

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

---

### 8.5 Unsticking Agent

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

**Governed Stream recording:** Maximum granularity — every turn is a distinct record: `unsticking_session_open`, `unsticking_hypothesis`, `unsticking_socratic_turn`, `unsticking_specialist_task`, `unsticking_specialist_response`, `unsticking_resolution`, `unsticking_escalation`.

**`unsticking_resolution` records** are indexed for vector and FTS retrieval — they constitute a growing problem class library retrievable by future Deep Memory Research Agent invocations.

**Dialogue loop detection:** If three Socratic turns produce no new reasoning from the stuck agent, the dialogue itself is stuck. Escalate to human with full transcript as Escalation Card.

---

### 8.6 Test Design Agent — Test Case Schema

**Nature:** CLI-backed Agent. Produces Test Case specifications — not code.

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
  "implementation_notes": "Specific guidance for Executor Agent implementing this as code — framework, assertion style, test data approach"
}
```

The `implementation_notes` field is the handoff contract to the Executor Agent. It must be specific enough that the Executor Agent knows framework, assertion style, and test data approach without re-interpreting the specification.

**Failed test routing (Phase 9.2):** Orchestrator invokes focused Reasoning Review on the failing test case against implementation evidence. Routing:
- Flaw in Test Case specification → re-invoke Test Design Agent for that Test Case only
- Flaw in implementation → re-invoke Executor Agent for the relevant Implementation Task
- Ambiguous → escalate to human

---

### 8.7 Implementation Planner Agent — Task Schema

**Nature:** CLI-backed Agent.

**Decomposition rule:** One Implementation Task = one Component + one Component Responsibility. If a Component Responsibility requires multiple distinct implementation steps, each step is its own task with explicit `dependency_task_ids`.

**Implementation Task schema:**

```json
{
  "id": "...",
  "component_id": "...",
  "component_responsibility": "exact verbatim text from component_model responsibilities array",
  "description": "...",
  "technical_spec_ids": ["..."],
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "estimated_complexity": "low | medium | high",
  "write_directory_paths": ["src/auth/", "src/session/"],
  "read_directory_paths": ["src/types/"],
  "data_model_entity_refs": ["User", "Session"],
  "configuration_parameter_refs": ["JWT_SECRET"],
  "interface_contract_refs": ["auth_service_api_v1"],
  "derived_from_record_ids": ["tech_spec_auth_001"],
  "path_estimates_are_estimated": true,
  "implementation_notes": "Specific guidance for Executor Agent"
}
```

**`component_responsibility` field:** Must carry verbatim text from the `component_model` artifact. This is the traceability link from task to architecture — paraphrasing is not permitted.

**Parallelism fields:** `write_directory_paths`, `read_directory_paths`, `data_model_entity_refs`, `configuration_parameter_refs`, `interface_contract_refs` are populated as directory-level estimates from the Technical Specification, flagged `path_estimates_are_estimated: true`. The Executor Agent refines to exact paths on completion. The Static Conflict Analyzer (future parallelism feature) will use these fields.

**Dependency graph:** Derived by the Orchestrator from `dependency_task_ids` fields at execution time. The Implementation Planner does not produce a separate graph artifact — the `implementation_plan` is the single source of truth.

---

### 8.8 Client Liaison Agent

**Nature:** LLM API calls. Google Gemini thinking model. Always available.

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

### 8.9 Ingestion Pipeline

Every new Governed Stream Record passes through the Ingestion Pipeline before becoming available to retrieval. The pipeline is synchronous — it completes before the next Sub-Phase begins. Total cost: one LLM API call per new record (Stage III only).

**Stage I — Type Classification and Authority Assignment (deterministic):**
Assigns `authority_level`, `effective_at`, and initial `superseded_at: null` based on record type and Sub-Phase context per the taxonomy in Section 3.1.

**Stage II — Deterministic Edge Assertion (deterministic):**
Creates system Memory Edges based on record type rules. Examples:
- `phase_gate_approved` → `validates` edges to all referenced artifact IDs
- `mirror_edited` → `corrects` edge to the original mirror record
- `artifact_produced` → `derives_from` edges to its input artifact IDs
- `decision_trace` of type `prior_decision_override` → `supersedes` edge to the superseded record

**Stage III — Relationship Extraction (single LLM API call):**
Given the new record's content and a summary of related records retrieved via FTS5, identify candidate relationships. Output: proposed `memory_edge` records with `edge_type`, `target_record_id`, `confidence`. Written as `memory_edge_proposed` Governed Stream Records with `authority_level: 2`.

**Stage IV — Supersession Detection (deterministic with LLM escalation):**
Queries `memory_edge` table for existing records on the same subject. If new record's position conflicts with a prior record's position: if deterministic (explicit ADR relationship, same subject), assert `supersedes` edge automatically. If ambiguous, record as `proposed` for human confirmation at next Phase Gate Mirror.

**Stage V — Open Question Resolution Check (deterministic):**
Queries `memory_edge` table for `raises` edges targeting unresolved Open Questions. If new record appears to answer one, proposes `answers` edge with confidence score.

---

## 9. Prompt Template Library

One Prompt Template file per Agent Role per Sub-Phase. All templates enforce the dual-scope structure and namespace prefixing.

### 9.1 Template Structure

Every template file has a machine-readable YAML header. The `TemplateLoader` parses this header and hard-stops if any required variable is absent from the Context Payload.

```markdown
---
[JC:PROMPT TEMPLATE]
agent_role: domain_interpreter
sub_phase: 01_2_intent_domain_bloom
schema_version: 1.0
required_variables:
  - raw_intent
  - baseline_artifact_set
  - canonical_vocabulary
  - collision_risk_report
  - prior_decision_summary
  - context_packet
  - janumicode_version_sha
---

[JC:SYSTEM SCOPE]
You are the [JC:Domain Interpreter Agent]...
{{canonical_vocabulary}}
{{collision_risk_report}}

[PRODUCT SCOPE]
{{baseline_artifact_set}}
{{prior_decision_summary}}
{{context_packet}}

[JC:TASK]
[JC:Raw Intent] received: {{raw_intent}}
```

### 9.2 Always-Prefixed JanumiCode Terms

These terms always carry `[JC:]` prefix in all Prompt Templates without exception:

`[JC:Phase]`, `[JC:Sub-Phase]`, `[JC:Agent Role]`, `[JC:Artifact]`, `[JC:Workflow Run]`, `[JC:Governed Stream]`, `[JC:Orchestrator]`, `[JC:Phase Gate]`, `[JC:Prompt Template]`, `[JC:Context Payload]`, `[JC:Reasoning Review]`, `[JC:Unsticking Agent]`, `[JC:Loop Detection Monitor]`, `[JC:Mirror]`, `[JC:Menu]`, `[JC:Bloom]`, `[JC:Prune]`, `[JC:Context Packet]`, `[JC:Retrieval Brief]`, `[JC:Authority Level]`, `[JC:Memory Edge]`

### 9.3 Directory Structure

```
/.janumicode/prompts
  /phases
    /phase_00_workspace_init
      /sub_phase_00_1_workspace_classification/
      /sub_phase_00_2_artifact_ingestion/
      /sub_phase_00_2b_brownfield_continuity/
      /sub_phase_00_4_vocabulary_collision_check/
    /phase_01_intent_capture/
    /phase_02_requirements/
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
    narrative_memory.system.md
    decision_trace.system.md
    vocabulary_collision_check.system.md
    ingestion_pipeline_stage3.system.md
    unsticking_session_open.system.md
    unsticking_socratic_turn.system.md
    unsticking_detective_hypothesis.system.md
    unsticking_specialist_task.system.md
    client_liaison_query_classification.system.md
    client_liaison_retrieval_brief.system.md
    client_liaison_synthesis.system.md
    deep_memory_query_decomposition.system.md
    deep_memory_context_packet_synthesis.system.md
  /orchestrator
    phase_gate_evaluation.system.md
    rollback_recommendation.system.md
    context_payload_adequacy.system.md
    failed_test_fault_analysis.system.md
    incomplete_context_packet_bloom.system.md
```

---

## 10. Configuration Schemas

### 10.1 `janumicode.config.json`

Master configuration. Exposed through VS Code extension settings panel — not edited directly by the user.

```json
{
  "schema_version": "1.0",
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
    "narrative_memory":            { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "decision_trace":              { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "vocabulary_collision_check":  { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "ingestion_pipeline_stage3":   { "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    "loop_detection_monitor":      { "implementation": "deterministic" }
  },

  "governed_stream": {
    "sqlite_path": ".janumicode/governed_stream.db",
    "vector_extension": "sqlite-vec",
    "embedding_model": { "provider": "...", "model": "..." }
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

User-maintained specialist registry. Edited directly or through VS Code settings panel.

```json
{
  "schema_version": "1.0",
  "specialists": [
    {
      "specialist_id": "<uuid>",
      "name": "GLM 4.7 Mobile Specialist",
      "backing_tool": "zhipuai_glm_cli",
      "problem_classes": [
        "mobile_source_code_diagnosis",
        "ios_swift_debugging",
        "android_kotlin_debugging"
      ],
      "trigger_conditions": [
        "Executor Agent looping on mobile platform code",
        "Reasoning Review identifies mobile-platform-specific reasoning gaps"
      ],
      "task_scope": "focused_diagnostic",
      "invocation_notes": "Provide isolated code segment and specific error only. Do not pass full codebase context.",
      "known_limitations": [
        "Not suited for overall architecture decisions",
        "Context window constraints on large files"
      ]
    }
  ]
}
```

---

## 11. Governed Stream Database Schema

The Governed Stream uses SQLite with the sqlite-vec extension for vector search and FTS5 with BM25 for full-text search.

```sql
-- Universal record store — the Governed Stream
CREATE TABLE governed_stream (
  id                          TEXT PRIMARY KEY,
  record_type                 TEXT NOT NULL,
  schema_version              TEXT NOT NULL,
  workflow_run_id             TEXT NOT NULL,
  phase_id                    TEXT,
  sub_phase_id                TEXT,
  produced_by_agent_role      TEXT,
  produced_by_record_id       TEXT,
  produced_at                 TEXT NOT NULL,        -- ISO 8601
  effective_at                TEXT,                 -- when underlying event occurred
  janumicode_version_sha      TEXT NOT NULL,
  authority_level             INTEGER NOT NULL DEFAULT 2,
  -- 1=Exploratory 2=Agent-Asserted 3=Human-Acknowledged
  -- 4=Human-Edited 5=Human-Approved 6=Phase-Gate-Certified 7=Constitutional
  is_current_version          INTEGER DEFAULT 1,    -- 0 if superseded by rollback
  superseded_by_id            TEXT,                 -- rollback supersession pointer
  superseded_at               TEXT,                 -- ISO 8601 — semantic supersession
  superseded_by_record_id     TEXT,                 -- semantic supersession pointer
  source_workflow_run_id      TEXT NOT NULL,
  derived_from_record_ids     TEXT,                 -- JSON array of UUIDs
  content                     TEXT NOT NULL,        -- JSON blob validated against schema_version
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Workflow Run registry
CREATE TABLE workflow_runs (
  id                          TEXT PRIMARY KEY,
  workspace_id                TEXT NOT NULL,
  janumicode_version_sha      TEXT NOT NULL,
  initiated_at                TEXT NOT NULL,
  completed_at                TEXT,
  status                      TEXT NOT NULL,        -- active | completed | abandoned
  current_phase_id            TEXT,
  current_sub_phase_id        TEXT,
  raw_intent_record_id        TEXT
);

-- Phase Gate completion registry (fast resume)
CREATE TABLE phase_gates (
  id                          TEXT PRIMARY KEY,
  workflow_run_id             TEXT NOT NULL,
  phase_id                    TEXT NOT NULL,
  sub_phase_id                TEXT,
  completed_at                TEXT NOT NULL,
  human_approved              INTEGER NOT NULL,
  approval_record_id          TEXT NOT NULL,
  narrative_memory_id         TEXT,
  decision_trace_id           TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

-- Retry and loop detection registry
CREATE TABLE sub_phase_execution_log (
  id                          TEXT PRIMARY KEY,
  workflow_run_id             TEXT NOT NULL,
  phase_id                    TEXT NOT NULL,
  sub_phase_id                TEXT NOT NULL,
  attempt_number              INTEGER NOT NULL,
  started_at                  TEXT NOT NULL,
  completed_at                TEXT,
  status                      TEXT NOT NULL,        -- in_progress | completed | failed | unsticking
  loop_status                 TEXT,                 -- null | CONVERGING | STALLED | DIVERGING | SCOPE_BLIND
  unsticking_session_id       TEXT
);

-- Memory Edge table — typed relationships between records
CREATE TABLE memory_edge (
  id                          TEXT PRIMARY KEY,
  source_record_id            TEXT NOT NULL,
  target_record_id            TEXT NOT NULL,
  edge_type                   TEXT NOT NULL,
  -- supersedes | contradicts | supports | derives_from | implements
  -- validates | invalidates | answers | raises | depends_on | corrects | refines
  asserted_by                 TEXT NOT NULL,        -- agent_role | 'human' | 'system'
  asserted_at                 TEXT NOT NULL,
  authority_level             INTEGER NOT NULL,
  confidence                  REAL,                 -- null for deterministic system edges
  workflow_run_id             TEXT,
  notes                       TEXT,
  FOREIGN KEY (source_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (target_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX memory_edge_source ON memory_edge(source_record_id);
CREATE INDEX memory_edge_target ON memory_edge(target_record_id);
CREATE INDEX memory_edge_type   ON memory_edge(edge_type);
CREATE INDEX memory_edge_asserted ON memory_edge(asserted_by, authority_level);

-- Schema version registry
CREATE TABLE schema_versions (
  artifact_type               TEXT NOT NULL,
  schema_version              TEXT NOT NULL,
  introduced_in_sha           TEXT NOT NULL,
  is_current                  INTEGER DEFAULT 1,
  breaking_change_from_version TEXT,
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
  source_record_id            TEXT NOT NULL,
  target_record_id            TEXT NOT NULL,
  reference_type              TEXT NOT NULL,        -- derives_from | validates | implements | tests
  created_at                  TEXT NOT NULL,
  PRIMARY KEY (source_record_id, target_record_id, reference_type)
);
```

### 11.1 Key Design Decisions

**`is_current_version` flag:** Handles rollback without deletion. Prior records get `is_current_version: 0` and `superseded_by_id` pointing to the replacement. History is never destroyed. Queries for current state filter on `is_current_version = 1`.

**Rollback vs. semantic supersession:** `superseded_by_id` handles rollback within a run. `superseded_by_record_id` + `superseded_at` handles semantic supersession across runs. These are distinct fields on distinct mechanisms — never conflated.

**`phase_gates` table:** Enables fast resume — on Workspace re-open the Orchestrator queries this table for the most recent completed record without scanning the full `governed_stream` table.

**`memory_edge` table:** The Memory Edge graph. Populated by Ingestion Pipeline Stages II and III. All graph traversal in the Deep Memory Research Agent Stage 4 operates on this table.

**FTS5 `content=` option:** Keeps full-text index synchronized with `governed_stream` without duplicating storage. BM25 ranking is native to FTS5.

**sqlite-vec:** Parallel vector index. Both FTS5 and sqlite-vec are queryable independently or combined — BM25 for keyword recall, vector similarity for semantic recall, merged by Deep Memory Research Agent.

**`authority_level` on `memory_edge`:** Inherited from the asserting record. System-asserted edges have the highest applicable authority. Human-confirmed edges have `authority_level: 5`. Agent-proposed edges have `authority_level: 2` until confirmed.

---

## 12. JSON Schema Library Structure

The JSON Schema library lives in the JanumiCode git repository, versioned with it.

```
/.janumicode/schemas
  /artifacts
    workspace_classification.schema.json
    ingested_artifact_index.schema.json
    ingestion_gap_list.schema.json
    ingestion_conflict_list.schema.json
    prior_decision_summary.schema.json
    collision_risk_report.schema.json
    intent_bloom.schema.json
    intent_statement.schema.json
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
    loop_detection_record.schema.json
    unsticking_resolution.schema.json
    unsticking_escalation.schema.json
    memory_edge_proposed.schema.json
    memory_edge_confirmed.schema.json
    open_query_received.schema.json
    query_classification_record.schema.json
    client_liaison_response.schema.json
    consistency_challenge_escalation.schema.json
    schema_gap_record.schema.json
    version_upgrade_card.schema.json
    ingestion_pipeline_record.schema.json
  /configuration
    janumicode.config.schema.json
    janumicode.specialists.schema.json
  /meta
    schema_registry.json
```

### 12.1 `schema_registry.json` Structure

```json
{
  "registry_version": "1.0",
  "schemas": [
    {
      "artifact_type": "intent_statement",
      "schema_file": "artifacts/intent_statement.schema.json",
      "current_version": "1.0",
      "introduced_in_sha": "abc123",
      "breaking_changes": []
    }
  ]
}
```

The `breaking_changes` array records schema versions that introduced fields whose absence in older artifacts must be flagged by the Schema Compatibility Check.

---

## 13. Version Management and Upgrade Protocol

### 13.1 Version Pinning

A Workflow Run always pins to the `janumicode_version_sha` at initiation. In-flight runs always use their pinned version. Upgrades only apply to new Workflow Runs. The SHA is recorded on every Governed Stream Record, enabling any record to be traced to the exact Prompt Template and Schema that produced it.

### 13.2 Sub-Phase Idempotency

On Workspace re-open, the Orchestrator resumes from the next Sub-Phase after the last completed Sub-Phase (per `phase_gates` table). The current Sub-Phase's partial outputs are discarded and re-executed from that Sub-Phase's entry criterion. Every Sub-Phase must be idempotent — re-running it from scratch must produce a deterministically equivalent result given the same input records.

### 13.3 Upgrade Detection and Resolution

1. A Workflow Run completes its current Sub-Phase using its pinned `janumicode_version_sha`
2. At the next Phase Gate, the Orchestrator checks whether a new JanumiCode version exists in the git repository
3. If yes: a Version Upgrade Card is presented to the human as a Governed Stream card
4. If the human selects Upgrade: the run re-pins to the new SHA; the Orchestrator runs a Schema Compatibility Check — a deterministic comparison of new artifact schemas against existing records via `schema_registry.json`; mismatches are recorded as `schema_gap_record` entries
5. The human reviews schema gaps per gap: accept as-is, manually edit, or mark for targeted regeneration. Targeted regeneration is human-initiated, not automatic.

### 13.4 Upgrade Friction Acknowledgment

Some Workflow Runs will carry records produced against older schema versions for their entire duration. This is a documented and accepted characteristic. The Orchestrator's Context Payload construction annotates older-schema records with their `schema_version` so receiving agents handle missing fields defensively rather than failing.

### 13.5 Rollback Within a Run

When a Phase rollback causes a previously completed record to be regenerated, the prior record gets `is_current_version: 0` and `superseded_by_id` pointing to the new record. The Governed Stream Record that produced the prior artifact is preserved. Decision Traces point to specific Governed Stream Records, maintaining traceability through history.

---

## 14. Deferred Items

| Item | Deferred To | Notes |
|---|---|---|
| Governed Stream UI card taxonomy | Bloom-and-prune design session | Card types, states, grouping rules, prominence hierarchy, and interaction affordances to be specified via bloom-and-prune with human validation |
| CI/CD integration | Post-MVP | Phase 10 closes with `commit_record`. CI/CD trigger deferred. |
| Parallel Implementation Task execution | Medium/Enterprise phase | Infrastructure partially in place via dependency graph and forward-compatible task schema fields. Requires Static Conflict Analyzer and Merge Orchestrator. |
| Static Conflict Analyzer | Medium/Enterprise phase | Option C (hybrid conservative): uses artifact-reference-based analysis with conservative fallback to sequential on any ambiguity |
| Merge Orchestrator | Medium/Enterprise phase | Options B + A: Optimistic Locking with Post-Execution Consistency Check as safety net |
| Multi-workspace / large team coordination | Enterprise phase | Advanced coordination to optimize across changes working in shared code areas |
| External tool export (Jira, Notion, GitHub Issues) | Large team / Enterprise phase | All records owned by JanumiCode. Export capability deferred. |
| Enterprise integrations (Slack, email, calendar) | Enterprise phase | Client Liaison Agent and Deep Memory Research Agent designed to accommodate when available (scope tier `all_runs_plus_external`) |
| Mid-size engineering org features | Phase 2 product | Standards governance, team role differentiation, approval workflows |
| Domain-specific workflow profiles | Post-MVP | Optimized vocabulary and phase gate nuances for mobile, embedded, SaaS, AI/ML domains |
| Kùzu graph database migration | If SQLite edge tables insufficient | Phase 1: SQLite `memory_edge` table. Phase 2 if needed: Kùzu for traversal-heavy analytical graph workloads |
| Learned reranker for materiality scoring | Post-MVP | Current hand-tuned weights in `janumicode.config.json`. Learned reranker when sufficient history accumulated |

---

## 15. Appendix — Key Record Schemas

### 15.1 Decision Trace

```json
{
  "artifact_type": "decision_trace_summary",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "phase_name": "...",
  "decisions": [
    {
      "decision_id": "...",
      "sub_phase_id": "...",
      "decision_type": "menu_selection | mirror_approval | mirror_rejection | mirror_edit | phase_gate_approval | rollback_authorization | unsticking_escalation_resolution | prior_decision_override",
      "governed_stream_record_id": "...",
      "timestamp": "...",
      "context_presented": "...",
      "options_presented": ["..."],
      "human_selection": "...",
      "human_edit_content": "...",
      "rationale_captured": "...",
      "superseded_record_id": "... (prior_decision_override only)"
    }
  ],
  "decision_count": 0,
  "rollback_count": 0,
  "prior_decision_override_count": 0,
  "unsticking_escalation_count": 0
}
```

### 15.2 Unsticking Resolution (Problem Class Library Entry)

```json
{
  "record_type": "unsticking_resolution",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "...",
  "stuck_agent_role": "...",
  "loop_status_at_trigger": "STALLED | DIVERGING | SCOPE_BLIND",
  "investigation_mode_used": "socratic | detective | specialist | combined",
  "specialist_id_used": "... | null",
  "resolution_summary": "Natural language description of what resolved the situation",
  "root_cause": "...",
  "resolution_action": "...",
  "dialogue_record_ids": ["..."],
  "embedding_vector": [...]
}
```

### 15.3 Reasoning Review Record

```json
{
  "record_type": "reasoning_review_record",
  "schema_version": "1.0",
  "overall_pass": true,
  "flaws": [
    {
      "flaw_type": "unsupported_assumption | invalid_inference | circular_logic | scope_violation | premature_convergence | false_equivalence | authority_confusion | completeness_shortcut | contradiction_with_prior_approved | unacknowledged_uncertainty",
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

### 15.4 Memory Edge

```json
{
  "record_type": "memory_edge_proposed",
  "schema_version": "1.0",
  "id": "...",
  "source_record_id": "...",
  "target_record_id": "...",
  "edge_type": "supersedes | contradicts | supports | derives_from | implements | validates | invalidates | answers | raises | depends_on | corrects | refines",
  "asserted_by": "system | agent_role_name | human",
  "asserted_at": "...",
  "authority_level": 2,
  "confidence": 0.85,
  "workflow_run_id": "...",
  "notes": "..."
}
```

### 15.5 Implementation Task (Reference)

```json
{
  "id": "...",
  "component_id": "...",
  "component_responsibility": "verbatim text from component_model",
  "description": "...",
  "technical_spec_ids": ["..."],
  "backing_tool": "claude_code_cli",
  "dependency_task_ids": ["..."],
  "estimated_complexity": "low | medium | high",
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

---

*JanumiCode Master Product Specification — Version 2.0*
*All sections subject to revision through bloom-and-prune with human approval.*
*Deferred items catalogued in Section 14.*
