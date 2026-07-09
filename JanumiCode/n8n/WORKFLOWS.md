# n8n Workflow Implementation Guide

This document provides detailed instructions for implementing JanumiCode v2 phases as n8n workflows using the custom nodes.

## Prerequisites

1. Start n8n:
```bash
cd E:\Projects\hestami-ai\JanumiCode\n8n
npm run start:n8n
```

2. Open n8n in browser: http://localhost:5678

3. The custom nodes will be automatically loaded from the `nodes/dist` directory

## Phase 0: Workspace Initialization

### Workflow: Phase 0 - Workspace Initialization

**Trigger**: Chat Trigger (manual input of raw intent)

**Node Sequence**:

1. **Chat Trigger**
   - Settings: Enable chat interface
   - Output: `rawIntent` (user input)

2. **Set Node: Initialize Workflow Run**
   - Set workflow run ID: `{{ $now.toISO() }}`
   - Set current phase: `0`
   - Set janumicode version sha: `poc-sha-placeholder`

3. **Governed Stream: Write Workspace Classification**
   - Action: Write Record
   - Record Type: `workspace_classification`
   - Content: 
     ```json
     {
       "workspace_type": "greenfield",
       "janumicode_version_sha": "poc-sha-placeholder"
     }
     ```
   - Authority Level: 5
   - Phase ID: `0`
   - Sub-Phase ID: `workspace_classification`

4. **If Node: Check Brownfield**
   - Condition: `{{ $json.workspace_type === "brownfield" }}`
   - If true: Execute brownfield path
   - If false: Skip to vocabulary check

5. **Governed Stream: Write Artifact Ingestion** (brownfield only)
   - Action: Write Record
   - Record Type: `ingested_artifact_index`
   - Content: (from existing artifacts)
   - Authority Level: 5
   - Phase ID: `0`
   - Sub-Phase ID: `artifact_ingestion`

6. **Governed Stream: Write Brownfield Continuity Check** (brownfield only)
   - Action: Write Record
   - Record Type: `prior_decision_summary`
   - Content: (from decision history)
   - Authority Level: 5
   - Phase ID: `0`
   - Sub-Phase ID: `brownfield_continuity_check`

7. **Governed Stream: Write Vocabulary Collision Check**
   - Action: Write Record
   - Record Type: `collision_risk_report`
   - Content: (from LLM analysis)
   - Authority Level: 5
   - Phase ID: `0`
   - Sub-Phase ID: `vocabulary_collision_check`

8. **Invariant Checker: Validate Workspace Classification**
   - Artifact Type: `workspace_classification`
   - Artifact Content: (from workspace classification record)
   - Phase ID: `0`

9. **Phase Gate Evaluator: Phase 0 Gate**
   - Phase ID: `0`
   - Artifact IDs: (comma-separated list of artifact IDs)
   - Schema Valid: `true` (if invariant check passed)
   - Invariants Passed: `true` (if invariant check passed)
   - Reasoning Review Passed: `true`
   - Consistency Passed: `true`
   - Domain Attested: `true`
   - Verification Ensemble Passed: `true`
   - Human Approved: `false` (requires human approval)

10. **Chat Node: Human Approval Gate**
    - Message: "Phase 0 complete. Please review and approve to proceed to Phase 1."
    - Options: "Approve", "Reject"
    - If rejected: Route to error workflow

11. **Set Node: Transition to Phase 1**
    - Set current phase: `1`
    - Output: Proceed to Phase 1 workflow

## Phase 0.5: Cross-Run Impact Analysis (Conditional)

### Workflow: Phase 0.5 - Cross-Run Impact Analysis

**Trigger**: Conditional from Phase 1 (if prior_decision_override detected)

**Node Sequence**:

1. **If Node: Check Prior Decision Override**
   - Condition: `{{ $json.prior_decision_override !== null }}`
   - Check if override references Phase-Gate-Certified interface

2. **Governed Stream: Write Impact Enumeration**
   - Action: Write Record
   - Record Type: `cross_run_impact_report`
   - Content:
     ```json
     {
       "changed_interface_id": "...",
       "affected_artifact_ids": ["..."],
       "affected_file_paths": ["..."],
       "estimated_refactoring_task_count": 10,
       "estimated_file_count": 5,
       "dependency_chain": ["..."],
       "modification_type": "additive|breaking|non_breaking"
     }
     ```
   - Authority Level: 5
   - Phase ID: `0.5`
   - Sub-Phase ID: `impact_enumeration`

3. **If Node: Cascade Threshold Check**
   - Condition: `{{ $json.estimated_refactoring_task_count > 100 || $json.estimated_file_count > 50 }}`
   - If exceeded: Present hard stop menu

4. **Chat Node: Refactoring Decision**
   - Message: Present cross_run_impact_report
   - Options: "Proceed", "Revise the override", "Accept divergence"
   - If "Revise": Return to Phase 1
   - If "Accept divergence": Record technical debt

5. **Phase Gate Evaluator: Phase 0.5 Gate**
   - Phase ID: `0.5`
   - Artifact IDs: (cross_run_impact_report ID)
   - Schema Valid: `true`
   - Invariants Passed: `true`
   - Reasoning Review Passed: `true`
   - Consistency Passed: `true`
   - Domain Attested: `true`
   - Verification Ensemble Passed: `true`
   - Human Approved: `false`

