import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	runGoalAlignmentCheck,
	runRequirementsTraceabilityCheck,
} from '../../../lib/roles/architectureValidator';
import type { ArchitectureDocument, CapabilityNode } from '../../../lib/types/architecture';
import { ArchitectureDocumentStatus } from '../../../lib/types/architecture';

// ─── Canonical fixture builders ──────────────────────────────────────

function makeDoc(overrides: Partial<ArchitectureDocument> = {}): ArchitectureDocument {
	return {
		doc_id: 'doc-123',
		dialogue_id: 'dialogue-123',
		version: 1,
		capabilities: [],
		workflow_graph: [],
		data_models: [],
		components: [],
		interfaces: [],
		implementation_sequence: [],
		goal_alignment_score: null,
		validation_findings: [],
		status: ArchitectureDocumentStatus.DRAFT,
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

function makeCapability(overrides: Partial<CapabilityNode> & Pick<CapabilityNode, 'capability_id'>): CapabilityNode {
	return {
		parent_capability_id: null,
		label: `${overrides.capability_id} label`,
		description: `${overrides.capability_id} description`,
		source_requirements: [],
		engineering_domain_mappings: [],
		workflows: [],
		...overrides,
	};
}

vi.mock('../../../lib/cli/providerResolver');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/database/architectureStore');

describe('Architecture Validator', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Provide a default getWorkflowState mock so the validator's metadata lookup
		// doesn't crash on undefined. Individual tests can override.
		const { getWorkflowState } = await import('../../../lib/workflow/stateMachine');
		vi.mocked(getWorkflowState).mockReturnValue({
			success: true,
			value: {
				dialogue_id: 'dialogue-123',
				current_phase: 'ARCHITECTURE',
				sub_state: null,
				metadata: '{}',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z',
			} as never,
		});
	});

	describe('runGoalAlignmentCheck', () => {
		it('performs deterministic checks', async () => {
			const { findUnbackedCapabilities, getAllDomainMappings } = await import('../../../lib/database/architectureStore');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(findUnbackedCapabilities).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(getAllDomainMappings).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('Provider not available'),
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.score).toBeGreaterThanOrEqual(0);
				expect(result.value.score).toBeLessThanOrEqual(1);
			}
		});

		it('detects unbacked capabilities', async () => {
			const { findUnbackedCapabilities, getAllDomainMappings } = await import('../../../lib/database/architectureStore');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(findUnbackedCapabilities).mockReturnValue({
				success: true,
				value: [
					makeCapability({ capability_id: 'CAP-1', label: 'Orphan Capability' }),
				],
			});

			vi.mocked(getAllDomainMappings).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('Provider not available'),
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.findings.length).toBeGreaterThan(0);
				expect(result.value.findings.some(f => f.includes('scope creep'))).toBe(true);
			}
		});

		it('combines LLM and deterministic findings', async () => {
			const { findUnbackedCapabilities, getAllDomainMappings } = await import('../../../lib/database/architectureStore');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(findUnbackedCapabilities).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(getAllDomainMappings).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						score: 0.85,
						findings: ['LLM finding 1', 'LLM finding 2'],
					}),
					exitCode: 0,
				} as any,
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.score).toBe(0.85);
				expect(result.value.findings.length).toBe(2);
			}
		});

		it('handles LLM failures gracefully', async () => {
			const { findUnbackedCapabilities, getAllDomainMappings } = await import('../../../lib/database/architectureStore');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(findUnbackedCapabilities).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(getAllDomainMappings).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(true);
		});

		it('handles thrown errors', async () => {
			const { findUnbackedCapabilities } = await import('../../../lib/database/architectureStore');

			vi.mocked(findUnbackedCapabilities).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(false);
		});
	});

	describe('runRequirementsTraceabilityCheck', () => {
		it('detects uncovered requirements', () => {
			const mockDoc = makeDoc({
				capabilities: [
					makeCapability({ capability_id: 'CAP-1', source_requirements: ['REQ-1'] }),
				],
			});

			const approvedPlan = {
				requirements: [
					{ id: 'REQ-1' },
					{ id: 'REQ-2' },
					{ id: 'REQ-3' },
				],
			};

			const result = runRequirementsTraceabilityCheck(mockDoc, approvedPlan, null);

			expect(result.uncovered_requirements).toEqual(['REQ-2', 'REQ-3']);
		});

		it('detects unbacked capabilities', () => {
			const mockDoc = makeDoc({
				capabilities: [
					makeCapability({ capability_id: 'CAP-1', source_requirements: ['REQ-1'] }),
					makeCapability({ capability_id: 'CAP-2', source_requirements: [] }),
				],
			});

			const approvedPlan = {
				requirements: [{ id: 'REQ-1' }],
			};

			const result = runRequirementsTraceabilityCheck(mockDoc, approvedPlan, null);

			expect(result.unbacked_capabilities).toEqual(['CAP-2']);
		});

		it('handles empty requirements', () => {
			const mockDoc = makeDoc();

			const approvedPlan = {
				requirements: [],
			};

			const result = runRequirementsTraceabilityCheck(mockDoc, approvedPlan, null);

			expect(result.uncovered_requirements).toEqual([]);
			expect(result.unbacked_capabilities).toEqual([]);
		});

		it('handles perfect traceability', () => {
			const mockDoc = makeDoc({
				capabilities: [
					makeCapability({ capability_id: 'CAP-1', source_requirements: ['REQ-1', 'REQ-2'] }),
				],
			});

			const approvedPlan = {
				requirements: [
					{ id: 'REQ-1' },
					{ id: 'REQ-2' },
				],
			};

			const result = runRequirementsTraceabilityCheck(mockDoc, approvedPlan, null);

			expect(result.uncovered_requirements).toEqual([]);
			expect(result.unbacked_capabilities).toEqual([]);
		});
	});

	describe('edge cases', () => {
		it('handles score calculation with many findings', async () => {
			const { findUnbackedCapabilities, getAllDomainMappings } = await import('../../../lib/database/architectureStore');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(findUnbackedCapabilities).mockReturnValue({
				success: true,
				value: new Array(20).fill(null).map((_, i) =>
					makeCapability({ capability_id: `CAP-${i}`, label: `Cap ${i}` })
				),
			});

			vi.mocked(getAllDomainMappings).mockReturnValue({
				success: true,
				value: [],
			});

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('Provider not available'),
			});

			const mockDoc = makeDoc();

			const result = await runGoalAlignmentCheck('dialogue-123', mockDoc);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.score).toBe(0);
			}
		});

		it('handles null approved plan', () => {
			const mockDoc = makeDoc();

			const result = runRequirementsTraceabilityCheck(mockDoc, null, null);

			expect(result.uncovered_requirements).toEqual([]);
		});
	});
});
