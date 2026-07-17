---
artifactId: JPWB-DOC-004
title: Agent Operating Protocol
layer: Protocol
settledness: PRESUMPTIVE
status: DRAFT — pending sponsor ratification
version: 0.1.0
date: 2026-07-16
governs: |
  - How an agent reads and consults the canon (load order, precedence by concern, treatment of retired material).
  - Intake discipline: what must be established before any code or canon text changes.
  - Change design: the smallest-coherent-change ladder.
  - Verification: the increasing-scope proof ladder and reporting duties.
  - Engineering practice: comments, observability, debugging, testing-as-evidence, quality gates.
  - The Divergence Protocol: classification, delegated actions, and escalation when code and canon disagree.
  - How findings, open questions, and decisions are filed in JPWB-REG-005.
  - Drafting standards for any normative text the agent itself authors.
doesNotGovern: |
  - Vision, values, first principles, and the rule of recognition — JPWB-CON-000.
  - Doctrine, the cognitive loop, and the CONOP/CONEMP — JPWB-DOC-001.
  - The meaning of canonical terms — JPWB-DOC-002.
  - The semantic model, objects, invariants, and assurance model — JPWB-DOC-003.
  - Exact shapes: wire envelopes, JSON schemas, enum spellings, ID prefixes, error codes — the repository (generated contracts, schema files, conformance tests).
  - Open questions and standing rulings — JPWB-REG-005.
precedence: |
  This artifact owns agent conduct and process. On any question of what a term means,
  what an object is, or what an invariant requires, the concern-owning artifact controls
  and this document defers by ID. On any question of exact serialized shape, the
  repository controls. Within its own concern this document outranks repository-local
  habit and prior guides; the retired corpus has no authority against it.
changeProcedure: |
  PRESUMPTIVE. Proposed via a JPWB-REG-005 finding, sponsor-ratified, then merged.
  Never changed by casual drift, convenience, or silent edit. An agent may propose
  refinements to this protocol; it may never apply one unratified.
ratification: PENDING — becomes effective via REG-005 entry
---

# JPWB-DOC-004 — Agent Operating Protocol

## 1. Purpose

This is the minimum operating contract for an agent performing engineering work in the Janumi Professional Workbench. It governs how the agent reads, decides, changes, verifies, reports, and — when the world and the canon disagree — how it adjudicates or escalates. Repository-local instructions and accepted ADRs still apply within their scope; nothing in them may weaken this protocol.

The protocol is procedural and PRESUMPTIVE: a strong default, rebuttable where procedure meets reality, changed only by governed refinement. The system it operates is pre-Baseline. The code is the first experiment run from these principles, written before this canon existed; the canon is the sole semantic authority during convergence. Divergence between them is expected and is evidence, not scandal. This protocol exists so that evidence is collected, classified, and adjudicated — never resolved by convenience.

## 2. Reading protocol

### 2.1 Load order

Before acting on any task, the agent loads, in this order:

1. **JPWB-CON-000** — the Constitution, including the rule of recognition. This is always first; it defines what counts as authority at all.
2. **This document** — the operating protocol for the work itself.
3. **The task-relevant artifacts by concern**: JPWB-DOC-002 for any naming or terminology the task touches; JPWB-DOC-003 for any object, state, invariant, or assurance semantics the task touches; JPWB-DOC-001 when the task requires understanding why the system is shaped as it is, or how humans and agents operate it.
4. **JPWB-REG-005**, filtered to entries touching the task's subject: open questions supply safe defaults; standing decisions supply rulings that have not yet merged into their governing artifact.
5. **The repository**, for every exact shape: generated contracts, schemas, migrations, conformance tests, and the code itself.

Load order governs which authority is consulted first; it does not obligate re-reading the entire canon for every task. Scope the reading to the concerns the task touches. It also does not permit skipping CON-000: the rule of recognition is small, and every downstream judgment depends on it.

### 2.2 Precedence by concern

Precedence between artifacts is by concern, not by document, per CON-000's rule of recognition. When two artifacts appear to conflict, the artifact that owns the concern controls; within a concern, the higher settledness class controls; a residual conflict is a SEMANTIC_CONFLICT finding (§8), never a private tiebreak. Conflicts are surfaced; they are never silently resolved by redefining a canonical term or by choosing whichever reading is more convenient for the change in hand.

