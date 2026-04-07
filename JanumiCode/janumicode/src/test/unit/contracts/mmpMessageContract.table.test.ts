import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import { getDatabase } from '../../../lib/database/init';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { getPendingMmpDecisions, savePendingMmpDecisions } from '../../../lib/database/pendingMmpStore';
import { handleMMPSubmit } from '../../../lib/ui/governedStream/panelMmp';
import type { PanelContext } from '../../../lib/ui/governedStream/panelContext';

type WebviewMsg = { type: string; [key: string]: unknown };

interface MockCtx extends PanelContext {
	messages: WebviewMsg[];
	runCount: number;
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

function insertDialogue(id: string): void {
	const db = getDatabase()!;
	db.prepare(
		"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, ?, 'ACTIVE', datetime('now'))"
	).run(id, 'Build app');
}

function mmpMessage(cardId = 'PD-REVIEW-1'): { type: string; [key: string]: unknown } {
	return {
		type: 'mmpSubmit',
		cardId,
		mirrorDecisions: { 'MIR-1': { status: 'accepted', text: 'Tenant portal' } },
		menuSelections: { 'MENU-1': { selectedOptionId: 'FULL', selectedLabel: 'Full scope', question: 'Scope' } },
		preMortemDecisions: { 'RISK-1': { status: 'accepted', assumption: 'Timeline risk' } },
	};
}

function createCtx(options: {
	dialogueId: string | null;
	isProcessing?: boolean;
	throwOnRun?: boolean;
}): MockCtx {
	const messages: WebviewMsg[] = [];
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
			if (options.throwOnRun) { throw new Error('synthetic cycle failure'); }
		},
		resumeAfterGate: async () => {},
		get messages() { return messages; },
		get runCount() { return runCount; },
	};
}

describe('MMP host/webview message contract (table-driven)', () => {
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

	const cases: Array<{
		name: string;
		dialogueId: string | null;
		isProcessing?: boolean;
		initWorkflow?: boolean;
		throwOnRun?: boolean;
		expectType: 'mmpSubmitAccepted' | 'mmpSubmitRejected';
		expectReasonContains?: string;
		expectPendingRemoved: boolean;
	}> = [
		{
			name: 'rejects when no active dialogue',
			dialogueId: null,
			expectType: 'mmpSubmitRejected',
			expectReasonContains: 'No active dialogue',
			expectPendingRemoved: false,
		},
		{
			name: 'rejects while host processing',
			dialogueId: '00000000-0000-0000-0000-000000000001',
			isProcessing: true,
			initWorkflow: true,
			expectType: 'mmpSubmitRejected',
			expectReasonContains: 'Processing in progress',
			expectPendingRemoved: false,
		},
		{
			name: 'rejects when workflow state invariant fails',
			dialogueId: '00000000-0000-0000-0000-000000000002',
			initWorkflow: false,
			expectType: 'mmpSubmitRejected',
			expectReasonContains: 'Cannot submit decisions',
			expectPendingRemoved: false,
		},
		{
			name: 'rejects when workflow cycle throws',
			dialogueId: '00000000-0000-0000-0000-000000000003',
			initWorkflow: true,
			throwOnRun: true,
			expectType: 'mmpSubmitRejected',
			expectReasonContains: 'synthetic cycle failure',
			expectPendingRemoved: false,
		},
		{
			name: 'accepts after successful workflow handoff',
			dialogueId: '00000000-0000-0000-0000-000000000004',
			initWorkflow: true,
			expectType: 'mmpSubmitAccepted',
			expectPendingRemoved: true,
		},
	];

	for (const tc of cases) {
		it(tc.name, async () => {
			if (tc.dialogueId) {
				insertDialogue(tc.dialogueId);
				if (tc.initWorkflow) {
					initializeWorkflowState(tc.dialogueId, { goal: 'Build app' });
				}
				const saveResult = savePendingMmpDecisions(tc.dialogueId, 'PD-REVIEW-1', {
					mirrorDecisions: { 'PD-REVIEW-1:MIR-1': { status: 'accepted' } },
					menuSelections: {},
					preMortemDecisions: {},
				});
				expect(saveResult.success).toBe(true);
			}

			const ctx = createCtx({
				dialogueId: tc.dialogueId,
				isProcessing: tc.isProcessing,
				throwOnRun: tc.throwOnRun,
			});

			await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));

			const contractMsg = ctx.messages.find((m) =>
				m.type === 'mmpSubmitAccepted' || m.type === 'mmpSubmitRejected'
			);
			expect(contractMsg?.type).toBe(tc.expectType);
			if (tc.expectReasonContains) {
				expect(String(contractMsg?.reason ?? '')).toContain(tc.expectReasonContains);
			}

			if (tc.dialogueId) {
				const pending = getPendingMmpDecisions(tc.dialogueId);
				expect(pending.success).toBe(true);
				if (pending.success) {
					const hasCard = Object.keys(pending.value).includes('PD-REVIEW-1');
					expect(hasCard).toBe(!tc.expectPendingRemoved);
				}
			}
		});
	}
});
