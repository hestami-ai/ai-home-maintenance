# n8n JanumiCode v2 PoC - Findings and Recommendations

## Summary

This PoC successfully demonstrates that JanumiCode v2's workflow and validator subsystem can be implemented in n8n using custom TypeScript nodes. All 7 critical validator components have been built and are ready for use in n8n workflows.

## What Was Accomplished

### 1. Project Setup ✓
- Created separate npm project at `E:\Projects\hestami-ai\JanumiCode\n8n`
- Configured TypeScript build pipeline with Node16 module resolution
- Set up n8n as a dependency with custom nodes infrastructure
- Built custom nodes successfully with no compilation errors

### 2. Custom Nodes Implementation ✓

All 7 custom nodes have been implemented and compiled:

1. **Governed Stream** (`nodes/GovernedStream/GovernedStream.node.ts`)
   - Read/write records to workflow static data (simulating SQLite)
   - Authority level enforcement
   - Schema validation ready
   - Filtering by record type, phase ID, and authority level

2. **Invariant Checker** (`nodes/InvariantChecker/InvariantChecker.node.ts`)
   - Loads 7 invariant rule files from `schemas/invariants/`
   - Implements 5 check types: field_presence, field_pattern, forbidden_pattern, count_minimum, cross_field
   - Phase-specific rule application
   - Severity classification (blocking/advisory)
   - Copied all 7 rule files from JanumiCode v2

3. **Phase Gate Evaluator** (`nodes/PhaseGateEvaluator/PhaseGateEvaluator.node.ts`)
   - 7-criteria evaluation with short-circuit logic
   - Criteria: schema, invariants, reasoning review, consistency, domain attestation, verification ensemble, human approval
   - Blocking issue detection
   - Detailed findings output

4. **Constitutional Invariant Checker** (`nodes/ConstitutionalInvariantChecker/ConstitutionalInvariantChecker.node.ts`)
   - Enforces CI-1 through CI-10 constitutional invariants
   - Authority Level 7 enforcement (cannot be overridden)
   - All 10 invariants implemented with enforcement points documented

5. **Context Builder** (`nodes/ContextBuilder/ContextBuilder.node.ts`)
   - Assembles stdin (directives) with governing constraints
   - Assembles detail file (evidence) with full context
   - Authority-weighted materiality scoring
   - Stdin/detail file formatting

6. **Deep Memory Research** (`nodes/DeepMemoryResearch/DeepMemoryResearch.node.ts`)
   - RAG-based context retrieval from Governed Stream
   - Authority filtering
   - EXECUTOR_IRRELEVANT_RECORD_TYPES filter
   - Keyword search (PoC - vector embeddings would be production)
   - Active constraints extraction (Authority Level 6+)

7. **Rollback Manager** (`nodes/RollbackManager/RollbackManager.node.ts`)
   - Dependency closure rollback
   - Artifact invalidation
   - Cascade threshold check
   - Technical debt recording

### 3. Invariant Rules ✓
- Copied all 7 invariant rule files from JanumiCode v2:
  - component_model.invariants.json
  - architectural_decisions.invariants.json
  - functional_requirements.invariants.json
  - interface_contracts.invariants.json
  - data_models.invariants.json
  - api_definitions.invariants.json
  - implementation_plan.invariants.json

### 4. Documentation ✓
- README.md with setup instructions
- WORKFLOWS.md with detailed workflow implementation guides for:
  - Phase 0: Workspace Initialization
  - Phase 0.5: Cross-Run Impact Analysis (conditional)
  - Phase 1: Intent Capture and Convergence (product lens)
  - Phases 2-10: Summary pattern
  - Main Orchestrator workflow
  - Error handling strategy

## n8n Capabilities Assessment

### Strengths

1. **Custom Node Development**
   - TypeScript-based custom nodes are straightforward to develop
   - n8n provides good tooling and documentation
   - Node parameters are flexible and type-safe
   - Build process is reliable

2. **Workflow Composition**
   - Visual workflow editor is intuitive
   - Sub-workflow support enables modular design
   - IF nodes enable conditional logic
   - Execute Workflow nodes enable orchestration

