import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import {
	getWorkflowState,
	initializeWorkflowState,
	isValidTransition,
	TransitionTrigger,
	transitionWorkflow,
	updateWorkflowMetadata,
} from '../../../lib/workflow/stateMachine';
import { Phase } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';

function insertDialogue(id: string, goal = 'Build app'): void {
	const db = getDatabase()!;
	db.prepare(
		"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, ?, 'ACTIVE', datetime('now'))"
	).run(id, goal);
}

function seededRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (1664525 * s + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

describe('workflow invariants (property-style)', () => {
	let tempDb: TempDbContext;
	let deterministic: DeterministicHarness;

	beforeEach(() => {
		deterministic = useDeterministicHarness();
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
		deterministic.restore();
	});

	it('randomized transition attempts never mutate state on invalid transitions', () => {
		const dialogueId = '00000000-0000-0000-0000-000000000071';
		insertDialogue(dialogueId);
		initializeWorkflowState(dialogueId);

		const allPhases = Object.values(Phase);
		const rand = seededRng(0xC0FFEE);
		let successfulTransitions = 0;

		for (let i = 0; i < 120; i++) {
			const before = getWorkflowState(dialogueId);
			expect(before.success).toBe(true);
			if (!before.success) { return; }

			const from = before.value.current_phase;
			const target = allPhases[Math.floor(rand() * allPhases.length)] as Phase;
			const allowed = isValidTransition(from, target);

			const result = transitionWorkflow(
				dialogueId,
				target,
				TransitionTrigger.PHASE_COMPLETE,
				{ step: i, seed: '0xC0FFEE' },
			);

			const after = getWorkflowState(dialogueId);
			expect(after.success).toBe(true);
			if (!after.success) { return; }

			if (allowed) {
				expect(result.success).toBe(true);
				expect(after.value.current_phase).toBe(target);
				expect(after.value.previous_phase).toBe(from);
				successfulTransitions++;
			} else {
				expect(result.success).toBe(false);
				expect(after.value.current_phase).toBe(from);
				expect(after.value.previous_phase).toBe(before.value.previous_phase);
			}
		}

		const db = getDatabase()!;
		const countRow = db.prepare('SELECT COUNT(*) as count FROM state_transitions WHERE workflow_state_id = (SELECT state_id FROM workflow_states WHERE dialogue_id = ?)').get(dialogueId) as { count: number };
		expect(countRow.count).toBe(successfulTransitions);
	});

	it('randomized metadata set/clear operations match an in-memory model', () => {
		const dialogueId = '00000000-0000-0000-0000-000000000072';
		insertDialogue(dialogueId);
		initializeWorkflowState(dialogueId, { goal: 'Build app' });

		const keys = [
			'pendingIntakeInput',
			'cachedRawCliOutput',
			'lastFailedPhase',
			'lastError',
			'replanRationale',
		] as const;
		const model: Record<string, string> = {};
		const rand = seededRng(0xBADC0DE);

		for (let i = 0; i < 160; i++) {
			const key = keys[Math.floor(rand() * keys.length)];
			const clear = rand() < 0.35;
			const payload: Record<string, unknown> = {};
			if (clear) {
				payload[key] = undefined;
				delete model[key];
			} else {
				const value = `${key}-v${i}-${Math.floor(rand() * 1000)}`;
				payload[key] = value;
				model[key] = value;
			}

			const write = updateWorkflowMetadata(dialogueId, payload as never);
			expect(write.success).toBe(true);

			const state = getWorkflowState(dialogueId);
			expect(state.success).toBe(true);
			if (!state.success) { return; }
			const metadata = JSON.parse(state.value.metadata) as Record<string, unknown>;

			for (const assertKey of keys) {
				expect(metadata[assertKey]).toBe(model[assertKey]);
			}
		}
	});
});
