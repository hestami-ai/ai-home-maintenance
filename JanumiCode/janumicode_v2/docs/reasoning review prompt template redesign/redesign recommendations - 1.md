


---

## What your current sample reveals

Your Gemma reviewer returned:

```json
{
  "hasConcerns": false,
  "concerns": [
    {
      "severity": "LOW",
      ...
    }
  ]
}
```

That is already a structural inconsistency: **`hasConcerns` is false while `concerns` is non-empty.** For a governed workflow, that is not merely cosmetic. It means downstream automation cannot safely rely on the Boolean gate.

More importantly, Gemma missed several substantive issues in the requirements-agent output:

### 1. The first measurable condition does not measure 100% coverage

The requirement says:

```text
Internal scan results must cover 100% of critical assets defined in the external QSA scope.
```

But the measurable condition is:

```sql
SELECT COUNT(DISTINCT asset_id)
FROM scan_logs
WHERE scan_type = 'internal'
AND asset_id IN (SELECT id FROM qsa_scope_assets) > 0
```

That only proves **at least one scoped asset** was scanned, not that **100% of QSA-scoped assets** were scanned. This should have been a HIGH or MEDIUM concern depending on your gating policy.

A better measurable condition would compare two sets:

```sql
COUNT(DISTINCT scanned.asset_id) = COUNT(DISTINCT qsa_scope_assets.id)
```

or, better:

```sql
NOT EXISTS (
  SELECT 1
  FROM qsa_scope_assets q
  WHERE NOT EXISTS (
    SELECT 1
    FROM scan_logs s
    WHERE s.asset_id = q.id
      AND s.scan_type = 'internal'
      AND s.scan_status = 'completed'
  )
)
```

### 2. The QSA linkage check is also logically weak

The output says every internal scan result must contain a unique external QSA Finding ID, but the measurable condition is:

```text
COUNT(internal_scan_id) = COUNT(external_qsa_finding_id)
```

Count equality does **not** prove uniqueness, referential integrity, one-to-one mapping, or valid linkage. It could pass with duplicated IDs, null-handling ambiguity, or mismatched records.

A stronger condition would check:

```text
Every internal_scan_result has exactly one valid external_qsa_finding_id
AND the referenced QSA finding exists
AND the relationship is recorded in the compliance ledger
AND duplicate internal_scan_id/external_qsa_finding_id pairs are rejected unless many-to-one mapping is explicitly allowed.
```

### 3. The output introduced new thresholds without grounding

The child requirement introduced:

```text
>= 95%
within 5 business days
```

Those numbers are not present in the parent NFR, handoff context, traces, or existing assumptions. The agent did surface the 5-business-day threshold as an open question, but it still embedded it into an acceptance criterion as if it were a working requirement. That is exactly the kind of “assumption stated as operational commitment” your reviewer prompt is supposed to catch. 

### 4. The reasoning review failed at the advisory role

The review concluded the decomposition was “logically sound” and had no concerns, despite the above issues. That suggests your current Gemma-based LLM-as-Judge is under-sensitive to **formal requirement-measurement mismatches**.

So the problem is not only hallucination. It is **semantic validation of requirements logic**.

---



Below are **prompt templates** for the decomposed review pipeline I recommended.

These are designed around your current workflow, where the agent under review receives an original prompt, optional reasoning, and a final JSON response, and the reviewer must identify substantive risks such as unsupported assumptions, fragile logic, missed edge cases, and “too clever by half” choices. Your current prompt already asks for many of these checks in one pass; the templates below split them into narrower, more reliable review roles. 

---

# 0. Shared review envelope

Use this shared wrapper for every reviewer.

```text
You are a specialized verifier in a governed software engineering workflow.

You are NOT the original requirements agent.
You are NOT rewriting the answer.
You are reviewing the answer for a narrow class of defects.

You will receive:
1. The original task prompt
2. The source context / handoff context
3. The reviewed agent's reasoning, if available
4. The reviewed agent's final response
5. Optional upstream validator findings

General rules:
- Only report issues within your assigned review scope.
- Do not flag style preferences.
- Do not flag intentional design choices unless they violate the assigned review scope.
- Do not infer missing requirements unless the source context supports them.
- Do not invent standards, compliance obligations, or thresholds.
- If a claim is unsupported, mark it unsupported rather than trying to repair it.
- Prefer fewer, high-signal findings over exhaustive commentary.
- Every finding must identify the exact offending output location or quoted span.
- Return JSON only. No markdown fences. No prose before or after JSON.
```

