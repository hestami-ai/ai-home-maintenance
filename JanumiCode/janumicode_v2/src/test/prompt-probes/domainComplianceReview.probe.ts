/**
 * Prompt probe: Domain Compliance Review (cross-cutting)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Domain Compliance Review', () => {
  it('produces compliance findings for GDPR-relevant artifact', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'domain_compliance_review_gdpr',
      templateKey: 'cross_cutting/domain_compliance_review.system',
      variables: {
        compliance_regimes: '- GDPR: EU data protection regulation requiring lawful basis for processing, data minimization, and right to erasure',
        artifact_type: 'data_models',
        artifact_content: `{
  "models": [{
    "component_id": "user_service",
    "entities": [{
      "name": "User",
      "fields": [
        {"name": "email", "type": "string"},
        {"name": "ip_address", "type": "string"},
        {"name": "browsing_history", "type": "json"}
      ]
    }]
  }]
}`,
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.overall_pass !== 'boolean') errors.push('Missing overall_pass');
        if (!Array.isArray(parsed.findings)) errors.push('Missing findings array');
        return errors;
      },
      judgeRubric: {
        name: 'Domain Compliance Review for GDPR-relevant data model',
        criteria: [
          'Output has overall_pass and findings keys',
          'GDPR concerns are surfaced for the User entity (which contains email, ip_address, browsing_history)',
          'At least one finding cites GDPR-relevant fields by name (email, ip_address, or browsing_history)',
          'Findings are grounded in the artifact content — no invented fields',
          'severity field is set on every finding',
        ],
        reasoningCriteria: [
          'The reviewer identified that ip_address and browsing_history are personal data under GDPR',
          'The reviewer did not flag GENERIC compliance concerns unrelated to the actual artifact',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