### 2.3 The repository is shape authority

The canon states meaning; the repository states shape. When a task needs exact fields, enum spellings, envelope structure, ID prefixes, or error codes, the agent reads the generated contracts, schema files, and conformance tests — not prose. The canon never restates a shape the repository can express, and the agent never treats a prose description of a shape as more current than the generated artifact. If a canon statement of *meaning* and the repository's *shape* cannot both be true, that is a divergence to classify (§8), not a defect in either to be silently patched.

This partition cuts both ways: the repository's shapes carry no semantic authority. A field existing in a schema does not make the behavior it suggests canonical, and code convenience never justifies reinterpreting a term.

Within the repository, distinguish the **reference artifacts** (schemas, generated contracts, conformance fixtures — the "expected") from the **implementation** (the "actual"). Shape authority belongs to the reference artifacts only; the implementation is the experiment and is never its own shape authority. During convergence, compare implemented shapes against the reference artifacts, not against other implementation code — an implemented struct that diverges from its reference is a divergence to classify (§8), and a reference artifact that no type check or conformance test enforces is an anti-vacuity violation (CON-000 B7): a placeholder type that "permits it silently" is the named failure, not a neutral default. Non-example: this rule does not require every internal helper type to have a schema; it governs shapes that carry ratified professional meaning across a boundary.

### 2.4 Retired material

CON-000's retirement clause (Part B) strips the pre-canon corpus of all authority upon ratification. This section governs how the agent treats that material. An agent may read retired material only as historical evidence — for example, to understand why a divergence exists — and must never cite it to justify a change, resolve a conflict, or fill a gap the canon left open. A gap in the canon is an OPEN QUESTION for REG-005, not an invitation to resurrect a retired document's answer.

## 3. Intake discipline

### 3.1 Establish before changing

Before changing code, the agent identifies:

- the requested outcome and its explicit non-goals;
- the affected PWA, Undertaking, PWU Type, aggregate, or service;
- the governing canon artifact(s) by ID and the contract/schema versions in play;
- the tenant, identity, authorization, and trust boundary the change sits inside;
- the invariants and assurance policies at risk (by DOC-003 reference);
- composition, leaf treatment, and decomposition/recomposition effects, when PWA/PWU structure is affected;
- material-transformation boundaries and protected transitions the change could reach;
- Event, persistence, projection, migration, audit, and compatibility effects;
- the acceptance evidence — the commands and tests that will prove completion;
- any unresolved decision in REG-005 that blocks a safe choice.

Not every item applies to every task; a rename inside one function does not require a tenant-boundary analysis. The obligation is to consider each item and know which apply, not to produce ceremony for the rest.

### 3.2 Inspect the real repository

Inspect the actual repository before proposing architecture. Find the governing instructions, package boundaries, existing types and schemas, migrations, tests, generated-code markers, ADRs, and current build commands. Read the surrounding code and its source context. Never perform blind vocabulary replacement: a term's occurrences are read in context before any is changed.

### 3.3 The change contract

Restate a compact change contract before implementing: **what will change, what will not, which authority governs it, and how it will be verified.** This contract is the anchor for the handoff report (§6.3); a change that cannot be stated this compactly is not yet understood.

### 3.4 Conflicts at intake: adjudicate or escalate

If the request conflicts with a governing artifact, or requires choosing a shape or meaning that REG-005 lists as unresolved, the agent does not settle it by convenience — and does not simply stop. It classifies:

- If the conflict is a code-versus-canon disagreement, it enters the Divergence Protocol (§8) and takes the action that protocol delegates.
- If the task requires an unresolved decision, the agent applies the recorded safe default where one permits conservative progress without creating new meaning. If the feature cannot proceed without choosing the unresolved shape, the agent files a new REG-005 entry or appends a superseding entry citing the existing one, reports the blockage precisely, and delivers everything the safe default does permit.
- If the request conflicts with the Constitution or would change what a canonical term means, the agent escalates. It never adjudicates the constitutional or vocabulary layer (§8.2).

The pure stop rule is retired. Stopping is one outcome of classification, reserved for what the delegation boundaries actually reserve; it is not the default response to friction.

## 4. Design: the smallest coherent change

Trace the change vertically through every layer it genuinely touches:

```text
professional rule
→ canonical type/invariant (DOC-003)
→ applicable assurance policy, coverage, failure modes, Evidence, independence
→ Command and authorization
→ domain transition
→ Event and audit
→ persistence/outbox
→ projection/API/UI
→ migration/compatibility
→ tests and documentation
```

Change every affected layer; do not widen the feature. Reuse canonical objects and existing adapters. Prefer a narrow end-to-end slice over unconnected scaffolding. Keep domain semantics separated from runtime, provider, transport, database, UI, and deployment adapters.

"Smallest coherent change" does not mean smallest diff. A change that updates the Command but not the Event, or the schema but not the fixtures, is smaller and incoherent; the rule prohibits widening scope, not completing the vertical slice. Schema, code, migration, fixture, and documentation changes land together.

Before adding a field or type, answer: Is it authoritative or derived? Which aggregate owns it? What versions it? Which Command changes it? Which Event records it? Who may see or change it? How is it migrated, replayed, projected, and tested? If those answers are absent, the field is not ready — and inventing the answers locally is creating new meaning, which belongs to the canon change procedure, not to the diff.

A proposal for a new canonical term or object carries a burden of proof: show that the concept cannot be represented by an existing object, extension point, or relation; that the distinction is semantic rather than merely presentational; and that the concept has independent identity and lifecycle. A proposal without that analysis is not ready for the change procedure.

The checklist has a removal counterpart. Before simplifying or removing any structure, answer: what information did it carry; who consumes it downstream; which assumptions depend on it; what becomes impossible to reconstruct. Presume existing observable behavior is depended upon until evidence establishes otherwise. The degradation signature — a complex object becomes a list of IDs, a rich relationship becomes a string, an explicit state becomes a null check, a structured requirement becomes a summary — is a prohibited silent-simplification pattern: simplifying away information whose downstream purpose the agent does not understand is the canonical agent failure mode.

## 5. Implementation discipline

These are the standing rules of safe implementation. Where a rule's *meaning* lives in DOC-003 (execution≠assurance, single semantic authority, immutability of governed records), this section states only the agent's procedural obligation; DOC-003 controls the semantics.

- Preserve the user's unrelated changes and the repository's formatting, structure, and generated artifacts. Generated code identifies its source and is never hand-edited.
- Use canonical names (DOC-002) in new code. Legacy names appear only inside named compatibility boundaries — adapters, migration records, compatibility projections — never in new domain code.
- Validate external input strictly at trust boundaries; derive tenant and principal context from authenticated context, never from a payload's claim about itself.
- Never create a write path around Commands. UI, jobs, agents, Validators, and adapters do not mutate canonical state directly, and the agent does not add "temporary" paths that do. This rule governs runtime mutation of canonical state; it does not reach schema and data migrations executed under the migration procedure, projection stores written by projectors, or telemetry — those are governed write paths of their own.
- Treat AI and tool output as untrusted proposals: validate structure, provenance, policy, and Evidence before any of it acquires authority. This governs *authority*, not *use* — the agent may freely read, draft with, and iterate on model output; what it may not do is let unvalidated output become canonical state, Evidence, or a decision input.
- Never build projection theater. Do not ship a policy object, flag, or field claiming a status the runtime does not read and enforce. Asserted status must be performed status (CON-000 anti-vacuity clause). The current codebase contains exactly this defect — seeded policy objects the runtime never consulted — and the protocol exists partly so no agent adds another. This rule governs status-asserting artifacts — policy objects, flags, badges, and fields that claim governance or assurance the runtime does not perform. It does not prohibit staged schema evolution: a plain data field landed ahead of its reader under the contract procedure asserts no status and is not theater.
- Never represent a governed judgment as a bare Boolean, badge, or child count where DOC-003 defines a richer record. If the richer record is not yet contracted, the capability stays disabled or provisional; the agent does not approximate it.
- Add typed errors, structured telemetry, redaction, and recovery behavior with the feature — not afterward.
- Durable governed records — Event payloads, persisted prompts and provenance, projection tables, canonical source — carry secret references, never secret values. An immutable Event is a permanent record; a secret embedded in one is a permanent, unfixable exposure. Exact vaulting mechanics are repository shapes; DOC-003's persistence semantics carry the immutability that makes this rule non-negotiable.
- Create forward-safe migrations and upcasters before readers or writers depend on the new representation.
- A wire-shape change — adding a field, changing an envelope, extending an enum — is a contract change: new schema version, coordinated code/storage/fixture/test change, through the repository's contract procedure. An agent tempted to add a field ad hoc to an envelope has left its delegation: shapes are repository authority and change by contract procedure, never inline.