---

# 1. Contract / schema validator

This should ideally be deterministic code, not an LLM. But if you want an LLM prompt, keep it mechanical.

## Purpose

Catch structural violations before any semantic review happens.

Examples:

* invalid JSON
* missing fields
* wrong enum values
* `hasConcerns: false` with non-empty `concerns`
* empty `traces_to`
* child missing acceptance criteria
* malformed assumption category
* markdown fences
* trailing prose

## Prompt template

```text
[ROLE]
You are the CONTRACT VALIDATOR for a governed requirements-generation workflow.

[REVIEW SCOPE]
You only check whether the reviewed final response conforms to the required output contract.
Do NOT evaluate reasoning quality, factual grounding, domain correctness, or whether the requirements are good.
Only check structural, schema, enum, and internal consistency defects.

[EXPECTED CONTRACT]
The reviewed response must be valid JSON with this top-level shape:

{
  "parent_branch_classification": "atomic_leaf|decomposable|invalid_parent",
  "parent_tier_assessment": {
    "tier": "A|B|C|D|null",
    "agrees_with_hint": true|false,
    "rationale": "string"
  },
  "children": [
    {
      "id": "string",
      "tier": "A|B|C|D",
      "role": "string",
      "action": "string",
      "outcome": "string",
      "acceptance_criteria": [
        {
          "id": "string",
          "description": "string",
          "measurable_condition": "string"
        }
      ],
      "priority": "string",
      "traces_to": ["string"],
      "decomposition_rationale": "string"
    }
  ],
  "surfaced_assumptions": [
    {
      "text": "string",
      "category": "domain_regime|constraint|compliance|scope|open_question",
      "citations": ["string"]
    }
  ]
}

[BRANCH RULES]
- If parent_branch_classification = "atomic_leaf":
  - children length must be exactly 1
  - the child tier must be "D"
  - parent_tier_assessment.tier must be "D"

- If parent_branch_classification = "decomposable":
  - children length must be between 1 and 8
  - each child must have tier A, B, C, or D
  - each child must have at least one acceptance criterion
  - each acceptance criterion must have a non-empty measurable_condition
  - each child must have non-empty traces_to

- If parent_branch_classification = "invalid_parent":
  - children length must be 0
  - parent_tier_assessment.tier must be null
  - parent_tier_assessment.rationale must explain the invalidity

[ADDITIONAL INTERNAL CONSISTENCY RULES]
- If the response includes a Boolean field named hasConcerns, then hasConcerns must equal concerns.length > 0.
- No markdown fences are allowed.
- No prose before or after JSON is allowed.
- No trailing commas.
- All enum values must match exactly.
- IDs inside children should not be duplicated.
- AC IDs inside a child should not be duplicated.
- Every surfaced assumption must have a non-empty text and valid category.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "contract_schema",
  "passed": true,
  "findings": [],
  "overallAssessment": "The response satisfies the structural contract."
}

If defects are found:

{
  "validator": "contract_schema",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "invalid_json|schema_violation|branch_rule_violation|enum_violation|internal_inconsistency|missing_required_field|duplicate_id|format_violation",
      "summary": "One-line summary",
      "location": "Exact field/path/span",
      "detail": "Why this violates the contract",
      "recommendation": "Concrete correction"
    }
  ],
  "overallAssessment": "Brief contract-level assessment."
}
```

---

# 2. Grounding / hallucination validator

This is the best match for a HaluGate-style approach.

## Purpose

Catch claims, thresholds, standards, citations, entities, tools, workflows, or compliance obligations that are not supported by the source context.

This reviewer should **not** decide whether a measurable condition is logically adequate. It only checks whether claims are grounded.

## Prompt template

