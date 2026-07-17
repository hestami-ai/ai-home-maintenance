# **Source Code Commenting Best Practices for AI Coding Agents**

## **Primary Principle**

Write comments for **future maintainers and future AI agents**, not to restate what the code already says.

Good comments explain:

* **Why** this exists  
* **Why this approach was chosen**  
* **What constraints shaped the implementation**  
* **What must not be changed casually**  
* **What external contract, user story, acceptance criterion, or historical decision this code satisfies**

Bad comments merely narrate obvious code behavior.

---

## **1\. Prefer Self-Documenting Code First**

Before adding a comment, improve the code itself:

* Use clear names.  
* Extract meaningful functions.  
* Use explicit types.  
* Represent state clearly.  
* Avoid cleverness unless necessary.  
* Make illegal states hard or impossible to represent.

Do not use comments to compensate for confusing code unless the complexity is unavoidable.

---

## **2\. Comment the “Why,” Not the “What”**

Avoid comments like:

// Loop through users  
for (const user of users) { ... }

Prefer comments like:

// We preserve the original ordering because downstream reconciliation expects  
// user-facing results to match the order returned by the vendor API.

The source code usually explains **what** happens. Comments should explain **why it must happen that way**.

---

## **3\. Include Business Context When It Affects Design**

It is acceptable to reference user stories, tasks, or acceptance criteria when they explain a non-obvious design decision.

Use this when the code encodes product intent, compliance logic, workflow semantics, or a user-visible guarantee.

Example:

// Supports US-142 AC-3: homeowners must see only contractors licensed  
// for the selected jurisdiction. Do not broaden this query without updating  
// the authorization and licensing rules.

Do not paste entire user stories or acceptance criteria into source files. Reference the smallest useful fragment.

---

## **4\. Use Structured Context Comments for Important Decisions**

For non-obvious or high-risk code, use a compact structured comment:

// Context:  
// \- Requirement: US-142 AC-3 requires jurisdiction-specific contractor filtering.  
// \- Reason: Licensing validity differs by state/county.  
// \- Constraint: Vendor records may have missing or stale license metadata.  
// \- Do not change: Do not fallback to "unverified" contractors unless the  
//   caller explicitly opts into unverified search results.

Use this sparingly, near the code where the decision matters.

---

## **5\. Document External Contracts at Boundaries**

Always comment when code depends on behavior outside the local source file:

* APIs  
* databases  
* queues  
* LLM outputs  
* browser automation  
* file formats  
* third-party services  
* authentication/session behavior  
* workflow engine semantics

Example:

// Boundary contract:  
// The LLM may omit fields or return null, empty strings, or unexpected casing.  
// Normalize before validation; never treat missing values as negative intent.

---

## **6\. Mark Invariants Explicitly**

Use comments to document conditions that must remain true.

Example:

// Invariant:  
// A WorkOrder can only enter SCHEDULED after providerId, scheduledWindow,  
// and homeownerConfirmation are all present. This prevents downstream  
// dispatch workflows from inferring readiness from partial state.

This is especially important for state machines, workflows, authorization, payments, retries, and agent orchestration.

---

## **7\. Explain Non-Obvious Error Handling**

Comment why errors are handled, retried, downgraded, escalated, or intentionally allowed to fail.

Example:

// We retry only idempotent provider lookups. Creating a bid request is not  
// retried here because the vendor API may create duplicate external records.

---

## **8\. Explain Observability Decisions**

When adding logs, traces, metrics, or spans, explain the diagnostic purpose if it is not obvious.

Example:

// Trace this decision boundary because shallow agent audits often appear  
// successful unless we capture the evaluated criteria and rejected options.

Comments should help future agents understand what signals are needed to debug the system.

---

## **9\. Do Not Leave Ambiguous TODOs**

Avoid:

// TODO: fix this later

Prefer:

// TODO(JANUMI-231):  
// Replace this temporary county lookup with the normalized jurisdiction table.  
// Current limitation: Fairfax and Loudoun are handled, but Maryland counties  
// are not yet canonicalized.

Every TODO should include:

* Owner or ticket/reference  
* Reason  
* Risk or limitation  
* Expected resolution

---

## **10\. Use Warning Comments Carefully**

