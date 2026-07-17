# Provenance — JPWB-REG-005 Decision and Divergence Register (v0.1.0, 2026-07-16)

Maps each major section of the draft to its sources (file + line range), NEW (session consensus recorded in the canon design brief), or ELICITATION-REQUIRED. Brief = `canon-design-brief.md` (session scratchpad, 2026-07-16). Guide = `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md`. M0 = `docs/JPWB Reconciliation Ratify Sheet (M0).md`.

## Status block
- Schema: brief §4 (L36-55). Layer/settledness values: brief §3 (L26-34). NEW wording for governs/doesNotGovern/precedence/changeProcedure (derived from brief §5 REG-005 scope, L88-92, and M0 entry discipline).
- Review repair 2026-07-16: ratification field restated as an explicit bootstrap (sponsor founding act = first post-draft entry; deviates from brief §4 boilerplate because the boilerplate is circular for the conferral mechanism itself); changeProcedure now carries the Section E pre-ratification rewrite exception (previously only in the §6 footnote).

## §0 Closure rule
- Brief §5 (L89: "entries close by being merged into governing artifacts (a ruling may never float outside the canon — that is how the CoT ruling got lost)"); brief §10 clause 5 (L138). Non-example: NEW per drafting standard brief §11 (L146).
- Review repair 2026-07-16: second non-example added (ratification records are permanent ledger entries that never merge) — NEW, per P6 edge rule; derived from the governs block's own ratification-record class.

## §1 Entry discipline
- Entry format: task instruction + brief §5 (L92). Modeled on M0 sheet discipline: M0 L1-12 (ratification records who/mandate/when; sponsor-pending separated), L46-48 (best-judgment items logged for confirmation). Safe-default definition: Guide §16 preamble (L2494). Status vocabulary: NEW (session consensus). Roadmap/Tracker context note: brief §12 (L164).
- Review repair 2026-07-16: OPEN redefined ("any recorded safe default binds" — divergence findings carry none); MERGED now requires an EFFECTIVE ratified artifact (draft carriage ≠ closure); safe-default bullet reworded to match JPWB-DOC-004 §3.4 (files/blocks-dependent-work/delivers-the-rest, replacing the retired pure stop rule); M0 context note split: entry-discipline precedent stands, ratification standing open per REG-Q-026.

## §2 Section A — Founding decisions REG-D-001..007
- Founding-entry mandate: brief §5 (L90). All seven recorded as DECIDED, session 2026-07-16, sponsor + drafting agent — NEW (session consensus), with statements drawn near-verbatim from the brief:
  - REG-D-001: brief §2 (L12-22, P1-P7 + C1).
  - REG-D-002: brief §5 (L57-92) + §10 clause 1 (L134).
  - REG-D-003: brief §3 (L26-34).
  - REG-D-004: brief §6 (L94-96).
  - REG-D-005: brief §7 (L98-100).
  - REG-D-006: brief §1 (L8) + §10 clause 8 (L141) + case battery 9 (L129).
  - REG-D-007: brief §8 delegation boundaries (L115).

## §3 Section B — REG-Q-001..025 (carried Guide §16 register)
- Source: Guide §16 table, L2492-2522, one entry per row, restated against the six-artifact set + repository per task instruction; safe defaults carried self-contained (survivorship, brief §11 L151):
  - REG-Q-001 ← Guide L2498 (+ designed closure via brief §10; NEW disposition note).
  - REG-Q-002 ← L2499 · REG-Q-003 ← L2500 · REG-Q-004 ← L2501 · REG-Q-005 ← L2502 · REG-Q-006 ← L2503 · REG-Q-007 ← L2504 · REG-Q-008 ← L2505 · REG-Q-009 ← L2506 · REG-Q-010 ← L2507 · REG-Q-011 ← L2508 · REG-Q-012 ← L2509 · REG-Q-013 ← L2510 · REG-Q-014 ← L2511 · REG-Q-015 ← L2512 (JSDL non-ratification detail also extract-condisc-13501.md L29 / Janumi Constitution Discussion.md L13501-15000) · REG-Q-016 ← L2513 · REG-Q-017 ← L2514 · REG-Q-018 ← L2515 · REG-Q-019 ← L2516 · REG-Q-020 ← L2517 · REG-Q-021 ← L2518 · REG-Q-022 ← L2519 · REG-Q-023 ← L2520 · REG-Q-024 ← L2521 · REG-Q-025 ← L2522.
