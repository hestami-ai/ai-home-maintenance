import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	createDialogueRecord,
	completeDialogue,
	abandonDialogue,
	getActiveDialogue,
	resumeDialogue,
} from '../../../lib/dialogue/lifecycle';

describe('Dialogue Lifecycle', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	// UUID-format IDs (36 chars) required by CHECK constraint
	const ID1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const ID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
	const ID3 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03';
	const ID4 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04';
	const ID5 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee05';

	it('creates a dialogue record with ACTIVE status', () => {
		const result = createDialogueRecord(ID1, 'Test goal');
		expect(result.success).toBe(true);
	});

	it('retrieves active dialogue', () => {
		createDialogueRecord(ID2, 'Another goal');
		const result = getActiveDialogue();
		expect(result.success).toBe(true);
		if (result.success && result.value) {
			expect(result.value.status).toBe('ACTIVE');
			expect(result.value.dialogue_id).toBe(ID2);
			expect(result.value.goal).toBe('Another goal');
		}
	});

	it('completes a dialogue', () => {
		createDialogueRecord(ID3, 'Complete test');
		const result = completeDialogue(ID3);
		expect(result.success).toBe(true);

		// Verify it's no longer the active dialogue
		const activeResult = getActiveDialogue();
		expect(activeResult.success).toBe(true);
		if (activeResult.success) {
			// Should be null or a different dialogue
			expect(activeResult.value?.dialogue_id).not.toBe(ID3);
		}
	});

	it('abandons a dialogue', () => {
		createDialogueRecord(ID4, 'Abandon test');
		const result = abandonDialogue(ID4);
		expect(result.success).toBe(true);

		// Verify it's no longer active
		const activeResult = getActiveDialogue();
		expect(activeResult.success).toBe(true);
		if (activeResult.success) {
			expect(activeResult.value?.dialogue_id).not.toBe(ID4);
		}
	});

	it('resumes an abandoned dialogue', () => {
		createDialogueRecord(ID5, 'Resume test');
		abandonDialogue(ID5);
		const result = resumeDialogue(ID5);
		expect(result.success).toBe(true);

		// Should be active again
		const activeResult = getActiveDialogue();
		expect(activeResult.success).toBe(true);
		if (activeResult.success && activeResult.value) {
			expect(activeResult.value.dialogue_id).toBe(ID5);
			expect(activeResult.value.status).toBe('ACTIVE');
		}
	});
});