Use strong warnings only for real hazards.

Example:

// WARNING:  
// Do not remove this deduplication step. Provider search can return the same  
// business from Google, Yelp, and BBB. Without canonicalization, the contact  
// agent may message the same vendor multiple times.

Avoid excessive warning comments; they lose force if everything is marked dangerous.

---

## **11\. Avoid Comment Drift**

When modifying code, update nearby comments in the same change.

A stale comment is worse than no comment because future AI agents may treat it as authoritative.

Before completing a task, verify:

* Comments still match behavior.  
* Referenced acceptance criteria are still valid.  
* Warnings still apply.  
* TODOs are still accurate.  
* No obsolete rationale remains.

---

## **12\. Do Not Encode Secrets or Sensitive Details**

Never place these in comments:

* API keys  
* credentials  
* tokens  
* private customer data  
* personal information  
* internal-only URLs unless approved  
* security bypass instructions

Use comments to describe the contract, not expose sensitive implementation material.

---

## **13\. Recommended Comment Types**

Use these categories consistently:

### **Intent Comment**

Explains why the code exists.

// Intent: prevent homeowners from seeing contractors that failed jurisdiction validation.

### **Context Comment**

Explains historical, product, or domain background.

// Context: Some county licensing records lag state records by several days,  
 // so we treat state verification as authoritative when county data is missing.

### **Boundary Comment**

Explains assumptions about external input/output.

// Boundary: This endpoint receives model-generated JSON. Validate strictly  
// before converting it into workflow state.

### **Invariant Comment**

Explains what must always remain true.

// Invariant: A bid cannot be accepted after the request has expired.

### **Tradeoff Comment**

Explains why one approach was chosen over another.

// Tradeoff: We use synchronous validation here instead of queueing because  
// the homeowner must receive immediate feedback before submitting the request.

### **Warning Comment**

Explains dangerous or fragile behavior.

// WARNING: Changing this retry policy may duplicate outbound vendor messages.

---

## **14\. Comment Placement Rules**

Place comments as close as possible to the code they explain.

Use:

* Function-level comments for behavior, contracts, and invariants.  
* Inline comments for unusual local decisions.  
* Module-level comments for architectural context.  
* File-level comments only when the whole file has a special role.

Avoid large comment blocks at the top of files unless they explain durable architecture.

---

## **15\. AI-Agent-Specific Guidance**

When generating or editing code, the AI agent must:

1. Preserve existing meaningful comments unless they are wrong.  
2. Delete or update stale comments.  
3. Add comments where future agents may misunderstand intent.  
4. Reference user stories or acceptance criteria only when they explain design.  
5. Avoid over-commenting obvious code.  
6. Treat comments as part of the implementation contract.  
7. Never invent business rationale. If rationale is inferred, say so explicitly.

Example:

// Inferred rationale:  
// The explicit null check appears to distinguish "not provided" from "provided  
// but empty." Preserve this distinction unless the product requirement changes.

---

## **16\. Final Review Checklist**

Before finishing a code change, verify:

* Does the code explain itself where possible?  
* Are comments focused on why, constraints, invariants, and contracts?  
* Are user story or acceptance criteria references minimal and useful?  
* Are comments close to the relevant code?  
* Are stale comments removed?  
* Are TODOs actionable?  
* Are boundary assumptions documented?  
* Are dangerous changes clearly warned about?  
* Would a future AI coding agent understand the intent without reading the entire task history?

---

## **Commenting Standard**

Use comments to preserve **decision context** that is not reliably recoverable from code alone.

The goal is not more comments.

The goal is fewer surprises.

\================

# **Debugging and Observability Best Practices for AI Coding Agents**

## **Primary Principle**

Build code so future humans and AI agents can answer:

1. What happened?  
2. Where did it happen?  
3. Why did it happen?  
4. What input, state, dependency, or decision caused it?  
5. Is this a one-off failure or a systemic pattern?

Observability is not just logging. It is the ability to reconstruct system behavior from emitted evidence.

---

## **1\. Instrument Boundaries First**

Add observability at every boundary where information changes trust level or ownership:

* User input  
* API request/response  
* Database read/write  
* Queue publish/consume  
* Workflow transition  
* LLM/tool call  
* File parse/import/export  
* Auth/session check  
* Third-party service call

