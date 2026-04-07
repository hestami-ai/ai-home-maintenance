# Code Review Findings (Round 7): Local IPC Security & Unauthenticated Permission Bridge

This round of review focused on local inter-process communication (IPC) and security boundaries. A severe vulnerability was identified in the bridge responsible for handling MCP tool permission requests.

### [P1] Unauthenticated Localhost Permission Server / CSRF Vector
**Location:** `src/lib/mcp/permissionBridge.ts` (Lines 87, 159-200)

**Synopsis:** The `PermissionBridge` spins up an HTTP server bound to `127.0.0.1:0` to receive `POST /permission` requests from the Claude Code CLI child process. When it receives a request, it parses the JSON body and either auto-approves (based on session memory) or pushes a permission card to the JanumiCode UI:
```typescript
	private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		if (req.method !== 'POST' || req.url !== '/permission') {
//...
		try {
			request = JSON.parse(body) as PermissionRequest;
        //...
			const decision = await this.evaluateRequest(request);
```

**Impact:** The server verifies neither an authentication token, nor relies on named pipes, nor enforces CORS headers. Because it listens on a local TCP port, _any process running on the user's machine_ can execute a POST request against this port. 

More dangerously, if the port is discovered, a malicious webpage could potentially execute a Cross-Site Request Forgery (CSRF) attack by sending a `POST` request with `Content-Type: text/plain` containing the JSON payload via standard `fetch()`, bypassing CORS preflight. This allows attackers to forge permission popup spam in the user's IDE, or if identical tool patterns are recognized by the `sessionApprovals` memory cache, potentially authorize unauthorized tool execution commands automatically.

**Recommendation:**
1. Generate an ephemeral, cryptographically secure bearer token (`crypto.randomBytes`) when spinning up the server and pass it to the MCP child process via an environment variable. The `PermissionBridge` must `401 Unauthorized` any request without this token in the `Authorization` header.
2. If possible, consider pivoting from a local HTTP socket to named pipes (`\\.\pipe\...` on Windows / `.sock` files on Unix) for superior OS-level access control.

======

CODE REVIEW PLAN

# RAD Comprehensive Code Review Plan

## Context

Across four review rounds + a self-review, the Recursive Architecture Decomposition pipeline has surfaced 14+ defects covering control flow, data flow, edge cases, cross-pass coherence, and dead code. Patterns emerged:

- **Same-block bugs:** every round found new bugs in the same nested-branch block, because patches added conditionals without simplifying structure.
- **Cross-pass drift:** RC4 dedupe / dep-remap / RC5 interface-remap operated on different snapshots of the data with different invariants.
- **LLM contract violations:** silent acceptance of malformed responses (orphans, duplicate IDs, parent + refactor for same component, missing remaps).
- **Loop termination:** subtle infinite-loop conditions hidden in progress-detection logic.
- **Dead/unused parameters:** API drift over multiple passes.

This plan defines a **repeatable structured review methodology** any reviewer (human or LLM) can execute end-to-end on the RAD code in roughly an hour. Output is not another fix list — it is a process. If executed faithfully, it should systematically catch the bug *categories* that have been escaping us.

**Scope:** the RAD pipeline as a whole, comprising:
- [src/lib/workflow/architectureRecursion.ts](JanumiCode/janumicode/src/lib/workflow/architectureRecursion.ts) — orchestrator + helpers
- [src/lib/workflow/architecturePhase.ts](JanumiCode/janumicode/src/lib/workflow/architecturePhase.ts) — `executeDesigning` (decompose adapter through RC3/RC4/RC5/dep-remap)
- [src/lib/roles/architectureExpert.ts](JanumiCode/janumicode/src/lib/roles/architectureExpert.ts) — `invokeBatchDecomposition` + `DECOMPOSITION_SYSTEM_PROMPT`

---

## Review Methodology — 7 Passes

Each pass is a focused walkthrough with a checklist. Passes are ordered so that earlier ones inform later ones. **Do not skip ahead** — bugs in pass N often masquerade as bugs in pass N+M.

### Pass 1 — Static Structure & API Surface

**Goal:** confirm the code's *shape* matches the intended design before reviewing behavior.

**Procedure:**
1. List every exported symbol from `architectureRecursion.ts`. For each, verify it has at most one caller outside the file or document why broader exposure is intentional.
2. List every parameter of `applyRecursiveDecomposition` and `invokeBatchDecomposition`. For each parameter, grep within the function body — does it have at least one use site? Flag any with zero references.
3. Open SonarLint/ESLint cognitive complexity report. For each function with complexity > 15, decide: (a) extract further, (b) accept with justification comment, (c) flag for refactor.
4. Diagram the call graph: orchestrator → helpers (one level deep). Verify no helper calls back into the orchestrator (cycles indicate hidden coupling).
5. For each helper, classify as **pure** (no side effects), **mutating** (modifies inputs), or **emitting** (calls `emitWorkflowCommand` / `log`). Document which is which in JSDoc if missing.

