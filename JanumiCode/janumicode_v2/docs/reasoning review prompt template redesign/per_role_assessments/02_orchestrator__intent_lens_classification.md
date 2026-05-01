# Assessment: orchestrator / intent_lens_classification (Phase 1.2)

**Sample:** `track_c_samples/02_orchestrator__intent_lens_classification.md`
**Reviewed agent:** `orchestrator` running `qwen3.5:9b`
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

The reviewed agent produced this final response:

```json
{
  "lens": "product",
  "confidence": 0.95,
  "rationale": "The input explicitly defines a 'Hestami AI Real Property OS and Platform' with a 'Vision' and 'Mission' section, indicating a new customer-facing surface. The document outlines 'Target Customer' personas, 'Phasing Strategy', and 'Three Pillars', which signals multi-feature scope and market positioning typical of a product lens rather than a feature or bug."
}
```

The reviewer (gemma4:e4b) returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The reasoning is highly sound. ... The confidence score is well-supported by the evidence."
}
```

The reviewer's gate-field consistency is intact (`has_concerns=false` matches `concerns=[]`). The substantive failure mode here is different from both the FR/NFR sample (measurement-logic mismatches) and the IQC sample (enumerate-then-drop coherence findings). For lens classification, the failure mode centres on **confidence calibration vs. the agent's own enumerated competing lenses, plus a meta-recursive scope conflation** between the raw intent and the attached artefact — neither of which the current reviewer noticed.

### 1.1 The chosen lens ("product") is plausibly correct, but the confidence violates the calibration table

The system prompt's calibration table is explicit:

> "0.9–1.0: multiple unambiguous signals, **no competing lens**.
>  0.7–0.9: clear primary lens, with one or two weaker competing signals."

The agent's own thinking chain enumerates and adjudicates **four** competing lenses before committing:

> "Why not **feature**? Because the intent isn't about adding a specific capability to an *existing* product. … Why not **infra**? While it details the tech stack … Why not **bug**? There's no error to fix. Why not **legal**? There's no specific regulatory task to evaluate, though 'Compliance' is a domain. … Wait, is there a case for **unclassified**? 'Execute the intent described in the attached document.' -> This is vague."

Having *considered and rejected* four competitors — including an explicit "is there a case for unclassified?" deliberation — the agent is squarely in the 0.7–0.9 band ("one or two weaker competing signals"), not the 0.9–1.0 band ("no competing lens"). The 0.95 figure is over-confident relative to the rubric the prompt defines. By the prompt's own rule, the agent crossing into 0.9–1.0 should imply it had to consider zero competitors — yet its reasoning is dominated by competitor adjudication.

Symmetrically, the prompt requires:

> "If confidence < 0.8, name the competing lens you considered and why you rejected it."

The agent reasoned through competitors but (because confidence ≥ 0.8) did not name them in the final rationale. So the over-confident score also functions as **rationale evasion**: by inflating confidence above 0.8, the agent exempted itself from disclosing the competing-lens analysis it actually performed. The reviewer did not notice this evasion loop.

### 1.2 The rationale conflates the raw intent with the attached artefact

The raw intent, verbatim, is:

> "Execute the intent described in the attached document."

That is a meta-recursive directive. The agent's thinking explicitly flags this:

> "The phrase 'Execute the intent described in the attached document' is slightly meta. … The underlying intent of the text provided is defining a product."

It then collapses the meta-level: it classifies the *attached document's content* (a product description) rather than the *raw intent's stated action* ("execute"). The disambiguation rules in the prompt are framed around the framing of the intent itself ("'Build X, an application for Y' → product, not feature, even if X is small. The framing 'build' + persona is the tell."). The word "build" is in the *document*, not in the *intent*. The agent's rationale silently treats the document content as if it were the intent's framing.

This is not necessarily wrong — "execute the spec" arguably routes to whatever lens the spec implies. But it is a **scope decision that the rationale never names**, and the prompt has no guidance on whether intents-by-reference inherit their lens from the referenced artefact. The agent's confidence does not reflect this unstated assumption. A defensible answer would either be `product` at confidence 0.7–0.85 with the meta-recursive assumption surfaced in the rationale, or `unclassified` (if the prompt author wants intents-by-reference to be flagged). The reviewer endorsed neither path.

### 1.3 The rationale's "quoted evidence" is mostly section headers, not load-bearing phrases

The prompt requires:

> "rationale grounded in **quoted evidence** from the input"
> "One to three sentences, **quoting specific phrases from the input that drove the choice**."

The rationale's quoted spans are:

- `'Hestami AI Real Property OS and Platform'` — a title.
- `'Vision'`, `'Mission'`, `'Target Customer'`, `'Phasing Strategy'` — generic section headers that would appear in nearly any product, feature, or even infra spec.
- `'Three Pillars'` — note the capitalisation does not match the document, which uses "three pillars" (lowercase, not as a heading). This is a **paraphrase quoted as if verbatim** — minor but a grounding hygiene issue.

The strongest product signals in the document — the explicit "build/launch" framing inside Vision and Mission statements (e.g., "Building the AI operating system matching property owners and service providers …" and "We are building the platform where the frictions for maintenance and repairs … are minimized"), the explicit persona enumeration, the multi-phase product roadmap — are not quoted. The agent's reasoning chain identifies them; the rationale omits them in favour of section labels. This is a **weak-signals-as-decisive** failure: the rationale presents thin evidence as if it were the determinative basis, when stronger evidence was available and known to the agent.

### 1.4 Document quality is itself degraded — confidence does not account for it

The attached document contains multiple empty/truncated sections:

- Vision sentence ends mid-clause: "the integrated holistic end-to-end home services" (no predicate).
- `## Mission` body is empty.
- `**Core Values:**` for Hestami Home is empty.
- `**High-Level Overview:**` for Hestami Home is empty.
- `**Key Product Features & Modules:**` for Hestami Home is empty.
- Phases 2 and 3 are specified by reference to competitor descriptions (ServiceTitan, Vantaca).
- `<To Be Determined>` markers in External Integrations.