At each boundary capture:

* Correlation/request ID  
* Input shape, not sensitive raw payloads  
* Validation result  
* External system name  
* Latency  
* Outcome  
* Error classification

---

## **2\. Trace Decisions, Not Just Failures**

For code that branches on business rules, agent reasoning, workflow state, ranking, eligibility, permissions, or retries, emit structured decision traces.

Example:

logger.info("contractor.filtered", {  
  contractorId,  
  reason: "license\_jurisdiction\_mismatch",  
  requiredJurisdiction,  
  observedJurisdiction,  
  story: "US-142",  
  acceptanceCriterion: "AC-3"  
});

Future AI agents need to know not only that a result was excluded, but why.

---

## **3\. Use Structured Logs**

Prefer structured logs over prose strings.

Good:

logger.warn("bid\_request.retry\_skipped", {  
  reason: "non\_idempotent\_operation",  
  providerId,  
  workOrderId,  
  attempt  
});

Bad:

logger.warn("Skipping retry because this might duplicate stuff");

Structured logs allow search, aggregation, replay analysis, and agent-assisted debugging.

---

## **4\. Propagate Correlation IDs Everywhere**

Every request, workflow, background job, queue message, LLM call, and outbound API call should carry a correlation ID.

Minimum IDs:

* `requestId`  
* `traceId`  
* `userId` or safe subject reference  
* `workflowId`  
* `taskId`  
* `externalRequestId` where applicable

Never create isolated logs that cannot be tied back to a user action or workflow.

---

## **5\. Make Errors Typed and Classified**

Do not throw or log generic errors without classification.

Use categories such as:

* `VALIDATION_ERROR`  
* `AUTHORIZATION_ERROR`  
* `EXTERNAL_SERVICE_TIMEOUT`  
* `EXTERNAL_SERVICE_BAD_RESPONSE`  
* `STATE_TRANSITION_DENIED`  
* `IDEMPOTENCY_CONFLICT`  
* `MODEL_OUTPUT_INVALID`  
* `RETRY_EXHAUSTED`  
* `INVARIANT_VIOLATION`

Each error should include:

* Stable error code  
* Human-readable message  
* Machine-readable metadata  
* Safe remediation hint where useful

---

## **6\. Preserve Failure Evidence**

When something fails, capture enough safe evidence to diagnose it later.

Include:

* Input schema/version  
* Redacted input summary  
* State before failure  
* Expected state  
* Actual state  
* Dependency called  
* Retry count  
* Timeout value  
* Validation errors  
* Decision path

Do not log secrets, tokens, credentials, raw PII, or sensitive customer content.

---

## **7\. Add Observability Around LLM and Agent Calls**

For every model/tool/agent call, capture:

* Agent role  
* Prompt/template version  
* Model name  
* Tool name  
* Input schema version  
* Output schema version  
* Validation result  
* Retry count  
* Token usage if available  
* Latency  
* Finish reason  
* Confidence/uncertainty signal if available  
* Guardrail result  
* Final accepted/rejected status

Do not log full prompts or outputs by default if they may contain sensitive information. Store redacted summaries or controlled debug artifacts.

---

## **8\. Validate and Log State Transitions**

State machines and workflows must log every transition.

Example:

logger.info("work\_order.transition", {  
  workOrderId,  
  fromState: "BID\_REVIEW",  
  toState: "SCHEDULED",  
  actorType: "homeowner",  
  guardPassed: true,  
  requiredFieldsPresent: \[  
    "providerId",  
    "scheduledWindow",  
    "homeownerConfirmation"  
  \]  
});

Rejected transitions should also be observable.

---

## **9\. Instrument Retries, Idempotency, and Deduplication**

Whenever code retries, suppresses duplicates, or uses idempotency keys, log the reason.

Capture:

* Idempotency key  
* Attempt number  
* Retry policy  
* Backoff duration  
* Whether operation is safe to retry  
* Deduplication match reason  
* Final outcome

This prevents future agents from accidentally introducing duplicate external actions.

---

## **10\. Metrics Should Track System Health and Product Semantics**

Add metrics for both technical and domain behavior.

