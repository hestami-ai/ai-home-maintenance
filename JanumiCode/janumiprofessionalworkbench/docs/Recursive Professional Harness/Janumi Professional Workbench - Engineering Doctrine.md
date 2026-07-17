# Janumi Professional Workbench Engineering Doctrine

**Document ID:** `JAN-ENGD-001`
**Version:** `0.1.0`
**Status:** Draft
**Layer:** Doctrine
**Role:** Interpretive principles for engineering judgment
**Parent authority:** [`JAN-ENGC-001@1.0.1`](<Janumi Professional Workbench - Engineering Constitution.md>)
**General-doctrine context:** [`JPWB-DOC-001`](<../_canon_draft/JPWB-DOC-001 Doctrine and Concept of Operations.md>) (Draft)
**Downstream procedural candidate:** [`JPWB-DOC-004`](<../_canon_draft/JPWB-DOC-004 Agent Operating Protocol.md>) (Draft)
**Applies to:** Human engineers, AI coding agents, reviewers, maintainers, and engineering-governance authors
**Supersedes:** None
**Date:** 2026-07-17
**Approval:** Pending

---

## 1. Purpose and Place in the Governance Stack

This document derives applied engineering doctrine from the binding commitments of `JAN-ENGC-001`.

The Constitution states the engineering conditions that must hold. This Doctrine explains how those conditions should be understood when engineers and agents exercise judgment across different repositories, technologies, risks, and kinds of work.

It does not restate the Constitution as a shorter checklist. It identifies the durable beliefs, distinctions, and reasoning stances that should survive changes in tools and procedure.

### 1.1 Authority Ladder

```text
JAN-ENGC-001 — Engineering Constitution
Non-negotiable commitments and boundaries
        │
        ▼ interpreted by
JAN-ENGD-001 — Engineering Doctrine
Principles and judgment for applying those commitments
        │
        ▼ operationalized by
JPWB-DOC-004 — Agent Operating Protocol
Actor-specific conduct, procedure, escalation, and reporting
        │
        ▼ made concrete by
Repository standards, profiles, playbooks, gates, and tooling
Exact commands, thresholds, formats, and operational mechanics
```

Precedence is by concern. The Engineering Constitution controls binding engineering commitments. This Doctrine interprets those commitments but cannot weaken or enlarge them. An adopted Agent Operating Protocol may define conduct and procedure but cannot convert a doctrinal interpretation into a new constitutional requirement. Repository-local standards make the requirements concrete but do not redefine their meaning.

### 1.2 Semantic and Product Boundary

This Doctrine governs engineering judgment, not Janumi's professional ontology or runtime semantics.

`RPH-DOC-000` remains the naming and product-boundary authority for this directory. Concern-owning specifications remain authoritative for PWA, Undertaking, PWU, RPH, JEM, authority, assurance, Decision, Baseline, persistence, and exact contract meaning. The repository remains the authority for exact serialized shapes and executable contracts.

Engineering convenience is not authority to reinterpret a canonical term, flatten a governed object, or bypass a semantic invariant.

### 1.3 Current Standing

This is supporting Draft doctrine. It is not yet a binding canon artifact, and derivation from a Normative Constitution does not confer approval.

The emerging `JPWB-CON-000` draft currently recognizes a closed six-artifact canon and assigns general doctrine to `JPWB-DOC-001` and agent conduct to `JPWB-DOC-004`. Before this document can become Normative, governance must either:

1. admit it explicitly as an applied-doctrine specialization beneath the Engineering Constitution; or
2. retain it as supporting doctrine outside that closed canon and define its precedence accordingly.

Until then, this document may guide review and elicit feedback, but it does not amend `JPWB-DOC-001`, `JPWB-DOC-004`, or their registries.

### 1.4 How to Use Doctrine

Doctrine is most useful where a rule does not mechanically decide the case:

* two legitimate engineering values pull in different directions;
* the available evidence is incomplete;
* the repository's technology differs from the examples in the Constitution;
* a risk-proportionate choice must still preserve a coherent change;
* a tool reports success but the professional outcome remains uncertain;
* an agent can perform an action but its authority to make the action effective is unclear.

Doctrine supplies a way to reason. Procedure supplies the ordered moves. The two should not be confused.

---

## 2. Central Thesis: Engineering Preserves Intent Through Evidence

Engineering in Janumi is not merely the production of code or artifacts. It is the disciplined preservation of professional intent and coherence while an implementation changes.

A change is professionally intelligible only when future humans and agents can reconstruct:

* what outcome the change served;
* which constraints and decisions shaped it;
* which boundaries and assumptions it depended upon;
* what evidence supported confidence;
* what uncertainty or risk remained;
* how the implementation can be challenged, repaired, or evolved without losing meaning.

The product of engineering is therefore both behavior and an evidence-bearing account of that behavior. Code without recoverable intent becomes fragile. Evidence without working behavior becomes theater. A sound engineering result carries both.

This thesis yields a recurring doctrinal stance:

> Preserve meaning, make consequential transformations observable, and let confidence follow evidence rather than assertion.

---

## 3. Engineering Doctrine Propositions

The following proposition identifiers are stable within the `0.x` development line and may be used in review notes, prompts, and diagnostics.

### ENGD-P01 — Professional Intent Is the Coherence Anchor

Implementation choices are judged by whether they preserve the intended professional outcome, governing constraints, and relevant semantic relationships—not by local elegance alone.

### ENGD-P02 — Structural Clarity Precedes Commentary

Code should reveal its ordinary behavior through structure. Comments earn their place by preserving decision context that structure cannot reliably carry.

### ENGD-P03 — Decision Context Is Durable Engineering Knowledge

Rationale, tradeoffs, boundary assumptions, and invariants are part of the engineering record when future change would otherwise require guesswork.

### ENGD-P04 — Observability Is Reconstructability

Operational evidence is valuable to the extent that it allows authorized people and systems to reconstruct consequential behavior. Log volume is not observability.

### ENGD-P05 — Confidence Follows Evidence

The occurrence of compilation, a green exit, measured coverage, artifact generation, or an agent assertion is a fact about activity; the asserted content remains a claim. Such activity supports confidence only when it addresses the governing claim and material failure conditions.

### ENGD-P06 — Trust Changes Require Validation

Information that crosses ownership, authority, validation, or protection boundaries must not be trusted for a consequential use until the applicable validation and authorization succeed. When the information proposes professional state, that state remains proposed until accepted through the applicable authority model.

### ENGD-P07 — Execution, Assurance, and Authority Remain Distinct

Execution produces candidate results. Assurance evaluates claims about those results. Governance authorizes consequential disposition. No green execution result collapses those responsibilities.

### ENGD-P08 — Every Material AI Transformation Needs Visible Micro-Assurance

Each material model, agent, or tool call is a distinct risk-injection boundary. Aggregate or end-stage assurance does not erase an unobserved or unvalidated transformation inside the trajectory.

### ENGD-P09 — Failure Creates a Learning Obligation

A material failure should leave the system easier to understand, detect, reproduce, or prevent. Repair without captured learning leaves the underlying institutional weakness intact.

### ENGD-P10 — Proportionality Scales Rigor, Not Coherence

The amount and form of evidence may vary with risk. Proportionality never licenses an incomplete vertical slice, a hidden boundary, or an unexamined invariant.

### ENGD-P11 — Quality Debt and Residual Risk Stay Visible

Findings, exceptions, uncertainty, and deferred work are governed information. Silence is not resolution, and a passing gate is not permission to hide what remains.

### ENGD-P12 — Friction Is Evidence, Not Private License

When faithful implementation conflicts with reality, the friction should inform governed refinement. It does not authorize a local actor to rewrite the rule, invent a new meaning, or conceal the conflict.

---

## 4. Preserving Professional Intent and Coherent Change

### 4.1 Local Correctness Is Not Enough

An implementation can be locally correct and professionally incoherent. A field can validate while breaking a lifecycle. A command can succeed while bypassing authority. A child artifact can pass while its parent remains unrecomposed. A test can be green while it proves the wrong claim.

Engineering judgment therefore follows the change through every layer it genuinely affects. The aim is not maximum scope; it is the smallest scope that remains coherent.

### 4.2 Smallest Diff and Smallest Coherent Change Are Different

A small diff is a property of text. A coherent change is a property of meaning and behavior.

If a change alters a contract, the corresponding implementation, compatibility behavior, evidence, and documentation may all be part of one coherent slice. Omitting an affected layer to preserve a small diff is not restraint; it is deferred inconsistency.

Conversely, coherence does not justify speculative refactoring or unrelated cleanup. The doctrine favors narrow end-to-end completeness over broad improvement programs.

### 4.3 Information Loss Is a First-Class Risk

Simplification is not neutral when it removes distinctions needed for authority, provenance, assurance, replay, or future reasoning.

Common degradation signatures include:

