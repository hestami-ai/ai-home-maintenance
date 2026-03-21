"""Rule-based edge proposer — creates typed edges between memory objects.

Proposes edges based on structural relationships visible in the source data:
- Verdicts → Claims: supports/invalidates
- Human decisions → Gates → Claims: supports (if APPROVE) or invalidates (if REJECT)
- Decision traces → Narrative memories: derived_from
- Corrections → Original claims: supersedes
- Open loops → Related objects: raises
"""

from __future__ import annotations

import uuid

from deep_memory_agent.models.base import BaseMemoryObject, ObjectType
from deep_memory_agent.models.relations import EdgeType, MemoryEdge


def _edge_id() -> str:
    return f"ME-{uuid.uuid4().hex[:12]}"


def propose_edges(objects: list[BaseMemoryObject]) -> list[MemoryEdge]:
    """Propose edges between memory objects based on structural rules.

    This is a rule-based pass — no LLM involved. It exploits known
    relationships between JanumiCode table rows.
    """
    edges: list[MemoryEdge] = []

    # Build lookup maps
    by_id: dict[str, BaseMemoryObject] = {obj.object_id: obj for obj in objects}
    by_source: dict[tuple[str, str], BaseMemoryObject] = {}
    for obj in objects:
        if obj.source_table and obj.source_id:
            by_source[(obj.source_table, obj.source_id)] = obj

    for obj in objects:
        # ── Verdict → Claim: supports or invalidates ──
        if obj.source_table == "verdicts" and obj.object_type in (ObjectType.CLAIM, ObjectType.CORRECTION):
            claim_id = obj.content.get("original_claim_id") or obj.content.get("claim_text", "")
            # Find the corresponding claim object
            for candidate in objects:
                if candidate.source_table == "claims" and candidate.object_type == ObjectType.CLAIM:
                    if candidate.source_id and obj.content.get("original_claim_id") == candidate.source_id:
                        # DISPROVED verdict invalidates the claim
                        if obj.object_type == ObjectType.CORRECTION:
                            edges.append(MemoryEdge(
                                edge_id=_edge_id(),
                                edge_type=EdgeType.INVALIDATES,
                                from_object_id=obj.object_id,
                                to_object_id=candidate.object_id,
                                confidence=0.9,
                                evidence="Verdict disproved this claim",
                                created_by="rule_engine",
                            ))
                        else:
                            # VERIFIED/CONDITIONAL verdict supports the claim
                            edges.append(MemoryEdge(
                                edge_id=_edge_id(),
                                edge_type=EdgeType.SUPPORTS,
                                from_object_id=obj.object_id,
                                to_object_id=candidate.object_id,
                                confidence=0.9,
                                evidence=f"Verdict {obj.content.get('verdict', '')} supports this claim",
                                created_by="rule_engine",
                            ))

        # ── Decision traces from narrative curator: derived_from narrative memories ──
        if obj.source_table == "decision_traces" and obj.object_type == ObjectType.DECISION_TRACE:
            # Link to any narrative memory from the same dialogue
            for candidate in objects:
                if (
                    candidate.source_table == "narrative_memories"
                    and candidate.dialogue_id == obj.dialogue_id
                    and candidate.object_type == ObjectType.NARRATIVE_SUMMARY
                ):
                    edges.append(MemoryEdge(
                        edge_id=_edge_id(),
                        edge_type=EdgeType.DERIVED_FROM,
                        from_object_id=obj.object_id,
                        to_object_id=candidate.object_id,
                        confidence=0.7,
                        evidence="Decision trace and narrative memory from same dialogue curation",
                        created_by="rule_engine",
                    ))

        # ── Human decisions: link to related gates/claims ──
        if obj.source_table == "human_decisions" and obj.object_type == ObjectType.DECISION_TRACE:
            action = obj.content.get("action", "")
            # APPROVE supports; REJECT invalidates
            edge_type = EdgeType.SUPPORTS if action == "APPROVE" else EdgeType.INVALIDATES if action == "REJECT" else None
            if edge_type:
                # Link to any claim in the same dialogue as a soft connection
                for candidate in objects:
                    if (
                        candidate.source_table == "claims"
                        and candidate.dialogue_id == obj.dialogue_id
                        and candidate.object_type == ObjectType.CLAIM
                    ):
                        edges.append(MemoryEdge(
                            edge_id=_edge_id(),
                            edge_type=edge_type,
                            from_object_id=obj.object_id,
                            to_object_id=candidate.object_id,
                            confidence=0.5,
                            evidence=f"Human {action} decision in same dialogue",
                            created_by="rule_engine",
                        ))

    return edges
