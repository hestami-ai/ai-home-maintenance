import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../lib/database';
import { getGate } from '../../../lib/workflow/gates';
import { processHumanGateDecision } from '../../../lib/workflow/humanGateHandling';
import { runNarrativeCuration } from '../../../lib/curation/narrativeCurator';
import { updateWorkflowMetadata, transitionWorkflow } from '../../../lib/workflow/stateMachine';
import { writeClaimEvent } from '../../../lib/events/writer';
import {
	handleGateDecision,
	handleGateDecisionAndResume,
	handleVerificationGateDecision,
	handleReviewGateDecision,
} from '../../../lib/ui/governedStream/panelGates';
import type { PanelContext } from '../../../lib/ui/governedStream/panelContext';
import { HumanAction, Phase } from '../../../lib/types';
import * as vscode from 'vscode';

// Mock dependencies
vi.mock('vscode', () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
}));

vi.mock('../../../lib/workflow/humanGateHandling', () => ({
	processHumanGateDecision: vi.fn(),
}));

vi.mock('../../../lib/workflow/gates', () => ({
	resolveGate: vi.fn(),
	getGate: vi.fn(),
}));

vi.mock('../../../lib/workflow/stateMachine', () => ({
	transitionWorkflow: vi.fn(),
	updateWorkflowMetadata: vi.fn(),
	TransitionTrigger: {
		PHASE_COMPLETE: 'PHASE_COMPLETE',
		REPLAN_REQUIRED: 'REPLAN_REQUIRED',
	},
}));

vi.mock('../../../lib/events/writer', () => ({
	writeClaimEvent: vi.fn(),
}));

vi.mock('../../../lib/curation/narrativeCurator', () => ({
	runNarrativeCuration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/database', () => ({
	getDatabase: vi.fn(),
}));

