# Prompt Template Issues Review

Review date: 2026-04-24

Scope: `janumicode_v2/.janumicode/prompts/**/*.md`

Purpose: systematic one-by-one review of prompt templates for prompt engineering, context engineering, intent engineering, and small-model robustness risks. This is a review document, not a patch plan. Findings are written so they can later be converted into deterministic validators, strong-model review rubrics, and DSPy calibration examples.

## Review Lens

Severity:

- `P0`: likely to cause invalid output, wrong downstream state, or unsafe execution.
- `P1`: likely to cause materially wrong or unstable semantic output.
- `P2`: likely to reduce quality, increase retries, or create evaluation ambiguity.
- `P3`: cleanup, consistency, or maintainability improvement.

Common issue tags:

- `schema_contract`: output shape, JSON validity, field constraints.
- `context_priority`: unclear grounding order or too much undifferentiated context.
- `intent_boundary`: unclear role/task boundary or agent asked to do multiple jobs.
- `small_model`: high cognitive load, long rule stack, or branch ambiguity for 9B-class models.
- `traceability`: weak ID, citation, provenance, or source preservation rules.
- `validation_gap`: rule should be deterministic post-validation rather than prompt-only.
- `prompt_template`: reusable-template concern rather than one invocation concern.

## Cross-Cutting Findings

1. Many templates rely on prose-only compliance with strict JSON rules. This should be paired with deterministic validators for JSON parse, schema conformance, enums, required fields, citation IDs, trace IDs, and no-prose/no-fence output.

2. Several templates combine broad generation, source extraction, traceability, dedupe, schema formatting, and self-validation in one prompt. Smaller models need an explicit decision pipeline: classify task branch, select branch-specific rules, generate, then validate.

3. Context is often presented as a flat block. Prompts should distinguish `primary_source`, `direct_context`, `sibling_context`, `existing_artifacts`, and `fallback_context`, with rules for when each may be used.

4. Prompt templates with examples inside markdown fences sometimes also require "no markdown fences" in the output. This is acceptable but should be standardized as "examples below are illustrative; final response must not include fences."

5. Traceability and source preservation rules are strong in many Phase 1 and Phase 2 templates, but they are uneven in later phases. Later-phase prompts often say "match schema" but provide fewer explicit preservation and coverage rules.

6. Repeated JSON-contract language should be centralized into a shared snippet to avoid drift. The longer templates already include good anti-failure-mode language for unescaped quotes; shorter templates often do not.

7. Any prompt asking for "review" should output a machine-actionable failure taxonomy, not just prose findings. This will support automated calibration and DSPy metrics.

8. Prompts should separate model responsibilities from orchestrator responsibilities. Where deterministic assignment, validation, or carry-forward behavior is performed by the caller, the prompt should explicitly forbid regenerating that material.

## Prompt-by-Prompt Review

### 1. `cross_cutting/client_liaison_query_classification.system.md`

Severity: `P2`

Tags: `schema_contract`, `small_model`, `validation_gap`

Findings:

- The eight-way classification task is appropriate, but query-type boundaries should include precedence rules for mixed queries. Human input often blends workflow initiation, status request, correction, and clarification.
- The prompt should require a confidence score and a short disambiguation reason if the top two labels are close.
- Back-end routing capabilities are included, but the prompt should state whether unsupported requests should be classified by intent or by available capability.
- Add deterministic validation for enum-only query type, required fields, and no invented capability IDs.

Recommended optimization:

- Add a "classification precedence" table and a "mixed intent" rule.
- Convert ambiguous cases into calibration examples.

### 2. `cross_cutting/client_liaison_synthesis.system.md`

Severity: `P1`

Tags: `context_priority`, `traceability`, `intent_boundary`, `small_model`

Findings:

- The prompt must synthesize user-facing answers while honoring DMR completeness, contradictions, supersession chains, active constraints, and open questions. This is a high cognitive-load synthesis task.
- Provenance rules are good, but the prompt should define claim granularity: which statements require citations and which conversational transitions do not.
- Contradiction handling is underspecified for conflict resolution. It says not to silently pick a winner, but should prescribe when to answer partially, when to block, and when to ask a follow-up.
- Conversation history can overpower retrieved records unless context priority is explicit.

Recommended optimization:

- Add answer modes: `answer`, `partial_answer`, `blocked_by_contradiction`, `needs_clarification`.
- Require each substantive paragraph to cite at least one record ID when relevant.

### 3. `cross_cutting/consistency_checker_semantic.system.md`

Severity: `P2`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- The task is clear, but the prompt is short for a semantic consistency checker. It should distinguish contradiction, tension, omission, duplicate, and terminology drift.
- "Specific artifacts involved" is required, but the output should require artifact IDs, quoted evidence, and severity.
- Add a rule to avoid flagging compatible abstraction differences as contradictions.