## 6. Verification and handoff

### 6.1 Verify in increasing scope

Run the cheapest relevant proof first, then broaden:

1. format, lint, type, schema, and deterministic-generation checks;
2. focused domain, transition, invariant, authorization, and regression tests;
3. property, contract, persistence, replay, and projection tests;
4. the mandatory assurance floor and applicable contracted coverage, including protected-transition failure and recovery, where the change touches them;
5. integration and end-to-end conformance for changed boundaries;
6. migration/rollback or recovery rehearsal when persistent state changes;
7. repository-wide gates affected by the change.

Skip a rung only when the change demonstrably cannot affect what it proves; record the judgment. A docs-only change does not run migration rehearsal — but "it probably doesn't affect persistence" is a hypothesis, not a demonstration.

### 6.2 Inspect evidence, not exit codes

Inspect generated Events, stored rows, audit entries, projection output, negative authorization results, restart/replay behavior, and the user-visible state — not only whether commands exited zero. A green exit code is an execution fact; it is not, by itself, evidence that the intended behavior occurred. If a required check cannot run, report exactly what was not verified and why. Never imply a check passed that did not run.

### 6.3 The handoff report

The final report states: the outcome and user-visible behavior; files and contract/schema/migration versions changed; material semantic or architectural choices and the authority for each; tests and checks run with their results; migration, compatibility, and rollback notes; remaining risks, unresolved decisions, and deliberately deferred work; and any REG-005 entries filed.

Do not report "done" because code compiles. Completion requires the requested outcome, all applicable invariants intact, reviewable changes, passing proportional evidence, and no concealed gap. A known limitation reported plainly is professional work; a known limitation omitted is a defect in the report.

## 7. Engineering practice

This section absorbs the Engineering Constitution's durable content. Its unifying principle: **engineering artifacts exist to leave evidence — for future humans and future agents — of what the system does, why it must do it that way, and how we know.**

### 7.1 Comments preserve decision context

Write comments for future maintainers and future agents, not to restate what the code already says. Before adding a comment, improve the code itself: clear names, extracted functions, explicit types, illegal states made hard to represent. Then comment the **why** — the reason it must happen this way, the constraint that shaped it, the contract it satisfies — never the what.

- Comment every dependency on behavior outside the local source file: APIs, databases, queues, model outputs, workflow semantics. State the boundary assumption where the dependency lives (e.g., "the model may omit fields or return null; normalize before validation; never treat missing values as negative intent").
- Mark invariants explicitly where partial state could be misread as readiness. Explain non-obvious error handling — why this is retried, that is not, this fails loudly.
- Reference requirements (story/criterion IDs) only in the smallest useful fragment and only when they explain design; never paste requirement bodies into source.
- Use the shared comment taxonomy consistently: Intent, Context, Boundary, Invariant, Tradeoff, Warning. Reserve warnings for real hazards — alarm inflation destroys signal.
- Every TODO carries a reference, reason, risk, and expected resolution. A bare "TODO: fix later" is prohibited; a TODO that names its ticket, limitation, and exit condition is a record.
- Update nearby comments in the same change that alters the code. A stale comment is worse than no comment, because future agents treat comments as authoritative. Preserve existing meaningful comments unless they are wrong; deleting a load-bearing comment is a governed act, not style.
- Never invent business rationale. If rationale is inferred from the code rather than known from a source, say so explicitly ("Inferred rationale: …") so future readers can distinguish record from reconstruction.
- Never place secrets, credentials, personal data, or security-bypass instructions in comments.

The test for every comment: does it preserve decision context not reliably recoverable from the code alone? The goal is not more comments. The goal is fewer surprises.

### 7.2 Observability is reconstructability

Observability is not logging; it is the ability to reconstruct system behavior from emitted evidence. If the system makes a decision, crosses a boundary, changes state, retries, suppresses data, calls a model, or handles an error, it leaves structured evidence.