These do not change the lens — a degraded product spec is still a product spec — but they should temper confidence. The 0.95 figure communicates "multiple unambiguous signals, no competing lens" when the source itself is fragmented and the meta-recursive intent layer is unresolved. Confidence should reflect *all* sources of uncertainty, not just lens-vs-lens uncertainty.

### 1.5 The current reviewer's behaviour

- **Caught:** nothing of substance. The overall_assessment endorses the confidence score as "well-supported", which is the precise opposite of the calibration analysis above.
- **Missed:** the calibration violation (1.1), the meta-recursive scope conflation (1.2), the section-headers-as-quoted-evidence pattern (1.3), the document-quality-vs-confidence mismatch (1.4).
- **Hallucinated:** none.
- **Schema consistency:** `has_concerns=false` with `concerns=[]` is internally consistent. No structural defect.
- **Severity calibration:** untestable (no findings).

The current reasoning_review prompt's defect catalogue does include "Over-confident conclusions from insufficient evidence" — which is exactly 1.1 — yet the reviewer did not invoke it. Likely cause: the reviewer is comparing the rationale to the response and finding them internally coherent, without cross-checking against the prompt's calibration table or the agent's own reasoning chain.

---

## 2. Diagnosis

The role-specific failure modes for an intent-lens classifier are:

1. **Confidence-vs-rationale mismatch.** The agent's confidence band claims a stronger evidentiary state than its rationale (or thinking) actually demonstrates. Most often shows up as 0.9+ scores on intents that require active competitor-lens adjudication.

2. **Calibration table evasion.** Confidence ≥ 0.8 exempts the agent from naming competitors. Inflating confidence above 0.8 is therefore a way to dodge a disclosure obligation. This is structural, not stylistic.

3. **Meta-recursive scope conflation.** When the raw intent is "execute the spec at <ref>", the agent classifies the spec rather than the intent without surfacing the inheritance assumption.

4. **Weak-signal decisive citation.** Rationale quotes section headers (which appear across all lenses) instead of the load-bearing framing phrases (verbs like "build", "launch", "fix", "deploy"; persona enumerations; vision statements).

5. **Paraphrase-as-quote.** Quoted spans in rationale are cosmetically reformatted (capitalisation, punctuation) so they no longer match the source verbatim.

6. **Source-quality blindness.** Confidence reflects only lens-vs-lens uncertainty, not the degraded/incomplete state of the source material.

7. **Classification drift.** (Not present in this sample, but a known risk class.) The thinking chain trends toward one lens and the final answer commits to another. Worth designing for even if absent here.

The output shape is small and fixed: `{ lens, confidence, rationale }`. That makes most validators lighter than for FR/NFR or IQC. There is no decomposition tier, no acceptance criteria, no surfaced_assumptions, no findings array. The validator pipeline should be correspondingly compact.

