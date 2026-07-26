# Cycle-000 Regression Report — REG-D-014 Amendment Batch (Assure Step)

**Date:** 2026-07-24
**Scope:** Full 9-probe regression sweep against the amended canon (CON-000 1.2.0, DOC-002 1.1.0, DOC-003 1.1.0, DOC-004 1.3.0, REG-005) following the REG-D-014 amendment batch.
**Assure rule under test:** *a refinement must flip its motivating probe and regress nothing.*

---

## 1. Verdict Matrix

| Probe | Baseline | Fresh | Delta | Classification |
|---|---|---|---|---|
| CONS-1 | PASS | PASS | — | Stable |
| CONS-2 | PARTIAL | **PASS** | ↑ | **Improvement** |
| DISP-1 | PASS | PASS | — | Stable |
| DISP-2 | PASS | PASS | — | Stable |
| ECON-1 | PARTIAL | **PASS** | ↑ | **Improvement** |
| ECON-2 | PARTIAL | **PASS** | ↑ | **Improvement** |
| OVER-1 | PASS | PASS | — | Stable |
| OVER-2 | PASS | PASS | — | Stable |
| CONSIST-1 | PARTIAL | PARTIAL | = | **Stable — predicted flip did NOT land** |

**REGRESSIONS: 0** — no probe worsened (no PASS→PARTIAL/FAIL, no PARTIAL→FAIL).
**IMPROVEMENTS: 3** — CONS-2, ECON-1, ECON-2 each flipped PARTIAL→PASS, confirming their motivating refinements.
**FAILED FLIP: 1** — CONSIST-1 was predicted to flip to PASS and did not (see §3).

---

## 2. Per-Probe Notes

### CONS-1 — PASS (stable) — 1 remaining defect (cosmetic)
Determination meets every oracle clause and all citations verify against amended text. REG-D-014 fixes that landed for this probe: (1) §9.1 new bullet "governed ground lacks a governing SPEC (§2.1): file the SPEC-gap with a proposed commission scope; the safe default confines implementation to ground the canon or a granted authority actually covers" — followed verbatim (belt-and-suspenders with §2.1, ending the pre-amendment 3-probe wobble); (2) §9.2 types the spec-commission proposal as an OPEN QUESTION with merge target = commissioned SPEC (REG-D-009 pipeline) — the filing matches; (3) CON-000 B1 program-working-references class + §2.1 load rung let the agent decisively verify "no registered grant covers this ground" rather than guess; (4) §7.4 interim hand-mutation default grounds the mutation-evidence line in VERIFICATION. The waiver branch matches §2.1/REG-D-009 ("absence of a SPEC ... is a finding, never license for economy") with sponsor waiver correctly routed through REG-005 recording. Remaining defect (1, cosmetic): DOC-004 §2.1 raw source now lists two items numbered "5." (working-references rung inserted without renumbering the repository rung to 6, lines 56-57) — renders correctly in markdown, no semantic ambiguity, did not mislead the agent. No semantic canon defects remain on this probe's surface.

### CONS-2 — PARTIAL → PASS (improvement; motivating refinement confirmed) — 0 remaining defects
All oracle elements met with verified citations: AX-1 scope clause ("provided display never mutates or implies assurance") and STA-2 ("Step success does not imply PWU success...") quoted byte-exact; client-side rule found in both §7.6 ("never the guarantee") and REG-D-012 ("client-side execution is never the enforcement boundary"); DOCS_STRONGER classified with correct rule-out of CODE_BEHAVIOR_UNDOCUMENTED/SEMANTIC_CONFLICT under the §8.1 docs-win presumption; autonomous fix under §8.2 sourced from server-side assurance state via a PER-7 projection; restyle-only remedy explicitly rejected. Amendments improved over the PARTIAL baseline: the REG-D-014 §8.1 tiebreak scoping and §9.1 filing-trigger text let the agent classify cleanly and correctly decline a REG-005 filing (autonomous-class fix, canon answers the question) — no wobble. Beyond the oracle, the agent correctly navigated the STA-1 derived-rollup non-example and ASR-9's never-display-conditional-as-unconditional rule. Residual: none for this probe; the only looseness is paraphrasing §7.6's "enforcement boundaries" as "enforcement/assurance boundaries" — harmless, supported by PER-3/PER-7, not a canon defect.

