# Assessment: orchestrator / intent_quality_check (Phase 1.1)

**Sample:** `track_c_samples/01_orchestrator__intent_quality_check.md`
**Reviewed agent:** `orchestrator` running `qwen3.5:9b`
**Reviewer under examination:** `gemma4:e4b` driven by `prompts/cross_cutting/reasoning_review.system.md`

---

## 1. What this sample reveals

The reviewed agent produced this final response:

```json
{
  "completeness_findings": [
    {"field": "what_is_being_built",   "status": "present", "severity": "low", "explanation": "..."},
    {"field": "who_it_serves",         "status": "present", "severity": "low", "explanation": "..."},
    {"field": "what_problem_it_solves","status": "present", "severity": "low", "explanation": "..."}
  ],
  "consistency_findings": [],
  "coherence_findings": [],
  "overall_status": "pass",
  "system_proposal_offered_for": []
}
```

The reviewer (gemma4:e4b) returned:

```json
{
  "has_concerns": false,
  "concerns": [],
  "overall_assessment": "The agent performed a thorough and accurate analysis. ..."
}
```

Unlike the FR/NFR sample called out in `redesign recommendations - 1.md`, the gate-field consistency here is intact — `has_concerns=false` matches `concerns=[]`. The failure mode in this sample is different: **the reviewer endorsed an answer that the agent's own thinking chain talked itself out of**, and missed several concrete coherence defects that are visible in the input text without leaving the prompt window.

### 1.1 The agent's reasoning explicitly raised concerns and then discarded them

The thinking chain contains this exact backtrack:

> "Core Values" is empty (line 10: "Core Values: \n\n"). … Maybe this is a Coherence warning: "Core Values defined for reference products but absent for Hestami Home". Severity: `warning`? Or `low`? … I'll stick to `[]` unless it's critical.

And again on naming collision:

> The section header is "### ServiceTitan". This is a naming convention quirk … I will not treat it as a conflict.

And on the meta-recursive intent:

> The phrase "Execute the intent described" is a bit meta. … One potential Coherence warning: The "Intent" says "Execute the intent…". It doesn't define *how* the execution happens (coding, planning, etc.) … Is there a blocking concern? No.

The system prompt is explicit on this point:

> "List concrete concerns (not vague unease)."

These are concrete — quoted spans, specific sections — not vague unease. The agent reasoned to the right candidate findings and then suppressed all of them, producing `coherence_findings: []`. The contradiction between thinking-chain and final answer is the central reasoning defect.

### 1.2 The input has multiple objectively missing/truncated artifacts the agent ignored

Quoting from the attached document inside the sample:

- **Vision sentence is truncated mid-clause:**
  > "The Hestami AI Real Property OS and Platform is created to be the integrated holistic end-to-end home services"
  Sentence ends with no predicate. Not flagged.
- **`## Mission` section is empty.** Not flagged.
- **`**High-Level Overview:**` for Hestami Home is empty.** Not flagged.
- **`**Key Product Features & Modules:**` for Hestami Home is empty.** Not flagged.
- **`**Core Values:**` for Hestami Home is empty.** The agent noticed this in its thinking and discarded it.
- **Phase 2 and Phase 3 user-journey sections** contain only the placeholder phrase "Based on business domains and user personas typical for field service management software" with no journeys enumerated.
- **`<To Be Determined>`** appears as the External Integrations vendor.
- **Phases 2 and 3 are specified by reference to competitor product descriptions** (`Appendix "ServiceTitan"`, `Appendix "Vantaca"`) rather than to a Hestami spec. The intent to "execute" therefore inherits competitor product behavior as the binding spec for two of three pillars. This is a concrete scope-boundary concern of exactly the kind the system prompt enumerates ("unresolved scope boundaries", "architecture choices the intent implies but does not justify").