Technical metrics:

* Request latency  
* Error rate  
* Queue depth  
* Retry rate  
* Timeout rate  
* Dependency latency  
* Database query duration

Product/workflow metrics:

* Intake clarification rate  
* Contractor search empty-result rate  
* Bid request acceptance rate  
* Vendor decline rate  
* LLM output validation failure rate  
* Manual escalation rate  
* Workflow abandonment rate

Good observability shows whether the system is technically working and whether the product behavior is healthy.

---

## **11\. Make Debugging Reproducible**

When practical, create debug artifacts that allow replay or reconstruction.

Useful artifacts:

* Sanitized request fixture  
* Normalized input object  
* Workflow event history  
* Model output validation report  
* External response summary  
* State transition log  
* Test case generated from failure

Every significant production bug should become a regression test or replay fixture when feasible.

---

## **12\. Use Log Levels Consistently**

Recommended standard:

* `debug`: high-detail diagnostics, disabled or sampled in production  
* `info`: meaningful business or system events  
* `warn`: unexpected but recoverable condition  
* `error`: failed operation requiring attention  
* `fatal`: process or system cannot continue safely

Do not log normal control flow as warnings or errors.

---

## **13\. Add Health Checks and Readiness Checks**

Services should expose:

* Liveness: process is running  
* Readiness: service can safely receive traffic  
* Dependency health: database, queue, cache, workflow engine, model server  
* Degraded mode: service is alive but missing noncritical dependencies

Health checks should be machine-readable and safe to expose only to authorized infrastructure.

---

## **14\. Fail Loudly on Invariants**

If an invariant is violated, emit a high-severity event and stop the unsafe operation.

Example:

logger.error("invariant.violation", {  
  invariant: "scheduled\_work\_order\_requires\_confirmed\_provider",  
  workOrderId,  
  currentState,  
  missingFields  
});

Do not silently repair state unless the repair itself is explicitly designed, logged, and tested.

---

## **15\. Debugging Workflow for AI Coding Agents**

When debugging, the agent must:

1. Reproduce or simulate the failure.  
2. Identify the expected behavior.  
3. Locate the boundary where actual behavior diverges.  
4. Inspect logs/traces/state before changing code.  
5. Form a specific hypothesis.  
6. Make the smallest corrective change.  
7. Add or update tests.  
8. Add or update observability so the failure is easier to diagnose next time.  
9. Verify no comments, logs, or metrics now misrepresent behavior.

Do not patch symptoms without identifying the broken assumption.

---

## **16\. Required Debugging Output From the Agent**

When completing a debugging task, the agent should report:

* Root cause  
* Broken assumption  
* Code changed  
* Tests added or updated  
* Observability added or updated  
* Residual risk  
* Follow-up work, if any

Example:

Root cause:  
The intake parser treated missing contractorPreference as "budget-first".

Broken assumption:  
Missing preference is not equivalent to budget preference.

Fix:  
Added explicit UNKNOWN preference state.

Tests:  
Added regression coverage for missing, null, empty, and explicit budget preference.

Observability:  
Added model\_output.preference\_classification log with validation outcome.

Residual risk:  
Older saved intake records may still contain inferred budget preference.

---

## **17\. Anti-Patterns to Avoid**

Avoid:

* Console-only debugging with no durable instrumentation  
* Generic “Something went wrong” errors  
* Catch-and-ignore blocks  
* Logging raw secrets or sensitive payloads  
* Retrying non-idempotent external actions  
* Metrics without dimensions  
* Logs without correlation IDs  
* Debugging by randomly changing code  
* Treating model output as trusted  
* Treating absence of evidence as evidence of absence

---

## **Final Standard**

Every meaningful feature should be shipped with enough observability for a future human or AI agent to understand its behavior without reconstructing the entire implementation from scratch.

If the system makes a decision, crosses a boundary, changes state, retries, suppresses data, calls an LLM, or handles an error, it should leave structured evidence.

\============

# **AI-Native Testing Best Practices for AI Coding Agents**

## **Philosophy**

Testing is not a phase of development.

Testing is the systematic generation of **evidence** that an implementation satisfies its intended behavior.

