# n8n JanumiCode v2 PoC

This is a proof of concept for implementing JanumiCode v2's workflow in n8n with custom nodes.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build custom nodes:
```bash
npm run build
```

3. Start n8n:
```bash
npm run start:n8n
```

## Custom Nodes

This project includes 7 custom nodes for the JanumiCode validator subsystem:

1. **Governed Stream** - Read/write records to the Governed Stream database
2. **Invariant Checker** - Check artifacts against invariant rules (7 rule files)
3. **Phase Gate Evaluator** - Evaluate 7-criteria Phase Gate with short-circuit logic
4. **Constitutional Invariant Checker** - Enforce CI-1 through CI-10 constitutional invariants
5. **Context Builder** - Assemble stdin (directives) and detail file (evidence)
6. **Deep Memory Research** - RAG-based context retrieval from Governed Stream
7. **Rollback Manager** - Dependency closure rollback and artifact invalidation

## Ollama Integration

To use Ollama with the ornith:35b-q4_K_M model:

1. Install Ollama: https://ollama.com
2. Pull the model:
```bash
ollama pull ornith:35b-q4_K_M
```

3. Configure n8n to use Ollama:
- In n8n, add an Ollama credential
- Configure the model settings:
  - Model: `ornith:35b-q4_K_M`
  - Options:
    - num_ctx: 131072
    - stop: ["<|im_end|>"]
    - temperature: 0.6
    - top_k: 20
    - top_p: 0.95

## Workflow Implementation

The PoC implements all 10 phases of JanumiCode v2:

- Phase 0: Workspace Initialization
- Phase 0.5: Cross-Run Impact Analysis (conditional)
- Phase 1: Intent Capture and Convergence (product lens only)
- Phase 2: Requirements Definition
- Phase 3: System Specification
- Phase 4: Architecture Definition
- Phase 5: Technical Specification
- Phase 6: Implementation Planning
- Phase 7: Test Planning
- Phase 8: Evaluation Planning
- Phase 9: Execution
- Phase 10: Commit and Deployment Initiation

## Project Structure

```
n8n/
├── nodes/
│   ├── GovernedStream/
│   ├── InvariantChecker/
│   ├── PhaseGateEvaluator/
│   ├── ConstitutionalInvariantChecker/
│   ├── ContextBuilder/
│   ├── DeepMemoryResearch/
│   └── RollbackManager/
├── schemas/
│   └── invariants/
│       ├── component_model.invariants.json
│       ├── architectural_decisions.invariants.json
│       ├── functional_requirements.invariants.json
│       ├── interface_contracts.invariants.json
│       ├── data_models.invariants.json
│       ├── api_definitions.invariants.json
│       └── implementation_plan.invariants.json
├── package.json
├── tsconfig.json
└── README.md
```

## Data Persistence

For this PoC, the Governed Stream is simulated using n8n's workflow static data. In production, this would be replaced with an external SQLite or PostgreSQL database.

## Next Steps

1. Start n8n and import the custom nodes
2. Create workflows for each phase
3. Test end-to-end execution
4. Document findings and recommendations
