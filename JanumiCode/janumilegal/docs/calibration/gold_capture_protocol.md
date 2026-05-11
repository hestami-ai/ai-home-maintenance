# JanumiLegal Gold Capture and Calibration Protocol

**Status:** Wave 5 prerequisite. Lifts JanumiCode v2's Wave 6 deferred-item lesson into JanumiLegal up front.
**Parents:** `janumilegal_product_description.md` §Test Use Case (lines 1040–2511); `janumilegal_product_description_evolution.md` §15.4; `janumilegal_implementation_roadmap.md` §5.4.
**Seed gold matter:** `janumilegal_product_description.md` lines 1040–2511 — the Family Law Production Lens custody-enforcement test case (`JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001`). This is **gold matter #1**.

---

## 1. Why This Exists Up Front

JanumiCode v2 deferred gold capture into Wave 6 and accumulated a deferred-items list because evaluation discipline was retrofit, not built in. JanumiLegal cannot afford to repeat that pattern: the legal domain is open-world, the cost of regression is malpractice exposure rather than developer annoyance, and the practice-area lens packs are too expensive to re-author when calibration reveals a structural error.

Therefore: **calibration is a Wave 5 prerequisite, with the seed gold matter already specified by the source document's test fixture.** Wave 6 lens-pack content is built against the gold matter from day one.

---

## 2. What a "Gold Matter" Is

A gold matter is a **fully specified, hand-curated, end-to-end test fixture** that captures:

- the input materials a real matter would carry (client message, uploaded documents, intake notes),
- the expected lens classification,
- the expected state-machine traversal,
- the per-state expected outputs (with structure, not just narrative),
- the expected pass/fail criteria per state,
- the expected release-status outcomes per artifact,
- the expected failure modes the system must catch,
- assertion sets a test runner can execute.

The source-document test case (lines 1040–2511) is exactly this shape. It is the template every subsequent gold matter follows.

A gold matter is **not** a synthetic prompt-response pair, a single LLM eval row, or a benchmark question. It is a workflow fixture covering an entire matter lifecycle.

---

## 3. Gold Capture Format

Each gold matter is stored as a directory under `JanumiCode/janumilegal/calibration/gold/`:

```
calibration/gold/
  JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001/
    matter.yaml                # IDs, lens, jurisdiction, practice area, release targets, risk level
    inputs/
      client_message.md
      custody_order.pdf
      text_messages.pdf
      prior_child_support_order.pdf
      intake_notes.md
    expectations/
      lens_classification.json
      required_states.yaml
      state_outputs/
        01_matter_context_normalize.json
        02_jurisdiction_capture.json
        ...
        22_governed_stream_finalize.json
      artifacts/
        attorney_review_packet.json
        legal_research_memo.json
        direct_legal_conclusion.json
        client_advice_draft.json
        court_filing_draft.json
        authority_verification_packet.json
      release_status.json
      pass_criteria.yaml
      failure_traps.yaml
    assertions/
      runner.py            # or .ts; executes the assertion set
      assertions.yaml
    notes/
      authoring_attorney.md   # who authored/curated this gold matter
      revision_log.md
```

### 3.1 `matter.yaml`

Mirrors the source-document test-case header (lines 1046–1062): test_case_id, lens, jurisdiction, practice_area, matter_type, primary_user, secondary_users, release_target, risk_level. Plus: gold_matter_version, last_revised, authoring_attorney_id, sensitive_content (true/false — gold matters should be synthetic; if any real content is used, it is fully scrubbed and labeled).

### 3.2 `inputs/`

The exact materials a real matter would have. Synthetic but realistic: real-shape client messages, real-shape document excerpts, real-shape intake notes. No real client content. Synthetic content must remain plausible (real Maryland court names, real statute references where applicable, real procedural posture).

### 3.3 `expectations/`

Per-state structured outputs in the same shape the production system emits. The source-document test case provides the model: each state has an expected JSON output and a pass-criteria block.

### 3.4 `assertions/`

Executable assertion runner. The source-document §10 minimal assertion set (lines 2462–2484) is the seed. Extended over time with state-by-state assertions, schema conformance, classification correctness, release-gate enforcement, and trap detection.

---

## 4. Seed Gold Matter — Family Law / Custody Enforcement / MD

The source document's test case lands as `calibration/gold/JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001/`. Wave 5 deliverables include populating this directory from the test-case prose.

### 4.1 What gets extracted from lines 1040–2511