6. **Chat Node: Human Approval Gate**
   - Message: "Phase 0.5 complete. Please approve to proceed to Phase 2."
   - If approved: Transition to Phase 2
   - If rejected: Return to Phase 1

## Phase 1: Intent Capture and Convergence (Product Lens)

### Workflow: Phase 1 - Intent Capture and Convergence

**Trigger**: From Phase 0 Gate approval

**Node Sequence**:

1. **Context Builder: Build Intent Context**
   - Phase ID: `1`
   - Sub-Phase ID: `intent_quality_check`
   - Agent Role: `technical_expert`
   - Artifact References: (from Phase 0)
   - Governing Constraints: (constitutional invariants)
   - Required Output: Intent quality assessment
   - Summary Context: Raw intent from Phase 0

2. **Ollama Node: Intent Quality Check**
   - Model: `ornith:35b-q4_K_M`
   - System Prompt: Intent quality check prompt
   - User Input: (from Context Builder stdin)
   - Options:
     - num_ctx: 131072
     - stop: ["<|im_end|>"]
     - temperature: 0.6
     - top_k: 20
     - top_p: 0.95

3. **Governed Stream: Write Intent Quality Check**
   - Action: Write Record
   - Record Type: `intent_quality_assessment`
   - Content: (from Ollama response)
   - Authority Level: 5
   - Phase ID: `1`
   - Sub-Phase ID: `intent_quality_check`

4. **Ollama Node: Intent Lens Classification**
   - Model: `ornith:35b-q4_K_M`
   - System Prompt: Lens classification prompt
   - User Input: Raw intent
   - Output: lens type (product, process, etc.)

5. **If Node: Check Product Lens**
   - Condition: `{{ $json.lens === "product" }}`
   - If not product: Hard-fail with error (PoC only supports product lens)

6. **Ollama Node: Intent Discovery Decomposition** (5 passes)
   - Pass 1: Business domains bloom
   - Pass 2: User journeys bloom
   - Pass 3: System workflows bloom
   - Pass 4: Entities bloom
   - Pass 5: Integrations + quality attributes bloom
   - Composer: Product description synthesis

7. **Governed Stream: Write Product Description**
   - Action: Write Record
   - Record Type: `product_description`
   - Content: (from composer)
   - Authority Level: 5
   - Phase ID: `1`
   - Sub-Phase ID: `product_description_synthesis`

8. **Invariant Checker: Validate Product Description**
   - Artifact Type: `product_description`
   - Artifact Content: (from product description record)
   - Phase ID: `1`

9. **Phase Gate Evaluator: Phase 1 Gate**
   - Phase ID: `1`
   - Artifact IDs: (all Phase 1 artifacts)
   - Schema Valid: `true` (if invariant check passed)
   - Invariants Passed: `true` (if invariant check passed)
   - Reasoning Review Passed: `true`
   - Consistency Passed: `true`
   - Domain Attested: `true`
   - Verification Ensemble Passed: `true`
   - Human Approved: `false`

10. **Chat Node: Human Approval Gate**
    - Message: "Phase 1 complete. Please review product description and approve."
    - If approved: Check for Phase 0.5 trigger
    - If rejected: Return to intent discovery

11. **If Node: Check Phase 0.5 Trigger**
    - Condition: `{{ $json.prior_decision_override !== null }}`
    - If true: Execute Phase 0.5 workflow
    - If false: Proceed to Phase 2

## Phases 2-10: Summary

For brevity, Phases 2-10 follow a similar pattern:

1. **Context Builder**: Build context for the phase
2. **Ollama Nodes**: Execute sub-phase LLM calls
3. **Governed Stream**: Write artifacts
4. **Invariant Checker**: Validate artifacts
5. **Phase Gate Evaluator**: Evaluate phase gate
6. **Chat Node**: Human approval gate
7. **Transition**: Move to next phase

Each phase has specific sub-phases and artifacts as defined in the JanumiCode v2 specification.

## Main Orchestrator Workflow

### Workflow: Main Orchestrator

**Trigger**: Chat Trigger (raw intent input)

**Node Sequence**:

1. **Chat Trigger**: Receive raw intent
2. **Execute Workflow: Phase 0**
3. **Execute Workflow: Phase 1**
4. **If Node: Check Phase 0.5 Trigger**
5. **Execute Workflow: Phase 0.5** (if needed)
6. **Execute Workflow: Phase 2**
7. **Execute Workflow: Phase 3**
8. **Execute Workflow: Phase 4**
9. **Execute Workflow: Phase 5**
10. **Execute Workflow: Phase 6**
11. **Execute Workflow: Phase 7**
12. **Execute Workflow: Phase 8**
13. **Execute Workflow: Phase 9**
14. **Execute Workflow: Phase 10**
15. **Chat Node: Workflow Complete**
    - Message: "JanumiCode v2 workflow complete. All phases executed successfully."

## Error Handling

Each phase should have an error workflow that:

1. Logs the error to Governed Stream
2. Invokes RollbackManager if needed
3. Presents error to human with options:
   - Retry current phase
   - Rollback to previous phase
   - Abort workflow

## Testing

To test the PoC:

1. Start n8n
2. Create the Main Orchestrator workflow
3. Create Phase 0 workflow
4. Test with sample intent: "Build a URL shortener service"
5. Verify custom nodes are working
6. Check Governed Stream records
7. Verify phase gate evaluation
8. Test human approval flow
