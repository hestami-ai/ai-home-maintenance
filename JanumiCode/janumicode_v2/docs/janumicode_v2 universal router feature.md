# JanumiCode Client Liaison Agent - Feature Requirements Document

**Summary:** A universal router agent that serves as the single natural language interface for all user input, classifying intent, querying the Governed Stream directly, and orchestrating workflow initiation when needed.

---

# Part 1: Product Requirements

## 1. Overview

### Problem Statement

Users need a unified conversational interface for:
1. Starting new workflows
2. Asking questions about current/past work
3. Exploring decisions and rationale
4. Managing workflow lifecycle

Without a unified interface, users must navigate different commands and modes.

### Goals

| Goal | Description |
|------|-------------|
| **G1** | Single conversational interface for all user input |
| **G2** | Intelligent query classification and routing |
| **G3** | Direct database access for information retrieval |
| **G4** | Seamless workflow initiation when needed |

### Non-Goals (MVP)

| Non-Goal | Reason |
|----------|--------|
| Multi-turn conversations | Each query is independent |
| Streaming responses | Complete responses sufficient |
| Custom capabilities | Built-in capabilities only |
| Capability discovery via LLM | Full list in system prompt |

### Success Metrics

| Metric | Target |
|--------|--------|
| Query classification accuracy | > 95% |
| Response time (information) | < 3 seconds |
| Response time (action) | < 5 seconds |
| User satisfaction | "I can ask anything" |

---

## 2. User Stories

### US-1: Start New Workflow

**As a** user with a new idea  
**I want to** describe what I want to build  
**So that** JanumiCode starts working on it

**Acceptance Criteria:**
- [ ] AC-1.1: Agent classifies as WORKFLOW_INITIATION
- [ ] AC-1.2: Orchestrator starts new run
- [ ] AC-1.3: User sees confirmation with run ID
- [ ] AC-1.4: Phase 0 begins automatically

### US-2: Ask About Current State

**As a** user with an active workflow  
**I want to** ask "where are we?"  
**So that** I understand current progress

**Acceptance Criteria:**
- [ ] AC-2.1: Agent classifies as STATUS_CHECK
- [ ] AC-2.2: Queries workflow_runs + current phase
- [ ] AC-2.3: Response includes phase, sub-phase, status
- [ ] AC-2.4: Cites record IDs for provenance

### US-3: Explore Past Decisions

**As a** user wondering about a prior choice  
**I want to** ask "why did we choose JWT?"  
**So that** I understand the rationale

**Acceptance Criteria:**
- [ ] AC-3.1: Agent classifies as RATIONALE_REQUEST
- [ ] AC-3.2: Retrieves decision_trace + adr_record
- [ ] AC-3.3: Response explains reasoning
- [ ] AC-3.4: Cites decision record ID

### US-4: Check Downstream Effects

**As a** user considering a change  
**I want to** ask "what depends on AuthService?"  
**So that** I understand impact

**Acceptance Criteria:**
- [ ] AC-4.1: Agent classifies as FORWARD_IMPLICATION
- [ ] AC-4.2: Traverses memory_edge graph
- [ ] AC-4.3: Response lists dependent artifacts
- [ ] AC-4.4: Shows dependency chain

### US-5: Challenge Consistency

**As a** user noticing a contradiction  
**I want to** point it out  
**So that** JanumiCode addresses it

**Acceptance Criteria:**
- [ ] AC-5.1: Agent classifies as CONSISTENCY_CHALLENGE
- [ ] AC-5.2: Retrieves relevant artifacts
- [ ] AC-5.3: Compares for contradiction
- [ ] AC-5.4: Escalates to Orchestrator if confirmed

### US-6: View Artifact

**As a** user wanting to see output  
**I want to** ask "show me the architecture"  
**So that** I can review it

**Acceptance Criteria:**
- [ ] AC-6.1: Agent classifies as ARTIFACT_REQUEST
- [ ] AC-6.2: Queries by artifact type
- [ ] AC-6.3: Response includes artifact content
- [ ] AC-6.4: Cites artifact record ID

---

## 3. Functional Requirements

### FR-1: Query Classification (P1)

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Classify into 8 query types |
| FR-1.2 | Classification via LLM function-calling |
| FR-1.3 | Fallback to STATUS_CHECK if ambiguous |

### FR-2: Information Retrieval (P1)

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | FTS5 full-text search on content |
| FR-2.2 | Direct SQL queries by record_type, phase |
| FR-2.3 | memory_edge graph traversal |
| FR-2.4 | Vector similarity search (sqlite-vec) |

