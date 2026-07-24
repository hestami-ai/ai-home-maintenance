# Task Prompt Template (canon-governed work sessions)

The standing structure for handing any implementation task to a coding agent under the JPWB canon. Seven slots; the first is constant, the rest are per-task. Exemplar: `docs/Command Precondition Legality/DWP-04-agent-prompt.md`.

## 1. Authority frame — CONSTANT

The canon at `docs/canon/` is operative (REG-D-010). Load order: CON-000 fully → DOC-004 fully → DOC-002/003 as touched → REG-005 filtered to the task's subjects. Safe defaults govern open questions. Everything outside `canon/` is historical **except the working authority granted below**.

## 2. Local working authority — PER TASK (sponsor grant)

Name the task's governing working documents (design docs, roadmaps, decision records) with their **binding sections and line anchors**. State their standing: working authority and enumerated obligation surface for this task's scope. State the composition rule (CON-000 B3): canon governs conduct/semantics/vocabulary/divergence handling; the granted docs govern task scope and design decisions; the repository's reference artifacts govern shapes/facts. Conflicts are classified and filed, never resolved by convenience.

**If no JPWB-SPEC covers the ground, the DEFAULT is spec-first**: structure the session in two phases — Phase 1 commissions the SPEC (use `deep-spec-commission-prompt.md`; authored from the repository's own machine/contract facts plus the granted docs; forks surfaced, not self-ratified; phase gate for sponsor rulings unless pre-authorized), Phase 2 implements as the SPEC's first conformance increment. Declaring the granted working docs "sufficient obligation surface" is a **WAIVER of spec-first, and must be written as one, with the sponsor's stated reason** — decision-brief-grade docs feeding implementation directly is exactly the shallow-docs → shallow-implementation pattern the three-tier architecture (REG-D-009) exists to break. Either way, never let the agent proceed on ground nothing enumerates.

Pin versions where the working tree and HEAD diverge.

## 3. The task — PER TASK

The scope itself. Include **known corrections to the working docs** (stale claims, drifted lists) as things to *re-verify*, not trust — never let the prompt's correction become the new unverified claim.

## 4. Canon bindings — PER TASK (the maximum-effect section)

Map each of the task's local disciplines to the canon clause that generalizes it (e.g., "unkillable test = B7 anti-vacuity"; "unratified source = B2"; "verify claims against the code = DOC-004 §3.2"). Two effects: the agent applies the *general* law — covering cases the briefing didn't enumerate — and every local rule inherits its why.

If the sponsor or orchestrating agent hasn't pre-written this section, instruct the coding agent to write it itself at intake (map the local rules to canon clauses in the change contract) — the mapping exercise is itself what makes the agent internalize the canon.

## 5. Filing — CONSTANT SHAPE, PER-TASK PATHS

Canon-level findings (silences, ambiguities, over-application temptations, SPEC-gaps) → `docs/canon/_test/pilot-findings-<date>.md`, REG-005 entry discipline, `PILOT-nnn`. Task-level records → the working docs' own conventions.

## 6. Operational constraints — PER TASK

Repository-specific hazards and authority mechanics (e.g., no git worktrees on this checkout; sponsor commits are the ratifying act; the applicable verification gate).

## 7. Handoff — CONSTANT SHAPE

DOC-004 §6.3 report + a task-appropriate evidence table (per-site / per-item: what was verified, citations, named tests and their red-proof, behavior changes) + the canon report (what the canon answered, silences, findings count).

---

**Template maintenance:** this file is program tooling, not canon. If a slot proves wrong in practice, that's a pilot finding.
