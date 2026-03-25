/**
 * Memory Ingestion Module
 *
 * Extracts typed memory objects from dialogue events, proposes graph edges
 * between them, and stores everything in the memory substrate tables.
 *
 * Pipeline: extract → normalize → propose edges → store
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../database/init';
import { getDialogueEvents } from '../events/reader';
import type {
	MemoryObject,
	MemoryEdge,
	MemoryObjectType,
	AuthorityLevel,
	EdgeType,
	ExtractionRun,
} from './types';

// ==================== Event-to-MemoryObject Mapping ====================

/**
 * Map dialogue event_type values to memory object types.
 * Events that don't match are skipped.
 */
const EVENT_TYPE_MAP: Record<string, { objectType: MemoryObjectType; authority: AuthorityLevel }> = {
	claim_introduced: { objectType: 'claim', authority: 'agent_proposed' },
	claim_verified: { objectType: 'claim', authority: 'agent_verified' },
	decision_made: { objectType: 'decision', authority: 'human_validated' },
	constraint_defined: { objectType: 'constraint', authority: 'human_validated' },
	requirement_captured: { objectType: 'requirement', authority: 'agent_proposed' },
	assumption_stated: { objectType: 'assumption', authority: 'agent_inferred' },
	question_raised: { objectType: 'open_question', authority: 'system_generated' },
	domain_assessment: { objectType: 'domain_assessment', authority: 'agent_proposed' },
	persona_defined: { objectType: 'persona', authority: 'agent_proposed' },
	user_journey_mapped: { objectType: 'user_journey', authority: 'agent_proposed' },
	entity_proposed: { objectType: 'entity_proposal', authority: 'agent_proposed' },
	workflow_proposed: { objectType: 'workflow_proposal', authority: 'agent_proposed' },
	integration_proposed: { objectType: 'integration_proposal', authority: 'agent_proposed' },
	narrative_recorded: { objectType: 'narrative_memory', authority: 'system_generated' },
	technical_finding: { objectType: 'technical_finding', authority: 'agent_proposed' },
	mmp_accepted: { objectType: 'decision', authority: 'human_validated' },
	mmp_rejected: { objectType: 'decision', authority: 'human_validated' },
};

// ==================== Extraction ====================

/**
 * Extract memory objects from dialogue_events for the given dialogue.
 * Reads events from the database and maps recognized event types to MemoryObjects.
 */
export function extractMemoryObjects(dialogueId: string): MemoryObject[] {
	const result = getDialogueEvents({ dialogue_id: dialogueId });
	if (!result.success) {
		return [];
	}

	const objects: MemoryObject[] = [];
	const events = result.value;

	for (const event of events) {
		const mapping = EVENT_TYPE_MAP[event.event_type];
		if (!mapping) {
			continue;
		}

		const content = event.content || event.summary || '';
		if (!content.trim()) {
			continue;
		}

		const now = new Date().toISOString();

		objects.push({
			object_id: randomUUID(),
			object_type: mapping.objectType,
			content,
			authority_level: mapping.authority,
			event_at: event.timestamp || now,
			effective_at: event.timestamp || now,
			dialogue_id: dialogueId,
			source_event_id: event.event_id,
			metadata: {
				role: event.role,
				phase: event.phase,
				speech_act: event.speech_act,
				event_type: event.event_type,
			},
		});
	}

	return objects;
}

// ==================== Normalization ====================

/**
 * Normalize raw items into MemoryObject schema with UUIDs.
 * Useful for ad-hoc ingestion from non-event sources.
 */
export function normalizeToMemoryObjects(
	items: Array<{ type: string; content: string; metadata?: Record<string, unknown> }>,
): MemoryObject[] {
	const now = new Date().toISOString();

	return items
		.filter((item) => item.content && item.content.trim())
		.map((item) => {
			const objectType = isValidObjectType(item.type) ? item.type : 'claim';
			return {
				object_id: randomUUID(),
				object_type: objectType as MemoryObjectType,
				content: item.content,
				authority_level: 'system_generated' as AuthorityLevel,
				event_at: now,
				effective_at: now,
				dialogue_id: (item.metadata?.dialogue_id as string) || 'unknown',
				source_event_id: item.metadata?.source_event_id as number | undefined,
				metadata: item.metadata,
			};
		});
}

function isValidObjectType(type: string): boolean {
	const valid: Set<string> = new Set([
		'claim', 'decision', 'constraint', 'requirement', 'assumption',
		'open_question', 'domain_assessment', 'persona', 'user_journey',
		'entity_proposal', 'workflow_proposal', 'integration_proposal',
		'narrative_memory', 'technical_finding',
	]);
	return valid.has(type);
}

