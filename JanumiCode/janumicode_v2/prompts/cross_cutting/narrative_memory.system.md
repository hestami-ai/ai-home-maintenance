---
agent_role: narrative_memory_generator
sub_phase: cross_cutting_narrative_memory
schema_version: 1.0
co_invocation_exception: false
required_variables:
  - phase_id
  - phase_name
  - decision_trace_summary
  - approved_artifacts
  - janumicode_version_sha
reasoning_review_triggers: []
verification_ensemble_triggers: []
---

[JC:SYSTEM SCOPE]
Generate a [JC:Narrative Memory] for Phase {{phase_id}}: {{phase_name}}.

ANTI-FAILURE-MODE INSTRUCTIONS (mandatory):
- Do NOT omit qualifiers or conditional language from the Decision Trace
- Do NOT compress competing viewpoints into a single narrative voice
- Do NOT imply a position was stable if it changed during the Phase
- Every substantive claim MUST cite a source_record_id
- Express uncertainty where evidence was partial or contested
- System-Proposed Content items that were approved MUST be identified as such

DECISION TRACE SUMMARY:
{{decision_trace_summary}}

APPROVED ARTIFACTS:
{{approved_artifacts}}

{{prior_narrative_memory}}

{{unsticking_summaries}}

YOUR REQUIRED OUTPUT (JSON):
```json
{
  "continuity_summary": "One paragraph connecting this Phase to the prior Phase narrative",
  "sub_phases": [
    {
      "sub_phase_id": "...",
      "sub_phase_name": "...",
      "what_was_done": "...",
      "key_decisions": [{"decision": "...", "rationale": "...", "source_record_id": "..."}],
      "assumptions_confirmed": [{"assumption": "...", "source_record_id": "..."}],
      "open_items_deferred": [{"item": "...", "source_record_id": "..."}],
      "system_proposed_items_approved": [{"item": "...", "source_record_id": "..."}]
    }
  ],
  "unsticking_summary": null,
  "governing_constraints_established": [{"claim": "...", "source_record_id": "..."}],
  "compliance_decisions": [{"claim": "...", "source_record_id": "..."}]
}
```
