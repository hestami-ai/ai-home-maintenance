# JAN-PRPWA-EP-001 — Engineering-Practice Requirements (Salvaged Descriptive Content)

*Normative restoration, as prescriptive requirements, of descriptive engineering-practice content that the previous canonicalization cycle did not fully or correctly carry from the retired source into `JAN-ENGC-001`.*

| Governance / Environment Field | Prescriptive Baseline Value |
| :--- | :--- |
| **Document ID** | `JAN-PRPWA-EP-001` |
| **Version** | `0.1.0-draft` |
| **Status** | `DRAFT` (normative program specification; imposes **stricter / more-specific** engineering-practice requirements per `JAN-ENGC-001 §1.1`; proposed for §11 reconciliation into `JAN-ENGC-001` — §5) |
| **Upstream Lineage** | Refines: `JAN-ENGC-001@1.0.1` (status: `NORMATIVE`). Descriptive origin: retired source `Janumi Professional Workbench - Engineering Constitution.md` under `retired/` (status: `HISTORICAL — NO CURRENT AUTHORITY`). Companion to: `JAN-PRPWA-DS-001@0.2.0-draft`. |
| **Active Wave / Work Packages** | `JAN-PRPWA` program-instance / cross-cutting (applies to every `JAN-PRPWA-DWP-01…07` artifact in `JAN-PRPWA-DR-001`) |
| **Repository Root & Branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| **Revision at Grounding** | Git Commit SHA: `2040ae37` |
| **Subject-of-Record Path** | Cross-cutting: all source, tests, prompts, tool contracts, and migrations changed under `Wave PRPWA-C` |
| **Persistence Specification** | N/A (engineering-practice specification; no schema, no tables) |
| **Runtime Configuration** | Workspace: `Turborepo + Bun monorepo`; Test Harness: `Vitest` + `Playwright` (`RPH_DEMO_MODE=test`) + `svelte-check` + `eslint` + `dependency-cruiser` + SonarQube/SonarLint static analysis (EP-TST-13) |
| **Validation Purpose** | Restore, as normative requirements, the descriptive engineering-practice content the previous cycle did not fully/correctly carry from the retired source into `JAN-ENGC-001`. Validated by an adversarial salvage (4-agent extraction + reconciliation with a completeness critic), calibrated against a sponsor-supplied known-answer (SonarQube, EP-TST-13). |
| **Scope of Fixture** | Only the **DEGRADED** or **ABSENT** descriptive content across commenting, observability/debugging, and testing-as-evidence — re-expressed deontically, each mapped to the `JAN-ENGC-001` clause it refines. Content `JAN-ENGC-001` already carries faithfully is **not** restated (§4 index). |
| **Deferred Elements / Non-Goals** | Does **not** amend `JAN-ENGC-001` (that requires its `§11` change control — recommended in §5, sponsor's decision); does **not** add invented requirements (§1.5 fidelity guardrail); does **not** restate faithfully-carried content. |

---

## 1. Preamble, Governance Positioning & Reading Contract

### 1.1 Why this document exists

`JAN-ENGC-001` is the binding engineering-practice constitution. It was produced from a richer, retired descriptive source; that compression **genericized or dropped** a body of concrete, load-bearing descriptive guidance (worked examples, category vocabularies, structured comment forms, the log-level taxonomy, mock discipline, and the SonarQube scanning duty). This document **salvages that content and re-expresses it as prescriptive requirements**, so an implementing coding agent regains the concrete "how" — not as informal examples, but with normative force consistent with the `JAN-PRPWA` documentation set.

### 1.2 Deontic conventions

**SHALL / SHALL NOT / SHOULD / SHOULD NOT / MAY** carry the binding meanings of `JAN-ENGC-001 §1.3`. SHALL is mandatory; SHOULD is a strong default requiring recorded justification to deviate; MAY is permitted. Worked examples are **non-normative illustrations** of a normative rule (`JAN-ENGC-001 §1.3`) — they show the *shape*, they do not narrow the rule.

### 1.3 Governance positioning (this is not a rogue authority)

- This document is a **repository-local instruction / accepted architecture decision** in the sense of `JAN-ENGC-001 §1.1`, which explicitly permits such instructions to **impose stricter requirements**.
- Every requirement here is **stricter than, or more specific than, and never weaker than** its `JAN-ENGC-001` counterpart. Where the governed doc *softened* the source, this document re-imposes the stronger form.
- No requirement here is **silent**: each carries a `↩` locator naming the `JAN-ENGC-001` clause it refines and its salvage status (`DEGRADED` = present but thinner/altered; `ABSENT` = dropped entirely).
- `JAN-ENGC-001` remains supreme for engineering practice; if any requirement here were read to *weaken* it, that reading is void and the conflict SHALL be surfaced per `JAN-ENGC-001 §1.1` / `§10`.
- Precedence order for the implementer: `JAN-ENGC-001` → this document (stricter refinements) → `JAN-PRPWA-DS-001` (the design it serves).

### 1.4 Applicability

These requirements SHALL apply to every material change under `Wave PRPWA-C` (the `JAN-PRPWA-DS-001` implementation), to the extent the change touches the concern each requirement governs (`JAN-ENGC-001 §1.4` "applicable"). They MAY be adopted repository-wide, but that adoption is the sponsor's decision (§5).

### 1.5 Fidelity guardrail

Every requirement below is a **faithful re-expression of guidance actually present in the retired descriptive source** — not a new invention (`JAN-ENGC-001 §2.7`, No Invented Rationale). Worked examples are quoted from that source. Where this document adds only *normative force* (SHALL) to descriptive guidance, that transformation is disclosed by the `↩` tag.

---

## 2. Commenting Requirements (restores `JAN-ENGC-001 §3`)

- **EP-CMT-1 (Dual reader audience).** Comments SHOULD be written so a **future AI coding agent can reconstruct intent WITHOUT reading the entire task history**, not only for a human maintainer. *↩ refines `§3.2/§3.7/§12` — DEGRADED (governed narrows the warrant and checklist to "maintainer").*
- **EP-CMT-2 (Comment-type taxonomy with per-type examples).** For high-signal comments, the author SHOULD use these six categories, each illustrated by its own form. This is a usable taxonomy, not a flat label list. *↩ refines `§3.4` — DEGRADED (governed keeps flat labels and redefines `Context:`); the per-type examples — especially `Context:` — were never surfaced.*
  ```text
  // Intent: prevent homeowners from seeing contractors that failed jurisdiction validation.
  // Context: Some county licensing records lag state records by several days,
  //   so we treat state verification as authoritative when county data is missing.
  // Boundary: This endpoint receives model-generated JSON. Validate strictly
  //   before converting it into workflow state.
  // Invariant: A bid cannot be accepted after the request has expired.
  // Tradeoff: We use synchronous validation here instead of queueing because
  //   the homeowner must receive immediate feedback before submitting the request.
  // WARNING: Changing this retry policy may duplicate outbound vendor messages.
  ```
- **EP-CMT-3 (Structured decision block for high-risk code).** For non-obvious or high-risk code, the author SHOULD use a compact **multi-field** decision block with an explicit **`Do not change:`** directive, placed sparingly near the decision. *↩ refines `§3.4` — DEGRADED (the multi-field template and the `Do not change:` field were lost).*
  ```text
  // Context:
  // - Requirement: US-142 AC-3 requires jurisdiction-specific contractor filtering.
  // - Reason: Licensing validity differs by state/county.
  // - Constraint: Vendor records may have missing or stale license metadata.
  // - Do not change: Do not fallback to "unverified" contractors unless the
  //   caller explicitly opts into unverified search results.
  ```
- **EP-CMT-4 (Boundary comment triggers — enumerated).** A comment SHALL document a non-obvious dependency on behavior outside the local file, and the author SHALL treat **each** of these as a comment trigger: APIs; databases; **queues**; LLM outputs; browser automation; **file formats**; third-party services; **authentication/session behavior**; **workflow-engine semantics**. *↩ refines `§3.3` — DEGRADED (enumerated categories dropped; queues, file formats, workflow-engine, auth/session survive nowhere as comment triggers).*
- **EP-CMT-5 (Observability-decision comments).** When adding a log, trace, metric, or span whose diagnostic purpose is not obvious, the author SHALL comment **why the instrumentation exists and what signal a future debugger needs**. *↩ `§none` — **ABSENT** (`§4` mandates emitting evidence; no clause requires commenting the rationale of instrumentation).*
  ```text
  // Trace this decision boundary because shallow agent audits often appear
  // successful unless we capture the evaluated criteria and rejected options.
  ```
- **EP-CMT-6 (No sensitive material in comments — completed list).** Comments SHALL NOT expose secrets, credentials, tokens, private customer data, personal information, **internal-only URLs unless approved**, or security-bypass instructions; a comment SHALL describe the *contract*, not expose sensitive implementation material. *↩ refines `§2.6` — DEGRADED (the "internal-only URLs unless approved" item and the describe-the-contract framing were dropped).*
- **EP-CMT-7 (Commenting-specific completion checks).** Before completing a change, the author SHALL verify, in addition to `§12`: AC/user-story references are minimal and useful; comments sit close to the code they explain; stale comments are removed; and a future AI agent could understand intent without the task history. *↩ refines `§12` — DEGRADED (Q3/Q4/Q5 and the "without task history" framing weakened/dropped).*

---

## 3. Observability & Debugging Requirements (restores `JAN-ENGC-001 §4`–`§5`)

- **EP-OBS-1 (Instrument boundaries — enumerated WHERE).** Instrumentation SHALL be placed at each boundary where information changes trust level or ownership, and the author SHALL treat **each** of these as an instrumentation point: user input; API request/response; database read/write; **queue publish/consume**; **workflow transition**; LLM/tool call; **file parse/import/export**; **auth/session check**; third-party service call. *↩ refines `§4.2` — DEGRADED (boundary-type enumeration dropped; `§2.4`'s list serves validation, not instrumentation).*
- **EP-OBS-2 (Decision traces — worked pattern).** A structured decision trace SHALL carry a **machine reason code**, **symmetric required-vs-observed fields**, and the **story/acceptance-criterion binding** so an exclusion is traceable to a requirement. *↩ refines `§4.3` — DEGRADED (the worked pattern was dropped).*
  ```text
  logger.info("contractor.filtered", {
    contractorId, reason: "license_jurisdiction_mismatch",
    requiredJurisdiction, observedJurisdiction,
    story: "US-142", acceptanceCriterion: "AC-3"
  });
  ```
- **EP-OBS-3 (Structured logs over prose — good/bad).** Operational events SHALL be logged as structured records, not prose strings, to enable search, aggregation, replay analysis, and agent-assisted debugging. *↩ refines `§4.4` — DEGRADED (good/bad example + rationale dropped).*
  ```text
  GOOD: logger.warn("bid_request.retry_skipped",
          { reason: "non_idempotent_operation", providerId, workOrderId, attempt });
  BAD:  logger.warn("Skipping retry because this might duplicate stuff");
  ```
- **EP-OBS-4 (Minimum correlation-ID set).** Every request, workflow, background job, queue message, model call, and outbound API call SHALL propagate correlation context including, where applicable: `requestId`, `traceId`, `userId` (or safe subject reference), `workflowId`, `taskId`, `externalRequestId`. *↩ refines `§4.4` — DEGRADED (the concrete minimum-ID set was dropped).*
- **EP-OBS-5 (Typed-error starter taxonomy).** Errors crossing a component/trust boundary SHALL use a stable classified code; absent a repository-specific vocabulary, the author SHALL use this starter taxonomy rather than inventing divergent codes: `VALIDATION_ERROR`, `AUTHORIZATION_ERROR`, `EXTERNAL_SERVICE_TIMEOUT`, `EXTERNAL_SERVICE_BAD_RESPONSE`, `STATE_TRANSITION_DENIED`, `IDEMPOTENCY_CONFLICT`, `MODEL_OUTPUT_INVALID`, `RETRY_EXHAUSTED`, `INVARIANT_VIOLATION`. *↩ refines `§4.5` — DEGRADED (example taxonomy dropped).*
- **EP-OBS-6 (Model/agent/tool call — confidence signal).** A model/agent/tool call record SHOULD capture the model's **confidence/uncertainty signal where available**, in addition to the `§4.7` fields. *↩ refines `§4.7` — DEGRADED (the confidence/uncertainty field was dropped).*
- **EP-OBS-7 (Log-level semantic taxonomy).** Severity SHALL follow this taxonomy: `debug` = high-detail diagnostics, disabled or sampled in production; `info` = meaningful business or system events; `warn` = unexpected but recoverable; `error` = failed operation requiring attention; `fatal` = process/system cannot continue safely. Normal control flow SHALL NOT be logged at `warn`/`error`. *↩ `§none` (only the derived control-flow rule survives in `§4.4`) — **ABSENT**.*
- **EP-OBS-8 (Technical-metric starter catalog).** Technical metrics SHOULD include, where applicable: request latency; error rate; queue depth; retry rate; timeout rate; dependency latency; database query duration. *↩ refines `§4.10` — DEGRADED (concrete catalog dropped).*
- **EP-OBS-9 (Product/workflow-metric catalog — business-outcome rates).** Metrics SHOULD cover product/work behavior as **business-outcome rates**, e.g.: intake clarification rate; search empty-result rate; request acceptance rate; vendor decline rate; **LLM-output validation-failure rate**; manual escalation rate; workflow abandonment rate. This teaches that a product metric is an outcome rate, not a technical counter. *↩ refines `§4.10` — DEGRADED (the load-bearing domain-metric catalog dropped).*
- **EP-OBS-10 (Dependency-health signal + guarded exposure).** A service SHALL expose an explicit **dependency-health** signal enumerating database, queue, cache, workflow engine, and model server; degraded mode SHALL distinguish missing critical from missing noncritical dependencies; health/readiness endpoints SHALL be exposed only to **authorized infrastructure**. *↩ refines `§4.10` — DEGRADED (explicit dependency-health signal, enumerated deps, and authorized-only exposure dropped).*
- **EP-OBS-11 (Replay artifact catalog).** Replay/reconstruction artifacts for a significant failure SHOULD include, in addition to `§6.5`'s set, a **model-output validation report** and a **state-transition log**. *↩ refines `§6.5` — DEGRADED (these two named artifact types dropped).*
- **EP-DBG-1 (Debugging completion-report — worked pattern).** A debugging completion report (`§5.2`) SHOULD follow the worked pattern: name the *broken assumption* (e.g., "missing preference ≠ budget preference"), the *corrective explicit-state* fix (introduce an explicit `UNKNOWN` state rather than inferring a default), the *variant test matrix* (missing/null/empty/explicit), and the *migration residual risk* for already-persisted records. *↩ refines `§5.2` — DEGRADED (the worked example dropped).*

---

## 4. Testing-as-Evidence Requirements (restores `JAN-ENGC-001 §6`–`§9`)

- **EP-TST-1 (Confidence is the objective).** The objective of testing SHALL be **confidence** that intended behavior occurred; a coverage percentage SHALL NOT be treated as the objective, and meeting a repository threshold SHALL NOT substitute for evidence that each affected rule, boundary, invariant, transition, contract, and known defect is tested. *↩ refines `§2.2/§6.8` — DEGRADED (the crisp "confidence, not coverage" maxim was diluted; `§6.8` partially re-centers a number).*
- **EP-TST-2 (Evidence forms per requirement — documented intent).** Every material requirement SHALL produce: deterministic implementation checks; automated tests; observable runtime behavior; **documented intent**; and explicit contracts. *↩ refines `§6.1` — DEGRADED ("documented intent" was dropped from the required forms).*
- **EP-TST-3 (Change-type triggers).** Evidence SHALL be increased or preserved for **every** triggering change type, explicitly including **prompt changes and infrastructure changes**, not only feature/bug-fix changes. *↩ refines `§6.1` — DEGRADED (the enumerated triggers collapsed; prompt/infra triggers lost).*
- **EP-TST-4 (Every bug becomes a permanent test — with the maxim).** A confirmed defect SHALL produce a regression test or replay fixture, improved observability, **and improved comments/documentation where appropriate**, such that **the same bug never occurs twice for the same reason**. *↩ refines `§2.5/§5.1/§6.5` — DEGRADED (the comments/docs learning duty and the memorable maxim were softened).*
- **EP-TST-5 (Evidence Pyramid — layer detail).** For each applicable `§6.2` layer, the author SHALL apply the concrete guidance the table row omits:
  - **Unit** — fast, deterministic, independent, exhaustive-where-practical; test parsing/transformations/calculations/formatting/validation/sorting/utilities; avoid databases/network/filesystem/timing. *↩ `§6.2 Unit` — DEGRADED.*
  - **Property/invariant** — worked forms: `normalize(normalize(x)) == normalize(x)`; `total >= subtotal`; "workflow cannot skip approval"; "duplicate import does not increase unique record count." Property tests find bugs example-based tests never do. *↩ `§6.2` — DEGRADED.*
  - **Integration** — exercise `API → Business Logic → Repository → Database`, incl. **message passing and authentication**; **prefer real infrastructure over mocks whenever practical** (see EP-TST-6). *↩ `§6.2` — DEGRADED.*
  - **Contract** — incl. GraphQL; **changes to external contracts SHALL fail tests immediately**. *↩ `§6.2/§6.3` — DEGRADED.*
  - **State-transition** — for a state machine, coverage SHALL ensure **every state reached, every transition exercised, every invalid transition rejected** (not merely changed-scope). *↩ `§6.2/§6.4` — DEGRADED.*
  - **End-to-end** — validate a complete professional journey, e.g. `request → clarification → research → ranking → selection → scheduling → completion`. *↩ `§6.2` — DEGRADED.*
  - **Chaos/resilience** — the failure catalog SHALL name **LLM timeouts, malformed responses, and network failures** alongside database/queue failures, duplicate events, and partial execution. *↩ `§6.2` — DEGRADED.*
  - **Production validation** — validate **feature flags and dashboards** in addition to telemetry/health/alerts/canary; production is the final testing environment. *↩ `§6.2/§4.10` — DEGRADED.*
- **EP-TST-6 (Mock discipline — prefer real infrastructure).** Tests SHALL prefer real infrastructure over mocks wherever practical, and **excessive mocking SHALL be avoided** — over-mocking produces tests that pass while the integrated system fails. *↩ `§none` — **ABSENT** (`JAN-ENGC-001` carries no mock-discipline steer at all).*
- **EP-TST-7 (Assert behavior, not implementation — worked contrast).** Assertions SHALL target externally-visible behavior/semantics. Prefer *"Homeowner receives only licensed contractors"* over *"`getLicensedContractors()` was called once"* — business semantics are more stable than implementation details. *↩ refines `§6.7` — DEGRADED (the contrast example dropped).*
- **EP-TST-8 (Prompt-regression dimensions).** A material prompt change SHALL be evaluated against a stable, versioned dataset across: structured output; **reasoning quality**; **business decisions**; tool selection; **consistency** — and SHALL NOT silently degrade behavior. *↩ refines `§6.6` — DEGRADED (three dimensions and "silently degrade" dropped).*
- **EP-TST-9 (Agent-trajectory tests — worked example).** For agent behavior, the **process** SHALL be tested, not only the final answer, e.g. a research agent should *search → expand radius if necessary → verify licenses → rank providers → explain ranking*. Trajectory quality is part of correctness. *↩ refines `§6.6` — DEGRADED (worked trajectory dropped).*
- **EP-TST-10 (Comment/documentation tests).** Where tooling permits, tests/validators SHALL check that **warnings remain accurate**, **TODOs include references**, and **comments do not contradict implementation** — comments are executable knowledge for future maintainers and agents. *↩ refines `§6.9` — DEGRADED (these specific checks and the framing dropped).*
- **EP-TST-11 (Per-change author self-questions).** As a compact author-facing set (distinct from the reviewer checklist), every change SHOULD answer: What behavior changed? What evidence proves correctness? What regression tests were added? What contracts changed? What observability changed? **What replay artifacts should be created?** What comments/documentation changed? *↩ refines `§8.3/§12` — DEGRADED (dispersed into report/review items, losing the author-facing interrogative set).*
- **EP-TST-12 (Consolidated testing anti-patterns).** The following SHALL be avoided as a single scannable set: testing private methods; brittle implementation-coupled tests; **excessive mocking**; happy-path-only testing; console debugging instead of automated evidence; coverage-driven development; **skipping regression tests**; trusting LLM output without validation; silent failures; manual verification as the only evidence. *↩ refines scattered `§4.12/§6.1/§6.4/§6.7/§6.8/§2.2` — DEGRADED (no consolidated list; "excessive mocking" has no active equivalent).*
- **EP-TST-13 (Source-code quality — SonarQube scanning).** A change SHALL run the SonarQube/SonarLint static analysis for source-code quality per the headless-remediation guide, and SHALL **fully address complexity findings** (which "almost always, if not always, should be addressed fully"); a remaining finding SHALL carry a recorded exception per `JAN-ENGC-001 §7.4`. The repository's own checked-in configuration is authoritative for *how* the scan runs (`§7.1`); the concrete guide at `JanumiCode/janumicode_v2/docs/sonarqube-headless-remediation-guide.md` and the workbench's SonarLint headless-driver practice are the operative pointers. *↩ refines `§7.1/§7.2/§7.3/§8.3` — DEGRADED (the tool name, the how-to-run pointer, and the completion duty were genericized to "static-analysis checks"; the sponsor's named example).*

---

## 5. Gap Register & Reconciliation Recommendation

### 5.1 The three fully-ABSENT items (highest priority)

| # | Dropped content | Restored by | `JAN-ENGC-001` |
| :-- | :-- | :-- | :-- |
| 1 | Observability-decision comments (comment the *why* of instrumentation) | EP-CMT-5 | none |
| 2 | Log-level semantic taxonomy (debug/info/warn/error/fatal) | EP-OBS-7 | none |
| 3 | Mock discipline (prefer real infrastructure / avoid excessive mocking) | EP-TST-6 | none |

### 5.2 DEGRADED restorations
All other requirements in §2–§4 carry a `↩ … DEGRADED` tag naming the clause each refines. The salvage classified ~35 DEGRADED/ABSENT items in total; every one is restored above (the completeness critic verified the extraction against both the governed doc and the retired source).

### 5.3 Recommendation (sponsor decision)
The requirements in §2–§4 SHOULD be reconciled **into `JAN-ENGC-001` itself** via its `§11` change control, so the restored specificity gains constitution-wide force rather than only program-local force. This document does **not** amend `JAN-ENGC-001` (an agent SHALL NOT self-approve a governed change — `JAN-ENGC-001 §10.1`); it records the delta and imposes it locally under the `§1.1` stricter-requirements allowance until the sponsor rules.

### 5.4 Content deliberately NOT restated
Content the salvage classified `PRESENT` (carried faithfully) is not re-prescribed here — e.g. self-documenting-code-first (`§3.1`), why-not-what (`§2.1`), invariant/error-handling comments (`§3.3/§3.2`), TODO discipline (`§3.5`), the state-transition and invariant-violation logging duties (`§4.8/§4.11`), retries/idempotency instrumentation (`§4.9`), failure-evidence capture (`§4.6`), the 9-step debugging workflow (`§5.1`), test-data practices (`§6.7`), and the Definition of Done (`§9`). For those, `JAN-ENGC-001` is sufficient and authoritative.

---

## 6. Provenance

Produced by an adversarial salvage over the retired descriptive source (three parallel extractors — commenting / observability-debugging / testing — each classifying every descriptive item against `JAN-ENGC-001` as carried/degraded/dropped, then a reconciliation pass with a completeness critic), run 2026-07-20 at SHA `2040ae37`, and calibrated against the sponsor-supplied known-answer (SonarQube, EP-TST-13), which the extraction independently recovered. Worked examples are quoted from the retired source; no requirement is invented (§1.5).

*End of JAN-PRPWA-EP-001 v0.1.0-draft.*