Recommended optimization:

- Define a finding taxonomy and require `artifact_ids`, `evidence`, `impact`, and `recommended_action`.

### 4. `cross_cutting/deep_memory_context_packet_synthesis.system.md`

Severity: `P1`

Tags: `traceability`, `context_priority`, `schema_contract`

Findings:

- The "every claim must cite source record IDs" rule is strong, but should be made schema-level: every summary item should carry `source_record_ids`.
- The prompt asks the model to be explicit about unknowns, but should distinguish `unknown`, `conflicting`, `out_of_scope`, and `not_retrieved`.
- Contradiction handling needs a deterministic resolution-status enum.

Recommended optimization:

- Add a coverage matrix: query target -> found evidence -> missing evidence -> contradiction status.

### 5. `cross_cutting/deep_memory_query_decomposition.system.md`

Severity: `P2`

Tags: `intent_boundary`, `context_priority`, `schema_contract`

Findings:

- Query decomposition is a good fit for a compact model, but the prompt should define retrieval target types and examples.
- It should separate lexical search terms, semantic search questions, filters, and exclusion criteria.
- Scope tier and requesting agent role are inputs, but the prompt should state how they constrain breadth and depth.

Recommended optimization:

- Add a fixed output shape with `must_retrieve`, `nice_to_have`, `filters`, and `avoid`.

### 6. `cross_cutting/domain_compliance_review.system.md`

Severity: `P1`

Tags: `intent_boundary`, `traceability`, `validation_gap`

Findings:

- Compliance review is high-risk. The prompt should explicitly prohibit inventing compliance regimes not provided in `compliance_regimes`.
- "Every finding must cite specific evidence" is good, but findings also need to cite the relevant compliance regime ID or text.
- The prompt should support `not_assessable` when evidence is insufficient.

Recommended optimization:

- Add verdict enum: `compliant`, `non_compliant`, `unclear`, `not_applicable`.
- Require compliance-source citation and artifact evidence separately.

### 7. `cross_cutting/eval_execution.system.md`

Severity: `P0`

Tags: `intent_boundary`, `schema_contract`, `validation_gap`

Findings:

- This prompt asks the agent to run an evaluation tool. In practice, tool execution should be orchestrator-owned and sandboxed, not left to prompt interpretation.
- The output contract says "after completing the tool execution" but does not define a strict JSON schema in the inventory signal.
- The prompt should distinguish executable command, expected artifact, observed output, pass/fail, and execution error.

Recommended optimization:

- Move command execution policy out of prompt text and into code.
- Require structured output with `executed`, `exit_code`, `stdout_excerpt`, `stderr_excerpt`, `measurement`, `passed`, and `error`.

### 8. `cross_cutting/ingestion_pipeline_stage3.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `small_model`

Findings:

- Relationship extraction is sensitive to false positives. The prompt lists allowed edge types, but should require evidence text for each edge.
- It should distinguish candidate edges from confirmed edges.
- Related record summaries may be insufficient to infer strong relationships; the prompt should allow `insufficient_evidence`.

Recommended optimization:

- Require `confidence`, `evidence`, and `edge_strength` for each relationship.

### 9. `cross_cutting/narrative_memory.system.md`

Severity: `P1`

Tags: `traceability`, `context_priority`, `schema_contract`

Findings:

- Anti-failure instructions are appropriate. The biggest risk is narrative compression dropping qualifiers, rejected alternatives, or conditional decisions.
- "Every substantive claim MUST cite a source_record_id" should be reflected in each output object, not only prose.
- The prompt should define how to handle approved artifacts with conflicting or superseded states.

Recommended optimization:

- Add sections for `approved_decisions`, `open_loops`, `superseded_items`, and `conditional_qualifiers`.

### 10. `cross_cutting/reasoning_review.system.md`

Severity: `P1`

Tags: `intent_boundary`, `schema_contract`, `validation_gap`

Findings:

- The prompt correctly notes that tool results are excluded. That limitation should force a verdict category like `cannot_assess_tool_result`.
- The failure taxonomy appears useful but should be standardized with the verification ensemble prompt.
- Evidence should include whether it came from trace or final output.
- This prompt is a good candidate for strong-model automated review and calibration-label creation.

Recommended optimization:

- Require `review_scope_limitations`.
- Emit machine-actionable failure labels and expected correction properties.

### 11. `cross_cutting/tier_c_ac_shape_audit.system.md`

Severity: `P1`

Tags: `small_model`, `schema_contract`, `validation_gap`

Findings:

- This prompt has strong structural rules but asks the model to classify ACs as `verification`, `policy`, or `ambiguous`. That is similar to the Phase 2 decomposition problem and should include branch-first decision logic.
- It should require exact references to child ID and AC ID for every finding.
- Advisory-only behavior is good, but it should include deterministic suggested follow-up: reclassify, split, prune, or leave.

