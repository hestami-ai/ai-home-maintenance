# Canon Synthesis Design Brief

**Date:** 2026-07-16
**Authority:** Sponsor-authorized synthesis program (session decision, 2026-07-16). This brief records the consensus reached between the sponsor and the drafting agent and is the controlling instruction for every synthesis, extraction, review, and repair agent in this program.

## 1. Mission

Replace the current JPWB documentation corpus (~200k+ words, `JanumiCode/janumiprofessionalworkbench/docs/`) with a six-artifact canon that a coding agent can consume to be **maximally and optimally informed**. After sponsor ratification, the source corpus will be RETIRED (moved out of the agent-visible tree). Therefore: **any load-bearing content not carried forward into the six artifacts (or explicitly ceded to the repository) is lost.** Survivorship matters.

The primary consumer is a coding agent. Human legibility matters only at the governance surface (REG-005 and the Ratify Sheet).

## 2. The problem set being solved (context for every drafting decision)

- **P1 Status flattening:** every source doc speaks in the same settled, binding register regardless of layer and ratification state. Genre (spec vs. chat transcript) is unmarked.
- **P2 Authority without conferral:** canonical status was claimed at authoring time, never conferred by an act. The only ratified artifact in the corpus is the M0 Reconciliation Ratify Sheet.
- **P3 Missing layers:** explicit doctrine (the theory/outcome driving the vocabulary) and CONOP/CONEMP (how humans and agents operate the system) were never separated out. The raw material exists, chiefly in the Constitution Discussion.
- **P4 Non-traveling adjudication:** the Coding Agent Guide adjudicates the corpus (precedence, demotions, safe defaults) but those rulings live only in the Guide; the primaries are unmarked and outrank it in voice.
- **P5 Undeclared authority direction between docs and code:** code predates most docs; docs describe a target in descriptive present tense; nothing maps which claims are LIVE vs TARGET vs FALSE.
- **P6 Rules without edges:** absolute prohibitions without scope boundaries or non-examples. Proven failure: two independent agents over-applied Guide §9.7 ("never solicit chain-of-thought" → disabled model thinking entirely). Class name: vacuous compliance / compliance-by-elimination.
- **P7 Scale/consumption mismatch:** corpus too large to hold, too interdependent to grep; grows by transcript accretion with no compaction.

**C1 (constraint):** the canonical voice is load-bearing and must be preserved in body text. It is the voice of **commitment**, not finality: "this is the hypothesis we are committed to testing rigorously." Rigor is justified by experimental validity — a hypothesis implemented sloppily teaches nothing; faithful implementation is what makes friction evidentiary.

## 3. The settledness ladder (normative for all artifacts)

Almost nothing in this system is settled by real-world operation yet. The entire system is pre-Baseline. Settledness descends the abstraction stack:

| Level | Class | Meaning | Relitigation |
|---|---|---|---|
| 0 | **CONSTITUTIONAL** | Vision, worldview, thesis, values, axioms, first principles. Genuinely settled. | Sponsor decision only. |
| 1 | **PRESUMPTIVE** | Canonical vocabulary; operating protocol. Strong default, more settled than unsettled, rebuttable where theory meets reality. | Governed refinement act (REG-005 entry, sponsor ratification). Never casual drift. |
| 2 | **HYPOTHESIS** | Doctrine details, semantic model, invariants, specifications. Committed hypotheses under test. Implement faithfully; treat friction as evidence. | Divergence protocol (below). |
| 3 | **EXPERIMENT** | The code. First implementation of the first principles, written without benefit of this canon. | Normal engineering under the protocol. |
| — | **LIVING** | The register. Append-only log; entries close by being merged into governing artifacts. | Continuous. |

## 4. Status block schema (every artifact begins with this)

