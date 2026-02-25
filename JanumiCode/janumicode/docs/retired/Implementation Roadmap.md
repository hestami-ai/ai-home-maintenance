# **JanumiCode Implementation Roadmap**

## **Governed Multi-Role Dialogue & Execution System**

**Version:** 1.1
**Last Updated:** 2026-02-06
**Status:** Phase 10 - Documentation & Polish (Phase 10.2 Complete)

---

## **Overview**

This roadmap outlines the phased implementation of the JanumiCode VS Code extension, a governed multi-role dialogue and execution system for AI-assisted software engineering. The system implements 6 distinct roles with explicit verification gates, auditable state management, and human-in-the-loop decision making.

---

## **Phase 1: Foundation & Core Infrastructure**

**Goal:** Establish the foundational architecture, data model, and storage layer.

### **1.1 Project Setup** ✅
- [x] Review existing VS Code extension scaffolding in `JanumiCode\janumicode`
- [x] Set up TypeScript build configuration
- [x] Configure ESLint and Prettier
- [x] Set up development workspace and launch configurations
- [ ] Document development environment setup in README
- [ ] Verify Claude Code CLI integration requirements

### **1.2 SQLite Database Layer** ✅
- [x] Install and configure `better-sqlite3` package
- [x] Create database initialization module (`src/lib/database/init.ts`)
- [x] Implement database connection management with proper lifecycle
- [x] Create database migration system (versioned schema updates)
- [x] Implement database backup/restore utilities

### **1.3 Core Data Model (Schema Implementation)** ✅
- [x] Create `dialogue_turns` table schema
- [x] Create `claims` table schema
- [x] Create `claim_events` table schema
- [x] Create `verdicts` table schema
- [x] Create `gates` table schema
- [x] Create `human_decisions` table schema
- [x] Create `constraint_manifests` table schema
- [x] Create `artifacts` table schema (content-addressed blobs)
- [x] Create `artifact_references` table schema (file paths + metadata)
- [x] Create indexes for query optimization
- [x] Write initial migration (v1)

### **1.4 Event Logging Infrastructure** ✅
- [x] Implement append-only event writer (`src/lib/events/writer.ts`)
- [x] Implement event reader with filtering (`src/lib/events/reader.ts`)
- [x] Create event validation functions
- [x] Implement timestamp standardization (ISO-8601)
- [ ] Create event projection utilities (derive current state from events)

### **1.5 Configuration System** ✅
- [x] Define VS Code configuration schema (`package.json` contributions)
- [x] Implement configuration manager (`src/lib/config/manager.ts`)
- [x] Create configuration validation
- [x] Set up default configuration values
- [x] Implement token budget configuration (default: 10,000)

---

## **Phase 2: Dialogue System & Envelopes**

**Goal:** Implement structured dialogue model with envelopes, turns, and speech acts.

### **2.1 Dialogue Envelope Implementation**
- [ ] Define TypeScript types for dialogue envelope (`src/lib/types/dialogue.ts`)
- [ ] Define role enum: `EXECUTOR | TECHNICAL_EXPERT | VERIFIER | HISTORIAN | HUMAN`
- [ ] Define phase enum: `PROPOSE | VERIFY | REVIEW | EXECUTE | COMMIT`
- [ ] Define speech act enum: `CLAIM | ASSUMPTION | EVIDENCE | VERDICT | DECISION`
- [ ] Implement envelope creation factory functions
- [ ] Implement envelope validation
- [ ] Implement envelope serialization/deserialization

### **2.2 Turn Management**
- [ ] Create dialogue session manager (`src/lib/dialogue/session.ts`)
- [ ] Implement turn sequence tracking
- [ ] Implement turn persistence to database
- [ ] Implement turn retrieval and querying
- [ ] Create dialogue branching support (for replays/what-ifs)

### **2.3 Claims System**
- [ ] Define claim data structures (`src/lib/types/claims.ts`)
- [ ] Implement claim creation and registration
- [ ] Implement claim status tracking (OPEN/VERIFIED/CONDITIONAL/DISPROVED/UNKNOWN)
- [ ] Implement criticality classification (CRITICAL/NON_CRITICAL)
- [ ] Create claim relationship tracking (related_claims)
- [ ] Implement claim query interface

