import { describe, it, expect } from 'vitest';
import { DECOMPOSING_SYSTEM_PROMPT } from '../../../lib/roles/architectureExpert';
import { runArchitectureProbe, buildSubPhaseBriefing } from '../../helpers/architectureProbeRunner';

const skip = !process.env.OLLAMA_PROBE;

describe.skipIf(skip)('Ollama probe: Decomposing (capabilities + workflows)', () => {
	it('produces a structurally valid decomposition JSON', async () => {
		const result = await runArchitectureProbe({
			name: 'decomposing',
			systemPrompt: DECOMPOSING_SYSTEM_PROMPT,
			upstreamProbeNames: ['technicalAnalysis'],
			buildPrompt: (fixture, upstream) => buildSubPhaseBriefing({
				fixture,
				subPhaseName: 'DECOMPOSING',
				upstream,
				upstreamLabels: { technicalAnalysis: 'Technical Analysis (upstream)' },
				taskInstruction: 'Decompose the goal into capabilities and workflows. Each capability must trace back to source requirements stated in the finalized intake plan above.',
			}),
			validateStructure: (parsed) => {
				if (!parsed || typeof parsed !== 'object') throw new Error('parsed is not an object');
				const obj = parsed as Record<string, unknown>;
				if (!Array.isArray(obj.capabilities)) throw new Error('capabilities must be an array');
				if (!Array.isArray(obj.workflows)) throw new Error('workflows must be an array');
				if (obj.capabilities.length === 0) throw new Error('capabilities is empty');
				if (obj.workflows.length === 0) throw new Error('workflows is empty');

				// engineering_domain_mappings.domain MUST come from the canonical
				// 12-domain enum. Catches the "model invents WEB_APP / API_GATEWAY"
				// regression observed on the first decomposing run.
				const VALID_DOMAINS = new Set([
					'PROBLEM_MISSION', 'STAKEHOLDERS', 'SCOPE', 'CAPABILITIES',
					'WORKFLOWS_USE_CASES', 'DATA_INFORMATION', 'INTEGRATION_INTERFACES',
					'SECURITY_COMPLIANCE', 'QUALITY_ATTRIBUTES', 'ENVIRONMENT_OPERATIONS',
					'ARCHITECTURE', 'VERIFICATION_DELIVERY',
				]);
				const invalidDomains: string[] = [];
				for (const cap of obj.capabilities as Array<Record<string, unknown>>) {
					const mappings = cap.engineering_domain_mappings;
					if (!Array.isArray(mappings)) continue;
					for (const m of mappings as Array<Record<string, unknown>>) {
						const d = m.domain;
						if (typeof d === 'string' && !VALID_DOMAINS.has(d)) {
							invalidDomains.push(`${cap.capability_id}:${d}`);
						}
					}
				}
				if (invalidDomains.length > 0) {
					throw new Error(
						`engineering_domain_mappings contain ${invalidDomains.length} non-canonical domain(s); ` +
						`must be from the 12-domain enum. Examples: ${invalidDomains.slice(0, 5).join(', ')}`
					);
				}
			},
			rubric: {
				name: 'Decomposing',
				criteria: [
					'Output JSON has non-empty capabilities[] and workflows[].',
					'Each capability has capability_id, label, description, source_requirements, engineering_domain_mappings.',
					'Each workflow links to a capability via capability_id that appears in capabilities[].',
					'Capabilities are at sensible mid-level granularity (not single-component, not whole-system).',
					'engineering_domain_mappings.domain values come ONLY from the canonical 12-domain enum (PROBLEM_MISSION, STAKEHOLDERS, SCOPE, CAPABILITIES, WORKFLOWS_USE_CASES, DATA_INFORMATION, INTEGRATION_INTERFACES, SECURITY_COMPLIANCE, QUALITY_ATTRIBUTES, ENVIRONMENT_OPERATIONS, ARCHITECTURE, VERIFICATION_DELIVERY). No invented taxonomies like WEB_APP, API_GATEWAY, AUTHENTICATION, MOBILE_CLIENT.',
					'Every leaf capability has at least one workflow_id in its workflows[] (root/pillar capabilities may aggregate via children).',
					'Workflow IDs referenced in capabilities[].workflows are defined in workflows[] (no dangling refs, no hallucinated IDs).',
					'Decomposition reflects the actual goal and finalized plan, not generic templates.',
					'No invented data outside the brief.',
				],
			},
		});
		expect(result.verdict.passed).toBe(true);
	}, 90 * 60_000);
});