Every feature, bug fix, refactor, prompt change, workflow modification, or infrastructure change should increase or preserve the amount of trustworthy evidence about system correctness.

The objective is **confidence**, not coverage percentages.

---

# **Core Principles**

## **Principle 1: Every Requirement Produces Evidence**

Every requirement should result in:

* deterministic implementation  
* automated tests  
* observable runtime behavior  
* documented intent  
* explicit contracts

No feature is complete until there is evidence that it behaves correctly.

---

## **Principle 2: Test Behavior, Not Implementation**

Tests should verify:

* business outcomes  
* contracts  
* invariants  
* state transitions  
* externally visible behavior

Avoid coupling tests to internal implementation details whenever possible.

Refactoring should rarely require rewriting tests.

---

## **Principle 3: Every Bug Becomes a Permanent Test**

A production failure should result in:

* root cause identification  
* regression test  
* improved observability  
* improved comments or documentation if appropriate

The same bug should never occur twice for the same reason.

---

## **Principle 4: Trust Boundaries Must Be Tested**

Every boundary where information changes ownership or trust level deserves explicit tests.

Examples:

* user input  
* REST APIs  
* databases  
* queues  
* LLM outputs  
* browser automation  
* workflow engines  
* third-party integrations

Never assume external systems behave correctly.

---

# **AI-Native Evidence Pyramid**

                   Production Validation  
                 Chaos / Resilience / Replay  
             End-to-End / Workflow Validation  
          Contract / Boundary / State Validation  
       Integration / Component Collaboration Tests  
         Property / Invariant / Metamorphic Tests  
              Unit Tests (Deterministic Logic)

Every layer exists to provide a different type of confidence.

---

# **Layer 1: Unit Tests**

## **Purpose**

Verify deterministic logic in isolation.

## **Characteristics**

* extremely fast  
* deterministic  
* independent  
* exhaustive where practical

## **Test**

* parsing  
* transformations  
* calculations  
* formatting  
* validation  
* sorting  
* utility functions

## **Avoid**

* databases  
* network access  
* filesystem dependencies  
* timing assumptions

---

# **Layer 2: Property and Invariant Tests**

## **Purpose**

Verify rules that must always remain true.

Examples:

normalize(normalize(x)) \== normalize(x)

total \>= subtotal

workflow cannot skip approval

duplicate import does not increase unique record count

Property tests often discover bugs that example-based tests never find.

---

# **Layer 3: Integration Tests**

## **Purpose**

Verify collaborating components work together correctly.

Examples:

API  
↓

Business Logic  
↓

Repository  
↓

Database

Test:

* serialization  
* persistence  
* dependency injection  
* transactions  
* message passing  
* authentication

Prefer real infrastructure over mocks whenever practical.

---

# **Layer 4: Contract Tests**

## **Purpose**

Verify assumptions about external interfaces.

Examples:

* REST APIs  
* GraphQL  
* LLM JSON output  
* event schemas  
* queue messages  
* file formats

Every external dependency should have explicit contract validation.

Changes to external contracts should fail tests immediately.

---

# **Layer 5: Boundary Tests**

## **Purpose**

Verify all trust boundaries.

Test:

* malformed input  
* missing fields  
* null values  
* duplicate values  
* incorrect casing  
* oversized payloads  
* unexpected types  
* injection attempts

Never trust external input.

---

# **Layer 6: State Transition Tests**

## **Purpose**

Verify workflow correctness.

For every state machine:

Test

* every legal transition  
* every illegal transition  
* guard conditions  
* retry behavior  
* compensation behavior  
* rollback behavior

Coverage should ensure:

* every state reached  
* every transition exercised  
* every invalid transition rejected

---

# **Layer 7: End-to-End Tests**

## **Purpose**

Verify complete user journeys.

Example:

User submits request

↓

Clarification

↓

Research

↓

Ranking

↓

Selection

↓

Scheduling

↓

Completion

Validate business outcomes rather than implementation details.

---

# **Layer 8: Replay Tests**

## **Purpose**

Reproduce real production behavior.

Capture:

* sanitized requests  
* normalized inputs  
* workflow history  
* dependency responses

Replay them automatically.

Every significant production bug should become a replay test.

Replay tests preserve institutional knowledge.

---

