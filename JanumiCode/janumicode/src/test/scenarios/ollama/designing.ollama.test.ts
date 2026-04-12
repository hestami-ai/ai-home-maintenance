import { describe, it, expect } from 'vitest';
import { DESIGNING_SYSTEM_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Designing (components + interfaces)', () => {
	it('produces a structurally valid design JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'designing',
			systemPrompt: DESIGNING_SYSTEM_PROMPT,
			upstreamProbeNames: ['decomposing', 'modeling'],
			buildPrompt: (fixture, upstream) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'DESIGNING',
				upstream,
				upstreamLabels: {
					decomposing: 'Decomposing (upstream — capabilities + workflows)',
					modeling: 'Modeling (upstream — data models)',
				},
				taskInstruction: 'Design the components and interfaces required to implement the upstream capabilities and data models. Components must serve specific workflows; interfaces must connect specific provider/consumer components by ID.',
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.components)) throw new Error('components must be an array');
				if (!Array.isArray(obj.interfaces)) throw new Error('interfaces must be an array');
				if (obj.components.length === 0) throw new Error('components is empty');
			},
			rubric: {
				name: 'Designing',
				criteria: [
					'Output JSON has non-empty components[] and interfaces[].',
					'Each component has component_id, label, responsibility, dependencies[], workflows_served[].',
					'Each interface has interface_id, type, provider_component, consumer_components[], contract.',
					'All component/interface ID references resolve within the same response (no dangling refs).',
					'Design covers the upstream capabilities and respects the data models.',
					'No invented data outside the brief.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