**Exit criteria:**
- [ ] Zero unused parameters
- [ ] Every helper labeled pure / mutating / emitting
- [ ] Cognitive complexity report attached
- [ ] Call graph diagrammed (mental model is fine)

**Bugs this catches:** dead params (M2, M3 from prior rounds), missing mutation contracts (H2), helper coupling.

---

### Pass 2 — Data Flow & Lifecycle

**Goal:** trace every datum from LLM response to persisted architecture document. Data that exists in only one snapshot is a red flag.

**Procedure:**
1. Pick the four primary data shapes: `ComponentSpec[]`, `InterfaceSpec[]`, `InterfaceProviderRemap[]`, `parent_component_id` graph.
2. For each shape, build a **lifecycle table** in your notes:

| Stage | Where | Mutated by | Read by |
|---|---|---|---|
| Born from LLM | `invokeBatchDecomposition` | parsing | `invokeDecomposition` |
| Aggregated | `applyRecursiveDecomposition` orchestrator | per-iteration push | RC3/RC4/RC5/dep-remap |
| Deduped | `architecturePhase.ts` RC4 | filter | RC5/dep-remap |
| Persisted | `updateArchitectureDocument` | DB write | downstream phases |

3. For each stage transition, ask: **does this stage's invariants still hold after the next mutation?**
   - Example failure: dep-remap routes to a child that RC4 will later drop. (This was H3.)
   - Example failure: aggregated interfaces include children that breadth-check rejected. (This was C4.)
4. Count the number of distinct snapshots each datum exists in. >2 is suspicious — each snapshot is a chance for drift.
5. For graph data (`parent_component_id`), draw two example component sets — one with a successful decomposition (parent + 2 children), one with refactor + decomposition mixed — and walk them through every stage by hand.

**Exit criteria:**
- [ ] Lifecycle table filled out for all four data shapes
- [ ] Every transition has a written invariant statement
- [ ] At least one mixed-decomposition example walked through manually

**Bugs this catches:** stale aggregates (C4), cross-pass drift (H3), data shape divergence after partial mutations.

---

### Pass 3 — Control Flow & Termination

**Goal:** prove every loop terminates and every branch is reachable.

**Procedure:**
1. Identify every loop in the RAD code. For each, write down:
   - **Variant:** what monotonically decreases? (e.g., max_iterations countdown, depth approaching max_depth)
   - **Bound:** what guarantees the variant terminates?
   - **Invariant:** what's true at the top of every iteration?
2. For each conditional branch in `processViolatingBatch`, `validateKeptIntact`, `classifyLevel`:
   - Construct an input that exercises this branch.
   - Trace execution mentally for 3 iterations. Does the output of iteration N feed iteration N+1 in a sane way?
3. Pathological inputs to mentally simulate:
   - **A.** LLM returns the exact same component set every iteration (no progress).
   - **B.** LLM returns components with parent_component_id pointing to itself.
   - **C.** LLM returns 100 children for one parent (breadth bomb).
   - **D.** LLM returns children whose parent_component_id is a non-violating component.
   - **E.** LLM returns refactor with same component_id but different parent_component_id (was non-null).
   - **F.** Mixed depth queue: depth 0 + depth 2 items in same iteration.
   - **G.** decomposeFn throws.
   - **H.** decomposeFn returns `{components: [], interfaces: [], interfaceProviderRemap: []}`.
4. For each pathological input, verify: (a) the function terminates, (b) no defect leaks to the architecture document, (c) a log line at WARN level documents what happened.

**Exit criteria:**
- [ ] Every loop has documented variant + bound + invariant
- [ ] Every conditional branch has a constructed test case
- [ ] All 8 pathological inputs walked through; results documented

**Bugs this catches:** infinite loops (C2, C3), unreachable branches, silent malformed-LLM acceptance.

---

### Pass 4 — LLM Contract Violation Audit

**Goal:** systematically enumerate ways the LLM can violate the prompt contract, and verify each is handled.

**Procedure:**
1. Open `DECOMPOSITION_SYSTEM_PROMPT`. List every constraint it places on the LLM:
   - Components must have valid component_id, label, responsibility, etc.
   - parent_component_id ∈ violating IDs OR null
   - Either decompose OR keep intact, not both
   - interface_provider_remap entries must reference valid children
   - interfaces array describes only inter-child contracts
   - workflows_served must reference real workflow IDs
