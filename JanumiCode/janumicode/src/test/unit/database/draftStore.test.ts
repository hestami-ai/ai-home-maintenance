import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	saveDraftsBatch,
	getDrafts,
	deleteAllDrafts,
	deleteDraftsByCategory,
	type DraftEntry,
} from '../../../lib/database/draftStore';
import { getDatabase } from '../../../lib/database/init';

describe('DraftStore', () => {
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

	describe('saveDraftsBatch', () => {
		it('saves a single draft entry', () => {
			const drafts: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-123', value: 'This looks good' },
			];

			const result = saveDraftsBatch(DLG_ID, drafts);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ? AND category = ? AND item_key = ?'
			).get(DLG_ID, 'gate_rationale', 'gate-123') as { value: string } | undefined;

			expect(row).toBeDefined();
			expect(row?.value).toBe('This looks good');
		});

		it('saves multiple draft entries in one transaction', () => {
			const drafts: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Rationale 1' },
				{ category: 'gate_rationale', itemKey: 'gate-2', value: 'Rationale 2' },
				{ category: 'intake_response', itemKey: 'response-1', value: 'Answer 1' },
			];

			const result = saveDraftsBatch(DLG_ID, drafts);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(3);
		});

		it('updates existing draft on conflict', () => {
			const drafts1: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Original value' },
			];
			saveDraftsBatch(DLG_ID, drafts1);

			const drafts2: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Updated value' },
			];
			const result = saveDraftsBatch(DLG_ID, drafts2);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(1);
			expect((rows[0] as { value: string }).value).toBe('Updated value');
		});

		it('handles empty drafts array', () => {
			const result = saveDraftsBatch(DLG_ID, []);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(0);
		});

		it('isolates drafts by dialogue_id', () => {
			const drafts1: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value1' },
			];
			const drafts2: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value2' },
			];

			saveDraftsBatch(DLG_ID, drafts1);
			saveDraftsBatch(DLG_ID_2, drafts2);

			const db = getDatabase()!;
			const rows1 = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);
			const rows2 = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows1).toHaveLength(1);
			expect(rows2).toHaveLength(1);
			expect((rows1[0] as { value: string }).value).toBe('value1');
			expect((rows2[0] as { value: string }).value).toBe('value2');
		});

		it('updates updated_at timestamp on upsert', () => {
			const drafts: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'original' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			const db = getDatabase()!;
			const row1 = db.prepare(
				'SELECT updated_at FROM webview_drafts WHERE dialogue_id = ? AND category = ? AND item_key = ?'
			).get(DLG_ID, 'test', 'key1') as { updated_at: string } | undefined;

			const timestamp1 = row1?.updated_at;

			const draftsUpdate: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'updated' },
			];
			saveDraftsBatch(DLG_ID, draftsUpdate);

			const row2 = db.prepare(
				'SELECT updated_at FROM webview_drafts WHERE dialogue_id = ? AND category = ? AND item_key = ?'
			).get(DLG_ID, 'test', 'key1') as { updated_at: string } | undefined;

			const timestamp2 = row2?.updated_at;

			expect(timestamp1).toBeDefined();
			expect(timestamp2).toBeDefined();
			expect(timestamp2! >= timestamp1!).toBe(true);
		});
	});

	describe('getDrafts', () => {
		it('returns empty object when no drafts exist', () => {
			const result = getDrafts(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual({});
			}
		});

		it('retrieves drafts grouped by category', () => {
			const drafts: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Rationale 1' },
				{ category: 'gate_rationale', itemKey: 'gate-2', value: 'Rationale 2' },
				{ category: 'intake_response', itemKey: 'resp-1', value: 'Answer 1' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			const result = getDrafts(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.keys(result.value)).toHaveLength(2);
				expect(result.value['gate_rationale']).toEqual({
					'gate-1': 'Rationale 1',
					'gate-2': 'Rationale 2',
				});
				expect(result.value['intake_response']).toEqual({
					'resp-1': 'Answer 1',
				});
			}
		});

		it('returns only drafts for specified dialogue', () => {
			const drafts1: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'dlg1-value' },
			];
			const drafts2: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'dlg2-value' },
			];

			saveDraftsBatch(DLG_ID, drafts1);
			saveDraftsBatch(DLG_ID_2, drafts2);

			const result = getDrafts(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value['test']['key1']).toBe('dlg1-value');
			}
		});

		it('handles multiple item keys in same category', () => {
			const drafts: DraftEntry[] = [
				{ category: 'attachments', itemKey: 'file1.txt', value: '/path/to/file1' },
				{ category: 'attachments', itemKey: 'file2.txt', value: '/path/to/file2' },
				{ category: 'attachments', itemKey: 'file3.txt', value: '/path/to/file3' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			const result = getDrafts(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.keys(result.value['attachments'])).toHaveLength(3);
				expect(result.value['attachments']['file1.txt']).toBe('/path/to/file1');
				expect(result.value['attachments']['file2.txt']).toBe('/path/to/file2');
				expect(result.value['attachments']['file3.txt']).toBe('/path/to/file3');
			}
		});
	});

	describe('deleteAllDrafts', () => {
		it('deletes all drafts for a dialogue', () => {
			const drafts: DraftEntry[] = [
				{ category: 'cat1', itemKey: 'key1', value: 'value1' },
				{ category: 'cat2', itemKey: 'key2', value: 'value2' },
				{ category: 'cat3', itemKey: 'key3', value: 'value3' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			const result = deleteAllDrafts(DLG_ID);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(0);
		});

		it('does not delete drafts from other dialogues', () => {
			const drafts1: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value1' },
			];
			const drafts2: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value2' },
			];

			saveDraftsBatch(DLG_ID, drafts1);
			saveDraftsBatch(DLG_ID_2, drafts2);

			deleteAllDrafts(DLG_ID);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows).toHaveLength(1);
		});

		it('succeeds when no drafts exist', () => {
			const result = deleteAllDrafts(DLG_ID);
			expect(result.success).toBe(true);
		});
	});

	describe('deleteDraftsByCategory', () => {
		it('deletes only drafts in specified category', () => {
			const drafts: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Rationale 1' },
				{ category: 'gate_rationale', itemKey: 'gate-2', value: 'Rationale 2' },
				{ category: 'intake_response', itemKey: 'resp-1', value: 'Answer 1' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			const result = deleteDraftsByCategory(DLG_ID, 'gate_rationale');
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const remaining = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(remaining).toHaveLength(1);
			expect((remaining[0] as { category: string }).category).toBe('intake_response');
		});

		it('does not affect other dialogues', () => {
			const drafts1: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value1' },
			];
			const drafts2: DraftEntry[] = [
				{ category: 'test', itemKey: 'key1', value: 'value2' },
			];

			saveDraftsBatch(DLG_ID, drafts1);
			saveDraftsBatch(DLG_ID_2, drafts2);

			deleteDraftsByCategory(DLG_ID, 'test');

			const db = getDatabase()!;
			const rows1 = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID);
			const rows2 = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows1).toHaveLength(0);
			expect(rows2).toHaveLength(1);
		});

		it('succeeds when category does not exist', () => {
			const result = deleteDraftsByCategory(DLG_ID, 'nonexistent_category');
			expect(result.success).toBe(true);
		});

		it('deletes all items in category', () => {
			const drafts: DraftEntry[] = [
				{ category: 'files', itemKey: 'file1', value: 'path1' },
				{ category: 'files', itemKey: 'file2', value: 'path2' },
				{ category: 'files', itemKey: 'file3', value: 'path3' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			deleteDraftsByCategory(DLG_ID, 'files');

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM webview_drafts WHERE dialogue_id = ? AND category = ?'
			).all(DLG_ID, 'files');

			expect(rows).toHaveLength(0);
		});
	});

	describe('draft persistence workflow', () => {
		it('simulates user editing and submitting a gate rationale', () => {
			// User starts typing
			saveDraftsBatch(DLG_ID, [
				{ category: 'gate_rationale', itemKey: 'gate-123', value: 'This' },
			]);

			// User continues typing
			saveDraftsBatch(DLG_ID, [
				{ category: 'gate_rationale', itemKey: 'gate-123', value: 'This looks' },
			]);

			// User finishes typing
			saveDraftsBatch(DLG_ID, [
				{ category: 'gate_rationale', itemKey: 'gate-123', value: 'This looks good to me' },
			]);

			// Verify only one draft exists
			const drafts = getDrafts(DLG_ID);
			expect(drafts.success).toBe(true);
			if (drafts.success) {
				expect(drafts.value['gate_rationale']['gate-123']).toBe('This looks good to me');
			}

			// User submits the form - delete the draft
			deleteDraftsByCategory(DLG_ID, 'gate_rationale');

			// Verify draft is gone
			const afterSubmit = getDrafts(DLG_ID);
			expect(afterSubmit.success).toBe(true);
			if (afterSubmit.success) {
				expect(afterSubmit.value).toEqual({});
			}
		});

		it('simulates managing multiple file attachments', () => {
			// User attaches first file
			saveDraftsBatch(DLG_ID, [
				{ category: 'attachments', itemKey: 'requirements.md', value: '/workspace/requirements.md' },
			]);

			// User attaches second file
			saveDraftsBatch(DLG_ID, [
				{ category: 'attachments', itemKey: 'requirements.md', value: '/workspace/requirements.md' },
				{ category: 'attachments', itemKey: 'api.ts', value: '/workspace/src/api.ts' },
			]);

			// Verify both attachments
			const drafts = getDrafts(DLG_ID);
			expect(drafts.success).toBe(true);
			if (drafts.success) {
				expect(Object.keys(drafts.value['attachments'])).toHaveLength(2);
			}

			// User submits and all attachments are cleared
			deleteAllDrafts(DLG_ID);

			const afterSubmit = getDrafts(DLG_ID);
			expect(afterSubmit.success).toBe(true);
			if (afterSubmit.success) {
				expect(afterSubmit.value).toEqual({});
			}
		});

		it('simulates multiple categories being drafted simultaneously', () => {
			// User fills out multiple form fields
			const drafts: DraftEntry[] = [
				{ category: 'gate_rationale', itemKey: 'gate-1', value: 'Rationale text' },
				{ category: 'review_notes', itemKey: 'general', value: 'Review notes' },
				{ category: 'attachments', itemKey: 'file.md', value: '/path' },
			];
			saveDraftsBatch(DLG_ID, drafts);

			// User submits gate decision - only gate rationales are cleared
			deleteDraftsByCategory(DLG_ID, 'gate_rationale');

			const afterGate = getDrafts(DLG_ID);
			expect(afterGate.success).toBe(true);
			if (afterGate.success) {
				expect(afterGate.value['gate_rationale']).toBeUndefined();
				expect(afterGate.value['review_notes']).toBeDefined();
				expect(afterGate.value['attachments']).toBeDefined();
			}

			// User completes entire dialogue - all drafts cleared
			deleteAllDrafts(DLG_ID);

			const afterComplete = getDrafts(DLG_ID);
			expect(afterComplete.success).toBe(true);
			if (afterComplete.success) {
				expect(afterComplete.value).toEqual({});
			}
		});
	});
});
