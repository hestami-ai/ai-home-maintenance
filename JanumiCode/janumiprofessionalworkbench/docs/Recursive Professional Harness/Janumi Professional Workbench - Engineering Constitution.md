# Janumi Professional Workbench Engineering Constitution

**Document ID:** `JAN-ENGC-001`
**Version:** `1.0.1`
**Status:** Normative
**Effective date:** 2026-07-17
**Role:** Binding engineering-practice constitution
**Authority:** Engineering practice for the Janumi Professional Workbench
**Scope:** Commenting, observability, debugging, testing-as-evidence, quality gates, and engineering completion
**Applies to:** Human contributors, AI coding agents, agent operators, reviewers, and maintainers
**Derived from:** [Retired non-normative Engineering Constitution source](<retired/Janumi Professional Workbench - Engineering Constitution.md>)
**Supersedes:** Uncontrolled source guidance for engineering-governance use
**Source disposition:** Original source preserved byte-for-byte under `retired/`; it carries no current authority
**Approval basis:** User direction to create a normative variant, 2026-07-17
**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY

---

## 1. Purpose and Constitutional Force

This Constitution establishes the binding engineering practices for changes to the Janumi Professional Workbench and its governed implementation artifacts.

It governs:

* source-code clarity and comments;
* debugging and failure analysis;
* logs, traces, metrics, and other observability evidence;
* testing and assurance evidence;
* AI-, model-, and tool-call engineering practices;
* code-quality gates;
* engineering completion and reporting;
* exceptions to these practices.

This Constitution applies to source code, tests, prompts, agent definitions, tool contracts, configuration, infrastructure code, migrations, telemetry, generated artifacts, and engineering documentation when they are created or changed as part of Janumi Professional Workbench work.

### 1.1 Scope Boundary

This document governs engineering practice. It does not define Janumi's professional ontology, Professional Work Architecture semantics, runtime invariants, serialized contracts, or product behavior.

The document that owns a semantic or architectural concern remains authoritative for that concern. This Constitution governs how an implementation change is designed, evidenced, reviewed, and completed; it SHALL NOT be used to redefine the meaning of a canonical Janumi term or object.

Repository-local instructions and accepted architecture decisions MAY impose stricter requirements. They SHALL NOT silently weaken this Constitution. If two requirements cannot be reconciled within their declared scopes, the conflict SHALL be surfaced to the responsible authority before an unsafe or semantically irreversible change proceeds.

### 1.2 Source Lineage

This document is the controlled normative variant of the retired, unversioned source named in the metadata above. It preserves that source's four substantive pillars:

1. comments preserve decision context;
2. observability makes behavior reconstructable;
3. testing constructs evidence of correctness;
4. quality gates and completion duties prevent silent engineering debt.

The source remains historical input. Within the scope of this Constitution, this controlled variant governs when the two differ.

### 1.3 Normative Language

The keywords SHALL, SHALL NOT, SHOULD, SHOULD NOT, and MAY have the binding meanings below in this document. `JAN-DOCS-001` defines the general document-control vocabulary; the RPH README registers this document in its current location. Neither is required to interpret these terms.

* SHALL and SHALL NOT state mandatory requirements.
* SHOULD and SHOULD NOT state strong defaults that require recorded justification when not followed.
* MAY states a permitted option.

Examples are non-normative: they illustrate a rule but do not narrow it.

Normative clause locators use the form `JAN-ENGC-001 § 3.2`. Within a major version, a published clause number SHALL NOT be reassigned to an unrelated requirement.

### 1.4 Applicability Terms

For this Constitution:

* a **material** change or action can affect externally visible behavior, governed state, authority, security, privacy, a contractual interface, a professional outcome, an irreversible external effect, assurance, or operational reliability;
* an **applicable** rule has a causal, contractual, or risk-bearing relationship to the changed behavior; a contributor SHALL consider the rule and SHALL record the reason when applicability is uncertain and the rule is omitted;
* **sufficient evidence** directly supports the governing requirement, is inspectable or reproducible as appropriate, and covers the material success and failure conditions affected by the change;
* **feasible** means possible within authorized scope and tooling without creating disproportionate risk; inconvenience, effort, or schedule pressure alone does not establish infeasibility;
* a **trust boundary** is a point at which information changes owner, authority, validation state, or protection domain.

