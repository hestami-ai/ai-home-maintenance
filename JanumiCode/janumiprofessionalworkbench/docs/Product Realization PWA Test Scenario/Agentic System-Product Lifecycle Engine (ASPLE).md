# **Agentic System-Product Lifecycle Engine (ASPLE)**

**Operational Engineering Methodology**

*A Hybrid, Highly Assured SDLC for Agentic Product Realization*

## **1\. Core Axioms & Architecture**

### **Primary Axiom**

> **Agent hallucination and defect rates are inversely proportional to context and task abstraction.**

> By applying **Extreme Recursive Decomposition (ERD)** down to deterministic, bounded micro-tasks, multi-agent systems reach near 100% completion and correctness across complex product lifecycles.

### **Tri-Agent Sandbox Engine**

#### **Human Diagram**

                          ┌───────────────────────────┐  
                           │   State Machine Execution │  
                           └─────────────┬─────────────┘  
                                         │  
                                         ▼  
┌──────────────────────────────────────────────────────────────────────────────┐  
│  EXECUTION AGENT (EA)                                                        │  
│  • Reads scoped context & minimal prompt boundary                            │  
│  • Performs atomic generation (specs, code, ICDs, test suites)               │  
└──────────────────────────────────────┬───────────────────────────────────────┘  
                                       │ Raw Artifact  
                                       ▼  
┌──────────────────────────────────────────────────────────────────────────────┐  
│  INTELLIGENT ASSURANCE GUARDRAIL (IAG)                                       │  
│  • Cross-Provider Model (e.g., Gemini if EA is Claude)                       │  
│  • Isolated Reasoning Review: Checks fallacies, assumptions, edge cases      │  
└──────────────────────────────────────┬───────────────────────────────────────┘  
                                       │ Evaluated Output \+ Telemetry  
                                       ▼  
┌──────────────────────────────────────────────────────────────────────────────┐  
│  CONSTRUCTIVE CRITIQUE ASSURANCE CO-AGENT (CACA)                             │  
│  • Independent Adversarial Verifier (e.g., OpenAI Codex/GPT-4o)             │  
│  • Evaluates completeness & intent fidelity against upstream specifications  │  
└──────────────────────┬───────────────────────────────────────┬───────────────┘  
                       │                                       │  
                \[FAIL\] │ Refinement Loop                       │ \[PASS\]  
                       └─────────────────► EA                  └───► Deterministic  
                                                                     Backpressure Gate

#### **Machine Specification: Tri-Agent Sandbox Protocol**

Plaintext  
COMPONENT: TriAgentSandbox Engine  
INPUT:   
  \- Scoped Task Boundary (AST node, micro-spec, or isolated function requirement)  
  \- Current Context Packet (minimal prompt \+ relevant Narrative Memories \+ ICD schema)  
STEPS:  
  1\. Execution Agent (EA):  
     \- Action: Ingest Context Packet; execute atomic generation.  
     \- Constraints: Single responsibility, strictly bound context window.  
     \- Output: Raw Execution Artifact (Code, Spec, Diagram, or Test Suite).  
  2\. Intelligent Assurance Guardrail (IAG):  
     \- Model Constraint: Provider diversity enforced (Provider\_IAG \!= Provider\_EA).  
     \- Action: Perform zero-shot Isolated Reasoning Review on EA output.  
     \- Evaluation Focus: Logical fallacies, unstated domain assumptions, boundary omissions, type safety.  
     \- Output: Pass/Fail \+ Reasoning Evaluation Trace.  
  3\. Constructive Critique Assurance Co-Agent (CACA):  
     \- Model Constraint: Provider diversity enforced (Provider\_CACA \!= Provider\_EA).  
     \- Action: Run adversarial verification on raw artifact \+ IAG evaluation trace.  
     \- Evaluation Focus: Upstream specification fidelity, edge-case invalidation, completeness.  
     \- Output: Pass/Fail \+ Structured Critique Feedback Loop.  
BRANCHING & STATE TRANSITIONS:  
  \- IF (IAG \== PASS AND CACA \== PASS): Advance artifact to Deterministic Backpressure Gate.  
  \- IF (IAG \== FAIL OR CACA \== FAIL): Route Structured Critique Feedback to EA. Increment Retry Counter (N).  
