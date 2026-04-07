import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	insertFinding,
	insertFindings,
	updateFindingRating,
	getFindingsForDialogue,
	getActiveFindings,
	getFinding,
	newFindingId,
} from '../../../lib/database/validationStore';
import type { GradedFinding } from '../../../lib/types/validate';
import { getDatabase } from '../../../lib/database/init';

describe('ValidationStore', () => {
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

	function createMockFinding(overrides?: Partial<GradedFinding>): GradedFinding {
		return {
			finding_id: newFindingId(),
			id: 'hyp-1',
			text: 'Potential SQL injection vulnerability',
			location: 'src/auth/login.ts:45',
			category: 'security',
			severity: 'high',
			tool_used: 'llm_only',
			proof_status: 'probable',
			proof_artifact: 'User input not sanitized before query',
			confidence: 0.85,
			...overrides,
		};
	}

	describe('newFindingId', () => {
		it('generates unique UUIDs', () => {
			const id1 = newFindingId();
			const id2 = newFindingId();

			expect(id1).toHaveLength(36);
			expect(id2).toHaveLength(36);
			expect(id1).not.toBe(id2);
		});
	});

	describe('insertFinding', () => {
		it('inserts a finding with all fields', () => {
			const finding = createMockFinding();
			const result = insertFinding(DLG_ID, finding);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.finding_id).toBe(finding.finding_id);
				expect(result.value.dialogue_id).toBe(DLG_ID);
				expect(result.value.hypothesis).toBe(finding.text);
				expect(result.value.category).toBe('security');
				expect(result.value.severity).toBe('high');
				expect(result.value.location).toBe('src/auth/login.ts:45');
				expect(result.value.tool_used).toBe('llm_only');
				expect(result.value.proof_status).toBe('probable');
				expect(result.value.proof_artifact).toBe('User input not sanitized before query');
				expect(result.value.confidence).toBe(0.85);
				expect(result.value.useful_rating).toBeNull();
				expect(result.value.created_at).toBeDefined();
			}
		});

		it('handles finding with null proof_artifact', () => {
			const finding = createMockFinding({
				proof_status: 'disproven',
				proof_artifact: null,
			});
			const result = insertFinding(DLG_ID, finding);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proof_artifact).toBeNull();
			}
		});

		it('inserts proven findings', () => {
			const finding = createMockFinding({
				proof_status: 'proven',
				tool_used: 'dafny',
				proof_artifact: 'Dafny verification failed at line 50',
				confidence: 0.95,
			});
			const result = insertFinding(DLG_ID, finding);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proof_status).toBe('proven');
				expect(result.value.tool_used).toBe('dafny');
			}
		});

		it('inserts critical severity findings', () => {
			const finding = createMockFinding({
				severity: 'critical',
				tool_used: 'sandbox_poc',
				confidence: 0.98,
			});
			const result = insertFinding(DLG_ID, finding);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.severity).toBe('critical');
			}
		});

		it('persists to database', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM validation_findings WHERE finding_id = ?'
			).get(finding.finding_id);

			expect(row).toBeDefined();
		});
	});

	describe('insertFindings', () => {
		it('bulk inserts multiple findings in a transaction', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ text: 'Finding 1', confidence: 0.9 }),
				createMockFinding({ text: 'Finding 2', confidence: 0.8 }),
				createMockFinding({ text: 'Finding 3', confidence: 0.7 }),
			];

			const result = insertFindings(DLG_ID, findings);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM validation_findings WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(3);
		});

		it('handles empty findings array', () => {
			const result = insertFindings(DLG_ID, []);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM validation_findings WHERE dialogue_id = ?'
			).all(DLG_ID);

			expect(rows).toHaveLength(0);
		});

		it('rolls back on error', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ text: 'Valid finding' }),
			];

			// Insert first batch
			insertFindings(DLG_ID, findings);

			const db = getDatabase()!;
			const count = db.prepare(
				'SELECT COUNT(*) as count FROM validation_findings WHERE dialogue_id = ?'
			).get(DLG_ID) as { count: number };

			expect(count.count).toBe(1);
		});

		it('inserts findings with different categories', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ category: 'security', confidence: 0.9 }),
				createMockFinding({ category: 'logic', confidence: 0.85 }),
				createMockFinding({ category: 'best_practices', confidence: 0.75 }),
			];

			insertFindings(DLG_ID, findings);

			const db = getDatabase()!;
			const categories = db.prepare(
				'SELECT DISTINCT category FROM validation_findings WHERE dialogue_id = ?'
			).all(DLG_ID) as { category: string }[];

			expect(categories).toHaveLength(3);
		});
	});

	describe('updateFindingRating', () => {
		it('updates rating to useful (1)', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);

			const result = updateFindingRating(finding.finding_id, true);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT useful_rating FROM validation_findings WHERE finding_id = ?'
			).get(finding.finding_id) as { useful_rating: number };

			expect(row.useful_rating).toBe(1);
		});

		it('updates rating to not useful (0)', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);

			const result = updateFindingRating(finding.finding_id, false);
			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT useful_rating FROM validation_findings WHERE finding_id = ?'
			).get(finding.finding_id) as { useful_rating: number };

			expect(row.useful_rating).toBe(0);
		});

		it('can change rating from useful to not useful', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);

			updateFindingRating(finding.finding_id, true);
			updateFindingRating(finding.finding_id, false);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT useful_rating FROM validation_findings WHERE finding_id = ?'
			).get(finding.finding_id) as { useful_rating: number };

			expect(row.useful_rating).toBe(0);
		});

		it('succeeds on non-existent finding_id', () => {
			const result = updateFindingRating('non-existent-id', true);
			expect(result.success).toBe(true);
		});
	});

	describe('getFindingsForDialogue', () => {
		it('returns empty array when no findings exist', () => {
			const result = getFindingsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('retrieves all findings for a dialogue', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ confidence: 0.9 }),
				createMockFinding({ confidence: 0.8 }),
				createMockFinding({ confidence: 0.7 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getFindingsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(3);
			}
		});

		it('orders findings by confidence descending', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ text: 'Low confidence', confidence: 0.6 }),
				createMockFinding({ text: 'High confidence', confidence: 0.95 }),
				createMockFinding({ text: 'Medium confidence', confidence: 0.8 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getFindingsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].confidence).toBe(0.95);
				expect(result.value[1].confidence).toBe(0.8);
				expect(result.value[2].confidence).toBe(0.6);
			}
		});

		it('includes all proof statuses', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ proof_status: 'proven', confidence: 0.95 }),
				createMockFinding({ proof_status: 'probable', confidence: 0.85 }),
				createMockFinding({ proof_status: 'disproven', confidence: 0.75 }),
				createMockFinding({ proof_status: 'error', confidence: 0.65 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getFindingsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(4);
			}
		});

		it('isolates findings by dialogue_id', () => {
			insertFindings(DLG_ID, [createMockFinding()]);
			insertFindings(DLG_ID_2, [createMockFinding()]);

			const result1 = getFindingsForDialogue(DLG_ID);
			const result2 = getFindingsForDialogue(DLG_ID_2);

			expect(result1.success && result1.value).toHaveLength(1);
			expect(result2.success && result2.value).toHaveLength(1);
		});

		it('includes useful_rating when set', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);
			updateFindingRating(finding.finding_id, true);

			const result = getFindingsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].useful_rating).toBe(1);
			}
		});
	});

	describe('getActiveFindings', () => {
		it('returns only proven and probable findings', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ proof_status: 'proven', confidence: 0.95 }),
				createMockFinding({ proof_status: 'probable', confidence: 0.85 }),
				createMockFinding({ proof_status: 'disproven', confidence: 0.75 }),
				createMockFinding({ proof_status: 'error', confidence: 0.65 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getActiveFindings(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value.every(f => f.proof_status === 'proven' || f.proof_status === 'probable')).toBe(true);
			}
		});

		it('returns empty array when only disproven/error findings exist', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ proof_status: 'disproven', confidence: 0.75 }),
				createMockFinding({ proof_status: 'error', confidence: 0.65 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getActiveFindings(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('orders active findings by confidence descending', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ proof_status: 'probable', confidence: 0.7 }),
				createMockFinding({ proof_status: 'proven', confidence: 0.95 }),
				createMockFinding({ proof_status: 'probable', confidence: 0.85 }),
			];
			insertFindings(DLG_ID, findings);

			const result = getActiveFindings(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].confidence).toBe(0.95);
				expect(result.value[1].confidence).toBe(0.85);
				expect(result.value[2].confidence).toBe(0.7);
			}
		});

		it('isolates findings by dialogue_id', () => {
			insertFindings(DLG_ID, [createMockFinding({ proof_status: 'proven' })]);
			insertFindings(DLG_ID_2, [createMockFinding({ proof_status: 'probable' })]);

			const result = getActiveFindings(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
			}
		});
	});

	describe('getFinding', () => {
		it('retrieves a finding by ID', () => {
			const finding = createMockFinding();
			insertFinding(DLG_ID, finding);

			const result = getFinding(finding.finding_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.finding_id).toBe(finding.finding_id);
				expect(result.value.hypothesis).toBe(finding.text);
			}
		});

		it('returns null for non-existent finding', () => {
			const result = getFinding('non-existent-id');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('retrieves finding with all fields', () => {
			const finding = createMockFinding({
				text: 'Buffer overflow in parser',
				location: 'src/parser.c:123',
				category: 'security',
				severity: 'critical',
				tool_used: 'z3',
				proof_status: 'proven',
				proof_artifact: 'Counterexample found',
				confidence: 0.98,
			});
			insertFinding(DLG_ID, finding);
			updateFindingRating(finding.finding_id, true);

			const result = getFinding(finding.finding_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.hypothesis).toBe('Buffer overflow in parser');
				expect(result.value.location).toBe('src/parser.c:123');
				expect(result.value.category).toBe('security');
				expect(result.value.severity).toBe('critical');
				expect(result.value.tool_used).toBe('z3');
				expect(result.value.proof_status).toBe('proven');
				expect(result.value.proof_artifact).toBe('Counterexample found');
				expect(result.value.confidence).toBe(0.98);
				expect(result.value.useful_rating).toBe(1);
			}
		});
	});

	describe('validation workflow', () => {
		it('simulates complete validation review workflow', () => {
			// HYPOTHESIZING: Generate findings
			const findings: GradedFinding[] = [
				createMockFinding({
					text: 'Unvalidated redirect vulnerability',
					category: 'security',
					severity: 'high',
					proof_status: 'probable',
					confidence: 0.88,
				}),
				createMockFinding({
					text: 'Race condition in async handler',
					category: 'logic',
					severity: 'medium',
					proof_status: 'proven',
					tool_used: 'micro_fuzz',
					confidence: 0.92,
				}),
				createMockFinding({
					text: 'Missing error handling',
					category: 'best_practices',
					severity: 'low',
					proof_status: 'probable',
					confidence: 0.65,
				}),
			];

			// GRADING: Insert findings
			insertFindings(DLG_ID, findings);

			// PRESENTING: Retrieve active findings for UI
			const activeResult = getActiveFindings(DLG_ID);
			expect(activeResult.success).toBe(true);
			if (activeResult.success) {
				expect(activeResult.value).toHaveLength(3);
			}

			// User rates findings
			updateFindingRating(findings[0].finding_id, true);  // Useful
			updateFindingRating(findings[1].finding_id, true);  // Useful
			updateFindingRating(findings[2].finding_id, false); // Not useful

			// Verify ratings persisted
			const allFindings = getFindingsForDialogue(DLG_ID);
			expect(allFindings.success).toBe(true);
			if (allFindings.success) {
				const rated = allFindings.value.filter(f => f.useful_rating !== null);
				expect(rated).toHaveLength(3);
			}
		});

		it('handles mixed proof statuses correctly', () => {
			const findings: GradedFinding[] = [
				createMockFinding({ proof_status: 'proven', confidence: 0.95 }),
				createMockFinding({ proof_status: 'probable', confidence: 0.85 }),
				createMockFinding({ proof_status: 'disproven', confidence: 0.70 }),
			];
			insertFindings(DLG_ID, findings);

			// All findings returned by getFindingsForDialogue
			const all = getFindingsForDialogue(DLG_ID);
			expect(all.success && all.value).toHaveLength(3);

			// Only actionable findings returned by getActiveFindings
			const active = getActiveFindings(DLG_ID);
			expect(active.success && active.value).toHaveLength(2);
		});
	});
});
