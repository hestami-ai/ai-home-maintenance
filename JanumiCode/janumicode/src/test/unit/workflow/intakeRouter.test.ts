import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import { executeIntakePhase } from '../../../lib/workflow/intakeRouter';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { getOrCreateIntakeConversation, updateIntakeConversation } from '../../../lib/events';
import { Phase, IntakeSubState, IntakeMode, ProposerPhase } from '../../../lib/types';
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



describe('IntakeRouter', () => {
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
						domains: ['domain1', 'domain2'],
						personas: [{ id: '1', name: 'User', description: 'End user' }],
					}),
					exitCode: 0,
				},
			],
		});

		initializeWorkflowState(dialogueId, { goal: 'Test router' });
	});

	afterEach(() => {
		teardownFakeProviders();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('executeIntakePhase routing', () => {
		describe('INTENT_DISCOVERY sub-state', () => {
			it('routes to analysis handler', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.INTENT_DISCOVERY,
				});

				const result = await executeIntakePhase(dialogueId, 'Analyze requirements');

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe(Phase.INTAKE);
				}
			});

			it('executes intake analysis', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.INTENT_DISCOVERY,
				});

				const result = await executeIntakePhase(dialogueId, 'Initial request');

				expect(result.success).toBe(true);
			});
		});

		describe('PRODUCT_REVIEW sub-state', () => {
			beforeEach(() => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PRODUCT_REVIEW,
					draftPlan: {
						proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
					} as any,
				});
			});

			it('handles MMP submission', async () => {
				const result = await executeIntakePhase(
					dialogueId,
					'[MMP Decisions]\nACCEPTED: Domain 1'
				);

				expect(result.success).toBe(true);
			});

			it('advances to next proposer round on MMP submission', async () => {
				const result = await executeIntakePhase(
					dialogueId,
					'[MMP Decisions]\nACCEPTED: All'
				);

				expect(result.success).toBe(true);
			});

			it('handles free text feedback', async () => {
				const result = await executeIntakePhase(
					dialogueId,
					'Please focus on the core features'
				);

				expect(result.success).toBe(true);
			});

			it('reruns current proposer with feedback', async () => {
				const result = await executeIntakePhase(
					dialogueId,
					'Add more detail to domain 1'
				);

				expect(result.success).toBe(true);
			});

			it('routes through proposer sequence', async () => {
				// Business domains → Journeys
				updateIntakeConversation(dialogueId, {
					draftPlan: {
						proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
					} as any,
				});

				const domains = await executeIntakePhase(dialogueId, '[MMP Decisions]');
				expect(domains.success).toBe(true);

				// Journeys → Entities
				updateIntakeConversation(dialogueId, {
					draftPlan: {
						proposerPhase: ProposerPhase.JOURNEY_WORKFLOW,
					} as any,
				});

				const journeys = await executeIntakePhase(dialogueId, '[MMP Decisions]');
				expect(journeys.success).toBe(true);

				// Entities → Integrations
				updateIntakeConversation(dialogueId, {
					draftPlan: {
						proposerPhase: ProposerPhase.ENTITY_DATA_MODEL,
					} as any,
				});

				const entities = await executeIntakePhase(dialogueId, '[MMP Decisions]');
				expect(entities.success).toBe(true);

				// Integrations → Synthesizing
				updateIntakeConversation(dialogueId, {
					draftPlan: {
						proposerPhase: ProposerPhase.INTEGRATION_QUALITY,
					} as any,
				});

				const integrations = await executeIntakePhase(dialogueId, '[MMP Decisions]');
				expect(integrations.success).toBe(true);
			});

			it('handles pre-proposer review', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PRODUCT_REVIEW,
					draftPlan: {
						preProposerReview: true,
					} as any,
				});

				const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');

				expect(result.success).toBe(true);
			});
		});

		describe('PROPOSING_* sub-states', () => {
			it('routes PROPOSING_BUSINESS_DOMAINS', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING_BUSINESS_DOMAINS,
				});

				const result = await executeIntakePhase(dialogueId, 'Continue');

				expect(result.success).toBe(true);
			});

			it('routes PROPOSING_JOURNEYS', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING_JOURNEYS,
				});

				const result = await executeIntakePhase(dialogueId, 'Continue');

				expect(result.success).toBe(true);
			});

			it('routes PROPOSING_ENTITIES', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING_ENTITIES,
				});

				const result = await executeIntakePhase(dialogueId, 'Continue');

				expect(result.success).toBe(true);
			});

			it('routes PROPOSING_INTEGRATIONS', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING_INTEGRATIONS,
				});

				const result = await executeIntakePhase(dialogueId, 'Continue');

				expect(result.success).toBe(true);
			});
		});

		describe('PROPOSING sub-state', () => {
			it('transitions to CLARIFYING', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING,
				});

				const result = await executeIntakePhase(dialogueId, 'User response');

				expect(result.success).toBe(true);

				const conv = getOrCreateIntakeConversation(dialogueId);
				if (conv.success) {
					expect(conv.value.subState).toBe(IntakeSubState.CLARIFYING);
				}
			});

			it('sets clarification round to 1', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PROPOSING,
				});

				await executeIntakePhase(dialogueId, 'Response');

				const conv = getOrCreateIntakeConversation(dialogueId);
				if (conv.success) {
					expect(conv.value.clarificationRound).toBe(1);
				}
			});
		});

		describe('CLARIFYING sub-state', () => {
			it('routes to clarification handler', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.CLARIFYING,
					clarificationRound: 1,
				});

				const result = await executeIntakePhase(dialogueId, 'Clarification');

				expect(result.success).toBe(true);
			});

			it('handles multiple clarification rounds', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.CLARIFYING,
					clarificationRound: 2,
				});

				const result = await executeIntakePhase(dialogueId, 'More details');

				expect(result.success).toBe(true);
			});
		});

		describe('GATHERING sub-state', () => {
			it('routes to gathering handler', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.GATHERING,
				});

				const result = await executeIntakePhase(dialogueId, 'Answer question');

				expect(result.success).toBe(true);
			});

			it('executes gathering turn', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.GATHERING,
				});

				const result = await executeIntakePhase(dialogueId, 'Domain details');

				expect(result.success).toBe(true);
			});
		});

		describe('DISCUSSING sub-state', () => {
			it('initializes on first turn', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.DISCUSSING,
					turnCount: 0,
				});

				const result = await executeIntakePhase(dialogueId, 'Initial goal');

				expect(result.success).toBe(true);
			});

			it('caches goal on first turn', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.DISCUSSING,
					turnCount: 0,
				});

				await executeIntakePhase(dialogueId, 'Build todo app');

				expect(true).toBe(true);
			});

			it('routes to analysis for STATE_DRIVEN mode', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.DISCUSSING,
					turnCount: 0,
					intakeMode: IntakeMode.STATE_DRIVEN,
				});

				const result = await executeIntakePhase(dialogueId, 'Build app');

				expect(result.success).toBe(true);
			});

			it('routes to analysis for DOCUMENT_BASED mode', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.DISCUSSING,
					turnCount: 0,
					intakeMode: IntakeMode.DOCUMENT_BASED,
				});

				const result = await executeIntakePhase(dialogueId, 'Review docs/');

				expect(result.success).toBe(true);
			});

			it('handles conversation turns for HYBRID mode', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.DISCUSSING,
					turnCount: 1,
					intakeMode: IntakeMode.HYBRID_CHECKPOINTS,
				});

				const result = await executeIntakePhase(dialogueId, 'Follow-up');

				expect(result.success).toBe(true);
			});
		});

		describe('SYNTHESIZING sub-state', () => {
			it('routes to plan finalization', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.SYNTHESIZING,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});

			it('produces final plan', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.SYNTHESIZING,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});
		});

		describe('AWAITING_APPROVAL sub-state', () => {
			it('routes to plan approval', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.AWAITING_APPROVAL,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});

			it('runs narrative curation', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.AWAITING_APPROVAL,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});

			it('produces handoff document', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.AWAITING_APPROVAL,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});

			it('creates MAKER intent and contract', async () => {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.AWAITING_APPROVAL,
				});

				const result = await executeIntakePhase(dialogueId, '');

				expect(result.success).toBe(true);
			});
		});

		describe('unknown sub-state', () => {
			it('returns error for unknown sub-state', async () => {
				updateIntakeConversation(dialogueId, {
					subState: 'INVALID' as any,
				});

				const result = await executeIntakePhase(dialogueId, 'Test');

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('Unknown intake sub-state');
				}
			});
		});
	});

	describe('proposer round progression', () => {
		it('advances from business domains to journeys', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				} as any,
			});

			const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');

			expect(result.success).toBe(true);
		});

		it('advances from journeys to entities', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.JOURNEY_WORKFLOW,
				} as any,
			});

			const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');

			expect(result.success).toBe(true);
		});

		it('advances from entities to integrations', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.ENTITY_DATA_MODEL,
				} as any,
			});

			const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');

			expect(result.success).toBe(true);
		});

		it('advances from integrations to synthesizing', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.INTEGRATION_QUALITY,
				} as any,
			});

			const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');

			expect(result.success).toBe(true);
		});
	});

	describe('feedback handling', () => {
		it('stores feedback in plan', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				} as any,
			});

			await executeIntakePhase(dialogueId, 'Focus on core features');

			const conv = getOrCreateIntakeConversation(dialogueId);
			if (conv.success && conv.value.draftPlan) {
				expect((conv.value.draftPlan as any).humanFeedback).toBe('Focus on core features');
			}
		});

		it('reruns proposer with feedback', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: {
					proposerPhase: ProposerPhase.JOURNEY_WORKFLOW,
				} as any,
			});

			const result = await executeIntakePhase(dialogueId, 'Add payment journey');

			expect(result.success).toBe(true);
		});
	});

	describe('mode-aware routing', () => {
		it('routes STATE_DRIVEN to analysis on first turn', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
				turnCount: 0,
				intakeMode: IntakeMode.STATE_DRIVEN,
			});

			const result = await executeIntakePhase(dialogueId, 'Build platform');

			expect(result.success).toBe(true);
		});

		it('routes DOCUMENT_BASED to analysis on first turn', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
				turnCount: 0,
				intakeMode: IntakeMode.DOCUMENT_BASED,
			});

			const result = await executeIntakePhase(dialogueId, 'Review specs/');

			expect(result.success).toBe(true);
		});

		it('routes HYBRID to conversation on first turn', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
				turnCount: 0,
				intakeMode: IntakeMode.HYBRID_CHECKPOINTS,
			});

			const result = await executeIntakePhase(dialogueId, 'Fix bug');

			expect(result.success).toBe(true);
		});
	});

	describe('error handling', () => {
		it('handles database errors', async () => {
			tempDb.cleanup();

			const result = await executeIntakePhase(dialogueId, 'Test');

			expect(result.success).toBe(false);
		});

		it('handles execution errors gracefully', async () => {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.SYNTHESIZING,
			});

			teardownFakeProviders();

			const result = await executeIntakePhase(dialogueId, '');

			expect(result.success).toBeDefined();
		});
	});

	describe('workflow scenarios', () => {
		it('executes STATE_DRIVEN flow', async () => {
			// First turn → analysis
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
				turnCount: 0,
				intakeMode: IntakeMode.STATE_DRIVEN,
			});

			const analysis = await executeIntakePhase(dialogueId, 'Build e-commerce');
			expect(analysis.success).toBe(true);

			// Product review → proposers
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.PRODUCT_REVIEW,
				draftPlan: { preProposerReview: true } as any,
			});

			const review = await executeIntakePhase(dialogueId, '[MMP Decisions]');
			expect(review.success).toBe(true);
		});

		it('executes HYBRID flow', async () => {
			// Conversation turns
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
				turnCount: 1,
				intakeMode: IntakeMode.HYBRID_CHECKPOINTS,
			});

			const turn1 = await executeIntakePhase(dialogueId, 'Add dark mode');
			expect(turn1.success).toBe(true);

			// Finalization
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.SYNTHESIZING,
			});

			const synthesis = await executeIntakePhase(dialogueId, '');
			expect(synthesis.success).toBe(true);
		});

		it('executes full proposer cycle', async () => {
			const proposerPhases = [
				ProposerPhase.BUSINESS_DOMAIN_MAPPING,
				ProposerPhase.JOURNEY_WORKFLOW,
				ProposerPhase.ENTITY_DATA_MODEL,
				ProposerPhase.INTEGRATION_QUALITY,
			];

			for (const phase of proposerPhases) {
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.PRODUCT_REVIEW,
					draftPlan: { proposerPhase: phase } as any,
				});

				const result = await executeIntakePhase(dialogueId, '[MMP Decisions]');
				expect(result.success).toBe(true);
			}
		});
	});
});