| Source-doc section | Gold-matter target |
|---|---|
| §1 Purpose, §2 Scenario summary | `notes/authoring_attorney.md` (purpose framing) + `matter.yaml` (test_case_id, scenario summary) |
| §3.1 Client message | `inputs/client_message.md` |
| §3.2 Custody order excerpt | `inputs/custody_order.pdf` (synthetic PDF generated from the excerpt) |
| §3.3 Text message excerpt | `inputs/text_messages.pdf` |
| §3.4 Prior child support order | `inputs/prior_child_support_order.pdf` |
| §3.5 Intake notes | `inputs/intake_notes.md` |
| §4 Expected lens selection | `expectations/lens_classification.json` |
| §5 Required state machine | `expectations/required_states.yaml` |
| §6 Expected state outputs (each state) | `expectations/state_outputs/<NN>_<state>.json` |
| §7 Expected artifacts | `expectations/artifacts/*.json` |
| §8 Release status | `expectations/release_status.json` |
| §9 Failure traps | `expectations/failure_traps.yaml` |
| §10 Minimal assertion set | `assertions/assertions.yaml` (seed) |
| §11 What this test demonstrates | `notes/authoring_attorney.md` (postscript) |

### 4.2 The 22 expected states

Per source §5.1, the expected state machine is:

```
01 MatterContextNormalize
02 JurisdictionCapture
03 ActorAudienceCapture
04 SourceDocumentInventory
05 FactExtraction
06 TimelineBuild
07 ExistingOrderExtract
08 IssueBloom
09 IssuePrune
10 LegalResearchPlan
11 AuthorityRetrieve
12 RuleElementMap
13 FactToRuleMap
14 DirectLegalConclusionDraft
15 ClientAdviceDraft
16 FilingDraftPlan
17 CourtFilingDraftGenerate
18 AuthorityVerification
19 SourceToClaimTrace
20 AttorneyReviewPacketAssemble
21 ReleaseStatusDetermine
22 GovernedStreamFinalize
```

Each gets its own `state_outputs/NN_*.json` populated from the source document's expected outputs (§6).

### 4.3 The traps

Per source §9, the failure traps the system must catch:

```
trap_1_support_dispute_treated_as_defense_for_withholding
trap_2_child_refusal_dismissed
trap_3_contempt_stated_as_final
trap_4_client_advice_sent_without_attorney_approval
trap_5_filing_proceeds_without_complete_package
trap_6_authority_marked_attorney_confirmed_when_only_machine_assessed
```

Each is encoded in `failure_traps.yaml` with the trap setup, the expected detection point, and the expected escalation path.

---

## 5. Calibration Metrics

Per evolution §15.4 and roadmap §8.5, the calibration suite reports:

| Metric | Definition | Target |
|---|---|---|
| Required-state completion rate | Fraction of required states the system actually completed | 100% (skip = failure) |
| Lens classification accuracy | Did the lens classifier pick the expected primary lens | ≥ 95% on gold set |
| Issue bloom seed coverage | Pass 1 seed-domain coverage | 100% (per Proposal C contract) |
| Issue bloom divergence rate | Pass 2 off-seed candidate rate | tracked, not gated |
| Issue bloom late-addition rate | Pass 3 illegal new-domain emissions | 0 (per Proposal C) |
| Silent-pruning rate | Pruning decisions without recorded reason | 0 |
| Source-trace completeness | Material assertions with valid trace | 100% in artifacts intended for attorney review |
| Mechanical citation check accuracy | Citations correctly parsed and source-located | ≥ 99% |
| Machine-assessed support precision | Machine-assessed support that holds up against attorney review | tracked, not gated; never collapsed with citator |
| False-confidence rate (citator collapse) | Authority shown as "verified" when only machine-assessed | 0 (architectural; CLV §11 enforces) |
| Release-gate correctness | Release status matches expected on gold set | 100% |
| Attorney packet usefulness | Survey score from attorney reviewers (when human-in-loop testing occurs) | tracked |
| Cross-matter leakage (synthetic two-matter test) | Bytes of matter A reachable from matter B context | 0 (architectural) |
| Active-matter-context mismatch rate | Writes where activeMatterContext != target matter | tracked; alarm threshold at any non-zero rate sustained |

### 5.1 Hard gates (evaluation suite must pass these for any wave promotion)

- Required-state completion rate = 100% on gold set.
- Issue bloom late-addition rate = 0.
- Silent-pruning rate = 0.
- False-confidence rate = 0.
- Cross-matter leakage = 0.
- Release-gate correctness = 100% on gold set.

Tracked-only metrics inform engineering decisions; they do not gate wave promotion.

---

## 6. Gold Matter Expansion Plan

### Wave 5 (calibration scaffold)
- [ ] `JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001` populated end-to-end from source document.
- [ ] Assertion runner produces machine-readable pass/fail + metrics.
- [ ] Synthetic two-matter isolation test added (`JLEGAL-ISO-MULTI-MATTER-001`).

### Wave 6 (lens pack v1)
- [ ] One additional gold matter per MVP lens pack (≥ 7 total).
  - Family Law: divorce/MSA review (`JLEGAL-FL-MD-MSA-001`).
  - Criminal Defense: DUI/DWI (`JLEGAL-CD-MD-DUI-001`).
  - Business/Civil Litigation: contract dispute (`JLEGAL-BCL-MD-CONTRACT-001`).
  - Legal Research Memo: standalone research request (`JLEGAL-LRM-MD-001`).
  - Client Advice Draft: status update (`JLEGAL-CAD-MD-001`).
  - Court Filing Draft: opposition to motion (`JLEGAL-CFD-MD-001`).
  - Redline: settlement agreement review (`JLEGAL-RL-001`).