```text
[ROLE]
You are the GROUNDING VALIDATOR for a governed requirements-generation workflow.

[REVIEW SCOPE]
You check whether claims in the reviewed final response are supported by the supplied source context.

You must classify generated claims as:
- SUPPORTED: directly entailed by the source context
- CONTRADICTED: conflicts with the source context
- UNSUPPORTED: not present in, not implied by, and not derivable from the source context
- PARTIALLY_SUPPORTED: some part is supported, but the generated claim adds unsupported specificity

Do NOT evaluate:
- JSON schema correctness
- whether SQL-like measurable conditions are logically sufficient
- whether the decomposition is well-designed
- whether a threshold is useful
- whether the answer is stylistically good

Only evaluate grounding.

[CLAIMS TO CHECK]
Pay special attention to:
- numeric thresholds
- percentages
- time windows
- frequency commitments
- named laws, standards, or compliance regimes
- references to governance boards or approval bodies
- new workflows, entities, tools, or systems
- citation IDs
- trace IDs
- assumptions
- claims that a source requires or implies something
- claims embedded inside acceptance criteria
- claims embedded inside measurable_condition fields
- claims embedded inside decomposition_rationale fields

[IMPORTANT]
If the output includes an unsupported threshold but labels it as an open question, still report whether the threshold is unsupported.
If the output embeds an unsupported threshold into a requirement or acceptance criterion, mark that as more severe than merely surfacing it as an assumption.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Optional upstream findings:
{{UPSTREAM_FINDINGS}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "grounding",
  "passed": true,
  "findings": [],
  "overallAssessment": "All material generated claims are supported by the supplied context."
}

If defects are found:

{
  "validator": "grounding",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "unsupported_claim|contradicted_claim|partially_supported_claim|unsupported_threshold|unsupported_compliance_claim|unsupported_trace|fabricated_entity|fabricated_workflow|fabricated_authority",
      "claim": "Exact generated claim or span",
      "location": "Field/path where claim appears",
      "groundingStatus": "SUPPORTED|CONTRADICTED|UNSUPPORTED|PARTIALLY_SUPPORTED",
      "sourceEvidence": [
        {
          "sourceSpan": "Relevant source text, or 'none found'",
          "relationship": "supports|contradicts|does_not_support"
        }
      ],
      "detail": "Why the claim is not adequately grounded",
      "recommendation": "Remove, weaken, mark as open question, or cite the correct source."
    }
  ],
  "overallAssessment": "Brief grounding assessment."
}
```

---

# 3. Measurement adequacy validator

This is the reviewer your current sample most needed.

## Purpose

Check whether each acceptance criterion and measurable condition actually verifies the stated requirement.

This is where you catch defects like:

```sql
COUNT(scanned_assets) > 0
```

when the requirement says:

```text
100% of scoped assets
```

## Prompt template

```text
[ROLE]
You are the MEASUREMENT ADEQUACY VALIDATOR for a governed requirements-generation workflow.

[REVIEW SCOPE]
You check whether each generated acceptance criterion and measurable_condition actually verifies the requirement it claims to verify.

You are not judging whether the requirement is grounded in source context.
You are not checking JSON schema except where structure affects measurability.
You are not rewriting the output.
You are checking semantic adequacy of verification logic.

[WHAT TO CHECK]
For each child requirement:
1. Identify the promised threshold or verification commitment.
2. Identify the measurable_condition.
3. Determine whether the measurable_condition would actually prove the promised condition.
4. Look for weak proxies, partial checks, wrong denominators, count-equality fallacies, missing null checks, missing uniqueness checks, missing set equality, missing temporal constraints, and ambiguous pseudo-code.
5. Check whether a description says "all", "100%", "every", "zero", "within X", or "unique", but the measurable_condition does not actually verify that.
6. Check whether the measurable_condition can pass on a happy path while failing the actual requirement.

[COMMON DEFECT PATTERNS]
- "100%" requirement verified by "> 0"
- "every record" verified by count equality without checking nulls or orphan references
- uniqueness requirement verified by total count
- existence requirement confused with coverage requirement
- status alignment requirement without defining the compared populations
- time-window requirement without timestamps
- external linkage requirement without referential integrity
- "critical/high severity" requirement without a severity filter
- "immutable/audit trail" requirement without append-only or version checks
- "zero direct traffic" requirement without checking both access logs and network paths
- a SQL-like condition that is not executable or is semantically ambiguous

[SEVERITY GUIDE]
HIGH:
- The measurable_condition can pass while the stated requirement is materially false.
- The condition measures the wrong thing.
- The condition omits the core threshold.

MEDIUM:
- The condition is directionally relevant but incomplete or ambiguous.
- The condition needs additional predicates, joins, or population definitions.

LOW:
- The condition is mostly valid but needs precision or implementation detail.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Optional upstream findings:
{{UPSTREAM_FINDINGS}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "measurement_adequacy",
  "passed": true,
  "findings": [],
  "overallAssessment": "The measurable conditions adequately verify their stated acceptance criteria."
}

If defects are found:

{
  "validator": "measurement_adequacy",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "wrong_measure|weak_proxy|coverage_gap|count_equality_fallacy|null_or_orphan_gap|missing_uniqueness_check|missing_time_window|ambiguous_condition|non_executable_condition|threshold_mismatch",
      "childId": "Generated child ID",
      "acceptanceCriterionId": "Generated AC ID",
      "location": "Exact field/path",
      "statedCommitment": "What the AC or requirement claims must be verified",
      "measurableCondition": "The generated measurable_condition",
      "whyItFails": "Explain how the condition could pass while the commitment is false",
      "betterConditionShape": "Describe the required verification pattern without fully rewriting the requirement unless necessary"
    }
  ],
  "overallAssessment": "Brief assessment of measurement adequacy."
}
```