INVARIANT: No artifact can bypass IAG and CACA verification prior to state progression.

### **Model Diversity Matrix**

To eliminate shared LLM blind spots, execution and assurance steps strictly enforce heterogeneous model architectures:

| Role | Primary Model Architecture | Responsibility |
| :---- | :---- | :---- |
| **Executing Agent (EA)** | Primary Code / Task Model (e.g., Anthropic Claude Code) | Generates scoped artifacts and code. |
| **Reasoning Review (IAG)** | Isolated Logic Model (e.g., Google Gemini) | Zero-shot logic verification, bias detection, and flaw scanning. |
| **Critique Co-Agent (CACA)** | Adversarial Verifier (e.g., OpenAI GPT-4o / Codex) | Invalidation, specification compliance, and mutation review. |

## **2\. Infrastructure & Systemic Engine**

#### **Human Diagram**

┌──────────────────────────────────────────────────────────────────────────────┐  
│                              GOVERNED STREAM                                 │  
│  • Append-only event ledger capturing all intents, specs, schemas, & outputs │  
└──────────────┬────────────────────────────────────────────────┬──────────────┘  
               │ Event Log                                      │ Telemetry  
               ▼                                                ▼  
┌──────────────────────────────┐                ┌──────────────────────────────┐  
│ HISTORIAN AGENT              │                │ LOOP DETECTOR AGENT          │  
│ • Synthesizes log into       │                │ • Tracks state iterations    │  
│   Narrative Memories         │                │ • Differentiates logic loops │  
│ • Resolves global state      │                │   from transient failures    │  
└──────────────┬───────────────┘                └──────────────┬───────────────┘  
               │ Narrative Context                             │ Intercept  
               ▼                                               ▼  
┌──────────────────────────────────────────────────────────────────────────────┐  
│ CONTEXT ENGINEERING ENGINE & JIT CREDENTIAL SERVICE                          │  
│ • Formulates exact, minimal prompts for EAs                                  │  
│ • Issues short-lived, least-privilege tokens per execution step              │  
└──────────────────────────────────────────────────────────────────────────────┘

#### **Machine Specification: Systemic Support Engine**

Plaintext  
COMPONENT: Infrastructure Backbone  
SUB-SYSTEMS:  
  1\. Governed Stream:  
     \- Architecture: Append-only immutable log stream.  
     \- Data Ingested: Every prompt, execution trace, schema change, state gate status, and test output.  
  2\. Historian Agent:  
     \- Trigger: Event log additions across phase transitions or state updates.  
     \- Action: Ingest continuous stream; synthesize into Narrative Memories.  
     \- Function: Compress long historical context into targeted decision summaries, resolving architectural intent across context boundaries.  
  3\. Loop Detector Agent:  
     \- Input: State machine transition history \+ Execution sandbox telemetry.  
     \- Evaluation Logic: Compare AST/hash of failed execution attempts over retries (N).  
     \- Branching Logic:  
       \- IF (Failure \== Logic/Code Structure AND Retry Count N \>= 3): Signal Logic Loop Circuit Breaker; halt state machine; trigger HITL Escalation.  
       \- IF (Failure \== Network/Environment Timeout): Isolate from Logic Counter; apply exponential backoff; retry environment pass.  
  4\. Context Engineering Engine & JIT Credential Manager:  
     \- Action: Dynamically construct context packets per EA micro-task using relevant Narrative Memories and ICDs.  
     \- Security Action: Mint short-lived, least-privilege tokens bound strictly to the current micro-task execution scope; automatically revoke upon task completion.

## **3\. The 6 Phases of ASPLE**

#### **Human Diagram**

Left-Side (Decomposition & Synthesis)          Right-Side (Integration & Verification)  
\=====================================          \======================================  
Phase 1: Intent & JTBD Extraction  ──────────► Phase 6: Continuous Assurance & Operations  
 Phase 2: UCD & Solution Framing   ────────► Phase 5: System Integration & V\&V  
  Phase 3: System Architecture V-Model ────► Phase 4: Extreme Agile / FDD Loops

