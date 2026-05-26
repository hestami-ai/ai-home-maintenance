# Implementation Packet Synthesis — Design

**Status:** Locked design (2026-05-19). Not yet implemented.

**Driver:** The ts-16 trace report ([decomposition-trace-report.md](../../test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-16/decomposition-trace-report.md)) surfaced a structural failure of the pipeline: even when every phase ran end-to-end, **only 5 of 32 user stories** had ANY downstream representation, **172 of 172 acceptance criteria** had no Phase 6 task trace, **5 evaluation criteria** were emitted exclusively for over-invented user stories while the two spec-anchored ones (US-001, US-002) had **zero evaluation coverage**, and the executor at Phase 9 received bare task records carrying no user story, no AC, no test case, no eval criterion, no component contract, no active constraint — and predictably invented all of that context inline (mock databases, fabricated ADRs, out-of-scope rate limiting, missing encryption-on-insert, missing click counter).

The three broken trace links exposed by the report — task→AC, test→AC, eval→FR — are **symptoms of one architectural gap**: there is no canonical "implementation packet" concept in the pipeline. Each phase produces its own artifact in its own id namespace, but nothing bundles them into a coherent context-rich unit that Phase 9 can act on. Fixing the three trace links individually is insufficient — Phase 9 would still get bare tasks even if every link were correct.

This design introduces an **`implementation_packet`** record type and a **`packet_synthesis`** sub-phase between Phase 8's evaluation_gate and Phase 9's execution. One packet per atomic Phase 6.1a task. Each packet bundles all upstream context the executor needs to do its work without inventing. A new coherence verifier guarantees every emitted packet contains: at least one user story, all of that user story's ACs, at least one test case per AC, at least one evaluation criterion per user story, the relevant component contract, data models, API definitions, technical constraints, and compliance items. Coherence failures route through either the iterative-implementation-backlog cycle controller (auto mode — typical for calibration / thin-slice runs) or a mirror gate (interactive mode — typical for CLI/UI runs).

---

## 1. Concept and invariants

### Concept

A new sub-phase **`packet_synthesis`** runs after Phase 8's `evaluation_gate` and before Phase 9's `implementation_task_execution`. It joins across every prior phase's artifacts, builds one **`implementation_packet`** record per atomic Phase 6.1a task, and runs a **coherence verifier** that gates Phase 9 entry. Phase 9's executor consumes the packet as primary context instead of the bare task.

```
   Phase 8 evaluation_gate (passes)
              ↓
   packet_synthesis sub-phase
       ↓
       ├─ joins upstream artifacts per atomic task
       ├─ emits implementation_packet records
       ├─ runs coherence_verifier
       │       ↓
       │       ├─ pass → Phase 9 entry
       │       └─ fail → mode-dependent routing:
       │               • auto mode → cycle_controller (route to iterative-implementation-backlog)
       │               • interactive mode → packet_coherence_mirror to operator
       │
       ↓ (pass branch)
   Phase 9 implementation_task_execution
       ↓ reads implementation_packet, NOT task
```

### Invariants

These are what "100% correct" means and what every test below must enforce.

- **I1 — One packet per atomic task.** For every Phase 6.1a `task_decomposition_node` with `status === 'atomic'`, exactly one `implementation_packet` record exists; for every packet, exactly one atomic task. No double-bundling, no orphan tasks, no orphan packets.
- **I2 — Self-contained context.** A packet contains COPIES (not just id references) of every upstream artifact relevant to the task. The executor receiving only the packet has enough context to do the work without consulting any other governed-stream record.
- **I3 — Coherence assertions hold before Phase 9 entry.** No `implementation_packet` flows into Phase 9 unless every blocking assertion in §4 passes (auto mode routes failed packets to the cycle controller; interactive mode blocks at a mirror — neither allows incoherent packets to execute).
- **I4 — Id grounding.** Every id referenced in a packet must exist upstream in the governed stream (verifier rule "no invented references" — see §4). Ai-proposed origin is annotated but not blocking (per Q4 option c).
- **I5 — Dependency ordering preserved.** A packet's `depends_on_packets[]` references real packet_ids; the dependency DAG is acyclic; Phase 9 honors the dependency ordering at execution-wave time.
- **I6 — Phase 9 executor reads the packet, not the task.** The executor prompt builder consumes the `implementation_packet` content and renders the full context into the prompt; the bare-task path is removed.

