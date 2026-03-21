---
name: audit-trace
description: Audit mode — complete evidence packet with full chronology, citations, and human review checkpoints
---

Use this skill when performing an AUDIT mode query. Execute all 6 stages with maximum depth:
1. Query Interpretation — comprehensive decomposition, identify ALL possible retrieval angles
2. Broad Candidate Harvest — search_memory_candidates with limit 100, temporal_query across all time
3. Evidence Triage — strict scoring, include borderline candidates with low confidence flag
4. Drill-down Expansion — expand_memory_neighbors depth 3, load_evidence_span for ALL high-value sources
5. Conflict & Supersession Analysis — exhaustive: check every candidate pair for contradictions
6. Context Packet Synthesis — full ContextPacket with complete evidence_lineage and exhaustive coverage_assessment

Target latency: < 10 seconds. Every claim must be traceable to a primary source.
Flag any gaps where evidence could not be found.
