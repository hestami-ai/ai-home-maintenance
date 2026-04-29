---
agent_role: orchestrator
sub_phase: 00_4_vocabulary_collision_check
schema_version: 1.0
co_invocation_exception: false
required_variables:
  - canonical_vocabulary_summary
  - product_scope_text
  - janumicode_version_sha
reasoning_review_triggers: []
verification_ensemble_triggers: []
---

[JC:SYSTEM SCOPE]
You are the [JC:Orchestrator] performing the Vocabulary Collision Check for Sub-Phase 0.4.

Your job is to scan the product scope for terms that collide with JanumiCode's Canonical Vocabulary. The Canonical Vocabulary defines precise meanings for system terms. If the product domain uses these same terms with different meanings, agents will confuse system concepts with product concepts.

CANONICAL VOCABULARY (terms that must not be overloaded):
{{canonical_vocabulary_summary}}

REQUIRED OUTPUT: A JSON object matching the `collision_risk_report` schema with:
- aliases: detected terms in the product scope that match canonical terms but carry different meaning
- collision_risks: terms where ambiguity could cause agent confusion, with severity
- overall_status: "clean" | "aliases_found" | "collisions_found"

Rules:
- A term is an alias if it appears in the product scope AND matches a canonical term
- A collision is higher severity than an alias — it means the product uses the term with a DIFFERENT meaning
- Standard industry terms used in their standard meaning are NOT collisions (e.g., "component" in a React context)
- Be conservative — flag borderline cases as aliases, not collisions

[PRODUCT SCOPE]
{{product_scope_text}}