# **Layer 9: Chaos and Resilience Tests**

## **Purpose**

Verify graceful degradation.

Simulate:

* database failures  
* queue failures  
* LLM timeouts  
* malformed responses  
* duplicate events  
* partial workflow execution  
* dependency latency  
* network failures

The system should fail predictably and safely.

---

# **Layer 10: Production Validation**

Production is the final testing environment.

Validate:

* traces  
* logs  
* metrics  
* health endpoints  
* feature flags  
* dashboards  
* alerts  
* canary deployments

If behavior cannot be observed, it cannot be trusted.

---

# **AI-Specific Testing**

## **Prompt Regression Tests**

Prompt changes must be evaluated against stable datasets.

Verify:

* structured output  
* reasoning quality  
* business decisions  
* tool selection  
* consistency

Prompt modifications should not silently degrade behavior.

---

## **Agent Trajectory Tests**

Do not verify only the final answer.

Verify the process.

Example:

Research agent should:

* search  
* expand radius if necessary  
* verify licenses  
* rank providers  
* explain ranking

Trajectory quality is part of correctness.

---

## **Observability Tests**

Verify that important runtime events emit telemetry.

Example:

Invalid state transition

↓

Error log emitted

↓

Trace recorded

↓

Metric incremented

↓

Correlation ID propagated

Observability is a testable requirement.

---

## **Comment and Documentation Tests**

Verify:

* public interfaces document contracts  
* boundaries are documented  
* invariants are documented  
* warnings remain accurate  
* TODOs include references  
* comments do not contradict implementation

Comments are executable knowledge for future maintainers and AI agents.

---

# **Test Data Best Practices**

Prefer:

* builders  
* fixtures  
* factories  
* generated data  
* deterministic seeds

Avoid:

* magic values  
* duplicated fixtures  
* hidden dependencies  
* mutable shared state

Test data should communicate intent.

---

# **Assertions**

Assert behavior rather than implementation.

Prefer:

Homeowner receives only licensed contractors.

Over:

Method getLicensedContractors() was called once.

Business semantics are more stable than implementation details.

---

# **Coverage Philosophy**

Coverage percentages are diagnostics, not goals.

Prefer evidence that demonstrates:

* every business rule verified  
* every boundary validated  
* every invariant enforced  
* every state transition tested  
* every external contract verified  
* every production bug reproduced

100% line coverage does not imply correctness.

---

# **Testing Requirements for Every Pull Request**

Every change should answer:

* What behavior changed?  
* What evidence proves correctness?  
* What regression tests were added?  
* What contracts changed?  
* What observability changed?  
* What replay artifacts should be created?  
* What comments or documentation changed?

---

# **AI Coding Agent Source Code Quality Guide**

Review "JanumiCode\janumicode_v2\docs\sonarqube-headless-remediation-guide.md" for details on how to run the SonarQube setup. 

NOTA BENE: Complexity findings almost always (if not always) should be addressed fully.

---

# **AI Coding Agent Responsibilities**

Before completing any implementation, verify:

✓ Requirements implemented

✓ Unit tests added

✓ Property/invariant tests considered

✓ Integration tests updated

✓ Contract tests updated

✓ Boundary tests updated

✓ State transition tests updated

✓ End-to-end workflows validated

✓ Replay test added for bug fixes

✓ Observability verified

✓ Comments updated

✓ Documentation updated

✓ SonarQube scans run and findings fully addressed (or documented exceptions where required or strongly recommended)

---

# **Anti-Patterns**

Avoid:

* testing private methods  
* brittle implementation-coupled tests  
* excessive mocking  
* happy-path-only testing  
* console debugging instead of automated evidence  
* coverage-driven development  
* skipping regression tests  
* trusting LLM output without validation  
* silent failures  
* manual verification as the only evidence

---

# **Definition of Done**

A feature is complete only when there is sufficient evidence that future humans and future AI agents can confidently answer:

* What is this supposed to do?  
* Why does it exist?  
* How do we know it works?  
* What assumptions does it depend on?  
* What happens when those assumptions fail?  
* How would we detect regressions?  
* How would we debug failures in production?

**Testing is therefore not the validation of code—it is the continuous construction of evidence that the system still satisfies its intended behavior.**