describe('ui/panelGates', () => {
	let mockContext: PanelContext;
	let mockDb: any;

	beforeEach(() => {
		// Create mock panel context
		mockContext = {
			activeDialogueId: 'dlg-123',
			isProcessing: false,
			postToWebview: vi.fn(),
			update: vi.fn(),
			resumeAfterGate: vi.fn().mockResolvedValue(undefined),
			runWorkflowCycle: vi.fn().mockResolvedValue(undefined),
			postInputEnabled: vi.fn(),
			postProcessing: vi.fn(),
		} as any;

		// Mock database
		mockDb = {
			prepare: vi.fn().mockReturnValue({
				get: vi.fn(),
				run: vi.fn(),
				all: vi.fn().mockReturnValue([]),
			}),
		};
		vi.mocked(getDatabase).mockReturnValue(mockDb);

		vi.clearAllMocks();
	});

	describe('handleGateDecision', () => {
		it('rejects short rationale', () => {
			handleGateDecision(mockContext, 'gate-1', 'APPROVE', 'Too short');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Rationale must be at least 10 characters.',
			});
		});

		it('rejects when processing in progress', () => {
			mockContext.isProcessing = true;

			handleGateDecision(mockContext, 'gate-1', 'APPROVE', 'Valid rationale here');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Processing in progress — please wait',
			});
		});

		it('rejects invalid action', () => {
			handleGateDecision(mockContext, 'gate-1', 'INVALID_ACTION', 'Valid rationale here');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Invalid action: INVALID_ACTION',
			});
		});

		it('processes valid gate decision', () => {
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			handleGateDecision(mockContext, 'gate-1', 'APPROVE', 'This is a valid rationale');

			expect(processHumanGateDecision).toHaveBeenCalledWith({
				gateId: 'gate-1',
				action: HumanAction.APPROVE,
				rationale: 'This is a valid rationale',
				decisionMaker: 'human-user',
			});

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionAccepted',
				gateId: 'gate-1',
			});

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'Gate approved successfully.'
			);

			expect(mockContext.update).toHaveBeenCalled();
		});

		it('handles processing failure', () => {
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: false,
				error: new Error('Processing failed'),
			} as any);

			handleGateDecision(mockContext, 'gate-1', 'APPROVE', 'Valid rationale here');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Processing failed',
			});
		});

		it('runs narrative curation after success', () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			handleGateDecision(mockContext, 'gate-1', 'APPROVE', 'Valid rationale here');

			expect(runNarrativeCuration).toHaveBeenCalledWith('dlg-123', expect.any(String));
		});
	});

	describe('handleGateDecisionAndResume', () => {
		it('handles regular gate without repair escalation', async () => {
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			mockDb.prepare().get.mockReturnValue(undefined);

			await handleGateDecisionAndResume(mockContext, 'gate-1', 'APPROVE', 'Valid rationale');

			expect(mockContext.resumeAfterGate).not.toHaveBeenCalled();
		});

		it('handles repair escalation gate', async () => {
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			mockDb.prepare().get.mockReturnValue({
				metadata: JSON.stringify({
					condition: 'REPAIR_ESCALATION',
					unit_id: 'unit-123',
				}),
			});

			await handleGateDecisionAndResume(mockContext, 'gate-1', 'APPROVE', 'Valid rationale');

			expect(mockContext.resumeAfterGate).toHaveBeenCalled();
		});
	});

	describe('handleVerificationGateDecision', () => {
		it('rejects when no active dialogue', async () => {
			mockContext.activeDialogueId = null;

			await handleVerificationGateDecision(mockContext, 'gate-1', 'OVERRIDE');

			expect(mockContext.postToWebview).not.toHaveBeenCalled();
		});

		it('rejects when processing in progress', async () => {
			mockContext.isProcessing = true;

			await handleVerificationGateDecision(mockContext, 'gate-1', 'OVERRIDE');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Processing in progress — please wait',
			});
		});

		it('handles OVERRIDE action with claim rationales', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			const claimRationales = {
				'claim-1': 'Risk accepted for claim 1',
				'claim-2': 'Risk accepted for claim 2',
			};

			await handleVerificationGateDecision(
				mockContext,
				'gate-1',
				'OVERRIDE',
				claimRationales
			);

			expect(writeClaimEvent).toHaveBeenCalledTimes(2);
			expect(mockContext.resumeAfterGate).toHaveBeenCalled();
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'Verification risks accepted. Continuing workflow.'
			);
		});

		it('handles RETRY_VERIFY action', async () => {

			vi.mocked(getGate).mockReturnValue({
				success: true,
				value: {
					gate_id: 'gate-1',
					blocking_claims: ['claim-1', 'claim-2'],
				},
			} as any);

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			await handleVerificationGateDecision(mockContext, 'gate-1', 'RETRY_VERIFY');

			expect(mockDb.prepare).toHaveBeenCalled();
			expect(mockContext.runWorkflowCycle).toHaveBeenCalled();
		});

		it('handles REFRAME action', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			await handleVerificationGateDecision(mockContext, 'gate-1', 'REFRAME');

			expect(transitionWorkflow).toHaveBeenCalledWith(
				'dlg-123',
				Phase.REPLAN,
				expect.any(String),
				expect.any(Object)
			);

			expect(mockContext.update).toHaveBeenCalled();
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'Workflow returned to replanning.'
			);
		});
	});

	describe('handleReviewGateDecision', () => {
		it('rejects when no active dialogue', async () => {
			mockContext.activeDialogueId = null;

			await handleReviewGateDecision(mockContext, 'gate-1', 'APPROVE');

			expect(mockContext.postToWebview).not.toHaveBeenCalled();
		});

		it('rejects when processing in progress', async () => {
			mockContext.isProcessing = true;

			await handleReviewGateDecision(mockContext, 'gate-1', 'APPROVE');

			expect(mockContext.postToWebview).toHaveBeenCalledWith({
				type: 'gateDecisionRejected',
				gateId: 'gate-1',
				reason: 'Processing in progress — please wait',
			});
		});

		it('handles APPROVE action with item rationales', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			const itemRationales = {
				'claim-1': 'Looks good',
				'claim-2': 'Approved',
			};

			await handleReviewGateDecision(
				mockContext,
				'gate-1',
				'APPROVE',
				itemRationales,
				'Overall looks great'
			);

			expect(transitionWorkflow).toHaveBeenCalledWith(
				'dlg-123',
				Phase.EXECUTE,
				expect.any(String)
			);

			expect(mockContext.resumeAfterGate).toHaveBeenCalled();
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'Review approved. Continuing to execution.'
			);
		});

		it('skips claim events for findings', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			const itemRationales = {
				'claim-1': 'Regular claim',
				'finding-1': 'This is a finding',
			};

			await handleReviewGateDecision(mockContext, 'gate-1', 'APPROVE', itemRationales);

			expect(writeClaimEvent).toHaveBeenCalledTimes(1);
		});

		it('handles REFRAME action', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			vi.mocked(updateWorkflowMetadata).mockReturnValue({
				success: true,
				value: undefined,
			} as any);

			vi.mocked(transitionWorkflow).mockReturnValue({
				success: true,
				value: undefined,
			} as any);

			const itemRationales = {
				'claim-1': 'Needs changes',
			};

			await handleReviewGateDecision(
				mockContext,
				'gate-1',
				'REFRAME',
				itemRationales,
				'Please improve the proposal'
			);

			expect(updateWorkflowMetadata).toHaveBeenCalledWith('dlg-123', {
				replanRationale: expect.stringContaining('Needs changes'),
			});

			expect(transitionWorkflow).toHaveBeenCalledWith(
				'dlg-123',
				Phase.REPLAN,
				expect.any(String),
				expect.any(Object)
			);

			expect(mockContext.resumeAfterGate).toHaveBeenCalled();
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'Changes requested — replanning proposal.'
			);
		});

		it('handles metadata update failure in REFRAME', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			vi.mocked(updateWorkflowMetadata).mockReturnValue({
				success: false,
				error: new Error('Metadata update failed'),
			} as any);

			await handleReviewGateDecision(mockContext, 'gate-1', 'REFRAME');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('Failed to save replan rationale')
			);
		});

		it('handles transition failure in REFRAME', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			vi.mocked(updateWorkflowMetadata).mockReturnValue({
				success: true,
				value: undefined,
			} as any);

			vi.mocked(transitionWorkflow).mockReturnValue({
				success: false,
				error: new Error('Transition failed'),
			} as any);

			await handleReviewGateDecision(mockContext, 'gate-1', 'REFRAME');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('Failed to transition to REPLAN')
			);
		});

		it('resets blocking claims in REFRAME', async () => {

			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			vi.mocked(updateWorkflowMetadata).mockReturnValue({
				success: true,
				value: undefined,
			} as any);

			vi.mocked(transitionWorkflow).mockReturnValue({
				success: true,
				value: undefined,
			} as any);

			mockDb.prepare().all.mockReturnValue([
				{ claim_id: 'claim-1' },
				{ claim_id: 'claim-2' },
			]);

			await handleReviewGateDecision(mockContext, 'gate-1', 'REFRAME');

			expect(mockDb.prepare().run).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('handles database errors gracefully', async () => {
			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			await handleGateDecisionAndResume(mockContext, 'gate-1', 'APPROVE', 'Valid rationale');

			expect(mockContext.postToWebview).toHaveBeenCalled();
		});

		it('handles thrown errors in metadata read', async () => {
			mockDb.prepare.mockImplementation(() => {
				throw new Error('Database error');
			});
			vi.mocked(processHumanGateDecision).mockReturnValue({
				success: true,
				value: { decision_id: 'dec-1' },
			} as any);

			await handleGateDecisionAndResume(mockContext, 'gate-1', 'APPROVE', 'Valid rationale');

			expect(mockContext.postToWebview).toHaveBeenCalled();
		});
	});
});