---

## 2. Foundational Engineering Principles

All work governed by this Constitution SHALL preserve the following principles.

### 2.1 Clarity Before Commentary

Code SHALL explain its ordinary behavior through clear names, explicit types, cohesive functions, visible state, and well-defined boundaries before comments are used to compensate for complexity.

Comments SHALL preserve decision context that is not reliably recoverable from code alone. They SHALL NOT narrate syntax or restate an implementation that is already clear.

### 2.2 Evidence Before Confidence

Engineering confidence SHALL be supported by inspectable evidence. A successful command, a generated artifact, a model response, a completed workflow step, or a high coverage percentage is not sufficient by itself to prove that intended behavior occurred.

Evidence produced by an AI agent MAY support review, but it is not governance approval and SHALL NOT be presented as independent human or policy authority.

Tests, telemetry, replay artifacts, model evaluations, and Validator output MAY provide evidence or assessment. They do not by themselves authorize a state change, make a governance Decision, or establish a Baseline; those effects remain governed by the concern-owning Janumi specification and authority model.

### 2.3 Reconstructable Behavior

A material system action SHALL leave enough safe, structured evidence for an authorized maintainer to determine what happened, where it happened, why it happened, which state or dependency influenced it, and whether the condition is isolated or systemic.

### 2.4 Explicit Trust Boundaries

Input that crosses an ownership or trust boundary SHALL be treated as untrusted until it is validated under the applicable contract. This includes user input, external APIs, files, database records from another authority boundary, messages, browser automation, model output, agent output, and tool output.

### 2.5 Permanent Learning From Failure

A material defect SHALL produce durable learning proportional to its risk. When feasible, that learning SHALL include a regression test or replay fixture and improved observability sufficient to detect the same failure mode earlier.

### 2.6 Safe Information Handling

Engineering artifacts SHALL NOT expose secrets, credentials, tokens, private customer data, unnecessary personal information, protected prompts or outputs, or security-bypass instructions.

### 2.7 No Invented Rationale

A contributor or agent SHALL NOT present inferred business or architectural rationale as known fact. When inference is necessary, it SHALL be labeled as inference and validated against the owning requirement or authority before it becomes a durable design constraint.

### 2.8 Proportional but Complete Practice

Verification and observability SHALL be proportional to change risk, but proportionality SHALL NOT be used to leave an affected layer incomplete. A small coherent change is preferred to a broad change; an incoherent partial change is prohibited even when its diff is smaller.

---

## 3. Source-Code Clarity and Commenting

### 3.1 Self-Documenting Code

Before adding an explanatory comment, the contributor SHALL consider whether the implementation can be clarified by:

* choosing a more precise name;
* extracting a cohesive function or type;
* making state and control flow explicit;
* replacing a magic value with a named concept;
* using an explicit contract or type;
* making an illegal state difficult or impossible to represent;
* removing unnecessary cleverness.

Comments SHALL NOT be used as a routine substitute for such improvements.

### 3.2 What Comments Shall Explain

A comment is warranted when a future maintainer could otherwise misunderstand:

* why the code exists;
* why this approach was selected;
* which requirement, decision, or acceptance criterion it satisfies;
* which constraint or tradeoff shaped it;
* which invariant must remain true;
* which external contract is being relied upon;
* why an error is retried, downgraded, escalated, or allowed to fail;
* why an apparently redundant step is necessary;
* what must not be changed without coordinated work elsewhere.

A comment SHALL explain the smallest durable context necessary. Entire user stories, long requirements, or task transcripts SHALL NOT be copied into source files when a stable identifier and a concise rationale are sufficient.

### 3.3 Required Boundary and Invariant Comments

Non-obvious dependencies on behavior outside the local source file SHALL be documented at the relevant boundary. The comment SHOULD identify the assumption, normalization rule, failure behavior, and owning contract when those facts are not obvious from types or generated documentation.

