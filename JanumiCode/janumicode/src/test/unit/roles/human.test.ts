import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	captureHumanDecision,
	getDecisionHistory,
	getOverrideHistory,
	hasActiveWaiver,
	getActiveWaivers,
	OverrideType,
	type HumanDecisionInput,
} from '../../../lib/roles/human';
import { HumanAction } from '../../../lib/types';

vi.mock('../../../lib/database');

describe('Human Authority Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('captureHumanDecision', () => {
		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Approved after review',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.gate_id).toBe('gate-123');
				expect(result.value.action).toBe(HumanAction.APPROVE);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.REJECT,
				rationale: 'Does not meet requirements',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.decision_id).toBeTruthy();
				expect(result.value.timestamp).toBeTruthy();
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Approved with documentation',
				attachmentsRef: ['doc-1', 'doc-2'],
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.attachments_ref).toBe('doc-1,doc-2');
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			const mockExec = vi.fn();
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
				exec: mockExec,
			} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.OVERRIDE,
				rationale: 'Override verifier verdict',
				overrideType: OverrideType.VERIFIER_VERDICT,
				overrideTargetId: 'verdict-123',
				decisionMaker: 'admin@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
			expect(mockExec).toHaveBeenCalled();
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			const mockExec = vi.fn();
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
				exec: mockExec,
			} as any);

			// Waivers are attached as a sidecar to a regular action (APPROVE/OVERRIDE).
			// The waiver records a time-bounded constraint exemption in constraint_waivers
			// with its own audit fields (constraint_ref, justification, granted_by, expiration).
			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Approved with time-limited waiver for migration work',
				waiver: {
					constraint_ref: 'constraint-xyz',
					justification: 'Special business requirement for 24h migration window',
					granted_by: 'manager@example.com',
				},
				decisionMaker: 'manager@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: '',
				action: HumanAction.APPROVE,
				rationale: 'Test',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: '',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Test rationale',
				decisionMaker: '',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: 'INVALID_ACTION' as any,
				rationale: 'Test rationale',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.OVERRIDE,
				rationale: 'Override',
				overrideType: OverrideType.VERIFIER_VERDICT,
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.OVERRIDE,
				rationale: 'Override',
				overrideTargetId: 'target-123',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('validates waiver without constraint ref', async () => {
			const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Attempting to waive a constraint without specifying which one',
				waiver: {
					constraint_ref: '',
					justification: 'Some justification text for the waiver',
					granted_by: 'user@example.com',
				},
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			// Validator should reject: "Waiver specified but no constraint reference provided"
			expect(result.success).toBe(false);
		});

		it('validates waiver expiration in past', async () => {
			const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue({} as any);

			const pastDate = new Date(Date.now() - 86400000).toISOString();

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Attempting to grant an already-expired waiver',
				waiver: {
					constraint_ref: 'constraint-123',
					justification: 'Special case justification that is sufficiently detailed',
					granted_by: 'user@example.com',
					expiration: pastDate,
				},
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			// Validator should reject: "Waiver expiration date must be in the future"
			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue(null);

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Test rationale',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			// DEFER and WAIVE removed from HumanAction enum; use current members.
			const actions = [
				HumanAction.APPROVE,
				HumanAction.REJECT,
				HumanAction.OVERRIDE,
				HumanAction.REFRAME,
				HumanAction.DELEGATE,
				HumanAction.ESCALATE,
			];

			for (const action of actions) {
				const input: HumanDecisionInput = {
					gateId: 'gate-123',
					action,
					rationale: `Decision with ${action}`,
					decisionMaker: 'user@example.com',
				};

				const result = captureHumanDecision(input);
				expect(result.success).toBe(true);
			}
		});
	});

	describe('getDecisionHistory', () => {
		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockDecisions = [
				{
					decision_id: 'dec-1',
					gate_id: 'gate-123',
					action: HumanAction.APPROVE,
					rationale: 'Approved',
					attachments_ref: null,
					timestamp: '2024-01-01T00:00:00Z',
				},
			];

			const mockAll = vi.fn().mockReturnValue(mockDecisions);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getDecisionHistory('gate-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].gate_id).toBe('gate-123');
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockAll = vi.fn().mockReturnValue([]);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getDecisionHistory('gate-999');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(0);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue(null);

			const result = getDecisionHistory('gate-123');

			expect(result.success).toBe(false);
		});
	});

	describe('getOverrideHistory', () => {
		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockOverrides = [
				{
					override_id: 'ovr-1',
					decision_id: 'dec-1',
					override_type: OverrideType.VERIFIER_VERDICT,
					target_id: 'verdict-123',
					rationale: 'Override reason',
					decision_maker: 'admin@example.com',
					timestamp: '2024-01-01T00:00:00Z',
				},
			];

			const mockAll = vi.fn().mockReturnValue(mockOverrides);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getOverrideHistory(OverrideType.VERIFIER_VERDICT);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].override_type).toBe(OverrideType.VERIFIER_VERDICT);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockOverrides = [
				{
					override_id: 'ovr-1',
					decision_id: 'dec-1',
					override_type: OverrideType.EXECUTOR_PROPOSAL,
					target_id: 'proposal-456',
					rationale: 'Override reason',
					decision_maker: 'admin@example.com',
					timestamp: '2024-01-01T00:00:00Z',
				},
			];

			const mockAll = vi.fn().mockReturnValue(mockOverrides);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getOverrideHistory(OverrideType.EXECUTOR_PROPOSAL, 'proposal-456');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue(null);

			const result = getOverrideHistory(OverrideType.VERIFIER_VERDICT);

			expect(result.success).toBe(false);
		});
	});

	describe('hasActiveWaiver', () => {
		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockWaiver = {
				waiver_id: 'waiver-123',
				expiration: null,
			};

			const mockGet = vi.fn().mockReturnValue(mockWaiver);
			const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = hasActiveWaiver('constraint-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockGet = vi.fn().mockReturnValue(undefined);
			const mockPrepare = vi.fn().mockReturnValue({ get: mockGet });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = hasActiveWaiver('constraint-999');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(false);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue(null);

			const result = hasActiveWaiver('constraint-123');

			expect(result.success).toBe(false);
		});
	});

	describe('getActiveWaivers', () => {
		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockWaivers = [
				{
					waiver_id: 'waiver-1',
					constraint_ref: 'constraint-1',
					justification: 'Justification 1',
					granted_by: 'user@example.com',
					timestamp: '2024-01-01T00:00:00Z',
					expiration: null,
				},
				{
					waiver_id: 'waiver-2',
					constraint_ref: 'constraint-2',
					justification: 'Justification 2',
					granted_by: 'admin@example.com',
					timestamp: '2024-01-02T00:00:00Z',
					expiration: '2025-01-01T00:00:00Z',
				},
			];

			const mockAll = vi.fn().mockReturnValue(mockWaivers);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getActiveWaivers();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			const mockAll = vi.fn().mockReturnValue([]);
			const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = getActiveWaivers();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(0);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');
			vi.mocked(getDatabase).mockReturnValue(null);

			const result = getActiveWaivers();

			expect(result.success).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('handles waiver with future expiration', async () => {
			const { getDatabase } = await import('../../../lib/database');

			const mockRun = vi.fn();
			const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
			const mockExec = vi.fn();
			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
				exec: mockExec,
			} as any);

			const futureDate = new Date(Date.now() + 86400000).toISOString();

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Granting a temporary 24-hour waiver for migration work',
				waiver: {
					constraint_ref: 'constraint-123',
					justification: 'Valid for 24 hours while migration completes',
					granted_by: 'user@example.com',
					expiration: futureDate,
				},
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(true);
			// Verify storeConstraintWaiver was invoked (exec for CREATE TABLE,
			// then two prepare/run: one for human_decisions, one for constraint_waivers)
			expect(mockExec).toHaveBeenCalled();
			expect(mockPrepare.mock.calls.length).toBeGreaterThanOrEqual(2);
		});

		it('handles multiple override types', async () => {
			const overrideTypes = [
				OverrideType.VERIFIER_VERDICT,
				OverrideType.EXECUTOR_PROPOSAL,
				OverrideType.CONSTRAINT,
				OverrideType.HISTORICAL_PRECEDENT,
			];

			for (const type of overrideTypes) {
				const { getDatabase } = await import('../../../lib/database');

				const mockRun = vi.fn();
				const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
				const mockExec = vi.fn();
				vi.mocked(getDatabase).mockReturnValue({
					prepare: mockPrepare,
					exec: mockExec,
				} as any);

				const input: HumanDecisionInput = {
					gateId: 'gate-123',
					action: HumanAction.OVERRIDE,
					rationale: 'Override',
					overrideType: type,
					overrideTargetId: 'target-123',
					decisionMaker: 'admin@example.com',
				};

				const result = captureHumanDecision(input);
				expect(result.success).toBe(true);
			}
		});

		it('', async () => {
const { getDatabase } = await import('../../../lib/database');

			vi.mocked(getDatabase).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			const input: HumanDecisionInput = {
				gateId: 'gate-123',
				action: HumanAction.APPROVE,
				rationale: 'Test',
				decisionMaker: 'user@example.com',
			};

			const result = captureHumanDecision(input);

			expect(result.success).toBe(false);
		});
	});
});