// ==================== Edge Proposal ====================

/**
 * Rule-based edge creation between extracted memory objects.
 *
 * Rules:
 * - Decisions support requirements (from the same dialogue)
 * - Claims derive_from events (if source_event_id is present)
 * - Constraints require requirements
 * - Technical findings support claims
 * - Assumptions derive_from domain assessments
 */
export function proposeEdges(objects: MemoryObject[]): MemoryEdge[] {
	const edges: MemoryEdge[] = [];
	const now = new Date().toISOString();

	// Index objects by type for efficient lookups
	const byType = new Map<MemoryObjectType, MemoryObject[]>();
	for (const obj of objects) {
		const list = byType.get(obj.object_type) || [];
		list.push(obj);
		byType.set(obj.object_type, list);
	}

	// Decisions support requirements
	const decisions = byType.get('decision') || [];
	const requirements = byType.get('requirement') || [];
	for (const decision of decisions) {
		for (const req of requirements) {
			if (decision.dialogue_id === req.dialogue_id) {
				edges.push(createEdge(decision.object_id, req.object_id, 'supports', 0.7, now));
			}
		}
	}

	// Claims derived_from their source events (link to other claims from same event batch)
	const claims = byType.get('claim') || [];
	for (let i = 0; i < claims.length; i++) {
		for (let j = i + 1; j < claims.length; j++) {
			if (
				claims[i].dialogue_id === claims[j].dialogue_id &&
				claims[i].source_event_id !== undefined &&
				claims[j].source_event_id !== undefined
			) {
				edges.push(createEdge(claims[i].object_id, claims[j].object_id, 'derived_from', 0.5, now));
			}
		}
	}

	// Constraints require requirements
	const constraints = byType.get('constraint') || [];
	for (const constraint of constraints) {
		for (const req of requirements) {
			if (constraint.dialogue_id === req.dialogue_id) {
				edges.push(createEdge(constraint.object_id, req.object_id, 'requires', 0.8, now));
			}
		}
	}

	// Technical findings support claims
	const findings = byType.get('technical_finding') || [];
	for (const finding of findings) {
		for (const claim of claims) {
			if (finding.dialogue_id === claim.dialogue_id) {
				edges.push(createEdge(finding.object_id, claim.object_id, 'supports', 0.6, now));
			}
		}
	}

	// Assumptions derived_from domain assessments
	const assumptions = byType.get('assumption') || [];
	const assessments = byType.get('domain_assessment') || [];
	for (const assumption of assumptions) {
		for (const assessment of assessments) {
			if (assumption.dialogue_id === assessment.dialogue_id) {
				edges.push(createEdge(assumption.object_id, assessment.object_id, 'derived_from', 0.6, now));
			}
		}
	}

	return edges;
}

function createEdge(
	sourceId: string,
	targetId: string,
	edgeType: EdgeType,
	confidence: number,
	createdAt: string,
): MemoryEdge {
	return {
		edge_id: randomUUID(),
		source_id: sourceId,
		target_id: targetId,
		edge_type: edgeType,
		confidence,
		created_at: createdAt,
	};
}

// ==================== Storage ====================

/**
 * Insert memory objects into the memory_objects table.
 * Uses the actual DB schema columns (which differ slightly from the MemoryObject interface).
 */
export function storeMemoryObjects(objects: MemoryObject[]): void {
	const db = getDatabase();
	if (!db || objects.length === 0) {
		return;
	}

	const stmt = db.prepare(`
		INSERT OR IGNORE INTO memory_objects (
			object_id, object_type, dialogue_id, actor, content,
			confidence, authority_level, event_at, effective_from,
			source_table, source_id, extraction_method, recorded_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	`);

	const insertMany = db.transaction((objs: MemoryObject[]) => {
		for (const obj of objs) {
			// Map MemoryObject interface fields to DB schema columns
			const actor = (obj.metadata?.role as string) || 'system';
			const sourceTable = obj.source_event_id !== undefined ? 'dialogue_events' : null;
			const sourceId = obj.source_event_id !== undefined ? String(obj.source_event_id) : null;

			// Map interface authority levels to DB CHECK constraint values
			const authorityMap: Record<string, string> = {
				human_validated: 'human_validated',
				agent_verified: 'accepted_artifact',
				agent_proposed: 'agent_inference',
				agent_inferred: 'agent_inference',
				system_generated: 'agent_inference',
			};
			const dbAuthority = authorityMap[obj.authority_level] || 'agent_inference';

			// Map interface object types to DB CHECK constraint values
			const typeMap: Record<string, string> = {
				claim: 'claim',
				decision: 'decision_trace',
				constraint: 'constraint',
				requirement: 'raw_record',
				assumption: 'assumption',
				open_question: 'open_question',
				domain_assessment: 'derived_conclusion',
				persona: 'raw_record',
				user_journey: 'raw_record',
				entity_proposal: 'raw_record',
				workflow_proposal: 'raw_record',
				integration_proposal: 'raw_record',
				narrative_memory: 'narrative_summary',
				technical_finding: 'derived_conclusion',
			};
			const dbType = typeMap[obj.object_type] || 'raw_record';

			stmt.run(
				obj.object_id,
				dbType,
				obj.dialogue_id,
				actor,
				obj.content,
				1.0,               // confidence
				dbAuthority,
				obj.event_at,
				obj.effective_at,
				sourceTable,
				sourceId,
				'dialogue_extraction',
			);
		}
	});

	insertMany(objects);
}