- Merge-target assignments: NEW (session consensus; concern routing per brief §10 clause 3).
- Review repairs 2026-07-16:
  - REG-Q-015: disputed-attribution JSDL commissioning turn added ← Janumi Constitution Discussion.md L11370-11435 (verified verbatim; attribution probable, not certain) — ELICITATION-REQUIRED before corpus retirement.
  - REG-Q-024: sponsor-adopted repair/revalidation semantics carried ← Janumicode_v2 - Validator Subsystem.md L1868 (RepairEvent "essential"), L1914-1922 (exit criteria set), L1932-1934 (diff-surface/inspection-surface intersection), L1974-1978 (identity-family non-negotiable rule) — verified verbatim.
  - REG-Q-025: sponsor-adopted no-hard-block-on-human-governance constraint carried ← Janumicode_v2 - Validator Subsystem.md L2015-2019 (verified verbatim); merge note re DOC-003 §8 ASR-10/ASR-15 scope line NEW.
- Section A statuses: "(closes on canon ratification)" qualifier applied uniformly to REG-D-002..007 (review repair 2026-07-16, consistency with REG-D-001).

## §4 Section C — REG-Q-026..047 (extraction contradictions no artifact resolves)
- REG-Q-026 ← M0 L9-12, L46-62 (§C items C-1..C-11); error-code count drift + self-ratification standing ← extract-ratify-roadmap.md L200-205 (M0 L9-10 vs L38-40; L11).
- REG-Q-027 ← extract-condisc-16501.md L44 (Janumi Constitution Discussion.md L17594) + brief case battery 6 (L126); the sponsor's retain-but-never-forward ruling is ELICITATION-REQUIRED (conversational, never registered).
- REG-Q-028 ← extract-doc002-a.md L122 (RPH-DOC-002 L623-624 vs L921-952).
- REG-Q-029 ← extract-doc002-b.md L127 (RPH-DOC-002 L2316 vs L2132).
- REG-Q-030 ← extract-doc004-a.md L137 (RPH-DOC-004 L536-538, L240-245, L548-553).
- REG-Q-031 ← extract-doc004-a.md L138 (RPH-DOC-004 L574-575). Strictest-of-set safe default: NEW (drafting agent proposal, consistent with REG-Q-011 strictest-unresolved rule).
- REG-Q-032 ← extract-doc005.md L147 (RPH-DOC-005 L1687-1693).
- REG-Q-033 ← extract-doc003-b (_canon_draft) L251 (RPH-DOC-003 L2399) + extract-doc005.md L146 (RPH-DOC-005 L1709-1711).
- REG-Q-034 ← extract-doc001-b (_working) L239 (RPH-DOC-001 L1112-1148 vs L1294-1471).
- REG-Q-035 ← extract-condisc-22501.md L64-65 (Janumi Constitution Discussion.md L22670-L22841).
- REG-Q-036 ← extract-condisc-6001.md L107 (Janumi Constitution Discussion.md L6137, L6203-6251).
- REG-Q-037 ← extract-doc000-a.md L117 (RPH-DOC-000 L84-94 vs L886-890).
- REG-Q-038 ← extract-rph-readme-exec.md L210-211 (README.md L50; Executive Overview L13-25).
- REG-Q-039 ← extract-add-complex (_working) L216-217 (Complex Systems discussion L682-L1240, L1262).
- REG-Q-040 ← extract-add-vision.md L12 (Capability Vision L18 vs L1154).
- REG-Q-041 ← extract-engconst.md L182 (Engineering Constitution.md L1186-L1220).
- REG-Q-042 ← extract-doc001-a (_working) L234 (RPH-DOC-001 L860-864 vs L1064-1067).
- Review repairs 2026-07-16:
  - REG-Q-026: C-1..C-11 expanded from labels to self-contained statements ← M0 sheet §C table (L46-62, verified verbatim); C-6 explicitly delegated to repository `src/errors.ts#ERROR_CODE_CATEGORY`.
  - REG-Q-027: statement corrected — Guide §9.7 (L1338, verified) DOES state a positive retention rule; its mechanics carried into statement and safe default as the interim rule anchoring the elicitation.
  - REG-Q-038: rewritten to acknowledge carriage in JPWB-DOC-001 §8 (L239, verified) and JPWB-CON-000 V5 (L63, verified); open question narrowed to the uncarried remainder.
  - REG-Q-039: merge-target hedge replaced with the REG-Q-027 elicitation formulation (voice, brief §11).