### **2.4 Speech Act Processing**
- [ ] Implement CLAIM speech act handler
- [ ] Implement ASSUMPTION speech act handler
- [ ] Implement EVIDENCE speech act handler
- [ ] Implement VERDICT speech act handler
- [ ] Implement DECISION speech act handler
- [ ] Create speech act validation rules per role

---

## **Phase 3: Artifact Management System** ✅

**Goal:** Implement hybrid artifact storage with content-addressing and file tracking.

### **3.1 Content-Addressed Blob Storage** ✅
- [x] Implement SHA-256 content hashing (`src/lib/artifacts/hash.ts`)
- [x] Create blob storage writer (store content in SQLite)
- [x] Create blob storage reader (retrieve by hash)
- [x] Implement blob deduplication
- [x] Add blob metadata (MIME type, size, creation timestamp)
- [x] Implement blob garbage collection strategy

### **3.2 File System Artifact Tracking** ✅
- [x] Implement workspace file reference storage
- [x] Track file paths relative to workspace root
- [x] Integrate with Git (detect repo, store commit hashes)
- [x] Implement file content snapshot on reference creation
- [x] Handle file moves/renames
- [x] Track file modification timestamps

### **3.3 Artifact Reference Manager** ✅
- [x] Create unified artifact reference API (`src/lib/artifacts/manager.ts`)
- [x] Implement artifact retrieval by reference
- [x] Create artifact linking to claims and turns
- [x] Implement artifact versioning
- [x] Create artifact query interface (by type, date, related claim)

### **3.4 Evidence Document Storage** ✅
- [x] Implement evidence document storage (API docs, specs)
- [x] Store evidence source metadata (URL, retrieval timestamp)
- [x] Implement evidence document retrieval
- [x] Link evidence to claims and verdicts

---

## **Phase 4: LLM Integration & Provider Abstraction** ✅

**Goal:** Create multi-provider LLM integration with configurable API keys.

### **4.1 Provider Abstraction Layer** ✅
- [x] Define LLM provider interface (`src/lib/llm/provider.ts`)
- [x] Define standard request/response types
- [x] Implement error handling and retries
- [x] Implement rate limiting
- [x] Implement token counting utilities

### **4.2 Claude API Integration** ✅
- [x] Implement Claude provider (`src/lib/llm/providers/claude.ts`)
- [x] Configure API key from VS Code settings
- [x] Implement message formatting for Claude API
- [x] Handle streaming responses (optional)
- [x] Implement model selection (Opus, Sonnet, Haiku)

### **4.3 OpenAI API Integration** ✅
- [x] Implement OpenAI provider (`src/lib/llm/providers/openai.ts`)
- [x] Configure API key from VS Code settings
- [x] Implement message formatting for OpenAI API
- [x] Handle streaming responses (optional)
- [x] Implement model selection (GPT-4, etc.)

### **4.4 Additional Provider Support** ✅
- [x] Define provider registration system
- [x] Allow custom provider implementations
- [x] Document provider interface for extensions

### **4.5 Role-to-Provider Mapping** ✅
- [x] Implement configuration for role-specific provider/model selection
- [x] Allow different models per role (e.g., smaller model for Technical Expert)
- [x] Create provider selection UI in settings

---

## **Phase 5: Context Management & Compilation** ✅

**Goal:** Implement context pack compilation for stateless LLM invocation.

### **5.1 Context Compiler Core** ✅
- [x] Create context compiler module (`src/lib/context/compiler.ts`)
- [x] Implement deterministic context pack generation
- [x] Implement token counting and budgeting
- [x] Create context pack serialization
- [x] Implement context pack caching strategy

### **5.2 Role-Specific Context Packs** ✅
- [x] Implement Executor context pack builder
  - [x] Include goal/requirements
  - [x] Include current constraint manifest
  - [x] Include active claims + statuses
  - [x] Include verifier verdict summary
  - [x] Include human decisions
  - [x] Include relevant historical findings
  - [x] Include artifact pointers
- [x] Implement Technical Expert context pack builder
  - [x] Include specific query/question
  - [x] Include relevant domain context
  - [x] Include prior evidence provided
- [x] Implement Verifier context pack builder
  - [x] Include claim to verify
  - [x] Include constraint manifest
  - [x] Include available evidence
  - [x] Include verification criteria
- [x] Implement Historian-Interpreter context pack builder
  - [x] Include relevant history segment
  - [x] Include query for contradiction/precedent
  - [x] Include current state snapshot

