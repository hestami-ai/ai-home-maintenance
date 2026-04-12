import { describe, it, expect } from 'vitest';
import { CONTEXT_ENGINEER_SYSTEM_PROMPT } from '../../../lib/context/contextEngineer';
import { Role, Phase } from '../../../lib/types/index';
import { runArchitectureProbe, buildContextEngineerStdinFromFixture } from '../../helpers/architectureProbeRunner';

// QUARANTINED: The Context Engineer is fundamentally a tool-using agent
// (it dispatches MCP retrieval tools to populate policy-required blocks).
// Probing it with no tool access is the wrong layer of test — it correctly
// reports "I can't retrieve anything" and fills the briefing with placeholders.
// Move this probe to a future tool-stub harness; for the prompt-template
// "walk the dog" suite, the sub-phase probes start at Technical Analysis /
// Decomposing and consume the intake handoff directly.
const skip = true; // !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Context Engineer briefing (quarantined)', () => {
	it('produces a structurally valid briefing JSON for the intake handoff', async () => {
		const result = await runArchitectureProbe({
			name: 'contextEngineer',
			systemPrompt: CONTEXT_ENGINEER_SYSTEM_PROMPT,
			buildPrompt: (fixture) =>
				buildContextEngineerStdinFromFixture(
					fixture,
					Role.TECHNICAL_EXPERT,
					Phase.ARCHITECTURE,
					'TECHNICAL_ANALYSIS'
				),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (typeof obj.briefing !== 'string' || obj.briefing.length < 100) {
					throw new Error('briefing missing or too short');
				}
				if (!Array.isArray(obj.sectionManifest)) throw new Error('sectionManifest missing or not an array');
				if (!obj.sufficiency || typeof obj.sufficiency !== 'object') throw new Error('sufficiency missing');
			},
			rubric: {
				name: 'Context Engineer briefing',
				criteria: [
					'Output is valid JSON with top-level briefing, sectionManifest, sufficiency.',
					'briefing references the actual goal text from the input.',
					'sectionManifest entries each name a concrete source (handoff_doc, db_query, static, agent_synthesized).',
					'sufficiency includes a boolean and a (possibly empty) missingRequired array.',
					'Briefing is dense with specific entities, not generic boilerplate.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
