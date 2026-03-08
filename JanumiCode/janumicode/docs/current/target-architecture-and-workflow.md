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

### 2. The Machine-Structured Layer (Internal Objects)
Invisible internal machinery orchestrates the MAKER-style reliability using structured objects. These must be implemented securely within JanumiCode:

**Intent & Planning:**
- **`intent_record`:** Canonical machine-readable form of the goal (`intent_id`, `human_goal`, `scope_in`, `scope_out`, `priority_axes`, `risk_posture`, `clarifications_resolved`).
- **`acceptance_contract`:** Defines what “done” means before planning expands (`contract_id`, `success_conditions`, `required_validations`, `non_goals`, `human_judgment_required`).

**Decomposition:**
- **`task_graph`:** Decomposed work graph derived from intent (`graph_id`, `root_goal`, `units`, `edges`, `critical_path`, `graph_status`).
- **`task_unit`:** Smallest execution-planning unit worth tracking (`unit_id`, `label`, `goal`, `category`, `inputs`, `outputs`, `preconditions`, `allowed_tools`, `preferred_provider`, `max_change_scope`).
- **`claim_unit`:** Atomic claim tied to a task unit, not broad proposal prose (`claim_id`, `statement`, `claim_scope`, `falsifiers`, `required_evidence`).

**Evidence & Validation:**
- **`evidence_packet`:** Structured support/disproof for one claim (`packet_id`, `sources`, `supported_statements`, `unsupported_statements`, `confidence`, `gaps`).
- **`validation_packet`:** Deterministic checks for a task unit (`validation_id`, `checks`, `expected_observables`, `actual_observables`, `pass_fail`, `failure_type`).
- **`repair_packet`:** Bounded internal retry/correction (`repair_id`, `suspected_cause`, `repair_strategy`, `attempt_count`, `escalation_threshold`).

**Memory:**
- **`historical_invariant_packet`:** Reusable memory from prior runs (`packet_id`, `relevant_invariants`, `prior_failure_motifs`, `precedent_patterns`, `reusable_subplans`).
- **`outcome_snapshot`:** Artifact for future routing and precedent use (`snapshot_id`, `providers_used`, `augmentations_used`, `success`, `failure_modes`, `useful_invariants`).

---

## The Governed Stream UX

The system compresses internal structure into clear user-facing UX updates, keeping the burden low.

### Human-Facing States
Replace raw orchestration phase output with clear, compact states:
- **Understanding:** "I’m grounding your request in the workspace, specs, and prior context."
- **Framing:** "I’ve formed the implementation intent and success criteria."
- **Needs Input:** "I need your decision on 1-2 items before proceeding." (Must include exact question and why it matters).
- **Planning:** "I’m decomposing the work and checking assumptions."
- **Verifying:** "I’m validating assumptions and checking prior constraints."
- **Executing:** "I’m applying changes and running validations."
- **Repairing:** "A validation failed. I’m attempting an internal correction."
- **Blocked:** "I’m blocked by an external dependency or unresolved judgment."
- **Complete:** "Work completed and validated."

### UX Modes
**Default Mode:** High signal-to-noise timeline for normal use.
  - Shows top summary card (goal, current state, active bundle).
  - Main timeline hides raw execution detail; shows key human prompts, major milestones, blockers, and final summary.
  - Decision Cards pop up only when needed (intent ambiguity, tradeoffs, risk acceptance).
  - Memory Card pops up only when applying major precedents ("Known failure motif detected").

**Advanced Mode (Expandable):** Inspectable internal state for debugging and power users.
  - `Task Graph` Panel (units and dependencies)
  - `Claims` and `Evidence` Panels
  - `History` (invariant packets) and `Validation` (raw checks, failures) Panels
  - `Routing` detail (provider selection, MCP bundles, fallbacks)

### What to Hide by Default
- Raw stdin for every role
- Every micro-claim and disconfirming query
- Intermediate repair loops and full historical packet matching.

---

## Concrete Modules to Add/Refactor
1. **Capability Model (`ProviderCapabilityProfile`)**: Defines strengths (coding, design, verification, search), parallel execution support, and structured output support.
2. **Task Router (`src/lib/routing/taskRouter.ts`)**: Accepts workflow phase and goal features to select a provider, augmentation bundle, and validation plan (e.g., Claude Code proposes -> Codex critiques -> Gemini judges).
3. **Augmentation Registry (`src/lib/augmentation/`)**: Moves mobile specialist out of raw execution and into generic bundles like `typescript-strict`, `frontend-ui-check`, or `test-engineer`.
4. **Validation Pipeline (`src/lib/validation/pipeline.ts`)**: Governs deterministic stages outside the provider: syntax/type check -> linter -> selected tests -> optional provider repair pass.
5. **Provider Outcome Tracker**: Records success by task type, parse failure rate, latency, and tokens in SQLite memory to drive empirical routing.