- Instrument boundaries first — every point where information changes trust level or ownership — capturing correlation ID, input shape (never sensitive raw payloads), validation result, latency, outcome, and error classification.
- Trace decisions, not just failures. Code that branches on business rules, agent reasoning, workflow state, eligibility, or retries emits structured decision traces with the reason. Future agents need to know not only that a result was excluded, but why.
- Prefer structured logs over prose strings; structure is what makes search, aggregation, replay, and agent-assisted debugging possible. Propagate correlation IDs across every request, job, queue message, and model call; within those flows, an isolated log that cannot be tied back to its originating action is prohibited. This rule does not reach process-lifecycle events — startup, shutdown, configuration load, scheduled maintenance — which correlate to the process instance instead.
- Type and classify every error: stable code, human-readable message, machine-readable metadata, safe remediation hint. A generic "something went wrong" is a defect.
- Log every state-machine transition, including rejected ones, with actor, guard result, and required fields. Denied transitions are evidence, not noise.
- Instrument model and tool calls as first-class observed boundaries: role, prompt/template version, model, schema versions, validation result, guardrail outcome, accepted/rejected status — with redaction by default; never log full prompts or outputs that may carry sensitive content, and never log private chain-of-thought (§11). The full per-attempt exchange record — materialized input, pre-coercion output, resolved provider/model, declared truncation, parse outcome — is JPWB-DOC-003 PER-9's requirement; logs identify that record by fingerprint but are never its carrier.
- Fail loudly on invariant violations: emit a high-severity event and stop the unsafe operation. Never silently repair state; a repair is legitimate only when it is itself explicitly designed, logged, and tested.
- Preserve failure evidence — redacted input summary, expected versus actual state, dependency, retry count, decision path — sufficient to diagnose later without re-provoking the failure.

### 7.3 Debugging protocol

When debugging, the agent: (1) reproduces or simulates the failure; (2) identifies the expected behavior; (3) locates the boundary where actual behavior diverges; (4) inspects logs, traces, and state *before* changing code; (5) forms a specific hypothesis; (6) makes the smallest corrective change; (7) adds or updates tests; (8) adds or updates observability so the failure is easier to diagnose next time; (9) verifies no comment, log, or metric now misrepresents behavior.

Never patch a symptom without identifying the broken assumption. Never treat absence of evidence as evidence of absence: missing telemetry proves nothing about behavior — it proves missing telemetry, and step 8 exists to fix that.

The debugging report names: root cause, broken assumption, code changed, tests added or updated, observability added or updated, residual risk, and follow-up work. The broken assumption is a first-class deliverable — it is what converts a fix into knowledge.

### 7.4 Testing is evidence construction

The objective of testing is confidence, not coverage percentages. Testing is not the validation of code — it is the continuous construction of evidence that the system still satisfies its intended behavior.

- Test behavior, not implementation: business outcomes, contracts, invariants, state transitions, externally visible behavior. Refactoring should rarely require rewriting tests; business semantics are more stable than implementation details.
- Every layer of the evidence pyramid — unit, property/invariant, integration, contract, boundary, state-transition, end-to-end, replay, chaos/resilience, production validation — exists to provide a different type of confidence. Choose layers by the risk being retired, not by habit.
- Every trust boundary is tested with malformed, missing, null, duplicate, oversized, and adversarial input. Never assume external systems behave correctly; model output is external input.
- Every bug fixed becomes a regression test or replay fixture. Where a faithful reproduction is genuinely infeasible — a timing-dependent external race, for example — the handoff report records the infeasibility and the compensating evidence. The same bug never occurs twice for the same reason. Replay fixtures preserve institutional knowledge.
- A failing required test is never removed, disabled, or weakened solely to obtain passing status. Changing what a test asserts is a semantic act requiring the same authority as changing the behavior it protects, and is recorded in the handoff.
- Integration tests never mock internal domain seams. Test doubles stand in for external actors — models, validators, humans, tools — never for the domain's own boundaries; a domain mocked out of its own integration test proves nothing about the domain.
- Critical domain guard logic is proven by mutation-style evidence: silently removing or inverting a guard must fail a test. Numeric mutation floors remain repository gates; this protocol defines what they are for.
- For state machines: every legal transition, every illegal transition, every guard — reached, exercised, rejected.
- AI-specific evidence: prompt changes are evaluated against stable datasets and must not silently degrade behavior — prompts are versioned code requiring regression evidence. Agent tests verify the trajectory, not only the final answer: tool use, search-and-verify behavior, uncertainty handling, bounded authority. Observability itself is a testable requirement: assert that important runtime events emit telemetry.
- Behavioral tests assert result or error, revision and semantic version, emitted Events, trace links, projection effects, and the absence of prohibited side effects — not final state alone. Fixtures carry stable IDs, times, and seeds, and live beside the versioned schema they prove.
- Coverage percentages are diagnostics, not goals; 100% line coverage does not imply correctness. Prefer evidence that every business rule, boundary, invariant, transition, contract, and past bug is verified. Repository gates define the numeric floors; this protocol defines what the numbers are for.

