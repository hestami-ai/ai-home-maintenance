---
artifactId: JPWB-CON-000
title: JPWB Constitution
layer: Constitutional
settledness: CONSTITUTIONAL
status: DRAFT — pending sponsor ratification
version: 0.1.0
date: 2026-07-16
governs:
  - The vision, worldview, thesis, values, axioms, and first principles of the Janumi Professional Workbench program.
  - The rule of recognition: what counts as canon, how authority is conferred, how precedence is decided, how the canon changes, and how the pre-canon corpus is retired.
  - The settledness ladder that every other canon artifact inherits.
doesNotGovern:
  - Doctrine, reasoning disciplines, and the concept of operations — JPWB-DOC-001.
  - The naming and meaning of terms — JPWB-DOC-002.
  - Semantic structure, objects, state, and invariants — JPWB-DOC-003.
  - Agent conduct, intake, divergence handling, and engineering practice — JPWB-DOC-004.
  - Exact shapes (wire envelopes, schemas, enum spellings, IDs, error codes) — the repository's generated contracts, schemas, migrations, and conformance tests.
  - Open questions, rulings, and divergence findings — JPWB-REG-005.
precedence: Highest settledness class in the canon. On any conflict within the canon, this artifact controls for vision, values, first principles, and recognition; for every other concern, the artifact that owns the concern controls (Part B, clause 3).
changeProcedure: Sponsor decision only, recorded as a JPWB-REG-005 entry and merged here. No other actor may amend this artifact.
ratification: PENDING — becomes effective via REG-005 entry
---

# JPWB-CON-000 — Constitution

## Part A — The Substantive Constitution

### 1. Vision

Humanity converts underspecified intent into consequential reality through professional capability. The enduring asset of professional work is not the artifact produced; it is the capability to produce, sustain, adapt, validate, and reproduce valuable outcomes under changing conditions.

AI greatly expands the amount of professional activity that can be attempted. It does not automatically preserve intent, truth, authority, wholeness, or capability. Without a stronger architecture, increased generation produces increased fragmentation. Janumi exists to answer that threat: infrastructure through which humans and AI deliberately shape, exercise, assure, preserve, and evolve professional capability.

The near-term commitment is scoped: prove the method at the Shape Engineering level, in software product realization, with JanumiCode as the first demanding existence proof. The larger capability-stewardship vision is carried as direction, not as product claim; nothing in near-term architecture may foreclose it, and nothing in it authorizes new canonical types or services before deliberate semantic design and governance. [ELICITATION: does the sponsor want the civilizational/intergenerational stewardship framing carried in CON-000 at this strength, or retired with the vision documents and referenced only as direction?]

### 2. Worldview

Professional work is reasoning under uncertainty directed toward outcomes. Not document editing. Not workflow execution. Not task management. Every artifact type exists because uncertainty existed: requirements because intent was uncertain, architecture because implementation was uncertain, tests because correctness was uncertain.

Professional work is a complex whole, not a collection of independent tasks. Decomposition loses information — intent, constraints, assumptions, cross-cutting obligations do not survive it automatically. This irreversibility of reductionism is why the system exists: recomposition is real work, decomposition creates explicit obligations, and understanding every part does not guarantee recovery of the whole.

Professional work is continuously reconciled. There is no "finished," only "coherent." Reality changes, evidence arrives, assumptions fail; any downstream signal may legitimately reopen upstream reasoning.

Software-product failure does not originate primarily in code generation. It originates in loss of coherence among stakeholder intent, assumptions, requirements, architecture, implementation, verification, and operating reality. The coding agent is one Participant within the system that maintains this coherence; it is never the system's organizing model.

### 3. Thesis

The Janumi Professional Workbench externalizes professional cognition into explicit, recursively composable, continuously reconciled, governed representations, so that humans and AI can reason together while intent, evidence, authority, and coherence are preserved. [ELICITATION: this thesis sentence is a candidate articulation assembled from assistant turns the sponsor engaged with but never ratified verbatim; confirm or amend the exact wording.]

Governance is the product, not a feature. A system that records that activity occurred is a task tracker; JPWB records how professional cognition advanced, failed, changed, and contributed to an outcome — and refuses to let any of those claims stand without the relations that perform them. [ELICITATION: "Governance is the product, not a feature" is carried from the Executive Overview, which the README demotes to an orientation aid; confirm the sponsor endorses it at constitutional strength.]

### 4. Values

**V1 — Honesty over theater.** The system never manufactures success. Budget exhaustion, inconclusive validation, partial context, degraded capability, and single-host limits are declared as what they are. A green indicator whose basis cannot be inspected is a defect, not a feature.

**V2 — Evidence over assertion.** Claims are supported by admissible evidence through explicit relationships. Fluency is not evidence; attachment is not support; a validator's prose is not a disposition; a backup that has not been restored is not verified.

**V3 — Human accountability inside the model.** Professional judgment, uncertainty, and human authority remain part of the executable model rather than being abstracted away. Formalization exists to make work inspectable, coordinable, and assurable — never to reduce a profession to deterministic software or to replace accountable human authority.

