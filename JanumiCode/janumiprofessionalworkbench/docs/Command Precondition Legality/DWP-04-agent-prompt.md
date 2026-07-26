# DWP-04 — session prompt (under the JPWB Canon): SPEC-001 commission + first conformance increment

This is a **two-phase engagement** per the canon's sequencing rule (REG-D-009: decision brief → forks ruled → SPEC → reference artifacts → implementation). The decision brief exists (DS-001; fork D4 ruled). Phase 1 authors the missing deep specification; Phase 2 implements DWP-04 as its first conformance increment. Do not skip to Phase 2.

## Authority frame

The documentation authority of this repository is the canon at `docs/canon/` — OPERATIVE (REG-D-010, 2026-07-24). Load order before touching anything: `JPWB-CON-000 Constitution.md` fully; `JPWB-DOC-004 Agent Operating Protocol.md` fully; then `JPWB-DOC-002`/`JPWB-DOC-003` as the work touches vocabulary or semantics; `JPWB-REG-005` filtered to this task's subjects. Open questions and elicitation items resolve to their recorded safe defaults. Everything under `docs/` outside `canon/` is historical material, **except the working authority granted below**.

## Local working authority (sponsor grant, this engagement)

- `docs/Command Precondition Legality/JAN-CMDPRE-DS-001 Command Precondition Legality Design.md` — design authority. Binding: §6 decision D4 (~L92 — allowlists are HAND-AUTHORED from each machine's in-arrows); §2–§3 (why `drivesFrom` has no authority); finding F-4 (tags-compounding); §10 residual 2.
- `docs/Command Precondition Legality/JAN-CMDPRE-DR-001 Detailed Implementation Roadmap.md` — implementation roadmap. Binding: §9 DWP-04 block (~L196–216); §12 mutation discipline (~L331–338); §14 refusal-code rules; §15 (expect ≥1 BENIGN reclassification); §16 traceability.

Precedence by concern (CON-000 B3): the canon governs conduct, semantics, vocabulary, divergence handling; DS/DR govern this program's design decisions; **the repository's state-machine rows govern the transition facts** and are the primary source for Phase 1. Conflicts are classified and filed, never resolved by convenience.

Version pin: the working-tree DR-001 carries uncommitted DWP-03 edits; the DWP-04 block, §12, and D4 are identical to HEAD `b832dccd`. Read the working tree; note this in the handoff.

---

## PHASE 1 — Author JPWB-SPEC-001: Command Precondition and Transition Legality

**Genre grant.** You are commissioned to write a **normative deep reference specification** — not a design doc, not a decision brief. It is a terminal deliverable: future implementation (starting with Phase 2) will be diffed against it. In this genre, exhaustive is correct and brevity is a defect.

**Method:** Phase 1 follows the deep-spec commission template v2 at `docs/canon/_test/deep-spec-commission-prompt.md` — its horizontal closure matrix, deontic register (every SHALL names its verification), adversarial-economy catalog, controlled-redundancy-with-citation rule, reference case, self-review battery, and stopping condition apply **in addition to** the structure below.

**Authoring grant.** The sponsor authorizes authoring at field/row grain for the command-legality surface. **Recommended scope: every command and state machine in the current registry** (governance, assurance, execution, work, intent, baseline — the full transition surface); **minimum scope: the governance + AssurancePolicy machines** (DWP-04's ground). If full scope proves too large for one pass, complete the minimum scope exhaustively and record the remainder in the Deliberately Unspecified table with a continuation plan — never thin the whole to cover more.

**Output:** `docs/canon/JPWB-SPEC-001 Command Precondition and Transition Legality.md` + `.provenance.md` sidecar. Status block per the canon schema: layer Semantic Model; settledness HYPOTHESIS; status DRAFT — authored under sponsor grant of 2026-07-24, ratification pending per CON-000 B1's SPEC-series rule.

**Required structure:**

1. **Status block**, plus scope statement and its relation to JPWB-DOC-003 (which owns meaning; this SPEC owns the enumerated legality surface).
2. **State-machine catalog.** Every aggregate machine in scope: all states; **every transition row** — from-state, to-state, triggering command, guard, emitted event — each row **cited to its machine source (file:line)**; illegal transitions enumerated explicitly, never by implication.
3. **Per-command contract catalog.** For EVERY command in scope: target aggregate/machine; legal from-states (the in-arrows, cited); **current precondition mechanism, honestly classified** (explicit `fromStates` / guard-only ["protection by accident"] / none); re-issue semantics (what a same-state re-issue does today vs. must do); the refusal-code matrix (which failure arm → which error code and result status); idempotency-key interaction; payload/eval-derived-target notes (a payload-derived target with a single source is a clean state set; a state set whose only correct value is "everything" is a vacuity trap and must become a predicate instead).
4. **Invariant catalog** (`SPEC-001-INV-nn`), each with statement, WHY, SCOPE, and NON-EXAMPLE where over-application is plausible. Must include at least: no currently-refused command becomes accepted; precondition-runs-before-guard per site (verified, not assumed); the **accumulative-field rule generalizing F-4** — a re-issue must not compound any accumulative field, with the accumulative fields enumerated per command (tags is one instance; find the others).
5. **Conformance-fixture specification.** Per command: the named re-issue test and its **mutation red-proof obligation** (weaken/remove the precondition → the named test must go red; a test that cannot fail is B7 anti-vacuity and is itself a finding). This section is what Phase 2 and all future DWPs implement against.
6. **Forks** — numbered sponsor decisions for anything a reasonable sponsor might rule differently (including scope continuation, any newly discovered guarded-only sites beyond DWP-04's six, and any machine row that appears wrong rather than merely unprotected). **Do not self-ratify**: mark authored-beyond-ratified-rows content UNRATIFIED-AUTHORED.
7. **Deliberately Unspecified table** — every referenced-but-undefined name with its reason and owning open question.

**Anti-elision rules:** no "etc.", no representative examples standing for enumerations, no command listed without its full contract row. Run a completeness audit as a distinct pass before finishing (referenced-but-undefined names; commands missing any contract element; transitions without citations) and report its counts. Expected scale: this document should be *large* — if it lands small, the cause is elision; audit before concluding.

**Phase gate:** present the SPEC and its fork list. **Pause for sponsor rulings before Phase 2** unless the sponsor has pre-authorized proceeding on recommended defaults — in which case adopt them, mark them, and continue.

---

## PHASE 2 — Implement DWP-04 as SPEC-001's first conformance increment

**Goal:** give the last unguarded/guarded-only assurance-policy and governance write sites an explicit `fromStates(...)` precondition (the DWP-01b mechanism) — now implemented **against the SPEC-001 rows**, not against ad-hoc re-derivation.

**Corrected site list — 6 sites** (the roadmap's framing is stale; ApproveDecision and GrantWaiver already got `allOf(kind, fromStates('PROPOSED'))` in DWP-01a/01b — re-verify rather than trust, and reconcile against your Phase 1 catalog):

- `governance.ts`: `revokeDecision` (EFFECTIVE→REVOKED; got only an audit comment in 01a), `promoteBaseline` (the genuinely-still-accidental canTransition site), `supersedeBaseline`.
- `assurance.ts` — AssurancePolicy.status lifecycle: `activateAssurancePolicy` (two legal sources — DRAFT and SUSPENDED — the set is a list), `suspendAssurancePolicy`, `supersedeAssurancePolicy` (tags-compounding — F-4; a re-issue must not grow the tags array).

The three AssurancePolicy commands have no `drivesFrom` anywhere → their sets come from your Phase 1 machine catalog, marked UNRATIFIED-AUTHORED. Invariants: no currently-refused command becomes accepted; SupersedeAssurancePolicy's tags cannot grow on re-issue. Tests: per-site re-issue REFUSED + ActivateAssurancePolicy accepts both sources — **each with its mutation red-proof per SPEC-001 §5**.

**The refusal-code change is a deliberate, enumerated behavior change** (DR-001 §14): wrong-state re-issue at a guarded site moves from `RPH_AUTHORITY_INSUFFICIENT`/UNAUTHORIZED to `RPH_ILLEGAL_STATE_TRANSITION`/REJECTED. Enumerate per site against the SPEC's refusal-code matrix; update any asserting test/consumer; test the new code explicitly.

If Phase 2 implementation contradicts a SPEC-001 row, that is a divergence: classify it (DOC-004 §8), fix the right side, and record it in the SPEC's provenance — the spec and the increment must leave this session agreeing.

## Filing

- Canon-level findings (silences, ambiguities, over-application temptations) → `docs/canon/_test/pilot-findings-<date>.md`, REG-005 entry discipline, `PILOT-nnn`.
- Task-level records (BENIGN reclassifications per §15, refusal-code enumeration) → per DR-001's conventions in `docs/Command Precondition Legality/`.

## Operational constraints

- **Do not use git worktrees on this checkout** — a prior worktree removal reached into the main tree and deleted 463 files. Work on the main tree. Sponsor commits are the authorization/ratification act; do not commit or push yourself.
- Verify with the affected package's full relevant gate (tests, types, lint; boundary/svelte-check where touched).

## Handoff

DOC-004 §6.3 report, plus: the SPEC (with completeness-audit counts and fork list); the per-site table — site · SPEC-001 row cited · set authored · named mutation test + red-proof · refusal-code change · disposition; and the canon report (what the canon answered, silences, findings count).
