import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	createArchitectureDocument,
	deleteArchitectureDocument,
	getArchitectureDocumentForDialogue,
	getArchitectureDocument,
	getApprovedArchitectureDocument,
	updateArchitectureDocument,
	updateArchitectureDocumentStatus,
	createNewVersion,
	getCapabilitiesForDocument,
	getComponentsForDocument,
	getImplementationStepsForDocument,
	getDomainMappingsForDomain,
	getAllDomainMappings,
	findOrphanComponents,
	findUnbackedCapabilities,
	getCapabilitiesForParent,
} from '../../../lib/database/architectureStore';
import type { ArchitectureDocument } from '../../../lib/types/architecture';
import { ArchitectureDocumentStatus } from '../../../lib/types/architecture';
import { EngineeringDomain } from '../../../lib/types/intake';
import { getDatabase } from '../../../lib/database/init';

describe('ArchitectureStore', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(DLG_ID);
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal 2', 'ACTIVE', datetime('now'))"
		).run(DLG_ID_2);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	function createMinimalDoc(dialogueId: string): Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> {
		return {
			dialogue_id: dialogueId,
			version: 1,
			status: ArchitectureDocumentStatus.DRAFT,
			goal_alignment_score: null,
			validation_findings: [],
			capabilities: [],
			workflow_graph: [],
			components: [],
			data_models: [],
			interfaces: [],
			implementation_sequence: [],
		};
	}

	describe('createArchitectureDocument', () => {
		it('creates a document with generated doc_id and timestamps', () => {
			const doc = createMinimalDoc(DLG_ID);
			const result = createArchitectureDocument(doc);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.doc_id).toBeDefined();
				expect(result.value.doc_id).toHaveLength(36); // UUID
				expect(result.value.created_at).toBeDefined();
				expect(result.value.updated_at).toBeDefined();
				expect(result.value.dialogue_id).toBe(DLG_ID);
			}
		});

		it('populates normalized lookup tables', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'User Management',
						description: 'Manage users',
						source_requirements: ['REQ-1'],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const result = createArchitectureDocument(doc);
			expect(result.success).toBe(true);
			if (!result.success) { return; }

			const db = getDatabase()!;
			const caps = db.prepare(
				'SELECT * FROM arch_capabilities WHERE doc_id = ?'
			).all(result.value.doc_id);

			expect(caps).toHaveLength(1);
		});

		it('handles hierarchical capabilities with parent-child relationships', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-PARENT',
						parent_capability_id: null,
						label: 'Parent Capability',
						description: 'Parent',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
					{
						capability_id: 'CAP-CHILD',
						parent_capability_id: 'CAP-PARENT',
						label: 'Child Capability',
						description: 'Child',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const result = createArchitectureDocument(doc);
			expect(result.success).toBe(true);
			if (!result.success) { return; }

			const db = getDatabase()!;
			const child = db.prepare(
				"SELECT * FROM arch_capabilities WHERE capability_id = 'CAP-CHILD'"
			).get() as { parent_capability_id: string | null } | undefined;

			expect(child).toBeDefined();
			expect(child?.parent_capability_id).toBe('CAP-PARENT');
		});
	});

	describe('deleteArchitectureDocument', () => {
		it('deletes document and all lookup table data', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'Test',
						description: 'Test',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const deleteResult = deleteArchitectureDocument(created.value.doc_id);
			expect(deleteResult.success).toBe(true);

			const db = getDatabase()!;
			const docRow = db.prepare(
				'SELECT * FROM architecture_documents WHERE doc_id = ?'
			).get(created.value.doc_id);
			expect(docRow).toBeUndefined();

			const caps = db.prepare(
				'SELECT * FROM arch_capabilities WHERE doc_id = ?'
			).all(created.value.doc_id);
			expect(caps).toHaveLength(0);
		});
	});

	describe('getArchitectureDocumentForDialogue', () => {
		it('returns latest version when multiple exist', () => {
			const doc1 = createArchitectureDocument({ ...createMinimalDoc(DLG_ID), version: 1 });
			const doc2 = createArchitectureDocument({ ...createMinimalDoc(DLG_ID), version: 2 });

			expect(doc1.success).toBe(true);
			expect(doc2.success).toBe(true);

			const result = getArchitectureDocumentForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.version).toBe(2);
			}
		});

		it('returns null when no document exists', () => {
			const result = getArchitectureDocumentForDialogue('non-existent');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getArchitectureDocument', () => {
		it('retrieves document by doc_id', () => {
			const created = createArchitectureDocument(createMinimalDoc(DLG_ID));
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getArchitectureDocument(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.doc_id).toBe(created.value.doc_id);
			}
		});

		it('returns error for non-existent doc_id', () => {
			const result = getArchitectureDocument('non-existent');
			expect(result.success).toBe(false);
		});
	});

	describe('getApprovedArchitectureDocument', () => {
		it('returns only APPROVED documents', () => {
			createArchitectureDocument({ ...createMinimalDoc(DLG_ID), version: 1, status: ArchitectureDocumentStatus.DRAFT });
			const approved = createArchitectureDocument({ ...createMinimalDoc(DLG_ID), version: 2, status: ArchitectureDocumentStatus.APPROVED });

			expect(approved.success).toBe(true);

			const result = getApprovedArchitectureDocument(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.status).toBe(ArchitectureDocumentStatus.APPROVED);
				expect(result.value.version).toBe(2);
			}
		});

		it('returns null when no approved document exists', () => {
			createArchitectureDocument({ ...createMinimalDoc(DLG_ID), status: ArchitectureDocumentStatus.DRAFT });

			const result = getApprovedArchitectureDocument(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('updateArchitectureDocument', () => {
		it('updates document and repopulates lookup tables', () => {
			const initial = createArchitectureDocument({
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'Original',
						description: 'Original',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			});
			expect(initial.success).toBe(true);
			if (!initial.success) { return; }

			const updated = updateArchitectureDocument(initial.value.doc_id, {
				capabilities: [
					{
						capability_id: 'CAP-2',
						parent_capability_id: null,
						label: 'Updated',
						description: 'Updated',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			});

			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.capabilities).toHaveLength(1);
				expect(updated.value.capabilities[0].label).toBe('Updated');
			}

			const db = getDatabase()!;
			const caps = db.prepare(
				'SELECT * FROM arch_capabilities WHERE doc_id = ?'
			).all(initial.value.doc_id);
			expect(caps).toHaveLength(1);
			expect((caps[0] as { capability_id: string }).capability_id).toBe('CAP-2');
		});

		it('updates updated_at timestamp', () => {
			const created = createArchitectureDocument(createMinimalDoc(DLG_ID));
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const originalTimestamp = created.value.updated_at;

			const updated = updateArchitectureDocument(created.value.doc_id, { goal_alignment_score: 0.95 });
			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.updated_at).not.toBe(originalTimestamp);
			}
		});
	});

	describe('updateArchitectureDocumentStatus', () => {
		it('updates status field', () => {
			const created = createArchitectureDocument({ ...createMinimalDoc(DLG_ID), status: ArchitectureDocumentStatus.DRAFT });
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const updated = updateArchitectureDocumentStatus(created.value.doc_id, ArchitectureDocumentStatus.APPROVED);
			expect(updated.success).toBe(true);
			if (updated.success) {
				expect(updated.value.status).toBe(ArchitectureDocumentStatus.APPROVED);
			}
		});
	});

	describe('createNewVersion', () => {
		it('supersedes existing documents and creates new version', () => {
			const v1 = createArchitectureDocument({ ...createMinimalDoc(DLG_ID), version: 1 });
			expect(v1.success).toBe(true);

			const v2Result = createNewVersion(DLG_ID, {
				dialogue_id: DLG_ID,
				status: ArchitectureDocumentStatus.DRAFT,
				goal_alignment_score: null,
				validation_findings: [],
				capabilities: [],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
			});

			expect(v2Result.success).toBe(true);
			if (v2Result.success) {
				expect(v2Result.value.version).toBe(2);
			}

			const db = getDatabase()!;
			const v1Row = db.prepare(
				'SELECT status FROM architecture_documents WHERE version = 1 AND dialogue_id = ?'
			).get(DLG_ID) as { status: string } | undefined;

			expect(v1Row?.status).toBe(ArchitectureDocumentStatus.SUPERSEDED);
		});
	});

	describe('getCapabilitiesForDocument', () => {
		it('retrieves capabilities with domain mappings and workflows', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'User Auth',
						description: 'Authentication',
						source_requirements: ['REQ-1'],
						engineering_domain_mappings: [
							{
								mapping_id: 'MAP-1',
								domain: EngineeringDomain.SECURITY_COMPLIANCE,
								capability_id: 'CAP-1',
								requirement_ids: ['REQ-1'],
								coverage_contribution: 'PRIMARY',
							},
						],
						workflows: ['WF-1'],
					},
				],
				workflow_graph: [
					{
						workflow_id: 'WF-1',
						capability_id: 'CAP-1',
						label: 'Login',
						description: 'Login workflow',
						actors: ['User'],
						steps: [],
						triggers: [],
						outputs: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getCapabilitiesForDocument(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].label).toBe('User Auth');
				expect(result.value[0].engineering_domain_mappings).toHaveLength(1);
				expect(result.value[0].workflows).toContain('WF-1');
			}
		});
	});

	describe('getComponentsForDocument', () => {
		it('retrieves all components when no parent filter', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				components: [
					{
						component_id: 'COMP-1',
						parent_component_id: null,
						label: 'AuthService',
						responsibility: 'Handle auth',
						rationale: 'Security',
						workflows_served: [],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getComponentsForDocument(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].label).toBe('AuthService');
			}
		});

		it('filters components by parent_component_id', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				components: [
					{
						component_id: 'COMP-PARENT',
						parent_component_id: null,
						label: 'Parent',
						responsibility: 'Parent',
						rationale: '',
						workflows_served: [],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
					},
					{
						component_id: 'COMP-CHILD',
						parent_component_id: 'COMP-PARENT',
						label: 'Child',
						responsibility: 'Child',
						rationale: '',
						workflows_served: [],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const children = getComponentsForDocument(created.value.doc_id, 'COMP-PARENT');
			expect(children.success).toBe(true);
			if (children.success) {
				expect(children.value).toHaveLength(1);
				expect(children.value[0].component_id).toBe('COMP-CHILD');
			}

			const topLevel = getComponentsForDocument(created.value.doc_id, null);
			expect(topLevel.success).toBe(true);
			if (topLevel.success) {
				expect(topLevel.value).toHaveLength(1);
				expect(topLevel.value[0].component_id).toBe('COMP-PARENT');
			}
		});
	});

	describe('getImplementationStepsForDocument', () => {
		it('retrieves steps ordered by sort_order', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				implementation_sequence: [
					{
						step_id: 'STEP-2',
						label: 'Second',
						description: 'Second step',
						components_involved: [],
						dependencies: [],
						estimated_complexity: 'MEDIUM',
						verification_method: 'Test',
						sort_order: 2,
					},
					{
						step_id: 'STEP-1',
						label: 'First',
						description: 'First step',
						components_involved: [],
						dependencies: [],
						estimated_complexity: 'LOW',
						verification_method: 'Test',
						sort_order: 1,
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getImplementationStepsForDocument(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].step_id).toBe('STEP-1');
				expect(result.value[1].step_id).toBe('STEP-2');
			}
		});
	});

	describe('getDomainMappingsForDomain', () => {
		it('filters mappings by domain', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'Test',
						description: 'Test',
						source_requirements: [],
						engineering_domain_mappings: [
							{
								mapping_id: 'MAP-1',
								domain: EngineeringDomain.SECURITY_COMPLIANCE,
								capability_id: 'CAP-1',
								requirement_ids: [],
								coverage_contribution: 'PRIMARY',
							},
							{
								mapping_id: 'MAP-2',
								domain: EngineeringDomain.DATA_INFORMATION,
								capability_id: 'CAP-1',
								requirement_ids: [],
								coverage_contribution: 'SECONDARY',
							},
						],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getDomainMappingsForDomain(created.value.doc_id, EngineeringDomain.SECURITY_COMPLIANCE);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].domain).toBe(EngineeringDomain.SECURITY_COMPLIANCE);
			}
		});
	});

	describe('getAllDomainMappings', () => {
		it('retrieves all mappings for a document', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-1',
						parent_capability_id: null,
						label: 'Test',
						description: 'Test',
						source_requirements: [],
						engineering_domain_mappings: [
							{
								mapping_id: 'MAP-1',
								domain: EngineeringDomain.SECURITY_COMPLIANCE,
								capability_id: 'CAP-1',
								requirement_ids: [],
								coverage_contribution: 'PRIMARY',
							},
							{
								mapping_id: 'MAP-2',
								domain: EngineeringDomain.DATA_INFORMATION,
								capability_id: 'CAP-1',
								requirement_ids: [],
								coverage_contribution: 'SECONDARY',
							},
						],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = getAllDomainMappings(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});
	});

	describe('findOrphanComponents', () => {
		it('finds components with empty workflows_served', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				components: [
					{
						component_id: 'COMP-ORPHAN',
						parent_component_id: null,
						label: 'Orphan',
						responsibility: 'Nothing',
						rationale: '',
						workflows_served: [],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
					},
					{
						component_id: 'COMP-USED',
						parent_component_id: null,
						label: 'Used',
						responsibility: 'Something',
						rationale: '',
						workflows_served: ['WF-1'],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = findOrphanComponents(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].component_id).toBe('COMP-ORPHAN');
			}
		});
	});

	describe('findUnbackedCapabilities', () => {
		it('finds capabilities with empty source_requirements', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-UNBACKED',
						parent_capability_id: null,
						label: 'Unbacked',
						description: 'No requirements',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
					{
						capability_id: 'CAP-BACKED',
						parent_capability_id: null,
						label: 'Backed',
						description: 'Has requirements',
						source_requirements: ['REQ-1'],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const result = findUnbackedCapabilities(created.value.doc_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].capability_id).toBe('CAP-UNBACKED');
			}
		});
	});

	describe('getCapabilitiesForParent', () => {
		it('retrieves top-level capabilities when parent is null', () => {
			const doc: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-TOP',
						parent_capability_id: null,
						label: 'Top',
						description: 'Top level',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
					{
						capability_id: 'CAP-CHILD',
						parent_capability_id: 'CAP-TOP',
						label: 'Child',
						description: 'Child level',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const topLevel = getCapabilitiesForParent(created.value.doc_id, null);
			expect(topLevel.success).toBe(true);
			if (topLevel.success) {
				expect(topLevel.value).toHaveLength(1);
				expect(topLevel.value[0].capability_id).toBe('CAP-TOP');
			}

			const children = getCapabilitiesForParent(created.value.doc_id, 'CAP-TOP');
			expect(children.success).toBe(true);
			if (children.success) {
				expect(children.value).toHaveLength(1);
				expect(children.value[0].capability_id).toBe('CAP-CHILD');
			}
		});
	});

	describe('lookup table atomicity', () => {
		it('clears stale lookup entries when updating document', () => {
			const doc1: Omit<ArchitectureDocument, 'doc_id' | 'created_at' | 'updated_at'> = {
				...createMinimalDoc(DLG_ID),
				capabilities: [
					{
						capability_id: 'CAP-OLD',
						parent_capability_id: null,
						label: 'Old',
						description: 'Old cap',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			};

			const created = createArchitectureDocument(doc1);
			expect(created.success).toBe(true);
			if (!created.success) { return; }

			const updated = updateArchitectureDocument(created.value.doc_id, {
				capabilities: [
					{
						capability_id: 'CAP-NEW',
						parent_capability_id: null,
						label: 'New',
						description: 'New cap',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: [],
					},
				],
			});
			expect(updated.success).toBe(true);

			const db = getDatabase()!;
			const oldCap = db.prepare(
				"SELECT * FROM arch_capabilities WHERE capability_id = 'CAP-OLD'"
			).get();
			expect(oldCap).toBeUndefined();

			const newCap = db.prepare(
				"SELECT * FROM arch_capabilities WHERE capability_id = 'CAP-NEW'"
			).get();
			expect(newCap).toBeDefined();
		});
	});
});