None of these surfaced as `coherence_findings`. The agent's `what_problem_it_solves` explanation cites only the Pillar 1 "Core Business Problem" — yet it asserts presence at the document level, not the Phase-1-only level. This is a **scope conflation**: completeness was satisfied for one pillar but the intent claims three.

### 1.3 The `severity: "low"` choice for present fields is unmoored

The system prompt schema requires `"severity": "high|medium|low"` for each completeness entry but never defines what severity means when `status: "present"`. The agent picked `"low"` arbitrarily for all three. There is no guidance in the prompt distinguishing a thinly-supported "present" (a one-line mention) from a thickly-supported "present" (a multi-page treatment). Every "present" entry from this agent will read `"low"` regardless of evidence weight. The reviewer did not notice.

### 1.4 The current reviewer's behavior

- **Caught:** nothing of substance.
- **Missed:** the thinking-vs-final-response contradiction (1.1), the truncated/empty section evidence (1.2), the pillar-scope conflation in the completeness explanations (1.2 last paragraph), the severity-field semantic vacuum (1.3).
- **Hallucinated:** none — the reviewer's restraint produced `concerns: []` correctly *given* its (incorrect) judgment, so no fabricated issues.
- **Structural consistency:** `has_concerns=false` matches `concerns=[]`. Good. No structural defect like the one called out in the reference doc.
- **Severity calibration:** untestable — no findings emitted.
- **Overall:** the reviewer is **under-sensitive to discard-the-finding patterns inside the thinking chain** and **does not cross-check the agent's "present" assertions against the pillar-by-pillar evidence quality in the source document**. The cheerful overall assessment ("thorough and accurate") is itself a misread.

---

## 2. Diagnosis

This is a different failure pattern than the FR/NFR sample. There, the defects were measurement-logic mismatches embedded in SQL-like conditions. Here, the defects are:

1. **Discard-without-justification.** The agent enumerates candidate findings in its reasoning, then drops them with phrases like "I'll stick to `[]` unless it's critical." The current reviewer prompt has no instruction to flag this pattern, even though it is precisely what "shortcut taken" and "contradictions between reasoning steps and conclusions" in the cross_cutting reasoning_review prompt are supposed to capture. The reviewer evidently treats the *final response* as the object of review and skims the thinking chain.

2. **Document-level vs pillar-level scope blindness.** The agent's "present" explanations cite Pillar-1-only evidence to justify a document-level claim that covers three pillars. The reviewer is not equipped to detect this scope mismatch.

3. **Schema enum semantic vacuum.** The completeness `severity` field has no defined meaning when `status="present"`. This is a prompt-design defect, not a reviewer defect, but it produces under-informative outputs the reviewer should either ignore or flag as a non-issue. (Recommend deferring: fix the upstream prompt rather than building a validator around it.)

4. **Coherence-finding under-eagerness.** The system prompt has anti-laziness language ("Zero findings is a valid answer — but only when you have actually looked"). The agent paid lip service in its thinking ("I see none. I need to check thoroughly.") but then suppressed actual concrete findings. This is a faithfulness/consistency failure between the prompt's anti-laziness instruction and the agent's behavior — and the reviewer has no nose for it.

The role-specific output shape (`completeness_findings`, `consistency_findings`, `coherence_findings`, `overall_status`, `system_proposal_offered_for`) is much smaller than the FR/NFR shape. The validator pipeline should be correspondingly leaner. `tier_decomposition`, `measurement_adequacy`, and `assumption_citation` from the reference doc do not apply here — there are no tiers, no measurable conditions, and no `surfaced_assumptions` field in this contract.

---

## 3. Recommended validator pipeline for this role

Six validators, three deterministic and three LLM-based. Two are direct reuses from the reference doc (with shape adapted); four are new or substantially reshaped for this sub-phase.