### Wave 9 (GA readiness)
- [ ] ≥ 20 gold matters per practice-area lens pack.
- [ ] At least three gold matters per pack include a deliberately introduced trap that the system must catch.
- [ ] Cross-jurisdiction gold matters: at least one per JC Law jurisdiction (MD, VA, PA, DC) per pack where applicable.

---

## 7. Gold Matter Authoring Discipline

### 7.1 Who authors

- Synthetic content authoring — engineering and AI agents in the initial implementation phase (per the staffing model: AI agents in the role of legal-knowledge author for initial outputs).
- Attorney review of gold matters — deferred to demonstrable implementation, paralleling the privilege design doc deferral. Until attorney review occurs, gold matters are labeled `engineering_draft` in `matter.yaml`.
- Once attorney review begins, status moves to `attorney_reviewed` with reviewer attribution.

### 7.2 Synthetic content rules

- No real client content. Ever.
- No real attorney name, real bar number, or real party name.
- Court names, statute references, and rule numbers are real (the platform has to handle real jurisdictional structure).
- All names are synthetic and clearly synthetic (e.g., "Anne Arundel County" is real; "Jane Doe" or "John Father / Jane Mother" for parties).
- Document contents are plausible-shape but synthetic.

### 7.3 Versioning

- Gold matters are version-pinned. Editing a gold matter produces a new version with a revision log entry.
- Lens-pack version updates may require gold-matter updates; the dependency is tracked.
- A gold matter is never silently mutated; the assertion runner is run on the authored version.

### 7.4 Sensitive content scrub

If any gold-matter authoring ever touches real-world content (e.g., a public court opinion used as authority — which is fine, since it is public record), the authoring log records the sourcing. Public-record content does not require scrubbing; non-public content does not enter gold matters.

---

## 8. Calibration Run Cadence

| Trigger | Cadence | Scope |
|---|---|---|
| Every commit to platform code | CI | Full assertion suite on full gold set |
| Every lens-pack version bump | CI | Full assertion suite + flagged regression delta |
| Every CLV migration | CI | VCC + assertion suite |
| Every prompt-template change | CI | Affected lens packs' gold matters |
| Pre-wave-promotion | Manual + CI | Full suite + hard-gate verification |
| Quarterly | Manual | Full suite + drift analysis vs. prior quarter |

A red CI build on calibration is **a hard block** on merge. There is no override mechanism; the failing case is fixed or the change is reverted.

---

## 9. Regression Reporting

Each calibration run emits a `regression_report.json` containing:

- gold-set-wide pass/fail counts.
- per-metric values + delta from last run.
- per-gold-matter pass/fail.
- per-state pass/fail across all gold matters (heat map).
- new failures since last run (with the diff that caused them, if attributable).
- newly-passing items (regressions resolved).

Regression reports are stored in the operational track of the Governed Stream (per privilege design §3.1 — they contain no matter content; they reference gold-matter ids only).

---

## 10. Calibration as Architectural Forcing Function

Beyond pass/fail, calibration acts as a forcing function for architecture:

- A trap that the system fails to catch is treated as a **structural defect**, not a tuning issue. The fix is structural (additional validator, stricter manifest contract, classifier change), not prompt tweaking.
- A metric trending in the wrong direction over multiple runs surfaces an architectural review.
- An assertion that requires constant prompt-tuning to pass indicates the assertion is wrong or the architecture is wrong; one of them changes.

This discipline is the explicit answer to the JanumiCode v2 "deferred items" pattern.

---

## 11. Standing Disciplines (calibration-specific)

- No production lens-pack content lands without a corresponding gold matter that exercises it.
- No CI override on calibration failure.
- No silent gold-matter mutation; revisions are versioned.
- No real client content in gold matters.
- No metric that conflates citator status with machine-assessed support, ever (CLV §11 is structurally enforced).
- No assertion runner that "passes if the LLM thinks it passed." Assertions are deterministic checks against structured outputs.

---

## 12. Deliverables Summary

By end of Wave 5:

- [ ] `calibration/gold/JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001/` fully populated from source document lines 1040–2511.
- [ ] Assertion runner operational and CI-integrated.
- [ ] Hard-gate metrics enforced on every CI run.
- [ ] Synthetic two-matter isolation gold test (`JLEGAL-ISO-MULTI-MATTER-001`) operational.
- [ ] `regression_report.json` produced and archived per run.

By end of Wave 6:

- [ ] Seven additional gold matters covering the MVP lens-pack set.

By end of Wave 9:

- [ ] ≥ 20 gold matters per practice-area lens pack; cross-jurisdictional coverage; trap coverage.
