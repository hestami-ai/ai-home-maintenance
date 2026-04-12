import { describe, it, expect } from 'vitest';
import { DECOMPOSITION_SYSTEM_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

/**
 * RAD probe: hand-picks the most-connected component from the upstream
 * Designing output and asks the model to decompose just that one.
 */
describe.skipIf(skip)('Ollama probe: RAD targeted decomposition', () => {
	it('produces a structurally valid sub-decomposition for one component', async () => {
		const result = await runArchitectureProbe({
			name: 'rad',
			systemPrompt: DECOMPOSITION_SYSTEM_PROMPT,
			upstreamProbeNames: ['designing'],
			buildPrompt: (fixture, upstream) => {
				const designing = upstream.designing as { components?: unknown[]; interfaces?: unknown[] } | undefined;
				const allComponents = Array.isArray(designing?.components) ? designing!.components : [];
				const target = allComponents
					.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
					.sort((a, b) => (Array.isArray(b.dependencies) ? b.dependencies.length : 0) - (Array.isArray(a.dependencies) ? a.dependencies.length : 0))[0]
					?? allComponents[0]
					?? { component_id: 'cmp-placeholder', label: 'Placeholder Component', responsibility: 'No upstream design available.' };

				return buildSubPhaseBriefing({
					fixture,
					subPhaseName: 'RAD (Targeted Decomposition)',
					upstream: {
						targetComponent: target,
						allComponents,
						allInterfaces: designing?.interfaces ?? [],
					},
					upstreamLabels: {
						targetComponent: 'Target Component (decompose THIS into sub-components)',
						allComponents: 'All Components (context only — do NOT redecompose these)',
						allInterfaces: 'All Interfaces (context for provider remapping)',
					},
					taskInstruction: 'Decompose the Target Component into sub-components and supporting interfaces. Sub-components must reference the target via parent_component_id. Together they must cover the target component\'s responsibility. Do not invent new sibling components outside the target subtree.',
				});
			},
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.components)) throw new Error('components must be an array');
				if (!Array.isArray(obj.interfaces)) throw new Error('interfaces must be an array');
				if (obj.components.length < 2) throw new Error(`RAD must produce at least 2 sub-components (got ${obj.components.length})`);
			},
			rubric: {
				name: 'RAD targeted decomposition',
				criteria: [
					'Output JSON has components[] (the new sub-components) and interfaces[].',
					'Sub-components have parent_component_id pointing at the target component.',
					'Sub-components together cover the original target component\'s responsibility.',
					'No sibling components hallucinated outside the target subtree.',
					'If interface_provider_remap is present, each entry references valid interface_ids and component_ids.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
