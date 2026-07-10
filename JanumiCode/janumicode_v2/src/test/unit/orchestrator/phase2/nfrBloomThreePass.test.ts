/**
 * Characterization tests for Phase 2.2b NFR threshold enrichment
 * (runEnrichmentPass). Pins the retry / success / exhaustion / catch /
 * missing-variables / missing-template branches, which the broader
 * Phase 2 product-lens integration suite only exercises on the happy
 * path. Uses a hand-rolled fake NfrBloomDeps so each branch is driven
 * deterministically without a database or real template corpus.
 */

import { describe, it, expect } from 'vitest';
import {
  runEnrichmentPass,
  type NfrBloomDeps,
} from '../../../../lib/orchestrator/phases/phase2/nfrBloomThreePass';
import type { NfrSkeleton } from '../../../../lib/orchestrator/phases/phase2/verifyNfrCoverage';

type CallForRole = (role: string, options: {
  traceContext?: { label?: string };
}) => Promise<{ parsed: Record<string, unknown> | null }>;

interface DepsOverrides {
  /** Enrichment template present? Default true. */
  enrichmentTemplate?: boolean;
  /** missing_variables returned by render(). Default []. */
  renderMissing?: string[];
  callForRole: CallForRole;
}

function makeDeps(opts: DepsOverrides): NfrBloomDeps {
  const template = { path: 'p', metadata: {}, body: 'b' };
  const emptyFmt = (): string => '';
  return {
    ctx: {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'sha',
        templateLoader: {
          findTemplate: (_role: string, name: string) =>
            name === 'nfr_bloom_enrichment' && opts.enrichmentTemplate === false
              ? null
              : template,
          render: () => ({ rendered: 'RENDERED', missing_variables: opts.renderMissing ?? [] }),
        },
        callForRole: opts.callForRole,
      },
    },
    handoff: {
      vvRequirements: [],
      technicalConstraints: [],
      complianceExtractedItems: [],
      qualityAttributes: [],
    },
    dmr: { activeConstraintsText: '', detailFilePath: '', detailFileContent: '' },
    intentSummary: '',
    frSummary: '',
    acceptedFrIds: [],
    format: {
      formatExtractedItems: emptyFmt,
      formatVVRequirements: emptyFmt,
      formatTechnicalConstraints: emptyFmt,
      formatJourneys: emptyFmt,
    },
  } as unknown as NfrBloomDeps;
}

function skeleton(over: Partial<NfrSkeleton> = {}): NfrSkeleton {
  return {
    id: 'NFR-1',
    category: 'security',
    description: 'd',
    priority: 'high',
    traces_to: ['VV-1'],
    ...over,
  };
}

describe('runEnrichmentPass — Phase 2.2b threshold enrichment', () => {
  it('enriches a skeleton with threshold + measurement_method from a complete response', async () => {
    const deps = makeDeps({
      callForRole: async () => ({ parsed: { threshold: 'T', measurement_method: 'M' } }),
    });
    const out = await runEnrichmentPass(deps, [skeleton()]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('NFR-1');
    expect(out[0].threshold).toBe('T');
    expect(out[0].measurement_method).toBe('M');
  });

  it('returns the skeletons array unchanged when the enrichment template is missing', async () => {
    let called = false;
    const input = [skeleton({ threshold: 'orig', measurement_method: 'origM' })];
    const deps = makeDeps({
      enrichmentTemplate: false,
      callForRole: async () => {
        called = true;
        return { parsed: {} };
      },
    });
    const out = await runEnrichmentPass(deps, input);
    // Same array reference returned; no LLM call made.
    expect(out).toBe(input);
    expect(called).toBe(false);
  });

  it('keeps the skeleton verbatim and skips the LLM call when template variables are missing', async () => {
    let called = false;
    const s = skeleton();
    const deps = makeDeps({
      renderMissing: ['detail_file_content'],
      callForRole: async () => {
        called = true;
        return { parsed: { threshold: 'T', measurement_method: 'M' } };
      },
    });
    const out = await runEnrichmentPass(deps, [s]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(s); // untouched skeleton reference
    expect(called).toBe(false);
  });

  it('retries when the first response is incomplete, then succeeds', async () => {
    let n = 0;
    const deps = makeDeps({
      callForRole: async () => {
        n += 1;
        // Attempt 1: missing measurement_method → parseEnrichmentResponse
        // returns the skeleton verbatim (no threshold) → retry.
        return n === 1
          ? { parsed: { threshold: 'T' } }
          : { parsed: { threshold: 'T', measurement_method: 'M' } };
      },
    });
    const out = await runEnrichmentPass(deps, [skeleton()]);
    expect(n).toBe(2);
    expect(out[0].threshold).toBe('T');
    expect(out[0].measurement_method).toBe('M');
  });

  it('retries when the LLM call throws, then succeeds', async () => {
    let n = 0;
    const deps = makeDeps({
      callForRole: async () => {
        n += 1;
        if (n === 1) throw new Error('boom');
        return { parsed: { threshold: 'T', measurement_method: 'M' } };
      },
    });
    const out = await runEnrichmentPass(deps, [skeleton()]);
    expect(n).toBe(2);
    expect(out[0].threshold).toBe('T');
    expect(out[0].measurement_method).toBe('M');
  });

  it('keeps the skeleton after exhausting all attempts on incomplete responses', async () => {
    let n = 0;
    const s = skeleton(); // no threshold/measurement_method
    const deps = makeDeps({
      callForRole: async () => {
        n += 1;
        return { parsed: {} };
      },
    });
    const out = await runEnrichmentPass(deps, [s]);
    expect(n).toBe(3); // ENRICHMENT_MAX_ATTEMPTS
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(s); // skeleton kept verbatim
    expect(out[0].threshold).toBeUndefined();
  });

  it('enriches each skeleton independently and preserves order', async () => {
    const deps = makeDeps({
      callForRole: async () => ({ parsed: { threshold: 'T', measurement_method: 'M' } }),
    });
    const out = await runEnrichmentPass(deps, [
      skeleton({ id: 'NFR-1' }),
      skeleton({ id: 'NFR-2' }),
    ]);
    expect(out.map(o => o.id)).toEqual(['NFR-1', 'NFR-2']);
    expect(out.every(o => o.threshold === 'T' && o.measurement_method === 'M')).toBe(true);
  });
});
