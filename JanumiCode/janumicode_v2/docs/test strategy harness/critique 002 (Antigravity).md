# Test Strategy Harness Specification Critique 002

Critical follow-on analysis of the "JanumiCode v2 Test Strategy Harness Requirements" specification, evaluated against the *Hestami AI* product scope and the realities of agentic workflow infrastructure.

## Guiding Principle

**Goal: Resilience against False Positives and Coverage of Governance.** While Critique 001 analyzed the internal consistency and architectural completeness of the spec itself, this critique shifts focus to how the harness will behave in reality: will it pass tests when the codebase is broken? Will it fail to test the core value proposition of the system?

## Summary

The proposed test strategy is well-structured for testing the "Golden Path" of an initial generation. However, it contains **six critical blind spots** related to test fidelity, mock isolation, and iterative state. Without addressing these, the harness will produce "green" builds that fail catastrophically in real-world scenarios.

---

## 1. False Positives in Mock Mode (The Semantic Key Blind Spot)

### The Claim
The specification uses a semantic key approach for fixtures: `agent_role__sub_phase_id__call_sequence`.

### The Problem
If a developer breaks the `Context Engineer`—for example, by introducing a bug that prevents the actual Hestami markdown spec from being attached to the `intent_statement` context payload—the semantic key will **still match**. 

The `MockLLMProvider` will receive a broken, empty prompt, but because it matches `requirements_agent__02_1__01`, it will blindly return the perfectly formulated list of 40 user stories captured from a previous correct run. **The test will pass, but the platform is deeply broken.** Mock fixtures decoupled from their input context offer negative value by providing false confidence.

### Required Addition
- The fixture schema must record a **hash of the critical input variables** (or a rough hash of the fully `prompt_rendered`).
- During execution, the `MockLLMProvider` must verify that the incoming context has not drifted substantially from the context that generated the fixture. If a developer accidentally drops 10,000 characters from the prompt context, the test must throw a `FixtureMismatchError` and fail, forcing the developer to recapture the fixture with the new context.

---

## 2. Inability to Test Human-in-the-Loop Mutations (The "Golden Path" Fallacy)

### The Claim
The CLI uses an `--auto-approve` flag that injects an `AutoApproveAdapter` to immediately satisfy all Phase Gates, select Menu index 0, and approve Mirrors.

### The Problem
JanumiCode’s primary differentiator is the **Governed Stream**: the ability for a human to edit, redirect, and modify AI proposals before they solidify. If the test harness *only* auto-approves unaltered LLM output, it never tests the system's ability to handle human unpredictability. 

If a user edits the Phase 1 `intent_statement` to remove an entire pillar, does Phase 2 crash because it assumes the shape of the original LLM output? The current harness cannot test this. Selectively choosing "Index 0" for Menus is also dangerous; if the exact product concept we are aiming for moves to Index 1 due to LLM non-determinism during capture, the entire test suite will track the wrong concept.

### Required Addition
- Introduce a **Human Action Playbook** (`decisions.json` or `HarnessConfig.userOverrides`) that can simulate deterministic *edits*. 
- For instance, applying a JSON Patch to the `mirror_presented` artifact prior to approval, allowing the harness to validate whether downstream phases gracefully adapt to human-injected constraints.
- Explicit menu overrides: `decisionOverrides: { "phase_1_3": "index_2" }`.

---

## 3. Absence of Brownfield Lifecycle Testing (Phase 0.5 Omission)

### The Claim
The Hestami test suite expects `workspace_classification type = greenfield` and tests Phases 0 through 10 linearly.

### The Problem
Agentic systems excel at bootstrap generation but dramatically fail at state reconciliation and safe partial refactors. The specification defines expectations for the Greenfield pass but provides **no test case for Phase 0.5 (Cross-Run Impact Analysis) or Phase 0.2 (Brownfield Ingestion).**

Iterative development is the core of coding. If JanumiCode cannot safely modify an existing system natively, it fails its mandate. 

### Required Addition
- Define a **Day 2 Test Scenario** in the Hestami suite.
- After confirming Phase 0-10 Greenfield success, the harness must submit a new prompt against the resulting workspace (e.g., *"Add a pet tracking tracking database to the CAM pillar"*).
- Assert on Phase 0.2 `ingestion_conflict_list` and Phase 0.5 `refactoring_scope` to guarantee iterative workflows are protected by tests.

---

## 4. Token Limit Vulnerability in Mocks

### The Claim
Mock Mode resolves LLM calls via static fixtures instantly, enabling lightning-fast CI runs.

### The Problem
The Hestami AI scope is colossal (3 pillars, 21 total domains). In later phases (e.g., Phase 6 Implementation Planning), the amount of required context will be immense. A developer might configure the `Context Compiler` to send the entire `Governed Stream` into the prompt, resulting in a 250,000+ token request. 

In Mock Mode, the test will pass instantly because the mock ignores payload size. When running locally realistically, the actual LLM API will immediately throw a `context_length_exceeded` error. Mocks often mask architectural context bloating.

### Required Addition
- `MockLLMProvider` must implement a rudimentary token estimation (e.g., `character_count / 4`) and compare it against configurable limits matching the target model (e.g., 128k for Claude/GPT-4o). 
- If an incoming prompt exceeds the real-world threshold, the mock must throw a `SimulatedTokenLimitExceededError` to fail the test.

---

## 5. Repository Bloat via Fixture Capture

### The Claim
The fixture generator produces JSON files containing both `prompt_template` and heavily populated `prompt_rendered` fields for debugging convenience.

### The Problem
Given the deep domains of the Hestami document and the compounding nature of the architecture pipeline, `prompt_rendered` strings will grow to tens of thousands of lines. Capturing these large strings across 11 phases with multiple iterations per phase will create massive JSON files. Tracking these files in Git will quickly bloat repository history and slow down clone times.

### Required Addition
- Strip `prompt_rendered` out of the committed `.json` fixture schemas.
- If rendered prompts are needed for local debugging, write them parallel to the fixtures in a `.janumicode/.gitignored-test-debug/` directory, rather than baking them into the source-controlled fixture object.

---

## 6. Gap Collector Data & Cost Leakage in CI

### The Claim
The Gap Collector makes a focused LLM API call to generate `suggested_fix` instructions. If an LLM is unavailable, it falls back to rules.

### The Problem
Automated CI pipelines may coincidentally have access to an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` via runner secrets used for other processes. If a test fails in a GitHub Action, the Gap Collector could unintentionally hijack these keys and fire expensive API calls simply to generate textual error summaries for the CI logs. 

### Required Addition
- Ensure the CLI and Gap Collector respect a strict `--disable-ai-suggestions` flag and detect `CI=true` environment variables natively.
- This provides an absolute guarantee that CI will fail fast using ONLY rule-based fallback tables, avoiding pipeline hangs or unnecessary AI spending on broken builds.