---

## 3. Recommended validator pipeline for this role

Six validators. Two deterministic, four LLM-based. Two are reuses (with shape narrowing); four are role-specific.

| # | Validator | Type | Status |
|---|-----------|------|--------|
| 1 | `contract_schema_lens` | deterministic | adapted from reference |
| 2 | `calibration_rule_consistency_lens` | deterministic | new (role-specific, encodes calibration table as code) |
| 3 | `rationale_grounding_lens` | LLM | adapted from reference grounding validator (narrowed) |
| 4 | `confidence_calibration_lens` | LLM | new (role-specific) |
| 5 | `intent_vs_artifact_scope_audit` | LLM | new (role-specific; covers meta-recursive intents) |
| 6 | `reasoning_to_response_faithfulness` | LLM | reuse of cross-role pattern from sample 01 |

`final_synthesis` from the reference doc applies unchanged.

**Validators that DO NOT apply to this role:**

- `tier_decomposition` — no tier model.
- `measurement_adequacy` — no acceptance criteria or measurable conditions.
- `assumption_citation` — no `surfaced_assumptions` field.
- `coherence_evidence_audit` (from sample 01) — coherence concerns about the document are an IQC concern, not a lens-classifier concern.
- `completeness_evidence_adequacy` (from sample 01) — completeness is upstream of classification.

### 3.1 Purpose of each validator

1. **`contract_schema_lens` (deterministic).** JSON shape, `lens` enum membership, `confidence` is a number in `[0.0, 1.0]`, `rationale` is non-empty string, no markdown fences, no trailing prose, no extra top-level keys. Cheap insurance.

2. **`calibration_rule_consistency_lens` (deterministic).** Encodes the prompt's own calibration table and disclosure obligations as code:
   - `lens == "unclassified"` ⇔ `confidence ≤ 0.5`.
   - If `confidence < 0.8`, the rationale must mention at least one of the other five lenses by name AND include a rejection phrase ("rather than", "not", "competing", "considered", or "rejected").
   - If `confidence ≥ 0.9`, rationale must NOT contain hedging markers ("might be", "could also be", "borderline", "though X is plausible") — those indicate competing-lens uncertainty incompatible with the 0.9–1.0 band.
   - Rationale length 1–3 sentences.
   - Quoted spans (text inside single or double quotes) must be substring-matchable against the source intent (case-sensitive; cross-check via `rationale_grounding_lens` for paraphrase-as-quote).

3. **`rationale_grounding_lens` (LLM).** Narrowed grounding validator. Verifies that every quoted span in `rationale` appears verbatim in the raw intent or attached files, and that any unquoted factual claim ("indicating a new customer-facing surface", "signals multi-feature scope") is supported by the source. Catches paraphrase-as-quote (1.3) and unsupported summary claims.

4. **`confidence_calibration_lens` (LLM).** The semantic counterpart to validator 2. Where validator 2 enforces the disclosure rule mechanically, this validator asks: **does the actual evidentiary state in the source justify the chosen confidence band?** Reads the source intent and the agent's reasoning, counts how many lenses present non-trivial signals, and judges whether the confidence band is consistent with the calibration table. Catches the central defect in 1.1 — agent enumerated four competitors, then chose 0.95.

5. **`intent_vs_artifact_scope_audit` (LLM, role-specific).** Specifically for intents-by-reference. Detects when the raw intent is a meta directive ("execute the attached spec", "do what the document says", "implement this PDF") and the lens choice is being driven by the *artefact's* content rather than the *intent's* framing. Severity HIGH if the meta-recursion is unflagged in rationale; MEDIUM if flagged but confidence is unattenuated. Catches 1.2.

6. **`reasoning_to_response_faithfulness` (LLM).** Direct reuse of the cross-role pattern from sample 01, scoped to lens classification: detects classification drift (thinking trends toward lens A, final answer is lens B without justification) and competitor-adjudication-then-suppression (thinking adjudicates competitors, rationale omits them).

---

## 4. Validator prompt templates

All templates use the positive-mission + scoped-boundary + decision-standard + JSON output contract pattern.

### 4.1 `contract_schema_lens` (deterministic — code, no LLM)

Pseudocode:

