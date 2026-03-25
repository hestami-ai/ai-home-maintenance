/**
 * Deep Memory Types
 *
 * TypeScript interfaces for the memory substrate — typed objects, graph edges,
 * and context packets used by the Deep Memory Research Agent.
 *
 * Replaces the Python Pydantic models from deep-memory-agent.
 */

// ==================== MEMORY OBJECTS ====================

/** Authority levels for memory objects — higher authority outranks lower in conflicts. */
export type AuthorityLevel =
	| 'human_validated'   // User explicitly accepted/rejected via MMP
	| 'agent_verified'    // Verifier confirmed with evidence
	| 'agent_proposed'    // Agent proposed but not yet validated
	| 'agent_inferred'    // Agent derived from other evidence
	| 'system_generated'; // Automated extraction (lowest authority)

/** Types of memory objects stored in the substrate. */
export type MemoryObjectType =
	| 'claim'
	| 'decision'
	| 'constraint'
	| 'requirement'
	| 'assumption'
	| 'open_question'
	| 'domain_assessment'
	| 'persona'
	| 'user_journey'
	| 'entity_proposal'
	| 'workflow_proposal'
	| 'integration_proposal'
	| 'narrative_memory'
	| 'technical_finding';

/** A typed memory object in the substrate. */
export interface MemoryObject {
	/** Unique identifier */
	object_id: string;
	/** What kind of memory this is */
	object_type: MemoryObjectType;
	/** The content of this memory (text, JSON, or structured data) */
	content: string;
	/** Authority level — determines precedence in conflicts */
	authority_level: AuthorityLevel;
	/** When the event that produced this memory occurred */
	event_at: string; // ISO-8601
	/** When this memory became effective (may differ from event_at for retroactive changes) */
	effective_at: string; // ISO-8601
	/** Source dialogue ID */
	dialogue_id: string;
	/** Source event ID (if extracted from a specific event) */
	source_event_id?: number;
	/** Additional structured metadata */
	metadata?: Record<string, unknown>;
}

// ==================== MEMORY EDGES ====================

/** Types of relationships between memory objects. */
export type EdgeType =
	| 'supports'       // Evidence supporting another claim
	| 'contradicts'    // Direct contradiction
	| 'supersedes'     // Newer version replacing older
	| 'derived_from'   // Inference chain
	| 'refines'        // More detailed version
	| 'requires'       // Dependency relationship
	| 'implements';    // Implementation of a requirement

/** A directed edge in the memory graph. */
export interface MemoryEdge {
	/** Unique identifier */
	edge_id: string;
	/** Source memory object ID */
	source_id: string;
	/** Target memory object ID */
	target_id: string;
	/** Relationship type */
	edge_type: EdgeType;
	/** Confidence in this relationship (0.0 - 1.0) */
	confidence: number;
	/** When this edge was created */
	created_at: string; // ISO-8601
	/** Additional metadata about the relationship */
	metadata?: Record<string, unknown>;
}

// ==================== CONTEXT PACKETS ====================

/** A material memory with relevance scoring for a specific query. */
export interface ScoredMemory {
	/** The memory object */
	object: MemoryObject;
	/** Relevance to the query (0.0 - 1.0) */
	relevance: number;
	/** How this memory was found (FTS, graph traversal, temporal, etc.) */
	retrieval_method: string;
}

/** A detected contradiction between memory objects. */
export interface Contradiction {
	/** The two conflicting objects */
	objects: [MemoryObject, MemoryObject];
	/** Which object has higher authority */
	higher_authority: string; // object_id
	/** Description of the conflict */
	description: string;
}

/** A superseded item with its replacement chain. */
export interface SupersededItem {
	/** The original (now superseded) object */
	original: MemoryObject;
	/** The chain of supersession (oldest → newest) */
	chain: MemoryObject[];
	/** The currently governing version */
	current: MemoryObject;
}

/**
 * The structured output of a deep memory research query.
 * This is what the Context Engineer receives from the Deep Memory Research Agent.
 */
export interface ContextPacket {
	/** Query that produced this packet */
	query: string;
	/** Material memories ranked by relevance */
	material_memories: ScoredMemory[];
	/** Binding constraints that must be respected */
	binding_constraints: MemoryObject[];
	/** Detected contradictions */
	contradictions: Contradiction[];
	/** Items that have been superseded by newer versions */
	superseded_items: SupersededItem[];
	/** Open questions that remain unresolved */
	open_questions: MemoryObject[];
	/** Assessment of how well the query is covered by available evidence */
	coverage_assessment: {
		/** Fraction of query topics covered (0.0 - 1.0) */
		coverage: number;
		/** Topics with strong evidence */
		well_covered: string[];
		/** Topics with weak or no evidence */
		gaps: string[];
	};
	/** Overall confidence in the packet (0.0 - 1.0) */
	confidence: number;
	/** Suggested follow-up queries to fill gaps */
	recommended_drilldowns: string[];
}

// ==================== EXTRACTION ====================

/** Result of a memory extraction run. */
export interface ExtractionRun {
	/** Unique run identifier */
	run_id: string;
	/** Dialogue ID that was processed */
	dialogue_id: string;
	/** When the extraction started */
	started_at: string;
	/** When the extraction completed */
	completed_at: string;
	/** Number of objects extracted */
	objects_extracted: number;
	/** Number of edges proposed */
	edges_proposed: number;
	/** Any warnings or issues encountered */
	warnings: string[];
}