---

## Concrete Roadmap for Engineers

The transition to a governed agent integration control plane occurs in distinct, actionable phases:

### Phase 1: Foundation and Capability Profiling
- **Context Reliability:** Fix context reliability; ensure document truncation is enforced reliably end-to-end before hitting token limits.
- **Provider Capability Profiles:** Add basic metadata limits and profiles to each provider.
- **Initial Task Router:** Introduce routing by task type while keeping current static roles in place temporarily.

### Phase 2: Execution Augmentation and Local Validation
- **Augmentation Registry:** Extract the existing mobile specialist logic into a fully realized generic augmentation registry.
- **New Bundles:** Add `test-engineer` and `lint/type-check` capability bundles.
- **Deterministic Pipeline:** After the EXECUTE loop, enforce a local validation pipeline (lint/test/subset) and a bounded autofix pass before escalating to a human gate.

### Phase 3: Evidence-Based Routing and Enforced Knowledge
- **Performance Database:** Store provider performance outcomes, token cost, latency, and success rates in SQLite.
- **Empirical Routing:** Route tasks using empirical success constraints rather than sole configurations.
- **System of Record Docs:** Promote repository docs and architectural/product constraints into an enforced, indexed knowledge system checked automatically.

### Phase 4: Advanced Orchestration and Scale
- **Multi-Provider Phases:** Allow a single phase to orchestrate multiple providers intentionally across the same subgraph. (e.g., Claude Code plans, Codex critiques the test coverage).
- **Expanded MCP Toolshed:** Introduce broad, curated MCP tools for repository search, test selection, git diff/PR context, logs/diagnostics, and browser inspection.
- **Extended Retries:** Add bounded unattended execution retries utilizing the rich Execution Augmentation tools.

---

## Next Steps for Prompt Refactoring
To achieve MAKER-like reliability, prompts must shift to outputting machine-checkable packets instead of conversational prose.

- **Executor:** Replace "primary deliverable is proposal prose" with "primary deliverable is a dependency-ordered task graph." 
  - *Must output fields:* `task_units`, `dependency_edges`, `required_evidence`, `verification_hooks`, `rollback_or_repair`, `integration_risks`.
  - Every task unit must name its own observables and state what would falsify it.
- **Verifier:** Stop falling into UNKNOWN for large claims. 
  - *Must output fields:* `DECOMPOSE_REQUIRED`, `claim_scope` (atomic, composite, vague), `minimal_split_suggestion`, `verification_blocker_type` (missing_evidence, oversized_claim, ambiguous_terms, external_dependency).
  - Require the strongest counterexample before disproving.
- **Historian:** Move from string findings to reusable patterns.
  - *Must output fields:* `invariants_to_preserve`, `recurring_failure_motifs`, `reusable_subplans`, `prior_validation_patterns`, `similarity_class`, `dangerous_couplings`.
- **Technical Expert (INTAKE):** Split intake into Extractor (atomic deltas), Synthesizer (merge deltas to plan), Gap Finder. 
  - *Must output fields:* `answer_scope`, `directly_supported_statements`, `unsupported_statements`, `repo_local_evidence`, `external_evidence`, `operational_implications`, `questions_this_does_not_answer`.
- **Evaluator:** Extend classifications beyond PROCEED/QUESTIONS.
  - Add specific failure identifiers: `TOO_COARSE`, `NOT_VERIFIABLE`, `MISSING_OBSERVABLES`, `MISSING_ACCEPTANCE_CONTRACT`.


## Frequently Asked Questions
### Describe how the dialogue between the Executor, Technical Expert, Historian and Verifier work in this new approach?

In the new approach, the roles no longer exchange mostly large prose blobs. They collaborate through smaller internal control objects while still presenting a simple experience to the human.

High-Level Flow

The dialogue becomes:

1. Human gives intent.  
2. Technical Expert frames intent into a machine-usable contract.  
3. Executor decomposes that contract into small task units and atomic claims.  
4. Verifier tests whether those claims are narrow enough and evidentially supportable.  
5. Historian checks whether the task units or claims violate prior invariants or repeat known failure motifs.  
6. Executor revises decomposition or proceeds to execution.  
7. Validation and repair happen internally.  
8. Human is involved only when judgment is required.