```ts
function validateLensContract(response: any): Finding[] {
  // 1. JSON parseable, no fences/prose surrounding object.
  // 2. Top-level keys exactly: { lens, confidence, rationale }.
  // 3. lens in {"product","feature","bug","infra","legal","unclassified"}.
  // 4. confidence is a finite number in [0.0, 1.0].
  // 5. rationale is a non-empty string.
  // 6. No additional top-level keys.
}
```

Output JSON:

```json
{
  "validator": "contract_schema_lens",
  "passed": true,
  "findings": [],
  "overallAssessment": "Output conforms to the lens-classification contract."
}
```

### 4.2 `calibration_rule_consistency_lens` (deterministic — code, no LLM)

Pseudocode:

```ts
function validateLensCalibrationRules(r: LensResponse, source: string): Finding[] {
  const findings: Finding[] = [];
  const otherLenses = ["product","feature","bug","infra","legal","unclassified"]
                       .filter(l => l !== r.lens);

  // Rule A: unclassified iff confidence <= 0.5
  if ((r.lens === "unclassified") !== (r.confidence <= 0.5)) {
    findings.push({ severity: "HIGH", type: "unclassified_confidence_mismatch", ... });
  }

  // Rule B: confidence < 0.8 requires naming a competitor in rationale
  if (r.confidence < 0.8) {
    const namesCompetitor = otherLenses.some(l =>
      new RegExp(`\\b${l}\\b`, "i").test(r.rationale));
    const usesRejectionLanguage =
      /\b(rather than|not (a |an )?(product|feature|bug|infra|legal)|competing|considered|rejected)\b/i
        .test(r.rationale);
    if (!namesCompetitor || !usesRejectionLanguage) {
      findings.push({ severity: "HIGH", type: "missing_competitor_disclosure", ... });
    }
  }

  // Rule C: confidence >= 0.9 must not contain hedging markers
  if (r.confidence >= 0.9) {
    const hedges = /\b(might be|could (also )?be|borderline|though .* (is|are) plausible|arguably)\b/i;
    if (hedges.test(r.rationale)) {
      findings.push({ severity: "MEDIUM", type: "hedged_high_confidence", ... });
    }
  }

  // Rule D: rationale 1-3 sentences
  const sentenceCount = (r.rationale.match(/[.!?]+(\s|$)/g) || []).length;
  if (sentenceCount < 1 || sentenceCount > 3) {
    findings.push({ severity: "LOW", type: "rationale_length_violation", ... });
  }

  // Rule E: every quoted span (single- or double-quoted) substring-matches the source
  const quoted = [...r.rationale.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  for (const q of quoted) {
    if (!source.includes(q)) {
      findings.push({
        severity: "MEDIUM",
        type: "quoted_span_not_in_source",
        location: `rationale: "${q}"`,
        ...
      });
    }
  }

  return findings;
}
```

In this sample, Rule E would fire on `'Three Pillars'` (the document uses lowercase "three pillars", never the capitalised heading form).

Output JSON shape mirrors §4.1 with `validator: "calibration_rule_consistency_lens"`.

### 4.3 `rationale_grounding_lens` (LLM)

```text
[MISSION]
Confirm that every quoted span and every factual assertion in the lens
classifier's rationale is supported by the raw intent and any attached
files.

[IN-SCOPE]
- Every span enclosed in single or double quotes inside the rationale.
- Every unquoted factual assertion (e.g., "indicating a new customer-facing
  surface", "signals multi-feature scope", "no error to fix").
- Whether each quoted span appears VERBATIM in the source (matching
  capitalisation and punctuation), or is a paraphrase styled as a quote.

[OUT OF SCOPE]
- Whether the chosen lens is the right lens (covered by
  confidence_calibration_lens).
- Whether the confidence value is appropriate (covered by
  confidence_calibration_lens and calibration_rule_consistency_lens).
- Stylistic preferences in the rationale.

[DECISION STANDARD]
A finding is valid when:
- a quoted span does not appear verbatim in the source, OR
- a quoted span is reformatted in a way that misrepresents the source's
  emphasis or structure (e.g., capitalising a phrase that the source
  presents in lowercase prose), OR
- an unquoted factual assertion is not supported by any span of the source.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent (raw + attached files): {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "rationale_grounding_lens",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "paraphrase_as_quote" | "quoted_span_not_in_source"
            | "unsupported_factual_assertion" | "weak_signal_cited_as_decisive",
      "span": "the offending quoted or asserted span",
      "location": "rationale",
      "sourceEvidence": [
        {"sourceSpan": "...", "relationship": "supports" | "contradicts" | "does_not_support" | "partial"}
      ],
      "detail": "...",
      "recommendation": "Replace with verbatim quote, weaken the assertion, or remove."
    }
  ],
  "overallAssessment": "..."
}
```

