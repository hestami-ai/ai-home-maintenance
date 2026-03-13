/**
 * Scenario: Happy Path
 * Tests that a simple goal progresses through all phases
 * when all claims are verified successfully (no gates triggered).
 */

import { describe, it, expect } from 'vitest';
import { runScenario } from '../helpers/scenarioRunner';
import { Phase, ClaimCriticality, VerdictType } from '../../lib/types';

describe('Scenario: Happy Path', () => {
	it('progresses through all phases without gates', async () => {
		const result = await runScenario({
			id: 'happy-path',
			goal: 'Add a login button to the header',
			executorResponses: [
				{ response: '{"proposal": "Add login button component with OAuth integration"}' },
			],
			claims: [
				{
					statement: 'OAuth library is available',
					criticality: ClaimCriticality.CRITICAL,
					verdict: VerdictType.VERIFIED,
					confidence: 0.95,
				},
				{
					statement: 'Header component supports slot insertion',
					criticality: ClaimCriticality.NON_CRITICAL,
					verdict: VerdictType.VERIFIED,
					confidence: 0.88,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.claimsCreated).toBe(2);
		expect(result.gatesCreated).toBe(0);
		expect(result.hasOpenGates).toBe(false);
		expect(result.finalPhase).toBe(Phase.COMMIT);
	});

	it('visits all expected phases in order', async () => {
		const result = await runScenario({
			id: 'happy-path-phases',
			goal: 'Implement feature X',
			claims: [
				{
					statement: 'TypeScript configured',
					criticality: ClaimCriticality.NON_CRITICAL,
					verdict: VerdictType.VERIFIED,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.phaseHistory).toEqual([
			Phase.INTAKE,
			Phase.PROPOSE,
			Phase.ASSUMPTION_SURFACING,
			Phase.VERIFY,
			Phase.HISTORICAL_CHECK,
			Phase.REVIEW,
			Phase.EXECUTE,
			Phase.VALIDATE,
			Phase.COMMIT,
		]);
	});

	it('emits claim:created events for each claim', async () => {
		const result = await runScenario({
			id: 'happy-path-events',
			goal: 'Test claim events',
			claims: [
				{
					statement: 'Claim A',
					criticality: ClaimCriticality.CRITICAL,
					verdict: VerdictType.VERIFIED,
				},
				{
					statement: 'Claim B',
					criticality: ClaimCriticality.NON_CRITICAL,
					verdict: VerdictType.VERIFIED,
				},
			],
		});

		const claimEvents = result.events.filter(e => e.type === 'claim:created');
		expect(claimEvents).toHaveLength(2);
	});
});