So the roles are less like “independent essay writers” and more like specialized functions in an internal review loop.

Technical Expert

The Technical Expert’s job shifts from “answer the question well” to “reduce ambiguity before planning and execution.”

Its dialogue outputs should mainly produce:

* clarified intent  
* acceptance contract  
* environment assumptions  
* unresolved questions  
* evidence-backed technical constraints

It should answer things like:

* what does the repo/spec actually imply?  
* what dependencies are real versus assumed?  
* what technical conditions must hold before planning is valid?  
* what acceptance checks are implied by the request?

In effect, the Technical Expert converts a human’s broad prompt into a more precise internal problem definition without telling the user to do that work manually.

Executor

The Executor no longer starts with “write the best big proposal you can.”  
It starts with “produce the smallest safe decomposition that can be verified and executed.”

Its dialogue outputs should mainly produce:

* task graph  
* task units  
* outputs and dependencies  
* atomic claims attached to units  
* observables and validation hooks  
* bounded execution scope

The Executor is the synthesizer and doer, but in smaller pieces.  
Instead of saying:

* “Here is the whole implementation plan for Concierge slice 1”

it should internally say something more like:

* “Unit A: define canonical ontology entities”  
* “Unit B: define schema migration boundary”  
* “Unit C: define cross-layer type generation path”  
* “Unit D: validate RLS assumptions”  
* “These are the claims each unit depends on”

That is the MAKER-style move: localize the reasoning.

Verifier

The Verifier becomes the decomposition gatekeeper, not just the truth gatekeeper.

In the current model it asks:

* is this claim true?

In the new model it should first ask:

* is this claim even shaped correctly for verification?

So its dialogue should include:

* claim normalization  
* claim scope classification: atomic, composite, vague  
* disconfirming queries  
* evidence sufficiency  
* verdict  
* decomposition-required signal when claims are too broad

That means the Verifier can reject an Executor output not only because it is false or unknown, but because it is not yet decomposed enough to be safely reasoned about.

This is crucial. Otherwise the system keeps failing late on broad claims instead of failing early on bad decomposition.

Historian

The Historian’s role becomes more operational.

In the current design it mostly says:

* this conflicts with history  
* here are some precedents

In the new design it should say:

* these invariants must be preserved  
* this decomposition resembles a prior failure pattern  
* this class of task previously succeeded when split differently  
* these units are crossing boundaries that usually create problems

So the Historian is less a passive memory narrator and more a reusable constraint and pattern source.

It should attach to task units:

* historical invariants  
* prior failure motifs  
* precedent subplans  
* suspicious couplings

That lets history shape the decomposition before execution, not just comment on it afterward.

How The Roles Talk To Each Other

The internal dialogue should become staged and structured:

Stage 1: Intent Framing

* Human \-\> Technical Expert  
* Technical Expert \-\> intent\_record, acceptance\_contract, unresolved questions

Stage 2: Decomposition

* Technical Expert/contract \-\> Executor  
* Executor \-\> task\_graph, task\_units, claim\_units

Stage 3: Decomposition Check

* Executor output \-\> Verifier  
* Verifier \-\> verifiable as-is or decompose\_required

Stage 4: Historical Constraint Check

* task units \+ claims \-\> Historian  
* Historian \-\> invariant packet, precedent packet, failure motifs

Stage 5: Revision

* Executor consumes:  
  * verifier decomposition feedback  
  * historian invariant feedback  
* Executor revises units or continues

Stage 6: Execution and Validation

* Executor executes one or more units  
* validation results feed repair loop  
* if repair cannot resolve, human sees a compact blocker

What Changes In Practice

Old interaction pattern:

* Technical Expert helps discuss  
* Executor writes large plan  
* Verifier attacks resulting assumptions  
* Historian comments on contradictions  
* Human sees many broad failures

New interaction pattern:

* Technical Expert narrows ambiguity  
* Executor emits smaller work units  
* Verifier rejects oversized or untestable units early  
* Historian injects constraints before execution  
* Executor iterates on decomposition  
* Human sees fewer, more meaningful interruptions

What The Human Sees

The human should still see a simple flow:

* “I understand your goal.”  
* “I need one clarification.”  
* “I’ve decomposed the work.”  
* “I’m verifying assumptions.”  
* “I’m executing and validating.”  
* “I’m blocked on this real decision.”