An invariant whose violation could authorize an invalid transition, corrupt governed state, duplicate an external effect, weaken security, or misrepresent assurance SHALL be explicit in code, tests, or a nearby comment. A comment alone does not enforce an invariant.

Example:

```text
// Boundary: Model output is an untrusted proposal. Normalize missing and null
// fields, then validate the declared output schema before constructing a Command.
```

```text
// Invariant: This transition occurs only after authority and expected revision
// checks succeed. Bypassing either check would make the committed state invalid.
```

### 3.4 Structured Comment Forms

The following labels MAY be used when they make a high-risk comment easier to scan:

* `Intent:` — why the code exists;
* `Context:` — durable historical, product, or domain background;
* `Boundary:` — assumptions about external input or output;
* `Invariant:` — a condition that must always remain true;
* `Tradeoff:` — why one acceptable approach was selected over another;
* `WARNING:` — a real hazard or fragile contract;
* `Inferred rationale:` — a hypothesis that has not been confirmed by an owning authority.

Labels SHALL NOT substitute for a precise explanation.

### 3.5 TODOs and Warnings

A TODO SHALL include:

* an owner or stable issue/reference;
* the reason the work remains;
* the current risk or limitation;
* the expected resolution or removal condition.

Ambiguous TODOs such as `fix later` are prohibited.

A warning comment SHALL be reserved for a material hazard. Warning language SHALL NOT be applied so broadly that it loses diagnostic value.

### 3.6 Comment Placement and Drift

Comments SHALL be placed as close as practical to the behavior they govern:

* module-level comments for durable architectural context;
* function- or type-level comments for contracts and invariants;
* local comments for unusual decisions;
* file-level comments only when the entire file has a special role.

When behavior changes, affected comments, examples, TODOs, warnings, and requirement references SHALL be updated or removed in the same change. A stale comment that contradicts behavior is a defect.

### 3.7 AI Coding Agent Duties for Comments

An AI coding agent SHALL:

1. preserve meaningful comments unless evidence shows they are wrong or obsolete;
2. update or remove stale comments when changing nearby behavior;
3. add decision context where future agents could plausibly misread a boundary, invariant, tradeoff, or failure policy;
4. avoid over-commenting obvious code;
5. distinguish known rationale from inferred rationale;
6. treat comments as part of the implementation contract during review.

---

## 4. Observability and Operational Evidence

### 4.1 Observability Standard

Observability is the ability to reconstruct system behavior from emitted evidence. It includes logs, traces, metrics, Events, audit records, health signals, and controlled diagnostic artifacts.

If the system makes a material decision, crosses a trust boundary, changes governed state, retries, suppresses or deduplicates data, calls a model or tool, or handles an error, it SHALL emit evidence proportional to the consequence of that action.

### 4.2 Instrument Boundaries First

Every material boundary SHOULD capture, where applicable:

* a trace or correlation identifier;
* a safe operation, actor, Undertaking, PWU, or aggregate reference;
* the input shape and schema version rather than sensitive raw content;
* validation and authorization outcomes;
* the dependency or provider involved;
* latency and timeout policy;
* outcome and stable error classification;
* retry, deduplication, or idempotency context.

Identifiers that do not exist in the governing domain SHALL NOT be fabricated merely to satisfy a logging template.

### 4.3 Structured Decision Evidence

Material branches based on professional rules, eligibility, authority, lifecycle state, ranking, retry policy, or agent/tool selection SHALL produce structured decision evidence when the decision would otherwise be difficult to reconstruct.

The record SHOULD state the evaluated rule or policy, relevant safe inputs, selected disposition, and reason. It SHALL NOT expose private chain-of-thought. A concise rationale, criteria result, or provenance-linked evidence summary is sufficient.

### 4.4 Structured Logs and Correlation

Machine-consumable structured logs SHALL be preferred over prose-only messages for operational events.

Correlation context SHALL propagate across requests, jobs, messages, workflows, model calls, tool calls, and external requests where the platform supports propagation. A log that cannot be associated with the operation that caused it SHOULD be treated as incomplete evidence.