#### **Machine Specification: Macro Lifecycle Topology**

Plaintext  
FRAMEWORK MAPPING:  
  \- Phase 1: Product Management & Jobs-To-Be-Done (JTBD)  
  \- Phase 2: User-Centered Design (UCD) & Systems Boundary Mapping  
  \- Phase 3: Systems Engineering V-Model (Left-Side Decomposition & ICD Generation)  
  \- Phase 4: Agile / Feature-Driven Development (FDD) & Test-Driven Development (TDD)  
  \- Phase 5: Systems Engineering V-Model (Right-Side Verification & Validation)  
  \- Phase 6: SRE, Continuous Operations & Telemetry Feedback  
EXECUTION FLOW:  
  \- Sequence: Phase 1 \-\> Phase 2 \-\> Phase 3 \-\> Phase 4 (Recursive) \-\> Phase 5 \-\> Phase 6\.  
  \- Traceability Invariant: Downstream phases must maintain bidirectional schema mapping back to Phase 1 JTBD metrics via the Governed Stream.

### **Phase 1: Intent Ingestion, Bloom & Prune, and JTBD Synthesis**

**Goal:** Transform ambiguous human intent into structured Jobs-to-be-Done (JTBD) matrices without unverified assumptions.

#### **Human Diagram**

\[Underspecified Intent\]   
       │  
       ▼  
 1.1 Intent Expansion (Bloom Agent)   
       │  
       ▼  
 1.2 Scope Trimming (Prune Gate \- HITL) ──► 1.3 JTBD Synthesis (EA \+ IAG \+ CACA)  
                                                   │  
                                                   ▼  
                                         \[Structured JTBD Matrix\]

#### **Machine Specification: Phase 1 Execution Protocol**

Plaintext  
PHASE\_ID: 1\_INTENT\_JTBD  
INPUT: Underspecified Human Intent String.  
SUB-PHASES:  
  1.1 Intent Expansion (Bloom Agent):  
      \- Action: Envision comprehensive scope; generate edge cases, domain requirements, and potential feature workflows.  
      \- Output: Unpruned Expanded Scope Matrix.  
  1.2 Scope Trimming (Prune Gate \- HITL):  
      \- Action: Present Expanded Scope Matrix to Human Product Owner.  
      \- Human Operations: Explicitly categorize every feature as \[IN\_SCOPE\], \[OUT\_OF\_SCOPE\], or \[DEFERRED\].  
      \- Output: Pruned Scope Boundary.  
  1.3 JTBD Synthesis:  
      \- Execution: Tri-Agent Sandbox (EA generates, IAG reviews logic, CACA verifies completeness).  
      \- Action: Map Pruned Scope Boundary to Main Functional Jobs, Emotional/Social Jobs, and Desired Outcome Metrics.  
      \- Output: Structured JTBD Matrix schema.  
GATE\_CONDITION: Human approval on Pruned Scope Boundary \+ IAG/CACA verification pass on JTBD Matrix.

### **Phase 2: User-Centered Design (UCD) & Experience Architecture**

**Goal:** Convert JTBD matrices into explicit user workflows and interaction contracts.

#### **Machine Specification: Phase 2 Execution Protocol**

Plaintext  
PHASE\_ID: 2\_UCD\_EXPERIENCE\_ARCH  
INPUT: Structured JTBD Matrix schema (from Phase 1).  
SUB-PHASES:  
  2.1 Scenario & Journey Mapping:  
      \- Action: EA generates high-fidelity interaction flows, happy-path sequences, and error-handling journeys.  
  2.2 Design System & Token Binding:  
      \- Action: Map generated interaction flows directly to concrete UI components and accessibility tokens.  
  2.3 Human-System Boundary Mapping:  
      \- Action: Mark every interaction node as \[AUTONOMOUS\_AGENT\_OPERATION\] or \[HUMAN\_INPUT\_REQUIRED\].  
ASSURANCE\_GATES:  
  \- Accessibility & Contract Check (IAG): Validate against WCAG 2.2 schemas.  
  \- Cognitive Walkthrough (CACA): Simulate navigation paths to identify unhandled state transitions.  
  \- User Usability Validation: Optional HITL check / target user interface evaluation.  