| # | Validator | Type | Status |
|---|-----------|------|--------|
| 1 | `contract_schema_iqc` | deterministic | adapted from reference |
| 2 | `status_consistency_iqc` | deterministic | new (role-specific) |
| 3 | `grounding_iqc` | LLM | adapted from reference (narrowed) |
| 4 | `completeness_evidence_adequacy` | LLM | new (role-specific) |
| 5 | `coherence_evidence_audit` | LLM | new (role-specific) |
| 6 | `reasoning_to_response_faithfulness` | LLM | new (role-specific, but pattern is reusable cross-role) |

`final_synthesis` from the reference doc applies unchanged and is not redefined here.

**Validators that DO NOT apply to this role and should not fire:**
- `tier_decomposition` — no tier model in this output shape.
- `measurement_adequacy` — no acceptance criteria or measurable conditions.
- `assumption_citation` — no `surfaced_assumptions` field; closest analogue is `system_proposal_offered_for` which is structurally trivial and covered by `contract_schema_iqc`.

### 3.1 Purpose of each validator

1. **`contract_schema_iqc` (deterministic).** Validates JSON shape, enum values, presence of all three required completeness entries, `overall_status` enum, `system_proposal_offered_for` is an array of strings, no markdown fences, no trailing prose. Catches no defect in this sample but cheap insurance.

2. **`status_consistency_iqc` (deterministic).** Enforces the `overall_status` rules from the system prompt as code:
   - `pass` ⇒ all three `completeness_findings[].status == "present"` AND zero finding has `severity == "blocking"` in `consistency_findings` or `coherence_findings`.
   - `requires_input` ⇒ at least one completeness `status == "absent"`, AND `system_proposal_offered_for` is non-empty.
   - `blocking` ⇒ at least one `consistency_findings[].severity == "blocking"` OR `coherence_findings[].severity == "blocking"`.
   - When `overall_status == "pass"` and any completeness `status == "absent"`: HIGH finding.

   This sample passes this check trivially (it is internally consistent). Cheap deterministic insurance against future drift — particularly the failure mode where an agent emits `requires_input` but forgets `system_proposal_offered_for`.

3. **`grounding_iqc` (LLM).** Direct reuse of the reference doc's grounding validator with the claim list narrowed: the only generated claims worth grounding here are the `explanation` fields and the elements quoted under `consistency_findings[].elements_in_conflict`. Catches: explanations that cite document sections that do not exist or do not say what they are claimed to say. In this sample, the `what_problem_it_solves` explanation cites only the Pillar 1 "Core Business Problem", which is a partially-supported claim relative to a document that defines three pillars.

4. **`completeness_evidence_adequacy` (LLM, role-specific).** For each `completeness_findings[]` entry with `status: "present"`, verifies that the evidence cited in `explanation` is **commensurate with the scope of the intent**. If the intent describes three pillars and the explanation cites evidence for only one pillar, flag it. If the cited section is empty/truncated/placeholder, flag it. This is the validator that should catch the agent's "what_problem_it_solves: present" claim being supported only by Pillar-1 evidence in this sample.

5. **`coherence_evidence_audit` (LLM, role-specific).** Independently scans the attached document for **objectively detectable coherence defects** — empty section bodies, truncated sentences, `<To Be Determined>` markers, sections defined only by reference to a competitor description, contradictions between named phases and named appendices — and verifies that any such defect that meets a concreteness threshold is represented in `coherence_findings`. This is a directional inversion of the reviewed agent's task: instead of asking "did the agent find anything?", it asks "are there concrete things the agent should have found?". This is the validator most directly indicted by section 1.2.

6. **`reasoning_to_response_faithfulness` (LLM, role-specific in scope but a cross-role pattern).** Reads the agent's thinking chain for **candidate findings the agent enumerated and then dropped without justification**, and verifies that each dropped candidate is either (a) absent because the agent justified the drop with evidence, or (b) present in the final response. The discard-without-justification pattern in section 1.1 is the canonical case. Markers: phrases like "I'll stick to `[]` unless …", "I'll not treat it as", "Maybe this is a … warning … I'll …".

---

## 4. Validator prompt templates