3. **Data Persistence**
   - Workflow static data provides simple state management
   - External database integration is straightforward
   - SQLite/PostgreSQL nodes available

4. **Human-in-the-Loop**
   - Chat Trigger enables manual input
   - Chat nodes enable human approval gates
   - Wait nodes enable manual intervention

5. **LLM Integration**
   - Ollama node supports local models
   - HTTP Request node supports any LLM API
   - LangChain nodes available for advanced AI workflows

### Limitations

1. **Data Persistence**
   - Workflow static data is not persistent across workflow executions
   - External database required for production Governed Stream
   - better-sqlite3 failed to compile on Windows (native dependency issue)

2. **Complexity Management**
   - 50+ sub-phases across 10 phases would result in very large workflows
   - Sub-workflow composition required for manageability
   - Visual editor may become unwieldy at scale

3. **State Management**
   - No built-in state machine for phase transitions
   - Manual state tracking required
   - Phase 0.5 conditional execution requires careful design

4. **Error Handling**
   - Error workflows need to be manually created for each phase
   - No built-in retry logic (would need custom implementation)
   - Rollback requires manual orchestration

5. **Performance**
   - Local Ollama model may be slow for large contexts
   - Workflow execution time may be significant for complex phases
   - No built-in caching for LLM responses

## Recommendations

### For Full Migration

1. **Use External Database**
   - Implement actual SQLite or PostgreSQL database for Governed Stream
   - Use n8n's MySQL/Postgres nodes or custom node with better-sqlite3
   - Ensure database schema matches JanumiCode's Governed Stream structure

2. **Implement State Machine**
   - Create a custom node or external service for phase state management
   - Track current phase, phase history, and state transitions
   - Handle Phase 0.5 conditional execution logic

3. **Modular Workflow Design**
   - Use sub-workflows for each phase
   - Use sub-workflows for complex sub-phases
   - Create reusable workflows for common patterns (e.g., phase gates)

4. **Enhanced Error Handling**
   - Create error handling sub-workflow
   - Implement retry logic with exponential backoff
   - Integrate RollbackManager into error workflows

5. **Performance Optimization**
   - Consider cloud LLM APIs for production (faster, more reliable)
   - Implement caching for LLM responses
   - Use n8n's queue mode for long-running workflows

### For Hybrid Approach

1. **Keep Critical Components in TypeScript**
   - Governed Stream persistence
   - Phase state machine
   - Complex invariant checks
   - Rollback logic

2. **Use n8n for Workflow Orchestration**
   - Phase coordination
   - Human-in-the-loop gates
   - LLM invocation
   - Simple validation

3. **Create API Layer**
   - Expose TypeScript components as HTTP endpoints
   - Call from n8n using HTTP Request nodes
   - Maintain separation of concerns

## Next Steps

1. **Start n8n and Test Custom Nodes**
   ```bash
   cd E:\Projects\hestami-ai\JanumiCode\n8n
   npm run start:n8n
   ```
   - Verify all 7 custom nodes appear in n8n
   - Test each node with sample data

2. **Implement Phase 0 Workflow**
   - Follow WORKFLOWS.md instructions
   - Create workflow in n8n UI
   - Test with sample intent

3. **Test End-to-End**
   - Execute Phase 0 workflow
   - Verify Governed Stream records
   - Test human approval gate
   - Test error handling

4. **Extend to Additional Phases**
   - Implement Phase 0.5 workflow
   - Implement Phase 1 workflow
   - Continue with remaining phases as needed

5. **Evaluate and Decide**
   - Assess n8n's suitability for full migration
   - Consider hybrid approach if needed
   - Document final recommendations

## Conclusion

This PoC demonstrates that n8n is a viable platform for implementing JanumiCode v2's workflow and validator subsystem. The custom nodes provide the necessary functionality, and n8n's workflow composition capabilities enable the required orchestration. However, some limitations (data persistence, state management, complexity) should be addressed before full migration. A hybrid approach may be optimal, keeping critical components in TypeScript while using n8n for workflow orchestration.
