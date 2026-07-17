# Operating under the JPWB Canon (pilot session)

You are working in `JanumiCode/janumiprofessionalworkbench/`. This repository's documentation authority is the six-artifact canon in `docs/_canon_draft/`. The artifacts are marked DRAFT pending ratification; for this session I, the sponsor, direct you to operate under them as if ratified (pilot authority). Where the canon records an open question or elicitation item, its stated safe default governs — do not relitigate defaults.

## Read in this order, before touching anything

1. **`JPWB-CON-000 Constitution.md` — read fully.** The frame: vision, values, axioms, and the rule of recognition (what governs what, the settledness ladder, the convergence clause, anti-vacuity).
2. **`JPWB-DOC-004 Agent Operating Protocol.md` — read fully.** Your standing orders: reading protocol, intake, change discipline, verification, the divergence protocol, delegation boundaries, filing discipline.
3. **Then on demand, task-relevant:** `JPWB-DOC-002 Canonical Vocabulary.md` for what terms mean (never redefine one casually); `JPWB-DOC-003 Semantic Model and Invariant Catalog.md` whenever your change touches professional-work semantics, state, assurance, or persistence; `JPWB-DOC-001 Doctrine and Concept of Operations.md` when you need the *why* in order to exercise judgment the specs don't cover; `JPWB-REG-005 Decision and Divergence Register.md` to check whether your question is already an open item with a safe default before treating it as new.

## Authority rules for this session

- **The canon is the sole semantic authority; the code is the first experiment** being brought into conformance (CON-000 B6). Expect divergence. Classify it per DOC-004 §8 — never silently patch either side to match the other.
- **Exact shapes** (fields, enums, envelopes, IDs, error codes) belong to the repository's **reference artifacts** — schemas, generated contracts, conformance fixtures — never to prose, and never to implementation code (DOC-004 §2.3). An implemented struct is not its own authority; a placeholder type that permits divergence silently is a named defect.
- **Everything in `docs/` outside `_canon_draft/` is retired-equivalent**: historical evidence only (DOC-004 §2.4). Do not consult it as authority, cite it to justify a change, or fill a canon gap from it. If a task legitimately requires it as historical evidence (e.g., transplanting a ratified schema into a reference artifact), say so explicitly when you use it. Also non-authoritative: `_design-brief.md`, `_extracts/`, `*.provenance.md`, and the Ratify Sheet — program records, not canon.
- **Where the canon is silent or ambiguous: fail closed — file, don't invent** (CON-000 AX-8). You may autonomously fix `DOCS_STRONGER` and `ACCIDENTAL_CODE_BEHAVIOR` divergences under normal change discipline; everything else escalates (DOC-004 §8.2).

## Stance

Implement the canon's hypotheses faithfully — rigor is what makes friction informative (CON-000 V6). A hypothesis implemented sloppily teaches nothing. Friction between canon and reality is evidence to file, never scandal to hide, and never license to improvise.

## Filing — this session is also a test of the canon

Do **not** write to REG-005 (it is append-only and sponsor-governed). Instead append findings to `docs/_canon_draft/_test/pilot-findings-<date>.md` using REG-005's entry discipline (`PILOT-nnn`, date, type, statement, divergence class where applicable, the safe default or interpretation you adopted, the merge target you would propose). File an entry for:

- every divergence you classify, including the ones you fix autonomously;
- every question the canon did not answer;
- every ambiguity or contradiction you find between artifacts;
- every moment you were tempted to consult retired material or over-apply a prohibition — even if you resisted.

## Handoff

Report per DOC-004 §6.3, plus a **canon report**: what the canon answered well; where it was silent, ambiguous, or contradictory; whether you ever needed retired material and why; and your pilot-findings count.

## Task

[YOUR TASK HERE]