Normal control flow SHALL NOT be logged at warning or error severity.

### 4.5 Typed and Classified Errors

Errors that cross a component or trust boundary SHALL have:

* a stable error code or category;
* a safe human-readable message;
* machine-readable context;
* the originating operation and correlation context;
* a remediation hint when one is safe and useful.

Generic catch-and-ignore behavior is prohibited. An error MAY be translated, retried, downgraded, or suppressed only under an explicit policy whose effect remains observable.

### 4.6 Failure Evidence

Failure records SHOULD preserve the safe evidence needed to diagnose:

* schema and contract versions;
* redacted input characteristics;
* expected and observed state;
* dependency and timeout information;
* validation findings;
* retry count and policy;
* decision path or failed guard;
* recovery or compensation outcome.

Secrets, raw credentials, unnecessary personal data, and sensitive prompts or outputs SHALL NOT be logged.

### 4.7 Model, Agent, and Tool Calls

Each material model, agent, or tool call SHALL be treated as an observed trust boundary. The call record SHALL capture, where available and applicable:

* agent role and invocation purpose;
* prompt or template identifier and version;
* model, provider, and tool identifiers;
* input and output schema versions;
* provenance and correlation context;
* validation, policy, guardrail, and assurance results;
* retry count, latency, token or resource use, and finish reason;
* accepted, rejected, escalated, or provisional disposition.

Full prompts, private reasoning, and raw outputs SHALL NOT be logged by default. Controlled diagnostic artifacts MAY retain redacted content when authorized, access-controlled, retention-bounded, and necessary for replay or assurance.

The absence of an emitted model error SHALL NOT be treated as evidence that the output was correct. Material output SHALL be validated before it acquires authority or drives a protected transition.

### 4.8 State Transitions

Every material governed state transition SHALL be observable. Transition evidence SHOULD include:

* object identity and revision;
* prior and resulting state;
* initiating Command or equivalent governed action;
* actor and authority outcome;
* guards and invariants evaluated;
* emitted Event or audit reference;
* correlation context.

Rejected transitions SHALL also be observable at an appropriate severity.

### 4.9 Retries, Idempotency, and Deduplication

Retry, idempotency, and deduplication behavior SHALL record the policy and final disposition. The evidence SHOULD include the idempotency key or safe derivative, attempt number, backoff, retry safety, duplicate-match reason, and outcome.

A non-idempotent external action SHALL NOT be retried automatically unless the owning contract provides a mechanism that prevents duplicate effects.

### 4.10 Metrics and Health Signals

Metrics SHOULD cover both technical health and meaningful product or work behavior. Metrics SHALL have bounded, non-sensitive dimensions and SHALL NOT create unbounded-cardinality or privacy hazards.

Services SHALL expose machine-readable liveness and readiness signals appropriate to their deployment. A service SHALL NOT report ready when it cannot safely perform the operations for which it receives traffic. Degraded states SHOULD distinguish unavailable critical dependencies from unavailable noncritical capabilities.

### 4.11 Invariant Violations

An invariant violation SHALL emit high-severity evidence and prevent the unsafe action. State SHALL NOT be silently repaired unless the repair mechanism is explicitly designed, authorized, observable, and tested.

### 4.12 Observability Anti-Patterns

The following are prohibited:

* console-only debugging as the sole durable evidence;
* generic failure messages without classification;
* catch-and-ignore blocks;
* logs without usable correlation where correlation is available;
* raw secret or sensitive-payload logging;
* retrying non-idempotent effects without protection;
* metrics with unsafe or unbounded dimensions;
* treating model or tool output as trusted;
* treating absence of evidence as evidence of absence.

---

## 5. Debugging Discipline

### 5.1 Required Workflow

When diagnosing a defect, the contributor or agent SHALL:

1. reproduce, replay, or safely simulate the failure when feasible;
2. identify the expected behavior and its governing requirement;
3. locate the boundary where observed behavior diverges;
4. inspect available logs, traces, Events, state, and dependency evidence before changing code;
5. state a specific, falsifiable hypothesis;
6. make the smallest coherent corrective change;
7. add or update evidence that prevents regression;
8. improve observability when the existing evidence was insufficient;
9. verify that comments, logs, metrics, and documentation still describe the resulting behavior accurately.

A contributor SHALL NOT patch symptoms through random changes or weaken an invariant merely to make a failing test pass.

### 5.2 Debugging Completion Report

A completed debugging change SHALL report:

* root cause;
* broken assumption;
* behavior and code changed;
* tests or replay evidence added or updated;
* observability added or updated;
* residual risk;
* deferred follow-up work.

If root cause remains unknown, the work SHALL be reported as an investigation or containment, not as a completed root-cause fix.

---

## 6. Testing as Evidence

### 6.1 Testing Principle

Testing is the systematic construction of evidence that an implementation satisfies intended behavior. It is continuous engineering work, not a terminal phase.

Every material requirement or behavioral change SHALL have evidence proportional to its risk. Evidence SHOULD include deterministic implementation checks, automated tests, observable runtime behavior, and explicit contracts where those forms apply.

Tests SHALL favor professional outcomes, contracts, invariants, state transitions, and externally visible behavior over private implementation details. Refactoring a conforming implementation SHOULD NOT routinely require rewriting behavior-level tests.

### 6.2 Evidence Ladder

The following layers provide different kinds of confidence. A change SHALL use every applicable layer; inapplicable layers MAY be omitted when the reason is evident or recorded.

| Layer | Required purpose when applicable |
| --- | --- |
| Unit | Verify deterministic logic in isolation. |
| Property, invariant, and metamorphic | Verify rules that must remain true across broad input spaces. |
| Integration | Verify collaborating components, persistence, transactions, serialization, and dependency wiring. |
| Contract | Verify assumptions at APIs, Events, messages, files, model outputs, and other external interfaces. |
| Boundary | Verify malformed, missing, null, duplicate, oversized, unauthorized, and unexpected input. |
| State transition | Verify every affected legal transition, illegal transition, guard, retry, compensation, and rollback rule. |
| End-to-end | Verify complete affected user or professional journeys and their outcomes. |
| Replay | Reconstruct significant field failures or production behavior from sanitized evidence. |
| Chaos and resilience | Verify predictable behavior under dependency failure, delay, duplication, and partial execution. |
| Production validation | Verify telemetry, health, alerting, canary behavior, and real operational outcomes. |

The cheapest relevant proof SHOULD run first, followed by broader proofs as risk requires.

### 6.3 Trust-Boundary and Contract Testing

Every changed trust boundary SHALL have explicit validation evidence. Tests SHOULD cover:

* missing and null fields;
* incorrect types and casing;
* malformed, oversized, duplicate, stale, or adversarial input;
* authorization failures;
* schema-version and compatibility behavior;
* dependency timeouts and bad responses;
* idempotency and duplicate delivery;
* safe redaction and error classification.

External systems SHALL NOT be assumed to behave correctly.

### 6.4 State and Workflow Testing

For every affected state machine, tests SHALL cover all changed legal transitions, relevant illegal transitions, guards, retries, compensation, recovery, and rollback behavior.

A happy-path test alone is insufficient when the change affects authority, state, money, security, external side effects, agent action, or professional assurance.

### 6.5 Production Defects and Replay

A confirmed production defect SHALL result in a regression test or replay fixture when feasible. If such evidence cannot be created, the completion report SHALL state why and identify the compensating detection or prevention mechanism.

Sanitized replay artifacts SHOULD preserve normalized inputs, governing versions, event or workflow history, dependency summaries, and the observed failure without exposing protected information.

### 6.6 AI-Specific Tests

Material prompt, model, agent, or tool changes SHALL be evaluated beyond ordinary deterministic unit tests.

Applicable evidence includes:

* prompt regression evaluation against a stable, versioned dataset;
* output-schema and boundary validation;
* tool-selection and permission tests;
* agent trajectory tests for required process behavior;
* adversarial and malformed-output cases;
* provenance, guardrail, and assurance checks;
* observability tests proving required telemetry is emitted;
* accepted/rejected/escalated disposition tests.