---

## 2. Data model

### New record type — `implementation_packet`

```ts
interface ImplementationPacketContent {
  kind: 'implementation_packet';
  schemaVersion: '1.0';

  /** Unique packet id. UUID; not the task id. */
  packet_id: string;

  /** The atomic Phase 6.1a leaf this packet implements. */
  task: {
    id: string;              // Phase 6 task display id (e.g. "task-comp-001-generate-short-url-identifier")
    node_id: string;         // task_decomposition_node UUID
    name: string;
    description: string;
    task_type: string;
    backing_tool: string;
    estimated_complexity: 'low' | 'medium' | 'high';
    completion_criteria: Array<{
      criterion_id: string;
      description: string;
      verification_method: string;
    }>;
    write_directory_paths: string[];
    read_directory_paths: string[];
    /** Phase 6's dependency_task_ids — translated to packet_ids in depends_on_packets below. */
    dependency_task_ids: string[];
  };

  /** Bundled context — copies, not references. */
  user_stories: Array<{
    id: string;
    role: string;
    action: string;
    outcome: string;
    priority: string;
    /** All ACs for this user story. */
    acceptance_criteria: Array<{
      id: string;
      description: string;
      measurable_condition: string;
    }>;
  }>;

  /** NFRs this packet must respect. */
  nfrs: Array<{
    id: string;
    category: string;
    description: string;
    threshold?: string;
    measurement_method?: string;
    measurable_condition?: string;
  }>;

  /** The component this task lives inside, with full contract. */
  component: {
    id: string;
    name: string;
    domain_id: string | null;
    responsibilities: Array<{ id: string; description: string; statement?: string }>;
    dependencies: Array<{ component_id: string; kind: string }>;
    active_constraints: string[];   // TECH-* ids
  };

  /** Data-model fields the task is expected to read/write. */
  data_models: Array<{
    id: string;
    name: string;
    component_id: string;
    fields: Array<{ name: string; type: string; constraints?: string }>;
  }>;

  /** API endpoints the task is expected to implement. */
  api_definitions: Array<{
    id: string;
    method: string;
    path: string;
    request_shape?: unknown;
    response_shape?: unknown;
    error_codes?: string[];
    description: string;
  }>;

  /** Test cases that verify the ACs in this packet. */
  test_cases: Array<{
    test_case_id: string;
    type: string;                   // 'functional' | 'integration' | 'performance' | …
    acceptance_criterion_ids: string[];   // must intersect this packet's AC ids
    preconditions: string[];
    expected_outcome: string;
  }>;

  /** Evaluation criteria that judge whether this packet's work succeeded. */
  evaluation_criteria: Array<{
    kind: 'functional' | 'quality' | 'reasoning';
    /** US or NFR id that this criterion judges. */
    target_id: string;
    evaluation_method: string;
    success_condition: string;
  }>;

  /** TECH-* technical constraints active for this packet (verbatim, not just ids). */
  active_constraints: Array<{
    id: string;
    category: string;
    text: string;
    technology?: string;
    rationale?: string;
  }>;

  /** COMP-*, VV-*, QA-* compliance / verification / quality items applicable to this packet. */
  compliance_items: Array<{
    id: string;
    kind: 'compliance' | 'vv_requirement' | 'quality_attribute';
    description: string;
    measurable_condition?: string;
  }>;

  /** Other packet_ids that must complete before this one. Derived from Phase 6 dependency_task_ids. */
  depends_on_packets: string[];

  /** Coherence verifier output — see §4. */
  coherence: {
    passed: boolean;
    blocking_failures: string[];
    advisory_findings: string[];
    /** Annotations — drift visibility without blocking. */
    annotations: {
      ai_proposed_root_count: number;
      ai_proposed_root_ids: string[];
    };
  };

  /** Release this packet was assigned to (from Phase 1.8 / Phase 2 release-anchoring). */
  release_id: string | null;
  release_ordinal: number | null;
}
```

### Governed-stream wiring

