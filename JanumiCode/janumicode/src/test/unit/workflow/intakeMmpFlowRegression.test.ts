/**
 * Regression: PRODUCT_REVIEW MMP submit must advance proposer rounds in-order.
 *
 * This reproduces the real failure path:
 * 1) User submits Product Discovery MMP decisions
 * 2) INTAKE should run domain mapping proposer
 * 3) User submits again
 * 4) INTAKE should advance to journeys proposer (not replay domain mapping)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';
import { createDialogueRecord } from '../../../lib/dialogue/lifecycle';
import { getOrCreateIntakeConversation } from '../../../lib/events/reader';
import { updateIntakeConversation } from '../../../lib/events/writer';
import {
	getWorkflowState,
	initializeWorkflowState,
	updateWorkflowMetadata,
} from '../../../lib/workflow/stateMachine';
import { advanceWorkflow } from '../../../lib/workflow/orchestrator';
import { IntakeSubState, ProposerPhase } from '../../../lib/types';

const DIALOGUE_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000009001';

function getMetadata(dialogueId: string): Record<string, unknown> {
	const state = getWorkflowState(dialogueId);
	if (!state.success) {
		throw new Error(`getWorkflowState failed: ${state.error.message}`);
	}
	return JSON.parse(state.value.metadata) as Record<string, unknown>;
}

describe('INTAKE MMP submit regression flow', () => {
	let tempDb: TempDbContext;
	let deterministic: DeterministicHarness;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		deterministic = useDeterministicHarness({ useClock: false });

		registerFakeProviders({
			expertResponses: [
				{
					response: JSON.stringify({
						domains: [
							{
								id: 'DOM-LEASE',
								name: 'Lease Management',
								description: 'Manage lease lifecycle and approvals',
								rationale: 'document-specified',
								entityPreview: ['Lease', 'Tenant'],
								workflowPreview: ['Lease approval'],
							},
						],
						personas: [
							{
								id: 'P-1',
								name: 'Property Manager',
								description: 'Operates leasing workflows',
								goals: ['Ship leases quickly'],
								painPoints: ['Manual handoffs'],
							},
						],
					}),
				},
				{
					response: JSON.stringify({
						userJourneys: [
							{
								id: 'UJ-LEASE-1',
								personaId: 'P-1',
								title: 'Create and approve lease',
								scenario: 'Manager creates a lease and routes for approval',
								steps: [
									{
										stepNumber: 1,
										actor: 'Property Manager',
										action: 'Enter lease terms',
										expectedOutcome: 'Draft lease is created',
									},
								],
								acceptanceCriteria: ['Lease can be approved in one flow'],
								implementationPhase: 'Phase 1',
								source: 'document-specified',
							},
						],
						workflows: [
							{
								id: 'WF-LEASE-APPROVAL',
								businessDomainId: 'DOM-LEASE',
								name: 'Lease approval workflow',
								description: 'Submit and approve lease package',
								steps: ['Draft lease', 'Route for approval'],
								triggers: ['Lease submitted'],
								actors: ['Property Manager', 'Owner'],
								source: 'domain-standard',
							},
						],
					}),
				},
			],
		});
	});

	afterEach(() => {
		teardownFakeProviders();
		deterministic.restore();
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('advances PRODUCT_REVIEW proposer rounds from domain mapping to journeys', async () => {
		const createResult = createDialogueRecord(
			DIALOGUE_ID,
			'Build a property management platform',
		);
		expect(createResult.success).toBe(true);

		const initResult = initializeWorkflowState(DIALOGUE_ID, {
			goal: 'Build a property management platform',
		});
		expect(initResult.success).toBe(true);

		const conv = getOrCreateIntakeConversation(DIALOGUE_ID);
		expect(conv.success).toBe(true);
		if (!conv.success) {
			return;
		}

		// Seed the state to match real Product Discovery review handoff.
		const setReviewState = updateIntakeConversation(DIALOGUE_ID, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: {
				...conv.value.draftPlan,
				preProposerReview: true,
				proposerPhase: ProposerPhase.BUSINESS_DOMAIN_MAPPING,
			} as never,
		});
		expect(setReviewState.success).toBe(true);

		// Submit Product Discovery decisions.
		const firstWrite = updateWorkflowMetadata(DIALOGUE_ID, {
			pendingIntakeInput: '[MMP Decisions]\nACCEPTED: "Lease lifecycle support"',
		});
		expect(firstWrite.success).toBe(true);

		const firstAdvance = await advanceWorkflow(DIALOGUE_ID);
		expect(firstAdvance.success).toBe(true);
		if (!firstAdvance.success) {
			return;
		}
		expect(firstAdvance.value.awaitingInput).toBe(true);

		const afterFirst = getOrCreateIntakeConversation(DIALOGUE_ID);
		expect(afterFirst.success).toBe(true);
		if (!afterFirst.success) {
			return;
		}
		expect(afterFirst.value.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(afterFirst.value.draftPlan.preProposerReview).toBe(false);
		expect(afterFirst.value.draftPlan.proposerPhase).toBe(
			ProposerPhase.BUSINESS_DOMAIN_MAPPING,
		);
		expect(afterFirst.value.draftPlan.businessDomainProposals?.length ?? 0).toBe(1);
		expect(afterFirst.value.draftPlan.personas?.length ?? 0).toBe(1);
		expect(getMetadata(DIALOGUE_ID).pendingIntakeInput).toBeUndefined();

		// Submit next review decisions; should advance to journeys proposer (not rerun domains).
		const secondWrite = updateWorkflowMetadata(DIALOGUE_ID, {
			pendingIntakeInput:
				'[MMP Decisions]\nACCEPTED: "Lease Management"\nACCEPTED: "Property Manager persona"',
		});
		expect(secondWrite.success).toBe(true);

		const secondAdvance = await advanceWorkflow(DIALOGUE_ID);
		expect(secondAdvance.success).toBe(true);
		if (!secondAdvance.success) {
			return;
		}
		expect(secondAdvance.value.awaitingInput).toBe(true);

		const afterSecond = getOrCreateIntakeConversation(DIALOGUE_ID);
		expect(afterSecond.success).toBe(true);
		if (!afterSecond.success) {
			return;
		}
		expect(afterSecond.value.subState).toBe(IntakeSubState.PRODUCT_REVIEW);
		expect(afterSecond.value.draftPlan.proposerPhase).toBe(
			ProposerPhase.JOURNEY_WORKFLOW,
		);
		expect(afterSecond.value.draftPlan.userJourneys?.length ?? 0).toBe(1);
		expect(afterSecond.value.draftPlan.workflowProposals?.length ?? 0).toBe(1);
		expect(afterSecond.value.draftPlan.businessDomainProposals?.[0]?.id).toBe(
			'DOM-LEASE',
		);
		expect(afterSecond.value.draftPlan.userJourneys?.[0]?.id).toBe('UJ-LEASE-1');
		expect(getMetadata(DIALOGUE_ID).pendingIntakeInput).toBeUndefined();
	});
});
