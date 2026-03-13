/**
 * Scenario: Reject and Replan
 * Tests that resolving a gate with rejection and then providing
 * a gate resolution allows the workflow to continue.
 */

import { describe, it, expect } from 'vitest';
import { runScenario } from '../helpers/scenarioRunner';
import { Phase, ClaimCriticality, VerdictType } from '../../lib/types';

describe('Scenario: Reject and Replan', () => {
	it('resolves gate and continues workflow after rejection', async () => {
		const result = await runScenario({
			id: 'reject-and-replan',
			goal: 'Implement authentication system',
			claims: [
				{
					statement: 'JWT library is compatible with Node 22',
					criticality: ClaimCriticality.CRITICAL,
					verdict: VerdictType.DISPROVED,
					confidence: 0.85,
				},
			],
			onGateTriggered: (_gateId, _reason) => ({
				action: 'APPROVE',
				rationale: 'Switching to Paseto tokens instead of JWT',
			}),
		});

		expect(result.success).toBe(true);
		expect(result.gatesCreated).toBe(1);
		expect(result.gatesResolved).toBe(1);
		expect(result.hasOpenGates).toBe(false);
		// Gate was resolved, so workflow should have continued past VERIFY
		expect(result.finalPhase).toBe(Phase.COMMIT);
	});
});