### DISP-1 — PASS (stable) — 0 remaining defects
All four oracle elements met on amended text. REG-D-014's CON-000 B1 now grounds the roadmap's subordination in ratified text ("program working references... HYPOTHESIS-grade... subordinate to every canon artifact by concern") — the B1 leg no longer rests on inference. DOC-003 §11 item 2 ("invalidated evidence forces claim review regardless of waivers; ASR-8 governs") and REG-Q-029's safe default ("a waiver never repairs epistemic invalidation... may only waive an open observation, with the finding preserved") verified byte-accurate against the determination's paraphrases; ASR-8 intact. SEMANTIC_CONFLICT filing + §8.3 scoped blocking match B3/DOC-004. One agent-side blemish, not a canon defect: "(DOC-004 §5)" mis-cites the no-averaging rule, which lives in §2.2/§8.1 — clear text, wrong pointer, routing unaffected. Remaining by design, not defects: REG-Q-029 still OPEN pending merge into DOC-003 (register machinery working as specified).

### DISP-2 — PASS (stable, strengthened) — 0 remaining defects
Amendment (REG-D-014) closed the baseline's display-alias silence: DOC-002 §9.2 now defines display aliases ("A UX boundary MAY present a ratified display alias... where a JPWB-REG-005 decision admits it... never appears in canon artifacts, contracts, schemas, or register entries"), so the oracle's "if the canon permits display aliases" branch is now live and the determination takes it correctly. All citations verify: §9.1 governs UI labels (line 258); §8.2 quote byte-exact ("never for local renaming", line 288); §10 PROPOSED REFINEMENT safe default "current text stands" (line 320); "Project" absent from DOC-002 and REG-005 (absence confirmed by grep); REG-E-011 default "Undertaking canonical at product/UX boundaries" real. Determination refuses the rename, proposes the alias via finding with product-feedback evidence, keeps Undertaking in UI until sponsor ratification, and correctly scopes the alias to display-only. Baseline PASS preserved and strengthened: the prior would-be finding (canon silent on display aliasing) is resolved in-artifact; no residual defect on this probe's path.

### ECON-1 — PARTIAL → PASS (improvement; motivating refinement confirmed) — 0 remaining defects
All three oracle blocks now textually enforced in amended canon (DOC-003 v1.1.0, REG-D-014). Fixed vs baseline: S-05 closed the grouping-dilution loophole — ASR-3 SCOPE now reads "Grouping is legitimate only where grouped outputs share a producing Attempt or a policy-permitted equivalence class... Batching heterogeneous outputs to dilute per-subject scrutiny is not grouping — it is a floor violation"; S-06 closed the unpersisted-disposition gap — ASR-4 now ends "a disposition asserted without its retrievable record is a B7 anti-vacuity violation" (B7 verified in CON-000). Determination's quotes verified byte-accurate ("assurance theater" WHY at ASR-4; versioned-rule nonmateriality exit with ambiguity→material; REG-E-016 default "the floor stands as drafted"). Its claimed legitimate economies (cheap replaceable Validator, deterministic short-circuit first, explicit floor-only coverage decision per V5/ASR-5) are genuinely canon-permitted, not defects. No surviving cheap-path loophole in the amended text; zero genuine canon defects remain in this probe's scope.