### FR-3: Response Synthesis (P1)

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Direct answers from retrieved facts |
| FR-3.2 | LLM synthesis of multiple records |
| FR-3.3 | Provenance citations (record IDs) |
| FR-3.4 | Comparison of multiple artifacts |

### FR-4: Action Execution (P1)

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Start workflow via Orchestrator |
| FR-4.2 | Escalate inconsistency to Orchestrator |
| FR-4.3 | Request clarification if ambiguous |
| FR-4.4 | Confirm destructive actions (cancel, rollback) |

### FR-5: Context Management (P2)

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Minimal context: current run, phase, status |
| FR-5.2 | Query-specific context: retrieved records |
| FR-5.3 | Memory edges for relationships |

---

## 4. Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target |
|-------------|--------|
| NFR-1.1 | Query classification | < 500ms |
| NFR-1.2 | Information retrieval | < 1s |
| NFR-1.3 | Response synthesis | < 2s |
| NFR-1.4 | Action execution | < 3s |

### NFR-2: Accuracy

| Requirement | Target |
|-------------|--------|
| NFR-2.1 | Classification accuracy | > 95% |
| NFR-2.2 | Retrieval relevance | > 90% |
| NFR-2.3 | Provenance accuracy | 100% |

### NFR-3: Reliability

| Requirement | Description |
|-------------|-------------|
| NFR-3.1 | Fallback to STATUS_CHECK on classification failure |
| NFR-3.2 | Graceful degradation on retrieval failure |
| NFR-3.3 | Clear error messages for user |

---

## 5. Out of Scope (MVP)

| Feature | Reason | Future Consideration |
|---------|--------|----------------------|
| Multi-turn conversations | Independent queries | Phase 2 |
| Streaming responses | Complete responses OK | Phase 2 |
| Custom capabilities | Built-in sufficient | Phase 3 |
| Capability discovery | Full list in prompt | Phase 2 |
| Response caching | Simpler without | Phase 2 |

---

# Part 2: Technical Specification

## 6. Architecture

### 6.1 Core Principle

**All user text input flows through the Client Liaison Agent.**

The user experiences a single, intelligent conversational interface. No mode selection, no explicit "start workflow" vs "ask question" - just natural language.

### 6.2 Component Structure

```
src/lib/agents/
  clientLiaisonAgent.ts       # Main agent class
  clientLiaison/
    classifier.ts             # Query type classification
    retriever.ts              # Database retrieval strategies
    synthesizer.ts            # Response synthesis
    capabilities/             # Capability implementations
      index.ts
      startWorkflow.ts
      getStatus.ts
      searchRecords.ts
      ...
```

### 6.3 Message Flow

```
Webview Composer
    |
    | submitIntent(text, attachments, references)
    v
Extension Host
    |
    | invokeClientLiaison(text, context)
    v
Client Liaison Agent
    |
    +-- classifyQuery() --> query_type
    |
    +-- retrieve(query_type, text) --> records
    |
    +-- synthesize(query_type, records) --> response
    |
    +-- if WORKFLOW_INITIATION:
    |       |--> orchestrator.startWorkflow(intent)
    |
    +-- if CONSISTENCY_CHALLENGE reveals issue:
    |       |--> orchestrator.escalateInconsistency(...)
    |
    v
Response to Webview
```

---

## 7. Query Types

### 7.1 Classification Taxonomy

| Query Type | Description | Example | Action |
|------------|-------------|---------|--------|
| **WORKFLOW_INITIATION** | User wants to start something new | "Build me a REST API for auth" | Trigger Orchestrator |
| **HISTORICAL_LOOKUP** | User asks about past decisions or events | "What did we decide about auth?" | Query DB, respond |
| **CONSISTENCY_CHALLENGE** | User notes a contradiction | "This contradicts our earlier decision" | Query + compare, escalate if needed |
| **FORWARD_IMPLICATION** | User asks about downstream effects | "What depends on AuthService?" | Traverse memory_edge |
| **RATIONALE_REQUEST** | User asks "why" something was decided | "Why did we choose JWT?" | Retrieve decision_trace |
| **AMBIENT_CLARIFICATION** | User asks for explanation | "What does this artifact mean?" | Retrieve + explain |
| **STATUS_CHECK** | User asks about current state | "Where are we?" | Query workflow_runs |
| **ARTIFACT_REQUEST** | User wants to see something | "Show me the architecture" | Query by artifact_type |

### 7.2 Retrieval Strategy per Type