- Record type registered alongside existing decomposition node types.
- Written by the new `packet_synthesis` sub-phase handler.
- Indexed by `packet_id` for fast dependency-ordering lookups.

### Workflow-run columns

```sql
ALTER TABLE workflow_runs ADD COLUMN packet_count INTEGER DEFAULT 0;
ALTER TABLE workflow_runs ADD COLUMN packet_coherence_blocking_count INTEGER DEFAULT 0;
ALTER TABLE workflow_runs ADD COLUMN packet_coherence_advisory_count INTEGER DEFAULT 0;
```

---

## 3. The `packet_synthesis` sub-phase

### When it runs

Sits between Phase 8's `evaluation_gate` and Phase 9's `implementation_task_execution`. New state-machine edge:

```
evaluation_gate → packet_synthesis (always, if no Phase 8 blocking gaps)
packet_synthesis → implementation_task_execution (if coherence verifier passes)
packet_synthesis → cycle_controller (auto mode — failed coherence routes to iterative-implementation-backlog)
packet_synthesis → packet_coherence_mirror (interactive mode — failed coherence routes to operator)
packet_coherence_mirror → packet_synthesis (operator: retry after intervening fix)
packet_coherence_mirror → cycle_controller (operator: defer to next cycle)
packet_coherence_mirror → DONE (operator: abort)
```

### Algorithm

```
1. Enumerate atomic tasks
   Read all task_decomposition_node records WHERE
       status === 'atomic' AND is_current_version = 1
   for the active release_ordinal (release-major iteration honored from
   iterative-implementation-backlog design).

2. Build the upstream-id index
   Walk every Phase 1–8 artifact in the governed stream and build:
     - allUpstreamIds: Set<string>     — every id ever produced upstream
     - aiProposedIds: Set<string>      — items with source === 'ai-proposed'
     - userSpecifiedIds: Set<string>   — items with source === 'user-specified'
     - artifactsById: Map<string, content>  — fast lookup by id
   This is the "trust root" backing Q4 option (c).

3. For each atomic task, build a packet:
   a. Resolve user stories
      - Match by `task.traces_to` containing US ids
      - Fallback: match Phase 6 task's `component_id` → component → user stories
        whose `traces_to` cite that component or its responsibilities
      - Always include ALL ACs from each resolved user story
   b. Resolve NFRs
      - Match by `task.traces_to` and `task.component_id` → component traces
   c. Resolve component
      - Lookup `task.component_id` → component_decomposition_node tree
      - Take the leaf component (matching the task's tier) plus its responsibility
        contract
   d. Resolve data_models
      - Match by `data_model.component_id === task.component_id`
   e. Resolve api_definitions
      - Match by `api.component_id === task.component_id`
   f. Resolve test_cases
      - For each AC bundled in this packet, find test_decomposition_node leaves
        whose `acceptance_criterion_ids` intersects the AC set
      - Permissive matching: also accept `${us_id}-${ac_suffix}` style references
   g. Resolve evaluation_criteria
      - From Phase 8's functional/quality/reasoning evaluation plans, match by
        `functional_requirement_id ∈ packet.user_stories[*].id` and
        `nonfunctional_requirement_id ∈ packet.nfrs[*].id`
   h. Resolve active_constraints
      - From `task.active_constraints[]` (TECH-* ids), look up full TECH content
        in Phase 1.0c technical_constraints_discovery
   i. Resolve compliance_items
      - From user_stories[*].traces_to and component.traces_to that resolve to
        COMP-*, VV-*, QA-* ids, look up full content in Phase 1.0d/0e/1.5
   j. Resolve depends_on_packets
      - Translate task.dependency_task_ids[] → packet_ids by joining against
        the packets emitted earlier in this same pass

4. Run coherence verifier on each packet (§4 details)
   For each assertion:
     - blocking failure → add to packet.coherence.blocking_failures
     - advisory finding → add to packet.coherence.advisory_findings
   Annotate ai_proposed_root_count by walking every id reference in the packet
   and tallying how many appear in aiProposedIds.

5. Write each packet to the governed stream
   record_type='implementation_packet', is_current_version=1.

6. Decide the routing
   total_blocking_failures = SUM(packet.coherence.blocking_failures.length)
   if total_blocking_failures === 0:
     transition → implementation_task_execution
   else if mode === 'auto-decompose-further':
     transition → cycle_controller (with the orphan AC/US/test set as the
                                    deferred-frontier seed for the next cycle)
   else (mode === 'block-and-mirror'):
     transition → packet_coherence_mirror
```

