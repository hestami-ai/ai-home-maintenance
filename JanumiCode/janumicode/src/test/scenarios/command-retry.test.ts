/**
 * Scenario: Command Retry
 * Tests that assessRetryableActions returns appropriate retry actions
 * when verification gates are open or when phase has failed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../helpers/fakeLogger';
import { assessRetryableActions } from '../../lib/ui/governedStream/textCommands';
import { createDialogueRecord } from '../../lib/dialogue/lifecycle';
import { initializeWorkflowState } from '../../lib/workflow/stateMachine';
import { createGate } from '../../lib/workflow/gates';

describe('Scenario: Command Retry', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		createDialogueRecord(DLG_ID, 'Test retry actions');
		initializeWorkflowState(DLG_ID);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('returns retry actions when verification gates are open', () => {
		// Create an open gate
		createGate({
			dialogueId: DLG_ID,
			reason: 'Critical claim verification failed',
			blockingClaims: ['claim-001'],
		});

		const actions = assessRetryableActions(DLG_ID);
		// Should return at least one action for the open gate
		expect(actions.length).toBeGreaterThanOrEqual(1);
	});

	it('returns empty actions when no gates or failures exist', () => {
		// No gates, no failures — nothing to retry
		const actions = assessRetryableActions(DLG_ID);
		expect(actions).toHaveLength(0);
	});
});