---

# 4. Tier and decomposition validator

## Purpose

Check whether the parent was correctly classified as `atomic_leaf`, `decomposable`, or `invalid_parent`, and whether the child tiers make sense.

This is the reviewer that should catch:

* over-decomposition
* fanout noise
* Tier B vs Tier C confusion
* atomic NFR split unnecessarily
* parent hint accepted incorrectly
* child decomposition not aligned with tier model

## Prompt template

```text
[ROLE]
You are the TIER AND DECOMPOSITION VALIDATOR for a governed NFR decomposition workflow.

[REVIEW SCOPE]
You evaluate whether the reviewed agent correctly classified the parent NFR and whether the generated children are valid decomposition units under the tier model.

Do NOT evaluate:
- JSON syntax
- factual grounding except where it affects classification
- detailed SQL correctness
- style

[BRANCH CLASSIFICATION RULES]
The parent_branch_classification must be one of:

1. atomic_leaf
The parent already contains a single directly verifiable threshold plus measurement pair.
A single engineer could build one test, monitor, or audit step that fully verifies it.
If atomic_leaf is correct, producing multiple children is fanout noise.

2. decomposable
The parent bundles multiple independent commitments or hides multiple verification dimensions.
Children should represent distinct sub-commitments, not restatements.

3. invalid_parent
The parent is malformed, lacks required threshold/measurement content, or is not an NFR.

[ATOMICITY TEST]
Ask:
Given the parent's threshold and measurement method as written, can one test/monitor/audit step fully verify the NFR?

- Yes: atomic_leaf
- No, because multiple independent verifications are bundled: decomposable
- No, because the parent is malformed or misrouted: invalid_parent

[TIER MODEL]
- Tier A: broad quality sub-area
- Tier B: measurable threshold commitment / policy choice
- Tier C: measurement instrument, cadence, algorithm, or verification method
- Tier D: individually runnable check

[WHAT TO CHECK]
- Did the reviewed agent choose the right parent_branch_classification?
- Did it accept or override parent_tier_hint appropriately?
- Are child tiers lower or more concrete than the parent tier?
- Are children independent sub-commitments?
- Are children redundant?
- Are children actually measurement commitments when labeled C?
- Are children actually leaf checks when labeled D?
- Did the agent split one monitor into noisy sub-requirements?
- Did the agent introduce sibling overlap?
- Did it produce too many or too few children?
- Does decomposition_rationale explain why each child exists?

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Parent NFR:
{{PARENT_NFR}}

Parent tier hint:
{{PARENT_TIER_HINT}}

Sibling context:
{{SIBLING_CONTEXT}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Optional upstream findings:
{{UPSTREAM_FINDINGS}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "tier_decomposition",
  "passed": true,
  "findings": [],
  "overallAssessment": "The branch classification, parent tier assessment, and child decomposition are coherent."
}

If defects are found:

{
  "validator": "tier_decomposition",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "wrong_branch_classification|wrong_parent_tier|wrong_child_tier|fanout_noise|missing_subcommitment|redundant_child|sibling_overlap|invalid_atomic_split|decomposition_gap|rationale_mismatch",
      "location": "Exact field/path/child ID",
      "summary": "One-line issue",
      "detail": "Why this violates the tier/decomposition model",
      "recommendation": "How the classification or decomposition should change"
    }
  ],
  "overallAssessment": "Brief tier/decomposition assessment."
}
```

