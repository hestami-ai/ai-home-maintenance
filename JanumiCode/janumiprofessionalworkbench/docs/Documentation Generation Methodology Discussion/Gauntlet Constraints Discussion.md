# Gauntlet Constraints Discussion

**Provenance:** Archived 2026-07-24 from the sponsor's session record as a method source for REG-D-012. Two parts: (1) a public post by Robert C. Martin (@unclebobmartin, X.com, 2026-07-23) supplied by the sponsor as an image, transcribed below; (2) OpenAI Codex's analysis, supplied by the sponsor, of what the post's "plethora of others" likely comprises. Status: historical method material; its adopted mechanisms are merged per REG-D-012 (DOC-004 §7.4/§7.6, CON-000 B2, deep-spec commission template); its deferred families are REG-Q-049/050.

---

## Part 1 — The post (transcribed)

> I'm significantly older than you. I started coding in the late 60s. My current strategy is to not read any of the code written by my agents. That's the only way I can take advantage of their productivity. What I do instead is to surround the agents with extreme constraints. Unit tests, gherkin tests, QA procedures, quality metrics, mutation testing, test coverage, and a plethora of others. In the end, I have very high confidence in the code they produce because they've had to run the gauntlet of all of my constraints and tests.
>
> — Uncle Bob Martin (@unclebobmartin), 6:44 AM · 7/23/26

## Part 2 — Codex's analysis: "What might the 'plethora of others' be?"

Some of the "plethora" can be reconstructed from Martin's adjacent posts and public repositories rather than merely guessed.

In a follow-up, he explicitly said he constrains **function size, cyclomatic complexity, and test coverage**. His public `empire-2025` agent instructions additionally require acceptance scenarios before implementation, failing acceptance and unit tests before code is changed, test-structure checks, a **CRAP score of 8 or less**, differential mutation testing, elimination of surviving mutants, architectural dependency checks, prohibition of dependency cycles, and enforcement of boundaries around internal state. He has also separately mentioned **Gherkin mutation testing**.

### 1. Specification and behavioral-oracle constraints

These determine whether the system is implementing the **right behavior**, rather than merely producing internally consistent code and tests:

- Human-approved acceptance criteria.
- Given/When/Then scenarios.
- Explicit negative requirements and prohibited behavior.
- Preconditions, postconditions, and invariants.
- Examples, counterexamples, boundary conditions, and error cases.
- Traceability from requirement → acceptance scenario → test → implementation.
- A rule that the implementation agent may not silently weaken or rewrite an acceptance test.
- Independent calculation of expected results for numerically or logically sensitive behavior.
- Explicit approval whenever an established behavior changes.

Martin's own division of labor is significant here: his agents write the unit tests, but he reviews the Gherkin acceptance tests and QA procedures. In other words, he has moved human scrutiny upward from implementation details to the definition of correct behavior.

### 2. Compilation and static-analysis constraints

- Compilation with warnings treated as errors.
- Strict type checking and nullability checking.
- Linting and formatting.
- Static data-flow analysis.
- Dead-code and unreachable-code detection.
- Undefined-behavior detection.
- Resource-leak detection.
- API and schema validation.
- Database migration validation.
- Detection of forbidden APIs, imports, or direct state access.
- Secret scanning.

These are particularly useful with coding agents because they turn architectural or stylistic expectations into deterministic pass/fail signals rather than prompt-level suggestions.

### 3. Code-shape and maintainability constraints

- Maximum function length; maximum class or module size.
- Maximum cyclomatic or cognitive complexity; maximum nesting depth; maximum parameter count.
- Duplication thresholds; coupling and cohesion limits.
- Dependency-direction rules; no dependency cycles; layer and component boundary enforcement.
- Architectural fitness functions; change-risk metrics based on complexity, coverage, and churn.
- Limits on mutation sites as a signal that a module has become too large.

Martin's CRAP metric combines cyclomatic complexity and test coverage: CRAP(fn) = CC²(1−coverage)³ + CC. It identifies code that is simultaneously complicated and poorly tested. His public tool describes scores above 30 as high risk, while his current project instructions require changed modules to be driven down to 8 or less — an intentionally severe constraint.

### 4. Multiple independent behavioral test streams

