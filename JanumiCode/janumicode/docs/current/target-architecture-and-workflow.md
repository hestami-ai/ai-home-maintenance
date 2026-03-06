# Target Architecture and Workflow: JanumiCode as an Agent Integration Control Plane

This document synthesizes the strategic direction for JanumiCode, incorporating principles from OpenAI Harness Engineering, Stripe Minions, and the MAKER approach. The overarching goal is to transition JanumiCode from a "governed multi-agent wrapper" to a "governed repo harness and agent integration control plane."

## Core Strategy

JanumiCode should not attempt to own the full agent runtime. Instead, it serves as the orchestration, policy, and memory layer that combines various underlying runtimes (Claude Code, Codex, Gemini, specialists). It provides:
- Superior explicit governance (claims, verdicts, human gates).
- Deep repository-native environment legibility (browser, tests, logs, metrics as tools).
- Deterministic automated local feedback loops (lint, test, autofix) before escalating to a human.
- A robust, persisting memory substrate crossing multiple providers.

### The Core Design Shift
**From:** `workflow -> role prompt -> provider`
**To:** `workflow -> task classification -> capability routing -> provider + augmentations -> governed execution -> memory update -> next-step policy`

---

## 5-Layer Target Architecture

1. **Interaction Layer** (`dataAggregator.ts`, `extension.ts`)
   - VS Code UX, governed stream, approvals, review surfaces.
   - **Purpose:** Make agent work observable and governable without overwhelming the human.
2. **Workflow and Policy Layer** (`stateMachine.ts`, `orchestrator.ts`, `responseEvaluator.ts`)
   - State machine, phase routing, human gates, policy checks, branch analysis, retries.
   - **Purpose:** Decide what happens next and under what constraints.
3. **Capability Routing Layer** (`providerResolver.ts`, CLI providers)
   - Provider registry, role-to-provider selection, capability discovery, cost/reliability routing.
   - **Purpose:** Choose the appropriate provider based on the task's required capabilities (e.g., coding vs. design vs. judging).
4. **Execution Augmentation Layer** (`executor.ts`, `mcpConfigManager.ts`)
   - MCP servers, pre/post-run hooks, linters, test runners, typed validators, tool bundles.
   - **Purpose:** Enrich provider runs internally without reimplementing the providers. This must become a first-class abstraction.
5. **Memory and Evidence Layer** (`schema.ts`, `compiler.ts`, `narrativeCurator.ts`)
   - SQLite audit log, claims/verdicts, curated narrative memory, precedent retrieval.
   - **Purpose:** Persistent cross-provider intelligence and governance.

---

## The MAKER Approach: Decomposition and Prompting

To achieve zero-error reliability, JanumiCode must transition from generating monolithic proposal prose to emitting minimal verified work graphs of checkable atomic units.

### Principle: Human-Simple vs. Machine-Structured
- **Humans express high-level intent.** The user should not be forced to provide internal structure.
- **JanumiCode constructs the decomposition** internally.
- **Errors become local** instead of catastrophic, making retries cheaper and human intervention targeted.

### Specific Prompting/Role Shifts:
- **Executor:** Emits a dependency-ordered task graph instead of a massive prose plan. Each task unit must define observables and verification hooks.
- **Verifier:** Can reject oversized claims (`DECOMPOSE_REQUIRED`). Checks whether claims are safely shaped.
- **Historian:** Returns reusable invariant sets, failure motifs, and validation patterns, acting as a decomposition aid.
- **Technical Expert:** Maps answers to specific supporting statements, separating directly grounded facts from external or adjacent context.
- **Evaluator:** Classifies decomposition quality (`TOO_COARSE`, `NOT_VERIFIABLE`, `MISSING_OBSERVABLES`).

---

## The Interaction Model

JanumiCode operates across two parallel layers to shield the user from machine complexity.

### 1. The Human-Simple Layer (User-Facing)
The user provides a high-level goal (e.g., "Implement Concierge slice 1") and receives concise updates. Human intervention is requested *only* for:
1. Intent ambiguity (e.g., "Which behavior do you want?")
2. Priority tradeoffs
3. Risk acceptance (e.g., "Dependency staged. Proceed?")
4. External reality gaps (e.g., unavailable credentials)

Compact status updates replace raw orchestration detail:
- *Understanding*, *Framing*, *Needs Input*, *Planning*, *Verifying*, *Executing*, *Repairing*, *Blocked*, *Complete*.

### 2. The Machine-Structured Layer (Internal)
Invisible internal machinery orchestrates the MAKER-style reliability using structured objects:
- `intent_record` & `acceptance_contract`: Canonical machine-readable definitions of "done".
- `task_graph` & `task_unit`: Decomposed work units.
- `claim_unit` & `evidence_packet`: Atomic verification artifacts.
- `historical_invariant_packet`: Reusable memory constraints.
- `validation_packet` & `repair_packet`: Deterministic checks and bounded internal retries.
- `outcome_snapshot`: Memory updates for future routing.

### The Governed Stream UX
- **Default Mode:** High signal-to-noise. Shows the goal, current compact state, progress, required judgments, and final outcomes.
- **Advanced Mode (Expandable):** Inspectable internal state for debugging (task graphs, claims, evidence, history, routing, raw validation runs). 

---

## Concrete Roadmap for Engineers

* **Phase A:** Fix context reliability and make document truncation real end-to-end.
* **Phase B:** Add a deterministic local validation pipeline after EXECUTE (local lint/test, bounded autofix pass).
* **Phase C:** Introduce agent-legible tools (browser, test runners, log query, code search) via the Execution Augmentation layer.
* **Phase D:** Map provider capability profiles and formalize the Task Router module; promote repo docs to an enforced knowledge system.
* **Phase E:** Expand MCP into a curated toolshed and add bounded unattended retries and evidence-based routing.
* **Prompt Refactoring:** Overhaul Executor to generate task graphs, Verifier to require decomposition, and Historian to emit constraints.