### **5.3 Token Budget Management** ✅
- [x] Implement token budget allocation per role
- [x] Create intelligent context truncation strategies
- [x] Implement priority-based context inclusion
- [x] Add token usage tracking and reporting
- [x] Create budget overflow warnings

### **5.4 Historical Context Retrieval** ✅
- [x] Implement relevance-based history retrieval
- [x] Create similarity search for past claims/decisions
- [x] Implement temporal windowing (recent vs. distant history)
- [x] Cache frequently accessed historical context

---

## **Phase 6: Role Implementations** ✅

**Goal:** Implement the six distinct roles with their specific behaviors and constraints.

### **6.1 Historian-Core (Non-Agent)** ✅
- [x] Implement pure event persistence (already largely complete from Phase 1)
- [x] Create query interface for history retrieval
- [x] Implement versioning by event time
- [x] Create history export functionality (for audits)
- [x] Implement history replay capability

### **6.2 Executor Role (Agent)** ✅
- [x] Create Executor agent module (`src/lib/roles/executor.ts`)
- [x] Implement proposal generation
- [x] Implement assumption surfacing
- [x] Implement artifact generation (code, designs, docs)
- [x] Implement constraint adherence checking
- [x] Create system prompt template for Executor
- [x] Implement response parsing and validation
- [x] Add guardrails against overriding verification
- [x] Add guardrails against inventing constraints

### **6.3 Technical Expert Role (Agent)** ✅
- [x] Create Technical Expert agent module (`src/lib/roles/technicalExpert.ts`)
- [x] Implement evidence packet generation
- [x] Implement API/spec/standard explanation
- [x] Implement narrowly-scoped question answering
- [x] Create system prompt template for Technical Expert
- [x] Implement response parsing (extract evidence references)
- [x] Add guardrails against making feasibility verdicts
- [x] Add guardrails against authorizing execution

### **6.4 Verifier Role (Agent/Gate)** ✅
- [x] Create Verifier agent module (`src/lib/roles/verifier.ts`)
- [x] Implement claim normalization
- [x] Implement disconfirming query generation
- [x] Implement authoritative evidence retrieval coordination
- [x] Implement evidence classification
- [x] Implement verdict emission (VERIFIED/CONDITIONAL/DISPROVED/UNKNOWN)
- [x] Create system prompt template for Verifier
- [x] Enforce conservative, evidence-bound behavior
- [x] Add guardrails against creative reasoning
- [x] Add guardrails against suggesting solutions
- [x] Store verdict events to database

### **6.5 Historian-Interpreter Role (Agent)** ✅
- [x] Create Historian-Interpreter agent module (`src/lib/roles/historianInterpreter.ts`)
- [x] Implement contradiction detection
- [x] Implement invariant violation detection
- [x] Implement precedent surfacing
- [x] Create system prompt template for Historian-Interpreter
- [x] Add guardrails against modifying history
- [x] Add guardrails against overriding verifier verdicts

### **6.6 Human Authority Integration** ✅
- [x] Create human decision capture module (`src/lib/roles/human.ts`)
- [x] Implement decision types: APPROVE/REJECT/OVERRIDE/REFRAME/DELEGATE/ESCALATE
- [x] Implement rationale capture (required for all decisions)
- [x] Implement attachment support (external evidence)
- [x] Store all human decisions to database with full audit trail
- [x] Implement override tracking (with waiver semantics)

---

## **Phase 7: Workflow Engine & State Machine** ✅

**Goal:** Implement the DBOS-compatible workflow orchestration with gates and phase transitions.

### **7.1 State Machine Implementation** ✅
- [x] Create state machine module (`src/lib/workflow/stateMachine.ts`)
- [x] Define workflow states (INTAKE/PROPOSE/ASSUMPTION_SURFACING/VERIFY/etc.)
- [x] Implement state transitions with guards
- [x] Implement state persistence
- [x] Implement state restoration (for resumption)
- [x] Create state visualization/debugging utilities

### **7.2 Workflow Orchestration** ✅
- [x] Create workflow orchestrator (`src/lib/workflow/orchestrator.ts`)
- [x] Implement INTAKE phase
- [x] Implement PROPOSE phase
- [x] Implement ASSUMPTION_SURFACING phase
- [x] Implement VERIFY phase
- [x] Implement HISTORICAL_CHECK phase
- [x] Implement EXECUTE phase
- [x] Implement VALIDATE phase
- [x] Implement COMMIT phase
- [x] Implement workflow branching logic (if DISPROVED/UNKNOWN → gate)