/**
 * Insert memory edges into the memory_edges table.
 * Uses the actual DB schema columns (from_object_id, to_object_id, created_by).
 */
export function storeMemoryEdges(edges: MemoryEdge[]): void {
	const db = getDatabase();
	if (!db || edges.length === 0) {
		return;
	}

	const stmt = db.prepare(`
		INSERT OR IGNORE INTO memory_edges (
			edge_id, edge_type, from_object_id, to_object_id,
			confidence, evidence, created_by, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);

	const insertMany = db.transaction((edgeList: MemoryEdge[]) => {
		for (const edge of edgeList) {
			// Map interface edge types to DB CHECK constraint values
			const validDbEdges = new Set([
				'supports', 'contradicts', 'supersedes', 'derived_from',
				'implements', 'blocked_by', 'answers', 'raises',
				'invalidates', 'depends_on',
			]);
			const dbEdgeType = validDbEdges.has(edge.edge_type) ? edge.edge_type : 'supports';

			stmt.run(
				edge.edge_id,
				dbEdgeType,
				edge.source_id,
				edge.target_id,
				edge.confidence,
				edge.metadata ? JSON.stringify(edge.metadata) : null,
				'memory_ingestion',
				edge.created_at,
			);
		}
	});

	insertMany(edges);
}

// ==================== Orchestration ====================

/**
 * Run the full ingestion pipeline for a dialogue:
 *   1. Extract memory objects from dialogue events
 *   2. Propose edges between extracted objects
 *   3. Store objects and edges in the database
 *
 * Returns an ExtractionRun summary.
 */
export function runIngestion(dialogueId: string): ExtractionRun {
	const runId = randomUUID();
	const startedAt = new Date().toISOString();
	const warnings: string[] = [];

	let objectsExtracted = 0;
	let edgesProposed = 0;

	try {
		// Step 1: Extract
		const objects = extractMemoryObjects(dialogueId);
		if (objects.length === 0) {
			warnings.push('No memory objects extracted from dialogue events');
		}

		// Step 2: Propose edges
		const edges = proposeEdges(objects);

		// Step 3: Store
		try {
			storeMemoryObjects(objects);
			objectsExtracted = objects.length;
		} catch (err) {
			warnings.push(`Failed to store objects: ${err instanceof Error ? err.message : String(err)}`);
		}

		try {
			storeMemoryEdges(edges);
			edgesProposed = edges.length;
		} catch (err) {
			warnings.push(`Failed to store edges: ${err instanceof Error ? err.message : String(err)}`);
		}

		// Record extraction run in audit table
		try {
			const db = getDatabase();
			if (db) {
				db.prepare(`
					INSERT INTO memory_extraction_runs (
						run_id, dialogue_id, mode, model_id, prompt_version,
						objects_created, edges_created, started_at, completed_at, status
					) VALUES (?, ?, 'incremental', 'rule-based', '1.0', ?, ?, ?, ?, 'completed')
				`).run(
					runId,
					dialogueId,
					objectsExtracted,
					edgesProposed,
					startedAt,
					new Date().toISOString(),
				);
			}
		} catch (err) {
			warnings.push(`Failed to record extraction run: ${err instanceof Error ? err.message : String(err)}`);
		}
	} catch (err) {
		warnings.push(`Ingestion pipeline error: ${err instanceof Error ? err.message : String(err)}`);
	}

	return {
		run_id: runId,
		dialogue_id: dialogueId,
		started_at: startedAt,
		completed_at: new Date().toISOString(),
		objects_extracted: objectsExtracted,
		edges_proposed: edgesProposed,
		warnings,
	};
}
