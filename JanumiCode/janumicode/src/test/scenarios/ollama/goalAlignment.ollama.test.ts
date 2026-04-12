import { describe, it, expect } from 'vitest';
import { GOAL_ALIGNMENT_SYSTEM_PROMPT } from '../../../lib/roles/architectureValidator';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Goal Alignment validator', () => {
	it('produces a structurally valid {score, findings} JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'goalAlignment',
			systemPrompt: GOAL_ALIGNMENT_SYSTEM_PROMPT,
			upstreamProbeNames: ['decomposing', 'designing'],
			buildPrompt: (fixture, upstream) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'VALIDATING — Goal Alignment',
				upstream,
				upstreamLabels: {
					decomposing: 'Architecture Decomposition (capabilities + workflows)',
					designing: 'Architecture Design (components + interfaces)',
				},
				taskInstruction: 'Score how well the upstream architecture aligns with the goal stated in this brief. Findings must reference specific capabilities, workflows, or components by ID. Note both alignments and gaps.',
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (typeof obj.score !== 'number') throw new Error('score must be a number');
				if (obj.score < 0 || obj.score > 1) throw new Error('score must be between 0 and 1');
				if (!Array.isArray(obj.findings)) throw new Error('findings must be an array');
			},
			rubric: {
				name: 'Goal Alignment',
				criteria: [
					'Output JSON has score (0..1) and findings[].',
					'score is calibrated to actual alignment, not always 1 or always 0.',
					'findings reference concrete capability_ids/component_ids/workflow_ids from the upstream architecture.',
					'findings note both alignments and gaps (not all positive, not all negative).',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