**Severity rule:** HIGH if a quoted span is fabricated (not in source at all); MEDIUM for paraphrase-as-quote and weak-signal-cited-as-decisive; LOW for cosmetic citation imprecision that does not change interpretation.

### 4.4 `confidence_calibration_lens` (LLM)

```text
[MISSION]
Judge whether the agent's confidence value is consistent with the
calibration table defined in the agent's own system prompt, given the
evidentiary state in the source and the competitor-lens analysis the
agent performed.

[CALIBRATION TABLE — verbatim from the agent's system prompt]
- 0.9–1.0: multiple unambiguous signals, NO competing lens.
- 0.7–0.9: clear primary lens, with one or two weaker competing signals.
- 0.5–0.7: a judgement call; pick the most likely lens but flag in
           rationale.
- ≤ 0.5: genuinely ambiguous — emit `unclassified`.

[CORE QUESTION]
For the chosen confidence band, is the evidentiary state consistent with
that band? Specifically:
- Did the agent's reasoning enumerate and reject one or more competing
  lenses? If so, the confidence cannot be in the 0.9–1.0 band.
- Did the agent flag any source-quality issue (truncated sections, empty
  bodies, placeholders, specification-by-competitor-reference)? If so,
  the confidence should be attenuated below the top of the lens-vs-lens
  band.
- Is the source itself thin (e.g., a one-line intent referencing a
  document)? Treat that as inherent uncertainty regardless of how clear
  the chosen lens looks.

[IN-SCOPE]
- The confidence value relative to the calibration table.
- The relationship between competitor-lens analysis in the agent's
  reasoning and the chosen band.
- Whether the rationale's hedging or non-hedging language matches the
  band.

[OUT OF SCOPE]
- Whether the lens itself is the right lens (a separate concern).
  Note: this validator may incidentally observe that the lens is wrong;
  if so, mention it in `overallAssessment` but do not produce a finding
  unless the wrong lens is what makes the confidence inappropriate.
- Schema and quote-grounding (covered elsewhere).

[DECISION STANDARD]
A finding is valid when the chosen confidence band is materially
inconsistent with one or more of:
- the number of competing lenses the agent considered,
- the source-quality state,
- the meta-recursive nature of the intent (intent-by-reference adds
  uncertainty),
- the rationale's own hedging language.

Severity rule:
- HIGH: confidence ≥ 0.9 while the agent enumerated and rejected one or
  more competing lenses, OR confidence ≥ 0.9 while the source is thin
  / fragmented / unclassified-eligible, OR `unclassified` chosen with
  confidence > 0.5, OR a non-`unclassified` lens chosen with confidence
  ≤ 0.5.
- MEDIUM: confidence is in the right band but at the wrong end of it
  (e.g., 0.95 where 0.85 would be defensible), OR rationale hedging
  language conflicts with the band.
- LOW: minor calibration drift that does not affect downstream gating.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "confidence_calibration_lens",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "overconfident_band" | "underconfident_band"
            | "unclassified_band_violation" | "rationale_hedging_mismatch"
            | "source_quality_unaccounted",
      "chosenLens": "product",
      "chosenConfidence": 0.95,
      "competitorsConsideredInReasoning": ["feature","infra","bug","legal","unclassified"],
      "expectedBand": "0.7-0.9",
      "detail": "Reasoning chain enumerates four competing lenses including an unclassified deliberation. Per the calibration table, this places the answer in the 0.7–0.9 band, not 0.9–1.0.",
      "recommendation": "Reduce confidence to 0.8 and disclose the rejected competitors in the rationale."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.5 `intent_vs_artifact_scope_audit` (LLM, role-specific)

```text
[MISSION]
Detect whether the lens classification is being driven by the content of
an attached artefact rather than by the framing of the raw intent itself,
and verify that any such inheritance is acknowledged in the rationale and
reflected in the confidence value.

[CORE QUESTION]
Is the raw intent a meta-recursive directive of the form "execute / build
/ implement / do what the attached document says"? If so, the lens choice
is being inherited from the artefact, and that inheritance must be:
- explicitly named in the rationale, AND
- reflected in confidence (an unstated inheritance is an additional
  source of uncertainty).

