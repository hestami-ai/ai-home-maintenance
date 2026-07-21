# JAN-PRPWA-DS-001 — Coherent-Leaf-with-Delegation Authoring Criterion

*A Prescriptive Design Specification for Comprehensive-by-Default PWA Authoring*

| Governance / Environment Field | Prescriptive Baseline Value |
| :--- | :--- |
| **Document ID** | `JAN-PRPWA-DS-001` |
| **Version** | `0.2.1-draft` (adversarially verified — see §13 Revision Note) |
| **Status** | `DRAFT` (design-session record; sponsor-ratified + delegated-authority decisions embedded — §9) |
| **Upstream Lineage** | Normative parent authority: `JAN-ENGC-001@1.0.1` (status: `NORMATIVE`, engineering-practice constitution, incorporated per §2.3). Subject-of-record oracle: `ASPLE@1.0-reference` (status: `EXTERNAL / SUBJECT-OF-RECORD`). |
| **Active Wave / Work Packages** | `JAN-PRPWA` program-instance (adopts `JAN-ROADMAP-001-A`) / detailed roadmap **`JAN-PRPWA-DR-001`** → work-packages **`JAN-PRPWA-DWP-01…07`**. *(The `WP-C1-{a…f}` labels used in §7 below are the design-time increments; `JAN-PRPWA-DR-001` is the authoritative implementation register and re-orders them per its RC-1.)* |
| **Repository Root & Branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| **Revision at Grounding** | Git Commit SHA: `2040ae37` |
| **Subject-of-Record Path** | `apps/rph-demo/src/lib/server/agent/` · `packages/rph-authoring/src/` · `packages/rph-contracts/vocab/` · `packages/rph-application/src/handlers/` · `packages/rph-projections/src/` |
| **Persistence Specification** | Engine: `better-sqlite3` (embedded SQLite; DOC-009 event-sourced + current-state hybrid); Schema: `packages/rph-persistence/src/schema.ts`; Count: `5` tables (`professional_work_objects`, `professional_work_object_versions`, `domain_events`, `outbox_messages`, `command_receipts`) + 2 indexes; Migrations: `SCHEMA_VERSION=1` baseline, forward-migration + fail-closed-on-newer (W2-INC-1). **This design adds NO tables**: the `executionBoundary` field and `boundaryContract` sub-object ride the existing `PwuType` object payload, validated at the write boundary. |
| **Runtime Configuration** | Workspace: `Turborepo + Bun monorepo (@janumipwb/*)`; Demo: `apps/rph-demo` (SvelteKit); Test Harness: `Vitest` (unit/component) + `Playwright` (e2e — system Edge, `RPH_DEMO_MODE=test`) + `svelte-check` + `eslint` + `dependency-cruiser` (boundary) |
| **Validation Purpose** | Validate the domain-agnostic **Coherent-Leaf-with-Delegation authoring criterion** (abstract architecture) against the **ASPLE Product-Realization instance** (concrete instance) instantiated from the **RPH / PWA composition-tree core pattern**. |
| **Scope of Fixture** | Establishes: the normative criterion for a legitimate **leaf** (*irreducible-within-scope* OR *delegated-across-a-boundary*); the **platform/content authoring boundary**; the **layered-prompt** architecture (agnostic core + domain template); the **calibrate-peel-diff** calibration method; the **boundary annotation + contract + assurance-by-attestation** model; **advisory (non-blocking) enforcement**. |
| **Deferred Elements** | reference-PWA→org-variant **variation layer** (R-11); Fixture C **(import-and-project)** (R-8); **V-model correspondence axis** rendering; **blocking** publication gate; the runtime **attestation-capture mechanism** (R-10). |
| **Retired Elements** | **declared-altitude field** — RETIRED (R-3), superseded by the leaf rule; distinct from Deferred (will not return absent a new spec). |

---

## 1. Preamble & Reading Contract

### 1.1 Purpose

This document is the **prescriptive record** of the design session that produced the Coherent-Leaf-with-Delegation authoring criterion for the JPWB PWA Designer. It is written to be sufficient for an implementing coding agent (or human engineer) to execute the design with rigor, without access to the originating conversation.

### 1.2 Audience

The primary reader is **the implementing coding agent**. Secondary readers are the sponsor and future maintainers.

### 1.3 Deontic conventions (normative)

This document uses **SHALL / SHALL NOT / SHOULD / SHOULD NOT / MAY** with the binding meanings of `JAN-ENGC-001 §1.3` (equivalently RFC 2119 MUST/MUST NOT/SHOULD/SHOULD NOT/MAY). SHALL/SHALL NOT are mandatory; SHOULD/SHOULD NOT are strong defaults requiring recorded justification to deviate; MAY is a permitted option. Examples are non-normative.

### 1.4 The Fallibility Clause (normative, and the point of this document)

This specification is **authoritative but not infallible**. The sponsor's intent is explicit: the implementing agent SHALL bring reasoned, rigorous professional judgment, using the constraints herein as guidance rather than as a substitute for thought.

- The agent **SHALL** treat this document as constraint *and* context, not as a mechanical checklist to satisfy literally at the expense of intent.
- On a gap, friction, ambiguity, or inconsistency, the agent **SHALL** apply the **Judgment Protocol (§10)**.
- The agent **SHALL NOT** treat the absence of a statement as a prohibition or as settled fact — *"the spec does not mention X"* is a claim about this text, never about the world (`JAN-ENGC-001 §4.12`: *"treating absence of evidence as evidence of absence"* is a prohibited anti-pattern).
- The agent **SHALL NOT** fabricate evidence, tests, or attestations to satisfy any clause or gate (`JAN-ENGC-001 §8.3`: *"SHALL NOT claim that a check passed when it did not run"*). A candid "unresolved" is REQUIRED over a false "done."

### 1.5 How the two frameworks are used, and how precedence works

Two orthogonal frameworks organize this document:

1. **The Governance & Operationalization Stack** (§2) — the *normative* spine, layering prescriptions from durable worldview to executable validators.
2. **The Design & Delivery Lifecycle** — `Envision → Research → Shape → Investigate → Plan → Implement → Assure` (§3–§8) — the *process* spine.

**Precedence (REQUIRED), scoped by concern-ownership then layer:**
- **Engineering-practice concerns** (how a change is commented, evidenced, observed, gated, completed) are governed by `JAN-ENGC-001`, which is **supreme within that scope** (`JAN-ENGC-001 §1.1`).
- **PWA-semantic concerns** (what a leaf is, what a PWU Type may declare, the assurance model) are owned by this document together with the canonical RPH/PWA specifications; `JAN-ENGC-001 §1.1` explicitly declines to redefine canonical semantics.
- **Within a scope**, the higher governance-stack layer governs: `Vision > Axioms > Constitution(engineering) > Doctrine > Policy > Standards > Specifications > Procedures > Controls`. Conflicts across scopes are resolved by §10.

---

## 2. The Governance & Operationalization Stack (Normative Core)

### 2.1 Vision / Worldview / Thesis

- **T-1.** JPWB exists so professional work can be **decomposed, executed, and assured** as a Recursive Professional Harness (RPH), such that outcomes approach completeness and correctness because every unit of work is bounded and assured.
- **T-2. Comprehensive-by-default.** An agent-authored PWA SHALL, by default, be **comprehensive in domain content** — decomposed until every leaf is legitimate (§2.6) — not a high-level map.
- **T-3. No green without assurance.** No unit of work is "done" absent discharged assurance. Inherited, not invented here; this design SHALL NOT weaken it.

### 2.2 Values, Axioms, and First Principles

- **A-1 (Decomposition-reliability axiom, adopted).** Agent hallucination and defect rates are inversely proportional to context and task abstraction; bounded, single-responsibility units are assured with far higher reliability than coarse ones. *(Adopted as domain-agnostic rationale; its ASPLE provenance does NOT make ASPLE a design input to the platform — D-2.)*
- **A-2 (Scope-relative irreducibility).** "Irreducible" is relative to an **accountability scope**. A unit decomposable to one party may be atomic to another.
- **A-3 (Assurance-bounded decomposition).** Correct decomposition depth is the depth at which the **platform assurance floor becomes reliable** per leaf. Under-decomposition is an **assurance hole**.
- **A-4 (Platform/content separation).** Professional *work* (content) is distinct from the *substrate* that runs it (platform). Authoring produces content and does not re-specify substrate.
- **A-5 (Epistemic humility).** All specifications, prompts, catalogs, and criteria are fallible; rigor resolves their gaps by principle (§10). Mirrors `JAN-ENGC-001 §2.7` (No Invented Rationale) and `§10.3` (Conservative Escalation).

### 2.3 Constitution / Charter (incorporated by reference and binding)

This design is **subordinate, within its engineering-practice scope, to `JAN-ENGC-001` — the Janumi Professional Workbench Engineering Constitution, v1.0.1, Status Normative, effective 2026-07-17**, at `docs/Recursive Professional Harness/Janumi Professional Workbench - Engineering Constitution.md`. Per that document's own metadata and §1.2, the byte-preserved source under `retired/` **carries no current authority**; the controlled variant governs. Per `JAN-ENGC-001 §1.1`, the Constitution governs *engineering practice* and does **not** redefine PWA semantics — so it binds the STD-4/§8 layers of this design, while STD-1…STD-3 (PWA semantics) are owned here and by the canonical docs. **Companion normative doc:** the retired source's descriptive engineering-practice content that `JAN-ENGC-001` genericized or dropped is restored — as stricter, program-local requirements per `JAN-ENGC-001 §1.1` — in **`JAN-PRPWA-EP-001`**; implementers SHALL apply it alongside `JAN-ENGC-001` for all `Wave PRPWA-C` work.

Binding obligations, restated for the implementer with clause locators:

- **C-1 (Comments are part of the implementation contract)** — `§2.1, §3.2, §3.3, §3.7`. New code SHALL carry *why/constraint/boundary/invariant/tradeoff* comments where intent is non-obvious; SHALL NOT narrate obvious behavior; SHALL NOT drift. Inferred rationale SHALL be labeled inferred (`§2.7`).
- **C-2 (Observability of decisions, not just failures)** — `§2.3, §4.3, §4.7, §4.8`. Code branching on the leaf criterion or authoring classification SHALL emit structured **decision evidence** (e.g. `leaf.classified` with `reason: irreducible | delegated`) where reconstruction would otherwise be hard; boundary crossings (delegated nodes) and rejected transitions SHALL be observable. Private chain-of-thought SHALL NOT be logged.
- **C-3 (Evidence, not coverage)** — `§2.2, §6.2, §6.8`. Every requirement SHALL produce evidence across the `§6.2` Evidence Ladder (Unit → Property/invariant → Integration → Contract → Boundary → State-transition → End-to-end → Replay → Chaos → Production). Coverage is a diagnostic, not proof.
- **C-4 (Definition of Done)** — `§9`. See §8; the DoD's seven questions are quoted verbatim there.
- **C-5 (Trust boundaries; never trust model/external output)** — `§2.4, §4.7, §4.12, §6.3`. LLM/agent/external output — including this agent's own proposals and any counterparty attestation — SHALL be validated at the boundary before it becomes authoritative state.
- **C-6 (Quality findings & complexity)** — `§7.2, §7.3, §7.4`. Findings SHALL be inspected (not just exit codes) and remediated fully by default; complexity in changed code SHALL be addressed by clearer decomposition; a finding MAY remain only under a recorded, approved exception.

### 2.4 Doctrine