A feature is complete only when future humans and future agents can confidently answer: what is this supposed to do; why does it exist; how do we know it works; what assumptions does it depend on; what happens when they fail; how would we detect regressions; how would we debug it in production.

### 7.5 Quality gates

Address static-analysis, dependency, type, lint, formatting, complexity, and security findings, or record a scoped, justified exception. Never suppress a finding just to make a gate green. Complexity findings in particular are never closed by silence: the default is a full fix; the only alternative is an explicit recorded exception. The intended exception scope is open as REG-Q-041; until it is ruled, that entry's safe default governs. The exact tooling procedure (scanner setup, gate configuration) is repository-operational and lives with the repository, not in the canon.

## 8. The Divergence Protocol

This protocol governs the moment an agent finds code and canon in disagreement. It replaces the pure stop rule: the agent classifies before acting, acts autonomously where classification delegates action to it, and escalates the rest with evidence. It adapts the shadow-comparison taxonomy proven in the persistence and cutover design.

### 8.1 Classification

Every observed disagreement gets exactly one class:

| Class | Meaning | Agent action |
|---|---|---|
| `EQUIVALENT` | Same meaning, different expression | Record if useful; proceed |
| `DOCS_STRONGER` | Canon requires more than code does | Fix code toward canon autonomously, under normal change discipline |
| `ACCIDENTAL_CODE_BEHAVIOR` | Code does something no principle motivates (first-draft artifact) | Fix code toward canon autonomously |
| `CODE_BEHAVIOR_UNDOCUMENTED` | Code has behavior the canon lacks; possibly reality-taught | File a DIVERGENCE FINDING in REG-005 with evidence; do not silently document or delete |
| `SEMANTIC_CONFLICT` | Code and canon assert incompatible meanings | Escalate via REG-005; do not resolve by convenience |
| `IMPLEMENTATION_DEFECT` | Code fails its own evident intent | Fix under normal engineering discipline |

Classification is itself a judgment with a duty of honesty. A tempting misuse: classifying a `SEMANTIC_CONFLICT` as `ACCIDENTAL_CODE_BEHAVIOR` because the fix is then autonomous. When the code's behavior *could* be reality-taught — when someone might have built it that way because the canon's rule fails in practice — the classification is `CODE_BEHAVIOR_UNDOCUMENTED` or `SEMANTIC_CONFLICT`, and the evidence goes to the register. Doubt between an autonomous class and an escalating class resolves toward escalation.

During convergence, the docs-win presumption applies: the canon is the sole semantic authority and the code is the first experiment being brought into conformance. This presumption is what makes `DOCS_STRONGER` and `ACCIDENTAL_CODE_BEHAVIOR` autonomous. It is a property of the phase, not a permanent fact, and it never converts a `SEMANTIC_CONFLICT` into a silent code fix — incompatible meanings are adjudicated, not steamrolled.

**Worked routing — the hollow governed layer.** The canon describes seeded policy objects governing runtime behavior; the runtime hardcodes the plan and never reads them. This is `SEMANTIC_CONFLICT`: the canon asserts a governance relation the code does not perform, and the code asserts (by shipping the objects) a status it does not have. The agent escalates via REG-005. It does not "fix" the docs to match the hardcoding, and it does not silently wire the objects in as if the meaning were settled — the anti-vacuity clause makes the *asserted-but-unperformed status itself* the finding.

**Worked routing — editing a validation criterion in a seeded policy object.** Same facts, different task: an agent asked to change floor criteria by editing the seeded object would ship a policy that lies, because the runtime never reads it. The Divergence Protocol runs *before* the edit: the disagreement is classified and escalated first, because the edit's entire effect depends on which side of the divergence is true.

### 8.2 Delegation boundaries