OUTPUT: Validated UX Architecture & Interface Layout Schemas.

### **Phase 3: Systems Engineering & V-Model Decomposition**

**Goal:** Translate product specs into a formal Systems Engineering V-Model topology, down to Atomic Functional Units (AFUs).

#### **Human Diagram**

  System Requirements Specification (SRS) ───────────────────────► System Acceptance Testing (SAT)  
     └─ Subsystem Design & ICDs ───────────────────────────────► Integration & Interface Testing  
          └─ Atomic Unit Specifications ───────────────────► Unit & Module Verification

#### **Machine Specification: Phase 3 Execution Protocol**

Plaintext  
PHASE\_ID: 3\_SYSTEMS\_ENG\_VMODEL  
INPUT: Validated UX Architecture & Structured JTBD Matrix.  
SUB-PHASES:  
  3.1 SRS Generation:  
      \- Action: Synthesize functional and non-functional requirements with unique identifiers.  
  3.2 Subsystem ICD & Migration Schema Generation:  
      \- Action: Define API contracts, state machine transitions, and database migration schemas (using expand-and-contract patterns).  
  3.3 Extreme Unit Decomposition:  
      \- Action: Recursively decompose subsystem specs into Atomic Functional Units (AFUs).  
      \- Constraints: AFUs must be single-purpose, fully isolated logic blocks bounded to \~200 lines of executable code.  
ASSURANCE\_GATES:  
  \- Formal Logic & ICD Review (IAG): Detect breaking schema changes or type inconsistencies.  
  \- Traceability Review (CACA): Enforce bidirectional links: JTBD\_ID \<-\> SRS\_ID \<-\> AFU\_ID \<-\> Test\_ID.  
OUTPUT: Machine-readable ICD Schemas \+ Bounded AFU Task Specifications.

### **Phase 4: Extreme Agile Execution & Feature-Driven Development (FDD)**

**Goal:** Execute construction through deterministic, test-first agent build loops.

#### **Human Diagram**

\[Epic\] ──► \[Feature\] ──► \[User Story\] ──► \[Micro-Task\]   
                                               │  
                                               ▼  
                                 ┌───────────────────────────┐  
                                 │ Adversarial Assertion     │  
                                 │ Synthesis Agent           │  
                                 └─────────────┬─────────────┘  
                                               │ Unimplemented Red Test Suite  
                                               ▼  
                                 ┌───────────────────────────┐  
                                 │ TDD Implementation Agent  │  
                                 └─────────────┬─────────────┘  
                                               │ Green Code Implementation  
                                               ▼  
                                 ┌───────────────────────────┐  
                                 │ Tri-Agent \+ AST Gate      │  
                                 └───────────────────────────┘

#### **Machine Specification: Phase 4 Execution Protocol**

Plaintext  
PHASE\_ID: 4\_EXTREME\_AGILE\_FDD  
INPUT: Bounded AFU Task Specification \+ Subsystem ICD Schemas.  
EXECUTION\_LOOP (Per Micro-Task):  
  1\. Task Tree Resolution:  
     \- Epics \-\> Features \-\> User Stories \-\> Micro-Tasks (1 Micro-Task \== 1 AFU modification).  
  2\. Adversarial Assertion Synthesis:  
     \- Action: Isolated Adversarial Agent reads ICD and AFU spec; writes breaking test suite (Unimplemented Red Tests) BEFORE code generation.  
     \- Invariant: Test suite must attempt edge-case invalidation, mock-spoof detection, and boundary condition checks.  
  3\. TDD Implementation Loop:  
     \- Action: EA writes code targeted ONLY at passing the pre-generated Adversarial Test Suite.  
  4\. Tri-Agent Sandbox & Deterministic Gates:  
     \- Static Check: AST parsing, type checking, security vulnerability scan.  
     \- Dynamic Check: Mutation testing (confirming code fails when assertions are mutated).  
     \- Multi-Model Assurance: Heterogeneous IAG and CACA code review passes.  
  5\. Loop Detector Check:  
     \- IF (Failures \>= 3): Hault execution; trigger Loop Detector HITL escalation.  
