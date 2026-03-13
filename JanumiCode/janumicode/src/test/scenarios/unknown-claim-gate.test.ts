/**
 * Scenario: Unknown Claim Gate
 * Tests that a CRITICAL claim with UNKNOWN verdict triggers a gate
 * and blocks workflow advancement.
 */

import { describe, it, expect } from 'vitest';
import { runScenario } from '../helpers/scenarioRunner';
import { Phase, ClaimCriticality, VerdictType } from '../../lib/types';

describe('Scenario: Unknown Claim Gate', () => {
	it('triggers gate when critical claim verdict is UNKNOWN', async () => {
		const result = await runScenario({
			id: 'unknown-claim-gate',
			goal: 'Deploy to production',
			claims: [
				{
					statement: 'Production database has sufficient capacity',
					criticality: ClaimCriticality.CRITICAL,
					verdict: VerdictType.UNKNOWN,
					confidence: 0.3,
				},
				{
					statement: 'CI pipeline is green',
					criticality: ClaimCriticality.NON_CRITICAL,
					verdict: VerdictType.VERIFIED,
					confidence: 0.99,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.gatesCreated).toBe(1);
		expect(result.hasOpenGates).toBe(true);
		// Should stop at VERIFY — cannot advance past open gate
		expect(result.finalPhase).toBe(Phase.VERIFY);
	});

	it('emits gate triggered event', async () => {
		const result = await runScenario({
			id: 'unknown-claim-gate-events',
			goal: 'Test gate events',
			claims: [
				{
					statement: 'Unknown dependency status',
					criticality: ClaimCriticality.CRITICAL,
					verdict: VerdictType.UNKNOWN,
				},
			],
		});

		const gateEvents = result.events.filter(e => e.type === 'workflow:gate_triggered');
		expect(gateEvents).toHaveLength(1);
	});
});