```markdown
---
artifactId: JPWB-XXX-NNN
title: <title>
layer: Constitutional | Doctrine | Vocabulary | Semantic Model | Protocol | Register
settledness: CONSTITUTIONAL | PRESUMPTIVE | HYPOTHESIS | LIVING
status: DRAFT — pending sponsor ratification
version: 0.1.0
date: 2026-07-16
governs: <bulleted: what questions this artifact answers authoritatively>
doesNotGovern: <bulleted: what it explicitly does NOT answer, and who does>
precedence: <relation to other artifacts and to the repository, by concern>
changeProcedure: <how this artifact may be changed, per its settledness class>
ratification: PENDING — becomes effective via REG-005 entry
---
```

The status block is the frame that lets the body keep full canonical voice (C1) without recreating P1.

## 5. The artifact set

All drafts go to `e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\docs\_canon_draft\`. Each artifact also produces a provenance sidecar `<filename>.provenance.md` mapping each major section to its sources (file + line range) or marking it NEW (from session consensus) or ELICITATION-REQUIRED.

### JPWB-CON-000 Constitution (`JPWB-CON-000 Constitution.md`)
- **Settledness:** CONSTITUTIONAL. **Budget: 1,500–3,000 words body.** A constitution longer than this is doctrine wearing a robe.
- **Part A — substantive:** vision, worldview, thesis, values, axioms, first principles. Distilled from sponsor-authored statements wherever possible (HUMAN turns in the discussion transcripts are primary sources; assistant turns are candidate articulations). Where the sponsor's actual position is unknown or extracted candidates conflict, include the strongest candidate clause and mark it `[ELICITATION: <question>]`.
- **Part B — rule of recognition** (draft near-verbatim from §10 of this brief).
- **Test:** every clause must be able to decide a dispute (see case battery, §9). A clause that cannot be violated is decoration — cut it.

### JPWB-DOC-001 Doctrine and Concept of Operations (`JPWB-DOC-001 Doctrine and Concept of Operations.md`)
- **Settledness:** PRESUMPTIVE (doctrine core) with HYPOTHESIS subsections clearly marked. **Budget: 4,000–8,000 words.**
- Carries: the theory that generates the vocabulary (professional work as reasoning under uncertainty directed toward outcomes; the cognitive loop; why the ontology has its shape; execution≠assurance and the other load-bearing inequalities *as reasoned doctrine, with the why*); Shape/Assurance/Harness/Context/Loop/Prompt engineering disciplines and their boundaries; **the CONOP/CONEMP**: how humans and agents actually operate JPWB across the five workbench contexts — who does what, in what rhythm, with what authority, from Undertaking creation through Baseline promotion; the dual stance itself (rigor-as-commitment; friction-as-evidence).
- Sources: Constitution Discussion (primary for P3 content), Guide §§1–2, 4, 8.1–8.2, 11 (CONOP-relevant), RPH-DOC-001, RPH-DOC-010, Fusion Analogy (explanatory lens only), Additional Concepts (maximalist framing).

### JPWB-DOC-002 Canonical Vocabulary (`JPWB-DOC-002 Canonical Vocabulary.md`)
- **Settledness:** PRESUMPTIVE. **Budget: 3,000–6,000 words.**
- Carries: canonical terms and meanings; the non-equivalence inequalities; retired/compatibility terminology; naming rules. Guide §3 is ~80% of this; verify against RPH-DOC-000 (the Vocabulary Charter) and carry forward what the Guide compressed away if load-bearing.
- Each term entry: meaning, what it is NOT (the non-equivalences belong beside the terms they guard), and — where a term has caused real confusion — a one-line note of the confusion it exists to prevent.

### JPWB-DOC-003 Semantic Model and Invariant Catalog (`JPWB-DOC-003 Semantic Model and Invariant Catalog.md`)
- **Settledness:** HYPOTHESIS. **Budget: 6,000–10,000 words.**
- Carries **meaning only**: the five-layer semantic model; core objects and their minimum rules; aggregate boundaries; relationship types; state axes and transition guards (as semantic requirements, not wire enums); decomposition/recomposition contracts; the assurance model (de minimis floor, Reasoning Review, dimensions, dispositions, independence, waivers, Decisions, Baselines); persistence *semantics* (one authority, immutable events, no hard-delete rules); the governed professional stream as a logical concept.
- **Authority partition (critical):** exact shapes — wire envelopes, JSON schemas, enum spellings, ID prefixes, error codes, generated contracts — are CEDED to the repository (generated contracts, schema files, conformance tests). DOC-003 states the semantic requirement and points to the repo as shape authority. Do NOT restate shapes that can drift. Where the Guide/DOC-007 recorded an exact wire rule whose *meaning* is load-bearing (e.g., "optimistic concurrency rejects stale commands; never last-write-wins"), keep the meaning, cede the shape.
- Every invariant entry: statement (canonical voice) + WHY (the failure it prevents) + SCOPE (what it governs / does not govern) + where warranted a NON-EXAMPLE of over-application (P6).

### JPWB-DOC-004 Agent Operating Protocol (`JPWB-DOC-004 Agent Operating Protocol.md`)
- **Settledness:** PRESUMPTIVE (procedural). **Budget: 4,000–8,000 words.**
- Carries: intake discipline (adapt Guide §15); the smallest-coherent-change and verification ladders; engineering practice (absorb the Engineering Constitution's durable content); the reading protocol (load order: CON-000 → task-relevant artifacts; the repo is shape authority); **the divergence protocol** (§8 of this brief, near-verbatim); the adjudicate-or-escalate rule replacing the pure stop rule; how to file findings and register entries; drafting standards for any normative text the agent itself authors (P6 edge rule).
- Includes the §9.7-class lesson as an explicit worked example of over-application (generation vs consumption of model reasoning).

### JPWB-REG-005 Decision and Divergence Register (`JPWB-REG-005 Decision and Divergence Register.md`)
- **Settledness:** LIVING. Append-only; entries close by being merged into governing artifacts (a ruling may never float outside the canon — that is how the CoT ruling got lost).
- **Founding entries** (record as DECIDED, session 2026-07-16, sponsor + drafting agent): (1) the problem set P1–P7 and constraint C1; (2) the six-artifact architecture; (3) the settledness ladder; (4) the authority partition (docs=meaning, repo=shapes); (5) docs are sole semantic authority during convergence; (6) source corpus retirement upon ratification; (7) the delegation boundaries.
- **Open questions:** carry forward every still-unresolved item from Guide §16 (the 25-item register), restated against the new artifact set, each with its safe default. Add all `[ELICITATION: …]` items from CON-000 drafting. Add any contradictions discovered during extraction that no artifact resolves.
- Entry format: id, date, type (DECISION | OPEN QUESTION | DIVERGENCE FINDING), statement, safe default (for open items), disposition, merge target, status.

## 6. Authority partition (P5 fix)

The canon is authoritative for **meaning, intent, doctrine, vocabulary, invariants, and protocol**. The repository — generated contracts, schemas, migrations, conformance tests — is authoritative for **exact shapes**. The canon never restates a shape the repo can express; it states the semantic requirement and defers. This is precedence by concern, not by document.

## 7. Convergence-phase authority rule

During the convergence phase (now, until closure): **the canon is the sole semantic authority; the code is the first experiment being brought into conformance.** "Dual run never means dual semantic authority." The code was written without benefit of this canon; divergence is expected and is evidence, not scandal. The docs-win presumption is a property of this phase, not a permanent fact; settledness is thereafter earned bottom-up through real-world operation.

## 8. Divergence protocol (for DOC-004; adapted from RPH-DOC-009 shadow-comparison taxonomy)

When the agent finds code and canon in disagreement, it classifies before acting:

| Class | Meaning | Agent action |
|---|---|---|
| `EQUIVALENT` | Same meaning, different expression | Record if useful; proceed |
| `DOCS_STRONGER` | Canon requires more than code does | Fix code toward canon autonomously, normal change discipline |
| `ACCIDENTAL_CODE_BEHAVIOR` | Code does something no principle motivates (first-draft artifact) | Fix code toward canon autonomously |
| `CODE_BEHAVIOR_UNDOCUMENTED` | Code has behavior the canon lacks; possibly reality-taught | File a DIVERGENCE FINDING in REG-005 with evidence; do not silently document or delete |
| `SEMANTIC_CONFLICT` | Code and canon assert incompatible meanings | Escalate via REG-005; do not resolve by convenience |
| `IMPLEMENTATION_DEFECT` | Code fails its own evident intent | Fix under normal engineering discipline |

**Delegation boundaries:** Constitutional layer — never adjudicates, always escalates. Vocabulary — may propose refinement with a finding; never applies one. Hypothesis layer — classifies divergences; autonomously fixes `DOCS_STRONGER` and `ACCIDENTAL_CODE_BEHAVIOR`; escalates reality-taught candidates and conflicts. Canon edits are always drafted-by-agent, ratified-by-sponsor. Code — full agency within the protocol.

## 9. Case battery (acceptance test for CON-000 and DOC-004)

The draft must decide, or explicitly route to the correct layer, each historical dispute:

1. §9.7 over-reach: does a prohibition on consuming model reasoning prohibit enabling it? (Expected: no — P6 edge rule; consumption≠generation.)
2. Guide-vs-DOC-000 precedence: which document wins on a naming question? (Expected: rule of recognition answers by concern.)
3. Hollow governed layer: docs describe seeded policy objects governing runtime; runtime hardcodes the plan. (Expected: SEMANTIC_CONFLICT → escalate; asserted status without performed status is prohibited.)
4. Docs-vs-code direction during convergence. (Expected: canon wins by default; classified exceptions.)
5. May an implementing agent collapse JanumiCode into one PWA? (Expected: no — vocabulary/ontology boundary; escalate.)
6. A sponsor ruling made in conversation (e.g., CoT retain-but-never-forward): where must it land? (Expected: REG-005 entry, merged into governing artifact; may not float.)
7. Agent tempted to add tenant fields to a wire envelope ad hoc. (Expected: shapes are repo authority; contract change procedure.)
8. Multi-PWA composition semantics absent. (Expected: open question with safe default; do not invent.)
9. Who may retire a source document? (Expected: sponsor act, recorded.)
10. Vocabulary term meets reality and creaks (e.g., `Undertaking` vs `Professional Endeavor`). (Expected: PRESUMPTIVE refinement path — propose, ratify, merge.)

## 10. Rule of recognition (CON-000 Part B — draft near-verbatim)

1. **The canon.** The recognized corpus is exactly: JPWB-CON-000, JPWB-DOC-001, JPWB-DOC-002, JPWB-DOC-003, JPWB-DOC-004, JPWB-REG-005, plus the repository's generated contracts, schemas, and conformance tests as shape authority. Nothing else governs. A document not in this registry — whatever its title or voice — is historical material.
2. **Status is conferred, not authored.** An artifact's authority derives from its ratification record in REG-005, never from its title, voice, or fluency. Every artifact carries a status block; the block is part of the artifact.
3. **Precedence is by concern.** Vision/values/first principles → CON-000. Reasoning, judgment, operation → DOC-001. Naming and meaning of terms → DOC-002. Semantic structure and invariants → DOC-003. Agent conduct and process → DOC-004. Exact shapes → the repository. Open questions and rulings → REG-005. On conflict between artifacts, the artifact that owns the concern controls; on conflict within a concern, the higher settledness class controls; residual conflicts are SEMANTIC_CONFLICT findings.
4. **The settledness ladder** (§3 of this brief) is constitutional. Every normative statement in the canon inherits its artifact's settledness class unless explicitly marked otherwise.
5. **Change procedure.** CONSTITUTIONAL: sponsor decision, recorded. PRESUMPTIVE: proposed via REG-005 finding, sponsor-ratified, merged. HYPOTHESIS: divergence protocol. No canon text is ever changed silently; every change traces to a register entry.
6. **The convergence clause** (§7 of this brief).
7. **Anti-vacuity clause.** No artifact, object, or field may claim a status its relations do not perform (no provenance theater, no policy objects the runtime never reads, no assurance represented by an unread flag). Asserted status must be performed status.
8. **Retirement.** The pre-canon corpus is retired upon ratification: moved out of the agent-visible tree, preserved in history. Retired documents have no authority and must not be consulted as authority. Reading them requires treating them as historical evidence only.

## 11. Drafting standards (all artifacts)

- **Voice:** canonical, declarative, present tense in body text (C1). No hedging inside clauses; the status block carries the epistemic frame. Statements of commitment, not speculation.
- **Edges (P6):** every MUST/NEVER states its object and scope; every prohibition that could plausibly be over-applied gets one non-example ("this rule governs X; it does not reach Y").
- **Altitude:** content at the wrong layer is routed to the right artifact, not kept. The constitution stays constitutional.
- **Vacuity:** a normative statement that cannot be violated, and could never decide a dispute, is cut.
- **No shape restatement:** see §6.
- **Compression with provenance:** prefer the Guide's already-adjudicated formulations where they were sound (the Guide is the strongest prior synthesis); verify demotions against sources rather than inheriting them blindly.
- **Self-containment:** after retirement there are no sources to "follow the link" to. Each artifact must be sufficient at the level of exactness it claims, or explicitly delegate (to the repo, or to another artifact by ID).

## 12. Source corpus map (for extraction and survivorship)

Base: `e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\docs\`

- `Recursive Professional Harness\` — the 10 numbered RPH docs + README + Executive Overview + Engineering Constitution. Primary sources. RPH-DOC-000=Vocabulary Charter, 001=Migration, 002=Domain Model, 003=Product Realization ontology, 004=Assurance Catalog, 005=Legacy mapping, 006=FSM fixture, 007=Contract Package (shapes→repo), 008=Conformance (shapes/tests→repo; properties' meanings→DOC-003), 009=Persistence/cutover (semantics→DOC-003; the shadow-divergence taxonomy→DOC-004), 010=Workbench UX (CONOP input→DOC-001).
- `Constitution Discussion\Janumi Constitution Discussion.md` (30,230 lines, chat transcript) — P3's raw material: first principles, cognition loop, CPCO, projections, Shape Engineering, JSDL/JEM (candidates only — the Guide demoted these; verify and preserve the demotion), CONOP-relevant material. HUMAN turns are sponsor primary source.
- `Documentation Challenges\` — the canonical-vs-doctrinal discussion (this program's origin) and the §9.7 fallacy analysis (worked example for DOC-004).
- `Legacy JanumiCode Source Materials\` — spec v2.3 (4,221 ln), Validator Subsystem (2,502 ln), Fusion Analogy (497 ln). Transfer value only: Governed Stream concept; validator/assurance shaping; fusion as explanatory lens. Phase models, schemas, storage, CoT-capture are explicitly NOT carried (Guide's demotions stand).
- `Additional Concepts\` (sans website prototype) — maximalist vision: Capability Vision & Strategic Evolution Map (1,245 ln), Complex Systems (1,475 ln), Construction (578 ln), Healthcare (346 ln), Atomic Agents (241 ln). Feed CON-000 Part A vision and DOC-001 doctrine breadth. Domain expansion specifics stay out of the canon (they are futures, not commitments) unless stated as vision.
- `Janumi Canonical Implementation Context - Coding Agent Guide.md` (2,551 ln) — the strongest prior synthesis; superseded by this program; its content redistributes as described above; its §16 register carries into REG-005.
- `JPWB Reconciliation Ratify Sheet (M0).md` — the ratification precedent; REG-005 models its entry discipline on it.
- `JPWB Implementation Roadmap and Tracker.md` — status snapshot; not canon; note for REG-005 context only.

## 13. Known ground truth the canon must not contradict

- The governed-objects layer in the current code is partly a projection: seeded policy objects exist that the runtime never reads; the authoring floor was hardcoded (since remediated in increments). The kernel was ~74% dead in production before the wiring program.
- The vocabulary registry's `sourceSection` fields were provenance theater for most field-bearing entries.
- The engine honors client `expectedRevision` (optimistic concurrency is real).
- Two independent agents over-applied Guide §9.7 in the same direction.
These are evidence for the anti-vacuity clause and the convergence-phase framing; DOC-003/004 must be written knowing the code is a first experiment, not a conformant implementation.