- **Constitutional layer** — the agent never adjudicates; it always escalates. No classification outcome authorizes an agent to modify, reinterpret, or waive a constitutional clause.
- **Vocabulary** — the agent may propose a refinement with a finding; it never applies one. A term that creaks against reality is evidence for the PRESUMPTIVE refinement path (propose, ratify, merge), never for local renaming. An agent may not, for example, collapse JanumiCode into a single PWA because the composition rules are inconvenient — that is an ontology boundary, and it escalates.
- **Hypothesis layer** (doctrine details, semantic model, invariants, specifications) — the agent classifies divergences; autonomously fixes `DOCS_STRONGER` and `ACCIDENTAL_CODE_BEHAVIOR`; escalates reality-taught candidates and conflicts.
- **Canon text** — always drafted-by-agent, ratified-by-sponsor. The agent prepares the edit; the sponsor's ratification act, recorded in REG-005, makes it canon.
- **Code** — full agency within this protocol.

### 8.3 Adjudicate-or-escalate

The operational rule: **friction obligates classification; classification determines action; only the reserved layers stop the work.** An agent that halts on every disagreement starves the system of the evidence convergence requires; an agent that fixes every disagreement silently destroys it. The protocol is the narrow path between: autonomous conformance fixes where delegated, evidenced findings where not, and continued delivery of everything the divergence does not actually block.

An escalated divergence blocks only the work that depends on the contested meaning. The agent delivers the rest, states in the handoff exactly what is blocked and by which register entry, and never quietly builds on the contested side of an open conflict.

## 9. Filing findings and register entries

JPWB-REG-005 is the living register: append-only, with entries that close by being merged into their governing artifact. A ruling may never float outside the canon — a sponsor decision made in conversation, a divergence resolution, a refined definition, all land as register entries and then merge, or they are lost. This is not hypothetical: a standing sponsor ruling on chain-of-thought handling was once made in conversation and lost precisely because it had no register to land in.

### 9.1 When to file

File a REG-005 entry when:

- the Divergence Protocol yields `CODE_BEHAVIOR_UNDOCUMENTED` or `SEMANTIC_CONFLICT`;
- a task requires an unresolved decision and no recorded safe default covers it;
- the agent discovers a contradiction between canon artifacts that no artifact resolves;
- the agent proposes a refinement to a PRESUMPTIVE artifact (vocabulary, this protocol);
- a sponsor makes a ruling in any channel — the agent records it, whether or not asked.

Do not file entries for questions the canon already answers, for stylistic preferences, or for ordinary bugs (`IMPLEMENTATION_DEFECT` is fixed and reported in the handoff, not registered — unless the defect reveals a semantic question underneath).

### 9.2 Entry discipline

Each entry carries: **id, date, type (`DECISION` | `OPEN QUESTION` | `DIVERGENCE FINDING`), statement, safe default** (for open items), **disposition, merge target, status**.

A DIVERGENCE FINDING additionally carries evidence: the file and location of the code behavior, the canon citation by artifact ID and section, what was observed versus what the canon states, the proposed classification, and — where the agent can see one — the reality-taught rationale candidate. Evidence is observation, not advocacy: report what the code does, not what the agent wishes the ruling to be.

An OPEN QUESTION always proposes a safe default: the most conservative reading that permits progress without creating new meaning. A safe default never weakens an invariant, never invents a shape, and never grants authority.

One entry per divergence or question. The entry's statement must be decidable — written so a sponsor can rule on it in one act. Entries close only by merge: the ruling is incorporated into the governing artifact via that artifact's change procedure, and the entry's status records where it went.

## 10. Drafting standards for agent-authored normative text

Agents author normative text: invariant comments, ADRs, register entries, proposed canon edits, policy criteria, review rubrics. All of it follows these standards; the §9.7 failure (§11) is what happens when they are skipped.