All templates use the positive-mission + scoped-boundary + decision-standard + JSON output contract pattern from the reference doc's revised shared envelope.

### 4.1 `contract_schema_iqc` (deterministic — code, not LLM)

Implemented as TypeScript inside the reasoning-review harness; no prompt. Pseudocode:

```ts
function validateIQCContract(response: any): Finding[] {
  const findings: Finding[] = [];
  // 1. JSON parseable, no markdown fences, no trailing prose. (parser-side)
  // 2. Top-level keys exactly: completeness_findings, consistency_findings,
  //    coherence_findings, overall_status, system_proposal_offered_for.
  // 3. completeness_findings.length === 3 and field set ===
  //    {what_is_being_built, who_it_serves, what_problem_it_solves}.
  // 4. Each completeness entry: status in {present,absent}, severity in {high,medium,low},
  //    explanation non-empty string.
  // 5. Each consistency_finding: elements_in_conflict.length >= 2,
  //    severity in {blocking,warning}, explanation non-empty.
  // 6. Each coherence_finding: concern non-empty, severity in {blocking,warning},
  //    explanation non-empty.
  // 7. overall_status in {pass, requires_input, blocking}.
  // 8. system_proposal_offered_for: array of strings (may be empty).
  return findings;
}
```

Output JSON:

```json
{
  "validator": "contract_schema_iqc",
  "passed": true,
  "findings": [],
  "overallAssessment": "Output conforms to the IQC contract."
}
```

### 4.2 `status_consistency_iqc` (deterministic — code)

```ts
function validateIQCStatusConsistency(response: IQCResponse): Finding[] {
  const allPresent = response.completeness_findings.every(f => f.status === "present");
  const anyAbsent = response.completeness_findings.some(f => f.status === "absent");
  const hasBlockingFinding =
    response.consistency_findings.some(f => f.severity === "blocking") ||
    response.coherence_findings.some(f => f.severity === "blocking");

  // pass requires all_present AND no_blocking
  // requires_input requires any_absent AND non-empty system_proposal_offered_for
  // blocking requires at least one blocking finding
  // ... emit HIGH findings on each rule break
}
```

Output JSON shape mirrors §4.1 with `validator: "status_consistency_iqc"`.

### 4.3 `grounding_iqc` (LLM)

```text
[MISSION]
Confirm that every quoted span and every section reference in the reviewed
agent's output is supported by the source intent (raw intent text plus any
attached/referenced files).

[IN-SCOPE]
- explanation strings inside completeness_findings[]
- elements_in_conflict[] strings inside consistency_findings[]
- concern strings inside coherence_findings[]
- explanation strings inside coherence_findings[]

For each span, classify as SUPPORTED, CONTRADICTED, UNSUPPORTED,
or PARTIALLY_SUPPORTED with respect to the source intent.

A particularly important sub-case for this role: a "present" claim whose
explanation cites evidence that covers only PART of the scope the intent
describes (e.g., one of three pillars). Mark such claims PARTIALLY_SUPPORTED
and include the missing-scope evidence in the finding.

[OUT OF SCOPE]
- Whether the requirements are well-designed.
- Whether SQL or pseudo-code is correct (none in this output shape).
- Whether the overall_status is the right verdict (covered by another validator).
- Style and wording.

[DECISION STANDARD]
A finding is valid when a span asserts a fact about the source that the
source does not actually entail, or when the span overgeneralises evidence
that only supports a narrower claim.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent (raw + attached files): {{SOURCE_CONTEXT}}
Agent thinking: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
Return a single JSON object beginning with "{" and ending with "}":
{
  "validator": "grounding_iqc",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "unsupported_claim" | "contradicted_claim"
            | "partially_supported_claim" | "fabricated_section_reference"
            | "scope_overgeneralisation",
      "claim": "...",
      "location": "completeness_findings[i].explanation | ...",
      "groundingStatus": "SUPPORTED" | "CONTRADICTED" | "UNSUPPORTED" | "PARTIALLY_SUPPORTED",
      "sourceEvidence": [
        {"sourceSpan": "...", "relationship": "supports" | "contradicts" | "does_not_support"}
      ],
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

**Severity rule:** HIGH if a fabricated section reference or a contradicted
claim drives the overall_status verdict; MEDIUM for scope overgeneralisation
that affects a "present" assertion; LOW for cosmetic citation imprecision.

### 4.4 `completeness_evidence_adequacy` (LLM, role-specific)

```text
[MISSION]
Verify that each completeness_findings entry with status "present" cites
evidence that is COMMENSURATE WITH THE SCOPE the intent itself defines.

