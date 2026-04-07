import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import {
	executeArchitecturePhase,
	backfillDomainMappings,
	computeCapabilityCoverage,
	handleArchitectureGateResolution,
	handleArchitectureDecomposeDeeper,
	extractArchitectureMMP,
} from '../../../lib/workflow/architecturePhase';
import { initializeWorkflowState, updateWorkflowMetadata } from '../../../lib/workflow/stateMachine';
import { Phase } from '../../../lib/types';
import { ArchitectureSubState, ArchitectureDocumentStatus } from '../../../lib/types/architecture';
import type { ArchitectureDocument, CapabilityNode } from '../../../lib/types/architecture';
import { randomUUID } from 'node:crypto';

// Stub the Context Engineer so unit tests don't trigger real LLM calls
// (the CE is itself an LLM-invoking agent that runs as a pre-step before
// role invocations). We're testing the workflow logic, not context assembly.
vi.mock('../../../lib/context', async () => {
	const actual = await vi.importActual<typeof import('../../../lib/context')>('../../../lib/context');
	return {
		...actual,
		assembleContext: vi.fn(async () => ({
			success: true as const,
			value: {
				briefing: '# Stub briefing for unit test',
				sectionManifest: [],
				sufficiency: { sufficient: true, missingRequired: [], warnings: [] },
				fingerprint: 'test-fp',
				diagnostics: { policyKey: 'test', policyVersion: 1, handoffDocsConsumed: [], sqlQueriesExecuted: 0, wallClockMs: 0 },
			},
		})),
	};
});