**V4 — Transparent AI participation.** AI appears as an attributable professional Participant, never invisible automation. AI origin remains visible after review or acceptance: approval never erases provenance. The accountable record of machine reasoning is the declared professional rationale — evidence, assumptions, methods, limitations — not private chain-of-thought. This value governs the consumption and attribution of model output; it does not reach internal model computation. Non-example: a rule forbidding the solicitation or evidentiary use of private chain-of-thought does not forbid enabling a model's thinking capability — restricting usage is not restricting generation.

**V5 — Proportionality above a universal floor.** Structure and assurance scale with consequence, uncertainty, irreversibility, and exposure. Uniform heavyweight ceremony is a violation, not diligence. The de minimis assurance floor is universal and is never a paid tier: trustworthiness is not monetized.

**V6 — Rigor as commitment.** Canonical voice states commitment, not finality: this is the hypothesis we are committed to testing rigorously. A hypothesis implemented sloppily teaches nothing; faithful implementation is what makes friction evidentiary. Friction between canon and reality is evidence to be filed, never scandal to be hidden.

### 5. Axioms and First Principles

**AX-1 — Execution is not assurance.** Five professional concerns stay orthogonal: Shape (what the work is), Execution (did machinery run), Assurance (is completion justified by admissible evidence under policy), Governance (who authorized, with what authority), Baseline (what is authoritative). Successful execution MUST NOT imply satisfied assurance, for any Professional Work Unit in any Undertaking, under any PWA; the state-axis semantics are carried by JPWB-DOC-003 and the exact spellings by the repository. Scope: this governs authoritative professional state; it does not forbid a surface from displaying execution progress, provided display never mutates or implies assurance.

**AX-2 — Capability is not authority.** An AI agent may propose anything and is never silently promoted to authority. AI output is proposed professional state unless an explicit governed grant says otherwise; approval and exception authority default to denied; no scenario, agent, validator, or registry grants itself authority. Every consequential decision is adjudicated by an authorized human, through the dispositions defined in JPWB-DOC-003, unless a PWA explicitly defines a governed autonomous mode.

**AX-3 — Uncertainty is first-class.** Questions, assumptions, contradictions, and residual uncertainty are governed objects that drive work, not annotations on it. Traditional software hides uncertainty; JPWB exposes it. Completion with residual uncertainty is legitimate only when the residual is documented, assessed, accepted by authority, and inspectable downstream.

**AX-4 — Decomposition creates a recomposition obligation.** Every decomposition is a claim that the children cover the parent obligation, and every delegation leaves synthesis with the parent. A parent MUST NOT be treated as complete merely because all children are complete. Scope: this governs professional completion; it does not forbid roll-up displays that are labeled as roll-ups.

**AX-5 — One authoritative model, many projections.** There is one authoritative semantic state; every view, cache, dashboard, chat surface, canvas, report, and repository listing is a derived projection. A projection MUST NOT become an independent source of professional truth or mutate state except through governed commands. Repository state alone does not define current professional truth; neither does a design document — both are representations of professional state requiring reconciliation with intent and observed reality. Authority over meaning is governed by Part B, not by this axiom.

**AX-6 — State is explicit.** Professional meaning is never inferred from null fields, missing values, attachment, proximity, ordering, storage location, or UI placement. Illegal and incomplete states are represented explicitly. Scope: this governs semantic state; it does not forbid ordinary defaulting inside non-semantic presentation or transport code.

**AX-7 — History is append-only.** Accepted semantic changes produce immutable events; correction moves forward through new events, supersession, or reconciliation, never by rewriting. Authoritative baselines are immutable; change means a successor. Human override may waive a disposition but never erases findings or evidence. Scope: this governs accepted semantic changes and authoritative history; it does not reach unaccepted drafts, working state, or non-semantic storage, which may be freely revised before acceptance.

**AX-8 — Fail closed; escalate rather than invent.** Inconclusive is never pass; unable-to-determine is never met; ambiguity in professional semantics halts or escalates rather than being silently filled. Escalation is the responsible transfer of unresolved professional responsibility, not failure. Silence is not license: where the canon does not answer, the agent files an open question with a safe default in JPWB-REG-005 and does not invent the answer.

**AX-9 — Intent is the root.** All material work traces to originating intent or an explicitly declared exploratory purpose. The decomposition exists to serve the intent; the intent does not exist to stabilize the decomposition. Unauthorized intent alteration cannot be waived — the only exit is a governed intent revision approved by the accountable human authority who owns the originating intent, per the role definitions in JPWB-DOC-002.

**AX-10 — Semantics precede technology.** Professional meaning is defined before and independently of databases, frameworks, deployment topology, and wire shapes. Deployment topology MUST NOT change professional meaning; a runtime is conformant only if it preserves the semantics, whatever its stack. Exact shapes belong to the repository (Part B, clause 3); the canon states meaning and defers.