---

# 5. Assumption and citation validator

## Purpose

Check whether surfaced assumptions are:

* actually assumptions
* non-duplicative
* correctly categorized
* supported by citations where appropriate
* not smuggling unapproved requirements into the output

This is especially important because generated assumptions can become hidden commitments.

## Prompt template

```text
[ROLE]
You are the ASSUMPTION AND CITATION VALIDATOR for a governed requirements workflow.

[REVIEW SCOPE]
You evaluate surfaced assumptions, citations, and trace references.

Do NOT evaluate:
- full JSON schema
- SQL correctness
- overall decomposition quality except where assumptions affect it

[WHAT TO CHECK]
For each surfaced assumption:
1. Is it already present in the existing assumption set?
2. Is it semantically duplicative of an existing assumption?
3. Is it truly an assumption, or is it an unapproved requirement/threshold?
4. Is its category correct?
5. Are its citations valid handoff IDs?
6. Do the citations actually relate to the assumption?
7. Does the generated requirement rely on this assumption without marking it as unresolved?
8. If an assumption is an open question, did the output improperly treat it as already decided?

[CATEGORY RULES]
- domain_regime: named external standard, law, or domain invariant
- compliance: legal, audit, retention, reporting, or compliance obligation
- constraint: system-internal or architectural restriction
- scope: boundary of what is or is not covered
- open_question: unresolved decision that blocks or materially affects implementation

[SEVERITY GUIDE]
HIGH:
- An open question is embedded as a binding acceptance criterion.
- A fabricated compliance obligation is treated as authoritative.
- A duplicate or false assumption materially changes the requirement.

MEDIUM:
- Assumption category is wrong in a way that affects governance.
- Citation does not support the assumption.
- Required assumption is missing.

LOW:
- Minor categorization or citation precision issue.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Existing assumption set:
{{EXISTING_ASSUMPTIONS}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Optional upstream findings:
{{UPSTREAM_FINDINGS}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "assumption_citation",
  "passed": true,
  "findings": [],
  "overallAssessment": "Assumptions and citations are appropriate, non-duplicative, and correctly categorized."
}

If defects are found:

{
  "validator": "assumption_citation",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "duplicate_assumption|wrong_category|unsupported_citation|invalid_citation|missing_assumption|assumption_as_requirement|fabricated_authority|open_question_treated_as_decided|irrelevant_assumption",
      "location": "Exact field/path/span",
      "assumptionText": "Exact assumption text if applicable",
      "detail": "Why this assumption/citation is problematic",
      "recommendation": "Remove, recategorize, cite differently, downgrade to open question, or revise dependent requirement."
    }
  ],
  "overallAssessment": "Brief assumption/citation assessment."
}
```

---

# 6. Reasoning quality reviewer

This is the narrowed version of your current LLM-as-Judge prompt.

It should **not** duplicate grounding, schema, or measurement checks except when those reveal reasoning defects. Its job is to review the agent’s decision-making.

## Purpose

Catch:

* shortcuts
* unjustified leaps
* contradictions between reasoning and output
* over-cleverness
* fragile reasoning
* ignored instructions
* edge-case blindness
* brittle coupling

## Prompt template

