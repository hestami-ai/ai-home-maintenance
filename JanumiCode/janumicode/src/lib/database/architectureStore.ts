/**
 * Architecture Data Access Layer
 *
 * CRUD operations for the Architecture phase tables:
 *   - architecture_documents (JSON snapshot + metadata)
 *   - arch_capabilities (normalized lookup)
 *   - arch_domain_mappings (domain→capability traceability)
 *   - arch_workflows (workflow lookup)
 *   - arch_components (component lookup, self-referencing)
 *   - arch_implementation_steps (bridges to MAKER TaskUnits)
 *
 * Hybrid storage model: the full ArchitectureDocument is stored as JSON
 * in architecture_documents.document. Normalized lookup tables are
 * populated atomically on write for relational queries.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from './init';
import type { Result } from '../types';
import type {
	ArchitectureDocument,
	ArchitectureDocumentStatus,
	CapabilityNode,
	DomainCapabilityMapping,
	WorkflowNode,
	ComponentSpec,
	ImplementationStep,
} from '../types/architecture';

// ==================== HELPERS ====================

function db() {
	const instance = getDatabase();
	if (!instance) {
		throw new Error('Database not initialized');
	}
	return instance;
}

function parseJSON<T>(value: string | null | undefined, fallback: T): T {
	if (!value) {return fallback;}
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

// ==================== ARCHITECTURE DOCUMENTS ====================

/**
 * Create a new architecture document with its full JSON snapshot
 * and populate all normalized lookup tables atomically.
 */