- New entries (review repairs 2026-07-16):
  - REG-Q-043 ← JPWB-DOC-003 §11 item 6 (L374, verified; previously filed nowhere despite DOC-003's claim).
  - REG-Q-044 ← JPWB-DOC-003 §11 item 7 (L375, verified).
  - REG-Q-045 ← RPH-DOC-003 L129-195, L371-380, L535-555, L633-644 + RPH-DOC-004 twelve core policies (L952, L1286-1288, L1455-1459): Product Realization PWA content survivorship; retirement hold pending seed verification (interacts with REG-F-001 hollow-seed finding).
  - REG-Q-046 ← Janumi Constitution Discussion.md L25300-27500 (Shape Engineering methodology); pattern mirrors REG-Q-022.
  - REG-Q-047 ← Janumi Constitution Discussion.md L27700-30230 (RIWS/JCUX screen contracts, Critical Acceptance Journeys); pattern mirrors REG-Q-038.
- Safe defaults in Section C: NEW (drafting agent's conservative proposals) except where they restate an existing carried default (noted per entry, e.g. REG-Q-029/030 reuse REG-Q-012 waiver discipline).
- Extraction contradictions surveyed but NOT carried (resolved by founding decisions or by artifact scope, or mooted by retirement): assistant-slice non-ratification notes (resolved by REG-Q-001/rule of recognition); JSDL-internal inconsistencies incl. PWU_INV_002 (subsumed by REG-Q-015 demotion); two-stacks question in extract-docchallenges.md L176 (resolved by REG-D-002/D-003); §9.7 clear-vs-ambiguous root cause (resolved in DOC-004 worked example / REG-F-004); legacy spec v2.3-vs-v2.5 label and DOC-008 "extension restarts" framing (mooted by retirement, REG-D-006); DOC-006 fixture snapshot inconsistencies (fixture is lowest authority per M0); DOC-009 "authoritative" word duplication (style, DOC-002 scope); DOC-007 UNKNOWN-fallback boundary (repository shape authority, REG-D-004); Additional Concepts domain-expansion gaps (futures, out of canon per brief §12 L161).

## §5 Section D — Divergence findings REG-F-001..004
- REG-F-001 ← brief §13 (L168: hollow governed layer, hardcoded floor, ~74% dead kernel) + extract-condisc-18001.md L49 (spec L18691 vs implementation); case battery 3 (L123). Remediation status: session ground truth (wiring program).
- REG-F-002 ← brief §13 (L169: sourceSection provenance theater).
- REG-F-003 ← brief §13 (L170: expectedRevision honored).
- REG-F-004 ← brief §2 P6 (L19) + §5 DOC-004 (L86) + extract-docchallenges.md L177 (fallacy-6a2b0f.md L123, L183).
- Class labels per brief §8 taxonomy (L104-113).
- Review repairs 2026-07-16: Section D preamble scoped to code/canon divergences; REG-F-004 class marked explicitly out-of-taxonomy (normative-drafting defect — the DOC-004 §8 taxonomy has no class for doc-vs-reader defects, by design); REG-F-003 status corrected MERGED → DECIDED — MERGE PENDING (DOC-003 is an unratified draft; MERGED now requires an effective artifact per §1).

## §6 Section E — Elicitation placeholder
- ELICITATION-REQUIRED: to be populated by the finalizer from JPWB-CON-000 `[ELICITATION: …]` markers per brief §5 (L91). The four known candidates are NEW (drafting agent, derived from REG-Q-026/027/038/039).
- Review repairs 2026-07-16: population rule extended to every ELICITATION-REQUIRED item in the six artifacts' provenance sidecars (the register, not the sidecars, is the survivorship carrier); the two actual CON-000 Part A markers added as candidates ← JPWB-CON-000 §3 (L49, thesis wording) and §1 (L35, stewardship-framing strength) — both verified; known sidecar items listed (DOC-003, DOC-004, DOC-001 E1-E4).

## Finalizer pass (2026-07-16)
Cross-artifact residue closed by the program finalizer: Attention Item entries added to DOC-002 §3 and DOC-003 §3 (disposition meanings NEW — REG-E-021); DOC-004 §7.2 exchange-record pointer to DOC-003 PER-9 and §11.4 repointed to PER-12; REG-Q-048 (cross-organization scope) and REG-E-001..022 filed in REG-005 Section E. Conferral instrument: 'JPWB Canon Ratify Sheet (R1).md'.

## Amendment pass (2026-07-16, sponsor-directed: AssessmentCriterion incident)
REG-D-008 applied: CON-000 B1 gained the reference-artifact non-example (implementation is never its own shape authority); DOC-004 §2.3 gained the reference/experiment discipline paragraph; REG-005 gained REG-D-008 (decision) + REG-F-005 (the AssessmentCriterion impoverishment, DOCS_STRONGER + B7); Ratify Sheet Part 4 gained retirement precondition 2 (shape-survivorship audit). Source: sponsor discussion of the {id, statement, mandatory} vs ratified 8-field criterion gap found against the pre-canon corpus.