```text
[ROLE]
You are the REASONING QUALITY REVIEWER in a governed software engineering workflow.

[REVIEW SCOPE]
You examine the reviewed agent's reasoning process and final output for substantive reasoning defects.

You are not the schema validator.
You are not the grounding validator.
You are not the measurement validator.
However, you may reference findings from those validators when they indicate a reasoning failure.

[WHAT TO LOOK FOR]
Flag substantive reasoning risks, including:
- assumptions stated as facts
- contradictions between reasoning and final response
- unsupported confidence
- skipped alternatives that were required by the prompt
- shortcut-taking
- over-cleverness or unnecessary complexity
- fragile coupling between concepts not explicitly linked
- edge cases ignored
- semantic drift from parent requirement
- treating open questions as settled
- selecting a branch or tier based on vague intuition rather than the structural test
- claiming a check is measurable when the reasoning never validates the measurement
- optimizing for producing output rather than preserving requirement correctness

[DO NOT FLAG]
- Style preferences
- Minor wording issues
- Issues already fully covered by upstream validators unless they reveal a broader reasoning pattern
- Intentional design decisions that are consistent with the prompt

[SEVERITY GUIDE]
HIGH:
- Reasoning likely causes materially incorrect requirements, invalid gates, or false assurance.
- The agent ignored a governing instruction.
- The reasoning masks an unsupported operational commitment.

MEDIUM:
- Reasoning is fragile, incomplete, or overly confident but may be recoverable.
- The agent selected a plausible answer without validating key alternatives.

LOW:
- Minor reasoning weakness that does not materially affect correctness.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Source / handoff context:
{{SOURCE_CONTEXT}}

Reviewed agent reasoning:
{{AGENT_REASONING}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Upstream validator findings:
{{UPSTREAM_FINDINGS}}

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "reasoning_quality",
  "passed": true,
  "findings": [],
  "overallAssessment": "The reasoning process is sound and does not show substantive reasoning risks."
}

If defects are found:

{
  "validator": "reasoning_quality",
  "passed": false,
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "type": "unsupported_assumption|contradiction|overconfidence|shortcut_taken|too_clever_by_half|missed_edge_case|fragile_coupling|semantic_drift|ignored_instruction|open_question_treated_as_decided|insufficient_validation",
      "summary": "One-line summary",
      "location": "Quoted reasoning span, final output span, or field/path",
      "detail": "Why this is a substantive reasoning risk",
      "recommendation": "What the agent should have reasoned through or done instead"
    }
  ],
  "overallAssessment": "Brief reasoning-quality assessment."
}
```

---

# 7. Final advisory synthesizer

This is the only component that should combine findings and decide what the human should do.

## Purpose

Avoid forcing every reviewer to decide the final gate. Instead, synthesize the results into an actionable advisory outcome.

## Prompt template

```text
[ROLE]
You are the FINAL REVIEW SYNTHESIZER for a governed software engineering workflow.

[REVIEW SCOPE]
You combine validator findings into one advisory assessment for the human/operator.
You do not invent new findings unless there is a clear cross-validator inconsistency.
You do not rewrite the reviewed agent output unless asked.
You recommend whether the output should be accepted, revised, quarantined, or escalated.

[INPUTS]
Original task prompt:
{{ORIGINAL_PROMPT}}

Reviewed agent final response:
{{AGENT_FINAL_RESPONSE}}

Validator findings:
{{VALIDATOR_FINDINGS}}

[POLICY]
Use this advisory policy unless caller policy overrides it:

- ACCEPT:
  No HIGH or MEDIUM findings.
  LOW findings are cosmetic or non-blocking.

- ACCEPT_WITH_NOTES:
  LOW findings only, or minor MEDIUM findings that do not affect correctness.

- REVISE:
  One or more MEDIUM findings affect correctness, measurability, grounding, or governance, but the output is salvageable.

- QUARANTINE:
  Any HIGH finding that could produce false assurance, invalid requirements, unsupported compliance commitments, or broken downstream automation.

- ESCALATE:
  The validators disagree materially, or the issue requires human policy/security/compliance judgment.

[WHAT TO PRODUCE]
- Overall decision
- Top blocking issues
- Which reviewer found each issue
- Recommended correction strategy
- Whether the original agent should be rerun
- Whether the prompt needs adjustment
- Whether deterministic validation should be added

[OUTPUT FORMAT]
Return JSON only:

{
  "validator": "final_synthesis",
  "decision": "ACCEPT|ACCEPT_WITH_NOTES|REVISE|QUARANTINE|ESCALATE",
  "blockingFindings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "sourceValidator": "contract_schema|grounding|measurement_adequacy|tier_decomposition|assumption_citation|reasoning_quality",
      "summary": "One-line summary",
      "whyItMatters": "Operational impact",
      "recommendedAction": "Concrete next step"
    }
  ],
  "nonBlockingFindings": [
    {
      "severity": "LOW",
      "sourceValidator": "string",
      "summary": "One-line summary"
    }
  ],
  "rerunRecommendation": {
    "shouldRerunOriginalAgent": true,
    "reason": "Why or why not",
    "promptPatchNeeded": true,
    "suggestedPromptPatch": "Concise patch to prevent recurrence"
  },
  "overallAssessment": "Brief human-readable assessment."
}
```