Recommended optimization:

- Add examples of policy-shaped vs verification-shaped ACs from the current requirement domain.

### 12. `cross_cutting/unsticking_socratic_turn.system.md`

Severity: `P2`

Tags: `intent_boundary`, `small_model`

Findings:

- Single-question output is good and small-model friendly.
- The prompt should define when to ask about missing facts vs conflicting assumptions vs next action.
- It should prohibit compound questions; otherwise the "single focused question" can still contain multiple decisions.

Recommended optimization:

- Add one rule: "Ask about the highest-blocking unknown only."

### 13. `cross_cutting/unsticking_tool_result_review.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `validation_gap`

Findings:

- This is a necessary companion to reasoning review because it can see actual tool results.
- It should require direct comparison fields: `agent_claim`, `tool_result_evidence`, `discrepancy`.
- The correction text should be bounded and safe to inject; prohibit broad task redirection.

Recommended optimization:

- Add severity and confidence.
- Add `safe_stdin_directive` with a length cap.

### 14. `cross_cutting/verification_ensemble_secondary.system.md`

Severity: `P1`

Tags: `schema_contract`, `intent_boundary`, `validation_gap`

Findings:

- This overlaps strongly with reasoning review. The distinction between primary reasoning review and secondary verification ensemble should be explicit.
- Recommended actions include control-flow actions such as `return_to_phase4`; these should be validated against orchestrator state.
- Evidence fields should distinguish output evidence from prior-artifact evidence.

Recommended optimization:

- Share a common failure taxonomy with `reasoning_review.system.md`.
- Add action preconditions for each recommended action.

### 15. `cross_cutting/vocabulary_collision_check.system.md`

Severity: `P2`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- Collision detection should distinguish exact duplicate, near synonym, overloaded term, and conflicting definition.
- The prompt should require canonical term ID references and candidate term evidence.
- It should allow `no_collision` with rationale.

Recommended optimization:

- Add a normalized-term comparison field and deterministic slug-collision validator.

### 16. `phase_01_intent_capture/sub_phase_01_0_intent_quality_check/intent_quality_check.system.md`

Severity: `P2`

Tags: `schema_contract`, `intent_boundary`

Findings:

- Quality checking intent is useful, but the prompt should define the dimensions of quality: clarity, scope, actor, outcome, constraints, ambiguity, feasibility.
- It should not only flag weakness; it should identify whether the workflow may proceed, proceed with caveats, or must request clarification.
- Add confidence and blocking/non-blocking distinction.

Recommended optimization:

- Output `blocking_questions[]` separately from `quality_warnings[]`.

### 17. `phase_01_intent_capture/sub_phase_01_0a_intent_lens_classification/intent_lens_classification.system.md`

Severity: `P2`

Tags: `small_model`, `schema_contract`

Findings:

- Lens classification needs precedence rules for inputs that are both product-shaped and feature-shaped.
- The prompt should define exact labels and what downstream path each label triggers.
- Add ambiguity handling for multi-lens intents.

Recommended optimization:

- Require `primary_lens`, `secondary_lenses`, `confidence`, and `routing_reason`.

### 18. `phase_01_intent_capture/sub_phase_01_0b_intent_discovery/intent_discovery.product.system.md`

Severity: `P1`

Tags: `small_model`, `context_priority`, `schema_contract`, `traceability`

Findings:

- This is a long, high-value generation prompt. It asks for personas, journeys, phasing, vision, description, success metrics, UX, requirements, decisions, constraints, and open questions in one pass.
- The "silent pass" rule is useful, but the prompt needs stronger context priority and source preservation.
- For smaller models, this should be split or internally staged: extract source facts, classify facts, synthesize candidates, then validate schema.
- The JSON quote-failure guidance is strong and should be reused elsewhere.

Recommended optimization:

- Add "do not fill every array by force" guidance where empty or uncertain categories are valid.
- Introduce coverage expectations per section to avoid one-section dominance.

### 19. `phase_01_intent_capture/sub_phase_01_0c_technical_constraints_discovery/technical_constraints_discovery.product.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `intent_boundary`

Findings:

- The transcribe-not-design boundary is strong and appropriate.
- The slug rule is good but should be deterministic validated.
- The prompt should distinguish explicit technology choice, architectural constraint, operational constraint, and integration/protocol.
- It should reject inferred "best practices" unless source-backed.

Recommended optimization:

- Add `capture_type` enum and require exact source excerpt for each item.

### 20. `phase_01_intent_capture/sub_phase_01_0d_compliance_retention_discovery/compliance_retention_discovery.product.system.md`

Severity: `P1`

