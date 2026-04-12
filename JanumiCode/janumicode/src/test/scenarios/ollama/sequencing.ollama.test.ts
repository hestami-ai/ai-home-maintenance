import { describe, it, expect } from 'vitest';
import { SEQUENCING_SYSTEM_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Sequencing', () => {
	it('produces a structurally valid implementation_sequence JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'sequencing',
			systemPrompt: SEQUENCING_SYSTEM_PROMPT,
			upstreamProbeNames: ['designing'],
			buildPrompt: (fixture, upstream) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'SEQUENCING',
				upstream,
				upstreamLabels: { designing: 'Designing (upstream — components + interfaces)' },
				taskInstruction: 'Order the upstream components into an implementation sequence. Each step must reference component_ids that exist in the upstream design and depend only on earlier step_ids.',
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.implementation_sequence)) throw new Error('implementation_sequence must be an array');
				if (obj.implementation_sequence.length === 0) throw new Error('implementation_sequence is empty');
			},
			rubric: {
				name: 'Sequencing',
				criteria: [
					'Output JSON has non-empty implementation_sequence[].',
					'Each step has step_id, label, components_involved[], dependencies[], sort_order, verification_method.',
					'sort_order forms a valid total order (no duplicates, monotonic).',
					'dependencies reference earlier step_ids only (no forward refs, no cycles).',
					'components_involved reference component_ids that exist in the upstream design.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
