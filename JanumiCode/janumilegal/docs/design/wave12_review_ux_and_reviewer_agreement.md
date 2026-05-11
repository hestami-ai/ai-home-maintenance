# Wave 12 — Review UX, AttorneyAction Integration, Reviewer-Agreement Metrics

**Status:** Design (not yet implemented)
**Authored:** 2026-05-09
**Predecessors:** Wave 11 (validator harness)
**Out-of-scope from Wave 11 (now in scope):** webview surfacing of findings; human reviewer-agreement metrics; AttorneyAction UI for finding acknowledgement.

---

## 1. Objective

Wave 11 makes reasoning quality machine-measurable but leaves the findings invisible to the attorney. Wave 12 closes that loop:

1. **Surface findings in the webview** so the attorney sees what the harness flagged before deciding to sign / release.
2. **Capture attorney annotations** on a thin-slice / gold workspace so the system can compute reviewer-agreement metrics (validator precision/recall against attorney ground truth).
3. **Wire AttorneyAction acknowledgement** for HIGH-severity findings so the release gate has a concrete unblock path.
4. **Calibration dashboard** that tracks per-validator agreement rates over time so we can retire / tune validators that drift.

This is the wave that makes the harness *usable*, not just *correct*.

## 2. Webview surfacing

The existing webview (`src/webview/App.svelte`, `MatterHeaderBar.svelte`) becomes a Matter Dashboard with a per-activation reasoning-review panel.

### 2.1 Finding card (per state)

```
┌─ FactExtraction ─────────────────────────────────────── [pass · 7/7] ─┐
│ output preview (first 240 chars)                                       │
│                                                                        │
│ ⚠ MEDIUM  fact_classification_discipline                               │
│   Client narrative "father has been using drugs" classified as a       │
│   document-supported fact without quoted text.                         │
│   evidence: { factIndex: 3, sourceCitation: null }                     │
│   [Acknowledge] [Disagree] [Open source]                               │
│                                                                        │
│ ⚠ LOW    grounding_validator                                           │
│   "every other weekend" appears verbatim in only one source; safe.     │
└────────────────────────────────────────────────────────────────────────┘
```

States get a status badge: green `pass`, amber `escalate (N findings)`, red `block`. HIGH findings render expanded by default; MEDIUM/LOW collapsed.

### 2.2 Activation summary

A top-of-dashboard card shows the activation-wide rollup:

- 11 states / 8 pass / 2 escalate / 1 block
- 3 HIGH findings open · 7 MEDIUM · 12 LOW
- Release gate: **blocked** — 2 HIGH findings unacknowledged on `DirectLegalConclusionDraft`.

Clicking a summary item filters the state list.

### 2.3 Three webview actions per finding

| Action          | Effect                                                                 |
|-----------------|------------------------------------------------------------------------|
| Acknowledge     | Records attorney annotation `agree_finding_correct` on the finding. Required for HIGH findings before release-gate unblock. Posted as part of an AttorneyAction. |
| Disagree        | Records `disagree_finding_incorrect` with a free-text reason. Does NOT clear the release-gate prerequisite by itself; an explicit `override_finding` AttorneyAction (signed) is needed. |
| Open source     | Opens the cited authorized source in a side pane with the relevant span highlighted. |

Both Acknowledge and Disagree are **annotations** for reviewer-agreement metrics — they don't mutate the finding itself.

### 2.4 Privilege discipline in the webview

- **work_product_mental** findings (LLM validators) render with a yellow left border indicating mental impressions.
- **work_product_factual** findings (deterministic validators) render with a blue left border.
- The op-track summary (severity counts, validator IDs) renders without border — no privileged content there.
- An attorney annotating a finding triggers a matter-track write, not an op-track write — annotations are themselves work product.

## 3. AttorneyAction extension

Wave 7's AttorneyAction model gets two new action types and one new slot:

```ts
export type AttorneyActionType =
  // existing:
  | 'reviewed_for_internal_use'
  | 'approved_for_client_use'
  | 'signed_for_filing'
  | 'redaction_decision'
  // new in Wave 12:
  | 'acknowledged_finding'        // attorney agrees finding is correct; HIGH finding cleared for release if all HIGH findings on the artifact are acknowledged or overridden
  | 'override_finding';           // attorney disagrees with finding; explicit override with rationale; release gate unblocks but `override_finding_count` surfaces in audit

export interface AttorneyAction {
  // existing fields …
  /**
   * Wave 12: list of finding IDs this action acknowledges or overrides.
   * Required when actionType is 'acknowledged_finding' or 'override_finding'.
   * Bound to the artifact version hash so a downstream artifact change
   * invalidates the acknowledgement.
   */
  readonly acknowledgedFindings?: readonly string[];
  readonly overrideRationale?: string; // required when actionType = 'override_finding'
}
```

### 3.1 Release-gate update

Wave 11's gate already blocks on unresolved HIGH findings. Wave 12 makes "resolved" concrete:

- **resolved** = there exists an `acknowledged_finding` or `override_finding` AttorneyAction whose `acknowledgedFindings` contains the finding ID *and* whose artifact-version-hash binding matches the current artifact version.
- **artifact mutation invalidates resolution**: editing the artifact recomputes its hash, which un-resolves all prior acknowledgements pointing at the old hash. The harness re-runs against the new version. Attorneys must re-acknowledge.

This is the legal analog of v2's "code change invalidates review" pattern.

## 4. Reviewer-agreement metrics

### 4.1 Annotation capture

Two paths produce annotations:

1. **Live attorney use** — every Acknowledge / Disagree click in the webview is a labeled data point.
2. **Gold-matter annotation pass** — for each gold matter, an attorney walks the captured workspace once and labels every finding. The thin-slice review script (`scripts/thinSliceReview.ts`) gets a new `--annotate` mode that writes annotations to `<workspace>/annotations.json`.

Both feed the same store: a new `reasoning_review_annotations` matter-track event:

```ts
{
  eventType: 'reasoning_review_annotation';
  payload: {
    findingId: string;
    annotationType: 'agree_finding_correct'
                  | 'disagree_finding_incorrect'
                  | 'agree_severity'
                  | 'disagree_severity_should_be_<H|M|L>';
    rationale?: string;
    annotatorAttorneyId: string;
    annotatorBarNumber: string;
  };
  // declaredClassification: 'work_product_mental'
}
```

### 4.2 Metrics computed

For each validator over a rolling window (default: last 30 calibration / live activations):

| Metric               | Definition                                                         |
|----------------------|--------------------------------------------------------------------|
| Precision            | agreed correct / (agreed correct + disagreed incorrect)            |
| Recall               | findings flagged / findings attorney also identified independently |
| Severity calibration | distribution of attorney-adjusted severities relative to validator |
| Drift               | precision delta over the last 7 vs. the prior 23 activations       |

Recall requires a separate channel: in the gold-matter annotation pass, the attorney can flag *missed* issues (annotation type `attorney_flagged_missed_issue`). Recall = harness-flagged ∩ attorney-flagged / attorney-flagged.

### 4.3 Calibration dashboard

A new top-level webview view: **Calibration**.

- Per-validator precision / recall over time (line charts).
- Validators below 0.6 precision flagged for review (likely too noisy).
- Validators below 0.5 recall flagged for review (likely missing pattern coverage).
- Severity-calibration heatmap: actual vs. expected severity distribution.

The dashboard reads from a Layer 1 service `ReasoningReviewMetricsService` that aggregates annotations across activations. Aggregations are op-track-friendly (validator ID, counts, ratios — no finding text). The dashboard only shows aggregates; clicking through to a finding requires the matter to be the active matter (privilege scope).

## 5. Implementation sequence

1. **AttorneyAction extension** — types, DAL migration, release-gate prerequisite update; tests for artifact-version-hash invalidation.
2. **Webview finding panel** — Svelte components, per-state finding cards, action buttons. Static fixture data first.
3. **Live wiring** — webview reads from matter-track via existing dashboard service; writes annotations via AttorneyAction service.
4. **Annotation capture** — `scripts/thinSliceReview.ts --annotate` mode; CLI prompts attorney to label each finding.
5. **Metrics service** — aggregates per-validator metrics; layer-1 service usable from CLI and webview.
6. **Calibration dashboard view** — second webview screen with charts (use [Chart.js](https://www.chartjs.org/) or similar; lock to a small dependency footprint).
7. **Calibration sweep** — attorney annotates the 3 gold matters end-to-end; dashboard surfaces baseline agreement metrics.

## 6. Wave 12 exit gate

- [ ] Webview surfaces all per-state findings with severity-coded UI.
- [ ] AttorneyAction `acknowledged_finding` and `override_finding` types implemented; release gate honors them.
- [ ] Artifact-version-hash invalidation tested (modify artifact → prior acknowledgement no longer counts).
- [ ] Annotation pass run against all 3 gold matters; annotations stored.
- [ ] Calibration dashboard shows per-validator precision/recall over the gold-matter set.
- [ ] At least one validator's severity tuning iteration captured in `docs/calibration/validator_tuning_log.md` (proves the loop closes).

## 7. Open questions deferred to implementation

- **Dashboard rendering library**: Chart.js vs. native SVG vs. Svelte chart libs. Decide at commit 6 based on bundle size.
- **Annotation storage location**: matter-track only, or also a Layer-1 aggregate (op-track-safe) cache for the calibration dashboard? Probably both — annotations themselves are mental impressions; aggregate counts are op-safe.
- **Multi-attorney annotation**: when multiple attorneys annotate, do we average severities or require consensus? Initial: most-recent-wins; metrics dashboard surfaces inter-attorney disagreement separately.

## 8. Out of scope (deferred to Wave 13+)

- Adversarial / red-team validators — Wave 13.
- Attorney-pair calibration (when two attorneys must agree on a severity) — Wave 14+.
- Active-learning loop where validator prompts auto-tune from annotations — Wave 14+ (significant ML scaffolding; punt until evidence justifies).