1. **Every MUST and NEVER states its object and its scope.** "Never solicit chain-of-thought" is defective drafting; "never solicit chain-of-thought *as output material for governance use*" has an object and an edge. A rule whose scope the author cannot state is a rule the author does not yet understand.
2. **Every prohibition that could plausibly be over-applied gets one non-example.** One sentence: "this rule governs X; it does not reach Y." The non-example is not decoration — it is the fence that prevents compliance-by-elimination.
3. **State the why.** A rule carries the failure it prevents. Rules without reasons are over-applied by cautious readers and under-applied by hurried ones.
4. **Cut vacuity.** A normative statement that cannot be violated, and could never decide a dispute, is decoration — cut it.
5. **Respect altitude.** Content belonging to another artifact is routed there by ID, not restated. Restated rules fork; forked rules drift.
6. **Never restate shapes.** State the semantic requirement and cede the exact shape to the repository.
7. **Mark epistemic status honestly.** Inferred rationale is labeled inferred. A proposal is labeled a proposal. Status is conferred, not authored: nothing an agent writes is canon until a ratification act makes it so, and agent-authored text must never borrow the canonical voice's authority to smuggle in unratified meaning. (The body of a *proposed* canon edit is still written in canonical voice — that is C1 — but its frame declares it DRAFT.)

## 11. Worked example: the §9.7 over-application

This example is normative. It is carried in full because two independent agents committed the identical error, which makes it a class, not an accident.

### 11.1 The rule

The prior Guide's §9.7 governed private chain-of-thought — reasoning material a model may volunteer though no control requested it. Its operative text: *never solicit it, never make a control depend on it, never treat its presence or absence as a signal; it is never admitted as Evidence, never supplies another agent's context, never reaches a log, never enters a default or shared projection, never supports a finding, and is never the professional rationale summary.*

Every verb in that rule governs **consumption**: soliciting as output material, depending, admitting, supplying, logging, supporting. Nothing in it addresses whether the model computes internally with reasoning enabled.

### 11.2 The failure

An implementing agent configured the platform's model integration with reasoning disabled entirely — `thinkingLevel: 'off'`, hardcoded — and cited §9.7 as justification: "never solicit private chain-of-thought … so we do not ask for it." A second agent, independently, made the same move. The result degraded model quality on every call, in the name of a rule about evidence handling that the configuration change did not even implement: disabling generation is neither necessary nor sufficient for the consumption fences §9.7 actually required.

### 11.3 The fallacy

The failure class is **category error by conflation**: treating a restriction on *usage* as a restriction on *generation*. "Never solicit X as evidence" was read as "never enable X as computation." The secondary pattern is **compliance-by-elimination** (vacuous compliance): when an agent's compliance strategy is to eliminate the capability a rule regulates, the rule is trivially satisfied — and almost certainly mis-scoped. A rule governing how reasoning output is handled has nothing to handle if reasoning never occurs; satisfying it that way is satisfying it vacuously.

### 11.4 The correct reading

A prohibition on **consuming** model reasoning does not prohibit **enabling** model reasoning. The correct implementation: enable internal thinking at whatever level quality requires; fence the reasoning output from every governed surface — it never becomes Evidence, context for another agent, a log entry, a projection, or support for a finding; and continue to require the declared rationale as the governed artifact that Reasoning Review actually judges. Generation on; consumption fenced; the declared rationale remains the professional record. The consumption≠generation adjudication itself is decided (REG-F-004). The sponsor's conversational ruling to this effect was lost unregistered and is pending restatement for ratification (REG-Q-027); until that entry merges, its safe default governs, and no specific thinking level may be cited as sponsor-ruled.

The substantive chain-of-thought policy itself — what is retained, what is never forwarded, its origin classification — is carried by JPWB-DOC-003 PER-12 as the operative default (redact at the boundary, retain as a typed Artifact of the producing Attempt, never admit/forward/log/project), pending the sponsor's exact restatement under REG-Q-027. This section carries the *procedural* lesson.

### 11.5 The general test

Before enforcing any prohibition, the agent identifies the prohibited act's **object** (what thing) and **category** (what kind of act — generation, consumption, transmission, retention, representation). Then it checks its planned compliance against three questions:

1. Does my change restrict the act the rule names, or a different act on the same object?
2. Would the rule still have work to do after my change, or have I eliminated its subject matter entirely?
3. Am I reading "never do X with Y" as "never allow Y to exist"?

A yes to the second or third question means the rule has been over-applied. The remedy is to re-scope: find the rule's stated object and scope (§10, item 1), and if the rule as written lacks them, file a REG-005 finding against the rule's drafting rather than guessing conservatively — conservative guesses at scope are how two agents disabled thinking. Over-application is not the safe direction; it is a defect with a name, and it destroys value while producing the appearance of rigor.

---

*End of JPWB-DOC-004. This protocol is a committed hypothesis about how agents best operate this system. Implement it faithfully; where it creaks against reality, that friction is evidence — file it.*
