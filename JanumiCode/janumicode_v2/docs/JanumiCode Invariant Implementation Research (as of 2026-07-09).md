Let me check a few more things before generating the final report — specifically the phase gate evaluator's invariant check provider and the DMR active constraints flow.
Now let me find where the gate providers are actually constructed — who calls `checkInvariantChecks` and what does it do?
















Now let me check the DMR active constraints flow — how constitutional invariants become `active_constraints` in the context packet.


Now let me check the [executionContextBuilder.ts](cci:7://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionContextBuilder.ts:0:0-0:0) lines around 917-930 to see the full picture of how DMR active constraints are (or aren't) passed to the executor.





Now I have all the pieces. Let me also check the `governingClassification.ts` to see how constitutional invariants are classified.

---

# Invariant Handling Report — JanumiCode v2

## Executive Summary

JanumiCode v2 has **three distinct invariant mechanisms**, each at a different stage of implementation maturity. The system has **architectural scaffolding for deterministic invariant checking** (the `InvariantChecker` class and `invariant_check_record`/`invariant_violation_record` types), **active seeding of constitutional invariants** into the governed stream, and **deliberate exclusion of constitutional invariants from executor prompts** in Phase 9. The `InvariantChecker` is instantiated but **never actually called** in the current workflow — its `.check()` method has zero call sites outside unit tests.

---

## 1. Constitutional Invariants (`constitutional_invariant`)

### 1.1 Seeding

Constitutional invariants are **hardcoded** in `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\constitutionalInvariants.ts:20-31`:

```typescript
export const CONSTITUTIONAL_INVARIANTS: readonly InvariantSeed[] = [
  { id: 'CI-1',  statement: '100% correctness and completeness — always. All three layers of correctness (Section 1.6) are required.' },
  { id: 'CI-2',  statement: 'Every phase is mandatory and executed in order. The Orchestrator cannot skip phases.' },
  // ... CI-3 through CI-10
];
```

There are **10 constitutional invariants** (CI-1 through CI-10), covering process governance rules like "every phase is mandatory," "every Phase Gate requires human approval," "agents never exercise judgment," "the Governed Stream is lossless," etc.

### 1.2 Seeding Mechanism

The `seedConstitutionalInvariants` function (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\constitutionalInvariants.ts:40-84`) is called from **Phase 0** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\phase0.ts:83-88`):

- **Idempotent**: checks if any `constitutional_invariant` records already exist in the workspace; if so, returns `[]` (no-op)
- Writes one `constitutional_invariant` record per invariant to the `governed_stream` with `authority_level: 7`, `phase_id: '0'`, `sub_phase_id: 'workspace_classification'`
- The `GovernedStreamWriter` also enforces authority level 7 for this record type (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\governedStreamWriter.ts:633-634`)
- The `effectiveAuthority` module (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\effectiveAuthority.ts:61`) hard-elevates `constitutional_invariant` to authority 7

### 1.3 Database Verification (cal-41, resume-1783549170738)

**Database queried directly.** The `governed_stream` table contains **10 `constitutional_invariant` records**, all seeded at `2026-07-06T23:04:54.427Z`–`437Z` (Phase 0), all with `authority_level=7`, `phase_id='0'`:

| Record ID | CI | Statement (truncated) |
|---|---|---|
| `cb4611ea-...` | CI-1 | 100% correctness and completeness — always... |
| `548cc69b-...` | CI-2 | Every phase is mandatory and executed in order... |
| `0baee706-...` | CI-3 | Every Phase Gate requires human approval... |
| `75f8dfe2-...` | CI-4 | Every human interaction is recorded in the Governed Stream... |
| `0cb17882-...` | CI-5 | Agents never exercise judgment... |
| `db5c2660-...` | CI-6 | The Governed Stream is single-threaded... |
| `7fa0af9a-...` | CI-7 | All Artifacts are owned by JanumiCode... |
| `3e4e1787-...` | CI-8 | Prompt Templates use namespace prefixing... |
| `011156b9-...` | CI-9 | No governing constraint may be truncated silently... |
| `7fe68802-...` | CI-10 | The Governed Stream is lossless... |

This confirms the seeding mechanism is **active and working** in production runs.

---

## 2. Deterministic Invariant Checker (`InvariantChecker`)

### 2.1 Implementation

The `InvariantChecker` class (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\invariantChecker.ts:72-401`) is a **deterministic, non-LLM validator** based on JanumiCode Spec v2.3, §8.10. It:

- Loads rules from `.invariants.json` files at startup
- Supports 5 check types: `field_presence`, `field_pattern`, `forbidden_pattern`, `count_minimum`, `cross_field`
- Returns `InvariantCheckResult` containing `InvariantViolation[]`
- Is described as running "BEFORE Reasoning Review for every artifact"

### 2.2 Rule Files (7 total)

Found at `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\schemas\invariants\`:

| File | Rules | Phase | Example |
|---|---|---|---|
| `component_model.invariants.json` | CM-001, CM-002 | 4 | No conjunctions in responsibility statements; every component has ≥1 responsibility |
| [architectural_decisions.invariants.json](cci:7://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/schemas/invariants/architectural_decisions.invariants.json:0:0-0:0) | ADR-001, ADR-002 | 4 | Every ADR has decision + rationale |
| `functional_requirements.invariants.json` | FR-001, FR-002 | 2 | Every user story has ≥1 acceptance criterion with measurable condition |
| [interface_contracts.invariants.json](cci:7://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/schemas/invariants/interface_contracts.invariants.json:0:0-0:0) | IC-001 | 3 | Every interface contract has ≥1 error response |
| [data_models.invariants.json](cci:7://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/schemas/invariants/data_models.invariants.json:0:0-0:0) | DM-001 | 5 | No entity field without a type |
| [api_definitions.invariants.json](cci:7://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/schemas/invariants/api_definitions.invariants.json:0:0-0:0) | API-001 | 5 | Every endpoint has auth requirement |
| `implementation_plan.invariants.json` | IP-001, IP-002 | 6 | Every task has ≥1 completion criterion; every task has component_responsibility |

### 2.3 Initialization

In `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\orchestratorEngine.ts:340-342`:
```typescript
this.invariantChecker = new InvariantChecker(
  `${extensionPath}/schemas/invariants`,
);
```

### 2.4 CRITICAL FINDING: Never Called in Production

**The `InvariantChecker.check()` method is never invoked anywhere in the production codebase.** A search for `.invariantChecker.` across all `src/` files returns only the constructor call. The `invariantChecker` is a `readonly` property on `OrchestratorEngine` but no phase handler, review harness, or gate evaluator ever calls it.

This means:
- The 7 invariant rule files are loaded into memory but **never used**
- The `InvariantCheckResult` / `InvariantViolation` objects are **never produced at runtime**
- The `invariant_check_record` and `invariant_violation_record` governed stream record types are **defined but never written**

### 2.5 Phase Gate Evaluator: Scaffolded But Unwired

The [PhaseGateEvaluator](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/phaseGateEvaluator.ts:68:0-169:1) (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phaseGateEvaluator.ts:113-116`) has invariant checks as **criterion #2** in its evaluation order:

```
1. Schema validation (deterministic)
2. Invariant checks (deterministic)  ← HERE
3. Reasoning Review results (cached)
4. Consistency report
5. Domain attestation
6. Verification Ensemble
7. Human approval
```

However, the `checkInvariantChecks` provider is a **callback interface** ([GateCriterionProviders](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/phaseGateEvaluator.ts:49:0-64:1)). A search for where [PhaseGateEvaluator.evaluate()](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/phaseGateEvaluator.ts:69:2-153:3) is called in production code found **zero call sites** — the evaluator is instantiated (`@/orchestratorEngine.ts:350`) but never invoked. The phase handlers write `phase_gate_evaluation` records directly without going through the evaluator.

### 2.6 Hardcoded Invariant Logic in Phase Handlers

Despite the `InvariantChecker` being unused, **some invariant logic is hardcoded directly in phase handlers** as ad-hoc validation:

- **Phase 3** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\phase3.ts:572-609`): Checks "every FR/NFR maps to ≥1 system requirement," "every external system has ≥1 interface contract," "every interface contract has ≥1 error response" — these duplicate IC-001 from the invariant rules
- **Phase 4** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\phase4.ts:1245-1279`): Checks "every component has ≥1 responsibility" (CM-002) and "no conjunction in responsibility statements" (CM-001) — these duplicate the component_model invariant rules
- **Phase 6** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\phase6.ts:1598-1603`): References "Invariant IP-001" in comments but implements the check inline

These are **not using the `InvariantChecker`** — they are bespoke validation logic embedded in each phase's consistency check.

---

## 3. `invariant_check_record` and `invariant_violation_record` Record Types

### 3.1 Definition

Both types are defined in the [RecordType](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/types/records.ts:235:0-380:27) union at `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\types\records.ts:247-248`:

```typescript
| 'invariant_check_record'
| 'invariant_violation_record'
```

### 3.2 Usage Analysis

- **`invariant_check_record`**: **Zero references** anywhere in the codebase outside the type definition. Never written, never read, never queried.
- **`invariant_violation_record`**: Referenced in exactly **one test** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\test\unit\orchestrator\phases.test.ts:112`) which queries for them and expects 0 results. Never written in production code.