[IN-SCOPE]
- The raw intent text (the part of the prompt outside the attached
  document, when an attached document is present).
- Whether the rationale's quoted evidence is drawn from the raw intent
  or only from the attached artefact.
- Whether the rationale acknowledges that the lens is inherited from
  the artefact.
- Whether confidence is attenuated to reflect the meta-recursion.

[OUT OF SCOPE]
- Whether the artefact itself is well-formed (an IQC concern).
- Whether the raw intent text is sufficient (an upstream concern).

[DECISION STANDARD]
A finding is valid when:
- the raw intent is a meta-recursive directive, AND
- all of the rationale's quoted evidence comes from the artefact (none
  from the raw intent itself), AND
- the rationale does not explicitly acknowledge the inheritance, AND/OR
- the confidence is in the 0.9–1.0 band despite the inheritance.

Severity rule:
- HIGH: meta-recursion is unflagged AND confidence is ≥ 0.9.
- MEDIUM: meta-recursion is unflagged but confidence is moderate (0.7–0.9).
- LOW: meta-recursion is acknowledged but confidence is unattenuated.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Raw intent (the non-attached part): {{RAW_INTENT}}
Attached artefacts: {{ATTACHED_ARTEFACTS}}
Agent reasoning: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "intent_vs_artifact_scope_audit",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "meta_recursion_unflagged" | "inheritance_unacknowledged"
            | "raw_intent_evidence_absent_from_rationale"
            | "confidence_unattenuated_for_meta_recursion",
      "rawIntent": "Execute the intent described in the attached document.",
      "rationaleQuoteSources": ["attached_artefact" | "raw_intent"],
      "detail": "...",
      "recommendation": "Acknowledge inheritance in rationale; attenuate confidence; or emit unclassified."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.6 `reasoning_to_response_faithfulness` (LLM, cross-role pattern)

Reuse the validator from `01_orchestrator__intent_quality_check.md` §4.6 with the role-specific markers and decision points narrowed:

- **Markers in the thinking chain to look for:**
  - "is there a case for **{lens}**?" followed by a dismissal that does not engage the calibration table.
  - "I'll set confidence to X" / "Let's set confidence to X" with no derivation.
  - "Wait, …" / "Actually, …" pivots between the chosen lens and a competitor.
  - Adjudication of competitors that does not surface in the final rationale.