### Mode selection

The harness invocation determines the default mode:

- `--auto-approve` (calibration / thin-slice runs) → `auto-decompose-further`
- absent (CLI/UI interactive runs) → `block-and-mirror`

Operator override via `--packet-coherence-mode={auto|interactive}` always wins.

---

## 4. Coherence verifier

The verifier runs per-packet (some assertions) and per-run (cross-packet integrity). All blocking assertions must pass for a packet to flow into Phase 9.

### Per-packet blocking assertions

- **P1 — Has at least one user story.** `packet.user_stories.length >= 1`. A task that doesn't satisfy any user story is by definition an orphan; routes the task to either cycle_controller or mirror.
- **P2 — Every user story has at least one AC.** For each `us in packet.user_stories`, `us.acceptance_criteria.length >= 1`. Trivially true if the US was loaded from `fr_bloom_skeleton` (which always carries ACs), but checked defensively.
- **P3 — Every AC has at least one test case.** For each AC bundled in the packet, at least one entry in `packet.test_cases` cites its id (or its `us_id` prefix) in `acceptance_criterion_ids`. The ts-16 failure mode (test cases use a different id namespace than ACs) lights up here.
- **P4 — Every user story has at least one evaluation criterion.** For each US, at least one entry in `packet.evaluation_criteria` with `target_id === us.id`. Catches ts-16's "eval covers US-003..US-007 but not US-001/US-002" failure mode.
- **P5 — Every NFR has at least one evaluation criterion.** Symmetric to P4 against `packet.nfrs[*].id`.
- **P6 — Component contract present.** `packet.component.id` is non-empty AND `packet.component.responsibilities.length >= 1`. A task with no resolvable component contract has no implementation home.
- **P7 — No invented id references.** Every id mentioned anywhere in the packet (US, AC, NFR, component, data model, API, test, eval, TECH, COMP/VV/QA, dependency packet) appears in `allUpstreamIds` or in the set of packets emitted in the same synthesis pass. Per Q4 option (c), "appears upstream" is permissive — Phase 1 over-invention is reported, not blocked here.

### Cross-packet blocking assertions

- **C1 — Implement-once invariant.** No task appears in more than one packet.
- **C2 — Atomic-task coverage.** Every atomic Phase 6.1a task has exactly one packet. No task is dropped silently.
- **C3 — Dependency DAG acyclic.** The `depends_on_packets[]` graph has no cycles.
- **C4 — All dependency references resolve.** Every entry in `packet.depends_on_packets[]` references a real `packet_id` emitted in this synthesis pass.

### Per-packet advisory findings (annotated, not blocking)

- **A1 — Task write-paths inside component boundary.** Each `task.write_directory_paths[]` entry SHOULD live within the component's typical filesystem namespace (e.g., `src/server/<component-slug>/...`). Mismatches flagged for review but do not block.
- **A2 — No test redundancy.** No two test cases in the packet have identical `acceptance_criterion_ids[]` AND identical `expected_outcome` (catches LLM-generated duplicate tests).
- **A3 — Eval criterion measurability.** Each evaluation criterion's `success_condition` should contain at least one observable predicate (matchable URL, status code, time threshold, etc.). Heuristic; advisory.

### Annotations (always, not assertions)

- **ai_proposed_root_count** — total count of ids in the packet that resolve to Phase 1 items with `source: 'ai-proposed'`. Surfaces over-invention drift without blocking.
- **ai_proposed_root_ids** — sample of up to 20 such ids for operator inspection.

---

## 5. Routing on coherence failure

### Auto mode — `auto-decompose-further`

Default for `--auto-approve` runs (calibration / thin-slice). When any blocking assertion fails:

1. Write a `packet_synthesis_failure` content record summarizing per-packet failures.
2. Compose a **deferred-frontier seed** for the iterative-implementation-backlog cycle controller:
   - Orphan ACs (P3 failures) → seed Phase 7 to author missing test cases for those ACs in the next cycle
   - Orphan USs (P4 failures) → seed Phase 8 to author missing evaluation criteria
   - Orphan packets (P1, P6 failures) → seed Phase 6 to re-decompose the affected component into tasks that trace to the orphan stories