**Database Verification**: Queried `governed_stream` for both record types:
- `invariant_check_record`: **0 records** — confirmed never generated
- `invariant_violation_record`: **0 records** — confirmed never generated

**Conclusion**: These record types are **reserved placeholders** in the schema. They are defined for future use but are **not generated** in the current workflow. No code writes them; no code reads them. The database confirms zero instances in a full Phase 0–9 run.

---

## 4. Invariant Flow to Phase 9 Executor Prompts

### 4.1 Constitutional Invariants: Deliberately Excluded

Constitutional invariants are **explicitly excluded** from executor DMR (Deep Memory Research) packets. In `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\agents\deepMemoryResearch.ts:114-116`:

```typescript
const EXECUTOR_IRRELEVANT_RECORD_TYPES = new Set<string>([
  'constitutional_invariant',
]);
```

At `@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\agents\deepMemoryResearch.ts:390-392`, when the requesting agent is `executor_agent`, these record types are filtered out:

```typescript
if (brief.requestingAgentRole === 'executor_agent') {
  candidates = candidates.filter(c => !EXECUTOR_IRRELEVANT_RECORD_TYPES.has(c.recordType));
```

The comment at lines 105-112 explains the rationale: constitutional invariants describe **how JanumiCode runs** (process governance), not **what to build**. They would dominate the authority-weighted materiality score (authority 7) while being irrelevant to code generation.