[CORE QUESTION]
For each "present" entry, ask: does the cited explanation cover the full
scope the intent describes, or does it cover only a fragment?

[IN-SCOPE]
- Pillar/phase/module enumeration in the source intent.
- Whether the "present" explanation cites evidence covering ALL such
  enumerated parts, or only some.
- Whether the cited section in the source is itself non-empty,
  non-truncated, and not a placeholder ("<To Be Determined>", "TBD",
  "See Appendix X" where Appendix X is a competitor description rather
  than a Hestami spec).

[OUT OF SCOPE]
- Coherence concerns about the document overall (covered by
  coherence_evidence_audit).
- Whether overall_status is correct (covered by status_consistency_iqc).
- Style.

[DECISION STANDARD]
A finding is valid when a "present" claim is justified by evidence whose
scope is materially narrower than the scope the intent describes, OR when
the cited section is itself empty/truncated/placeholder.

Severity rule:
- HIGH: a "present" claim is supported only by content for one of N
  enumerated parts, AND the missing parts have no equivalent content
  elsewhere in the source.
- MEDIUM: cited section is partially populated; major sub-headings are
  empty but the overall claim has some support.
- LOW: minor evidence-citation imprecision.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent thinking: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "completeness_evidence_adequacy",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "scope_undercoverage" | "cited_section_empty"
            | "cited_section_truncated" | "cited_section_is_placeholder"
            | "cited_section_is_competitor_reference",
      "field": "what_is_being_built" | "who_it_serves" | "what_problem_it_solves",
      "citedExplanation": "...",
      "intentScopeEnumeration": ["pillar 1", "pillar 2", "pillar 3"],
      "actuallyCoveredScope": ["pillar 1"],
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.5 `coherence_evidence_audit` (LLM, role-specific)

```text
[MISSION]
Independently audit the source intent for concrete coherence defects and
verify that any such defect meeting a concreteness threshold is reflected
in the agent's coherence_findings.

[INVERSION]
You are not asking "did the agent find anything?". You are asking
"what concrete coherence defects does the source contain, and were they
represented?".

[IN-SCOPE — concrete defect catalogue]
- Section bodies that are empty under named headings ("## Mission" with
  no content, "**Key Product Features & Modules:**" with no list).
- Truncated sentences (sentence ends without predicate or punctuation).
- Placeholder markers: "<To Be Determined>", "TBD", "See Appendix X"
  where Appendix X turns out to be a competitor product description.
- Named phases or pillars whose specification reduces to a competitor
  reference rather than a first-party spec.
- Naming collisions between the product's own pillar names and
  competitor names used as appendix titles.
- Phasing/scope statements that reference content the document does
  not actually contain.

[DECISION STANDARD]
For each defect class above, if at least one concrete instance exists in
the source AND it is NOT represented (or is materially under-represented)
in coherence_findings, emit a finding.

Severity rule:
- HIGH: a phase or pillar is specified ONLY by competitor reference, OR a
  required field's source evidence is empty/truncated, AND the agent
  emitted overall_status "pass".
- MEDIUM: minor empty subsections or cosmetic placeholders are present
  and unflagged.
- LOW: surfaced but with imprecise wording.

[OUT OF SCOPE]
- Whether the agent's existing coherence_findings are individually
  well-worded.
- Whether overall_status is correct (status_consistency_iqc).

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent thinking: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "coherence_evidence_audit",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "empty_named_section" | "truncated_sentence"
            | "tbd_placeholder" | "phase_specified_by_competitor_reference"
            | "naming_collision" | "phasing_references_missing_content",
      "sourceSpan": "...",
      "sourceLocation": "section heading or line span",
      "agentRepresentedThis": false,
      "detail": "...",
      "recommendation": "Add coherence_finding with severity X because ..."
    }
  ],
  "overallAssessment": "..."
}
```