3. Transition to `cycle_controller`, which sees the deferred frontier and re-enters Phase 2..9 for the next cycle (per the iterative-implementation-backlog locked design).

The system self-heals: a coherence failure becomes a backlog item, not a workflow halt.

### Interactive mode — `block-and-mirror`

Default for human-interactive CLI/UI runs. When any blocking assertion fails:

1. Write the `packet_synthesis_failure` content record.
2. Present a **`packet_coherence_mirror`** to the operator:

   ```
   Packet synthesis blocked.
   - 12 of 26 packets failed coherence (3 missing user stories, 7 missing test
     cases, 5 missing eval criteria, 1 missing component contract).
   - 47 invented id references found.
   - 32 packets are rooted in ai-proposed Phase 1 items.

   Options:
     [retry]   Fix upstream and re-run packet_synthesis.
     [defer]   Treat failed packets as backlog; advance only the 14 coherent packets to Phase 9.
     [abort]   Terminate the workflow run.
   ```

3. Operator response routes:
   - `retry` → re-enter `packet_synthesis` (likely after the operator has edited upstream artifacts via re-running an earlier phase manually)
   - `defer` → emit only the coherent packets to Phase 9; failed-packet ids are written as a backlog seed for the next iterative cycle
   - `abort` → terminate the workflow run

Rationale for the two-mode split: in calibration/thin-slice the system should self-heal autonomously to expose how the loop closes; in human runs, a coherence failure is signal that something significant went wrong and a human should triage rather than silently iterate.

---

## 6. Phase 9 executor changes

### Prompt construction

Phase 9's executor prompt builder now consumes the `implementation_packet` content (not the bare `task_decomposition_node`). The packet is rendered into the prompt with one section per bundled artifact type:

```
You are implementing the following atomic task. The context below contains
EVERYTHING you need; do not invent missing details.

# Task
{task.name}
{task.description}
Files to write under: {task.write_directory_paths}
Files you may read: {task.read_directory_paths}

# User Stories this Task Implements
{for each us in user_stories:}
  ## {us.id} — As a {us.role}, I want to {us.action}, so that {us.outcome}.

  Acceptance criteria (these MUST hold true when this task completes):
  {for each ac in us.acceptance_criteria:}
    - {ac.id}: {ac.description}
      Measurable: {ac.measurable_condition}

# Component Contract
Component {component.id} — {component.name}
Responsibilities:
{for each resp in component.responsibilities:}
  - {resp.id}: {resp.description}
Dependencies:
{for each dep in component.dependencies:}
  - {dep.component_id} ({dep.kind})

# Data Models You Read/Write
{for each dm in data_models:}
  {dm.name} fields:
    {for each f in dm.fields:}
      - {f.name}: {f.type} {f.constraints || ''}

# API Endpoints You Implement
{for each api in api_definitions:}
  {api.method} {api.path}
  Request: {api.request_shape}
  Response: {api.response_shape}
  Errors: {api.error_codes}

# Test Cases You Must Make Pass
{for each tc in test_cases:}
  {tc.test_case_id} (verifies {tc.acceptance_criterion_ids}):
    Preconditions: {tc.preconditions}
    Expected outcome: {tc.expected_outcome}

# How This Task Will Be Evaluated
{for each ec in evaluation_criteria:}
  Target: {ec.target_id} ({ec.kind})
  Method: {ec.evaluation_method}
  Success condition: {ec.success_condition}

# Technical Constraints (apply without exception)
{for each tc in active_constraints:}
  {tc.id} ({tc.category}): {tc.text}

# Compliance / V&V / Quality Constraints
{for each c in compliance_items:}
  {c.id} ({c.kind}): {c.description}
  Measurable: {c.measurable_condition || ''}

# Dependencies
This task must wait for these other packets to complete first:
{depends_on_packets}
```

### Executor responsibility

The executor now writes code that:
- Satisfies the ACs in the packet (not just the task description).
- Implements the API endpoints listed.
- Reads/writes the data-model fields named.
- Respects the active constraints.
- Generates code that the listed test cases can validate.
- Stays within the write_directory_paths.