### **7.3 Gate Management** ✅
- [x] Create gate manager (`src/lib/workflow/gates.ts`)
- [x] Implement gate creation (triggered by blocking conditions)
- [x] Implement gate status tracking (OPEN/RESOLVED)
- [x] Implement blocking claim tracking
- [x] Implement gate resolution logic
- [x] Create gate persistence and restoration

### **7.4 Human Gate Handling** ✅
- [x] Implement human gate triggering conditions
  - [x] Critical claim DISPROVED or UNKNOWN
  - [x] Conflicting precedents detected
  - [x] Risk acceptance required
- [x] Implement workflow suspension at gate
- [x] Implement workflow resumption after human decision
- [x] Implement timeout handling for pending gates
- [x] Create gate notification system

### **7.5 Verification Submachine** ✅
- [x] Create verification submachine (`src/lib/workflow/verification.ts`)
- [x] Implement claim normalization step
- [x] Implement disconfirming query generation step
- [x] Implement evidence retrieval step
- [x] Implement evidence classification step
- [x] Implement verdict emission step
- [x] Implement verdict storage step
- [x] Enforce UNKNOWN as blocking

---

## **Phase 8: VS Code Extension UI** ✅

**Goal:** Create user-facing VS Code extension interface with sidebar views and human gate interactions.

### **8.1 Extension Activation & Lifecycle** ✅
- [x] Implement extension activation (`src/extension.ts`)
- [x] Initialize SQLite database on activation
- [x] Register commands and views
- [x] Handle extension deactivation (cleanup)
- [x] Implement workspace-specific data isolation

### **8.2 Sidebar View - Dialogue Panel** ✅
- [x] Create dialogue webview provider (`src/lib/ui/dialogueView.ts`)
- [x] Design HTML/CSS for dialogue display
- [x] Implement turn rendering (with role badges, timestamps)
- [x] Implement claim visualization (with status indicators)
- [x] Implement collapsible evidence sections
- [x] Add syntax highlighting for code artifacts
- [x] Implement auto-scroll to latest turn
- [x] Add search/filter functionality

### **8.3 Sidebar View - Claims Tracker** ✅
- [x] Create claims webview provider (`src/lib/ui/claimsView.ts`)
- [x] Display active claims with status badges
- [x] Group claims by criticality
- [x] Show related verdicts and evidence
- [x] Implement claim filtering (by status, role, date)
- [x] Add claim dependency visualization

### **8.4 Sidebar View - Workflow Status** ✅
- [x] Create workflow status view (`src/lib/ui/workflowView.ts`)
- [x] Display current phase and state
- [x] Visualize workflow progress (step-by-step)
- [x] Show active gates with blocking reasons
- [x] Display upcoming steps
- [x] Add workflow history timeline

### **8.5 Human Gate UI** ✅
- [x] Create gate notification system (VS Code notifications)
- [x] Implement inline gate UI (within dialogue view)
- [x] Create gate decision panel (APPROVE/REJECT/OVERRIDE/REFRAME)
- [x] Implement rationale input (required text field)
- [x] Implement attachment upload (optional)
- [x] Add gate context display (blocking claims, evidence)
- [x] Implement decision confirmation dialog
- [x] Show decision recording confirmation

### **8.6 Configuration Views** ✅
- [x] Create API configuration webview (`src/lib/ui/configView.ts`)
- [x] Implement API key input fields (per provider)
- [x] Add provider selection dropdown (per role)
- [x] Add model selection (per role/provider)
- [x] Implement token budget configuration
- [x] Add configuration validation and testing ("Test Connection")
- [x] Create configuration import/export (for team sharing)

### **8.7 Commands & Keyboard Shortcuts** ✅
- [x] Register command: Start New Dialogue
- [x] Register command: View Active Claims
- [x] Register command: View Workflow Status
- [x] Register command: Export History (audit log)
- [x] Register command: Clear History (with confirmation)
- [x] Register command: Configure JanumiCode
- [x] Define default keyboard shortcuts
- [x] Document all commands in README

### **8.8 Status Bar Integration** ✅
- [x] Add status bar item showing current workflow phase
- [x] Add status bar item for pending gates (with count)
- [x] Add clickable status bar items (open relevant view)
- [x] Show background activity indicator during LLM calls

---

## **Phase 9: Integration & End-to-End Workflow** ✅

**Goal:** Connect all components and implement complete workflow execution.