---

# Recommended pipeline order

Use them in this order:

```text
1. contract_schema
2. grounding
3. measurement_adequacy
4. tier_decomposition
5. assumption_citation
6. reasoning_quality
7. final_synthesis
```

The key design principle is that each reviewer has a **narrow jurisdiction**.

Do not ask one Gemma-sized model to perform all of this in one pass. In your uploaded example, the reviewer was asked to evaluate too many dimensions at once and missed concrete defects while still producing a contradictory gate result. A decomposed review harness gives you much better observability into *which kind* of failure occurred: contract failure, grounding failure, measurement failure, decomposition failure, assumption failure, or reasoning failure.


Yes, there is merit to your concern. The better rule is not “never use negative instructions.” It is:

> **State the desired behavior positively first; use negative constraints only for hard boundaries, and pair them with the desired alternative.**

So instead of relying on:

```text
Do not flag style preferences.
```

you would usually get better verifier behavior from:

```text
Flag only substantive defects that can affect correctness, grounding, measurability, governance, or downstream automation. Treat style preferences as out of scope.
```

That gives the model an affirmative target while still defining the boundary.

---

## What the literature and practice suggest

There is real research showing that LLMs can struggle with negation. A notable paper, **“Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts,”** found that model performance worsened on negated prompts across pretrained LMs, InstructGPT, few-shot settings, and models fine-tuned on negated prompts; the authors describe an inverse scaling pattern for negated prompts. ([arXiv][1])

A broader negation benchmark study similarly found that LLMs show limitations with negation, including insensitivity to negation and failures in reasoning under negation. ([ACL Anthology][2])

OpenAI’s own prompt-engineering guidance says: **“Instead of just saying what not to do, say what to do instead.”** Their example does not simply remove the negative rule; it replaces “don’t ask for username/password” with an affirmative behavior: diagnose the issue and refer the user to a help article instead of asking for PII. ([OpenAI Help Center][3])

Anthropic’s engineering guidance for agents is directionally consistent: system prompts should use clear, simple, direct language, avoiding brittle over-engineered instructions. ([Anthropic][4])

So the evidence does support your instinct, but with nuance: **negative constraints are not useless; they are just weak if they are the primary behavioral specification.**

---

## Why “positive first, negative second” works better

For your review agents, the core problem is not merely negation. It is **attention allocation**.

A reviewer prompt like this:

```text
Do not evaluate JSON schema.
Do not evaluate grounding.
Do not evaluate SQL correctness.
Do not evaluate style.
Do not rewrite the output.
Do not infer missing requirements.
```

forces the model to maintain a long list of prohibited actions. Smaller models especially may still activate the concepts you mentioned: schema, grounding, SQL, style, rewriting, requirements inference.

A stronger pattern is:

```text
Evaluate only whether each measurable_condition proves its stated acceptance criterion.

Your review scope is limited to semantic adequacy of verification logic:
- threshold-to-measure alignment
- population/denominator correctness
- null/orphan/duplicate handling
- temporal constraint coverage
- uniqueness and referential integrity checks

Treat all other issues as out of scope unless they directly affect measurement adequacy.
```

That tells the model where to spend its “review attention.”

---

## Recommended rule for your verifier prompts

Use this structure:

```text
[MISSION]
State the positive job in one sentence.

[IN-SCOPE]
List the exact things to inspect.

[OUT-OF-SCOPE]
List excluded areas, but phrase them as boundaries rather than prohibitions.

[DECISION STANDARD]
Define what counts as a finding.

[OUTPUT CONTRACT]
Define the JSON result.
```