The current ts-16 failure modes — mocked databases, invented rate limiting, missing click counter, missing HTTPS redirect, encryption helpers defined-but-not-used — become structurally less likely because the packet's ACs explicitly name these behaviors.

### Phase 9 → Packet coherence is enforced

Phase 9's task entry point asserts `packet.coherence.passed === true` before invoking the executor. Defense-in-depth: even if `packet_synthesis` somehow lets an incoherent packet through, Phase 9 still refuses to execute it.

---

## 7. Failure modes and recovery

| Failure | Detection | Recovery |
|---|---|---|
| Packet has no user story (P1) | per-packet verifier | auto: route to cycle_controller; interactive: mirror |
| AC has no test case (P3) | per-packet verifier | same |
| US has no eval criterion (P4 / P5) | per-packet verifier | same |
| Invented id reference (P7) | per-packet verifier | same; annotation records the missing id for upstream diagnosis |
| Atomic task missing packet (C2) | cross-packet verifier | hard-fail packet_synthesis; this is a synthesizer bug |
| Dependency cycle (C3) | cross-packet verifier | hard-fail; design defect in Phase 6 |
| Packet coherence passes but Phase 9 still fails | Phase 9 quarantine | existing executionScheduler `deferred_batch` retry path |
| `ai_proposed_root_count` high but packet otherwise coherent | annotation only | does not block; operator sees count in harness output and trace report |
| Operator chooses `defer` at mirror | mirror handler | advance coherent packets to Phase 9; write failed-packet ids as cycle backlog seed |

---

## 8. Files that must change

No code yet — the list below is the surface the implementation will touch.

- `src/lib/types/records.ts` — add `ImplementationPacketContent` interface.
- `src/lib/database/schema.ts` — workflow_runs columns (`packet_count`, `packet_coherence_blocking_count`, `packet_coherence_advisory_count`).
- `src/lib/orchestrator/stateMachine.ts` — `packet_synthesis` sub-phase + `packet_coherence_mirror` surface; new edges.
- `src/lib/orchestrator/phases/packetSynthesis.ts` — NEW. §3 algorithm.
- `src/lib/orchestrator/phases/packetSynthesis/upstreamIndex.ts` — NEW. Builds the `allUpstreamIds` / `aiProposedIds` / `artifactsById` indices in one DB walk.
- `src/lib/orchestrator/phases/packetSynthesis/coherenceVerifier.ts` — NEW. §4 verifier (per-packet and cross-packet).
- `src/lib/orchestrator/phases/packetSynthesis/packetBuilder.ts` — NEW. The per-task join logic (§3 step 3).
- `src/lib/orchestrator/phases/phase9.ts` — entry point reads `implementation_packet`, not bare task; assert `coherence.passed === true`; rewire executor prompt construction.
- `src/lib/orchestrator/executionScheduler.ts` — accept packets (with `depends_on_packets[]` for wave ordering) instead of bare tasks.
- `src/lib/orchestrator/quarantineLedger.ts` — quarantine record carries `packet_id` alongside the task_id.
- `src/lib/types/mmp.ts` — new mirror shape `packet_coherence_mirror`.
- `src/webview/components/PacketCoherenceMirror.svelte` — NEW. Operator UI for the interactive mode mirror.
- New prompts:
  - Executor prompt template — completely rewritten to consume the packet (the bulk of §6).
  - `packet_coherence_mirror` operator-prompt scaffolding (mirror card text generation).
- `harness.ts` — `--packet-coherence-mode` flag plumbing; status-line additions showing packet counts.

---

## 9. Tests required

- **Unit — packet builder.** Given a fixture set of upstream artifacts and one atomic task, builds the expected packet shape. Cases:
  - Task with multiple traced user stories.
  - Task with no resolvable user story.
  - Task with no resolvable component.
  - Task with dependencies pointing at packets in the same pass.