- **Severity rule (role-specific override):**
  - HIGH: classification drift — thinking commits to lens A, final answer is lens B without justification.
  - HIGH: thinking adjudicates `unclassified` as a live possibility, final answer chooses a specific lens with confidence ≥ 0.9.
  - MEDIUM: competitor-lens adjudication is performed in thinking and not represented in rationale, while confidence ≥ 0.8 (which exempts disclosure under the prompt's own rule — the issue is the *evasion loop*, not the disclosure rule itself).
  - LOW: stylistic deliberation that does not affect the final answer.

Output JSON shape unchanged from sample 01 §4.6, except `responseLocation` will typically be `"rationale"` or `"confidence"` rather than a findings array path.

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_lens` | yes (deterministic) | `agent_role == "orchestrator" && sub_phase == "intent_lens_classification"` |
| `calibration_rule_consistency_lens` | yes (deterministic) | same; only Rules A–D fire if `contract_schema_lens` failed (Rule E needs the source) |
| `rationale_grounding_lens` | conditional (LLM) | same; skip if `contract_schema_lens` failed |
| `confidence_calibration_lens` | conditional (LLM) | same; skip if `contract_schema_lens` failed |
| `intent_vs_artifact_scope_audit` | conditional (LLM) | fires only when the raw intent contains meta-recursive markers ("execute", "implement", "build", "do") plus a reference to an attached/inlined artefact AND the artefact is non-trivial (≥ ~500 chars) |
| `reasoning_to_response_faithfulness` | conditional (LLM) | fires only when `agent_thinking_chain.length > 0` |

Pipeline order:

```
1. contract_schema_lens                  (deterministic, gate)
2. calibration_rule_consistency_lens     (deterministic)
3. rationale_grounding_lens              (LLM)
4. confidence_calibration_lens           (LLM)
5. intent_vs_artifact_scope_audit        (LLM, conditional)
6. reasoning_to_response_faithfulness    (LLM, conditional)
7. final_synthesis                       (LLM, unchanged from reference)
```

### 5.2 Deterministic vs LLM split

- **Deterministic (no LLM):** `contract_schema_lens`, `calibration_rule_consistency_lens`. Both reduce to pure functions over the response (and source, for Rule E). Confidence-band-vs-disclosure-rule is a mechanical check; do not spend tokens on it.
- **LLM:** the remaining four. They require source comprehension, calibration judgment, meta-recursion detection, or reasoning-chain reading.

### 5.3 Integration with the cross-role validators

- `contract_schema` (reference §1) generalises to a role-keyed contract registry; `contract_schema_lens` is the lens-classifier entry. Same model as IQC's `contract_schema_iqc`.
- `grounding` (reference §2) maps to `rationale_grounding_lens` with the claim list narrowed to quoted spans + factual assertions inside the rationale.
- `reasoning_quality` (reference §6) is fully covered for this role by `confidence_calibration_lens` + `reasoning_to_response_faithfulness` together. Recommend not dispatching the generic `reasoning_quality` validator on this role; it would duplicate the more specific checks and burn tokens.
- `tier_decomposition`, `measurement_adequacy`, `assumption_citation` — do not dispatch.
- `final_synthesis` (reference §7) applies unchanged.

### 5.4 Cross-validator rationale rule

`calibration_rule_consistency_lens` and `confidence_calibration_lens` are deliberately split: the former is mechanical (encodes the prompt's text directly as code), the latter is semantic (judges whether the band is justified by the evidentiary state). They will sometimes both fire on the same response. When that happens, `final_synthesis` should treat the deterministic finding as authoritative on rule-text violations and the LLM finding as authoritative on band-vs-evidence judgments; do not double-count them as independent issues.

---

## 6. Notes and open questions

1. **The 0.8 disclosure threshold creates an incentive to inflate.** The prompt's "if confidence < 0.8, name the competing lens you considered and why you rejected it" is the only mechanism that surfaces competitor adjudication in the final output. By tying disclosure to a single-sided threshold, the prompt creates a structural reward for choosing 0.8+: the agent can dodge disclosure. Recommend the prompt author consider either (a) requiring competitor disclosure at *all* confidence bands, or (b) rephrasing to "if you considered any competing lens, name it and explain rejection regardless of confidence". Deferred — out of scope for the validator design but worth surfacing.

2. **`confidence_calibration_lens` will sometimes need to disagree with the agent's own band-vs-evidence framing without being able to fully recover the evidentiary state from the prompt window.** Ensure the validator has access to the same source (raw intent + attached files) the agent received. Without that, the validator collapses into a styling check on the rationale.

3. **Meta-recursive intents are common and the prompt has no rule for them.** Sample 02 happens to hit one ("Execute the intent described in the attached document"). The prompt's disambiguation notes do not address this case. `intent_vs_artifact_scope_audit` is therefore both a validator and an implicit prompt-design feedback channel. If the validator fires consistently across many runs, that signals the upstream prompt should grow an explicit meta-recursion clause — not that the validator should be tuned down.

4. **Lens-correctness is not a separate validator.** Choosing the wrong lens shows up indirectly through `confidence_calibration_lens` (because a wrong choice usually correlates with weak signals) or `rationale_grounding_lens` (because the rationale will struggle to ground the wrong choice). A dedicated `lens_correctness` validator would essentially re-run the lens classifier and is therefore better expressed as ensemble verification (the verification_ensemble pattern), not a reasoning-review validator. Deferred.

5. **Thin samples may degrade `confidence_calibration_lens`.** For very short rationales with no reasoning chain captured (smaller models), the calibration validator has less signal. In that regime, `calibration_rule_consistency_lens` (deterministic) carries most of the weight. Acceptable trade-off.

6. **Reviewer-model sizing.** As with sample 01, the gemma4:e4b reviewer was demonstrably under-sensitive — here it endorsed an over-confident classification that the agent's own reasoning chain flagged as a meta-recursive judgment call. The decomposed pipeline above narrows each validator's job, but the LLM-based validators (3–6) will still under-perform at gemma4:e4b scale. Stepping the LLM validators up to a stronger reviewer is recommended; the deterministic validators (1–2) are size-independent.

7. **Quoted-span verbatim matching (Rule E in §4.2) is conservative.** It will false-positive on intentional ellipsis or punctuation normalisation by the agent. That is a tolerable cost — the false-positive surfaces as a LOW finding, and the cure is for the agent to either quote verbatim or weaken the punctuation. Worth re-evaluating if the false-positive rate is high in practice.