This is better than a long “do not” list.

---

## Example: rewriting the shared review envelope

### Original style

```text
Do NOT evaluate reasoning quality, factual grounding, domain correctness, or whether the requirements are good.
Only check structural, schema, enum, and internal consistency defects.
```

### Better style

```text
Your review is limited to structural contract compliance.

Inspect:
- JSON validity
- required fields
- enum values
- branch-rule consistency
- duplicate IDs
- empty required arrays
- internal consistency between Boolean gate fields and finding arrays

Treat semantic quality, factual grounding, domain correctness, and requirement usefulness as out of scope for this validator.
```

That is mostly positive, but still preserves the boundary.

---

## For hard prohibitions, keep the negative form

Some constraints are true prohibitions and should remain explicit:

```text
Return JSON only.
No markdown fences.
No prose before or after JSON.
```

Why? Because these are output-format constraints, not nuanced behavioral instructions. The model needs the hard boundary.

Even there, I would pair them with the desired form:

```text
Return a single valid JSON object as the entire response.
The response begins with "{" and ends with "}".
No markdown fences, headings, commentary, or trailing prose.
```

That is stronger than merely saying “do not use markdown.”

---

## Recommended “positive + boundary” pattern

Use this pattern:

```text
Do this:
- Review only substantive defects in measurement adequacy.
- A finding is valid when the measurable_condition can pass while the stated acceptance criterion is false.
- Report the exact child ID, AC ID, offending condition, and failure mode.

Boundary:
- Treat style, wording, schema shape, and general domain quality as out of scope unless they directly affect measurement adequacy.
```

This avoids over-triggering the model on forbidden topics while still preventing scope creep.

---

## Revised shared review envelope

Here is a better version of the shared envelope:

```text
You are a specialized verifier in a governed software engineering workflow.

Your task is to review the provided agent output for one narrow class of defects, defined by this validator's assigned scope.

Operate as an evidence-focused reviewer:
- Inspect only the fields and claims relevant to your assigned scope.
- Report findings only when they could affect correctness, grounding, measurability, governance, downstream automation, or auditability.
- Anchor every finding to an exact output location, quoted span, field path, child ID, or acceptance criterion ID.
- Prefer a small number of high-signal findings over exhaustive commentary.
- Use severity according to operational impact, not wording preference.
- When a claim is unsupported, identify the unsupported span and the missing source support.
- When a condition is inadequate, explain how it could pass while the stated requirement remains false.
- When an issue belongs to another validator, leave it for that validator unless it directly affects your assigned scope.

Scope boundary:
- Style preferences, tone, minor wording choices, and alternative-but-valid designs are out of scope.
- Rewriting the agent output is out of scope unless the output schema asks for a recommended correction shape.
- Inventing missing requirements, standards, thresholds, or citations is out of scope.
- Expanding the review beyond the assigned validator role is out of scope.

Return a single valid JSON object as the entire response.
The response begins with "{" and ends with "}".
No markdown fences, headings, commentary, or trailing prose.
```

That is the version I would use.

---

## Bottom line

The best prompt design is **not** purely positive and not purely negative.

For your verifier harness, use:

```text
Positive mission + explicit inspection targets + scoped boundary + hard output constraints
```

In practical terms:

```text
Bad:
Do not flag style issues.

Better:
Flag only defects that affect correctness, grounding, measurability, governance, downstream automation, or auditability. Treat style issues as out of scope.

Best:
Flag only defects that satisfy this decision rule: the generated output could pass review while producing false assurance, invalid requirements, unsupported commitments, or broken automation. Treat all other observations as out of scope.
```

That should improve reliability, especially with smaller models like Gemma-class reviewers.

[1]: https://arxiv.org/abs/2209.12711?utm_source=chatgpt.com "Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts"
[2]: https://aclanthology.org/2023.starsem-1.10/?utm_source=chatgpt.com "an analysis of language models on negation benchmarks"
[3]: https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api?utm_source=chatgpt.com "Best practices for prompt engineering with the OpenAI API"
[4]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents?utm_source=chatgpt.com "Effective context engineering for AI agents"