### 4.2 DMR Active Constraints Flow (Non-Constitutional)

For non-constitutional governing constraints, the flow is:

1. **DMR fetch** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionScheduler.ts:997-1004`): [fetchDmrPacketForTask](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionScheduler.ts:1427:2-1497:3) calls `buildPhaseContextPacket` which retrieves authority ≥6 records as `activeConstraints`
2. **Task artifact seeding** (lines 1445-1451): The task's upstream technical artifacts (component_model, data_models, etc.) are seeded as "known relevant" to ensure they outrank any governance records
3. **Active constraints text** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\dmrContext.ts:116-120`): Constraints are formatted as "BINDING (apply without exception)" vs "CERTIFIED CONTEXT" based on [classifyGoverningKind](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/agents/governingClassification.ts:63:0-70:1)
4. **ExecutionContextBuilder** (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionContextBuilder.ts:917-928`): The DMR's `activeConstraintsText` is **not directly injected** into the executor prompt. Instead, the builder resolves `task.active_constraints` (TECH-* IDs) and points the executor to the Implementation Packet's "Technical Constraints" section

### 4.3 Implementation Packet: The Actual Constraint Channel

The **Implementation Packet** (`implementation_packet` record type) is the primary vehicle for delivering constraints to the executor. It's synthesized in Phase 9.0's `packet_synthesis` sub-phase and contains:

- `active_constraints: PacketActiveConstraint[]` — resolved TECH-* constraints with full text, category, technology, rationale
- `compliance_items: PacketComplianceItem[]` — compliance/V&V/quality items

These are rendered by [formatPacketAsExecutorContext](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/phases/packetSynthesis/packetContextFormatter.ts:17:0-260:1) (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\phases\packetSynthesis\packetContextFormatter.ts:192-212`) into a "## Technical Constraints (apply without exception)" section that is prepended to the executor's stdin.

### 4.4 Invariant Violations in Retry Context

The [ExecutionContextBuilder.buildTaskContext](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionContextBuilder.ts:773:2-1041:3) method accepts a `retryContext` parameter (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionContextBuilder.ts:789-792`):

```typescript
retryContext?: {
  invariantViolations?: string;
  reasoningReviewFindings?: string;
},
```

These are passed to the base `ContextBuilder` (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\contextBuilder.ts:161-164`):

```typescript
if (content.invariantViolations) {
  sections.push(
    '[JC:INVARIANT VIOLATION]\n' + content.invariantViolations,
  );
}
```