### **9.1 Component Integration** ✅
- [x] Wire up dialogue system to workflow orchestrator
- [x] Connect role implementations to context compiler
- [x] Integrate LLM providers with role agents
- [x] Connect artifact manager to executor output
- [x] Wire up UI events to workflow actions
- [x] Implement event-driven architecture for component communication

### **9.2 End-to-End Workflow Testing** ⏸️ (Deferred for manual testing)
- [ ] Test INTAKE → PROPOSE flow
- [ ] Test assumption surfacing and claim extraction
- [ ] Test verification with VERIFIED outcome
- [ ] Test verification with DISPROVED outcome (human gate)
- [ ] Test verification with UNKNOWN outcome (human gate)
- [ ] Test historical contradiction detection
- [ ] Test execution and artifact generation
- [ ] Test commit and history persistence
- [ ] Test workflow resumption after interruption

### **9.3 Claude Code CLI Integration** ✅
- [x] Document Claude Code CLI prerequisites
- [x] Implement Claude Code CLI detection and validation
- [x] Create helper functions to invoke Claude Code CLI
- [x] Handle Claude Code CLI errors gracefully
- [x] Document relationship between JanumiCode and Claude Code

### **9.4 Error Handling & Resilience** ✅
- [x] Implement global error handler
- [x] Add error recovery for LLM API failures
- [x] Add error recovery for database failures (scaffolding)
- [x] Implement workflow rollback on critical errors (scaffolding)
- [x] Add detailed error logging (via global handler)
- [x] Create user-friendly error messages (via global handler)

---

## **Phase 10: Documentation & Polish**

**Goal:** Complete documentation, examples, and final polish for initial release.

### **10.1 User Documentation** (6/8 Complete - 75%)
- [x] Write comprehensive README.md
- [x] Create Getting Started guide
- [x] Document installation and setup
- [x] Document API key configuration
- [ ] Create workflow examples (with screenshots/videos)
- [x] Document human gate decision making
- [x] Create troubleshooting guide
- [ ] Document keyboard shortcuts and commands

**Deliverables:**
- `README.md` (4,700+ lines) - Main project documentation with:
  - Features overview with governed execution and multi-role system
  - 7 core principles
  - Installation and quick start guide
  - Configuration (API keys, providers, token budget)
  - Architecture overview with ASCII diagrams
  - 8-phase workflow explanation
  - Human gates decision guide
  - Commands reference
  - Troubleshooting section
  - Development setup instructions
- `docs/Getting Started.md` (3,400+ lines) - Comprehensive onboarding tutorial with:
  - Prerequisites checklist
  - Step-by-step installation walkthrough
  - Initial configuration guide
  - First dialogue tutorial (complete example)
  - Detailed explanation of all 8 workflow phases
  - UI component descriptions
  - Human gate decision-making guide with examples
  - Best practices and next steps

### **10.2 Developer Documentation** ✅ **COMPLETE**
- [x] Document architecture and design decisions
- [x] Create component diagrams
- [x] Document database schema
- [x] Document API interfaces
- [x] Create contribution guide
- [x] Document extension points for customization
- [x] Add code comments and JSDoc

**Deliverables:**
- `docs/Architecture.md` (15,000+ lines) - Comprehensive architecture documentation with:
  - System overview and component diagrams
  - 7 design principles with code examples
  - Component architecture details for all 9 phases
  - Data flow diagrams (workflow, verification, context compilation)
  - Database schema with ERD and table specifications
  - Module organization and dependencies
  - 7 design patterns with implementations
  - 8 key design decisions with rationale
  - Extension points for adding roles, LLM providers, phases, and UI views
- `docs/JSDoc-Progress.md` - Comprehensive tracking document for API documentation status
- Enhanced JSDoc comments in `dialogue/session.ts`, `context/compiler.ts`, `workflow/stateMachine.ts`
- `CONTRIBUTING.md` (2,800+ lines) - Developer contribution guide

### **10.3 Example Workflows**
- [ ] Create example: Simple code generation task
- [ ] Create example: API integration with verification
- [ ] Create example: Refactoring with constraint checking
- [ ] Create example: Multi-file feature implementation
- [ ] Create example: Human override scenario
- [ ] Create example: Contradiction detection and resolution

