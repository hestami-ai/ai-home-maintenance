import { describe, it, expect } from 'vitest';
import { TECHNICAL_ANALYSIS_PROMPT } from '../../../lib/workflow/architecturePhase';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Technical Analysis', () => {
	it('produces a structurally valid technical analysis JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'technicalAnalysis',
			systemPrompt: TECHNICAL_ANALYSIS_PROMPT,
			buildPrompt: (fixture) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'TECHNICAL_ANALYSIS',
				taskInstruction: [
					'Treat this as a GREENFIELD project: there is no existing codebase to analyze.',
					'Set codebaseFindings to [] and note greenfield status in analysisSummary.',
					'Base technicalNotes and existingStack on the technology choices stated in the finalized intake plan above.',
					'Assess each of the 12 engineering domains based on the plan content.',
				].join(' '),
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				const required = ['analysisSummary', 'codebaseFindings', 'technicalNotes', 'existingStack', 'proposedApproach', 'engineeringDomainAssessment'];
				for (const key of required) {
					if (!(key in obj)) throw new Error(`missing required key: ${key}`);
				}
				if (typeof obj.analysisSummary !== 'string' || obj.analysisSummary.length < 50) {
					throw new Error('analysisSummary missing or too short');
				}
				if (!Array.isArray(obj.engineeringDomainAssessment)) {
					throw new Error('engineeringDomainAssessment must be an array');
				}
			},
			rubric: {
				name: 'Technical Analysis',
				criteria: [
					'Output is valid JSON with all six required top-level keys.',
					'analysisSummary addresses the actual goal stated in the brief, not generic boilerplate.',
					'existingStack references concrete technologies named in the finalized plan (e.g. databases, frameworks, infra).',
					'proposedApproach is actionable and grounded in the plan, not vague.',
					'engineeringDomainAssessment covers multiple of the 12 domains with specific evidence drawn from the plan.',
					'No invented data: all claims trace back to inputs in the brief.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