Tags: `traceability`, `intent_boundary`, `schema_contract`

Findings:

- The extract-not-interpret boundary is strong.
- Compliance vs requirement vs constraint can still blur. The prompt should include sharper examples for retention, notice, audit, jurisdiction, and derived implementation work.
- Source excerpts are mandatory, which is good.

Recommended optimization:

- Add `authority_level` or `source_strength`: explicit statute/regime, client-stated obligation, inferred operational need.

### 21. `phase_01_intent_capture/sub_phase_01_0e_vv_requirements_discovery/vv_requirements_discovery.product.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- The pass has a clear reason: mechanically verifiable targets. Good.
- The prompt should explicitly forbid turning vague quality wishes into precise thresholds unless the source states the threshold.
- It should allow capture of vague V&V candidates as `needs_quantification` rather than inventing numbers.

Recommended optimization:

- Add `measurement_specificity`: `explicit`, `partial`, `needs_quantification`.

### 22. `phase_01_intent_capture/sub_phase_01_0f_canonical_vocabulary_discovery/canonical_vocabulary_discovery.product.system.md`

Severity: `P2`

Tags: `traceability`, `schema_contract`, `validation_gap`

Findings:

- Good extraction boundary and source excerpt requirement.
- The prompt should distinguish canonical domain terms from generic product words.
- Slug generation should be post-validated.

Recommended optimization:

- Add exclusion examples: verbs, UI labels, generic nouns, implementation-only class names unless domain-significant.

### 23. `phase_01_intent_capture/sub_phase_01_1b_scope_bounding/scope_bounding.system.md`

Severity: `P2`

Tags: `schema_contract`, `intent_boundary`

Findings:

- The prompt is compact but may under-specify how to divide in-scope, out-of-scope, deferred, assumptions, and dependencies.
- It should require each scope item to cite a source or state that it is inferred.

Recommended optimization:

- Add `basis`: `explicit_source`, `inferred_from_goal`, `orchestrator_default`.

### 24. `phase_01_intent_capture/sub_phase_01_2_business_domains_bloom/business_domains_bloom.product.system.md`

Severity: `P1`

Tags: `small_model`, `schema_contract`, `traceability`, `context_priority`

Findings:

- The prompt asks for domain expansion plus persona refinement. This risks mixing domain taxonomy work with persona correction.
- Coverage rules are strong but can encourage over-generation.
- It should define when to preserve seed personas unchanged vs refine them.

Recommended optimization:

- Split output sections into `preserved_personas`, `refined_personas`, `new_personas`, and `domain_proposals`, or at least require `change_reason`.

### 25. `phase_01_intent_capture/sub_phase_01_2_intent_domain_bloom/intent_domain_bloom.feature.system.md`

Severity: `P2`

Tags: `schema_contract`, `intent_boundary`

Findings:

- Feature-shaped bloom rules are appropriate, especially requiring touched components and interaction-surface assumptions.
- The prompt should define how many candidates to produce and how diverse they should be.
- It should avoid overfitting to implementation if source is product-level.

Recommended optimization:

- Add candidate diversity dimensions: narrow implementation, broader workflow, integration impact.

### 26. `phase_01_intent_capture/sub_phase_01_2_intent_domain_bloom/intent_domain_bloom.product.system.md`

Severity: `P2`

Tags: `schema_contract`, `intent_boundary`

Findings:

- Product-shaped bloom is clear and requires persona and anti-goal assumptions.
- It should constrain speculation: product interpretations should be plausible from the intent, not arbitrary markets.
- Add a required "basis" field for every candidate.

Recommended optimization:

- Require candidates to explicitly list what source phrase triggered them.

### 27. `phase_01_intent_capture/sub_phase_01_2_intent_domain_bloom/intent_domain_bloom.system.md`

Severity: `P2`

Tags: `schema_contract`, `small_model`

Findings:

- Generic bloom prompt is shorter and less constrained than product/feature variants. It may behave inconsistently.
- It should share the same schema discipline and candidate-count rules as specialized variants.

Recommended optimization:

- Add a lens-neutral decision pipeline and reuse common `intent_bloom` schema contract text.

### 28. `phase_01_intent_capture/sub_phase_01_3a_user_journey_bloom/user_journey_bloom.product.system.md`

Severity: `P1`

Tags: `small_model`, `traceability`, `schema_contract`, `context_priority`

Findings:

- This is one of the heaviest prompts. It must cover every persona, domain, compliance surface, retention surface, journey ID discipline, phase tagging, and structured steps.
- Coverage pressure can cause low-quality invented journeys if the input does not support every required dimension.
- The prompt wisely provides `unreached_personas` and `unreached_domains`; extend this pattern to compliance/retention surfaces.
- Step actor rules are good but should be post-validated.

Recommended optimization:

- Add a coverage ledger in output: persona/domain/compliance seed -> journey IDs or unreached reason.

### 29. `phase_01_intent_capture/sub_phase_01_3a_user_journey_decomposition/user_journey_decomposition.product.system.md`

Severity: `P1`

Tags: `small_model`, `intent_boundary`, `schema_contract`

Findings:

- The decompose-vs-refuse decision is the critical branch and should come first.
- The structural test distinguishing atomic vs umbrella journeys is helpful but should be made procedural.
- Children must be journeys, not features; good rule. Add examples of invalid feature children.

Recommended optimization:

- Use classify-first routing: `atomic_journey`, `umbrella_journey`, `invalid_parent`.

### 30. `phase_01_intent_capture/sub_phase_01_3b_system_workflow_bloom/system_workflow_bloom.product.system.md`

Severity: `P1`

Tags: `small_model`, `traceability`, `schema_contract`

Findings:

- Similar complexity to user journey bloom, but for automatable workflows.
- The prompt should define workflow granularity: not every step is a workflow; not every workflow is a component.
- Automatable journey steps should be primary seeds, but compliance, retention, and integration obligations may also seed workflows. The priority order should be explicit.

Recommended optimization:

- Add a seed-to-workflow coverage table and workflow granularity tests.

### 31. `phase_01_intent_capture/sub_phase_01_3b_system_workflow_decomposition/system_workflow_decomposition.product.system.md`

Severity: `P1`

Tags: `intent_boundary`, `small_model`, `schema_contract`

Findings:

- Workflow decomposition needs a branch distinction like: atomic workflow, compound workflow, invalid workflow, or duplicate of sibling.
- Without a strong branch rule, models may split workflows into too-small internal operations.
- It should preserve trigger and outcome semantics exactly.

Recommended optimization:

- Add "do not split into implementation mechanics" and require child workflows to have independently meaningful triggers/outcomes.

### 32. `phase_01_intent_capture/sub_phase_01_4_entities_bloom/entities_bloom.product.system.md`

Severity: `P2`

Tags: `traceability`, `schema_contract`, `validation_gap`

Findings:

- Entity bloom should distinguish business entities, documents, events, configuration, logs, and external records.
- It should prevent duplicate entities when vocabulary terms already describe the same concept.
- Require source or journey/workflow basis for each entity.

Recommended optimization:

- Add duplicate/collision check against canonical vocabulary and existing entities.

### 33. `phase_01_intent_capture/sub_phase_01_4_intent_statement_synthesis/intent_statement_synthesis.feature.system.md`

Severity: `P2`

Tags: `context_priority`, `schema_contract`

Findings:

- Feature intent synthesis should preserve the selected lens and not broaden into product vision.
- It should distinguish confirmed facts, assumptions, and open questions.
- Add explicit "do not invent missing implementation details."

Recommended optimization:

- Require `source_basis` per statement section.

### 34. `phase_01_intent_capture/sub_phase_01_4_intent_statement_synthesis/intent_statement_synthesis.product.system.md`

Severity: `P2`

Tags: `context_priority`, `schema_contract`

Findings:

- Product intent synthesis risks smoothing over unresolved alternatives from bloom.
- It should carry forward rejected or deferred interpretations if they materially constrain the product.
- Add coverage check against accepted personas, domains, journeys, and open questions.

Recommended optimization:

- Include `synthesis_exclusions` for interpretations deliberately not selected.

### 35. `phase_01_intent_capture/sub_phase_01_4_intent_statement_synthesis/intent_statement_synthesis.system.md`

Severity: `P2`

Tags: `schema_contract`, `small_model`

Findings:

- The generic version is likely less robust than product/feature variants.
- It should import the same source-priority and open-question preservation rules.

Recommended optimization:

- Consolidate common synthesis rules across all three intent statement prompts.

### 36. `phase_01_intent_capture/sub_phase_01_5_integrations_qa_bloom/integrations_qa_bloom.product.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `intent_boundary`

Findings:

- Integrations and quality attributes are distinct concerns and may deserve separate branches. Combining them risks conflating external system interfaces with NFRs.
- The prompt should define when an external service is an integration vs just a technology constraint.
- Quality attributes should avoid invented thresholds unless source-backed.

Recommended optimization:

- Add separate output subcontracts and source-basis requirements for integrations vs quality attributes.

### 37. `phase_01_intent_capture/sub_phase_01_6_product_description_synthesis/product_description_synthesis.product.system.md`

Severity: `P1`

Tags: `intent_boundary`, `schema_contract`, `traceability`

Findings:

- The prompt correctly says deterministic handoff arrays are carried forward and must not be regenerated. This is a strong pattern.
- It should require the four generated fields to reference which accepted outputs informed them.
- It should forbid changing IDs, counts, or ordering of hidden deterministic arrays, which it already implies.

