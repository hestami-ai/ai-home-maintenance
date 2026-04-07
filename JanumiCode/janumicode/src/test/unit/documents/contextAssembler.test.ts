import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assembleDocumentContext } from '../../../lib/documents/contextAssembler';

import { getAllDialogues } from '../../../lib/dialogue/lifecycle';
import { getWorkflowState } from '../../../lib/workflow/stateMachine';
import { getIntakeConversation, getClaims, getVerdicts } from '../../../lib/events/reader';
import { getArchitectureDocumentForDialogue } from '../../../lib/database/architectureStore';
import { getTaskGraphForDialogue, getTaskUnitsForGraph } from '../../../lib/database/makerStore';

vi.mock('../../../lib/events/reader');
vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/database/architectureStore');
vi.mock('../../../lib/database/makerStore');
vi.mock('../../../lib/dialogue/lifecycle');

describe('Document Context Assembler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('assembleDocumentContext', () => {
		it('assembles all available context sections', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [
					{
						dialogue_id: 'dialogue-123',
						goal: 'Build feature',
						title: 'Test Dialogue',
						status: 'active',
						created_at: '2024-01-01T00:00:00Z',
					},
				],
			} as any);

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						title: 'Test Plan',
						summary: 'Summary',
						requirements: [],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: [],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toBeTruthy();
			expect(context).toContain('Dialogue Metadata');
		});

		it('handles missing dialogue metadata', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			const context = assembleDocumentContext('dialogue-999');

			expect(context).toBeDefined();
		});

		it('includes intake plan when available', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [
					{
						dialogue_id: 'dialogue-123',
						goal: 'Build feature',
						title: 'Test',
						status: 'active',
						created_at: '2024-01-01T00:00:00Z',
					},
				],
			} as any);

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					finalizedPlan: {
						title: 'Final Plan',
						summary: 'Plan summary',
						requirements: [
							{ id: 'REQ-1', text: 'Requirement 1', type: 'REQUIREMENT' },
						],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: [],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('INTAKE Plan');
			expect(context).toContain('REQ-1');
		});

		it('includes architecture document when available', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: true,
				value: {
					doc_id: 'doc-123',
					dialogue_id: 'dialogue-123',
					status: 'DRAFT',
					capabilities: [
						{
							capability_id: 'CAP-1',
							label: 'Capability 1',
							description: 'Description',
							source_requirements: [],
							workflows: [],
							engineering_domain_mappings: [],
						},
					],
					components: [],
					data_models: [],
					interfaces: [],
					workflow_graph: [],
					implementation_sequence: [],
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Architecture Document');
			expect(context).toContain('CAP-1');
		});

		it('includes claims and verdicts when available', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [
					{
						claim_id: 'claim-123',
						statement: 'Test claim',
						status: 'OPEN',
						criticality: 'CRITICAL',
						dialogue_id: 'dialogue-123',
					},
				],
			} as any);

			vi.mocked(getVerdicts).mockReturnValue({
				success: true,
				value: [
					{
						verdict_id: 'verdict-123',
						claim_id: 'claim-123',
						verdict: 'VERIFIED',
					},
				],
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Claims & Verdicts');
		});

		it('includes task graph when available', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getTaskGraphForDialogue).mockReturnValue({
				success: true,
				value: {
					graph_id: 'graph-123',
					graph_status: 'ACTIVE',
				},
			} as any);

			vi.mocked(getTaskUnitsForGraph).mockReturnValue({
				success: true,
				value: [
					{
						unit_id: 'unit-123',
						label: 'Task Unit 1',
						status: 'PENDING',
					},
				],
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Task Graph');
		});

		it('formats plan with all optional fields', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					finalizedPlan: {
						title: 'Plan',
						summary: 'Summary',
						requestCategory: 'product_or_feature',
						productVision: 'Vision',
						productDescription: 'Description',
						proposedApproach: 'Approach',
						requirements: [],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: ['Note 1'],
						personas: [
							{
								id: 'P1',
								name: 'Admin',
								description: 'Admin user',
								goals: ['Manage system'],
								painPoints: ['Too complex'],
							},
						],
						userJourneys: [
							{
								id: 'J1',
								personaId: 'P1',
								title: 'Login',
								scenario: 'User logs in',
								priority: 'HIGH',
								steps: [
									{
										stepNumber: 1,
										actor: 'User',
										action: 'Enter credentials',
										expectedOutcome: 'Success',
									},
								],
								acceptanceCriteria: ['Must work'],
							},
						],
						successMetrics: ['Metric 1'],
						phasingStrategy: [
							{
								phase: 'Phase 1',
								description: 'First phase',
								rationale: 'Start here',
								journeyIds: ['J1'],
							},
						],
						uxRequirements: ['UX 1'],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Product Vision');
			expect(context).toContain('Personas');
			expect(context).toContain('User Journeys');
		});

		it('formats architecture with all sections', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: true,
				value: {
					doc_id: 'doc-123',
					dialogue_id: 'dialogue-123',
					status: 'VALIDATED',
					goal_alignment_score: 0.95,
					capabilities: [],
					workflow_graph: [
						{
							workflow_id: 'WF-1',
							label: 'Workflow 1',
							steps: ['Step 1', 'Step 2'],
						},
					],
					components: [
						{
							component_id: 'COMP-1',
							label: 'Component 1',
							responsibility: 'Handles X',
							technology_notes: 'Node.js',
						},
					],
					data_models: [
						{
							model_id: 'DM-1',
							entity_name: 'User',
							fields: [{ name: 'id', type: 'uuid' }],
						},
					],
					interfaces: [
						{
							interface_id: 'API-1',
							label: 'User API',
							type: 'REST',
							description: 'User management',
						},
					],
					implementation_sequence: [
						{
							sort_order: 1,
							label: 'Step 1',
							description: 'First step',
						},
					],
					validation_findings: ['Finding 1'],
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Goal Alignment Score');
			expect(context).toContain('Workflow Graph');
			expect(context).toContain('Components');
			expect(context).toContain('Data Models');
			expect(context).toContain('Interfaces');
			expect(context).toContain('Implementation Sequence');
		});

		it('separates sections with delimiters', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [
					{
						dialogue_id: 'dialogue-123',
						goal: 'Test',
						created_at: '2024-01-01T00:00:00Z',
					},
				],
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						title: 'Plan',
						summary: 'Summary',
						requirements: [],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: [],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('---');
		});

		it('handles plan with business domain proposals', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						title: 'Plan',
						summary: 'Summary',
						requirements: [],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: [],
						businessDomainProposals: [
							{
								id: 'BD-1',
								name: 'User Management',
								description: 'User domain',
								rationale: 'Core domain',
								entityPreview: ['User', 'Role'],
								workflowPreview: ['Login', 'Register'],
							},
						],
						entityProposals: [
							{
								id: 'E-1',
								name: 'User',
								businessDomainId: 'BD-1',
								description: 'User entity',
								keyAttributes: ['id', 'email'],
								relationships: ['has many Roles'],
							},
						],
						workflowProposals: [
							{
								id: 'W-1',
								name: 'Login',
								businessDomainId: 'BD-1',
								description: 'Login workflow',
								triggers: ['User submits credentials'],
								actors: ['User', 'System'],
								steps: ['Validate', 'Create session'],
							},
						],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Business Domains');
			expect(context).toContain('Data Entities');
			expect(context).toContain('System Workflows');
		});

		it('handles empty context gracefully', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getTaskGraphForDialogue).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			const context = assembleDocumentContext('dialogue-999');

			expect(context).toBeDefined();
			expect(typeof context).toBe('string');
		});
	});

	describe('edge cases', () => {
		it('handles plan with integration proposals', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						title: 'Plan',
						summary: 'Summary',
						requirements: [],
						decisions: [],
						constraints: [],
						openQuestions: [],
						technicalNotes: [],
						integrationProposals: [
							{
								id: 'I-1',
								name: 'Stripe',
								category: 'payment',
								description: 'Payment integration',
							},
						],
						qualityAttributes: ['Performance', 'Security'],
					},
				},
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('External Integrations');
			expect(context).toContain('Quality Attributes');
		});

		it('handles claims with verdicts map', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [],
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [
					{
						claim_id: 'claim-1',
						statement: 'Long claim statement that needs to be truncated for display purposes',
						status: 'VERIFIED',
						criticality: 'HIGH',
					},
				],
			} as any);

			vi.mocked(getVerdicts).mockReturnValue({
				success: true,
				value: [
					{
						verdict_id: 'v-1',
						claim_id: 'claim-1',
						verdict: 'VERIFIED',
					},
					{
						verdict_id: 'v-2',
						claim_id: 'claim-1',
						verdict: 'CONDITIONAL',
					},
				],
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('Claims & Verdicts');
			expect(context).toContain('CONDITIONAL');
		});

		it('handles untitled dialogue', () => {

			vi.mocked(getAllDialogues).mockReturnValue({
				success: true,
				value: [
					{
						dialogue_id: 'dialogue-123',
						goal: 'Test',
						title: null,
						status: 'active',
						created_at: '2024-01-01T00:00:00Z',
					},
				],
			} as any);

			vi.mocked(getWorkflowState).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			const context = assembleDocumentContext('dialogue-123');

			expect(context).toContain('(untitled)');
			expect(context).toContain('UNKNOWN');
		});
	});
});