* a structured governed record reduced to a Boolean;
* a relationship reduced to an identifier with no semantics;
* an explicit state reduced to nullability;
* a version-bound judgment reduced to a badge;
* a rationale reduced to a summary with no source or uncertainty;
* a professional object reduced to a generic task or workflow step.

Before removing structure, engineering judgment asks what meaning it carried and what will become impossible to reconstruct.

---

## 5. Clarity and Decision Memory

### 5.1 Code Is the Primary Explanation of Ordinary Behavior

Names, types, boundaries, and state models should make the normal path intelligible. Commentary cannot rescue a representation whose structure contradicts or conceals its own meaning.

This is why clarity precedes commentary: durable understanding should be carried by the strongest available mechanism. When a type can make an illegal state impossible, a comment warning against that state is weaker evidence and weaker control.

### 5.2 Comments Preserve What Code Cannot Reliably Reveal

Code rarely reveals why one valid design was chosen over another, which external contract constrained it, which historical defect made a redundant-looking guard necessary, or which professional consequence makes a transition dangerous.

That context is not stylistic decoration. It is decision memory. It allows future engineers and agents to distinguish an intentional constraint from an accidental shape.

### 5.3 Comment Drift Is Knowledge Corruption

A stale comment is hazardous because agents and humans may treat it as authority. Updating behavior without updating its decision memory creates two competing accounts of the system.

The doctrinal response is not to avoid comments. It is to reserve them for durable context and maintain them as part of the affected engineering record.

### 5.4 Inference Must Remain Labeled

Repositories often contain behavior whose rationale was never recorded. Recovering a plausible rationale can help investigation, but inference must not be laundered into fact.

An inferred explanation remains provisional until confirmed by the owning requirement, Decision, or responsible authority. This distinction preserves provenance and prevents future work from building on invented history.

---

## 6. Observability as Control and Assurance Fabric

### 6.1 Reconstructability, Not Exhaust

Observability is not an instruction to record everything. Unbounded telemetry can obscure causality, leak protected information, and make meaningful evidence harder to find.

The doctrinal objective is selective reconstructability: enough structured, correlated, protected evidence to understand consequential behavior without turning sensitive content or private reasoning into routine exhaust.

### 6.2 Consequential Boundaries Must Leave Evidence

The strongest need for evidence appears where trust or meaning changes:

* external input becomes validated input;
* a proposal becomes authoritative state;
* a Command attempts a governed transition;
* a retry risks repeating an external effect;
* a model or tool transforms material context;
* a finding changes control behavior;
* an exception changes the accepted risk posture.

The exact telemetry fields belong to standards and protocols. Doctrine supplies the reason: without boundary evidence, later evaluators see isolated snapshots and cannot judge the trajectory that produced them.

### 6.3 Micro-Assurance Is Connective Tissue

A professional result may pass a final review while still containing a material transformation that was unobserved, malformed, or outside authority. End-stage assurance cannot retroactively make such a trajectory sound.

For that reason, each material AI-, model-, agent-, or tool-mediated transformation is treated as its own assurance-relevant boundary. Its provenance, contract, validation, and disposition remain visible enough to support later review.

This does not require storing private chain-of-thought or retaining raw content beyond policy. It requires an inspectable, policy-permitted representation or reference sufficient to evaluate the material inputs and outputs, together with professional rationale, declared limitations, and applicable evidence. Exact capture, access, and retention remain owned by concern-owning policies and standards.

### 6.4 Privacy and Reconstructability Are Joint Constraints

Redaction is not an afterthought to observability. Evidence design should identify the minimum safe representation that still answers the material diagnostic and assurance questions.

When those goals conflict, the answer is governed access, retention, summarization, fingerprints, and controlled artifacts—not silent collection and not diagnostic blindness.

---

## 7. Testing and Debugging as Institutional Learning

### 7.1 Tests Support Claims

A test result is evidence about a claim under specified conditions. It is not the claim itself, and it is not proof beyond the conditions the test actually exercises.

This distinction explains why coverage and green exits are diagnostic facts rather than final judgments. They say that code ran or lines were visited. They do not establish that the right professional behavior, boundary, invariant, or failure mode was tested.

### 7.2 Evidence Selection Is Risk-Driven

Different evidence forms retire different uncertainties. Deterministic unit evidence can establish local transformations. Property and invariant evidence challenge broad classes of input. Integration and contract evidence exercise boundaries. Replay evidence preserves knowledge of actual failure. Production observation tests assumptions that controlled environments cannot fully reproduce.