Recommended optimization:

- Add a concise `source_basis` array for each of the four fields if schema permits.

### 38. `phase_01_intent_capture/sub_phase_01_8_release_plan/release_plan_v2.product.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- The deterministic assignment explanation is good. The critical failure mode is journey omission or duplicate assignment.
- This should be enforced deterministically: every accepted journey appears exactly once.
- The prompt should define release sizing and dependency rules more explicitly.

Recommended optimization:

- Add `unassigned_journeys` only if caller permits; otherwise validation should hard-fail.
- Add dependency-based ordering checks.

### 39. `phase_02_requirements/sub_phase_02_1_functional_requirements/functional_requirements_ac_enrichment.product.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `small_model`

Findings:

- The measurable-condition discipline is strong and concrete.
- The prompt asks for failure/rejection modes, positive behavior, and testable ACs under traced context. This is appropriate but high-load.
- It should distinguish enriching the given skeleton from changing the requirement itself.
- Formula, IDs, traces, and existing acceptance criteria should be preservation-protected.

Recommended optimization:

- Add "echo unchanged fields exactly" for any skeleton fields outside AC enrichment.
- Add AC category tags: positive, negative, authorization, failure, timing, audit.

### 40. `phase_02_requirements/sub_phase_02_1_functional_requirements/functional_requirements_bloom.product.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `context_priority`

Findings:

- Coverage contract is strong: every accepted user journey must seed at least one FR or be listed as unreached.
- The prompt allows supplemental FRs from compliance/entities/workflows; it should state that these must not drown out journey-derived FRs.
- Valid trace ID prefixes are helpful and should be deterministically checked.

Recommended optimization:

- Add output coverage matrix: journey ID -> FR IDs or unreached reason.

### 41. `phase_02_requirements/sub_phase_02_1_functional_requirements/functional_requirements_bloom.system.md`

Severity: `P2`

Tags: `schema_contract`, `prompt_template`

Findings:

- This older/simple version is less robust than the product-specific Pass-1 prompt.
- It lacks the stronger coverage, trace prefix, and JSON anti-failure rules.

Recommended optimization:

- Either retire it, mark it legacy, or align it with the newer Pass-1 contract.

### 42. `phase_02_requirements/sub_phase_02_1a_functional_requirements_decomposition/functional_requirements_decomposition.product.system.md`

Severity: `P1`

Tags: `small_model`, `context_priority`, `schema_contract`, `validation_gap`

Findings:

- This is the prompt previously reviewed in detail. It has a strong tier model, but it asks a smaller model to perform tier classification, one-level decomposition, assumption surfacing, trace selection, dedupe, and strict JSON generation in one pass.
- The atomic-leaf exception is too late in the prompt and should be elevated into a first-class branch.
- Context should be split into direct, sibling, existing assumptions, and fallback context.
- Formula preservation and assumption dedupe need explicit validation.

Recommended optimization:

- Use the optimized template created in `test-and-evaluation/calibration-workspaces/optimized-requirements-decomposition-prompt-template.md`.
- Add validators for formula preservation, trace validity, assumption dedupe, fanout, and tier enum.

### 43. `phase_02_requirements/sub_phase_02_2_nonfunctional_requirements/nonfunctional_requirements_bloom.product.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `small_model`

Findings:

- Coverage of every V&V requirement and material compliance item is strong.
- Category equity is good, but it may pressure models to spread categories artificially.
- The prompt should clarify when one broad NFR may absorb multiple seeds and how to cite that absorption.

Recommended optimization:

- Add seed coverage matrix: seed ID -> NFR ID or unreached/absorbed reason.

### 44. `phase_02_requirements/sub_phase_02_2_nonfunctional_requirements/nonfunctional_requirements_bloom.system.md`

Severity: `P2`

Tags: `prompt_template`, `schema_contract`

Findings:

- Like the simple FR bloom prompt, this appears less mature than the product-specific version.
- It lacks newer traceability and coverage rules.

Recommended optimization:

- Retire, mark legacy, or align with product Pass-1 NFR bloom.

### 45. `phase_02_requirements/sub_phase_02_2_nonfunctional_requirements/nonfunctional_requirements_threshold_enrichment.product.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- The prompt correctly distinguishes threshold from measurement method.
- It should explicitly forbid inventing thresholds when traced V&V requirements do not provide them; use `open_question` or leave blocked if schema allows.
- "Echo all other fields unchanged" is a strong preservation rule and should be validated.

Recommended optimization:

- Add deterministic diff validator: only `threshold` and `measurement_method` may change, plus allowed removal of `seed_threshold`.

### 46. `phase_02_requirements/sub_phase_02_2a_non_functional_requirements_decomposition/nonfunctional_requirements_decomposition.product.system.md`