export function createArchitectureDocument(
	doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'>
): Result<ArchitectureDocument> {
	try {
		const docId = randomUUID();
		const now = new Date().toISOString();
		const full: ArchitectureDocument = {
			...doc,
			doc_id: docId,
			created_at: now,
			updated_at: now,
		};

		const txn = db().transaction(() => {
			// 1. Insert the JSON snapshot
			db().prepare(`
				INSERT INTO architecture_documents (doc_id, dialogue_id, version, document, goal_alignment_score, validation_findings, status, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				full.doc_id, full.dialogue_id, full.version,
				JSON.stringify(full), full.goal_alignment_score,
				JSON.stringify(full.validation_findings), full.status,
				full.created_at, full.updated_at
			);

			// 2. Populate normalized lookup tables
			populateLookupTables(full);
		});
		txn();

		return { success: true, value: full };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Delete an architecture document and all its lookup table data.
 * Used when re-entering DECOMPOSING via navigation to avoid UNIQUE constraint violations.
 */
export function deleteArchitectureDocument(docId: string): Result<void> {
	try {
		const txn = db().transaction(() => {
			clearLookupTables(docId);
			db().prepare('DELETE FROM architecture_documents WHERE doc_id = ?').run(docId);
		});
		txn();
		return { success: true, value: undefined };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get the latest architecture document for a dialogue.
 */
export function getArchitectureDocumentForDialogue(
	dialogueId: string
): Result<ArchitectureDocument | null> {
	try {
		const row = db().prepare(
			'SELECT * FROM architecture_documents WHERE dialogue_id = ? ORDER BY version DESC LIMIT 1'
		).get(dialogueId) as Record<string, unknown> | undefined;
		return { success: true, value: row ? hydrateArchitectureDocument(row) : null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get a specific architecture document by ID.
 */
export function getArchitectureDocument(docId: string): Result<ArchitectureDocument> {
	try {
		const row = db().prepare(
			'SELECT * FROM architecture_documents WHERE doc_id = ?'
		).get(docId) as Record<string, unknown> | undefined;
		if (!row) {return { success: false, error: new Error(`ArchitectureDocument not found: ${docId}`) };}
		return { success: true, value: hydrateArchitectureDocument(row) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get the approved architecture document for a dialogue.
 */
export function getApprovedArchitectureDocument(
	dialogueId: string
): Result<ArchitectureDocument | null> {
	try {
		const row = db().prepare(
			"SELECT * FROM architecture_documents WHERE dialogue_id = ? AND status = 'APPROVED' ORDER BY version DESC LIMIT 1"
		).get(dialogueId) as Record<string, unknown> | undefined;
		return { success: true, value: row ? hydrateArchitectureDocument(row) : null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Update the full architecture document. Replaces the JSON snapshot
 * and repopulates all normalized lookup tables atomically.
 */
export function updateArchitectureDocument(
	docId: string,
	updates: Partial<Omit<ArchitectureDocument, 'doc_id' | 'dialogue_id' | 'created_at'>>
): Result<ArchitectureDocument> {
	try {
		const existing = getArchitectureDocument(docId);
		if (!existing.success) {return existing;}

		const merged: ArchitectureDocument = {
			...existing.value,
			...updates,
			updated_at: new Date().toISOString(),
		};

		const txn = db().transaction(() => {
			// 1. Update the JSON snapshot
			db().prepare(`
				UPDATE architecture_documents
				SET version = ?, document = ?, goal_alignment_score = ?, validation_findings = ?, status = ?, updated_at = ?
				WHERE doc_id = ?
			`).run(
				merged.version, JSON.stringify(merged), merged.goal_alignment_score,
				JSON.stringify(merged.validation_findings), merged.status,
				merged.updated_at, docId
			);

			// 2. Clear and repopulate lookup tables
			clearLookupTables(docId);
			populateLookupTables(merged);
		});
		txn();

		return { success: true, value: merged };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Update only the status of an architecture document.
 */
export function updateArchitectureDocumentStatus(
	docId: string,
	status: ArchitectureDocumentStatus
): Result<ArchitectureDocument> {
	try {
		const now = new Date().toISOString();
		db().prepare(
			'UPDATE architecture_documents SET status = ?, updated_at = ? WHERE doc_id = ?'
		).run(status, now, docId);
		return getArchitectureDocument(docId);
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Supersede all existing documents for a dialogue and create a new version.
 */
export function createNewVersion(
	dialogueId: string,
	doc: Omit<ArchitectureDocument, 'doc_id' | 'version' | 'created_at' | 'updated_at'>
): Result<ArchitectureDocument> {
	try {
		const txn = db().transaction(() => {
			// Mark all existing versions as SUPERSEDED
			db().prepare(
				"UPDATE architecture_documents SET status = 'SUPERSEDED', updated_at = datetime('now') WHERE dialogue_id = ? AND status != 'SUPERSEDED'"
			).run(dialogueId);

			// Get the latest version number
			const latest = db().prepare(
				'SELECT MAX(version) as max_version FROM architecture_documents WHERE dialogue_id = ?'
			).get(dialogueId) as { max_version: number | null } | undefined;
			const nextVersion = (latest?.max_version ?? 0) + 1;

			return nextVersion;
		});
		const nextVersion = txn();

		return createArchitectureDocument({
			...doc,
			dialogue_id: dialogueId,
			version: nextVersion,
		});
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== LOOKUP QUERIES ====================

/**
 * Get all capabilities for a document.
 */
export function getCapabilitiesForDocument(docId: string): Result<CapabilityNode[]> {
	try {
		const rows = db().prepare(
			'SELECT * FROM arch_capabilities WHERE doc_id = ?'
		).all(docId) as Record<string, unknown>[];

		const capabilities: CapabilityNode[] = rows.map(row => ({
			capability_id: row.capability_id as string,
			parent_capability_id: (row.parent_capability_id as string) || null,
			label: row.label as string,
			description: row.description as string,
			source_requirements: parseJSON<string[]>(row.source_requirements as string, []),
			domain_mappings: [], // Populated below
			workflows: [],      // Populated below
		}));

		// Populate domain mappings
		for (const cap of capabilities) {
			const mappingRows = db().prepare(
				'SELECT * FROM arch_domain_mappings WHERE capability_id = ? AND doc_id = ?'
			).all(cap.capability_id, docId) as Record<string, unknown>[];
			cap.domain_mappings = mappingRows.map(hydrateDomainMapping);

			const workflowRows = db().prepare(
				'SELECT workflow_id FROM arch_workflows WHERE capability_id = ? AND doc_id = ?'
			).all(cap.capability_id, docId) as { workflow_id: string }[];
			cap.workflows = workflowRows.map(w => w.workflow_id);
		}

		return { success: true, value: capabilities };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get all components for a document, optionally filtered by parent.
 */
export function getComponentsForDocument(
	docId: string,
	parentComponentId?: string | null
): Result<ComponentSpec[]> {
	try {
		let rows: Record<string, unknown>[];
		if (parentComponentId === undefined) {
			rows = db().prepare(
				'SELECT * FROM arch_components WHERE doc_id = ?'
			).all(docId) as Record<string, unknown>[];
		} else if (parentComponentId === null) {
			rows = db().prepare(
				'SELECT * FROM arch_components WHERE doc_id = ? AND parent_component_id IS NULL'
			).all(docId) as Record<string, unknown>[];
		} else {
			rows = db().prepare(
				'SELECT * FROM arch_components WHERE doc_id = ? AND parent_component_id = ?'
			).all(docId, parentComponentId) as Record<string, unknown>[];
		}

		return {
			success: true,
			value: rows.map(hydrateComponent),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get implementation steps for a document, ordered by sort_order.
 */
export function getImplementationStepsForDocument(docId: string): Result<ImplementationStep[]> {
	try {
		const rows = db().prepare(
			'SELECT * FROM arch_implementation_steps WHERE doc_id = ? ORDER BY sort_order ASC'
		).all(docId) as Record<string, unknown>[];

		return {
			success: true,
			value: rows.map(hydrateImplementationStep),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get domain mappings for a specific domain across a document.
 * Used by Historian for requirement coverage validation.
 */
export function getDomainMappingsForDomain(
	docId: string,
	domain: string
): Result<DomainCapabilityMapping[]> {
	try {
		const rows = db().prepare(
			'SELECT * FROM arch_domain_mappings WHERE doc_id = ? AND domain = ?'
		).all(docId, domain) as Record<string, unknown>[];
		return { success: true, value: rows.map(hydrateDomainMapping) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get all domain mappings for a document.
 * Used by Historian for completeness validation.
 */
export function getAllDomainMappings(docId: string): Result<DomainCapabilityMapping[]> {
	try {
		const rows = db().prepare(
			'SELECT * FROM arch_domain_mappings WHERE doc_id = ?'
		).all(docId) as Record<string, unknown>[];
		return { success: true, value: rows.map(hydrateDomainMapping) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Find orphan components — components that serve no workflow.
 * Used during structural consistency validation.
 */
export function findOrphanComponents(docId: string): Result<ComponentSpec[]> {
	try {
		const rows = db().prepare(
			"SELECT * FROM arch_components WHERE doc_id = ? AND workflows_served = '[]'"
		).all(docId) as Record<string, unknown>[];
		return { success: true, value: rows.map(hydrateComponent) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Find capabilities with no backing requirements (scope creep detection).
 */
export function findUnbackedCapabilities(docId: string): Result<CapabilityNode[]> {
	try {
		const rows = db().prepare(
			"SELECT * FROM arch_capabilities WHERE doc_id = ? AND source_requirements = '[]'"
		).all(docId) as Record<string, unknown>[];
		return {
			success: true,
			value: rows.map(row => ({
				capability_id: row.capability_id as string,
				parent_capability_id: (row.parent_capability_id as string) || null,
				label: row.label as string,
				description: row.description as string,
				source_requirements: [],
				domain_mappings: [],
				workflows: [],
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get capabilities filtered by parent.
 * null → top-level capabilities; string → children of that capability.
 */
export function getCapabilitiesForParent(
	docId: string,
	parentCapabilityId: string | null
): Result<CapabilityNode[]> {
	try {
		const query = parentCapabilityId === null
			? 'SELECT * FROM arch_capabilities WHERE doc_id = ? AND parent_capability_id IS NULL'
			: 'SELECT * FROM arch_capabilities WHERE doc_id = ? AND parent_capability_id = ?';
		const params = parentCapabilityId === null ? [docId] : [docId, parentCapabilityId];
		const rows = db().prepare(query).all(...params) as Record<string, unknown>[];

		const capabilities: CapabilityNode[] = rows.map(row => ({
			capability_id: row.capability_id as string,
			parent_capability_id: (row.parent_capability_id as string) || null,
			label: row.label as string,
			description: row.description as string,
			source_requirements: parseJSON<string[]>(row.source_requirements as string, []),
			domain_mappings: [],
			workflows: [],
		}));

		// Populate domain mappings and workflows
		for (const cap of capabilities) {
			const mappingRows = db().prepare(
				'SELECT * FROM arch_domain_mappings WHERE capability_id = ? AND doc_id = ?'
			).all(cap.capability_id, docId) as Record<string, unknown>[];
			cap.domain_mappings = mappingRows.map(hydrateDomainMapping);

			const workflowRows = db().prepare(
				'SELECT workflow_id FROM arch_workflows WHERE capability_id = ? AND doc_id = ?'
			).all(cap.capability_id, docId) as { workflow_id: string }[];
			cap.workflows = workflowRows.map(w => w.workflow_id);
		}

		return { success: true, value: capabilities };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== INTERNAL HELPERS ====================

/**
 * Populate all normalized lookup tables from an ArchitectureDocument.
 * Must be called within a transaction.
 */
function populateLookupTables(doc: ArchitectureDocument): void {
	const d = db();

	// Capabilities
	const insertCap = d.prepare(`
		INSERT INTO arch_capabilities (capability_id, doc_id, dialogue_id, label, description, source_requirements, parent_capability_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`);
	for (const cap of doc.capabilities) {
		insertCap.run(
			cap.capability_id, doc.doc_id, doc.dialogue_id,
			cap.label, cap.description,
			JSON.stringify(cap.source_requirements),
			cap.parent_capability_id ?? null
		);

		// Domain mappings for this capability
		const insertMapping = d.prepare(`
			INSERT INTO arch_domain_mappings (mapping_id, doc_id, domain, capability_id, requirement_ids, coverage_contribution)
			VALUES (?, ?, ?, ?, ?, ?)
		`);
		for (const mapping of cap.domain_mappings) {
			insertMapping.run(
				mapping.mapping_id, doc.doc_id, mapping.domain,
				mapping.capability_id, JSON.stringify(mapping.requirement_ids),
				mapping.coverage_contribution
			);
		}
	}

	// Workflows
	const insertWf = d.prepare(`
		INSERT INTO arch_workflows (workflow_id, doc_id, capability_id, label, description, actors)
		VALUES (?, ?, ?, ?, ?, ?)
	`);
	for (const wf of doc.workflow_graph) {
		insertWf.run(
			wf.workflow_id, doc.doc_id, wf.capability_id,
			wf.label, wf.description,
			JSON.stringify(wf.actors)
		);
	}

	// Components
	const insertComp = d.prepare(`
		INSERT INTO arch_components (component_id, doc_id, label, responsibility, rationale, workflows_served, dependencies, interaction_patterns, file_scope, parent_component_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	for (const comp of doc.components) {
		insertComp.run(
			comp.component_id, doc.doc_id, comp.label, comp.responsibility,
			comp.rationale || '',
			JSON.stringify(comp.workflows_served), JSON.stringify(comp.dependencies),
			JSON.stringify(comp.interaction_patterns || []),
			comp.file_scope, comp.parent_component_id
		);
	}

	// Implementation steps
	const insertStep = d.prepare(`
		INSERT INTO arch_implementation_steps (step_id, doc_id, label, description, components_involved, dependencies, estimated_complexity, verification_method, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	for (const step of doc.implementation_sequence) {
		insertStep.run(
			step.step_id, doc.doc_id, step.label, step.description,
			JSON.stringify(step.components_involved), JSON.stringify(step.dependencies),
			step.estimated_complexity, step.verification_method, step.sort_order
		);
	}
}

/**
 * Clear all normalized lookup tables for a document.
 * Must be called within a transaction.
 */
function clearLookupTables(docId: string): void {
	const d = db();
	// Order: children before parents (FK constraints)
	d.prepare('DELETE FROM arch_implementation_steps WHERE doc_id = ?').run(docId);
	d.prepare('DELETE FROM arch_components WHERE doc_id = ?').run(docId);
	d.prepare('DELETE FROM arch_workflows WHERE doc_id = ?').run(docId);
	d.prepare('DELETE FROM arch_domain_mappings WHERE doc_id = ?').run(docId);
	d.prepare('DELETE FROM arch_capabilities WHERE doc_id = ?').run(docId);
}

/**
 * Hydrate an ArchitectureDocument from the JSON snapshot column.
 */
function hydrateArchitectureDocument(row: Record<string, unknown>): ArchitectureDocument {
	const doc = parseJSON<ArchitectureDocument>(row.document as string, null as unknown as ArchitectureDocument);
	if (doc) {
		// Ensure DB-level fields are consistent with snapshot
		doc.doc_id = row.doc_id as string;
		doc.status = row.status as ArchitectureDocumentStatus;
		doc.goal_alignment_score = row.goal_alignment_score as number | null;
		doc.validation_findings = parseJSON<string[]>(row.validation_findings as string, []);
		doc.created_at = row.created_at as string;
		doc.updated_at = row.updated_at as string;
	}
	return doc;
}

function hydrateDomainMapping(row: Record<string, unknown>): DomainCapabilityMapping {
	return {
		mapping_id: row.mapping_id as string,
		domain: row.domain as DomainCapabilityMapping['domain'],
		capability_id: row.capability_id as string,
		requirement_ids: parseJSON<string[]>(row.requirement_ids as string, []),
		coverage_contribution: row.coverage_contribution as 'PRIMARY' | 'SECONDARY',
	};
}

function hydrateComponent(row: Record<string, unknown>): ComponentSpec {
	return {
		component_id: row.component_id as string,
		label: row.label as string,
		responsibility: row.responsibility as string,
		rationale: (row.rationale as string) || '',
		workflows_served: parseJSON<string[]>(row.workflows_served as string, []),
		dependencies: parseJSON<string[]>(row.dependencies as string, []),
		interaction_patterns: parseJSON<string[]>(row.interaction_patterns as string, []),
		technology_notes: (row.technology_notes as string) || '',
		file_scope: (row.file_scope as string) || '',
		parent_component_id: (row.parent_component_id as string) || null,
	};
}

function hydrateImplementationStep(row: Record<string, unknown>): ImplementationStep {
	return {
		step_id: row.step_id as string,
		label: row.label as string,
		description: row.description as string,
		components_involved: parseJSON<string[]>(row.components_involved as string, []),
		dependencies: parseJSON<string[]>(row.dependencies as string, []),
		estimated_complexity: row.estimated_complexity as ImplementationStep['estimated_complexity'],
		verification_method: row.verification_method as string,
		sort_order: row.sort_order as number,
	};
}
