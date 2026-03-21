---
name: fast-recall
description: Fast mode memory recall — lightweight context stuffing without LLM-intensive stages
---

Use this skill when performing a FAST mode query. Skip LLM-intensive stages:
1. Skip Query Interpretation — use the query directly as search terms
2. Broad Candidate Harvest — search_memory_candidates with limit 20
3. Skip Evidence Triage — take top results by authority level and recency
4. Skip Drill-down — no graph expansion
5. Skip Conflict Analysis — only flag objects that have superseded_by set
6. Context Packet Synthesis — assemble lightweight ContextPacket

Target latency: < 500ms. Set stages_completed to 2 in the output.
Prioritize binding_constraints and recent decision_traces.
