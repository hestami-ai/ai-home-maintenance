import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	savePendingMmpDecisions,
	getPendingMmpDecisions,
	deletePendingMmpDecisions,
	deleteAllPendingMmpDecisions,
} from '../../../lib/database/pendingMmpStore';
import { getDatabase } from '../../../lib/database/init';

describe('PendingMmpStore', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
	const CARD_ID_1 = 'card-intake-01';
	const CARD_ID_2 = 'card-arch-gate-01';

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

	describe('savePendingMmpDecisions', () => {
		it('saves mirror decisions', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: {
					'mirror-1': { status: 'accepted' },
					'mirror-2': { status: 'rejected' },
				},
			});

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT mirror_decisions FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { mirror_decisions: string } | undefined;

			expect(row).toBeDefined();
			const parsed = JSON.parse(row!.mirror_decisions);
			expect(parsed['mirror-1'].status).toBe('accepted');
			expect(parsed['mirror-2'].status).toBe('rejected');
		});

		it('saves mirror decisions with edited text', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: {
					'mirror-1': { status: 'accepted', editedText: 'Edited summary' },
				},
			});

			expect(result.success).toBe(true);

			const decisions = getPendingMmpDecisions(DLG_ID);
			if (decisions.success) {
				expect(decisions.value[CARD_ID_1].mirrorDecisions['mirror-1'].editedText).toBe('Edited summary');
			}
		});

		it('saves menu selections', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				menuSelections: {
					'menu-1': { selectedOptionId: 'option-a' },
					'menu-2': { selectedOptionId: 'option-b' },
				},
			});

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT menu_selections FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { menu_selections: string } | undefined;

			expect(row).toBeDefined();
			const parsed = JSON.parse(row!.menu_selections);
			expect(parsed['menu-1'].selectedOptionId).toBe('option-a');
			expect(parsed['menu-2'].selectedOptionId).toBe('option-b');
		});

		it('saves menu selections with custom responses', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				menuSelections: {
					'menu-1': { selectedOptionId: 'custom', customResponse: 'My custom answer' },
				},
			});

			expect(result.success).toBe(true);

			const decisions = getPendingMmpDecisions(DLG_ID);
			if (decisions.success) {
				expect(decisions.value[CARD_ID_1].menuSelections['menu-1'].customResponse).toBe('My custom answer');
			}
		});

		it('saves premortem decisions', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				preMortemDecisions: {
					'risk-1': { status: 'mitigated', rationale: 'Added input validation' },
					'risk-2': { status: 'accepted' },
				},
			});

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT premortem_decisions FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { premortem_decisions: string } | undefined;

			expect(row).toBeDefined();
			const parsed = JSON.parse(row!.premortem_decisions);
			expect(parsed['risk-1'].status).toBe('mitigated');
			expect(parsed['risk-1'].rationale).toBe('Added input validation');
		});

		it('saves product edits', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				productEdits: {
					'feature-1': 'Updated feature description',
					'feature-2': 'New acceptance criteria',
				},
			});

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT product_edits FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { product_edits: string } | undefined;

			expect(row).toBeDefined();
			const parsed = JSON.parse(row!.product_edits);
			expect(parsed['feature-1']).toBe('Updated feature description');
			expect(parsed['feature-2']).toBe('New acceptance criteria');
		});

		it('saves all decision types together', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
				menuSelections: { 'mn1': { selectedOptionId: 'opt1' } },
				preMortemDecisions: { 'r1': { status: 'mitigated' } },
				productEdits: { 'f1': 'edit text' },
			});

			expect(result.success).toBe(true);

			const decisions = getPendingMmpDecisions(DLG_ID);
			expect(decisions.success).toBe(true);
			if (decisions.success) {
				const card = decisions.value[CARD_ID_1];
				expect(card.mirrorDecisions['m1']).toBeDefined();
				expect(card.menuSelections['mn1']).toBeDefined();
				expect(card.preMortemDecisions['r1']).toBeDefined();
				expect(card.productEdits['f1']).toBeDefined();
			}
		});

		it('updates existing decisions on conflict', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'mirror-1': { status: 'accepted' } },
			});

			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'mirror-1': { status: 'rejected' } },
			});

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).all(DLG_ID, CARD_ID_1);

			expect(rows).toHaveLength(1);

			const decisions = getPendingMmpDecisions(DLG_ID);
			if (decisions.success) {
				expect(decisions.value[CARD_ID_1].mirrorDecisions['mirror-1'].status).toBe('rejected');
			}
		});

		it('handles empty decision objects', () => {
			const result = savePendingMmpDecisions(DLG_ID, CARD_ID_1, {});

			expect(result.success).toBe(true);

			const decisions = getPendingMmpDecisions(DLG_ID);
			if (decisions.success) {
				expect(decisions.value[CARD_ID_1].mirrorDecisions).toEqual({});
				expect(decisions.value[CARD_ID_1].menuSelections).toEqual({});
				expect(decisions.value[CARD_ID_1].preMortemDecisions).toEqual({});
				expect(decisions.value[CARD_ID_1].productEdits).toEqual({});
			}
		});

		it('isolates decisions by dialogue_id and card_id', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID, CARD_ID_2, {
				mirrorDecisions: { 'm2': { status: 'rejected' } },
			});

			savePendingMmpDecisions(DLG_ID_2, CARD_ID_1, {
				mirrorDecisions: { 'm3': { status: 'deferred' } },
			});

			const db = getDatabase()!;
			const rows = db.prepare('SELECT * FROM pending_mmp_decisions').all();
			expect(rows).toHaveLength(3);
		});

		it('updates timestamp on upsert', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			const db = getDatabase()!;
			const row1 = db.prepare(
				'SELECT updated_at FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { updated_at: string } | undefined;

			const timestamp1 = row1?.updated_at;

			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'rejected' } },
			});

			const row2 = db.prepare(
				'SELECT updated_at FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
			).get(DLG_ID, CARD_ID_1) as { updated_at: string } | undefined;

			const timestamp2 = row2?.updated_at;

			// updated_at must not regress. SQLite datetime('now') is second-resolution,
			// so back-to-back upserts can tie within the same second — that's OK.
			expect(timestamp2).toBeDefined();
			expect(timestamp1).toBeDefined();
			expect(timestamp2! >= timestamp1!).toBe(true);
		});
	});

	describe('getPendingMmpDecisions', () => {
		it('returns empty object when no decisions exist', () => {
			const result = getPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual({});
			}
		});

		it('retrieves decisions for all cards in a dialogue', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID, CARD_ID_2, {
				menuSelections: { 'mn1': { selectedOptionId: 'opt1' } },
			});

			const result = getPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.keys(result.value)).toHaveLength(2);
				expect(result.value[CARD_ID_1]).toBeDefined();
				expect(result.value[CARD_ID_2]).toBeDefined();
			}
		});

		it('isolates decisions by dialogue_id', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID_2, CARD_ID_1, {
				mirrorDecisions: { 'm2': { status: 'rejected' } },
			});

			const result1 = getPendingMmpDecisions(DLG_ID);
			const result2 = getPendingMmpDecisions(DLG_ID_2);

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);

			if (result1.success && result2.success) {
				expect(Object.keys(result1.value)).toHaveLength(1);
				expect(Object.keys(result2.value)).toHaveLength(1);
				expect(result1.value[CARD_ID_1].mirrorDecisions['m1'].status).toBe('accepted');
				expect(result2.value[CARD_ID_1].mirrorDecisions['m2'].status).toBe('rejected');
			}
		});

		it('correctly parses JSON fields', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted', editedText: 'Custom text' } },
				menuSelections: { 'mn1': { selectedOptionId: 'opt1', customResponse: 'Response' } },
				preMortemDecisions: { 'r1': { status: 'mitigated', rationale: 'Rationale' } },
				productEdits: { 'f1': 'Edit text' },
			});

			const result = getPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);

			if (result.success) {
				const card = result.value[CARD_ID_1];
				expect(card.dialogueId).toBe(DLG_ID);
				expect(card.cardId).toBe(CARD_ID_1);
				expect(card.mirrorDecisions['m1']).toEqual({ status: 'accepted', editedText: 'Custom text' });
				expect(card.menuSelections['mn1']).toEqual({ selectedOptionId: 'opt1', customResponse: 'Response' });
				expect(card.preMortemDecisions['r1']).toEqual({ status: 'mitigated', rationale: 'Rationale' });
				expect(card.productEdits['f1']).toBe('Edit text');
			}
		});
	});

	describe('deletePendingMmpDecisions', () => {
		it('deletes decisions for a specific card', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID, CARD_ID_2, {
				mirrorDecisions: { 'm2': { status: 'rejected' } },
			});

			const result = deletePendingMmpDecisions(DLG_ID, CARD_ID_1);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM pending_mmp_decisions WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(1);
			expect((rows[0] as { card_id: string }).card_id).toBe(CARD_ID_2);
		});

		it('does not affect other dialogues', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID_2, CARD_ID_1, {
				mirrorDecisions: { 'm2': { status: 'rejected' } },
			});

			deletePendingMmpDecisions(DLG_ID, CARD_ID_1);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM pending_mmp_decisions WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows).toHaveLength(1);
		});

		it('succeeds when card does not exist', () => {
			const result = deletePendingMmpDecisions(DLG_ID, 'non-existent-card');
			expect(result.success).toBe(true);
		});
	});

	describe('deleteAllPendingMmpDecisions', () => {
		it('deletes all decisions for a dialogue', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID, CARD_ID_2, {
				menuSelections: { 'mn1': { selectedOptionId: 'opt1' } },
			});

			const result = deleteAllPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM pending_mmp_decisions WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(0);
		});

		it('does not affect other dialogues', () => {
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			savePendingMmpDecisions(DLG_ID_2, CARD_ID_1, {
				mirrorDecisions: { 'm2': { status: 'rejected' } },
			});

			deleteAllPendingMmpDecisions(DLG_ID);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM pending_mmp_decisions WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows).toHaveLength(1);
		});

		it('succeeds when no decisions exist', () => {
			const result = deleteAllPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);
		});
	});

	describe('MMP workflow scenarios', () => {
		it('simulates intake product discovery MMP workflow', () => {
			// User starts making mirror decisions
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: {
					'summary': { status: 'accepted' },
					'requirements': { status: 'accepted', editedText: 'Updated requirements list' },
				},
			});

			// User adds menu selections
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: {
					'summary': { status: 'accepted' },
					'requirements': { status: 'accepted', editedText: 'Updated requirements list' },
				},
				menuSelections: {
					'domain': { selectedOptionId: 'healthcare' },
					'risk_level': { selectedOptionId: 'medium' },
				},
			});

			// Verify partial state persisted
			const partial = getPendingMmpDecisions(DLG_ID);
			expect(partial.success).toBe(true);
			if (partial.success) {
				expect(partial.value[CARD_ID_1].mirrorDecisions['requirements'].editedText).toBe('Updated requirements list');
				expect(partial.value[CARD_ID_1].menuSelections['domain'].selectedOptionId).toBe('healthcare');
			}

			// User submits - decisions are deleted
			deletePendingMmpDecisions(DLG_ID, CARD_ID_1);

			const after = getPendingMmpDecisions(DLG_ID);
			expect(after.success).toBe(true);
			if (after.success) {
				expect(after.value).toEqual({});
			}
		});

		it('simulates architecture gate MMP workflow', () => {
			// User reviews architecture proposal with premortem risks
			savePendingMmpDecisions(DLG_ID, CARD_ID_2, {
				mirrorDecisions: {
					'arch-decision-1': { status: 'accepted' },
					'arch-decision-2': { status: 'rejected' },
				},
				preMortemDecisions: {
					'risk-scalability': { status: 'mitigated', rationale: 'Added caching layer' },
					'risk-security': { status: 'accepted', rationale: 'Low probability, acceptable risk' },
				},
			});

			const decisions = getPendingMmpDecisions(DLG_ID);
			expect(decisions.success).toBe(true);
			if (decisions.success) {
				expect(decisions.value[CARD_ID_2].preMortemDecisions['risk-scalability'].status).toBe('mitigated');
			}

			// Gate passed - clean up
			deletePendingMmpDecisions(DLG_ID, CARD_ID_2);
		});

		it('simulates multiple cards in same dialogue', () => {
			// First MMP card (intake)
			savePendingMmpDecisions(DLG_ID, 'card-intake', {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			// Second MMP card (proposer-validator)
			savePendingMmpDecisions(DLG_ID, 'card-proposer', {
				menuSelections: { 'mn1': { selectedOptionId: 'opt1' } },
			});

			// Third MMP card (architecture gate)
			savePendingMmpDecisions(DLG_ID, 'card-arch', {
				preMortemDecisions: { 'r1': { status: 'mitigated' } },
			});

			const all = getPendingMmpDecisions(DLG_ID);
			expect(all.success).toBe(true);
			if (all.success) {
				expect(Object.keys(all.value)).toHaveLength(3);
			}

			// First card submitted
			deletePendingMmpDecisions(DLG_ID, 'card-intake');

			const after1 = getPendingMmpDecisions(DLG_ID);
			expect(after1.success && after1.value && Object.keys(after1.value)).toHaveLength(2);

			// Dialogue abandoned - clean up all
			deleteAllPendingMmpDecisions(DLG_ID);

			const afterAll = getPendingMmpDecisions(DLG_ID);
			expect(afterAll.success && afterAll.value).toEqual({});
		});

		it('simulates incremental decision making', () => {
			// User makes first decision
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' } },
			});

			// User adds another decision
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'accepted' }, 'm2': { status: 'rejected' } },
			});

			// User changes first decision
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				mirrorDecisions: { 'm1': { status: 'deferred' }, 'm2': { status: 'rejected' } },
			});

			const final = getPendingMmpDecisions(DLG_ID);
			expect(final.success).toBe(true);
			if (final.success) {
				expect(final.value[CARD_ID_1].mirrorDecisions['m1'].status).toBe('deferred');
				expect(final.value[CARD_ID_1].mirrorDecisions['m2'].status).toBe('rejected');
			}
		});

		it('handles product edit workflow', () => {
			// User edits product features during intake
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				productEdits: {
					'feature-1': 'User authentication with OAuth',
					'feature-2': 'Dashboard with real-time metrics',
				},
			});

			// User refines edits
			savePendingMmpDecisions(DLG_ID, CARD_ID_1, {
				productEdits: {
					'feature-1': 'User authentication with OAuth 2.0 and MFA',
					'feature-2': 'Dashboard with real-time metrics',
					'feature-3': 'API rate limiting',
				},
			});

			const result = getPendingMmpDecisions(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Object.keys(result.value[CARD_ID_1].productEdits)).toHaveLength(3);
				expect(result.value[CARD_ID_1].productEdits['feature-1']).toContain('MFA');
			}
		});
	});
});