Final output alone is insufficient when the required trajectory, evidence collection, tool use, or protected-transition handling is part of correctness.

### 6.7 Test Data and Assertions

Test data SHOULD use builders, fixtures, factories, generated values, and deterministic seeds that communicate intent. Tests SHOULD avoid unexplained magic values, mutable shared state, hidden dependencies, and duplicated fixtures.

Assertions SHALL target stable behavior and semantics. An assertion that only verifies a private method call is insufficient when the actual requirement concerns an external outcome or invariant.

### 6.8 Coverage

Coverage measurements are diagnostics, not proof of correctness. Required repository thresholds SHALL be met, but a numerical threshold SHALL NOT replace evidence that each affected rule, boundary, invariant, transition, contract, and known defect is tested.

One hundred percent line coverage does not, by itself, establish conformance.

### 6.9 Documentation and Observability Tests

Public contracts, generated reference material, boundary documentation, and invariant comments SHOULD be tested or validated where tooling permits. Required runtime telemetry SHALL be testable; observability is itself a requirement, not an unverified aspiration.

---

## 7. Quality Gates

### 7.1 Repository-Local Procedure

The repository's checked-in tooling, configuration, scripts, and accepted operations documentation define how quality gates are executed. An out-of-repository guide MAY be consulted as background, but it SHALL NOT silently control a repository whose own configuration differs.

### 7.2 Required Gates

Every change SHALL run the applicable format, lint, type, schema, generation, test, security, and static-analysis checks defined by the affected repository or package.

The contributor SHALL inspect the findings, not merely the process exit code. A gate that could not run SHALL be reported as not run, together with the reason and residual risk.

### 7.3 Findings and Complexity

Quality findings SHALL be remediated fully by default. Complexity findings in changed code SHALL be addressed through clearer decomposition, simpler control flow, or a better domain representation whenever a safe coherent remedy exists.

Effort, schedule pressure, or the fact that a finding predates the current change is not by itself sufficient justification to ignore a finding introduced or materially worsened by the change.

### 7.4 Recorded Exceptions

A finding MAY remain only under an explicit, reviewable exception. The exception SHALL record:

* the tool, rule, finding, and affected location;
* why remediation is inapplicable, unsafe, or more harmful at this time;
* the risk of leaving the finding;
* compensating evidence or controls;
* the approving authority;
* an owner and a removal condition, review date, or expiry when the exception is temporary.

False positives, generated or vendor-controlled code, and a demonstrated conflict with a higher-order requirement MAY justify an exception. Convenience and silence SHALL NOT.

An exception to a quality finding does not waive a semantic invariant, security boundary, authorization rule, or legal obligation.

---

## 8. AI Coding Agent Responsibilities

### 8.1 Before Implementation

An AI coding agent SHALL:

1. identify the requested outcome, scope, and non-goals;
2. read the applicable repository instructions and governing documents;
3. inspect the actual code, contracts, tests, migrations, and generated-artifact boundaries;
4. identify affected trust boundaries, invariants, state transitions, and external effects;
5. determine the evidence required to prove completion;
6. surface a material authority conflict or unresolved requirement rather than inventing a durable answer.

### 8.2 During Implementation

An AI coding agent SHALL:

* preserve unrelated user changes;
* make the smallest coherent change;
* avoid hand-editing generated artifacts when a source generator exists;
* validate model, tool, and external input before authoritative use;
* maintain comments, tests, telemetry, and documentation with the behavior they describe;
* protect secrets and sensitive data;
* avoid bypass paths around governed commands, validation, authority, assurance, or persistence contracts;
* distinguish verified facts from inference.

### 8.3 Before Completion

An AI coding agent SHALL verify and report, as applicable:

* requirements implemented;
* unit and focused regression tests;
* property or invariant tests;
* integration, contract, and boundary tests;
* state-transition and end-to-end evidence;
* replay evidence for defect remediation;
* prompt or trajectory evaluation for AI behavior changes;
* observability and redaction behavior;
* comment and documentation accuracy;
* quality-gate and static-analysis results;
* exceptions, residual risk, and deferred work.

