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

// ── ⭑⭑ JAN-EXECGOV EG-07b — THE AGENT MAY DECLARE HOW WORK IS DISCHARGED, AND ARM THE INSTRUCTION ───────────
//
// SPONSOR DIRECTION: *"the PWA authoring agent should be able to declare how work is discharged, and the human
// reviewing the full PWA before approving its use would be the model."* Decision `G-4`: **text plus arming,
// AFTER the review surface lands** — `EG-07a` discharged that condition, so arming is live here.
//
// ⛔ MEASURED BEFORE THIS: `DefineTypeInput` carried 12 fields and none was `workDischarge`; the tool schema
// named none of the prompt fields. `workDischarge: 'MODEL'` was reachable ONLY by a human choosing it in a
// select, so an agent-authored type was never MODEL, never got a `RUNTIME_BINDING`, and took
// `bindingAuthorityVerdict`'s `OUT_OF_SCOPE` limb — the pre-`EG-02` state, for the agent path only.
describe('EG-07b — the agent can declare discharge and author a prompt', () => {
	const captured: Record<string, unknown>[] = [];
	const brokerFor = () => {
		captured.length = 0;
		return {
			help: () => ({
				name: 'n',
				pwuKind: 'k',
				purpose: 'p',
				isRoot: 'r',
				completionRule: 'c',
				requiredInputs: 'i',
				requiredOutputs: 'o',
				requiredAssurancePolicyIds: 'a',
				executionBoundary: 'b',
				counterpartyLabel: 'cl',
				attestedAssurancePolicyIds: 'ap',
				boundaryApplicabilityNote: 'ban',
				permittedChildren: 'pc',
				workDischarge: 'wd',
				promptTemplateText: 'ptt',
				promptOutputContract: 'poc',
				promptActive: 'pa'
			}),
			defineType: vi.fn((input: Record<string, unknown>) => {
				captured.push(input);
				return { ok: true, id: 'pwut_1', status: 'ACCEPTED' };
			})
		} as unknown as PwaAuthoringBroker;
	};
	const sink = { declare: vi.fn(), get: () => undefined } as unknown as RationaleSink;
	const defineTool = (b: PwaAuthoringBroker) =>
		buildAuthoringTools(b, sink).find((t) => t.name === 'define_pwu_type')!;

	it('⭑ the tool SCHEMA offers the four parameters, described by the shared help', () => {
		// ⛔ The schema is the agent's whole view of what it may say. EG-06 single-sourced these strings under a
		// comment naming them "the three the agent's tool schema cannot see"; this is that sentence being retired.
		const params = defineTool(brokerFor()).parameters as Record<string, { description?: string }>;
		for (const p of ['workDischarge', 'promptTemplateText', 'promptOutputContract', 'promptActive'])
			expect(params[p], `${p} must be offered to the agent`).toBeDefined();
		expect(params.workDischarge!.description).toBe('wd');
		expect(params.promptActive!.description).toBe('pa');
	});

	it('⛔⛔ ABSENCE IS PRESERVED — an agent that says nothing declares nothing', () => {
		// ⚠⚠ THE ASSERTION THAT MATTERS MOST IN THIS INCREMENT. `isRoot: bool(a.isRoot)` sits twenty lines from
		// the new helper and turns an absent argument into `false`. The same idiom on discharge would turn an
		// agent that never mentioned it into one that DECLARED something, destroying the distinction the engine
		// keeps: "absent means the author was never asked; UNDECLARED means they were asked and deferred".
		// THE MUTANT: forward unconditionally, or default to 'UNDECLARED'.
		const b = brokerFor();
		defineTool(b).run({ name: 'T', pwuKind: 'K' });
		expect(captured).toHaveLength(1);
		expect(captured[0]).not.toHaveProperty('workDischarge');
		expect(captured[0]).not.toHaveProperty('promptTemplate');
	});

	it('a declared discharge reaches the broker verbatim', () => {
		const b = brokerFor();
		defineTool(b).run({ name: 'T', pwuKind: 'K', workDischarge: 'MODEL' });
		expect(captured[0]!.workDischarge).toBe('MODEL');
	});

	it('⭑ a value outside the ratified enum is DROPPED, not passed through', () => {
		// The enum is ratified; an agent inventing a fourth discharge would otherwise reach the engine and be
		// refused there — which is safe but tells the agent nothing about WHICH field was wrong.
		const b = brokerFor();
		defineTool(b).run({ name: 'T', pwuKind: 'K', workDischarge: 'ROBOT' });
		expect(captured[0]).not.toHaveProperty('workDischarge');
	});

	it('⭑⭑ a prompt is assembled with DERIVED placeholders, and is DRAFT unless armed', () => {
		// ⛔ `declaredPlaceholders` is derived by `markersIn` and never taken from the agent: it is the one grammar
		// for what a marker is, and letting a caller declare its own list would make the render guard check the
		// agent's claim about its own text rather than the text.
		const b = brokerFor();
		defineTool(b).run({
			name: 'T',
			pwuKind: 'K',
			workDischarge: 'MODEL',
			promptTemplateText: 'Assess {subject} against {criteria}.',
			promptOutputContract: 'JSON with findings[]'
		});
		const t = captured[0]!.promptTemplate as {
			declaredPlaceholders: string[];
			status: string;
			outputContract?: string;
		};
		expect(t.declaredPlaceholders.sort()).toEqual(['criteria', 'subject']);
		expect(t.outputContract).toBe('JSON with findings[]');
		expect(t.status, 'unarmed unless the agent says otherwise').toBe('DRAFT');
	});

	it('⛔ ARMING is explicit — promptActive true, and nothing else, makes it ACTIVE', () => {
		// THE MUTANT: treat any truthy value, or the template's presence, as arming. A DRAFT template is authored
		// text; an ACTIVE one is what a model is actually told, and the difference is a decision.
		const b = brokerFor();
		defineTool(b).run({
			name: 'T',
			pwuKind: 'K',
			workDischarge: 'MODEL',
			promptTemplateText: 'Do the thing.',
			promptActive: true
		});
		expect((captured[0]!.promptTemplate as { status: string }).status).toBe('ACTIVE');
	});

	it('⭑ CONTROL — no prompt text means no template at all, not an empty one', () => {
		// An empty template would be an authored instruction saying nothing, and `renderPromptTemplate` would have
		// to decide what that means. Absence is the honest representation.
		const b = brokerFor();
		defineTool(b).run({ name: 'T', pwuKind: 'K', promptActive: true, promptOutputContract: 'x' });
		expect(captured[0]).not.toHaveProperty('promptTemplate');
	});
});
