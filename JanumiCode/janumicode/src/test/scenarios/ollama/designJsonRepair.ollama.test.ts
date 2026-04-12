import { describe, it, expect } from 'vitest';
import { DESIGN_JSON_REPAIR_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

/**
 * Probe for the DESIGN_JSON_REPAIR_PROMPT — this prompt is used as a fallback
 * when the Designing response is malformed JSON. We feed it a deliberately
 * broken design payload (trailing commas, unquoted keys, smart quotes) and
 * expect a clean parseable design JSON back.
 */
describe.skipIf(skip)('Ollama probe: Design JSON repair', () => {
	it('repairs deliberately malformed design JSON', async () => {
		const malformed = `{
  components: [
    {
      "component_id": "auth",
      "label": "Auth Service",
      "responsibility": "Handle login & session,",
      "dependencies": [],
    },
    {
      "component_id": "api",
      "label": "API Gateway",
      "responsibility": "Route requests",
      "dependencies": ["auth"]
    },
  ],
  "interfaces": [
    {
      "interface_id": "iface-login",
      "type": "rest",
      "provider_component": "auth",
      "consumer_components": ["api"],
      "contract": "POST /login → {token}",
    }
  ]
}`;

		const result = await runArchitectureProbe({
			name: 'designJsonRepair',
			systemPrompt: DESIGN_JSON_REPAIR_PROMPT,
			buildPrompt: () => [
				'Repair the following malformed JSON. Return ONLY the corrected JSON, no commentary.',
				'',
				malformed,
			].join('\n'),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object — repair failed');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.components)) throw new Error('components must be an array');
				if (!Array.isArray(obj.interfaces)) throw new Error('interfaces must be an array');
				if (obj.components.length !== 2) throw new Error(`expected 2 components, got ${obj.components.length}`);
				if (obj.interfaces.length !== 1) throw new Error(`expected 1 interface, got ${obj.interfaces.length}`);
			},
			rubric: {
				name: 'Design JSON repair',
				criteria: [
					'Output is valid parseable JSON with the original structure intact.',
					'No content was invented or removed — only syntax was corrected.',
					'Trailing commas, unquoted keys, and smart quotes are all fixed.',
					'components and interfaces preserve their original IDs and field values.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