**However**, the `retryContext` parameter is **always passed as `undefined`** by the [ExecutionScheduler](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionScheduler.ts:177:0-1524:1) (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionScheduler.ts:1040-1049`):

```typescript
let stdinText = this.executionContextBuilder.buildTaskContext(
  leaf as unknown as CtxTask,
  workflowRunId,
  contextFileId,
  this.artifacts,
  undefined,  // ← retryContext is always undefined
  dmrPacket,
  layoutScaffold,
  packet,
).stdin.text;
```

Instead, retry context is handled separately via `augmentedContext` (line 1125-1126):

```typescript
if (augmentedContext) {
  stdinText = `${stdinText}\n\n## RETRY CONTEXT\n\n${augmentedContext}`;
}
```

The [buildRetryContext](cci:1://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionScheduler.ts:1780:0-1803:1) function (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionScheduler.ts:1781-1804`) builds retry context from reasoning review flaws and test failures — **but never from invariant violations**, since the `InvariantChecker` is never called and no `invariant_violation_record` records exist.

**Database Verification**: Queried Phase 9 `agent_invocation` records for `RETRY CONTEXT`:
- **31 records** contain `RETRY CONTEXT` — all from retry attempts after `execution_failed` errors (e.g., "mimo serve exited early")
- **0 records** contain `INVARIANT VIOLATION` — the `[JC:INVARIANT VIOLATION]` stdin section is never used
- Retry context strings contain error messages and prior attempt summaries, never invariant violation descriptions

### 4.5 Mirror Generator: Prior Invariant Violations

The `MirrorGenerator` (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\mirrorGenerator.ts:87-91`) has support for displaying "PRIOR INVARIANT VIOLATION — resolved in this version" in mirror fields. However, `priorInvariantViolations` is an optional input field that is never populated in the current codebase.

### 4.6 Engineering Constitution (Not Invariants)

The executor prompt also includes an "Engineering Constitution" section (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\src\lib\orchestrator\executionScheduler.ts:1086-1122`) — a 5-bullet craft standard (commenting, observability, testing). This is **not related to invariants** — it's a craft/conformance standard verified at Phase 10.

### 4.7 Executor Prompt Template

The Phase 9 executor prompt template (`@/e:\Projects\hestami-ai\JanumiCode\janumicode_v2\prompts\phases\phase_09_execution\implementation_task_execution\implementation_task_execution.system.md`) has a `# GOVERNING CONSTRAINTS (apply without exception)` section with `{{active_constraints}}` as a variable. The variable is populated by the [ExecutionContextBuilder](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionContextBuilder.ts:752:0-1229:1) with task-specific TECH-* constraint references, not constitutional invariants.

The word "invariant" appears in the template only in the context of **property-based testing** (line 68): "A test case marked **PROPERTY** (it carries an invariant + an input domain...)" — this refers to test invariants, not governance invariants.

### 4.8 Database Verification: Executor Prompt Content (cal-41)

Queried 683 Phase 9 `agent_invocation` records in the test-harness database:

| Search Term | Count | Context |
|---|---|---|
| `Implementation Packet Context` | **80** | Present in actual executor (9.1) prompts — the packet context block is prepended to executor stdin |
| `Technical Constraints` | **165** | Present in executor prompts as "## Technical Constraints (apply without exception)" with TECH-* constraint listings |
| `GOVERNING CONSTRAINTS` | **592** | The standard governing constraints section header — present in most Phase 9 agent invocations |
| `Engineering Constitution` | Present | The 5-bullet craft standard is appended to executor prompts |
| `invariant` | **80** | **All 80 occurrences are in the property-based testing section** — "it carries an invariant + an input domain" / "assert invariant" / "prop_assert!(<invariant>)". **Zero occurrences relate to governance invariants.** |
| `constitutional` | **0** | **Confirmed: constitutional invariants never appear in Phase 9 executor prompts** |
| `INVARIANT VIOLATION` | **0** | The `[JC:INVARIANT VIOLATION]` stdin section is never used |
| `RETRY CONTEXT` | **31** | Present in retry attempts, but content is error messages (e.g., "mimo serve exited early"), never invariant violations |

**Sample executor prompt** (ID `88b5020c-...`, sub_phase `9.1`, 25,643 chars stdin):
- Contains `# Implementation Packet Context` with component contract, data models, API endpoints, technical constraints, and test cases
- Contains `# GOVERNING CONSTRAINTS (apply without exception)` with `## Active Constraints` referencing TECH-NODEJS-1, TECH-BETTERAUTH-1, TECH-CERBOS-1, TECH-ORPC-1
- Contains `## Technical Constraints (apply without exception)` with full text of each TECH-* constraint
- Contains `## Property-based test cases` section mentioning "invariant" in the context of property-based testing
- Contains `## Engineering Constitution (required craft standard — verified at Phase 10)` with 5-bullet craft directive
- **Does NOT contain** `constitutional`, `INVARIANT VIOLATION`, or any governance invariant reference