- **D-1 (Layered prompt).** Authoring grounding SHALL be factored into a **domain-agnostic CORE** (STD-1 criterion, comprehensive-by-default, the negative platform rule D-3, and **the three planes — D-1a**) and a **pluggable DOMAIN TEMPLATE** (ladder rung names, leaf-floor granularity, framework vocabulary, correspondence axis). The engine and criterion are domain-agnostic; only the template is domain content.
- **D-1a (The three planes — definition).** A PWA is read on three distinct, non-interchangeable planes; the agnostic core SHALL teach all three and keep them distinct:
  1. **Composition architecture** — the `permits` tree ("what is this made of?"); timeless; does not imply order.
  2. **Artifact hand-off** — `requiredOutputs → requiredInputs` matching by artifact name; a *dependency* relation, NOT a schedule; carries traceability (e.g. `JTBD_ID ↔ SRS_ID ↔ AFU_ID ↔ Test_ID`).
  3. **PWU lifecycle** — the per-unit state-machine exercised during an Undertaking (the `Envision→Assure` arc as it plays out for one unit); PWU Types are definitions and carry no instance state.
  ~~The **V-model correspondence axis** (left-decomposition ↔ right-verification) is a **deferred 4th plane** (§11), NOT one of the three.~~ **[CORRECTION 2026-07-21 — struck per D-2.** The V-model is domain SDLC *framework vocabulary* that may appear INSIDE an authored PWA's content, not a platform rendering plane. Promoting an ASPLE-internal framework to a platform "4th plane/overlay" is a platform/content category error (D-2: ASPLE is subject, not source); it also over-fits the platform to one domain (Fixture B "get bloodwork" has no V-model). The spec↔verification correspondence it describes is already carried by **plane 2 (artifact hand-off** — `SRS_ID ↔ Test_ID`, above) and discharged by the assurance floor's Reasoning Review. Per **D-1**, any correspondence axis is *domain-template content*, never a 4th plane. There is nothing to build and nothing to defer.**]** *This trio is distinct from §5.2's platform/content three-way classification and from STD-1-I(d)'s floor triad; the agnostic core SHALL NOT conflate them.*
- **D-2 (ASPLE is subject, not source).** ASPLE is a **subject-of-record** — a PWA-to-be-authored and a calibration oracle — and SHALL NOT be treated as a design input to the platform. Where ASPLE names platform concerns (e.g. "Governed Stream"), those are **leaks** to be projected out (D-3), not content to author.
- **D-3 (Platform/content negative rule).** The agent SHALL NOT author platform substrate as PWU Types. Substrate includes: the event ledger (concretely `domain_events`), memory/narrative synthesis, loop/retry control, **context-engineering / JIT context assembly**, credential issuance, and the universal assurance floor. The agent SHALL author only domain work and its domain-specific review sub-phases.
- **D-4 (Two kinds of leaf).** A node is terminal for exactly one of two reasons: **irreducible-within-scope** (splitting fragments one professional judgment) or **delegated-across-a-boundary** (real, decomposable work belonging to another organization). A merely "coarse for presentation" leaf is neither and is subject to the advisory (P-2).
- **D-5 (Calibrate-peel-diff).** Criteria and templates SHALL be validated by: capturing a known-cold `(intent → projected-oracle)` fixture; peeling agnostic-core from domain-template; and diffing agent output against the **projected** oracle. Omission of platform elements is CORRECT and SHALL NOT be scored as a gap.

### 2.5 Policy

- **P-1 (Comprehensive-by-default authoring).** Given underspecified intent, the agent SHALL decompose the domain work until every leaf is legitimate (§2.6). "Comprehensive" means **content-complete, not platform-respecified** (D-3).
- **P-2 (Advisory, non-blocking enforcement).** Under-decomposition SHALL be surfaced as an **advisory** finding. The agent self-check tool `review_composition` SHALL invoke `lintComposition` and surface its findings; the same function backs any human read. The advisory **SHALL NOT** block commit or publication (INV-6). Rationale: leaf legitimacy is a professional judgment; a hard gate would also change gate semantics for every existing PWA (including the seed). *(Supersedes any earlier notion of a blocking under-decomposition gate.)*
- **P-3 (Assurance-by-attestation at boundaries).** For a delegated leaf the platform floor does NOT execute the external work. Assurance is **relocated, never removed** (T-3): green-at-a-boundary is defined in R-10. The agent SHALL author the boundary contract (STD-3).
- **P-4 (Judgment over literalism).** Implementers SHALL apply §10; the ratified decisions (§9) govern where present.

### 2.6 Standards

**STD-1 — The Leaf Criterion (central standard).** A PWU Type is a **legitimate leaf** iff it satisfies **STD-1-I** *or* **STD-1-D**.

- **STD-1-I (Irreducible-within-scope).** All four hold (conjunctive; all REQUIRED; not a menu):
  - **(a)** a single accountable executor (one professional role / one agent) can produce its work end-to-end;
  - **(b)** it yields exactly one nameable, verifiable output;
  - **(c)** splitting it would fragment a single professional judgment rather than reveal distinct responsibilities; **and**
  - **(d)** it sits within the **reliability envelope of the platform assurance floor** — bounded enough that the floor (Output Contract & Invariant Integrity · Identity/Provenance/Trace · Reasoning Review; `packages/rph-assurance/src/floor-policies.ts`) can trustworthily discharge it.
  - The agent SHALL apply rigor to the (c)/(d) judgment; per R-5 this is judgment, not a machine-check.
- **STD-1-D (Delegated-across-a-boundary).** The work lies outside the authoring organization's accountability scope; from that scope it presents as a single external party, one contracted output, not ours to decompose. A delegated leaf satisfies STD-1-I *relative to our scope* (A-2) but SHALL be marked explicitly (STD-2) because it changes what is authored (STD-3) and who discharges assurance (R-10).

