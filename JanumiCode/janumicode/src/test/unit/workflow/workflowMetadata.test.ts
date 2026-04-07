/**
 * Workflow Metadata & State Machine Regression Tests
 *
 * Tests the bugs discovered during manual testing:
 * 1. updateWorkflowMetadata: setting fields to undefined must CLEAR them from JSON
 * 2. advanceWorkflow guard: PRODUCT_REVIEW with no pendingIntakeInput must not replay goal
 * 3. preProposerReview: must be clearable (not stuck as true)
 * 4. Intake sub-state transitions: PRODUCT_REVIEW → PROPOSING_BUSINESS_DOMAINS → PROPOSING_JOURNEYS
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import {
	initializeWorkflowState,
	getWorkflowState,
	updateWorkflowMetadata,
} from '../../../lib/workflow/stateMachine';
import { advanceWorkflow } from '../../../lib/workflow/orchestrator';
import { updateIntakeConversation } from '../../../lib/events/writer';
import { getOrCreateIntakeConversation } from '../../../lib/events/reader';
import { IntakeSubState, ProposerPhase } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';

// ─── Helpers ──────────────────────────────────────────────────────────

function insertDialogue(id: string, goal = 'test goal'): void {
	const db = getDatabase()!;
	db.prepare(
		"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, ?, 'ACTIVE', datetime('now'))"
	).run(id, goal);
}

function getMetadata(dialogueId: string): Record<string, unknown> {
	const result = getWorkflowState(dialogueId);
	if (!result.success) { throw new Error(`getWorkflowState failed: ${result.error.message}`); }
	return JSON.parse(result.value.metadata);
}

let nextId = 1;
function freshId(): string {
	const n = nextId++;
	return `aaaaaaaa-bbbb-cccc-dddd-${String(n).padStart(12, '0')}`;
}

let deterministic: DeterministicHarness;
beforeEach(() => {
	deterministic = useDeterministicHarness({ useClock: false });
});
afterEach(() => {
	deterministic.restore();
});

// ─── Test Suite ───────────────────────────────────────────────────────

describe('updateWorkflowMetadata — field clearing', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('sets a metadata field', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'build something' });

		updateWorkflowMetadata(id, { pendingIntakeInput: 'hello world' });

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBe('hello world');
	});

	it('does not call db.transaction during metadata update (sidecar recording regression guard)', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'build something' });

		const db = getDatabase()!;
		const txnSpy = vi.spyOn(db, 'transaction').mockImplementation(() => {
			throw new Error('db.transaction should not be called by updateWorkflowMetadata');
		});

		try {
			const result = updateWorkflowMetadata(id, { pendingIntakeInput: 'hello world' });
			expect(result.success).toBe(true);
			expect(txnSpy).not.toHaveBeenCalled();
			expect(getMetadata(id).pendingIntakeInput).toBe('hello world');
		} finally {
			txnSpy.mockRestore();
		}
	});

	it('clears a field when set to undefined (the JSON serialization bug)', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'build something' });

		// Set a field
		updateWorkflowMetadata(id, { pendingIntakeInput: 'some input' });
		expect(getMetadata(id).pendingIntakeInput).toBe('some input');

		// Clear the field with undefined
		updateWorkflowMetadata(id, { pendingIntakeInput: undefined });

		// The field should be GONE from the metadata (not still 'some input')
		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBeUndefined();
		expect('pendingIntakeInput' in meta).toBe(false);
	});

	it('clears cachedRawCliOutput when set to undefined', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id);

		updateWorkflowMetadata(id, { cachedRawCliOutput: 'some raw output' });
		expect(getMetadata(id).cachedRawCliOutput).toBe('some raw output');

		updateWorkflowMetadata(id, { cachedRawCliOutput: undefined });
		expect(getMetadata(id).cachedRawCliOutput).toBeUndefined();
	});

	it('clears lastFailedPhase and lastError when set to undefined', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id);

		updateWorkflowMetadata(id, { lastFailedPhase: 'INTAKE', lastError: 'boom' });
		const before = getMetadata(id);
		expect(before.lastFailedPhase).toBe('INTAKE');
		expect(before.lastError).toBe('boom');

		updateWorkflowMetadata(id, { lastFailedPhase: undefined, lastError: undefined });
		const after = getMetadata(id);
		expect(after.lastFailedPhase).toBeUndefined();
		expect(after.lastError).toBeUndefined();
	});

	it('clears phaseCheckpoint when set to undefined', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id);

		updateWorkflowMetadata(id, { phaseCheckpoint: { step: 3, data: 'test' } as never });
		expect(getMetadata(id).phaseCheckpoint).toBeDefined();

		updateWorkflowMetadata(id, { phaseCheckpoint: undefined });
		expect(getMetadata(id).phaseCheckpoint).toBeUndefined();
	});

	it('clears current_unit_id when set to undefined', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id);

		updateWorkflowMetadata(id, { current_unit_id: 'unit-42' });
		expect(getMetadata(id).current_unit_id).toBe('unit-42');

		updateWorkflowMetadata(id, { current_unit_id: undefined });
		expect(getMetadata(id).current_unit_id).toBeUndefined();
	});

	it('clears replanRationale when set to undefined', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id);

		updateWorkflowMetadata(id, { replanRationale: 'because tests' } as never);
		expect(getMetadata(id).replanRationale).toBe('because tests');

		updateWorkflowMetadata(id, { replanRationale: undefined } as never);
		expect(getMetadata(id).replanRationale).toBeUndefined();
	});

	it('does not affect other fields when clearing one', () => {
		const id = freshId();
		insertDialogue(id);
		initializeWorkflowState(id, { goal: 'build something' });

		updateWorkflowMetadata(id, {
			pendingIntakeInput: 'input',
			cachedRawCliOutput: 'output',
			lastFailedPhase: 'INTAKE',
		});

		// Clear only pendingIntakeInput
		updateWorkflowMetadata(id, { pendingIntakeInput: undefined });

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBeUndefined();
		expect(meta.cachedRawCliOutput).toBe('output');
		expect(meta.lastFailedPhase).toBe('INTAKE');
		expect(meta.goal).toBe('build something');
	});
});

describe('Intake conversation — preProposerReview clearing', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('preProposerReview=false persists in draftPlan (not dropped like undefined)', () => {
		const id = freshId();
		insertDialogue(id);

		// Create intake conversation
		getOrCreateIntakeConversation(id);

		// Set preProposerReview to true (as executeIntakeAnalysis does)
		const conv = getOrCreateIntakeConversation(id);
		expect(conv.success).toBe(true);
		if (!conv.success) { return; }

		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: { ...conv.value.draftPlan, preProposerReview: true } as never,
		});

		// Verify it's true
		const afterSet = getOrCreateIntakeConversation(id);
		expect(afterSet.success).toBe(true);
		if (!afterSet.success) { return; }
		expect(afterSet.value.draftPlan.preProposerReview).toBe(true);

		// Clear it with false (the fix)
		updateIntakeConversation(id, {
			draftPlan: { ...afterSet.value.draftPlan, preProposerReview: false } as never,
		});

		// Verify it's false (not still true)
		const afterClear = getOrCreateIntakeConversation(id);
		expect(afterClear.success).toBe(true);
		if (!afterClear.success) { return; }
		expect(afterClear.value.draftPlan.preProposerReview).toBe(false);
	});

	it('preProposerReview=undefined would be DROPPED from JSON (demonstrating the bug)', () => {
		const id = freshId();
		insertDialogue(id);
		getOrCreateIntakeConversation(id);

		const conv = getOrCreateIntakeConversation(id);
		if (!conv.success) { return; }

		// Set preProposerReview to true
		updateIntakeConversation(id, {
			draftPlan: { ...conv.value.draftPlan, preProposerReview: true } as never,
		});

		// Try to "clear" with undefined — this creates a new object where the key is absent
		const afterSet = getOrCreateIntakeConversation(id);
		if (!afterSet.success) { return; }
		const planWithUndefined = { ...afterSet.value.draftPlan, preProposerReview: undefined };

		// JSON.stringify drops undefined values — so the key won't be in the JSON
		const serialized = JSON.stringify(planWithUndefined);
		const deserialized = JSON.parse(serialized);

		// The key is GONE from the serialized object (this is the fundamental issue)
		expect('preProposerReview' in deserialized).toBe(false);

		// But when we spread `{ ...oldPlan, preProposerReview: undefined }`,
		// the undefined DOES override in the in-memory object
		expect(planWithUndefined.preProposerReview).toBeUndefined();

		// However, if updateIntakeConversation did a read-modify-write with JSON,
		// the old `true` value from the DB could persist depending on implementation.
		// updateIntakeConversation replaces the entire draftPlan column, so the spread
		// + JSON.stringify approach means the key is absent → on re-read it's undefined.
		// This specific case works because it's a full column replacement.
		// The updateWorkflowMetadata case is different because it MERGES.
	});
});

describe('Intake sub-state transitions', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('sets up PRODUCT_REVIEW with proposerPhase correctly', () => {
		const id = freshId();
		insertDialogue(id);
		getOrCreateIntakeConversation(id);

		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: false,
			} as never,
		});

		const conv = getOrCreateIntakeConversation(id);
		expect(conv.success).toBe(true);
		if (!conv.success) { return; }
		expect(conv.value.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(conv.value.draftPlan.proposerPhase).toBe(ProposerPhase.BUSINESS_DOMAIN_MAPPING);
		expect(conv.value.draftPlan.preProposerReview).toBe(false);
	});

	it('pendingIntakeInput fallback to goal: guard should block in PRODUCT_REVIEW', () => {
		const id = freshId();
		insertDialogue(id, 'Review specs for my app');
		initializeWorkflowState(id, { goal: 'Review specs for my app' });
		getOrCreateIntakeConversation(id);

		// Set intake state to PRODUCT_REVIEW (post-domain-mapping)
		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: false,
			} as never,
		});

		// No pendingIntakeInput set — advanceWorkflow should detect this
		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBeUndefined();
		expect(meta.goal).toBe('Review specs for my app');

		// The humanInput fallback would be: metadata.pendingIntakeInput ?? metadata.goal
		// which equals 'Review specs for my app' (the original goal)
		// This should NOT be fed to the router as if it were fresh user input
		const humanInput = (meta.pendingIntakeInput as string | undefined) ?? (meta.goal as string) ?? '';
		expect(humanInput).toBe('Review specs for my app');
		expect(humanInput.startsWith('[MMP Decisions]')).toBe(false);

		// The guard in advanceWorkflow should catch this scenario:
		// subState is PRODUCT_REVIEW AND pendingIntakeInput is absent
		const conv = getOrCreateIntakeConversation(id);
		expect(conv.success).toBe(true);
		if (!conv.success) { return; }
		const awaitingStates = ['PRODUCT_REVIEW', 'CLARIFYING', 'AWAITING_APPROVAL'];
		expect(awaitingStates.includes(conv.value.subState)).toBe(true);
	});

	it('pendingIntakeInput with MMP decisions should pass through guard', () => {
		const id = freshId();
		insertDialogue(id, 'Review specs for my app');
		initializeWorkflowState(id, { goal: 'Review specs for my app' });
		getOrCreateIntakeConversation(id);

		// Set intake state to PRODUCT_REVIEW
		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: true,
			} as never,
		});

		// Set pendingIntakeInput with MMP decisions (as panelMmp.ts does)
		updateWorkflowMetadata(id, {
			pendingIntakeInput: '[MMP Decisions]\n## Mirror\n- DOM-1: accepted',
		});

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBeDefined();
		expect((meta.pendingIntakeInput as string).startsWith('[MMP Decisions]')).toBe(true);

		// The guard should NOT block because pendingIntakeInput is present
		// humanInput = pendingIntakeInput (not goal)
		const humanInput = (meta.pendingIntakeInput as string | undefined) ?? (meta.goal as string) ?? '';
		expect(humanInput.startsWith('[MMP Decisions]')).toBe(true);
	});

	it('clearing pendingIntakeInput then reading falls back to goal', () => {
		const id = freshId();
		insertDialogue(id, 'Build a real estate app');
		initializeWorkflowState(id, { goal: 'Build a real estate app' });

		// Set then clear
		updateWorkflowMetadata(id, { pendingIntakeInput: '[MMP Decisions] test' });
		expect(getMetadata(id).pendingIntakeInput).toBe('[MMP Decisions] test');

		updateWorkflowMetadata(id, { pendingIntakeInput: undefined });
		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBeUndefined();

		// Fallback to goal
		const humanInput = (meta.pendingIntakeInput as string | undefined) ?? (meta.goal as string) ?? '';
		expect(humanInput).toBe('Build a real estate app');
	});
});

describe('advanceWorkflow — INTAKE guard (the active bug)', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('blocks with awaitingInput when PRODUCT_REVIEW has no pendingIntakeInput', async () => {
		const id = freshId();
		insertDialogue(id, 'Review specs for my app');
		initializeWorkflowState(id, { goal: 'Review specs for my app' });
		getOrCreateIntakeConversation(id);

		// Simulate state after domain mapping completes: PRODUCT_REVIEW, no pending input
		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: false,
			} as never,
		});

		// No pendingIntakeInput — advanceWorkflow should return awaitingInput
		const result = await advanceWorkflow(id);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.awaitingInput).toBe(true);
		}
	});

	it('blocks with awaitingInput when CLARIFYING has no pendingIntakeInput', async () => {
		const id = freshId();
		insertDialogue(id, 'Build something');
		initializeWorkflowState(id, { goal: 'Build something' });
		getOrCreateIntakeConversation(id);

		updateIntakeConversation(id, {
			subState: IntakeSubState.CLARIFYING,
		});

		const result = await advanceWorkflow(id);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.awaitingInput).toBe(true);
		}
	});

	it('blocks with awaitingInput when AWAITING_APPROVAL has no pendingIntakeInput', async () => {
		const id = freshId();
		insertDialogue(id, 'Build something');
		initializeWorkflowState(id, { goal: 'Build something' });
		getOrCreateIntakeConversation(id);

		updateIntakeConversation(id, {
			subState: IntakeSubState.AWAITING_APPROVAL,
		});

		const result = await advanceWorkflow(id);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.awaitingInput).toBe(true);
		}
	});

	it('does NOT block when PRODUCT_REVIEW has pendingIntakeInput with MMP decisions', async () => {
		const id = freshId();
		insertDialogue(id, 'Review specs for my app');
		initializeWorkflowState(id, { goal: 'Review specs for my app' });
		getOrCreateIntakeConversation(id);

		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: true,
			} as never,
		});

		// Set pendingIntakeInput (as panelMmp.ts does on MMP submit)
		updateWorkflowMetadata(id, {
			pendingIntakeInput: '[MMP Decisions]\n## Mirror\n- PD-MIR-1: accepted\n- PD-MIR-2: accepted',
		});

		// advanceWorkflow should NOT return awaitingInput — it should proceed
		// (it will fail because no LLM providers, but that's fine — we check it didn't short-circuit)
		const result = await advanceWorkflow(id);

		// If the guard blocked, result.value.awaitingInput would be true
		// If the guard let it through, it will try executeIntakePhase and likely fail
		// (no providers) — that's a success: false with an error, not awaitingInput
		if (result.success && result.value.awaitingInput) {
			// This is the bug — guard incorrectly blocked despite pendingIntakeInput being set
			expect.fail('Guard blocked even though pendingIntakeInput was set — the active bug!');
		}
		// Either success with awaitingInput=false (phase ran), or failure (no providers) — both mean guard passed
		expect(true).toBe(true); // Guard did not block
	});

	it('does NOT block INTENT_DISCOVERY even without pendingIntakeInput (initial prompt uses goal)', async () => {
		const id = freshId();
		insertDialogue(id, 'Build a real estate platform');
		initializeWorkflowState(id, { goal: 'Build a real estate platform' });
		getOrCreateIntakeConversation(id);

		// INTENT_DISCOVERY is the initial sub-state — it SHOULD use metadata.goal
		updateIntakeConversation(id, {
			subState: IntakeSubState.INTENT_DISCOVERY,
		});

		// No pendingIntakeInput — but INTENT_DISCOVERY is not in the guard list
		const result = await advanceWorkflow(id);

		// Should NOT return awaitingInput — should proceed (and fail due to no providers)
		if (result.success && result.value.awaitingInput) {
			expect.fail('Guard incorrectly blocked INTENT_DISCOVERY — should only block PRODUCT_REVIEW/CLARIFYING/AWAITING_APPROVAL');
		}
		expect(true).toBe(true);
	});
});

describe('MMP submit → advanceWorkflow end-to-end (the active UI bug)', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('pendingIntakeInput set immediately before advanceWorkflow is readable inside advanceWorkflow', async () => {
		// This test simulates the exact panelMmp.handleMMPSubmit → runWorkflowCycle flow:
		// 1. updateWorkflowMetadata({ pendingIntakeInput: mmpText })
		// 2. advanceWorkflow reads metadata.pendingIntakeInput
		// If pendingIntakeInput is NONE inside advanceWorkflow, the guard blocks and the bug reproduces.

		const id = freshId();
		insertDialogue(id, 'Build a property management platform');
		initializeWorkflowState(id, { goal: 'Build a property management platform' });
		getOrCreateIntakeConversation(id);

		// Set up: dialogue in PRODUCT_REVIEW (post intent discovery)
		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				preProposerReview: true,
			} as never,
		});

		// Simulate panelMmp.handleMMPSubmit line 156-158:
		const mmpText = '[MMP Decisions]\nACCEPTED: "Tenant portal"\nACCEPTED: "Maintenance requests"';
		const writeResult = updateWorkflowMetadata(id, {
			pendingIntakeInput: mmpText,
		});
		expect(writeResult.success, 'updateWorkflowMetadata should succeed').toBe(true);

		// Verify the write persisted by re-reading (same as advanceWorkflow does)
		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput, 'pendingIntakeInput should survive write→read round-trip').toBe(mmpText);

		// Now call advanceWorkflow — should NOT be blocked by the guard
		const result = await advanceWorkflow(id);

		// If the guard blocked, it returns awaitingInput: true with no phase execution
		if (result.success && result.value.awaitingInput) {
			// Check what advanceWorkflow actually saw
			const metaAfter = getMetadata(id);
			expect.fail(
				`Guard blocked despite pendingIntakeInput being set! ` +
				`Before: pendingIntakeInput="${mmpText.slice(0, 40)}..." ` +
				`After: pendingIntakeInput=${metaAfter.pendingIntakeInput ? '"SET"' : 'NONE'}`
			);
		}

		// advanceWorkflow should have proceeded (and likely failed due to no CLI providers,
		// but that's fine — the point is it didn't short-circuit at the guard)
	});

	it('pendingIntakeInput survives write→read cycle through getWorkflowState JSON parse', () => {
		const id = freshId();
		insertDialogue(id, 'test goal');
		initializeWorkflowState(id, { goal: 'test goal' });

		const mmpText = '[MMP Decisions]\nACCEPTED: "Feature A"\nSELECTED: "Option B" → "Full scope"';

		// Write
		updateWorkflowMetadata(id, { pendingIntakeInput: mmpText });

		// Read via getWorkflowState (same path as advanceWorkflow line 2570)
		const stateResult = getWorkflowState(id);
		expect(stateResult.success).toBe(true);
		if (!stateResult.success) { return; }

		const metadata = JSON.parse(stateResult.value.metadata);
		expect(metadata.pendingIntakeInput).toBe(mmpText);

		// Verify the nullish coalescing fallback works correctly
		const humanInput = metadata.pendingIntakeInput ?? metadata.goal ?? '';
		expect(humanInput).toBe(mmpText);
		expect(humanInput.startsWith('[MMP Decisions]')).toBe(true);
	});

	it('pendingIntakeInput with special characters survives JSON round-trip', () => {
		const id = freshId();
		insertDialogue(id, 'test goal');
		initializeWorkflowState(id, { goal: 'test goal' });

		// MMP text can contain quotes, newlines, unicode from LLM output
		const mmpText = '[MMP Decisions]\nACCEPTED: "Tenant portal — \'self-service\' with "quotes""\nEDITED: "Original" → "Revised with émojis 🏠"';

		updateWorkflowMetadata(id, { pendingIntakeInput: mmpText });

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBe(mmpText);
	});

	it('pendingIntakeInput is consumed (cleared) after advanceWorkflow reads it', async () => {
		const id = freshId();
		insertDialogue(id, 'Build something');
		initializeWorkflowState(id, { goal: 'Build something' });
		getOrCreateIntakeConversation(id);

		// Set PRODUCT_REVIEW state + pendingIntakeInput
		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: { preProposerReview: true } as never,
		});
		updateWorkflowMetadata(id, {
			pendingIntakeInput: '[MMP Decisions]\nACCEPTED: "test"',
		});

		// Run advanceWorkflow — it should consume pendingIntakeInput
		await advanceWorkflow(id);

		// After consumption, pendingIntakeInput should be cleared
		const metaAfter = getMetadata(id);
		expect(metaAfter.pendingIntakeInput).toBeUndefined();
		// And goal should still be there as fallback
		expect(metaAfter.goal).toBe('Build something');
	});

	it('multiple rapid updateWorkflowMetadata calls: last write wins', () => {
		const id = freshId();
		insertDialogue(id, 'test goal');
		initializeWorkflowState(id, { goal: 'test goal' });

		// Simulate rapid writes (e.g., partial saves followed by final MMP submit)
		updateWorkflowMetadata(id, { pendingIntakeInput: 'partial-1' });
		updateWorkflowMetadata(id, { pendingIntakeInput: 'partial-2' });
		updateWorkflowMetadata(id, { pendingIntakeInput: '[MMP Decisions]\nfinal' });

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBe('[MMP Decisions]\nfinal');
	});

	it('updateWorkflowMetadata does not clobber other fields when setting pendingIntakeInput', () => {
		const id = freshId();
		insertDialogue(id, 'test goal');
		initializeWorkflowState(id, { goal: 'test goal', lastIntakeGoal: 'original goal' });

		updateWorkflowMetadata(id, { pendingIntakeInput: '[MMP Decisions]\ntest' });

		const meta = getMetadata(id);
		expect(meta.pendingIntakeInput).toBe('[MMP Decisions]\ntest');
		expect(meta.goal).toBe('test goal');
		expect(meta.lastIntakeGoal).toBe('original goal');
	});

	it('updateWorkflowMetadata returns success=false for non-existent dialogue', () => {
		// Simulates what happens if the metadata write fails in panelMmp.handleMMPSubmit
		const result = updateWorkflowMetadata('non-existent-id', {
			pendingIntakeInput: '[MMP Decisions]\ntest',
		});
		expect(result.success).toBe(false);
	});

	it('advanceWorkflow with PRODUCT_REVIEW and empty pendingIntakeInput string blocks', async () => {
		// Edge case: pendingIntakeInput is set to empty string (should be treated as absent)
		const id = freshId();
		insertDialogue(id, 'Build something');
		initializeWorkflowState(id, { goal: 'Build something' });
		getOrCreateIntakeConversation(id);

		updateIntakeConversation(id, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: { preProposerReview: false } as never,
		});

		// Set pendingIntakeInput to empty string
		updateWorkflowMetadata(id, { pendingIntakeInput: '' });

		const result = await advanceWorkflow(id);
		// Empty string is falsy — guard should block
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.awaitingInput).toBe(true);
		}
	});
});