Severity: `P1`

Tags: `small_model`, `schema_contract`, `context_priority`

Findings:

- This mirrors FR decomposition and has similar risks: branch ambiguity, assumption duplication, over-decomposition, and weak context priority.
- Relationship to FR leaves via `applies_to_requirements` is valuable but should be validated.
- Atomic NFR leaf handling should be elevated.

Recommended optimization:

- Apply the same classify-first branch pattern as the optimized FR decomposition prompt.
- Add validators for `applies_to_requirements`, trace IDs, and measurable conditions.

### 47. `phase_03_system_specification/sub_phase_03_1_system_boundary/system_boundary.system.md`

Severity: `P2`

Tags: `schema_contract`, `traceability`

Findings:

- The prompt is concise but may under-specify how to derive system boundary from FRs, NFRs, external systems, and out-of-scope intent.
- "in_scope must cover all Functional Requirements" should be backed by output coverage mapping.
- External systems needing interface contracts should preserve IDs.

Recommended optimization:

- Add `fr_coverage` and `external_system_contract_obligations`.

### 48. `phase_03_system_specification/sub_phase_03_2_system_requirements/system_requirements.system.md`

Severity: `P2`

Tags: `traceability`, `schema_contract`, `validation_gap`

Findings:

- Every FR must map to at least one system requirement. This is a deterministic coverage invariant.
- The prompt should define expected granularity: system requirement vs component responsibility vs API endpoint.
- Source IDs should be exact and validated.

Recommended optimization:

- Add examples and a coverage matrix.

### 49. `phase_03_system_specification/sub_phase_03_3_interface_contracts/interface_contracts.system.md`

Severity: `P2`

Tags: `schema_contract`, `traceability`

Findings:

- Interface contracts need explicit direction for internal vs external interfaces.
- Error responses are required, but auth, retry, timeout, and idempotency behavior should be considered where applicable.
- Every external system coverage should be validated.

Recommended optimization:

- Add fields/rules for auth, error, timeout, retry, idempotency, and data ownership.

### 50. `phase_04_architecture/sub_phase_04_1_software_domains/software_domains.system.md`

Severity: `P2`

Tags: `intent_boundary`, `schema_contract`

Findings:

- The prompt should define how software domains relate to business domains and bounded contexts.
- Ubiquitous language ambiguity is mentioned but needs collision handling.
- It should prevent creating domains that are just technology layers unless intended.

Recommended optimization:

- Add domain granularity tests and `source_business_domain_ids`.

### 51. `phase_04_architecture/sub_phase_04_2_component_decomposition/component_decomposition.system.md`

Severity: `P1`

Tags: `schema_contract`, `validation_gap`, `traceability`

Findings:

- Responsibility atomicity rule is strong: no conjunctions connecting distinct concerns.
- This should be validated deterministically but carefully; simple "and" checks can false-positive inside phrases.
- System requirement allocation coverage is a key invariant.

Recommended optimization:

- Add component responsibility examples and a coverage map from system requirement IDs to component IDs.

### 52. `phase_04_architecture/sub_phase_04_3_adr_capture/adr_capture.system.md`

Severity: `P2`

Tags: `traceability`, `schema_contract`

Findings:

- ADR capture needs clearer distinction between real architectural decisions, design consequences, and implementation tasks.
- Alternatives considered are required, but prompt should avoid hallucinated alternatives unless context supports them.
- ADR status should be enum-validated.

Recommended optimization:

- Require `decision_basis_ids` and `alternative_basis` when alternatives are source-backed; otherwise mark as inferred.

### 53. `phase_05_technical_specification/sub_phase_05_1_data_models/data_models.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- Data model generation is under-specified for a high-impact artifact.
- It should require entity ownership, primary keys, relationships, constraints, indexes, tenancy/security implications, and trace to component responsibilities.
- Consistency with component responsibilities is mentioned but not made operational.

Recommended optimization:

- Add a data-model checklist and trace fields to entities, components, and requirements.

### 54. `phase_05_technical_specification/sub_phase_05_2_api_definitions/api_definitions.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- API definitions need more explicit constraints: method semantics, request/response schemas, auth, authorization, error codes, pagination, idempotency, and versioning.
- Authentication is required, which is good, but authorization source should also be captured.
- Consistency with interface contracts should be a traceable mapping.

Recommended optimization:

- Add `source_contract_ids`, `source_component_ids`, and structured error/auth fields.

### 55. `phase_05_technical_specification/sub_phase_05_3_error_handling/error_handling_strategies.system.md`

Severity: `P2`

Tags: `schema_contract`, `validation_gap`

Findings:

- Error handling prompt has useful rules against generic errors.
- It should distinguish detection, classification, response, retry/recovery, user-visible message, logging/alerting, and audit behavior.
- Every component coverage should be validated.