2. For each constraint, ask: **what does the parser do if the LLM violates it?** Trace the path through `invokeBatchDecomposition` and downstream consumers.
3. Build a **violation handling matrix**:

| Constraint | Violation form | Detection point | Response | Test |
|---|---|---|---|---|
| parent_component_id ∈ violating | refers to non-violating ID | classified as `keptIntact` | ✓ orphan check | ? |
| Either decompose OR keep | both for same ID | refactoredById extraction | ✓ "preferring children" warning | ? |
| Provider remap valid child | references unrelated comp | RC5 LLM lookup | ✓ ignored, fall back | ? |
| ... | ... | ... | ... | ... |

4. For every cell with "?" in the test column, write the concrete violation example and trace it. If the response is "silent acceptance", that's a bug.
5. Cross-check against `validateMMPPayload`-style validators elsewhere in the codebase — does RAD have an equivalent strict-mode validator? If not, consider whether one is needed.

**Exit criteria:**
- [ ] Every prompt constraint has a violation handling matrix row
- [ ] Every "silent accept" path is either justified in writing or fixed
- [ ] At least one synthetic LLM-violation fixture exists for testing

**Bugs this catches:** hallucinated siblings (Round 2 F3), orphan refactors (M4), arbitrary provider assignment (Round 3 F3), silent malformed-component acceptance.

---

### Pass 5 — Cross-File Coherence

**Goal:** verify the recursion module and `architecturePhase.ts` agree on data invariants at their boundary.

**Procedure:**
1. Identify the contract between `applyRecursiveDecomposition` and `executeDesigning`:
   - Inputs: components, workflows, config, options
   - Outputs: `{components, interfaces, interfaceProviderRemap}`
2. For each output field, document what `executeDesigning` does with it:
   - `components` → RC3 (workflow repair) → RC4 (dedupe) → dep-remap → persist
   - `interfaces` → merge with existing → RC5 (provider/consumer remap) → persist
   - `interfaceProviderRemap` → RC5 LLM lookup map
3. Order-of-operations audit:
   - Is RC3 idempotent if RC4 reorders?
   - Does dep-remap happen before or after RC4? (Currently after, post-Phase-3 fix.)
   - Does RC5 use deduped components or pre-dedupe? (Currently deduped.)
4. For each pass (RC3, RC4, dep-remap, RC5), ask: **what does this pass assume about the previous one's output?** Write the assumption down. Then verify the previous pass actually guarantees it.
5. Look for any code in `executeDesigning` that mutates `components` or `interfaces` after persistence — those would be detected, persisted-then-mutated bugs.

**Exit criteria:**
- [ ] Boundary contract documented
- [ ] Order-of-operations dependency graph drawn
- [ ] Each pass's assumptions about its inputs verified against the previous pass's guarantees

**Bugs this catches:** cross-pass drift (H3), order-dependent correctness, ghost mutations after persistence.

---

### Pass 6 — Observability & Debuggability

**Goal:** verify a developer can reconstruct what happened in a failing run from logs alone.

**Procedure:**
1. Pick three failure modes: (a) infinite loop hit iteration cap, (b) breadth exceeded mid-batch, (c) LLM returned an orphan refactor.
2. For each, write down: **what log lines would I expect to see?** Then grep the code for those messages. Missing → instrument.
3. For every `emitWorkflowCommand` call, verify it includes enough context (componentId, depth, decision) for a UI viewer to reconstruct the decision tree.
4. For every `log?.warn` and `log?.error`, verify the message is actionable — does the reader know what went wrong AND what state to inspect?
5. Audit log levels: `info` should be one-per-decision, `warn` should be one-per-anomaly, `debug` should be high-volume diagnostics. Mismatches indicate either spam or under-logging.
6. Trace context: confirm `dialogueId` flows into every emitted log line either explicitly or via `AsyncLocalStorage` (if Phase 1 trace context lands).

**Exit criteria:**
- [ ] Three failure-mode log traces walked through
- [ ] Every WARN message rated for actionability
- [ ] Log level distribution matches intent

**Bugs this catches:** silent failures, debug-time blindspots, log spam, missing trace context.

---

### Pass 7 — Test Coverage Audit

**Goal:** identify what's tested vs. what's relied upon to "just work."

