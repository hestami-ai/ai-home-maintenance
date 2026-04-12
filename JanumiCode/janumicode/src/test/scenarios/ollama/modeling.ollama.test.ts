import { describe, it, expect } from 'vitest';
import { MODELING_SYSTEM_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Modeling (data models)', () => {
	it('produces a structurally valid data model JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'modeling',
			systemPrompt: MODELING_SYSTEM_PROMPT,
			upstreamProbeNames: ['decomposing'],
			buildPrompt: (fixture, upstream) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'MODELING',
				upstream,
				upstreamLabels: { decomposing: 'Decomposing (upstream — capabilities + workflows)' },
				taskInstruction: 'Produce domain data models that satisfy the upstream capabilities and workflows. Each model must trace back to a capability_id from the upstream decomposition.',
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.data_models)) throw new Error('data_models must be an array');
				if (obj.data_models.length === 0) throw new Error('data_models is empty');
			},
			rubric: {
				name: 'Modeling',
				criteria: [
					'Output JSON has non-empty data_models[].',
					'Each data model has model_id, entity_name, fields[], relationships[], source_requirements[].',
					'Fields are typed and meaningful (not just id+name placeholders).',
					'Relationships form a coherent domain graph and reference valid model_ids.',
					'Models trace back to capabilities/workflows from the upstream decomposition.',
					'No invented data outside the brief.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
