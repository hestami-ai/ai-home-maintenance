import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { getLogger } from '../../../lib/logging';
import { getDatabase } from '../../../lib/database/init';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { writeDialogueEvent } from '../../../lib/events/writer';
import { buildDiagnosticSnapshot } from '../../../lib/diagnostics/snapshot';

function insertDialogue(dialogueId: string, goal = 'Build app'): void {
	const db = getDatabase()!;
	db.prepare(
		"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, ?, 'ACTIVE', datetime('now'))"
	).run(dialogueId, goal);
}

describe('buildDiagnosticSnapshot', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('exports recent logs plus dialogue/workflow rows with DB identity fields', () => {
		const dialogueId = '00000000-0000-0000-0000-000000001111';
		insertDialogue(dialogueId);
		const stateInit = initializeWorkflowState(dialogueId, { goal: 'Build app' });
		expect(stateInit.success).toBe(true);

		const eventWrite = writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'human_message',
			role: 'HUMAN',
			phase: 'INTAKE',
			speech_act: 'REQUEST',
			summary: 'Need product discovery',
			content: 'Please propose domain model.',
		});
		expect(eventWrite.success).toBe(true);

		getLogger().child({ component: 'snapshotTest' }).info('snapshotProbe', {
			dialogueId,
			result: 'ok',
		});

		const snapshot = buildDiagnosticSnapshot({
			dialogueId,
			logLimit: 50,
			eventLimit: 50,
			stateLimit: 50,
			transitionLimit: 50,
			pendingLimit: 50,
		});

		expect(typeof snapshot.generatedAt).toBe('string');
		expect(snapshot.database.ready).toBe(true);
		expect(snapshot.database.connectionMode === 'direct' || snapshot.database.connectionMode === 'sidecar').toBe(true);
		expect(typeof snapshot.database.dbPath).toBe('string');
		expect(typeof snapshot.database.dbInstanceId).toBe('string');

		expect(snapshot.counts.logs).toBe(snapshot.logs.length);
		expect(snapshot.counts.dialogueEvents).toBe(snapshot.rows.dialogueEvents.length);
		expect(snapshot.counts.workflowStates).toBe(snapshot.rows.workflowStates.length);

		const hasWorkflowState = snapshot.rows.workflowStates.some((row) => {
			const data = row as Record<string, unknown>;
			return data.dialogue_id === dialogueId;
		});
		expect(hasWorkflowState).toBe(true);

		const hasDialogueEvent = snapshot.rows.dialogueEvents.some((row) => {
			const data = row as Record<string, unknown>;
			return data.dialogue_id === dialogueId;
		});
		expect(hasDialogueEvent).toBe(true);
	});
});