The human should not need to see all role-to-role internal packets unless they expand advanced detail.

The Core Principle

The new dialogue model is:

* Technical Expert reduces ambiguity.  
* Executor reduces scope.  
* Verifier reduces epistemic risk.  
* Historian reduces repeated failure.  
* JanumiCode orchestrates the loop until the work is decomposed enough to execute safely.

That is how the roles become a path toward MAKER-style reliability instead of just a sequence of specialized prompts.



### What sources of information do the Historian and Verifier check?

The short answer is:

* Verifier checks whether a claim is supportable from authoritative evidence and current workspace/context.  
* Historian checks whether the current work conflicts with prior runs, prior decisions, prior claims/verdicts, and durable project memory.

In JanumiCode, they should overlap a little, but not do the same job.

Verifier sources

The Verifier should primarily inspect sources that answer: “is this specific claim true, false, conditional, or still unknown?”

Current prompt and context indicate it checks:

* the specific claim to verify  
* constraint manifest  
* existing verdicts/evidence  
* historical verdicts on similar claims  
* related claims  
* code/artifact context included in the verifier context pack

You can see that in the Verifier prompt and invocation path:

* [verifier.ts (line 74\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)  
* [verification.ts (line 69\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)

In the improved approach, its authoritative sources should be ordered roughly like this:

1. local codebase facts  
   * source files  
   * config files  
   * schemas  
   * tests  
   * generated contracts  
2. repo-local specs/docs that are treated as source of truth  
3. execution/validation outputs  
   * typecheck  
   * test output  
   * linter output  
   * CLI/tool results  
4. external authoritative references when needed  
   * official docs  
   * standards  
   * APIs  
5. prior verdicts only as context, not as proof

Important distinction:

* prior verdicts can guide where to look  
* they should not substitute for current evidence if the claim is about present reality

So the Verifier is mainly evidence-facing and present-state-facing.

Historian sources

The Historian should primarily inspect sources that answer: “how does this proposed work relate to what happened before?”

Current implementation and docs suggest it checks:

* historical claims  
* historical verdicts  
* human decisions at gates  
* workflow history  
* prior findings and contradictions  
* narrative curator artifacts  
* semantic retrieval over prior artifacts

You can see that in:

* [historianInterpreter.ts (line 85\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)  
* [compiler.ts (line 152\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)  
* [narrativeCurator.ts (line 1\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)  
* [schema.ts (line 223\)](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/mchen/.windsurf/extensions/openai.chatgpt-0.4.79-win32-x64/webview/#)

In the improved approach, the Historian should pull from:

1. prior dialogue turns  
2. prior claims and verdicts  
3. prior human decisions and overrides  
4. prior gates/blockers  
5. narrative memories  
6. decision traces  
7. open loops  
8. embeddings / semantic retrieval over the above  
9. previous task graphs / validations once those exist

So the Historian is mainly memory-facing and temporal-pattern-facing.

Clean division of labor

A useful rule is:

* Verifier asks: “Is this claim justified by evidence now?”  
* Historian asks: “Have we seen this pattern before, and what did it lead to?”

Examples:

If the claim is:

* “This route already enforces tenant isolation”

Verifier checks:

* middleware code  
* route code  
* RLS config  
* tests  
* docs/specs if they are source of truth

Historian checks:

* whether earlier runs already flagged tenant-isolation problems  
* whether similar claims were previously disproved  
* whether there is a known invariant like “all association-scoped docs require both organizationId and associationId”

If the claim is:

* “We can safely implement this using the existing schema pipeline”

Verifier checks:

* whether that pipeline actually exists in repo today

Historian checks:

* whether prior attempts using that pipeline succeeded or repeatedly broke at some boundary

What each should not overreach into

Verifier should not:

* do long historical storytelling  
* infer architectural precedent from weak similarity  
* treat old conclusions as automatically valid today

Historian should not:

* re-verify technical truth claims  
* act like a test runner  
* pronounce present-state truth from memory alone

Best source hierarchy in the new model

For the Verifier:

* current workspace reality first  
* authoritative external docs second  
* historical verdicts third

For the Historian:

* durable internal memory first  
* prior workflow artifacts second  
* semantic retrieval over prior artifacts third  
* current workspace only insofar as needed to map history to the present

So both may inspect the repo, but for different reasons:

* Verifier: to confirm truth  
* Historian: to detect continuity, conflict, and repeated failure

