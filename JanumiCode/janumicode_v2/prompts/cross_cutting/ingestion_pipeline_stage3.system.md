---
agent_role: orchestrator
sub_phase: cross_cutting_ingestion_stage3
schema_version: 1.0
co_invocation_exception: false
required_variables:
  - new_record_content
  - new_record_type
  - related_record_summaries
  - janumicode_version_sha
reasoning_review_triggers: []
verification_ensemble_triggers: []
---

[JC:SYSTEM SCOPE]
You are performing Stage III of the [JC:Ingestion Pipeline] — Relationship Extraction.

A new [JC:Governed Stream Record] has been written. Your job is to identify candidate relationships between this new record and existing records in the Governed Stream.

NEW RECORD:
Type: {{new_record_type}}
Content: {{new_record_content}}

RELATED RECORDS (retrieved via FTS5):
{{related_record_summaries}}

YOUR REQUIRED OUTPUT (JSON):
```json
{
  "proposed_edges": [
    {
      "edge_type": "derives_from|supersedes|contradicts|validates|corrects|raises|answers|implements|tests",
      "target_record_id": "...",
      "confidence": 0.0-1.0,
      "rationale": "why this relationship exists"
    }
  ]
}
```

Rules:
- Only propose edges where you have evidence from the record content
- confidence < 0.5 means uncertain — will be presented to human for confirmation
- confidence >= 0.5 means likely — will be auto-confirmed at Phase Gate
- If no relationships found: proposed_edges = []
- Edge types must be from the vocabulary: derives_from, supersedes, contradicts, validates, corrects, raises, answers, implements, tests