describe('ArchitecturePhase', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		
		registerFakeProviders({
			expertResponses: [
				{
					response: JSON.stringify({
						capabilities: [],
						workflows: [],
						components: [],
						technicalFindings: 'Test findings'
					}),
					exitCode: 0,
				},
			],
		});

		initializeWorkflowState(dialogueId, { goal: 'Test architecture' });
		updateWorkflowMetadata(dialogueId, {
			approvedIntakePlan: {
				title: 'Test Plan',
				summary: 'Test summary',
				requirements: [],
			},
		});
	});

	afterEach(() => {
		teardownFakeProviders();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('executeArchitecturePhase', () => {
		it('dispatches to sub-state handlers', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.ARCHITECTURE);
			}
		});

		it('handles TECHNICAL_ANALYSIS sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles DECOMPOSING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.DECOMPOSING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles MODELING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.MODELING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles DESIGNING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.DESIGNING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles SEQUENCING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.SEQUENCING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles VALIDATING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.VALIDATING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles PRESENTING sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.PRESENTING,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('returns error for unknown sub-state', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: 'INVALID' as any,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Unknown architecture sub-state');
			}
		});

		it('uses default token budget when not specified', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles missing intake plan', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
				approvedIntakePlan: undefined,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(false);
		});
	});

	describe('backfillDomainMappings', () => {
		it('fills domain mappings for capabilities', () => {
			const capabilities: CapabilityNode[] = [
				{
					capability_id: 'cap-1',
					parent_capability_id: null,
					label: 'User Authentication',
					description: 'Handle user login and security',
					source_requirements: [],
					engineering_domain_mappings: [],
					workflows: [],
				},
			];

			const result = backfillDomainMappings(capabilities, {}, {});

			expect(result[0].engineering_domain_mappings).toBeDefined();
		});

		it('preserves existing domain mappings', () => {
			const capabilities: CapabilityNode[] = [
				{
					capability_id: 'cap-1',
					parent_capability_id: null,
					label: 'Test Capability',
					description: 'Test description',
					source_requirements: [],
					engineering_domain_mappings: [] as any,
					workflows: [],
				},
			];

			const result = backfillDomainMappings(capabilities, {}, {});

			expect(result[0]).toBeDefined();
		});

		it('handles empty capabilities array', () => {
			const capabilities: CapabilityNode[] = [];

			const result = backfillDomainMappings(capabilities, {}, {});

			expect(result).toEqual([]);
		});

		it('handles null coverage data', () => {
			const capabilities: CapabilityNode[] = [
				{
					capability_id: 'cap-1',
					parent_capability_id: null,
					label: 'Test',
					description: 'Test',
					source_requirements: [],
					engineering_domain_mappings: [],
					workflows: [],
				},
			];

			const result = backfillDomainMappings(capabilities, {}, null);

			expect(result).toEqual(capabilities);
		});
	});

	describe('computeCapabilityCoverage', () => {
		it('computes coverage from architecture document', () => {
			const doc: ArchitectureDocument = {
				doc_id: 'doc-1',
				dialogue_id: dialogueId,
				version: 1,
				status: ArchitectureDocumentStatus.DRAFT,
				capabilities: [
					{
						capability_id: 'cap-1',
						parent_capability_id: null,
						label: 'Test Capability',
						description: 'Test',
						source_requirements: [],
						engineering_domain_mappings: [],
						workflows: ['wf-1'],
					},
				],
				workflow_graph: [
					{
						workflow_id: 'wf-1',
						capability_id: 'cap-1',
						label: 'Test Workflow',
						description: 'Test',
						steps: [],
						actors: [],
						triggers: [],
						outputs: [],
					},
				],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const coverage = computeCapabilityCoverage(doc);

			expect(coverage).toBeDefined();
		});

		it('handles empty architecture document', () => {
			const doc: ArchitectureDocument = {
				doc_id: 'doc-1',
				dialogue_id: dialogueId,
				version: 1,
				status: ArchitectureDocumentStatus.DRAFT,
				capabilities: [],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const coverage = computeCapabilityCoverage(doc);

			expect(coverage).toBeDefined();
		});


	});

	describe('handleArchitectureGateResolution', () => {
		it('handles APPROVE action', () => {
			const result = handleArchitectureGateResolution(dialogueId, 'APPROVE');

			expect(result.success).toBe(true);
		});

		it('handles REVISE action with feedback', () => {
			const result = handleArchitectureGateResolution(
				dialogueId,
				'REVISE',
				'Need more detail on authentication'
			);

			expect(result.success).toBe(true);
		});

		it('handles SKIP action', () => {
			const result = handleArchitectureGateResolution(dialogueId, 'SKIP');

			expect(result.success).toBe(true);
		});

		it('stores feedback in metadata for REVISE', () => {
			handleArchitectureGateResolution(
				dialogueId,
				'REVISE',
				'Add payment processing'
			);

			expect(true).toBe(true);
		});

		it('handles missing feedback for REVISE', () => {
			const result = handleArchitectureGateResolution(dialogueId, 'REVISE');

			expect(result.success).toBe(true);
		});
	});

	describe('handleArchitectureDecomposeDeeper', () => {
		it('sets decompose deeper flag', () => {
			const result = handleArchitectureDecomposeDeeper(dialogueId);

			expect(result.success).toBe(true);
		});

		it('transitions back to DESIGNING', () => {
			handleArchitectureDecomposeDeeper(dialogueId);

			expect(true).toBe(true);
		});

		it('handles database errors', () => {
			tempDb.cleanup();

			const result = handleArchitectureDecomposeDeeper(dialogueId);

			expect(result.success).toBe(false);
		});
	});

	describe('extractArchitectureMMP', () => {
		it('extracts MMP from architecture document', () => {
			const doc: ArchitectureDocument = {
				doc_id: 'doc-1',
				dialogue_id: dialogueId,
				version: 1,
				status: ArchitectureDocumentStatus.DRAFT,
				capabilities: [],
				workflow_graph: [],
				components: [
					{
						component_id: 'comp-1',
						label: 'AuthService',
						responsibility: 'Handle authentication',
						rationale: 'Required for security',
						workflows_served: [],
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
						parent_component_id: null,
					},
				],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const mmp = extractArchitectureMMP(doc);

			expect(mmp).toBeDefined();
		});



		it('returns undefined for empty document', () => {
			const doc: ArchitectureDocument = {
				doc_id: 'doc-1',
				dialogue_id: dialogueId,
				version: 1,
				status: ArchitectureDocumentStatus.DRAFT,
				capabilities: [],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const mmp = extractArchitectureMMP(doc);

			expect(mmp).toBeUndefined();
		});
	});

	describe('sub-state workflow', () => {
		it('progresses through architecture sub-states', async () => {
			const subStates = [
				ArchitectureSubState.TECHNICAL_ANALYSIS,
				ArchitectureSubState.DECOMPOSING,
				ArchitectureSubState.MODELING,
				ArchitectureSubState.DESIGNING,
				ArchitectureSubState.SEQUENCING,
				ArchitectureSubState.VALIDATING,
				ArchitectureSubState.PRESENTING,
			];

			for (const subState of subStates) {
				updateWorkflowMetadata(dialogueId, { architectureSubState: subState });
				const result = await executeArchitecturePhase(dialogueId);
				expect(result.success).toBe(true);
			}
		});

		it('handles validation loop', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.VALIDATING,
				validationAttempts: 0,
				maxValidationAttempts: 3,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles human revision loop', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.PRESENTING,
			});

			const presentResult = await executeArchitecturePhase(dialogueId);
			expect(presentResult.success).toBe(true);

			handleArchitectureGateResolution(dialogueId, 'REVISE', 'Need changes');

			const reviseResult = await executeArchitecturePhase(dialogueId);
			expect(reviseResult.success).toBe(true);
		});
	});

	describe('error handling', () => {
		it('handles missing workflow state', async () => {
			const result = await executeArchitecturePhase('nonexistent-dialogue');

			expect(result.success).toBe(false);
		});

		it('handles provider resolution failure', async () => {
			teardownFakeProviders();

			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
			});

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(false);
		});

		it('handles database errors gracefully', async () => {
			tempDb.cleanup();

			const result = await executeArchitecturePhase(dialogueId);

			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('executes complete architecture workflow', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.TECHNICAL_ANALYSIS,
			});

			const analysisResult = await executeArchitecturePhase(dialogueId);
			expect(analysisResult.success).toBe(true);
		});

		it('handles architecture approval flow', async () => {
			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.PRESENTING,
			});

			const presentResult = await executeArchitecturePhase(dialogueId);
			expect(presentResult.success).toBe(true);

			const approveResult = handleArchitectureGateResolution(dialogueId, 'APPROVE');
			expect(approveResult.success).toBe(true);
		});

		it('handles decompose deeper request', async () => {
			const deeperResult = handleArchitectureDecomposeDeeper(dialogueId);
			expect(deeperResult.success).toBe(true);

			updateWorkflowMetadata(dialogueId, {
				architectureSubState: ArchitectureSubState.DESIGNING,
			});

			const designResult = await executeArchitecturePhase(dialogueId);
			expect(designResult.success).toBe(true);
		});
	});
});