| Query Type | Retrieval Strategy |
|------------|-------------------|
| WORKFLOW_INITIATION | No retrieval - start fresh |
| HISTORICAL_LOOKUP | FTS5 on query terms, filter by timestamp |
| CONSISTENCY_CHALLENGE | FTS5 + retrieve current artifact + compare |
| FORWARD_IMPLICATION | memory_edge traversal from mentioned entity |
| RATIONALE_REQUEST | Retrieve decision_trace + adr_record |
| AMBIENT_CLARIFICATION | Retrieve specific artifact + explain |
| STATUS_CHECK | Query workflow_runs + current phase artifacts |
| ARTIFACT_REQUEST | Query by artifact_type |

---

## 8. Data Model

### 8.1 Agent Context

```typescript
interface AgentContext {
  // Workspace
  workspaceId: string;
  workspaceRoot: string;
  
  // Current run state
  activeRun: WorkflowRun | null;
  currentPhase: PhaseId | null;
  currentSubPhase: SubPhaseId | null;
  runStatus: 'active' | 'paused' | 'waiting_for_input' | 'completed' | 'cancelled' | null;
  
  // Services
  orchestrator: OrchestratorEngine;
  db: Database;
  eventBus: EventBus;
  
  // User input
  input: {
    text: string;
    attachments: Attachment[];
    references: Reference[];
  };
}
```

### 8.2 Minimal Context (always included)

```json
{
  "current_workflow_run_id": "uuid or null",
  "current_phase": "0-10 or null",
  "current_sub_phase": "1.2 or null",
  "workflow_status": "active|waiting_for_input|completed|failed",
  "recent_record_summary": ["last 5 record types + timestamps"]
}
```

---

## 9. API Design

### 9.1 Capability Interface

```typescript
interface Capability<P = unknown, R = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;           // For LLM function calling
  preconditions?: (ctx: Context) => boolean | string;
  execute: (params: P, ctx: Context) => Promise<R>;
  formatResponse: (result: R) => string;
}
```

### 9.2 Core Capabilities (MVP)

| Category | Capabilities |
|----------|-------------|
| **Workflow Control** | startWorkflow, pauseWorkflow, resumeWorkflow, cancelWorkflow |
| **Information Retrieval** | getStatus, getPhaseHistory, searchRecords, getRecentActivity |
| **Artifact Interaction** | showArtifact, explainArtifact, listArtifacts |
| **Context Management** | attachFile, addConstraint, listConstraints |
| **Decision & History** | explainDecision, listDecisions, getAlternatives |
| **System** | help, getSettings, getVersion |

### 9.3 Capability Example

```typescript
export const startWorkflow: Capability<StartWorkflowParams, StartWorkflowResult> = {
  name: "startWorkflow",
  description: "Start a new workflow run to build something.",
  parameters: {
    type: "object",
    properties: {
      intent: { type: "string", description: "The user's raw intent" },
      attachments: { type: "array", items: { type: "string" } }
    },
    required: ["intent"]
  },
  
  preconditions: (ctx) => {
    if (ctx.activeRun?.status === 'active') {
      return "A workflow is already active. Cancel first or confirm replacement.";
    }
    return true;
  },
  
  execute: async (params, ctx) => {
    const { run, trace } = ctx.orchestrator.startWorkflowRun(ctx.workspaceId);
    await ctx.db.insertRecord({
      record_type: 'raw_intent_received',
      workflow_run_id: run.id,
      content: { intent: params.intent, attachments: params.attachments }
    });
    await ctx.orchestrator.executeCurrentPhase(run.id, trace);
    return { runId: run.id, phase: '0', trace };
  },
  
  formatResponse: (result) => 
    `Started workflow run \`${result.runId}\`. Now in Phase 0: Workspace Classification.`
};
```

---

## 10. Database Interface

### 10.1 Retrieval Methods

```typescript
interface ClientLiaisonDB {
  // Text search
  ftsSearch(query: string, filters?: RecordFilters): Promise<GovernedStreamRecord[]>;
  
  // Record retrieval
  getRecordsByType(type: RecordType): Promise<GovernedStreamRecord[]>;
  getRecordsByPhase(phaseId: PhaseId): Promise<GovernedStreamRecord[]>;
  getRecordById(id: string): Promise<GovernedStreamRecord | null>;
  
  // Graph traversal
  traverseEdges(fromId: string, edgeType?: EdgeType): Promise<MemoryEdge[]>;
  getDownstreamDependencies(entityId: string): Promise<GovernedStreamRecord[]>;
  
  // Workflow state
  getCurrentWorkflowRun(): Promise<WorkflowRun | null>;
  getWorkflowStatus(): Promise<WorkflowStatus>;
  