Beyond unit tests and Gherkin acceptance tests: integration tests; API and consumer-contract tests; end-to-end tests; UI automation; database and persistence tests; serialization tests; backward-compatibility tests; regression tests; golden-master/characterization tests for brownfield behavior; cross-platform tests; upgrade/downgrade tests; installation and packaging tests; data-migration and rollback tests.

The important feature is **independence**. Unit tests generally observe implementation-level behavior, while acceptance tests observe externally meaningful behavior. An agent has more difficulty satisfying two separately structured test streams with the same erroneous shortcut.

### 5. Systematic exploration of the input and state space

Property-based testing; boundary-value testing; equivalence-class testing; pairwise/combinatorial testing; fuzz testing; grammar-based fuzzing; model-based testing; state-machine testing; metamorphic testing; differential testing against a prior version or reference implementation; deterministic replay of randomized failures; concurrency/race/deadlock testing; repeated execution with different seeds and schedules.

### 6. Tests of the tests

This is critical when agents themselves generate the tests:

- Statement, line, branch, and condition coverage — **of changed code**, not only repository-wide averages.
- Mutation testing of production code; mutation testing of Gherkin scenarios or their intermediate representation.
- Assertion-strength checks; detection of tests with no meaningful assertions; detection of tests that never fail.
- Test-isolation checks; flaky-test detection; order-randomized execution.
- Verification that tests fail when the relevant implementation is deliberately broken.
- Detection of excessive mocking; enforcement that acceptance tests operate through public interfaces; validation that generated test bindings actually exercise their scenarios.

### 7. Security and software-supply-chain constraints

SAST; dependency and vulnerability scanning; secret scanning; license-policy checks; SBOM generation; build provenance and artifact attestations; reproducible/isolated builds; authentication/authorization tests; tenant-isolation tests; input-validation and injection tests; abuse-case tests; least-privilege checks; container/infrastructure scanning; **verification that the coding agent cannot alter the controls that judge its work**. (NIST SSDF, OWASP ASVS, SLSA.)

### 8. Nonfunctional and operational constraints

Latency/throughput budgets; load, stress, soak; resource ceilings; startup/shutdown behavior; fault injection and resilience; retry/timeout/circuit-breaker/idempotency verification; backup and restoration testing; DR and rollback tests; accessibility; localization; telemetry requirements (required logs, metrics, traces, correlation IDs); error-budget/SLO checks; canary analysis. Observability itself can be an acceptance condition.

### 9. Process and governance constraints

Required CI checks that cannot be bypassed by the agent; protected branches and restricted merge authority; independent validation by another agent, tool, or human; separation between implementation and acceptance authority; evidence packages attached to each completion claim; explicit handling of waived or deferred failures; risk-based escalation; manual exploratory testing for consequential changes; release approval outside the implementation agent's authority; automatic rollback on production invariant failure; audit records of which agent, prompt, tools, models, and artifacts participated.

### The most important "other": separation of authorship from judgment

The dangerous arrangement is: one agent interprets the requirement, writes the code, writes the tests, chooses the metrics, modifies the failing tests, and declares success. That is not independent assurance; it is one cognitive process producing mutually consistent artifacts.

Martin partially avoids this by personally reviewing the Gherkin specifications and QA procedures while leaving implementation code and unit tests to the agents. The human is no longer inspecting every instruction; he is protecting the **behavioral oracle**.

Even perfect coverage and a perfect mutation score do not prove the intended requirement was correct. The assurance system must separately establish: (1) oracle validity; (2) implementation conformance; (3) test adequacy; (4) operational fitness.

### In Janumi terms

The post describes a compact form of Assurance Engineering. Each mechanism would be a typed Assurance Policy: claim → applicability and criticality → validator → acceptance threshold → required evidence → independence requirement → exception authority → remediation or rollback. A PWU declares the claims it must establish; the RPH selects and executes applicable validators, prevents unauthorized modification of the acceptance oracle, preserves evidence, and rejects the completion claim while any required assurance obligation remains unresolved.

The defensible interpretation is not "run every conceivable check on every change," but **apply a risk-proportional assurance profile while never waiving the foundational invariants**. The "plethora of others" is a defense-in-depth system governing intent, implementation shape, behavior, test adequacy, architecture, security, production fitness, evidence, and release authority.