### 4.9 Database Verification: DMR Packets in Phase 9

Queried 18 Phase 9 `dmr_pipeline` records:
- **All 18 have `active_constraints: []`** (empty array) — the DMR is not surfacing any authority ≥6 constraints for executor tasks
- **0 DMR packets contain `constitutional`** in their content — the `EXECUTOR_IRRELEVANT_RECORD_TYPES` filter is working correctly
- The DMR `context_packet` records (18 total) also all have `active_constraints: []`

This confirms the DMR filter is functioning: constitutional invariants are excluded from executor DMR packets, and no other authority ≥6 constraints are being surfaced through DMR for Phase 9 tasks. The actual binding constraints reach the executor exclusively through the **Implementation Packet** channel, not through DMR active constraints.

---

## 5. Summary: Invariant Lifecycle Status

| Mechanism | Status | Records Generated? | Reaches Executor? |
|---|---|---|---|
| **Constitutional Invariants** (CI-1 through CI-10) | ✅ Active | `constitutional_invariant` records written in Phase 0 | ❌ Deliberately excluded from executor DMR |
| **Deterministic InvariantChecker** | ⚠️ Scaffolded, unused | `invariant_check_record` / `invariant_violation_record` never written | ❌ Never called, no violations to pass |
| **Phase Gate invariant_checks criterion** | ⚠️ Scaffolded, unwired | No — evaluator never invoked | N/A |
| **Hardcoded invariant checks in phases** | ✅ Active (bespoke) | No governed stream records | Findings surface as warnings in consistency reports |
| **Implementation Packet active_constraints** | ✅ Active | **618 `implementation_packet` records** in cal-41 DB, each with `active_constraints` (1–20 TECH-* items) | ✅ Yes — "Technical Constraints (apply without exception)" in executor stdin (verified in 80 prompts) |
| **Retry context invariantViolations** | ⚠️ Scaffolded, unused | No — `retryContext` always `undefined` | ❌ Channel exists but never populated |
| **Mirror priorInvariantViolations** | ⚠️ Scaffolded, unused | No — field never populated | N/A |

### Key Takeaways

1. **`invariant_check_record` and `invariant_violation_record` are never generated.** They are reserved types in the schema with zero write sites in production code. **Database confirms: 0 records of either type in cal-41 (full Phase 0–9 run).**

2. **The `InvariantChecker` is dead code in production.** It's instantiated on `OrchestratorEngine` but its `.check()` method is never called. The 7 rule files are loaded but unused. Some invariant logic exists but is hardcoded directly in phase handlers.

3. **Constitutional invariants are seeded but deliberately excluded from executor prompts.** The DMR explicitly filters them out for `executor_agent` requests because they describe JanumiCode's operating model, not what to build. **Database confirms: 10 `constitutional_invariant` records seeded in Phase 0; 0 Phase 9 executor prompts contain "constitutional"; all 18 Phase 9 DMR packets have empty `active_constraints` and zero contain "constitutional".**

4. **The actual binding constraints that reach the executor** are TECH-* technical constraints delivered via the Implementation Packet's `active_constraints` field, rendered as "Technical Constraints (apply without exception)" in the executor's stdin. **Database confirms: 618 `implementation_packet` records with populated `active_constraints`; 80 executor prompts contain "Implementation Packet Context"; 165 contain "Technical Constraints".**

5. **The invariant violation retry channel exists but is disconnected.** The `ContextBuilder` can inject `[JC:INVARIANT VIOLATION]` sections into stdin, and [ExecutionContextBuilder](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionContextBuilder.ts:752:0-1229:1) accepts `retryContext.invariantViolations`, but the [ExecutionScheduler](cci:2://file:///e:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/executionScheduler.ts:177:0-1524:1) always passes `undefined` and builds retry context from reasoning review flaws and test failures instead. **Database confirms: 31 Phase 9 prompts contain "RETRY CONTEXT" (all error messages), 0 contain "INVARIANT VIOLATION".**

6. **The word "invariant" appears in 80 Phase 9 executor prompts**, but exclusively in the **property-based testing** section ("it carries an invariant + an input domain") — this refers to test invariants, not governance invariants. **Zero governance invariant content reaches the executor.**