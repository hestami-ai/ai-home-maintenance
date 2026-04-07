import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	upsertGeneratedDocument,
	getGeneratedDocument,
	getDocumentsForDialogue,
	deleteGeneratedDocument,
} from '../../../lib/documents/documentStore';
import { DocumentType } from '../../../lib/documents/types';
import { getDatabase } from '../../../lib/database/init';

describe('DocumentStore', () => {
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

	describe('upsertGeneratedDocument', () => {
		it('inserts a new document', () => {
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'Product Vision Document',
				'# Vision\n\nThis product will revolutionize...'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.document_type).toBe(DocumentType.VISION);
				expect(result.value.title).toBe('Product Vision Document');
				expect(result.value.content).toContain('revolutionize');
				expect(result.value.created_at).toBeDefined();
			}
		});

		it('replaces existing document on conflict', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'Original PRD',
				'Original content'
			);

			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'Updated PRD',
				'Updated content'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.title).toBe('Updated PRD');
				expect(result.value.content).toBe('Updated content');
			}

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
			).all(DLG_ID, DocumentType.PRD);

			expect(rows).toHaveLength(1);
		});

		it('allows different document types for same dialogue', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Vision', 'Vision content');
			upsertGeneratedDocument(DLG_ID, DocumentType.PRD, 'PRD', 'PRD content');
			upsertGeneratedDocument(DLG_ID, DocumentType.ARCHITECTURE, 'Arch', 'Arch content');

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM generated_documents WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(3);
		});

		it('handles all document types', () => {
			const types = [
				DocumentType.VISION,
				DocumentType.CONOPS,
				DocumentType.PRD,
				DocumentType.DOMAIN_MODEL,
				DocumentType.ARCHITECTURE,
				DocumentType.IMPLEMENTATION_ROADMAP,
				DocumentType.TECHNICAL_BRIEF,
				DocumentType.CHANGE_IMPACT,
				DocumentType.VERIFICATION_SUMMARY,
			];

			types.forEach((type, index) => {
				const result = upsertGeneratedDocument(
					DLG_ID,
					type,
					`Document ${index}`,
					`Content for ${type}`
				);
				expect(result.success).toBe(true);
			});

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM generated_documents WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(types.length);
		});

		it('handles long content', () => {
			const longContent = '# Long Document\n\n' + 'Lorem ipsum '.repeat(1000);
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'Long PRD',
				longContent
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe(longContent);
			}
		});

		it('updates timestamp on upsert', () => {
			const first = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'First',
				'First content'
			);

			const second = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'Second',
				'Second content'
			);

			expect(first.success && second.success).toBe(true);
			if (first.success && second.success) {
				expect(second.value.created_at).not.toBe(first.value.created_at);
			}
		});

		it('persists to database', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.ARCHITECTURE,
				'Architecture Doc',
				'# Architecture\n\nMicroservices...'
			);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
			).get(DLG_ID, DocumentType.ARCHITECTURE);

			expect(row).toBeDefined();
		});
	});

	describe('getGeneratedDocument', () => {
		it('retrieves an existing document', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.CONOPS,
				'CONOPS Document',
				'# Concept of Operations'
			);

			const result = getGeneratedDocument(DLG_ID, DocumentType.CONOPS);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.document_type).toBe(DocumentType.CONOPS);
				expect(result.value.title).toBe('CONOPS Document');
			}
		});

		it('returns null for non-existent document', () => {
			const result = getGeneratedDocument(DLG_ID, DocumentType.VISION);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('returns null for non-existent dialogue', () => {
			const result = getGeneratedDocument('non-existent-dialogue', DocumentType.VISION);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('retrieves correct document type', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Vision', 'Vision content');
			upsertGeneratedDocument(DLG_ID, DocumentType.PRD, 'PRD', 'PRD content');

			const vision = getGeneratedDocument(DLG_ID, DocumentType.VISION);
			const prd = getGeneratedDocument(DLG_ID, DocumentType.PRD);

			expect(vision.success && vision.value?.title).toBe('Vision');
			expect(prd.success && prd.value?.title).toBe('PRD');
		});

		it('includes all fields', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.TECHNICAL_BRIEF,
				'Tech Brief',
				'# Technical Details'
			);

			const result = getGeneratedDocument(DLG_ID, DocumentType.TECHNICAL_BRIEF);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.id).toBeDefined();
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.document_type).toBe(DocumentType.TECHNICAL_BRIEF);
				expect(result.value.title).toBe('Tech Brief');
				expect(result.value.content).toBe('# Technical Details');
				expect(result.value.created_at).toBeDefined();
			}
		});
	});

	describe('getDocumentsForDialogue', () => {
		it('returns empty array when no documents exist', () => {
			const result = getDocumentsForDialogue(DLG_ID);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('retrieves all documents for a dialogue', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Vision', 'Vision content');
			upsertGeneratedDocument(DLG_ID, DocumentType.PRD, 'PRD', 'PRD content');
			upsertGeneratedDocument(DLG_ID, DocumentType.ARCHITECTURE, 'Arch', 'Arch content');

			const result = getDocumentsForDialogue(DLG_ID);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(3);
			}
		});

		it('orders documents by created_at descending', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'First', 'Content 1');
			upsertGeneratedDocument(DLG_ID, DocumentType.PRD, 'Second', 'Content 2');
			upsertGeneratedDocument(DLG_ID, DocumentType.CONOPS, 'Third', 'Content 3');

			const result = getDocumentsForDialogue(DLG_ID);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].title).toBe('Third');
				expect(result.value[1].title).toBe('Second');
				expect(result.value[2].title).toBe('First');
			}
		});

		it('isolates documents by dialogue_id', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Doc 1', 'Content 1');
			upsertGeneratedDocument(DLG_ID_2, DocumentType.VISION, 'Doc 2', 'Content 2');

			const result1 = getDocumentsForDialogue(DLG_ID);
			const result2 = getDocumentsForDialogue(DLG_ID_2);

			expect(result1.success && result1.value).toHaveLength(1);
			expect(result2.success && result2.value).toHaveLength(1);

			if (result1.success && result2.success) {
				expect(result1.value[0].title).toBe('Doc 1');
				expect(result2.value[0].title).toBe('Doc 2');
			}
		});

		it('returns all document types', () => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Vision', 'Content');
			upsertGeneratedDocument(DLG_ID, DocumentType.DOMAIN_MODEL, 'Model', 'Content');
			upsertGeneratedDocument(DLG_ID, DocumentType.CHANGE_IMPACT, 'Impact', 'Content');

			const result = getDocumentsForDialogue(DLG_ID);

			expect(result.success).toBe(true);
			if (result.success) {
				const types = result.value.map(d => d.document_type);
				expect(types).toContain(DocumentType.VISION);
				expect(types).toContain(DocumentType.DOMAIN_MODEL);
				expect(types).toContain(DocumentType.CHANGE_IMPACT);
			}
		});
	});

	describe('deleteGeneratedDocument', () => {
		beforeEach(() => {
			upsertGeneratedDocument(DLG_ID, DocumentType.VISION, 'Vision', 'Content');
			upsertGeneratedDocument(DLG_ID, DocumentType.PRD, 'PRD', 'Content');
		});

		it('deletes a specific document', () => {
			const result = deleteGeneratedDocument(DLG_ID, DocumentType.VISION);

			expect(result.success).toBe(true);

			const remaining = getDocumentsForDialogue(DLG_ID);
			if (remaining.success) {
				expect(remaining.value).toHaveLength(1);
				expect(remaining.value[0].document_type).toBe(DocumentType.PRD);
			}
		});

		it('only deletes specified document type', () => {
			deleteGeneratedDocument(DLG_ID, DocumentType.VISION);

			const visionCheck = getGeneratedDocument(DLG_ID, DocumentType.VISION);
			const prdCheck = getGeneratedDocument(DLG_ID, DocumentType.PRD);

			expect(visionCheck.success && visionCheck.value).toBeNull();
			expect(prdCheck.success && prdCheck.value).not.toBeNull();
		});

		it('succeeds when document does not exist', () => {
			const result = deleteGeneratedDocument(DLG_ID, DocumentType.CONOPS);
			expect(result.success).toBe(true);
		});

		it('does not affect other dialogues', () => {
			upsertGeneratedDocument(DLG_ID_2, DocumentType.VISION, 'Vision 2', 'Content 2');

			deleteGeneratedDocument(DLG_ID, DocumentType.VISION);

			const dlg2Docs = getDocumentsForDialogue(DLG_ID_2);
			expect(dlg2Docs.success && dlg2Docs.value).toHaveLength(1);
		});

		it('removes document from database', () => {
			deleteGeneratedDocument(DLG_ID, DocumentType.VISION);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
			).get(DLG_ID, DocumentType.VISION);

			expect(row).toBeUndefined();
		});
	});

	describe('document lifecycle workflows', () => {
		it('simulates document generation and regeneration', () => {
			const initial = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.IMPLEMENTATION_ROADMAP,
				'Implementation Roadmap v1',
				'# Roadmap\n\n## Phase 1\n- Step 1\n- Step 2'
			);

			expect(initial.success).toBe(true);

			const retrieved = getGeneratedDocument(DLG_ID, DocumentType.IMPLEMENTATION_ROADMAP);
			expect(retrieved.success && retrieved.value?.title).toBe('Implementation Roadmap v1');

			const regenerated = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.IMPLEMENTATION_ROADMAP,
				'Implementation Roadmap v2',
				'# Roadmap\n\n## Phase 1\n- Step 1\n- Step 2\n## Phase 2\n- Step 3'
			);

			expect(regenerated.success).toBe(true);
			if (regenerated.success) {
				expect(regenerated.value.title).toBe('Implementation Roadmap v2');
				expect(regenerated.value.content).toContain('Phase 2');
			}
		});

		it('simulates generating multiple documents for product discovery', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'Product Vision',
				'# Vision\n\nRevolutionary healthcare platform...'
			);

			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.CONOPS,
				'Concept of Operations',
				'# CONOPS\n\n## User Workflows...'
			);

			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'Product Requirements',
				'# PRD\n\n## Features\n- Feature 1\n- Feature 2'
			);

			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.DOMAIN_MODEL,
				'Domain Model',
				'# Domain Model\n\n## Entities\n- User\n- Patient\n- Appointment'
			);

			const allDocs = getDocumentsForDialogue(DLG_ID);
			expect(allDocs.success && allDocs.value).toHaveLength(4);
		});

		it('simulates document export workflow', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VERIFICATION_SUMMARY,
				'Verification Summary',
				'# Verification Summary\n\n## Test Results\n- All tests passed'
			);

			const doc = getGeneratedDocument(DLG_ID, DocumentType.VERIFICATION_SUMMARY);

			expect(doc.success).toBe(true);
			if (doc.success && doc.value) {
				expect(doc.value.content).toBeDefined();
				expect(doc.value.title).toBe('Verification Summary');
			}
		});

		it('simulates document deletion after export', () => {
			upsertGeneratedDocument(
				DLG_ID,
				DocumentType.TECHNICAL_BRIEF,
				'Technical Brief',
				'# Brief\n\nTechnical details...'
			);

			const beforeDelete = getDocumentsForDialogue(DLG_ID);
			expect(beforeDelete.success && beforeDelete.value).toHaveLength(1);

			deleteGeneratedDocument(DLG_ID, DocumentType.TECHNICAL_BRIEF);

			const afterDelete = getDocumentsForDialogue(DLG_ID);
			expect(afterDelete.success && afterDelete.value).toEqual([]);
		});

		it('handles rapid regeneration of same document type', () => {
			for (let i = 1; i <= 5; i++) {
				upsertGeneratedDocument(
					DLG_ID,
					DocumentType.ARCHITECTURE,
					`Architecture v${i}`,
					`# Architecture Version ${i}\n\nContent...`
				);
			}

			const final = getGeneratedDocument(DLG_ID, DocumentType.ARCHITECTURE);
			expect(final.success && final.value?.title).toBe('Architecture v5');

			const allDocs = getDocumentsForDialogue(DLG_ID);
			expect(allDocs.success && allDocs.value).toHaveLength(1);
		});

		it('maintains document history via timestamp updates', () => {
			const v1 = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'PRD v1',
				'Content v1'
			);

			const v2 = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'PRD v2',
				'Content v2'
			);

			expect(v1.success && v2.success).toBe(true);
			if (v1.success && v2.success) {
				const timestamp1 = new Date(v1.value.created_at);
				const timestamp2 = new Date(v2.value.created_at);
				expect(timestamp2.getTime()).toBeGreaterThanOrEqual(timestamp1.getTime());
			}
		});
	});

	describe('edge cases', () => {
		it('handles empty content', () => {
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'Empty Vision',
				''
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('');
			}
		});

		it('handles special characters in title', () => {
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.PRD,
				'PRD: "Special" & <Characters>',
				'Content'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.title).toBe('PRD: "Special" & <Characters>');
			}
		});

		it('handles markdown with code blocks', () => {
			const content = `# Code Example

\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`
`;
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.TECHNICAL_BRIEF,
				'Code Example',
				content
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toContain('```typescript');
			}
		});

		it('handles unicode characters', () => {
			const result = upsertGeneratedDocument(
				DLG_ID,
				DocumentType.VISION,
				'Vision 文档 📄',
				'# Vision\n\n中文内容 🚀'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.title).toContain('文档');
				expect(result.value.content).toContain('中文内容');
			}
		});
	});
});
