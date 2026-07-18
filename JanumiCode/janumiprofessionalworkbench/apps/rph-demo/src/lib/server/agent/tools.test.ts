import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import type { PwuBehaviorProjection } from '@janumipwb/rph-projections';
import { describe, expect, it, vi } from 'vitest';
import type { RationaleSink } from './rationale.js';
import { buildAuthoringTools, buildPwuLifecycleTopologyTool } from './tools.js';

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

describe('link_types semantic edge attributes', () => {
	it('declares and forwards cardinality/applicability to the broker', () => {
		const linkTypes = vi.fn(() => ({ ok: true, status: 'ACCEPTED' }));
		const broker = {
			help: () => ({
				name: 'name',
				pwuKind: 'kind',
				purpose: 'purpose',
				isRoot: 'root',
				completionRule: 'completion',
				requiredInputs: 'inputs',
				requiredOutputs: 'outputs',
				requiredAssurancePolicyIds: 'policies'
			}),
			linkTypes
		} as unknown as PwaAuthoringBroker;
		const rationale = {
			declare: vi.fn(),
			get: () => undefined
		} as RationaleSink;
		const tool = buildAuthoringTools(broker, rationale).find(
			(candidate) => candidate.name === 'link_types'
		)!;

		expect(tool.parameters.cardinality?.description).toMatch(/M\+/);
		expect(tool.parameters.applicabilityNote?.description).toMatch(/conditional/);
		const result = tool.run({
			parentPwuTypeId: 'pwut_parent',
			childPwuTypeId: 'pwut_child',
			cardinality: 'C+',
			applicabilityNote: 'Only when regulated.'
		});

		expect(result.ok).toBe(true);
		expect(linkTypes).toHaveBeenCalledWith('pwut_parent', 'pwut_child', {
			cardinality: 'C+',
			applicabilityNote: 'Only when regulated.'
		});

		const invalid = tool.run({
			parentPwuTypeId: 'pwut_parent',
			childPwuTypeId: 'pwut_child',
			cardinality: 'sometimes'
		});
		expect(invalid).toMatchObject({ ok: false });
		expect(invalid.summary).toMatch(/M1, M\+, C1, or C\+/);
		expect(linkTypes).toHaveBeenCalledTimes(1);
	});
});

describe('scaffold_graph semantic edge attributes', () => {
	it('rejects an invalid cardinality instead of silently weakening it to M1', () => {
		const scaffold = vi.fn(() => ({ ok: true, status: 'ACCEPTED' }));
		const broker = {
			help: () => ({
				name: 'name',
				pwuKind: 'kind',
				purpose: 'purpose',
				isRoot: 'root',
				completionRule: 'completion',
				requiredInputs: 'inputs',
				requiredOutputs: 'outputs',
				requiredAssurancePolicyIds: 'policies'
			}),
			scaffold
		} as unknown as PwaAuthoringBroker;
		const rationale = {
			declare: vi.fn(),
			get: () => undefined
		} as RationaleSink;
		const tool = buildAuthoringTools(broker, rationale).find(
			(candidate) => candidate.name === 'scaffold_graph'
		)!;

		const result = tool.run({
			types: [
				{
					tempKey: 'root',
					name: 'Root',
					pwuKind: 'MANAGEMENT',
					isRoot: true,
					childTempKeys: ['child'],
					childCardinalities: [{ tempKey: 'child', cardinality: 'many-ish' }]
				},
				{ tempKey: 'child', name: 'Child', pwuKind: 'IMPLEMENTATION' }
			]
		});

		expect(result).toMatchObject({ ok: false });
		expect(result.summary).toMatch(/M1, M\+, C1, or C\+/);
		expect(scaffold).not.toHaveBeenCalled();
	});
});