Recommended optimization:

- Add an error taxonomy and component coverage matrix.

### 56. `phase_05_technical_specification/sub_phase_05_4_configuration_parameters/configuration_parameters.system.md`

Severity: `P2`

Tags: `schema_contract`, `validation_gap`

Findings:

- Security-sensitive parameter handling is good.
- Prompt should also capture type, default, environment scope, mutability, validation, owner, and secret-management source.
- Avoid inventing config parameters not implied by architecture or implementation needs.

Recommended optimization:

- Add `sensitivity`, `default_policy`, `source_requirement_ids`, and `validation_rule`.

### 57. `phase_06_implementation_planning/implementation_task_decomposition.system.md`

Severity: `P1`

Tags: `traceability`, `schema_contract`, `validation_gap`

Findings:

- Verbatim component responsibility preservation is strong and should be deterministically diffed.
- High-complexity tasks require flags, but task granularity should also be constrained.
- Every technical spec coverage is a deterministic invariant.

Recommended optimization:

- Add `technical_spec_coverage` and task granularity tests: one implementable unit, not epic; not a single line change unless genuinely trivial.

### 58. `phase_07_test_planning/test_case_generation.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- Every AC must have at least one test case. This is a key deterministic coverage check.
- The prompt should distinguish unit, integration, e2e, contract, security, compliance, and performance tests.
- Preconditions are required, but expected result and oracle should also be explicit.

Recommended optimization:

- Add `test_type`, `source_ac_ids`, `test_oracle`, and negative-case requirements.

### 59. `phase_08_evaluation_planning/evaluation_design.system.md`

Severity: `P1`

Tags: `schema_contract`, `small_model`, `validation_gap`

Findings:

- "REQUIRED OUTPUT: Three JSON objects" is risky. Many pipelines expect one parseable JSON root. This is a likely integration failure point unless the caller explicitly supports streaming or multiple JSON documents.
- NFR-to-evaluation coverage is a deterministic invariant.
- Tooling selection should be grounded in available tool constraints where possible.

Recommended optimization:

- Return one root object with three named arrays/objects instead of three separate JSON objects.
- Add coverage matrix from NFR IDs to evaluation criteria.

### 60. `phase_09_execution/sub_phase_09_1_implementation_task/implementation_task_execution.system.md`

Severity: `P0`

Tags: `intent_boundary`, `validation_gap`, `schema_contract`

Findings:

- This prompt governs implementation execution, which is operationally high-risk.
- Completion criteria and governing ADRs are mentioned, but tool/file mutation policy should be enforced by the runtime, not only prompt text.
- Output as "Implementation Artifacts per Technical Specification" is too loose for automated validation.

Recommended optimization:

- Require structured execution report: files changed, task IDs completed, tests run, ADR compliance notes, deviations, and blockers.
- Enforce filesystem and command policy outside the prompt.

### 61. `phase_10_commit/pre_commit_consistency.system.md`

Severity: `P1`

Tags: `schema_contract`, `traceability`, `validation_gap`

Findings:

- Pre-commit consistency is a gate; it should be stricter than a generic consistency report.
- It should compare changed artifacts against implementation tasks, ADRs, tests, and acceptance criteria.
- The prompt should require blocking vs non-blocking findings.

Recommended optimization:

- Add verdict enum: `pass`, `pass_with_warnings`, `fail`.
- Require `blocking_findings[]`, `non_blocking_findings[]`, and `required_remediation[]`.

## Immediate Priorities

1. Fix `phase_08/evaluation_design.system.md` to emit one JSON root instead of three separate JSON objects unless the caller explicitly supports multi-document JSON.

2. Standardize the JSON contract snippet across prompts, especially for shorter legacy prompts.

3. Apply classify-first branch routing to decomposition prompts:
   - functional requirements decomposition
   - nonfunctional requirements decomposition
   - journey decomposition
   - workflow decomposition
   - tier C AC audit

4. Add deterministic validators for:
   - JSON parse and schema
   - required fields and enums
   - no markdown/prose output
   - trace ID validity
   - source citation validity
   - coverage matrices
   - formula/exact-text preservation
   - unchanged-field preservation

5. Mark or retire older/simple prompt variants that overlap with newer product-specific prompts:
   - `functional_requirements_bloom.system.md`
   - `nonfunctional_requirements_bloom.system.md`
   - generic intent bloom/synthesis prompts if product/feature variants are authoritative.

6. Create a prompt-family taxonomy before DSPy:
   - classifiers
   - extractors
   - bloom/generators
   - decomposers
   - synthesizers
   - reviewers/auditors
   - execution/gate prompts

7. Use strong-model review and deterministic validation to build calibration examples by prompt family before running DSPy optimization.

