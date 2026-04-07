import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import { closeDatabase, getDatabase, initializeDatabase } from '../../../lib/database/init';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { getPendingMmpDecisions, savePendingMmpDecisions } from '../../../lib/database/pendingMmpStore';
import { handleMMPSubmit } from '../../../lib/ui/governedStream/panelMmp';
import type { PanelContext } from '../../../lib/ui/governedStream/panelContext';

interface MockCtx extends PanelContext {
	messages: Array<{ type: string; [key: string]: unknown }>;
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

describe('panelMmp failure injection', () => {
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

	it('rejects submit and preserves pending decisions if DB connection is lost', async () => {
		const id = '00000000-0000-0000-0000-000000000041';
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'Build app' });
		const saveResult = savePendingMmpDecisions(id, 'PD-REVIEW-1', {
			mirrorDecisions: { 'PD-REVIEW-1:MIR-1': { status: 'accepted' } },
			menuSelections: {},
			preMortemDecisions: {},
		});
		expect(saveResult.success).toBe(true);

		// Simulate sidecar/DB outage immediately before submit handling.
		closeDatabase();

		const messages: Array<{ type: string; [key: string]: unknown }> = [];
		const ctx: MockCtx = {
			activeDialogueId: id,
			isProcessing: false,
			view: undefined,
			postProcessing: () => {},
			postInputEnabled: () => {},
			postToWebview: (m) => messages.push(m),
			update: () => {},
			runWorkflowCycle: async () => {},
			resumeAfterGate: async () => {},
			messages,
		};

		await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));

		const reject = messages.find((m) => m.type === 'mmpSubmitRejected');
		expect(reject).toBeDefined();
		expect(String(reject?.reason ?? '')).toContain('Cannot submit decisions');

		// Re-open DB and verify pending data survived.
		const reinit = initializeDatabase({
			path: tempDb.dbPath,
			connectionMode: process.env.JANUMICODE_TEST_DB_MODE as 'auto' | 'direct' | 'sidecar' | undefined,
			extensionPath: process.cwd(),
		});
		expect(reinit.success).toBe(true);
		const pending = getPendingMmpDecisions(id);
		expect(pending.success).toBe(true);
		if (pending.success) {
			expect(Object.keys(pending.value)).toContain('PD-REVIEW-1');
		}
	});

	it('rejects a concurrent second submit while first submit is in-flight', async () => {
		const id = '00000000-0000-0000-0000-000000000042';
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'Build app' });

		let releaseCycle: () => void = () => {};
		const cycleStarted = new Promise<void>((resolve) => {
			releaseCycle = () => resolve();
		});

		const messages: Array<{ type: string; [key: string]: unknown }> = [];
		const ctx: MockCtx = {
			activeDialogueId: id,
			isProcessing: false,
			view: undefined,
			postProcessing: () => {},
			postInputEnabled: () => {},
			postToWebview: (m) => messages.push(m),
			update: () => {},
			runWorkflowCycle: async () => {
				await cycleStarted;
			},
			resumeAfterGate: async () => {},
			messages,
		};

		const first = handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));
		// Let first call reach in-flight state before second submit.
		await Promise.resolve();
		await Promise.resolve();

		await handleMMPSubmit(ctx, mmpMessage('PD-REVIEW-1'));
		const secondReject = messages.find((m) =>
			m.type === 'mmpSubmitRejected' && String(m.reason ?? '').includes('Processing in progress')
		);
		expect(secondReject).toBeDefined();

		releaseCycle();
		await first;

		const acceptedCount = messages.filter((m) => m.type === 'mmpSubmitAccepted').length;
		const rejectedCount = messages.filter((m) => m.type === 'mmpSubmitRejected').length;
		expect(acceptedCount).toBe(1);
		expect(rejectedCount).toBe(1);
	});
});
