/**
 * Pillar A — producer-side stable id minting for data-model entities + API
 * endpoints. Ids must be deterministic (from the natural key) and idempotent
 * (re-running yields the identical id → resume-safe).
 */
import { describe, it, expect } from 'vitest';
import {
  mintEntityId, mintEndpointId, mintEntityIds, mintEndpointIds,
} from '../../../../lib/orchestrator/phases/phase5/dataModelIdMinter';

describe('mintEntityId / mintEndpointId — deterministic natural-key ids', () => {
  it('derives a stable id from (component, name) and strips the comp- prefix', () => {
    expect(mintEntityId('comp-analytics', 'ClickStat')).toBe('DM-analytics-clickstat');
    expect(mintEntityId('comp-analytics', 'ClickStat')).toBe(mintEntityId('comp-analytics', 'ClickStat'));
    // Different component ⇒ different id; different entity ⇒ different id.
    expect(mintEntityId('comp-url', 'ClickStat')).not.toBe(mintEntityId('comp-analytics', 'ClickStat'));
  });

  it('endpoint id keys on (component, method, path)', () => {
    expect(mintEndpointId('comp-api', 'POST', '/shorten')).toBe('API-api-post-shorten');
    expect(mintEndpointId('comp-api', 'GET', '/shorten')).not.toBe(mintEndpointId('comp-api', 'POST', '/shorten'));
  });
});

describe('mintEntityIds / mintEndpointIds — idempotent in-place mint', () => {
  it('assigns ids and is a no-op (identical values) on re-run', () => {
    const content = { models: [{ component_id: 'comp-analytics', entities: [{ name: 'ClickStat', fields: [] }] }] };
    mintEntityIds(content);
    const first = content.models[0].entities[0].id;
    expect(first).toBe('DM-analytics-clickstat');
    mintEntityIds(content); // resume re-run
    expect(content.models[0].entities[0].id).toBe(first);
  });

  it('mints endpoint ids in place', () => {
    const content = { definitions: [{ component_id: 'comp-api', endpoints: [{ path: '/u', method: 'DELETE' }] }] };
    expect(mintEndpointIds(content)).toBe(1);
    expect(content.definitions[0].endpoints[0].id).toBe('API-api-delete-u');
  });
});