### 4.6 `reasoning_to_response_faithfulness` (LLM, role-specific scope, cross-role pattern)

```text
[MISSION]
Identify candidate findings the agent enumerated in its thinking chain
and then dropped without evidentiary justification, and verify that the
final response either (a) contains them, or (b) records a justified reason
for their omission.

[WHAT TO LOOK FOR IN THE THINKING CHAIN]
Markers of enumerate-then-drop:
- "Maybe this is a ... warning"
- "I'll stick to [] unless ..."
- "I will not treat it as ..."
- "Is this a conflict? ... No, just ..."
- "Should I include this? ... I'll skip it."
- Any phrase where the agent identifies a concrete observation about the
  source and then chooses not to report it without anchoring the choice
  to the system prompt's decision rules.

For each such marker, locate the corresponding final-response field
(coherence_findings or consistency_findings, depending on the topic).

[DECISION STANDARD]
A finding is valid when:
1. the thinking chain enumerates a concrete observation drawn from the
   source, AND
2. the system prompt's decision rules would admit it as a valid finding
   ("List concrete concerns (not vague unease)" is satisfied), AND
3. the agent dropped it without citing a decision rule that excludes it,
   AND
4. it is absent from the final response.

[OUT OF SCOPE]
- Findings the agent considered and rejected with explicit reference to
  a system-prompt rule (for example: "this is a thorough intent because
  the prompt says a one-liner referencing a 100-page spec is thorough" —
  that drop IS justified).
- Stylistic or wording-level deliberation in the thinking chain.

Severity rule:
- HIGH: the dropped candidate, if reported, would have changed
  overall_status (e.g., a blocking-severity coherence concern).
- MEDIUM: the dropped candidate would have added a non-blocking warning
  but not changed overall_status.
- LOW: the dropped candidate is borderline-concrete.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Agent thinking: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "reasoning_to_response_faithfulness",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "enumerate_then_drop_unjustified"
            | "thinking_contradicts_response"
            | "shortcut_taken",
      "thinkingSpan": "exact quoted thinking-chain span",
      "responseLocation": "field that should have contained the finding",
      "promptRuleNotInvoked": "which system-prompt rule would have admitted it",
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

---

## 5. Conditional dispatch and integration

### 5.1 Dispatch matrix

| Validator | Always-on? | Fires when |
|-----------|------------|------------|
| `contract_schema_iqc` | yes (deterministic) | `agent_role == "orchestrator" && sub_phase == "intent_quality_check"` |
| `status_consistency_iqc` | yes (deterministic) | same as above |
| `grounding_iqc` | conditional (LLM) | same as above; skip if `contract_schema_iqc` failed (don't waste tokens on an invalid object) |
| `completeness_evidence_adequacy` | conditional (LLM) | same as above; skip if `contract_schema_iqc` failed |
| `coherence_evidence_audit` | conditional (LLM) | same as above; skip if `contract_schema_iqc` failed |
| `reasoning_to_response_faithfulness` | conditional (LLM) | fires only when `agent_thinking_chain.length > 0`; cross-role pattern (re-usable for any role with a captured thinking chain) |

The pipeline order matches the reference doc's recommendation:

```
1. contract_schema_iqc          (deterministic, gate)
2. status_consistency_iqc       (deterministic)
3. grounding_iqc                (LLM, cross-role)
4. completeness_evidence_adequacy (LLM, role-specific)
5. coherence_evidence_audit     (LLM, role-specific)
6. reasoning_to_response_faithfulness (LLM, cross-role pattern)
7. final_synthesis              (LLM, unchanged from reference)
```

### 5.2 Deterministic vs LLM split

- **Deterministic (no LLM):** `contract_schema_iqc`, `status_consistency_iqc`. Both can be expressed as pure functions over the parsed response. No reason to spend tokens.
- **LLM:** the remaining four. They require source-context comprehension, scope reasoning, or thinking-chain reading.

### 5.3 Integration with the cross-role validators in the reference doc

- `contract_schema` (reference §1) generalises to a **role-keyed contract registry** where `intent_quality_check` registers the IQC schema and `fr_nfr_decomposition` registers its own. `contract_schema_iqc` is therefore not a new validator type — it is the IQC entry in that registry.
- `grounding` (reference §2) applies, with the claim list narrowed as in §4.3 above. Same prompt skeleton, role-specific [IN-SCOPE] block.
- `reasoning_quality` (reference §6) **partially overlaps** with `reasoning_to_response_faithfulness`. Recommend keeping `reasoning_to_response_faithfulness` as a narrower, more reliably-triggered validator and letting `reasoning_quality` cover the remaining categories (overconfidence, semantic drift, etc.) when a thinking chain is available. Avoid having both fire when only `reasoning_to_response_faithfulness` would yield findings — that's a duplicate-token cost.
- `tier_decomposition`, `measurement_adequacy`, `assumption_citation` (reference §§4, 3, 5) **do not dispatch** for this role.
- `final_synthesis` (reference §7) applies unchanged.

---

## 6. Notes and open questions

1. **The completeness `severity` field has no defined semantics.** When `status: "present"`, what does HIGH vs LOW mean? Recommend either (a) removing severity from `present` entries in the upstream agent prompt, or (b) defining it as "evidence weight" (HIGH = thickly supported, LOW = minimally supported). I would not build a validator around the current ambiguous field; fix it upstream.

2. **A second sample would help** establish whether the discard-without-justification pattern is reliable enough across runs of the same role to anchor `reasoning_to_response_faithfulness`. The qwen3.5:9b agent in this sample produced a particularly long, deliberative thinking chain. Smaller-model runs may not enumerate candidates as visibly, in which case the validator's surface area shrinks.

3. **The "Execute the intent described in the attached document" phrasing** is itself a meta-recursive directive. The system prompt explicitly admits this with "A short one-liner that references a 100-page spec is a thorough intent". That instruction is correct in spirit but produces a semantic loophole: the agent uses it to justify accepting *any* attached document as-is. Worth raising with the upstream prompt author whether the rule should require the agent to additionally check that the referenced spec is itself complete enough to constitute a substantive intent. Deferred.

4. **Phase-2 and Phase-3 specification by competitor reference** (Appendix "ServiceTitan", Appendix "Vantaca") is the most operationally consequential coherence defect in this sample, yet it sits in a grey zone: the system prompt does not explicitly enumerate "specification-by-competitor-reference" as a coherence flag. `coherence_evidence_audit` lists it in its catalogue (§4.5). Validate against a second sample whether this catalogue entry over-fires on legitimate "modeled after" language. Deferred.

5. **`system_proposal_offered_for` semantics on `pass`.** The system prompt only describes this field's content under `requires_input`. The agent emitted `[]` on `pass`, which is reasonable but undefined. `contract_schema_iqc` currently allows empty array on any status; `status_consistency_iqc` only enforces non-empty when `overall_status == "requires_input"`. Confirm with prompt author.

6. **Reviewer-model sizing.** The current gemma4:e4b reviewer was demonstrably under-sensitive across two distinct failure modes (FR/NFR measurement defects in the reference doc; thinking-chain backtrack defects here). Even a well-decomposed pipeline will under-perform on this size class. The pipeline above is necessary but probably not sufficient without a step up in reviewer model capability for the LLM-based validators (3-6).