The agent SHALL NOT claim that a check passed when it did not run.

---

## 9. Definition of Done

A change is complete only when:

1. the requested behavior is implemented within the agreed scope;
2. affected contracts, invariants, and authority boundaries remain satisfied;
3. applicable evidence demonstrates the intended behavior and material failure modes;
4. required observability makes the behavior reconstructable;
5. comments and documentation accurately preserve decision context;
6. applicable quality gates pass or each remaining finding has an approved recorded exception;
7. migration, compatibility, rollback, and recovery effects are addressed where applicable;
8. residual risks and deliberately deferred work are disclosed.

The final evidence SHALL allow a future human or AI agent to answer:

* What is this supposed to do?
* Why does it exist?
* How do we know it works?
* Which assumptions and contracts does it depend on?
* What happens when those assumptions fail?
* How would a regression be detected?
* How would a production failure be diagnosed?

Completion is not established merely because code compiles, a test command exits successfully, or an agent states that the task is done.

---

## 10. Deviations, Waivers, and Escalation

### 10.1 Deviation Record

Any deviation from a SHALL or SHALL NOT requirement in this Constitution requires an explicit record linked to the change. The record SHALL include:

* the clause being deviated from;
* the reason and responsible owner;
* affected scope and duration;
* risk and compensating controls;
* approving authority;
* resolution, review, or expiry condition.

The approving authority is the person or governance body identified by the affected repository, policy, or concern-owning document. An AI agent or the author of a deviation SHALL NOT self-approve it. If no approving authority can be identified, the deviation remains unapproved and the stricter rule applies until a repository owner or other duly authorized maintainer decides it.

### 10.2 Non-Waivable Concerns

This Constitution cannot be used to waive a legal obligation, security boundary, authorization requirement, canonical semantic invariant, data-protection duty, or a stricter requirement owned by another governing document.

### 10.3 Conservative Escalation

When a contributor cannot determine whether a proposed deviation is safe, the contributor SHALL preserve the stricter interpretation, complete all safely separable work, and escalate the unresolved decision with concrete evidence.

---

## 11. Change Control

This Constitution SHALL change only through an explicit governed revision.

A revision proposal SHALL identify:

* the clauses changed;
* the engineering problem or evidence motivating the change;
* compatibility and enforcement effects;
* downstream tooling, prompt, test, or documentation changes;
* the approving authority and effective date.

The document identifier `JAN-ENGC-001` is permanent. Versions SHALL follow the semantic-version policy in `JAN-DOCS-001`, and the RPH README SHALL record the current version and status. The `ENGC` family distinguishes this engineering-practice constitution from a future platform-wide Janumi Constitution. A materially distinct replacement document, if ever created, SHALL receive a new permanent identifier, and this document SHALL remain registered with an appropriate Deprecated or Superseded status.

---

## 12. Compact Review Checklist

Before approving a governed change, the reviewer SHALL be able to answer yes, not applicable with reason, or exception recorded for each relevant question:

* Is the implementation clearer than the comments needed to explain it?
* Do comments preserve why, constraints, boundaries, invariants, and tradeoffs without narrating syntax?
* Are TODOs actionable and warnings reserved for real hazards?
* Are trust boundaries validated and safely observable?
* Are decisions, state transitions, retries, model/tool calls, and errors reconstructable?
* Are logs structured, correlated, classified, and redacted?
* Does the test evidence cover affected behavior, boundaries, invariants, transitions, contracts, and failure modes?
* Did each material defect produce durable regression evidence where feasible?
* Were AI prompt, output, tool-use, trajectory, and assurance risks evaluated where applicable?
* Were repository quality gates run and their findings inspected?
* Is every remaining exception explicit, approved, and bounded?
* Can a future maintainer understand what changed, why, how it was proved, and what risk remains?

The constitutional standard is not more comments, logs, tests, or ceremony. It is fewer hidden assumptions and stronger, safer evidence.