- **Unit — coherence verifier.** Each of P1–P7, C1–C4, and A1–A3 has at least one pass case and one fail case. Annotations (`ai_proposed_root_count`) tested independently.
- **Unit — upstream-id indexer.** Walks a fixture DB and emits the expected `allUpstreamIds` / `aiProposedIds` sets.
- **Unit — Phase 9 packet entry point.** Asserts that a packet with `coherence.passed === false` is refused.
- **Integration — auto mode.** Fixture run where 1 of 3 packets fails P3; auto mode routes to cycle_controller with the orphan AC as the deferred-frontier seed; cycle 2 produces the missing test case; cycle 2's packet_synthesis passes; Phase 9 runs.
- **Integration — interactive mode.** Same fixture; interactive mode blocks at packet_coherence_mirror; mocked operator selects `defer`; coherent packets advance, failed packet becomes backlog seed.
- **Integration — Phase 9 executor consumes packet.** Mocked executor receives a packet, asserts that the rendered prompt contains every required section, asserts no missing-context invocations.
- **Regression — ts-16-style failure.** Fixture replays ts-16's upstream artifacts; assert that the packet_synthesizer correctly identifies the same orphan stories the trace report identified manually.

---

## 10. Implementation roadmap

Each step is independently testable and shippable. Steps 1–3 don't yet activate the new control flow; activation happens at step 4.

1. **Data model + record-type registration.** `ImplementationPacketContent` interface, governed-stream record type, workflow_runs columns. No behavior change.
2. **Upstream-id indexer + packet builder.** Pure functions, fixture-tested in isolation. Not yet wired.
3. **Coherence verifier.** Pure function with full assertion suite, fixture-tested. Not yet wired.
4. **`packet_synthesis` sub-phase handler — auto mode.** Wire steps 1–3 into the orchestrator. Default routing: ALWAYS write packets, but if coherence fails, route to cycle_controller (auto mode only). Phase 9 still reads bare tasks for now; packets are written but unused.
5. **Phase 9 reads packets.** Phase 9's task entry switches to `implementation_packet`. Executor prompt rewrite (§6). The bare-task path is removed.
6. **Interactive mode + mirror UI.** `packet_coherence_mirror` shape, Svelte component, operator routing. Defaulting to interactive in non-`--auto-approve` runs.
7. **Telemetry + harness output.** Status line updates, trace-report integration (next thin-slice trace report includes a packet-coherence section).
8. **Calibration validation.** Run ts-17+ thin slice against the new pipeline; verify the trace report's orphan counts collapse and Phase 9 produces code that respects ACs.

---

## 11. Locked design decisions (for traceability)

These were resolved during the design discussion on 2026-05-19:

- **Q1 — Level of intervention:** A new record type (`implementation_packet`) and a dedicated sub-phase (`packet_synthesis`) between Phase 8 and Phase 9. Not three independent gates; one architectural change that the three earlier-proposed gates dissolve into.
- **Q2 — Where the synthesis lives:** Dedicated sub-phase, not a pre-flight inside the executor or a wrapper around Phase 6. The packet is a first-class governed-stream record.
- **Q3 — Failure routing:** Both modes implemented. Auto-decompose-further is the default for `--auto-approve` runs (calibration / thin-slice); block-and-mirror is the default for human-interactive (CLI/UI) runs. The harness flag determines mode; `--packet-coherence-mode={auto|interactive}` overrides.
- **Q4 — Trust-root for "no invented references":** Option (c) — accept any upstream id as valid (permissive); separately annotate each packet with an `ai_proposed_root_count` showing how many of its references resolve to Phase 1 items marked `source: 'ai-proposed'`. Phase 1 over-invention is a separate concern at a separate gate (bloom prompts + auto-approve `recommended: true` semantics), not the packet verifier's job.

Additional locked decisions:

- **Greenfield, no backwards compatibility.** JanumiCode v2 is not deployed; the bare-task Phase 9 path is removed in step 5 with no migration shim.
- **Self-contained packets (I2):** the packet contains COPIES of upstream artifacts, not just id references. Executor isolation matters more than storage compactness.
- **Release-major iteration honored** from the iterative-implementation-backlog locked design — packet_synthesis is per-release; per-cycle delta packet sets are written each cycle.
- **Cross-link with iterative-implementation-backlog design:** packet_synthesis failures in auto mode route directly into the cycle_controller's deferred-frontier seeding mechanism. The two designs compose cleanly.
