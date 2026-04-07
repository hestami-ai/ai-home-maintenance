import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	storeHandoffDocument,
	getLatestHandoffDocument,
	getHandoffDocuments,
	getHandoffDocumentsSince,
	deleteHandoffDocuments,
} from '../../../lib/context/handoffDocStore';
import { HandoffDocType } from '../../../lib/context/engineTypes';
import type { IntakeHandoffContent, ArchitectureHandoffContent } from '../../../lib/context/engineTypes';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';

describe('Handoff Document Store', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	function mintDialogue(): string {
		const id = randomUUID();
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(id);
		return id;
	}


	const createMockIntakeContent = (): IntakeHandoffContent => ({
		type: 'INTAKE',
		goal: 'Build a REST API',
		finalizedPlan: { summary: 'API project' },
		humanDecisions: [{ action: 'APPROVE', rationale: 'Looks good' }],
		openLoops: [],
		mmpDecisions: null,
	});

	const createMockArchitectureContent = (): ArchitectureHandoffContent => ({
		type: 'ARCHITECTURE',
		documentVersion: 1,
		capabilities: [{ id: 'cap1', label: 'User Auth', requirements: ['JWT'] }],
		components: [{ id: 'comp1', label: 'API Gateway', responsibility: 'Route requests', dependencies: [] }],
		interfaces: [{ id: 'int1', label: 'REST API', type: 'REST', contract: null }],
		implementationSequence: [{ label: 'Phase 1', complexity: 'MEDIUM', components: ['comp1'] }],
		validationFindings: [],
	});

	describe('storeHandoffDocument', () => {
		it('stores handoff document successfully', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.doc_id).toBeDefined();
				expect(result.value.dialogue_id).toBe(dialogueId);
				expect(result.value.doc_type).toBe(HandoffDocType.INTAKE);
				expect(result.value.source_phase).toBe('INTAKE');
				expect(result.value.token_count).toBe(500);
				expect(result.value.event_watermark).toBe(10);
				expect(result.value.content).toEqual(content);
			}
		});

		it('stores architecture handoff document', () => {
			const dialogueId = mintDialogue();
			const content = createMockArchitectureContent();

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.ARCHITECTURE,
				'ARCHITECTURE',
				content,
				1000,
				20
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.doc_type).toBe(HandoffDocType.ARCHITECTURE);
				expect(result.value.content.type).toBe('ARCHITECTURE');
			}
		});

		it('generates unique document IDs', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const result1 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			const result2 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			expect(result1.success && result2.success).toBe(true);
			if (result1.success && result2.success) {
				expect(result1.value.doc_id).not.toBe(result2.value.doc_id);
			}
		});

		it('sets created_at timestamp', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.created_at).toBeDefined();
				expect(new Date(result.value.created_at).getTime()).toBeGreaterThan(0);
			}
		});

		it('stores multiple documents for same dialogue', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			const result1 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			const result2 = storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);

			expect(result1.success && result2.success).toBe(true);
		});

		it('preserves content structure through JSON serialization', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			content.finalizedPlan = { complex: { nested: { structure: 'value' } } };

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toEqual(content);
				expect((result.value.content as IntakeHandoffContent).finalizedPlan).toEqual(content.finalizedPlan);
			}
		});
	});

	describe('getLatestHandoffDocument', () => {
		it('retrieves latest document of given type', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			const result = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.token_count).toBe(600);
				expect(result.value.event_watermark).toBe(20);
			}
		});

		it('returns null when no documents exist', () => {
			const dialogueId = mintDialogue();

			const result = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('filters by document type', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);

			const result = getLatestHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.doc_type).toBe(HandoffDocType.ARCHITECTURE);
				expect(result.value.content.type).toBe('ARCHITECTURE');
			}
		});

		it('returns null for wrong dialogue ID', () => {
			const dialogueId1 = mintDialogue();
			const dialogueId2 = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId1, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			const result = getLatestHandoffDocument(dialogueId2, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('deserializes content correctly', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			content.openLoops = [
				{ category: 'technical', description: 'Decide on DB', priority: 'HIGH' },
			];

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			const result = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.content).toEqual(content);
				expect((result.value.content as IntakeHandoffContent).openLoops).toEqual(content.openLoops);
			}
		});
	});

	describe('getHandoffDocuments', () => {
		it('retrieves all documents for dialogue', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 600, 30);

			const result = getHandoffDocuments(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(3);
			}
		});

		it('filters by document type when specified', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 600, 30);

			const result = getHandoffDocuments(dialogueId, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
				expect(result.value.every(doc => doc.doc_type === HandoffDocType.INTAKE)).toBe(true);
			}
		});

		it('returns empty array when no documents exist', () => {
			const dialogueId = mintDialogue();

			const result = getHandoffDocuments(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('orders documents by created_at descending', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const doc1 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			const doc2 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);
			const doc3 = storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 700, 30);

			const result = getHandoffDocuments(dialogueId, HandoffDocType.INTAKE);

			expect(result.success).toBe(true);
			if (result.success && doc1.success && doc2.success && doc3.success) {
				expect(result.value[0].doc_id).toBe(doc3.value.doc_id);
				expect(result.value[1].doc_id).toBe(doc2.value.doc_id);
				expect(result.value[2].doc_id).toBe(doc1.value.doc_id);
			}
		});

		it('isolates documents by dialogue', () => {
			const dialogueId1 = mintDialogue();
			const dialogueId2 = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId1, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId1, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);
			storeHandoffDocument(dialogueId2, HandoffDocType.INTAKE, 'INTAKE', content, 700, 30);

			const result = getHandoffDocuments(dialogueId1);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
				expect(result.value.every(doc => doc.dialogue_id === dialogueId1)).toBe(true);
			}
		});
	});

	describe('getHandoffDocumentsSince', () => {
		it('retrieves documents after watermark', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 700, 30);

			const result = getHandoffDocumentsSince(dialogueId, 15);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
				expect(result.value.every(doc => doc.event_watermark > 15)).toBe(true);
			}
		});

		it('returns empty array when no documents after watermark', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			const result = getHandoffDocumentsSince(dialogueId, 50);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('excludes documents at exact watermark', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			const result = getHandoffDocumentsSince(dialogueId, 20);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(0);
			}
		});

		it('returns all documents when watermark is 0', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			const result = getHandoffDocumentsSince(dialogueId, 0);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
			}
		});

		it('includes all document types in results', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);

			const result = getHandoffDocumentsSince(dialogueId, 5);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
				const types = result.value.map(doc => doc.doc_type);
				expect(types).toContain(HandoffDocType.INTAKE);
				expect(types).toContain(HandoffDocType.ARCHITECTURE);
			}
		});
	});

	describe('deleteHandoffDocuments', () => {
		it('deletes all documents for dialogue', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			const deleteResult = deleteHandoffDocuments(dialogueId);

			expect(deleteResult.success).toBe(true);
			if (deleteResult.success) {
				expect(deleteResult.value).toBe(2);
			}

			const getResult = getHandoffDocuments(dialogueId);
			expect(getResult.success).toBe(true);
			if (getResult.success) {
				expect(getResult.value).toEqual([]);
			}
		});

		it('returns 0 when no documents to delete', () => {
			const dialogueId = mintDialogue();

			const result = deleteHandoffDocuments(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(0);
			}
		});

		it('does not affect other dialogues', () => {
			const dialogueId1 = mintDialogue();
			const dialogueId2 = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId1, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);
			storeHandoffDocument(dialogueId2, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			deleteHandoffDocuments(dialogueId1);

			const result = getHandoffDocuments(dialogueId2);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
			}
		});

		it('deletes documents of all types', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'ARCHITECTURE', archContent, 1000, 20);

			const deleteResult = deleteHandoffDocuments(dialogueId);

			expect(deleteResult.success).toBe(true);
			if (deleteResult.success) {
				expect(deleteResult.value).toBe(2);
			}
		});
	});

	describe('integration scenarios', () => {
		it('handles complete document lifecycle', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const storeResult = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);
			expect(storeResult.success).toBe(true);

			const getResult = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);
			expect(getResult.success).toBe(true);
			if (getResult.success) {
				expect(getResult.value).not.toBeNull();
			}

			const deleteResult = deleteHandoffDocuments(dialogueId);
			expect(deleteResult.success).toBe(true);

			const getFinalResult = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);
			expect(getFinalResult.success).toBe(true);
			if (getFinalResult.success) {
				expect(getFinalResult.value).toBeNull();
			}
		});

		it('handles phase progression with multiple handoffs', () => {
			const dialogueId = mintDialogue();
			const intakeContent = createMockIntakeContent();
			const archContent = createMockArchitectureContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', intakeContent, 500, 10);
			storeHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE, 'PROPOSE', archContent, 1000, 20);

			const allDocs = getHandoffDocuments(dialogueId);
			expect(allDocs.success).toBe(true);
			if (allDocs.success) {
				expect(allDocs.value.length).toBe(2);
			}

			const latestArch = getLatestHandoffDocument(dialogueId, HandoffDocType.ARCHITECTURE);
			expect(latestArch.success).toBe(true);
			if (latestArch.success && latestArch.value) {
				expect(latestArch.value.source_phase).toBe('PROPOSE');
			}
		});

		it('supports incremental document creation', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			const docs1 = getHandoffDocumentsSince(dialogueId, 0);
			expect(docs1.success && docs1.value.length).toBe(1);

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 600, 20);

			const docs2 = getHandoffDocumentsSince(dialogueId, 10);
			expect(docs2.success && docs2.value.length).toBe(1);
		});
	});

	describe('edge cases', () => {
		it('handles empty content arrays', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			content.openLoops = [];
			content.humanDecisions = [];

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect((result.value.content as IntakeHandoffContent).openLoops).toEqual([]);
				expect((result.value.content as IntakeHandoffContent).humanDecisions).toEqual([]);
			}
		});

		it('handles zero token count', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				0,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.token_count).toBe(0);
			}
		});

		it('handles very large token counts', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				1000000,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.token_count).toBe(1000000);
			}
		});

		it('handles null mmpDecisions field', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			content.mmpDecisions = null;

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect((result.value.content as IntakeHandoffContent).mmpDecisions).toBeNull();
			}
		});

		it('handles complex nested structures in content', () => {
			const dialogueId = mintDialogue();
			const content = createMockArchitectureContent();
			content.capabilities = [
				{
					id: 'complex',
					label: 'Complex Capability',
					requirements: Array.from({ length: 50 }, (_, i) => `req${i}`),
				},
			];

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.ARCHITECTURE,
				'ARCHITECTURE',
				content,
				2000,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				const arch = result.value.content as ArchitectureHandoffContent;
				expect(arch.capabilities[0].requirements.length).toBe(50);
			}
		});

		it('handles negative watermark query', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			storeHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE', content, 500, 10);

			const result = getHandoffDocumentsSince(dialogueId, -1);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
			}
		});

		it('handles very long source phase names', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			const longPhaseName = 'VERY_LONG_PHASE_NAME_'.repeat(10);

			const result = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				longPhaseName,
				content,
				500,
				10
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.source_phase).toBe(longPhaseName);
			}
		});
	});

	describe('data integrity', () => {
		it('preserves all document fields through storage and retrieval', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();
			content.goal = 'Complex goal with special chars: 日本語 & symbols!@#$%';

			const storeResult = storeHandoffDocument(
				dialogueId,
				HandoffDocType.INTAKE,
				'INTAKE',
				content,
				500,
				10
			);

			expect(storeResult.success).toBe(true);
			if (!storeResult.success) {return;}

			const getResult = getLatestHandoffDocument(dialogueId, HandoffDocType.INTAKE);

			expect(getResult.success).toBe(true);
			if (getResult.success && getResult.value) {
				expect(getResult.value.doc_id).toBe(storeResult.value.doc_id);
				expect(getResult.value.dialogue_id).toBe(storeResult.value.dialogue_id);
				expect(getResult.value.doc_type).toBe(storeResult.value.doc_type);
				expect(getResult.value.source_phase).toBe(storeResult.value.source_phase);
				expect(getResult.value.token_count).toBe(storeResult.value.token_count);
				expect(getResult.value.event_watermark).toBe(storeResult.value.event_watermark);
				expect(getResult.value.content).toEqual(storeResult.value.content);
				expect(getResult.value.created_at).toBe(storeResult.value.created_at);
			}
		});

		it('maintains document ordering consistency', () => {
			const dialogueId = mintDialogue();
			const content = createMockIntakeContent();

			for (let i = 0; i < 5; i++) {
				storeHandoffDocument(
					dialogueId,
					HandoffDocType.INTAKE,
					'INTAKE',
					content,
					500 + i * 100,
					10 + i * 10
				);
			}

			const allDocs = getHandoffDocuments(dialogueId);
			expect(allDocs.success).toBe(true);
			if (allDocs.success) {
				for (let i = 0; i < allDocs.value.length - 1; i++) {
					const current = new Date(allDocs.value[i].created_at);
					const next = new Date(allDocs.value[i + 1].created_at);
					expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
				}
			}
		});
	});
});