Doctrine does not mandate the same stack for every change. It expects the evidence portfolio to match the material claims and risks.

### 7.3 Debugging Seeks the Broken Assumption

The visible failure is often downstream of the actual defect. Hypothesis-driven debugging searches for the boundary where expected and observed behavior diverged and for the assumption that made the incorrect behavior appear reasonable.

Naming the broken assumption turns repair into reusable knowledge. Without it, a patch may remove the symptom while leaving the same reasoning error available elsewhere.

### 7.4 Failure Should Improve the System's Memory

Regression tests, replay fixtures, improved telemetry, clarified contracts, and corrected decision context are ways a system remembers failure.

Not every defect can be reproduced perfectly. The doctrinal obligation is honest: preserve the strongest feasible learning, state what remains unknown, and avoid claiming that containment is root-cause resolution.

---

## 8. AI, Tools, Trust, and Authority

### 8.1 Generative Output Is Proposed State

Model, agent, and tool output may be useful before it is authoritative. Use and authority are different questions.

An output can inform exploration, drafting, or analysis while remaining untrusted for a governed transition. Authority arises only through the applicable validation, assurance, and governance path.

### 8.2 Capability Does Not Confer Authority

An actor's ability to edit a file, call a tool, execute code, or produce a persuasive answer does not determine what that action is permitted to make professionally effective.

This applies equally to humans, agents, automation, and operators. Tool access is not domain permission. Repository write access is not authority to redefine canonical meaning. A model's competence is not approval authority.

### 8.3 Trajectory Quality Is Part of Correctness

For agentic work, final output alone may hide unsafe tool use, scope expansion, ignored evidence, or invalid intermediate transitions.

Where the process carries material risk, engineering confidence considers both outcome and trajectory: which sources were used, which boundaries were crossed, what was validated, what authority was exercised, and how uncertainty was handled.

### 8.4 AI Evidence Is Not Independent Approval

An agent may generate tests, analyses, or assurance artifacts. Those artifacts can be valuable Evidence, but the agent's production of them does not make them independent review or governance approval.

Independence requirements and disposition authority remain governed outside the generating actor.

---

## 9. Quality, Exceptions, and Honest Completion

### 9.1 Quality Gates Are Sensors

Static analysis, tests, type systems, security scans, and formatting gates reveal different classes of condition. A gate is a sensor and control point, not a substitute for engineering judgment.

A passing gate does not prove the intended outcome. A failing gate is evidence that requires disposition. Disabling the sensor does not resolve the condition it reported.

### 9.2 Complexity Is Often Semantic Feedback

Complexity findings may indicate more than an inconvenient function. They can reveal mixed responsibilities, hidden state, unresolved domain boundaries, or a representation that does not fit the professional problem.

The doctrinal default is to investigate the underlying structure before suppressing the symptom. A justified exception remains possible under the Constitution, but it stays explicit and accountable.

### 9.3 Exceptions Preserve, Rather Than Erase, the Rule

A legitimate exception is reasoned, risk-visible, bounded, reviewable, and accepted only by the authority named by the Constitution.

An exception preserves rather than erases the rule. It does not rewrite the rule for everyone else and cannot waive a higher semantic invariant, security boundary, legal obligation, or authority requirement.

### 9.4 Completion Is a Professional Judgment

Completion is not compilation, artifact production, test exit, deployment, or agent declaration. It is an evidence-backed judgment that the intended behavior exists, affected boundaries remain sound, applicable risks have been addressed, and residual uncertainty is visible.

Honest incompletion is preferable to fabricated certainty. A result that names its limitation can be governed. A result that hides it cannot.

---

## 10. Recurring Doctrinal Tensions

Doctrine becomes visible where values must be held together rather than optimized separately.

### 10.1 Clarity and Traceability

Prefer structure for ordinary behavior and comments for unrecoverable decision context. Do not maximize comments, and do not discard still-relevant decision context merely because the current code reads cleanly; preserve it in the appropriate durable record and remove obsolete commentary.

### 10.2 Evidence and Privacy

Preserve enough evidence to reconstruct consequential behavior while minimizing sensitive content, access, and retention. Neither indiscriminate capture nor willful blindness satisfies the doctrine.

### 10.3 Rigor and Proportionality

Scale evidence to risk, but preserve every materially affected boundary and invariant. Proportionality changes depth and breadth; it does not authorize incoherence.

### 10.4 Speed and Learning

Fast repair is valuable, but a repair that captures no broken assumption or regression evidence may externalize the same cost into the future. Urgency may change sequencing; it does not make learning irrelevant.