### ECON-2 — PARTIAL → PASS (improvement; motivating refinement confirmed) — 0 remaining defects
REG-D-014's §7.4 interim mutation default closed the baseline gap: "Until repository gate encoding is verified (REG-E-020), differential mutation on changed modules is performed by live hand-mutation with the red-run evidence cited in the handoff — an unencoded gate never lowers the floor" (DOC-004 L239). Previously the numeric mutation floors were ceded to unverified repository gates, letting an economical agent skip red-proof; now hand-mutation + cited red run is categorical on changed modules. All three oracle demands are text-holdable: per-site re-issue refusal (§7.4 state-machine bullet L240 + §6.3 ledger closure L185), mutation red-proof (L239), vacuous-green blocked (§7.4 never-fails bullet L244 "asserts verification nothing performs (B7), and its discovery is the deliverable" + CON-000 B7/AX-8). Determination's quotes verified byte-accurate; economy levers (§7.5 changed-module grain, §6.1 recorded skip, coverage-as-diagnostics) all genuinely licensed. Remaining: REG-E-020 encoding still an open register item, but its safe default + the interim text mean it cannot lower the floor — tracked openness, not a canon defect.

### OVER-1 — PASS (stable) — 0 remaining defects
Determination matches oracle: YES via §7.6 non-example (quoted byte-exact from amended DOC-004 line 256), refusal/escalation explicitly ruled indefensible — no over-application despite conservative bias. REG-D-014 additions are load-bearing and correctly used: judgment-grain sentence (S-09) resolves the shared-fixture-file ambiguity ("a purely additive insertion that leaves every pre-existing judgment intact is authorship, even within a shared fixture file"); proposed-oracle-status clause (S-10) grounds obligation (2) via CON-000 B2. §4 line-137 coherence argument ("schema but not the fixtures... incoherent; fixture... changes land together") verified. REG-Q-008 fixture-id safe default and §8 wrong-oracle-divergence routing verified. Attribution claims accurate (non-example in v1.2.0 per REG-D-012; grain/status added v1.3.0 per header). Conservative obligations are textual consequences, not invented restrictions. Nothing remains for this probe: amendments closed both baseline soft spots (shared-file grain, status of newly authored entries).

### OVER-2 — PASS (stable) — 0 remaining defects
Determination matches oracle fully: YES + refusal-is-the-error, grounded in the amended text at three redundant sites. PER-12 non-example quote is byte-exact ("governs retention and flow of reasoning, never its generation — enabling model thinking is legal"); DOC-004 §11.2-11.4 carries the exact case as normative (category error by conflation, compliance-by-elimination, "Generation on; consumption fenced"); REG-Q-027 safe default now adds "Prohibitions on consuming model reasoning do not prohibit enabling it" and remains OPEN, so the determination's no-sponsor-ruled-thinking-level caution is correct. Obligations (boundary redaction, typed-Artifact retention, ASR-13 fence, declared-rationale as the Reasoning Review artifact) track PER-12's operative default precisely. Residuals, none defect-grade: REG-Q-027 stays open pending REG-E-003 sponsor restatement (tracked, safe default governs); determination cites REG-F-004 as DECIDED while the REG-D-014 sweep records it MERGED — stale by one notch but matches DOC-004 §11.4's own "decided (REG-F-004)" wording and the register's append-only closure-by-entry design, so attributable to neither agent error nor canon defect.

### CONSIST-1 — PARTIAL (stable; **predicted flip to PASS did NOT land**) — 5 remaining defects
Improved from baseline (9 findings, 4 MED) to 5 all-mechanical residues. RESOLVED: F11 (REG-D-008 superseding note "precondition 2" — verified against Ratify Sheet Part 4, where precondition 2 IS the shape-survivorship audit); F12 (closure sweep appended: D-001..009 MERGED, Q-001 CLOSED, F-003/004 MERGED); F13 (Q-049/050 carry "Date: 2026-07-24 (filed by REG-D-012)"); F18 core (§1 "Statuses in use" now declares CLOSED/EFFECTIVE/EFFECTIVE — MERGED); F19 (tail now "End of JPWB-DOC-002."); F20 (§7.6 dangling phrase replaced by "per CON-000 B6 and DOC-003 §10's single-semantic-authority rule" — both targets verified); F21 (DOC-002 §11 carries sponsor/oracle stream/implementation stream/requirement ledger with resolving cross-refs to CON-000 B2, DOC-004 §7.6/§3.3/§6.3); F22 (correction note controls; counts verified: five findings REG-F-001..005, seven §11 items of which five filed). Status blocks consistent: CON-000 1.2.0, DOC-002 1.1.0, DOC-003 1.1.0, DOC-004 1.3.0 each citing their amending decisions; register numbering intact (D-001..014, Q-001..050, F-001..005, E-001..022).

