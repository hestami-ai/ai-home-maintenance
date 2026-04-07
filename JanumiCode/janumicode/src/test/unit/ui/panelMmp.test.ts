import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import { getDatabase } from '../../../lib/database/init';
import { getLogger } from '../../../lib/logging';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { getPendingMmpDecisions, savePendingMmpDecisions } from '../../../lib/database/pendingMmpStore';
import { handleMMPSubmit } from '../../../lib/ui/governedStream/panelMmp';
import type { PanelContext } from '../../../lib/ui/governedStream/panelContext';

function insertDialogue(id: string, goal = 'test goal'): void {
	const db = getDatabase()!;
	db.prepare(
		"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, ?, 'ACTIVE', datetime('now'))"
	).run(id, goal);
}

function mmpMessage(cardId = 'PD-REVIEW-1'): { type: string; [key: string]: unknown } {
	return {
		type: 'mmpSubmit',
		cardId,
		mirrorDecisions: {
			'MIR-1': { status: 'accepted', text: 'Tenant portal' },
		},
		menuSelections: {
			'MENU-1': { selectedOptionId: 'FULL', selectedLabel: 'Full scope', question: 'Scope' },
		},
		preMortemDecisions: {
			'RISK-1': { status: 'accepted', assumption: 'Timeline risk' },
		},
	};
}

function ensurePendingMmpTable(): void {
	const db = getDatabase()!;
	db.exec(`
		CREATE TABLE IF NOT EXISTS pending_mmp_decisions (
			dialogue_id TEXT NOT NULL,
			card_id TEXT NOT NULL,
			mirror_decisions TEXT NOT NULL DEFAULT '{}',
			menu_selections TEXT NOT NULL DEFAULT '{}',
			premortem_decisions TEXT NOT NULL DEFAULT '{}',
			product_edits TEXT NOT NULL DEFAULT '{}',
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (dialogue_id, card_id)
		);
		CREATE INDEX IF NOT EXISTS idx_pending_mmp_dialogue ON pending_mmp_decisions(dialogue_id);
	`);
}

interface MockCtx extends PanelContext {
	messages: Array<{ type: string; [key: string]: unknown }>;
	runCount: number;
}

function createCtx(options: {
	dialogueId: string | null;
	isProcessing?: boolean;
	throwOnRun?: boolean;
}): MockCtx {
	const messages: Array<{ type: string; [key: string]: unknown }> = [];
	let runCount = 0;

	let activeDialogueId = options.dialogueId;
	let isProcessing = options.isProcessing ?? false;

	return {
		get activeDialogueId() { return activeDialogueId; },
		set activeDialogueId(v) { activeDialogueId = v; },
		get isProcessing() { return isProcessing; },
		set isProcessing(v) { isProcessing = v; },
		get view() { return undefined; },
		postProcessing: () => {},
		postInputEnabled: () => {},
		postToWebview: (message) => { messages.push(message); },
		update: () => {},
		runWorkflowCycle: async () => {
			runCount++;
			if (options.throwOnRun) {
				throw new Error('synthetic cycle failure');
			}
		},
		resumeAfterGate: async () => {},
		get messages() { return messages; },
		get runCount() { return runCount; },
	};
}

describe('panelMmp.handleMMPSubmit', () => {
	let tempDb: TempDbContext;
	let deterministic: DeterministicHarness;

	beforeEach(() => {
		deterministic = useDeterministicHarness();
		initTestLogger();
		tempDb = createTempDatabase();
		ensurePendingMmpTable();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
		deterministic.restore();
	});

	it('rejects submit when host is already processing (no silent drop)', async () => {
		const id = '00000000-0000-0000-0000-000000000001';
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'Build app' });
		const ctx = createCtx({ dialogueId: id, isProcessing: true });

		await handleMMPSubmit(ctx, mmpMessage());

		expect(ctx.runCount).toBe(0);
		expect(ctx.messages.some((m) => m.type === 'mmpSubmitRejected')).toBe(true);
		expect(ctx.messages.some((m) => m.type === 'mmpSubmitAccepted')).toBe(false);
	});

	it('rejects when workflow state invariant fails and preserves pending decisions', async () => {
		const id = '00000000-0000-0000-0000-000000000002';
		insertDialogue(id);
		// Intentionally do NOT initialize workflow state to trigger invariant rejection.
		const saveResult = savePendingMmpDecisions(id, 'PD-REVIEW-1', {
			mirrorDecisions: { 'PD-REVIEW-1:MIR-1': { status: 'accepted' } },
			menuSelections: {},
			preMortemDecisions: {},
		});
		expect(saveResult.success).toBe(true);

		const ctx = createCtx({ dialogueId: id });
		await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));

		expect(ctx.runCount).toBe(0);
		const reject = ctx.messages.find((m) => m.type === 'mmpSubmitRejected');
		expect(reject).toBeDefined();
		expect(typeof reject?.reason === 'string' ? reject.reason : '').toContain('Cannot submit decisions');

		const pending = getPendingMmpDecisions(id);
		expect(pending.success).toBe(true);
		if (pending.success) {
			expect(Object.keys(pending.value)).toContain('PD-REVIEW-1');
		}

		const invariantLog = getLogger()
			.getRecentEntries(30)
			.find((entry) => entry.message === 'submitInvariantViolation');
		expect(invariantLog).toBeDefined();
		const invariantData = invariantLog?.data;
		expect(invariantData?.severity).toBe('HIGH');
		expect(typeof invariantData?.correlationId).toBe('string');
	});

	it('accepts submit after successful cycle and deletes pending decisions', async () => {
		const id = '00000000-0000-0000-0000-000000000003';
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'Build app' });
		const saveResult = savePendingMmpDecisions(id, 'PD-REVIEW-1', {
			mirrorDecisions: { 'PD-REVIEW-1:MIR-1': { status: 'accepted' } },
			menuSelections: {},
			preMortemDecisions: {},
		});
		expect(saveResult.success).toBe(true);

		const ctx = createCtx({ dialogueId: id });
		await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));

		expect(ctx.runCount).toBe(1);
		expect(ctx.messages.some((m) => m.type === 'mmpSubmitAccepted')).toBe(true);
		expect(ctx.messages.some((m) => m.type === 'mmpSubmitRejected')).toBe(false);

		const pending = getPendingMmpDecisions(id);
		expect(pending.success).toBe(true);
		if (pending.success) {
			expect(Object.keys(pending.value)).not.toContain('PD-REVIEW-1');
		}
	});

	it('rejects when workflow cycle throws and keeps pending decisions', async () => {
		const id = '00000000-0000-0000-0000-000000000004';
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'Build app' });
		const saveResult = savePendingMmpDecisions(id, 'PD-REVIEW-1', {
			mirrorDecisions: { 'PD-REVIEW-1:MIR-1': { status: 'accepted' } },
			menuSelections: {},
			preMortemDecisions: {},
		});
		expect(saveResult.success).toBe(true);

		const ctx = createCtx({ dialogueId: id, throwOnRun: true });
		await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));

		expect(ctx.runCount).toBe(1);
		expect(ctx.messages.some((m) => m.type === 'mmpSubmitAccepted')).toBe(false);
		const reject = ctx.messages.find((m) => m.type === 'mmpSubmitRejected');
		expect(reject).toBeDefined();
		expect(typeof reject?.reason === 'string' ? reject.reason : '').toContain('synthetic cycle failure');

		const pending = getPendingMmpDecisions(id);
		expect(pending.success).toBe(true);
		if (pending.success) {
			expect(Object.keys(pending.value)).toContain('PD-REVIEW-1');
		}
	});
});