**AX-11 — One primitive, many topologies.** The Professional Work Unit is the common primitive of professional work; professional domains compose it into different work topologies. Domain specialization extends the canonical semantics and MUST NOT weaken, duplicate, or replace them. A domain product is a specialization of JPWB containing multiple PWAs — never a single PWA, and never a fork of the ontology.

**AX-12 — Self-hosting.** JPWB must be capable of building, assuring, governing, and evolving the professional-work systems that define and produce JPWB. This dogfooding property is required, not aspirational: an architecture decision that makes JPWB unable to host its own construction violates this constitution.

## Part B — The Rule of Recognition

**B1 — The canon.** The recognized corpus is exactly: JPWB-CON-000, JPWB-DOC-001, JPWB-DOC-002, JPWB-DOC-003, JPWB-DOC-004, JPWB-REG-005, plus the repository's generated contracts, schemas, migrations, and conformance tests as shape authority. Nothing else governs. A document not in this registry — whatever its title or voice — is historical material. Shape authority means the repository's *reference artifacts* — schemas, generated contracts, migrations, conformance fixtures — never the implementation itself: the implementation is the experiment (B4, level 3) and is never its own shape authority. A shape reference that no type check or conformance test enforces asserts a status nothing performs (B7).

**B2 — Status is conferred, not authored.** An artifact's authority derives from its ratification record in JPWB-REG-005, never from its title, voice, or fluency. Every artifact carries a status block; the block is part of the artifact. Ratification is a sponsor act; an agent's best-judgment resolution is a proposal logged for confirmation, not a conferral. [ELICITATION: confirm that the M0 build-agent RATIFIED entries are proposals pending sponsor confirmation, not conferrals.]

**B3 — Precedence is by concern.** Vision, values, and first principles → CON-000. Reasoning, judgment, and operation → DOC-001. Naming and meaning of terms → DOC-002. Semantic structure and invariants → DOC-003. Agent conduct and process → DOC-004. Exact shapes → the repository. Open questions and rulings → REG-005. On conflict between artifacts, the artifact that owns the concern controls; on conflict within a concern, the higher settledness class controls; residual conflicts are SEMANTIC_CONFLICT findings (per the JPWB-DOC-004 divergence protocol) filed in REG-005.

**B4 — The settledness ladder is constitutional.** Almost nothing in this system is settled by real-world operation yet; the entire system is pre-Baseline, and settledness descends the abstraction stack:

| Level | Class | Meaning | Relitigation |
|---|---|---|---|
| 0 | CONSTITUTIONAL | Vision, worldview, thesis, values, axioms, first principles. Genuinely settled. | Sponsor decision only. |
| 1 | PRESUMPTIVE | Canonical vocabulary; doctrine core; operating protocol. Strong default; rebuttable where theory meets reality. | Governed refinement act: REG-005 entry, sponsor ratification. Never casual drift. |
| 2 | HYPOTHESIS | Doctrine details, semantic model, invariants, specifications. Committed hypotheses under test: implement faithfully; treat friction as evidence. | Divergence protocol (DOC-004). |
| 3 | EXPERIMENT | The code — the first implementation of the first principles, written without benefit of this canon. | Normal engineering under the protocol. |
| — | LIVING | The register. Append-only; entries close by being merged into governing artifacts. | Continuous. |

Every normative statement in the canon inherits its artifact's settledness class unless explicitly marked otherwise.

**B5 — Change procedure.** CONSTITUTIONAL: sponsor decision, recorded. PRESUMPTIVE: proposed via a REG-005 finding, sponsor-ratified, then merged. HYPOTHESIS: the divergence protocol in DOC-004. No canon text is ever changed silently; every change traces to a register entry. A ruling made in conversation is not effective until it lands as a REG-005 entry and is merged into its governing artifact — a ruling may never float outside the canon.

**B6 — The convergence clause.** During the convergence phase — now, until closure — the canon is the sole semantic authority, and the code is the first experiment being brought into conformance. Dual run never means dual semantic authority. The code was written without benefit of this canon; divergence is expected and is evidence, not scandal. The docs-win presumption is a property of this phase, not a permanent fact; settledness is thereafter earned bottom-up through real-world operation.

**B7 — Anti-vacuity clause.** No artifact, object, or field may claim a status its relations do not perform: no provenance theater, no policy objects the runtime never reads, no assurance represented by an unread flag. Asserted status must be performed status. A discovered gap between asserted and performed status is a SEMANTIC_CONFLICT, escalated via REG-005 — never quietly documented around and never quietly deleted. Non-example: a canon statement the code does not yet satisfy is a divergence under B6, not vacuity; a status block marked DRAFT, or a claim explicitly declared as target, is not theater. This clause governs claims of currently performed status.

**B8 — Retirement.** The pre-canon corpus is retired upon ratification: moved out of the agent-visible tree, preserved in history. Retirement is a sponsor act, recorded in REG-005. Retired documents have no authority and must not be consulted as authority; reading them requires treating them as historical evidence only.
