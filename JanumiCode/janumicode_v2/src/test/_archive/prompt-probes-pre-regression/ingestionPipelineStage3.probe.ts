/**
 * Prompt probe: Ingestion Pipeline Stage III (cross-cutting)
 *
 * Tests Stage III of the Ingestion Pipeline — Relationship Extraction.
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Ingestion Pipeline Stage III', () => {
  it('extracts relationships for derived artifact', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'ingestion_stage3_derives_from',
      templateKey: 'cross_cutting/ingestion_pipeline_stage3.system',
      variables: {
        new_record_type: 'artifact_produced',
        new_record_content: '{"component_id": "auth_service", "endpoints": [{"path": "/login", "method": "POST"}]}',
        related_record_summaries: `[rec-001] component_model: {components: [{id: "auth_service", responsibilities: ["Handle user authentication"]}]}
[rec-002] interface_contracts: {contracts: [{id: "auth_api_v1", systems_involved: ["client", "auth_service"]}]}`,
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.proposed_edges)) errors.push('Missing proposed_edges array');
        return errors;
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
  }, 300000);
});