**STD-2 — Execution-Boundary Annotation.** Each PWU Type SHALL carry an `executionBoundary` value, enum `{ INTERNAL (default), DELEGATED_EXTERNAL }` (R-9). A `DELEGATED_EXTERNAL` node is terminal by definition and SHALL NOT declare permitted child types (INV-1). The automation axis (autonomous-agent vs human-required; *ASPLE §2.3*) is a **separate future field** (R-9), NOT folded into this enum.

**STD-3 — Boundary Contract (the ICD at the org boundary).** A `DELEGATED_EXTERNAL` node SHALL author, in lieu of an internal decomposition, a `boundaryContract` sub-object: `{ counterpartyLabel, attestedAssurancePolicyIds[], applicabilityNote? }`. The required inputs supplied to / outputs consumed from the counterparty reuse the existing `requiredInputs` / `requiredOutputs` fields (the artifact hand-off plane, D-1a.2). This is the professional-work generalization of *"depend on an interface, not an implementation."*

**STD-4 — Engineering-practice standards.** All implementation artifacts SHALL conform to `JAN-ENGC-001` (C-1…C-6): comments-as-contract, decision observability, the `§6.2` Evidence Ladder, quality gates, and the `§9` Definition of Done.

### 2.7 Specifications

- **SPEC-1 (System prompt — agnostic core).** `apps/rph-demo/src/lib/server/agent/system-prompt.ts` SHALL be extended to state STD-1 (both branches), P-1, D-3, and the three planes (D-1a). *Grounded current state: the prompt contains NONE of these; it only discourages fan-out and asserts "depth is good." The asymmetry is the defect.*
- **SPEC-2 (Lint — under-decomposition advisory).** `packages/rph-authoring/src/lint.ts` SHALL gain an advisory finding, the **symmetric partner** to the existing `checkFanout`. *Grounded current state: `lintComposition` checks only root-count, fan-out (`FANOUT_LIMIT = 5`), and orphans — no under-depth check.* Behavior:
  - It **SHALL NOT** fire on a `DELEGATED_EXTERNAL` node (structurally enforceable — INV-4a).
  - For an `INTERNAL` leaf it is a **heuristic keyed on structural proxies**: fires when the leaf declares **more than one distinct `requiredOutput`** (a multiple-responsibility signal), OR bears a `pwuKind` the active domain template lists as `typicallyDecomposed`, OR sits on a branch shallower than a template-declared expectation. Per R-5 this heuristic MAY false-positive on a genuinely-irreducible leaf; being advisory, the author MAY dismiss it (INV-4b). A future `declare_rationale`-borne irreducibility rationale MAY suppress the advisory, but is not required now.
