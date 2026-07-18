import { describe, expect, it } from 'vitest';
import type { PwuBehaviorProjection } from '@janumipwb/rph-projections';
import { buildPwuLifecycleTopologyTool } from './tools.js';

describe('get_pwu_lifecycle_topology', () => {
	it('exposes the derived behavior projection without a mutation surface', () => {
		const tool = buildPwuLifecycleTopologyTool();

		expect(tool.name).toBe('get_pwu_lifecycle_topology');
		expect(tool.mutates).toBe(false);
		expect(tool.parameters).toEqual({});
		expect(tool.description).toMatch(/derived, non-authoritative/i);
		expect(tool.description).toMatch(/never .*dispatches a domain Command/i);

		const result = tool.run({});
		expect(result.ok).toBe(true);
		expect(result.summary).toMatch(/Simulation only/i);
		expect(result.summary).toMatch(/no domain Command was dispatched/i);

		const topology = result.data as PwuBehaviorProjection;
		expect(topology.authority).toBe('DERIVED_NON_AUTHORITATIVE');
		expect(topology.scope).toBe('WORK_LIFECYCLE_TOPOLOGY');
		expect(topology.states.length).toBeGreaterThan(0);
		expect(topology.transitions.length).toBeGreaterThan(0);
		expect(topology.transitions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					requiresAuthoritativeCommand: true
				})
			])
		);
		expect(
			topology.transitions.every((transition) =>
				transition.simulationEventType.startsWith('SIMULATE.PWU.')
			)
		).toBe(true);
	});
});