**Procedure:**
1. List unit tests touching `architectureRecursion`, `architectureExpert.invokeBatchDecomposition`, and `architecturePhase.executeDesigning`.
2. For each helper in `architectureRecursion.ts` (`classifyLevel`, `invokeDecomposition`, `extractRefactors`, `processViolatingBatch`, `validateKeptIntact`, `remapDependencyEdges`), verify at least one direct unit test exists. If not, write a stub.
3. Build a coverage matrix against the **8 pathological inputs** from Pass 3. Each should map to at least one test case.
4. Build a coverage matrix against the **violation handling matrix** from Pass 4. Each row should have a test fixture.
5. Identify integration tests that exercise the full pipeline end-to-end: WorkflowTestDriver scenarios that hit DESIGNING with non-trivial component graphs.
6. Snapshot test the `DECOMPOSITION_SYSTEM_PROMPT` — prompt regressions are silent failures.

**Exit criteria:**
- [ ] Coverage matrix for pathological inputs filled out
- [ ] Coverage matrix for LLM violations filled out
- [ ] At least one integration test exercising decomposition exists
- [ ] Prompt snapshot test exists

**Bugs this catches:** untested helpers, regression risk, silent prompt drift.

---

## Standing Smell Catalog

Things to grep for during *every* review pass — these have all bitten us before:

| Pattern | Where to grep | Why it's a smell |
|---|---|---|
| `for (...) { ... if (...) { break; } ... }` with mutation inside | recursion loops | Loop mutating its own iteration target |
| `splice()` mid-iteration | helpers consuming arrays | Order-dependent; can skip elements |
| `[0]` index access | arrays of unknown length | Arbitrary-pick bug (Round 3 F3) |
| `??` or `\|\|` on object fields | parsers | Silently swallows missing data |
| `as unknown as Result<...>` casts | early returns | Hides type drift across signature changes |
| Two passes that build a `Map` from the same source at different times | dedupe + remap | Cross-pass drift (H3) |
| `progressMade = false` set far from check | termination logic | Easy to miss a path that should set it true |
| `currentDepth` / `currentLevel` shared across helpers | mixed-depth queues | Single-level invariant violated (C1) |
| `for (const v of violating) { allComponents.push(v.component); }` | result accumulation | Probably should be the original NOT a refactored copy |
| Any `let` reassigned inside a loop body that's also captured in a closure | async/event handlers | Stale closure |

---

## Review Cadence

- **After every non-trivial RAD edit:** Pass 1 + Pass 3 (~15 min)
- **After every behavior change to the prompt or LLM contract:** Pass 4 + Pass 7 (~30 min)
- **After every phase boundary change in `executeDesigning`:** Pass 2 + Pass 5 (~30 min)
- **Quarterly:** Full 7-pass review (~1 hour)

The full review should produce a **review log** appended to `docs/reviews/rad-YYYY-MM-DD.md` so future reviewers can see what the previous reviewer concluded and what they didn't check.

---

## Critical Files for Reviewers

- [src/lib/workflow/architectureRecursion.ts](JanumiCode/janumicode/src/lib/workflow/architectureRecursion.ts) — helpers + orchestrator
- [src/lib/workflow/architecturePhase.ts](JanumiCode/janumicode/src/lib/workflow/architecturePhase.ts) — `executeDesigning`, RC3/RC4/RC5 + dep-remap callsite
- [src/lib/roles/architectureExpert.ts](JanumiCode/janumicode/src/lib/roles/architectureExpert.ts) — `invokeBatchDecomposition`, `DECOMPOSITION_SYSTEM_PROMPT`
- [src/lib/types/architecture.ts](JanumiCode/janumicode/src/lib/types/architecture.ts) — `ComponentSpec`, `InterfaceSpec`, `StoppingCriteria`, `DecompositionConfig`
- [src/test/unit/workflow/](JanumiCode/janumicode/src/test/unit/workflow/) — existing tests; reviewer should know what's covered

---

## Verification (of this plan)

1. **Dry-run Pass 1 + Pass 3** on the current code (~30 min). Confirm the checklists are concrete enough to execute and that they catch C1-C4 + M4 if you pretend Phase 2 didn't happen.
2. **Reviewer feedback loop:** after the first full review, refine the checklists based on what was missed. The plan is meant to evolve.
3. **Coverage of past defects:** for each historical bug (Rounds 1-3 + self-review), trace which pass would have caught it. Any defect that no pass catches indicates a missing checklist item.

---

## Out of Scope

- New code review tooling (SonarLint already in place)
- Automated review agents (could be future work)
- Reviews of phases other than RAD (this plan is RAD-specific; the methodology generalizes but the smell catalog and pathological inputs do not)