- **SPEC-3 (Boundary annotation — contracts thread).** `executionBoundary` (enum) + `boundaryContract` (sub-object, R-9) SHALL be threaded vocab → generated contracts → handler → broker → UI. `executionBoundary` defaults `INTERNAL` (additive; existing types unaffected). This **replaces** the retired declared-altitude field (R-3) at comparable cost with real contract/assurance semantics. Agent tools (`tools.ts`) and inspector UI SHALL expose both. Fields SHALL be authored **per PWU Type** (never a global PWA setting — forward-compat F-1, R-11).
- **SPEC-4 (Domain template).** Template content (ladder: Epic/Feature/Story/AFU or SRS/Subsystem/AFU; leaf floor = AFU with `~200 LOC` as a **template-local proxy, NOT engine law**; frameworks: JTBD/UCD/V-model/FDD/TDD; domain review PWUs such as CACA constructive-critique) SHALL be sourced from the projected ASPLE fixture (§4). A domain template is a governance artifact authored per R-12.
- **SPEC-5 (Calibration fixtures).** Three fixtures (labels are disjoint; the record's "2a/2b" map to A/C):
  - **Fixture A — author-from-intent (ASPLE)** — primary calibration oracle; `(original intent → projected ASPLE)`; exercises STD-1, D-3, platform/content discrimination.
  - **Fixture B — bloodwork trio (delegation)** — exercises STD-1-D / STD-2 / STD-3 across three boundary placements (ASPLE is mostly internal).
  - **Fixture C — import-and-project** — deferred (R-8; PB-4).
  Scoring diffs against **projected** oracles only (D-5); platform omissions are passes.

### 2.8 Procedures and Playbooks

- **PB-1 (Authoring playbook — per node).** For each unit: (1) determine accountability scope; (2) classify — internal or delegated; (3) if delegated → author `boundaryContract` (STD-3), stop; (4) if internal and irreducible (STD-1-I) → leaf; (5) else → decompose and recurse. Finish with `declare_rationale` (existing obligation).
- **PB-2 (Calibration playbook).** Run Fixture A: author from intent → project out platform leaks → diff against projected ASPLE → each surviving gap becomes a prompt/lint work item.
- **PB-3 (Implementation playbook).** Execute Increments 0–5 (§7) in order; each SHALL pass its gate before the next; no increment MAY silently narrow scope without a recorded note (`JAN-ENGC-001 §3.5`: no ambiguous deferrals).
- **PB-4 (Import playbook — DEFERRED, Fixture C).** For enterprise robustness: classify each foreign element as *platform-satisfied / author-as-PWU / out-of-model*; reconcile foreign substrate against JPWB invariants; treat foreign content as an untrusted DRAFT proposal (C-5), never gospel. Out of scope for this wave (R-8 §9.1; §11).

### 2.9 Controls, Invariants, and Validators

Each invariant is REQUIRED and SHOULD have an automated validator (C-3):

- **INV-1.** A `DELEGATED_EXTERNAL` node SHALL author a `boundaryContract` and SHALL NOT declare permitted child types. *(Validator: property + contract test.)*
- **INV-2.** The platform floor's substantive/Reasoning-Review discharge SHALL NOT be represented as satisfied for a delegated node's external work; its substantive assurance is the counterparty attestation (R-10). *(Validator: unit/contract test on the assurance projection.)*
- **INV-3.** "Comprehensive" SHALL NOT entail authoring platform substrate; a PWU Type **SHALL NOT** be created for a substrate concern (D-3). *(Validator: Fixture A diff — projected-ASPLE omissions are correct.)*
- **INV-4a (enforceable).** The under-decomposition advisory **SHALL NOT** fire on a `DELEGATED_EXTERNAL` node. *(Validator: unit test.)*
- **INV-4b (heuristic, not an invariant).** For `INTERNAL` leaves the advisory is a structural-proxy heuristic (SPEC-2) that MAY raise a false positive on a genuinely-irreducible leaf; the author MAY dismiss it. It is deliberately NOT stated as an absolute invariant, consistent with R-5.
- **INV-5 (inherited, SHALL NOT weaken).** Execution authority ≠ assurance authority. This design touches neither; implementers SHALL NOT introduce a path where authoring self-certifies assurance.
- **INV-6.** A commit or publication **SHALL NOT** be blocked by an under-decomposition finding (P-2). *(Validator: e2e — an intentionally coarse PWA still commits, advisory present.)*

---

## 3. Envision

**Stakeholder need & quality goal.** An agent-authored PWA (the ASHRAE data-center lifecycle) rendered as a shallow three-level map: legible but under-specified, with leaves meaning only "no children authored yet." The goal: the agent SHALL, by default, produce a **comprehensive** decomposition whose leaves are **professionally irreducible or explicitly delegated**, with the tool exerting principled pressure toward that depth — while remaining honest that leaf legitimacy is a judgment, and robust to enterprises arriving with predefined process definitions.

*Cross-domain situating (informative).* The `Envision→Assure` lifecycle is domain-agnostic; JPWB's purpose is to help professionals traverse it under assurance, which is why D-1 separates the universal spine from the domain template:

| Lifecycle phase | Software | Medicine | Law | Autonomous systems |
| :--- | :--- | :--- | :--- | :--- |
| Envision | Stakeholder needs & quality goals | Patient goals & clinical obligations | Client objectives & legal duties | Safety goals & intended use |
| Research | Codebase, standards, prior art | Records, evidence, history | Law, precedent, facts | Standards, incidents, models & data |
| Shape | Architecture & interfaces | Differential & care structure | Case theory / transaction structure | System & safety architecture |
| Investigate | Prototype, benchmark, analysis | Examination, test, consultation | Discovery & due diligence | Simulation, scenarios & testing |
| Plan | Release & migration plan | Care & follow-up plan | Litigation / transaction strategy | Validation, deployment & fallback |
| Implement | Build & deploy | Treat & communicate | Advise, draft, file, advocate | Build, deploy & operate |
| Assure | Test, review & acceptance | Consent, follow-up, peer review | Professional judgment & adjudication | Safety case, certification, runtime assurance |

The "get bloodwork" example (§5.4) shows why **Research/Shape** cannot be fully universal: the organizational boundary — where one party's `Envision→Assure` ends and another's begins — is domain- and organization-specific.

---

## 4. Research

Artifacts examined at grounding (SHA `2040ae37`):

- **Current authoring grounding** — `system-prompt.ts`: emphasizes 2–4 top-level areas and "depth is good," but states **no** leaf/stopping criterion and **no** platform/content boundary.
- **Current lint** — `packages/rph-authoring/src/lint.ts`: `lintComposition` = root-count + fan-out (`FANOUT_LIMIT = 5`) + orphans. **No under-decomposition check** — enforcement is asymmetric.
- **Current leaf semantics** — `packages/rph-projections/src/pwa-graph-report.ts`: leaf = `permittedChildTypeIds.length === 0` — purely structural.
- **Assurance floor** — `packages/rph-assurance/src/floor-policies.ts`: three de-minimis floor policies — Output Contract & Invariant Integrity (deterministic, BLOCKING), Identity/Provenance/Trace (deterministic, BLOCKING), Reasoning Review (MODEL_JUDGMENT, `DIFFERENT_MODEL` independence, applies **only to AI-produced subjects**). Grounds STD-1-I(d) and R-10.
- **Existing attestation primitive** — `packages/rph-application/src/handlers/pwu.ts` + `messages.ts`: `shapeReadinessAttestationId` with a semantic-version staleness guard ("an attestation must reference the specific version reviewed, or it is stale"); and `validators.ts §8.10` "disclosure is not verification." R-10 composes with these rather than inventing attestation.
- **PwuType object** — `packages/rph-contracts/vocab/m1-object-fields.json`: fields include `pwuKind`, `permittedChildTypeIds`, `permittedChildren` (`PermittedChildRule[]`, the ratified helper-subtype pattern R-9 mirrors), `requiredInputs`/`requiredOutputs`, `requiredAssurancePolicyIds`. Generated to `packages/rph-contracts/src/*` via `bun run gen`.
- **Platform ledger** — `packages/rph-persistence/src/schema.ts`: `domain_events` is the append-only ledger — the concrete "Governed Stream" the negative rule (D-3) refers to.
- **Subject-of-record oracle** — `docs/Product Realization PWA Test Scenario/Agentic System-Product Lifecycle Engine (ASPLE).md`.
- **Engineering Constitution** — `JAN-ENGC-001` v1.0.1 Normative (§2.3).

---

## 5. Shape

### 5.1 The layered architecture
Per D-1, grounding splits at the **agnostic-core / domain-template** seam. The engine and STD-1 criterion are universal; the ladder, vocabulary, and floor-granularity are template content.

### 5.2 The platform/content boundary
Three-way **classification** (PB-1 / PB-4; distinct from the D-1a three *planes*): **platform-satisfied** (do not author) · **author-as-PWU** (domain work) · **out-of-model** (flag, do not fake). The **assurance seam**: universal assurance → platform **floor**; domain-specific substantive review → **authored PWU** (e.g. CACA). ASPLE's IAG/Reasoning Review is in the floor; ASPLE's CACA is an authored review PWU.

### 5.3 Two kinds of leaf
Legitimate because **irreducible-within-scope** (STD-1-I) or **delegated-across-a-boundary** (STD-1-D). This retires the "declared altitude" dial (R-3): the reason a PWA legitimately varies in depth is usually *where the organizational boundary cuts* (structural), not a presentation preference. A genuinely intentional coarse overview — work that is ours and simply undecomposed — is neither irreducible nor delegated and attracts the **advisory** (P-2), which the author MAY accept.

### 5.4 Organizational boundary — the worked example

| Organization | "draw blood" | "analyze bloodwork" | Leaf structure |
| :--- | :--- | :--- | :--- |
| Integrated (e.g. large HMO) | internal | **internal** → decomposed into the lab's PWUs | analysis is **not** a leaf |
| Small/medium office | internal | **delegated** to external lab | "external lab analysis" is a **boundary leaf** (contract + hand-off) |
| Single-physician office | delegated (referral) | delegated | leaf = "refer to external provider" |

This is the ICD pattern (STD-3); ASPLE already carries it (ICDs *ASPLE §3.2*, and the autonomous-vs-human node mark *ASPLE §2.3*).

---

## 6. Investigate

**Method: calibrate-peel-diff (D-5).** Validate against domains known cold rather than assert.

- **Fixture A (primary)** — author-from-intent: does the agent produce the correct **projected** PWA (comprehensive; leaves irreducible or delegated; CACA authored; platform *not* authored)? Exercises STD-1, D-3, and platform/content discrimination in one shot.
- **Fixture B** — bloodwork trio: exercises STD-1-D / STD-2 / STD-3 across three boundary placements.
- **Fixture C** — import-and-project: deferred (R-8; PB-4).

Per D-5 and INV-3, omission of platform elements is a *pass*. Each surviving diff is a prompt/lint work item.

---

## 7. Plan

> **Authoritative implementation register:** these design-time increments are realized as `JAN-PRPWA-DWP-01…07` in the detailed roadmap **`JAN-PRPWA-DR-001`** (conforming to `JAN-ROADMAP-001-A`), which grounds them against the repo, adds the §5 work-package contracts, and re-orders lint after contracts (RC-1). The table below is the design intent; DR-001 governs sequencing and gates.

Increments are Work Packages `WP-C1-{a…f}` (Increments 0–5). Each SHALL **land → gate → commit** before the next. Gates are central (never delegated to a sub-agent): `bun run check-types` · `bun run test` · `bun run lint` · `bun run boundary` · `apps/rph-demo` svelte-check · Playwright e2e (`RPH_DEMO_MODE=test`). Rebuild changed package dists before svelte-check/e2e.

| WP | Increment | Deliverable | Gate |
| :--- | :--- | :--- | :--- |
| `WP-C1-a` | **0 · Prompt-only core** | SPEC-1: STD-1 (both branches) + P-1 + D-3 + the three planes (D-1a) into `system-prompt.ts`. No contracts touched. | check-types + test; validate via Fixture A diff |
| `WP-C1-b` | **1 · Under-decomposition advisory** | SPEC-2 in `lint.ts`; INV-4a enforceable, INV-4b heuristic; tests for both leaf kinds. | check-types + `rph-authoring` tests |
| `WP-C1-c` | **2 · Boundary annotation contracts** | SPEC-3 / STD-2: `executionBoundary` + `boundaryContract` (R-9) through vocab → handler → broker; INV-1. | check-types + `rph-contracts`/`rph-application`/`rph-authoring` tests |
| `WP-C1-d` | **3 · Boundary contract + agent tools** | STD-3 authoring surface; delegated leaf authors a contract; `tools.ts` + `system-prompt.ts` prose; INV-1/INV-2; R-10 authoring-time obligations. | check-types + e2e (mock path) |
| `WP-C1-e` | **4 · UI: annotation + inspector + advisory** | boundary annotation + delegated-contract in form/inspector; advisory surfaced via `review_composition`; INV-6. | svelte-check + e2e |
| `WP-C1-f` | **5 · Calibration harness** | SPEC-5: Fixtures A + B as replay/contract tests; diff-vs-projected scoring. | full test + e2e + boundary + lint |

Deferred beyond this wave (§11): variation layer (R-11), Fixture C (R-8), V-model correspondence rendering, the runtime attestation-capture mechanism (R-10).

---

## 8. Assure

Acceptance is governed by `JAN-ENGC-001 §6.2` (Evidence Ladder) and `§9` (Definition of Done). Per `§9`, the final evidence SHALL allow a future human or AI agent to answer, **verbatim**:

> *What is this supposed to do? · Why does it exist? · How do we know it works? · Which assumptions and contracts does it depend on? · What happens when those assumptions fail? · How would a regression be detected? · How would a production failure be diagnosed?*

Required evidence by `§6.2` layer (each REQUIRED unless marked; inapplicable layers MAY be omitted with a recorded reason per `§6.2`):

- **Unit** — the leaf classifier (STD-1-I clauses; delegated recognition).
- **Property / invariant** — INV-1 (delegated ⇒ no children); **INV-4a** (advisory never fires on `DELEGATED_EXTERNAL` — the machine-checkable claim; *not* the unsatisfiable "never flags a legitimate leaf"); consistency of `executionBoundary`/`boundaryContract` through the contracts thread.
- **Integration** — the `executionBoundary` + `boundaryContract` round-trip through command → handler → event → projection (SPEC-3 / WP-C1-c/d), incl. persistence and serialization.
- **Contract** — the vocab/generated-contract changes (STD-2/STD-3); the Fixture A diff against **projected** ASPLE as a contract/replay test (SPEC-5).
- **Boundary** — malformed/oversized `boundaryContract` and `executionBoundary` rejected at the write boundary (C-5).
- **State-transition** — authoring-turn states unaffected; if touched, every legal/illegal transition tested (`§6.4`).
- **End-to-end** — author-from-intent yields ≥1 delegated leaf and a comprehensive tree; an intentionally coarse PWA still commits with the advisory present (INV-6).
- **Replay** — Fixtures A/B serve as replay-style regression evidence (`§6.5`).
- **Observability (SHOULD, testable)** — `leaf.classified` decision evidence and boundary-crossing events emit structured telemetry (C-2; `§6.9`).
- **Chaos / Production** — N/A for a prompt/lint/contract-field change (recorded per `§6.2`).

**No fabricated passes.** Per §1.4, A-5, and `JAN-ENGC-001 §8.3`, the agent SHALL NOT synthesize a green gate; a failed or skipped step SHALL be reported with its output.

---

## 9. Decision Record

### 9.1 Ratified (sponsor authority; design session 2026-07-20)

- **R-1.** Leaf rule FINAL: legitimate leaf ⇔ *irreducible-within-scope* (STD-1-I) OR *delegated-across-a-boundary* (STD-1-D).
- **R-2.** STD-1-I's (a)–(d) are **conjunctive** (all four), applied by agent judgment.
- **R-3. Fork 1 (declared-altitude dial): RETIRED** (not deferred). Residual handled by the advisory (P-2).
- **R-4.** Enforcement: **prompt (primary) + advisory lint**, **no blocking gate** (P-2).
- **R-5.** Machine-check ceiling: the criterion is **agent judgment**; lint provides **structural proxies only**. No hard machine-check of "professionally irreducible."
- **R-6.** Platform/content: CACA = authored PWU; IAG/Reasoning Review = platform floor; Governed Stream et al. = platform (D-3).
- **R-7.** Organizational boundary **folds into this pass** (STD-1-D / STD-2 / STD-3 / R-10 in scope; variation layer deferred).
- **R-8.** Calibration scored against **projected** ASPLE; Fixture A primary; Fixture C (import) deferred.

### 9.2 Ratified under delegated authority (sponsor grant 2026-07-20: *"author robust solutions with rigor"*; sponsor MAY override)

- **R-9 (was O-1 — boundary annotation shape).** Add `executionBoundary` enum `{ INTERNAL (default), DELEGATED_EXTERNAL }` + a `boundaryContract` helper sub-object (STD-2/STD-3), modeled on the ratified `PermittedChildRule` helper pattern; additive, default `INTERNAL` (back-compat). The autonomous-vs-human **automation axis is NOT folded in** — it is a separate future field (`performerMode`), because `executionBoundary` answers *whose work / ours to decompose & assure* while automation answers *how an internal node is performed*; conflating orthogonal axes into one enum yields ill-defined cross-products and violates JPWB's one-axis-per-field discipline. Forward rule: STD-1-D and the lint key **only** off `executionBoundary`, so `performerMode` can be added later without rework.
- **R-10 (was O-2 — assurance-by-attestation).** For a `DELEGATED_EXTERNAL` node, **green-at-a-boundary** = **(i)** the deterministic floor policies WE run on the boundary crossing pass — *Output Contract & Invariant Integrity* (the received output conforms to the authored contract/ICD) and *Identity/Provenance/Trace* (the admitted output is traceable) — **AND (ii)** a **non-stale counterparty attestation** is on record against the current contract version, covering `boundaryContract.attestedAssurancePolicyIds`. The attestation is recorded as a **provenance-bearing CLAIM, not verification** (C-5; *"disclosure is not verification"*), reusing the existing `shapeReadinessAttestationId` staleness pattern. It **substitutes for Reasoning Review**, which cannot run on external work (that policy applies "only to AI-produced subjects"; we do not observe the counterparty's reasoning). Invariants preserved: **T-3** (assurance relocated, not removed), **INV-2** (our substantive floor never claimed for external work), **INV-5** (counterparty executes; attestation is their claim; our admission checks are independent; authoring never self-certifies). **In scope now (authoring-time):** the agent SHALL populate `attestedAssurancePolicyIds` from the **ACTIVE** policy library (same validation as `requiredAssurancePolicyIds` — reject DRAFT/SUSPENDED/floor ids) + `counterpartyLabel`. **Deferred:** the Undertaking-time attestation-capture/staleness mechanism.
- **R-11 (was O-3 — variation-layer deferral + forward-compat).** The reference-PWA→org-variant **variation layer stays deferred** (a single PWA already carries delegated leaves; the multi-variant relation is orthogonal). To avoid rework, the in-scope work SHALL honor a **forward-compatibility contract**:
  - **F-1.** `executionBoundary`/`boundaryContract` SHALL be authored **per PWU Type** (never a global PWA setting), so a future org-profile can override per type.
  - **F-2.** No component SHALL assume a conceptual unit has a **fixed** boundary (the same work is INTERNAL in one org's PWA, DELEGATED in another's). The leaf criterion + lint SHALL operate on the **resolved** boundary of a type within its PWA, so a future profile-resolution pass slots in without touching them.
  - **F-3.** `boundaryContract` SHALL be **self-contained** (counterparty + attested policies + note), so a profile can rebind it without dangling cross-references.
- **R-12 (was the record's dropped fork — domain-template authorship).** A domain template is a **governance artifact** (it defines a domain's leaf floor, ladder, and vocabulary), so it inherits the existing **"agent drafts, human activates"** rule modeled on `create_assurance_policy`: the agent MAY propose a template as a **DRAFT** shared-library artifact; a template becomes **ACTIVE** (usable to ground authoring) only via **explicit human ratification**. The agent SHALL NOT self-activate a template.

*No open sub-decisions remain. The sponsor MAY override R-9…R-12; until then implementers SHALL follow them and SHALL surface any friction per §10.*

---

## 10. Judgment Protocol (Fallibility Resolution)

On a gap, friction, ambiguity, or inconsistency between this document, the code, `JAN-ENGC-001`, or the sponsor's decisions, the implementing agent SHALL:

1. **Classify** (missing spec · internal contradiction · spec-vs-code drift · under-specified judgment · cross-layer or cross-scope conflict).
2. **Resolve by scope then precedence (§1.5).** An engineering-practice conflict yields to `JAN-ENGC-001` within its scope; a PWA-semantic conflict is owned here + the canonical docs; within a scope the higher stack layer governs.
3. **Prefer the assurance-preserving reading** (T-3, INV-2, INV-5) and, per `JAN-ENGC-001 §10.3`, the **stricter** interpretation when safety is uncertain.
4. **Re-derive, do not assume absence** (§1.4; `§4.12` anti-pattern).
5. **Surface material conflicts** with a structured record — what conflicted, which layers/scopes, the chosen resolution, the assumption relied upon — in the change description and, where code encodes the decision, as an `Inferred rationale:` comment (`§3.4`). A deviation from a `JAN-ENGC-001` SHALL/SHALL NOT additionally requires the `§10.1` deviation record; an agent SHALL NOT self-approve it (`§10.1`).
6. **Never fabricate to satisfy a clause** (§1.4, §8; `§8.3`). A recorded "unresolved — sponsor input required" is REQUIRED over a false completion.

This protocol is the operative expression of the sponsor's intent: **the documentation supplies constraints and context; the agent supplies rigor and judgment, and is accountable for both.**

---

## 11. Deferred Elements & Non-Goals (explicit)

Out of scope for Wave PRPWA-C; SHALL NOT be implemented under this document without a new/updated specification:

- **Variation / specialization layer** (reference PWA + per-org variants; product-line variability) — R-11.
- **Fixture C — import-and-project** — R-8; PB-4.
- **V-model correspondence axis** (the deferred 4th plane; left↔right: SRS↔SAT, Subsystem↔Integration, AFU↔Unit).
- **Blocking publication gate** on under-decomposition (contra P-2).
- **Runtime attestation-capture mechanism** — R-10 is *modeled* now; the Undertaking-time capture/staleness runtime is deferred.
- **`performerMode` (automation axis)** — R-9 keeps it separate and future.

**Retired (distinct from deferred; will not return absent a new spec):** the **declared-altitude field** (R-3).

---

## 12. Traceability Index

- Thesis/Axioms → `system-prompt.ts` agnostic core (SPEC-1).
- STD-1 (leaf criterion) → `system-prompt.ts` + `lint.ts` advisory (SPEC-1, SPEC-2) + leaf semantics `pwa-graph-report.ts`.
- STD-2/STD-3 (boundary + contract, R-9/R-10) → vocab `packages/rph-contracts/vocab/*` → `packages/rph-application/src/handlers/pwa-authoring.ts` → `packages/rph-authoring/src/broker.ts` → `apps/rph-demo` UI (SPEC-3); floor at `packages/rph-assurance/src/floor-policies.ts`.
- Domain template (R-12) → projected ASPLE (SPEC-4).
- Calibration → Fixtures A + B (SPEC-5).
- Engineering practice → `JAN-ENGC-001` (STD-4, §8, §10).

---

## 13. Revision Note

**v0.2.1-draft** — added the companion **`JAN-PRPWA-EP-001`** reference in §2.3. That doc salvages the retired source's descriptive engineering-practice content that the previous cycle did not fully/correctly carry into `JAN-ENGC-001`, and restores it as stricter program-local normative requirements: **3 fully-absent items** (observability-decision comments; the debug/info/warn/error/fatal log-level taxonomy; mock discipline / prefer-real-infrastructure) plus ~32 degraded restorations including the **SonarQube scanning duty** (`EP-TST-13`). Produced via an adversarial 4-agent salvage, calibrated against the sponsor's SonarQube known-answer.

**v0.2.0-draft** — reconciled against a four-lens adversarial verification pass (completeness · consistency/deontic · Constitution-fidelity · code-grounding) run 2026-07-20 at SHA `2040ae37`. Changes from v0.1.0:

- **Constitution correction (critical).** v0.1 incorporated the `retired/` engineering-practices file, which `JAN-ENGC-001 §1.2` / its metadata declares carries **no current authority**. Re-anchored to the active **`JAN-ENGC-001` v1.0.1 (Normative)** with real clause locators (§2.3, §8, §10), and respected its `§1.1` scope boundary (governs engineering practice, not PWA semantics). *Surfaced per §10 as a judgment call against the original instruction to use the retired file; the practices woven in are unchanged — only the authority citation moved to the governed document. Sponsor MAY reverse.*
- **Three planes defined (D-1a)** — previously referenced but never enumerated; now defined and explicitly disambiguated from §5.2's classification and STD-1-I(d)'s floor triad.
- **INV-4 split** into enforceable INV-4a (delegated exclusion) and heuristic INV-4b (irreducible), reconciling the earlier overclaim with R-5's no-machine-check ruling; SPEC-2 now defines the concrete structural proxies; §8's property test rewritten to the satisfiable claim.
- **O-1…O-4 resolved** under delegated authority as R-9 (annotation shape), R-10 (assurance-by-attestation), R-11 (variation deferral + forward-compat F-1…F-3), R-12 (domain-template authorship). The previously-dropped domain-template-authorship fork is now tracked (R-12).
- **DoD** quoted verbatim from `§9` (was mislabeled "verbatim" while paraphrased); **Integration** and **Replay** layers added to §8 per `§6.2`.
- Fixtures relabeled **A/B/C** (removing the 2a/2b/#2 collision); Increments corrected to **0–5**; deontic keyword fixes (INV-3/INV-6 MAY→SHALL NOT); miscites fixed (D-2 §2.4; STD-2→R-9; PB-4→R-8/§11; ASPLE §2.3/§3.2 disambiguated); D-3 substrate list completed (context assembly); RETIRED altitude moved out of the Deferred metadata row.

*End of JAN-PRPWA-DS-001 v0.2.0-draft.*