OUTPUT: AST-verified, fully tested, zero-defect code modules merged into integration branch.

### **Phase 5: System Integration & Verification & Validation (V\&V)**

**Goal:** Integrate AFUs into subsystems and validate complete system flows against Phase 1 intent.

#### **Machine Specification: Phase 5 Execution Protocol**

Plaintext  
PHASE\_ID: 5\_SYSTEM\_INTEGRATION\_VV  
INPUT: Verified AFU code modules (from Phase 4\) \+ System Architecture ICDs.  
SUB-PHASES:  
  5.1 Subsystem Integration Assembly:  
      \- Action: Aggregate AFUs; execute contract testing in isolated virtualized environments (mock services generated directly from ICDs).  
  5.2 End-to-End & Performance Validation:  
      \- Action: Execute automated headless browser (Playwright) and API load tests based on Phase 2 user journeys.  
  5.3 Stateful Data Migration Verification:  
      \- Action: Run expand-and-contract migration scripts against sample datasets; verify zero data corruption.  
ASSURANCE\_GATES:  
  \- Integration Drift Review (IAG): Detect side-effects across subsystem boundaries.  
  \- Validation Co-Agent (CACA): Verify that integrated system behaviors directly satisfy Phase 1 JTBD Desired Outcome Metrics.  
OUTPUT: Fully integrated production artifact ready for deployment.

### **Phase 6: Continuous Release, Telemetry & Operational Evolution**

**Goal:** Deploy safely using progressive rollouts, monitor operational metrics, and feed telemetry back to Phase 1\.

#### **Machine Specification: Phase 6 Execution Protocol**

Plaintext  
PHASE\_ID: 6\_CONTINUOUS\_OPERATIONS  
INPUT: Production Artifact (from Phase 5).  
SUB-PHASES:  
  6.1 Progressive Canary Deployment:  
      \- Action: SRE Deployment Agent triggers canary cutover; monitors real-time telemetry.  
      \- Guardrail: Automated instant rollback triggered if error budget exceeds threshold.  
  6.2 Telemetry & Anomaly Analysis:  
      \- Action: Ingest runtime logs, performance metrics, and user drop-off points into the Governed Stream.  
  6.3 Auto-Spec Evolution:  
      \- Action: Convert identified operational anomalies or missing edge cases directly into structured JTBD inputs for Phase 1\.  
ASSURANCE\_GATES:  
  \- Blast Radius Guardrail: Enforce rate limits on infrastructure and policy modifications.  
  \- JIT Credential Audit: Confirm total destruction/revocation of ephemeral deployment tokens.  
OUTPUT: Live operational state \+ Continuous feedback loop into Phase 1 backlog.

## **4\. ASPLE Phase Control Matrix**

| Phase | Core Integrated Methodologies | Primary Agent Tasks | Key Guardrail & Assurance Protocol |
| :---- | :---- | :---- | :---- |
| **Phase 1: Intent** | JTBD, Product Management | Bloom (expansion) $\\rightarrow$ Prune $\\rightarrow$ Matrix generation | **Prune Gate:** Human sign-off on scope boundary. |
| **Phase 2: UX Framing** | UCD, Design Systems | Scenario generation, design token binding | **Cognitive Review:** Accessibility audits & target user testing. |
| **Phase 3: Systems Eng.** | Systems Engineering V-Model | SRS synthesis, ICD generation, AFU decomposition | **ICD & Migration Audit:** Formal logic checks & backward compatibility. |
| **Phase 4: Construction** | Agile, FDD, TDD | Adversarial Assertion Synthesis $\\rightarrow$ TDD execution | **Tri-Agent Sandbox:** Heterogeneous LLM review & mutation testing. |
| **Phase 5: Verification** | System Integration V\&V | Subsystem assembly, E2E Playwright validation | **JTBD Alignment Gate:** Verifies runtime behaviors match Phase 1 specs. |
| **Phase 6: Operation** | SRE, DevOps, CI/CD | Canary deployment, telemetry ingestion, auto-backlog | **Blast Radius Review:** JIT credentials & automated rollbacks. |