  // Semantic search
  vectorSearch(embedding: number[], limit?: number): Promise<GovernedStreamRecord[]>;
}
```

### 10.2 Governed Stream as Source of Truth

| Data | Table(s) | Client Liaison Can Answer |
|------|----------|---------------------------|
| Workflow runs | `workflow_runs` | "What's the current phase?", "When did this run start?" |
| Phases completed | `governed_stream` + `phase_gate_approved` | "What phases have we completed?" |
| Artifacts produced | `governed_stream` + `artifact_produced` | "What did we decide about auth?" |
| Decisions made | `governed_stream` + `decision_trace` | "Why did we choose JWT?" |
| Constraints active | `governed_stream` + `constraint_asserted` | "What constraints are we operating under?" |
| Prior runs | `workflow_runs` + `governed_stream` | "What did we build last week?" |
| Memory edges | `memory_edge` | "What depends on AuthService?" |

---

## 11. Orchestrator Integration

### 11.1 When Client Liaison Invokes Orchestrator

| Scenario | Client Liaison Action | Orchestrator Action |
|----------|----------------------|---------------------|
| **New workflow** | Classifies as WORKFLOW_INITIATION | `startWorkflowRun()` with raw intent |
| **Consistency escalation** | Detects active inconsistency | Bloom-and-prune resolution |
| **Mid-workflow change** | User requests modification | Determine if rollback needed |

### 11.2 When Orchestrator Sends to Client Liaison

| Scenario | Orchestrator Action | Client Liaison Action |
|----------|--------------------|-----------------------|
| **Phase completion** | Records artifact | Can answer questions about it |
| **Stuck situation** | Triggers Unsticking Agent | Can explain situation to user |
| **Phase Gate reached** | Awaits approval | Can explain gate criteria |

### 11.3 No Agent-to-Agent Chatter

**Key insight:** Client Liaison and Orchestrator don't "talk" directly.

- They share state through the **database**
- Client Liaison reads what Orchestrator writes
- Orchestrator acts on what Client Liaison routes to it

---

## 12. System Prompt Structure

```markdown
# Client Liaison Agent

You are the primary interface between the human user and the JanumiCode system.

## Your Role

You help users:
- Start and manage workflow runs
- Answer questions about past decisions and current state
- Explore the Governed Stream database
- Control the workflow lifecycle

## Query Types

Classify user input into one of these types:
- WORKFLOW_INITIATION: User wants to start building something
- HISTORICAL_LOOKUP: User asks about past decisions or events
- CONSISTENCY_CHALLENGE: User notes a contradiction
- FORWARD_IMPLICATION: User asks about downstream effects
- RATIONALE_REQUEST: User asks "why" something was decided
- AMBIENT_CLARIFICATION: User asks for explanation of something
- STATUS_CHECK: User asks about current state
- ARTIFACT_REQUEST: User wants to see a specific artifact

## Available Capabilities

{list of all capabilities with descriptions}

## Current Context

- Workspace: {workspaceId}
- Active Run: {activeRun?.id || 'None'}
- Current Phase: {currentPhase || 'N/A'}
- Status: {runStatus || 'No active run'}

## Guidelines

1. **Be proactive**: If intent is ambiguous, ask clarifying questions.
2. **Cite sources**: Reference record IDs for every claim.
3. **Confirm destructive actions**: Before cancelling or rolling back.
4. **Explain what you're doing**: Brief explanation before capability calls.
5. **Be helpful**: Offer suggestions if user seems stuck.

## Response Format

- For simple questions: Respond directly.
- For actions: Call the appropriate capability.
- For complex queries: May call multiple capabilities.
```

---

## 13. Implementation Steps

### Step 1: Create Agent Core

- `src/lib/agents/clientLiaisonAgent.ts`
- Main agent class with handleUserInput method
- LLM provider integration

### Step 2: Build Classifier

- `src/lib/agents/clientLiaison/classifier.ts`
- Query type classification via LLM
- Fallback logic

### Step 3: Build Retriever

- `src/lib/agents/clientLiaison/retriever.ts`
- FTS5, SQL, memory_edge traversal
- Vector search integration

### Step 4: Build Synthesizer

- `src/lib/agents/clientLiaison/synthesizer.ts`
- Response synthesis with provenance
- LLM-based summarization

### Step 5: Implement Core Capabilities

- `src/lib/agents/clientLiaison/capabilities/`
- startWorkflow, getStatus, searchRecords, showArtifact
- Capability registry

### Step 6: Wire to Intent Composer

- Extension host routes submitOpenQuery to agent
- Agent response displayed in Governed Stream

### Step 7: Add Capability Registry

- Map of all capabilities
- Generate LLM function schema from registry

---

## 14. References

- `janumicode-client-liaison-capabilities-bloom-b1c6c5.md` - Capability catalog
- `janumicode-client-liaison-router-bloom-b1c6c5.md` - Router architecture
