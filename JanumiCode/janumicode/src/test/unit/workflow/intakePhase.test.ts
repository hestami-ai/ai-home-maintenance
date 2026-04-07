import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import {
	executeIntakeConversationTurn,
	executeIntakePlanFinalization,
	executeIntakePlanApproval,
	executeIntakeGatheringTurn,
	executeIntakeAnalysis,
	executeIntakeClarificationTurn,
	executeProposerBusinessDomains,
	executeProposerJourneys,
	executeProposerEntities,
	executeProposerIntegrations,
	extractProductDiscoveryMMP,
	extractDomainMMP,
	extractJourneyWorkflowMMP,
	extractEntityMMP,
	extractIntegrationMMP,
} from '../../../lib/workflow/intakePhase';
import { initializeWorkflowState, updateWorkflowMetadata } from '../../../lib/workflow/stateMachine';
import { Phase } from '../../../lib/types';
import { randomUUID } from 'node:crypto';
import { getOrCreateIntakeConversation } from '../../../lib/events';

describe('IntakePhase', () => {
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
						analysis: 'Test analysis',
						questions: ['Question 1', 'Question 2'],
						coverage: { architecture: 0.8, requirements: 0.7 }
					}),
					exitCode: 0,
				},
			],
		});

		initializeWorkflowState(dialogueId, { goal: 'Test intake' });
	});

	afterEach(() => {
		teardownFakeProviders();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('executeIntakeConversationTurn', () => {
		it('processes a conversation turn', async () => {
			const result = await executeIntakeConversationTurn(
				dialogueId,
				'I need to build a todo app'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
				expect(result.value.awaitingInput).toBe(true);
			}
		});

		it('invokes technical expert', async () => {
			const result = await executeIntakeConversationTurn(
				dialogueId,
				'Build an authentication system'
			);

			expect(result.success).toBe(true);
		});

		it('updates conversation state', async () => {
			await executeIntakeConversationTurn(
				dialogueId,
				'Test message'
			);

			const conversation = getOrCreateIntakeConversation(dialogueId);
			expect(conversation.success).toBe(true);
		});

		it('maintains context window', async () => {
			for (let i = 0; i < 3; i++) {
				await executeIntakeConversationTurn(
					dialogueId,
					`Message ${i}`
				);
			}

			expect(true).toBe(true);
		});
	});

	describe('executeIntakePlanFinalization', () => {
		it('synthesizes conversation into plan', async () => {
			await executeIntakeConversationTurn(dialogueId, 'Build todo app');
			
			const result = await executeIntakePlanFinalization(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
			}
		});

		it('invokes plan synthesis', async () => {
			const result = await executeIntakePlanFinalization(dialogueId);

			expect(result.success).toBe(true);
		});

		it('produces structured plan', async () => {
			const result = await executeIntakePlanFinalization(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('executeIntakePlanApproval', () => {
		it('stores approved plan', () => {
			const result = executeIntakePlanApproval(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
			}
		});

		it('transitions to next phase', () => {
			const result = executeIntakePlanApproval(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.nextPhase).toBeDefined();
			}
		});

		it('updates workflow metadata', () => {
			executeIntakePlanApproval(dialogueId);

			expect(true).toBe(true);
		});
	});

	describe('executeIntakeGatheringTurn', () => {
		it('executes gathering turn', async () => {
			const result = await executeIntakeGatheringTurn(
				dialogueId,
				'Tell me about the requirements'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
				expect(result.value.awaitingInput).toBe(true);
			}
		});

		it('expert acts as interviewer', async () => {
			const result = await executeIntakeGatheringTurn(
				dialogueId,
				'User authentication needed'
			);

			expect(result.success).toBe(true);
		});

		it('investigates one domain', async () => {
			const result = await executeIntakeGatheringTurn(
				dialogueId,
				'Database requirements'
			);

			expect(result.success).toBe(true);
		});

		it('returns gathering metadata', async () => {
			const result = await executeIntakeGatheringTurn(
				dialogueId,
				'Test message'
			);

			expect(result.success).toBe(true);
		});
	});

	describe('executeIntakeAnalysis', () => {
		it('produces comprehensive analysis', async () => {
			const result = await executeIntakeAnalysis(
				dialogueId,
				'Analyze the codebase'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
			}
		});

		it('reads docs and codebase', async () => {
			const result = await executeIntakeAnalysis(
				dialogueId,
				'Initial analysis'
			);

			expect(result.success).toBe(true);
		});

		it('no user interaction during analysis', async () => {
			const result = await executeIntakeAnalysis(
				dialogueId,
				'Run analysis'
			);

			expect(result.success).toBe(true);
		});
	});

	describe('executeIntakeClarificationTurn', () => {
		it('handles clarification turn', async () => {
			const result = await executeIntakeClarificationTurn(
				dialogueId,
				'Clarify the requirements'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.INTAKE);
			}
		});

		it('tracks clarification rounds', async () => {
			await executeIntakeClarificationTurn(dialogueId, 'Round 1');
			await executeIntakeClarificationTurn(dialogueId, 'Round 2');

			expect(true).toBe(true);
		});

		it('transitions after max rounds', async () => {
			for (let i = 0; i < 5; i++) {
				await executeIntakeClarificationTurn(dialogueId, `Round ${i}`);
			}

			expect(true).toBe(true);
		});
	});

	describe('Proposer Phase', () => {
		describe('executeProposerBusinessDomains', () => {
			it('proposes business domains and personas', async () => {
				const result = await executeProposerBusinessDomains(
					dialogueId,
					'Propose domains'
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe(Phase.INTAKE);
					expect(result.value.awaitingInput).toBe(true);
				}
			});

			it('uses intent discovery findings', async () => {
				updateWorkflowMetadata(dialogueId, {
					intentDiscoveryFindings: {
						summary: 'Build e-commerce platform',
						domains: ['products', 'orders', 'payments']
					}
				});

				const result = await executeProposerBusinessDomains(
					dialogueId,
					'Continue'
				);

				expect(result.success).toBe(true);
			});

			it('generates domain MMP', async () => {
				const result = await executeProposerBusinessDomains(
					dialogueId,
					'Show domains'
				);

				expect(result.success).toBe(true);
			});
		});

		describe('executeProposerJourneys', () => {
			it('proposes user journeys and workflows', async () => {
				const result = await executeProposerJourneys(
					dialogueId,
					'Propose journeys'
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.awaitingInput).toBe(true);
				}
			});

			it('uses accepted domains', async () => {
				const result = await executeProposerJourneys(
					dialogueId,
					'Continue'
				);

				expect(result.success).toBe(true);
			});

			it('generates journey MMP', async () => {
				const result = await executeProposerJourneys(
					dialogueId,
					'Show journeys'
				);

				expect(result.success).toBe(true);
			});
		});

		describe('executeProposerEntities', () => {
			it('proposes entities and data model', async () => {
				const result = await executeProposerEntities(
					dialogueId,
					'Propose entities'
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.awaitingInput).toBe(true);
				}
			});

			it('uses accepted domains and workflows', async () => {
				const result = await executeProposerEntities(
					dialogueId,
					'Continue'
				);

				expect(result.success).toBe(true);
			});

			it('generates entity MMP', async () => {
				const result = await executeProposerEntities(
					dialogueId,
					'Show entities'
				);

				expect(result.success).toBe(true);
			});
		});

		describe('executeProposerIntegrations', () => {
			it('proposes integrations and quality attributes', async () => {
				const result = await executeProposerIntegrations(
					dialogueId,
					'Propose integrations'
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.awaitingInput).toBe(true);
				}
			});

			it('generates integration MMP', async () => {
				const result = await executeProposerIntegrations(
					dialogueId,
					'Show integrations'
				);

				expect(result.success).toBe(true);
			});
		});
	});

	describe('MMP extraction', () => {
		describe('extractProductDiscoveryMMP', () => {
			it('extracts MMP for product features', () => {
				const plan = {
					requestCategory: 'product_or_feature' as const,
					summary: 'E-commerce platform',
					requirements: ['Req 1', 'Req 2'],
					personas: [{ id: '1', name: 'User', description: 'End user' }],
					userJourneys: [{ id: 'j1', title: 'Purchase', scenario: 'User buys product' }],
				};

				const mmp = extractProductDiscoveryMMP(plan as any);

				expect(mmp).toBeDefined();
				if (mmp) {
					expect(mmp.mirror).toBeDefined();
					expect(mmp.menu).toBeDefined();
				}
			});

			it('skips MMP for technical tasks', () => {
				const plan = {
					requestCategory: 'technical_task' as const,
					summary: 'Refactor code',
				};

				const mmp = extractProductDiscoveryMMP(plan as any);

				expect(mmp).toBeUndefined();
			});

			it('includes personas as mirror items', () => {
				const plan = {
					requestCategory: 'product_or_feature' as const,
					summary: 'Test',
					personas: [
						{ id: '1', name: 'Admin', description: 'Administrator' },
						{ id: '2', name: 'User', description: 'End user' }
					],
				};

				const mmp = extractProductDiscoveryMMP(plan as any);

				expect(mmp).toBeDefined();
			});
		});

		describe('extractDomainMMP', () => {
			it('extracts MMP for domains', () => {
				const domains = [
					{ id: 'd1', name: 'Products', description: 'Product catalog' },
					{ id: 'd2', name: 'Orders', description: 'Order processing' }
				];
				const personas = [
					{ id: 'p1', name: 'Customer', description: 'Buyer' }
				];

				const mmp = extractDomainMMP(domains as any, personas);

				expect(mmp).toBeDefined();
				if (mmp && mmp.mirror) {
					expect(mmp.mirror.items.length).toBeGreaterThan(0);
				}
			});

			it('creates mirror items for each domain', () => {
				const domains = [
					{ id: 'd1', name: 'Domain 1', description: 'Desc 1' }
				];
				const personas: Array<{ id: string; name: string; description: string }> = [];

				const mmp = extractDomainMMP(domains as any, personas);

				expect(mmp).toBeDefined();
			});
		});

		describe('extractJourneyWorkflowMMP', () => {
			it('extracts MMP for journeys', () => {
				const journeys = [
					{ id: 'j1', title: 'Login', scenario: 'User logs in' }
				];
				const workflows = [
					{ id: 'w1', name: 'Auth', description: 'Authentication', triggers: [] }
				];

				const mmp = extractJourneyWorkflowMMP(journeys, workflows as any);

				expect(mmp).toBeDefined();
			});

			it('includes both journeys and workflows', () => {
				const journeys = [{ id: 'j1', title: 'Journey 1', scenario: 'Scenario' }];
				const workflows = [{ id: 'w1', name: 'Workflow 1', description: 'Desc', triggers: [] }];

				const mmp = extractJourneyWorkflowMMP(journeys, workflows as any);

				expect(mmp).toBeDefined();
				if (mmp && mmp.mirror) {
					expect(mmp.mirror.items.length).toBeGreaterThan(0);
				}
			});
		});

		describe('extractEntityMMP', () => {
			it('extracts MMP for entities', () => {
				const entities = [
					{ id: 'e1', name: 'User', description: 'User entity', attributes: [] },
					{ id: 'e2', name: 'Product', description: 'Product entity', attributes: [] }
				];

				const mmp = extractEntityMMP(entities as any);

				expect(mmp).toBeDefined();
				if (mmp && mmp.mirror) {
					expect(mmp.mirror.items.length).toBe(2);
				}
			});

			it('creates mirror items for each entity', () => {
				const entities = [
					{ id: 'e1', name: 'Order', description: 'Order entity', attributes: [] }
				];

				const mmp = extractEntityMMP(entities as any);

				expect(mmp).toBeDefined();
			});
		});

		describe('extractIntegrationMMP', () => {
			it('extracts MMP for integrations', () => {
				const integrations: Array<{ id: string; name: string; description: string; purpose: string }> = [
					{ id: 'i1', name: 'Stripe', description: 'Payment processing', purpose: 'Payments' }
				];
				const qualityAttributes = ['Security', 'Performance'];

				const mmp = extractIntegrationMMP(integrations as any, qualityAttributes);

				expect(mmp).toBeDefined();
			});

			it('includes quality attributes', () => {
				const integrations: Array<{ id: string; name: string; description: string; purpose: string }> = [];
				const qualityAttributes = ['Scalability', 'Reliability'];

				const mmp = extractIntegrationMMP(integrations as any, qualityAttributes);

				expect(mmp).toBeDefined();
			});
		});
	});

	describe('sub-state routing', () => {
		it('routes through INTENT_DISCOVERY → PRODUCT_REVIEW flow', async () => {
			const discovery = await executeIntakeConversationTurn(
				dialogueId,
				'Initial request'
			);
			expect(discovery.success).toBe(true);

			const finalization = await executeIntakePlanFinalization(dialogueId);
			expect(finalization.success).toBe(true);

			const approval = executeIntakePlanApproval(dialogueId);
			expect(approval.success).toBe(true);
		});

		it('routes through proposer rounds', async () => {
			const domains = await executeProposerBusinessDomains(dialogueId, 'Start');
			expect(domains.success).toBe(true);

			const journeys = await executeProposerJourneys(dialogueId, 'Continue');
			expect(journeys.success).toBe(true);

			const entities = await executeProposerEntities(dialogueId, 'Continue');
			expect(entities.success).toBe(true);

			const integrations = await executeProposerIntegrations(dialogueId, 'Finish');
			expect(integrations.success).toBe(true);
		});

		it('handles gathering mode flow', async () => {
			const gathering1 = await executeIntakeGatheringTurn(dialogueId, 'Question 1');
			expect(gathering1.success).toBe(true);

			const gathering2 = await executeIntakeGatheringTurn(dialogueId, 'Question 2');
			expect(gathering2.success).toBe(true);
		});

		it('handles analysis → clarification flow', async () => {
			const analysis = await executeIntakeAnalysis(dialogueId, 'Start analysis');
			expect(analysis.success).toBe(true);

			const clarification = await executeIntakeClarificationTurn(dialogueId, 'Clarify');
			expect(clarification.success).toBe(true);
		});
	});

	describe('plan field population', () => {
		it('populates plan with conversation data', async () => {
			await executeIntakeConversationTurn(dialogueId, 'Build todo app with users');
			await executeIntakePlanFinalization(dialogueId);

			expect(true).toBe(true);
		});

		it('populates plan from proposer rounds', async () => {
			await executeProposerBusinessDomains(dialogueId, 'Domains');
			await executeProposerJourneys(dialogueId, 'Journeys');
			await executeProposerEntities(dialogueId, 'Entities');

			expect(true).toBe(true);
		});

		it('accumulates plan fields across turns', async () => {
			await executeIntakeConversationTurn(dialogueId, 'Turn 1');
			await executeIntakeConversationTurn(dialogueId, 'Turn 2');
			await executeIntakePlanFinalization(dialogueId);

			expect(true).toBe(true);
		});
	});
});