### 10.5 Automation and Authority

Automate repeatable execution and evaluation where the authority model permits. Do not infer that automation may decide merely because it can execute or assess.

### 10.6 Standardization and Local Fit

Common standards improve transfer and automation. Repository-local rules may impose stricter requirements or select among alternatives already permitted by the Constitution. An adaptation that would otherwise depart from a constitutional rule is legitimate only through the Constitution's approved deviation path; visibility alone is not authorization.

---

## 11. Doctrinal Non-Equivalences

| Non-equivalence | Doctrinal meaning |
| --- | --- |
| Comments ≠ clarity | Commentary cannot compensate for an incoherent representation. |
| Readable code ≠ recorded rationale | Structure may show what happens while leaving why unrecoverable. |
| Logging ≠ observability | Evidence must support reconstruction, not merely exist in volume. |
| Coverage ≠ proof | Execution counts do not establish that the governing claim was tested. |
| Green execution ≠ assurance | Successful production does not independently evaluate fitness or correctness. |
| Validation ≠ approval | Evaluation and authorized disposition are separate acts. |
| Capability ≠ authority | Ability and permission are governed independently. |
| Commit ≠ Baseline | Technical persistence is not governance promotion. |
| Passing gate ≠ completion | A sensor result cannot represent the whole professional judgment. |
| Exception ≠ waiver of higher law | A scoped disposition cannot erase a superior obligation. |
| Final state ≠ valid trajectory | A plausible outcome cannot repair an unauthorized or unobservable path. |
| Artifact production ≠ outcome achievement | Producing code or documents does not prove the intended effect. |

These distinctions are interpretive guardrails. Their semantic mechanics remain owned by the applicable canonical documents.

---

## 12. Boundary Between Doctrine and Protocol

This Doctrine deliberately does not define:

* canon load order;
* task-intake fields or a change-contract format;
* ordered debugging steps or a debugging report schema;
* verification ladders or mandatory test inventories;
* telemetry field lists and log severity rules;
* comment labels, TODO formats, or placement rules;
* quality-gate commands, thresholds, or scanner setup;
* agent before/during/after checklists;
* Definition-of-Done checklists or handoff fields;
* divergence classifications, filing procedures, or escalation routing;
* exact waiver and exception record shapes.

Those concerns belong to an adopted Agent Operating Protocol, a concern-owning policy, or repository-local standards and tooling.

`JPWB-DOC-004` currently contains substantial engineering-practice content and says that it absorbs the earlier Engineering Constitution's durable material. This Doctrine does not silently displace that draft. Before `JPWB-DOC-004` is ratified, it should be reconciled so that:

* `JAN-ENGC-001` owns binding engineering commitments;
* `JAN-ENGD-001`, if adopted, owns applied interpretation and judgment;
* `JPWB-DOC-004` owns agent-specific conduct and procedure;
* repository standards own exact implementation mechanics.

---

## 13. Interpretive Tests

When applying this Doctrine to an unfamiliar case, useful questions include:

1. What professional intent or relationship could this implementation choice lose?
2. Which decision context would be expensive or impossible to recover later?
3. Where does information change trust, authority, validation state, or protection domain?
4. What evidence would support—and what evidence could falsify—the claim that the change works?
5. Does the planned assurance cover each material AI or tool transformation, not only the final artifact?
6. Is a small diff being mistaken for a coherent change?
7. What broken assumption or residual risk must remain visible?
8. Is a tool result, capability, or green gate being mistaken for authority or completion?

These are prompts for judgment, not a substitute for the applicable protocol.

---

## 14. Governed Refinement

Doctrine should evolve through evidence from practice.

Useful refinement inputs include:

* recurring ambiguity in applying a constitutional clause;
* repeated conflicts between legitimate engineering values;
* failures whose root cause is a missing or misleading interpretive principle;
* protocol rules that have become ritual because their doctrinal purpose is unclear;
* repository adaptations that preserve the constitutional outcome better than the current default;
* AI-agent failure patterns that reveal a missing boundary or non-example.

Friction is evidence for a governed proposal, not permission for silent reinterpretation. A revision should state the experience that motivated it, the proposition affected, the downstream protocol or standard implications, and whether the change is clarification or a substantive doctrinal shift.

Promotion beyond Draft requires explicit approval and resolution of the canon-standing question in Section 1.3. Until then, this document remains a reviewable applied-doctrine proposal beneath `JAN-ENGC-001`.