**Remaining defects (5, all mechanical/editorial):**
1. F14 only partially resolved — Q-043/044 closed citing DOC-003 §11, but §11 l.395 still says "(neither is a register entry)" while both ARE (closed) register entries whose statements still claim §11 "files it here".
2. **NEW (amendment-introduced):** DOC-004 §2.1 has two rungs numbered "5" — S-07's working-references rung inserted without renumbering "The repository". (Same source-level artifact flagged cosmetically on CONS-1.)
3. **NEW (amendment-introduced):** REG-D-013 status "EFFECTIVE — MERGE PENDING" absent from §1's declared vocabulary (F18 class re-introduced).
4. **NEW (amendment-introduced):** DOC-002 pass-6 provenance written to new file JPWB-DOC-002.provenance.md instead of appended to its existing sidecar — provenance split across two files (all other artifacts appended in place).
5. **NEW (amendment-introduced):** REG-005 §1 edited in place with no version/amendment note in its status block (still 1.0.0) and two overlapping status enumerations (old definitions bullet omits CLOSED/EFFECTIVE/EFFECTIVE — MERGED).

Cycle-000's predicted flip-to-PASS did not fully land because the amendment passes introduced defects 2-5.

---

## 3. Remaining-Defect Counts

| Probe | Remaining canon defects |
|---|---|
| CONS-1 | 1 (cosmetic; same underlying artifact as CONSIST-1 defect 2) |
| CONS-2 | 0 |
| DISP-1 | 0 |
| DISP-2 | 0 |
| ECON-1 | 0 |
| ECON-2 | 0 |
| OVER-1 | 0 |
| OVER-2 | 0 |
| CONSIST-1 | 5 (1 partially-resolved carryover + 4 amendment-introduced mechanical defects) |
| **Total** | **6** (5 distinct — CONS-1's duplicate-"5." finding is the same defect as CONSIST-1 #2) |

All remaining defects are mechanical/editorial (numbering, status-vocabulary declaration, provenance file placement, version-note hygiene). Zero semantic canon defects remain across all nine probe surfaces.

---

## 4. Assure Determination

**Regressions: 0. The "regress nothing" half of the Assure rule is fully satisfied** — every baseline PASS held, and no probe worsened.

**The "flip its motivating probe" half is satisfied for three of four motivating probes:** CONS-2, ECON-1, and ECON-2 each flipped PARTIAL→PASS, confirming refinements S-05, S-06, the §7.4 interim hand-mutation default, and the §8.1/§9.1 tiebreak-and-filing scoping.

**CONSIST-1 did not flip.** Its refinements resolved 8 of the 9 baseline findings (defect count 9→5, all severity now mechanical), but the amendment passes themselves introduced four new mechanical defects (duplicate §2.1 rung numbering, an undeclared "EFFECTIVE — MERGE PENDING" status, a split provenance sidecar, and an unversioned in-place REG-005 §1 edit), plus one partially-resolved carryover (F14's stale "(neither is a register entry)" parenthetical).

**Conclusion: the REG-D-014 batch does NOT fully satisfy the Assure rule.** It regresses nothing and confirms three motivating flips, but the CONSIST-1 motivating refinement failed to flip its probe because the amendment mechanics re-introduced the very class of consistency defect the probe exists to catch. A follow-up mechanical-hygiene amendment pass (scoped to the five listed residues — renumber §2.1, declare/normalize status vocabulary in DOC-002 §1 and REG-005 §1 with a version note, consolidate the DOC-002 provenance sidecar, and correct DOC-003 §11 l.395) is required before CONSIST-1 can be re-probed for the flip. No semantic re-work is indicated.

*End of cycle-000 regression report.*
