---
name: memory-research
description: Full 6-stage memory research pipeline for decision-grade historical context
---

Use this skill when performing a RESEARCH mode query. Execute all 6 pipeline stages:
1. Query Interpretation — decompose into retrieval targets
2. Broad Candidate Harvest — cast wide net with search_memory_candidates + temporal_query
3. Evidence Triage — score by semantic, decision, constraint, authority, temporal, contradiction
4. Drill-down Expansion — expand_memory_neighbors depth 2, load_evidence_span for raw sources
5. Conflict & Supersession Analysis — get_supersession_chain + get_conflict_set
6. Context Packet Synthesis — assemble full ContextPacket with all fields populated

Target latency: < 3 seconds. Include all evidence lineage and coverage assessment.
