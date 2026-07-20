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

// JAN-PRPWA-DS-001 STD-2/STD-3 (DWP-04): the flattened boundary params across the three authoring tools. The
// engine enforces INV-1 (F-10) — the tools only pre-check the enum and reassemble the contract for the broker.
describe('PWU-Type boundary tool params (JAN-PRPWA DWP-04)', () => {
	const FULL_HELP = {
		name: 'name',
		pwuKind: 'kind',
		purpose: 'purpose',
		isRoot: 'root',
		completionRule: 'completion',
		requiredInputs: 'inputs',
		requiredOutputs: 'outputs',
		requiredAssurancePolicyIds: 'policies',
		executionBoundary: 'Where work is discharged: INTERNAL or DELEGATED_EXTERNAL.',
		counterpartyLabel: 'the external party',
		attestedAssurancePolicyIds: 'attested policies',
		boundaryApplicabilityNote: 'scope note'
	};
	const rationale = { declare: vi.fn(), get: () => undefined } as RationaleSink;
	const buildTools = (methods: Record<string, unknown>) =>
		buildAuthoringTools({ help: () => FULL_HELP, ...methods } as unknown as PwaAuthoringBroker, rationale);
	const find = (methods: Record<string, unknown>, name: string) =>
		buildTools(methods).find((t) => t.name === name)!;

	it('define_pwu_type: rejects a garbage executionBoundary and does not call the broker', () => {
		const defineType = vi.fn(() => ({ ok: true, id: 'pwut_x', status: 'ACCEPTED' }));
		const tool = find({ defineType }, 'define_pwu_type');
		expect(tool.parameters.executionBoundary?.description).toMatch(/DELEGATED_EXTERNAL/);
		const r = tool.run({ name: 'X', pwuKind: 'X', executionBoundary: 'OFFSHORE' });
		expect(r).toMatchObject({ ok: false });
		expect(r.summary).toMatch(/INTERNAL or DELEGATED_EXTERNAL/);
		expect(defineType).not.toHaveBeenCalled();
	});

	it('define_pwu_type: reassembles the flattened params into a boundaryContract and forwards it', () => {
		const defineType = vi.fn(() => ({ ok: true, id: 'pwut_x', status: 'ACCEPTED' }));
		const tool = find({ defineType }, 'define_pwu_type');
		tool.run({
			name: 'Bloodwork',
			pwuKind: 'DELEGATED',
			executionBoundary: 'DELEGATED_EXTERNAL',
			counterpartyLabel: 'Contract Lab',
			attestedAssurancePolicyIds: ['pol_x'],
			boundaryApplicabilityNote: 'STAT only'
		});
		expect(defineType).toHaveBeenCalledWith(
			expect.objectContaining({
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: {
					counterpartyLabel: 'Contract Lab',
					attestedAssurancePolicyIds: ['pol_x'],
					applicabilityNote: 'STAT only'
				}
			})
		);
	});

	it('define_pwu_type: omits boundary fields entirely when none are given (INTERNAL resolves downstream)', () => {
		const defineType = vi.fn(() => ({ ok: true, id: 'pwut_x', status: 'ACCEPTED' }));
		find({ defineType }, 'define_pwu_type').run({ name: 'Internal', pwuKind: 'X' });
		expect(defineType).toHaveBeenCalledWith(expect.not.objectContaining({ executionBoundary: expect.anything() }));
		expect(defineType).toHaveBeenCalledWith(expect.not.objectContaining({ boundaryContract: expect.anything() }));
	});

	it('edit_pwu_type: rejects a garbage boundary, then reassembles the contract into the patch', () => {
		const editType = vi.fn(() => ({ ok: true, id: 'pwut_x', status: 'ACCEPTED' }));
		const tool = find({ editType }, 'edit_pwu_type');
		expect(tool.run({ pwuTypeId: 'pwut_x', executionBoundary: 'nope' })).toMatchObject({ ok: false });
		expect(editType).not.toHaveBeenCalled();
		tool.run({ pwuTypeId: 'pwut_x', executionBoundary: 'DELEGATED_EXTERNAL', counterpartyLabel: 'Lab' });
		expect(editType).toHaveBeenCalledWith(
			'pwut_x',
			expect.objectContaining({
				executionBoundary: 'DELEGATED_EXTERNAL',
				boundaryContract: { counterpartyLabel: 'Lab', attestedAssurancePolicyIds: [] }
			})
		);
	});

	it('scaffold_graph: rejects a garbage executionBoundary on any item and forwards a delegated leaf contract', () => {
		const scaffold = vi.fn(() => ({ ok: true, ids: {}, status: 'ACCEPTED' }));
		const tool = find({ scaffold }, 'scaffold_graph');
		expect(
			tool.run({ types: [{ tempKey: 'a', name: 'A', pwuKind: 'X', executionBoundary: 'bad' }] })
		).toMatchObject({ ok: false });
		expect(scaffold).not.toHaveBeenCalled();
		tool.run({
			types: [
				{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT', isRoot: true, childTempKeys: ['lab'] },
				{
					tempKey: 'lab',
					name: 'Lab',
					pwuKind: 'DELEGATED',
					executionBoundary: 'DELEGATED_EXTERNAL',
					counterpartyLabel: 'Contract Lab',
					attestedAssurancePolicyIds: []
				}
			]
		});
		expect(scaffold).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					tempKey: 'lab',
					executionBoundary: 'DELEGATED_EXTERNAL',
					boundaryContract: { counterpartyLabel: 'Contract Lab', attestedAssurancePolicyIds: [] }
				})
			])
		);
	});
});