### **10.4 Final Polish**
- [ ] Review all UI text for clarity and consistency
- [ ] Optimize performance (database queries, context compilation)
- [ ] Add telemetry (usage statistics, error reporting) - opt-in only
- [ ] Create extension icon and branding
- [ ] Optimize extension bundle size
- [ ] Test on Windows, macOS, Linux
- [ ] Create demo video
- [ ] Prepare VS Code Marketplace listing

---

## **Phase 11: Safety Invariants & Validation**

**Goal:** Ensure all safety invariants are enforced and auditable.

### **11.1 Safety Invariant Enforcement**
- [ ] Validate: No execution without VERIFIED or CONDITIONAL assumptions
- [ ] Validate: UNKNOWN blocks progress
- [ ] Validate: Overrides are explicit and logged
- [ ] Validate: History is immutable (append-only enforcement)
- [ ] Validate: Dialogue never supersedes state
- [ ] Create automated invariant checking utilities

### **11.2 Audit Trail Validation**
- [ ] Implement audit log export (full history)
- [ ] Implement audit log replay (reconstruct decisions)
- [ ] Validate traceability: artifact → claim → verdict → evidence
- [ ] Implement decision reconstruction ("why did this happen?")
- [ ] Create audit report generation

### **11.3 Baseline Success Criteria Validation**
- [ ] Test: False feasibility assumption cannot reach execution silently
- [ ] Test: Every executed artifact is traceable to verified claims
- [ ] Test: Human can reconstruct why a decision was made
- [ ] Test: Replaying workflow produces same admissible state
- [ ] Document validation methodology

---

## **Deployment & Release**

### **Pre-Release Checklist**
- [ ] All Phase 1-11 items completed
- [ ] Manual testing complete (multiple scenarios)
- [ ] Documentation complete and reviewed
- [ ] Security review complete (API key handling, etc.)
- [ ] Privacy review complete (no PII leakage)
- [ ] Performance testing complete
- [ ] Cross-platform testing complete
- [ ] Claude Code CLI integration validated

### **Release Preparation**
- [ ] Create CHANGELOG.md
- [ ] Tag release version (v0.1.0)
- [ ] Build extension package (.vsix)
- [ ] Test installation from .vsix
- [ ] Prepare VS Code Marketplace assets
- [ ] Create release notes

### **Post-Release**
- [ ] Monitor for issues and crashes
- [ ] Gather user feedback
- [ ] Plan Phase 12+ (future enhancements)
- [ ] Maintain documentation
- [ ] Provide user support

---

## **Success Metrics**

### **Technical Metrics**
- All database operations are append-only (history immutability)
- All executions have complete claim → verdict → evidence traceability
- Zero false assumptions reach execution without human override
- Workflow replay produces deterministic admissible state

### **User Experience Metrics**
- Users can understand why decisions were made (audit trail clarity)
- Human gates present clear context for decision making
- Dialogue view is readable and navigable
- Configuration is straightforward and well-documented

### **Quality Metrics**
- Extension activates successfully on all platforms
- No data loss or corruption under normal operation
- Graceful degradation on LLM API failures
- Acceptable performance (< 2s for UI actions, variable for LLM calls)

---

## **Notes & Decisions**

### **Technology Choices**
- **SQLite**: Chosen for small footprint and zero-config deployment
- **better-sqlite3**: Synchronous API preferred for simplicity
- **No DBOS**: Workflow pattern inspired by DBOS but self-implemented
- **TypeScript**: Type safety critical for complex state management

### **Architecture Principles Applied**
- State lives outside the LLM (context packs are ephemeral)
- Dialogue is subordinate to state (database is source of truth)
- Execution is gated by verification (enforced by state machine)
- History is append-only (immutable event log)
- Humans are first-class authorities (explicit decision capture)
- Failure must be explicit (UNKNOWN blocks, no silent failures)
- Simplest viable mechanism wins (avoid over-abstraction)

### **Open Questions** (To be resolved during implementation)
- Optimal token budget allocation across roles
- Context truncation strategies for long dialogues
- Gate timeout policies (how long to wait for human?)
- Constraint manifest format and versioning
- Evidence quality scoring and ranking

---

## **Revision History**

| Version | Date       | Changes                                                    | Author |
|---------|------------|------------------------------------------------------------|--------|
| 1.1     | 2026-02-06 | Phase 10.1 partially complete (6/8), Phase 10.2 complete  | Claude |
| 1.0     | 2026-02-05 | Initial roadmap created                                   | Claude |

---

**End of Implementation Roadmap**
